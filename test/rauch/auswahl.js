/* Rauchtest: Auswahl und Tastatur — Knoten ziehen, Klick-Verhalten,
   Bereichs-Layout, Kanten neu ziehen mit Auswahl, Pfeiltasten/Entf, Verlauf. */
const {bootApp, makeT} = require('./start');

(async ()=>{
const {S, api, document, svg, dispatch} = await bootApp();
const {t, finish} = makeT();

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

console.log('== Verlauf reicht 20 Aktionen zurück ==');
{
  api.setView(1);
  const n = S.graph.nodes.find(x => !x.hidden);
  const start = n.x;
  for(let i = 1; i <= 25; i++){ n.x = start + i; api.persist(); }   // 25 Aktionen
  let undos = 0;
  while(undos < 30){
    const vorher = S.graph.byId.get(n.id).x;
    api.undo();
    if(S.graph.byId.get(n.id).x === vorher) break;                  // nichts mehr zurückzunehmen
    undos++;
  }
  t('genau 20 Aktionen lassen sich zurücknehmen', undos === 20, undos + ' Undos');
  t('der älteste erreichbare Stand ist Aktion 5', S.graph.byId.get(n.id).x === start + 5,
    'x=' + S.graph.byId.get(n.id).x + ', erwartet ' + (start + 5));
  while(S.graph.byId.get(n.id).x !== start + 25){ const v = S.graph.byId.get(n.id).x; api.redo(); if(S.graph.byId.get(n.id).x === v) break; }
  n.x = start; api.persist();                                       // aufräumen
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

console.log('== Pfeiltasten verschieben, Entf blendet aus ==');
{
  api.setView(1);
  const taste = (key, opts={}) => dispatch(document.getElementById('canvas'), 'keydown', {key, ...opts});
  const a = S.graph.nodes.find(n => !n.hidden), b = S.graph.nodes.filter(n => !n.hidden)[1];
  api.setSelection([a.id, b.id]);
  const ax = a.x, ay = a.y, bx = b.x;
  taste('ArrowRight');
  t('Pfeil rechts verschiebt die ganze Auswahl fein', a.x === ax + 4 && b.x === bx + 4,
    `a ${ax}→${a.x}, b ${bx}→${b.x}`);
  taste('ArrowDown', {shiftKey:true});
  t('Umschalt+Pfeil verschiebt um ein Rasterfeld', a.y === ay + 24, `${ay} → ${a.y}`);

  // Kante innerhalb der Auswahl wandert starr mit
  const innen = S.graph.edges.find(e => e.from === a.id && e.to === b.id || e.from === b.id && e.to === a.id);
  if(innen){
    innen.bends = [{x:100, y:100}];
    taste('ArrowRight');
    t('Stützpunkte innerhalb der Auswahl wandern mit', innen.bends[0].x === 104, 'x=' + innen.bends[0].x);
    innen.bends = null;
  }

  /* Kante über die Auswahlgrenze: der Zug bleibt erhalten und passt sich nur
     am bewegten Kasten an. Vorher wurde er beim ersten Tastendruck verworfen
     (bends und Anschlusspunkte auf null) und vom Verfahren neu gezogen. */
  const raus = S.graph.edges.find(e =>
    (e.from === a.id && e.to !== b.id) || (e.to === a.id && e.from !== b.id));
  if(raus){
    const amAnfang = raus.from === a.id;
    raus.ortho = true;
    raus.portFrom = {side:'B', t:0.5};
    raus.portTo   = {side:'T', t:0.5};
    const n = S.graph.byId.get(a.id);
    raus.bends = [{x:Math.round(n.x + n.w/2), y:Math.round(n.y + n.h + 40)},
                  {x:Math.round(n.x + n.w/2) + 120, y:Math.round(n.y + n.h + 40)}];
    const merk = raus.bends.map(q=>({x:q.x, y:q.y}));
    api.setSelection([a.id]);
    taste('ArrowRight');
    t('Zug über die Auswahlgrenze bleibt erhalten',
      !!raus.bends && raus.bends.length === 2 && !!raus.portFrom,
      'bends=' + (raus.bends ? raus.bends.length : 'null'));
    if(raus.bends && raus.bends.length === 2){
      const pts = api.routePoints(raus, S.graph.byId.get(raus.from), S.graph.byId.get(raus.to));
      const nah = amAnfang ? [pts[0], pts[1]] : [pts[pts.length-1], pts[pts.length-2]];
      t('das erste Stück bleibt achsparallel (rechtwinklig)',
        Math.abs(nah[0].x - nah[1].x) < 1 || Math.abs(nah[0].y - nah[1].y) < 1,
        `(${Math.round(nah[0].x)},${Math.round(nah[0].y)}) → (${Math.round(nah[1].x)},${Math.round(nah[1].y)})`);
      const fern = amAnfang ? raus.bends[1] : raus.bends[0];
      const fernMerk = amAnfang ? merk[1] : merk[0];
      t('der vom Kasten abgewandte Stützpunkt bleibt liegen',
        fern.x === fernMerk.x && fern.y === fernMerk.y,
        `(${fern.x},${fern.y}) statt (${fernMerk.x},${fernMerk.y})`);
    }
    raus.bends = null; raus.ortho = false; raus.portFrom = null; raus.portTo = null;
    api.setSelection([a.id, b.id]);
  }

  // ohne Auswahl passiert nichts
  api.setSelection([]);
  const cx = a.x;
  taste('ArrowRight');
  t('ohne Auswahl bewegt sich nichts', a.x === cx);

  // Entf blendet aus, Strg+Z holt zurück
  api.setSelection([a.id]);
  taste('Delete');
  t('Entf blendet das markierte Objekt aus', a.hidden === true);
  t('und hebt die Auswahl auf', S.sel.size === 0);
  api.undo();
  t('Rückgängig holt es zurück', S.graph.byId.get(a.id).hidden === false);
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

console.log('== Ausrichten und Verteilen über die Leiste ==');
{
  /* Die Ausrichte-Leiste war bisher in keinem Test bedient — geprüft wird der
     Bedienweg (Klick auf den Knopf), nicht alignSelection() direkt. */
  const knopf = al => [...document.getElementById('alignBar').querySelectorAll('button')]
    .find(b => b.dataset.al === al);
  const bar = ()=> document.getElementById('alignBar');
  const knoten = S.graph.nodes.filter(n => !n.hidden).slice(0, 3);
  const [a] = knoten;
  const stellen = ()=>{
    knoten[0].x = 100; knoten[0].y = 100;
    knoten[1].x = 240; knoten[1].y = 300;
    knoten[2].x = 400; knoten[2].y = 520;
    api.setSelection(knoten.map(n => n.id));
    api.persist();          // Ausgangslage in den Verlauf, sonst prüft das Rückgängig nichts
  };

  api.setSelection([a.id]);
  t('Leiste bleibt aus bei einem Kasten', !bar().classList.contains('on'));
  stellen();
  t('Leiste schaltet ab zwei Kästen an', bar().classList.contains('on'));
  t('Zähler nennt die Zahl der Gewählten',
    document.getElementById('alignCount').textContent === '3 gewählt',
    document.getElementById('alignCount').textContent);

  stellen();
  const yVor = knoten.map(n => n.y);
  knopf('l').click();
  t('linksbündig: alle auf dem kleinsten x', knoten.every(n => n.x === 100),
    knoten.map(n=>n.x).join('/'));
  t('linksbündig lässt y in Ruhe', knoten.every((n,i) => n.y === yVor[i]));

  stellen();
  knopf('r').click();
  const rechts = Math.max(...knoten.map(n => n.x + n.w));
  t('rechtsbündig: alle enden auf derselben Kante',
    knoten.every(n => n.x + n.w === rechts), knoten.map(n=>n.x+n.w).join('/'));

  stellen();
  knopf('ch').click();
  const mitteX = knoten.map(n => n.x + n.w/2);
  t('horizontal zentriert: gleiche Mitte',
    mitteX.every(m => Math.abs(m - mitteX[0]) < 1), mitteX.join('/'));

  stellen();
  const xVor = knoten.map(n => n.x);
  knopf('t').click();
  t('oben: alle auf dem kleinsten y', knoten.every(n => n.y === 100),
    knoten.map(n=>n.y).join('/'));
  t('oben lässt x in Ruhe', knoten.every((n,i) => n.x === xVor[i]));

  stellen();
  knopf('b').click();
  const unten = Math.max(...knoten.map(n => n.y + n.h));
  t('unten: alle enden auf derselben Kante', knoten.every(n => n.y + n.h === unten));

  stellen();
  knopf('cv').click();
  const mitteY = knoten.map(n => n.y + n.h/2);
  t('vertikal zentriert: gleiche Mitte',
    mitteY.every(m => Math.abs(m - mitteY[0]) < 1), mitteY.join('/'));

  stellen();
  const spanneX = [Math.min(...knoten.map(n=>n.x)), Math.max(...knoten.map(n=>n.x+n.w))];
  knopf('dh').click();
  {
    const s = knoten.slice().sort((p,q)=> p.x - q.x);
    const l1 = s[1].x - (s[0].x + s[0].w), l2 = s[2].x - (s[1].x + s[1].w);
    t('waagrecht verteilt: gleiche Lücken', Math.abs(l1 - l2) <= 1, l1 + ' / ' + l2);
    t('waagrecht verteilt: die Spanne bleibt stehen',
      Math.abs(s[0].x - spanneX[0]) <= 1 && Math.abs(s[2].x + s[2].w - spanneX[1]) <= 1);
  }

  stellen();
  knopf('dv').click();
  {
    const s = knoten.slice().sort((p,q)=> p.y - q.y);
    const l1 = s[1].y - (s[0].y + s[0].h), l2 = s[2].y - (s[1].y + s[1].h);
    t('senkrecht verteilt: gleiche Lücken', Math.abs(l1 - l2) <= 1, l1 + ' / ' + l2);
  }

  /* Ausrichten ist eine Änderung wie jede andere: der Verlauf muss sie kennen */
  stellen();
  const vor = knoten.map(n => n.x);
  knopf('l').click();
  api.undo();
  // nach dem Rückgängig ist der Graph neu gebaut — über die Kennung nachsehen
  const jetzt = knoten.map(n => S.graph.byId.get(n.id).x);
  t('Rückgängig stellt die Lage vor dem Ausrichten her',
    jetzt.every((x,i) => x === vor[i]), jetzt.join('/') + ' statt ' + vor.join('/'));

  /* Ein einzelner Kasten darf sich durch einen Knopfdruck nicht bewegen */
  api.setSelection([a.id]);
  const einzeln = S.graph.byId.get(a.id);
  const ax = einzeln.x, ay = einzeln.y;
  knopf('l').click(); knopf('t').click();
  t('mit einem Kasten bewirkt die Leiste nichts', einzeln.x === ax && einzeln.y === ay);
  api.setSelection([]);
}

console.log('== Strg+Klick, Escape, Strg+A ==');
{
  const taste = (key, opt)=> dispatch(document.getElementById('canvas'), 'keydown',
    Object.assign({key}, opt || {}));
  const kasten = id => [...document.getElementById('nodes').querySelectorAll('.node')]
    .find(e => e.dataset.id === id);
  const sicht = S.graph.nodes.filter(n => !n.hidden);
  const [a, b] = sicht;

  api.setSelection([a.id, b.id]);
  dispatch(kasten(b.id), 'pointerdown', {clientX:0, clientY:0, ctrlKey:true});
  dispatch(svg, 'pointerup', {clientX:0, clientY:0, ctrlKey:true});
  t('Strg+Klick nimmt einen einzelnen aus der Auswahl',
    S.sel.has(a.id) && !S.sel.has(b.id), '[' + [...S.sel].join(', ') + ']');
  dispatch(kasten(b.id), 'pointerdown', {clientX:0, clientY:0, ctrlKey:true});
  dispatch(svg, 'pointerup', {clientX:0, clientY:0, ctrlKey:true});
  t('und holt ihn genauso wieder dazu', S.sel.has(a.id) && S.sel.has(b.id),
    '[' + [...S.sel].join(', ') + ']');

  taste('Escape');
  t('Escape hebt die Auswahl auf', S.sel.size === 0);

  taste('a', {ctrlKey:true});
  t('Strg+A wählt alles Sichtbare',
    S.sel.size === sicht.filter(n => !n.hidden).length, S.sel.size + ' von ' + sicht.length);
  api.setSelection([]);
}

console.log('== Anordnen-Menü: Beschriftungen, Flussrichtung, eine Kante ==');
{
  const menu = document.getElementById('layoutMenu');
  const vorher = S.layout.labels !== false;
  document.getElementById('optLabels').click();
  t('Beziehungsnamen lassen sich ausblenden', (S.layout.labels !== false) !== vorher,
    'labels=' + S.layout.labels);
  document.getElementById('optLabels').click();
  t('und wieder einblenden', (S.layout.labels !== false) === vorher);

  const richtung = [...document.getElementById('dirGrid').querySelectorAll('button')]
    .find(b => b.dataset.dir === 'LR');
  richtung.click();
  t('die Flussrichtung folgt dem Knopf', S.layout.dir === 'LR', S.layout.dir);
  [...document.getElementById('dirGrid').querySelectorAll('button')]
    .find(b => b.dataset.dir === 'TB').click();

  // Nur die gewählte Kante neu ziehen
  const hit = document.getElementById('edges').querySelectorAll('.e-hit')[0];
  dispatch(hit, 'pointerdown', {clientX:100, clientY:100});
  t('eine Kante ist gewählt', !!S.selEdge, String(S.selEdge));
  const eine = [...menu.querySelectorAll('[data-route]')].find(b => b.dataset.route === 'one');
  t('„nur diese Kante" ist mit Auswahl bedienbar', !eine.disabled);
  eine.click();
  t('die Meldung nennt die einzelne Kante',
    /Kante neu gezogen/.test(document.getElementById('toast').textContent),
    document.getElementById('toast').textContent);
  S.selEdge = null; api.draw();
}

console.log('== Kanten neu ziehen bei waagrechter Flussrichtung ==');
{
  /* Die Wegsuche schiebt jeden Anschluss ein Stück aus dem Kasten heraus —
     bei waagrechtem Fluss nach links und rechts. Bisher lief nur die senkrechte
     Hälfte davon durch einen Test. */
  const menu = document.getElementById('layoutMenu');
  const richtung = d => [...document.getElementById('dirGrid').querySelectorAll('button')]
    .find(b => b.dataset.dir === d);
  api.setSelection([]);
  richtung('LR').click();
  [...menu.querySelectorAll('[data-route]')].find(b => b.dataset.route === 'all').click();

  const gezogen = S.graph.edges.filter(e => e.bends && e.bends.length);
  t('bei LR werden Kanten neu gezogen', gezogen.length > 0, gezogen.length + ' Kanten');
  const seiten = new Set(S.graph.edges.filter(e => e.portFrom).map(e => e.portFrom.side));
  t('die Anschlüsse liegen jetzt seitlich', seiten.has('L') || seiten.has('R'),
    [...seiten].join(','));
  t('kein Zug hat einen unendlichen oder fehlenden Punkt',
    gezogen.every(e => e.bends.every(p => Number.isFinite(p.x) && Number.isFinite(p.y))));

  richtung('TB').click();
}

console.log('== Mehrfachauswahl mit dem Zeiger ziehen ==');
{
  /* Für die Pfeiltasten ist oben geprüft, dass ein Kantenzug innerhalb der
     Auswahl starr mitwandert. Das Ziehen mit dem Zeiger läuft durch anderen
     Code und war ungeprüft. */
  api.setView(1);
  const paar = S.graph.edges.find(e => e.from !== e.to
    && !S.graph.byId.get(e.from).hidden && !S.graph.byId.get(e.to).hidden);
  t('eine Kante zwischen zwei sichtbaren Kästen gefunden', !!paar);
  if(paar){
    const a = S.graph.byId.get(paar.from), b = S.graph.byId.get(paar.to);
    paar.bends = [{x:300, y:300}, {x:360, y:340}];
    paar.manual = true;
    api.setSelection([a.id, b.id]);
    const ax = a.x, ay = a.y, bx = b.x, by = b.y;
    // erst hier zurücksetzen: setView() passt den Ausschnitt an und ändert den Maßstab
    S.t.x = 0; S.t.y = 0; S.t.k = 1;
    const kasten = [...document.getElementById('nodes').querySelectorAll('.node')]
      .find(el => el.dataset.id === a.id);
    dispatch(kasten, 'pointerdown', {clientX:100, clientY:100});
    dispatch(svg, 'pointermove', {clientX:150, clientY:130});
    dispatch(svg, 'pointerup', {clientX:150, clientY:130});

    t('beide Kästen sind um denselben Betrag gewandert',
      a.x === ax + 50 && a.y === ay + 30 && b.x === bx + 50 && b.y === by + 30,
      `a ${ax}/${ay}→${a.x}/${a.y}, b ${bx}/${by}→${b.x}/${b.y}`);
    t('die Stützpunkte innerhalb der Auswahl wandern mit',
      paar.bends[0].x === 350 && paar.bends[0].y === 330
      && paar.bends[1].x === 410 && paar.bends[1].y === 370,
      JSON.stringify(paar.bends));
    t('die Form des Zuges bleibt dieselbe',
      paar.bends[1].x - paar.bends[0].x === 60 && paar.bends[1].y - paar.bends[0].y === 40);
    paar.bends = null; paar.manual = false;
    api.setSelection([]);
  }
}

finish();
})();
