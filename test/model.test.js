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

console.log('== Fremdschlüssel zur eingehenden Beziehung ==');
{
  /* Der Fremdschlüssel sitzt im Ziel der Beziehung: zu Kunde → Bestellung
     verweist Bestellung über "references" auf Kunde. Geprüft wird nur, wer
     überhaupt Attribute hat. */
  const yl = (rels, attrsA, attrsB) => 'BusinessObjects:\n'
    + '  A:\n    Domain: D\n    attributes:\n    - name: ID\n' + attrsA
    + (rels ? '    relationships:\n' + rels : '')
    + '  B:\n    Domain: D\n' + (attrsB === null ? '' : '    attributes:\n    - name: X\n' + attrsB);
  const zuB = '    - to: B\n';
  const fk = m => m.messages.filter(x => x.group === 'Fremdschlüssel fehlt');
  const ohne = buildModel(yl(zuB, '', ''));
  t('Fremdschlüssel fehlt wird gemeldet', has(ohne.messages, 'warn', 'A → B: Fremdschlüssel fehlt'),
    ohne.messages.map(x => x.title).join(' | '));
  t('Fremdschlüssel vorhanden', !fk(buildModel(yl(zuB, '', '      references: A.ID\n'))).length);
  t('Ziel ohne Attribute wird nicht geprüft', !fk(buildModel(yl(zuB, '', null))).length);
  t('FK im Ausgangsobjekt zählt nicht', fk(buildModel(yl(zuB, '      references: B.X\n', ''))).length === 1);
  t('eine Meldung je Paar',
    fk(buildModel(yl('    - to: B\n      name: hat\n    - to: B\n      name: kennt\n', '', ''))).length === 1);
  const selbst = buildModel('BusinessObjects:\n  A:\n    Domain: D\n    attributes:\n    - name: ID\n    relationships:\n    - to: A\n');
  t('Selbstbezug ohne Verweis wird gemeldet', has(selbst.messages, 'warn', 'A → A: Fremdschlüssel fehlt'));
  const q = r => buildModel('SourceTables:\n  Webshop:\n    A:\n      relationships:\n      - to: Webshop.B\n'
    + '      attributes:\n      - name: ID\n    B:\n      attributes:\n      - name: AID\n' + r, 'quelle');
  t('Quelltabellen: Verweis vorhanden', !fk(q('        references: Webshop.A.ID\n')).length,
    q('        references: Webshop.A.ID\n').messages.map(x => x.title).join(' | '));
  t('Quelltabellen: ohne Verweis gemeldet', has(q('').messages, 'warn', 'Webshop.A → Webshop.B: Fremdschlüssel fehlt'));
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

console.log('== Quelltabellen: gruppiert nach Quellsystem ==');
{
  const go = buildModel('BusinessObjects:\n  Kunde:\n    Domain: D\n  Bestellung:\n    Domain: D\n');
  const Q = buildModel([
    'SourceTables:',
    '  Webshop:',
    '    Bestellung:',
    '      business_object: Bestellung',
    '      Domain: D',
    '      business_keys:',
    '      - ID',
    '      attributes:',
    '      - name: KundeID',
    '        foreign_key: true',
    '        references: Webshop.Kunde.KundeID',
    '      relationships:',
    '      - to: Webshop.Kunde',
    '      - to: Roadshow.Bestellung',
    '        name: entspricht',
    '    Kunde:',
    '      business_object: Kunde',
    '      Domain: D',
    '      business_keys:',
    '      - KundeID',
    '      attributes:',
    '      - name: KundeID',
    '  Roadshow:',
    '    Bestellung:',
    '      business_object: Gibtsnicht',
    '      Domain: D',
    '      business_keys:',
    '      - ID',
    '      attributes:',
    '      - name: Ref',
    '        references: Webshop.Gibtsnicht.ID'
  ].join('\n') + '\n', 'quelle');
  const namen = Object.keys(Q.objects).join(',');
  t('gleichnamige Tabellen in zwei Systemen', namen === 'Webshop.Bestellung,Webshop.Kunde,Roadshow.Bestellung', namen);
  t('keine Meldung „doppelt"', !Q.messages.some(m => /doppelt/.test(m.title)), Q.messages.map(m => m.title).join(' | '));
  const WB = Q.objects['Webshop.Bestellung'], RB = Q.objects['Roadshow.Bestellung'];
  t('System und Tabelle je Tabelle', WB.system === 'Webshop' && WB.tabelle === 'Bestellung'
    && RB.system === 'Roadshow' && RB.tabelle === 'Bestellung');
  t('die Zuordnung je Tabelle eigen', WB.bo === 'Bestellung' && RB.bo === 'Gibtsnicht');
  t('eine Tabelle hat keine Quellenliste', Array.isArray(WB.sources) && !WB.sources.length);
  t('qualifizierte Verweise treffen', !Q.messages.some(m => m.obj === 'Webshop.Bestellung' && m.level !== 'info'),
    Q.messages.filter(m => m.obj === 'Webshop.Bestellung').map(m => m.title).join(' | '));
  t('Verweis ins andere System gilt', WB.rels.some(r => r.to === 'Roadshow.Bestellung')
    && !has(Q.messages, 'err', 'Ziel unbekannt'));
  t('Verweisziel unbekannt wird gemeldet', has(Q.messages, 'err', 'Roadshow.Bestellung.Ref: Verweisziel unbekannt'));
  t('ein unbekanntes Geschäftsobjekt ist kein Befund (die Übernahme legt es an)',
    !Q.messages.some(m => /Geschäftsobjekt unbekannt/.test(m.title)), Q.messages.map(m => m.title).join(' | '));
  t('Quellsystem und Zuordnung sind keine Zusatzattribute',
    !Q.zusatz.objekt.has('source_system') && !Q.zusatz.objekt.has('business_object'), [...Q.zusatz.objekt.keys()].join(','));
  t('„keine Quelle" gilt nicht für Tabellen', !Q.messages.some(m => m.group === 'keine Quelle'));

  const U = buildModel('SourceTables:\n  Webshop:\n    A:\n      relationships:\n      - to: B\n      attributes:\n      - name: X\n        references: B.ID\n    B:\n      attributes:\n      - name: ID\n', 'quelle');
  t('unqualifizierte Verweise gelten im eigenen System',
    U.objects['Webshop.A'].rels[0].to === 'Webshop.B' && U.objects['Webshop.A'].attrs[0].ref === 'Webshop.B.ID',
    JSON.stringify(U.objects['Webshop.A'].rels));
  t('und werden gemeldet', has(U.messages, 'warn', 'Webshop.A: Verweis ohne Quellsystem')
    && !has(U.messages, 'err', 'unbekannt'), U.messages.map(m => m.title).join(' | '));

  const P = buildModel('SourceTables:\n  Web.shop:\n    T:\n      Domain: D\n', 'quelle');
  t('Punkt im Namen ist ein Fehler', has(P.messages, 'err', 'Web.shop.T: Punkt im Namen'), P.messages.map(m => m.title).join(' | '));
  const BK = buildModel('SourceTables:\n  Webshop:\n    T:\n      Domain: D\n      business_keys:\n      - X\n', 'quelle');
  t('Quelltabellen haben keine Business Keys', BK.objects['Webshop.T'].keys.length === 0
    && !BK.messages.some(m => m.group === 'kein Business Key') && !BK.zusatz.objekt.has('business_keys'),
    BK.messages.map(m => m.title).join(' | '));
  const X = buildModel('SourceTables:\n  Webshop:\n    T:\n      source_system: Roadshow\n', 'quelle');
  t('widersprüchliches Quellsystem wird gemeldet, es gilt der Abschnitt',
    has(X.messages, 'warn', 'Webshop.T: Quellsystem widersprüchlich') && X.objects['Webshop.T'].system === 'Webshop');

  let fehler = '';
  try{ buildModel('BusinessObjects:\n  A:\n    Domain: D\n', 'quelle'); }catch(e){ fehler = e.message; }
  t('ohne Abschnitt SourceTables ein Fehler', /Kein Abschnitt "SourceTables"/.test(fehler), fehler);
  const G = buildModel('BusinessObjects:\n  A:\n    source_system: X\n');
  t('an Geschäftsobjekten bleibt source_system ein Zusatzattribut', G.objects.A.extra.source_system === 'X' && G.objects.A.system === undefined);
}

console.log('== Quelltabellen: flache Form vom 2026-10-07 ==');
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
    '    relationships:',
    '    - to: T3',
    '  T2:',
    '    Domain: D',
    '    business_keys:',
    '    - ID',
    '  T3:',
    '    source_system: S1',
    '    Domain: D',
    '    business_keys:',
    '    - ID'
  ].join('\n') + '\n', 'quelle');
  t('Tabellen der flachen Form bekommen ihr System vorangestellt',
    Object.keys(Q.objects).join(',') === 'S1.T1,T2,S1.T3', Object.keys(Q.objects).join(','));
  const T1 = Q.objects['S1.T1'];
  t('Quellsystem und Zuordnung aus den Feldern', T1.system === 'S1' && T1.tabelle === 'T1' && T1.bo === 'Kunde');
  t('ihr unqualifizierter Verweis trifft', T1.rels[0].to === 'S1.T3' && !has(Q.messages, 'err', 'Ziel unbekannt'));
  t('kein Quellsystem wird gemeldet', has(Q.messages, 'warn', 'T2: kein Quellsystem'), Q.messages.map(m => m.title).join(' | '));
  t('ohne Geschäftsobjekt ist ein Info-Hinweis', has(Q.messages, 'info', 'S1.T3: ohne Geschäftsobjekt'));
  const V = buildModel('Quelltabellen:\n  T:\n    Source_System: S9\n    Geschäftsobjekt: Kunde\n', 'quelle');
  t('Schreibvarianten Quelltabellen / Source_System / Geschäftsobjekt',
    V.objects['S9.T'] && V.objects['S9.T'].bo === 'Kunde', JSON.stringify(Object.keys(V.objects)));
}

