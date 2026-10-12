/* Rauchtest: Geschäftsobjekte aus den Quelltabellen übernehmen. Beim Laden
   einer Quelltabellen-Datei und über „Datei & Export → Geschäftsobjekte
   übernehmen" werden fehlende Objekte angelegt und vorhandene ergänzt, samt
   Herkunft (Table_Sources, Relation_Sources, attribut_sources). Dazu Domain
   als Liste in Modell, Oberfläche und Pflege. */
const {bootApp, makeT} = require('./start');

(async ()=>{
const {S, api, document, dispatch} = await bootApp();
const {t, finish} = makeT();

const $ = id => document.getElementById(id);
const klick = el => dispatch(typeof el === 'string' ? $(el) : el, 'click', {});
const warte = async ()=>{ for(let k = 0; k < 60; k++) await Promise.resolve(); };
const akt = a => [...$('menu').querySelectorAll('button')].find(b => b.dataset.act === a);
const block = name => { const y = S.yamlText, i = y.indexOf('\n  ' + name + ':\n'); const j = y.slice(i + 1).search(/\n  \S/);
  return j < 0 ? y.slice(i) : y.slice(i, i + 1 + j); };
const fuettern = async (id, name, text)=>{
  const feld = $(id);
  feld.files = [{name, text: ()=> Promise.resolve(text)}];
  dispatch(feld, 'change', {});
  await warte();
};

const GO = [
  'BusinessObjects:',
  '  # Stammdaten',
  '  Kunde:',
  '    Domain: Willibald   # Hauptdomäne',
  '    desc: Eine Person.',
  '    schema.org: https://schema.org/Person',
  '    business_keys:',
  '    - KundeID',
  '    attributes:',
  '    - name: KundeID',
  '      type: char(13)',
  '  Produkt:',
  '    Domain: Willibald',
  '    schema.org:',
  ''
].join('\n');

const TAB = [
  'SourceTables:',
  '  Webshop:',
  '    Auftrag:',
  '      business_object: Auftrag',
  '      Domain: Vertrieb',
  '      desc: Ein Auftrag im Shop.',
  '      schema.org: https://schema.org/Order',
  '      business_keys:',
  '      - AuftragNr',
  '      attributes:',
  '      - name: AuftragNr',
  '        type: int',
  '        primary_key: true',
  '      - name: KundeID',
  '        foreign_key: true',
  '        references: Webshop.Kunde.KundeID',
  '      - name: LagerID',
  '        foreign_key: true',
  '        references: Webshop.Lager.LagerID',
  '      relationships:',
  '      - to: Webshop.Kunde',
  '        name: gehört zu',
  '        cardinality:',
  '          from: zero_or_many',
  '          to: exactly_one',
  '      - to: Webshop.Lager',
  '    Kunde:',
  '      business_object: Kunde',
  '      Domain: CRM',
  '      desc: Kundenstamm im Shop.',
  '      schema.org: https://example.org/anders',
  '      attributes:',
  '      - name: KundeNr',
  '    Lager:',
  '      Domain: Logistik',
  '  Roadshow:',
  '    Auftrag_RS:',
  '      business_object: Auftrag',
  '      Domain: Vertrieb',
  '      schema.org: https://example.org/rs',
  '      attributes:',
  '      - name: Extra',
  '      relationships:',
  '      - to: Webshop.Kunde',
  '        name: gehört zu',
  ''
].join('\n');

await api.loadYaml(GO, 'klein.yaml');
api.setMode('komplett');
klick('optQuellen');
S.zusatzAn = {objekt:['schema.org'], attribut:[]};   // Einstellung „Zusatzattribute …": schema.org eingeschaltet

console.log('== Menü ==');
{
  const b = akt('uebernehmen');
  t('„Geschäftsobjekte übernehmen" im Menü', !!b && /Geschäftsobjekte übernehmen/.test(b.textContent));
  t('nur bei eingeschalteten Quelltabellen', b.classList.contains('nur-quellen'));
}

console.log('== Laden legt an und ergänzt ==');
const vorherGO = S.yamlText;
await fuettern('quellInput', 'tabellen.yaml', TAB);
{
  t('die Rückmeldung zählt', /Übernahme: 1 angelegt, 1 ergänzt, 0 übersprungen, 1 Beziehung\(en\) ohne Geschäftsobjekt am Ziel/.test($('toast').textContent),
    $('toast').textContent);
  const A = S.model.objects.Auftrag;
  t('Auftrag ist angelegt', !!A);
  t('mit der Domäne der Tabelle', A.domains.join(',') === 'Vertrieb');
  t('Beschreibung samt Herkunftsmarke', A.desc === 'Ein Auftrag im Shop.\n--->aus Webshop.Auftrag kopiert', JSON.stringify(A.desc));
  t('Business Keys übernommen', A.keys.join(',') === 'AuftragNr');
  t('alle Attribute der ersten Tabelle, jedes mit attribut_sources',
    A.attrs.map(a => a.name + '=' + a.quelle).join(',') === 'AuftragNr=Webshop.Auftrag.AuftragNr,KundeID=Webshop.Auftrag.KundeID,LagerID=Webshop.Auftrag.LagerID',
    A.attrs.map(a => a.name + '=' + a.quelle).join(','));
  t('nicht die der zweiten Tabelle', !A.attrs.some(a => a.name === 'Extra'));
  t('references auf das Geschäftsobjekt umgesetzt', A.attrs.find(a => a.name === 'KundeID').ref === 'Kunde.KundeID');
  const lager = A.attrs.find(a => a.name === 'LagerID');
  t('ohne Zuordnung entfällt nur das Verweisziel', !lager.ref && lager.fk);
  t('PK und Typ bleiben', A.attrs[0].pk && A.attrs[0].type === 'int');
  t('die Beziehung zeigt aufs Geschäftsobjekt, Name und Kardinalität bleiben',
    A.rels.length === 1 && A.rels[0].to === 'Kunde' && A.rels[0].name === 'gehört zu'
    && A.rels[0].from === 'zero_or_many' && A.rels[0].toCard === 'exactly_one', JSON.stringify(A.rels));
  t('die gleiche Beziehung der zweiten Tabelle kommt nicht doppelt, nur ihre Herkunft',
    A.rels[0].quellen.join(',') === 'Webshop.Auftrag→Webshop.Kunde,Roadshow.Auftrag_RS→Webshop.Kunde', A.rels[0].quellen.join(','));
  t('Table_Sources nennt beide Tabellen', A.tabQuellen.join(',') === 'Webshop.Auftrag,Roadshow.Auftrag_RS');
  t('eingeschaltetes Zusatzfeld übernommen, die erste Tabelle zählt', A.extra['schema.org'] === 'https://schema.org/Order', A.extra['schema.org']);

  const K = S.model.objects.Kunde;
  t('Kunde: die Domäne ist in der Liste ergänzt', K.domains.join(',') === 'Willibald,CRM', K.domains.join(','));
  t('Kunde: die Beschreibung ist unten angehängt',
    K.desc === 'Eine Person.\n\nKundenstamm im Shop.\n--->aus Webshop.Kunde kopiert', JSON.stringify(K.desc));
  t('Kunde: vorhandene Attribute bleiben, ohne attribut_sources',
    K.attrs.map(a => a.name).join(',') === 'KundeID' && !K.attrs[0].quelle);
  t('Kunde: ein vorhandener Zusatzwert bleibt', K.extra['schema.org'] === 'https://schema.org/Person');
  t('Kunde: Table_Sources', K.tabQuellen.join(',') === 'Webshop.Kunde');

  const kb = block('Kunde');
  t('der Kommentar vor dem Objekt bleibt', /# Stammdaten/.test(S.yamlText));
  t('der Kommentar an der Domain wandert mit', /Domain: +# Hauptdomäne\n    - Willibald\n    - CRM/.test(kb), kb);
  t('Produkt bleibt Zeichen für Zeichen', S.yamlText.includes('\n  Produkt:\n    Domain: Willibald\n    schema.org:\n')
    && !/Table_Sources/.test(block('Produkt')), JSON.stringify(block('Produkt')));
  t('keine Prüfmeldung „Geschäftsobjekt unbekannt"', !S.quellModell.messages.some(m => /unbekannt/.test(m.title)));
  t('keine Fehler im Geschäftsobjekt-Modell', !S.model.messages.some(m => m.level === 'err'),
    S.model.messages.filter(m => m.level === 'err').map(m => m.title).join(' | '));
}

console.log('== Wiederholen ändert nichts ==');
{
  const vorher = S.yamlText;
  klick(akt('uebernehmen'));
  t('Rückmeldung: alles übersprungen', /Übernahme: 0 angelegt, 0 ergänzt, 3 übersprungen/.test($('toast').textContent), $('toast').textContent);
  t('der Modelltext ist unverändert', S.yamlText === vorher);
  api.undo();
  t('kein eigener Verlaufsschritt: Strg+Z nimmt das Laden zurück', S.yamlText === vorherGO && !S.model.objects.Auftrag);
  t('auch die Tabellen sind wieder die vorigen', !Object.keys(S.quellModell.objects).includes('Webshop.Auftrag'));
  api.redo();
  t('Strg+Y bringt beides wieder', !!S.model.objects.Auftrag && !!S.quellModell.objects['Webshop.Auftrag']);
}

console.log('== Menü übernimmt eine neue Tabelle ==');
{
  S.zusatzAn = {objekt:[], attribut:[]};          // schema.org ausgeschaltet
  // Eine Tabelle kommt dazu, ohne dass eine Datei geladen wird (wie nach dem Bearbeiten)
  S.quellText = TAB.replace('  Roadshow:\n', '    Artikel:\n      business_object: Produkt\n      Domain: Willibald\n      schema.org: https://schema.org/Product\n      desc: Artikelstamm.\n  Roadshow:\n');
  S.quellModell = api.buildModel(S.quellText, 'quelle');
  const vorher = S.yamlText;
  klick(akt('uebernehmen'));
  const P = S.model.objects.Produkt;
  t('Produkt ergänzt', P.tabQuellen.join(',') === 'Webshop.Artikel' && /--->aus Webshop.Artikel kopiert$/.test(P.desc), JSON.stringify(P));
  t('die Domäne ist schon da, nichts doppelt', P.domains.join(',') === 'Willibald');
  t('ausgeschaltetes Zusatzfeld wird nicht übernommen', !P.extra['schema.org'], P.extra['schema.org']);
  t('Produkt hatte keine Attribute und keine bekommen (Tabelle hat keine)', !P.attrs.length);
  t('die übrigen Tabellen übersprungen', /0 angelegt, 1 ergänzt, 3 übersprungen/.test($('toast').textContent), $('toast').textContent);
  api.undo();
  t('Strg+Z nimmt die Übernahme in einem Schritt zurück', S.yamlText === vorher, S.yamlText.slice(-120));
  api.redo();
}

console.log('== Pflege erhält die Herkunft ==');
{
  S.pflegeAn = true;
  api.setSelection(['o:Auftrag']);
  klick(document.getElementById('detailBody').querySelector('[data-edit]'));
  t('das Formular ist offen', !!$('pfName'));
  t('Domain steht kommagetrennt', $('pfDomain').value === 'Vertrieb');
  document.querySelector('.pfa-name[data-i="0"]').value = 'AuftragNummer';
  document.querySelector('.pfb-name[data-i="0"]').value = 'gehört zum';
  klick('pfSave');
  const A = S.model.objects.Auftrag;
  t('umbenanntes Attribut behält attribut_sources', A.attrs[0].name === 'AuftragNummer' && A.attrs[0].quelle === 'Webshop.Auftrag.AuftragNr');
  t('unveränderte Attribute ebenso', A.attrs[1].quelle === 'Webshop.Auftrag.KundeID');
  t('umbenannte Beziehung behält Relation_Sources', A.rels[0].name === 'gehört zum' && A.rels[0].quellen.length === 2);
  t('Table_Sources bleibt', A.tabQuellen.length === 2);
  api.undo();
}

console.log('== Domain als Liste in der Oberfläche ==');
{
  api.setMode('komplett');
  const gruppen = [...$('objectList').querySelectorAll('.gname')].map(g => g.textContent);
  t('Kunde steht in beiden Domänengruppen', ['WILLIBALD','CRM'].every(g => gruppen.includes(g))
    && $('objectList').querySelectorAll('.ochk[data-id="o:Kunde"]').length === 2, gruppen.join(','));
  S.content[1] = {domain:true}; api.applyContent();
  t('die Unterzeile nennt beide', S.graph.byId.get('o:Kunde').sub === 'Willibald, CRM', S.graph.byId.get('o:Kunde').sub);
  klick('optDomaene');
  const d = S.graph.nodes.filter(n => n.eltern === 'o:Kunde' && n.kind === 'domain');
  t('ein Domänen-Kasten je Domäne, der erste mit der alten Kennung',
    d.map(n => n.id).join(',') === 'd:Kunde,d:Kunde|CRM', d.map(n => n.id).join(','));
  klick('optDomaene');
  S.filter = 'crm'; api.draw();
  t('die Suche trifft auch die zweite Domäne', $('searchHits').textContent.startsWith('1/'), $('searchHits').textContent);
  S.filter = ''; api.draw();
  api.setSelection(['o:Kunde']);
  t('die Details nennen beide', /<dt>Domain<\/dt><dd>Willibald, CRM<\/dd>/.test($('detailBody').innerHTML));
  t('die Details zeigen Table_Sources', /TABLE_SOURCES/.test($('detailBody').innerHTML) && /Webshop\.Kunde/.test($('detailBody').innerHTML));

  S.pflegeAn = true;                              // Strg+Z oben hat den direkt gesetzten Schalter mit zurückgenommen
  api.setSelection(['o:Produkt']);
  klick($('detailBody').querySelector('[data-edit]'));
  $('pfDomain').value = 'Willibald, Lager';
  klick('pfSave');
  t('zwei Domänen werden als Liste geschrieben', /\n  Produkt:\n    Domain:\n    - Willibald\n    - Lager\n/.test(S.yamlText), block('Produkt'));
  t('und gelesen', S.model.objects.Produkt.domains.join(',') === 'Willibald,Lager');
  api.undo();
  t('eine Domäne bleibt ein Einzelwert', /\n  Produkt:\n    Domain: Willibald\n/.test(S.yamlText));
  S.pflegeAn = false;
}

finish();
})().catch(e=>{ console.error(e); process.exit(1); });
