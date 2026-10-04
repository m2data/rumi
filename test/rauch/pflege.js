/* Rauchtest: Geschäftsobjekte und Beziehungen pflegen — Formular im Reiter
   „Details", Text-Chirurgie am Modell-YAML (nur geänderte Stellen), Umbenennen
   samt Verweisen und Kennungen, Anlegen, Löschen, Rückgängig. */
const {bootApp, makeT} = require('./start');

(async ()=>{
const {S, api, win, document, dispatch} = await bootApp();
const {t, finish} = makeT();

// Der Start steht in der Hierarchie (oberste Stufe); dieses Thema prüft die
// Komplettansicht und stellt sie darum ausdrücklich her.
api.setMode('komplett');

const detail = ()=> document.getElementById('detailBody');
const $ = id => document.getElementById(id);
const formularOeffnen = id => {
  api.setSelection([id]);
  const b = detail().querySelector('[data-edit]');
  if(b) dispatch(b, 'click', {});
  return !!$('pfName');
};

console.log('== Nur geänderte Stellen: Kommentare und Formatierung bleiben ==');
{
  const text = [
    'BusinessObjects:',
    '  A:',
    '    # gehört zum Vertrieb',
    '    Domain: Alt',
    '    source_systems:',
    '    - Q1          # Hauptquelle',
    '    - Q2',
    '    attributes:',
    '    - name: AID',
    '      type: bigint',
    '      primary_key: true',
    '    relationships:',
    '    - to: B',
    '      name: hat',
    '      cardinality:',
    '        from: exactly_one',
    '        to: zero_or_many',
    '  B:',
    '    Domain: Alt',
    ''
  ].join('\n');
  const alt = {name:'A', domain:'Alt', desc:null, keys:[], sources:['Q1','Q2'],
    attrs:[{name:'AID', type:'bigint', nullable:false, pk:true, fk:false, ref:null}],
    rels:[{to:'B', name:'hat', from:'exactly_one', toCard:'zero_or_many'}]};
  const entwurf = (aenderung)=> Object.assign({
    name:'A', domain:'Alt', desc:'', keys:[], sources:alt.sources.slice(),
    attrs: alt.attrs.map(a => Object.assign({}, a, {_alt:a})),
    rels:  alt.rels.map(r => Object.assign({}, r, {_alt:r}))
  }, aenderung || {});

  const nurDomain = api.goObjektAendern(text, 'A', entwurf({domain:'Neu'}), alt);
  t('der Kommentar über dem Feld bleibt stehen', /# gehört zum Vertrieb/.test(nurDomain), nurDomain);
  t('der Kommentar am Listeneintrag bleibt stehen', /- Q1 +# Hauptquelle/.test(nurDomain));
  t('geändert wird nur die eine Zeile', /Domain: Neu/.test(nurDomain)
    && (nurDomain.match(/Domain: Alt/g) || []).length === 1);
  t('unberührte Attribute stehen Zeichen für Zeichen wie zuvor',
    nurDomain.includes('    - name: AID\n      type: bigint\n      primary_key: true'));
  t('die unberührte Beziehung bleibt samt Kardinalität',
    nurDomain.includes('    - to: B\n      name: hat\n      cardinality:\n        from: exactly_one\n        to: zero_or_many'));

  const andereKard = api.goObjektAendern(text, 'A',
    entwurf({rels:[{to:'B', name:'hat', from:'exactly_one', toCard:'one_or_many', _alt:alt.rels[0]}]}), alt);
  t('eine geänderte Kardinalität wird neu geschrieben',
    /to: one_or_many/.test(andereKard) && !/zero_or_many/.test(andereKard), andereKard);
  t('das Ziel der Beziehung bleibt dasselbe', /- to: B/.test(andereKard));

  const neuesAttr = api.goObjektAendern(text, 'A', entwurf({attrs:[
    Object.assign({}, alt.attrs[0], {_alt:alt.attrs[0]}),
    {name:'BID', type:'int', nullable:false, pk:false, fk:true, ref:'B.BID', _alt:null}]}), alt);
  t('ein neues Attribut kommt mit Typ, FK und Verweis dazu',
    neuesAttr.includes('    - name: BID\n      type: int\n      foreign_key: true\n      references: B.BID'), neuesAttr);

  const wenigerQuellen = api.goObjektAendern(text, 'A', entwurf({sources:['Q2']}), alt);
  t('eine entfernte Quelle ist raus, die andere unverändert',
    !/Q1/.test(wenigerQuellen) && /- Q2/.test(wenigerQuellen), wenigerQuellen);

  const ohneRels = api.goObjektAendern(text, 'A', entwurf({rels:[]}), alt);
  t('die letzte Beziehung entfernt auch das leere Feld',
    !/relationships/.test(ohneRels) && !/- to: B/.test(ohneRels), ohneRels);

  const mitDesc = api.goObjektAendern(text, 'A', entwurf({desc:'Erste Zeile\nZweite Zeile'}), alt);
  t('ein noch fehlendes Feld wird ergänzt, Zeilenumbrüche maskiert',
    /desc: "Erste Zeile\\nZweite Zeile"/.test(mitDesc), mitDesc);
}

console.log('== Ein Listenfeld, das schon einen Wert hinter dem Doppelpunkt trägt ==');
{
  /* „source_systems: []" steht so in echten Modelldateien (models/verquer_bo.yaml).
     Die Zeile trägt bereits einen Wert und taugt darum nicht als Kopf einer
     Blockliste: Einträge darunter ergäben kein YAML mehr, und die gepflegte
     Quelle wäre beim nächsten Lesen still verschwunden. */
  const text = [
    'BusinessObjects:',
    '  A:',
    '    Domain: Haushalt',
    '    source_systems: []',
    '    attributes:',
    '    - name: AID',
    ''
  ].join('\n');
  const alt = {name:'A', domain:'Haushalt', desc:null, keys:[], sources:[],
    attrs:[{name:'AID', type:null, nullable:false, pk:false, fk:false, ref:null}], rels:[]};
  const entwurf = {name:'A', domain:'Haushalt', desc:'', keys:[], sources:['Q9'],
    attrs: alt.attrs.map(a => Object.assign({}, a, {type:'', ref:'', _alt:a})), rels:[]};

  const mitQuelle = api.goObjektAendern(text, 'A', entwurf, alt);
  t('die leere Inline-Liste wird zur Kopfzeile einer Blockliste',
    /\n {4}source_systems:\n {4}- Q9\n/.test(mitQuelle) && !/source_systems: \[\]/.test(mitQuelle), mitQuelle);
  t('das unberührte Attribut steht unverändert dahinter',
    /\n {4}attributes:\n {4}- name: AID\n/.test(mitQuelle), mitQuelle);

  // Auch eine gefüllte Inline-Liste zerfiele sonst in Kopfzeile plus Einträge.
  const inline = api.goObjektAendern(text.replace('source_systems: []', 'source_systems: [Q1]'), 'A',
    Object.assign({}, entwurf, {sources:['Q1','Q9']}),
    Object.assign({}, alt, {sources:['Q1']}));
  t('eine gefüllte Inline-Liste wird gleichfalls zur Blockliste',
    /\n {4}source_systems:\n {4}- Q1\n {4}- Q9\n/.test(inline) && !/\[Q1\]/.test(inline), inline);

  // Gegenprobe: eine wertlose Kopfzeile bleibt Zeichen für Zeichen stehen.
  const wertlos = api.goObjektAendern(
    text.replace('    source_systems: []', '    source_systems:      # noch offen'), 'A', entwurf, alt);
  t('eine wertlose Kopfzeile bleibt samt Kommentar unangetastet',
    /\n {4}source_systems: {6}# noch offen\n {4}- Q9\n/.test(wertlos), wertlos);
}

console.log('== Leerzeilen trennen und rutschen nicht mitten hinein ==');
{
  /* Eine Leerzeile am Ende eines Eintrags oder Blocks trennt vom Folgenden.
     Die Zerleger schlagen sie dem letzten Eintrag bzw. dem letzten Feld zu —
     käme sie mit zurück, rutschte sie mitten in die Liste, sobald darunter
     etwas dazukommt. */
  const alt = {name:'A', domain:'D', desc:null, keys:[], sources:['Q1'], attrs:[], rels:[]};
  const entwurf = (s)=> ({name:'A', domain:'D', desc:'', keys:[], sources:s, attrs:[], rels:[]});

  const inListe = api.goObjektAendern(
    ['BusinessObjects:','  A:','    Domain: D','    source_systems:','    - Q1',''].join('\n'),
    'A', entwurf(['Q1','Q2']), alt);
  t('in der Liste steht die Leerzeile hinter dem neuen Eintrag',
    /\n {4}- Q1\n {4}- Q2\n$/.test(inListe), inListe);

  const vorFeld = api.goObjektAendern(
    ['BusinessObjects:','  A:','    source_systems:','    - Q1','','    attributes:','    - name: X',''].join('\n'),
    'A', Object.assign(entwurf(['Q1','Q2']),
      {attrs:[{name:'X', type:'', nullable:false, pk:false, fk:false, ref:'',
               _alt:{name:'X', type:null, nullable:false, pk:false, fk:false, ref:null}}]}),
    Object.assign({}, alt, {attrs:[{name:'X', type:null, nullable:false, pk:false, fk:false, ref:null}]}));
  t('die Leerzeile trennt weiter vom nächsten Feld',
    /\n {4}- Q1\n {4}- Q2\n\n {4}attributes:\n/.test(vorFeld), vorFeld);

  const imBlock = api.goObjektAendern(
    ['BusinessObjects:','  A:','    Domain: D',''].join('\n'),
    'A', entwurf(['Q1']), Object.assign({}, alt, {sources:[]}));
  t('im Block steht die Leerzeile hinter dem ergänzten Feld',
    /\n {4}Domain: D\n {4}source_systems:\n {4}- Q1\n$/.test(imBlock), imBlock);

  const zweiObjekte = api.goObjektAendern(
    ['BusinessObjects:','  A:','    Domain: D','','  B:','    Domain: D',''].join('\n'),
    'A', entwurf(['Q1']), Object.assign({}, alt, {sources:[]}));
  t('die Leerzeile bleibt zwischen den beiden Objekten',
    /\n {4}- Q1\n\n {2}B:\n/.test(zweiObjekte), zweiObjekte);

  // Gegenproben: ohne Zuwachs bleibt alles, wo es ist.
  const unberuehrt = ['BusinessObjects:','  A:','    Domain: D','    source_systems:','    - Q1',''].join('\n');
  t('ohne neuen Eintrag ist der Text Zeichen für Zeichen der alte',
    api.goObjektAendern(unberuehrt, 'A', entwurf(['Q1']), alt) === unberuehrt,
    JSON.stringify(api.goObjektAendern(unberuehrt, 'A', entwurf(['Q1']), alt)));

  const gruppiert = api.goObjektAendern(
    ['BusinessObjects:','  A:','    Domain: D','    source_systems:','    - Q1','','    - Q2',''].join('\n'),
    'A', entwurf(['Q1','Q2','Q3']), Object.assign({}, alt, {sources:['Q1','Q2']}));
  t('eine Leerzeile zwischen zwei Einträgen bleibt liegen',
    /\n {4}- Q1\n\n {4}- Q2\n {4}- Q3\n$/.test(gruppiert), gruppiert);

  const mitKomm = api.goObjektAendern(
    ['BusinessObjects:','  A:','    Domain: D','    source_systems:','    - Q1','    # Ende',''].join('\n'),
    'A', entwurf(['Q1','Q2']), alt);
  t('ein Kommentar am Ende bleibt, wo er steht',
    /\n {4}- Q1\n {4}# Ende\n {4}- Q2\n$/.test(mitKomm), mitKomm);

  /* Ein Blockskalar als letztes Feld: die Leerzeile dahinter wandert vor das
     ergänzte Feld, der Blockskalar selbst bleibt Zeichen für Zeichen stehen.
     Für den Wert ist das folgenlos — der Leser wirft Leerzeilen am Blockende
     ohnehin weg (expandBlockScalars). */
  const blockText = api.goObjektAendern(
    ['BusinessObjects:','  A:','    Domain: D','    desc: |','      Zeile eins',
     '      Zeile zwei',''].join('\n'),
    'A', Object.assign(entwurf(['Q1']), {desc:'Zeile eins\nZeile zwei'}),
    Object.assign({}, alt, {sources:[], desc:'Zeile eins\nZeile zwei'}));
  t('ein Blockskalar bleibt unangetastet',
    blockText.includes('    desc: |\n      Zeile eins\n      Zeile zwei\n'), blockText);

  /* Zwischen Kopfzeile und erstem Eintrag: so steht es in models/sap-finanz.yaml.
     Diese Zeilen gehören zu keinem Eintrag und verschwanden beim Neuschreiben. */
  const nachKopf = api.goObjektAendern(
    ['BusinessObjects:','  A:','    Domain: D','    source_systems:','','    - Q1',''].join('\n'),
    'A', entwurf(['Q1','Q2']), alt);
  t('eine Leerzeile hinter der Kopfzeile bleibt dort',
    /\n {4}source_systems:\n\n {4}- Q1\n {4}- Q2\n$/.test(nachKopf), nachKopf);

  const kommKopf = api.goObjektAendern(
    ['BusinessObjects:','  A:','    Domain: D','    source_systems:','    # alle Altsysteme','    - Q1',''].join('\n'),
    'A', entwurf(['Q1','Q2']), alt);
  t('ein Kommentar hinter der Kopfzeile bleibt dort',
    /\n {4}source_systems:\n {4}# alle Altsysteme\n {4}- Q1\n {4}- Q2\n$/.test(kommKopf), kommKopf);

  const leerListe = api.goObjektAendern(
    ['BusinessObjects:','  A:','    Domain: D','    source_systems:','','  B:','    Domain: D',''].join('\n'),
    'A', entwurf(['Q1']), Object.assign({}, alt, {sources:[]}));
  t('ohne Eintrag trennt die Leerzeile weiter nach unten',
    /\n {4}source_systems:\n {4}- Q1\n\n {2}B:\n/.test(leerListe), leerListe);
  t('und das ergänzte Feld steht davor, nicht hinter der Lücke',
    /\n {6}Zeile zwei\n {4}source_systems:\n {4}- Q1\n$/.test(blockText), blockText);
}

console.log('== Umbenennen zieht jeden Verweis mit ==');
{
  // Das Objekt heißt wie ein Kardinalitätswert: „to: many" unter „cardinality:"
  // darf dabei NICHT mitwandern — dort steht dasselbe Wort für etwas anderes.
  const text = [
    'BusinessObjects:',
    '  many:',
    '    Domain: D',
    '  C:',
    '    attributes:',
    '    - name: X',
    '      references: many.X',
    '    relationships:',
    '    - to: many',
    '      cardinality:',
    '        to: many',
    ''
  ].join('\n');
  const neu = api.goUmbenennen(text, 'many', 'Menge');
  t('die Kopfzeile trägt den neuen Namen', /^ {2}Menge:/m.test(neu), neu);
  t('das Ziel der fremden Beziehung wandert mit', /- to: Menge/.test(neu));
  t('der Verweis im Attribut wandert mit', /references: Menge\.X/.test(neu));
  t('die Kardinalität bleibt unangetastet', /\n {8}to: many/.test(neu), neu);
}

console.log('== Löschen nimmt die eingehenden Beziehungen mit ==');
{
  const text = [
    'BusinessObjects:',
    '  A:',
    '    relationships:',
    '    - to: B',
    '      name: hat',
    '    - to: C',
    '  B:',
    '    Domain: D',
    '  C:',
    '    Domain: D',
    ''
  ].join('\n');
  const neu = api.goObjektLoeschen(text, 'B');
  t('der Block ist weg', !/^ {2}B:/m.test(neu), neu);
  t('die Beziehung darauf ist weg', !/- to: B/.test(neu));
  t('die andere Beziehung bleibt', /- to: C/.test(neu));

  const leer = api.goObjektLoeschen(api.goObjektLoeschen(text, 'B'), 'C');
  t('fällt die letzte Beziehung weg, verschwindet auch das leere Feld',
    !/relationships/.test(leer), leer);
}

console.log('== Anlegen hängt einen leeren Block in derselben Einrückung an ==');
{
  const neu = api.goObjektAnlegen('BusinessObjects:\n  A:\n    Domain: D\n', 'Neuling');
  t('der neue Block steht unter BusinessObjects', /^ {2}Neuling:$/m.test(neu), neu);
  t('das Vorhandene bleibt unberührt', /^ {2}A:\n {4}Domain: D$/m.test(neu));
}

console.log('== Namen wirken auch in der Hierarchiebeschreibung ==');
{
  const txt = 'Übersicht:\n  objekte:\n    - Kunde\n    - Bestellung\n  Details:\n    Kunde:\n      objekte:\n        - Kunde\n';
  const um = api.uebersichtObjekt(txt, 'Kunde', 'Klient');
  t('jeder Listeneintrag wird umbenannt', (um.match(/- Klient/g) || []).length === 2, um);
  t('der gleichnamige Diagrammname bleibt stehen', /\n {4}Kunde:/.test(um));
  const weg = api.uebersichtObjekt(txt, 'Kunde', null);
  t('Löschen nimmt die Einträge aus den Diagrammen', !/- Kunde/.test(weg) && /- Bestellung/.test(weg), weg);
}

console.log('== Einstellung: Bearbeiten ist zunächst aus ==');
{
  t('die Vorgabe ist „aus"', S.pflegeAn === false);
  api.setSelection(['o:Bestellung']);
  t('die Details zeigen keinen „Bearbeiten"-Knopf', !detail().querySelector('[data-edit]'));
  t('„＋ Objekt" ist ausgeblendet', $('objNew').hidden === true);
  t('auch über die Schnittstelle geht nichts', (api.pflegeObjektNeu('Heimlich'), !S.model.objects.Heimlich));

  dispatch($('btnEinst'), 'click', {});
  t('der Knopf in der Kopfzeile öffnet das Menü', $('einstMenu').classList.contains('open'));
  t('der Haken steht auf dem gemerkten Stand', $('optPflege').getAttribute('aria-checked') === 'false');
  dispatch($('optPflege'), 'click', {});
  t('der Menüpunkt schaltet die Pflege ein', S.pflegeAn === true);
  t('und setzt den Haken', $('optPflege').getAttribute('aria-checked') === 'true');
  t('„＋ Objekt" ist jetzt da', $('objNew').hidden === false);
  t('die Details zeigen „Bearbeiten"', !!detail().querySelector('[data-edit]'));
  dispatch($('btnEinst'), 'click', {});
  t('ein zweiter Klick auf den Knopf schließt das Menü', !$('einstMenu').classList.contains('open'));

  // Strg+Z nimmt auch Einstellungen zurück, Strg+Y bringt sie wieder.
  api.undo();
  t('Rückgängig schaltet die Pflege wieder ab', S.pflegeAn === false);
  t('und nimmt den „Bearbeiten"-Knopf mit', !detail().querySelector('[data-edit]'));
  api.redo();
  t('Wiederherstellen schaltet sie wieder ein', S.pflegeAn === true);
}

console.log('== Ausschalten schließt ein offenes Formular ==');
{
  formularOeffnen('o:Bestellung');
  dispatch($('btnEinst'), 'click', {});
  dispatch($('optPflege'), 'click', {});
  t('das Formular ist zu', !$('pfName'));
  t('und der „Bearbeiten"-Knopf verschwunden', !detail().querySelector('[data-edit]'));
  dispatch($('optPflege'), 'click', {});
  dispatch($('btnEinst'), 'click', {});
  t('wieder eingeschaltet steht die Pflege bereit', !!detail().querySelector('[data-edit]'));
}

console.log('== Bedienweg: wählen, „Bearbeiten", ändern, speichern ==');
{
  t('die Details bieten „Bearbeiten" an', formularOeffnen('o:Bestellung'));
  t('der Name ist vorbelegt', $('pfName').value === 'Bestellung', $('pfName').value);
  t('die Attribute stehen als Zeilen im Formular',
    detail().querySelectorAll('.pfa-name').length === S.model.objects.Bestellung.attrs.length);
  $('pfDomain').value = 'Vertrieb';
  $('pfKeys').value = 'BestellungID, Auftragsnummer';
  dispatch($('pfSave'), 'click', {});
  t('das Formular ist wieder zu', !$('pfName'));
  t('die Domain steht im Modell', S.model.objects.Bestellung.domain === 'Vertrieb');
  t('der zweite Business Key ist dazugekommen',
    S.model.objects.Bestellung.keys.join(',') === 'BestellungID,Auftragsnummer',
    S.model.objects.Bestellung.keys.join(','));
  t('der Modelltext trägt beides', /Domain: Vertrieb/.test(S.yamlText) && /- Auftragsnummer/.test(S.yamlText));
  t('die Beschreibung blieb unangetastet', S.model.objects.Bestellung.desc.startsWith('Repräsentiert einen Kundenauftrag'));
  t('der Kasten im Diagramm zeigt den neuen Stand',
    S.graph.byId.get('o:Bestellung').ref.domain === 'Vertrieb');
}

console.log('== Bedienweg: Attribut und Beziehung über die Knöpfe ==');
{
  formularOeffnen('o:Produkt');
  const vorher = S.model.objects.Produkt.attrs.length;
  dispatch(detail().querySelector('[data-neu="attr"]'), 'click', {});
  const namen = detail().querySelectorAll('.pfa-name');
  t('„＋ Attribut" hängt eine leere Zeile an', namen.length === vorher + 1, namen.length + '');
  namen[vorher].value = 'Testattribut';
  detail().querySelectorAll('.pfa-type')[vorher].value = 'text';
  detail().querySelectorAll('.pfa-null')[vorher].checked = true;
  dispatch(detail().querySelector('[data-neu="rel"]'), 'click', {});
  const ziele = detail().querySelectorAll('.pfb-to');
  ziele[ziele.length-1].value = 'Kunde';
  detail().querySelectorAll('.pfb-name')[ziele.length-1].value = 'Probebeziehung';
  detail().querySelectorAll('.pfb-toc')[ziele.length-1].value = 'zero_or_many';
  dispatch($('pfSave'), 'click', {});

  const a = S.model.objects.Produkt.attrs.find(x => x.name === 'Testattribut');
  t('das Attribut steht mit Typ und nullable im Modell', !!a && a.type === 'text' && a.nullable === true,
    JSON.stringify(a));
  const r = S.model.objects.Produkt.rels.find(x => x.name === 'Probebeziehung');
  t('die Beziehung steht mit Ziel und Kardinalität im Modell',
    !!r && r.to === 'Kunde' && r.toCard === 'zero_or_many', JSON.stringify(r));
  t('sie ist als Kante gezeichnet',
    S.graph.edges.some(e => e.from === 'o:Produkt' && e.to === 'o:Kunde' && e.label === 'Probebeziehung'));

  // und wieder heraus
  formularOeffnen('o:Produkt');
  const idx = S.model.objects.Produkt.attrs.findIndex(x => x.name === 'Testattribut');
  const ri = S.model.objects.Produkt.rels.findIndex(x => x.name === 'Probebeziehung');
  dispatch(detail().querySelectorAll('[data-weg="attr"]')[idx], 'click', {});
  dispatch(detail().querySelectorAll('[data-weg="rel"]')[ri], 'click', {});
  dispatch($('pfSave'), 'click', {});
  t('das Attribut ist wieder weg', !S.model.objects.Produkt.attrs.some(x => x.name === 'Testattribut'));
  t('die Beziehung ist wieder weg', !S.model.objects.Produkt.rels.some(x => x.name === 'Probebeziehung'));
  t('die übrigen Attribute sind vollzählig geblieben', S.model.objects.Produkt.attrs.length === vorher,
    S.model.objects.Produkt.attrs.length + ' statt ' + vorher);
}

console.log('== Ein neues Objekt wirft keinen Kantenzug weg ==');
{
  const kante = S.graph.edges.find(e => e.kind === 'rel' && e.from !== e.to);
  kante.bends = [{x:11, y:12}];
  const schluessel = api.edgeKey(kante);
  api.persist();
  const gelegt = Object.assign({}, S.saved[S.view]);

  api.pflegeObjektNeu('Neuling');
  t('das Objekt steht im Modell', !!S.model.objects.Neuling);
  t('das Formular dazu ist gleich offen', !!$('pfName') && $('pfName').value === 'Neuling');
  const wieder = S.graph.edges.find(e => api.edgeKey(e) === schluessel);
  t('der Kantenzug des anderen Objekts steht noch',
    !!wieder && !!wieder.bends && wieder.bends.length === 1, JSON.stringify(wieder && wieder.bends));
  t('die bisherige Anordnung liegt unverändert',
    Object.keys(gelegt).every(id => S.saved[S.view][id]
      && S.saved[S.view][id].x === gelegt[id].x && S.saved[S.view][id].y === gelegt[id].y));
  const n = S.graph.byId.get('o:Neuling');
  t('der neue Kasten liegt unter den vorhandenen',
    !!n && n.y >= Math.max(...Object.keys(gelegt).map(id => gelegt[id].y)), n && n.y + '');
}

console.log('== Umbenennen behält Anordnung und Kantenzug ==');
{
  const alt = 'o:Kategorie', neu = 'o:Warengruppe';
  const kante = S.graph.edges.find(e => (e.from === alt || e.to === alt) && e.from !== e.to);
  kante.bends = [{x:21, y:22}];
  api.persist();
  const pos = Object.assign({}, S.saved[S.view][alt]);

  formularOeffnen(alt);
  $('pfName').value = 'Warengruppe';
  dispatch($('pfSave'), 'click', {});

  t('das Objekt heißt jetzt anders', !!S.model.objects.Warengruppe && !S.model.objects.Kategorie);
  t('kein Verweis zeigt mehr auf den alten Namen',
    Object.values(S.model.objects).every(o => o.rels.every(r => r.to !== 'Kategorie')
      && o.attrs.every(a => !a.ref || a.ref.split('.')[0] !== 'Kategorie')));
  t('die Prüfung meldet kein unbekanntes Ziel',
    !S.model.messages.some(m => m.group === 'Ziel unbekannt'),
    (S.model.messages.find(m => m.group === 'Ziel unbekannt') || {}).title);
  t('die Anordnung wandert auf die neue Kennung mit',
    S.saved[S.view][neu] && S.saved[S.view][neu].x === pos.x && S.saved[S.view][neu].y === pos.y,
    JSON.stringify(S.saved[S.view][neu]) + ' statt ' + JSON.stringify(pos));
  const wieder = S.graph.edges.find(e => (e.from === neu || e.to === neu) && e.bends && e.bends.length);
  t('der Kantenzug hängt am umbenannten Objekt',
    !!wieder && wieder.bends[0].x === 21, JSON.stringify(wieder && wieder.bends));
  t('das umbenannte Objekt ist ausgewählt', S.selected === neu, S.selected);
}

console.log('== Löschen über den Bedienweg ==');
{
  const ziel = 'Warengruppe';
  const rein = Object.values(S.model.objects)
    .reduce((s,o)=> s + o.rels.filter(r => r.to === ziel).length, 0);
  api.pflegeObjektWeg(ziel);
  t('das Objekt ist aus dem Modell', !S.model.objects[ziel]);
  t('es hatte eingehende Beziehungen, keine ist geblieben',
    rein > 0 && Object.values(S.model.objects).every(o => o.rels.every(r => r.to !== ziel)), rein + ' eingehende');
  t('es steht auch nicht mehr im Diagramm', !S.graph.byId.get('o:' + ziel));
  t('die Objektliste zeigt den neuen Stand',
    document.getElementById('objectList').querySelectorAll('button[data-id]').length === S.graph.nodes.length);
}

console.log('== Bearbeiten ist rückgängig zu machen ==');
{
  const vorher = S.yamlText;
  formularOeffnen('o:Kunde');
  $('pfDomain').value = 'Testdomäne';
  dispatch($('pfSave'), 'click', {});
  t('die Änderung ist da', S.model.objects.Kunde.domain === 'Testdomäne');
  api.undo();
  t('Rückgängig nimmt sie zurück', S.model.objects.Kunde.domain !== 'Testdomäne'
    && S.yamlText === vorher, S.model.objects.Kunde.domain);
  api.redo();
  t('Wiederherstellen bringt sie zurück', S.model.objects.Kunde.domain === 'Testdomäne');
  api.undo();
}

console.log('== Ein offenes Formular blockiert das Sichern ==');
{
  // Das Formular steht nur im DOM: würde still gesichert, fehlten dem Stand
  // genau die Änderungen, wegen derer gespeichert wird.
  formularOeffnen('o:Kunde');
  $('pfDomain').value = 'Ungespeichert';
  let gefragt = false;
  win.showSaveFilePicker = async ()=>{ gefragt = true; throw new Error('darf nicht kommen'); };
  const toastEl = document.getElementById('toast');
  await api.speichernInDatei();
  t('der Dateidialog kommt gar nicht erst', gefragt === false);
  t('stattdessen ein Hinweis auf das offene Formular',
    toastEl.textContent.includes('Bearbeiten-Formular'), toastEl.textContent);
  dispatch($('pfCancel'), 'click', {});
  await api.speichernInDatei();
  t('nach dem Abbrechen wird gesichert', gefragt === true);
  delete win.showSaveFilePicker;
}

console.log('== Das Formular wehrt sich gegen kaputte Eingaben ==');
{
  formularOeffnen('o:Kunde');
  const text = S.yamlText;
  $('pfName').value = '';
  dispatch($('pfSave'), 'click', {});
  t('ein leerer Name wird abgelehnt', !!$('pfName') && S.yamlText === text);
  $('pfName').value = 'Bestellung';
  dispatch($('pfSave'), 'click', {});
  t('ein schon vergebener Name wird abgelehnt', !!$('pfName') && S.yamlText === text,
    document.getElementById('toast').textContent);
  $('pfName').value = 'Kunde:X';
  dispatch($('pfSave'), 'click', {});
  t('ein Name mit Doppelpunkt wird abgelehnt', !!$('pfName') && S.yamlText === text);
  $('pfName').value = 'Kunde';
  dispatch($('pfCancel'), 'click', {});
  t('„Abbrechen" schließt das Formular ohne Änderung', !$('pfName') && S.yamlText === text);
}

console.log('== Anlegen und Löschen über die Dialoge ==');
{
  /* pflegeNeu()/pflegeLoeschen() fragen über prompt/confirm nach — im Mini-DOM
     stellt die niemand, also hier gesetzt. Die Arbeit dahinter ist oben schon
     geprüft; hier geht es um den Knopf und darum, dass ein Nein nichts tut. */
  global.prompt = ()=> global.__antwort;
  global.confirm = ()=> global.__ja !== false;
  if(!S.pflegeAn) S.pflegeAn = true;

  global.__antwort = 'Testobjekt';
  document.getElementById('objNew').click();
  t('„＋ Objekt" legt das Objekt an', !!S.model.objects.Testobjekt,
    Object.keys(S.model.objects).join(','));
  t('und öffnet gleich sein Formular', S.pflege === 'o:Testobjekt', String(S.pflege));

  global.__antwort = '';
  const vorher = Object.keys(S.model.objects).length;
  document.getElementById('objNew').click();
  t('ein abgebrochener Dialog legt nichts an',
    Object.keys(S.model.objects).length === vorher);

  api.pflegeStart('o:Testobjekt');
  global.__ja = false;
  document.getElementById('pfDelete').click();
  t('ein Nein im Löschdialog lässt das Objekt stehen', !!S.model.objects.Testobjekt);

  global.__ja = true;
  document.getElementById('pfDelete').click();
  t('ein Ja löscht es', !S.model.objects.Testobjekt, Object.keys(S.model.objects).join(','));
}

console.log('== Umbenennen zieht den Hierarchie-Ausschnitt mit ==');
{
  /* Die Kennung eines Objekts steckt in seinem Namen (o:Kunde). Beim Umbenennen
     muss sie in jeder Ablage mitwandern — auch in der Liste der Objekte, die ein
     Diagramm zeigt. Sonst fällt das Objekt beim Umbenennen aus dem Diagramm. */
  if(!S.pflegeAn) S.pflegeAn = true;
  const alt = Object.keys(S.model.objects)[0];
  const neu = alt + 'Neu';
  api.loadUebersicht('Thema:\n  objekte:\n    - ' + alt + '\n');
  api.setMode('hierarchie');
  api.selectDiagram('Thema');
  api.addRelated('o:' + alt);          // ein- und ausblenden merkt den Ausschnitt
  t('das Diagramm merkt sich seine Objekte', (S.hierShown['Thema'] || []).includes('o:' + alt),
    JSON.stringify(S.hierShown['Thema']));
  api.setMode('komplett'); api.setView();   // umbenannt wird in der Komplettansicht

  t('das Formular lässt sich öffnen', formularOeffnen('o:' + alt));
  $('pfName').value = neu;
  dispatch($('pfSave'), 'click', {});

  t('das Objekt heißt jetzt anders', !!S.model.objects[neu] && !S.model.objects[alt],
    Object.keys(S.model.objects).join(','));
  t('der Ausschnitt trägt die neue Kennung',
    (S.hierShown['Thema'] || []).includes('o:' + neu)
    && !(S.hierShown['Thema'] || []).includes('o:' + alt),
    JSON.stringify(S.hierShown['Thema']));
  const n = S.graph.byId.get('o:' + neu);
  t('und das Objekt bleibt im Diagramm sichtbar', !!n && n.hidden === false,
    n ? ('hidden=' + n.hidden) : 'nicht im Graphen');
}

console.log('== Bedienweg: erste Quelle bei „source_systems: []" pflegen ==');
{
  /* Derselbe Fall über das Formular: eingetippt, gespeichert — und beim
     nächsten Lesen muss die Quelle im Modell stehen, nicht bloß im Text. */
  api.loadYaml([
    'BusinessObjects:',
    '  Topflappen:',
    '    Domain: Haushalt',
    '    source_systems: []',
    ''
  ].join('\n'), 'inline.yaml');
  api.setMode('komplett'); api.setView();
  if(!S.pflegeAn) S.pflegeAn = true;

  t('das Objekt hat noch keine Quelle', S.model.objects.Topflappen.sources.length === 0);
  t('das Formular lässt sich öffnen', formularOeffnen('o:Topflappen'));
  $('pfSources').value = 'Küchenschrank';
  dispatch($('pfSave'), 'click', {});

  t('die gepflegte Quelle steht im Modell',
    S.model.objects.Topflappen.sources.join(',') === 'Küchenschrank',
    JSON.stringify(S.model.objects.Topflappen.sources));
  t('der Modelltext trägt sie als Listeneintrag',
    /\n {4}source_systems:\n {4}- Küchenschrank\n/.test(S.yamlText), S.yamlText);
  t('die Warnung „keine Quelle" ist weg',
    !(S.model.messages || []).some(m => m.group === 'keine Quelle'),
    (S.model.messages || []).map(m => m.title).join(' | '));
}

console.log('== Bedienweg: Business Keys in einem Feld „BusinessKeys" ==');
{
  /* Steht die Schreibvariante schon in der Datei, wird sie weiterbenutzt —
     ein zweites Feld daneben trüge dieselbe Sache zweimal. */
  api.loadYaml([
    'BusinessObjects:',
    '  Kelle:',
    '    Domain: Haushalt',
    '    BusinessKeys:',
    '    - KelleID',
    '    source_systems:',
    '    - Schublade',
    ''
  ].join('\n'), 'gross.yaml');
  api.setMode('komplett'); api.setView();
  if(!S.pflegeAn) S.pflegeAn = true;

  t('der vorhandene Business Key ist gelesen',
    S.model.objects.Kelle.keys.join(',') === 'KelleID',
    JSON.stringify(S.model.objects.Kelle.keys));
  t('das Formular lässt sich öffnen', formularOeffnen('o:Kelle'));
  t('und hat ihn vorbelegt', $('pfKeys').value === 'KelleID', $('pfKeys').value);

  $('pfKeys').value = 'KelleID, Kellennummer';
  dispatch($('pfSave'), 'click', {});

  t('der zweite Business Key steht im Modell',
    S.model.objects.Kelle.keys.join(',') === 'KelleID,Kellennummer',
    JSON.stringify(S.model.objects.Kelle.keys));
  t('geschrieben wird in das vorhandene Feld',
    /\n {4}BusinessKeys:\n {4}- KelleID\n {4}- Kellennummer\n/.test(S.yamlText), S.yamlText);
  t('und kein zweites Feld daneben', !/business_keys/.test(S.yamlText), S.yamlText);
}

console.log('== Bedienweg: Quellen im alten Feld „sources" ==');
{
  /* „source_systems" hat „sources" abgelöst. Eine ältere Datei wird weiter
     gelesen, und gepflegt wird in das Feld, das dasteht. */
  api.loadYaml([
    'BusinessObjects:',
    '  Sieb:',
    '    Domain: Haushalt',
    '    sources:',
    '    - Schublade',
    ''
  ].join('\n'), 'alt.yaml');
  api.setMode('komplett'); api.setView();
  if(!S.pflegeAn) S.pflegeAn = true;

  t('die vorhandene Quelle ist gelesen', S.model.objects.Sieb.sources.join(',') === 'Schublade',
    JSON.stringify(S.model.objects.Sieb.sources));
  t('das Formular lässt sich öffnen', formularOeffnen('o:Sieb'));
  $('pfSources').value = 'Schublade, Haken';
  dispatch($('pfSave'), 'click', {});

  t('die zweite Quelle steht im Modell', S.model.objects.Sieb.sources.join(',') === 'Schublade,Haken',
    JSON.stringify(S.model.objects.Sieb.sources));
  t('geschrieben wird in das vorhandene Feld',
    /\n {4}sources:\n {4}- Schublade\n {4}- Haken\n/.test(S.yamlText), S.yamlText);
  t('und kein zweites Feld daneben', !/source_systems/.test(S.yamlText), S.yamlText);
}

/* Entwurf wie im Formular, aber ohne Oberfläche: `extra` sind die
   eingeschalteten Zusatzattribute des Objekts. */
const entwurfAus = (o, aenderung)=> Object.assign({
  name:o.name, domain:o.domain || '', desc:o.desc || '', keys:o.keys.slice(), sources:o.sources.slice(),
  extra:{},
  attrs:o.attrs.map(a => Object.assign({}, a, {extra:Object.assign({}, a.extra), _alt:a})),
  rels:o.rels.map(r => Object.assign({}, r, {_alt:r}))
}, aenderung || {});
const willibald = require('fs').readFileSync(require('path').join(__dirname, '..', '..', 'models', 'willibald-attr.yaml'), 'utf8');
const block = (text, name)=>{
  const m = text.match(new RegExp('\\n  ' + name + ':\\n([\\s\\S]*?)(?=\\n  [^\\s]|$)'));
  return m ? m[1] : '';
};
const anzahl = (text, re)=> (text.match(re) || []).length;

console.log('== Lesen/Schreiben: Bestellung und Bestellung_VRS ==');
{
  const vorher = anzahl(willibald, /schema\.org:/g);
  const M = api.buildModel(willibald), o = M.objects.Bestellung;
  t('gelesen: genau die beiden Quellen', JSON.stringify(o.sources) === '["Bestellung","Bestellung_VRS"]',
    JSON.stringify(o.sources));
  t('„schema.org" steht als Zusatzattribut, nicht in den Quellen', o.extra['schema.org'] === ''
    && !o.sources.some(s => /schema/.test(s)), JSON.stringify(o.extra));

  t('unverändert gespeichert bleibt der Text Zeichen für Zeichen gleich',
    api.goObjektAendern(willibald, 'Bestellung', entwurfAus(o), o) === willibald);

  const pruefe = (titel, quellen)=>{
    const text = api.goObjektAendern(willibald, 'Bestellung', entwurfAus(o, {sources:quellen}), o);
    const neu = api.buildModel(text).objects.Bestellung;
    t(titel + ': gelesen wird, was geschrieben wurde', JSON.stringify(neu.sources) === JSON.stringify(quellen),
      JSON.stringify(neu.sources));
    t(titel + ': „schema.org" bleibt', anzahl(text, /schema\.org:/g) === vorher
      && /\n {4}schema\.org:/.test(block(text, 'Bestellung')), block(text, 'Bestellung'));
    t(titel + ': „schema.org" wird kein Quelleneintrag', neu.extra['schema.org'] === '');
    return text;
  };
  pruefe('Bestellung_VRS entfernt', ['Bestellung']);
  pruefe('Bestellung entfernt', ['Bestellung_VRS']);
  const leer = pruefe('beide entfernt', []);
  t('beide entfernt: kein „source_systems" mehr', !/source_systems:/.test(block(leer, 'Bestellung')), block(leer, 'Bestellung'));
  const dazu = pruefe('Bestellung_Neu ergänzt', ['Bestellung', 'Bestellung_VRS', 'Bestellung_Neu']);
  t('die neue Quelle steht vor „schema.org", nicht dahinter',
    /- Bestellung_VRS\n {4}- Bestellung_Neu\n {4}schema\.org:/.test(block(dazu, 'Bestellung')), block(dazu, 'Bestellung'));
}

const sonder = [
  'BusinessObjects:',
  '  A:',
  '    Domain: D',
  '    dq-regel: nie leer',
  '    quelle/system: SAP',
  '    fach_owner: Meier',
  '    schema.org: https://schema.org/Thing',
  '    source_systems:',
  '    - Q1',
  '    attributes:',
  '    - name: AID',
  '      type: int',
  '      schema.org: https://schema.org/identifier',
  '      herkunft:',
  '      - Q1',
  ''
].join('\n');

console.log('== Zusatzattribute: Sonderzeichen in Feldnamen ==');
{
  const M = api.buildModel(sonder), o = M.objects.A;
  t('alle vier Schlüssel sind als Zusatzattribute erkannt',
    [...M.zusatz.objekt.keys()].join(',') === 'dq-regel,quelle/system,fach_owner,schema.org',
    [...M.zusatz.objekt.keys()].join(','));
  t('die Werte sind gelesen', o.extra['quelle/system'] === 'SAP' && o.extra['schema.org'] === 'https://schema.org/Thing',
    JSON.stringify(o.extra));
  t('am Attribut ebenso, eine Liste wird nicht angeboten',
    [...M.zusatz.attribut.keys()].join(',') === 'schema.org', [...M.zusatz.attribut.keys()].join(','));

  const extra = {'dq-regel':'nie leer', 'quelle/system':'SAP ERP', fach_owner:'Meier', 'schema.org':'https://schema.org/Thing'};
  const text = api.goObjektAendern(sonder, 'A', entwurfAus(o, {extra}), o);
  t('geändert wird genau die eine Zeile', text === sonder.replace('quelle/system: SAP', 'quelle/system: SAP ERP'), text);

  const geleert = api.goObjektAendern(sonder, 'A', entwurfAus(o, {extra:Object.assign({}, extra, {fach_owner:''})}), o);
  t('geleert bleibt der Schlüssel als Platzhalter', /\n {4}fach_owner:\n/.test(geleert), geleert);

  const neu = api.goObjektAendern(sonder, 'A', entwurfAus(o, {extra:{'neu-feld':'x'}}), o);
  t('ein fehlendes Feld kommt ans Blockende', /\n {6}- Q1\n {4}neu-feld: x\n$/.test(neu), neu);
}

console.log('== Zusatzattribute: bleiben beim Neuschreiben eines Attributs ==');
{
  const o = api.buildModel(sonder).objects.A;
  const e = entwurfAus(o);
  e.attrs[0].type = 'bigint';
  const text = api.goObjektAendern(sonder, 'A', e, o);
  t('der Typ ist geändert', /type: bigint/.test(text), text);
  t('„schema.org" am Attribut bleibt (auch ausgeschaltet)', /\n {6}schema\.org: https:\/\/schema\.org\/identifier/.test(text), text);
  t('die Liste „herkunft" am Attribut ebenso', /\n {6}herkunft:\n {6}- Q1\n$/.test(text), text);
}

console.log('== Bedienweg: Zusatzattribute einschalten und pflegen ==');
{
  api.loadYaml(willibald, 'willibald-attr.yaml');
  api.setMode('komplett'); api.setView();
  if(!S.pflegeAn) S.pflegeAn = true;
  S.zusatzAn = {objekt:[], attribut:[]};

  dispatch($('btnEinst'), 'click', {});
  dispatch($('optZusatz'), 'click', {});
  t('„Zusatzattribute …" öffnet den Dialog', $('zusatzDlg').hidden === false);
  t('und schließt das Menü', !$('einstMenu').classList.contains('open'));
  const box = $('zusatzListe').querySelector('input[data-ebene="objekt"]');
  t('„schema.org" wird mit Anzahl angeboten', !!box && box.dataset.k === 'schema.org'
    && /an 11 Objekten/.test($('zusatzListe').textContent), $('zusatzListe').textContent);
  t('zunächst ausgeschaltet', box && !box.checked);
  box.checked = true;
  dispatch(box, 'change', {});
  t('Anhaken schaltet es ein', S.zusatzAn.objekt.join(',') === 'schema.org');
  dispatch($('zusatzZu'), 'click', {});
  t('„Schließen" schließt den Dialog', $('zusatzDlg').hidden === true);

  t('das Formular lässt sich öffnen', formularOeffnen('o:Bestellung'));
  const feld = detail().querySelector('.pfo-extra');
  t('es hat ein Feld „schema.org"', !!feld && feld.value === '');
  feld.value = 'https://schema.org/Order';
  dispatch($('pfSave'), 'click', {});
  t('der Wert steht im Modell', S.model.objects.Bestellung.extra['schema.org'] === 'https://schema.org/Order');
  t('und an seiner Stelle im Modelltext',
    /- Bestellung_VRS\n {4}schema\.org: https:\/\/schema\.org\/Order\n {4}attributes:/.test(block(S.yamlText, 'Bestellung')),
    block(S.yamlText, 'Bestellung'));
  t('die übrigen Platzhalter bleiben', anzahl(S.yamlText, /schema\.org:\s*\n/g) === 10);
  t('die Details zeigen den Wert', /https:\/\/schema\.org\/Order/.test(detail().textContent));

  const gemerkt = JSON.parse(win.localStorage.getItem('sitzung'));
  t('die Einstellung wird gemerkt', gemerkt.zusatzfelder && gemerkt.zusatzfelder.objekt.join(',') === 'schema.org');
  api.undo();
  t('Rückgängig nimmt die Bearbeitung zurück', !S.model.objects.Bestellung.extra['schema.org']);
  t('zunächst nicht die Einstellung', S.zusatzAn.objekt.join(',') === 'schema.org');
  api.undo();
  t('ein Schritt weiter auch die Einstellung', S.zusatzAn.objekt.length === 0, S.zusatzAn.objekt.join(','));
  api.redo(); api.redo();
  t('Wiederherstellen bringt beides zurück', S.zusatzAn.objekt.join(',') === 'schema.org'
    && S.model.objects.Bestellung.extra['schema.org'] === 'https://schema.org/Order');

  dispatch($('optZusatz'), 'click', {});
  const aus = $('zusatzListe').querySelector('input[data-k="schema.org"]');
  aus.checked = false;
  dispatch(aus, 'change', {});
  dispatch($('zusatzZu'), 'click', {});
  formularOeffnen('o:Bestellung');
  t('ausgeschaltet verschwindet das Feld aus dem Formular', !detail().querySelector('.pfo-extra'));
  dispatch($('pfSave'), 'click', {});
  t('der Wert bleibt in der Datei', /schema\.org: https:\/\/schema\.org\/Order/.test(S.yamlText));
}

console.log('== Bedienweg: Zusatzattribut an einem Attribut ==');
{
  api.loadYaml(sonder, 'sonder.yaml');
  api.setMode('komplett'); api.setView();
  S.zusatzAn = {objekt:[], attribut:[]};
  dispatch($('optZusatz'), 'click', {});
  const box = $('zusatzListe').querySelector('input[data-ebene="attribut"]');
  t('am Attribut wird „schema.org" angeboten', !!box && box.dataset.k === 'schema.org');
  box.checked = true;
  dispatch(box, 'change', {});
  dispatch($('zusatzZu'), 'click', {});
  formularOeffnen('o:A');
  const feld = detail().querySelector('.pfa-extra');
  t('die Attributzeile hat das Feld, vorbelegt', !!feld && feld.value === 'https://schema.org/identifier');
  feld.value = 'https://schema.org/productID';
  dispatch($('pfSave'), 'click', {});
  t('geschrieben wird am Attribut',
    /\n {6}schema\.org: https:\/\/schema\.org\/productID\n/.test(S.yamlText), S.yamlText);
  t('eine Liste am Attribut bleibt mit ihren Zeilen stehen', /\n {6}herkunft:\n {6}- Q1/.test(S.yamlText), S.yamlText);
  t('die Details zeigen den Wert', /productID/.test(detail().textContent));
}

finish();
})();
