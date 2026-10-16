/* Rauchtest: Sitzung, Dateien und Export — Dateinamen, PNG-Export,
   Exportschalter, Selbstständigkeit der HTML, Delta-Merge, kein Merken im
   Browser und Warnung beim Verlassen. */
const {bootApp, makeT} = require('./start');

(async ()=>{
const {S, api, win, document, svg, dispatch, FILE, html} = await bootApp();
const {t, finish} = makeT();

// Der Start steht in der Hierarchie (oberste Stufe); dieses Thema prüft die
// Komplettansicht und stellt sie darum ausdrücklich her.
api.setMode('komplett');

console.log('== Modellname oben links ==');
{
  const feld = document.getElementById('modellName');
  t('zum Start steht der Dateiname ohne Endung im Feld',
    feld.value === 'willibald-attr' && S.modellName === 'willibald-attr', feld.value);
  feld.value = '  Mein:Modell?  ';
  dispatch(feld, 'change', {});
  t('ein getippter Name gilt, ohne unzulässige Zeichen', S.modellName === 'MeinModell', S.modellName);
  t('das Feld zeigt den bereinigten Namen', feld.value === 'MeinModell', feld.value);
  feld.value = '  ';
  dispatch(feld, 'change', {});
  t('ein leerer Name gilt nicht', S.modellName === 'MeinModell' && feld.value === 'MeinModell', S.modellName);
  t('die Hierarchie heißt Name + _hier', api.uebersichtName() === 'MeinModell_hier.yaml', api.uebersichtName());
  // Ein gesicherter Stand bringt seinen Namen mit, auch wenn er vom Dateinamen abweicht
  const stand = Object.assign({yaml:S.yamlText, fileName:S.fileName, modellName:'Gesichert'}, api.layoutFile());
  await api.loadYaml(stand.yaml, stand.fileName, stand);
  t('der Stand bringt seinen Modellnamen mit', S.modellName === 'Gesichert' && feld.value === 'Gesichert', S.modellName);
  await api.loadYaml(stand.yaml, stand.fileName, Object.assign({}, stand, {modellName:undefined}));
  t('ohne Namen im Stand gilt der Dateiname', S.modellName === 'willibald-attr', S.modellName);
}

console.log('== PNG-Export: Maßstab wählbar, Größenlimit benannt ==');
{
  const scales = document.getElementById('menu').querySelectorAll('[data-act="png"][data-scale]');
  const werte = [...scales].map(b => b.dataset.scale).sort().join(',');
  t('Maßstäbe 1×/2×/4× im Menü', werte.includes('1') && werte.includes('2') && werte.includes('4'), werte);
  // Ein Knoten weit draußen macht die Fläche größer als das Canvas-Limit
  const n = S.graph.nodes.find(x => !x.hidden);
  const ox = n.x;
  n.x = 400000;
  const toastEl = document.getElementById('toast');
  toastEl.textContent = '';
  api.exportPNG(2);
  t('zu großes PNG wird benannt statt still zu scheitern', toastEl.textContent.includes('zu groß'),
    JSON.stringify(toastEl.textContent));
  n.x = ox;
}

console.log('== Absicherung: Exportschalter bleibt nicht hängen ==');
{
  api.exportSVG();                   // ein normaler Export …
  const nachher = document.getElementById('edges').querySelectorAll('.e-hit').length;
  t('Klickflächen nach Export wieder da', nachher > 0, nachher + '');
  t('Exportschalter aus', S.exporting === false);
}

console.log('== Keine externen Quellen ==');
{
  const roh = html;
  t('kein Google-Fonts-Verweis', !/fonts\.(googleapis|gstatic)\.com/.test(roh));
  const laden = roh.match(/<(link|script)\b[^>]*\b(href|src)="https?:\/\/[^"]+"/gi) || [];
  t('nichts wird nachgeladen', laden.length === 0, laden.join(' | '));
  t('Marken für die Schrifteinbettung vorhanden',
    roh.includes('/* SCHRIFTEN-ANFANG */') && roh.includes('/* SCHRIFTEN-ENDE */'));
  t('Zeichenfläche unterbindet Textmarkierung (user-select:none)',
    /#canvas\{[^}]*user-select:none/.test(roh));
}

console.log('== Delta-Geschäftsobjekte: ergänzen und zum Superset verschmelzen ==');
{
  const base  = 'BusinessObjects:\n  A:\n    Domain: D\n  B:\n    Domain: D\n';
  const delta = 'BusinessObjects:\n  B:\n    Domain: NEU\n  C:\n    Domain: D\n';
  const r = api.mergeGoText(base, delta);
  t('mergeGoText zählt neu und zusammengeführt', r && r.added === 1 && r.merged === 1,
    r ? `neu ${r.added}, zusammengeführt ${r.merged}` : 'null');
  t('Einzelwert: das Delta gewinnt', /B:\s*\n\s*Domain: NEU/.test(r.text), r && r.text);
  t('neues Objekt ist ergänzt', /\n\s*C:\s*\n\s*Domain: D/.test(r.text));

  // Superset: Quellen, Attribute und Beziehungen beider Fassungen bleiben —
  // genau der Fall zweier Modelle mit gleichnamigen Objekten. Die Einrückung
  // der Listen unterscheidet sich absichtlich (2 gegen 6 Leerzeichen).
  const b2 = [
    'BusinessObjects:',
    '  Kunde:',
    '    Domain: CRM',
    '    source_systems:',
    '    - Customer',
    '    attributes:',
    '    - name: KundeID',
    '      type: char(10)',
    '    relationships:',
    '    - to: Kontaktpunkt',
    '      name: besitzt',
    '    - to: Bestellung',
    '      name: tätigt'
  ].join('\n');
  const d2 = [
    'BusinessObjects:',
    '  Kunde:',
    '    Domain: SAP',
    '    source_systems:',
    '      - KNA1',
    '    attributes:',
    '      - name: Mandant',
    '        type: char(3)',
    '    relationships:',
    '      - to: Auftrag',
    '        name: erteilt',
    '      - to: Bestellung',
    '        name: erteilt1'
  ].join('\n');
  const s = api.mergeGoText(b2, d2);
  const yml = s.text;
  t('Superset: beide Quellen bleiben', /- Customer/.test(yml) && /- KNA1/.test(yml), yml);
  t('Superset: beide Attribute bleiben', /name: KundeID/.test(yml) && /name: Mandant/.test(yml));
  t('Superset: Beziehungen nur der Basis bleiben', /to: Kontaktpunkt/.test(yml));
  t('Superset: Beziehungen nur des Deltas kommen dazu', /to: Auftrag/.test(yml));
  // Gleiches Ziel, aber verschiedene Namen -> zwei eigenständige Beziehungen
  t('Superset: gleiches Ziel mit anderem Namen bleibt erhalten',
    /tätigt/.test(yml) && /erteilt1/.test(yml)
    && (yml.match(/to: Bestellung/g) || []).length === 2, yml);
  // Gleiches Ziel und gleicher Name -> eine Beziehung, das Delta gewinnt
  const gleich = api.mergeGoText(
    'BusinessObjects:\n  A:\n    relationships:\n    - to: B\n      name: hat\n      cardinality:\n        to: many\n  B:\n    Domain: D\n',
    'BusinessObjects:\n  A:\n    relationships:\n    - to: B\n      name: hat\n      cardinality:\n        to: zero_or_many\n');
  t('Superset: gleiches Ziel mit gleichem Namen wird nicht verdoppelt',
    (gleich.text.match(/to: B\b/g) || []).length === 1, gleich.text);
  t('Superset: dort gewinnt die Fassung des Deltas',
    /zero_or_many/.test(gleich.text) && !/to: many/.test(gleich.text), gleich.text);
  // end-to-end auf dem geladenen Modell (zuletzt, da es S.model verändert)
  const before = Object.keys(S.model.objects).length;
  const first = Object.keys(S.model.objects)[0];
  const altQuellen = S.model.objects[first].sources.slice();
  const altRels = S.model.objects[first].rels.length;
  api.loadDelta(`BusinessObjects:\n  ${first}:\n    Domain: DeltaDom\n    source_systems:\n    - DeltaQuelle\n  NeuObjekt:\n    Domain: DeltaDom\n    business_keys:\n    - K`);
  t('loadDelta fügt ein neues Objekt hinzu', !!S.model.objects.NeuObjekt);
  t('loadDelta übernimmt den neuen Einzelwert', S.model.objects[first].domain === 'DeltaDom');
  t('loadDelta behält die bisherigen Quellen und ergänzt die neue',
    altQuellen.every(q => S.model.objects[first].sources.includes(q))
    && S.model.objects[first].sources.includes('DeltaQuelle'),
    S.model.objects[first].sources.join(','));
  t('loadDelta behält die bisherigen Beziehungen', S.model.objects[first].rels.length === altRels,
    altRels + ' → ' + S.model.objects[first].rels.length);
  t('Objektzahl wächst genau um die neuen', Object.keys(S.model.objects).length === before + 1, before + ' → ' + Object.keys(S.model.objects).length);
}

console.log('== Delta-Geschäftsobjekte sind rückgängig machbar ==');
{
  // Ein Delta ist eine normale Aktion im Verlauf: Strg+Z nimmt es samt Modell
  // wieder heraus, Strg+Y bringt es zurück. Früher setzte loadDelta den
  // Verlauf zurück — das Delta war unumkehrbar.
  const vorher = Object.keys(S.model.objects).length;
  const altYaml = S.yamlText;
  api.loadDelta('BusinessObjects:\n  UndoProbe:\n    Domain: T\n    business_keys:\n    - K');
  t('Delta ergänzt das Objekt', Object.keys(S.model.objects).length === vorher + 1
    && !!S.model.objects.UndoProbe, Object.keys(S.model.objects).length + '');
  api.undo();
  t('Rückgängig entfernt das Delta wieder', Object.keys(S.model.objects).length === vorher
    && !S.model.objects.UndoProbe, Object.keys(S.model.objects).length + '');
  t('auch der Modelltext ist wieder der alte', S.yamlText === altYaml);
  api.redo();
  t('Wiederherstellen bringt das Delta zurück', !!S.model.objects.UndoProbe);
  api.undo();                                              // Endzustand: ohne Delta
  t('Objektliste zeigt wieder den alten Stand',
    document.getElementById('objectList').querySelectorAll('button[data-id]').length
      === S.graph.nodes.length, 'Listeneinträge');
}

console.log('== Die Datei zeigt nur, was in ihr steckt ==');
{
  /* Früher merkte sich der Browser die Sitzung — und weil sich bei file://
     alle lokalen HTML-Dateien einen Speicher teilen, zeigte eine frisch
     geöffnete Datei das Modell einer anderen. Jetzt gilt nur der eingebackene
     Stand (hier keiner, also das mitgelieferte Beispiel). */
  const mini = name => JSON.stringify({fileName:name, view:1,
    yaml:'BusinessObjects:\n  ' + name.replace('.yaml','') + ':\n    Domain: T\n'});
  const L = win.localStorage, Ss = win.sessionStorage;
  L.setItem('sitzung', mini('geteilt.yaml'));
  L.setItem('layouts:x.yaml', '{}');
  L.setItem('andere-app', 'bleibt');
  Ss.removeItem('sitzung');                    // ein neuer Tab hat noch keine eigene
  await api.boot();
  for(let k=0;k<50;k++) await Promise.resolve();
  t('Öffnen ignoriert die geteilte Sitzung', S.fileName === 'willibald-attr.yaml', 'fileName=' + S.fileName);

  Ss.setItem('sitzung', mini('tabeigen.yaml'));
  await api.boot();
  for(let k=0;k<50;k++) await Promise.resolve();
  t('Öffnen ignoriert die Tab-Sitzung', S.fileName === 'willibald-attr.yaml', 'fileName=' + S.fileName);

  const unsere = d => Object.keys(d).filter(k => k === 'sitzung' || k.startsWith('layouts:'));
  t('Reste älterer Fassungen werden beim Öffnen gelöscht',
    unsere(L._d).length === 0 && unsere(Ss._d).length === 0, unsere(L._d).concat(unsere(Ss._d)).join(','));
  t('fremde Schlüssel bleiben stehen', L.getItem('andere-app') === 'bleibt');

  const verlassen = ()=>{
    let gewarnt = false;
    const e = {preventDefault(){ gewarnt = true; }, returnValue: undefined};
    (win._hoerer.beforeunload || []).forEach(f => f(e));
    return gewarnt;
  };
  t('frisch geöffnet: keine Warnung beim Verlassen', !verlassen());
  api.setMode('komplett');
  t('das erste Umschalten ordnet an, gilt aber nicht als Änderung', !verlassen());

  let n = S.graph.nodes.find(x => !x.hidden);
  n.x += 80;
  api.persist();
  t('Arbeiten schreibt nichts in den Browser',
    unsere(L._d).length === 0 && unsere(Ss._d).length === 0, unsere(L._d).concat(unsere(Ss._d)).join(','));
  t('nach einer Änderung warnt das Verlassen', verlassen());
  api.undo();
  t('zurückgenommen bis zum Anfang: keine Warnung', !verlassen());

  n = S.graph.byId.get(n.id);                  // Rückgängig baut den Graphen neu
  n.x += 80;
  api.persist();
  t('die zweite Änderung warnt wieder', verlassen());
  // Das Mini-DOM verwirft <script>-Blöcke; den Platzhalter fürs Einbacken nachreichen
  if(!document.getElementById('bakedState')){
    const baked = document.createElement('script');
    baked.setAttribute('id', 'bakedState');
    baked.textContent = 'null';
    document.body.appendChild(baked);
  }
  win.showSaveFilePicker = async ()=>({name:'x.html',
    createWritable: async ()=>({write: async ()=>{}, close: async ()=>{}})});
  await api.speichernInDatei();
  delete win.showSaveFilePicker;
  t('nach „Stand speichern": keine Warnung', !verlassen());

  S.pflege = n.id;
  t('ein offenes Bearbeiten-Formular warnt', verlassen());
  S.pflege = null;

  // Ein bekanntes YAML bringt keine alten Positionen aus dem Browser mit
  L.setItem('layouts:probe.yaml', JSON.stringify({ansichten:{1:{'o:Probe':{x:777, y:555}}}}));
  await api.loadYaml('BusinessObjects:\n  Probe:\n    Domain: T\n', 'probe.yaml');
  const p = S.graph.byId.get('o:Probe');
  t('ein geladenes YAML übernimmt keine gemerkten Positionen', p && !(p.x === 777 && p.y === 555),
    p ? p.x + '/' + p.y : 'kein Knoten');
  L.removeItem('layouts:probe.yaml');
}

console.log('== Das Dateimenü löst die Aktionen aus ==');
{
  /* Die Funktionen dahinter sind geprüft — hier geht es um den Weg über die
     Knöpfe: dass jeder data-act beim Richtigen landet. Die erzeugten Downloads
     werden über document.createElement mitgeschrieben (downloadBlob hängt dafür
     ein <a> ins Dokument). */
  const geladen = [];
  const echtesElement = document.createElement;
  document.createElement = tag=>{
    const el = echtesElement(tag);
    if(tag === 'a') geladen.push(el);
    return el;
  };
  const letzter = ()=> geladen.length ? geladen[geladen.length-1].download : '(keiner)';
  const menu = document.getElementById('menu');
  const akt = a => [...menu.querySelectorAll('button')].find(b => b.dataset.act === a);

  // Auf und zu
  dispatch(document.getElementById('btnMenu'), 'click', {});
  t('der Knopf öffnet das Menü', menu.classList.contains('open'));
  t('und meldet den Zustand an die Hilfstechnik',
    document.getElementById('btnMenu').attrs['aria-expanded'] === 'true');
  dispatch(document.getElementById('btnMenu'), 'click', {});
  t('nochmal drücken schließt es', !menu.classList.contains('open'));

  // Laden: die Knöpfe reichen an das jeweilige Dateifeld weiter
  const gerufen = [];
  ['fileInput','deltaInput','uebersichtInput','layoutInput'].forEach(id =>
    document.getElementById(id).onclick = ()=> gerufen.push(id));
  akt('open').click();
  akt('openDelta').click();
  akt('loadUebersicht').click();
  akt('loadLayout').click();
  t('jeder Lade-Knopf öffnet sein eigenes Dateifeld',
    gerufen.join(',') === 'fileInput,deltaInput,uebersichtInput,layoutInput', gerufen.join(','));
  t('ein Lade-Knopf schließt das Menü', !menu.classList.contains('open'));

  // Speichern: jede Datei heißt nach dem Modellnamen, die Art steht im Zusatz
  const feld = document.getElementById('modellName');
  feld.value = 'Vertrieb';
  dispatch(feld, 'change', {});
  akt('saveGO').click();
  t('Geschäftsobjekte ohne Zusatz', letzter() === 'Vertrieb.yaml', letzter());
  akt('uebersicht').click();
  t('die Hierarchie mit _hier', letzter() === 'Vertrieb_hier.yaml', letzter());
  akt('layout').click();
  t('die Positionen mit _pos', letzter() === 'Vertrieb_pos.json', letzter());
  akt('saveQuellen').click();
  t('die Quelltabellen mit _quellen', letzter() === 'Vertrieb_quellen.yaml', letzter());
  akt('saveQuellDiagramme').click();
  t('die Quelltabellen-Hierarchie mit _quellhier', letzter() === 'Vertrieb_quellhier.yaml', letzter());
  akt('svg').click();
  t('der Diagramm-Export als Name.svg', letzter() === 'Vertrieb.svg', letzter());
}

console.log('== Stand in dieselbe Datei zurückschreiben ==');
{
  const geladen = [];
  const echtesElement = document.createElement;
  document.createElement = tag=>{
    const el = echtesElement(tag);
    if(tag === 'a') geladen.push(el);
    return el;
  };
  /* Das Mini-DOM wirft beim Einlesen alle <script>-Blöcke weg — der
     Platzhalter für den eingebackenen Stand fehlt deshalb und wird hier
     nachgereicht, sonst läuft das Sichern ins Leere. */
  let baked = document.getElementById('bakedState');
  if(!baked){
    baked = document.createElement('script');
    baked.setAttribute('id', 'bakedState');
    baked.setAttribute('type', 'application/json');
    baked.textContent = 'null';
    document.body.appendChild(baked);
  }
  const vorher = baked.textContent;
  const knopf = [...document.getElementById('menu').querySelectorAll('button')]
    .find(b => b.dataset.act === 'saveHtml');
  t('das Menü bietet „Stand speichern" unter SPEICHERN an', !!knopf);

  // 1) Browser mit Dateizugriff: es entsteht keine neue Datei, geschrieben wird
  //    in die gewählte — und zwar der ganze Stand samt Modelltext.
  let gefragt = null, geschrieben = null, geschlossen = false;
  win.showSaveFilePicker = async opt=>{
    gefragt = opt;
    return {name:'geschaeftsobjekt-explorer.html',
      createWritable: async ()=>({
        write: async txt=>{ geschrieben = txt; },
        close: async ()=>{ geschlossen = true; }
      })};
  };
  await api.speichernInDatei();
  t('der Dialog schlägt die geöffnete Datei vor',
    !!gefragt && /\.html?$/.test(gefragt.suggestedName || ''), gefragt && gefragt.suggestedName);
  t('geschrieben wird eine vollständige HTML', /^<!DOCTYPE html>/.test(geschrieben || ''),
    (geschrieben || '').slice(0, 30));
  t('der Modelltext steckt darin', (geschrieben || '').includes('BusinessObjects'));
  t('der Modellname ebenso', (geschrieben || '').includes('"modellName":"' + S.modellName + '"'), S.modellName);
  t('die Datei wird ordentlich geschlossen', geschlossen);
  t('dabei entsteht kein Download', geladen.length === 0, geladen.length + ' Downloads');
  t('der eingebackene Stand ist danach wieder wie zuvor', baked.textContent === vorher,
    baked.textContent.slice(0, 40));
  t('das Diagramm ist nach dem Sichern wieder gezeichnet',
    document.getElementById('nodes').querySelectorAll('.node').length > 0);
  t('die Objektliste ebenfalls',
    document.getElementById('objectList').innerHTML.length > 0);

  // 2) Abgebrochener Dialog schreibt nichts und meldet auch nichts als Fehler
  geschrieben = null;
  const toastEl = document.getElementById('toast');
  toastEl.textContent = '';
  win.showSaveFilePicker = async ()=>{ const e = new Error('abbruch'); e.name = 'AbortError'; throw e; };
  await api.speichernInDatei();
  t('ein abgebrochener Dialog schreibt nichts', geschrieben === null);
  t('und meldet keinen Fehler', toastEl.textContent === '', toastEl.textContent);

  // 3) Browser ohne Dateizugriff (Firefox, Safari, Sandkasten): Download wie bisher
  delete win.showSaveFilePicker;
  knopf.click();
  t('ohne Dateizugriff wird als Name.html heruntergeladen',
    (geladen.length && geladen[geladen.length-1].download) === S.modellName + '.html',
    geladen.length ? geladen[geladen.length-1].download : '(keine)');
  t('und das auch gemeldet', toastEl.textContent.includes('gesichert'), toastEl.textContent);
}

console.log('== Anordnung aus einer Datei übernehmen ==');
{
  /* Der Weg über das Dateifeld, nicht über adoptLayoutFile: eine kaputte Datei
     muss benannt werden, statt die Anordnung stillschweigend zu zerlegen. */
  const feld = document.getElementById('layoutInput');
  const laden = async text=>{
    feld.files = [{name:'positionen.json', text: ()=> Promise.resolve(text)}];
    dispatch(feld, 'change', {target: feld});
    for(let k = 0; k < 50; k++) await Promise.resolve();
  };
  const n = S.graph.nodes.find(x => !x.hidden);

  await laden('{kein json');
  t('eine kaputte Datei wird benannt',
    /lässt sich nicht lesen/.test(document.getElementById('toast').textContent),
    document.getElementById('toast').textContent);

  const stand = {ansichten:{1:{}, 2:{}, 3:{}}};
  stand.ansichten[S.view] = {[n.id]: {x: 777, y: 555}};
  await laden(JSON.stringify(stand));
  t('eine gültige Datei wird übernommen',
    /Positionsinformationen übernommen/.test(document.getElementById('toast').textContent),
    document.getElementById('toast').textContent);
  t('der Kasten steht auf der geladenen Position',
    S.graph.byId.get(n.id).x === 777 && S.graph.byId.get(n.id).y === 555,
    S.graph.byId.get(n.id).x + '/' + S.graph.byId.get(n.id).y);
}

console.log('== Dateien über die Dateifelder laden ==');
{
  /* Der Weg, den die Menüknöpfe anstoßen: das Feld meldet „change", die App
     liest die Datei. Geprüft wird für alle drei Felder, weil jedes an einer
     anderen Stelle im Zustand landet. */
  const fuettern = async (id, name, text)=>{
    const feld = document.getElementById(id);
    feld.files = [{name, text: ()=> Promise.resolve(text)}];
    dispatch(feld, 'change', {});
    for(let k = 0; k < 60; k++) await Promise.resolve();
  };

  await fuettern('fileInput', 'klein.yaml',
    'BusinessObjects:\n  Apfel:\n    domain: Obst\n    business_key: [Name]\n  Birne:\n    domain: Obst\n    business_key: [Name]\n');
  t('das geladene Modell ersetzt das alte',
    Object.keys(S.model.objects).join(',') === 'Apfel,Birne', Object.keys(S.model.objects).join(','));
  t('der Dateiname wird übernommen', S.fileName === 'klein.yaml', S.fileName);
  t('und wird zum Modellnamen', S.modellName === 'klein'
    && document.getElementById('modellName').value === 'klein', S.modellName);
  t('das Feld ist danach wieder leer', document.getElementById('fileInput').value === '');

  await fuettern('deltaInput', 'delta.yaml',
    'BusinessObjects:\n  Kirsche:\n    domain: Obst\n    business_key: [Name]\n');
  t('das Delta kommt zum geladenen Modell dazu',
    !!S.model.objects.Kirsche && !!S.model.objects.Apfel,
    Object.keys(S.model.objects).join(','));

  await fuettern('uebersichtInput', 'hierarchie.yaml',
    'Obstkorb:\n  objekte:\n    - Apfel\n    - Birne\n');
  t('die geladene Hierarchiebeschreibung steht im Baum',
    S.outline && S.outline.roots.length === 1 && S.outline.roots[0].name === 'Obstkorb',
    S.outline && S.outline.roots.map(r => r.name).join(','));
}

console.log('== Eine Datei auf die Zeichenfläche ablegen ==');
{
  const wrap = document.getElementById('canvasWrap');
  const dz = document.getElementById('dropzone');
  dispatch(wrap, 'dragenter', {dataTransfer:{files:[]}});
  t('beim Hereinziehen erscheint die Ablegefläche', dz.classList.contains('on'));
  dispatch(wrap, 'dragleave', {dataTransfer:{files:[]}});
  t('beim Hinausziehen verschwindet sie wieder', !dz.classList.contains('on'));

  dispatch(wrap, 'dragenter', {dataTransfer:{files:[]}});
  dispatch(wrap, 'drop', {dataTransfer:{files:[{name:'abgelegt.yaml',
    text: ()=> Promise.resolve('BusinessObjects:\n  Zwetschge:\n    domain: Obst\n    business_key: [Name]\n')}]}});
  for(let k = 0; k < 60; k++) await Promise.resolve();
  t('die abgelegte Datei wird geladen', !!S.model.objects.Zwetschge,
    Object.keys(S.model.objects).join(','));
  t('und die Ablegefläche ist wieder weg', !dz.classList.contains('on'));
}

console.log('== PNG-Export bis zum Bild ==');
{
  /* Das Größenlimit ist weiter oben geprüft; hier läuft der andere Zweig durch
     bis zum Bild. Das Zeichnen auf die Leinwand selbst bleibt außen vor — dafür
     fehlt dem Mini-DOM die Grundlage. */
  const toast = ()=> document.getElementById('toast').textContent;
  const vorher = toast();
  [...document.getElementById('menu').querySelectorAll('button')]
    .find(b => b.dataset.act === 'png' && (b.dataset.scale === '1' || !b.dataset.scale)).click();
  t('ein PNG in normaler Größe wird nicht abgelehnt',
    !/zu groß|fehlgeschlagen/.test(toast()), toast() || vorher);
}

console.log('== Eine Datei, die kein Modell ist ==');
{
  /* Greift jemand zur falschen Datei, muss das benannt werden — und der bisher
     geladene Stand stehen bleiben. */
  const feld = document.getElementById('fileInput');
  const vorher = Object.keys(S.model.objects).join(',');
  const name = S.fileName;
  feld.files = [{name:'notizen.txt', text: ()=> Promise.resolve('einfach nur Text ohne Doppelpunkt\n')}];
  dispatch(feld, 'change', {});
  for(let k = 0; k < 60; k++) await Promise.resolve();

  t('die Datei wird als unlesbar gemeldet',
    /Datei nicht lesbar/.test(document.getElementById('toast').textContent),
    document.getElementById('toast').textContent);
  t('und der Grund steht dabei',
    /BusinessObjects/.test(document.getElementById('toast').textContent),
    document.getElementById('toast').textContent);
  t('das bisherige Modell bleibt stehen',
    Object.keys(S.model.objects).join(',') === vorher, Object.keys(S.model.objects).join(','));
  t('auch der Dateiname bleibt der alte', S.fileName === name, S.fileName);
}

console.log('== Delta-Merge bringt einen Block auf die Einrückung der Basis ==')
{
  /* Zwei Modelle, dieselbe Struktur, verschiedene Einrückung — beim
     Zusammenführen muss der übernommene Block auf die Einrückung der Basis
     gebracht werden, sonst steht er im Ergebnis schief und ist kein gültiges
     YAML mehr. */
  const basis = 'BusinessObjects:\n  Alt:\n    domain: D\n    business_key: [Nr]\n';
  const delta = 'BusinessObjects:\n        Neu:\n            domain: D\n            business_key: [Nr]\n';
  const r = api.mergeGoText(basis, delta);
  t('der Block wird als neu gezählt', r && r.added === 1, JSON.stringify(r && {a:r.added, m:r.merged}));
  const zeile = r.text.split('\n').find(l => /Neu:/.test(l));
  t('er sitzt in der Einrückung der Basis', zeile === '  Neu:', JSON.stringify(zeile));
  // der Block wandert als Ganzes: seine Felder bleiben tiefer als seine Kopfzeile
  const feld = r.text.slice(r.text.indexOf('Neu:')).split('\n').find(l => /domain: D/.test(l));
  t('seine Felder rücken als Ganzes mit', /^ {3,}domain: D$/.test(feld || ''), JSON.stringify(feld));
  t('beide Objekte stehen danach auf derselben Ebene',
    r.text.includes('\n  Alt:') && r.text.includes('\n  Neu:'), r.text);
}

console.log('== Jede gespeicherte YAML ist einheitlich ==');
{
  const blobs = [];
  const echt = win.URL.createObjectURL;
  win.URL.createObjectURL = b => { blobs.push(b); return 'blob:x'; };
  const text = () => blobs.length ? blobs[blobs.length - 1].teile.join('') : '';
  const knopf = a => [...document.getElementById('menu').querySelectorAll('button')].find(b => b.dataset.act === a);

  const go = "BusinessObjects:\n  A:\n    Domain: D\n    desc: kurz\n    x: 'a'\n";
  await api.loadYaml(go, 'einheitlich.yaml');
  api.setMode('komplett');
  knopf('saveGO').click();
  t('heruntergeladene Modell-YAML: Beschreibung als Block, Text schlicht',
    text().includes('    desc: |\n      kurz\n') && text().includes('    x: a\n'), text());
  t('der Arbeitstext in der App bleibt unverändert', S.yamlText === go, S.yamlText);

  api.loadQuellen("SourceTables:\n  S:\n    T:\n      desc: 'eins\n\n        zwei'\n      Domain: D\n", 'q.yaml');
  S.quellenAn = true;
  knopf('saveQuellen').click();
  t('heruntergeladene Quelltabellen-YAML: mehrzeilige Beschreibung als Block',
    text().includes('      desc: |\n        eins\n        zwei\n'), text());

  let baked = document.getElementById('bakedState');
  if(!baked){
    baked = document.createElement('script');
    baked.setAttribute('id', 'bakedState');
    baked.setAttribute('type', 'application/json');
    baked.textContent = 'null';
    document.body.appendChild(baked);
  }
  const html = api.standAlsHtml();
  const m = html.match(/id="bakedState"[^>]*>([\s\S]*?)<\/script>/);
  const stand = m ? JSON.parse(m[1]) : {};
  t('„Stand speichern" bettet die einheitlichen Texte ein',
    String(stand.yaml).includes('desc: |\n      kurz') && String(stand.quellYaml).includes('desc: |\n        eins'),
    m ? m[1].slice(0, 200) : html.slice(0, 200));
  win.URL.createObjectURL = echt;
}

console.log('== Projektordner: alle Dateien auf einmal laden und speichern ==');
{
  /* Ein nachgebauter Ordner-Handle wie aus showDirectoryPicker: values()
     liefert die Dateien, getFileHandle schreibt in denselben Inhalt zurück. */
  const ordnerAttrappe = (name, inhalt = {})=>({
    name, kind:'directory', inhalt,
    async *values(){
      for(const n of Object.keys(inhalt))
        yield {kind:'file', name:n, getFile: async ()=>({text: async ()=> inhalt[n]})};
    },
    async getFileHandle(n){
      return {createWritable: async ()=>{
        let puffer = '';
        return {write: async x=>{ puffer += x; }, close: async ()=>{ inhalt[n] = puffer; }};
      }};
    }
  });
  const warten = async ()=>{ for(let k = 0; k < 80; k++) await Promise.resolve(); };
  const toastText = ()=> document.getElementById('toast').textContent;
  const verlassen = ()=>{
    let gewarnt = false;
    (win._hoerer.beforeunload || []).forEach(f => f({preventDefault(){ gewarnt = true; }}));
    return gewarnt;
  };
  const menu = document.getElementById('menu');
  const akt = a => [...menu.querySelectorAll('button')].find(b => b.dataset.act === a);
  const strgS = ()=> dispatch(document.body, 'keydown', {key:'s', ctrlKey:true});

  // Strg+S ohne Projektordner bleibt beim Sichern in die HTML
  let htmlGefragt = 0;
  win.showSaveFilePicker = async ()=>{ htmlGefragt++; const e = new Error('abbruch'); e.name = 'AbortError'; throw e; };
  strgS(); await warten();
  t('Strg+S ohne Projektordner sichert in die HTML', htmlGefragt === 1, htmlGefragt + '');
  t('das Menü bietet beide Projektpunkte an', !!akt('projektOeffnen') && !!akt('projektSpeichern'));

  // Ein Stand mit allem: Modell, Hierarchie mit einer Lage im Diagramm, Quelltabellen
  await api.loadYaml('BusinessObjects:\n  Apfel:\n    Domain: Obst\n  Birne:\n    Domain: Obst\n', 'obst.yaml');
  api.loadUebersicht('Korb:\n  objekte:\n    - Apfel\n    - Birne\n');
  api.loadQuellen('SourceTables:\n  S:\n    T:\n      Domain: Obst\n', 'q.yaml');
  S.quellenAn = true;
  api.setMode('hierarchie');
  const n = S.graph.nodes.find(x => !x.hidden);
  n.x += 120;
  api.persist();
  const lage = JSON.stringify(S.bereiche.hierarchie.hierSaved);
  t('Vorbereitung: eine Lage im Diagramm ist gespeichert', lage.includes(n.id), lage);

  // Was die Einzelknöpfe herunterladen, zum Vergleich
  const blobs = [];
  const echt = win.URL.createObjectURL;
  win.URL.createObjectURL = b => { blobs.push(b); return 'blob:x'; };
  const einzeln = a => { akt(a).click(); return blobs[blobs.length - 1].teile.join(''); };
  const goEinzeln = einzeln('saveGO'), hierEinzeln = einzeln('uebersicht');
  const quellEinzeln = einzeln('saveQuellen'), quellhierEinzeln = einzeln('saveQuellDiagramme');
  win.URL.createObjectURL = echt;

  // Chrome/Edge: das erste Speichern fragt nach dem Ordner
  const ordner = ordnerAttrappe('repo');
  let gefragt = 0, vorschlag = 'keiner';
  win.showDirectoryPicker = async opt=>{ gefragt++; vorschlag = opt.startIn; return ordner; };
  await api.projektSpeichern();
  const namen = Object.keys(ordner.inhalt).sort().join(',');
  t('ohne offenen Ordner wird einmal nach ihm gefragt', gefragt === 1, gefragt + '');
  t('ohne bisherigen Ordner gibt es keinen Vorschlag', vorschlag === undefined, String(vorschlag));
  t('alle fünf Dateien heißen nach dem Modellnamen',
    namen === 'obst.yaml,obst_hier.yaml,obst_pos.json,obst_quellen.yaml,obst_quellhier.yaml', namen);
  const pos = JSON.parse(ordner.inhalt['obst_pos.json']);
  t('die _pos.json trägt die Diagrammtexte nicht doppelt',
    !('uebersichtText' in pos) && !('uebersichtText' in pos.quelltabellen), Object.keys(pos).join(','));
  t('die _pos.json trägt die Lagen der Diagramme', JSON.stringify(pos.hierarchie.anordnung) === lage);
  t('die Inhalte gleichen denen der Einzelknöpfe',
    ordner.inhalt['obst.yaml'] === goEinzeln && ordner.inhalt['obst_hier.yaml'] === hierEinzeln
    && ordner.inhalt['obst_quellen.yaml'] === quellEinzeln && ordner.inhalt['obst_quellhier.yaml'] === quellhierEinzeln);
  t('der einzelne Positionen-Knopf behält die Diagrammtexte', 'uebersichtText' in api.layoutFile());
  t('danach gilt der Stand als gesichert', !verlassen());
  t('die Meldung nennt den Ordner', /5 Dateien in repo gespeichert/.test(toastText()), toastText());

  // Weiter im selben Ordner: Strg+S fragt wieder, mit dem offenen Ordner als Vorschlag
  S.graph.byId.get(n.id).x += 40;
  api.persist();
  t('eine Änderung warnt beim Verlassen', verlassen());
  vorschlag = 'keiner';
  strgS(); await warten();
  t('Strg+S speichert ins Projekt, nicht in die HTML', gefragt === 2 && htmlGefragt === 1,
    `Ordner ${gefragt}, HTML ${htmlGefragt}`);
  t('der Dialog schlägt den offenen Ordner vor', vorschlag === ordner, String(vorschlag && vorschlag.name));
  t('und gilt danach als gesichert', !verlassen());
  const gespeichert = Object.assign({}, ordner.inhalt);

  // Rundreise: ein anderes Modell, dann den Ordner wieder öffnen
  await api.loadYaml('BusinessObjects:\n  Fremd:\n    Domain: X\n', 'fremd.yaml');
  vorschlag = 'keiner';
  await api.projektOeffnen();
  t('das Öffnen fragt nach dem Ordner', gefragt === 3, gefragt + '');
  t('und schlägt den bisherigen vor', vorschlag === ordner, String(vorschlag && vorschlag.name));
  t('das Modell kommt aus dem Ordner', Object.keys(S.model.objects).includes('Apfel') && S.modellName === 'obst',
    Object.keys(S.model.objects).join(',') + ' / ' + S.modellName);
  t('die Hierarchie ebenso', S.bereiche.hierarchie.outlineText.includes('Korb'));
  const lageGespeichert = JSON.stringify(JSON.parse(gespeichert['obst_pos.json']).hierarchie.anordnung);
  t('die Lagen im Diagramm bleiben erhalten (auch die nach Strg+S)',
    JSON.stringify(S.bereiche.hierarchie.hierSaved) === lageGespeichert && lageGespeichert !== lage,
    JSON.stringify(S.bereiche.hierarchie.hierSaved));
  t('die Quelltabellen ebenso', S.quellenAn && /T:/.test(S.quellText), S.quellText);
  t('frisch geladen: keine Warnung beim Verlassen', !verlassen());
  t('die Meldung nennt, was geladen wurde', /Projekt repo: .*_hier, _pos, _quellen, _quellhier/.test(toastText()), toastText());
  await api.projektSpeichern();
  const geaendert = Object.keys(gespeichert).filter(k => gespeichert[k] !== ordner.inhalt[k]);
  t('erneutes Speichern ändert keine Datei', geaendert.length === 0
    && Object.keys(ordner.inhalt).length === Object.keys(gespeichert).length, geaendert.join(','));

  // Der Projektordner lässt sich beim Speichern wechseln
  const anderer = ordnerAttrappe('kopie');
  win.showDirectoryPicker = async opt=>{ vorschlag = opt.startIn; return anderer; };
  await api.projektSpeichern();
  t('beim Speichern lässt sich ein anderer Ordner wählen',
    Object.keys(anderer.inhalt).sort().join(',') === Object.keys(gespeichert).sort().join(',')
    && /in kopie gespeichert/.test(toastText()), Object.keys(anderer.inhalt).join(',') + ' / ' + toastText());
  await api.projektSpeichern();
  t('danach ist er der Vorschlag', vorschlag === anderer, String(vorschlag && vorschlag.name));

  // Taugt der Vorschlag nicht mehr als Startpunkt, geht der Dialog ohne ihn auf
  const versuche = [];
  win.showDirectoryPicker = async opt=>{
    versuche.push(opt.startIn);
    if(opt.startIn) throw new TypeError('startIn nicht erreichbar');
    return ordner;
  };
  await api.projektSpeichern();
  t('ein unbrauchbarer Vorschlag: zweiter Versuch ohne ihn',
    versuche.length === 2 && versuche[0] === anderer && versuche[1] === undefined
    && /in repo gespeichert/.test(toastText()), versuche.length + ' / ' + toastText());
  win.showDirectoryPicker = async opt=>{ vorschlag = opt.startIn; return ordner; };

  // Ein neuer Modellname: neue Dateien, und der Hinweis auf die alten
  const feld = document.getElementById('modellName');
  feld.value = 'obst2';
  dispatch(feld, 'change', {});
  await api.projektSpeichern();
  t('nach neuem Namen entstehen die Dateien unter ihm', 'obst2.yaml' in ordner.inhalt);
  t('und die Meldung nennt die alten', /obst\.yaml — bitte entfernen/.test(toastText()), toastText());

  // Falsche Ordner werden abgelehnt, der Stand bleibt
  const vorher = S.yamlText;
  win.showDirectoryPicker = async ()=> ordnerAttrappe('zwei', {'a.yaml':'BusinessObjects:\n  A:\n    Domain: D\n',
    'b.yaml':'BusinessObjects:\n  B:\n    Domain: D\n'});
  await api.projektOeffnen();
  t('zwei Geschäftsobjekt-Dateien ohne Positionen: nichts geladen', S.yamlText === vorher
    && /Mehrere Geschäftsobjekt-Dateien im Ordner: a\.yaml, b\.yaml/.test(toastText()), toastText());
  win.showDirectoryPicker = async ()=> ordnerAttrappe('falsch', {'a.yaml':'BusinessObjects:\n  A:\n    Domain: D\n',
    'a_hier.yaml':'BusinessObjects:\n  X:\n    Domain: D\n'});
  await api.projektOeffnen();
  t('eine falsche _hier.yaml: nichts geladen, mit Grund', S.yamlText === vorher
    && /a_hier\.yaml nicht geladen: Das ist eine Geschäftsobjekt-Datei/.test(toastText()), toastText());
  win.showDirectoryPicker = async ()=> ordnerAttrappe('eindeutig', {'a.yaml':'BusinessObjects:\n  A:\n    Domain: D\n',
    'a_pos.json':'{}', 'b.yaml':'BusinessObjects:\n  B:\n    Domain: D\n'});
  await api.projektOeffnen();
  t('mehrere, aber nur eine mit Positionen: die wird geladen',
    S.modellName === 'a' && !!S.model.objects.A, S.modellName);
  win.showDirectoryPicker = async ()=> { const e = new Error('abbruch'); e.name = 'AbortError'; throw e; };
  const a = S.yamlText;
  await api.projektOeffnen();
  t('ein abgebrochener Ordnerdialog ändert nichts', S.yamlText === a);

  // Firefox/Safari: kein showDirectoryPicker — Ordner lesen über das Dateifeld, Speichern lädt herunter
  delete win.showDirectoryPicker;
  const projektFeld = document.getElementById('projektInput');
  let feldGeklickt = 0;
  projektFeld.onclick = ()=> feldGeklickt++;
  akt('projektOeffnen').click();
  t('ohne Ordnerzugriff öffnet „Projektordner öffnen" das Ordner-Dateifeld', feldGeklickt === 1, feldGeklickt + '');
  t('das Feld wählt einen ganzen Ordner', 'webkitdirectory' in projektFeld.attrs);
  projektFeld.files = Object.entries(gespeichert).map(([name, text]) =>
    ({name, webkitRelativePath:'repo/' + name, text: ()=> Promise.resolve(text)}))
    .concat([{name:'alt.yaml', webkitRelativePath:'repo/archiv/alt.yaml',
      text: ()=> Promise.resolve('BusinessObjects:\n  Alt:\n    Domain: D\n')}]);
  dispatch(projektFeld, 'change', {});
  await warten();
  t('der gelesene Ordner wird geladen, Unterordner zählen nicht',
    S.modellName === 'obst' && !!S.model.objects.Apfel && /Projekt repo:/.test(toastText()), toastText());
  t('auch hier bleiben die Lagen im Diagramm erhalten',
    JSON.stringify(S.bereiche.hierarchie.hierSaved) === lageGespeichert);

  const geladen = [];
  const echtesElement = document.createElement;
  document.createElement = tag=>{ const el = echtesElement(tag); if(tag === 'a') geladen.push(el); return el; };
  S.graph.byId.get(n.id).x += 40;
  api.persist();
  strgS(); await warten();
  document.createElement = echtesElement;
  t('Strg+S lädt dann alle Projektdateien herunter',
    geladen.map(x => x.download).sort().join(',') === Object.keys(gespeichert).sort().join(','),
    geladen.map(x => x.download).join(','));
  t('und sagt, wohin sie gehören', /Download-Ordner/.test(toastText()), toastText());
  t('danach gilt der Stand als gesichert', !verlassen());
  delete win.showSaveFilePicker;
}

finish();
})();