console.log('== Domain als Liste ==');
{
  const M = buildModel('BusinessObjects:\n  A:\n    Domain:\n    - Vertrieb\n    - CRM\n  B:\n    Domain: Vertrieb\n  C:\n    business_keys: [X]\n');
  t('Liste wird gelesen', M.objects.A.domains.join(',') === 'Vertrieb,CRM' && M.objects.A.domain === 'Vertrieb',
    JSON.stringify(M.objects.A.domains));
  t('Einzelwert ergibt eine Liste mit einem Eintrag', M.objects.B.domains.join(',') === 'Vertrieb' && M.objects.B.domain === 'Vertrieb');
  t('ohne Domain eine leere Liste', Array.isArray(M.objects.C.domains) && !M.objects.C.domains.length);
  t('„keine Domain" nur ohne Domäne', has(M.messages, 'warn', 'C: keine Domain')
    && !has(M.messages, 'warn', 'A: keine Domain') && !has(M.messages, 'warn', 'B: keine Domain'));
}

console.log('== Führende Domäne ==');
{
  const M = buildModel([
    'BusinessObjects:',
    '  A:',
    '    Domain:',
    '    - A1',
    '    - A2',
    '    leading_domain: A2',
    '  B:',
    '    Domain: B1',
    '  C:',
    '    Domain:',
    '    - C1',
    '    - C2',
    '  D:',
    '    Domain: D1',
    '    leading_domain: X',
    '  E:',
    '    Domain:',
    '    - E1',
    '    - E2',
    '    Leading_Domain: E1',
    '  F:',
    '    Domain:',
    '    - F1',
    '    - F2',
    '    Führende_Domäne: F2'
  ].join('\n') + '\n');
  const o = M.objects;
  t('festgelegt: sie führt', o.A.fuehrend === 'A2' && !M.messages.some(m => m.obj === 'A' && /führend/.test(m.title)));
  t('eine Domain führt ohne Feld', o.B.fuehrend === 'B1' && o.B.leading === null);
  t('mehrere ohne Feld: keine führende, mit Info', o.C.fuehrend === null && has(M.messages, 'info', 'C: mehrere Domänen, keine führende'));
  t('nicht gelistet: führt trotzdem, mit Hinweis', o.D.fuehrend === 'X' && has(M.messages, 'warn', 'D: führende Domäne nicht unter Domain'));
  t('Schreibvarianten Leading_Domain und Führende_Domäne', o.E.fuehrend === 'E1' && o.F.fuehrend === 'F2');
  t('kein Zusatzattribut', !['leading_domain','Leading_Domain','Führende_Domäne'].some(k => M.zusatz.objekt.has(k)));
}

