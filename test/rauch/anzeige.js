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

finish();
})();
