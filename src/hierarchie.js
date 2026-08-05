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

/* Die Übersicht (inkl. der in der App bearbeiteten Texte und Objektmengen)
   zurück in das YAML-Format schreiben. Beschreibungen als doppelt quotierte
   einzeilige Werte mit \n-Escapes, damit sie der Leser verlustfrei zurückliest. */
function outlineToYaml(roots){
  const q = s => '"' + String(s).replace(/\\/g,'\\\\').replace(/"/g,'\\"').replace(/\n/g,'\\n').replace(/\t/g,'\\t') + '"';
  const plain = s => /^[A-Za-z0-9_][A-Za-z0-9_ .\-]*$/.test(s);
  const skalar = s => plain(s) ? s : q(s);
  const lines = [];
  const emit = (node, ind)=>{
    const pad = '  '.repeat(ind);
    lines.push(`${pad}${node.name}:`);   // Namen sind Map-Schlüssel: roh (der Leser entquotet Schlüssel nicht)
    const txt = diagramText(node);
    if(txt) lines.push(`${pad}  beschreibung: ${q(txt)}`);
    const objs = S.hierShown[node.id] ? S.hierShown[node.id].map(i => i.replace(/^o:/, '')) : (node.objekte || []);
    if(objs.length){
      lines.push(`${pad}  objekte:`);
      objs.forEach(o => lines.push(`${pad}    - ${skalar(o)}`));
    }
    if(node.kinder && node.kinder.length){
      lines.push(`${pad}  Details:`);
      node.kinder.forEach(k => emit(k, ind + 2));
    }
  };
  roots.forEach(r => emit(r, 0));
  return lines.join('\n') + '\n';
}

/* Eine Zeile in gestylte Abschnitte („runs") zerlegen: **fett**, *kursiv*,
   `code`, [Text](url). Für den formatierten Export. */
function mdRuns(s){
  const runs = [];
  const re = /\*\*([^*]+)\*\*|\*([^*\n]+)\*|`([^`]+)`|\[([^\]]+)\]\((?:https?:\/\/[^)\s]+|mailto:[^)\s]+)\)/g;
  let last = 0, m;
  const push = (text, st)=>{ if(text) runs.push(Object.assign({text}, st)); };
  while((m = re.exec(s))){
    push(s.slice(last, m.index), {});
    if(m[1] !== undefined) push(m[1], {bold:true});
    else if(m[2] !== undefined) push(m[2], {italic:true});
    else if(m[3] !== undefined) push(m[3], {code:true});
    else push(m[4], {link:true});
    last = re.lastIndex;
  }
  push(s.slice(last), {});
  return runs.length ? runs : [{text:''}];
}
const runCssFont = (r, size)=>
  `${r.italic ? 'italic ' : ''}${r.bold ? 700 : 400} ${size}px ${r.code ? '"IBM Plex Mono", monospace' : '"Space Grotesk", sans-serif'}`;
const runAttrs = r=>{
  let a = '';
  if(r.bold)   a += ' font-weight="700"';
  if(r.italic) a += ' font-style="italic"';
  if(r.code)   a += ' font-family="IBM Plex Mono, monospace" fill="#1D3F72"';
  if(r.link)   a += ' fill="#1D3F72" text-decoration="underline"';
  return a;
};
/* runs auf Zeilen umbrechen (wortweise, Stil je Wort). Liefert Zeilen aus Tokens. */
function wrapRuns(runs, size, maxW){
  const spaceW = measure(' ', runCssFont({}, size));
  const toks = [];
  runs.forEach(r=> r.text.split(/(\s+)/).forEach(p=>{
    if(p === '') return;
    toks.push(/^\s+$/.test(p) ? {space:true} : {text:p, r});
  }));
  const lines = [[]]; let curW = 0;
  toks.forEach(tk=>{
    const cur = lines[lines.length-1];
    if(tk.space){ if(cur.length && !cur[cur.length-1].space){ cur.push({space:true, w:spaceW}); curW += spaceW; } return; }
    const w = measure(tk.text, runCssFont(tk.r, size));
    if(curW + w > maxW && cur.length){
      while(cur.length && cur[cur.length-1].space) curW -= cur.pop().w;
      lines.push([{text:tk.text, r:tk.r, w}]); curW = w;
    } else { cur.push({text:tk.text, r:tk.r, w}); curW += w; }
  });
  lines.forEach(l=>{ while(l.length && l[l.length-1].space) l.pop(); });
  return lines;
}

/* Kopf für den SVG-/PNG-Export eines Diagramms: Titel + Beschreibung über dem
   Bild, mit gerendertem Markdown (fett/kursiv/Code, Überschriften, Listen,
   Zitate). Gibt {svg, height} zurück oder null (nicht im Hierarchie-Modus). */
function hierExportHeader(b){
  if(S.mode !== 'hierarchie' || !S.hierSel || !S.outline) return null;
  const node = outlineFind(S.outline.roots, S.hierSel);
  if(!node) return null;
  const x0 = b.x + 16, maxW = Math.max(240, b.w - 32);
  const lh = s => Math.round(s * 1.35) + 3;

  // Beschreibung Zeile für Zeile in Render-Anweisungen übersetzen
  const ops = [];   // {gap} | {size, indent, prefix, wrapped}
  String(diagramText(node) || '').replace(/\r\n?/g, '\n').split('\n').forEach(raw=>{
    const line = raw.replace(/\s+$/, '');
    if(!line.trim()){ ops.push({gap:true}); return; }
    let m, size = 12, indent = 0, prefix = '', head = false, quote = false, text = line;
    if((m = line.match(/^(#{1,3})\s+(.*)$/))){ const l = m[1].length; size = l === 1 ? 16 : l === 2 ? 14 : 13; head = true; text = m[2]; }
    else if((m = line.match(/^\s*[-*]\s+(.*)$/))){ prefix = '•'; indent = 16; text = m[1]; }
    else if((m = line.match(/^\s*(\d+)\.\s+(.*)$/))){ prefix = m[1] + '.'; indent = 20; text = m[2]; }
    else if((m = line.match(/^>\s?(.*)$/))){ indent = 12; quote = true; text = m[1]; }
    const runs = mdRuns(text);
    if(head) runs.forEach(r=> r.bold = true);
    ops.push({size, indent, prefix, quote, head, wrapped: wrapRuns(runs, size, maxW - indent)});
  });
  while(ops.length && ops[ops.length-1].gap) ops.pop();

  const titleLH = 28, padTop = 20, gap = 10, padBot = 16, absatz = 8;
  const bodyH = ops.reduce((h, op)=> h + (op.gap ? absatz : op.wrapped.length * lh(op.size)), 0);
  const height = padTop + titleLH + (ops.length ? gap + bodyH : 0) + padBot;

  const lineSvg = toks => toks.map(t=> t.space ? '<tspan> </tspan>' : `<tspan${runAttrs(t.r)}>${esc(t.text)}</tspan>`).join('');
  let y = b.y - height + padTop;
  y += titleLH;
  let svg = `<text class="hx-ttl" x="${x0}" y="${y.toFixed(1)}">${esc(node.name)}</text>`;
  if(ops.length) y += gap;
  ops.forEach(op=>{
    if(op.gap){ y += absatz; return; }
    op.wrapped.forEach((toks, i)=>{
      y += lh(op.size);
      const lx = x0 + op.indent;
      if(i === 0 && op.prefix)
        svg += `<text class="hx-dsc" x="${x0}" y="${y.toFixed(1)}" font-size="${op.size}">${esc(op.prefix)}</text>`;
      const cls = op.head ? 'hx-h' : op.quote ? 'hx-q' : 'hx-dsc';
      svg += `<text class="${cls}" xml:space="preserve" x="${lx}" y="${y.toFixed(1)}" font-size="${op.size}">${lineSvg(toks)}</text>`;
    });
  });
  svg += `<line x1="${b.x + 16}" y1="${(b.y - 8).toFixed(1)}" x2="${b.x + b.w - 16}" y2="${(b.y - 8).toFixed(1)}" stroke="#C4CFD8"/>`;
  return {svg, height};
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
  $('hierTools').hidden = mode !== 'hierarchie';
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

/* ---------- Struktur bearbeiten: anlegen, umbenennen, löschen ---------- */
/* In-App-Bearbeitungen (Text, Objektmengen) in die Knoten schreiben, damit sie
   beim Neuaufbau der Kennungen und der YAML-Ausgabe erhalten bleiben. */
function bakeOverlays(){
  outlineFlat(S.outline.roots).forEach(n=>{
    if(S.hierText[n.id] !== undefined) n.beschreibung = S.hierText[n.id];
    if(S.hierShown[n.id]) n.objekte = S.hierShown[n.id].map(i => i.replace(/^o:/, ''));
  });
  S.hierText = {}; S.hierShown = {};
}

/* Kennungen (Pfad) für den ganzen Baum neu vergeben. */
function reassignIds(){
  const walk = (nodes, pfad)=> nodes.forEach(n=>{ n.id = pfad.concat(n.name).join('›'); walk(n.kinder, pfad.concat(n.name)); });
  walk(S.outline.roots, []);
}

/* Gespeicherte Anordnungen/Kantenzüge auf geänderte Kennungen umschreiben
   (newPrefix === null löscht sie). */
function remapGeometry(oldPrefix, newPrefix){
  [S.hierSaved, S.hierRoutes].forEach(store=>{
    Object.keys(store).forEach(k=>{
      if(k === oldPrefix || k.startsWith(oldPrefix + '›')){
        const val = store[k]; delete store[k];
        if(newPrefix !== null) store[newPrefix + k.slice(oldPrefix.length)] = val;
      }
    });
  });
}

/* Bearbeitete Übersicht als YAML festhalten und sichern. */
function commitOutline(){
  S.outlineText = outlineToYaml(S.outline.roots);
  writeStore();
}

const reinName = s => String(s || '').replace(/[›:]/g, '').trim();

function outlineAdd(parentId, name){
  name = reinName(name);
  if(!name || !S.outline) return null;
  bakeOverlays();
  const neu = {id:'', name, beschreibung:'', objekte:[], kinder:[]};
  if(parentId){ const p = outlineFind(S.outline.roots, parentId); if(!p) return null; p.kinder.push(neu); }
  else S.outline.roots.push(neu);
  reassignIds();
  commitOutline();
  selectDiagram(neu.id);
  toast('Diagramm „' + name + '" angelegt');
  return neu.id;
}

function outlineRename(id, name){
  name = reinName(name);
  const node = S.outline && outlineFind(S.outline.roots, id);
  if(!node || !name) return;
  bakeOverlays();
  const alt = node.id;
  node.name = name;
  reassignIds();
  remapGeometry(alt, node.id);
  if(S.hierSel === alt || S.hierSel.startsWith(alt + '›')) S.hierSel = node.id + S.hierSel.slice(alt.length);
  commitOutline();
  selectDiagram(S.hierSel);
}

function outlineDelete(id){
  const node = S.outline && outlineFind(S.outline.roots, id);
  if(!node) return;
  bakeOverlays();
  const entferne = arr=>{
    const i = arr.findIndex(n => n.id === id);
    if(i >= 0){ arr.splice(i, 1); return true; }
    return arr.some(n => entferne(n.kinder));
  };
  entferne(S.outline.roots);
  remapGeometry(id, null);
  reassignIds();
  commitOutline();
  const rest = outlineFlat(S.outline.roots);
  selectDiagram(rest.length ? rest[0].id : null);
}

/* Verknüpfung der Werkzeugleiste (fragt Namen per Dialog ab). */
function hierAction(act){
  if(act === 'add-top'){ const n = prompt('Name der neuen Domäne:'); if(n) outlineAdd(null, n); return; }
  const id = S.hierSel;
  if(!id){ toast('Erst ein Diagramm wählen'); return; }
  const node = outlineFind(S.outline.roots, id);
  if(act === 'add-child'){ const n = prompt('Name des neuen Unterdiagramms:'); if(n) outlineAdd(id, n); }
  else if(act === 'rename'){ const n = prompt('Neuer Name:', node ? node.name : ''); if(n) outlineRename(id, n); }
  else if(act === 'delete'){ if(node && confirm('„' + node.name + '" samt Unterdiagrammen löschen?')) outlineDelete(id); }
}
