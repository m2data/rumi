/* Gemeinsamer Start der Rauchtests: lädt die gebaute HTML, startet die echte
   App im Mini-DOM und reicht App-Zustand, API und Helfer an die Themendatei.
   Jede Themendatei bootet ihre EIGENE App-Instanz — so teilen die Themen
   keinen Zustand und lassen sich einzeln ausführen:

       node test/rauch/<thema>.js [pfad/zur/geschaeftsobjekt-explorer.html]
*/
const fs = require('fs');
const path = require('path');
const {createDom, dispatch} = require('../domshim');

async function bootApp(file){
  const FILE = file || process.argv[2]
    || path.join(__dirname, '..', '..', 'dist', 'geschaeftsobjekt-explorer.html');
  const html = fs.readFileSync(FILE, 'utf8');
  const script = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)]
    .map(m => m[1]).filter(s => s.includes('function'))[0];

  const {document} = createDom(html);
  const win = {
    addEventListener(){}, requestAnimationFrame(f){ f(0); },
    setTimeout:(f)=>0, clearTimeout(){}, storage:undefined,
    localStorage:{ _d:{}, getItem(k){ return this._d[k] ?? null; }, setItem(k,v){ this._d[k]=v; }, removeItem(k){ delete this._d[k]; } },
    sessionStorage:{ _d:{}, getItem(k){ return this._d[k] ?? null; }, setItem(k,v){ this._d[k]=v; }, removeItem(k){ delete this._d[k]; } },
    CSS:{ escape:s=>String(s).replace(/["\\]/g,'\\$&') },
    URL:{ createObjectURL:()=>'blob:x', revokeObjectURL(){} },
    Blob:function(){}, Image:function(){}, FileReader:function(){}
  };

  let S, api = {};
  const runner = new Function('document','window','localStorage','sessionStorage','CSS','URL','Blob','Image','FileReader',
    'setTimeout','clearTimeout','__expose', script + '\n__expose({S, draw, drawEdges, setView, persist, routePoints, edgeKey, ALGOS, rerouteEdges, applyContent, nearestPort, nodeMarkup, contentOf, materializeOrtho, setMode, selectDiagram, exportSVG, outlineAdd, outlineRename, outlineDelete, outlineMove, addRelated, loadUebersicht, setSelection, arrangeSelection, uebersichtName, undo, redo, renderMessages, mergeGoText, loadDelta, loadYaml, spreadLabels, polyPoint, measure, boot, loopGeom, loopPoint, exportPNG, pflegeStart, pflegeSpeichern, pflegeEnde, pflegeObjektNeu, pflegeObjektWeg, goObjektAendern, goUmbenennen, goObjektLoeschen, goObjektAnlegen, uebersichtObjekt, renderDetails});');
  runner(document, win, win.localStorage, win.sessionStorage, win.CSS, win.URL, win.Blob, win.Image, win.FileReader,
         win.setTimeout, win.clearTimeout, o => { api = o; S = o.S; });

  // boot() ist asynchron — offene Mikrotasks abarbeiten lassen
  for(let k=0;k<50;k++) await Promise.resolve();

  return {S, api, win, document, svg: document.getElementById('canvas'), dispatch, FILE, html};
}

/* Zähler und Abschluss — dieselbe Ausgabe wie bisher, je Themendatei. */
function makeT(){
  let fail = 0, pass = 0;
  const t = (name, cond, info)=>{
    if(cond){ pass++; console.log('  ok   ' + name); }
    else { fail++; console.log('  FEHL ' + name + (info ? '  → ' + info : '')); }
  };
  const finish = ()=>{
    console.log('\n' + (fail ? fail + ' von ' + (fail+pass) + ' Prüfungen fehlgeschlagen'
                             : 'Alle ' + pass + ' Prüfungen bestanden'));
    process.exit(fail ? 1 : 0);
  };
  return {t, finish};
}

module.exports = {bootApp, makeT};
