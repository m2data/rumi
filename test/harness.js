/* Lädt einzelne src-Module ohne Browser in einen gemeinsamen Gültigkeitsbereich
   und gibt die gewünschten Symbole heraus. So lassen sich Modell- und Layout-
   Funktionen prüfen, ohne die ganze App zu starten (das tut smoke.js).

   Die Module sind als Skript-Rumpf gedacht, nicht als Node-Module — deshalb
   derselbe Kniff wie in smoke.js: alles in eine Funktion legen, benötigte
   Globale (document, S) hineinreichen, Symbole über __expose herausgeben. */
const fs = require('fs');
const path = require('path');
const {createDom} = require('./domshim');

function load(modules, symbols){
  const dir = path.join(__dirname, '..', 'src');
  const src = modules.map(m => fs.readFileSync(path.join(dir, m), 'utf8')).join('\n');

  const {document} = createDom('<div></div>');
  const S = {};                       // Zustand: nur was contentOf() beim Aufruf liest
  const win = { addEventListener(){}, requestAnimationFrame(f){ f(0); },
                setTimeout:()=>0, clearTimeout(){} };

  const runner = new Function('document', 'window', 'S', '__expose',
    src + `\n__expose({${symbols.join(', ')}});`);

  let api = {};
  runner(document, win, S, o => { api = o; });
  return {api, S, document};
}

module.exports = {load};
