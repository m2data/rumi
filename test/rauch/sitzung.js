/* Rauchtest: Sitzung, Dateien und Export — Dateinamen, Speicher-Quota,
   PNG-Export, Exportschalter, Selbstständigkeit der HTML, Delta-Merge,
   Tab-eigene Sitzung. */
const {bootApp, makeT} = require('./start');

(async ()=>{
const {S, api, win, document, svg, dispatch, FILE, html} = await bootApp();
const {t, finish} = makeT();

console.log('== Hierarchie-Export leitet den Namen vom Modell ab ==');
{
  const prev = S.fileName;
  S.fileName = 'sap-finanz.yaml';
  t('Hierarchiename = Basisname + -hierarchie', api.uebersichtName() === 'sap-finanz-hierarchie.yaml', api.uebersichtName());
  S.fileName = 'willibald-attr.yaml';
  t('funktioniert auch für ein anderes Modell', api.uebersichtName() === 'willibald-attr-hierarchie.yaml', api.uebersichtName());
  S.fileName = prev;
}

console.log('== Speichern meldet volle Quota (einmal je Sitzung) ==');
{
  const echtes = win.localStorage.setItem.bind(win.localStorage);
  const toastEl = document.getElementById('toast');
  win.localStorage.setItem = ()=>{ throw new Error('QuotaExceededError'); };
  toastEl.textContent = '';
  api.persist();
  t('voller Speicher löst einen Hinweis aus', toastEl.textContent.includes('Speichern im Browser fehlgeschlagen'),
    JSON.stringify(toastEl.textContent));
  toastEl.textContent = '';
  api.persist();
  t('der Hinweis kommt nur einmal je Sitzung', toastEl.textContent === '',
    JSON.stringify(toastEl.textContent));
  win.localStorage.setItem = echtes;
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
    '    sources:',
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
    '    sources:',
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
  api.loadDelta(`BusinessObjects:\n  ${first}:\n    Domain: DeltaDom\n    sources:\n    - DeltaQuelle\n  NeuObjekt:\n    Domain: DeltaDom\n    business_keys:\n    - K`);
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

console.log('== Jeder Tab behält beim Neuladen seine eigene Sitzung ==');
{
  // Geteilte Sitzung (localStorage) und Tab-Sitzung (sessionStorage) zeigen auf
  // verschiedene Modelle -> boot() muss die Tab-eigene bevorzugen.
  const mini = name => JSON.stringify({fileName:name, view:1,
    yaml:'BusinessObjects:\n  ' + name.replace('.yaml','') + ':\n    Domain: T\n'});
  win.localStorage.setItem('sitzung', mini('geteilt.yaml'));
  win.sessionStorage.setItem('sitzung', mini('tabeigen.yaml'));
  await api.boot();
  for(let k=0;k<50;k++) await Promise.resolve();
  t('Neuladen nimmt die Tab-eigene Sitzung (nicht die geteilte)',
    S.fileName === 'tabeigen.yaml', 'fileName=' + S.fileName);
  api.persist();
  t('persist() schreibt die Tab-eigene Sitzung mit',
    (win.sessionStorage.getItem('sitzung') || '').includes('tabeigen.yaml'));
  t('persist() pflegt weiterhin die geteilte Sitzung',
    (win.localStorage.getItem('sitzung') || '').includes('tabeigen.yaml'));
}

finish();
})();
