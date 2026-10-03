/* Rauchtest: Beziehungsbeschriftungen — frei entlang der Kante und der
   Selbstbezug-Schleife verschiebbar, automatisches Entzerren bei Überlappung. */
const {bootApp, makeT} = require('./start');

(async ()=>{
const {S, api, document, svg, dispatch} = await bootApp();
const {t, finish} = makeT();

// Der Start steht in der Hierarchie (oberste Stufe); dieses Thema prüft die
// Komplettansicht und stellt sie darum ausdrücklich her.
api.setMode('komplett');

console.log('== Beziehungs-Label frei entlang der Kante verschiebbar ==');
{
  api.setView();
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
    t('gezogenes Label gilt als von Hand platziert', e.labelManual === true);

    // Position und Manuell-Kennzeichen überleben den Ansichtswechsel
    const gemerkt = e.labelT;
    api.persist(); api.setView();
    const back = S.graph.edges.find(x => x.from === e.from && x.to === e.to && (x.ord||0) === (e.ord||0));
    t('manuelle Label-Position überlebt den Ansichtswechsel',
      back && Math.abs(back.labelT - gemerkt) < 1e-6 && back.labelManual === true,
      back ? 'labelT=' + back.labelT + ', manual=' + back.labelManual : 'Kante weg');
    if(back){ back.labelT = null; back.labelManual = false; back.bends = null; api.persist(); }  // aufräumen
  }
  S.selEdge = null;
}

console.log('== Selbstbezug-Label ist auf der Schleife verschiebbar ==');
{
  api.setView();
  const e = S.graph.edges.find(x => x.from === x.to && x.label);
  t('Selbstbezug mit Beschriftung vorhanden', !!e, e ? e.from : 'keiner');
  if(e){
    e.labelT = null; e.labelManual = false;
    api.drawEdges();
    const hit = document.querySelector('.e-lbl-hit[data-lbl="' + e.id + '"]');
    t('Schleifen-Label hat ein Zieh-Feld', !!hit);
    if(hit){
      const A = S.graph.byId.get(e.from);
      const p1 = api.loopGeom(A, e).p1;                    // Anfang der Schleife
      const cx = p1.x * S.t.k + S.t.x, cy = p1.y * S.t.k + S.t.y;
      dispatch(hit, 'pointerdown', {clientX:0, clientY:0});
      dispatch(svg, 'pointermove', {clientX:cx, clientY:cy});
      dispatch(svg, 'pointerup', {clientX:cx, clientY:cy});
      t('Ziehen setzt labelT auf der Schleife', typeof e.labelT === 'number' && e.labelT >= 0 && e.labelT <= 1,
        'labelT=' + e.labelT);
      t('Label wandert zum Schleifenanfang', e.labelT < 0.25, 'labelT=' + e.labelT);
      t('gilt als von Hand platziert', e.labelManual === true);
      // gezeichnete Position liegt auf der Kurve bei labelT (das Label liegt
      // als eigene .elbl-Gruppe hinter allen Kanten, nicht mehr in der .eg)
      const lp = api.loopPoint(api.loopGeom(A, e), e.labelT);
      const txt = [...document.getElementById('edges').querySelectorAll('.elbl')]
        .find(g => g.dataset.id === e.id).querySelector('.e-lbl');
      t('gezeichnetes Label sitzt am Kurvenpunkt', txt && Math.abs(+txt.getAttribute('x') - lp.x) < 1,
        txt ? txt.getAttribute('x') + ' vs ' + lp.x.toFixed(1) : 'kein Text');
      e.labelT = null; e.labelManual = false; api.persist();   // aufräumen
    }
  }
}

console.log('== Beschriftungen liegen über allen Kantenlinien ==');
{
  api.setView();
  // Alle Beschriftungsgruppen müssen im DOM NACH allen Kantengruppen stehen —
  // sonst streicht eine später gezeichnete Kante durch den hellen Hintergrund
  // eines früheren Labels (dichte Bündel bei waagrechtem Fluss).
  const kinder = [...document.getElementById('edges').children];
  const letzteKante = kinder.map(c => c.getAttribute('class') || '').reduce((m, cls, i) => cls.split(' ')[0] === 'eg' ? i : m, -1);
  const erstesLabel = kinder.findIndex(c => (c.getAttribute('class') || '').split(' ')[0] === 'elbl');
  t('Beschriftungsgruppen vorhanden', erstesLabel >= 0, erstesLabel + '');
  t('jede Beschriftung liegt hinter der letzten Kantengruppe', erstesLabel > letzteKante,
    `letzte Kante bei ${letzteKante}, erstes Label bei ${erstesLabel}`);
  // Zustand (abgeblendet) färbt auch die Labelgruppe
  const irgendeine = S.graph.edges.find(e => e.label && e.from !== e.to);
  api.setSelection([S.graph.nodes.find(n => !n.hidden).id]);
  const lblFaded = [...document.getElementById('edges').querySelectorAll('.elbl')]
    .some(g => (g.getAttribute('class') || '').includes('faded'));
  t('abgeblendete Kanten blenden ihre Beschriftung mit ab', lblFaded);
  api.setSelection([]);
}

console.log('== Beschriftung weicht Kästen aus ==');
{
  api.setView();
  // Kante von A nach B, deren Mitte genau unter dem Kasten C liegt: das Label
  // darf nicht auf C sitzen bleiben, die Kante bietet links und rechts Platz.
  const e = S.graph.edges.find(x => x.label && x.from !== x.to);
  const A = S.graph.byId.get(e.from), B = S.graph.byId.get(e.to);
  const C = S.graph.nodes.find(n => !n.hidden && n.id !== e.from && n.id !== e.to);
  A.x = 0;    A.y = 0;
  B.x = 1200; B.y = 0;
  e.bends = null; e.portFrom = null; e.portTo = null; e.labelT = null; e.labelManual = false; e.ortho = false;
  C.x = 600 - C.w/2; C.y = A.y + A.h/2 - C.h/2;      // mittig AUF der Kantenmitte
  api.spreadLabels([e]);
  const p = api.polyPoint(api.routePoints(e, A, B), e.labelT != null ? e.labelT : 0.5);
  const aufC = p.x > C.x && p.x < C.x + C.w && p.y > C.y && p.y < C.y + C.h;
  t('Label rutscht von einem Kasten herunter', !aufC,
    `labelT=${e.labelT}, Punkt (${Math.round(p.x)},${Math.round(p.y)}), C x=${Math.round(C.x)}..${Math.round(C.x + C.w)}`);
  e.labelT = null; e.labelManual = false;
}

console.log('== Auto-Layout entzerrt überlappende Beziehungs-Labels ==');
{
  api.setView();
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
    [e1,e2].forEach(e=>{ e.bends=null; e.portFrom=null; e.portTo=null; e.labelT=null; e.labelManual=false; e.ortho=false; });
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

    // Von Hand platzierte Beschriftung bleibt stehen, die andere weicht aus
    e1.labelT = 0.5; e1.labelManual = true;
    e2.labelT = null; e2.labelManual = false;
    api.spreadLabels();
    t('von Hand gesetzte Beschriftung bleibt beim Entzerren stehen',
      e1.labelT === 0.5 && e1.labelManual === true);
    t('die automatische weicht der festen aus',
      e2.labelT != null && Math.abs(e2.labelT - 0.5) > 0.01, 'labelT=' + e2.labelT);

    // Mit Bereich: Kanten außerhalb bleiben unangetastet
    e1.labelManual = false; e1.labelT = 0.5;
    e2.labelT = null;
    api.spreadLabels([e2]);
    t('außerhalb des Bereichs bleibt die Beschriftung unverändert', e1.labelT === 0.5);
    t('innerhalb des Bereichs weicht sie aus',
      e2.labelT != null && Math.abs(e2.labelT - 0.5) > 0.01, 'labelT=' + e2.labelT);

    [e1, e2].forEach(e=>{ e.labelT = null; e.labelManual = false; });   // aufräumen
  }
}

finish();
})();
