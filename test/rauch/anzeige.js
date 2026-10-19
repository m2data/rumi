/* Rauchtest: Anzeige und Seitenleiste — Start, Inhaltsauswahl, Prüfliste
   (Gruppen, Sprung zum Objekt), Objektliste, Kastengeometrie, Herkunft. */
const {bootApp, makeT} = require('./start');

(async ()=>{
const {S, api, document, svg, dispatch, html} = await bootApp();
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
  api.setView();
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
  api.setView();
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

  /* Die Klickfläche des Pfeils wird beim Zuklappen gedreht. Sie muss dabei
     liegen bleiben, sonst zielt man beim Wiederaufklappen ins Leere: ohne
     eigene Maße erbte der Pfeil flex:1 von „.olist button", wurde so breit wie
     die Zeile, und die Drehung stellte diesen Streifen hochkant quer über die
     Liste. Geprüft wird am Rohtext — das Mini-DOM wirft <style> weg und rechnet
     ohnehin kein Layout. */
  const regel = (html.match(/\.olist \.gcaret\{[^}]*\}/) || [''])[0];
  t('der Klapp-Pfeil hat eigene Maße im Listenkontext', !!regel, regel);
  const breite = (regel.match(/[^-]width:(\d+)px/) || [])[1];
  const hoehe  = (regel.match(/[^-]height:(\d+)px/) || [])[1];
  t('sie sind quadratisch — gedreht bleibt die Fläche deckungsgleich',
    !!breite && breite === hoehe, breite + '×' + hoehe);
  t('und der Pfeil wächst nicht auf Zeilenbreite mit',
    /flex:0 0 auto/.test(regel), regel);
}

