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
  'setTimeout','clearTimeout','__expose', script + '\n__expose({S, draw, drawEdges, setView, persist, routePoints, edgeKey, ALGOS, rerouteEdges, applyContent, nearestPort, nodeMarkup, contentOf, materializeOrtho, setMode, selectDiagram});');

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
    t('vorher keine Bearbeitungsgriffe (der gemeldete Zustand)', ghVor === 0 && segVor === 0,
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
  t('Hierarchie-Panel an, Komplett-Panel aus',
    document.getElementById('hierPanel').hidden === false
    && document.getElementById('komplettPanel').hidden === true);
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
  }
  api.setMode('komplett');
  t('zurück in Komplettansicht mit allen Objekten',
    S.mode === 'komplett' && S.graph.nodes.filter(n => !n.hidden).length === 11);
}

console.log('== Keine externen Quellen ==');
{
  const roh = fs.readFileSync(FILE, 'utf8');
  t('kein Google-Fonts-Verweis', !/fonts\.(googleapis|gstatic)\.com/.test(roh));
  const laden = roh.match(/<(link|script)\b[^>]*\b(href|src)="https?:\/\/[^"]+"/gi) || [];
  t('nichts wird nachgeladen', laden.length === 0, laden.join(' | '));
  t('Marken für die Schrifteinbettung vorhanden',
    roh.includes('/* SCHRIFTEN-ANFANG */') && roh.includes('/* SCHRIFTEN-ENDE */'));
}

console.log('\n' + (fail ? fail + ' von ' + (fail+pass) + ' Prüfungen fehlgeschlagen'
                          : 'Alle ' + pass + ' Prüfungen bestanden'));
process.exit(fail ? 1 : 0);
})();