console.log('== source_systems: Reihenfolge und überschneidende Gruppen ==');
{
  const {api: q} = load(['yaml.js', 'model.js'], ['buildModel', 'disjunkteEinheiten']);
  const M = q.buildModel([
    'BusinessObjects:',
    '  A:',
    '    source_systems:',
    '    - name: S1',
    '      overlap_group: 1',
    '    - S2',
    '    - name: S3',
    '      overlap_group: 1',
    '  B:',
    '    source_systems:',
    '    - X',
    '    - Y',
    '  C:',
    '    source_systems:',
    '    - name: Z',
    '      overlap_group: 7',
    '    - W'
  ].join('\n') + '\n');
  const o = M.objects;
  t('gemischte Liste: Namen in Dateireihenfolge', o.A.sources.join(',') === 'S1,S2,S3', o.A.sources.join(','));
  t('gemischte Liste: Gruppen', JSON.stringify(o.A.quellGruppe) === '{"S1":"1","S3":"1"}', JSON.stringify(o.A.quellGruppe));
  t('ältere Datei: nur Kurzform, keine Gruppen', o.B.sources.join(',') === 'X,Y' && !Object.keys(o.B.quellGruppe).length);
  t('Gruppe mit einer Quelle wird gemeldet', M.messages.some(m => m.level === 'info' && m.title === 'C: Gruppe mit einer Quelle'));
  t('kein Zusatzattribut, keine Warnung „keine Quelle"', !M.messages.some(m => /keine Quelle/.test(m.title) && /^[AB]/.test(m.title)));
  t('5 Quellen, zweimal zwei überschneidend: 3 disjunkte Einheiten',
    q.disjunkteEinheiten(['A','B','C','D','E'], {A:'1', B:'1', C:'2', D:'2'}) === 3);
  t('ohne Gruppen ist jede Quelle eine Einheit', q.disjunkteEinheiten(['A','B','C'], {}) === 3);
}

