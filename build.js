/* Zusammenbau: fuegt die Quellen aus src/ (und models/) zu einer einzelnen
   HTML-Datei zusammen und schreibt sie nach dist/. Bewusst simpel: einlesen,
   in das Geruest einsetzen, schreiben. Kein Buendler, keine Abhaengigkeiten,
   kein node_modules.

   Jeder Eintrag ersetzt einen Platzhalter im Geruest:
     module: Modul-Dateien unveraendert aneinanderreihen (der <script>-Rumpf)
     file + wrap: Dateiinhalt (ohne Leerraum am Ende) in eine Huelle setzen
   Reihenfolge zaehlt: 'skript' bringt die Marker fuer svg.css und das Modell
   erst ins Dokument, deren Eintraege stehen deshalb danach. */
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, 'src');
const MODELS = path.join(__dirname, 'models');
const DIST = path.join(__dirname, 'dist');
const OUT = path.join(DIST, 'geschaeftsobjekt-explorer.html');

const lies = (dir, f) => fs.readFileSync(path.join(dir, f), 'utf8');
const ohneLeerraumEnde = s => s.replace(/\s+$/, '');

const teile = [
  { marker: '<!-- einsetzen: style.css -->', file: 'style.css',
    wrap: s => `<style>\n${s}\n</style>` },

  { marker: '/* einsetzen: skript */',
    module: ['yaml.js', 'model.js', 'layout.js', 'render.js', 'app.js', 'route.js', 'edit.js', 'interaktion.js', 'hierarchie.js', 'pflege.js', 'ui.js'] },

  { marker: '/* einsetzen: svg.css */', file: 'svg.css',
    wrap: s => 'const SVG_CSS = `\n' + s + '\n`;' },

  { marker: '/* einsetzen: modell willibald-attr.yaml */', dir: MODELS, file: 'willibald-attr.yaml',
    wrap: s => 'const DEFAULT_YAML = `' + s + '\n`;' },

  { marker: '/* einsetzen: uebersicht willibald-übersicht.yaml */', dir: MODELS, file: 'williibald-übersicht.yaml',
    wrap: s => 'const DEFAULT_UEBERSICHT = `' + s + '\n`;' },
];

let html = lies(SRC, 'index.html');

for (const t of teile) {
  if (!html.includes(t.marker)) {
    console.error(`build: Platzhalter fehlt im Geruest: ${t.marker}`);
    process.exit(1);
  }
  const inhalt = t.module
    ? t.module.map(f => lies(SRC, f)).join('')
    : t.wrap(ohneLeerraumEnde(lies(t.dir || SRC, t.file)));
  html = html.replace(t.marker, () => inhalt);
}

fs.mkdirSync(DIST, { recursive: true });
fs.writeFileSync(OUT, html);
console.log(`build: ${path.relative(__dirname, OUT)} geschrieben (${teile.length} Teile).`);
