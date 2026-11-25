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

console.log('== Lizenzhinweis: Haken ==');
{
  L.removeItem(KEY);
  await neuStart();
  api.setMode('komplett');
  const hoehe = svg => +svg.match(/height="(\d+)"/)[1];
  const hinweis = ()=> /class="att"/.test(api.exportSVG());
  const oeffne = ()=>{ dispatch($('btnEinst'), 'click', {}); dispatch($('optLizenz'), 'click', {}); };
  const setze = an => { oeffne(); $('lizenzAn').checked = an; dispatch($('lizenzOk'), 'click', {}); };
  const setzeFelder = w => { oeffne(); Object.entries(w).forEach(([id, v])=>{ $(id).value = v; }); dispatch($('lizenzOk'), 'click', {}); };
  t('Vorgabe ein: der Hinweis steht im Bild', S.lizenzAn && hinweis() && api.exportSVG().includes('© DDVUG e.V.'));
  const h = hoehe(api.exportSVG());
  S.pflegeAn = false;
  oeffne();
  t('der Dialog zeigt meta', !$('lizenzDlg').hidden && $('lizenzAn').checked && $('lzTitel').value === 'Willibald'
    && $('lzUrheber').value === 'DDVUG e.V.' && $('lzLizenz').value === 'CC BY 4.0' && /creativecommons/.test($('lzUrl').value) && $('lzHinweis').value === '');
  t('ohne „Bearbeiten" sind die Felder gesperrt, mit Erklärung', $('lzUrheber').disabled && !$('lizenzGesperrt').hidden && !$('lizenzAn').disabled);
  $('lzUrheber').value = 'Fremd';
  $('lizenzAn').checked = false;
  const vorText = S.yamlText;
  dispatch($('lizenzOk'), 'click', {});
  t('der Haken wirkt trotzdem, der Text bleibt', $('lizenzDlg').hidden && !hinweis() && S.yamlText === vorText);
  t('ohne Hinweis ist das Bild 20 px niedriger', hoehe(api.exportSVG()) === h - 20, hoehe(api.exportSVG()) + ' / ' + h);
  t('auch die PNG-Höhe folgt', api.attributionLine() === '');
  api.undo();
  t('Strg+Z schaltet wieder ein', hinweis());
  api.redo();
  t('Strg+Y wieder aus', !hinweis());
  const stand = api.layoutFile();
  S.lizenzAn = true;
  api.adoptLayoutFile(stand);
  t('die Positionsinformationen tragen den Haken', S.lizenzAn === false);
  delete stand.lizenzhinweis;
  api.adoptLayoutFile(stand);
  t('ohne den Schlüssel gilt ein', S.lizenzAn === true);
  setze(false);
  const vorher = api.layoutFile();
  oeffne(); $('lizenzAn').checked = true; dispatch($('lizenzAbbruch'), 'click', {});
  t('Abbrechen ändert nichts', !S.lizenzAn && $('lizenzDlg').hidden);
  oeffne(); $('lizenzAn').checked = true; dispatch($('lzTitel'), 'keydown', {key:'Escape'});
  t('Escape auch aus einem Feld heraus nicht', !S.lizenzAn && $('lizenzDlg').hidden);
  oeffne(); dispatch($('lizenzOk'), 'click', {});
  api.undo();
  t('ohne Änderung entsteht kein Verlaufsschritt', S.lizenzAn === true);

  console.log('== Lizenzhinweis: Angaben ==');
  S.pflegeAn = true;
  oeffne();
  t('mit „Bearbeiten" sind die Felder offen', !$('lzUrheber').disabled && $('lizenzGesperrt').hidden);
  dispatch($('lizenzAbbruch'), 'click', {});
  const alt = S.yamlText;
  setzeFelder({lzUrheber: 'X: Y "Z"'});
  t('geändert wird nur diese Zeile', S.yamlText === alt.replace('  urheber: DDVUG e.V.', '  urheber: "X: Y \\"Z\\""'), S.yamlText.slice(0, 160));
  t('das Bild nennt den neuen Urheber', api.attributionLine().includes('© X: Y "Z"'), api.attributionLine());
  api.undo();
  t('Strg+Z nimmt die Angabe zurück', S.yamlText === alt && S.model.meta.urheber === 'DDVUG e.V.');
  setzeFelder({lzLizenz: '', lzUrl: ''});
  t('geleerte Felder fallen weg', /^meta:\n  titel: Willibald\n  urheber: DDVUG e\.V\.\n\nBusinessObjects:/.test(S.yamlText.replace(/\r/g, '')), S.yamlText.slice(0, 120));
  setzeFelder({lzUrheber: '', lzHinweis: 'Nur intern'});
  t('ein Hinweis allein erscheint', /Nur intern/.test(api.attributionLine()) && hinweis());
  setzeFelder({lzHinweis: ''});
  t('der Titel allein nicht', !hinweis());
  api.setSelection(['o:Bestellung']);
  api.pflegeStart('o:Bestellung');
  oeffne();
  t('bei offenem Formular öffnet sich der Dialog nicht', $('lizenzDlg').hidden && S.pflege === 'o:Bestellung');
  api.pflegeEnde();
  setze(false);
  await api.loadYaml('BusinessObjects:\n  A:\n    Domain: D\n', 'neu.yaml');
  t('ein anderes Modell beginnt mit ein', S.lizenzAn === true && !hinweis());
  S.pflegeAn = true;
  setzeFelder({lzUrheber: 'Ich'});
  t('ohne meta entsteht der Abschnitt am Anfang', S.yamlText.startsWith('meta:\n  urheber: Ich\n\nBusinessObjects:') && !!S.model.objects.A, S.yamlText);
  setzeFelder({lzUrheber: ''});
  t('alles leer: der Abschnitt entfällt', S.yamlText === 'BusinessObjects:\n  A:\n    Domain: D\n', S.yamlText);

  console.log('== Lizenzhinweis: Eingriff in den Text ==');
  const werte = (text, neu = {}) => { const m = api.buildModel(text).meta; return Object.assign({}, m, neu); };
  const REST = '\n# Objekte\nBusinessObjects:\n  A:\n    Domain: D\n';
  const fremd = 'meta:   # Kopf\n  # eigen\n  stand: 2026\n  license: MIT  # frei\n  # dazu\n  hinweis: |\n    eins\n    zwei\n' + REST;
  t('unverändert bleibt der Text, auch mehrzeilig', api.goMetaAendern(fremd, werte(fremd)) === fremd);
  t('Fremdes, Kommentare und englische Schreibweise bleiben',
    api.goMetaAendern(fremd, werte(fremd, {lizenz:'BSD'})) === fremd.replace('license: MIT  # frei', 'license: BSD # frei'), api.goMetaAendern(fremd, werte(fremd, {lizenz:'BSD'})));
  t('ein entferntes Feld lässt den Kommentar dahinter stehen',
    api.goMetaAendern(fremd, werte(fremd, {lizenz:''})) === fremd.replace('  license: MIT  # frei\n', ''), api.goMetaAendern(fremd, werte(fremd, {lizenz:''})));
  t('ein mehrzeiliger Hinweis geht ganz', api.goMetaAendern(fremd, werte(fremd, {hinweis:''})) === fremd.replace('  hinweis: |\n    eins\n    zwei\n', ''),
    api.goMetaAendern(fremd, werte(fremd, {hinweis:''})));
  const inline = 'meta: {titel: A, stand: 2026}\n' + REST;
  const i2 = api.goMetaAendern(inline, werte(inline, {urheber:'U'}));
  const im = api.buildModel(i2).meta;
  t('einzeilig geschrieben: Werte bleiben erhalten', im.titel === 'A' && im.urheber === 'U' && /stand: "?2026/.test(i2) && i2.endsWith(REST), i2);
}

finish();
})();
