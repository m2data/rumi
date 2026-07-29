/* =====================================================================
   11 — Hierarchie: redaktionelle Diagramme
   Liest die Übersicht (Baum aus Diagrammen) und normalisiert sie zu Knoten
   mit stabiler Kennung, Beschreibung, Objektliste und Kindern. Jeder Knoten
   ist ein Diagramm: ein Ausschnitt des Modells mit erklärendem Text.
   ===================================================================== */
function buildOutline(text, model){
  const {doc, notes} = readYaml(text);
  const messages = notes.slice();
  const known = model && model.objects ? new Set(Object.keys(model.objects)) : null;
  const TRENNER = '›';                       // › im Pfad, wie edgeKey es nutzt

  function node(name, raw, pfad){
    const def = (raw && typeof raw === 'object') ? raw : {};
    const liste = Array.isArray(def.objekte) ? def.objekte
                : Array.isArray(def.objects) ? def.objects : [];
    const objekte = liste.filter(Boolean).map(String);
    if(known) objekte.forEach(o=>{
      if(!known.has(o)) messages.push({level:'warn', title:`${name}: Objekt „${o}“ unbekannt`,
        body:`„${o}“ ist im Modell nicht definiert und erscheint im Diagramm nicht.`});
    });
    const id = pfad.concat(name).join(TRENNER);
    const kinderRaw = def.Details || def.details || def.kinder || null;
    const kinder = (kinderRaw && typeof kinderRaw === 'object' && !Array.isArray(kinderRaw))
      ? Object.entries(kinderRaw).map(([k, v]) => node(k, v, pfad.concat(name)))
      : [];
    return {
      id, name,
      beschreibung: def.beschreibung || def.text || def.description || '',
      objekte, kinder
    };
  }

  const roots = (doc && typeof doc === 'object' && !Array.isArray(doc))
    ? Object.entries(doc).map(([k, v]) => node(k, v, []))
    : [];
  return {roots, messages};
}

/* Knoten im Baum anhand seiner Kennung finden. */
function outlineFind(roots, id){
  const stack = [...roots];
  while(stack.length){
    const n = stack.pop();
    if(n.id === id) return n;
    stack.push(...n.kinder);
  }
  return null;
}

/* Alle Knoten in Anzeigereihenfolge (Tiefensuche), z. B. für „erstes Diagramm“. */
function outlineFlat(roots){
  const out = [];
  const walk = ns => ns.forEach(n=>{ out.push(n); walk(n.kinder); });
  walk(roots);
  return out;
}

/* ---------- Übersicht aus dem eingebetteten/geladenen YAML aufbauen ---------- */
function parseOutline(){
  if(!S.outlineText) S.outlineText = (typeof DEFAULT_UEBERSICHT !== 'undefined') ? DEFAULT_UEBERSICHT : '';
  S.outline = buildOutline(S.outlineText, S.model);
  // Ordner anfangs aufgeklappt
  S.hierOpen = new Set(outlineFlat(S.outline.roots).filter(n => n.kinder.length).map(n => n.id));
}

/* ---------- Baum links oben ---------- */
function renderOutlineTree(){
  const box = $('hierTree');
  if(!S.outline){ box.innerHTML = ''; return; }
  const twig = (node, depth)=>{
    const kids = node.kinder.length;
    const open = S.hierOpen.has(node.id);
    const sel = node.id === S.hierSel;
    let s = `<div class="dnode${sel ? ' sel' : ''}" data-id="${esc(node.id)}" role="treeitem"`
          + ` aria-selected="${sel}" style="padding-left:${6 + depth * 15}px">`;
    s += kids
      ? `<span class="tw" data-toggle="${esc(node.id)}">${open ? '▾' : '▸'}</span>`
      : `<span class="tw leaf">·</span>`;
    s += `<span class="lbl">${esc(node.name)}</span>`;
    s += `<span class="cnt">${node.objekte.length}</span></div>`;
    if(kids && open) s += node.kinder.map(k => twig(k, depth + 1)).join('');
    return s;
  };
  box.innerHTML = S.outline.roots.map(r => twig(r, 0)).join('');
}

/* ---------- Beschreibung links unten (Phase 2: schlichter Text) ---------- */
function renderOutlineDesc(){
  const box = $('hierDesc');
  const node = S.hierSel && S.outline ? outlineFind(S.outline.roots, S.hierSel) : null;
  if(!node){ box.innerHTML = '<div class="empty">Ein Diagramm in der Hierarchie wählen.</div>'; return; }
  const txt = (node.beschreibung || '').trim();
  const abs = txt
    ? '<p>' + esc(txt).replace(/\n\n+/g, '</p><p>').replace(/\n/g, '<br>') + '</p>'
    : '<div class="empty">Noch keine Beschreibung.</div>';
  box.innerHTML = `<h2 class="hd-title">${esc(node.name)}</h2><div class="hd-text">${abs}</div>`;
}

/* ---------- Ordner auf-/zuklappen ---------- */
function toggleOutline(id){
  if(S.hierOpen.has(id)) S.hierOpen.delete(id); else S.hierOpen.add(id);
  renderOutlineTree();
}

/* ---------- Diagramm wählen: Ausschnitt zeichnen ---------- */
function selectDiagram(id){
  S.hierSel = id;
  renderOutlineTree();
  renderOutlineDesc();
  const node = id && S.outline ? outlineFind(S.outline.roots, id) : null;
  if(node) showDiagram(node);
}

/* Nur die Objekte des Knotens zeigen, Darstellung wie Ansicht 1. Eine einmal
   von Hand gelegte Anordnung des Diagramms wird wiederhergestellt; sonst wird
   automatisch angeordnet und diese Erstanordnung gemerkt. */
function showDiagram(node){
  S.graph = makeGraph(S.model, 1);
  const sichtbar = new Set(node.objekte.map(o => 'o:' + o));
  S.graph.nodes.forEach(n=>{ n.hidden = !sichtbar.has(n.id); });
  S.sel = new Set(); S.selected = null; S.selEdge = null;
  const saved = S.hierSaved[node.id] || {};
  const vis = visNodes();
  const known = vis.filter(n => saved[n.id]);
  if(known.length === vis.length && known.length){
    S.graph.nodes.forEach(n=>{ if(saved[n.id]){ n.x = saved[n.id].x; n.y = saved[n.id].y; } });
    applyRoutesFrom(S.hierRoutes[node.id] || {});
  } else {
    applyAutoLayout(S.graph);
    known.forEach(n=>{ n.x = saved[n.id].x; n.y = saved[n.id].y; });
    if(known.length) separate(vis);
    hierPersist();
  }
  draw();
  renderLegend();
  renderContentMenu();
  updateAlignBar();
  fit();
}

/* ---------- Modus wechseln ---------- */
function setMode(mode){
  S.mode = mode;
  document.body.classList.toggle('modus-hierarchie', mode === 'hierarchie');
  document.querySelectorAll('.mode-btn').forEach(b =>
    b.setAttribute('aria-selected', String(b.dataset.mode === mode)));
  $('komplettPanel').hidden = mode !== 'komplett';
  $('hierPanel').hidden = mode !== 'hierarchie';
  if(mode === 'hierarchie'){
    if(!S.outline) parseOutline();
    const gewaehlt = S.hierSel && outlineFind(S.outline.roots, S.hierSel);
    const erst = outlineFlat(S.outline.roots)[0];
    selectDiagram((gewaehlt || erst || {}).id || null);
  } else {
    setView(S.view);
  }
}
