/* =====================================================================
   7 — Ansicht wechseln, Anordnung merken
   ===================================================================== */
function setView(v, {autoFit = true} = {}){
  S.view = v;
  document.querySelectorAll('.view-btn').forEach(b=> b.setAttribute('aria-selected', String(+b.dataset.view === v)));
  S.graph = makeGraph(S.model, v);
  S.graph.nodes.forEach(n=>{ n.hidden = S.hidden.has(n.id); });
  const saved = S.saved[v] || {};
  const known = S.graph.nodes.filter(n => saved[n.id]);
  if(known.length === S.graph.nodes.length && known.length){
    S.graph.nodes.forEach(n=>{ n.x = saved[n.id].x; n.y = saved[n.id].y; });
    applyRoutes();
  } else {
    applyAutoLayout(S.graph);
    known.forEach(n=>{ n.x = saved[n.id].x; n.y = saved[n.id].y; });
    if(known.length) separate(visNodes());
    persist();
  }
  S.sel = new Set([...S.sel].filter(id => S.graph.byId.has(id)));
  if(S.selected && !S.graph.byId.has(S.selected)) S.selected = [...S.sel].pop() || null;
  S.selEdge = null;
  draw();
  renderObjectList();
  renderDetails();
  renderLegend();
  renderHerkunft();
  renderContentMenu();
  updateAlignBar();
  persist();
  if(autoFit) fit();
}

function applyAutoLayout(g){
  // Ausgeblendete Knoten bleiben liegen, wo sie waren, und reißen keine Lücke
  const nodes = visNodes(), edges = visEdges();
  if(!nodes.length) return;
  g.edges.forEach(e=>{ e.bends = null; e.ortho = false; e.portFrom = null; e.portTo = null; });
  const algo = ALGOS[S.layout.algo] || ALGOS.hier;
  runByComponent(nodes, edges, algo.dir ? S.layout.dir : 'TB', algo.fn);
}

/* Ablage: im Claude-Artefakt window.storage, in einer heruntergeladenen
   Datei localStorage. Beides kann fehlen, dann wird still nicht gespeichert. */
const store = {
  async get(key){
    if(window.storage){
      try{ const r = await window.storage.get(key); if(r && r.value) return r.value; }catch(_){}
    }
    try{ return localStorage.getItem(key); }catch(_){ return null; }
  },
  async set(key, value){
    if(window.storage){ try{ await window.storage.set(key, value); }catch(_){} }
    try{ localStorage.setItem(key, value); }catch(_){}
  }
};

const layoutFile = ()=> ({
  version: 5,
  verfahren: S.layout,
  ansichten: S.saved,
  kantenzuege: S.routes,
  inhalt: S.content,
  ausgeblendet: [...S.hidden],
  uebersichtText: S.outlineText,
  hierarchie: { anordnung: S.hierSaved, kantenzuege: S.hierRoutes, sichtbar: S.hierShown, text: S.hierText }
});

function adoptLayoutFile(obj){
  if(!obj || typeof obj !== 'object') return false;
  const a = obj.ansichten || ((obj[1] || obj[2] || obj[3]) ? obj : null);
  if(a) S.saved = {1:a[1]||{}, 2:a[2]||{}, 3:a[3]||{}};
  if(obj.verfahren && obj.verfahren.algo) S.layout = {
    algo: ALGOS[obj.verfahren.algo] ? obj.verfahren.algo : 'hier',
    dir: DIR_NAME[obj.verfahren.dir] ? obj.verfahren.dir : 'TB',
    labels: obj.verfahren.labels !== false
  };
  if(obj.kantenzuege) S.routes = {1:obj.kantenzuege[1]||{}, 2:obj.kantenzuege[2]||{}, 3:obj.kantenzuege[3]||{}};
  if(obj.inhalt) S.content = {1:obj.inhalt[1]||{}, 2:obj.inhalt[2]||{}, 3:obj.inhalt[3]||{}};
  if(Array.isArray(obj.ausgeblendet)) S.hidden = new Set(obj.ausgeblendet);
  if(obj.uebersichtText) S.outlineText = obj.uebersichtText;
  if(obj.hierarchie){
    S.hierSaved = obj.hierarchie.anordnung || {};
    S.hierRoutes = obj.hierarchie.kantenzuege || {};
    S.hierShown = obj.hierarchie.sichtbar || {};
    S.hierText = obj.hierarchie.text || {};
  }
  return true;
}

function positionsSnapshot(){
  const m = {};
  S.graph.nodes.forEach(n=>{ m[n.id] = {x:n.x, y:n.y}; });
  return m;
}

function writeStore(){
  const blob = layoutFile();
  store.set('layouts:' + S.fileName, JSON.stringify(blob));
  store.set('sitzung', JSON.stringify(
    Object.assign({fileName:S.fileName, yaml:S.yamlText, view:S.view}, blob)));
}

function persist(){
  if(S.mode === 'hierarchie'){ hierPersist(); return; }
  S.saved[S.view] = positionsSnapshot();
  captureRoutes();
  writeStore();
}

/* Anordnung des aktuell gewählten Diagramms merken (wie persist() für Ansichten).
   Nur sichtbare Knoten: ein später hinzugeholtes Objekt gilt dann als neu und
   wird von hierPlaceFresh() platziert, statt bei (0,0) zu kleben. */
function hierPersist(){
  if(!S.hierSel) return;
  const m = {};
  visNodes().forEach(n=>{ m[n.id] = {x:n.x, y:n.y}; });
  S.hierSaved[S.hierSel] = m;
  S.hierRoutes[S.hierSel] = routesSnapshot();
  writeStore();
}

/* =====================================================================
   8 — Seitenleiste
   ===================================================================== */
/* Die Objektliste zeigt in beiden Modi alle Objekte des Modells: in der
   Hierarchie sind die im Diagramm sichtbaren angehakt, die übrigen lassen sich
   dort hinzuholen. */
function listedNodes(){ return S.graph.nodes; }

function renderObjectList(){
  const ul = $('objectList');
  const groups = new Map();
  listedNodes().forEach(n=>{
    const g = n.kind === 'source' ? 'Quellen' : (n.ref.domain || 'Ohne Domain');
    if(!groups.has(g)) groups.set(g, []);
    groups.get(g).push(n);
  });
  let html = '';
  const gidx = [];
  for(const [g, list] of groups){
    const gi = gidx.push(list) - 1;
    html += `<li class="grouphead"><span>${esc(g.toUpperCase())}</span>
      <span class="gtools"><button data-gi="${gi}" data-on="1">alle</button>
      <button data-gi="${gi}" data-on="0">keine</button></span></li>`;
    list.sort((a,b)=> a.name.localeCompare(b.name, 'de')).forEach(n=>{
      const meta = n.kind === 'source'
        ? `${n.ref.users.length}×`
        : `${n.ref.keys.length} BK · ${n.ref.attrs.length} A · ${n.ref.rels.length} B`;
      html += `<li class="row${n.hidden ? ' off' : ''}">
        <input type="checkbox" class="ochk" data-id="${esc(n.id)}" ${n.hidden ? '' : 'checked'}
               aria-label="${esc(n.name)} im Diagramm anzeigen">
        <button data-id="${esc(n.id)}" aria-current="${S.sel.has(n.id)}">
          <span class="nm">${esc(n.name)}</span><span class="meta">${esc(meta)}</span>
        </button></li>`;
    });
  }
  ul.innerHTML = html;
  ul.querySelectorAll('button[data-id]').forEach(b=> b.addEventListener('click', ev=>
    select(b.dataset.id, true, ev.shiftKey || ev.ctrlKey || ev.metaKey)));
  ul.querySelectorAll('.ochk').forEach(c=> c.addEventListener('change', ()=> setVisible(c.dataset.id, c.checked)));
  ul.querySelectorAll('.gtools button').forEach(b=> b.addEventListener('click', ()=>
    setGroupVisible(gidx[+b.dataset.gi], b.dataset.on === '1')));
  updateVisCount();
}

