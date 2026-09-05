/* Rauchtest: Hierarchie-Modus — Baum, Diagramm-Ausschnitte, Beschreibung
   bearbeiten, Struktur ändern (anlegen/umbenennen/verschieben), verknüpfte
   Objekte holen, Übersicht laden, Markdown im Export. */
const {bootApp, makeT} = require('./start');

(async ()=>{
const {S, api, document, svg, dispatch} = await bootApp();
const {t, finish} = makeT();

console.log('== Start zeigt die oberste Stufe der Hierarchie ==');
{
  // Direkt nach dem Booten geprüft, bevor ein Test den Modus umstellt.
  t('der Start steht im Hierarchie-Modus', S.mode === 'hierarchie', S.mode);
  const oben = S.outline && S.outline.roots[0];
  t('gewählt ist die oberste Stufe', !!oben && S.hierSel === oben.id,
    S.hierSel + ' statt ' + (oben && oben.id));
  t('im Baum ist sie markiert',
    !!document.querySelector('.dnode.sel') &&
    document.querySelector('.dnode.sel').dataset.id === S.hierSel);
  const sichtbar = S.graph.nodes.filter(n => !n.hidden).map(n => n.name).sort();
  t('gezeigt werden die Objekte der obersten Stufe',
    !!oben && JSON.stringify(sichtbar) === JSON.stringify(oben.objekte.slice().sort()),
    sichtbar.join(','));

  /* Sind die Schriften geladen, wird neu gemessen. Das lief über setView() und
     hob den Ausschnitt wieder auf: kurz nach dem Start standen plötzlich alle
     Objekte im Diagramm. Im Mini-DOM gibt es kein document.fonts, deshalb
     direkt gerufen. */
  api.nachSchriftMessen();
  const danach = S.graph.nodes.filter(n => !n.hidden).map(n => n.name).sort();
  t('Neu messen nach dem Schriftladen behält den Ausschnitt',
    JSON.stringify(danach) === JSON.stringify(sichtbar), danach.join(','));
}

console.log('== Hierarchie-Modus: Baum, Ausschnitt, Beschreibung ==');
{
  api.setMode('hierarchie');
  t('Modus ist Hierarchie', S.mode === 'hierarchie');
  t('Baum sichtbar, Beschreibung-Reiter aktiv',
    document.getElementById('hierTree').hidden === false
    && !!document.querySelector('.sidetab[data-pane="beschreibung"][aria-selected="true"]'));
  const rows = document.getElementById('hierTree').querySelectorAll('.dnode');
  t('Baum zeigt mehrere Diagramme', rows.length >= 4, rows.length + ' Knoten');
  const ziel = [...rows].find(r => r.dataset.id.endsWith('›Lieferung'));
  t('Unterdiagramm „Lieferung“ im Baum', !!ziel, ziel && ziel.dataset.id);
  if(ziel){
    api.selectDiagram(ziel.dataset.id);
    const sichtbar = S.graph.nodes.filter(n => !n.hidden).map(n => n.name).sort();
    t('nur die Objekte des Diagramms sichtbar',
      JSON.stringify(sichtbar) === JSON.stringify(['Bestellung','Kunde','Lieferadresse','Lieferung','Position']),
      sichtbar.join(','));
    t('Beschreibung zum gewählten Diagramm angezeigt',
      (document.querySelector('.hd-title') || {}).textContent === 'Lieferung'
      && (document.querySelector('.hd-text') || {}).textContent.length > 0);

    // Inhalt einblenden darf den Ausschnitt nicht auf alle Objekte aufblähen
    {
      const cbtn = document.getElementById('contentList').querySelectorAll('[data-content]')[0];
      t('Inhalt-Schaltfläche vorhanden', !!cbtn);
      if(cbtn){
        cbtn.onclick();
        t('Inhalt umschalten behält den Diagramm-Ausschnitt',
          S.graph.nodes.filter(n => !n.hidden).length === 5,
          S.graph.nodes.filter(n => !n.hidden).length + ' sichtbar');
      }
    }

    // Editierbar wie die Komplettansicht: Knoten ziehen, je Diagramm gemerkt
    const g = document.getElementById('nodes').querySelectorAll('.node')[0];
    const node = S.graph.byId.get(g.dataset.id);
    const nodeId = node.id, ox = node.x;
    dispatch(g, 'pointerdown', {clientX:120, clientY:120});
    dispatch(svg, 'pointermove', {clientX:230, clientY:190});
    dispatch(svg, 'pointerup', {});
    t('Knoten im Diagramm verschiebbar', node.x !== ox, ox + ' → ' + node.x);
    const merk = S.hierSaved[S.hierSel] && S.hierSaved[S.hierSel][nodeId];
    t('Anordnung je Diagramm gemerkt', merk && Math.abs(merk.x - node.x) < 0.5);
    // anderes Diagramm und zurück: Position bleibt erhalten
    api.selectDiagram('Übersicht');
    api.selectDiagram(ziel.dataset.id);
    const wieder = S.graph.byId.get(nodeId);
    t('gemerkte Anordnung überlebt den Diagrammwechsel',
      wieder && merk && Math.abs(wieder.x - merk.x) < 0.5, (merk && merk.x) + ' → ' + (wieder && wieder.x));

    // Reiter „Objekte“: ALLE Objekte zur Auswahl, angehakt = im Diagramm
    const listBtns = document.getElementById('objectList').querySelectorAll('button[data-id]');
    t('Objektliste bietet alle Objekte zur Auswahl', listBtns.length === 11, listBtns.length + '');
    const zeilen = document.getElementById('objectList').querySelectorAll('li.row');
    const aktiv = [...zeilen].filter(li => !li.classList.contains('off')).length;
    t('nur die Diagramm-Objekte sind angehakt', aktiv === 5, aktiv + ' von ' + zeilen.length);
    dispatch(listBtns[0], 'click', {});
    const db = document.getElementById('detailBody');
    t('Details-Reiter zeigt das gewählte Objekt', !db.hidden && db.textContent.length > 0);

    // Weiteres GO ins Diagramm holen (Objekt, das nicht in der YAML-Liste steht)
    const chkNeu = [...document.getElementById('objectList').querySelectorAll('.ochk')].find(c => !c.checked);
    const neuId = chkNeu.dataset.id;
    chkNeu.checked = true; dispatch(chkNeu, 'change', {});
    t('weiteres Objekt ins Diagramm geholt',
      S.graph.byId.get(neuId).hidden === false
      && (S.hierShown[S.hierSel] || []).includes(neuId) && !S.hidden.has(neuId));
    api.selectDiagram('Übersicht'); api.selectDiagram(ziel.dataset.id);
    t('hinzugeholtes Objekt bleibt im Diagramm', S.graph.byId.get(neuId).hidden === false);
    const chkWeg = [...document.getElementById('objectList').querySelectorAll('.ochk')].find(c => c.dataset.id === neuId);
    if(chkWeg){ chkWeg.checked = false; dispatch(chkWeg, 'change', {}); }   // zurücksetzen

    // Beschreibung in der App bearbeiten: leichtes Markdown, gespeichert, gerendert
    const beschrTab = [...document.querySelectorAll('.sidetab')].find(s => s.dataset.pane === 'beschreibung');
    dispatch(beschrTab, 'click', {});
    dispatch(document.getElementById('hdEdit'), 'click', {});
    const area = document.getElementById('hdArea');
    t('Bearbeiten öffnet ein Textfeld', !!area);
    if(area){
      area.value = '# Lieferkette\n\nEin **wichtiger** Ablauf.';
      dispatch(document.getElementById('hdSave'), 'click', {});
      t('Beschreibung gespeichert', S.hierText[S.hierSel] === '# Lieferkette\n\nEin **wichtiger** Ablauf.');
      const rendered = document.querySelector('.hd-text').innerHTML;
      t('Markdown gerendert (Überschrift + fett)',
        rendered.includes('<h2>Lieferkette</h2>') && rendered.includes('<strong>wichtiger</strong>'));
      api.selectDiagram('Übersicht'); api.selectDiagram(ziel.dataset.id);
      t('bearbeitete Beschreibung überlebt den Diagrammwechsel',
        S.hierText[ziel.dataset.id] === '# Lieferkette\n\nEin **wichtiger** Ablauf.');
      // Export trägt Titel und Beschreibung des Diagramms
      const svgOut = api.exportSVG();
      t('SVG-Export enthält Titel und Beschreibung',
        svgOut.includes('hx-ttl') && svgOut.includes('>Lieferung<')
        && svgOut.includes('hx-dsc') && svgOut.includes('Lieferkette'));
    }

    // Struktur bearbeiten: Unterdiagramm anlegen, umbenennen, löschen
    const dId = api.outlineAdd('Übersicht', 'Testthema');
    t('Unterdiagramm angelegt und gewählt', dId === 'Übersicht›Testthema' && S.hierSel === dId);
    t('Baum zeigt das neue Diagramm',
      !!document.querySelector('#hierTree .dnode[data-id="Übersicht›Testthema"]'));
    api.outlineRename(dId, 'Umbenannt');
    t('Diagramm umbenannt', S.hierSel === 'Übersicht›Umbenannt'
      && !!document.querySelector('#hierTree .dnode[data-id="Übersicht›Umbenannt"]'));
    t('Struktur landet im Übersicht-YAML', S.outlineText.includes('Umbenannt'));
    api.outlineDelete('Übersicht›Umbenannt');
    t('Diagramm gelöscht', !document.querySelector('#hierTree .dnode[data-id="Übersicht›Umbenannt"]')
      && !S.outlineText.includes('Umbenannt'));

    // Struktur per Verschieben ändern (umhängen + umsortieren)
    const findNode = id => { let r = null; (function w(l){ (l||[]).forEach(n=>{ if(n.id === id) r = n; w(n.kinder); }); })(S.outline.roots); return r; };
    S.hierSaved['Übersicht›roadshow'] = {'o:Kunde':{x:1, y:2}};
    api.outlineMove('Übersicht›roadshow', 'Übersicht›webshop', 'inside');
    t('Diagramm umgehängt (neue Kennung unter dem Ziel)',
      !!findNode('Übersicht›webshop›roadshow') && !findNode('Übersicht›roadshow'));
    t('gespeicherte Anordnung wandert auf die neue Kennung',
      !!S.hierSaved['Übersicht›webshop›roadshow'] && !S.hierSaved['Übersicht›roadshow']);
    api.outlineMove('Übersicht›webshop›roadshow', 'Übersicht›webshop', 'before');
    const order = findNode('Übersicht').kinder.map(n => n.name);
    t('davor eingeordnet (Reihenfolge/Ebene geändert)',
      order.indexOf('roadshow') > -1 && order.indexOf('roadshow') < order.indexOf('webshop'), order.join(','));
    api.undo();
    t('Baum-Verschiebung rückgängig', !!findNode('Übersicht›webshop›roadshow') && !findNode('Übersicht›roadshow'));
    api.redo();
    t('Baum-Verschiebung wiederhergestellt', !!findNode('Übersicht›roadshow') && !findNode('Übersicht›webshop›roadshow'));
  }
  api.setMode('komplett');
  t('zurück in Komplettansicht mit allen Objekten',
    S.mode === 'komplett' && S.graph.nodes.filter(n => !n.hidden).length === 11);
}

console.log('== Verknüpfte Objekte ins Diagramm holen ==');
{
  api.setMode('hierarchie');
  S.layout.algo = 'hier';
  // an Bestellung verankern, Ausschnitt zunächst nur Bestellung -> „zu 1" (Kunde)
  // und „zu n" (Kinder) sind versteckt und werden beide platziert.
  const manySide = nid => S.graph.edges.some(e =>
    (e.from === 'o:Bestellung' && e.to === nid && /many/.test(e.toCard || '')) ||
    (e.to === 'o:Bestellung' && e.from === nid && /many/.test(e.fromCard || '')));

  const probe = (dir)=>{
    S.hierShown['Übersicht'] = ['o:Bestellung'];
    S.layout.dir = dir;
    api.selectDiagram('Übersicht');
    api.addRelated('o:Bestellung');
    const B = S.graph.byId.get('o:Bestellung');
    const neu = S.graph.nodes.filter(n => !n.hidden && n.id !== 'o:Bestellung');
    let oben = 0, unten = 0, regel = neu.length > 0;
    neu.forEach(n=>{
      const istOben = n.y + n.h <= B.y, istUnten = n.y >= B.y + B.h;
      if(istOben) oben++; if(istUnten) unten++;
      // Flussanfang bei TB oben, bei BT unten
      const eins = dir === 'TB' ? istOben : istUnten;
      const viele = dir === 'TB' ? istUnten : istOben;
      if(manySide(n.id)){ if(!viele) regel = false; } else { if(!eins) regel = false; }
    });
    return {neu:neu.length, oben, unten, regel};
  };

  const tb = probe('TB');
  t('verknüpfte Objekte hinzugefügt', tb.neu > 0, tb.neu + ' neu');
  t('TB: zu 1 oberhalb, zu n unterhalb', tb.regel && tb.oben > 0 && tb.unten > 0,
    `oben ${tb.oben}, unten ${tb.unten}`);
  const bt = probe('BT');
  t('BT: Seiten gedreht (zu 1 unten, zu n oben)', bt.regel && bt.oben > 0 && bt.unten > 0,
    `oben ${bt.oben}, unten ${bt.unten}`);

  // Objekt selbst wird mitgeholt, wenn es noch nicht im Diagramm ist
  S.hierShown['Übersicht'] = [];
  S.layout.dir = 'TB';
  api.selectDiagram('Übersicht');
  t('Diagramm zunächst leer', S.graph.nodes.filter(n => !n.hidden).length === 0);
  api.addRelated('o:Bestellung');
  t('Objekt selbst wird mitgeholt', S.graph.byId.get('o:Bestellung').hidden === false);
  t('und die verknüpften Objekte dazu', S.graph.nodes.filter(n => !n.hidden).length > 1);

  api.setMode('komplett');
}

console.log('== Verknüpfte Objekte bei waagrechter Flussrichtung ==');
{
  /* Dieselbe Regel um 90 Grad gedreht: bei LR steht die „zu 1"-Seite links,
     die „zu n"-Seite rechts. Das Platzieren dafür ist eigener Code und lief
     bisher durch keinen Test. */
  const vieleSeite = nid => S.graph.edges.some(e =>
    (e.from === 'o:Bestellung' && e.to === nid && /many/.test(e.toCard || '')) ||
    (e.to === 'o:Bestellung' && e.from === nid && /many/.test(e.fromCard || '')));
  S.hierShown['Übersicht'] = ['o:Bestellung'];
  S.layout.dir = 'LR';
  api.selectDiagram('Übersicht');
  api.addRelated('o:Bestellung');
  const B = S.graph.byId.get('o:Bestellung');
  const neu = S.graph.nodes.filter(n => !n.hidden && n.id !== 'o:Bestellung');
  t('LR: verknüpfte Objekte hinzugefügt', neu.length > 0, neu.length + ' neu');
  const links = neu.filter(n => n.x + n.w <= B.x);
  const rechts = neu.filter(n => n.x >= B.x + B.w);
  t('LR: die einen links, die anderen rechts vom Anker',
    links.length > 0 && rechts.length > 0, links.length + ' links, ' + rechts.length + ' rechts');
  t('LR: keins liegt über oder unter dem Anker',
    links.length + rechts.length === neu.length,
    (neu.length - links.length - rechts.length) + ' daneben');
  t('LR: die „zu n"-Seite steht rechts', rechts.every(n => vieleSeite(n.id)),
    rechts.map(n => n.id).join(','));
  t('LR: die „zu 1"-Seite steht links', links.every(n => !vieleSeite(n.id)),
    links.map(n => n.id).join(','));
  S.layout.dir = 'TB';
}

console.log('== Hierarchiebeschreibung laden ==');
{
  const y = 'Testwurzel:\n  objekte:\n    - Kunde\n  Details:\n    Unterthema:\n      objekte:\n        - Bestellung\n';
  api.loadUebersicht(y);
  const roots = S.outline.roots;
  t('geladene Übersicht ersetzt die alte', roots.length === 1 && roots[0].name === 'Testwurzel',
    roots.map(r => r.name).join(','));
  t('geladene Struktur enthält das Unterthema',
    roots[0].kinder.length === 1 && roots[0].kinder[0].name === 'Unterthema');
  t('outlineText übernommen', S.outlineText.includes('Testwurzel'));
  t('Diagramm-Bearbeitungen zurückgesetzt',
    Object.keys(S.hierShown).length === 0 && Object.keys(S.hierSaved).length === 0);
}

console.log('== Export: Markdown in der Diagramm-Beschreibung wird formatiert ==');
{
  api.loadUebersicht('Übersicht:\n  beschreibung: x\n  objekte:\n    - Bestellung\n    - Position');
  api.setMode('hierarchie');
  const rootId = S.outline.roots[0].id;
  api.selectDiagram(rootId);
  S.hierText[rootId] = '# Kopf\nEin **fetter** und *kursiver* Text mit `code`.\n- Punkt';
  const out = api.exportSVG();
  t('Export: Überschrift wird größer gesetzt', /font-size="16"/.test(out), 'kein font-size=16');
  t('Export: fett als eigenes tspan', /font-weight="700"/.test(out));
  t('Export: kursiv als eigenes tspan', /font-style="italic"/.test(out));
  t('Export: Code in Monospace', /IBM Plex Mono, monospace/.test(out));
  t('Export: Listenpunkt mit Aufzählungszeichen', out.includes('•'));
  api.setMode('komplett'); api.setView(1);
}

console.log('== Werkzeugleiste über dem Baum ==');
{
  /* hierAction() fragt Namen über prompt/confirm ab — im Browser stellt die das
     Fenster, im Mini-DOM niemand. Hier werden sie gesetzt, sonst ist die ganze
     Werkzeugleiste vom Test aus nicht erreichbar. Geprüft wird gegen den Baum
     im Zustand, nicht gegen die gezeichneten Zeilen: ein zugeklapptes Diagramm
     zeigt seine Kinder nicht an, angelegt sind sie trotzdem. */
  api.setMode('hierarchie');
  api.loadUebersicht('Alpha:\n  objekte:\n    - Kunde\n  Details:\n    Beta:\n      objekte:\n        - Bestellung\nGamma:\n  objekte:\n    - Kunde\n');
  const werkzeug = h => [...document.getElementById('hierTools').querySelectorAll('[data-hact]')]
    .find(b => b.dataset.hact === h);
  const sammle = (liste, aus)=> liste.reduce((a,n)=> a.concat([n.id], sammle(n.kinder || [], aus)), []);
  const ids = ()=> sammle(S.outline.roots);

  let gefragt = null;
  global.prompt = (frage)=>{ gefragt = frage; return global.__antwort; };
  global.confirm = ()=> global.__ja !== false;

  global.__antwort = 'Testdomäne';
  werkzeug('add-top').click();
  t('＋ Domäne legt eine Domäne auf oberster Ebene an',
    ids().includes('Testdomäne'), ids().join(' | '));
  t('und fragt vorher nach dem Namen', /Domäne/.test(gefragt || ''), gefragt);

  api.selectDiagram('Testdomäne');
  global.__antwort = 'Unterthema';
  werkzeug('add-child').click();
  t('＋ Unterdiagramm hängt es unter das gewählte',
    ids().includes('Testdomäne›Unterthema'), ids().join(' | '));

  api.selectDiagram('Testdomäne›Unterthema');
  global.__antwort = 'Umbenannt';
  werkzeug('rename').click();
  t('Umbenennen wirkt auf das gewählte Diagramm',
    ids().includes('Testdomäne›Umbenannt'), ids().join(' | '));

  api.selectDiagram('Testdomäne');
  global.__ja = true;
  werkzeug('delete').click();
  t('Löschen nimmt das Diagramm samt Unterdiagrammen mit',
    !ids().some(id => id.startsWith('Testdomäne')), ids().join(' | '));

  // Abbrechen im Dialog darf nichts verändern
  global.__antwort = '';
  const vorher = ids().length;
  werkzeug('add-top').click();
  t('ein abgebrochener Dialog legt nichts an', ids().length === vorher);

  // Ohne gewähltes Diagramm sagt die Leiste Bescheid, statt stillzuhalten
  S.hierSel = null;
  werkzeug('rename').click();
  t('ohne Auswahl kommt ein Hinweis',
    /Erst ein Diagramm wählen/.test(document.getElementById('toast').textContent),
    document.getElementById('toast').textContent);
}

console.log('== Baum: klappen, wählen, per Ziehen umhängen ==');
{
  api.setMode('hierarchie');
  api.loadUebersicht('Alpha:\n  objekte:\n    - Kunde\n  Details:\n    Beta:\n      objekte:\n        - Bestellung\nGamma:\n  objekte:\n    - Kunde\n');
  const baum = document.getElementById('hierTree');
  const zeile = id => [...baum.querySelectorAll('.dnode')].find(r => r.dataset.id === id);
  const gezeigt = ()=> [...baum.querySelectorAll('.dnode')].map(r => r.dataset.id);
  const sammle = liste => liste.reduce((a,n)=> a.concat([n.id], sammle(n.kinder || [])), []);
  const ids = ()=> sammle(S.outline.roots);

  // Klick auf den Klapp-Pfeil: die Kinder verschwinden aus dem gezeichneten Baum
  api.selectDiagram('Alpha');
  const tw = zeile('Alpha') && zeile('Alpha').querySelector('[data-toggle]');
  t('ein Diagramm mit Kindern hat einen Klapp-Pfeil', !!tw, gezeigt().join(' | '));
  if(tw){
    dispatch(tw, 'click', {});
    t('Zuklappen nimmt die Kinder aus dem Baum', !gezeigt().includes('Alpha›Beta'),
      gezeigt().join(' | '));
    t('angelegt sind sie weiterhin', ids().includes('Alpha›Beta'));
    dispatch(zeile('Alpha').querySelector('[data-toggle]'), 'click', {});
    t('Aufklappen bringt sie zurück', gezeigt().includes('Alpha›Beta'), gezeigt().join(' | '));
  }

  // Klick auf die Zeile wählt das Diagramm
  dispatch(zeile('Gamma'), 'click', {});
  t('ein Klick auf die Zeile wählt das Diagramm', S.hierSel === 'Gamma', S.hierSel);

  /* Ziehen im Baum: obere Kante = davor, Mitte = als Unterdiagramm. Das
     Mini-DOM meldet für jede Zeile dieselbe Fläche (0/0, 1200×800) — die
     Trefferzone folgt also clientY: unter 224 „davor", über 576 „danach". */
  const dt = ()=> ({effectAllowed:'', setData(){}, getData(){ return ''; }});
  const ziehen = (von, nach, y)=>{
    dispatch(zeile(von), 'dragstart', {dataTransfer: dt()});
    dispatch(zeile(nach), 'dragover',  {dataTransfer: dt(), clientY: y});
    dispatch(zeile(nach), 'drop',      {dataTransfer: dt(), clientY: y});
  };

  ziehen('Gamma', 'Alpha', 400);                        // Mitte: als Unterdiagramm
  t('in die Mitte gezogen wird es zum Unterdiagramm',
    ids().includes('Alpha›Gamma'), ids().join(' | '));
  t('die Meldung nennt das verschobene Diagramm',
    /verschoben/.test(document.getElementById('toast').textContent),
    document.getElementById('toast').textContent);

  ziehen('Alpha›Gamma', 'Alpha', 40);                   // obere Kante: davor
  t('an die obere Kante gezogen landet es davor',
    ids().indexOf('Gamma') === 0 && ids().includes('Alpha'), ids().join(' | '));

  // Eine Zeile auf sich selbst zu ziehen darf den Baum nicht verändern
  const vorher = ids().join('|');
  ziehen('Alpha', 'Alpha', 400);
  t('auf sich selbst gezogen bleibt alles, wie es war', ids().join('|') === vorher,
    ids().join(' | '));
  api.setMode('komplett'); api.setView(1);
}

console.log('== Das Objekt selbst kommt unter die vorhandenen ==');
{
  /* Holt man verknüpfte Objekte zu einem Objekt, das selbst noch nicht im
     Diagramm ist, wird es mit eingeblendet — und zwar unter die vorhandenen
     gelegt. Geprüft war bisher nur der andere Fall: das leere Diagramm, wo es
     auf 0/0 landet. */
  api.setMode('hierarchie');
  api.loadUebersicht('Test:\n  objekte:\n    - Kunde\n');
  api.selectDiagram('Test');
  S.layout.dir = 'TB';
  const vorhanden = S.graph.nodes.filter(n => !n.hidden);
  t('genau ein Kasten liegt im Diagramm', vorhanden.length === 1,
    vorhanden.map(n => n.id).join(','));
  const x0 = Math.min(...vorhanden.map(n => n.x)), x1 = Math.max(...vorhanden.map(n => n.x + n.w));
  const y1 = Math.max(...vorhanden.map(n => n.y + n.h));

  api.addRelated('o:Bestellung');
  const A = S.graph.byId.get('o:Bestellung');
  t('das Objekt selbst ist eingeblendet', A.hidden === false);
  t('es liegt unter den vorhandenen', A.y === Math.round(y1 + 120), A.y + ' statt ' + Math.round(y1 + 120));
  t('und waagrecht in deren Mitte',
    A.x === Math.round((x0 + x1)/2 - A.w/2), A.x + ' statt ' + Math.round((x0 + x1)/2 - A.w/2));
  t('seine verknüpften Objekte kommen mit', S.graph.nodes.filter(n => !n.hidden).length > 2,
    S.graph.nodes.filter(n => !n.hidden).length + ' sichtbar');
}

console.log('== Rückgängig nimmt das gewählte Diagramm weg ==');
{
  /* Dann muss ein anderes gewählt werden — sonst zeigt die Auswahl auf ein
     Diagramm, das es nicht mehr gibt. */
  api.setMode('hierarchie');
  api.loadUebersicht('Eins:\n  objekte:\n    - Kunde\nZwei:\n  objekte:\n    - Bestellung\n');
  api.selectDiagram('Eins');
  api.outlineAdd(null, 'Drei');            // legt an und wählt gleich aus
  t('das neue Diagramm ist gewählt', S.hierSel === 'Drei', String(S.hierSel));

  /* Anlegen hinterlässt zwei Verlaufsschritte — erst die Struktur, dann der
     Ausschnitt des neu gewählten Diagramms. Zurück geht es entsprechend in zwei
     Schritten; hier zählt, was danach gewählt ist. */
  api.undo(); api.undo();
  const ids = S.outline.roots.map(r => r.id);
  t('zwei Schritte zurück nehmen es wieder weg', !ids.includes('Drei'), ids.join(' | '));
  t('die Auswahl zeigt auf ein vorhandenes Diagramm',
    !!S.hierSel && ids.includes(S.hierSel), String(S.hierSel));
  t('der Baum ist gezeichnet',
    document.getElementById('hierTree').querySelectorAll('.dnode').length === ids.length,
    document.getElementById('hierTree').querySelectorAll('.dnode').length + ' Zeilen');
}

console.log('== Export: Link und Zeilenumbruch in der Beschreibung ==');
{
  api.setMode('hierarchie');
  api.loadUebersicht('Thema:\n  objekte:\n    - Kunde\n');
  api.selectDiagram('Thema');
  const zaehle = s => (s.match(/<text/g) || []).length;

  S.hierText['Thema'] = 'Siehe [die Doku](https://example.org/doku) dazu.';
  const mitLink = api.exportSVG();
  t('der Link wird als eigener Abschnitt gesetzt',
    /text-decoration="underline"/.test(mitLink), 'keine Unterstreichung im Export');
  // im Export steht jedes Wort in einem eigenen tspan — deshalb wortweise prüfen
  t('sein Text steht im Export', mitLink.includes('Doku') && mitLink.includes('Siehe'));
  t('die Adresse selbst wird nicht mitgedruckt', !mitLink.includes('example.org'));

  S.hierText['Thema'] = 'Kurz.';
  const kurz = zaehle(api.exportSVG());
  const lang = 'Ein Absatz ohne jeden Zeilenumbruch, der so lang gerät, dass er '
    + 'in mehrere Zeilen gebrochen werden muss, weil er sonst weit über den Rand '
    + 'des Diagramms hinausliefe und niemand ihn mehr lesen könnte.';
  S.hierText['Thema'] = lang;
  const out = api.exportSVG();
  t('ein langer Absatz wird umbrochen', zaehle(out) >= kurz + 2,
    kurz + ' → ' + zaehle(out) + ' Textzeilen');
  t('dabei geht kein Wort verloren',
    lang.split(/\s+/).every(w => out.includes(w.replace(/[.,]$/, ''))),
    lang.split(/\s+/).find(w => !out.includes(w.replace(/[.,]$/, ''))));
  api.setMode('komplett'); api.setView(1);
}

finish();
})();
