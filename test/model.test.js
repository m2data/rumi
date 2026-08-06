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

console.log('\n' + (fail ? `${fail} Prüfung(en) fehlgeschlagen, ${pass} bestanden`
                          : `Alle ${pass} Prüfungen bestanden`));
process.exit(fail ? 1 : 0);