console.log('== Quelltabelle: genau eine Domäne ==');
{
  const Q = buildModel([
    'SourceTables:',
    '  Webshop:',
    '    Einzeln:',
    '      Domain: Vertrieb',
    '    Liste:',
    '      Domain:',
    '      - A',
    '      - B',
    '    Fuehrend:',
    '      Domain: A',
    '      leading_domain: B'
  ].join('\n') + '\n', 'quelle');
  const o = Q.objects;
  t('Einzelwert: die Domäne führt', o['Webshop.Einzeln'].domains.join(',') === 'Vertrieb' && o['Webshop.Einzeln'].fuehrend === 'Vertrieb'
    && !Q.messages.some(m => m.obj === 'Webshop.Einzeln' && /Domän/.test(m.title)));
  t('eine Liste an der Tabelle: es gilt die erste, mit Hinweis', o['Webshop.Liste'].domains.join(',') === 'A'
    && has(Q.messages, 'warn', 'Webshop.Liste: mehrere Domänen an einer Quelltabelle'), Q.messages.map(m => m.title).join(' | '));
  t('leading_domain an der Tabelle wird nicht ausgewertet', o['Webshop.Fuehrend'].fuehrend === 'A' && o['Webshop.Fuehrend'].leading === null
    && !Q.messages.some(m => m.obj === 'Webshop.Fuehrend' && /führend/.test(m.title)) && !Q.zusatz.objekt.has('leading_domain'));
  const G = buildModel('BusinessObjects:\n  A:\n    Domain:\n    - X\n    - Y\n    leading_domain: Y\n');
  t('am Geschäftsobjekt bleibt die Liste samt führender', G.objects.A.domains.join(',') === 'X,Y' && G.objects.A.fuehrend === 'Y');
}

console.log('== Herkunftsfelder aus der Übernahme ==');
{
  const M = buildModel([
    'BusinessObjects:',
    '  A:',
    '    Table_Sources:',
    '    - Webshop.A',
    '    - Roadshow.A',
    '    attributes:',
    '    - name: ID',
    '      attribut_sources: Webshop.A.ID',
    '    relationships:',
    '    - to: B',
    '      name: hat',
    '      Relation_Sources:',
    '      - Webshop.A→Webshop.B',
    '  B:',
    '    Domain: D'
  ].join('\n') + '\n');
  const A = M.objects.A;
  t('Table_Sources wird gelesen', A.tabQuellen.join(',') === 'Webshop.A,Roadshow.A', JSON.stringify(A.tabQuellen));
  t('attribut_sources als Einzelwert wird eine Liste', A.attrs[0].quellen.join(',') === 'Webshop.A.ID');
  const L = buildModel('BusinessObjects:\n  A:\n    attributes:\n    - name: ID\n      attribut_sources:\n      - Webshop.A.ID\n      - Roadshow.A.ID\n');
  t('attribut_sources als Liste', L.objects.A.attrs[0].quellen.join(',') === 'Webshop.A.ID,Roadshow.A.ID');
  t('Relation_Sources wird gelesen', A.rels[0].quellen.join(',') === 'Webshop.A→Webshop.B' && A.rels[0].name === 'hat');
  t('keines davon ist ein Zusatzattribut', !M.zusatz.objekt.has('Table_Sources') && !M.zusatz.attribut.has('attribut_sources')
    && !('attribut_sources' in A.attrs[0].extra));
  t('ohne die Felder leere Werte', M.objects.B.tabQuellen.length === 0);
}