/* Sichtbarkeit merken: in der Komplettsicht global (S.hidden), im Hierarchie-
   Modus als sichtbare Menge je Diagramm (S.hierShown[Diagramm]). */
function markVisible(id, on){
  if(S.mode === 'hierarchie'){
    const shown = hierShownSet();
    if(on) shown.add(id); else shown.delete(id);
    S.hierShown[S.hierSel] = [...shown];
  } else {
    if(on) S.hidden.delete(id); else S.hidden.add(id);
  }
}

function setGroupVisible(list, on){
  list.forEach(n=>{
    n.hidden = !on;
    markVisible(n.id, on);
    if(!on) S.sel.delete(n.id);
  });
  if(S.selected && !S.sel.has(S.selected)) S.selected = [...S.sel].pop() || null;
  if(S.mode === 'hierarchie') hierPlaceFresh();
  renderObjectList(); draw(); renderDetails(); updateAlignBar(); persist();
}

function updateVisCount(){
  const list = listedNodes();
  const total = list.length;
  const vis = list.filter(n => !n.hidden).length;
  $('visCount').textContent = vis === total ? `${total}` : `${vis} / ${total}`;
}

function setVisible(id, on){
  const n = S.graph.byId.get(id);
  if(n) n.hidden = !on;
  markVisible(id, on);
  if(!on){ S.sel.delete(id); if(S.selected === id) S.selected = [...S.sel].pop() || null; }
  if(S.mode === 'hierarchie') hierPlaceFresh();
  document.querySelectorAll(`.olist .ochk[data-id="${CSS.escape(id)}"]`).forEach(c=>{
    c.checked = on;
    c.closest('li').classList.toggle('off', !on);
  });
  updateVisCount(); draw(); renderDetails(); updateAlignBar(); persist();
}

function setAllVisible(on){
  listedNodes().forEach(n=>{ n.hidden = !on; markVisible(n.id, on); });
  if(!on){ S.sel.clear(); S.selected = null; }
  if(S.mode === 'hierarchie') hierPlaceFresh();
  renderObjectList(); draw(); renderDetails(); updateAlignBar(); persist();
}

function renderDetails(){
  const box = $('detailBody'), empty = $('detailEmpty');
  const n = S.selected && S.graph.byId.get(S.selected);
  if(!n){ box.hidden = true; empty.hidden = false; return; }
  box.hidden = false; empty.hidden = true;

  if(S.sel.size > 1){
    const list = [...S.sel].map(id => S.graph.byId.get(id)).filter(Boolean);
    box.innerHTML =
      `<div class="grouphead">${list.length} OBJEKTE GEWÄHLT</div>` +
      list.map(x=>`<div class="rel"><span class="arrow">•</span>
        <button data-goto="${esc(x.id)}">${esc(x.name)}</button></div>`).join('') +
      `<div class="empty">Ziehen bewegt alle gemeinsam. Über die Leiste am unteren Rand ausrichten oder verteilen.</div>`;
    box.querySelectorAll('[data-goto]').forEach(b=>
      b.addEventListener('click', ()=> select(b.dataset.goto, true)));
    return;
  }

  if(n.kind === 'source'){
    box.innerHTML =
      `<div class="grouphead">QUELLE</div>
       <dl class="kv"><dt>Name</dt><dd>${esc(n.name)}</dd></dl>
       <div class="grouphead">VERSORGT</div>` +
      n.ref.users.map(u=>`<div class="rel"><span class="arrow">←</span>
        <button data-goto="o:${esc(u)}">${esc(u)}</button></div>`).join('');
  } else {
    const o = n.ref;
    const incoming = [];
    Object.values(S.model.objects).forEach(src=>
      src.rels.forEach(r=>{ if(r.to === o.name) incoming.push({from:src.name, r}); }));
    box.innerHTML =
      `<div class="grouphead">GESCHÄFTSOBJEKT</div>
       <dl class="kv"><dt>Name</dt><dd>${esc(o.name)}</dd></dl>
       <dl class="kv"><dt>Domain</dt><dd>${o.domain ? esc(o.domain) : '—'}</dd></dl>
       ${o.desc ? `<div class="descbox">${esc(o.desc)}</div>` : ''}
       <div class="grouphead">BUSINESS KEYS</div>
       <div>${o.keys.length ? o.keys.map(k=>`<span class="chip key">${esc(k)}</span>`).join('') : '<span class="empty">keine</span>'}</div>
       <div class="grouphead">QUELLEN</div>
       <div>${o.sources.length ? o.sources.map(s=>`<span class="chip src">${esc(s)}</span>`).join('') : '<span class="empty">keine</span>'}</div>
       <div class="grouphead">ATTRIBUTE${o.attrs.length ? ' (' + o.attrs.length + ')' : ''}</div>
       ${o.attrs.length ? `<table class="attrs">` + o.attrs.map(a=>`<tr>
          <td class="an">${esc(a.name)}</td>
          <td class="at">${a.type ? esc(a.type) : ''}${a.nullable ? ' ?' : ''}</td>
          <td class="ak">${a.pk ? '<span class="pk">PK</span>' : ''}${a.fk ? '<span class="fk">FK</span>' : ''}</td>
          </tr>` + (a.ref ? `<tr><td class="aref" colspan="3">→ ${esc(a.ref)}</td></tr>` : '')).join('') + `</table>`
        : '<div class="empty">keine</div>'}
       <div class="grouphead">BEZIEHUNGEN AUSGEHEND</div>
       ${o.rels.length ? o.rels.map((r,ri)=>`<div class="rel"><span class="arrow">→</span>
          <button data-goto="o:${esc(r.to)}">${esc(r.to)}</button>
          ${r.name ? `<span class="relname">${esc(r.name)}</span>` : ''}
          <button class="pickedge" data-edge="o:${esc(o.name)}|o:${esc(r.to)}|${o.rels.slice(0,ri).filter(x=>x.to===r.to).length}" title="Kante im Diagramm auswählen und bearbeiten">Kante</button>
          <span class="card">${esc(CARD_LABEL[r.from]||r.from||'?')} : ${esc(CARD_LABEL[r.toCard]||r.toCard||'?')}</span></div>`).join('')
        : '<div class="empty">keine</div>'}
       <div class="grouphead">BEZIEHUNGEN EINGEHEND</div>
       ${incoming.length ? incoming.map((x,xi)=>`<div class="rel"><span class="arrow">←</span>
          <button data-goto="o:${esc(x.from)}">${esc(x.from)}</button>
          ${x.r.name ? `<span class="relname">${esc(x.r.name)}</span>` : ''}
          <button class="pickedge" data-edge="o:${esc(x.from)}|o:${esc(o.name)}|${incoming.slice(0,xi).filter(y=>y.from===x.from && y.r.to===x.r.to).length}" title="Kante im Diagramm auswählen und bearbeiten">Kante</button>
          <span class="card">${esc(CARD_LABEL[x.r.from]||x.r.from||'?')} : ${esc(CARD_LABEL[x.r.toCard]||x.r.toCard||'?')}</span></div>`).join('')
        : '<div class="empty">keine</div>'}`;
  }
  box.querySelectorAll('[data-goto]').forEach(b=>
    b.addEventListener('click', ()=> select(b.dataset.goto, true)));
  box.querySelectorAll('[data-edge]').forEach(b=>
    b.addEventListener('click', ()=> selectEdgeByPair(b.dataset.edge)));
}

