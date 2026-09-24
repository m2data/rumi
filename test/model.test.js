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
    sources:
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
    sources:
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
    sources:
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
    sources:
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
    sources:
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
    sources:
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
    sources:
    - Q
    relationships:
    - to: Bestellung
      name: tätigt
    - to: Bestellung
  Bestellung:
    Domain: D
    business_keys:
    - B
    sources:
    - Q
`);
  t('benannt gegen unbenannt: kein Hinweis', !has(m2.messages, 'warn', 'doppelt'));

  // Zweimal derselbe Name bleibt ein Duplikat.
  const m3 = buildModel(`BusinessObjects:
  Kunde:
    Domain: D
    business_keys:
    - K
    sources:
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
    sources:
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
    sources:
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
    sources:
    - Q
`);
  t('unbekannter Wert an der to-Seite gemeldet', has(m.messages, 'warn', '"0..n" unbekannt'));
  t('unbekannter Wert an der from-Seite gemeldet', has(m.messages, 'warn', '"viele" unbekannt'));
  t('der Hinweis nennt die erlaubten Werte', has(m.messages, 'warn', 'zero_or_many'));
  const treffer = m.messages.filter(x => x.group === 'Kardinalität unbekannt').length;
  t('gültige Werte lösen keinen Hinweis aus', treffer === 2, treffer + ' Meldungen');
}

console.log('== Doppelte Attributnamen werden gemeldet ==');
{
  const m = buildModel(`BusinessObjects:
  A:
    Domain: D
    business_keys:
    - K
    sources:
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

console.log('\n' + (fail ? `${fail} Prüfung(en) fehlgeschlagen, ${pass} bestanden`
                          : `Alle ${pass} Prüfungen bestanden`));
process.exit(fail ? 1 : 0);