console.log('== Quelltabellen: Beispieldatei ==');
{
  const dir = path.join(__dirname, '..', 'models');
  const W = buildModel(fs.readFileSync(path.join(dir, 'willibald-attr.yaml'), 'utf8'));
  const WQ = buildModel(fs.readFileSync(path.join(dir, 'willibald-quelltabellen.yaml'), 'utf8'), 'quelle');
  const systeme = [...new Set(Object.values(WQ.objects).map(o => o.system))].sort();
  t('13 Tabellen', Object.keys(WQ.objects).length === 13, Object.keys(WQ.objects).length);
  t('kein business_keys mehr in der Datei', !/business_keys/.test(fs.readFileSync(path.join(dir, 'willibald-quelltabellen.yaml'), 'utf8')));
  t('drei Quellsysteme', systeme.join(',') === 'Referenzdaten,Roadshow,Webshop', systeme.join(','));
  t('Kennungen System.Tabelle', Object.values(WQ.objects).every(o => o.name === o.system + '.' + o.tabelle));
  // Bestellung_VRS führt keine Spalte zum VereinsPartner — eine echte Lücke der Datei
  const fkLuecke = 'Roadshow.VereinsPartner → Roadshow.Bestellung_VRS: Fremdschlüssel fehlt';
  t('der fehlende Fremdschlüssel zum VereinsPartner wird gemeldet', WQ.messages.some(m => m.title === fkLuecke));
  t('sonst keine Fehler und Hinweise', !WQ.messages.some(m => m.level !== 'info' && m.title !== fkLuecke),
    WQ.messages.filter(m => m.level !== 'info').map(m => m.title).join(' | '));
  t('jede Tabelle steht unter source_systems ihres Geschäftsobjekts',
    Object.values(WQ.objects).every(o => W.objects[o.bo] && W.objects[o.bo].sources.includes(o.tabelle)));
}

console.log('== Beschreibung: Anführungszeichen, Kommentare, Zeilenumbrüche ==');
{
  // Ein maskiertes \" beendete im Kommentarfilter die Zeichenkette — ab " #"
  // fiel der Rest der Beschreibung weg.
  const d = readYaml('A:\n  desc: "\\"\\nEr sagte \\"Hallo\\" # dazu"\n').doc.A.desc;
  t('Kommentar hinter maskiertem Anführungszeichen ist keiner', d === '"\nEr sagte "Hallo" # dazu', JSON.stringify(d));
  t('ein echter Kommentar hinter der Zeichenkette bleibt Kommentar',
    readYaml('A:\n  desc: "a" # weg\n').doc.A.desc === 'a');
  const tb = readYaml('A:\n  desc: |\n    a\tb\n    c\t\td\n').doc.A.desc;
  t('Blockskalar behält Tabs im Text', tb === 'a\tb\nc\t\td', JSON.stringify(tb));

  const {api: g, S: gs} = load(['yaml.js', 'model.js'], ['buildModel', 'makeGraph']);
  gs.content = {1: {desc:true}};
  const n = g.makeGraph(g.buildModel('BusinessObjects:\n  A:\n    Domain: D\n    desc: "Zeile 1\\n\\nZeile 3"\n'))
    .nodes.find(x => x.name === 'A');
  t('Zeilenumbrüche und Leerzeile im Diagramm', JSON.stringify(n.desc) === '["Zeile 1","","Zeile 3"]', JSON.stringify(n.desc));
  const q = g.makeGraph(g.buildModel('SourceTables:\n  S:\n    T:\n      desc: "a\\nb"\n', 'quelle'))
    .nodes.find(x => x.name === 'S.T');
  t('Zeilenumbruch im Diagramm der Quelltabellen', q && JSON.stringify(q.desc) === '["a","b"]', q && JSON.stringify(q.desc));
}