function renderMessages(){
  const list = S.model.messages;
  const bad = list.filter(m => m.level !== 'info').length;
  const badge = $('msgBadge');
  badge.textContent = list.length;
  badge.classList.toggle('zero', bad === 0);
  $('msgList').innerHTML = list.length
    ? list.map(m=>`<div class="msg ${m.level}"><strong>${m.level === 'err' ? 'Fehler' : m.level === 'warn' ? 'Hinweis' : 'Info'}</strong>${esc(m.title)}<br>${esc(m.body)}</div>`).join('')
    : '<div class="empty">Keine Auffälligkeiten gefunden.</div>';
}

/* Namensnennung nach CC-BY und Verwandtem: eine Zeile, überall dieselbe. */
function attributionLine(){
  const m = S.model && S.model.meta;
  if(!m || (!m.urheber && !m.lizenz)) return '';
  const teile = [];
  teile.push('Datenmodell' + (m.titel ? ' „' + m.titel + '"' : ''));
  if(m.urheber) teile.push('© ' + m.urheber);
  if(m.lizenz)  teile.push('lizenziert unter ' + m.lizenz);
  let s = teile.join(', ') + '.';
  if(m.lizenzUrl) s += ' ' + m.lizenzUrl;
  if(m.hinweis)   s += ' ' + m.hinweis;
  return s;
}

function renderHerkunft(){
  // Herkunft/Lizenz wird nicht mehr in der Seitenleiste angezeigt; der Hinweis
  // steht in der README. Die Modell-Metadaten (S.model.meta) bleiben als Daten
  // erhalten und wandern beim YAML-Speichern mit.
  const box = $('herkunft');
  box.hidden = true;
  box.innerHTML = '';
}

function renderLegend(){
  const row = (card, txt) => {
    const mk = markerMarkup({x:52, y:11}, Math.PI, card);
    return `<div><svg width="66" height="22" viewBox="0 0 66 22" aria-hidden="true">
      <g class="eg"><path class="e-path" d="M4 11H52"/>${mk}</g></svg>${txt}</div>`;
  };
  let html =
    row('exactly_one', 'genau eins') +
    row('zero_or_many', 'null bis viele') +
    row('one_or_many', 'eins bis viele') +
    row('zero_or_one', 'null oder eins');
  if(S.view === 3) html += `<div><svg width="66" height="22" viewBox="0 0 66 22" aria-hidden="true">
      <g class="eg quelle"><path class="e-path" d="M4 11H60"/></g></svg>Quelle, ohne Kardinalität</div>`;
  $('legend').innerHTML = html;
}

function syncListSelection(){
  document.querySelectorAll('#objectList button').forEach(b=>
    b.setAttribute('aria-current', String(S.sel.has(b.dataset.id))));
}

/* Kante über Quelle, Ziel und laufende Nummer auswählen — unabhängig davon,
   ob man die Linie im Diagramm trifft. */
function selectEdgeByPair(spec){
  const [from, to, ord] = String(spec).split('|');
  const e = S.graph.edges.find(x => x.from === from && x.to === to && (x.ord || 0) === +ord);
  if(!e) return;
  S.selected = null; S.sel.clear();
  S.selEdge = e.id;
  draw(); renderDetails(); syncLayoutMenu(); updateAlignBar();
  const A = S.graph.byId.get(e.from), B = S.graph.byId.get(e.to);
  if(A && B && !A.hidden && !B.hidden){
    const r = svg.getBoundingClientRect();
    S.t.x = r.width/2  - ((A.x + A.w/2 + B.x + B.w/2)/2) * S.t.k;
    S.t.y = r.height/2 - ((A.y + A.h/2 + B.y + B.h/2)/2) * S.t.k;
    applyTransform();
  }
  toast('Kante gewählt — Griffe erscheinen im Diagramm');
}

function setSelection(ids){
  S.selEdge = null;
  S.sel = new Set(ids);
  S.selected = ids.length ? ids[ids.length-1] : null;
  draw(); syncListSelection(); renderDetails(); updateAlignBar();
}

function select(id, center, additive){
  S.selEdge = null;
  if(additive){
    if(S.sel.has(id)){
      S.sel.delete(id);
      if(S.selected === id) S.selected = [...S.sel].pop() || null;
    } else { S.sel.add(id); S.selected = id; }
  } else if(S.sel.size === 1 && S.sel.has(id)){
    S.sel.clear(); S.selected = null;
  } else {
    S.sel = new Set([id]); S.selected = id;
  }
  draw();
  syncListSelection();
  renderDetails();
  updateAlignBar();
  if(S.selected && center && !additive){
    setSidePane('details');
    const n = S.graph.byId.get(S.selected);
    if(n && !n.hidden && S.sel.size === 1){
      const r = svg.getBoundingClientRect();
      S.t.x = r.width/2 - (n.x + n.w/2)*S.t.k;
      S.t.y = r.height/2 - (n.y + n.h/2)*S.t.k;
      applyTransform();
    }
  }
}

function updateAlignBar(){
  const bar = $('alignBar');
  const n = [...S.sel].filter(id => isVisible(id)).length;
  bar.classList.toggle('on', n >= 2);
  $('alignCount').textContent = n + ' gewählt';
}

