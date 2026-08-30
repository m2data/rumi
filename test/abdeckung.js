/* Zeilenabdeckung der Testsuite, je Modul in src/:

       node test/abdeckung.js

   Baut zusammen, startet die vier Testeinstiege je in einem eigenen Prozess
   mit eingeschalteter V8-Coverage und rechnet deren Offsets auf die Dateien in
   src/ zurück. Läuft bewusst NICHT in der Pflichtkette — er führt die ganze
   Suite ein zweites Mal aus; er ist zum Nachsehen da, wo Prüfungen fehlen.

   Rückgabewert 0, solange die Suite grün ist (die Zahl selbst ist kein Tor).

   Warum der Umweg über den Hook: die App wird in den Tests über `new Function`
   ausgeführt, V8 meldet solche Skripte ohne url. abdeckung-hook.js schreibt die
   Rümpfe mit, hier werden Skript und Rumpf über die Länge zusammengeführt. */
const fs = require('fs');
const os = require('os');
const path = require('path');
const {spawnSync} = require('child_process');

const WURZEL = path.join(__dirname, '..');
const SRC = path.join(WURZEL, 'src');
/* Reihenfolge wie in build.js — nur für die Ausgabe, gefunden wird per Suche. */
const MODULE = ['yaml.js', 'model.js', 'layout.js', 'render.js', 'app.js', 'route.js',
                'edit.js', 'interaktion.js', 'hierarchie.js', 'pflege.js', 'ui.js'];
const EINSTIEGE = ['smoke.js', 'model.test.js', 'layout.test.js', 'outline.test.js'];
/* build.js ersetzt in einzelnen Modulen diese Marker — der gebaute Text weicht
   dort vom Dateitext ab, deshalb wird segmentweise gesucht. */
const MARKER = /\/\* einsetzen:[^*]*\*\//g;

const quelle = Object.fromEntries(MODULE.map(m => [m, fs.readFileSync(path.join(SRC, m), 'utf8')]));

/* ---------- Messlauf ---------- */

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'abdeckung-'));
const covDir = path.join(tmp, 'cov'), rumpfDir = path.join(tmp, 'ruempfe');
fs.mkdirSync(covDir); fs.mkdirSync(rumpfDir);

const lauf = (datei, umgebung) =>
  spawnSync(process.execPath, [path.join(WURZEL, datei)],
            {stdio:'ignore', env: Object.assign({}, process.env, umgebung || {})});

if(lauf('build.js').status){ console.error('abdeckung: Zusammenbau fehlgeschlagen'); process.exit(1); }

const umgebung = {
  NODE_V8_COVERAGE: covDir,
  ABDECKUNG_RUEMPFE: rumpfDir,
  /* Schrägstriche: NODE_OPTIONS frisst Rückstriche in Anführungszeichen auf */
  NODE_OPTIONS: '--require "' + path.join(__dirname, 'abdeckung-hook.js').split(path.sep).join('/') + '"'
};
let rot = 0;
for(const e of EINSTIEGE){
  process.stdout.write('  ' + e + ' … ');
  const r = lauf(path.join('test', e), umgebung);
  console.log(r.status ? 'FEHL' : 'ok');
  if(r.status) rot++;
}
if(rot) console.log('\nAchtung: ' + rot + ' Einstieg(e) rot — die Zahlen unten sind unvollständig.\n');

/* ---------- Auswertung ---------- */

/* Aus einem mitgeschriebenen Rumpf die Länge des Skripts errechnen, das V8
   daraus baut: (function anonymous(<params>\n) {\n<rumpf>\n}) */
const ruempfe = fs.readdirSync(rumpfDir).map(f => {
  const {params, body} = JSON.parse(fs.readFileSync(path.join(rumpfDir, f), 'utf8'));
  const huelle = '(function anonymous(' + params.join(',') + '\n) {\n';
  return {huelle, body, laenge: huelle.length + body.length + '\n})'.length};
});

/* Deckungsfeld je Rumpf. Wichtig: erst innerhalb EINES Skripts auswerten
   (dort überschreibt der engere Bereich den weiteren), dann über die Prozesse
   hinweg verodern. Andersherum löscht ein nie betretener Zweig aus Prozess A,
   was Prozess B durchlaufen hat — die Quote hängt dann an der Dateireihenfolge. */