console.log('== Fremde Schreibweisen: U+2028, mehrzeilige Zeichenketten in Anführungszeichen ==');
{
  // U+2028 (Zeilentrenner, aus Word/Excel eingefügt) ließ die ganze Zeile still herausfallen
  const a = readYaml('A:\n  desc: "a\u2028b"\n  x: 1\n').doc.A;
  t('U+2028 in "…" bricht die Zeile nicht, wird Zeilenumbruch', a.desc === 'a\nb' && a.x === 1, JSON.stringify(a));
  t('U+2028 im schlichten Wert', readYaml('A:\n  desc: a\u2028b\n').doc.A.desc === 'a\nb');

  // So schreiben YAML-Werkzeuge im Python-Stil lange Texte
  const d = y => readYaml('A:\n  desc: ' + y + '\n  x: 1\n').doc.A;
  t("'…' über mehrere Zeilen, Leerzeile wird Umbruch", d("'eins\n\n    zwei'").desc === 'eins\nzwei', JSON.stringify(d("'eins\n\n    zwei'")));
  t('Faltung: ein einfacher Umbruch wird Leerzeichen', d("'eins\n    zwei'").desc === 'eins zwei');
  t("'' in '…' ist ein Apostroph", d("'it''s\n    so'").desc === "it's so");
  t('"…" mit \\-Fortsetzung und \\ ', d('"a\\\n    \\ b\\nc"').desc === 'a b\nc', JSON.stringify(d('"a\\\n    \\ b\\nc"').desc));
  t('danach geht es mit dem nächsten Schlüssel weiter', d("'eins\n\n    zwei'").x === 1);
  t('Escapes \\u00e4 \\x41 \\/', d('"\\u00e4\\x41\\/"').desc === 'äA/', JSON.stringify(d('"\\u00e4\\x41\\/"').desc));

  // Gegenprobe: ein Apostroph am Anfang ohne Schluss verschluckt keine Folgezeilen
  const g = readYaml("A:\n  d: 'x\n  e: y'\n").doc.A;
  t('ein Apostroph ohne Schluss bleibt schlicht', g.d === "'x" && g.e === "y'", JSON.stringify(g));

  // Nachgebaut aus einer Quelltabellen-Datei, wie sie ein anderes Werkzeug schreibt
  const Q = buildModel([
    'SourceTables:',
    '  CRM:',
    '    Familie:',
    "      desc: 'ist die Familie aus dem Portfolio",
    '',
    "        Wird gepflegt und weitergegeben'",
    '      Domain: CRM',
    '    Angebot:',
    '      desc: "Im CRM sind keine (!) Angebote hinterlegt, \\nes existieren nur PDFs und im SAP wird teilweise\\',
    '        \\ ein Angebot angelegt, \\ndas ist keine Pflicht"',
    '      Domain: CRM',
    '    Chance:',
    '      desc: "Nicht gut ersichtlich:\u2028- Churn-Rate"',
    '      Domain: CRM',
    ''].join('\n'), 'quelle');
  const qd = n => (Q.objects['CRM.' + n] || {}).desc;
  t('Quelltabelle mit mehrzeiligem \'…\'', qd('Familie') === 'ist die Familie aus dem Portfolio\nWird gepflegt und weitergegeben', JSON.stringify(qd('Familie')));
  t('Quelltabelle mit "…\\-Fortsetzung', qd('Angebot') === 'Im CRM sind keine (!) Angebote hinterlegt, \nes existieren nur PDFs und im SAP wird teilweise ein Angebot angelegt, \ndas ist keine Pflicht', JSON.stringify(qd('Angebot')));
  t('Quelltabelle mit U+2028 hat ihre Beschreibung', qd('Chance') === 'Nicht gut ersichtlich:\n- Churn-Rate', JSON.stringify(qd('Chance')));
}

