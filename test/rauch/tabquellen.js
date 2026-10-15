/* Rauchtest: Table_Sources eines Geschäftsobjekts — als eigenes Element
   (Einstellungen → Als eigenes Element → Quelltabellen) und als Zeilen im
   Kasten (Inhalt → Quelltabellen). Beides nur bei den Geschäftsobjekten;
   bei den Quelltabellen gibt es weder diesen Schalter noch „Quellen". */
const {bootApp, makeT} = require('./start');

(async ()=>{
const {S, api, document, dispatch, html} = await bootApp();
const {t, finish} = makeT();

const $ = id => document.getElementById(id);
const klick = el => dispatch(typeof el === 'string' ? $(el) : el, 'click', {});
const tq = ()=> S.graph.nodes.filter(n => n.kind === 'tabsource');
const inhalt = k => $('contentList').querySelector(`[data-content="${k}"]`);

const GO = [
  'BusinessObjects:',
  '  Auftrag:',
  '    Domain: Vertrieb',
  '    sources:',
  '    - Webshop',
  '    Table_Sources:',
  '    - Webshop.Auftrag',
  '    - Roadshow.Auftrag_RS',
  '  Kunde:',
  '    Domain: Vertrieb',
  '    Table_Sources:',
  '    - Webshop.Kunde',
  ''
].join('\n');
const TAB = [
  'SourceTables:',
  '  Webshop:',
  '    Auftrag:',
  '      business_object: Auftrag',
  '      attributes:',
  '      - name: AuftragNr',
  '        primary_key: true',
  ''
].join('\n');

await api.loadYaml(GO, 'auftrag.yaml');
api.setMode('komplett');

console.log('== Der Schalter gilt nur bei den Geschäftsobjekten ==');
{
  t('Einstellungen bieten „Quelltabellen"', !!$('optTabQuelle'));
  t('er und „Quellen" tragen die Klasse nur-go',
    !!$('optTabQuelle') && $('optTabQuelle').classList.contains('nur-go') && $('optQuelle').classList.contains('nur-go'));
  t('die Klasse blendet sie bei den Quelltabellen aus', /body\.modus-quellen \.nur-go\{display:none/.test(html));
}

console.log('== Quelltabellen als eigene Elemente ==');
{
  if($('optTabQuelle')) klick('optTabQuelle');
  t('Haken ist gesetzt', !!$('optTabQuelle') && $('optTabQuelle').getAttribute('aria-checked') === 'true' && S.elemente.tabquellen === true);
  t('je Objekt und Tabelle ein eigener Kasten', tq().map(n => n.name).sort().join(',')
    === 'Roadshow.Auftrag_RS,Webshop.Auftrag,Webshop.Kunde', tq().map(n => n.name).join(','));
  const k = S.graph.edges.filter(e => e.kind === 'tabquelle');
  t('verbunden über „Quelltabelle", ohne Kardinalität',
    k.length === 3 && k.every(e => e.label === 'Quelltabelle' && !e.fromCard && !e.toCard));
  const falsch = tq().filter(n =>{ const p = S.graph.byId.get(n.eltern); return n.x < p.x + p.w; });
  t('rechts neben ihrem Objekt', !falsch.length, falsch.map(n => n.id).join(', '));
  t('die Legende erklärt die Kante', /Quelltabelle, ohne Kardinalität/.test($('legend').innerHTML));
  t('die Kante wird gezeichnet', /class="eg tabquelle/.test($('edges').innerHTML));
  const w = tq().find(n => n.name === 'Webshop.Auftrag');
  if(w) api.setSelection([w.id]);
  const d = $('detailBody').innerHTML;
  t('die Details nennen das versorgte Objekt', !!w && /QUELLTABELLE/.test(d) && /data-goto="o:Auftrag"/.test(d) && !/o:Kunde/.test(d));
  api.setSelection([]);
}

console.log('== Inhalt: Quelltabellen als Zeilen im Kasten ==');
{
  t('„Quelltabellen" im Inhalt ist gesperrt, solange das Element steht',
    !!inhalt('tabSources') && inhalt('tabSources').classList.contains('off'));
  if($('optTabQuelle')) klick('optTabQuelle');
  t('ausgeschaltet: keine Kästen mehr', !tq().length);
  if(inhalt('tabSources')) klick(inhalt('tabSources'));
  const rows = S.graph.byId.get('o:Auftrag').rows.filter(r => r.kind === 'tab').map(r => r.text);
  t('die Tabellen stehen als Zeilen im Kasten', rows.join(',') === 'Webshop.Auftrag,Roadshow.Auftrag_RS', rows.join(','));
  t('mit eigenem Kürzel', /class="n-tag tab"[^>]*>tab</.test($('nodes').innerHTML));
  if($('optTabQuelle')) klick('optTabQuelle');
  t('mit Element an kein Zeilen-Doppel im Kasten', S.graph.nodes.every(n => !n.rows.some(r => r.kind === 'tab')));
}

console.log('== Einstellung wird gemerkt ==');
{
  const sitzung = api.layoutFile();
  t('im Stand abgelegt', sitzung.elemente.tabquellen === true, JSON.stringify(sitzung.elemente));
  S.elemente = {};
  api.adoptLayoutFile(sitzung);
  t('ein geladener Stand bringt sie mit', S.elemente.tabquellen === true);
}

console.log('== Bei den Quelltabellen weder Quellen noch Quelltabellen ==');
{
  S.elemente = Object.assign({}, S.elemente, {quelle:true, tabquellen:true});
  klick('optQuellen');
  global.confirm = ()=> false;
  api.loadQuellen(TAB, 'tab.yaml');
  api.setMode('quellen');
  S.elemente = {quelle:true, tabquellen:true};    // gilt je Diagramm: auch hier gesetzt
  api.selectDiagram(S.hierSel);
  t('Tabellen sind da', S.graph.nodes.some(n => n.kind === 'object'));
  t('kein Quellkasten', !S.graph.nodes.some(n => n.kind === 'source'));
  t('kein Quelltabellen-Kasten', !tq().length);
  t('die Legende schweigt dazu', !/Quelle, ohne|Quelltabelle, ohne/.test($('legend').innerHTML));
  t('„Quellen" im Inhalt ist hier nicht gesperrt', !inhalt('sources').classList.contains('off'));
  t('„Quelltabellen" fehlt im Inhalt', !inhalt('tabSources'));
  api.setMode('komplett');
  t('zurück bei den Geschäftsobjekten sind beide wieder da',
    S.graph.nodes.some(n => n.kind === 'source') && tq().length === 3);
}

finish();
})();