function alignSelection(mode){
  const list = [...S.sel].map(id => S.graph.byId.get(id)).filter(n => n && !n.hidden);
  if(list.length < 2) return;
  const x0 = Math.min(...list.map(n=>n.x)), x1 = Math.max(...list.map(n=>n.x+n.w));
  const y0 = Math.min(...list.map(n=>n.y)), y1 = Math.max(...list.map(n=>n.y+n.h));
  const move = (n, nx, ny)=>{ n.x = Math.round(nx); n.y = Math.round(ny); };
  if(mode === 'l')  list.forEach(n=> move(n, x0, n.y));
  if(mode === 'r')  list.forEach(n=> move(n, x1 - n.w, n.y));
  if(mode === 'ch') list.forEach(n=> move(n, (x0 + x1)/2 - n.w/2, n.y));
  if(mode === 't')  list.forEach(n=> move(n, n.x, y0));
  if(mode === 'b')  list.forEach(n=> move(n, n.x, y1 - n.h));
  if(mode === 'cv') list.forEach(n=> move(n, n.x, (y0 + y1)/2 - n.h/2));
  if(mode === 'dh' && list.length > 2){
    const s = list.slice().sort((a,b)=> a.x - b.x);
    const free = (x1 - x0) - s.reduce((t,n)=> t + n.w, 0);
    const gap = free / (s.length - 1);
    let c = x0;
    s.forEach(n=>{ n.x = Math.round(c); c += n.w + gap; });
  }
  if(mode === 'dv' && list.length > 2){
    const s = list.slice().sort((a,b)=> a.y - b.y);
    const free = (y1 - y0) - s.reduce((t,n)=> t + n.h, 0);
    const gap = free / (s.length - 1);
    let c = y0;
    s.forEach(n=>{ n.y = Math.round(c); c += n.h + gap; });
  }
  // Umgelenkte Kanten zwischen bewegten Knoten sind danach nicht mehr stimmig
  S.graph.edges.forEach(e=>{
    if((S.sel.has(e.from) || S.sel.has(e.to)) && !e.manual){
      e.bends = null; e.portFrom = null; e.portTo = null;
    }
  });
  draw(); persist();
}

$('alignBar').querySelectorAll('button').forEach(b=> b.onclick = ()=> alignSelection(b.dataset.al));

function renderContentMenu(){
  const C = contentOf(S.view);
  $('contentHead').textContent = 'IM KASTEN ZEIGEN — ANSICHT ' + S.view;
  let html = '';
  CONTENT_FIELDS.forEach(f=>{
    const locked = f.k === 'sources' && S.view === 3;
    const off = (f.sub && !C[f.sub]) || locked;
    html += `<button class="opt${f.sub ? ' indent' : ''}${off ? ' off' : ''}" data-content="${f.k}"
      role="menuitemcheckbox" aria-checked="${!locked && !!C[f.k]}">${esc(f.label)}<span class="tick">✓</span></button>`;
  });
  if(S.view === 3) html += `<div class="note">Quellen stehen in dieser Ansicht als eigene Knoten.</div>`;
  $('contentList').innerHTML = html;
  $('contentList').querySelectorAll('[data-content]').forEach(b=> b.onclick = ()=>{
    if(b.classList.contains('off')) return;
    const k = b.dataset.content;
    const cur = contentOf(S.view);
    S.content[S.view] = Object.assign({}, cur, {[k]: !cur[k]});
    applyContent();
  });
}

/* Inhalt geändert: Kästen neu vermessen, Lagen der Knoten behalten */
function applyContent(){
  const keep = {};
  S.graph.nodes.forEach(n=>{ keep[n.id] = {x:n.x, y:n.y}; });
  S.saved[S.view] = Object.assign({}, S.saved[S.view], keep);
  setView(S.view, {autoFit:false});
  renderContentMenu();
  toast('Inhalt geändert — bei Bedarf neu anordnen');
}

function setSidePane(name){
  document.querySelectorAll('.sidetab').forEach(t=> t.setAttribute('aria-selected', String(t.dataset.pane === name)));
  document.querySelectorAll('.pane').forEach(p=> p.classList.toggle('active', p.id === 'pane-'+name));
}

/* =====================================================================
   9 — Maus, Touch, Tastatur
   ===================================================================== */
let drag = null, pan = null, bendDrag = null, band = null, segDrag = null, portDrag = null, loopDrag = null;