console.log('== YAML-Besonderheiten ==');
{
  const r = y => readYaml(y);
  const d = y => r(y).doc;
  const gleich = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const hinweis = (y, frag) => r(y).notes.some(n => (n.title + ' ' + n.body).includes(frag));
  const zeig = y => JSON.stringify(d(y)) + ' | ' + r(y).notes.map(n => n.title).join(' / ');

  t('1 Inline-Liste', gleich(d('a: [x, "y, z", 3]').a, ['x', 'y, z', 3]), zeig('a: [x, "y, z", 3]'));
  t('2 Inline-Abbildung, verschachtelt', gleich(d('a: {b: 1, c: [x]}').a, {b: 1, c: ['x']}), zeig('a: {b: 1, c: [x]}'));
  t('3 Inline-Liste über zwei Zeilen', gleich(d('a: [x,\n  y]\nb: 1'), {a: ['x', 'y'], b: 1}), zeig('a: [x,\n  y]\nb: 1'));
  t('4 Anker und Alias', d('a: &k x\nb: *k').b === 'x', zeig('a: &k x\nb: *k'));
  const ab = d('a: &k\n  c: 1\nb: *k');
  t('5 Alias auf Abbildung ist eine Kopie', gleich(ab.b, {c: 1}) && ab.a !== ab.b, zeig('a: &k\n  c: 1\nb: *k'));
  const mg = 'a: &k\n  c: 1\nb:\n  <<: *k\n  c: 2\n  d: 3';
  t('6 Merge-Schlüssel, eigene Werte gehen vor', gleich(d(mg).b, {c: 2, d: 3}), zeig(mg));
  t('7 unbekannter Alias: null mit Hinweis', d('b: *fehlt').b === null && hinweis('b: *fehlt', 'Alias'), zeig('b: *fehlt'));
  const tg = 'a: !!str 123\nb: !!int "7"\nc: !foo x';
  t('8 Tags', gleich(d(tg), {a: '123', b: 7, c: 'x'}) && hinweis(tg, 'Tag'), zeig(tg));
  t('9 Schlüssel in Anführungszeichen', gleich(d('"a b": 1\n\'c:d\': 2'), {'a b': 1, 'c:d': 2}), zeig('"a b": 1\n\'c:d\': 2'));
  t('10 a: x:y ist Text, url bleibt', d('a: x:y').a === 'x:y' && d('url: http://x').url === 'http://x', zeig('a: x:y'));
  t('11 Schlüssel mit ?', gleich(d('? a\n: 1'), {a: 1}), zeig('? a\n: 1'));
  t('12 Liste in Liste', gleich(d('a:\n- - x\n  - y\n- z').a, [['x', 'y'], 'z']), zeig('a:\n- - x\n  - y\n- z'));
  const sk = 'a: Null\nb: NULL\nc: 1e3\nd: .5\ne: 0x1F\nf: +5\ng: 2024-01-02';
  t('13 null und Zahlen nach YAML 1.2', gleich(d(sk), {a: null, b: null, c: 1000, d: 0.5, e: 31, f: 5, g: '2024-01-02'}), zeig(sk));
  t('14 |+ behält Leerzeilen am Ende, | nicht', d('a: |+\n  x\n\nb: 1').a === 'x\n\n' && d('a: |\n  x\n\nb: 1').a === 'x',
    JSON.stringify(d('a: |+\n  x\n\nb: 1').a));
  t('15 schlichter Text: Leerzeile wird Umbruch', d('a: eins\n  zwei\n\n  drei').a === 'eins zwei\ndrei', zeig('a: eins\n  zwei\n\n  drei'));
  t('16 Folgezeile mit Doppelpunkt wird angehängt, mit Hinweis',
    d('a: eins\n  zwei: drei').a === 'eins zwei: drei' && hinweis('a: eins\n  zwei: drei', 'Zeile 2'), zeig('a: eins\n  zwei: drei'));
  t('17 Tab im Wert bleibt', d('a: "x\ty"').a === 'x\ty', zeig('a: "x\ty"'));
  t('18 --- und ... am Rand werden übergangen', gleich(d('---\na: 1\n...'), {a: 1}) && !r('---\na: 1\n...').notes.length, zeig('---\na: 1\n...'));
  t('18 zweites Dokument: nur das erste, mit Hinweis', gleich(d('a: 1\n---\nb: 2'), {a: 1}) && hinweis('a: 1\n---\nb: 2', 'Dokument'),
    zeig('a: 1\n---\nb: 2'));
  t('19 Zeile ohne Schlüssel wird gemeldet', hinweis('a: 1\nfoo\n', 'Zeile 2') && hinweis('a: 1\nfoo\n', 'foo'), zeig('a: 1\nfoo\n'));
  t('20 tiefere Zeile ohne Elternschlüssel wird gemeldet', d('a: 1\n    b: 2').a === 1 && hinweis('a: 1\n    b: 2', 'Zeile 2'), zeig('a: 1\n    b: 2'));
  t('21 Anführungszeichen ohne Schluss', d("d: 'x").d === "'x" && hinweis("d: 'x", 'ohne Schluss'), zeig("d: 'x"));
  t('22 der Hinweis kommt im Modell an', has(buildModel('BusinessObjects:\n  A:\n    Domain: D\n    foo\n').messages, 'warn', 'nicht gelesen'),
    buildModel('BusinessObjects:\n  A:\n    Domain: D\n    foo\n').messages.map(m => m.title).join(' | '));
}

