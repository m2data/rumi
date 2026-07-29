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

const {api, S} = load(['yaml.js', 'model.js', 'hierarchie.js'],
  ['buildModel', 'buildOutline', 'outlineFind', 'outlineFlat', 'renderMarkdown', 'outlineToYaml']);
const {buildModel, buildOutline, outlineFind, outlineFlat, renderMarkdown, outlineToYaml} = api;
S.hierShown = {}; S.hierText = {};   // Overlays leer für den Serializer
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

console.log('== YAML-Rundlauf der Übersicht ==');
{
  const proj = ns => ns.map(n => ({name:n.name, beschreibung:n.beschreibung, objekte:n.objekte, kinder:proj(n.kinder)}));
  const yaml2 = outlineToYaml(roots);
  const wieder = buildOutline(yaml2, model);
  t('Struktur, Texte und Objekte überleben den Rundlauf',
    JSON.stringify(proj(roots)) === JSON.stringify(proj(wieder.roots)));
  // mehrzeiliger Text mit Raute (Markdown) muss verlustfrei zurückkommen
  S.hierText = { [top.id]: 'Zeile eins\n\nZeile zwei # mit Raute\n- Punkt' };
  const y3 = outlineToYaml(roots);
  const rt = buildOutline(y3, model);
  t('mehrzeilige Beschreibung mit Raute überlebt den Rundlauf',
    rt.roots[0].beschreibung === 'Zeile eins\n\nZeile zwei # mit Raute\n- Punkt',
    JSON.stringify(rt.roots[0].beschreibung));
  S.hierText = {};
}

console.log('== Markdown-Renderer ==');
t('Überschrift wird zu <h2>', renderMarkdown('# Titel') === '<h2>Titel</h2>', renderMarkdown('# Titel'));
t('**fett** wird <strong>', renderMarkdown('a **b** c').includes('<strong>b</strong>'));
t('*kursiv* wird <em>', renderMarkdown('a *b* c').includes('<em>b</em>'));
t('Liste wird <ul><li>', renderMarkdown('- eins\n- zwei') === '<ul><li>eins</li><li>zwei</li></ul>',
  renderMarkdown('- eins\n- zwei'));
t('Link wird <a>', renderMarkdown('[x](https://e.de)').includes('<a href="https://e.de" target="_blank"'));
t('HTML wird maskiert (keine Injektion)', (()=>{
  const h = renderMarkdown('<script>alert(1)</script>');
  return h.includes('&lt;script&gt;') && !h.includes('<script>');
})());

console.log('\n' + (fail ? `${fail} Prüfung(en) fehlgeschlagen, ${pass} bestanden`
                          : `Alle ${pass} Prüfungen bestanden`));
process.exit(fail ? 1 : 0);