svg.addEventListener('pointerdown', ev=>{
  // Sicherheitsnetz: ein nicht beendetes Ziehen (verlorenes pointerup) würde
  // sonst alle folgenden Bewegungen abfangen.
  bendDrag = segDrag = portDrag = loopDrag = null;
  if(drag && !drag.moved) drag = null;
  const t = ev.target;

  // Selbstbezug-Schleife am Scheitel verschieben (vor dem Anschlusspunkt prüfen)
  if(t.dataset && t.dataset.loop){
    const e = S.graph.edges.find(x => x.id === S.selEdge);
    const n = e && S.graph.byId.get(e.from);
    if(!e || !n) return;
    svg.setPointerCapture(ev.pointerId);
    loopDrag = {e, n};
    ev.preventDefault(); return;
  }

  // Stützpunkt greifen oder entfernen
  if(t.classList && t.classList.contains('hnd')){
    const e = S.graph.edges.find(x => x.id === S.selEdge);
    const i = +t.dataset.bend;
    if(!e || !e.bends) return;
    if(ev.altKey){
      e.bends.splice(i, 1);
      if(!e.bends.length) e.bends = null;
      e.manual = true; e.ortho = false;
      drawEdges(); persist();
      ev.preventDefault(); return;
    }
    // Zeiger auf der Zeichenfläche fangen, nicht auf dem Griff: der Griff wird
    // beim Neuzeichnen ersetzt und würde die Erfassung mitnehmen.
    svg.setPointerCapture(ev.pointerId);
    bendDrag = {e, i, sx:ev.clientX, sy:ev.clientY, ox:e.bends[i].x, oy:e.bends[i].y};
    ev.preventDefault(); return;
  }

  // Anschlusspunkt am Knoten verschieben
  if(t.classList && t.classList.contains('pt')){
    const e = S.graph.edges.find(x => x.id === S.selEdge);
    if(!e) return;
    const which = t.dataset.port === 'from' ? 'portFrom' : 'portTo';
    const n = S.graph.byId.get(which === 'portFrom' ? e.from : e.to);
    if(!n) return;
    if(!e[which]){
      if(e.from === e.to){
        // Selbstbezug: aus der aktuellen Schleifengeometrie übernehmen, damit
        // der Anschlusspunkt beim Anfassen nicht wegspringt.
        const g = loopGeom(n, e), p = which === 'portFrom' ? g.p1 : g.p2;
        e[which] = nearestPort(n, p.x, p.y);
      } else {
        const o = S.graph.byId.get(which === 'portFrom' ? e.to : e.from);
        e[which] = nearestPort(n, o.x + o.w/2, o.y + o.h/2);
      }
    }
    svg.setPointerCapture(ev.pointerId);
    portDrag = {e, which, n};
    ev.preventDefault(); return;
  }

  // Teilstück einer rechtwinkligen Kante quer verschieben
  if(t.classList && t.classList.contains('seg')){
    const e = S.graph.edges.find(x => x.id === S.selEdge);
    const A = e && S.graph.byId.get(e.from), B = e && S.graph.byId.get(e.to);
    if(!e || !A || !B) return;
    const i = +t.dataset.seg;
    const pts = routePoints(e, A, B);
    const axis = Math.abs(pts[i].x - pts[i+1].x) < 1 ? 'x' : 'y';
    // Enden des Teilstücks: Stützpunkt oder Anschlusspunkt am Knoten
    const ends = [i, i+1].map(k=>{
      if(k === 0) return {port:'portFrom', node:A};
      if(k === pts.length-1) return {port:'portTo', node:B};
      return {bend: k-1};
    });
    svg.setPointerCapture(ev.pointerId);
    segDrag = {e, axis, ends, sx:ev.clientX, sy:ev.clientY,
               base: axis === 'x' ? pts[i].x : pts[i].y};
    ev.preventDefault(); return;
  }

  // Neuen Stützpunkt einfügen und sofort ziehen
  if(t.classList && t.classList.contains('gh')){
    const e = S.graph.edges.find(x => x.id === S.selEdge);
    const A = e && S.graph.byId.get(e.from), B = e && S.graph.byId.get(e.to);
    if(!e || !A || !B) return;
    const i = +t.dataset.add;
    const pts = routePoints(e, A, B);
    const p = pts[i], q = pts[i+1];
    const m = {x:(p.x + q.x)/2, y:(p.y + q.y)/2};
    e.bends = e.bends || [];
    e.manual = true;
    svg.setPointerCapture(ev.pointerId);

    if(e.ortho){
      // Ein einzelner Punkt würde den rechten Winkel brechen: die beiden
      // Reststücke lägen schräg. Ein sauberer Versatz braucht vier Punkte —
      // zwei kurze Querstücke an den Rändern und das verschiebbare Stück
      // dazwischen. Anfangs liegen sie paarweise aufeinander, die Kante
      // sieht also unverändert aus, bis gezogen wird.
      const vert = Math.abs(p.x - q.x) < 1;
      const d = Math.min(24, Math.hypot(q.x - p.x, q.y - p.y) / 4);
      const mk = (o)=> vert ? {x:m.x, y:Math.round(m.y + o)} : {x:Math.round(m.x + o), y:m.y};
      e.bends.splice(i, 0, mk(-d), mk(-d), mk(d), mk(d));
      drawEdges();
      segDrag = {e, axis: vert ? 'x' : 'y',
                 ends: [{bend:i+1}, {bend:i+2}],
                 sx:ev.clientX, sy:ev.clientY,
                 base: vert ? m.x : m.y};
    } else {
      e.bends.splice(i, 0, m);
      e.ortho = false;
      drawEdges();
      bendDrag = {e, i, sx:ev.clientX, sy:ev.clientY, ox:m.x, oy:m.y};
    }
    ev.preventDefault(); return;
  }

  // Kante auswählen
  const eg = t.closest && t.closest('.eg');
  if(eg){
    S.selEdge = (S.selEdge === eg.dataset.id) ? null : eg.dataset.id;
    S.selected = null; S.sel.clear();
    draw(); renderDetails(); syncLayoutMenu(); updateAlignBar();
    document.querySelectorAll('#objectList button').forEach(b=> b.setAttribute('aria-current','false'));
    ev.preventDefault(); return;
  }

  const g = ev.target.closest('.node');
  if(g){
    const n = S.graph.byId.get(g.dataset.id);
    if(!n) return;
    g.setPointerCapture(ev.pointerId);
    // Wird ein Knoten aus der Auswahl gegriffen, wandert die ganze Auswahl mit
    if(!S.sel.has(n.id)) setSelection([n.id]);
    const moving = new Set(S.sel.size ? S.sel : [n.id]);
    const items = [...moving].map(id=>{
      const nn = S.graph.byId.get(id);
      return nn && !nn.hidden
        ? {n:nn, g:gNodes.querySelector('[data-id="' + CSS.escape(id) + '"]'), ox:nn.x, oy:nn.y}
        : null;
    }).filter(x => x && x.g);

    // Kanten innerhalb der Auswahl wandern starr mit, Kanten nach außen werden gelöst
    const inner = [];
    S.graph.edges.forEach(e=>{
      const a = moving.has(e.from), b = moving.has(e.to);
      if(a && b && e.bends) inner.push({e, orig: e.bends.map(q=>({x:q.x, y:q.y}))});
      else if(a !== b && !e.manual){ e.bends = null; e.portFrom = null; e.portTo = null; }
    });
    drag = {n, g, items, inner, sx:ev.clientX, sy:ev.clientY, moved:false};
    ev.preventDefault();
    return;
  }
  if(S.selEdge){ S.selEdge = null; draw(); }
  if(ev.shiftKey){
    const r = svg.getBoundingClientRect();
    const wx = (ev.clientX - r.left - S.t.x)/S.t.k, wy = (ev.clientY - r.top - S.t.y)/S.t.k;
    band = {x0:wx, y0:wy, x1:wx, y1:wy};
    svg.setPointerCapture(ev.pointerId);
    ev.preventDefault();
    return;
  }
  if(S.sel.size) setSelection([]);
  pan = {sx:ev.clientX, sy:ev.clientY, ox:S.t.x, oy:S.t.y};
  svg.setPointerCapture(ev.pointerId);
  svg.classList.add('panning');
});

svg.addEventListener('pointermove', ev=>{
  if(loopDrag){
    const r = svg.getBoundingClientRect();
    const wx = (ev.clientX - r.left - S.t.x)/S.t.k;
    const wy = (ev.clientY - r.top  - S.t.y)/S.t.k;
    const n = loopDrag.n;
    loopDrag.e.loop = {dx: Math.round(wx - (n.x + n.w/2)), dy: Math.round(wy - (n.y + n.h/2))};
    loopDrag.e.manual = true;
    drawEdges();
    return;
  }
  if(portDrag){
    const r = svg.getBoundingClientRect();
    const wx = (ev.clientX - r.left - S.t.x)/S.t.k;
    const wy = (ev.clientY - r.top  - S.t.y)/S.t.k;
    portDrag.e[portDrag.which] = nearestPort(portDrag.n, wx, wy);
    alignStub(portDrag.e, portDrag.which);
    portDrag.e.manual = true;
    drawEdges();
    return;
  }
  if(segDrag){
    const d = segDrag;
    const delta = (d.axis === 'x' ? ev.clientX - d.sx : ev.clientY - d.sy) / S.t.k;
    const v = Math.round(d.base + delta);
    d.ends.forEach(end=>{
      if(end.bend !== undefined){
        if(!d.e.bends || !d.e.bends[end.bend]) return;
        d.e.bends[end.bend][d.axis] = v;
      } else {
        // Anschlusspunkt kann nur längs seiner Knotenkante rutschen
        const port = d.e[end.port], n = end.node;
        if(!port) return;
        const along = (port.side === 'T' || port.side === 'B') ? 'x' : 'y';
        if(along !== d.axis) return;
        const t2 = along === 'x' ? (v - n.x) / n.w : (v - n.y) / n.h;
        port.t = Math.min(0.92, Math.max(0.08, t2));
      }
    });
    d.e.manual = true;
    drawEdges();
    return;
  }
  if(bendDrag){
    const b = bendDrag;
    let x = b.ox + (ev.clientX - b.sx)/S.t.k;
    let y = b.oy + (ev.clientY - b.sy)/S.t.k;
    // Sanftes Einrasten auf die Nachbarpunkte hält rechtwinklige Züge sauber
    const A = S.graph.byId.get(b.e.from), B = S.graph.byId.get(b.e.to);
    const pts = routePoints(b.e, A, B);
    [pts[b.i], pts[b.i + 2]].forEach(q=>{
      if(!q) return;
      if(Math.abs(q.x - x) < 7) x = q.x;
      if(Math.abs(q.y - y) < 7) y = q.y;
    });
    b.e.bends[b.i] = {x:Math.round(x), y:Math.round(y)};
    b.e.manual = true;
    drawEdges();
    return;
  }
  if(drag){
    const dx = (ev.clientX - drag.sx)/S.t.k, dy = (ev.clientY - drag.sy)/S.t.k;
    if(Math.abs(dx) + Math.abs(dy) > 2) drag.moved = true;
    drag.items.forEach(it=>{
      it.n.x = Math.round(it.ox + dx); it.n.y = Math.round(it.oy + dy);
      it.g.setAttribute('transform', `translate(${it.n.x},${it.n.y})`);
    });
    drag.inner.forEach(({e, orig})=>{
      e.bends = orig.map(q=>({x:Math.round(q.x + dx), y:Math.round(q.y + dy)}));
    });
    drawEdges();
  } else if(band){
    const r = svg.getBoundingClientRect();
    band.x1 = (ev.clientX - r.left - S.t.x)/S.t.k;
    band.y1 = (ev.clientY - r.top  - S.t.y)/S.t.k;
    drawHandles();
  } else if(pan){
    S.t.x = pan.ox + (ev.clientX - pan.sx);
    S.t.y = pan.oy + (ev.clientY - pan.sy);
    applyTransform();
  }
});