console.log('== Einheitliches Format (yamlEinheitlich) ==');
{
  const {api: y} = load(['yaml.js'], ['readYaml', 'yamlEinheitlich']);
  const E = y.yamlEinheitlich;
  const zeig = s => JSON.stringify(E(s));
  t('E1 Text schlicht, wo es geht, sonst "…"', E("a: 'text'\nb: 'x: y'\nc: '1'\nd: ''") === 'a: text\nb: "x: y"\nc: "1"\nd: ""',
    zeig("a: 'text'\nb: 'x: y'\nc: '1'\nd: ''"));
  t('E2 mehrzeiliger Text wird Block', E("a: 'eins\n\n  zwei'\nb: 1") === 'a: |\n  eins\n  zwei\nb: 1', zeig("a: 'eins\n\n  zwei'\nb: 1"));
  t('E3 Beschreibung immer als Block', E('desc: kurz') === 'desc: |\n  kurz', zeig('desc: kurz'));
  t('E4 Inline-Liste und -Abbildung werden Block, [] bleibt',
    E('a: [x, "y z"]\nb: {c: 1}\ne: []') === 'a:\n- x\n- y z\nb:\n  c: 1\ne: []', zeig('a: [x, "y z"]\nb: {c: 1}\ne: []'));
  const bleibt = "a: 1\nb: true\nc: null\nd: &k x\ne: *k\nf: !!str 5\ng: 'x'  # Kommentar";
  t('E5 Zahlen, Wahrheitswerte, Anker, Alias, Tag und Kommentar bleiben', E(bleibt) === bleibt, zeig(bleibt));
  t('E6 Listeneinträge', E("l:\n- 'x'\n- name: 'y'\n  type: 'int'") === 'l:\n- x\n- name: y\n  type: int', zeig("l:\n- 'x'\n- name: 'y'\n  type: 'int'"));
  const dir = path.join(__dirname, '..', 'models');
  const crmArtig = fs.readFileSync(path.join(dir, 'willibald-quelltabellen.yaml'), 'utf8')
    + "  Fremd:\n    T:\n      desc: 'eins\n\n        zwei'\n      prio: ''\n      tags: [a, b]\n      desc2: \"x\\\n        \\ y\"\n";
  const dateien = fs.readdirSync(dir).filter(f => /\.ya?ml$/.test(f)).map(f => [f, fs.readFileSync(path.join(dir, f), 'utf8')])
    .concat([['crm-artig', crmArtig]]);
  // Beschreibungen werden wie im Formular getrimmt — sonst muss der Inhalt gleich bleiben
  const ohneRand = v => Array.isArray(v) ? v.map(ohneRand) : v && typeof v === 'object'
    ? Object.fromEntries(Object.entries(v).map(([k, w]) => [k, /^(desc|beschreibung|description)$/.test(k) && typeof w === 'string' ? w.trim() : ohneRand(w)])) : v;
  dateien.forEach(([n, s])=>{
    const e = E(s);
    t('E7 ' + n + ': einmal ist genug', E(e) === e);
    t('E8 ' + n + ': gleicher Inhalt', JSON.stringify(ohneRand(y.readYaml(e).doc)) === JSON.stringify(ohneRand(y.readYaml(s).doc)));
  });
  // Ausweichweg: eine Zeile nur aus Leerzeichen trägt der Block nicht verlustfrei
  const roh = 'a: "eins\\n   \\nzwei"';
  t('E9 was als Block nicht verlustfrei ginge, bleibt in den alten Zeilen', E(roh) === roh, zeig(roh));
}

console.log('== Beziehungsname aus Leerzeichen ==');
{
  const yl = "BusinessObjects:\n  A:\n    Domain: D\n    relationships:\n    - to: B\n      name: '  '\n  B:\n    Domain: D\n";
  const M = buildModel(yl);
  t('gilt als unbenannt', M.objects.A.rels[0].name === null, JSON.stringify(M.objects.A.rels[0]));
  const {api: g, S: gs} = load(['yaml.js', 'model.js'], ['buildModel', 'makeGraph']);
  gs.content = {1: {}};
  const e = g.makeGraph(g.buildModel(yl)).edges[0];
  t('keine Beschriftung an der Kante', e && e.label === null, e && JSON.stringify(e.label));
  const Q = buildModel("SourceTables:\n  S:\n    T:\n      relationships:\n      - to: S.U\n        name: '  '\n    U:\n      desc: x\n", 'quelle');
  t('auch an Quelltabellen unbenannt', Q.objects['S.T'].rels[0].name === null, JSON.stringify(Q.objects['S.T'].rels[0]));
}

console.log('\n' + (fail ? `${fail} Prüfung(en) fehlgeschlagen, ${pass} bestanden`
                          : `Alle ${pass} Prüfungen bestanden`));
process.exit(fail ? 1 : 0);

