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
// Laden fragt nach verwaisten Geschäftsobjekten; bis zum eigenen Abschnitt bleibt alles stehen
global.confirm = ()=> false;

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
  '    sources:',
  '    - Altsystem',
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
  '        alternate_key: true',
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
  '        type: int',
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
    /Übernahme: 2 angelegt, 2 aktualisiert, 0 unverändert, 1 aus Beziehungsziel angelegt: Lager, 1 Beziehung\(en\) ohne Ziel$/.test($('toast').textContent),
    $('toast').textContent);
  const A = S.model.objects.Auftrag;
  t('Auftrag ist angelegt', !!A);
  t('mit der Domäne der Tabelle', A.domains.join(',') === 'Vertrieb');
  t('Beschreibung samt Herkunftsmarke, die gleiche der zweiten Tabelle nicht doppelt',
    A.desc === 'Ein Auftrag im Shop.\n--->aus Webshop.Auftrag kopiert', JSON.stringify(A.desc));
  t('Business Key aus dem Primärschlüssel', A.keys.join(',') === 'AuftragNr', A.keys.join(','));
  t('alle Attribute beider Tabellen, jedes mit attribut_sources',
    A.attrs.map(a => a.name).join(',') === 'AuftragNr,KundeID,LagerID,Extra'
    && quellen(A.attrs[1].quellen) === 'Webshop.Auftrag.KundeID', A.attrs.map(a => a.name + '=' + quellen(a.quellen)).join(' '));
  t('der gleiche PK der zweiten Tabelle ergänzt nur die Quelle',
    quellen(A.attrs[0].quellen) === 'Webshop.Auftrag.AuftragNr,Roadshow.Auftrag_RS.AuftragNr', quellen(A.attrs[0].quellen));
  t('ein anderes Attribut der zweiten Tabelle kommt als eigenes dazu',
    quellen((A.attrs.find(a => a.name === 'Extra') || {}).quellen) === 'Roadshow.Auftrag_RS.Extra');
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
  t('die Quellen nennen beide Quellsysteme', A.sources.join(',') === 'Webshop,Roadshow', A.sources.join(','));
  t('… und stehen in der YAML', /\n    (sources|source_systems):\n    - Webshop\n    - Roadshow\n/.test(block('Auftrag')), block('Auftrag'));
  t('eingeschaltetes Zusatzfeld übernommen, beide Tabellen als Liste',
    JSON.stringify(A.extra['schema.org']) === '["https://schema.org/Order","https://example.org/rs"]', JSON.stringify(A.extra['schema.org']));
  t('… als Blockliste in der YAML', /\n    schema\.org:\n    - https:\/\/schema\.org\/Order\n    - https:\/\/example\.org\/rs\n/.test(block('Auftrag')), block('Auftrag'));

  const K = S.model.objects.Kunde;
  t('Kunde: die Domäne ist in der Liste ergänzt', K.domains.join(',') === 'Willibald,CRM', K.domains.join(','));
  t('Kunde: eine andere Beschreibung wird unten angehängt, eine gleiche nicht',
    K.desc === 'Eine Person.\n\nKundenstamm im Shop.\n--->aus Webshop.Kunde kopiert', JSON.stringify(K.desc));
  t('Kunde: neuer PK wird Business Key', K.keys.join(',') === 'KundeID,KundeNr', K.keys.join(','));
  t('Kunde: auch in ein Objekt mit Attributen kommen alle dazu, mit Quelle',
    K.attrs.map(a => a.name).join(',') === 'KundeID,KundeNr,Name' && quellen(K.attrs[1].quellen) === 'Webshop.Kunde.KundeNr'
    && quellen(K.attrs[2].quellen) === 'Webshop.Kunde.Name', K.attrs.map(a => a.name + '=' + quellen(a.quellen)).join(' '));
  t('Kunde: ein AK der Tabelle wird AK am Attribut, aber kein Business Key',
    K.attrs[2].ak && !K.attrs[2].pk && !K.keys.includes('Name'), JSON.stringify(K.attrs[2]));
  t('Kunde: stimmen alle Quellen überein (hier die eine), gilt ihr Typ', K.attrs[0].type === 'int', K.attrs[0].type);
  t('Kunde: dann gibt es keine Meldung „abweichender Typ"',
    !$('msgList').innerHTML.includes('Kunde.KundeID: Quellen mit abweichendem Typ'), $('msgList').textContent.slice(0, 300));
  t('Kunde: PK schon Business Key → nur die Quelle am Attribut', quellen(K.attrs[0].quellen) === 'Roadshow.Kunde_RS.KundeID'
    && K.keys.filter(k => k === 'KundeID').length === 1, quellen(K.attrs[0].quellen));
  t('Kunde: an einen vorhandenen Zusatzwert wird angehängt, er wird zur Liste',
    JSON.stringify(K.extra['schema.org']) === '["https://schema.org/Person","https://example.org/anders"]', JSON.stringify(K.extra['schema.org']));
  t('Produkt: ohne Wert in der Tabelle bleibt das leere Feld', S.model.objects.Produkt.extra['schema.org'] === '',
    JSON.stringify(S.model.objects.Produkt.extra));
  t('Kunde: Table_Sources', K.tabQuellen.join(',') === 'Webshop.Kunde,Roadshow.Kunde_RS');

  const L = S.model.objects.Lager, R = S.model.objects.Regal, P = S.model.objects.Produkt;
  t('Lager aus dem Beziehungsziel angelegt, voll übernommen',
    L && L.domains.join(',') === 'Logistik' && L.desc === 'Ein Lager.\n--->aus Webshop.Lager kopiert'
    && L.keys.join(',') === 'LagerID' && L.tabQuellen.join(',') === 'Webshop.Lager', JSON.stringify(L));
  t('keine Kette: Regal nicht, seine Quelle Lager hat kein eigenes business_object',
    !R && !L.rels.some(r => r.to === 'Regal'), Object.keys(S.model.objects).join(','));
  t('ein Ziel, das es als Geschäftsobjekt schon gibt, wird ergänzt',
    P.tabQuellen.join(',') === 'Webshop.Produkt' && P.keys.join(',') === 'ProduktID', JSON.stringify(P));
  t('eine vorhandene Quelle bleibt vorn, das Quellsystem kommt dazu', P.sources.join(',') === 'Altsystem,Webshop', P.sources.join(','));
  t('Lager: Quellsystem auch beim aus dem Ziel angelegten', L.sources.join(',') === 'Webshop', L.sources.join(','));

  t('die Tabellen-YAML bleibt unverändert, die Zuordnung der Ziele wird jedes Mal abgeleitet',
    S.quellText === TAB && !S.quellModell.objects['Webshop.Lager'].bo, S.quellText);

  const msg = $('msgList').innerHTML;
  t('die Prüfung meldet die aus Zielen angelegten', /Lager: aus Beziehungsziel angelegt|aus Beziehungsziel angelegt/.test(msg)
    && $('msgList').querySelector('[data-msgobj="Lager"]'), msg.slice(0, 300));
  const ohneGo = msg.match(/Hinweis<\/strong><span class="mlink">[^<]*: Quelltabelle ohne Geschäftsobjekt/g) || [];
  t('Regal ohne Angabe ist ein Hinweis in der Prüfung, die zugeordneten nicht',
    ohneGo.length === 1 && ohneGo[0].endsWith('Webshop.Regal: Quelltabelle ohne Geschäftsobjekt'), ohneGo.join('|'));
  klick($('msgList').querySelector('.mgh') || $('msgList').querySelector('[data-msgobj="Lager"]'));
  klick($('msgList').querySelector('[data-msgobj="Lager"]'));
  t('ein Klick springt zum Objekt', S.selected === 'o:Lager', S.selected);
  t('Produkt (gab es schon) wird dort nicht gemeldet', S.uebernahmeMeldungen.map(m => m.obj).join(',') === 'Lager'
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
  t('Rückmeldung: nichts zu tun, alle unverändert', /Übernahme: 0 angelegt, 0 aktualisiert, 4 unverändert, 1 Beziehung\(en\) ohne Ziel$/.test($('toast').textContent), $('toast').textContent);
  t('beide Texte unverändert', S.yamlText === vorher && S.quellText === vorherQ);
  t('auch der zweite Lauf legt Regal nicht an', !S.model.objects.Regal);
  api.undo();
  t('kein eigener Verlaufsschritt: Strg+Z nimmt das Laden zurück', S.yamlText === vorherGO && !S.model.objects.Auftrag);
  t('auch die Tabellen sind wieder die vorigen', S.quellText === vorherTab);
  t('die Meldung verschwindet mit dem Objekt', !$('msgList').querySelector('[data-msgobj="Lager"]'));
  api.redo();
  t('Strg+Y bringt es wieder', !!S.model.objects.Lager && S.quellText === TAB);
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
  t('die übrigen Objekte unverändert', /0 angelegt, 1 aktualisiert, 3 unverändert/.test($('toast').textContent), $('toast').textContent);
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

// Die Beschreibung des gespeicherten Objekts wird zum Block „desc: |" (gewollt);
// der Zeilenvergleich gilt dem Rest
const ohneDesc = text => { const out = []; let col = -1;
  text.split('\n').forEach(l => { const c = l.match(/^ */)[0].length;
    if(col >= 0 && (l.trim() === '' || c > col)) return; col = -1;
    if(/^\s*desc:/.test(l)){ col = c; return; } out.push(l); });
  return out; };
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
  t('beim Speichern bleibt das alte Feld im Text stehen', /business_keys:\n      - KundeID\n/.test(S.quellText) && /desc: \|\n {8}Ein Mensch\.\n/.test(S.quellText), S.quellText);
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
  const a = ohneDesc(vorher), b = ohneDesc(S.quellText);
  t('eine Domäne wird als Einzelwert geschrieben, nur diese Zeile',
    b.length === a.length && b.filter(l => !a.includes(l)).join('|') === '      Domain: Lagerhaus', b.filter(l => !a.includes(l)).join('|'));
  api.undo();
  api.setMode('komplett');
}

