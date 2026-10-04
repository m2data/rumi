/* =====================================================================
   7 — Ansicht wechseln, Anordnung merken
   ===================================================================== */
/* Die Komplettansicht (neu) aufbauen. Früher gab es drei Ansichten; die
   Ablagen behalten den Schlüssel 1 (S.view), damit ältere Dateien gelten. */
function setView({autoFit = true} = {}){
  S.graph = makeGraph(S.model);
  S.graph.nodes.forEach(n=>{ n.hidden = S.hidden.has(n.id); });
  const saved = S.saved[S.view] || {};
  const known = S.graph.nodes.filter(n => saved[n.id]);
  if(known.length === S.graph.nodes.length && known.length){
    S.graph.nodes.forEach(n=>{ n.x = saved[n.id].x; n.y = saved[n.id].y; });
    applyRoutes();
  } else if(known.length){
    // Nur einzelne Kästen sind neu (Objekt angelegt, Delta eingespielt,
    // Quelle/Domäne eingeschaltet): das Gelegte bleibt liegen — samt
    // Kantenzügen. Ein volles Auto-Layout warf hier jeden von Hand gezogenen
    // Zug weg, weil applyAutoLayout die Knicke löscht und persist() gleich
    // darauf den leeren Stand merkt. Anhängsel kommen rechts an ihr Objekt.
    known.forEach(n=>{ n.x = saved[n.id].x; n.y = saved[n.id].y; });
    applyRoutes();
    const neu = S.graph.nodes.filter(n => !saved[n.id]);
    const neuObj = neu.filter(n => !n.eltern && !n.hidden);
    if(neuObj.length){
      platziereNeue(neuObj, known);
      separate(visNodes().filter(n => !n.eltern));
    }
    platziereAnhaengsel(S.graph, neu);
    persist();
  } else {
    applyAutoLayout(S.graph);
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
  spreadLabels();                          // überlappende Beziehungs-Labels entzerren
}

/* Ablage: im Claude-Artefakt window.storage, in einer heruntergeladenen
   Datei localStorage. Beides kann fehlen, dann wird nicht gespeichert —
   aber nicht still: bei einem großen Modell läuft localStorage über die
   Quota, und ohne Warnung verschwänden Positionen erst beim nächsten
   Öffnen. Einmal je Sitzung reicht, sonst nervt der Toast bei jedem Zug. */
let storeWarned = false;
function warnStoreOnce(){
  if(storeWarned) return;
  storeWarned = true;
  toast('Speichern im Browser fehlgeschlagen (Speicher voll?) — Positionen über „Datei & Export" als JSON sichern');
}
const store = {
  async get(key){
    if(window.storage){
      try{ const r = await window.storage.get(key); if(r && r.value) return r.value; }catch(_){}
    }
    try{ return localStorage.getItem(key); }catch(_){ return null; }
  },
  async set(key, value){
    if(window.storage){ try{ await window.storage.set(key, value); }catch(_){} }
    try{ localStorage.setItem(key, value); }catch(_){ warnStoreOnce(); }
  }
};

const layoutFile = ()=> ({
  version: 5,
  verfahren: S.layout,
  ansichten: S.saved,
  kantenzuege: S.routes,
  inhalt: S.content,
  ausgeblendet: [...S.hidden],
  pflegeAn: S.pflegeAn,
  zusatzfelder: S.zusatzAn,
  elemente: S.elemente,
  uebersichtText: S.outlineText,
  hierarchie: { anordnung: S.hierSaved, kantenzuege: S.hierRoutes, sichtbar: S.hierShown, text: S.hierText }
});

function adoptLayoutFile(obj){
  if(!obj || typeof obj !== 'object') return false;
  const a = obj.ansichten || ((obj[1] || obj[2] || obj[3]) ? obj : null);
  if(a) S.saved = {1:a[1]||{}};               // Ansicht 2 und 3 älterer Dateien entfallen
  if(obj.verfahren && obj.verfahren.algo) S.layout = {
    algo: ALGOS[obj.verfahren.algo] ? obj.verfahren.algo : 'hier',
    dir: DIR_NAME[obj.verfahren.dir] ? obj.verfahren.dir : 'TB',
    labels: obj.verfahren.labels !== false
  };
  if(obj.kantenzuege) S.routes = {1:obj.kantenzuege[1]||{}};
  if(obj.inhalt) S.content = {1:obj.inhalt[1]||{}};
  if(Array.isArray(obj.ausgeblendet)) S.hidden = new Set(obj.ausgeblendet);
  if(typeof obj.pflegeAn === 'boolean') S.pflegeAn = obj.pflegeAn;
  if(obj.zusatzfelder && typeof obj.zusatzfelder === 'object') S.zusatzAn = {
    objekt:   Array.isArray(obj.zusatzfelder.objekt)   ? obj.zusatzfelder.objekt.slice()   : [],
    attribut: Array.isArray(obj.zusatzfelder.attribut) ? obj.zusatzfelder.attribut.slice() : []
  };
  if(obj.elemente && typeof obj.elemente === 'object')
    S.elemente = {quelle: !!obj.elemente.quelle, domaene: !!obj.elemente.domaene};
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
  const snap = JSON.stringify(blob);
  store.set('layouts:' + S.fileName, snap);
  const sitzung = JSON.stringify(
    Object.assign({fileName:S.fileName, yaml:S.yamlText}, blob));
  store.set('sitzung', sitzung);
  // Tab-eigene Sitzung: localStorage teilen sich alle Tabs (letzter Schreiber
  // gewinnt) — sessionStorage gilt nur für diesen Tab und hat beim Neuladen
  // Vorrang. So behält jeder Tab sein eigenes Modell.
  try{ sessionStorage.setItem('sitzung', sitzung); }catch(_){ warnStoreOnce(); }
  recordHistory(JSON.stringify({yaml:S.yamlText, stand:layoutFile()}));
}

/* ---- Verlauf: Rückgängig (Strg+Z) / Wiederherstellen (Strg+Y) ----
   Schnappschuss-basiert: jede gespeicherte Aktion (Verschieben, Anordnen,
   Kante umlenken, Ein-/Ausblenden, Inhalt, Delta-Geschäftsobjekte, jede
   Einstellung) legt einen Stand aus Modelltext und layoutFile() ab. Das Modell gehört dazu, damit auch
   ein eingespieltes Delta rückgängig geht. Es werden die letzten 20 Aktionen
   behalten (also 21 Stände). */
const HIST_MAX = 20;
let hist = [], histPos = -1, restoringHistory = false;
function resetHistory(){ hist = [JSON.stringify({yaml:S.yamlText, stand:layoutFile()})]; histPos = 0; }
function recordHistory(snap){
  if(restoringHistory) return;
  if(histPos >= 0 && hist[histPos] === snap) return;      // keine echte Änderung
  hist = hist.slice(0, histPos + 1);                       // ein neuer Zweig verwirft „Wiederherstellen"
  hist.push(snap);
  while(hist.length > HIST_MAX + 1) hist.shift();
  histPos = hist.length - 1;
}
function restoreHistory(snap){
  restoringHistory = true;                                 // die folgenden persist()/writeStore() nicht mitschreiben
  try{
    const p = JSON.parse(snap);
    // Anderer Modelltext (Delta rückgängig/wiederhergestellt): Modell neu bauen
    if(p.yaml !== S.yamlText){
      S.yamlText = p.yaml;
      S.model = buildModel(p.yaml);
      renderMessages();
    }
    const beforeOutline = S.outlineText;
    adoptLayoutFile(p.stand);
    // Einstellungen gehen mit zurück: ohne Pflege kein offenes Formular
    if(!S.pflegeAn){ S.pflege = null; pfEntwurf = null; }
    syncEinstMenu();
    // Änderte sich die Hierarchie-Struktur, den Baum aus dem Text neu aufbauen.
    if(S.outlineText !== beforeOutline){ S.outline = null; parseOutline(); }
    if(S.mode === 'hierarchie'){
      renderOutlineTree();
      if(S.hierSel && !(S.outline && outlineFind(S.outline.roots, S.hierSel))){
        const flat = S.outline ? outlineFlat(S.outline.roots) : [];
        S.hierSel = flat.length ? flat[0].id : null;
      }
      if(S.hierSel) selectDiagram(S.hierSel); else draw();
    }
    else setView({autoFit:false});
    syncLayoutMenu();
    writeStore();
  } finally { restoringHistory = false; }
}
function undo(){
  if(histPos <= 0){ toast('Nichts zum Rückgängigmachen'); return; }
  restoreHistory(hist[--histPos]); toast('Rückgängig');
}
function redo(){
  if(histPos < 0 || histPos >= hist.length - 1){ toast('Nichts zum Wiederherstellen'); return; }
  restoreHistory(hist[++histPos]); toast('Wiederhergestellt');
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
   dort hinzuholen. Anhängsel (Quelle/Domäne) gehören zu ihrem Objekt und
   stehen nicht in der Liste. */
function listedNodes(){ return S.graph.nodes.filter(n => !n.eltern); }

const collapsedGroups = new Set();          // zugeklappte Domänen (nur diese Sitzung)

function renderObjectList(){
  $('objNew').hidden = !S.pflegeAn;          // Einstellung „Geschäftsobjekte bearbeiten"
  const ul = $('objectList');
  const groups = new Map();
  listedNodes().forEach(n=>{
    const g = n.ref.domain || 'Ohne Domain';
    if(!groups.has(g)) groups.set(g, []);
    groups.get(g).push(n);
  });
  let html = '';
  const gidx = [];
  for(const [g, list] of groups){
    const gi = gidx.push(list) - 1;
    const collapsed = collapsedGroups.has(g);
    const shownOff = list.filter(n=>n.hidden).length;
    html += `<li class="grouphead${collapsed ? ' collapsed' : ''}">
      <button class="gcaret" data-grp="${esc(g)}" aria-expanded="${!collapsed}" aria-label="Domäne auf- oder zuklappen">▾</button>
      <span class="gname" data-grp="${esc(g)}">${esc(g.toUpperCase())}</span>
      ${collapsed ? `<span class="gcount">${list.length}</span>` : ''}
      <span class="gtools"><button data-gi="${gi}" data-on="1">alle</button>
      <button data-gi="${gi}" data-on="0">keine</button></span></li>`;
    if(collapsed) continue;
    list.sort((a,b)=> a.name.localeCompare(b.name, 'de')).forEach(n=>{
      const meta = `${n.ref.keys.length} BK · ${n.ref.attrs.length} A · ${n.ref.rels.length} B`;
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
  ul.querySelectorAll('.gcaret, .gname').forEach(el=> el.addEventListener('click', ()=>{
    const g = el.dataset.grp;
    if(collapsedGroups.has(g)) collapsedGroups.delete(g); else collapsedGroups.add(g);
    renderObjectList();
  }));
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

/* Zu einer Entität alle über Beziehungen verknüpften Entitäten ins Diagramm
   holen. „zu 1"-Nachbarn (Kardinalität auf der Nachbarseite ist nicht „viele")
   an den Anfang der Flussrichtung, „zu n" ans Ende — TB: 1 oben / n unten,
   BT umgekehrt, LR: 1 links / n rechts, RL umgekehrt. Nur noch nicht enthaltene
   (versteckte) Objekte werden eingeblendet und platziert; vorhandene bleiben. */
function addRelated(id){
  const A = S.graph.byId.get(id);
  if(!A) return;
  const neigh = new Map();
  S.graph.edges.forEach(e=>{
    if(e.from === e.to) return;                       // Selbstbezug übersprungen
    let nb, card;
    if(e.from === id){ nb = e.to; card = e.toCard; }
    else if(e.to === id){ nb = e.from; card = e.fromCard; }
    else return;
    const node = S.graph.byId.get(nb);
    if(!node || node.eltern) return;                  // Quelle/Domäne ist kein verknüpftes Objekt
    const many = /_or_many$/.test(card || '');
    const cur = neigh.get(nb);
    neigh.set(nb, {node, many: (cur ? cur.many : false) || many});   // mehrere Kanten: „viele" gewinnt
  });
  const neu = [...neigh.values()].filter(v => v.node.hidden);
  const selbst = A.hidden;                                   // Objekt selbst noch nicht im Diagramm?
  if(!neu.length && !selbst){ toast(neigh.size ? 'Alle Verknüpften sind bereits im Diagramm' : 'Keine verknüpften Objekte'); return; }

  const dir = (ALGOS[S.layout.algo] || ALGOS.hier).dir ? S.layout.dir : 'TB';
  const vertical = dir === 'TB' || dir === 'BT';
  const oneSign = (dir === 'TB' || dir === 'LR') ? -1 : 1;   // Anfang der Flussrichtung
  const GAP = 40, SEP = 24;

  if(selbst){                                                // Objekt selbst einblenden und platzieren
    A.hidden = false; markVisible(A.id, true);
    const others = visNodes().filter(n => n !== A);
    if(others.length){
      const x0 = Math.min(...others.map(n=>n.x)), x1 = Math.max(...others.map(n=>n.x + n.w));
      const y1 = Math.max(...others.map(n=>n.y + n.h));
      A.x = Math.round((x0 + x1)/2 - A.w/2); A.y = Math.round(y1 + 120);
    } else { A.x = 0; A.y = 0; }
  }

  neu.forEach(v => { v.node.hidden = false; markVisible(v.node.id, true); });   // sichtbar + in der Menge merken

  const place = (group, sign)=>{
    if(!group.length) return;
    if(vertical){
      const base = sign < 0 ? A.y - GAP : A.y + A.h + GAP;
      let x = A.x + A.w/2 - (group.reduce((t,v)=> t + v.node.w + SEP, -SEP)) / 2;
      group.forEach(v=>{ v.node.x = Math.round(x); v.node.y = Math.round(sign < 0 ? base - v.node.h : base); x += v.node.w + SEP; });
    } else {
      const base = sign < 0 ? A.x - GAP : A.x + A.w + GAP;
      let y = A.y + A.h/2 - (group.reduce((t,v)=> t + v.node.h + SEP, -SEP)) / 2;
      group.forEach(v=>{ v.node.x = Math.round(sign < 0 ? base - v.node.w : base); v.node.y = Math.round(y); y += v.node.h + SEP; });
    }
  };
  place(neu.filter(v => !v.many), oneSign);                 // „zu 1" an den Anfang
  place(neu.filter(v => v.many), -oneSign);                 // „zu n" ans Ende
  const bewegt = new Set(neu.map(v => v.node.id).concat(selbst ? [A.id] : []));
  platziereAnhaengsel(S.graph, S.graph.nodes.filter(n => bewegt.has(n.eltern)));

  S.selEdge = null;
  draw(); renderObjectList(); renderDetails(); updateAlignBar(); persist();
  const total = neu.length + (selbst ? 1 : 0);
  toast(total + (total === 1 ? ' Objekt hinzugefügt' : ' Objekte hinzugefügt'));
}

function renderDetails(){
  const box = $('detailBody'), empty = $('detailEmpty');
  const n = S.selected && S.graph.byId.get(S.selected);
  if(!n){ box.hidden = true; empty.hidden = false; return; }
  box.hidden = false; empty.hidden = true;

  // Ein angefangenes Formular gehört zu genau einem Objekt: wechselt die
  // Auswahl, ist es vom Tisch (wie die Beschreibung im Hierarchie-Modus).
  if(S.pflege && (S.pflege !== n.id || S.sel.size > 1)){ S.pflege = null; pfEntwurf = null; }

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

  if(S.pflege === n.id){ pflegeFormular(box); return; }

  if(n.eltern){
    // Anhängsel: wer sonst noch diese Quelle nutzt bzw. in dieser Domäne liegt
    const quelle = n.kind === 'source';
    const nutzer = Object.values(S.model.objects)
      .filter(o => quelle ? o.sources.includes(n.name) : o.domain === n.name).map(o => o.name);
    box.innerHTML =
      `<div class="grouphead">${quelle ? 'QUELLE' : 'DOMÄNE'}</div>
       <dl class="kv"><dt>Name</dt><dd>${esc(n.name)}</dd></dl>
       <div class="grouphead">${quelle ? 'VERSORGT' : 'GESCHÄFTSOBJEKTE'}</div>` +
      nutzer.map(u=>`<div class="rel"><span class="arrow">←</span>
        <button data-goto="o:${esc(u)}">${esc(u)}</button></div>`).join('');
  } else {
    const o = n.ref;
    const incoming = [];
    Object.values(S.model.objects).forEach(src=>
      src.rels.forEach(r=>{ if(r.to === o.name) incoming.push({from:src.name, r}); }));
    box.innerHTML =
      `<div class="grouphead">GESCHÄFTSOBJEKT</div>
       <dl class="kv"><dt>Name</dt><dd>${esc(o.name)}</dd></dl>
       ${S.pflegeAn ? `<button class="relbtn edit" data-edit="1" title="Name, Domain, Beschreibung, Schlüssel, Quellen, Attribute und Beziehungen dieses Objekts ändern">Bearbeiten</button>` : ''}
       <button class="relbtn" data-related="1" title="Alle über Beziehungen verknüpften Objekte einblenden und um dieses Objekt anordnen">Verknüpfte Objekte ins Diagramm holen</button>
       <dl class="kv"><dt>Domain</dt><dd>${o.domain ? esc(o.domain) : '—'}</dd></dl>
       ${S.zusatzAn.objekt.map(k=>`<dl class="kv"><dt>${esc(k)}</dt><dd>${o.extra[k] ? esc(o.extra[k]) : '—'}</dd></dl>`).join('')}
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
          </tr>` + (a.ref ? `<tr><td class="aref" colspan="3">→ ${esc(a.ref)}</td></tr>` : '')
          + S.zusatzAn.attribut.filter(k => a.extra[k]).map(k=>
            `<tr><td class="aref" colspan="3">${esc(k)}: ${esc(a.extra[k])}</td></tr>`).join('')).join('') + `</table>`
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
  box.querySelectorAll('[data-related]').forEach(b=>
    b.addEventListener('click', ()=> addRelated(n.id)));
  box.querySelectorAll('[data-edit]').forEach(b=>
    b.addEventListener('click', ()=> pflegeStart(n.id)));
}

const expandedMsgGroups = new Set();        // aufgeklappte Hinweisgruppen (nur diese Sitzung)

function renderMessages(){
  const list = S.model.messages;
  const bad = list.filter(m => m.level !== 'info').length;
  const badge = $('msgBadge');
  badge.textContent = list.length;
  badge.classList.toggle('zero', bad === 0);
  const lvl = l => l === 'err' ? 'Fehler' : l === 'warn' ? 'Hinweis' : 'Info';
  // Gleichartige Hinweise (gleicher Typ hinter dem letzten „: ") zusammenfassen.
  const typeOf = t => { const i = t.lastIndexOf(': '); return i >= 0 ? t.slice(i + 2) : t; };
  const objOf  = t => { const i = t.lastIndexOf(': '); return i >= 0 ? t.slice(0, i) : t; };
  const groups = new Map();
  list.forEach(m=>{
    const label = m.group || typeOf(m.title);      // stabiler Typ, sonst aus dem Titel
    const key = m.level + '|' + label;
    if(!groups.has(key)) groups.set(key, {key, level:m.level, label, items:[]});
    groups.get(key).items.push(m);
  });
  // Betrifft der Hinweis ein Objekt (m.obj), wird sein Titel klickbar:
  // auswählen, bei Bedarf einblenden und im Diagramm zentrieren.
  const link = (m, text, cls)=> m.obj
    ? `<button class="${cls}" data-msgobj="${esc(m.obj)}" title="Im Diagramm zeigen">${esc(text)}</button>`
    : `<span class="${cls}">${esc(text)}</span>`;
  const one = m => `<div class="msg ${m.level}"><strong>${lvl(m.level)}</strong>${link(m, m.title, 'mlink')}<br>${esc(m.body)}</div>`;
  let html = '';
  for(const g of groups.values()){
    if(g.items.length === 1){ html += one(g.items[0]); continue; }
    const open = expandedMsgGroups.has(g.key);
    html += `<div class="msg ${g.level} mgroup${open ? ' open' : ''}">
      <button class="mgh" data-mk="${esc(g.key)}" aria-expanded="${open}">
        <span class="mcaret">▾</span><span class="mgt"><strong>${lvl(g.level)}</strong>${esc(g.label)}</span>
        <span class="mcount">${g.items.length}×</span></button>
      <div class="mgbody">${g.items.map(m=>
        `<div class="mgi">${link(m, objOf(m.title), 'mgi-obj')}<br>${esc(m.body)}</div>`).join('')}</div></div>`;
  }
  $('msgList').innerHTML = html || '<div class="empty">Keine Auffälligkeiten gefunden.</div>';
  $('msgList').querySelectorAll('.mgh').forEach(b=> b.addEventListener('click', ()=>{
    const k = b.dataset.mk;
    if(expandedMsgGroups.has(k)) expandedMsgGroups.delete(k); else expandedMsgGroups.add(k);
    renderMessages();
  }));
  $('msgList').querySelectorAll('[data-msgobj]').forEach(b=>
    b.addEventListener('click', ()=> gotoObject(b.dataset.msgobj)));
}

/* Aus der Prüfliste zum Objekt springen: auswählen, bei Bedarf einblenden und
   zentrieren. Anders als select(id, true) wird nicht umgeschaltet (ein zweiter
   Klick wählt nicht ab) und die Seitenleiste bleibt auf der Prüfliste stehen —
   wer Hinweise abarbeitet, will die Liste nicht bei jedem Sprung verlieren. */
function gotoObject(name){
  const n = S.graph.byId.get('o:' + name);
  if(!n){ toast(`„${name}" kommt in dieser Ansicht nicht vor`); return; }
  if(n.hidden){ setVisible(n.id, true); toast(name + ' eingeblendet'); }
  S.selEdge = null;
  S.sel = new Set([n.id]); S.selected = n.id;
  draw(); syncListSelection(); renderDetails(); updateAlignBar(); syncLayoutMenu();
  const r = svg.getBoundingClientRect();
  S.t.x = r.width/2 - (n.x + n.w/2)*S.t.k;
  S.t.y = r.height/2 - (n.y + n.h/2)*S.t.k;
  applyTransform();
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
  const ohne = (k, txt)=> `<div><svg width="66" height="22" viewBox="0 0 66 22" aria-hidden="true">
      <g class="eg ${k}"><path class="e-path" d="M4 11H60"/></g></svg>${txt}, ohne Kardinalität</div>`;
  if(S.elemente.quelle)  html += ohne('quelle', 'Quelle');
  if(S.elemente.domaene) html += ohne('domaene', 'Domäne');
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
  draw(); syncListSelection(); renderDetails(); updateAlignBar(); syncLayoutMenu();
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
  syncLayoutMenu();
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
  const vorher = new Map(list.map(n => [n.id, {x:n.x, y:n.y}]));
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
  // Anhängsel folgen ihrem Objekt um denselben Versatz — außer sie sind selbst markiert
  S.graph.nodes.forEach(n=>{
    const v = vorher.get(n.eltern), p = S.graph.byId.get(n.eltern);
    if(!v || S.sel.has(n.id)) return;
    n.x += p.x - v.x; n.y += p.y - v.y;
  });
  // Umgelenkte Kanten zwischen bewegten Knoten sind danach nicht mehr stimmig;
  // die Kante zum mitgewanderten Anhängsel bleibt es
  S.graph.edges.forEach(e=>{
    const mit = vorher.has(e.from) && S.graph.byId.get(e.to).eltern === e.from && !S.sel.has(e.to);
    if((S.sel.has(e.from) || S.sel.has(e.to)) && !e.manual && !mit){
      e.bends = null; e.portFrom = null; e.portTo = null;
    }
  });
  draw(); persist();
}

$('alignBar').querySelectorAll('button').forEach(b=> b.onclick = ()=> alignSelection(b.dataset.al));

function renderContentMenu(){
  const C = contentOf();
  // Steht Quelle bzw. Domäne als eigener Kasten daneben, fehlt sie im Kasten
  const gesperrt = {sources: !!S.elemente.quelle, domain: !!S.elemente.domaene};
  let html = '';
  CONTENT_FIELDS.forEach(f=>{
    const locked = !!gesperrt[f.k];
    const off = (f.sub && !C[f.sub]) || locked;
    html += `<button class="opt${f.sub ? ' indent' : ''}${off ? ' off' : ''}" data-content="${f.k}"
      role="menuitemcheckbox" aria-checked="${!locked && !!C[f.k]}">${esc(f.label)}<span class="tick">✓</span></button>`;
  });
  if(gesperrt.sources || gesperrt.domain)
    html += `<div class="note">${[gesperrt.domain && 'Domäne', gesperrt.sources && 'Quellen'].filter(Boolean).join(' und ')}
      stehen als eigene Elemente neben dem Objekt (Einstellungen).</div>`;
  $('contentList').innerHTML = html;
  $('contentList').querySelectorAll('[data-content]').forEach(b=> b.onclick = ()=>{
    if(b.classList.contains('off')) return;
    const k = b.dataset.content;
    const cur = contentOf();
    S.content[1] = Object.assign({}, cur, {[k]: !cur[k]});
    applyContent();
  });
}

/* Diagramm neu aufbauen, Lagen der Knoten behalten: nach geändertem Inhalt
   (Kästen neu vermessen) oder umgeschalteten Elementen (Einstellungen). */
function neuAufbauen(){
  if(S.mode === 'hierarchie'){
    // Ausschnitt behalten: nur die Lagen der sichtbaren Knoten sichern und das
    // Diagramm neu aufbauen (showDiagram misst die Kästen neu). NICHT setView,
    // das wuerde alle Geschäftsobjekte einblenden.
    const keep = {};
    visNodes().forEach(n=>{ keep[n.id] = {x:n.x, y:n.y}; });
    if(S.hierSel) S.hierSaved[S.hierSel] = Object.assign({}, S.hierSaved[S.hierSel], keep);
    const node = S.hierSel && S.outline ? outlineFind(S.outline.roots, S.hierSel) : null;
    if(node) showDiagram(node);
  } else {
    const keep = {};
    S.graph.nodes.forEach(n=>{ keep[n.id] = {x:n.x, y:n.y}; });
    S.saved[S.view] = Object.assign({}, S.saved[S.view], keep);
    setView({autoFit:false});
  }
  renderContentMenu();
}

function applyContent(){
  neuAufbauen();
  toast('Inhalt geändert — bei Bedarf neu anordnen');
}

function setSidePane(name){
  document.querySelectorAll('.sidetab').forEach(t=> t.setAttribute('aria-selected', String(t.dataset.pane === name)));
  document.querySelectorAll('.pane').forEach(p=> p.classList.toggle('active', p.id === 'pane-'+name));
}

/* =====================================================================
   9b — Zoom und Tastatur (Zeiger-Interaktion: siehe interaktion.js)
   ===================================================================== */

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
  // Strg+S sichert den Stand — auch aus einem Eingabefeld heraus, sonst öffnete
  // der Browser seinen eigenen „Seite speichern"-Dialog und legte eine Kopie an.
  if((ev.ctrlKey || ev.metaKey) && !ev.altKey && (ev.key === 's' || ev.key === 'S')){
    ev.preventDefault(); speichernInDatei(); return;
  }
  // In einem Eingabefeld (Suche, Beschreibung, Umbenennen) gilt keine Kurztaste —
  // dort tippt man Text (auch Ziffern), nur Escape verlässt das Feld. Sonst löste
  // z. B. die Taste „f" ein Einpassen aus.
  const editable = ev.target.matches
    && (ev.target.matches('input, textarea, select') || ev.target.isContentEditable);
  if(editable){ if(ev.key === 'Escape') ev.target.blur(); return; }
  if((ev.ctrlKey || ev.metaKey) && !ev.altKey && (ev.key === 'z' || ev.key === 'Z')){
    ev.preventDefault();
    if(ev.shiftKey) redo(); else undo();       // Strg+Umschalt+Z = Wiederherstellen
    return;
  }
  if((ev.ctrlKey || ev.metaKey) && (ev.key === 'y' || ev.key === 'Y')){
    ev.preventDefault(); redo(); return;
  }
  if(ev.key === 'Escape'){
    if(!$('zusatzDlg').hidden){ zusatzZu(); return; }
    if(S.selEdge){ S.selEdge = null; draw(); }
    else if(S.sel.size) setSelection([]);
    closeMenus();
  }
  if((ev.ctrlKey || ev.metaKey) && (ev.key === 'a' || ev.key === 'A')){
    ev.preventDefault();
    setSelection(visNodes().map(n=>n.id));
    toast(S.sel.size + ' Objekte gewählt');
  }
  // Auswahl mit den Pfeiltasten verschieben: fein, mit Umschalt ein Rasterfeld
  if(PFEIL[ev.key]){
    const [dx, dy] = PFEIL[ev.key], s = ev.shiftKey ? 24 : 4;
    if(moveSelection(dx * s, dy * s)) ev.preventDefault();
    return;
  }
  // Entf blendet die markierten Objekte aus (Strg+Z holt sie zurück)
  if(ev.key === 'Delete'){
    // Anhängsel (Quelle/Domäne) gehen mit ihrem Objekt, nicht allein
    const list = [...S.sel].map(id => S.graph.byId.get(id)).filter(n => n && !n.hidden && !n.eltern);
    if(!list.length) return;
    ev.preventDefault();
    setGroupVisible(list, false);
    toast(list.length + (list.length === 1 ? ' Objekt ausgeblendet' : ' Objekte ausgeblendet'));
    return;
  }
  if(ev.key === 'f' || ev.key === 'F') fit();
});

const PFEIL = {ArrowLeft:[-1,0], ArrowRight:[1,0], ArrowUp:[0,-1], ArrowDown:[0,1]};

/* Die markierten Objekte um dx/dy verschieben. Kanten INNERHALB der Auswahl
   wandern starr mit.

   Kanten über die Auswahlgrenze behalten ihren Zug. Anders als beim Ziehen mit
   der Maus, wo ein weiter Weg ein Neuziehen rechtfertigt, sind die Pfeiltasten
   zum Feinjustieren da: einen von Hand gelegten oder vom Verfahren geführten
   Zug für ein Rasterfeld wegzuwerfen, nimmt mehr weg, als die Bewegung wert
   ist. Anschlusspunkte sind Seite plus Anteil und wandern mit dem Kasten, die
   Stützpunkte bleiben liegen — es ändert sich also von selbst nur das Stück am
   bewegten Objekt. Gibt false zurück, wenn nichts markiert ist. */
function moveSelection(dx, dy){
  const ids = samtAnhaengseln([...S.sel].filter(id => isVisible(id)));
  if(!ids.size) return false;
  S.graph.edges.forEach(e=>{
    if(ids.has(e.from) && ids.has(e.to) && e.bends)
      e.bends.forEach(q=>{ q.x += dx; q.y += dy; });
  });
  ids.forEach(id=>{ const n = S.graph.byId.get(id); n.x = Math.round(n.x + dx); n.y = Math.round(n.y + dy); });

  /* Rechtwinklige Züge bleiben rechtwinklig: das Stück zwischen Anschluss und
     erstem Stützpunkt lief achsparallel, und der Anschluss ist gerade
     mitgewandert. Ohne Nachzug bliebe ein schräger Stummel am Kasten stehen —
     gezeichnet wird der Zug als gerade Strecke von Punkt zu Punkt. Die
     Anschlussseite gibt die Achse vor: oben/unten heißt senkrecht hinaus, also
     übernimmt der Stützpunkt die Querlage des Anschlusses.

     Erst ab zwei Stützpunkten: bei nur einem müssten beide Enden dieselbe
     Spalte fordern, und das Nachziehen des einen bräche die Achse am anderen. */
  const nachziehen = (e, port, bend, n)=>{
    if(!e.ortho || !port || !bend || !n) return;
    const p = portPoint(n, port);
    if(port.side === 'T' || port.side === 'B') bend.x = Math.round(p.x);
    else                                       bend.y = Math.round(p.y);
  };
  S.graph.edges.forEach(e=>{
    const a = ids.has(e.from), b = ids.has(e.to);
    if(a === b || !e.bends || e.bends.length < 2) return;   // nur über die Grenze
    if(a) nachziehen(e, e.portFrom, e.bends[0], S.graph.byId.get(e.from));
    else  nachziehen(e, e.portTo, e.bends[e.bends.length-1], S.graph.byId.get(e.to));
  });

  spreadLabels(S.graph.edges.filter(e => ids.has(e.from) || ids.has(e.to)));
  draw(); persist();
  return true;
}

/* =====================================================================
   10 — Kopfzeile und Menü
   ===================================================================== */
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

// Diagramme im Baum per Drag verschieben: obere/untere Kante = davor/danach,
// Mitte = als Unterdiagramm.
let hierDragId = null;
const clearHierDrop = ()=> $('hierTree').querySelectorAll('.drop-before,.drop-after,.drop-inside')
  .forEach(e=>{ e.classList.remove('drop-before','drop-after','drop-inside'); delete e.dataset.dropPos; });
$('hierTree').addEventListener('dragstart', ev=>{
  const row = ev.target.closest('.dnode'); if(!row) return;
  hierDragId = row.dataset.id;
  ev.dataTransfer.effectAllowed = 'move';
  try{ ev.dataTransfer.setData('text/plain', hierDragId); }catch(_){}
});
$('hierTree').addEventListener('dragover', ev=>{
  if(!hierDragId) return;
  const row = ev.target.closest('.dnode');
  if(!row) return;
  ev.preventDefault();
  clearHierDrop();
  const r = row.getBoundingClientRect();
  const rel = (ev.clientY - r.top) / r.height;
  const pos = rel < 0.28 ? 'before' : rel > 0.72 ? 'after' : 'inside';
  row.classList.add('drop-' + pos);
  row.dataset.dropPos = pos;
});
$('hierTree').addEventListener('drop', ev=>{
  if(!hierDragId) return;
  ev.preventDefault();
  const row = ev.target.closest('.dnode');
  if(row && row.dataset.id !== hierDragId) outlineMove(hierDragId, row.dataset.id, row.dataset.dropPos || 'inside');
  clearHierDrop(); hierDragId = null;
});
$('hierTree').addEventListener('dragend', ()=>{ clearHierDrop(); hierDragId = null; });

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

/* Nur die markierten Objekte mit dem gewählten Verfahren anordnen. Der übrige
   Plan bleibt liegen: die Auswahl wird nach dem Anordnen an ihre alte Mitte
   zurückgeschoben. Kanten mit einem Ende in der Auswahl werden neu gezogen. */
function arrangeSelection(){
  const markiert = [...S.sel].map(id => S.graph.byId.get(id)).filter(n => n && !n.hidden);
  if(markiert.length < 2){ toast('Mindestens zwei Objekte markieren'); return; }
  // Anhängsel der markierten Objekte werden mit angeordnet, das Verfahren
  // setzt sie wieder neben ihr Objekt
  const ids = samtAnhaengseln(markiert.map(n => n.id));
  const sel = [...ids].map(id => S.graph.byId.get(id));
  const sub = S.graph.edges.filter(e => ids.has(e.from) && ids.has(e.to));
  const bbox = list=>{
    const x0 = Math.min(...list.map(n=>n.x)), y0 = Math.min(...list.map(n=>n.y));
    const x1 = Math.max(...list.map(n=>n.x+n.w)), y1 = Math.max(...list.map(n=>n.y+n.h));
    return {cx:(x0+x1)/2, cy:(y0+y1)/2};
  };
  const before = bbox(sel);
  S.graph.edges.forEach(e=>{                    // Kanten an der Auswahl lösen
    if(ids.has(e.from) || ids.has(e.to)){ e.bends = null; e.ortho = false; e.portFrom = null; e.portTo = null; e.manual = false; }
  });
  const algo = ALGOS[S.layout.algo] || ALGOS.hier;
  runByComponent(sel, sub, algo.dir ? S.layout.dir : 'TB', algo.fn);
  const after = bbox(sel);
  const dx = Math.round(before.cx - after.cx), dy = Math.round(before.cy - after.cy);
  sel.forEach(n=>{ n.x += dx; n.y += dy; });    // zurück an die alte Mitte
  sub.forEach(e=>{ if(e.bends) e.bends.forEach(q=>{ q.x += dx; q.y += dy; }); });
  spreadLabels(S.graph.edges.filter(e => ids.has(e.from) || ids.has(e.to)));
  S.selEdge = null; persist(); draw();
  const a = ALGOS[S.layout.algo] || ALGOS.hier;
  toast(markiert.length + ' Objekte angeordnet (' + (a.dir ? a.name + ', ' + DIR_NAME[S.layout.dir] : a.name) + ')');
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

// Ist ein Bereich markiert (>=2 sichtbare Knoten), wirkt das Verfahren nur auf
// ihn — so lässt sich für einen Teil ein anderes Auto-Layout wählen.
const selArrange = ()=> [...S.sel].filter(id => isVisible(id)).length >= 2;
function applyLayoutChoice(){
  if(selArrange()){ arrangeSelection(); syncLayoutMenu(); }
  else relayout(true);
}
$('layoutMenu').querySelectorAll('.opt[data-algo]').forEach(b => b.onclick = ()=>{
  S.layout.algo = b.dataset.algo; applyLayoutChoice();
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
    // Ist ein Bereich markiert, nur dessen Kanten (mind. ein Ende in der Auswahl)
    // neu ziehen; sonst alle.
    const selIds = new Set([...S.sel].filter(id => isVisible(id)));
    const list = selIds.size
      ? S.graph.edges.filter(e => selIds.has(e.from) || selIds.has(e.to))
      : S.graph.edges;
    const n = rerouteEdges(list);
    persist();
    toast(n + (selIds.size ? ' Kanten der Auswahl neu gezogen' : ' Kanten neu gezogen'));
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
  applyLayoutChoice();
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
[['btnMenu','menu'], ['btnLayout','layoutMenu'], ['btnContent','contentMenu'], ['btnEinst','einstMenu']].forEach(([bid, mid])=>{
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
  // Laden
  if(a === 'open') $('fileInput').click();
  if(a === 'openDelta') $('deltaInput').click();
  if(a === 'loadUebersicht') $('uebersichtInput').click();
  if(a === 'loadLayout') $('layoutInput').click();
  // Speichern
  if(a === 'saveGO'){
    download(S.yamlText, S.fileName.replace(/\.[^.]+$/, '') + '.yaml', 'text/yaml');
    toast('Geschäftsobjekte gespeichert');
  }
  if(a === 'uebersicht'){
    if(!S.outline) parseOutline();
    download(outlineToYaml(S.outline.roots), uebersichtName(), 'text/yaml');
    toast('Hierarchiebeschreibung gespeichert');
  }
  if(a === 'layout') download(JSON.stringify(layoutFile(), null, 2), diagramName()+'-positionen.json', 'application/json');
  if(a === 'saveHtml') speichernInDatei();
  // Diagramm exportieren
  if(a === 'svg') download(exportSVG(), diagramName()+'.svg', 'image/svg+xml');
  if(a === 'png') exportPNG(+b.dataset.scale || 2);
});

/* Kontextmenü am Kasten: dieselben Aktionen wie im Detailbereich und auf der
   Entf-Taste, nur dort erreichbar, wo das Objekt liegt — neue Fähigkeiten
   kommen keine dazu. Der Inhalt entsteht bei jedem Öffnen, denn welche
   Einträge gelten, hängt an der Größe der Auswahl, an der Art des Objekts und
   am Schalter „Geschäftsobjekte bearbeiten". Geschlossen wird es von
   closeMenus() — es trägt die Klasse .menu und hängt damit schon an Escape
   und am Klick daneben. */
function ctxMenuOeffnen(n, x, y){
  const m = $('ctxMenu');
  const list = [...S.sel].map(id => S.graph.byId.get(id)).filter(k => k && !k.hidden);
  const mehrere = list.length > 1;
  const einzeln = !mehrere && n.kind === 'object';      // Quellen kennen weder Pflege noch Nachbarn
  m.innerHTML =
    `<button data-ctx="hide">${mehrere ? list.length + ' Objekte ausblenden' : 'Ausblenden'}</button>`
    + (einzeln ? `<button data-ctx="related">Verknüpfte Objekte ins Diagramm holen</button>` : '')
    + (einzeln && S.pflegeAn
        ? `<button data-ctx="edit">Bearbeiten …</button>
           <hr><button data-ctx="delete">Objekt löschen …</button>` : '');
  m.querySelectorAll('[data-ctx]').forEach(b=> b.onclick = ()=>{
    closeMenus();
    const a = b.dataset.ctx;
    if(a === 'hide'){
      setGroupVisible(list, false);
      toast(list.length + (list.length === 1 ? ' Objekt ausgeblendet' : ' Objekte ausgeblendet'));
    }
    if(a === 'related') addRelated(n.id);
    if(a === 'edit') pflegeStart(n.id);
    if(a === 'delete') pflegeLoeschen(n.id);
  });
  closeMenus(m);
  m.style.left = x + 'px'; m.style.top = y + 'px';
  m.classList.add('open');
  // Am rechten und unteren Rand nach innen klappen, sonst stünde das Menü
  // halb außerhalb des Fensters.
  const r = m.getBoundingClientRect();
  if(r.right > window.innerWidth) m.style.left = Math.max(0, x - r.width) + 'px';
  if(r.bottom > window.innerHeight) m.style.top = Math.max(0, y - r.height) + 'px';
}

const slug = s => String(s).toLowerCase()
  .replace(/ä/g,'ae').replace(/ö/g,'oe').replace(/ü/g,'ue').replace(/ß/g,'ss')
  .replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
const diagramName = ()=> slug(S.fileName.replace(/\.[^.]+$/, '')) + '-geschaeftsobjektmodell';
// Der Hierarchie-Export heißt wie die Geschäftsobjekt-Datei plus „-hierarchie".
const uebersichtName = ()=> S.fileName.replace(/\.[^.]+$/, '') + '-hierarchie.yaml';

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
.hx-dsc{font:400 12px "Space Grotesk",sans-serif;fill:#5E717F}
.hx-h{font-family:"Space Grotesk",sans-serif;font-weight:700;fill:#122029}
.hx-q{font-family:"Space Grotesk",sans-serif;font-style:italic;fill:#5E717F}</style>
<rect x="${b.x}" y="${topY}" width="${b.w}" height="${totalH}" fill="#E7ECF1"/>
${head ? head.svg : ''}
${inner}
${att ? `<text class="att" x="${b.x + 12}" y="${b.y + b.h + 13}">${esc(att)}</text>` : ''}
</svg>`;
}
/* Browser deckeln Canvas-Flächen (üblich 16384 px je Seite); darüber liefert
   toBlob kommentarlos nichts. Vorab prüfen und benennen statt still scheitern. */
const PNG_MAX_SIDE = 16384;

function exportPNG(scale){
  scale = scale || 2;
  const b = bbox(30);
  const head = hierExportHeader(b);
  const headH = head ? head.height : 0;
  const w = Math.round(b.w*scale), h = Math.round((headH + b.h + (attributionLine() ? 20 : 0))*scale);
  if(w > PNG_MAX_SIDE || h > PNG_MAX_SIDE){
    toast(`PNG wäre ${w} × ${h} px — zu groß für den Browser. Kleinerer Maßstab oder SVG.`);
    return;
  }
  const blob = new Blob([exportSVG()], {type:'image/svg+xml;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const img = new Image();
  img.onload = ()=>{
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#E7ECF1'; ctx.fillRect(0,0,c.width,c.height);
    ctx.drawImage(img, 0, 0, c.width, c.height);
    c.toBlob(bl=>{
      URL.revokeObjectURL(url);
      if(!bl){ toast('PNG-Export fehlgeschlagen — SVG nutzen'); return; }
      downloadBlob(bl, diagramName()+'.png');
    });
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
$('deltaInput').addEventListener('change', e=>{
  const f = e.target.files[0]; if(!f) return;
  f.text().then(t => loadDelta(t));
  e.target.value = '';
});

/* ---------- Delta-Geschäftsobjekte einspielen ----------
   Neue Objekte kommen hinzu; bei Namensgleichheit entsteht ein Superset aus
   beiden Fassungen: Listen (Quellen, Business Keys, Attribute, Beziehungen)
   werden vereinigt, einzelne Werte (Domain, Beschreibung) nimmt das Delta.
   Zusammenführung auf Textebene (Objektblöcke), damit Attribute, Beschreibungen
   und Kommentare erhalten bleiben; danach wird das Ganze neu geprüft. */
const BO_HEAD = /^\s*(BusinessObjects|businessObjects|business_objects|Geschaeftsobjekte)\s*:\s*(#.*)?$/;
function splitBusinessObjects(text){
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const col = s => s.replace(/\t/g, '    ').match(/^ */)[0].length;
  const isBlank = s => s.trim() === '' || /^\s*#/.test(s);
  const hi = lines.findIndex(l => BO_HEAD.test(l));
  if(hi < 0) return null;
  const headCol = col(lines[hi]);
  let childCol = null, firstIdx = -1;
  for(let i = hi + 1; i < lines.length; i++){
    if(isBlank(lines[i])) continue;
    if(col(lines[i]) <= headCol) break;
    childCol = col(lines[i]); firstIdx = i; break;
  }
  const blocks = []; let endIdx = lines.length;
  if(childCol != null){
    let cur = null;
    for(let i = firstIdx; i < lines.length; i++){
      const l = lines[i];
      if(!isBlank(l) && col(l) <= headCol){ endIdx = i; break; }
      if(!isBlank(l) && col(l) === childCol){
        const m = l.match(/^\s*"?([^":]+?)"?\s*:/);
        if(cur) blocks.push(cur);
        cur = {name: m ? m[1].trim() : l.trim(), lines: [l]};
      } else if(cur) cur.lines.push(l);
    }
    if(cur) blocks.push(cur);
  }
  const preEnd = firstIdx < 0 ? hi + 1 : firstIdx;
  return {childCol, blocks, pre: lines.slice(0, preEnd), post: lines.slice(endIdx)};
}
const yCol = s => s.replace(/\t/g, '    ').match(/^ */)[0].length;
const yBlank = s => s.trim() === '' || /^\s*#/.test(s);
const shiftLines = (lines, d)=> d === 0 ? lines.slice() : lines.map(l => l.trim() === '' ? l
  : (d > 0 ? ' '.repeat(d) + l.replace(/\t/g, '    ') : l.replace(/\t/g, '    ').slice(-d)));

function reindentBlock(block, from, to){
  if(from === to || from == null || to == null) return block;
  return {name: block.name, lines: shiftLines(block.lines, to - from)};
}

/* Einen Objektblock in Kopfzeile und Felder zerlegen. Ein Feld ist entweder ein
   Einzelwert („Domain: X", auch mehrzeilig bei „desc: >") oder eine Liste
   („source_systems:" mit eingerückten Einträgen darunter). Was vor dem ersten Feld
   steht — ein Kommentar zum ganzen Objekt — gehört zu keinem Feld und käme
   sonst beim Neuschreiben abhanden: es steht als `vorspann` bereit. */
function splitObjectFields(lines){
  let fieldCol = null;
  for(let i = 1; i < lines.length; i++) if(!yBlank(lines[i])){ fieldCol = yCol(lines[i]); break; }
  const fields = [], vorspann = [];
  let cur = null;
  for(let i = 1; i < lines.length; i++){
    const l = lines[i];
    const m = (!yBlank(l) && yCol(l) === fieldCol) ? l.match(/^\s*"?([A-Za-z_][\w.\/-]*)"?\s*:/) : null;
    if(m){ cur = {key: m[1], lines: [l]}; fields.push(cur); }
    else if(cur) cur.lines.push(l);
    else vorspann.push(l);
  }
  return {head: lines[0], fieldCol, fields, vorspann};
}

/* Die Listeneinträge eines Feldes. Ein Eintrag beginnt mit „- " und reicht bis
   zum nächsten Eintrag derselben Einrückung. */
function splitListItems(field){
  const items = [];
  let cur = null, itemCol = null;
  for(let i = 1; i < field.lines.length; i++){
    const l = field.lines[i];
    if(yBlank(l)){ if(cur) cur.lines.push(l); continue; }
    const c = yCol(l);
    if(/^\s*-\s/.test(l) && (itemCol === null || c === itemCol)){
      itemCol = c; cur = {lines: [l]}; items.push(cur);
    } else if(cur) cur.lines.push(l);
  }
  return {items, itemCol};
}

/* Wodurch ein Listeneintrag identifiziert wird: eine Beziehung über Ziel UND
   Name (unterschiedlich benannte Beziehungen zum selben Objekt sind zwei
   verschiedene), ein Attribut über seinen Namen, ein einfacher Wert über sich
   selbst. Nur die direkten Felder des Eintrags zählen — „to:" unter
   „cardinality:" ist die Kardinalität, nicht das Ziel. */
function listItemKey(item){
  const itemCol = yCol(item.lines[0]);
  const direkt = item.lines
    .filter(l => !yBlank(l) && yCol(l) <= itemCol + 2)
    .map(l => l.replace(/^\s*-\s*/, '').trim());
  let ziel = null, name = null;
  for(const l of direkt){
    const to = l.match(/^to\s*:\s*"?([^"#]+?)"?\s*$/);
    if(to && ziel === null) ziel = to[1].trim();
    const nm = l.match(/^name\s*:\s*"?([^"#]+?)"?\s*$/);
    if(nm && name === null) name = nm[1].trim();
  }
  if(ziel !== null) return 'bez:' + ziel + '\u0000' + (name || '');
  if(name !== null) return 'attr:' + name;
  return 'wert:' + (direkt[0] || '');
}

/* Zwei gleichnamige Objektblöcke zu einem Superset verschmelzen: Listenfelder
   werden vereinigt (Einträge des Deltas ersetzen gleiche der Basis, neue kommen
   dazu), Einzelwerte nimmt das Delta, Felder nur einer Seite bleiben erhalten. */
function mergeObjectBlocks(baseLines, deltaLines){
  const B = splitObjectFields(baseLines), D = splitObjectFields(deltaLines);
  if(B.fieldCol == null) return deltaLines.slice();
  if(D.fieldCol == null) return baseLines.slice();
  const dByKey = new Map();
  D.fields.forEach(f=>{ if(!dByKey.has(f.key)) dByKey.set(f.key, f); });
  const out = [B.head], benutzt = new Set();

  B.fields.forEach(bf=>{
    benutzt.add(bf.key);
    const df = dByKey.get(bf.key);
    if(!df){ out.push(...bf.lines); return; }
    const bl = splitListItems(bf), dl = splitListItems(df);
    if(!bl.items.length || !dl.items.length){ out.push(...df.lines); return; }  // Einzelwert: Delta gewinnt
    const dShift = bl.itemCol - dl.itemCol;                                     // Einrückung angleichen
    const dRest = new Map();
    dl.items.forEach(it=>{ const k = listItemKey(it); if(!dRest.has(k)) dRest.set(k, it); });
    out.push(bf.lines[0]);
    bl.items.forEach(bi=>{
      const k = listItemKey(bi);
      const di = dRest.get(k);
      if(di){ out.push(...shiftLines(di.lines, dShift)); dRest.delete(k); }     // Delta ist die neuere Fassung
      else out.push(...bi.lines);
    });
    dRest.forEach(di => out.push(...shiftLines(di.lines, dShift)));             // was das Delta zusätzlich hat
  });
  D.fields.forEach(df=>{                                                        // Felder, die nur das Delta hat
    if(!benutzt.has(df.key)) out.push(...shiftLines(df.lines, B.fieldCol - D.fieldCol));
  });
  return out;
}

function mergeGoText(baseText, deltaText){
  const B = splitBusinessObjects(baseText), D = splitBusinessObjects(deltaText);
  if(!B || !D) return null;
  const order = [], map = new Map();
  B.blocks.forEach(b=>{ if(!map.has(b.name)) order.push(b.name); map.set(b.name, b); });
  let added = 0, merged = 0;
  const ziel = B.childCol != null ? B.childCol : D.childCol;
  D.blocks.forEach(d=>{
    const dd = reindentBlock(d, D.childCol, ziel);
    const vorhanden = map.get(d.name);
    if(vorhanden){
      merged++;
      map.set(d.name, {name: d.name, lines: mergeObjectBlocks(vorhanden.lines, dd.lines)});
    } else {
      added++; order.push(d.name);
      map.set(d.name, dd);
    }
  });
  const body = [];
  order.forEach(nm => body.push(...map.get(nm).lines));
  return {text: [...B.pre, ...body, ...B.post].join('\n'), added, merged};
}
function loadDelta(text){
  const merged = mergeGoText(S.yamlText, text);
  if(!merged){ toast('Keine Geschäftsobjekte in der Datei gefunden'); return; }
  S.model = buildModel(merged.text);
  S.yamlText = merged.text;
  renderMessages(); syncLayoutMenu();
  // Kein resetHistory: die Verlaufsstände tragen den Modelltext mit, ein Delta
  // ist damit eine ganz normale Aktion — Strg+Z nimmt es wieder heraus.
  setView();                             // vorhandene bleiben, neue werden platziert; persistiert in den Verlauf
  if(S.mode === 'hierarchie') setMode('hierarchie');
  toast(`Delta: ${merged.added} neu, ${merged.merged} zusammengeführt`);
}
$('layoutInput').addEventListener('change', e=>{
  const f = e.target.files[0]; if(!f) return;
  f.text().then(t=>{
    try{
      adoptLayoutFile(JSON.parse(t));
      syncLayoutMenu(); setView();
      if(S.mode === 'hierarchie') setMode('hierarchie');
      toast('Positionsinformationen übernommen');
    }
    catch(_){ toast('Die JSON-Datei lässt sich nicht lesen'); }
  });
  e.target.value = '';
});

/* Hierarchiebeschreibung aus einer Datei laden. Ersetzt die Übersicht; die je
   Diagramm gespeicherten Bearbeitungen (die auf die alten Kennungen zeigen)
   werden dabei verworfen. */
function loadUebersicht(text){
  S.outlineText = text;
  S.outline = null; S.hierSel = null;
  S.hierSaved = {}; S.hierRoutes = {}; S.hierShown = {}; S.hierText = {};
  parseOutline();
  writeStore();
  if(S.mode === 'hierarchie') setMode('hierarchie');
  const bad = S.outline.messages.filter(m => m.level !== 'info').length;
  toast(bad ? `Hierarchiebeschreibung geladen · ${bad} Hinweise` : 'Hierarchiebeschreibung geladen');
}

$('uebersichtInput').addEventListener('change', e=>{
  const f = e.target.files[0]; if(!f) return;
  f.text().then(t => loadUebersicht(t));
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
    setView();
    if(S.mode === 'hierarchie') setMode('hierarchie');
    resetHistory();                       // geladener Stand ist der Anfang des Verlaufs
    const bad = model.messages.filter(m => m.level !== 'info').length;
    toast(bad ? `${Object.keys(model.objects).length} Objekte geladen · ${bad} Hinweise`
              : `${Object.keys(model.objects).length} Objekte geladen`);
  }catch(err){
    toast('Datei nicht lesbar: ' + err.message);
  }
}

/* ---------- Stand sichern ----------
   Der ganze Stand — Modelltext, Hierarchie, Anordnung, Kantenzüge,
   Einstellungen — wird in das Dokument selbst eingebacken. Beim Öffnen liest
   boot() ihn aus <script id="bakedState"> und ist sofort wieder dort, wo man
   aufgehört hat. Die Datei bleibt dabei eigenständig und ohne Nachladen. */
function standAlsHtml(){
  const el = $('bakedState');
  const before = el.textContent;
  el.textContent = JSON.stringify(
    Object.assign({fileName:S.fileName, yaml:S.yamlText}, layoutFile())
  ).replace(/</g, '\\u003c');

  // Generierte Bereiche leeren, damit die Datei klein bleibt
  ['canvas','objectList','msgList','legend','detailBody'].forEach(id => $(id).innerHTML = '');
  const html = '<!DOCTYPE html>\n' + document.documentElement.outerHTML;
  el.textContent = before;

  initSvg(); draw(); renderObjectList(); renderMessages(); renderLegend(); renderDetails();
  return html;
}

function exportHTML(){
  download(standAlsHtml(), S.fileName.replace(/\.[^.]+$/, '') + '-stand.html', 'text/html');
  toast('Eigenständige HTML-Datei gesichert');
}

/* Der Name der gerade geöffneten Datei als Vorschlag im Dialog — nur so lässt
   sich im Dateiauswahlfenster genau sie wieder treffen und überschreiben. */
function htmlDateiname(){
  const pfad = (window.location && window.location.pathname) || '';
  let roh = '';
  try{ roh = decodeURIComponent(pfad.split('/').pop() || ''); }catch(_){ roh = ''; }
  return /\.html?$/i.test(roh) ? roh : S.fileName.replace(/\.[^.]+$/, '') + '-stand.html';
}

/* In eine bestehende Datei zurückschreiben, statt bei jedem Sichern eine neue
   anzulegen. Der Dialog kommt vor jedem Speichern: der Browser vergibt die
   Schreiberlaubnis nur auf ausdrückliche Wahl des Nutzers, und so ist zugleich
   immer zu sehen, welche Datei überschrieben wird. Wo der Browser das nicht
   kann (Firefox, Safari, Sandkasten), bleibt es beim Download. */
async function speichernInDatei(){
  // Ein offenes Formular steht nur im DOM, nicht im Modell — es stillschweigend
  // zu übergehen sicherte einen Stand ohne die gerade getippten Änderungen.
  if(S.pflege){ toast('Erst das offene Bearbeiten-Formular speichern oder abbrechen'); return; }
  // Den Dateizugriff gibt der Browser nur einer über http(s) geladenen Seite.
  // Direkt aus einer Datei geöffnet (file://) fehlt er — dann bleibt der
  // Download, und der Grund gehört benannt statt verschwiegen.
  if(!window.showSaveFilePicker){
    const ausDatei = window.location && window.location.protocol === 'file:';
    toast(ausDatei
      ? 'Aus einer Datei geöffnet kann der Browser nicht zurückschreiben — es wird heruntergeladen'
      : 'Dieser Browser kann nicht in eine Datei zurückschreiben — es wird heruntergeladen');
    exportHTML();
    return;
  }
  let datei;
  try{
    datei = await window.showSaveFilePicker({
      suggestedName: htmlDateiname(),
      types:[{description:'HTML-Datei', accept:{'text/html':['.html', '.htm']}}]
    });
  }catch(_){ return; }                   // Dialog abgebrochen — das ist keine Störung
  try{
    const schreiber = await datei.createWritable();
    await schreiber.write(standAlsHtml());
    await schreiber.close();
    toast('Stand gespeichert: ' + datei.name);
  }catch(err){
    toast('Speichern fehlgeschlagen: ' + err.message);
  }
}

/* ---------- Start ---------- */
async function boot(){
  initSvg();
  let preset = null;
  try{ preset = JSON.parse($('bakedState').textContent); }catch(_){}
  if(!preset){
    // Zuerst die Tab-eigene Sitzung: beim Neuladen behält jeder Tab sein Modell.
    try{ preset = JSON.parse(sessionStorage.getItem('sitzung')); }catch(_){}
  }
  if(!preset){
    // Sonst die geteilte Sitzung — der Start für neue Tabs und Fenster.
    try{ preset = JSON.parse(await store.get('sitzung')); }catch(_){}
  }
  if(preset && preset.yaml) await loadYaml(preset.yaml, preset.fileName, preset);
  else await loadYaml(DEFAULT_YAML, 'willibald-attr.yaml');
  // Angezeigt wird zum Start die Hierarchie mit ihrer obersten Stufe: sie
  // erklärt das Modell, die Komplettansicht zeigt es nur. Erst NACH dem Laden,
  // denn die Übersicht entsteht aus dem fertigen Modell.
  //
  // Nur wenn sie dazu passt: zu einem fremden Modell fällt die Übersicht auf
  // die mitgelieferte zurück, deren Objekte es dort nicht gibt — das Diagramm
  // wäre leer. Geprüft wird an einer Probe, die nichts am Zustand ändert;
  // erst setMode() legt Übersicht und Auswahl wirklich an.
  if(S.model){
    const roh = S.outlineText || (typeof DEFAULT_UEBERSICHT !== 'undefined' ? DEFAULT_UEBERSICHT : '');
    const oben = buildOutline(roh, S.model).roots[0];
    if(oben && oben.objekte.some(o => S.model.objects[o])) setMode('hierarchie');
  }
}
boot();
window.addEventListener('resize', ()=> applyTransform());
/* Sind die Schriften da, stimmen die Kastenmaße erst wirklich — also einmal
   neu messen und anordnen. Im Hierarchie-Modus über das gewählte Diagramm:
   setView() würde den Ausschnitt aufheben und wieder alle Objekte zeigen. */
function nachSchriftMessen(){
  if(!S.graph) return;
  if(S.mode === 'hierarchie'){ if(S.hierSel) selectDiagram(S.hierSel); }
  else setView();
}
document.fonts && document.fonts.ready.then(nachSchriftMessen);
