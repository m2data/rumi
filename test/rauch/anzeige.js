/* Rauchtest: Anzeige und Seitenleiste — Start, Inhaltsauswahl, Prüfliste
   (Gruppen, Sprung zum Objekt), Objektliste, Kastengeometrie, Herkunft. */
const {bootApp, makeT} = require('./start');

(async ()=>{
const {S, api, document, svg, dispatch} = await bootApp();
const {t, finish} = makeT();

console.log('== Start ==');
t('Modell geladen', S.model && Object.keys(S.model.objects).length === 11,
  S.model ? Object.keys(S.model.objects).length + ' Objekte' : 'kein Modell');
t('Graph aufgebaut', S.graph && S.graph.nodes.length > 0);
t('Kanten gezeichnet', document.getElementById('edges').children.length > 0,
  document.getElementById('edges').children.length + ' Gruppen');
t('Knoten gezeichnet', document.getElementById('nodes').children.length > 0);

console.log('== Inhaltsauswahl ==');
{
  const btn = document.getElementById('contentList').querySelectorAll('[data-content]')
    .filter(b => b.dataset.content === 'attrs')[0];
  t('Schaltfläche Attribute vorhanden', !!btn);
  if(btn){
    const vorher = S.graph.byId.get('o:Bestellung').h;
    btn.onclick();
    const nachher = S.graph.byId.get('o:Bestellung').h;
    t('Kasten wird höher mit Attributen', nachher > vorher, vorher + ' → ' + nachher);
    const svgTxt = document.getElementById('nodes').innerHTML;
    t('attr-Kürzel im Diagramm', svgTxt.includes('>attr<'));
    t('Beschreibungsbox erst nach Auswahl', !svgTxt.includes('n-desc-bg'));
    btn.onclick();
  }
}

console.log('== Hinweise gruppieren und aufklappen ==');
{
  const prev = S.model.messages;
  S.model.messages = [
    {level:'warn', title:'Alpha: keine Domain', body:'Feld fehlt.'},
    {level:'warn', title:'Beta: keine Domain',  body:'Feld fehlt.'},
    {level:'warn', title:'Gamma: keine Domain', body:'Feld fehlt.'},
    {level:'err',  title:'Alpha → Ziel: Ziel unbekannt', body:'weg.'}
  ];
  api.renderMessages();
  const ml = document.getElementById('msgList');
  const groups = ml.querySelectorAll('.mgroup').length;
  const total = ml.querySelectorAll('.msg').length;
  t('gleiche Hinweise werden zu einer Gruppe zusammengefasst', groups === 1, groups + ' Gruppen');
  t('ein einzelner Hinweis bleibt einzeln', total - groups === 1, (total - groups) + ' einzelne');
  const head = ml.querySelector('.mgh');
  t('Gruppe ist zunächst eingeklappt', head.getAttribute('aria-expanded') === 'false');
  t('Gruppe listet ihre Objekte', ml.querySelectorAll('.mgi').length === 3);
  dispatch(head, 'click', {});
  t('Klick klappt die Gruppe auf', document.getElementById('msgList').querySelector('.mgh').getAttribute('aria-expanded') === 'true');
  // Hinweise ohne ":" im Titel (variable Stelle mittendrin) gruppieren über das group-Feld
  S.model.messages = [
    {level:'info', group:'Quelle mehrfach genutzt', title:'Quelle "S1" mehrfach genutzt', body:'a'},
    {level:'info', group:'Quelle mehrfach genutzt', title:'Quelle "S2" mehrfach genutzt', body:'b'}
  ];
  api.renderMessages();
  t('auch Hinweise ohne ":" im Titel werden gruppiert', document.getElementById('msgList').querySelectorAll('.mgroup').length === 1);
  S.model.messages = prev;
  api.renderMessages();
}

console.log('== Klick auf einen Hinweis springt zum Objekt ==');
{
  api.setView(1);
  const prev = S.model.messages;
  const kunde = S.graph.byId.get('o:Kunde'), best = S.graph.byId.get('o:Bestellung');
  S.model.messages = [
    {level:'warn', group:'keine Domain', obj:'Kunde',      title:'Kunde: keine Domain',      body:'a'},
    {level:'warn', group:'kein Business Key', obj:'Bestellung', title:'Bestellung: kein Business Key', body:'b'},
    {level:'info', title:'Beziehungen ohne Namen', body:'global, ohne Objekt'}
  ];
  api.renderMessages();
  const ml = document.getElementById('msgList');
  const btns = ml.querySelectorAll('[data-msgobj]');
  t('Hinweise mit Objekt sind klickbar', btns.length === 2, btns.length + ' Knöpfe');
  t('globale Hinweise bleiben unklickbar', ml.querySelectorAll('button.mlink').length === 2);
  api.setSelection([]);
  dispatch(btns[0], 'click', {});
  t('Klick wählt das Objekt aus', S.selected === 'o:Kunde' && S.sel.has('o:Kunde'),
    'selected=' + S.selected);
  // ausgeblendetes Objekt wird eingeblendet
  best.hidden = true;
  dispatch(document.getElementById('msgList').querySelectorAll('[data-msgobj]')[1], 'click', {});
  t('Klick blendet ein verstecktes Objekt ein', best.hidden === false);
  t('und wählt es aus', S.selected === 'o:Bestellung');
  // in einer Gruppe ist die Objektnennung der Klickpunkt
  S.model.messages = [
    {level:'warn', group:'keine Domain', obj:'Kunde',      title:'Kunde: keine Domain',      body:'a'},
    {level:'warn', group:'keine Domain', obj:'Bestellung', title:'Bestellung: keine Domain', body:'b'}
  ];
  api.renderMessages();
  dispatch(document.getElementById('msgList').querySelector('.mgh'), 'click', {});
  const item = document.getElementById('msgList').querySelectorAll('button.mgi-obj')[0];
  t('Gruppeneinträge sind klickbar', !!item);
  if(item){
    dispatch(item, 'click', {});
    t('Klick im Gruppeneintrag springt ebenfalls', S.selected === 'o:Kunde');
  }
  S.model.messages = prev;
  api.renderMessages();
  api.setSelection([]);
}

console.log('== Domänen zusammenklappen ==');
{
  api.setView(1);
  const before = document.getElementById('objectList').querySelectorAll('li.row').length;
  const caret = document.getElementById('objectList').querySelector('.gcaret');
  t('Domänen-Kopf hat einen Klapp-Pfeil', !!caret);
  if(caret){
    dispatch(caret, 'click', {});
    const after = document.getElementById('objectList').querySelectorAll('li.row').length;
    t('Zuklappen blendet die Objektzeilen der Domäne aus', after < before, before + ' → ' + after);
    dispatch(document.getElementById('objectList').querySelector('.gcaret'), 'click', {});
    const restored = document.getElementById('objectList').querySelectorAll('li.row').length;
    t('Aufklappen zeigt sie wieder', restored === before, before + ' → ' + restored);
  }
}

console.log('== Suche greift über den Objektnamen hinaus ==');
{
  api.setView(1);
  api.setSelection([]);                       // sonst blendet die Nachbarschaft aus
  const suche = q =>{
    const el = document.getElementById('search');
    el.value = q;
    dispatch(el, 'input', {});
    return [...document.getElementById('nodes').querySelectorAll('.node')]
      .filter(g => !(g.getAttribute('class') || '').includes('faded'))
      .map(g => S.graph.byId.get(g.dataset.id).name).sort();
  };
  const alle = S.graph.nodes.filter(n => !n.hidden).length;

  t('leere Suche blendet nichts aus', suche('').length === alle);
  // „kunde" trifft das Objekt selbst UND alles, was auf es verweist (KundeID) —
  // genau die gewollte Erweiterung. Unbeteiligte Objekte bleiben blass.
  const k = suche('kunde');
  t('Objektname trifft weiterhin', k.includes('Kunde'), k.join(','));
  t('und zusätzlich die Objekte mit KundeID-Verweis', k.includes('Bestellung'), k.join(','));
  t('unbeteiligte Objekte bleiben blass', !k.includes('Kategorie') && !k.includes('Produkt'), k.join(','));
  // Attributname: Pflanzabstand steht nur bei Produkt
  t('Attributname trifft sein Objekt', JSON.stringify(suche('pflanzabstand')) === JSON.stringify(['Produkt']),
    suche('pflanzabstand').join(','));
  // Verweis: references: Produkt.ProduktID -> Position trifft über den Verweis
  const ref = suche('produktid');
  t('Verweis (references) trifft das verweisende Objekt', ref.includes('Position') && ref.includes('Produkt'),
    ref.join(','));
  // Quelle: Bestellung_VRS ist nur bei Bestellung hinterlegt
  t('Quellenname trifft sein Objekt', JSON.stringify(suche('bestellung_vrs')) === JSON.stringify(['Bestellung']),
    suche('bestellung_vrs').join(','));
  // Beziehungsname: „ist Vorsitzender von" steht bei Kunde
  t('Beziehungsname trifft sein Objekt', JSON.stringify(suche('vorsitzender')) === JSON.stringify(['Kunde']),
    suche('vorsitzender').join(','));
  // Business Key und Domain
  t('Business Key trifft', suche('posid').includes('Position'), suche('posid').join(','));
  t('Domain trifft alle Objekte der Domäne', suche('willibald').length === alle, suche('willibald').length + '');
  // Datentypen bleiben bewusst außen vor
  t('Datentypen werden nicht durchsucht', suche('bigint').length === 0, suche('bigint').join(','));
  t('ohne Treffer bleibt alles blass', suche('gibtesnicht').length === 0);

  // Ansicht 3: ein Quellenkasten trifft über die Objekte, die ihn nutzen
  api.setView(3);
  const q3 = suche('kunde');
  t('Quellenkasten trifft über die nutzenden Objekte', q3.length > 0 && q3.some(n => n !== 'Kunde'),
    q3.join(','));

  suche('');                                   // Filter zurücksetzen
  api.setView(1);

  // Die Suche gehört nicht mehr in den Reiter „Objekte": sie wirkt aufs
  // Diagramm und muss aus jedem Reiter erreichbar bleiben.
  const feld = document.getElementById('search');
  t('Suchfeld liegt außerhalb der Reiter-Inhalte', !feld.closest('.pane'),
    feld.closest('.pane') ? feld.closest('.pane').id : 'außerhalb');
  t('Suchleiste steht über den Reitern', !!document.querySelector('.searchbar .search'));
  dispatch([...document.querySelectorAll('.sidetab')].find(s => s.dataset.pane === 'details'), 'click', {});
  t('bleibt auch im Reiter „Details" im Baum', !document.getElementById('search').closest('.pane'));
  dispatch([...document.querySelectorAll('.sidetab')].find(s => s.dataset.pane === 'objects'), 'click', {});

  // Trefferzahl neben dem Feld
  const hits = () => document.getElementById('searchHits').textContent;
  const alleSichtbar = S.graph.nodes.filter(n => !n.hidden).length;
  suche('pflanzabstand');
  t('Trefferzahl zeigt Treffer und Gesamtzahl', hits() === '1/' + alleSichtbar, hits());
  suche('gibtesnicht');
  t('ohne Treffer steht 0 da', hits() === '0/' + alleSichtbar, hits());
  t('und die Zahl wird als Warnung markiert',
    document.getElementById('searchHits').classList.contains('none'));
  suche('');
  t('ohne Suchbegriff bleibt die Zahl leer', hits() === '', hits());
}

console.log('== Kein Text klebt am Kastenrand ==');
{
  // Misst den untersten gezeichneten Inhalt gegen die Kastenhöhe, in jeder
  // Kombination der Inhaltsauswahl. Deckt Rundungs- und Additionsfehler in
  // der Höhenrechnung auf, die man auf dem Bildschirm leicht übersieht.
  const tief = n=>{
    const mk = api.nodeMarkup(n, '');
    let maxY = 0;
    for(const m of mk.matchAll(/<text[^>]*\by="([-\d.]+)"/g)) maxY = Math.max(maxY, +m[1]);
    for(const m of mk.matchAll(/<rect class="n-desc-bg"[^>]*\by="([-\d.]+)"[^>]*height="([-\d.]+)"/g))
      maxY = Math.max(maxY, +m[1] + +m[2]);
    return n.h - maxY;
  };
  const kombis = [
    ['nur Beschreibung',  {desc:1}],
    ['Beschreibung+Domain',{desc:1,domain:1}],
    ['nur Domain',        {domain:1}],
    ['nur Keys',          {keys:1}],
    ['nur Quellen',       {sources:1}],
    ['nur Attribute',     {attrs:1}],
    ['Attribute ohne Typ',{attrs:1,types:0}],
    ['alles',             {desc:1,domain:1,keys:1,sources:1,attrs:1,types:1}]
  ];
  let schlimmster = 99, wo = '';
  kombis.forEach(([name, c])=>{
    S.content[1] = Object.assign({desc:false,domain:false,keys:false,sources:false,attrs:false,keysOnly:false,types:true},
      Object.fromEntries(Object.entries(c).map(([k,v])=>[k,!!v])));
    api.setView(1);
    S.graph.nodes.filter(n=>n.kind!=='source').forEach(n=>{
      const d = tief(n);
      if(d < schlimmster){ schlimmster = d; wo = name + '/' + n.name; }
    });
  });
  t('Abstand Text zu Kastenrand mindestens 5 px', schlimmster >= 5, schlimmster + ' px bei ' + wo);
  S.content[1] = {};
  api.setView(1);
}

console.log('== Herkunft: Metadaten gelesen, aber nicht angezeigt ==');
{
  const m = S.model.meta;
  t('Modellkopf gelesen', !!(m && m.urheber && m.lizenz), m ? m.urheber + ' / ' + m.lizenz : 'fehlt');
  const box = document.getElementById('herkunft');
  t('Herkunft nicht in der Seitenleiste angezeigt', box.hidden === true && box.textContent === '');
}

console.log('== Details einer Quelle (Ansicht 3) ==');
{
  /* In Ansicht 3 stehen die Quellen als eigene Kästen — der Detailbereich zeigt
     dann nicht ein Geschäftsobjekt, sondern wer aus der Quelle versorgt wird. */
  api.setView(3);
  const q = S.graph.nodes.find(n => n.kind === 'source' && !n.hidden);
  t('Ansicht 3 zeigt Quellen als eigene Kästen', !!q, q && q.name);
  if(q){
    api.setSelection([q.id]);
    const html = document.getElementById('detailBody').innerHTML;
    t('der Detailbereich weist sie als Quelle aus', /QUELLE/.test(html));
    t('und listet, wen sie versorgt', /VERSORGT/.test(html) && /data-goto="o:/.test(html));
  }
  api.setSelection([]);
  api.setView(1);
}

finish();
})();