console.log('== Aktualisieren aus den Quellen ==');
{
  const menue = ()=> dispatch(akt('uebernehmen'), 'click', {});
  const tabellen = (desc, typ, mitSpalte, bo)=> [
    'SourceTables:',
    '  Webshop:',
    '    Artikel:',
    '      business_object: ' + bo,
    ...(desc ? ['      desc: ' + desc] : []),
    '      attributes:',
    '      - name: ArtNr',
    '        type: ' + typ,
    '        primary_key: true',
    ...(mitSpalte ? ['      - name: Farbe'] : []),
    '      relationships:',
    '      - to: Webshop.Lager',
    '    Lager:',
    '      business_object: Lager',
    ''].join('\n');
  const setze = text=>{ S.quellText = text; S.quellModell = api.buildModel(text, 'quelle'); };
  await api.loadYaml('BusinessObjects:\n  Ware:\n    Domain: Handel\n    desc: Von Hand geschrieben.\n  Lager:\n    Domain: Handel\n', 'ware.yaml');
  api.setMode('komplett');
  if(!S.quellenAn) klick('optQuellen');

  setze(tabellen('Erster Text.', 'int', true, 'Ware'));
  menue();
  let W = S.model.objects.Ware;
  t('Ausgang: Beschreibung angehängt, Attribute mit Quellen',
    W.desc === 'Von Hand geschrieben.\n\nErster Text.\n--->aus Webshop.Artikel kopiert' && W.attrs.map(a => a.name).join(',') === 'ArtNr,Farbe',
    JSON.stringify(W.desc));

  setze(tabellen('Zweiter Text.', 'int', true, 'Ware'));
  menue();
  W = S.model.objects.Ware;
  t('geänderte Beschreibung ersetzt ihren Block, der Text von Hand bleibt',
    W.desc === 'Von Hand geschrieben.\n\nZweiter Text.\n--->aus Webshop.Artikel kopiert', JSON.stringify(W.desc));

  setze(tabellen('', 'bigint', true, 'Ware'));
  menue();
  W = S.model.objects.Ware;
  t('geleerte Beschreibung: ihr Block entfällt', W.desc === 'Von Hand geschrieben.', JSON.stringify(W.desc));
  t('geänderter Spaltentyp kommt ans Attribut (alle Quellen gleich)', W.attrs[0].type === 'bigint', W.attrs[0].type);

  setze(tabellen('', 'bigint', false, 'Ware'));
  menue();
  W = S.model.objects.Ware;
  t('eine weggefallene Spalte verschwindet aus attribut_sources, das Attribut bleibt',
    !!W.attrs.find(a => a.name === 'Farbe') && !W.attrs.find(a => a.name === 'Farbe').quellen.length);

  setze(tabellen('Dritter Text.', 'bigint', false, 'Lager'));
  menue();
  W = S.model.objects.Ware;
  const L = S.model.objects.Lager;
  t('Zuordnung gewechselt: beim alten Objekt ist alles von der Tabelle weg',
    !W.tabQuellen.length && W.attrs.every(a => !a.quellen.length) && W.rels.every(x => !x.quellen.length)
    && W.desc === 'Von Hand geschrieben.', JSON.stringify({t: W.tabQuellen, d: W.desc}));
  t('beim neuen Objekt eingetragen', L.tabQuellen.includes('Webshop.Artikel')
    && L.attrs.some(a => a.quellen.includes('Webshop.Artikel.ArtNr')) && /--->aus Webshop.Artikel kopiert/.test(L.desc));

  const vorher = S.yamlText;
  setze('SourceTables:\n  CRM:\n    Person:\n      business_object: Kunde2\n');
  menue();
  t('Schutzregel: Tabellen aus einer anderen Datei bleiben am Objekt',
    S.model.objects.Lager.tabQuellen.includes('Webshop.Artikel') && S.model.objects.Lager.attrs.some(a => a.quellen.length));
  t('und es kommt nur das Neue dazu', !!S.model.objects.Kunde2 && S.yamlText.startsWith(vorher.replace(/\n$/, '')), S.yamlText.slice(-200));
}

