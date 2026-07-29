#!/usr/bin/env node
/* Bettet Schriftdateien als Base64 direkt in die HTML-Datei ein.
   Danach lädt die Anwendung nichts mehr nach — kein CDN, kein Netz, keine
   Übertragung von Nutzerdaten an Dritte.

   Aufruf:  node fonts-einbetten.js <schriftordner> [ziel.html]

   Ziel ist standardmäßig src/index.html (die Quelle mit den Marken). Danach
   `node build.js`, damit die einzelne dist-Datei die Schriften enthält.

   Der Ordner darf .woff2-Dateien in beliebiger Struktur enthalten. Die
   Zuordnung geschieht über den Dateinamen; erkannt werden IBM Plex Mono und
   Space Grotesk in den Schnitten 400, 500, 600 und 700. Liegt eine OFL.txt
   dabei, wird ihr Text als Kommentar mit eingebettet — die SIL Open Font
   License verlangt, dass Lizenz und Urhebervermerk mitgeliefert werden.
*/
const fs = require('fs');
const path = require('path');

const ordner = process.argv[2];
const ziel = process.argv[3] || path.join(__dirname, 'src', 'index.html');

if(!ordner){
  console.error('Aufruf: node fonts-einbetten.js <schriftordner> [ziel.html]');
  process.exit(2);
}

const FAMILIEN = [
  {name:'IBM Plex Mono',  muster:/ibmplexmono|ibm[-_]?plex[-_]?mono/i},
  {name:'Space Grotesk',  muster:/spacegrotesk|space[-_]?grotesk/i}
];
// Trennzeichen zwingend: sonst greift "Bold" auch in "SemiBold"
const GEWICHTE = [
  {w:400, muster:/[-_.](regular|400)\b/i},
  {w:500, muster:/[-_.](medium|500)\b/i},
  {w:600, muster:/[-_.](semibold|semi-bold|600)\b/i},
  {w:700, muster:/[-_.](bold|700)\b/i}
];

function alleDateien(dir){
  const out = [];
  for(const e of fs.readdirSync(dir, {withFileTypes:true})){
    const p = path.join(dir, e.name);
    if(e.isDirectory()) out.push(...alleDateien(p));
    else out.push(p);
  }
  return out;
}

const dateien = alleDateien(ordner);
const woff2 = dateien.filter(f => f.toLowerCase().endsWith('.woff2'));
if(!woff2.length){
  console.error('Keine .woff2-Datei in ' + ordner + ' gefunden.');
  console.error('Bezugsquellen: github.com/IBM/plex und github.com/floriankarsten/space-grotesk');
  process.exit(1);
}

const regeln = [];
const gefunden = [];
for(const fam of FAMILIEN){
  for(const g of GEWICHTE){
    const treffer = woff2.find(f=>{
      const b = path.basename(f);
      // Kursive und variable Schnitte überspringen
      if(/italic|oblique|\[wght\]|variable/i.test(b)) return false;
      return fam.muster.test(b) && g.muster.test(b);
    });
    if(!treffer) continue;
    const b64 = fs.readFileSync(treffer).toString('base64');
    regeln.push(
      `@font-face{font-family:'${fam.name}';font-style:normal;font-weight:${g.w};` +
      `font-display:swap;src:url(data:font/woff2;base64,${b64}) format('woff2')}`
    );
    gefunden.push(`${fam.name} ${g.w}  ←  ${path.basename(treffer)}  (${Math.round(fs.statSync(treffer).size/1024)} KB)`);
  }
}

if(!regeln.length){
  console.error('Keine passende Schrift erkannt. Erwartete Namen enthalten');
  console.error('"IBMPlexMono" bzw. "SpaceGrotesk" und einen Schnitt wie "Regular" oder "500".');
  process.exit(1);
}

// Lizenztexte mitnehmen, soweit vorhanden
const lizenzen = dateien
  .filter(f => /(^|[\\/])(OFL|LICENSE)(\.txt|\.md)?$/i.test(path.basename(f)))
  .map(f => `--- ${path.relative(ordner, f)} ---\n` + fs.readFileSync(f, 'utf8').trim());

const block = [
  '/* SCHRIFTEN-ANFANG */',
  '/* Eingebettet am ' + new Date().toISOString().slice(0,10) + '.',
  '   IBM Plex Mono und Space Grotesk stehen unter der SIL Open Font License 1.1.',
  '   Die OFL erlaubt das Einbetten und Weitergeben zusammen mit Software.',
  lizenzen.length
    ? '   Lizenztexte:\n' + lizenzen.join('\n\n').replace(/\*\//g, '* /').split('\n').map(l => '   ' + l).join('\n')
    : '   Lizenztext bitte als OFL.txt beilegen.',
  '*/',
  ...regeln,
  '/* SCHRIFTEN-ENDE */'
].join('\n');

let html = fs.readFileSync(ziel, 'utf8');
const von = html.indexOf('/* SCHRIFTEN-ANFANG */');
const bis = html.indexOf('/* SCHRIFTEN-ENDE */');
if(von < 0 || bis < 0){
  console.error('Marken /* SCHRIFTEN-ANFANG */ und /* SCHRIFTEN-ENDE */ nicht in ' + ziel + ' gefunden.');
  process.exit(1);
}
const vorher = Buffer.byteLength(html);
html = html.slice(0, von) + block + html.slice(bis + '/* SCHRIFTEN-ENDE */'.length);
fs.writeFileSync(ziel, html);

console.log('Eingebettet:');
gefunden.forEach(z => console.log('  ' + z));
console.log('Lizenztexte gefunden: ' + (lizenzen.length || 'keine — bitte OFL.txt beilegen'));
console.log('Datei: ' + ziel);
console.log('Größe: ' + Math.round(vorher/1024) + ' KB → ' + Math.round(Buffer.byteLength(html)/1024) + ' KB');
