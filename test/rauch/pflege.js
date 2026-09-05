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
    '    sources:',
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
  t('der Knopf in der Kopfzeile öffnet den Dialog', $('einstDlg').hidden === false);
  t('der Schalter steht auf dem gemerkten Stand', $('einstPflege').checked === false);
  $('einstPflege').checked = true;
  dispatch($('einstPflege'), 'change', {});
  t('Umlegen schaltet die Pflege ein', S.pflegeAn === true);
  t('„＋ Objekt" ist jetzt da', $('objNew').hidden === false);
  t('die Details zeigen „Bearbeiten"', !!detail().querySelector('[data-edit]'));
  dispatch($('einstZu'), 'click', {});
  t('„Schließen" schließt den Dialog', $('einstDlg').hidden === true);

  // Die Einstellung ist keine Aktion am Modell: Strg+Z darf sie nicht mitnehmen.
  api.undo(); api.undo();
  t('Rückgängig schaltet die Pflege nicht wieder ab', S.pflegeAn === true);
  api.redo(); api.redo();
}

console.log('== Ausschalten schließt ein offenes Formular ==');
{
  formularOeffnen('o:Bestellung');
  dispatch($('btnEinst'), 'click', {});
  $('einstPflege').checked = false;
  dispatch($('einstPflege'), 'change', {});
  t('das Formular ist zu', !$('pfName'));
  t('und der „Bearbeiten"-Knopf verschwunden', !detail().querySelector('[data-edit]'));
  $('einstPflege').checked = true;
  dispatch($('einstPflege'), 'change', {});
  dispatch($('einstZu'), 'click', {});
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
  api.setMode('komplett'); api.setView(1);   // umbenannt wird in der Komplettansicht

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

finish();
})();