console.log('== Zusatzattribute werden angehängt, auch an Attributen ==');
{
  await api.loadYaml(['BusinessObjects:',
    '  Ware:',
    '    Domain: Handel',
    '    schema.org: https://schema.org/Product',
    '    attributes:',
    '    - name: ArtNr',
    '      schema.org: https://schema.org/sku',
    ''].join('\n'), 'ware.yaml');
  api.setMode('komplett');
  if(!S.quellenAn) klick('optQuellen');
  S.zusatzAn = {objekt:['schema.org'], attribut:['schema.org']};
  S.quellText = ['SourceTables:',
    '  Webshop:',
    '    Artikel:',
    '      business_object: Ware',
    '      schema.org: https://schema.org/Product',
    '      attributes:',
    '      - name: ArtNr',
    '        primary_key: true',
    '        schema.org: https://example.org/artnr',
    '  Lager:',
    '    Teil:',
    '      business_object: Ware',
    '      schema.org: https://example.org/teil',
    '      attributes:',
    '      - name: ArtNr',
    '        schema.org: https://example.org/artnr',
    '      - name: Farbe',
    '        schema.org: https://example.org/farbe',
    ''].join('\n');
  S.quellModell = api.buildModel(S.quellText, 'quelle');
  klick(akt('uebernehmen'));
  const W = S.model.objects.Ware, nr = W.attrs.find(a => a.name === 'ArtNr'), farbe = W.attrs.find(a => a.name === 'Farbe');
  t('am Objekt: neuer Wert angehängt, ein gleicher nicht doppelt',
    JSON.stringify(W.extra['schema.org']) === '["https://schema.org/Product","https://example.org/teil"]', JSON.stringify(W.extra));
  t('am vorhandenen Attribut ebenso', JSON.stringify(nr.extra['schema.org']) === '["https://schema.org/sku","https://example.org/artnr"]',
    JSON.stringify(nr.extra));
  t('… als Blockliste unter dem Attribut',
    /\n      schema\.org:\n      - https:\/\/schema\.org\/sku\n      - https:\/\/example\.org\/artnr\n/.test(S.yamlText), S.yamlText);
  t('ein neues Attribut bekommt den Einzelwert', farbe && farbe.extra['schema.org'] === 'https://example.org/farbe', JSON.stringify(farbe));
  const nachEins = S.yamlText;
  klick(akt('uebernehmen'));
  t('ein zweiter Lauf ändert nichts', S.yamlText === nachEins && /0 aktualisiert, 1 unverändert/.test($('toast').textContent), $('toast').textContent);

  S.pflegeAn = true;
  api.setSelection(['o:Ware']);
  t('die Details nennen die Liste', $('detailBody').innerHTML.includes('<dd>https://schema.org/Product, https://example.org/teil</dd>'),
    $('detailBody').innerHTML.slice(0, 800));
  klick($('detailBody').querySelector('[data-edit]'));
  const feldO = document.querySelector('.pfo-extra[data-i="0"]');
  const feldA = i => document.querySelectorAll('.pfa-extra[data-i="' + i + '"]')[0];
  const iFarbe = W.attrs.indexOf(farbe);
  t('im Formular ein Wert je Zeile', feldO.value === 'https://schema.org/Product\nhttps://example.org/teil'
    && feldA(0).value === 'https://schema.org/sku\nhttps://example.org/artnr', JSON.stringify([feldO.value, feldA(0).value]));
  feldO.value = 'https://schema.org/Product';
  feldA(iFarbe).value = 'https://example.org/farbe\nhttps://example.org/color';
  klick('pfSave');
  const W2 = S.model.objects.Ware;
  t('eine Zeile: wieder ein Einzelwert', W2.extra['schema.org'] === 'https://schema.org/Product'
    && /\n    schema\.org: https:\/\/schema\.org\/Product\n/.test(S.yamlText), S.yamlText);
  t('zwei Zeilen: eine Liste', JSON.stringify(W2.attrs[iFarbe].extra['schema.org']) === '["https://example.org/farbe","https://example.org/color"]',
    JSON.stringify(W2.attrs[iFarbe].extra));
  S.pflegeAn = false;
  S.zusatzAn = {objekt:[], attribut:[]};
}