const deckung = new Map();                // Index im Rümpfe-Feld -> Uint8Array
for(const f of fs.readdirSync(covDir)){
  const j = JSON.parse(fs.readFileSync(path.join(covDir, f), 'utf8'));
  for(const s of j.result){
    if(s.url !== '') continue;            // nur die eval-Skripte
    let ende = 0;
    for(const fn of s.functions) for(const r of fn.ranges) ende = Math.max(ende, r.endOffset);
    const i = ruempfe.findIndex(x => x.laenge === ende);
    if(i < 0) continue;
    const {huelle, body} = ruempfe[i];
    const liste = [];
    for(const fn of s.functions) for(const r of fn.ranges) liste.push(r);
    liste.sort((a, b) => (b.endOffset - b.startOffset) - (a.endOffset - a.startOffset));
    const lokal = new Uint8Array(body.length);
    for(const r of liste)
      lokal.fill(r.count > 0 ? 1 : 0,
                 Math.max(0, r.startOffset - huelle.length),
                 Math.min(body.length, r.endOffset - huelle.length));
    if(!deckung.has(i)) deckung.set(i, new Uint8Array(body.length));
    const summe = deckung.get(i);
    for(let k = 0; k < lokal.length; k++) if(lokal[k]) summe[k] = 1;
  }
}

/* Ein Modul im Rumpf wiederfinden: an den Markern zerlegen und die Stücke der
   Reihe nach suchen. Rückgabe: Zuordnung Dateioffset -> Rumpfoffset. */
function segmente(body, src){
  const stuecke = [];
  let pos = 0;
  for(const m of src.matchAll(MARKER)){ stuecke.push([pos, m.index]); pos = m.index + m[0].length; }
  stuecke.push([pos, src.length]);
  const res = [];
  let cursor = 0;
  for(const [a, b] of stuecke){
    if(b - a < 20) continue;              // Restschnipsel neben einem Marker
    const at = body.indexOf(src.slice(a, b), cursor);
    if(at < 0) return null;
    res.push({von: a, nach: at, laenge: b - a});
    cursor = at + (b - a);
  }
  return res.length ? res : null;
}

/* Zeile zählt als Code, wenn sie nicht leer, kein Kommentar und keine reine
   Klammerzeile ist — sonst schönt die Quote sich selbst. */
const NURKLAMMER = ['}', '{', '};', '});', ')', ');', '],', '];'];
const istCode = z => {
  const t = z.trim();
  return !!t && !t.startsWith('//') && !t.startsWith('/*') && !t.startsWith('*') && !NURKLAMMER.includes(t);
};

const stand = Object.fromEntries(MODULE.map(m => [m, {code: new Set(), deckt: new Set()}]));

for(const [i, gedeckt] of deckung){
  const {body} = ruempfe[i];
  for(const m of MODULE){
    const segs = segmente(body, quelle[m]);
    if(!segs) continue;                   // Modul steckt nicht in diesem Rumpf
    let off = 0, nr = 0;
    for(const zeile of quelle[m].split('\n')){
      nr++;
      if(istCode(zeile)){
        const seg = segs.find(s => off >= s.von && off + zeile.length <= s.von + s.laenge);
        if(seg){
          stand[m].code.add(nr);
          const b = seg.nach + (off - seg.von);
          for(let k = 0; k < zeile.length; k++) if(gedeckt[b + k]){ stand[m].deckt.add(nr); break; }
        }
      }
      off += zeile.length + 1;
    }
  }
}

/* ---------- Ausgabe ---------- */

let gCode = 0, gDeckt = 0;
const zeilen = MODULE.map(m => {
  const c = stand[m].code.size, d = stand[m].deckt.size;
  gCode += c; gDeckt += d;
  return [m, quelle[m].split('\n').length, c, d, c ? 100*d/c : 0];
}).sort((a, b) => a[4] - b[4]);

console.log('\nModul            Zeilen  Code  gedeckt   %');
for(const [m, g, c, d, p] of zeilen)
  console.log(m.padEnd(16) + String(g).padStart(6) + String(c).padStart(6) + String(d).padStart(9) + p.toFixed(0).padStart(5));
console.log('-'.repeat(45));
console.log('gesamt'.padEnd(16) + ''.padStart(6) + String(gCode).padStart(6) + String(gDeckt).padStart(9) +
            (gCode ? (100*gDeckt/gCode).toFixed(0) : '0').padStart(5));

const luecken = [];
for(const m of MODULE){
  const {code, deckt} = stand[m];
  let von = null, bis = null;
  for(const nr of [...code].sort((a, b) => a - b)){
    if(!deckt.has(nr)){ if(von === null) von = nr; bis = nr; }
    else if(von !== null){ luecken.push([m, von, bis]); von = null; }
  }
  if(von !== null) luecken.push([m, von, bis]);
}
luecken.sort((a, b) => (b[2]-b[1]) - (a[2]-a[1]));
console.log('\nLängste ungedeckte Strecken:');
for(const [m, a, b] of luecken.slice(0, 20))
  console.log('  ' + (m + ':' + a + '–' + b).padEnd(26) + (b-a+1) + ' Zeilen');

fs.rmSync(tmp, {recursive: true, force: true});
process.exit(rot ? 1 : 0);
