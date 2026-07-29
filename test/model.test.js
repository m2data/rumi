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

console.log('== Rundlauf am ausgelieferten Modell ==');
const real = fs.readFileSync(path.join(__dirname, '..', 'models', 'willibald-attr.yaml'), 'utf8');
const rm = buildModel(real);
t('11 Geschäftsobjekte', Object.keys(rm.objects).length === 11,
  Object.keys(rm.objects).length + ' gelesen');
t('Bestellung enthalten', !!rm.objects.Bestellung);
t('ohne harte Fehler baubar', !rm.messages.some(m => m.level === 'err'),
  rm.messages.filter(m => m.level === 'err').map(m => m.title).join(' | '));

console.log('\n' + (fail ? `${fail} Prüfung(en) fehlgeschlagen, ${pass} bestanden`
                          : `Alle ${pass} Prüfungen bestanden`));
process.exit(fail ? 1 : 0);
