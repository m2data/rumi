/* Rauchtest: Attribute eines Geschäftsobjekts zusammenführen, trennen und
   umbenennen. Die Übernahme aus den Quelltabellen führt gleichnamige
   Attribute zusammen; alles andere entscheidet der Dialog „Attribute
   zusammenführen", erreichbar aus den Details und dem Kontextmenü, nur mit
   eingeschaltetem „Geschäftsobjekte bearbeiten". */
const {bootApp, makeT} = require('./start');

(async ()=>{
const {S, api, document, dispatch} = await bootApp();
const {t, finish} = makeT();

const $ = id => document.getElementById(id);
const klick = el => dispatch(typeof el === 'string' ? $(el) : el, 'click', {});
const detail = ()=> $('detailBody');
const liste = ()=> $('attrDlgListe');
const zeilen = ()=> [...liste().querySelectorAll('.ad-name')].map(f => f.value);
const markiere = (...is)=> is.forEach(i => { liste().querySelector('.ad-mark[data-i="' + i + '"]').checked = true; });
const name = (i, v)=> { liste().querySelector('.ad-name[data-i="' + i + '"]').value = v; };
const attr = n => S.model.objects.Auftrag.attrs.find(a => a.name === n);
const q = a => (a ? a.quellen : []).join(',');
const oeffnen = ()=>{ api.setSelection(['o:Auftrag']); const b = detail().querySelector('[data-attrdlg]'); if(b) klick(b); return !$('attrDlg').hidden; };

const GO = [
  'BusinessObjects:',
  '  Auftrag:',
  '    Domain: Vertrieb',
  '    business_keys:',
  '    - AuftragNr',
  '    attributes:',
  '    - name: AuftragNr   # die Nummer',
  '      type: int',
  '      primary_key: true',
  '    - name: Datum',
  '      type: date',
  '  Rechnung:',
  '    Domain: Vertrieb',
  '    attributes:',
  '    - name: AuftragRef',
  '      foreign_key: true',
  '      references: Auftrag.KdNr',
  '    - name: Nummer',
  '      references: Auftrag.AuftragNr',
  ''
].join('\n');
const TAB = [
  'SourceTables:',
  '  Webshop:',
  '    Auftrag:',
  '      business_object: Auftrag',
  '      attributes:',
  '      - name: AuftragNr',
  '        type: int',
  '        primary_key: true',
  '      - name: KundeID',
  '        type: char(13)',
  '  Roadshow:',
  '    Auftrag_RS:',
  '      business_object: Auftrag',
  '      attributes:',
  '      - name: AuftragNr',
  '        type: bigint',
  '        primary_key: true',
  '      - name: KdNr',
  '        type: int',
  ''
].join('\n');

await api.loadYaml(GO, 'auftrag.yaml');
api.setMode('komplett');
klick('optQuellen');
api.loadQuellen(TAB, 'tabellen.yaml');

console.log('== Übernahme: gleichnamige zusammen, alle anderen dazu ==');
{
  const A = S.model.objects.Auftrag;
  t('Reihenfolge: vorhandene, dann neue Attribute', A.attrs.map(a => a.name).join(',') === 'AuftragNr,Datum,KundeID,KdNr',
    A.attrs.map(a => a.name).join(','));
  t('gleichnamige aus zwei Tabellen sind eins', q(attr('AuftragNr')) === 'Webshop.Auftrag.AuftragNr,Roadshow.Auftrag_RS.AuftragNr');
  t('das vorhandene behält seinen Typ', attr('AuftragNr').type === 'int' && attr('AuftragNr').pk);
  t('abweichender Typ einer Quelle wird gemeldet', $('msgList').innerHTML.includes('Auftrag.AuftragNr: Quellen mit abweichendem Typ'));
  t('kein zweiter Business Key', A.keys.join(',') === 'AuftragNr');
}

console.log('== Aufruf ==');
{
  S.pflegeAn = false;
  api.setSelection(['o:Auftrag']);
  t('ohne „Geschäftsobjekte bearbeiten" kein Knopf', !detail().querySelector('[data-attrdlg]'));
  S.pflegeAn = true;
  t('mit dem Schalter öffnet der Knopf den Dialog', oeffnen());
  t('je Attribut eine Zeile, Namen vorbelegt', zeilen().join(',') === 'AuftragNr,Datum,KundeID,KdNr', zeilen().join(','));
  const quellen = liste().querySelectorAll('.ad-q');
  t('die Quellen stehen mit Typ unter dem Attribut', /Webshop\.Auftrag\.AuftragNr · int · PK/.test(liste().textContent)
    && /Roadshow\.Auftrag_RS\.AuftragNr · bigint · PK/.test(liste().textContent), liste().textContent.slice(0, 300));
  t('der abweichende Typ ist markiert', liste().querySelectorAll('.ad-q.anders').length === 1);
  t('„abtrennen" nur an Attributen mit mehreren Quellen', liste().querySelectorAll('[data-ab]').length === 2
    && [...liste().querySelectorAll('[data-ab]')].every(b => b.dataset.ab === '0'));
  klick('attrAbbruch');
  t('Abbrechen schließt', $('attrDlg').hidden);
  api.setMode('quellen');
  api.selectDiagram('Quellsysteme');
  api.setSelection(['o:Webshop.Auftrag']);
  t('an einer Quelltabelle gibt es den Knopf nicht', !detail().querySelector('[data-attrdlg]'));
  api.setMode('komplett');
}

console.log('== Zusammenführen ==');
{
  oeffnen();
  const vorher = S.yamlText;
  markiere(2);
  klick('attrMerge');
  t('ein markiertes Attribut reicht nicht', zeilen().length === 4 && /zwei/.test($('toast').textContent));
  markiere(2, 3);
  klick('attrMerge');
  t('aus KundeID und KdNr wird eins', zeilen().join(',') === 'AuftragNr,Datum,KundeID', zeilen().join(','));
  klick('attrOk');
  t('der Dialog schließt', $('attrDlg').hidden);
  t('KundeID trägt beide Quellen', q(attr('KundeID')) === 'Webshop.Auftrag.KundeID,Roadshow.Auftrag_RS.KdNr', q(attr('KundeID')));
  t('KdNr ist weg', !attr('KdNr'));
  t('ein Verweis auf das entfallene zeigt aufs bleibende', S.model.objects.Rechnung.attrs[0].ref === 'Auftrag.KundeID',
    S.model.objects.Rechnung.attrs[0].ref);

  oeffnen();
  klick(liste().querySelector('[data-ab="2"][data-k="1"]'));
  t('abgetrennt mit freiem Spaltennamen heißt wie die Spalte', zeilen().join(',') === 'AuftragNr,Datum,KundeID,KdNr', zeilen().join(','));
  klick('attrAbbruch');
  t('Abbrechen verwirft das Abtrennen', !attr('KdNr'));

  api.undo();
  t('Strg+Z nimmt das Zusammenführen in einem Schritt zurück', S.yamlText === vorher);
}

console.log('== Abtrennen ==');
{
  oeffnen();
  klick(liste().querySelector('[data-ab="0"][data-k="1"]'));
  t('die Quelle wird ein eigenes Attribut direkt darunter, Name mit Tabelle',
    zeilen().join(',') === 'AuftragNr,AuftragNr_Auftrag_RS,Datum,KundeID,KdNr', zeilen().join(','));
  klick('attrOk');
  const neu = attr('AuftragNr_Auftrag_RS');
  t('mit den Eigenschaften der Quellspalte', neu && neu.type === 'bigint' && neu.pk, JSON.stringify(neu));
  t('die Quelle ist umgezogen', q(neu) === 'Roadshow.Auftrag_RS.AuftragNr' && q(attr('AuftragNr')) === 'Webshop.Auftrag.AuftragNr');
  t('jetzt kein abweichender Typ mehr', !$('msgList').innerHTML.includes('Quellen mit abweichendem Typ'));
  dispatch([...$('menu').querySelectorAll('button')].find(b => b.dataset.act === 'uebernehmen'), 'click', {});
  t('eine neue Übernahme vereinigt Getrenntes nicht wieder', !!attr('AuftragNr_Auftrag_RS') && q(attr('AuftragNr')) === 'Webshop.Auftrag.AuftragNr');
  t('der abgetrennte Primärschlüssel wird beim nächsten Lauf Business Key',
    S.model.objects.Auftrag.keys.join(',') === 'AuftragNr,AuftragNr_Auftrag_RS', S.model.objects.Auftrag.keys.join(','));
  api.undo(); api.undo();
}

console.log('== Umbenennen ==');
{
  oeffnen();
  name(0, 'Auftragsnummer');
  klick('attrOk');
  const A = S.model.objects.Auftrag;
  t('das Attribut heißt neu und behält seine Quellen', !!attr('Auftragsnummer') && !attr('AuftragNr')
    && q(attr('Auftragsnummer')) === 'Webshop.Auftrag.AuftragNr,Roadshow.Auftrag_RS.AuftragNr');
  t('der Business Key zieht mit', A.keys.join(',') === 'Auftragsnummer', A.keys.join(','));
  t('references in anderen Objekten ziehen mit', S.model.objects.Rechnung.attrs[1].ref === 'Auftrag.Auftragsnummer');

  // Eine neue Tabelle mit der Spalte unter altem Namen findet das umbenannte Attribut
  api.loadQuellen(TAB + '    Auftrag_Alt:\n      business_object: Auftrag\n      attributes:\n      - name: AuftragNr\n        primary_key: true\n', 'mehr.yaml');
  t('über den Spaltennamen in den Quellen landet sie im umbenannten Attribut',
    q(attr('Auftragsnummer')).endsWith('Roadshow.Auftrag_Alt.AuftragNr') && !attr('AuftragNr'), q(attr('Auftragsnummer')));
  t('ihr PK ergibt keinen zweiten Business Key', S.model.objects.Auftrag.keys.join(',') === 'Auftragsnummer', S.model.objects.Auftrag.keys.join(','));
  api.undo(); api.undo();
}

console.log('== Prüfungen vor dem Übernehmen ==');
{
  oeffnen();
  const vorher = S.yamlText;
  name(1, '');
  klick('attrOk');
  t('leerer Name wird abgelehnt', S.yamlText === vorher && !$('attrDlg').hidden && /Namen/.test($('toast').textContent));
  name(1, 'KundeID');
  klick('attrOk');
  t('doppelter Name wird abgelehnt', S.yamlText === vorher && /gleich/.test($('toast').textContent));
  name(1, 'Da.tum');
  klick('attrOk');
  t('ein Punkt wird abgelehnt', S.yamlText === vorher && /\./.test($('toast').textContent));
  name(1, 'Bestelldatum');
  klick('attrAbbruch');
  t('Abbrechen verwirft auch ein Umbenennen', S.yamlText === vorher);
}

console.log('== Nur Geändertes wird geschrieben ==');
{
  oeffnen();
  const vorher = S.yamlText;
  name(1, 'Bestelldatum');
  klick('attrOk');
  const a = vorher.split('\n'), b = S.yamlText.split('\n');
  t('genau eine Zeile anders', b.length === a.length && b.filter(l => !a.includes(l)).join('|') === '    - name: Bestelldatum',
    b.filter(l => !a.includes(l)).join('|'));
  api.undo();
  t('Strg+Z: wieder wie vorher', S.yamlText === vorher);
}

console.log('== Stand von vorher: schon übernommene Tabellen werden aktualisiert ==');
{
  // So sah ein Objekt nach der Übernahme vor der Attributregel aus: die
  // Tabellen stehen in Table_Sources, die Attribute tragen keine Quellen
  await api.loadYaml([
    'BusinessObjects:',
    '  Auftrag:',
    '    Domain: Vertrieb',
    '    attributes:',
    '    - name: AuftragNr',
    '      type: int',
    '    Table_Sources:',
    '    - Webshop.Auftrag',
    '    - Roadshow.Auftrag_RS',
    ''
  ].join('\n'), 'vorher.yaml');
  if(!S.quellenAn) klick('optQuellen');
  S.quellText = TAB; S.quellModell = api.buildModel(TAB, 'quelle');
  dispatch([...$('menu').querySelectorAll('button')].find(b => b.dataset.act === 'uebernehmen'), 'click', {});
  const A = S.model.objects.Auftrag;
  t('die Rückmeldung zählt das Objekt als aktualisiert', /Übernahme: 0 angelegt, 1 aktualisiert, 0 unverändert/.test($('toast').textContent),
    $('toast').textContent);
  t('gleichnamige bekommen ihre Quellen', q(attr('AuftragNr')) === 'Webshop.Auftrag.AuftragNr,Roadshow.Auftrag_RS.AuftragNr', q(attr('AuftragNr')));
  t('fehlende Attribute der Quellen kommen dazu', A.attrs.map(a => a.name).join(',') === 'AuftragNr,KundeID,KdNr',
    A.attrs.map(a => a.name).join(','));
  t('der PK wird Business Key', A.keys.join(',') === 'AuftragNr');
  S.pflegeAn = true;
  oeffnen();
  const alleQuellen = [...liste().querySelectorAll('.ad-q')].map(d => d.textContent.split('·')[0].replace('←', '').trim()).sort().join(',');
  t('der Dialog zeigt jede Spalte jeder Quelle', alleQuellen
    === 'Roadshow.Auftrag_RS.AuftragNr,Roadshow.Auftrag_RS.KdNr,Webshop.Auftrag.AuftragNr,Webshop.Auftrag.KundeID', alleQuellen);
  klick('attrAbbruch');
  const vorher = S.yamlText;
  dispatch([...$('menu').querySelectorAll('button')].find(b => b.dataset.act === 'uebernehmen'), 'click', {});
  t('ein zweiter Lauf ändert nichts', S.yamlText === vorher && /0 angelegt, 0 aktualisiert, 1 unverändert/.test($('toast').textContent),
    $('toast').textContent);
}

finish();
})().catch(e=>{ console.error(e); process.exit(1); });