function endPointer(ev){
  if(loopDrag){ loopDrag = null; persist(); }
  if(portDrag){
    // Ortho-Kante ohne Knick, die jetzt schräg läuft, in echte Ecken überführen —
    // damit Segment- und Stützpunktgriffe erscheinen und sie bearbeitbar bleibt.
    if(materializeOrtho(portDrag.e)) drawEdges();
    portDrag = null; persist();
  }
  if(segDrag){ segDrag = null; persist(); }
  if(bendDrag){ bendDrag = null; persist(); }
  if(drag){
    if(drag.moved) persist();
    else select(drag.n.id, false, ev && (ev.shiftKey || ev.ctrlKey || ev.metaKey));
    drag = null;
  }
  if(band){
    const x0 = Math.min(band.x0, band.x1), x1 = Math.max(band.x0, band.x1);
    const y0 = Math.min(band.y0, band.y1), y1 = Math.max(band.y0, band.y1);
    const hit = visNodes().filter(n => n.x < x1 && n.x + n.w > x0 && n.y < y1 && n.y + n.h > y0);
    band = null;
    setSelection(hit.map(n=>n.id));
    if(hit.length) toast(hit.length + (hit.length === 1 ? ' Objekt gewählt' : ' Objekte gewählt'));
  }
  if(pan){ pan = null; svg.classList.remove('panning'); }
}
svg.addEventListener('pointerup', endPointer);
svg.addEventListener('pointercancel', endPointer);
svg.addEventListener('lostpointercapture', endPointer);

svg.addEventListener('wheel', ev=>{
  ev.preventDefault();
  const r = svg.getBoundingClientRect();
  const mx = ev.clientX - r.left, my = ev.clientY - r.top;
  const k2 = Math.min(3, Math.max(0.15, S.t.k * Math.exp(-ev.deltaY * 0.0016)));
  S.t.x = mx - (mx - S.t.x) * (k2/S.t.k);
  S.t.y = my - (my - S.t.y) * (k2/S.t.k);
  S.t.k = k2;
  applyTransform();
}, {passive:false});

function zoomBy(f){
  const r = svg.getBoundingClientRect();
  const k2 = Math.min(3, Math.max(0.15, S.t.k * f));
  S.t.x = r.width/2 - (r.width/2 - S.t.x) * (k2/S.t.k);
  S.t.y = r.height/2 - (r.height/2 - S.t.y) * (k2/S.t.k);
  S.t.k = k2; applyTransform();
}
$('zIn').onclick = ()=> zoomBy(1.25);
$('zOut').onclick = ()=> zoomBy(0.8);

document.addEventListener('keydown', ev=>{
  if(ev.target.matches('input')) { if(ev.key === 'Escape') ev.target.blur(); return; }
  if(ev.key === 'Escape'){
    if(S.selEdge){ S.selEdge = null; draw(); }
    else if(S.sel.size) setSelection([]);
    closeMenus();
  }
  if((ev.ctrlKey || ev.metaKey) && (ev.key === 'a' || ev.key === 'A')){
    ev.preventDefault();
    setSelection(visNodes().map(n=>n.id));
    toast(S.sel.size + ' Objekte gewählt');
  }
  if(ev.key >= '1' && ev.key <= '3') setView(+ev.key);
  if(ev.key === 'f' || ev.key === 'F') fit();
});

/* =====================================================================
   10 — Kopfzeile und Menü
   ===================================================================== */
document.querySelectorAll('.view-btn').forEach(b=> b.onclick = ()=> setView(+b.dataset.view));
document.querySelectorAll('.sidetab').forEach(t=> t.onclick = ()=> setSidePane(t.dataset.pane));
$('btnFit').onclick = fit;

// Modus Komplettansicht ↔ Hierarchie
document.querySelectorAll('.mode-btn').forEach(b=> b.onclick = ()=> setMode(b.dataset.mode));
// Struktur bearbeiten (Werkzeugleiste über dem Baum)
$('hierTools').querySelectorAll('[data-hact]').forEach(b=> b.onclick = ()=> hierAction(b.dataset.hact));
// Baum: Ordner klappen oder Diagramm wählen
$('hierTree').addEventListener('click', ev=>{
  const tw = ev.target.closest('[data-toggle]');
  if(tw){ toggleOutline(tw.dataset.toggle); return; }
  const row = ev.target.closest('.dnode');
  if(row) selectDiagram(row.dataset.id);
});

const DIR_NAME = {TB:'oben nach unten', BT:'unten nach oben', LR:'links nach rechts', RL:'rechts nach links'};

function syncLayoutMenu(){
  const noDir = !(ALGOS[S.layout.algo] || ALGOS.hier).dir;
  document.querySelectorAll('.menu .opt[data-algo]').forEach(b=>
    b.setAttribute('aria-checked', String(b.dataset.algo === S.layout.algo)));
  document.querySelectorAll('#dirGrid button').forEach(b=>
    b.setAttribute('aria-checked', String(b.dataset.dir === S.layout.dir)));
  $('optLabels').setAttribute('aria-checked', String(S.layout.labels !== false));
  $('routeOne').disabled = !S.selEdge;
  $('dirGrid').classList.toggle('off', noDir);
  $('dirHead').classList.toggle('off', noDir);
}

function relayout(announce){
  S.graph.edges.forEach(e=>{ e.manual = false; });
  S.selEdge = null;
  applyAutoLayout(S.graph);
  persist(); draw(); fit();
  syncLayoutMenu();
  const a = ALGOS[S.layout.algo] || ALGOS.hier;
  if(announce) toast(a.dir ? a.name + ', ' + DIR_NAME[S.layout.dir] : a.name + ' angeordnet');
}

