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

/* Sehr kleiner, offline Markdown-Renderer für die Diagramm-Beschreibung.
   Unterstützt Überschriften (# ## ###), **fett**, *kursiv*, `code`, Listen
   (- / * und 1.), Zitat (>), Links [Text](http…|mailto…), Absätze und
   Zeilenumbrüche. HTML wird zuerst maskiert; nur die erzeugten Tags entstehen. */
function renderMarkdown(md){
  const roh = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const inline = s => roh(s)
    .replace(/`([^`]+)`/g, (m,c)=>`<code>${c}</code>`)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*\n]+)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+|mailto:[^)\s]+)\)/g,
             (m,t,u)=>`<a href="${u}" target="_blank" rel="noopener">${t}</a>`);
  const lines = String(md || '').replace(/\r\n?/g, '\n').split('\n');
  const out = [];
  let para = [], list = null;
  const flushPara = ()=>{ if(para.length){ out.push('<p>' + para.map(inline).join('<br>') + '</p>'); para = []; } };
  const flushList = ()=>{ if(list){ out.push(`<${list.tag}>` + list.items.map(t=>`<li>${inline(t)}</li>`).join('') + `</${list.tag}>`); list = null; } };
  let m;
  for(const raw of lines){
    const line = raw.replace(/\s+$/, '');
    if(!line.trim()){ flushPara(); flushList(); continue; }
    if((m = line.match(/^(#{1,3})\s+(.*)$/))){ flushPara(); flushList(); const lvl = m[1].length + 1; out.push(`<h${lvl}>${inline(m[2])}</h${lvl}>`); continue; }
    if((m = line.match(/^\s*[-*]\s+(.*)$/))){ flushPara(); if(!list || list.tag !== 'ul'){ flushList(); list = {tag:'ul', items:[]}; } list.items.push(m[1]); continue; }
    if((m = line.match(/^\s*\d+\.\s+(.*)$/))){ flushPara(); if(!list || list.tag !== 'ol'){ flushList(); list = {tag:'ol', items:[]}; } list.items.push(m[1]); continue; }
    if((m = line.match(/^>\s?(.*)$/))){ flushPara(); flushList(); out.push(`<blockquote>${inline(m[1])}</blockquote>`); continue; }
    para.push(line);
  }
  flushPara(); flushList();
  return out.join('\n');
}

/* Wirksame Beschreibung: in der App bearbeiteter Text, sonst die YAML-Vorlage. */
function diagramText(node){
  return (S.hierText[node.id] !== undefined) ? S.hierText[node.id] : (node.beschreibung || '');
}

/* ---------- Beschreibung links unten: ansehen / bearbeiten ---------- */
function renderOutlineDesc(){
  const box = $('hierDesc');
  const node = S.hierSel && S.outline ? outlineFind(S.outline.roots, S.hierSel) : null;
  if(!node){ S.hierEditing = false; box.innerHTML = '<div class="empty">Ein Diagramm in der Hierarchie wählen.</div>'; return; }
  const txt = diagramText(node);
  if(S.hierEditing){
    box.innerHTML =
      `<div class="hd-bar"><h2 class="hd-title">${esc(node.name)}</h2>
         <span class="hd-actions"><button class="hd-btn ok" id="hdSave">Speichern</button>
         <button class="hd-btn" id="hdCancel">Abbrechen</button></span></div>
       <textarea class="hd-area" id="hdArea" spellcheck="false" aria-label="Beschreibung bearbeiten"></textarea>
       <div class="hd-hint"># Überschrift · **fett** · *kursiv* · - Liste · [Text](https://…)</div>`;
    const area = $('hdArea'); area.value = txt; area.focus();
    $('hdSave').onclick = saveEditDesc;
    $('hdCancel').onclick = ()=>{ S.hierEditing = false; renderOutlineDesc(); };
  } else {
    box.innerHTML =
      `<div class="hd-bar"><h2 class="hd-title">${esc(node.name)}</h2>
         <button class="hd-btn" id="hdEdit">Bearbeiten</button></div>
       <div class="hd-text">${txt.trim() ? renderMarkdown(txt) : '<div class="empty">Noch keine Beschreibung. „Bearbeiten“ wählen.</div>'}</div>`;
    $('hdEdit').onclick = ()=>{ S.hierEditing = true; renderOutlineDesc(); };
  }
}

