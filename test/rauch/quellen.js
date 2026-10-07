/* Rauchtest: die Ebene der Quelltabellen. Ein Schalter „Quelltabellen
   verwenden" (Vorgabe aus) gibt den Bereich frei; dort ein Baum wie die
   Hierarchie mit einem Diagramm je Quellsystem und frei angelegten
   Gegenüberstellungen, das Geschäftsobjekt als eigenes Element (einmal je
   Diagramm) und die Pflege über „Quelltabellen bearbeiten". */
const {bootApp, makeT} = require('./start');

(async ()=>{
const {S, api, document, dispatch} = await bootApp();
const {t, finish} = makeT();

const $ = id => document.getElementById(id);
const klick = el => dispatch(typeof el === 'string' ? $(el) : el, 'click', {});
const modusKnopf = m => document.querySelector(`.mode-btn[data-mode="${m}"]`);
const sichtbar = ()=> S.graph.nodes.filter(n => !n.hidden);
const namen = liste => liste.map(n => n.name).sort().join(',');
const menu = $('menu');
const akt = a => [...menu.querySelectorAll('button')].find(b => b.dataset.act === a);
const detail = ()=> $('detailBody');
const formularOeffnen = id =>{
  api.setSelection([id]);
  const b = detail().querySelector('[data-edit]');
  if(b) klick(b);
  return !!$('pfName');
};
const warte = async ()=>{ for(let k = 0; k < 60; k++) await Promise.resolve(); };

console.log('== Vorgabe: ausgeschaltet ==');
{
  t('der Schalter ist aus', S.quellenAn === false && $('optQuellen').getAttribute('aria-checked') === 'false');
  t('alles zu den Quelltabellen ist verborgen', !document.body.classList.contains('quellen-an'));
  t('Modus-Knopf, Dateien und Schalter tragen die Klasse dafür',
    modusKnopf('quellen').classList.contains('nur-quellen')
    && ['openQuellen','loadQuellDiagramme','saveQuellen','saveQuellDiagramme'].every(a => akt(a) && akt(a).classList.contains('nur-quellen'))
    && $('optQuellPflege').classList.contains('nur-quellen') && $('optGO').classList.contains('nur-quellen'));
  api.setMode('quellen');
  t('ohne Schalter führt der Modus in die Hierarchie', S.mode === 'hierarchie', S.mode);
  t('die Positionsinformationen tragen den Schalter mit', api.layoutFile().quelltabellen.an === false);
}

console.log('== Einschalten ==');
{
  klick('optQuellen');
  t('der Haken ist gesetzt', S.quellenAn && $('optQuellen').getAttribute('aria-checked') === 'true');
  t('der Bereich ist eingeblendet', document.body.classList.contains('quellen-an'));
  api.undo();
  t('Strg+Z schaltet wieder aus', !S.quellenAn && !document.body.classList.contains('quellen-an'));
  api.redo();
  t('Strg+Y wieder ein', S.quellenAn && document.body.classList.contains('quellen-an'));
}

console.log('== Bereich öffnen: je Quellsystem ein Diagramm ==');
{
  klick(modusKnopf('quellen'));
  t('der Modus wechselt', S.mode === 'quellen' && modusKnopf('quellen').getAttribute('aria-selected') === 'true');
  t('Baum und Werkzeugleiste stehen da', !$('hierTree').hidden && !$('hierTools').hidden);
  t('„＋ Domäne" heißt hier „＋ Diagramm"',
    $('hierTools').querySelector('[data-hact="add-top"]').textContent === '＋ Diagramm');
  const baum = $('hierTree').innerHTML;
  t('der Baum zeigt Quellsysteme, Referenzdaten, Roadshow, Webshop',
    ['Quellsysteme','Referenzdaten','Roadshow','Webshop'].every(n => baum.includes('>' + n + '<')), baum.slice(0, 200));
  t('gewählt ist „Quellsysteme" mit allen 13 Tabellen', S.hierSel === 'Quellsysteme' && sichtbar().length === 13,
    S.hierSel + ' / ' + sichtbar().length);
  klick(document.querySelector('.dnode[data-id="Quellsysteme›Roadshow"]'));
  t('Roadshow zeigt genau seine Tabellen', namen(sichtbar()) === 'Bestellung_VRS,Position_VRS,VereinsPartner', namen(sichtbar()));
  t('die Objektliste gruppiert nach Quellsystem', /ROADSHOW/.test($('objectList').innerHTML) && /WEBSHOP/.test($('objectList').innerHTML));
  t('die Prüfung ist da und gilt den Tabellen',
    /Kategorie/.test($('msgList').innerHTML) && !/keine Quelle/.test($('msgList').innerHTML));
  api.setSelection(['o:Bestellung_VRS']);
  t('die Details nennen Quellsystem und Geschäftsobjekt',
    /QUELLTABELLE/.test(detail().innerHTML) && /Roadshow/.test(detail().innerHTML) && /Bestellung/.test(detail().innerHTML));
  S.filter = 'webshop'; api.draw();
  t('die Suche trifft das Quellsystem', $('searchHits').textContent === '0/3', $('searchHits').textContent);
  S.filter = ''; api.draw();
}

console.log('== Automatische Diagramme sind geschützt ==');
{
  global.prompt = ()=> global.__antwort;
  global.confirm = ()=> true;
  api.selectDiagram('Quellsysteme›Webshop');
  global.__antwort = 'Anders';
  api.hierAction('rename');
  t('Umbenennen geht nicht', !!S.outline.roots[0].kinder.find(k => k.id === 'Quellsysteme›Webshop'));
  api.hierAction('delete');
  t('Löschen geht nicht', S.outline.roots[0].kinder.length === 3);
  api.hierAction('add-child');
  t('kein Unterdiagramm darunter', S.outline.roots[0].kinder.every(k => !k.kinder.length));
  global.__antwort = 'Quellsysteme';
  api.hierAction('add-top');
  t('der Name „Quellsysteme" ist vergeben', S.outline.roots.filter(r => r.name === 'Quellsysteme').length === 1);
}

console.log('== Eigenes Diagramm: Gegenüberstellung ==');
{
  global.__antwort = 'Bestellung Webshop/Roadshow';
  klick($('hierTools').querySelector('[data-hact="add-top"]'));
  t('das Diagramm ist angelegt und gewählt', S.hierSel === 'Bestellung Webshop/Roadshow', S.hierSel);
  t('es ist leer', sichtbar().length === 0);
  ['o:Bestellung', 'o:Bestellung_VRS'].forEach(id=>{
    const c = $('objectList').querySelector(`.ochk[data-id="${id}"]`);
    c.checked = true; dispatch(c, 'change', {});
  });
  t('über die Liste kommen Tabellen aus zwei Systemen hinein', namen(sichtbar()) === 'Bestellung,Bestellung_VRS', namen(sichtbar()));
  const lage = S.hierSaved[S.hierSel] || {};
  t('ihre Anordnung ist gemerkt', lage['o:Bestellung'] && lage['o:Bestellung_VRS']);
  const yaml = api.quellDiagrammeYaml();
  t('die Diagramm-YAML enthält es mit „tabellen:"',
    /^Bestellung Webshop\/Roadshow:/m.test(yaml) && /tabellen:\n {4}- Bestellung\n {4}- Bestellung_VRS/.test(yaml), yaml);
  t('aber nicht die Diagramme der Quellsysteme', !/Quellsysteme|Webshop:/.test(yaml));
  t('die Hierarchie bleibt unberührt', !/Bestellung Webshop/.test(S.bereiche.hierarchie.outlineText || ''));
}

console.log('== Geschäftsobjekt als eigenes Element ==');
{
  klick('optGO');
  t('der Haken ist gesetzt', $('optGO').getAttribute('aria-checked') === 'true');
  const g = S.graph.nodes.filter(n => n.kind === 'gobj' && !n.hidden);
  t('Bestellung genau einmal im Diagramm', g.length === 1 && g[0].id === 'g:Bestellung', g.map(n => n.id).join(','));
  const k = S.graph.edges.filter(e => e.kind === 'go' && e.to === 'g:Bestellung');
  t('verbunden mit beiden Tabellen', k.map(e => e.from).sort().join(',') === 'o:Bestellung,o:Bestellung_VRS', k.map(e => e.from).join(','));
  const tab = ['o:Bestellung', 'o:Bestellung_VRS'].map(id => S.graph.byId.get(id));
  t('es steht rechts neben den Tabellen', g[0].x >= Math.max(...tab.map(n => n.x + n.w)), g[0].x);
  t('die gelegten Tabellen bleiben liegen',
    tab.every(n => n.x === S.hierSaved[S.hierSel][n.id].x && n.y === S.hierSaved[S.hierSel][n.id].y));
  t('nicht in der Objektliste', !$('objectList').querySelector('.ochk[data-id="g:Bestellung"]'));
  t('die Legende erklärt die Kante', /Geschäftsobjekt, ohne Kardinalität/.test($('legend').innerHTML));
  api.setSelection(['g:Bestellung']);
  t('die Details nennen seine Tabellen', /QUELLTABELLEN/.test(detail().innerHTML) && /Bestellung_VRS/.test(detail().innerHTML));
  api.selectDiagram('Quellsysteme');
  t('im großen Diagramm je Geschäftsobjekt ein Kasten',
    S.graph.nodes.filter(n => n.kind === 'gobj' && !n.hidden).length === new Set(Object.values(S.quellModell.objects).map(o => o.bo)).size);
  api.selectDiagram('Bestellung Webshop/Roadshow');
  ['o:Bestellung', 'o:Bestellung_VRS'].forEach(id=>{
    const c = $('objectList').querySelector(`.ochk[data-id="${id}"]`);
    c.checked = false; dispatch(c, 'change', {});
  });
  t('ohne seine Tabellen ist es ausgeblendet', S.graph.byId.get('g:Bestellung').hidden);
  api.undo(); api.undo();
  api.setMode('komplett');
  t('in der Komplettansicht gibt es das Element nicht', !S.graph.nodes.some(n => n.kind === 'gobj'));
  api.setMode('hierarchie');
  t('in der Hierarchie auch nicht', !S.graph.nodes.some(n => n.kind === 'gobj'));
  api.setMode('quellen');
}

console.log('== Pflege: ausgeschaltet ==');
{
  api.selectDiagram('Quellsysteme');
  api.setSelection(['o:Kunde']);
  t('ohne den Schalter kein „Bearbeiten"', !detail().querySelector('[data-edit]'));
  t('und kein „＋ Objekt"', $('objNew').hidden);
  S.pflegeAn = true; api.renderDetails();
  t('„Geschäftsobjekte bearbeiten" gilt hier nicht', !detail().querySelector('[data-edit]'));
  S.pflegeAn = false;
}

console.log('== Pflege: Quellsystem und Zuordnung ändern ==');
{
  klick('optQuellPflege');
  t('der Haken ist gesetzt', S.quellPflegeAn && $('optQuellPflege').getAttribute('aria-checked') === 'true');
  t('das Formular öffnet', formularOeffnen('o:Kunde'));
  t('mit Feld „Quellsystem" statt „Quellen"', !!$('pfSystem') && !$('pfSources') && $('pfSystem').value === 'Webshop');
  t('und einer Auswahl „Geschäftsobjekt"', !!$('pfBO') && $('pfBO').value === 'Kunde');
  $('pfSystem').value = 'CRM';
  $('pfBO').value = 'VereinsPartner';
  klick('pfSave');
  const text = S.quellText;
  const block = text.split('\n  Kunde:\n')[1].split(/\n  \S/)[0];
  t('geschrieben in die Tabellen-YAML', /source_system: CRM/.test(block) && /business_object: VereinsPartner/.test(block), block.slice(0, 120));
  t('das Geschäftsobjekt-Modell bleibt unberührt', !/CRM/.test(S.yamlText));
  t('die Tabelle wandert in ein neues Systemdiagramm',
    !!S.outline.roots[0].kinder.find(k => k.name === 'CRM' && k.objekte.includes('Kunde')),
    S.outline.roots[0].kinder.map(k => k.name).join(','));
  api.undo();
  t('Strg+Z nimmt es zurück', S.quellModell.objects.Kunde.system === 'Webshop' && S.quellModell.objects.Kunde.bo === 'Kunde');
}

console.log('== Pflege: nur die geänderten Zeilen ==');
{
  const vorher = S.quellText || '';
  // leer = die eingebettete Vorlage (ohne Leerraum am Ende, plus Zeilenende)
  const basis = vorher || require('fs').readFileSync(require('path').join(__dirname, '..', '..', 'models', 'willibald-quelltabellen.yaml'), 'utf8').replace(/\s+$/, '') + '\n';
  formularOeffnen('o:Produkt');
  $('pfBO').value = '';
  klick('pfSave');
  const a = basis.split('\n'), b = S.quellText.split('\n');
  t('genau eine Zeile weniger', b.length === a.length - 1, a.length + ' → ' + b.length);
  t('es fehlt nur die Zuordnung von Produkt',
    a.filter(l => !b.includes(l)).join('|') === '    business_object: Produkt', a.filter(l => !b.includes(l)).join('|'));
  t('jetzt ohne Geschäftsobjekt gemeldet', S.quellModell.messages.some(m => m.title === 'Produkt: ohne Geschäftsobjekt'));
  api.undo();
}

console.log('== Pflege: Tabelle umbenennen ==');
{
  api.selectDiagram('Bestellung Webshop/Roadshow');
  ['o:Bestellung', 'o:Position'].forEach(id=>{
    const c = $('objectList').querySelector(`.ochk[data-id="${id}"]`);
    if(!c.checked){ c.checked = true; dispatch(c, 'change', {}); }
  });
  const lage = Object.assign({}, S.hierSaved[S.hierSel]['o:Position']);
  const komplettVorher = JSON.stringify(S.saved[1]);
  formularOeffnen('o:Position');
  $('pfName').value = 'Bestellposition';
  klick('pfSave');
  const Q = S.quellModell.objects;
  t('die Tabelle heißt neu', Q.Bestellposition && !Q.Position);
  t('„to:" zieht mit', Q.Bestellung.rels.some(r => r.to === 'Bestellposition'));
  t('„references:" zieht mit', Object.values(Q).every(o => o.attrs.every(a => !/^Position\./.test(a.ref || ''))));
  const dy = api.quellDiagrammeYaml();
  t('die Diagramm-YAML zieht mit', /- Bestellposition/.test(dy) && !/- Position\n/.test(dy), dy);
  const neu = S.hierSaved['Bestellung Webshop/Roadshow']['o:Bestellposition'];
  t('die Anordnung bleibt', neu && neu.x === lage.x && neu.y === lage.y, JSON.stringify(neu) + ' / ' + JSON.stringify(lage));
  t('die Komplettansicht der Geschäftsobjekte bleibt unberührt', JSON.stringify(S.saved[1]) === komplettVorher);
  t('das Geschäftsobjekt Position heißt weiter so', !!S.model.objects.Position);
  api.undo();
}

console.log('== Pflege: anlegen und löschen ==');
{
  api.selectDiagram('Quellsysteme');
  api.pflegeObjektNeu('Neu_Tab');
  t('eine neue Tabelle ist angelegt', !!S.quellModell.objects.Neu_Tab && /\n  Neu_Tab:/.test(S.quellText));
  t('und gleich im Formular', S.pflege === 'o:Neu_Tab' && !!$('pfSystem'));
  global.confirm = ()=> true;
  api.pflegeObjektWeg('Neu_Tab');
  t('und wieder gelöscht', !S.quellModell.objects.Neu_Tab && !/Neu_Tab/.test(S.quellText));
  t('das Geschäftsobjekt-Modell blieb dabei unberührt', !/Neu_Tab/.test(S.yamlText));
}

console.log('== Umbenennen eines Geschäftsobjekts zieht die Zuordnung mit ==');
{
  api.setMode('komplett');
  S.pflegeAn = true;
  formularOeffnen('o:Bestellung');
  $('pfName').value = 'Auftrag';
  klick('pfSave');
  t('das Geschäftsobjekt heißt neu', !!S.model.objects.Auftrag);
  t('beide Tabellen sind ihm weiter zugeordnet',
    S.quellModell.objects.Bestellung.bo === 'Auftrag' && S.quellModell.objects.Bestellung_VRS.bo === 'Auftrag');
  t('die Tabellen selbst heißen weiter so', !!S.quellModell.objects.Bestellung && !S.quellModell.objects.Auftrag);
  t('keine Meldung „Geschäftsobjekt unbekannt"', !S.quellModell.messages.some(m => m.group === 'Geschäftsobjekt unbekannt'));
  t('ein Feld mit Kommentar behält ihn',
    api.quellBoUmbenennen('SourceTables:\n  T:\n    business_object: A  # wichtig\n', 'A', 'B') === 'SourceTables:\n  T:\n    business_object: B  # wichtig\n');
  t('ein gleichnamiger Wert anderswo bleibt',
    /desc: A/.test(api.quellBoUmbenennen('SourceTables:\n  T:\n    desc: A\n    business_object: A\n', 'A', 'B')));
  api.undo();
  S.pflegeAn = false;
  t('Strg+Z nimmt beides zurück', !!S.model.objects.Bestellung && S.quellModell.objects.Bestellung.bo === 'Bestellung');
  api.setMode('quellen');
}

console.log('== Laden und Speichern ==');
{
  const geladen = [];
  const echtesElement = document.createElement;
  document.createElement = tag=>{ const el = echtesElement(tag); if(tag === 'a') geladen.push(el); return el; };
  const letzter = ()=> geladen.length ? geladen[geladen.length-1].download : '(keiner)';
  akt('saveQuellen').click();
  t('Quelltabellen werden unter ihrem Dateinamen gesichert', letzter() === 'willibald-quelltabellen.yaml', letzter());
  akt('saveQuellDiagramme').click();
  t('die Diagramme als …-diagramme.yaml', letzter() === 'willibald-quelltabellen-diagramme.yaml', letzter());
  document.createElement = echtesElement;

  const gerufen = [];
  ['quellInput','quellDiagInput'].forEach(id => $(id).onclick = ()=> gerufen.push(id));
  akt('openQuellen').click(); akt('loadQuellDiagramme').click();
  t('jeder Lade-Knopf öffnet sein Dateifeld', gerufen.join(',') === 'quellInput,quellDiagInput', gerufen.join(','));

  const fuettern = async (id, name, text)=>{
    const feld = $(id);
    feld.files = [{name, text: ()=> Promise.resolve(text)}];
    dispatch(feld, 'change', {});
    await warte();
  };
  await fuettern('quellInput', 'crm-tabellen.yaml',
    'SourceTables:\n  KNA1:\n    source_system: SAP\n    business_object: Kunde\n  ADRC:\n    source_system: SAP\n');
  t('die geladene Datei ersetzt die Tabellen', Object.keys(S.quellModell.objects).join(',') === 'KNA1,ADRC',
    Object.keys(S.quellModell.objects).join(','));
  t('der Dateiname wird übernommen', S.quellFileName === 'crm-tabellen.yaml');
  t('der Baum folgt: ein Diagramm SAP', S.outline.roots[0].kinder.map(k => k.name).join(',') === 'SAP');
  t('das Geschäftsobjekt-Modell bleibt', Object.keys(S.model.objects).length === 11);
  await fuettern('quellInput', 'kaputt.yaml', 'BusinessObjects:\n  X:\n');
  t('eine unlesbare Datei lässt den Stand stehen', S.quellFileName === 'crm-tabellen.yaml');
  await fuettern('quellDiagInput', 'd.yaml', 'Vergleich:\n  tabellen:\n    - KNA1\n');
  t('die Diagramme werden ersetzt', S.outline.roots.map(r => r.name).join(',') === 'Quellsysteme,Vergleich',
    S.outline.roots.map(r => r.name).join(','));
  t('die Hierarchie bleibt', /Übersicht/.test(S.bereiche.hierarchie.outlineText));
}

console.log('== Sitzung und Stand ==');
{
  api.selectDiagram('Vergleich');
  const lage = JSON.stringify(S.hierSaved.Vergleich);
  // Das Mini-DOM wirft <script>-Blöcke weg; der Platzhalter wird nachgereicht (wie in sitzung.js)
  const baked = document.createElement('script');
  baked.setAttribute('id', 'bakedState'); baked.setAttribute('type', 'application/json');
  baked.textContent = 'null';
  document.body.appendChild(baked);
  const html = api.standAlsHtml();
  const roh = (html.match(/<script id="bakedState" type="application\/json">([\s\S]*?)<\/script>/) || [])[1] || 'null';
  const p = JSON.parse(roh) || {quelltabellen:{anordnung:{}}};
  t('der Stand trägt die Quelltabellen mit', /KNA1/.test(p.quellYaml) && p.quellFileName === 'crm-tabellen.yaml');
  t('und Schalter, Diagramme und Anordnung', p.quelltabellen.an === true && p.quelltabellen.pflegeAn === true
    && /Vergleich/.test(p.quelltabellen.uebersichtText) && JSON.stringify(p.quelltabellen.anordnung.Vergleich) === lage);
  // Derselbe Weg wie boot() mit eingebackenem Stand: loadYaml mit dem Stand als Vorgabe
  const neu = await bootApp();
  await neu.api.loadYaml(p.yaml, p.fileName, p); await warte();
  t('nach dem Öffnen sind die Tabellen wieder da', Object.keys(neu.S.quellModell.objects).join(',') === 'KNA1,ADRC');
  t('und die Schalter', neu.S.quellenAn && neu.S.quellPflegeAn && neu.document.body.classList.contains('quellen-an'));
  neu.api.setMode('quellen'); neu.api.selectDiagram('Vergleich');
  t('und die Anordnung des eigenen Diagramms', JSON.stringify(neu.S.hierSaved.Vergleich) === lage);
}

console.log('== Ältere Positionsinformationen ==');
{
  const alt = api.layoutFile();
  delete alt.quelltabellen;
  alt.elemente = {quelle:false, domaene:false};
  S.quellenAn = false;
  api.adoptLayoutFile(alt);
  t('ohne den Schlüssel bleibt der Schalter, wie er ist', S.quellenAn === false);
  t('das Geschäftsobjekt-Element ist aus', S.elemente.geschaeftsobjekt === false);
  S.quellenAn = true;
}

console.log('== Ausschalten im Bereich ==');
{
  api.setMode('quellen');
  klick('optQuellen');
  t('führt in die Hierarchie', S.mode === 'hierarchie' && !document.body.classList.contains('modus-quellen'));
  t('der Bereich ist wieder verborgen', !document.body.classList.contains('quellen-an'));
  t('die Hierarchie zeigt ihre Objekte', S.graph.nodes.some(n => !n.hidden && n.name === 'Kunde'));
}

finish();
})().catch(e=>{ console.error(e); process.exit(1); });