$('layoutMenu').querySelectorAll('.opt[data-algo]').forEach(b => b.onclick = ()=>{
  S.layout.algo = b.dataset.algo; relayout(true);
});
$('layoutMenu').querySelectorAll('[data-route]').forEach(b => b.onclick = ()=>{
  if(b.disabled) return;
  if(b.dataset.route === 'one'){
    const e = S.graph.edges.find(x => x.id === S.selEdge);
    if(!e) return;
    rerouteEdges([e]); persist();
    toast('Kante neu gezogen');
  } else {
    S.selEdge = null;
    const n = rerouteEdges(S.graph.edges);
    persist();
    toast(n + ' Kanten neu gezogen');
  }
  syncLayoutMenu();
});

$('optLabels').onclick = ()=>{
  S.layout.labels = S.layout.labels === false;
  syncLayoutMenu(); draw(); persist();
  toast(S.layout.labels ? 'Beziehungsnamen eingeblendet' : 'Beziehungsnamen ausgeblendet');
};
$('dirGrid').querySelectorAll('button').forEach(b => b.onclick = ()=>{
  S.layout.dir = b.dataset.dir;
  if(!(ALGOS[S.layout.algo] || ALGOS.hier).dir) S.layout.algo = 'hier';
  relayout(true);
});

$('search').addEventListener('input', e=>{ S.filter = e.target.value.trim().toLowerCase(); draw(); });
$('showAll').onclick = ()=> setAllVisible(true);
$('showNone').onclick = ()=> setAllVisible(false);

const menu = $('menu');
function closeMenus(except){
  document.querySelectorAll('.menu').forEach(m=>{ if(m !== except) m.classList.remove('open'); });
  document.querySelectorAll('[aria-haspopup]').forEach(b=>
    b.setAttribute('aria-expanded', String(b.nextElementSibling && b.nextElementSibling.classList.contains('open'))));
}
[['btnMenu','menu'], ['btnLayout','layoutMenu'], ['btnContent','contentMenu']].forEach(([bid, mid])=>{
  const m = $(mid);
  $(bid).onclick = e=>{
    e.stopPropagation();
    const open = m.classList.toggle('open');
    closeMenus(open ? m : null);
    $(bid).setAttribute('aria-expanded', String(open));
  };
  m.addEventListener('click', e=> e.stopPropagation());
});
document.addEventListener('click', ()=> closeMenus());
menu.querySelectorAll('button').forEach(b=> b.onclick = ()=>{
  closeMenus();
  const a = b.dataset.act;
  if(a === 'open') $('fileInput').click();
  if(a === 'yamlClean'){
    const base = slug(S.fileName.replace(/\.[^.]+$/, ''));
    download(modelToYaml(S.model), base + '-bereinigt.yaml', 'text/yaml');
    toast('Bereinigtes YAML gespeichert');
  }
  if(a === 'yamlRaw'){
    download(S.yamlText, S.fileName.replace(/\.[^.]+$/, '') + '.yaml', 'text/yaml');
    toast('Originaltext gespeichert');
  }
  if(a === 'loadLayout') $('layoutInput').click();
  if(a === 'html') exportHTML();
  if(a === 'svg') download(exportSVG(), diagramName()+'.svg', 'image/svg+xml');
  if(a === 'png') exportPNG();
  if(a === 'layout') download(JSON.stringify(layoutFile(), null, 2), diagramName()+'-anordnung.json', 'application/json');
  if(a === 'uebersicht'){
    if(!S.outline) parseOutline();
    download(outlineToYaml(S.outline.roots), 'williibald-uebersicht.yaml', 'text/yaml');
    toast('Übersicht als YAML gespeichert');
  }
  if(a === 'reset'){
    if(S.mode === 'hierarchie'){
      if(S.hierSel){ delete S.hierSaved[S.hierSel]; delete S.hierRoutes[S.hierSel]; writeStore(); selectDiagram(S.hierSel); }
    } else {
      S.saved[S.view] = {}; setView(S.view);
    }
    toast('Anordnung verworfen');
  }
});

const VIEW_NAME = {1:'Geschäftsobjektmodell', 2:'Geschäftsobjektquellen', 3:'Quellenbezogene Sicht'};
const slug = s => String(s).toLowerCase()
  .replace(/ä/g,'ae').replace(/ö/g,'oe').replace(/ü/g,'ue').replace(/ß/g,'ss')
  .replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
const diagramName = ()=> slug(S.fileName.replace(/\.[^.]+$/, '')) + '-' + slug(VIEW_NAME[S.view]);

