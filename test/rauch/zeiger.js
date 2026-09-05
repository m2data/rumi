/* Rauchtest: Zeiger auf dem Hintergrund — Rahmen aufziehen, Schwenken, Zoom.
   Was auf einem Kasten oder einer Kante beginnt, steht in auswahl.js bzw.
   kanten.js; hier geht es um die Wege, die auf der leeren Fläche anfangen,
   und um das Versetzen eines Mittelstücks in einem bestehenden Ortho-Zug. */
const {bootApp, makeT} = require('./start');

(async ()=>{
const {S, api, document, svg, dispatch} = await bootApp();
const {t, finish} = makeT();

// Der Start steht in der Hierarchie (oberste Stufe); dieses Thema prüft die
// Komplettansicht und stellt sie darum ausdrücklich her.
api.setMode('komplett');

/* Ohne Verschiebung und ohne Maßstab ist Weltkoordinate = Bildschirmkoordinate
   (das Mini-DOM meldet die Zeichenfläche bei 0/0), das macht die Zahlen lesbar. */
const zuruecksetzen = ()=>{ S.t.x = 0; S.t.y = 0; S.t.k = 1; };

console.log('== Umschalt+Ziehen wählt alles im Rahmen ==');
{
  zuruecksetzen();
  api.setSelection([]);
  const sicht = S.graph.nodes.filter(n => !n.hidden);
  const [a, b, c] = sicht;
  a.x = 100; a.y = 100;
  b.x = 200; b.y = 160;
  c.x = 900; c.y = 900;                       // liegt weit außerhalb des Rahmens
  api.draw();

  dispatch(svg, 'pointerdown', {clientX:60, clientY:60, shiftKey:true, pointerId:3});
  dispatch(svg, 'pointermove', {clientX:420, clientY:380, pointerId:3});
  dispatch(svg, 'pointerup',   {clientX:420, clientY:380, pointerId:3});

  t('die beiden Kästen im Rahmen sind gewählt', S.sel.has(a.id) && S.sel.has(b.id),
    '[' + [...S.sel].join(', ') + ']');
  t('der Kasten außerhalb bleibt ungewählt', !S.sel.has(c.id));
  t('die Meldung nennt die Zahl der Gewählten',
    /\d+ Objekte? gewählt/.test(document.getElementById('toast').textContent),
    document.getElementById('toast').textContent);

  // Ein Rahmen ins Leere hebt die Auswahl auf, statt sie stehen zu lassen
  dispatch(svg, 'pointerdown', {clientX:700, clientY:60, shiftKey:true, pointerId:3});
  dispatch(svg, 'pointermove', {clientX:760, clientY:120, pointerId:3});
  dispatch(svg, 'pointerup',   {clientX:760, clientY:120, pointerId:3});
  t('ein leerer Rahmen wählt nichts', S.sel.size === 0);
}

console.log('== Ziehen auf dem Hintergrund schwenkt die Ansicht ==');
{
  zuruecksetzen();
  const a = S.graph.nodes.find(n => !n.hidden);
  const lage = {x: a.x, y: a.y};
  api.setSelection([a.id]);

  dispatch(svg, 'pointerdown', {clientX:500, clientY:400, pointerId:4});
  t('die Auswahl fällt beim Griff ins Leere weg', S.sel.size === 0);
  t('die Zeichenfläche zeigt das Schwenken an', svg.classList.contains('panning'));
  dispatch(svg, 'pointermove', {clientX:560, clientY:430, pointerId:4});
  t('die Ansicht folgt dem Zeiger', S.t.x === 60 && S.t.y === 30, S.t.x + '/' + S.t.y);
  const kVor = S.t.k;
  dispatch(svg, 'pointerup', {clientX:560, clientY:430, pointerId:4});
  t('nach dem Loslassen ist das Schwenken beendet', !svg.classList.contains('panning'));
  t('Schwenken ändert den Maßstab nicht', S.t.k === kVor);

  // Geschwenkt wird die Ansicht, nicht der Inhalt
  const b = S.graph.byId.get(a.id);
  t('Schwenken verschiebt keinen Kasten', b.x === lage.x && b.y === lage.y,
    b.x + '/' + b.y + ' statt ' + lage.x + '/' + lage.y);
}

console.log('== Zoom über Rad und Knöpfe ==');
{
  zuruecksetzen();
  dispatch(svg, 'wheel', {deltaY:-240, clientX:600, clientY:400});
  t('Rad nach vorn vergrößert', S.t.k > 1, 'k=' + S.t.k.toFixed(3));
  const k1 = S.t.k;
  dispatch(svg, 'wheel', {deltaY:240, clientX:600, clientY:400});
  t('Rad zurück verkleinert wieder', S.t.k < k1, 'k=' + S.t.k.toFixed(3));

  zuruecksetzen();
  document.getElementById('zIn').click();
  t('der Plus-Knopf vergrößert um ein Viertel', Math.abs(S.t.k - 1.25) < 1e-9, 'k=' + S.t.k);
  document.getElementById('zOut').click();
  t('der Minus-Knopf verkleinert wieder', Math.abs(S.t.k - 1) < 1e-9, 'k=' + S.t.k);
  t('die Anzeige nennt den Maßstab in Prozent',
    /%$/.test(document.getElementById('zoomVal').textContent),
    document.getElementById('zoomVal').textContent);

  // Grenzen: der Maßstab läuft weder ins Unendliche noch auf null
  for(let i = 0; i < 20; i++) document.getElementById('zIn').click();
  t('nach oben bei 3 gedeckelt', S.t.k === 3, 'k=' + S.t.k);
  for(let i = 0; i < 40; i++) document.getElementById('zOut').click();
  t('nach unten bei 0,15 gedeckelt', S.t.k === 0.15, 'k=' + S.t.k);
  zuruecksetzen();
}

console.log('== Mittelstück eines bestehenden Ortho-Zuges versetzen ==');
{
  /* Der andere Zweig — die Direktlinie ohne Stützpunkte — steht in kanten.js.
     Hier hat die Kante bereits Knicke: dann werden vier Punkte eingesetzt,
     damit die beiden Enden achsparallel bleiben. */
  zuruecksetzen();
  [...document.getElementById('layoutMenu').querySelectorAll('[data-algo]')]
    .filter(b => b.dataset.algo === 'ortho').forEach(b => b.onclick && b.onclick());
  const e = S.graph.edges.find(x => x.ortho && x.bends && x.bends.length);
  t('eine rechtwinklige Kante mit Knicken gefunden', !!e);
  if(e){
    S.selEdge = e.id; api.draw();
    const gh = [...document.getElementById('handles').querySelectorAll('.gh')];
    t('sie bietet Zusatzpunkt-Griffe an', gh.length > 0, gh.length + ' Griffe');
    if(gh.length){
      const vorher = e.bends.length;
      dispatch(gh[0], 'pointerdown', {clientX:300, clientY:300, pointerId:5});
      t('vier Punkte kommen dazu, nicht einer', e.bends.length === vorher + 4,
        vorher + ' → ' + e.bends.length);
      const paare = JSON.stringify(e.bends);
      dispatch(svg, 'pointermove', {clientX:360, clientY:360, pointerId:5});
      dispatch(svg, 'pointerup',   {clientX:360, clientY:360, pointerId:5});
      t('das Ziehen versetzt das Mittelstück', JSON.stringify(e.bends) !== paare);
      t('die Kante gilt danach als von Hand bearbeitet', e.manual === true);
      const p = e.bends;
      const schief = p.slice(1).filter((q,i) =>
        Math.abs(q.x - p[i].x) > 0.5 && Math.abs(q.y - p[i].y) > 0.5).length;
      t('der Zug bleibt rechtwinklig', schief === 0, schief + ' schräge Strecken');
    }
  }
}

finish();
})();