console.log('== Willibald: zweimal laden ==');
{
  await api.loadYaml(require('fs').readFileSync(require('path').join(__dirname, '..', '..', 'models', 'willibald-attr.yaml'), 'utf8'), 'willibald-attr.yaml');
  if(!S.quellenAn) klick('optQuellen');
  const T = require('fs').readFileSync(require('path').join(__dirname, '..', '..', 'models', 'willibald-quelltabellen.yaml'), 'utf8');
  api.loadQuellen(T, 'w.yaml');
  t('erster Lauf aktualisiert die Objekte', /0 angelegt, 11 aktualisiert/.test($('toast').textContent), $('toast').textContent);
  const nachEins = S.yamlText;
  api.loadQuellen(T, 'w.yaml');
  t('zweiter Lauf: alles unverändert', S.yamlText === nachEins && /0 angelegt, 0 aktualisiert, 11 unverändert/.test($('toast').textContent),
    $('toast').textContent);
}

console.log('== Laden fragt nach verwaisten Geschäftsobjekten ==');
{
  /* Willibald ist voll geladen. Eine Datei nur mit dem Webshop lässt
     VereinsPartner (Roadshow) und href_termintreue (Referenzdaten) ohne
     Tabelle zurück; Bestellung und Position verlieren nur ihre Roadshow-Tabelle. */
  const T = require('fs').readFileSync(require('path').join(__dirname, '..', '..', 'models', 'willibald-quelltabellen.yaml'), 'utf8');
  const nurWebshop = T.replace(/\n {2}Roadshow:[\s\S]*$/, '\n');
  const fragen = [];
  global.confirm = text => { fragen.push(text); return global.__ja; };

  global.__ja = false;
  api.loadQuellen(nurWebshop, 'webshop.yaml');
  t('die Frage kommt einmal', fragen.length === 1, fragen.length + ' Fragen');
  t('sie nennt die Verwaisten', /VereinsPartner/.test(fragen[0] || '') && /href_termintreue/.test(fragen[0] || ''), fragen[0]);
  t('und nicht die nur teilweise betroffenen', !/Bestellung|Position/.test(fragen[0] || ''), fragen[0]);
  t('Nein lässt die Verwaisten stehen', !!S.model.objects.VereinsPartner && !!S.model.objects.href_termintreue);
  t('Nein lässt auch die alte Herkunft stehen', S.model.objects.Bestellung.tabQuellen.includes('Roadshow.Bestellung_VRS'),
    S.model.objects.Bestellung.tabQuellen.join(','));

  api.undo();
  t('Rückgängig bringt die volle Datei zurück', !!S.quellModell.objects['Roadshow.VereinsPartner']);
  fragen.length = 0;
  global.__ja = true;
  api.loadQuellen(nurWebshop, 'webshop.yaml');
  t('Ja löscht die Verwaisten', !S.model.objects.VereinsPartner && !S.model.objects.href_termintreue,
    Object.keys(S.model.objects).join(','));
  // Leer stünde wieder die mitgelieferte Übersicht da — und die nennt VereinsPartner
  const h = S.bereiche.hierarchie.outlineText;
  t('… nimmt sie aus der Hierarchie', !!h && !/VereinsPartner/.test(h), JSON.stringify((h || '').slice(0, 60)));
  t('… und die Beziehungen auf sie', !Object.values(S.model.objects).some(o => o.rels.some(r => r.to === 'VereinsPartner')));
  const B = S.model.objects.Bestellung;
  t('teilweise Betroffene bleiben', !!B && !!S.model.objects.Position);
  t('… nur mit der verbliebenen Tabelle', B && B.tabQuellen.join(',') === 'Webshop.Bestellung', B && B.tabQuellen.join(','));
  t('… und ohne Attributquellen der weggefallenen', B && !B.attrs.some(a => a.quellen.some(q => q.startsWith('Roadshow.'))));
  t('der Toast nennt die Löschung', /2 gelöscht/.test($('toast').textContent), $('toast').textContent);

  api.undo();
  t('ein Schritt im Verlauf: alles wieder da', !!S.model.objects.VereinsPartner
    && S.model.objects.Bestellung.tabQuellen.includes('Roadshow.Bestellung_VRS')
    && !!S.quellModell.objects['Roadshow.VereinsPartner']);

  fragen.length = 0;
  api.loadQuellen(T, 'w.yaml');
  t('ohne Verwaiste keine Frage', fragen.length === 0, fragen.length + ' Fragen');
}

