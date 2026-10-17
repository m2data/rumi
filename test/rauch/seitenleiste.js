/* Rauchtest: Breite der Seitenleiste — Ziehgriff an ihrer Kante zur
   Zeichenfläche, Grenzen, Doppelklick auf die Standardbreite. Die Breite ist
   eine reine Ansichtseinstellung: sie zählt nicht als Änderung und landet
   weder im Browser noch in den Positionsinformationen. */
const {bootApp, makeT} = require('./start');

(async ()=>{
const {S, api, win, document, dispatch} = await bootApp();
const {t, finish} = makeT();

const griff = document.getElementById('seitenGriff');
const seite = document.getElementById('sidebar');
const breite = ()=> seite.style.flexBasis;
const ziehen = (von, nach)=>{
  dispatch(griff, 'pointerdown', {clientX:von});
  dispatch(griff, 'pointermove', {clientX:nach});
  dispatch(griff, 'pointerup', {clientX:nach});
};

console.log('== Griff ==');
t('Griff vorhanden', !!griff);
if(!griff){ finish(); return; }
t('Griff ist ein Trenner', griff.getAttribute('role') === 'separator');

console.log('== Ziehen ==');
{
  const sauber = !api.ungesichert();
  const x0 = S.t.x;
  ziehen(268, 368);
  t('breiter gezogen', breite() === '368px', breite());
  t('Diagramm bleibt stehen', S.t.x === x0 - 100, x0 + ' → ' + S.t.x);
  t('Ziehen ist keine Änderung', !api.ungesichert() === sauber);
  dispatch(griff, 'pointermove', {clientX:500});
  t('Bewegen ohne Drücken ändert nichts', breite() === '368px', breite());
  ziehen(368, 50);
  t('Mindestbreite 220', breite() === '220px', breite());
  ziehen(220, 5000);
  t('Höchstbreite 640 (60 % von 1600, gedeckelt)', breite() === '640px', breite());
  dispatch(griff, 'dblclick');
  t('Doppelklick holt 268 zurück', breite() === '268px', breite());
  t('Diagramm wieder am Ausgangspunkt', S.t.x === x0, x0 + ' → ' + S.t.x);
}

console.log('== Nichts gemerkt ==');
t('nichts im localStorage', win.localStorage.length === 0, Object.keys(win.localStorage._d).join(','));
t('nicht in den Positionsinformationen', !/268|640|breite/i.test(Object.keys(api.layoutFile()).join(',')));

finish();
})();
