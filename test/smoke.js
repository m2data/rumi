/* Rauchtest: startet die echte App im Mini-DOM und klickt sie durch.
   Deckt genau die Wege ab, die sich durch reine Codeprüfung nicht sichern lassen. */
const fs = require('fs');
const path = require('path');
const {createDom, dispatch} = require('./domshim');

const FILE = process.argv[2] || path.join(__dirname, '..', 'dist', 'geschaeftsobjekt-explorer.html');
const html = fs.readFileSync(FILE, 'utf8');
const script = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)]
  .map(m => m[1]).filter(s => s.includes('function'))[0];

const {document, root} = createDom(html);
const win = {
  addEventListener(){}, requestAnimationFrame(f){ f(0); },
  setTimeout:(f)=>0, clearTimeout(){}, storage:undefined,
  localStorage:{ _d:{}, getItem(k){ return this._d[k] ?? null; }, setItem(k,v){ this._d[k]=v; }, removeItem(k){ delete this._d[k]; } },
  CSS:{ escape:s=>String(s).replace(/["\\]/g,'\\$&') },
  URL:{ createObjectURL:()=>'blob:x', revokeObjectURL(){} },
  Blob:function(){}, Image:function(){}, FileReader:function(){}
};

let fail = 0, pass = 0;
const t = (name, cond, info)=>{
  if(cond){ pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FEHL ' + name + (info ? '  → ' + info : '')); }
};

// App im eigenen Gültigkeitsbereich starten
let S, api = {};
const runner = new Function('document','window','localStorage','CSS','URL','Blob','Image','FileReader',
  'setTimeout','clearTimeout','__expose', script + '\n__expose({S, draw, drawEdges, setView, persist, routePoints, edgeKey, ALGOS, rerouteEdges, applyContent, nearestPort, nodeMarkup, contentOf, materializeOrtho, setMode, selectDiagram, exportSVG, outlineAdd, outlineRename, outlineDelete, outlineMove, addRelated, loadUebersicht, setSelection, arrangeSelection, uebersichtName, undo, redo, renderMessages, mergeGoText, loadDelta, spreadLabels, polyPoint, measure});');

try{
  runner(document, win, win.localStorage, win.CSS, win.URL, win.Blob, win.Image, win.FileReader,
         win.setTimeout, win.clearTimeout, o => { api = o; S = o.S; });
}catch(err){
  console.log('  FEHL App startet nicht  → ' + err.message);
  console.log(err.stack.split('\n').slice(0,4).join('\n'));
  process.exit(1);
}

// boot() ist asynchron — offene Mikrotasks abarbeiten lassen
(async ()=>{
for(let k=0;k<50;k++) await Promise.resolve();

console.log('== Start ==');
t('Modell geladen', S.model && Object.keys(S.model.objects).length === 11,
  S.model ? Object.keys(S.model.objects).length + ' Objekte' : 'kein Modell');
t('Graph aufgebaut', S.graph && S.graph.nodes.length > 0);
t('Kanten gezeichnet', document.getElementById('edges').children.length > 0,
  document.getElementById('edges').children.length + ' Gruppen');
t('Knoten gezeichnet', document.getElementById('nodes').children.length > 0);

console.log('== Kante auswählen ==');
const svg = document.getElementById('canvas');
const hit = document.getElementById('edges').querySelectorAll('.e-hit')[0];
t('Klickfläche vorhanden', !!hit);
if(hit){
  dispatch(hit, 'pointerdown', {clientX:100, clientY:100});
  t('Kante ist ausgewählt', !!S.selEdge, 'selEdge=' + S.selEdge);
  const H = document.getElementById('handles');
  t('Griffe erscheinen', H.children.length > 0, H.children.length + ' Elemente');
  t('Anschlusspunkte vorhanden', H.querySelectorAll('.pt').length === 2,
    H.querySelectorAll('.pt').length + ' Stück');
}

console.log('== Stützpunkt einsetzen und ziehen ==');
const H = document.getElementById('handles');
const ghost = H.querySelectorAll('.gh')[0];
t('Geisterpunkt vorhanden', !!ghost);
if(ghost){
  const e = S.graph.edges.find(x => x.id === S.selEdge);
  const vor = e.bends ? e.bends.length : 0;
  dispatch(ghost, 'pointerdown', {clientX:100, clientY:100});
  const nach = e.bends ? e.bends.length : 0;
  t('Stützpunkte kamen dazu', nach > vor, vor + ' → ' + nach);
  dispatch(svg, 'pointermove', {clientX:180, clientY:150});
  dispatch(svg, 'pointerup', {clientX:180, clientY:150});
  t('Kante gilt als von Hand bearbeitet', e.manual === true);
}

console.log('== Stützpunkt verschieben ==');
const hnd = document.getElementById('handles').querySelectorAll('.hnd')[0];
t('Stützpunktgriff vorhanden', !!hnd);
if(hnd){
  const e = S.graph.edges.find(x => x.id === S.selEdge);
  const i = +hnd.dataset.bend;
  const vor = {x:e.bends[i].x, y:e.bends[i].y};
  dispatch(hnd, 'pointerdown', {clientX:200, clientY:200});
  dispatch(svg, 'pointermove', {clientX:260, clientY:240});
  dispatch(svg, 'pointerup', {});
  t('Stützpunkt hat sich bewegt', e.bends[i].x !== vor.x || e.bends[i].y !== vor.y,
    `${vor.x},${vor.y} → ${e.bends[i].x},${e.bends[i].y}`);
}

console.log('== Anschlusspunkt verschieben ==');
const pt = document.getElementById('handles').querySelectorAll('.pt')[0];
if(pt){
  const e = S.graph.edges.find(x => x.id === S.selEdge);
  const vor = e.portFrom ? e.portFrom.side + ':' + e.portFrom.t.toFixed(2) : 'keiner';
  dispatch(pt, 'pointerdown', {clientX:300, clientY:300});
  dispatch(svg, 'pointermove', {clientX:80, clientY:420});
  dispatch(svg, 'pointerup', {});
  const nach = e.portFrom ? e.portFrom.side + ':' + e.portFrom.t.toFixed(2) : 'keiner';
  t('Anschlusspunkt hat sich geändert', vor !== nach, vor + ' → ' + nach);
}

console.log('== Anschlusspunkt ohne Stützpunkt verschieben ==');
{
  // Zustand wie nach einem Knotenzug: beide Ports gelöscht, kein Stützpunkt.
  // Genau hier ließ sich der Anschlusspunkt früher erst nach dem Setzen eines
  // Stützpunkts verschieben (Bug: routePoints beachtete einen einzelnen Port nicht).
  const e = S.graph.edges.find(x => x.from !== x.to
    && !S.graph.byId.get(x.from).hidden && !S.graph.byId.get(x.to).hidden);
  t('Kante vorhanden', !!e);
  if(e){
    e.portFrom = null; e.portTo = null; e.bends = null; e.manual = false;
    S.selEdge = e.id; api.draw();
    const A = S.graph.byId.get(e.from), B = S.graph.byId.get(e.to);
    const pfadD = ()=>{
      const g = document.getElementById('edges').querySelector('[data-id="' + e.id + '"]');
      const p = g && g.querySelector('.e-path');
      return p ? p.getAttribute('d') : null;
    };
    const vor = api.routePoints(e, A, B)[0];
    const dVor = pfadD();
    const griff = document.getElementById('handles').querySelectorAll('.pt')
      .find(c => c.dataset.port === 'from');
    t('Anschlusspunktgriff vorhanden', !!griff);
    if(griff){
      dispatch(griff, 'pointerdown', {clientX:120, clientY:120});
      dispatch(svg, 'pointermove', {clientX:60, clientY:480});
      dispatch(svg, 'pointerup', {});
      const nach = api.routePoints(e, A, B)[0];
      t('Griffpunkt bewegt sich ohne Stützpunkt',
        Math.abs(nach.x - vor.x) > 0.5 || Math.abs(nach.y - vor.y) > 0.5,
        `(${vor.x.toFixed(1)},${vor.y.toFixed(1)}) → (${nach.x.toFixed(1)},${nach.y.toFixed(1)})`);
      // Der eigentliche Fehler: der Griff wanderte, die gezeichnete Kante nicht.
      t('gezeichnete Kante folgt dem Anschlusspunkt', pfadD() && pfadD() !== dVor);
      t('ein einzelner Anschlusspunkt genügt (der andere bleibt frei)',
        !!e.portFrom && !e.portTo && (!e.bends || !e.bends.length));
    }
  }
}

console.log('== Segment einer rechtwinkligen Kante ==');
document.getElementById('layoutMenu').querySelectorAll('[data-algo]')
  .filter(b => b.dataset.algo === 'ortho').forEach(b => b.onclick && b.onclick());
const eo = S.graph.edges.find(x => x.ortho && x.bends && x.bends.length);
t('Orthogonal erzeugt Knicke', !!eo);
if(eo){
  S.selEdge = eo.id; api.draw();
  const seg = document.getElementById('handles').querySelectorAll('.seg')[0];
  t('Segmentbalken vorhanden', !!seg);
  if(seg){
    const before = JSON.stringify(eo.bends);
    dispatch(seg, 'pointerdown', {clientX:400, clientY:400});
    dispatch(svg, 'pointermove', {clientX:470, clientY:470});
    dispatch(svg, 'pointerup', {});
    t('Teilstück wurde verschoben', JSON.stringify(eo.bends) !== before);
  }
}

console.log('== Ortho: diagonal gezogener Anschlusspunkt bleibt bearbeitbar ==');
{
  // Ortho-Kante ohne Knick, Anschlusspunkte auf senkrechten Seiten -> die
  // direkte Verbindung läuft schräg. Ohne Materialisierung zeichnet der
  // Ortho-Zweig von drawHandles dafür weder Segment- noch Stützpunktgriff:
  // die Kante ließe sich weder schieben noch mit einem Stützpunkt versehen.
  const e = S.graph.edges.find(x => x.ortho && x.from !== x.to
    && !S.graph.byId.get(x.from).hidden && !S.graph.byId.get(x.to).hidden);
  t('Ortho-Kante vorhanden', !!e);
  if(e){
    e.bends = null; e.portFrom = {side:'R', t:0.5}; e.portTo = {side:'T', t:0.5}; e.manual = true;
    S.selEdge = e.id; api.draw();
    const H = () => document.getElementById('handles');
    const ghVor = H().querySelectorAll('.gh').length, segVor = H().querySelectorAll('.seg').length;
    // Neu: auch die schräge Direktverbindung bietet einen Zusatzpunkt-Griff
    // (Sicherheitsnetz in drawHandles), damit sich dort ein Stützpunkt setzen lässt.
    t('schräge Ortho-Direktverbindung bietet einen Zusatzpunkt-Griff', ghVor >= 1,
      `gh=${ghVor}, seg=${segVor}`);

    const gesetzt = api.materializeOrtho(e);
    api.draw();
    t('schräge Ortho-Kante bekommt echte Knicke', gesetzt && e.bends && e.bends.length >= 2,
      'bends=' + (e.bends ? e.bends.length : 0));
    const ghNach = H().querySelectorAll('.gh').length, segNach = H().querySelectorAll('.seg').length;
    t('Segment- und Stützpunktgriffe erscheinen', ghNach > 0 && segNach > 0,
      `gh=${ghNach}, seg=${segNach}`);
  }
}

console.log('== Kantenzüge überleben Ansichtswechsel ==');
{
  const e = S.graph.edges.find(x => x.manual && x.bends);
  if(e){
    const key = api.edgeKey(e), snap = JSON.stringify(e.bends);
    api.setView(2); api.setView(1);
    const back = S.graph.edges.find(x => api.edgeKey(x) === key);
    t('Von Hand gelegter Zug ist wieder da', back && back.bends && back.bends.length > 0);
  } else t('Von Hand gelegter Zug ist wieder da', false, 'keine manuelle Kante gefunden');
}

console.log('== Knoten und Auswahl ==');
{
  const g = document.getElementById('nodes').querySelectorAll('.node')[0];
  const n = S.graph.byId.get(g.dataset.id);
  const ox = n.x;
  dispatch(g, 'pointerdown', {clientX:0, clientY:0});
  dispatch(svg, 'pointermove', {clientX:60, clientY:30});
  dispatch(svg, 'pointerup', {clientX:60, clientY:30});
  t('Knoten verschoben', n.x !== ox, ox + ' → ' + n.x);
}

console.log('== Doppelklick auf eine Kante löscht ihre Stützpunkte ==');
{
  api.setView(1);
  const e = S.graph.edges.find(x=>{
    const A = S.graph.byId.get(x.from), B = S.graph.byId.get(x.to);
    return A && B && !A.hidden && !B.hidden && x.from !== x.to;
  });
  e.bends = [{x:10, y:10}, {x:20, y:20}]; e.portFrom = {side:'B', t:0.4}; e.portTo = {side:'T', t:0.6}; e.manual = true;
  api.drawEdges();
  const findEg = () => [...document.getElementById('edges').querySelectorAll('.eg')].find(g => g.dataset.id === e.id);
  const eg1 = findEg();
  t('Kantengruppe im DOM gefunden', !!eg1);
  if(eg1){
    // 1. Klick wählt die Kante aus -> darüber erscheinen Segment-/Zusatzpunkt-Griffe
    dispatch(eg1, 'pointerdown', {timeStamp: 1000});
    // 2. Klick landet realistisch auf so einem Griff (nicht auf der .eg-Gruppe);
    //    er muss dennoch löschen, nicht einen Stützpunkt setzen.
    const handle = document.getElementById('handles').querySelector('.gh, .seg, .hnd');
    t('Griffe der gewählten Kante vorhanden', !!handle);
    dispatch(handle || findEg(), 'pointerdown', {timeStamp: 1120});
    t('zweiter Klick auf einem Griff löscht die Stützpunkte (statt einen zu setzen)', e.bends === null);
    t('Doppelklick setzt auf die kürzeste Verbindung (Anschlusspunkte gelöst)',
      !e.portFrom && !e.portTo && e.ortho === false);
    S.selEdge = e.id; api.draw();
    t('die gerade Verbindung bietet wieder einen Zusatzpunkt-Griff',
      document.getElementById('handles').querySelectorAll('.gh').length >= 1);
    S.selEdge = null;
    // ein langsamer zweiter Klick löscht NICHT
    const e2 = S.graph.edges.find(x=>{
      const A = S.graph.byId.get(x.from), B = S.graph.byId.get(x.to);
      return A && B && !A.hidden && !B.hidden && x.from !== x.to && x.id !== e.id;
    });
    if(e2){
      e2.bends = [{x:5,y:5}]; e2.manual = true; api.drawEdges();
      const g = () => [...document.getElementById('edges').querySelectorAll('.eg')].find(x=>x.dataset.id===e2.id);
      dispatch(g(), 'pointerdown', {timeStamp: 5000});
      dispatch(g(), 'pointerdown', {timeStamp: 5800});   // >350 ms
      t('einzelne Klicks lassen die Stützpunkte stehen', Array.isArray(e2.bends) && e2.bends.length === 1);
    }
  }
}

console.log('== Manuelle Kante folgt dem gewählten Verfahren (eckig/rund) ==');
{
  api.setView(1);
  const pick = ()=> S.graph.edges.find(x=>{
    const A = S.graph.byId.get(x.from), B = S.graph.byId.get(x.to);
    return A && B && !A.hidden && !B.hidden && x.from !== x.to;
  });
  const insertWaypoint = ()=>{
    const e = pick(); e.bends = null; e.ortho = false; S.selEdge = e.id; api.draw();
    const gh = document.getElementById('handles').querySelector('.gh');
    if(gh){ dispatch(gh, 'pointerdown', {clientX:0, clientY:0}); dispatch(svg, 'pointerup', {}); }
    return e;
  };
  S.layout.algo = 'ortho';
  const eo = insertWaypoint();
  t('orthogonal: manuell eingefügter Punkt macht die Kante eckig (ortho=true)', eo.ortho === true);
  S.layout.algo = 'hier';
  const eh = insertWaypoint();
  t('hierarchisch: manuell eingefügter Punkt bleibt rund (ortho=false)', eh.ortho === false);
  S.selEdge = null; S.layout.algo = 'hier';
}

console.log('== Ortho: Direktlinie ziehen -> 2 Punkte, Löschen bleibt eckig ==');
{
  api.setView(1);
  const e = S.graph.edges.find(x=>{
    const A = S.graph.byId.get(x.from), B = S.graph.byId.get(x.to);
    return A && B && !A.hidden && !B.hidden && x.from !== x.to;
  });
  e.bends = null; e.portFrom = null; e.portTo = null; e.ortho = false; e.manual = true;   // kürzeste Direktlinie
  S.layout.algo = 'ortho'; S.layout.dir = 'TB'; S.selEdge = e.id; api.draw();
  const gh = document.getElementById('handles').querySelector('.gh');
  t('Direktlinie hat einen Zusatzpunkt-Griff', !!gh);
  if(gh){
    dispatch(gh, 'pointerdown', {clientX:0, clientY:0});
    dispatch(svg, 'pointermove', {clientX:0, clientY:40});
    dispatch(svg, 'pointerup', {clientX:0, clientY:40});
    t('Ziehen der Direktlinie ergibt genau zwei Stützpunkte (nicht vier)',
      Array.isArray(e.bends) && e.bends.length === 2, 'bends=' + (e.bends ? e.bends.length : 0));
    t('gezogene Direktlinie ist eckig (ortho=true)', e.ortho === true);
    // alle drei Strecken achsparallel (90°): über die echten Anschlusspunkte prüfen
    {
      const A = S.graph.byId.get(e.from), B = S.graph.byId.get(e.to);
      const pp = (n,p)=>{ const tt = Math.min(0.92, Math.max(0.08, p.t));
        return p.side==='T'?{x:n.x+n.w*tt,y:n.y}:p.side==='B'?{x:n.x+n.w*tt,y:n.y+n.h}:p.side==='L'?{x:n.x,y:n.y+n.h*tt}:{x:n.x+n.w,y:n.y+n.h*tt}; };
      const pts = [pp(A, e.portFrom), ...e.bends, pp(B, e.portTo)];
      let alle90 = true;
      for(let k=0;k<pts.length-1;k++){ const dx=Math.abs(pts[k+1].x-pts[k].x), dy=Math.abs(pts[k+1].y-pts[k].y); if(dx>=1 && dy>=1) alle90 = false; }
      t('alle drei Strecken sind rechtwinklig (kein schräges Stück am Objekt)', alle90);
    }
    S.selEdge = e.id; api.draw();
    const hnd = document.getElementById('handles').querySelector('.hnd');
    if(hnd){
      dispatch(hnd, 'pointerdown', {clientX:0, clientY:0, altKey:true});
      t('Löschen eines Punkts bleibt eckig statt geschwungen (ortho=true)', e.ortho === true);
    }
  }
  S.selEdge = null; S.layout.algo = 'hier';
}

console.log('== Beziehungs-Label frei entlang der Kante verschiebbar ==');
{
  api.setView(1);
  const e = S.graph.edges.find(x=>{
    const A = S.graph.byId.get(x.from), B = S.graph.byId.get(x.to);
    return A && B && !A.hidden && !B.hidden && x.from !== x.to;
  });
  e.label = 'testkante'; e.bends = [{x:100, y:100}, {x:200, y:100}]; e.ortho = true; e.labelT = null;
  api.drawEdges();
  const hit = document.querySelector('.e-lbl-hit[data-lbl="' + e.id + '"]');
  t('Label hat ein Zieh-Feld an der Kante', !!hit);
  if(hit){
    const A = S.graph.byId.get(e.from), B = S.graph.byId.get(e.to);
    const p1 = api.routePoints(e, A, B)[0];              // Kantenanfang
    const cx = p1.x * S.t.k + S.t.x, cy = p1.y * S.t.k + S.t.y;
    dispatch(hit, 'pointerdown', {clientX:0, clientY:0});
    dispatch(svg, 'pointermove', {clientX:cx, clientY:cy});
    dispatch(svg, 'pointerup', {clientX:cx, clientY:cy});
    t('Ziehen setzt die Label-Position entlang der Kante (labelT in [0,1])',
      typeof e.labelT === 'number' && e.labelT >= 0 && e.labelT <= 1, 'labelT=' + e.labelT);
    t('Label wandert zum Kantenanfang', e.labelT < 0.25, 'labelT=' + e.labelT);
  }
  S.selEdge = null;
}

console.log('== Auto-Layout entzerrt überlappende Beziehungs-Labels ==');
{
  api.setView(1);
  // Zwei beschriftete Kanten mit vier verschiedenen Knoten auf identische, lange
  // Gerade zwingen -> ihre Labels liegen bei Mitte übereinander.
  const chosen = []; const used = new Set();
  for(const e of S.graph.edges){
    if(!e.label || e.from === e.to || used.has(e.from) || used.has(e.to)) continue;
    chosen.push(e); used.add(e.from); used.add(e.to);
    if(chosen.length === 2) break;
  }
  t('zwei beschriftete Kanten für den Test gefunden', chosen.length === 2);
  if(chosen.length === 2){
    const [e1, e2] = chosen;
    const A1=S.graph.byId.get(e1.from), B1=S.graph.byId.get(e1.to), A2=S.graph.byId.get(e2.from), B2=S.graph.byId.get(e2.to);
    A1.x=A2.x=0; A1.y=A2.y=0; B1.x=B2.x=2000; B1.y=B2.y=0;
    [e1,e2].forEach(e=>{ e.bends=null; e.portFrom=null; e.portTo=null; e.labelT=null; e.ortho=false; });
    const F='500 10px "IBM Plex Mono", monospace';
    const rect=e=>{ const A=S.graph.byId.get(e.from),B=S.graph.byId.get(e.to);
      const p=api.polyPoint(api.routePoints(e,A,B), e.labelT!=null?e.labelT:0.5); const w=api.measure(e.label,F)+8;
      return {x:p.x-w/2,y:p.y-7,w,h:14}; };
    const hit=(r,s)=> r.x<s.x+s.w&&s.x<r.x+r.w&&r.y<s.y+s.h&&s.y<r.y+r.h;
    t('vor der Entzerrung überlappen die beiden Labels', hit(rect(e1), rect(e2)));
    api.spreadLabels();
    t('nach der Entzerrung überlappen sie nicht mehr', !hit(rect(e1), rect(e2)),
      'labelT: ' + e1.labelT + ' / ' + e2.labelT);
    t('eine der Beschriftungen wurde entlang ihrer Kante verschoben',
      e1.labelT != null || e2.labelT != null);
  }
}

console.log('== Rückgängig / Wiederherstellen ==');
{
  api.setView(1);
  const id = S.graph.nodes.find(x => !x.hidden).id;
  const ox = S.graph.byId.get(id).x, oy = S.graph.byId.get(id).y;
  const nn = S.graph.byId.get(id);
  nn.x = ox + 200; nn.y = oy + 150; api.persist();          // Aktion: verschieben
  api.undo();
  const a1 = S.graph.byId.get(id);
  t('Rückgängig stellt die vorige Position her',
    Math.round(a1.x) === Math.round(ox) && Math.round(a1.y) === Math.round(oy),
    `x ${Math.round(a1.x)} statt ${Math.round(ox)}`);
  api.redo();
  const a2 = S.graph.byId.get(id);
  t('Wiederherstellen bringt die Änderung zurück',
    Math.round(a2.x) === Math.round(ox + 200) && Math.round(a2.y) === Math.round(oy + 150),
    `x ${Math.round(a2.x)} statt ${Math.round(ox + 200)}`);
}

console.log('== Klick markiert und behält die Auswahl ==');
{
  // Regressions: ein einfacher Klick (pointerdown ohne Verschieben, dann pointerup)
  // muss den Knoten markiert lassen. Früher hob das pointerup die frisch gesetzte
  // Auswahl sofort wieder auf — markiert blieb es nur, wenn man leicht verschob.
  const nodeById = id => [...document.getElementById('nodes').querySelectorAll('.node')]
    .find(e => e.dataset.id === id);
  S.sel = new Set(); S.selected = null;                       // sauber leer starten
  const edgeSig = ()=> JSON.stringify(S.graph.edges.map(e=>
    (e.portFrom ? e.portFrom.side : '-') + ':' + (e.bends ? e.bends.length : 0)));
  const first = document.getElementById('nodes').querySelectorAll('.node')[0];
  const id = first.dataset.id;
  const sigVor = edgeSig();
  dispatch(first, 'pointerdown', {clientX:0, clientY:0});
  dispatch(svg, 'pointerup', {clientX:0, clientY:0});          // Klick ohne Verschieben
  t('einfacher Klick markiert den Knoten', S.sel.has(id) && S.sel.size === 1,
    'sel=[' + [...S.sel].join(',') + ']');
  t('Klick ohne Verschieben zieht die Kanten nicht neu', edgeSig() === sigVor);

  const again = nodeById(id);                                 // draw() hat neu gezeichnet
  dispatch(again, 'pointerdown', {clientX:0, clientY:0});
  dispatch(svg, 'pointerup', {clientX:0, clientY:0});
  t('erneuter Klick hebt die einzelne Auswahl auf', !S.sel.has(id) && S.sel.size === 0);

  const c = nodeById(id);
  dispatch(c, 'pointerdown', {clientX:0, clientY:0});
  dispatch(svg, 'pointerup', {clientX:0, clientY:0});
  t('dritter Klick markiert wieder', S.sel.has(id) && S.sel.size === 1);
}

console.log('== Verfahren wirkt nur auf die Auswahl, wenn ein Bereich markiert ist ==');
{
  api.setView(1);
  const ids = ['o:LieferDienst', 'o:Lieferung', 'o:Position'].filter(id => S.graph.byId.get(id));
  const sel = new Set(ids);
  // Auswahl absichtlich übereinanderlegen, damit das Anordnen sie trennen muss
  ids.forEach((id, i) => { const n = S.graph.byId.get(id); n.x = i * 4; n.y = i * 4; });
  const posBefore = new Map(S.graph.nodes.filter(n => !n.hidden).map(n => [n.id, n.x + ',' + n.y]));
  api.setSelection(ids);
  // wie in der App: ein Verfahren aus dem Menü wählen, während der Bereich markiert ist
  [...document.getElementById('layoutMenu').querySelectorAll('.opt[data-algo]')]
    .find(b => b.dataset.algo === 'hier').onclick();
  let othersMoved = 0;
  posBefore.forEach((v, id) => { if(!sel.has(id) && (S.graph.byId.get(id).x + ',' + S.graph.byId.get(id).y) !== v) othersMoved++; });
  t('nicht markierte Objekte bleiben liegen', othersMoved === 0, othersMoved + ' bewegt');
  const sn = ids.map(id => S.graph.byId.get(id));
  let overlap = 0;
  for(let i = 0; i < sn.length; i++) for(let j = i + 1; j < sn.length; j++){
    const a = sn[i], b = sn[j];
    if(a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) overlap++;
  }
  t('die angeordnete Auswahl überlappt sich nicht mehr', overlap === 0, overlap + ' Überlappungen');
  api.setSelection([]);
}

console.log('== Kanten neu ziehen respektiert die Auswahl ==');
{
  api.setView(1);
  S.graph.edges.forEach(e=>{ e.bends = [{x:-999, y:-999}]; });   // Sentinel: „nicht neu gezogen"
  const someEdge = S.graph.edges.find(e=>{
    const A = S.graph.byId.get(e.from), B = S.graph.byId.get(e.to);
    return A && B && !A.hidden && !B.hidden && e.from !== e.to;
  });
  const sel = [someEdge.from, someEdge.to];
  const selSet = new Set(sel);
  api.setSelection(sel);
  const inList  = S.graph.edges.filter(e => selSet.has(e.from) || selSet.has(e.to));
  const outList = S.graph.edges.filter(e => !(selSet.has(e.from) || selSet.has(e.to)));
  [...document.getElementById('layoutMenu').querySelectorAll('[data-route]')].find(b => b.dataset.route === 'all').onclick();
  const sent = e => e.bends && e.bends.length === 1 && e.bends[0].x === -999;
  t('nur die Kanten der Auswahl werden neu gezogen', inList.length > 0 && inList.every(e => !sent(e)),
    inList.filter(e=>!sent(e)).length + '/' + inList.length);
  t('Kanten außerhalb der Auswahl bleiben unverändert', outList.every(sent),
    outList.filter(sent).length + '/' + outList.length);
  api.setSelection([]);
}

console.log('== Hierarchie-Export leitet den Namen vom Modell ab ==');
{
  const prev = S.fileName;
  S.fileName = 'sap-finanz.yaml';
  t('Hierarchiename = Basisname + -hierarchie', api.uebersichtName() === 'sap-finanz-hierarchie.yaml', api.uebersichtName());
  S.fileName = 'willibald-attr.yaml';
  t('funktioniert auch für ein anderes Modell', api.uebersichtName() === 'willibald-attr-hierarchie.yaml', api.uebersichtName());
  S.fileName = prev;
}

console.log('== Inhaltsauswahl ==');
{
  const btn = document.getElementById('contentList').querySelectorAll('[data-content]')
    .filter(b => b.dataset.content === 'attrs')[0];
  t('Schaltfläche Attribute vorhanden', !!btn);
  if(btn){
    const vorher = S.graph.byId.get('o:Bestellung').h;
    btn.onclick();
    const nachher = S.graph.byId.get('o:Bestellung').h;
    t('Kasten wird höher mit Attributen', nachher > vorher, vorher + ' → ' + nachher);
    const svgTxt = document.getElementById('nodes').innerHTML;
    t('attr-Kürzel im Diagramm', svgTxt.includes('>attr<'));
    t('Beschreibungsbox erst nach Auswahl', !svgTxt.includes('n-desc-bg'));
    btn.onclick();
  }
}

console.log('== Hinweise gruppieren und aufklappen ==');
{
  const prev = S.model.messages;
  S.model.messages = [
    {level:'warn', title:'Alpha: keine Domain', body:'Feld fehlt.'},
    {level:'warn', title:'Beta: keine Domain',  body:'Feld fehlt.'},
    {level:'warn', title:'Gamma: keine Domain', body:'Feld fehlt.'},
    {level:'err',  title:'Alpha → Ziel: Ziel unbekannt', body:'weg.'}
  ];
  api.renderMessages();
  const ml = document.getElementById('msgList');
  const groups = ml.querySelectorAll('.mgroup').length;
  const total = ml.querySelectorAll('.msg').length;
  t('gleiche Hinweise werden zu einer Gruppe zusammengefasst', groups === 1, groups + ' Gruppen');
  t('ein einzelner Hinweis bleibt einzeln', total - groups === 1, (total - groups) + ' einzelne');
  const head = ml.querySelector('.mgh');
  t('Gruppe ist zunächst eingeklappt', head.getAttribute('aria-expanded') === 'false');
  t('Gruppe listet ihre Objekte', ml.querySelectorAll('.mgi').length === 3);
  dispatch(head, 'click', {});
  t('Klick klappt die Gruppe auf', document.getElementById('msgList').querySelector('.mgh').getAttribute('aria-expanded') === 'true');
  // Hinweise ohne ":" im Titel (variable Stelle mittendrin) gruppieren über das group-Feld
  S.model.messages = [
    {level:'info', group:'Quelle mehrfach genutzt', title:'Quelle "S1" mehrfach genutzt', body:'a'},
    {level:'info', group:'Quelle mehrfach genutzt', title:'Quelle "S2" mehrfach genutzt', body:'b'}
  ];
  api.renderMessages();
  t('auch Hinweise ohne ":" im Titel werden gruppiert', document.getElementById('msgList').querySelectorAll('.mgroup').length === 1);
  S.model.messages = prev;
  api.renderMessages();
}

console.log('== Domänen zusammenklappen ==');
{
  api.setView(1);
  const before = document.getElementById('objectList').querySelectorAll('li.row').length;
  const caret = document.getElementById('objectList').querySelector('.gcaret');
  t('Domänen-Kopf hat einen Klapp-Pfeil', !!caret);
  if(caret){
    dispatch(caret, 'click', {});
    const after = document.getElementById('objectList').querySelectorAll('li.row').length;
    t('Zuklappen blendet die Objektzeilen der Domäne aus', after < before, before + ' → ' + after);
    dispatch(document.getElementById('objectList').querySelector('.gcaret'), 'click', {});
    const restored = document.getElementById('objectList').querySelectorAll('li.row').length;
    t('Aufklappen zeigt sie wieder', restored === before, before + ' → ' + restored);
  }
}

console.log('== Kurztasten greifen nicht in Eingabefeldern ==');
{
  api.setView(1);
  dispatch(document.getElementById('search'), 'keydown', {key:'2'});
  t('Ziffer im Suchfeld wechselt die Ansicht nicht', S.view === 1, 'view=' + S.view);
  dispatch(document.getElementById('canvas'), 'keydown', {key:'2'});
  t('Ziffer außerhalb eines Feldes wechselt die Ansicht', S.view === 2, 'view=' + S.view);
  api.setView(1);
}

console.log('== Kein Text klebt am Kastenrand ==');
{
  // Misst den untersten gezeichneten Inhalt gegen die Kastenhöhe, in jeder
  // Kombination der Inhaltsauswahl. Deckt Rundungs- und Additionsfehler in
  // der Höhenrechnung auf, die man auf dem Bildschirm leicht übersieht.
  const tief = n=>{
    const mk = api.nodeMarkup(n, '');
    let maxY = 0;
    for(const m of mk.matchAll(/<text[^>]*\by="([-\d.]+)"/g)) maxY = Math.max(maxY, +m[1]);
    for(const m of mk.matchAll(/<rect class="n-desc-bg"[^>]*\by="([-\d.]+)"[^>]*height="([-\d.]+)"/g))
      maxY = Math.max(maxY, +m[1] + +m[2]);
    return n.h - maxY;
  };
  const kombis = [
    ['nur Beschreibung',  {desc:1}],
    ['Beschreibung+Domain',{desc:1,domain:1}],
    ['nur Domain',        {domain:1}],
    ['nur Keys',          {keys:1}],
    ['nur Quellen',       {sources:1}],
    ['nur Attribute',     {attrs:1}],
    ['Attribute ohne Typ',{attrs:1,types:0}],
    ['alles',             {desc:1,domain:1,keys:1,sources:1,attrs:1,types:1}]
  ];
  let schlimmster = 99, wo = '';
  kombis.forEach(([name, c])=>{
    S.content[1] = Object.assign({desc:false,domain:false,keys:false,sources:false,attrs:false,keysOnly:false,types:true},
      Object.fromEntries(Object.entries(c).map(([k,v])=>[k,!!v])));
    api.setView(1);
    S.graph.nodes.filter(n=>n.kind!=='source').forEach(n=>{
      const d = tief(n);
      if(d < schlimmster){ schlimmster = d; wo = name + '/' + n.name; }
    });
  });
  t('Abstand Text zu Kastenrand mindestens 5 px', schlimmster >= 5, schlimmster + ' px bei ' + wo);
  S.content[1] = {};
  api.setView(1);
}

console.log('== Zweiter Weg: Kante aus dem Detailbereich ==');
{
  S.selEdge = null;
  api.setView(1);
  const nb = document.getElementById('objectList').querySelectorAll('button[data-id]')
    .find(b => b.dataset.id === 'o:Kunde');
  if(nb) dispatch(nb, 'click', {});
  const pick = document.getElementById('detailBody').querySelectorAll('.pickedge')[0];
  t('Schaltfläche "Kante" im Detailbereich', !!pick, pick ? pick.dataset.edge : '');
  if(pick){
    dispatch(pick, 'click', {});
    t('Kante darüber ausgewählt', !!S.selEdge, 'selEdge=' + S.selEdge);
    t('Griffe erscheinen', document.getElementById('handles').querySelectorAll('.pt').length === 2);
  }
}

console.log('== Absicherung: Exportschalter bleibt nicht hängen ==');
{
  const vorher = document.getElementById('edges').querySelectorAll('.e-hit').length;
  t('Klickflächen vor Export', vorher > 0, vorher + '');
  t('Exportschalter aus', S.exporting === false);
}

console.log('== Absicherung: hängendes Ziehen blockiert nicht ==');
{
  const g = document.getElementById('nodes').querySelectorAll('.node')[0];
  const n = S.graph.byId.get(g.dataset.id);
  const hnd0 = document.getElementById('handles').querySelectorAll('.hnd')[0]
            || document.getElementById('handles').querySelectorAll('.pt')[0];
  if(hnd0) dispatch(hnd0, 'pointerdown', {clientX:0, clientY:0});   // pointerup fehlt absichtlich
  const ox = n.x;
  dispatch(g, 'pointerdown', {clientX:0, clientY:0});
  dispatch(svg, 'pointermove', {clientX:44, clientY:22});
  dispatch(svg, 'pointerup', {});
  t('Knoten trotz abgebrochenem Ziehen beweglich', n.x !== ox, ox + ' → ' + n.x);
}

console.log('== Herkunft: Metadaten gelesen, aber nicht angezeigt ==');
{
  const m = S.model.meta;
  t('Modellkopf gelesen', !!(m && m.urheber && m.lizenz), m ? m.urheber + ' / ' + m.lizenz : 'fehlt');
  const box = document.getElementById('herkunft');
  t('Herkunft nicht in der Seitenleiste angezeigt', box.hidden === true && box.textContent === '');
}

console.log('== Hierarchie-Modus: Baum, Ausschnitt, Beschreibung ==');
{
  api.setMode('hierarchie');
  t('Modus ist Hierarchie', S.mode === 'hierarchie');
  t('Baum sichtbar, Beschreibung-Reiter aktiv',
    document.getElementById('hierTree').hidden === false
    && !!document.querySelector('.sidetab[data-pane="beschreibung"][aria-selected="true"]'));
  const rows = document.getElementById('hierTree').querySelectorAll('.dnode');
  t('Baum zeigt mehrere Diagramme', rows.length >= 4, rows.length + ' Knoten');
  const ziel = [...rows].find(r => r.dataset.id.endsWith('›Lieferung'));
  t('Unterdiagramm „Lieferung“ im Baum', !!ziel, ziel && ziel.dataset.id);
  if(ziel){
    api.selectDiagram(ziel.dataset.id);
    const sichtbar = S.graph.nodes.filter(n => !n.hidden).map(n => n.name).sort();
    t('nur die Objekte des Diagramms sichtbar',
      JSON.stringify(sichtbar) === JSON.stringify(['Bestellung','Kunde','Lieferadresse','Lieferung','Position']),
      sichtbar.join(','));
    t('Beschreibung zum gewählten Diagramm angezeigt',
      (document.querySelector('.hd-title') || {}).textContent === 'Lieferung'
      && (document.querySelector('.hd-text') || {}).textContent.length > 0);

    // Inhalt einblenden darf den Ausschnitt nicht auf alle Objekte aufblähen
    {
      const cbtn = document.getElementById('contentList').querySelectorAll('[data-content]')[0];
      t('Inhalt-Schaltfläche vorhanden', !!cbtn);
      if(cbtn){
        cbtn.onclick();
        t('Inhalt umschalten behält den Diagramm-Ausschnitt',
          S.graph.nodes.filter(n => !n.hidden).length === 5,
          S.graph.nodes.filter(n => !n.hidden).length + ' sichtbar');
      }
    }

    // Editierbar wie die Komplettansicht: Knoten ziehen, je Diagramm gemerkt
    const g = document.getElementById('nodes').querySelectorAll('.node')[0];
    const node = S.graph.byId.get(g.dataset.id);
    const nodeId = node.id, ox = node.x;
    dispatch(g, 'pointerdown', {clientX:120, clientY:120});
    dispatch(svg, 'pointermove', {clientX:230, clientY:190});
    dispatch(svg, 'pointerup', {});
    t('Knoten im Diagramm verschiebbar', node.x !== ox, ox + ' → ' + node.x);
    const merk = S.hierSaved[S.hierSel] && S.hierSaved[S.hierSel][nodeId];
    t('Anordnung je Diagramm gemerkt', merk && Math.abs(merk.x - node.x) < 0.5);
    // anderes Diagramm und zurück: Position bleibt erhalten
    api.selectDiagram('Übersicht');
    api.selectDiagram(ziel.dataset.id);
    const wieder = S.graph.byId.get(nodeId);
    t('gemerkte Anordnung überlebt den Diagrammwechsel',
      wieder && merk && Math.abs(wieder.x - merk.x) < 0.5, (merk && merk.x) + ' → ' + (wieder && wieder.x));

    // Reiter „Objekte“: ALLE Objekte zur Auswahl, angehakt = im Diagramm
    const listBtns = document.getElementById('objectList').querySelectorAll('button[data-id]');
    t('Objektliste bietet alle Objekte zur Auswahl', listBtns.length === 11, listBtns.length + '');
    const zeilen = document.getElementById('objectList').querySelectorAll('li.row');
    const aktiv = [...zeilen].filter(li => !li.classList.contains('off')).length;
    t('nur die Diagramm-Objekte sind angehakt', aktiv === 5, aktiv + ' von ' + zeilen.length);
    dispatch(listBtns[0], 'click', {});
    const db = document.getElementById('detailBody');
    t('Details-Reiter zeigt das gewählte Objekt', !db.hidden && db.textContent.length > 0);

    // Weiteres GO ins Diagramm holen (Objekt, das nicht in der YAML-Liste steht)
    const chkNeu = [...document.getElementById('objectList').querySelectorAll('.ochk')].find(c => !c.checked);
    const neuId = chkNeu.dataset.id;
    chkNeu.checked = true; dispatch(chkNeu, 'change', {});
    t('weiteres Objekt ins Diagramm geholt',
      S.graph.byId.get(neuId).hidden === false
      && (S.hierShown[S.hierSel] || []).includes(neuId) && !S.hidden.has(neuId));
    api.selectDiagram('Übersicht'); api.selectDiagram(ziel.dataset.id);
    t('hinzugeholtes Objekt bleibt im Diagramm', S.graph.byId.get(neuId).hidden === false);
    const chkWeg = [...document.getElementById('objectList').querySelectorAll('.ochk')].find(c => c.dataset.id === neuId);
    if(chkWeg){ chkWeg.checked = false; dispatch(chkWeg, 'change', {}); }   // zurücksetzen

    // Beschreibung in der App bearbeiten: leichtes Markdown, gespeichert, gerendert
    const beschrTab = [...document.querySelectorAll('.sidetab')].find(s => s.dataset.pane === 'beschreibung');
    dispatch(beschrTab, 'click', {});
    dispatch(document.getElementById('hdEdit'), 'click', {});
    const area = document.getElementById('hdArea');
    t('Bearbeiten öffnet ein Textfeld', !!area);
    if(area){
      area.value = '# Lieferkette\n\nEin **wichtiger** Ablauf.';
      dispatch(document.getElementById('hdSave'), 'click', {});
      t('Beschreibung gespeichert', S.hierText[S.hierSel] === '# Lieferkette\n\nEin **wichtiger** Ablauf.');
      const rendered = document.querySelector('.hd-text').innerHTML;
      t('Markdown gerendert (Überschrift + fett)',
        rendered.includes('<h2>Lieferkette</h2>') && rendered.includes('<strong>wichtiger</strong>'));
      api.selectDiagram('Übersicht'); api.selectDiagram(ziel.dataset.id);
      t('bearbeitete Beschreibung überlebt den Diagrammwechsel',
        S.hierText[ziel.dataset.id] === '# Lieferkette\n\nEin **wichtiger** Ablauf.');
      // Export trägt Titel und Beschreibung des Diagramms
      const svgOut = api.exportSVG();
      t('SVG-Export enthält Titel und Beschreibung',
        svgOut.includes('hx-ttl') && svgOut.includes('>Lieferung<')
        && svgOut.includes('hx-dsc') && svgOut.includes('Lieferkette'));
    }

    // Struktur bearbeiten: Unterdiagramm anlegen, umbenennen, löschen
    const dId = api.outlineAdd('Übersicht', 'Testthema');
    t('Unterdiagramm angelegt und gewählt', dId === 'Übersicht›Testthema' && S.hierSel === dId);
    t('Baum zeigt das neue Diagramm',
      !!document.querySelector('#hierTree .dnode[data-id="Übersicht›Testthema"]'));
    api.outlineRename(dId, 'Umbenannt');
    t('Diagramm umbenannt', S.hierSel === 'Übersicht›Umbenannt'
      && !!document.querySelector('#hierTree .dnode[data-id="Übersicht›Umbenannt"]'));
    t('Struktur landet im Übersicht-YAML', S.outlineText.includes('Umbenannt'));
    api.outlineDelete('Übersicht›Umbenannt');
    t('Diagramm gelöscht', !document.querySelector('#hierTree .dnode[data-id="Übersicht›Umbenannt"]')
      && !S.outlineText.includes('Umbenannt'));

    // Struktur per Verschieben ändern (umhängen + umsortieren)
    const findNode = id => { let r = null; (function w(l){ (l||[]).forEach(n=>{ if(n.id === id) r = n; w(n.kinder); }); })(S.outline.roots); return r; };
    S.hierSaved['Übersicht›roadshow'] = {'o:Kunde':{x:1, y:2}};
    api.outlineMove('Übersicht›roadshow', 'Übersicht›webshop', 'inside');
    t('Diagramm umgehängt (neue Kennung unter dem Ziel)',
      !!findNode('Übersicht›webshop›roadshow') && !findNode('Übersicht›roadshow'));
    t('gespeicherte Anordnung wandert auf die neue Kennung',
      !!S.hierSaved['Übersicht›webshop›roadshow'] && !S.hierSaved['Übersicht›roadshow']);
    api.outlineMove('Übersicht›webshop›roadshow', 'Übersicht›webshop', 'before');
    const order = findNode('Übersicht').kinder.map(n => n.name);
    t('davor eingeordnet (Reihenfolge/Ebene geändert)',
      order.indexOf('roadshow') > -1 && order.indexOf('roadshow') < order.indexOf('webshop'), order.join(','));
    api.undo();
    t('Baum-Verschiebung rückgängig', !!findNode('Übersicht›webshop›roadshow') && !findNode('Übersicht›roadshow'));
    api.redo();
    t('Baum-Verschiebung wiederhergestellt', !!findNode('Übersicht›roadshow') && !findNode('Übersicht›webshop›roadshow'));
  }
  api.setMode('komplett');
  t('zurück in Komplettansicht mit allen Objekten',
    S.mode === 'komplett' && S.graph.nodes.filter(n => !n.hidden).length === 11);
}

console.log('== Verknüpfte Objekte ins Diagramm holen ==');
{
  api.setMode('hierarchie');
  S.layout.algo = 'hier';
  // an Bestellung verankern, Ausschnitt zunächst nur Bestellung -> „zu 1" (Kunde)
  // und „zu n" (Kinder) sind versteckt und werden beide platziert.
  const manySide = nid => S.graph.edges.some(e =>
    (e.from === 'o:Bestellung' && e.to === nid && /many/.test(e.toCard || '')) ||
    (e.to === 'o:Bestellung' && e.from === nid && /many/.test(e.fromCard || '')));

  const probe = (dir)=>{
    S.hierShown['Übersicht'] = ['o:Bestellung'];
    S.layout.dir = dir;
    api.selectDiagram('Übersicht');
    api.addRelated('o:Bestellung');
    const B = S.graph.byId.get('o:Bestellung');
    const neu = S.graph.nodes.filter(n => !n.hidden && n.id !== 'o:Bestellung');
    let oben = 0, unten = 0, regel = neu.length > 0;
    neu.forEach(n=>{
      const istOben = n.y + n.h <= B.y, istUnten = n.y >= B.y + B.h;
      if(istOben) oben++; if(istUnten) unten++;
      // Flussanfang bei TB oben, bei BT unten
      const eins = dir === 'TB' ? istOben : istUnten;
      const viele = dir === 'TB' ? istUnten : istOben;
      if(manySide(n.id)){ if(!viele) regel = false; } else { if(!eins) regel = false; }
    });
    return {neu:neu.length, oben, unten, regel};
  };

  const tb = probe('TB');
  t('verknüpfte Objekte hinzugefügt', tb.neu > 0, tb.neu + ' neu');
  t('TB: zu 1 oberhalb, zu n unterhalb', tb.regel && tb.oben > 0 && tb.unten > 0,
    `oben ${tb.oben}, unten ${tb.unten}`);
  const bt = probe('BT');
  t('BT: Seiten gedreht (zu 1 unten, zu n oben)', bt.regel && bt.oben > 0 && bt.unten > 0,
    `oben ${bt.oben}, unten ${bt.unten}`);

  // Objekt selbst wird mitgeholt, wenn es noch nicht im Diagramm ist
  S.hierShown['Übersicht'] = [];
  S.layout.dir = 'TB';
  api.selectDiagram('Übersicht');
  t('Diagramm zunächst leer', S.graph.nodes.filter(n => !n.hidden).length === 0);
  api.addRelated('o:Bestellung');
  t('Objekt selbst wird mitgeholt', S.graph.byId.get('o:Bestellung').hidden === false);
  t('und die verknüpften Objekte dazu', S.graph.nodes.filter(n => !n.hidden).length > 1);

  api.setMode('komplett');
}

console.log('== Selbstbezug verschiebbar ==');
{
  S.selEdge = null; api.setView(1);
  const e = S.graph.edges.find(x => x.from === x.to);
  t('Selbstbezug-Kante vorhanden', !!e, e ? e.from : 'keine');
  if(e){
    S.selEdge = e.id; api.draw();
    // Standardausrichtung: "eins"-Seite (exactly_one) rechts, "viele"-Seite oben
    {
      const A0 = S.graph.byId.get(e.from);
      const ps = [...document.getElementById('handles').querySelectorAll('.pt[data-port]')];
      const fH = ps.find(c => c.dataset.port === 'from'), tH = ps.find(c => c.dataset.port === 'to');
      t('Standard: eins-Seite rechts hinaus, viele-Seite oben hinein',
        fH && tH && Math.abs(+fH.getAttribute('cx') - (A0.x + A0.w)) < 2
        && Math.abs(+tH.getAttribute('cy') - A0.y) < 2,
        fH ? `from.cx=${fH.getAttribute('cx')} (rechts=${A0.x + A0.w}), to.cy=${tH.getAttribute('cy')} (oben=${A0.y})` : 'keine Ports');
    }
    const h = document.getElementById('handles').querySelector('.pt[data-loop]');
    t('Scheitel-Griff erscheint', !!h);
    if(h){
      const vor = JSON.stringify(e.loop || null);
      dispatch(h, 'pointerdown', {clientX:100, clientY:100});
      dispatch(svg, 'pointermove', {clientX:280, clientY:60});
      dispatch(svg, 'pointerup', {});
      t('Schleife lässt sich verschieben',
        !!e.loop && JSON.stringify(e.loop) !== vor, JSON.stringify(e.loop));
    }
    // zwei Anschlusspunkte am Selbstbezug, einzeln verschiebbar
    const H = document.getElementById('handles');
    const ports = [...H.querySelectorAll('.pt[data-port]')];
    t('zwei Anschlusspunkt-Griffe am Selbstbezug', ports.length === 2, ports.length + '');
    const pf = ports.find(c => c.dataset.port === 'from');
    if(pf){
      const vorP = JSON.stringify(e.portFrom || null);
      dispatch(pf, 'pointerdown', {clientX:120, clientY:120});
      dispatch(svg, 'pointermove', {clientX:60, clientY:420});
      dispatch(svg, 'pointerup', {});
      t('Anschlusspunkt am Selbstbezug verschiebbar',
        !!e.portFrom && JSON.stringify(e.portFrom) !== vorP, JSON.stringify(e.portFrom));
    }
  }
}

console.log('== Hierarchiebeschreibung laden ==');
{
  const y = 'Testwurzel:\n  objekte:\n    - Kunde\n  Details:\n    Unterthema:\n      objekte:\n        - Bestellung\n';
  api.loadUebersicht(y);
  const roots = S.outline.roots;
  t('geladene Übersicht ersetzt die alte', roots.length === 1 && roots[0].name === 'Testwurzel',
    roots.map(r => r.name).join(','));
  t('geladene Struktur enthält das Unterthema',
    roots[0].kinder.length === 1 && roots[0].kinder[0].name === 'Unterthema');
  t('outlineText übernommen', S.outlineText.includes('Testwurzel'));
  t('Diagramm-Bearbeitungen zurückgesetzt',
    Object.keys(S.hierShown).length === 0 && Object.keys(S.hierSaved).length === 0);
}

console.log('== Keine externen Quellen ==');
{
  const roh = fs.readFileSync(FILE, 'utf8');
  t('kein Google-Fonts-Verweis', !/fonts\.(googleapis|gstatic)\.com/.test(roh));
  const laden = roh.match(/<(link|script)\b[^>]*\b(href|src)="https?:\/\/[^"]+"/gi) || [];
  t('nichts wird nachgeladen', laden.length === 0, laden.join(' | '));
  t('Marken für die Schrifteinbettung vorhanden',
    roh.includes('/* SCHRIFTEN-ANFANG */') && roh.includes('/* SCHRIFTEN-ENDE */'));
  t('Zeichenfläche unterbindet Textmarkierung (user-select:none)',
    /#canvas\{[^}]*user-select:none/.test(roh));
}

console.log('== Export: Markdown in der Diagramm-Beschreibung wird formatiert ==');
{
  api.loadUebersicht('Übersicht:\n  beschreibung: x\n  objekte:\n    - Bestellung\n    - Position');
  api.setMode('hierarchie');
  const rootId = S.outline.roots[0].id;
  api.selectDiagram(rootId);
  S.hierText[rootId] = '# Kopf\nEin **fetter** und *kursiver* Text mit `code`.\n- Punkt';
  const svg = api.exportSVG();
  t('Export: Überschrift wird größer gesetzt', /font-size="16"/.test(svg), 'kein font-size=16');
  t('Export: fett als eigenes tspan', /font-weight="700"/.test(svg));
  t('Export: kursiv als eigenes tspan', /font-style="italic"/.test(svg));
  t('Export: Code in Monospace', /IBM Plex Mono, monospace/.test(svg));
  t('Export: Listenpunkt mit Aufzählungszeichen', svg.includes('•'));
  api.setMode('komplett'); api.setView(1);
}

console.log('== Delta-Geschäftsobjekte: ergänzen und ersetzen ==');
{
  const base  = 'BusinessObjects:\n  A:\n    Domain: D\n  B:\n    Domain: D\n';
  const delta = 'BusinessObjects:\n  B:\n    Domain: NEU\n  C:\n    Domain: D\n';
  const r = api.mergeGoText(base, delta);
  t('mergeGoText zählt neu und ersetzt', r && r.added === 1 && r.replaced === 1, r ? `neu ${r.added}, ersetzt ${r.replaced}` : 'null');
  t('ersetztes Objekt trägt die neue Info', /B:\s*\n\s*Domain: NEU/.test(r.text), r && r.text);
  t('neues Objekt ist ergänzt', /\n\s*C:\s*\n\s*Domain: D/.test(r.text));

  // end-to-end auf dem geladenen Modell (zuletzt, da es S.model verändert)
  const before = Object.keys(S.model.objects).length;
  const first = Object.keys(S.model.objects)[0];
  api.loadDelta(`BusinessObjects:\n  ${first}:\n    Domain: DeltaDom\n    business_keys:\n    - K\n  NeuObjekt:\n    Domain: DeltaDom\n    business_keys:\n    - K`);
  t('loadDelta fügt ein neues Objekt hinzu', !!S.model.objects.NeuObjekt);
  t('loadDelta ersetzt ein vorhandenes Objekt', S.model.objects[first].domain === 'DeltaDom');
  t('Objektzahl wächst genau um die neuen', Object.keys(S.model.objects).length === before + 1, before + ' → ' + Object.keys(S.model.objects).length);
}

console.log('\n' + (fail ? fail + ' von ' + (fail+pass) + ' Prüfungen fehlgeschlagen'
                          : 'Alle ' + pass + ' Prüfungen bestanden'));
process.exit(fail ? 1 : 0);
})();
