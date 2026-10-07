/* Modellprüfung: YAML-Rundlauf und die Prüfregeln aus buildModel().
   Ohne DOM, ohne die ganze App — nur yaml.js + model.js. */
const fs = require('fs');
const path = require('path');
const {load} = require('./harness');

let fail = 0, pass = 0;
const t = (name, cond, info)=>{
  if(cond){ pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FEHL ' + name + (info ? '  → ' + info : '')); }
};

const {api} = load(['yaml.js', 'model.js'], ['readYaml', 'buildModel']);
const {readYaml, buildModel} = api;
const has = (msgs, level, frag)=> msgs.some(m => m.level === level && (m.title + ' ' + m.body).includes(frag));

console.log('== YAML-Rundlauf: Tabs wie Leerzeichen ==');
const sp = [
  'meta:',
  '    titel: Test',
  'BusinessObjects:',
  '    A:',
  '        Domain: D',
  '        business_keys:',
  '        - AID'
].join('\n') + '\n';
const tb = sp.replace(/ {4}/g, '\t');                 // 4 Leerzeichen == 1 Tab (TAB_WIDTH)
const rsp = readYaml(sp), rtb = readYaml(tb);
t('Tabs ergeben dieselbe Struktur', JSON.stringify(rsp.doc) === JSON.stringify(rtb.doc),
  JSON.stringify(rtb.doc));
t('Tabs lösen einen Hinweis aus', has(rtb.notes, 'warn', 'Tabulator'));
t('Leerzeichen lösen keinen Tab-Hinweis aus', !has(rsp.notes, 'warn', 'Tabulator'));

console.log('== buildModel: Struktur eines sauberen Modells ==');
const clean = `meta:
  titel: Mini
  lizenz: CC BY 4.0
BusinessObjects:
  Kunde:
    Domain: Willibald
    business_keys:
    - KundeID
    source_systems:
    - Quelle1
    attributes:
    - name: KundeID
      type: int
      primary_key: true
    relationships:
    - to: Bestellung
      name: hat
  Bestellung:
    Domain: Willibald
    business_keys:
    - BestellungID
    source_systems:
    - Quelle1
    attributes:
    - name: BestellungID
      type: int
      primary_key: true
    - name: KundeID
      type: int
      foreign_key: true
      references: Kunde.KundeID
`;
const cm = buildModel(clean);
t('beide Objekte gelesen', cm.objects.Kunde && cm.objects.Bestellung,
  Object.keys(cm.objects).join(', '));
t('Kopf gelesen (Titel, Lizenz)', cm.meta.titel === 'Mini' && cm.meta.lizenz === 'CC BY 4.0');
t('Beziehung mit Name und Ziel', cm.objects.Kunde.rels.length === 1
  && cm.objects.Kunde.rels[0].to === 'Bestellung' && cm.objects.Kunde.rels[0].name === 'hat');
t('Fremdschlüssel mit Verweis erkannt', (()=>{
  const fk = cm.objects.Bestellung.attrs.find(a => a.name === 'KundeID');
  return fk && fk.fk === true && fk.ref === 'Kunde.KundeID';
})());
t('sauberes Modell ohne Fehler', !cm.messages.some(m => m.level === 'err'),
  cm.messages.filter(m => m.level === 'err').map(m => m.title).join(' | '));

console.log('== Business Keys auch in Binnenmajuskel ==');
{
  /* Andere Werkzeuge schreiben den Schlüssel wie „Domain" groß. Bliebe er
     ungelesen, fehlte der Business Key still — samt Warnung, obwohl er
     dasteht. */
  const m = buildModel(`BusinessObjects:
  Kunde:
    Domain: D
    BusinessKeys:
    - KundeID
    source_systems:
    - Q
`);
  t('BusinessKeys wird als Business Key gelesen',
    m.objects.Kunde.keys.join(',') === 'KundeID', JSON.stringify(m.objects.Kunde.keys));
  t('und die Warnung bleibt aus',
    !has(m.messages, 'warn', 'kein Business Key'), m.messages.map(x=>x.title).join(' | '));

  // Stehen beide da, gilt die Schreibweise, die das Werkzeug selbst schreibt.
  const beide = buildModel(`BusinessObjects:
  Kunde:
    Domain: D
    BusinessKeys:
    - Gross
    business_keys:
    - Klein
    source_systems:
    - Q
`);
  t('business_keys hat Vorrang', beide.objects.Kunde.keys.join(',') === 'Klein',
    JSON.stringify(beide.objects.Kunde.keys));
}

console.log('== buildModel: Prüfregeln greifen ==');
const dirty = `foo: bar
BusinessObjects:
  A:
    relationships:
    - to: B
    - to: A
    - to: Geist
    attributes:
    - name: x
      references: Geist.y
  B:
    Domain: D
    business_keys:
    - BID
    relationships:
    - to: A
`;
const dm = buildModel(dirty);
t('verwaister Schlüssel auf oberster Ebene', has(dm.messages, 'err', 'Verwaister Schlüssel'));
t('unbekanntes Beziehungsziel', has(dm.messages, 'err', 'Ziel unbekannt'));
t('unbekanntes Verweisziel im Attribut', has(dm.messages, 'err', 'Verweisziel unbekannt'));
t('fehlende Domain gemeldet', has(dm.messages, 'warn', 'keine Domain'));
t('fehlender Business Key gemeldet', has(dm.messages, 'warn', 'kein Business Key'));
t('doppelte Beziehung (beide Richtungen)', has(dm.messages, 'warn', 'doppelt'));
t('Selbstbezug als Hinweis', has(dm.messages, 'info', 'Selbstbezug'));

console.log('== Beziehungen gelten nur bei gleichem Namen als doppelt ==');
{
  // Zwei Beziehungen zum selben Ziel, verschieden benannt: zwei Sachverhalte.
  const m = buildModel(`BusinessObjects:
  Kunde:
    Domain: D
    business_keys:
    - K
    source_systems:
    - Q
    relationships:
    - to: Bestellung
      name: tätigt
    - to: Bestellung
      name: erteilt
  Bestellung:
    Domain: D
    business_keys:
    - B
    source_systems:
    - Q
`);
  t('verschieden benannt: kein Hinweis', !has(m.messages, 'warn', 'doppelt'),
    m.messages.filter(x => x.level === 'warn').map(x => x.title).join(' | '));
  t('beide Beziehungen bleiben im Modell', m.objects.Kunde.rels.length === 2);

  // Eine benannt, eine unbenannt: ebenfalls zwei Sachverhalte.
  const m2 = buildModel(`BusinessObjects:
  Kunde:
    Domain: D
    business_keys:
    - K
    source_systems:
    - Q
    relationships:
    - to: Bestellung
      name: tätigt
    - to: Bestellung
  Bestellung:
    Domain: D
    business_keys:
    - B
    source_systems:
    - Q
`);
  t('benannt gegen unbenannt: kein Hinweis', !has(m2.messages, 'warn', 'doppelt'));

  // Zweimal derselbe Name bleibt ein Duplikat.
  const m3 = buildModel(`BusinessObjects:
  Kunde:
    Domain: D
    business_keys:
    - K
    source_systems:
    - Q
    relationships:
    - to: Bestellung
      name: tätigt
    - to: Bestellung
      name: tätigt
  Bestellung:
    Domain: D
    business_keys:
    - B
    source_systems:
    - Q
`);
  t('gleicher Name zweimal: Hinweis bleibt', has(m3.messages, 'warn', 'doppelt'));
  t('der Hinweis nennt den Beziehungsnamen', has(m3.messages, 'warn', 'tätigt'));
}

console.log('== Unbekannte Kardinalitätswerte werden gemeldet ==');
{
  const m = buildModel(`BusinessObjects:
  A:
    Domain: D
    business_keys:
    - K
    source_systems:
    - Q
    relationships:
    - to: B
      cardinality:
        from: exactly_one
        to: 0..n
    - to: B
      name: zweite
      cardinality:
        from: viele
        to: zero_or_many
  B:
    Domain: D
    business_keys:
    - K
    source_systems:
    - Q
`);
  t('unbekannter Wert an der to-Seite gemeldet', has(m.messages, 'warn', '"0..n" unbekannt'));
  t('unbekannter Wert an der from-Seite gemeldet', has(m.messages, 'warn', '"viele" unbekannt'));
  t('der Hinweis nennt die erlaubten Werte', has(m.messages, 'warn', 'zero_or_many'));
  const treffer = m.messages.filter(x => x.group === 'Kardinalität unbekannt').length;
  t('gültige Werte lösen keinen Hinweis aus', treffer === 2, treffer + ' Meldungen');
}

console.log('== "many" ohne Untergrenze ist kein gültiger Wert mehr ==');
{
  const m = buildModel(`BusinessObjects:
  A:
    Domain: D
    business_keys:
    - K
    source_systems:
    - Q
    relationships:
    - to: B
      cardinality:
        from: exactly_one
        to: many
  B:
    Domain: D
    business_keys:
    - K
    source_systems:
    - Q
`);
  t('"many" wird als unbekannt gemeldet', has(m.messages, 'warn', '"many" unbekannt'));
  const {api: r} = load(['render.js'], ['isManyCard']);
  t('"many" zählt beim Anordnen nicht als viele', !r.isManyCard('many'));
  t('zero_or_many und one_or_many zählen weiter als viele',
    r.isManyCard('zero_or_many') && r.isManyCard('one_or_many'));
}

console.log('== Doppelte Attributnamen werden gemeldet ==');
{
  const m = buildModel(`BusinessObjects:
  A:
    Domain: D
    business_keys:
    - K
    source_systems:
    - Q
    attributes:
    - name: ID
      type: int
    - name: Wert
      type: text
    - name: ID
      type: char(3)
`);
  t('doppelter Attributname gemeldet', has(m.messages, 'warn', 'A.ID: Attribut doppelt'));
  t('nur einmal je Name gemeldet',
    m.messages.filter(x => x.group === 'Attribut doppelt').length === 1);
  t('eindeutige Attribute lösen nichts aus', !has(m.messages, 'warn', 'A.Wert'));
}

console.log('== Rundlauf am ausgelieferten Modell ==');
const real = fs.readFileSync(path.join(__dirname, '..', 'models', 'willibald-attr.yaml'), 'utf8');
const rm = buildModel(real);
t('11 Geschäftsobjekte', Object.keys(rm.objects).length === 11,
  Object.keys(rm.objects).length + ' gelesen');
t('Bestellung enthalten', !!rm.objects.Bestellung);
t('ohne harte Fehler baubar', !rm.messages.some(m => m.level === 'err'),
  rm.messages.filter(m => m.level === 'err').map(m => m.title).join(' | '));

console.log('== Blockskalare: | , |- und > ==');
{
  const doc = readYaml([
    'BusinessObjects:',
    '  Foo:',
    '    desc: |-',
    '      Zeile eins',
    '      Zeile zwei',
    '    domain: X'
  ].join('\n')).doc;
  const desc = doc.BusinessObjects.Foo.desc;
  t('literal |- ergibt echte Zeilenumbrüche', desc === 'Zeile eins\nZeile zwei', JSON.stringify(desc));
  t('der Marker |- steht nicht mehr im Wert', typeof desc === 'string' && !desc.includes('|'), JSON.stringify(desc));
  t('der folgende Schlüssel bleibt erhalten', doc.BusinessObjects.Foo.domain === 'X');
}
{
  const doc = readYaml([
    'a: >',
    '  eins',
    '  zwei',
    '',
    '  drei',
    'b: 1'
  ].join('\n')).doc;
  t('gefaltet > verbindet Zeilen mit Leerzeichen, Leerzeile bricht um', doc.a === 'eins zwei\ndrei', JSON.stringify(doc.a));
  t('nach dem Block geht es normal weiter', doc.b === 1);
}
{
  // '#' und ':' innerhalb eines Blocks bleiben Text, kein Kommentar/kein Schlüssel
  const doc = readYaml([
    'x: |',
    '  Preis # Stück',
    '  Verhältnis 1:2'
  ].join('\n')).doc;
  t('# und : im Block bleiben erhalten', doc.x === 'Preis # Stück\nVerhältnis 1:2', JSON.stringify(doc.x));
}

console.log('== Beziehung als Rumpf unter ihrem Namen ==');
{
  /* Zweite Schreibweise: der Beziehungsname ist der Schlüssel, das Ziel steht
     im Rumpf darunter. Bisher war nur die Form mit „to:" auf gleicher Ebene
     geprüft — die andere lief durch keinen Test. */
  const y = [
    'BusinessObjects:',
    '  Kunde:',
    '    domain: D',
    '    business_key: [Nr]',
    '    relationships:',
    '      - hat:',
    '          to: Bestellung',
    '  Bestellung:',
    '    domain: D',
    '    business_key: [Nr]'
  ].join('\n') + '\n';
  const m = buildModel(y);
  const r = m.objects.Kunde.rels[0];
  t('Ziel aus dem Rumpf gelesen', r && r.to === 'Bestellung', JSON.stringify(r));
  t('der Schlüssel darüber wird zum Namen', r && r.name === 'hat', r && r.name);
  t('kein Hinweis auf eine unlesbare Beziehung', !has(m.messages, 'err', 'unlesbar'));
}

console.log('== Beziehung ohne Ziel wird gemeldet ==');
{
  const y = [
    'BusinessObjects:',
    '  Kunde:',
    '    domain: D',
    '    business_key: [Nr]',
    '    relationships:',
    '      - name: irgendwas',
    '  Bestellung:',
    '    domain: D',
    '    business_key: [Nr]'
  ].join('\n') + '\n';
  const m = buildModel(y);
  t('fehlendes "to" wird gemeldet', has(m.messages, 'err', 'unlesbar'),
    m.messages.map(x => x.title).join(' | '));
  t('der Hinweis nennt die erwartete Schreibweise', has(m.messages, 'err', 'Erwartet wird "to:"'));
  t('die unlesbare Beziehung landet nicht im Modell', m.objects.Kunde.rels.length === 0);
}

console.log('== Verweis auf ein Attribut, das im Ziel fehlt ==');
{
  const y = [
    'BusinessObjects:',
    '  Bestellung:',
    '    domain: D',
    '    business_key: [Nr]',
    '    attributes:',
    '      - name: Nr',
    '        type: int',
    '  Position:',
    '    domain: D',
    '    business_key: [PNr]',
    '    attributes:',
    '      - name: PNr',
    '        type: int',
    '      - name: BestellungID',
    '        type: int',
    '        references: Bestellung.Nummer'
  ].join('\n') + '\n';
  const m = buildModel(y);
  t('das fehlende Attribut im Ziel wird gemeldet',
    has(m.messages, 'warn', 'Attribut im Ziel fehlt'), m.messages.map(x => x.title).join(' | '));
  t('der Hinweis nennt Verweis und Zielobjekt',
    has(m.messages, 'warn', '"Bestellung.Nummer"') && has(m.messages, 'warn', 'bei Bestellung'));
  t('ein Verweis auf ein vorhandenes Attribut löst nichts aus',
    !has(buildModel(y.replace('Bestellung.Nummer', 'Bestellung.Nr')).messages,
         'warn', 'Attribut im Ziel fehlt'));
}

console.log('== Doppelter Schlüssel auf derselben Ebene ==');
{
  const y = [
    'BusinessObjects:',
    '  Kunde:',
    '    domain: Erst',
    '    domain: Zweit',
    '    business_key: [Nr]'
  ].join('\n') + '\n';
  const r = readYaml(y);
  t('der doppelte Schlüssel wird gemeldet',
    r.notes.some(n => n.level === 'warn' && n.title.includes('"domain" doppelt')),
    r.notes.map(n => n.title).join(' | '));
  t('der Hinweis nennt die Zeile', r.notes.some(n => /Zeile 4/.test(n.title)),
    r.notes.map(n => n.title).join(' | '));
  t('der spätere Wert gewinnt', r.doc.BusinessObjects.Kunde.domain === 'Zweit',
    r.doc.BusinessObjects.Kunde.domain);
  t('der Hinweis steht auch im Modell', has(buildModel(y).messages, 'warn', 'doppelt'));
}

console.log('== Zusatzattribute: unbekannte Schlüssel werden mitgeführt ==');
{
  const y = [
    'BusinessObjects:',
    '  A:',
    '    Domain: D',
    '    schema.org: https://schema.org/Thing',
    '    dq-regel:',
    '    tags:',
    '    - x',
    '    attributes:',
    '    - name: AID',
    '      type: int',
    '      schema.org: https://schema.org/identifier',
    '  B:',
    '    schema.org: https://schema.org/Order',
    ''
  ].join('\n');
  const M = buildModel(y);
  t('am Objekt: Wert gelesen, leerer Wert als ""',
    M.objects.A.extra['schema.org'] === 'https://schema.org/Thing' && M.objects.A.extra['dq-regel'] === '',
    JSON.stringify(M.objects.A.extra));
  t('bekannte Schlüssel sind keine Zusatzattribute', !('Domain' in M.objects.A.extra) && !('attributes' in M.objects.A.extra));
  t('eine Liste wird nicht angeboten', !('tags' in M.objects.A.extra) && !M.zusatz.objekt.has('tags'));
  t('gezählt wird je Objekt', M.zusatz.objekt.get('schema.org') === 2 && M.zusatz.objekt.get('dq-regel') === 1,
    JSON.stringify([...M.zusatz.objekt]));
  t('am Attribut ebenso', M.objects.A.attrs[0].extra['schema.org'] === 'https://schema.org/identifier'
    && !('type' in M.objects.A.attrs[0].extra) && M.zusatz.attribut.get('schema.org') === 1);
  t('keine Meldung dafür', !M.messages.some(m => /schema|dq-regel/.test(m.title + m.body)),
    M.messages.map(m => m.title).join(' | '));
}

console.log('== buildModel: Quellen unter „source_systems", auch noch unter „sources" ==');
{
  const y = [
    'BusinessObjects:',
    '  Neu:',
    '    source_systems:',
    '    - Q1',
    '    - Q2',
    '  Alt:',
    '    sources:',
    '    - Q3',
    '  Leer:',
    '    source_systems:',
    ''
  ].join('\n');
  const M = buildModel(y);
  t('„source_systems" wird als Quellen gelesen', M.objects.Neu.sources.join(',') === 'Q1,Q2',
    JSON.stringify(M.objects.Neu.sources));
  t('das alte „sources" ebenso', M.objects.Alt.sources.join(',') === 'Q3',
    JSON.stringify(M.objects.Alt.sources));
  t('ein leeres „source_systems" ist kein Zusatzattribut', !('source_systems' in M.objects.Leer.extra)
    && !M.zusatz.objekt.has('source_systems'), JSON.stringify(M.objects.Leer.extra));
  t('und gilt als „keine Quelle"', M.messages.some(m => m.group === 'keine Quelle' && m.obj === 'Leer'));
}

console.log('== Alternativschlüssel (AK) ==');
{
  const y = [
    'BusinessObjects:',
    '  A:',
    '    Domain: D',
    '    business_keys:',
    '    - K',
    '    source_systems:',
    '    - Q',
    '    attributes:',
    '    - name: ID',
    '      primary_key: true',
    '      alternate_key: true',
    '    - name: PNr',
    '      primary_key: true',
    '    - name: Nr',
    '      alternate_key: true',
    '    - name: Ref',
    '      alternate_key: true',
    '      foreign_key: true',
    '    - name: Aus',
    '      alternate_key: false',
    ''
  ].join('\n');
  const M = buildModel(y), at = n => M.objects.A.attrs.find(a => a.name === n);
  t('alternate_key wird als AK gelesen', at('Nr').ak === true && !at('Nr').pk && !at('Nr').fk,
    JSON.stringify(at('Nr')));
  t('alternate_key ist kein Zusatzattribut', !('alternate_key' in at('Nr').extra)
    && !M.zusatz.attribut.has('alternate_key'), JSON.stringify(at('Nr').extra));
  t('alternate_key: false ergibt kein AK', at('Aus').ak === false);
  const pkak = M.messages.filter(m => m.group === 'PK und AK zugleich');
  t('PK und AK zugleich ist ein Fehler', has(M.messages, 'err', 'A.ID: PK und AK zugleich'),
    M.messages.map(m => m.title).join(' | '));
  t('gemeldet wird nur dieses eine Attribut', pkak.length === 1 && pkak[0].obj === 'A',
    pkak.map(m => m.title).join(' | '));
  t('AK und FK zugleich sind erlaubt', !has(M.messages, 'err', 'A.Ref'));

  const {api: g, S: gs} = load(['yaml.js', 'model.js'], ['buildModel', 'attrText', 'makeGraph']);
  const tag = (pk, ak, fk)=> g.attrText({name:'x', pk, ak, fk}, false).tags;
  t('Kürzel im Kasten in der Reihenfolge PK AK FK',
    tag(0,1,0) === 'AK' && tag(0,1,1) === 'AK FK' && tag(1,1,1) === 'PK AK FK' && tag(1,0,1) === 'PK FK',
    [tag(0,1,0), tag(0,1,1), tag(1,1,1), tag(1,0,1)].join(' / '));
  gs.content = {1: {attrs:true, keysOnly:true}};
  const n = g.makeGraph(g.buildModel(y)).nodes.find(x => x.name === 'A');
  const zeilen = n.rows.filter(r => r.kind === 'attr').map(r => r.a.name);
  t('„nur Schlüsselattribute" zeigt auch reine AK', zeilen.includes('Nr') && !zeilen.includes('Aus'),
    zeilen.join(','));
}

console.log('== Quelltabellen: eigene Modellart ==');
{
  const go = buildModel('BusinessObjects:\n  Kunde:\n    Domain: D\n');
  const Q = buildModel([
    'SourceTables:',
    '  T1:',
    '    source_system: S1',
    '    business_object: Kunde',
    '    Domain: D',
    '    business_keys:',
    '    - ID',
    '  T2:',
    '    Domain: D',
    '    business_keys:',
    '    - ID',
    '    business_object: Gibtsnicht',
    '  T3:',
    '    source_system: S1',
    '    Domain: D',
    '    business_keys:',
    '    - ID'
  ].join('\n') + '\n', 'quelle', go);
  const T1 = Q.objects.T1;
  t('Tabelle liest Quellsystem und Geschäftsobjekt', T1.system === 'S1' && T1.bo === 'Kunde', JSON.stringify(T1));
  t('eine Tabelle hat keine Quellenliste', Array.isArray(T1.sources) && !T1.sources.length);
  t('Quellsystem und Zuordnung sind keine Zusatzattribute',
    !Q.zusatz.objekt.has('source_system') && !Q.zusatz.objekt.has('business_object'), [...Q.zusatz.objekt.keys()].join(','));
  t('kein Quellsystem wird gemeldet', has(Q.messages, 'warn', 'T2: kein Quellsystem'), Q.messages.map(m => m.title).join(' | '));
  t('unbekanntes Geschäftsobjekt wird gemeldet', has(Q.messages, 'warn', 'T2 → Gibtsnicht: Geschäftsobjekt unbekannt'));
  t('ohne Geschäftsobjekt ist ein Info-Hinweis', has(Q.messages, 'info', 'T3: ohne Geschäftsobjekt'));
  t('„keine Quelle" gilt nicht für Tabellen', !Q.messages.some(m => m.group === 'keine Quelle'));

  const V = buildModel('Quelltabellen:\n  T:\n    Source_System: S9\n    Geschäftsobjekt: Kunde\n', 'quelle', go);
  t('Schreibvarianten Quelltabellen / Source_System / Geschäftsobjekt',
    V.objects.T && V.objects.T.system === 'S9' && V.objects.T.bo === 'Kunde', JSON.stringify(V.objects.T));

  let fehler = '';
  try{ buildModel('BusinessObjects:\n  A:\n    Domain: D\n', 'quelle'); }catch(e){ fehler = e.message; }
  t('ohne Abschnitt SourceTables ein Fehler', /Kein Abschnitt "SourceTables"/.test(fehler), fehler);
  const G = buildModel('BusinessObjects:\n  A:\n    source_system: X\n');
  t('an Geschäftsobjekten bleibt source_system ein Zusatzattribut', G.objects.A.extra.source_system === 'X' && G.objects.A.system === undefined);

  const dir = path.join(__dirname, '..', 'models');
  const W = buildModel(fs.readFileSync(path.join(dir, 'willibald-attr.yaml'), 'utf8'));
  const WQ = buildModel(fs.readFileSync(path.join(dir, 'willibald-quelltabellen.yaml'), 'utf8'), 'quelle', W);
  const systeme = [...new Set(Object.values(WQ.objects).map(o => o.system))].sort();
  t('Beispieldatei: 13 Tabellen', Object.keys(WQ.objects).length === 13, Object.keys(WQ.objects).length);
  t('Beispieldatei: drei Quellsysteme', systeme.join(',') === 'Referenzdaten,Roadshow,Webshop', systeme.join(','));
  t('Beispieldatei: keine Fehler und Hinweise', !WQ.messages.some(m => m.level !== 'info'),
    WQ.messages.filter(m => m.level !== 'info').map(m => m.title).join(' | '));
  t('Beispieldatei: jede Tabelle steht unter source_systems ihres Geschäftsobjekts',
    Object.values(WQ.objects).every(o => W.objects[o.bo] && W.objects[o.bo].sources.includes(o.name)));
}

console.log('\n' + (fail ? `${fail} Prüfung(en) fehlgeschlagen, ${pass} bestanden`
                          : `Alle ${pass} Prüfungen bestanden`));
process.exit(fail ? 1 : 0);