console.log('== Vorlage ohne Table_Sources: Laden fragt trotzdem ==');
{
  /* Wie beim echten Öffnen: Willibald-Modell und die Tabellen als Vorlage,
     nichts übernommen. Zugehörig sind die Objekte dann nur über
     business_object der Vorlage. */
  const {S: S2, api: api2} = await bootApp();
  const alle = Object.keys(S2.model.objects);
  t('Ausgangslage: 11 Objekte, keines mit Table_Sources',
    alle.length === 11 && !Object.values(S2.model.objects).some(o => o.tabQuellen.length),
    alle.length + ' Objekte');
  S2.yamlText = api2.goObjektAnlegen(S2.yamlText, 'Eigenes');
  S2.model = api2.buildModel(S2.yamlText);
  api2.persist();

  const fragen = [];
  global.confirm = text => { fragen.push(text); return global.__ja; };
  const neu = 'SourceTables:\n  CRM:\n    Person:\n      business_object: Kunde\n';
  global.__ja = true;
  api2.loadQuellen(neu, 'crm.yaml');
  t('die Frage kommt', fragen.length === 1, fragen.length + ' Fragen');
  t('sie nennt die Vorlage, nicht was die neue Datei nennt',
    /Bestellung/.test(fragen[0] || '') && !/\bKunde\b/.test(fragen[0] || ''), fragen[0]);
  const K = S2.model.objects.Kunde;
  t('was die neue Datei nennt, bleibt und wird beliefert', !!K && K.tabQuellen.join(',') === 'CRM.Person',
    K && K.tabQuellen.join(','));
  const rest = alle.filter(n => n !== 'Kunde');
  t('der Rest der Vorlage wird gelöscht', rest.every(n => !S2.model.objects[n]),
    rest.filter(n => S2.model.objects[n]).join(','));
  t('von Hand angelegt bleibt', !!S2.model.objects.Eigenes);

  api2.undo();
  fragen.length = 0;
  global.__ja = false;
  api2.loadQuellen(neu, 'crm.yaml');
  t('Nein lässt alle stehen', alle.every(n => S2.model.objects[n]) && !!S2.model.objects.Eigenes,
    Object.keys(S2.model.objects).join(','));
}