console.log('== Suche greift über den Objektnamen hinaus ==');
{
  api.setView();
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

  // Quelle als eigener Kasten: trifft über sein Objekt, nicht über fremde
  api.setMode('komplett');
  dispatch(document.getElementById('optQuelle'), 'click', {});
  suche('pflanzabstand');
  const hell = [...document.getElementById('nodes').querySelectorAll('.node')]
    .filter(g => !(g.getAttribute('class') || '').includes('faded'))
    .map(g => S.graph.byId.get(g.dataset.id));
  const q3 = hell.filter(n => n.eltern);
  t('Quellenkasten trifft über sein Objekt', q3.length > 0 && q3.every(n => n.eltern === 'o:Produkt'),
    q3.map(n => n.id).join(','));

  suche('');                                   // Filter zurücksetzen
  dispatch(document.getElementById('optQuelle'), 'click', {});

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

console.log('== Suche: weitere Felder, ehrliche Zahl, Sprung, Ausgeblendete ==');
{
  api.setMode('komplett');
  api.setView();
  api.setSelection([]);
  const feld = document.getElementById('search');
  const suche = q =>{ feld.value = q; dispatch(feld, 'input', {}); };
  const hell = () => [...document.getElementById('nodes').querySelectorAll('.node')]
    .filter(g => !(g.getAttribute('class') || '').includes('faded'))
    .map(g => S.graph.byId.get(g.dataset.id));
  const namen = () => hell().filter(n => !n.eltern).map(n => n.name).sort().join(',');
  const hits = () => document.getElementById('searchHits').textContent;
  const objekte = () => S.graph.nodes.filter(n => !n.hidden && !n.eltern).length;

  // Was nicht im Kasten steht, wird trotzdem gefunden
  const O = S.model.objects;
  const attr = O.Produkt.attrs[0];
  const alt = {desc:O.Kunde.desc, extra:O.Kategorie.extra, aextra:attr.extra};
  O.Kunde.desc = 'Stammkunde mit Treuekarte';
  O.Kategorie.extra = Object.assign({}, alt.extra, {steward:'Frau Rabe'});
  attr.extra = Object.assign({}, alt.aextra, {klasse:['vertraulich']});
  suche('treuekarte');
  t('Beschreibung trifft ihr Objekt', namen() === 'Kunde', namen());
  suche('rabe');
  t('Zusatzfeld am Objekt trifft', namen() === 'Kategorie', namen());
  suche('vertraulich');
  t('Zusatzfeld am Attribut trifft (Liste)', namen() === 'Produkt', namen());
  O.Kunde.desc = alt.desc; O.Kategorie.extra = alt.extra; attr.extra = alt.aextra;

  // Quellenkästen werden hell, zählen aber nicht als eigene Treffer
  dispatch(document.getElementById('optQuelle'), 'click', {});
  suche('pflanzabstand');
  t('Quellenkasten bleibt hell', hell().some(n => n.eltern === 'o:Produkt'));
  t('zählt aber nicht mit', hits() === '1/' + objekte(), hits());
  suche('');
  dispatch(document.getElementById('optQuelle'), 'click', {});

  // Eine Auswahl blendet keine Treffer aus
  suche('kunde');
  const treffer = hell().map(n => n.id);
  const nachbarn = id => new Set(S.graph.edges.flatMap(e => e.from === id ? [e.to] : e.to === id ? [e.from] : []));
  const fern = S.graph.nodes.filter(n => !n.hidden && !n.eltern)
    .map(n => ({n, aus: treffer.filter(h => h !== n.id && !nachbarn(n.id).has(h)).length}))
    .sort((a,b) => b.aus - a.aus)[0];
  t('Prüffall: ein Treffer liegt außerhalb der Nachbarschaft', fern.aus > 0);
  api.setSelection([fern.n.id]);
  suche('kunde');
  const nachher = hell().map(n => n.id);
  t('mit Auswahl bleiben alle Treffer hell', treffer.every(h => nachher.includes(h)),
    treffer.filter(h => !nachher.includes(h)).join(','));
  api.setSelection([]);

  // Springen: Enter vor, Umschalt+Enter zurück, im Kreis
  suche('kunde');
  const reihe = S.graph.nodes.filter(n => !n.hidden && !n.eltern && treffer.includes(n.id))
    .sort((a,b) => a.y - b.y || a.x - b.x);
  const N = reihe.length;
  dispatch(feld, 'keydown', {key:'Enter'});
  t('Enter wählt den ersten Treffer', S.selected === reihe[0].id, S.selected + ' statt ' + reihe[0].id);
  t('Anzeige nennt die Stelle', hits() === '1 von ' + N, hits());
  const r = svg.getBoundingClientRect(), n0 = reihe[0];
  const mx = (n0.x + n0.w/2) * S.t.k + S.t.x, my = (n0.y + n0.h/2) * S.t.k + S.t.y;
  t('und holt ihn in die Mitte', Math.abs(mx - r.width/2) < 1 && Math.abs(my - r.height/2) < 1, mx + ',' + my);
  t('der Suchbegriff bleibt stehen', S.filter === 'kunde' && feld.value === 'kunde');
  dispatch(feld, 'keydown', {key:'Enter', shiftKey:true});
  t('Umschalt+Enter springt im Kreis zum letzten', S.selected === reihe[N-1].id && hits() === N + ' von ' + N, hits());
  dispatch(document.getElementById('searchNext'), 'click', {});
  t('▶ springt im Kreis zum ersten', S.selected === reihe[0].id, S.selected);
  dispatch(document.getElementById('searchPrev'), 'click', {});
  t('◀ springt zurück', S.selected === reihe[N-1].id, S.selected);
  if(N === 1) t('Prüffall: mehr als ein Treffer', false);
  api.setSelection([]);
  t('ohne Auswahl wieder Zahl statt Stelle', hits() === N + '/' + objekte(), hits());

  // Einpassen: alle Treffer im Ausschnitt
  S.t.k = 4; S.t.x = -5000; S.t.y = -5000;
  dispatch(document.getElementById('searchFit'), 'click', {});
  const drin = reihe.every(n => n.x * S.t.k + S.t.x >= 0 && (n.x + n.w) * S.t.k + S.t.x <= r.width
                             && n.y * S.t.k + S.t.y >= 0 && (n.y + n.h) * S.t.k + S.t.y <= r.height);
  t('⤢ bringt alle Treffer in den Ausschnitt', drin, JSON.stringify(S.t));

  // Ausgeblendete Treffer: in der Objektliste und als Zahl
  suche('');
  const chk = id => [...document.getElementById('objectList').querySelectorAll('.ochk')].find(c => c.dataset.id === id);
  const aus = chk('o:Produkt');
  aus.checked = false; dispatch(aus, 'change', {});
  suche('pflanzabstand');
  t('ausgeblendeter Treffer wird gemeldet', hits() === '0/' + objekte() + ' +1 ausgeblendet', hits());
  const zeilen = [...document.getElementById('objectList').querySelectorAll('button[data-id]')].map(b => b.dataset.id);
  t('die Objektliste zeigt nur die Treffer', zeilen.join(',') === 'o:Produkt', zeilen.join(','));
  const ein = chk('o:Produkt');
  ein.checked = true; dispatch(ein, 'change', {});
  t('das Häkchen holt ihn ins Bild', !S.graph.byId.get('o:Produkt').hidden && hits() === '1/' + objekte(), hits());
  suche('');
  const alleZeilen = document.getElementById('objectList').querySelectorAll('button[data-id]').length;
  t('ohne Suchbegriff wieder die ganze Liste', alleZeilen === S.graph.nodes.filter(n => !n.eltern && !n.abgeleitet).length,
    alleZeilen + '');
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
    api.setView();
    S.graph.nodes.filter(n=>n.kind!=='source').forEach(n=>{
      const d = tief(n);
      if(d < schlimmster){ schlimmster = d; wo = name + '/' + n.name; }
    });
  });
  t('Abstand Text zu Kastenrand mindestens 5 px', schlimmster >= 5, schlimmster + ' px bei ' + wo);
  S.content[1] = {};
  api.setView();
}

