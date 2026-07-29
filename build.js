/* Zusammenbau: fuegt die Quellen aus src/ zu einer einzelnen HTML-Datei zusammen
   und schreibt sie nach dist/. Bewusst simpel: einlesen, in das Geruest einsetzen,
   schreiben. Kein Buendler, keine Abhaengigkeiten, kein node_modules.

   Vorgehen (UMZUG.md, Schritt 2): Solange src/index.html noch keine Platzhalter
   enthaelt, laeuft die Datei unveraendert durch. Beim Herausschneiden eines Moduls
   (Schritt 3) wird der Inline-Block in src/index.html durch einen Platzhalter
   ersetzt und hier ein Eintrag ergaenzt. */
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, 'src');
const DIST = path.join(__dirname, 'dist');
const OUT = path.join(DIST, 'geschaeftsobjekt-explorer.html');

// Jeder Eintrag ersetzt einen Platzhalter im Geruest durch den umschlossenen
// Inhalt einer Quelldatei. Noch leer -- die Datei laeuft unveraendert durch.
// Beispiel fuer Schritt 3:
//   { marker: '<!-- einsetzen: style.css -->', file: 'style.css', wrap: s => `<style>\n${s}\n</style>` },
const teile = [
  { marker: '<!-- einsetzen: style.css -->', file: 'style.css', wrap: s => `<style>\n${s}\n</style>` },
];

let html = fs.readFileSync(path.join(SRC, 'index.html'), 'utf8');

for (const t of teile) {
  if (!html.includes(t.marker)) {
    console.error(`build: Platzhalter fehlt im Geruest: ${t.marker}`);
    process.exit(1);
  }
  const inhalt = fs.readFileSync(path.join(SRC, t.file), 'utf8').replace(/\s+$/, '');
  html = html.replace(t.marker, () => t.wrap(inhalt));
}

fs.mkdirSync(DIST, { recursive: true });
fs.writeFileSync(OUT, html);
console.log(`build: ${path.relative(__dirname, OUT)} geschrieben (${teile.length} Teil(e) eingesetzt).`);
