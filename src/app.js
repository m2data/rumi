/* =====================================================================
   6 — Anwendungszustand
   ===================================================================== */
/* einsetzen: modell willibald-attr.yaml */
/* einsetzen: uebersicht willibald-übersicht.yaml */

const S = {
  model:null, view:1, graph:null, yamlText:'',
  saved:{1:{}, 2:{}, 3:{}},
  routes:{1:{}, 2:{}, 3:{}},
  content:{1:{}, 2:{}, 3:{}},
  hidden:new Set(),
  selEdge:null, exporting:false,
  sel:new Set(),
  layout:{algo:'hier', dir:'TB', labels:true},
  selected:null, filter:'',
  pflege:null,              // Kennung des Objekts, das gerade bearbeitet wird
  t:{x:0, y:0, k:1},
  fileName:'willibald.yaml',
  // Hierarchie (redaktionelle Diagramme): eigener Modus neben der Komplettansicht
  mode:'komplett',          // 'komplett' | 'hierarchie'
  outline:null,             // Baum aus buildOutline()
  outlineText:'',           // Quelle der Übersicht (YAML)
  hierSel:null,             // Kennung des gewählten Diagramms
  hierOpen:null,            // Set aufgeklappter Knoten
  hierSaved:{},             // je Diagramm: Knotenpositionen {id:{x,y}}
  hierRoutes:{},            // je Diagramm: Kantenzüge
  hierShown:{},             // je Diagramm: sichtbare Objekte [id,…] (überschreibt die YAML-Liste)
  hierText:{},              // je Diagramm: Beschreibung (Markdown), überschreibt die YAML-Vorlage
  hierEditing:false         // Beschreibung gerade im Bearbeiten-Modus?
};

const $ = id => document.getElementById(id);
const svg = $('canvas');
let gEdges, gNodes, gViewport, gHandles;

function initSvg(){
  svg.innerHTML =
    `<defs>
       <pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse">
         <path d="M24 0H0V24" fill="none" stroke="#D3DBE2" stroke-width="0.6"/>
       </pattern>
       <pattern id="grid5" width="120" height="120" patternUnits="userSpaceOnUse">
         <rect width="120" height="120" fill="url(#grid)"/>
         <path d="M120 0H0V120" fill="none" stroke="#C0CBD4" stroke-width="0.9"/>
       </pattern>
     </defs>
     <rect id="bg" x="-100000" y="-100000" width="200000" height="200000" fill="url(#grid5)"/>
     <style>${SVG_CSS}</style>
     <g id="vp"><g id="edges"></g><g id="nodes"></g><g id="handles"></g></g>`;
  gViewport = svg.querySelector('#vp');
  gEdges = svg.querySelector('#edges');
  gNodes = svg.querySelector('#nodes');
  gHandles = svg.querySelector('#handles');
}

const isVisible = id => { const n = S.graph.byId.get(id); return n && !n.hidden; };
const visNodes = ()=> S.graph.nodes.filter(n => !n.hidden);
const visEdges = ()=> S.graph.edges.filter(e => isVisible(e.from) && isVisible(e.to));

/* Suchtreffer. Gesucht wird nicht nur im Objektnamen, sondern in allem, was
   das Objekt beschreibt: Domain, Business Keys, Quellen, Attributnamen samt
   Verweisziel (references) und Beziehungsnamen. Fragen wie „wo ist KundeID
   referenziert?" oder „welche Objekte hängen an Position_VRS?" beantwortet die
   Suche sonst nicht. Bewusst NICHT durchsucht: Datentypen — „int" oder „uuid"
   träfe fast jedes Objekt und machte die Suche wertlos. Ein Quellenkasten
   (Ansicht 3) trifft zusätzlich über die Objekte, die ihn nutzen. */
function matchesFilter(n, q){
  if(!q) return true;
  const hat = v => !!v && String(v).toLowerCase().includes(q);
  if(hat(n.name)) return true;
  const r = n.ref || {};
  if(n.kind === 'source') return (r.users || []).some(hat);
  if(hat(r.domain)) return true;
  if((r.keys || []).some(hat) || (r.sources || []).some(hat)) return true;
  if((r.attrs || []).some(a => hat(a.name) || hat(a.ref))) return true;
  return (r.rels || []).some(x => hat(x.name));
}

function neighbourhood(){
  if(S.selEdge){
    const e = S.graph.edges.find(x => x.id === S.selEdge);
    if(e && isVisible(e.from) && isVisible(e.to))
      return {keep:new Set([e.from, e.to]), eids:new Set([e.id])};
  }
  if(S.sel.size !== 1) return null;                 // Mehrfachauswahl dient dem Ordnen, nicht dem Erkunden
  const only = [...S.sel][0];
  if(!isVisible(only)) return null;
  const keep = new Set([only]), eids = new Set();
  visEdges().forEach(e=>{
    if(e.from === only || e.to === only){
      keep.add(e.from); keep.add(e.to); eids.add(e.id);
    }
  });
  return {keep, eids};
}

function draw(){
  const nb = neighbourhood();
  const list = visNodes();
  let treffer = 0;
  gNodes.innerHTML = list.map(n=>{
    const passt = matchesFilter(n, S.filter);
    if(passt) treffer++;
    let c = '';
    if(S.sel.has(n.id)) c = 'selected';
    else if(nb && !nb.keep.has(n.id)) c = 'faded';
    else if(!passt) c = 'faded';
    return nodeMarkup(n, c);
  }).join('');
  // Trefferzahl an der Suchleiste: aus demselben Durchgang, also immer stimmig
  const hits = $('searchHits');
  if(hits){
    hits.textContent = S.filter ? treffer + '/' + list.length : '';
    hits.classList.toggle('none', !!S.filter && treffer === 0);
  }
  drawEdges();
  applyTransform();
}

function drawEdges(){
  const nb = neighbourhood();
  const parts = visEdges().map(e=>{
    let c = '';
    if(nb) c = nb.eids.has(e.id) ? 'active' : 'faded';
    if(e.id === S.selEdge) c += ' picked';
    return edgeMarkup(e, S.graph, c);
  });
  // Beschriftungen als eigene Schicht HINTER allen Kantengruppen: ihr heller
  // Hintergrund deckt so jede Linie ab, statt von später gezeichneten Kanten
  // durchgestrichen zu werden (dichte Bündel bei waagrechtem Fluss).
  gEdges.innerHTML = parts.map(p=>p.edge).join('') + parts.map(p=>p.label).join('');
  drawHandles();
}

