/* Rauchtest: was sich der Browser merkt — „Geschäftsobjekte bearbeiten",
   „Quelltabellen verwenden", „Quelltabellen bearbeiten" und die Auswahl der
   Zusatzattribute. Die drei Schalter setzen sich gegen die Datei durch, die
   Zusatzattribute nur, wenn die Datei keine mitbringt. */
const {bootApp, makeT} = require('./start');

(async ()=>{
const {S, api, win, document, dispatch} = await bootApp();
const {t, finish} = makeT();

const $ = id => document.getElementById(id);
const detail = ()=> $('detailBody');
const KEY = 'geschaeftsobjekt-explorer:einstellungen';
const L = win.localStorage;
const neuStart = async ()=>{ await api.boot(); for(let k=0;k<50;k++) await Promise.resolve(); };
const menue = id => { dispatch($('btnEinst'), 'click', {}); dispatch($('' + id), 'click', {}); dispatch($('btnEinst'), 'click', {}); };

console.log('== Vorgabe: nichts gemerkt ==');
t('alle Schalter aus', !S.pflegeAn && !S.quellenAn && !S.quellPflegeAn);
t('nichts im Speicher', L.getItem(KEY) === null);

console.log('== Umschalten wird gemerkt und überlebt das Neuladen ==');
{
  menue('optPflege');
  menue('optQuellen');
  menue('optQuellPflege');
  const g = JSON.parse(L.getItem(KEY) || 'null');
  t('gemerkt sind alle drei', g && g.pflegeAn && g.quellenAn && g.quellPflegeAn, L.getItem(KEY));

  api.setMode('komplett');
  dispatch($('btnEinst'), 'click', {});
  dispatch($('optZusatz'), 'click', {});
  const box = $('zusatzListe').querySelector('input[data-k="schema.org"][data-ebene="objekt"]');
  box.checked = true;
  dispatch(box, 'change', {});
  dispatch($('zusatzZu'), 'click', {});
  t('auch das Zusatzattribut', JSON.parse(L.getItem(KEY)).zusatzAn.objekt.join(',') === 'schema.org');

  S.pflegeAn = S.quellenAn = S.quellPflegeAn = false;
  S.zusatzAn = {objekt:[], attribut:[]};
  await neuStart();
  t('nach dem Neuladen: Geschäftsobjekte bearbeiten', S.pflegeAn === true);
  t('Quelltabellen verwenden', S.quellenAn === true);
  t('Quelltabellen bearbeiten', S.quellPflegeAn === true);
  t('Zusatzattribut schema.org', S.zusatzAn.objekt.join(',') === 'schema.org', S.zusatzAn.objekt.join(','));
  t('die Haken stehen', $('optPflege').getAttribute('aria-checked') === 'true'
    && $('optQuellen').getAttribute('aria-checked') === 'true'
    && $('optQuellPflege').getAttribute('aria-checked') === 'true');
  t('der Start gilt nicht als Änderung', !api.ungesichert());
}

console.log('== Datei gegen Browser ==');
{
  await api.loadYaml(S.yamlText, 'datei.yaml',
    {pflegeAn:false, quelltabellen:{an:false, pflegeAn:false}, zusatzfelder:{objekt:[], attribut:['schema.org']}});
  t('die Schalter kommen aus dem Browser', S.pflegeAn && S.quellenAn && S.quellPflegeAn);
  t('die Zusatzattribute aus der Datei', S.zusatzAn.objekt.length === 0 && S.zusatzAn.attribut.join(',') === 'schema.org',
    JSON.stringify(S.zusatzAn));
  t('der Browser übernimmt die Liste der Datei nicht', JSON.parse(L.getItem(KEY)).zusatzAn.objekt.join(',') === 'schema.org');
  t('auch das gilt nicht als Änderung', !api.ungesichert());
  api.setMode('komplett');
  S.graph.nodes.find(x => !x.hidden).x += 50;
  api.persist();
  api.undo();
  t('ein Strg+Z ohne Schalter schreibt die Liste der Datei nicht in den Browser',
    JSON.parse(L.getItem(KEY)).zusatzAn.attribut.length === 0, L.getItem(KEY));

  await api.loadYaml(S.yamlText, 'ohne.yaml', {pflegeAn:false});
  t('ohne Zusatzattribute in der Datei gilt die gemerkte Liste', S.zusatzAn.objekt.join(',') === 'schema.org'
    && S.zusatzAn.attribut.length === 0, JSON.stringify(S.zusatzAn));
}

console.log('== Strg+Z nimmt auch das Gemerkte zurück ==');
{
  menue('optPflege');
  t('ausgeschaltet und gemerkt', S.pflegeAn === false && JSON.parse(L.getItem(KEY)).pflegeAn === false);
  api.undo();
  t('Rückgängig schaltet wieder ein', S.pflegeAn === true);
  t('und merkt es', JSON.parse(L.getItem(KEY)).pflegeAn === true);
}

console.log('== Fremde Schlüssel bleiben gemerkt, erscheinen aber nicht ==');
{
  L.setItem(KEY, JSON.stringify({pflegeAn:true, quellenAn:false, quellPflegeAn:false,
    zusatzAn:{objekt:['fremd', 'schema.org'], attribut:['auchFremd']}}));
  await neuStart();
  api.setMode('komplett');
  t('die Liste steht wie gemerkt', S.zusatzAn.objekt.join(',') === 'fremd,schema.org');
  api.setSelection(['o:Bestellung']);
  const dts = [...detail().querySelectorAll('dt')].map(d => d.textContent);
  t('die Details zeigen schema.org', dts.includes('schema.org'), dts.join(','));
  t('aber nicht den fremden Schlüssel', !dts.includes('fremd'), dts.join(','));
  dispatch(detail().querySelector('[data-edit]'), 'click', {});
  t('das Formular hat ein Feld je bekanntem Schlüssel', detail().querySelectorAll('.pfo-extra').length === 1
    && detail().querySelectorAll('.pfa-extra').length === 0);
  t('und der Entwurf kennt nur diese', !/fremd/i.test(detail().textContent));
  dispatch($('pfCancel'), 'click', {});

  dispatch($('btnEinst'), 'click', {});
  dispatch($('optZusatz'), 'click', {});
  const box = $('zusatzListe').querySelector('input[data-k="schema.org"][data-ebene="objekt"]');
  box.checked = false;
  dispatch(box, 'change', {});
  dispatch($('zusatzZu'), 'click', {});
  t('Abschalten im Dialog lässt den fremden Schlüssel stehen',
    JSON.parse(L.getItem(KEY)).zusatzAn.objekt.join(',') === 'fremd');
}

finish();
})();
