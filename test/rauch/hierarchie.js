/* Rauchtest: Hierarchie-Modus — Baum, Diagramm-Ausschnitte, Beschreibung
   bearbeiten, Struktur ändern (anlegen/umbenennen/verschieben), verknüpfte
   Objekte holen, Übersicht laden, Markdown im Export. */
const {bootApp, makeT} = require('./start');

(async ()=>{
const {S, api, document, svg, dispatch} = await bootApp();
const {t, finish} = makeT();

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

finish();
})();