console.log('== Delta Quelltabellen ergänzt und aktualisiert ==');
{
  const fragen = [];
  global.confirm = text => { fragen.push(text); return true; };
  const b = akt('openQuellDelta');
  t('„Delta Quelltabellen" im Menü', !!b && /Delta Quelltabellen/.test(b.textContent));
  t('nur bei eingeschalteten Quelltabellen', !!b && b.classList.contains('nur-quellen'));
  let geoeffnet = false;
  $('quellDeltaInput').onclick = ()=>{ geoeffnet = true; };
  b && b.click();
  t('der Knopf öffnet sein Dateifeld', geoeffnet);

  const tabellenVorher = Object.keys(S.quellModell.objects);
  const gosVorher = Object.keys(S.model.objects);
  const vorher = S.quellText;
  const kundeSpalten = S.quellModell.objects['Webshop.Kunde'].attrs.map(a => a.name);
  await fuettern('quellDeltaInput', 'delta.yaml', [
    'SourceTables:',
    '    Webshop:',
    '        Kunde:',
    '            attributes:',
    '            -   name: KundeID',
    '                type: char(20)',
    '            -   name: Treuepunkte',
    '                type: int',
    '        Gutschein:',
    '            business_object: Gutschein',
    '            attributes:',
    '            -   name: Code',
    '                type: varchar(20)',
    '                primary_key: true',
    '    Kasse:',
    '        Bon:',
    '            business_object: Bon',
    ''
  ].join('\n'));
  const Q = S.quellModell.objects;
  t('neue Tabelle kommt dazu', !!Q['Webshop.Gutschein'], Object.keys(Q).join(','));
  t('… und ihr Geschäftsobjekt', !!S.model.objects.Gutschein);
  t('neues System wird angelegt', !!Q['Kasse.Bon']);
  const K = Q['Webshop.Kunde'];
  t('vorhandene Tabelle: neue Spalte ergänzt', !!K && K.attrs.some(a => a.name === 'Treuepunkte'));
  t('… die alten Spalten bleiben', !!K && kundeSpalten.every(n => K.attrs.some(a => a.name === n)),
    K && K.attrs.map(a => a.name).join(','));
  t('vorhandene Spalte: das Delta gewinnt', !!K && K.attrs.find(a => a.name === 'KundeID').type === 'char(20)');
  t('nichts wird gelöscht', tabellenVorher.every(n => Q[n]) && gosVorher.every(n => S.model.objects[n]));
  t('und nichts gefragt', fragen.length === 0, fragen.length + ' Fragen');
  t('die Rückmeldung zählt', /2 neu, 1 zusammengeführt/.test($('toast').textContent), $('toast').textContent);

  api.undo();
  t('ein Schritt im Verlauf', S.quellText === vorher && !S.model.objects.Gutschein);

  const nachUndo = S.quellText;
  await fuettern('quellDeltaInput', 'kaputt.yaml', 'BusinessObjects:\n  X:\n    Domain: D\n');
  t('eine Datei ohne SourceTables wird benannt', /Quelltabellen/.test($('toast').textContent), $('toast').textContent);
  t('… und der Stand bleibt', S.quellText === nachUndo);

  const hinweis = ()=>{ api.setMode('komplett'); api.renderMessages();
    return /Kasse\.Beleg: Quelltabelle ohne Geschäftsobjekt/.test($('msgList').innerHTML); };
  await fuettern('quellDeltaInput', 'beleg.yaml', 'SourceTables:\n  Kasse:\n    Beleg:\n      desc: Ein Kassenbeleg.\n');
  t('Delta: eine neue Tabelle ohne business_object wird nicht übernommen', !!S.quellModell.objects['Kasse.Beleg'] && !S.model.objects.Beleg);
  t('… sondern als Hinweis gemeldet', hinweis(), $('msgList').textContent.slice(0, 400));
  await fuettern('quellDeltaInput', 'beleg.yaml', 'SourceTables:\n  Kasse:\n    Beleg:\n      business_object: Beleg\n');
  t('mit business_object kommt das Objekt', !!S.model.objects.Beleg && S.model.objects.Beleg.tabQuellen.join(',') === 'Kasse.Beleg');
  t('… und der Hinweis ist weg', !hinweis());
  api.undo(); api.undo();
}