function toast(msg){
  const t = $('toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast._id); toast._id = setTimeout(()=> t.classList.remove('show'), 1800);
}

/* ---------- Export ---------- */
function exportSVG(){
  // Auswahl und Filter kurz aufheben, damit das Bild neutral herauskommt
  const sel = S.selected, flt = S.filter, se = S.selEdge, ss = S.sel;
  let b, inner;
  try{
    S.selected = null; S.filter = ''; S.selEdge = null; S.sel = new Set(); S.exporting = true;
    draw();
    b = bbox(30);
    inner = gEdges.outerHTML + gNodes.outerHTML;
  } finally {
    // Muss auch bei einem Fehler zurückgesetzt werden: bleibt der Schalter
    // stehen, verlieren alle Kanten ihre Klickfläche.
    S.selected = sel; S.filter = flt; S.selEdge = se; S.sel = ss; S.exporting = false;
    draw();
  }
  const att = attributionLine();
  const foot = att ? 20 : 0;
  const head = hierExportHeader(b);            // Titel + Beschreibung (nur Hierarchie)
  const headH = head ? head.height : 0;
  const topY = b.y - headH, totalH = headH + b.h + foot;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(b.w)}" height="${Math.round(totalH)}" viewBox="${b.x} ${topY} ${b.w} ${totalH}">
<style>${SVG_CSS}
.att{font:400 10px "IBM Plex Mono",ui-monospace,monospace;fill:#5E717F}
.hx-ttl{font:600 20px "Space Grotesk",sans-serif;fill:#122029}
.hx-dsc{font:400 12px "Space Grotesk",sans-serif;fill:#5E717F}</style>
<rect x="${b.x}" y="${topY}" width="${b.w}" height="${totalH}" fill="#E7ECF1"/>
${head ? head.svg : ''}
${inner}
${att ? `<text class="att" x="${b.x + 12}" y="${b.y + b.h + 13}">${esc(att)}</text>` : ''}
</svg>`;
}
function exportPNG(){
  const b = bbox(30), scale = 2;
  const head = hierExportHeader(b);
  const headH = head ? head.height : 0;
  const blob = new Blob([exportSVG()], {type:'image/svg+xml;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const img = new Image();
  img.onload = ()=>{
    const c = document.createElement('canvas');
    c.width = Math.round(b.w*scale); c.height = Math.round((headH + b.h + (attributionLine() ? 20 : 0))*scale);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#E7ECF1'; ctx.fillRect(0,0,c.width,c.height);
    ctx.drawImage(img, 0, 0, c.width, c.height);
    c.toBlob(bl=>{ downloadBlob(bl, diagramName()+'.png'); URL.revokeObjectURL(url); });
  };
  img.onerror = ()=>{ toast('PNG-Export fehlgeschlagen — SVG nutzen'); URL.revokeObjectURL(url); };
  img.src = url;
}
function download(text, name, type){ downloadBlob(new Blob([text], {type}), name); }
function downloadBlob(blob, name){
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=> URL.revokeObjectURL(a.href), 4000);
}

/* ---------- Dateien laden ---------- */
$('fileInput').addEventListener('change', e=>{
  const f = e.target.files[0]; if(!f) return;
  f.text().then(t => loadYaml(t, f.name));
  e.target.value = '';
});
$('layoutInput').addEventListener('change', e=>{
  const f = e.target.files[0]; if(!f) return;
  f.text().then(t=>{
    try{
      adoptLayoutFile(JSON.parse(t));
      syncLayoutMenu(); setView(S.view);
      toast('Anordnung übernommen');
    }
    catch(_){ toast('Die JSON-Datei lässt sich nicht lesen'); }
  });
  e.target.value = '';
});

const dz = $('dropzone'), wrap = $('canvasWrap');
let dragDepth = 0;
['dragenter','dragover'].forEach(t => wrap.addEventListener(t, e=>{
  e.preventDefault(); if(t === 'dragenter') dragDepth++; dz.classList.add('on');
}));
['dragleave','drop'].forEach(t => wrap.addEventListener(t, e=>{
  e.preventDefault();
  if(t === 'dragleave'){ dragDepth--; if(dragDepth > 0) return; }
  dragDepth = 0; dz.classList.remove('on');
}));
wrap.addEventListener('drop', e=>{
  const f = e.dataTransfer.files[0]; if(!f) return;
  f.text().then(t => loadYaml(t, f.name));
});

async function loadYaml(text, name, preset){
  try{
    const model = buildModel(text);
    S.model = model;
    S.yamlText = text;
    S.fileName = name || 'modell.yaml';
    S.selected = null;
    S.saved = {1:{}, 2:{}, 3:{}};
    S.routes = {1:{}, 2:{}, 3:{}};
    S.content = {1:{}, 2:{}, 3:{}};
    S.hidden = new Set();
    S.outline = null; S.hierSel = null;   // Übersicht zum neuen Modell neu prüfen
    S.outlineText = '';
    S.hierSaved = {}; S.hierRoutes = {}; S.hierShown = {}; S.hierText = {};
    if(preset) adoptLayoutFile(preset);
    else {
      const raw = await store.get('layouts:' + S.fileName);
      if(raw){ try{ adoptLayoutFile(JSON.parse(raw)); }catch(_){} }
    }
    $('fileLabel').textContent = S.fileName;
    renderMessages();
    syncLayoutMenu();
    setView(preset && preset.view ? preset.view : S.view);
    if(S.mode === 'hierarchie') setMode('hierarchie');
    const bad = model.messages.filter(m => m.level !== 'info').length;
    toast(bad ? `${Object.keys(model.objects).length} Objekte geladen · ${bad} Hinweise`
              : `${Object.keys(model.objects).length} Objekte geladen`);
  }catch(err){
    toast('Datei nicht lesbar: ' + err.message);
  }
}

/* ---------- YAML schreiben ---------- */
const yamlVal = v => /^[A-Za-z0-9_.\-]+$/.test(String(v))
  ? String(v) : '"' + String(v).replace(/(["\\])/g, '\\$1') + '"';

function modelToYaml(m){
  const att = attributionLine();
  const L = [
    '# Geschäftsobjekt-Explorer — bereinigter Stand vom ' + new Date().toLocaleDateString('de-DE'),
    '# Einrückung durchgängig mit Leerzeichen, ungültige Blöcke entfernt.'
  ];
  if(att) L.push('#', '# ' + att);
  L.push('');
  const mm = m.meta || {};
  if(mm.titel || mm.urheber || mm.lizenz){
    L.push('meta:');
    if(mm.titel)     L.push('  titel: ' + yamlVal(mm.titel));
    if(mm.urheber)   L.push('  urheber: ' + yamlVal(mm.urheber));
    if(mm.lizenz)    L.push('  lizenz: ' + yamlVal(mm.lizenz));
    if(mm.lizenzUrl) L.push('  lizenz_url: ' + yamlVal(mm.lizenzUrl));
    if(mm.hinweis)   L.push('  hinweis: ' + yamlVal(mm.hinweis));
    L.push('');
  }
  L.push('BusinessObjects:');
  for(const o of Object.values(m.objects)){
    L.push('  ' + yamlVal(o.name) + ':');
    if(o.domain) L.push('    Domain: ' + yamlVal(o.domain));
    if(o.keys.length){
      L.push('    business_keys:');
      o.keys.forEach(k => L.push('      - ' + yamlVal(k)));
    }
    if(o.sources.length){
      L.push('    sources:');
      o.sources.forEach(s => L.push('      - ' + yamlVal(s)));
    }
    if(o.rels.length){
      L.push('    relationships:');
      o.rels.forEach(r=>{
        L.push('      - to: ' + yamlVal(r.to));
        if(r.name) L.push('        name: ' + yamlVal(r.name));
        if(r.from || r.toCard){
          L.push('        cardinality:');
          if(r.from)   L.push('          from: ' + yamlVal(r.from));
          if(r.toCard) L.push('          to: ' + yamlVal(r.toCard));
        }
      });
    }
    L.push('');
  }
  return L.join('\n');
}

/* ---------- Eigenständigen Stand als HTML sichern ---------- */
function exportHTML(){
  const el = $('bakedState');
  const before = el.textContent;
  el.textContent = JSON.stringify(
    Object.assign({fileName:S.fileName, yaml:S.yamlText, view:S.view}, layoutFile())
  ).replace(/</g, '\\u003c');

  // Generierte Bereiche leeren, damit die Datei klein bleibt
  ['canvas','objectList','msgList','legend','detailBody'].forEach(id => $(id).innerHTML = '');
  const html = '<!DOCTYPE html>\n' + document.documentElement.outerHTML;
  el.textContent = before;

  initSvg(); draw(); renderObjectList(); renderMessages(); renderLegend(); renderDetails();
  download(html, S.fileName.replace(/\.[^.]+$/, '') + '-stand.html', 'text/html');
  toast('Eigenständige HTML-Datei gesichert');
}

/* ---------- Start ---------- */
async function boot(){
  initSvg();
  let preset = null;
  try{ preset = JSON.parse($('bakedState').textContent); }catch(_){}
  if(!preset){
    try{ preset = JSON.parse(await store.get('sitzung')); }catch(_){}
  }
  if(preset && preset.yaml) await loadYaml(preset.yaml, preset.fileName, preset);
  else await loadYaml(DEFAULT_YAML, 'willibald-attr.yaml');
}
boot();
window.addEventListener('resize', ()=> applyTransform());
document.fonts && document.fonts.ready.then(()=>{ if(S.graph){ setView(S.view); } });