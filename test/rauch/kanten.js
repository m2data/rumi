/* Rauchtest: Kanten bearbeiten — auswählen, Stützpunkte, Anschlusspunkte,
   Segmente, Doppelklick, Ortho-Formen, Selbstbezug. */
const {bootApp, makeT} = require('./start');

(async ()=>{
const {S, api, document, svg, dispatch} = await bootApp();
const {t, finish} = makeT();

console.log('== Kante auswählen ==');
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
    // t bewusst schief (nicht 0.5): so liegen die Anschlusspunkte auf
    // gebrochenen Koordinaten — der Fall, in dem sich Zeichnung und Ablage
    // früher um bis zu einen halben Punkt unterschieden.
    e.bends = null; e.portFrom = {side:'R', t:0.37}; e.portTo = {side:'T', t:0.63}; e.manual = true;
    S.selEdge = e.id; api.draw();
    const H = () => document.getElementById('handles');
    const ghVor = H().querySelectorAll('.gh').length, segVor = H().querySelectorAll('.seg').length;
    // Neu: auch die schräge Direktverbindung bietet einen Zusatzpunkt-Griff
    // (Sicherheitsnetz in drawHandles), damit sich dort ein Stützpunkt setzen lässt.
    t('schräge Ortho-Direktverbindung bietet einen Zusatzpunkt-Griff', ghVor >= 1,
      `gh=${ghVor}, seg=${segVor}`);

    // Gezeichnete Stufe und die spätere Ablage stammen aus derselben Quelle
    // (orthoCorners): das Materialisieren darf die Linie nicht verrücken.
    const pfad = ()=>{
      const g = [...document.getElementById('edges').querySelectorAll('.eg')].find(x => x.dataset.id === e.id);
      return g && g.querySelector('.e-path').getAttribute('d');
    };
    const vorMat = pfad();
    const gesetzt = api.materializeOrtho(e);
    api.draw();
    t('schräge Ortho-Kante bekommt echte Knicke', gesetzt && e.bends && e.bends.length >= 2,
      'bends=' + (e.bends ? e.bends.length : 0));
    t('die gezeichnete Linie bleibt dabei unverändert', pfad() === vorMat,
      vorMat + '  →  ' + pfad());
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

console.log('== Weiche Führung: lange Traversen bleiben Geraden (keine Kringel) ==');
{
  api.setView(1);
  // Zug mit langer Quertraverse zwischen zwei kurzen Stichen — der Muster-Fall
  // aus dem kombinierten Modell (willibald + crm + sap-finanz), in dem weich
  // verschliffene Kanten wie Kreise um fremde Kästen wirkten. Der Bogen von
  // Segmentmitte zu Segmentmitte holte dabei hunderte Pixel aus; jetzt wird
  // mit begrenztem Eckradius gerundet, Geraden bleiben Geraden.
  const e = S.graph.edges.find(x=>{
    const A = S.graph.byId.get(x.from), B = S.graph.byId.get(x.to);
    return A && B && !A.hidden && !B.hidden && x.from !== x.to;
  });
  const A = S.graph.byId.get(e.from), B = S.graph.byId.get(e.to);
  A.x = 0; A.y = 0; B.x = 900; B.y = 300;
  e.bends = [{x:-200, y:150}, {x:1100, y:150}];   // Traverse von 1300 px
  e.ortho = false; e.portFrom = null; e.portTo = null; e.manual = true;
  api.drawEdges();
  const g = [...document.getElementById('edges').querySelectorAll('.eg')].find(x => x.dataset.id === e.id);
  const d = g.querySelector('.e-path').getAttribute('d');
  // Jede Kurvensehne (Abstand vom Punkt vor dem Q zu seinem Endpunkt) muss
  // klein bleiben — smoothPath spannte sie über die halbe Traverse (~650 px).
  const toks = [...d.matchAll(/([MLQ])([-\d. ]+)/g)];
  let cur = null, maxSehne = 0, geraden = 0;
  toks.forEach(([,cmd,args])=>{
    const n = args.trim().split(/\s+/).map(Number);
    const ende = {x:n[n.length-2], y:n[n.length-1]};
    if(cmd === 'Q' && cur) maxSehne = Math.max(maxSehne, Math.hypot(ende.x-cur.x, ende.y-cur.y));
    if(cmd === 'L' && cur) geraden = Math.max(geraden, Math.hypot(ende.x-cur.x, ende.y-cur.y));
    cur = ende;
  });
  t('Rundungen bleiben eng am Knick (Sehne < 100 px)', maxSehne > 0 && maxSehne < 100,
    'größte Sehne=' + Math.round(maxSehne));
  t('die lange Traverse liegt als gerade Strecke im Pfad', geraden > 900,
    'längste Gerade=' + Math.round(geraden));
  e.bends = null; e.manual = false; api.persist();
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

console.log('== Ortho: Direktlinie bei waagrechter Flussrichtung ==');
{
  /* Gegenstück zum Fall oben: läuft der Fluss waagrecht, gehen die Anschlüsse
     nach rechts und links hinaus statt nach unten und oben. Der Zweig war
     bisher ungeprüft — die Kante wäre schräg aus dem Kasten gelaufen, ohne dass
     ein Test es gemerkt hätte. */
  api.setView(1);
  const e = S.graph.edges.find(x=>{
    const A = S.graph.byId.get(x.from), B = S.graph.byId.get(x.to);
    return A && B && !A.hidden && !B.hidden && x.from !== x.to;
  });
  e.bends = null; e.portFrom = null; e.portTo = null; e.ortho = false; e.manual = true;
  S.layout.algo = 'ortho'; S.layout.dir = 'LR'; S.selEdge = e.id; api.draw();
  const gh = document.getElementById('handles').querySelector('.gh');
  t('Direktlinie hat auch hier einen Zusatzpunkt-Griff', !!gh);
  if(gh){
    dispatch(gh, 'pointerdown', {clientX:0, clientY:0});
    dispatch(svg, 'pointermove', {clientX:40, clientY:0});
    dispatch(svg, 'pointerup', {clientX:40, clientY:0});
    t('auch waagrecht entstehen genau zwei Stützpunkte',
      Array.isArray(e.bends) && e.bends.length === 2, 'bends=' + (e.bends ? e.bends.length : 0));
    const A = S.graph.byId.get(e.from), B = S.graph.byId.get(e.to);
    const rechtsherum = (A.x + A.w/2) <= (B.x + B.w/2);
    t('der Anschluss verlässt den Kasten seitlich, nicht oben oder unten',
      e.portFrom && e.portTo
      && e.portFrom.side === (rechtsherum ? 'R' : 'L')
      && e.portTo.side === (rechtsherum ? 'L' : 'R'),
      (e.portFrom && e.portFrom.side) + ' → ' + (e.portTo && e.portTo.side));
    t('und sitzt mittig auf seiner Kante', e.portFrom.t === 0.5 && e.portTo.t === 0.5);
    {
      const pp = (n,p)=>{ const tt = Math.min(0.92, Math.max(0.08, p.t));
        return p.side==='T'?{x:n.x+n.w*tt,y:n.y}:p.side==='B'?{x:n.x+n.w*tt,y:n.y+n.h}:p.side==='L'?{x:n.x,y:n.y+n.h*tt}:{x:n.x+n.w,y:n.y+n.h*tt}; };
      const pts = [pp(A, e.portFrom), ...e.bends, pp(B, e.portTo)];
      let alle90 = true;
      for(let k=0;k<pts.length-1;k++){ const dx=Math.abs(pts[k+1].x-pts[k].x), dy=Math.abs(pts[k+1].y-pts[k].y); if(dx>=1 && dy>=1) alle90 = false; }
      t('alle drei Strecken bleiben rechtwinklig', alle90);
    }
  }
  S.selEdge = null; S.layout.algo = 'hier'; S.layout.dir = 'TB';
}

console.log('== Anschlusspunkt an einer Ortho-Kante mit Knicken ==');
{
  /* Beim Ziehen eines Anschlusspunktes rastet das anschließende Stub-Ende auf
     die Achse des Anschlusses ein (alignStub). Das greift nur bei einer
     rechtwinkligen Kante, die schon Knicke hat — die bisherigen Ziehversuche
     trafen weiche oder knickfreie Kanten, der Zweig lief durch keinen Test. */
  api.setView(1);
  [...document.getElementById('layoutMenu').querySelectorAll('[data-algo]')]
    .filter(b => b.dataset.algo === 'ortho').forEach(b => b.onclick && b.onclick());
  const e = S.graph.edges.find(x => x.ortho && x.bends && x.bends.length && x.from !== x.to);
  t('rechtwinklige Kante mit Knicken vorhanden', !!e);
  if(e){
    S.selEdge = e.id; api.draw();
    const pt = document.getElementById('handles').querySelectorAll('.pt')[0];
    t('sie bietet Anschlusspunkt-Griffe', !!pt);
    if(pt){
      dispatch(pt, 'pointerdown', {clientX:200, clientY:200});
      dispatch(svg, 'pointermove', {clientX:260, clientY:250});
      dispatch(svg, 'pointerup', {clientX:260, clientY:250});
      const n = S.graph.byId.get(e.from);
      const p = e.portFrom;
      t('der Anschluss sitzt danach auf einer Kastenseite', !!p && 'TBLR'.includes(p.side),
        p && p.side);
      const tt = Math.min(0.92, Math.max(0.08, p.t));
      const pp = p.side==='T'?{x:n.x+n.w*tt,y:n.y}:p.side==='B'?{x:n.x+n.w*tt,y:n.y+n.h}
               :p.side==='L'?{x:n.x,y:n.y+n.h*tt}:{x:n.x+n.w,y:n.y+n.h*tt};
      const b0 = e.bends[0];
      const dx = Math.abs(b0.x - pp.x), dy = Math.abs(b0.y - pp.y);
      t('das erste Stück läuft achsparallel aus dem Kasten', dx < 1 || dy < 1,
        'dx=' + dx.toFixed(1) + ' dy=' + dy.toFixed(1) + ' (' + p.side + ')');
      t('und zwar quer zur Anschlussseite',
        (p.side === 'T' || p.side === 'B') ? dx < 1 : dy < 1,
        p.side + ': dx=' + dx.toFixed(1) + ' dy=' + dy.toFixed(1));
    }
  }
  S.selEdge = null; S.layout.algo = 'hier'; api.draw();
}

finish();
})();