console.log('== Herkunft: Metadaten gelesen, aber nicht angezeigt ==');
{
  const m = S.model.meta;
  t('Modellkopf gelesen', !!(m && m.urheber && m.lizenz), m ? m.urheber + ' / ' + m.lizenz : 'fehlt');
  const box = document.getElementById('herkunft');
  t('Herkunft nicht in der Seitenleiste angezeigt', box.hidden === true && box.textContent === '');
}

console.log('== Details einer Quelle und einer Domäne als eigener Kasten ==');
{
  /* Steht Quelle bzw. Domäne als eigener Kasten, zeigt der Detailbereich nicht
     ein Geschäftsobjekt, sondern wer aus der Quelle versorgt wird bzw. welche
     Objekte in der Domäne liegen. */
  api.setMode('komplett');
  dispatch(document.getElementById('optQuelle'), 'click', {});
  dispatch(document.getElementById('optDomaene'), 'click', {});
  const q = S.graph.nodes.find(n => n.kind === 'source' && !n.hidden);
  const d = S.graph.nodes.find(n => n.kind === 'domain' && !n.hidden);
  t('Quellen stehen als eigene Kästen', !!q, q && q.name);
  t('Domänen stehen als eigene Kästen', !!d, d && d.name);
  if(q){
    api.setSelection([q.id]);
    const html = document.getElementById('detailBody').innerHTML;
    t('der Detailbereich weist sie als Quelle aus', /QUELLE/.test(html));
    t('und listet, wen sie versorgt', /VERSORGT/.test(html) && /data-goto="o:/.test(html));
  }
  if(d){
    api.setSelection([d.id]);
    const html = document.getElementById('detailBody').innerHTML;
    t('der Detailbereich weist sie als Domäne aus', /DOMÄNE/.test(html));
    t('und listet ihre Objekte', (html.match(/data-goto="o:/g) || []).length === 11);
  }
  api.setSelection([]);
  dispatch(document.getElementById('optQuelle'), 'click', {});
  dispatch(document.getElementById('optDomaene'), 'click', {});
}

console.log('== Detailbereich ohne eingehende Beziehungen ==');
{
  /* Eingehende Beziehungen stehen nicht mehr im Detailbereich; ob es zu ihnen
     einen Fremdschlüssel gibt, sagt die Prüfung. */
  api.setMode('komplett');
  const ziel = S.graph.nodes.find(n => n.kind === 'object' && !n.hidden
    && Object.values(S.model.objects).some(o => o.rels.some(r => r.to === n.name)));
  t('ein Objekt mit eingehender Beziehung ist sichtbar', !!ziel);
  if(ziel){
    api.setSelection([ziel.id]);
    const html = document.getElementById('detailBody').innerHTML;
    t('der Detailbereich zeigt keine eingehenden Beziehungen', !/EINGEHEND/.test(html), ziel.name);
    t('die ausgehenden bleiben', /BEZIEHUNGEN AUSGEHEND/.test(html));
  }
  api.setSelection([]);
}

console.log('== Zweiter Klick in der Objektliste hebt die Auswahl auf ==');
{
  /* Über den Kasten läuft das Abwählen durch endPointer, über die Liste durch
     select() — ein eigener Zweig, der bisher durch keinen Test lief. */
  api.setView();
  api.setSelection([]);
  const zeile = id => [...document.getElementById('objectList').querySelectorAll('button[data-id]')]
    .find(b => b.dataset.id === id);
  const sicht = S.graph.nodes.filter(n => !n.hidden);
  const [a, b] = sicht;

  dispatch(zeile(a.id), 'click', {});
  t('ein Klick in der Liste wählt das Objekt', S.sel.has(a.id) && S.sel.size === 1,
    '[' + [...S.sel].join(', ') + ']');
  dispatch(zeile(a.id), 'click', {});
  t('derselbe Eintrag noch einmal hebt die Auswahl auf', S.sel.size === 0,
    '[' + [...S.sel].join(', ') + ']');

  dispatch(zeile(a.id), 'click', {});
  dispatch(zeile(b.id), 'click', {});
  t('ein anderer Eintrag schaltet um statt aufzuheben',
    S.sel.has(b.id) && !S.sel.has(a.id) && S.sel.size === 1,
    '[' + [...S.sel].join(', ') + ']');
  dispatch(zeile(a.id), 'click', {ctrlKey:true});
  t('mit Strg kommt er dazu', S.sel.has(a.id) && S.sel.has(b.id),
    '[' + [...S.sel].join(', ') + ']');
  api.setSelection([]);
}

console.log('== Beschreibung in den Details ==');
t('Zeilenumbrüche der Beschreibung bleiben in den Details stehen',
  /\.descbox\{[^}]*white-space:pre-wrap/.test(html));

console.log('== Modus-Knöpfe ==');
{
  const knopf = m => document.querySelector(`.mode-btn[data-mode="${m}"]`).textContent;
  t('die Knöpfe heißen Geschäftsobjekte, GO-Hierarchie, Quelltabellen',
    knopf('komplett') === 'Geschäftsobjekte' && knopf('hierarchie') === 'GO-Hierarchie' && knopf('quellen') === 'Quelltabellen',
    [knopf('komplett'), knopf('hierarchie'), knopf('quellen')].join(' | '));
}

console.log('== Meldungen: längere bleiben bis zur Bestätigung ==');
{
  const box = document.getElementById('toast');
  box.textContent = '';
  const zeilen = ()=> box.querySelectorAll('.toast-msg');
  api.toast('Erste lange Meldung', 6000);
  api.toast('Zweite lange Meldung', 4000);
  t('zwei lange Meldungen stehen beide da', zeilen().length === 2
    && /Erste lange/.test(box.textContent) && /Zweite lange/.test(box.textContent), box.innerHTML);
  t('die neueste steht unten', /Zweite/.test(zeilen()[1].textContent));
  t('jede lange hat einen OK-Knopf', zeilen().every(z => z.querySelector('.toast-ok')));
  api.toast('Erste lange Meldung', 6000);
  t('derselbe Text steht nur einmal da, jetzt unten',
    zeilen().length === 2 && /Erste/.test(zeilen()[1].textContent), box.innerHTML);
  api.toast('kurz');
  api.toast('noch kürzer');
  t('eine kurze hat keinen OK-Knopf, und kurze ersetzen einander',
    zeilen().length === 3 && !zeilen()[2].querySelector('.toast-ok') && !/kurz</.test(box.innerHTML)
    && /noch kürzer/.test(box.textContent), box.innerHTML);
  const ok = zeilen()[0].querySelector('.toast-ok');
  dispatch(ok, 'click', {});
  t('OK nimmt die Meldung weg', zeilen().length === 2 && !/Zweite lange/.test(box.textContent), box.innerHTML);
  // Das Mini-DOM verwirft <script>-Blöcke; den Platzhalter fürs Einbacken nachreichen
  const baked = document.createElement('script');
  baked.setAttribute('id', 'bakedState');
  baked.textContent = 'null';
  document.body.appendChild(baked);
  const gesichert = api.standAlsHtml();
  t('eine gesicherte HTML enthält keine Meldung', !/Erste lange Meldung/.test(gesichert));
  t('danach steht sie wieder da', /Erste lange Meldung/.test(box.textContent), box.innerHTML);
  dispatch(box.querySelector('.toast-ok'), 'click', {});
  t('auch nach dem Sichern lässt sie sich bestätigen', !/Erste lange/.test(box.textContent), box.innerHTML);
}

finish();
})();