function saveEditDesc(){
  const node = S.hierSel && S.outline ? outlineFind(S.outline.roots, S.hierSel) : null;
  if(!node) return;
  S.hierText[node.id] = $('hdArea').value;
  S.hierEditing = false;
  renderOutlineDesc();
  writeStore();
}

/* ---------- Ordner auf-/zuklappen ---------- */
function toggleOutline(id){
  if(S.hierOpen.has(id)) S.hierOpen.delete(id); else S.hierOpen.add(id);
  renderOutlineTree();
}

/* Aktuell sichtbare Objekte des gewählten Diagramms (gespeicherte Menge oder,
   solange unbearbeitet, die YAML-Liste). */
function hierShownSet(){
  if(S.hierShown[S.hierSel]) return new Set(S.hierShown[S.hierSel]);
  const node = S.outline ? outlineFind(S.outline.roots, S.hierSel) : null;
  return new Set((node ? node.objekte : []).map(o => 'o:' + o));
}

/* Neu ins Diagramm geholte Objekte (noch ohne gemerkte Lage) unter die bereits
   platzierten setzen, damit die bestehende Anordnung erhalten bleibt. */
function hierPlaceFresh(){
  const saved = S.hierSaved[S.hierSel] || {};
  const platziert = visNodes().filter(n => saved[n.id]);
  const neu = visNodes().filter(n => !saved[n.id]);
  if(!neu.length) return;
  let x = platziert.length ? Math.min(...platziert.map(n => n.x)) : 0;
  const y = platziert.length ? Math.max(...platziert.map(n => n.y + n.h)) + 40 : 0;
  neu.forEach(n=>{ n.x = Math.round(x); n.y = Math.round(y); x += n.w + 30; });
}

/* ---------- Diagramm wählen: Ausschnitt zeichnen ---------- */
function selectDiagram(id){
  S.hierSel = id;
  S.hierEditing = false;   // beim Diagrammwechsel nicht im Bearbeiten-Modus bleiben
  renderOutlineTree();
  renderOutlineDesc();
  const node = id && S.outline ? outlineFind(S.outline.roots, id) : null;
  if(node) showDiagram(node);
}

/* Nur die Objekte des Knotens zeigen, Darstellung wie Ansicht 1. Eine einmal
   von Hand gelegte Anordnung des Diagramms wird wiederhergestellt; sonst wird
   automatisch angeordnet und diese Erstanordnung gemerkt. Über die Objektliste
   je Diagramm ausgeblendete Objekte bleiben verborgen. */
function showDiagram(node){
  S.graph = makeGraph(S.model, 1);
  const shown = S.hierShown[node.id]
    ? new Set(S.hierShown[node.id])
    : new Set(node.objekte.map(o => 'o:' + o));
  S.graph.nodes.forEach(n=>{ n.hidden = !shown.has(n.id); });
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
  renderObjectList();
  renderDetails();
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
  $('hierTree').hidden = mode !== 'hierarchie';
  if(mode === 'hierarchie'){
    if(!S.outline) parseOutline();
    setSidePane('beschreibung');
    const gewaehlt = S.hierSel && outlineFind(S.outline.roots, S.hierSel);
    const erst = outlineFlat(S.outline.roots)[0];
    selectDiagram((gewaehlt || erst || {}).id || null);
  } else {
    // die nur in der Hierarchie sinnvolle „Beschreibung“ nicht in der Komplettsicht stehen lassen
    const aktiv = (document.querySelector('.sidetab[aria-selected="true"]') || {}).dataset;
    if(aktiv && aktiv.pane === 'beschreibung') setSidePane('objects');
    setView(S.view);
  }
}
