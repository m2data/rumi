/* Hierarchieprüfung: buildOutline() liest die Übersicht (Baum aus Diagrammen)
   und normalisiert sie. Ohne DOM — yaml.js + model.js + hierarchie.js. */
const fs = require('fs');
const path = require('path');
const {load} = require('./harness');

let fail = 0, pass = 0;
const t = (name, cond, info)=>{
  if(cond){ pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FEHL ' + name + (info ? '  → ' + info : '')); }
};

const {api} = load(['yaml.js', 'model.js', 'hierarchie.js'],
  ['buildModel', 'buildOutline', 'outlineFind', 'outlineFlat']);
const {buildModel, buildOutline, outlineFind, outlineFlat} = api;
const has = (msgs, level, frag)=> msgs.some(m => m.level === level && (m.title + ' ' + m.body).includes(frag));

const model = buildModel(fs.readFileSync(path.join(__dirname, '..', 'models', 'willibald-attr.yaml'), 'utf8'));
const uebersicht = fs.readFileSync(path.join(__dirname, '..', 'models', 'williibald-übersicht.yaml'), 'utf8');
const {roots, messages} = buildOutline(uebersicht, model);

console.log('== Baum aus der Übersicht ==');
t('genau eine Wurzel „Übersicht“', roots.length === 1 && roots[0].name === 'Übersicht',
  roots.map(r => r.name).join(', '));
const top = roots[0] || {};
t('Wurzel hat Beschreibung', typeof top.beschreibung === 'string' && top.beschreibung.length > 0);
t('Wurzel zeigt Kunde und Bestellung', JSON.stringify(top.objekte) === JSON.stringify(['Kunde', 'Bestellung']),
  JSON.stringify(top.objekte));
t('zwei Domänen darunter', (top.kinder || []).map(k => k.name).join(',') === 'webshop,roadshow',
  (top.kinder || []).map(k => k.name).join(','));

console.log('== Verschachtelung und Kennungen ==');
const webshop = (top.kinder || []).find(k => k.name === 'webshop') || {};
t('webshop hat zwei Themen', (webshop.kinder || []).map(k => k.name).join(',') === 'Produkt,Lieferung',
  (webshop.kinder || []).map(k => k.name).join(','));
t('Kennung ist der Pfad', webshop.id === 'Übersicht›webshop', webshop.id);
const lieferung = (webshop.kinder || []).find(k => k.name === 'Lieferung') || {};
t('tiefe Kennung ist der volle Pfad', lieferung.id === 'Übersicht›webshop›Lieferung', lieferung.id);
t('Lieferadresse im Thema Lieferung', (lieferung.objekte || []).includes('Lieferadresse'),
  JSON.stringify(lieferung.objekte));

console.log('== Suche und flache Liste ==');
t('outlineFind trifft über den Pfad', !!outlineFind(roots, 'Übersicht›roadshow›Produkt'));
t('outlineFind gibt bei Unbekanntem null', outlineFind(roots, 'gibtsnicht') === null);
t('outlineFlat listet alle sechs Diagramme', outlineFlat(roots).length === 6,
  outlineFlat(roots).length + ' Diagramme');

console.log('== Prüfregeln ==');
t('ausgeliefertes Übersicht-YAML ohne unbekannte Objekte',
  !has(messages, 'warn', 'unbekannt'),
  messages.filter(m => m.level === 'warn').map(m => m.title).join(' | '));

const {messages: dm} = buildOutline(`Test:
  objekte:
    - Kunde
    - Gibtsnicht
`, model);
t('unbekanntes Objekt wird gemeldet', has(dm, 'warn', 'unbekannt'),
  dm.map(m => m.title).join(' | '));

console.log('\n' + (fail ? `${fail} Prüfung(en) fehlgeschlagen, ${pass} bestanden`
                          : `Alle ${pass} Prüfungen bestanden`));
process.exit(fail ? 1 : 0);