console.log('== Neue Tabellen ersetzen alle bisherigen: schon beim ersten Laden ==');
{
  // Stammen alle Geschäftsobjekte aus Tabellen, die in der neuen Datei
  // fehlen, löscht das Bejahen sie alle. Der Abschnitt BusinessObjects steht
  // dann einen Augenblick leer da — das darf das Laden nicht abbrechen.
  await api.loadYaml('BusinessObjects:\n  Alt:\n    Domain: D\n', 'alt.yaml');
  api.loadQuellen('SourceTables:\n  Vorher:\n    Alt:\n      business_object: Alt\n', 'vorher.yaml');
  t('Ausgangslage: Alt stammt aus einer Tabelle', S.model.objects.Alt.tabQuellen.join(',') === 'Vorher.Alt');
  global.confirm = ()=> true;
  let fehler = null;
  try{ api.loadQuellen('SourceTables:\n  Neu:\n    Ding:\n      business_object: Ding\n', 'neu.yaml'); }catch(e){ fehler = e.message; }
  global.confirm = ()=> false;
  t('kein Fehler', !fehler, fehler);
  t('beim ersten Mal nur noch das neue Objekt', Object.keys(S.model.objects).join(',') === 'Ding', Object.keys(S.model.objects).join(','));
  t('das Modell passt zum Text', !/\n  Alt:/.test(S.yamlText) && /\n  Ding:/.test(S.yamlText), S.yamlText);
  t('die Rückmeldung nennt die Gelöschten', /1 gelöscht/.test($('toast').textContent), $('toast').textContent);
}

