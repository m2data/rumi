/* Rauchtest: Geschäftsobjekte aus den Quelltabellen übernehmen. Beim Laden
   einer Quelltabellen-Datei und über „Datei & Export → Geschäftsobjekte
   übernehmen" werden fehlende Objekte angelegt und vorhandene ergänzt, samt
   Herkunft (Table_Sources, Relation_Sources, attribut_sources). Business Keys
   kommen aus den Primärschlüsseln der Tabellen; ein Beziehungsziel ohne
   Geschäftsobjekt bekommt eins. Dazu Domain als Liste in Modell, Oberfläche
   und Pflege. */
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
const quellen = q => (q || []).join(',');

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
  '        primary_key: true',
  '      - name: Name',
  '    Lager:',
  '      Domain: Logistik',
  '      desc: Ein Lager.',
  '      attributes:',
  '      - name: LagerID',
  '        primary_key: true',
  '      relationships:',
  '      - to: Webshop.Regal',
  '    Regal:',
  '      attributes:',
  '      - name: RegalID',
  '        primary_key: true',
  '    Produkt:',
  '      Domain: Willibald',
  '      attributes:',
  '      - name: ProduktID',
  '        primary_key: true',
  '  Roadshow:',
  '    Auftrag_RS:',
  '      business_object: Auftrag',
  '      Domain: Vertrieb',
  '      desc: Ein Auftrag im Shop.',
  '      schema.org: https://example.org/rs',
  '      attributes:',
  '      - name: AuftragNr',
  '        primary_key: true',
  '      - name: Extra',
  '      relationships:',
  '      - to: Webshop.Kunde',
  '        name: gehört zu',
  '      - to: Webshop.Produkt',
  '        name: enthält',
  '    Kunde_RS:',
  '      business_object: Kunde',
  '      desc: Eine Person.',
  '      attributes:',
  '      - name: KundeID',
  '        primary_key: true',
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
const vorherGO = S.yamlText, vorherTab = S.quellText;
await fuettern('quellInput', 'tabellen.yaml', TAB);
{
  t('die Rückmeldung zählt und nennt die Ziel-Objekte',
    /Übernahme: 3 angelegt, 2 ergänzt, 0 übersprungen, 2 aus Beziehungsziel angelegt: Lager, Regal/.test($('toast').textContent),
    $('toast').textContent);
  const A = S.model.objects.Auftrag;
  t('Auftrag ist angelegt', !!A);
  t('mit der Domäne der Tabelle', A.domains.join(',') === 'Vertrieb');
  t('Beschreibung samt Herkunftsmarke, die gleiche der zweiten Tabelle nicht doppelt',
    A.desc === 'Ein Auftrag im Shop.\n--->aus Webshop.Auftrag kopiert', JSON.stringify(A.desc));
  t('Business Key aus dem Primärschlüssel', A.keys.join(',') === 'AuftragNr', A.keys.join(','));
  t('alle Attribute der ersten Tabelle, jedes mit attribut_sources',
    A.attrs.map(a => a.name).join(',') === 'AuftragNr,KundeID,LagerID'
    && quellen(A.attrs[1].quellen) === 'Webshop.Auftrag.KundeID', A.attrs.map(a => a.name + '=' + quellen(a.quellen)).join(' '));
  t('der gleiche PK der zweiten Tabelle ergänzt nur die Quelle',
    quellen(A.attrs[0].quellen) === 'Webshop.Auftrag.AuftragNr,Roadshow.Auftrag_RS.AuftragNr', quellen(A.attrs[0].quellen));
  t('andere Attribute der zweiten Tabelle nicht', !A.attrs.some(a => a.name === 'Extra'));
  t('references auf das Geschäftsobjekt umgesetzt', A.attrs[1].ref === 'Kunde.KundeID');
  t('auch auf ein aus dem Ziel angelegtes', A.attrs[2].ref === 'Lager.LagerID', A.attrs[2].ref);
  t('PK und Typ bleiben', A.attrs[0].pk && A.attrs[0].type === 'int');
  const kunde = A.rels.find(r => r.to === 'Kunde');
  t('die Beziehung zeigt aufs Geschäftsobjekt, Name und Kardinalität bleiben',
    kunde && kunde.name === 'gehört zu' && kunde.from === 'zero_or_many' && kunde.toCard === 'exactly_one', JSON.stringify(A.rels));
  t('die gleiche Beziehung der zweiten Tabelle kommt nicht doppelt, nur ihre Herkunft',
    quellen(kunde.quellen) === 'Webshop.Auftrag→Webshop.Kunde,Roadshow.Auftrag_RS→Webshop.Kunde', quellen(kunde.quellen));
  t('die Beziehung zum Ziel ohne Zuordnung wird übernommen',
    A.rels.some(r => r.to === 'Lager' && quellen(r.quellen) === 'Webshop.Auftrag→Webshop.Lager'));
  t('Table_Sources nennt beide Tabellen', A.tabQuellen.join(',') === 'Webshop.Auftrag,Roadshow.Auftrag_RS');
  t('eingeschaltetes Zusatzfeld übernommen, die erste Tabelle zählt', A.extra['schema.org'] === 'https://schema.org/Order', A.extra['schema.org']);

  const K = S.model.objects.Kunde;
  t('Kunde: die Domäne ist in der Liste ergänzt', K.domains.join(',') === 'Willibald,CRM', K.domains.join(','));
  t('Kunde: eine andere Beschreibung wird unten angehängt, eine gleiche nicht',
    K.desc === 'Eine Person.\n\nKundenstamm im Shop.\n--->aus Webshop.Kunde kopiert', JSON.stringify(K.desc));
  t('Kunde: neuer PK wird Business Key', K.keys.join(',') === 'KundeID,KundeNr', K.keys.join(','));
  t('Kunde: sein Attribut kommt dazu, mit Quelle, die übrigen nicht',
    K.attrs.map(a => a.name).join(',') === 'KundeID,KundeNr' && quellen(K.attrs[1].quellen) === 'Webshop.Kunde.KundeNr',
    K.attrs.map(a => a.name + '=' + quellen(a.quellen)).join(' '));
  t('Kunde: PK schon Business Key → nur die Quelle am Attribut', quellen(K.attrs[0].quellen) === 'Roadshow.Kunde_RS.KundeID'
    && K.keys.filter(k => k === 'KundeID').length === 1, quellen(K.attrs[0].quellen));
  t('Kunde: ein vorhandener Zusatzwert bleibt', K.extra['schema.org'] === 'https://schema.org/Person');
  t('Kunde: Table_Sources', K.tabQuellen.join(',') === 'Webshop.Kunde,Roadshow.Kunde_RS');

  const L = S.model.objects.Lager, R = S.model.objects.Regal, P = S.model.objects.Produkt;
  t('Lager aus dem Beziehungsziel angelegt, voll übernommen',
    L && L.domains.join(',') === 'Logistik' && L.desc === 'Ein Lager.\n--->aus Webshop.Lager kopiert'
    && L.keys.join(',') === 'LagerID' && L.tabQuellen.join(',') === 'Webshop.Lager', JSON.stringify(L));
  t('die Kette weiter: Regal ebenso', R && R.keys.join(',') === 'RegalID' && L.rels.some(r => r.to === 'Regal'));
  t('ein Ziel, das es als Geschäftsobjekt schon gibt, wird ergänzt',
    P.tabQuellen.join(',') === 'Webshop.Produkt' && P.keys.join(',') === 'ProduktID', JSON.stringify(P));

  const neu = S.quellText.split('\n'), alt = TAB.split('\n');
  t('in der Tabellen-YAML sind nur die Zuordnungen dazugekommen',
    neu.filter(l => !alt.includes(l)).join('|') === '      business_object: Lager|      business_object: Regal|      business_object: Produkt'
    && alt.every(l => neu.includes(l)), neu.filter(l => !alt.includes(l)).join('|'));
  t('die Tabellen sind zugeordnet', S.quellModell.objects['Webshop.Lager'].bo === 'Lager');

  const msg = $('msgList').innerHTML;
  t('die Prüfung meldet die aus Zielen angelegten', /Lager: aus Beziehungsziel angelegt|aus Beziehungsziel angelegt/.test(msg)
    && $('msgList').querySelector('[data-msgobj="Lager"]') && $('msgList').querySelector('[data-msgobj="Regal"]'), msg.slice(0, 300));
  klick($('msgList').querySelector('.mgh') || $('msgList').querySelector('[data-msgobj="Lager"]'));
  klick($('msgList').querySelector('[data-msgobj="Lager"]'));
  t('ein Klick springt zum Objekt', S.selected === 'o:Lager', S.selected);
  t('Produkt (gab es schon) wird dort nicht gemeldet', S.uebernahmeMeldungen.map(m => m.obj).join(',') === 'Lager,Regal'
    && !/Produkt: aus Beziehungsziel/.test(msg), S.uebernahmeMeldungen.map(m => m.obj).join(','));

  const kb = block('Kunde');
  t('der Kommentar vor dem Objekt bleibt', /# Stammdaten/.test(S.yamlText));
  t('der Kommentar an der Domain wandert mit', /Domain: +# Hauptdomäne\n    - Willibald\n    - CRM/.test(kb), kb);
  t('keine Prüfmeldung „Geschäftsobjekt unbekannt"', !S.quellModell.messages.some(m => /unbekannt/.test(m.title)));
  t('keine Fehler im Geschäftsobjekt-Modell', !S.model.messages.some(m => m.level === 'err'),
    S.model.messages.filter(m => m.level === 'err').map(m => m.title).join(' | '));
}

console.log('== Wiederholen ändert nichts ==');
{
  const vorher = S.yamlText, vorherQ = S.quellText;
  klick(akt('uebernehmen'));
  t('Rückmeldung: alles übersprungen', /Übernahme: 0 angelegt, 0 ergänzt, 7 übersprungen$/.test($('toast').textContent), $('toast').textContent);
  t('beide Texte unverändert', S.yamlText === vorher && S.quellText === vorherQ);
  api.undo();
  t('kein eigener Verlaufsschritt: Strg+Z nimmt das Laden zurück', S.yamlText === vorherGO && !S.model.objects.Auftrag);
  t('auch die Tabellen sind wieder die vorigen', S.quellText === vorherTab);
  t('die Meldung verschwindet mit dem Objekt', !$('msgList').querySelector('[data-msgobj="Lager"]'));
  api.redo();
  t('Strg+Y bringt beides wieder', !!S.model.objects.Lager && S.quellModell.objects['Webshop.Lager'].bo === 'Lager');
}

console.log('== Menü übernimmt eine neue Tabelle ==');
{
  S.zusatzAn = {objekt:[], attribut:[]};          // schema.org ausgeschaltet
  // Eine Tabelle kommt dazu, ohne dass eine Datei geladen wird (wie nach dem Bearbeiten)
  S.quellText = S.quellText.replace('  Roadshow:\n', '    Artikel:\n      business_object: Produkt\n      Domain: Willibald\n      schema.org: https://schema.org/Product\n      desc: Artikelstamm.\n  Roadshow:\n');
  S.quellModell = api.buildModel(S.quellText, 'quelle');
  const vorher = S.yamlText;
  klick(akt('uebernehmen'));
  const P = S.model.objects.Produkt;
  t('Produkt ergänzt', P.tabQuellen.join(',') === 'Webshop.Produkt,Webshop.Artikel' && /--->aus Webshop.Artikel kopiert$/.test(P.desc), JSON.stringify(P));
  t('die Domäne ist schon da, nichts doppelt', P.domains.join(',') === 'Willibald');
  t('ausgeschaltetes Zusatzfeld wird nicht übernommen', !P.extra['schema.org'], P.extra['schema.org']);
  t('die übrigen Tabellen übersprungen', /0 angelegt, 1 ergänzt, 7 übersprungen/.test($('toast').textContent), $('toast').textContent);
  t('die Infos zum Beziehungsziel gelten bis zur nächsten Übernahme', !S.uebernahmeMeldungen.length);
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
  t('umbenanntes Attribut behält attribut_sources',
    A.attrs[0].name === 'AuftragNummer' && quellen(A.attrs[0].quellen) === 'Webshop.Auftrag.AuftragNr,Roadshow.Auftrag_RS.AuftragNr');
  t('unveränderte Attribute ebenso', quellen(A.attrs[1].quellen) === 'Webshop.Auftrag.KundeID');
  t('umbenannte Beziehung behält Relation_Sources', A.rels[0].name === 'gehört zum' && A.rels[0].quellen.length === 2);
  t('Table_Sources bleibt', A.tabQuellen.length === 2);
  api.undo();
}

console.log('== Quelltabellen ohne Business Keys ==');
{
  api.loadQuellen('SourceTables:\n  CRM:\n    Person:\n      business_object: Kunde\n      business_keys:\n      - KundeID\n      desc: Eine Person.\n', 'alt.yaml');
  t('ein altes business_keys wird nicht gelesen', S.quellModell.objects['CRM.Person'].keys.length === 0
    && !S.quellModell.messages.some(m => m.group === 'kein Business Key'));
  api.setMode('quellen');
  klick('optQuellPflege');
  api.selectDiagram('Quellsysteme');
  api.setSelection(['o:CRM.Person']);
  klick($('detailBody').querySelector('[data-edit]'));
  t('das Formular der Tabelle hat kein Feld „Business Keys"', !!$('pfName') && !$('pfKeys'));
  $('pfDesc').value = 'Ein Mensch.';
  klick('pfSave');
  t('beim Speichern bleibt das alte Feld im Text stehen', /business_keys:\n      - KundeID\n/.test(S.quellText) && /desc: Ein Mensch\./.test(S.quellText), S.quellText);
  api.undo(); api.undo();
  api.setMode('komplett');
}

console.log('== Führende Domäne: die Übernahme hält die Anzeige ==');
{
  const K = S.model.objects.Kunde;
  t('aus einer Domäne wurde eine Liste, die bisherige ist führend', K.domains.join(',') === 'Willibald,CRM' && K.leading === 'Willibald',
    K.leading);
  t('geschrieben als leading_domain', /\n    leading_domain: Willibald\n/.test(block('Kunde')), block('Kunde'));
  t('ein neues Objekt mit einer Domäne bekommt kein Feld', !/leading_domain/.test(block('Auftrag')) && !/leading_domain/.test(block('Lager')));
  t('und seine Domäne steht als Einzelwert', /\n  Auftrag:\n    Domain: Vertrieb\n/.test(S.yamlText), block('Auftrag'));
}

console.log('== Führende Domäne in der Oberfläche ==');
{
  api.setMode('komplett');
  // Die Gruppen, in denen ein Objekt steht — aus dem Listenmarkup, Gruppe für Gruppe
  const gruppenVon = id => $('objectList').innerHTML.split('<li class="grouphead').slice(1)
    .filter(g => g.includes('data-id="' + id + '"')).map(g => (g.match(/class="gname"[^>]*>([^<]*)</) || [])[1]);
  t('Kunde steht nur in der Gruppe seiner führenden Domäne', gruppenVon('o:Kunde').join(',') === 'WILLIBALD', gruppenVon('o:Kunde').join(','));
  S.content[1] = {domain:true}; api.applyContent();
  t('die Unterzeile nennt nur die führende', S.graph.byId.get('o:Kunde').sub === 'Willibald', S.graph.byId.get('o:Kunde').sub);
  klick('optDomaene');
  t('ein Domänen-Kasten, mit der alten Kennung',
    S.graph.nodes.filter(n => n.eltern === 'o:Kunde' && n.kind === 'domain').map(n => n.id + '=' + n.name).join(',') === 'd:Kunde=Willibald');
  klick('optDomaene');
  S.filter = 'crm'; api.draw();
  t('die Suche trifft weiter alle Domänen', $('searchHits').textContent.startsWith('1/'), $('searchHits').textContent);
  S.filter = ''; api.draw();
  S.pflegeAn = true;                              // Strg+Z oben hat den direkt gesetzten Schalter mit zurückgenommen
  api.setSelection(['o:Kunde']);
  t('die Details nennen alle, die führende markiert',
    $('detailBody').innerHTML.includes('<dt>Domain</dt><dd>Willibald (führend), CRM</dd>'), $('detailBody').innerHTML.slice(0, 600));
  t('die Details zeigen Table_Sources', /TABLE_SOURCES/.test($('detailBody').innerHTML) && /Webshop\.Kunde/.test($('detailBody').innerHTML));

  klick($('detailBody').querySelector('[data-edit]'));
  t('das Formular hat eine Auswahl „Führende Domäne"', !!$('pfLeading') && $('pfLeading').value === 'Willibald'
    && [...$('pfLeading').querySelectorAll('option')].map(o => o.getAttribute('value')).join(',') === ',Willibald,CRM');
  const vorher = S.yamlText;
  $('pfLeading').value = 'CRM';
  klick('pfSave');
  const a = vorher.split('\n'), b = S.yamlText.split('\n');
  t('nur die Zeile leading_domain ändert sich', b.length === a.length && b.filter(l => !a.includes(l)).join('|') === '    leading_domain: CRM',
    b.filter(l => !a.includes(l)).join('|'));
  t('Unterzeile und Gruppe folgen', S.graph.byId.get('o:Kunde').sub === 'CRM' && gruppenVon('o:Kunde').join(',') === 'CRM');
  api.setSelection(['o:Kunde']);
  klick($('detailBody').querySelector('[data-edit]'));
  $('pfLeading').value = '';
  klick('pfSave');
  t('ohne führende: das Feld entfällt', !/leading_domain/.test(block('Kunde')));
  t('ohne führende: keine Unterzeile, Gruppe „Ohne Domain"', !S.graph.byId.get('o:Kunde').sub && gruppenVon('o:Kunde').join(',') === 'OHNE DOMAIN');
  t('und die Prüfung erklärt es', S.model.messages.some(m => m.title === 'Kunde: mehrere Domänen, keine führende'));
  api.undo(); api.undo();
  t('Strg+Z bringt die führende zurück', S.model.objects.Kunde.leading === 'Willibald');

  S.pflegeAn = true;                              // auch hier: Strg+Z nahm den direkt gesetzten Schalter mit
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

console.log('== Folgeläufe ergänzen die Domänenliste am Geschäftsobjekt ==');
{
  S.pflegeAn = true;
  api.setMode('komplett');
  api.setSelection(['o:Kunde']);
  klick($('detailBody').querySelector('[data-edit]'));
  $('pfLeading').value = 'CRM';
  klick('pfSave');
  const vorherQ = S.quellText;
  // Zwei neue Tabellen: eine auf Kunde, eine auf Produkt
  S.quellText = 'SourceTables:\n  Webshop:\n    Kunde_Log:\n      business_object: Kunde\n      Domain: Logistik\n'
    + '    Artikel_Lager:\n      business_object: Produkt\n      Domain: Lager\n';
  S.quellModell = api.buildModel(S.quellText, 'quelle');
  klick(akt('uebernehmen'));
  const K = S.model.objects.Kunde, P = S.model.objects.Produkt;
  t('die Domäne wird angehängt, die bisherigen bleiben in ihrer Reihenfolge', K.domains.join(',') === 'Willibald,CRM,Logistik', K.domains.join(','));
  t('eine gesetzte führende Domäne bleibt', K.leading === 'CRM' && /\n    leading_domain: CRM\n/.test(block('Kunde')), block('Kunde'));
  t('im Folgelauf entsteht die Liste, die bisherige führt', P.domains.join(',') === 'Willibald,Lager' && P.leading === 'Willibald',
    P.domains.join(',') + ' / ' + P.leading);
  api.undo(); api.undo();
  t('Strg+Z nimmt Übernahme und Formular zurück', S.model.objects.Kunde.leading === 'Willibald'
    && S.model.objects.Kunde.domains.join(',') === 'Willibald,CRM', S.model.objects.Kunde.leading);
  S.quellText = vorherQ; S.quellModell = api.buildModel(S.quellText, 'quelle');
}

console.log('== Formular der Quelltabelle: genau eine Domäne ==');
{
  api.loadQuellen(TAB, 'tabellen.yaml');          // eigener Ausgangsstand für diesen Abschnitt
  api.setMode('quellen');
  S.quellPflegeAn = true;
  api.selectDiagram('Quellsysteme');
  api.setSelection(['o:Webshop.Lager']);
  klick($('detailBody').querySelector('[data-edit]'));
  t('Feld Domain ja, Auswahl „Führende Domäne" nein', !!$('pfDomain') && $('pfDomain').value === 'Logistik' && !$('pfLeading'));
  const vorher = S.quellText;
  $('pfDomain').value = 'Logistik, Lager';
  klick('pfSave');
  t('zwei Domänen werden abgelehnt', S.quellText === vorher && /genau eine Domäne/.test($('toast').textContent), $('toast').textContent);
  $('pfDomain').value = 'Lagerhaus';
  klick('pfSave');
  const a = vorher.split('\n'), b = S.quellText.split('\n');
  t('eine Domäne wird als Einzelwert geschrieben, nur diese Zeile',
    b.length === a.length && b.filter(l => !a.includes(l)).join('|') === '      Domain: Lagerhaus', b.filter(l => !a.includes(l)).join('|'));
  api.undo();
  api.setMode('komplett');
}

finish();
})().catch(e=>{ console.error(e); process.exit(1); });