console.log('== Abgleich: die Prüfung meldet, was nicht zusammenpasst ==');
{
  // Beim Laden eines Projekts läuft keine Übernahme: ist die Tabellen-Datei
  // draußen geändert worden, zeigen die Verweise der Geschäftsobjekte ins Leere.
  const qt = (system, ohneSpalte, ohneBeziehung, dazu)=> ['SourceTables:', '  ' + system + ':',
    '    PA001:', '      business_object: Person', '      attributes:',
    '      - name: PERNR', '        primary_key: true', ...(ohneSpalte ? [] : ['      - name: Name']),
    ...(ohneBeziehung ? [] : ['      relationships:', '      - to: ' + system + '.PA002']),
    '    PA002:', '      business_object: Abteilung',
    ...(dazu ? ['    PA003:', '      business_object: Person'] : []), ''].join('\n');
  await api.loadYaml('BusinessObjects:\n  Person:\n    Domain: HR\n', 'hr.yaml');
  S.quellenAn = true;
  api.loadQuellen(qt('HRCM'), 'hr_quellen.yaml');
  const go = S.yamlText;
  const pruefung = ()=>{ api.setMode('komplett'); api.renderMessages(); return $('msgList').textContent; };
  const laden = async q => api.projektLaden([{name:'hr.yaml', text: async ()=> go},
    {name:'hr_quellen.yaml', text: async ()=> q}], 'hr');
  const ABGLEICH = /Quelltabelle fehlt|Quellspalte fehlt|Quellbeziehung fehlt|Quellsystem ohne Tabellen|noch nicht übernommen|Quelltabelle ohne Geschäftsobjekt/;
  t('Ausgangslage: Person stammt aus HRCM.PA001', S.model.objects.Person.tabQuellen.includes('HRCM.PA001')
    && S.model.objects.Person.sources.includes('HRCM'), S.yamlText);
  t('nach der Übernahme passt alles zusammen', !ABGLEICH.test(pruefung()), pruefung());

  await laden(qt('HCM'));
  let p = pruefung();
  t('ein umbenanntes System: die Tabelle fehlt', /Quelltabelle fehlt/.test(p) && /HRCM\.PA001/.test(p), p);
  t('… mit dem Hinweis auf den neuen Namen', /gibt es als HCM\.PA001/.test(p), p);
  t('… und das System ohne Tabellen', /Quellsystem ohne Tabellen/.test(p) && /source_systems nennt HRCM/.test(p), p);
  t('der Titel springt zum Geschäftsobjekt', !!$('msgList').querySelector('[data-msgobj="Person"]'));

  await laden(qt('HRCM', true));
  t('eine entfernte Spalte', /Quellspalte fehlt/.test(pruefung()) && /HRCM\.PA001\.Name/.test(pruefung()), pruefung());
  await laden(qt('HRCM', false, true));
  t('eine entfernte Beziehung', /Quellbeziehung fehlt/.test(pruefung()) && /HRCM\.PA001→HRCM\.PA002/.test(pruefung()), pruefung());
  await laden(qt('HRCM', false, false, true));
  p = pruefung();
  t('eine neue Tabelle ist noch nicht übernommen', /noch nicht übernommen/.test(p) && /HRCM\.PA003/.test(p)
    && !/Quelltabelle fehlt|Quellspalte fehlt|Quellbeziehung fehlt/.test(p), p);
  S.quellenAn = false;
  t('ohne Quelltabellen meldet der Abgleich nichts', !ABGLEICH.test(pruefung()), pruefung());
}

finish();
})().catch(e=>{ console.error(e); process.exit(1); });
