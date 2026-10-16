/* =====================================================================
   6 — Anwendungszustand
   ===================================================================== */
/* einsetzen: modell willibald-attr.yaml */
/* einsetzen: uebersicht willibald-übersicht.yaml */
/* einsetzen: quelltabellen willibald-quelltabellen.yaml */

const S = {
  model:null, graph:null, yamlText:'',
  view:1,                   // fester Ablageschlüssel: früher gab es drei Ansichten
  saved:{1:{}},
  routes:{1:{}},
  content:{1:{}},
  elementeKomplett:{},      // Einstellung der Komplettansicht: Quelle/Quelltabelle/Domäne als eigener Kasten (S.elemente)
  hidden:new Set(),
  selEdge:null, exporting:false,
  sel:new Set(),
  layout:{algo:'hier', dir:'TB', labels:true},
  selected:null, filter:'',
  pflegeAn:false,           // Einstellung: dürfen Geschäftsobjekte bearbeitet werden?
  zusatzAn:{objekt:[], attribut:[]},   // Einstellung: welche Zusatzattribute gepflegt werden
  pflege:null,              // Kennung des Objekts, das gerade bearbeitet wird
  // Quelltabellen: eigene Datei, eigener Bereich (Einstellung, Vorgabe aus)
  quellenAn:false,          // Einstellung: gibt es den Bereich überhaupt?
  quellPflegeAn:false,      // Einstellung: dürfen Quelltabellen bearbeitet werden?
  quellText:'',             // Quelltabellen-YAML; leer = mitgelieferte Vorlage
  quellFileName:'willibald-quelltabellen.yaml',
  quellModell:null,         // aus quellModellBauen()
  uebernahmeMeldungen:[],   // Infos der letzten Übernahme für die Prüfung (stehen in keinen Daten)
  t:{x:0, y:0, k:1},
  fileName:'willibald.yaml',
  modellName:'willibald',   // frei änderbar, Basis aller gespeicherten Dateinamen
  // Hierarchie (redaktionelle Diagramme): eigener Modus neben der Komplettansicht
  mode:'komplett',          // 'komplett' | 'hierarchie' | 'quellen'
  bereiche:{hierarchie: neuerBaum(), quellen: neuerBaum()}
};

/* Ein Diagrammbaum mit allem, was an ihm hängt. Hierarchie und Quelltabellen
   haben je einen; die Felder S.outline, S.hierSel … zeigen auf den Baum des aktiven Bereichs,
   damit hierarchie.js für jeden Baum dasselbe tut. */
function neuerBaum(){
  return {
    outline:null,           // Baum aus buildOutline()
    outlineText:'',         // Quelle der Übersicht (YAML)
    hierSel:null,           // Kennung des gewählten Diagramms
    hierOpen:null,          // Set aufgeklappter Knoten
    hierSaved:{},           // je Diagramm: Knotenpositionen {id:{x,y}}
    hierRoutes:{},          // je Diagramm: Kantenzüge
    hierShown:{},           // je Diagramm: sichtbare Objekte [id,…] (überschreibt die YAML-Liste)
    hierText:{},            // je Diagramm: Beschreibung (Markdown), überschreibt die YAML-Vorlage
    hierElemente:{},        // je Diagramm: Quelle/Quelltabelle/Domäne/GO als eigener Kasten (S.elemente)
    hierEditing:false       // Beschreibung gerade im Bearbeiten-Modus?
  };
}
const aktBaum = ()=> S.mode === 'quellen' ? S.bereiche.quellen : S.bereiche.hierarchie;
Object.keys(neuerBaum()).forEach(k => Object.defineProperty(S, k, {
  get(){ return aktBaum()[k]; }, set(v){ aktBaum()[k] = v; }, enumerable:true
}));
/* „Als eigenes Element" gilt je Diagramm: S.elemente ist der Satz des
   aktuellen — der Komplettansicht oder des gewählten Diagramms im Baum.
   Ohne gewähltes Diagramm ist alles aus und Schreiben wirkungslos. */
Object.defineProperty(S, 'elemente', {
  get(){ return S.mode === 'komplett' ? S.elementeKomplett : (S.hierSel && S.hierElemente[S.hierSel]) || {}; },
  set(v){
    if(S.mode === 'komplett') S.elementeKomplett = v;
    else if(S.hierSel) S.hierElemente = Object.assign({}, S.hierElemente, {[S.hierSel]: v});
  },
  enumerable:true
});
const aktModell = ()=> S.mode === 'quellen' ? S.quellModell : S.model;

/* Eine reine Rechnung im Baum eines anderen Bereichs ausführen, etwa die
   Diagramm-YAML der Quelltabellen aus der Komplettansicht heraus speichern.
   Nichts zeichnen: der Modus gilt nur für die Dauer von fn. */
function imBereich(mode, fn){
  const alt = S.mode;
  S.mode = mode;
  try{ return fn(); } finally { S.mode = alt; }
}

const quellTextAkt = ()=> S.quellText || (typeof DEFAULT_QUELLTABELLEN !== 'undefined' ? DEFAULT_QUELLTABELLEN : '');

/* Das Tabellenmodell neu bauen — nach jeder Änderung an den Tabellen. Eine
   unlesbare Datei lässt den Bereich leer und sagt es in der Prüfung. */
function quellModellBauen(){
  try{ S.quellModell = buildModel(quellTextAkt(), 'quelle'); }
  catch(err){
    S.quellModell = {objects:{}, meta:{}, zusatz:{objekt:new Map(), attribut:new Map()},
      messages:[{level:'err', title:'Quelltabellen nicht lesbar', body:err.message}]};
  }
}

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
// Wer ein Objekt bewegt, bewegt seine Anhängsel (Quelle/Domäne) mit
const samtAnhaengseln = ids => {
  const s = new Set(ids);
  S.graph.nodes.forEach(n=>{ if(n.eltern && s.has(n.eltern)) s.add(n.id); });
  return s;
};

/* Suchtreffer. Gesucht wird nicht nur im Objektnamen, sondern in allem, was
   das Objekt beschreibt: Domain, Business Keys, Quellen, Attributnamen samt
   Verweisziel (references), Beziehungsnamen, Beschreibung und alle
   Zusatzfelder an Objekt und Attribut — auch was gerade nicht im Kasten
   steht. Fragen wie „wo ist KundeID referenziert?" oder „welche Objekte hängen
   an Position_VRS?" beantwortet die Suche sonst nicht. Bewusst NICHT
   durchsucht: Datentypen — „int" oder „uuid" träfe fast jedes Objekt und
   machte die Suche wertlos. Ein Quellen- oder Domänenkasten trifft zusätzlich
   über sein Objekt. */
function matchesFilter(n, q){
  if(!q) return true;
  const hat = v => !!v && String(v).toLowerCase().includes(q);
  const extraHat = x => Object.values(x || {}).some(v => alsListe(v).some(hat));
  if(hat(n.name)) return true;
  if(n.eltern) return matchesFilter(S.graph.byId.get(n.eltern), q);
  const r = n.ref || {};
  if((r.domains || []).some(hat)) return true;
  if((r.keys || []).some(hat) || (r.sources || []).some(hat) || (r.tabQuellen || []).some(hat)) return true;
  if(hat(r.system) || hat(r.bo) || hat(r.desc) || extraHat(r.extra)) return true;
  if((r.attrs || []).some(a => hat(a.name) || hat(a.ref) || extraHat(a.extra))) return true;
  return (r.rels || []).some(x => hat(x.name));
}

/* Was als Treffer zählt: Objekte und Tabellen, nicht ihre Quellen-, Domänen-
   und GO-Element-Kästen — die leuchten mit ihrem Objekt, wären als eigene
   Treffer aber doppelt gezählt. Sichtbare in Lesereihenfolge, dem Weg der
   Sprungtasten. */
const zaehltAlsTreffer = n => !n.eltern && !n.abgeleitet;
function suchTreffer(){
  return visNodes().filter(n => zaehltAlsTreffer(n) && matchesFilter(n, S.filter))
    .sort((a,b) => a.y - b.y || a.x - b.x);
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
  gNodes.innerHTML = list.map(n=>{
    let c = '';
    if(S.sel.has(n.id)) c = 'selected';
    // Während der Suche bestimmt der Treffer, nicht die Nachbarschaft der
    // Auswahl — sonst verblassten beim Springen alle übrigen Treffer
    else if(S.filter) c = matchesFilter(n, S.filter) ? '' : 'faded';
    else if(nb && !nb.keep.has(n.id)) c = 'faded';
    return nodeMarkup(n, c);
  }).join('');
  // Trefferzahl an der Suchleiste: „3 von 12", solange ein Treffer gewählt
  // ist, sonst „12/40"; ausgeblendete Treffer kommen dazu
  const hits = $('searchHits');
  if(hits){
    let text = '';
    if(S.filter){
      const tr = suchTreffer();
      const stelle = tr.findIndex(n => n.id === S.selected);
      const aus = S.graph.nodes.filter(n => n.hidden && zaehltAlsTreffer(n) && matchesFilter(n, S.filter)).length;
      text = (stelle >= 0 ? (stelle + 1) + ' von ' + tr.length : tr.length + '/' + list.filter(zaehltAlsTreffer).length)
           + (aus ? ' +' + aus + ' ausgeblendet' : '');
      hits.classList.toggle('none', !tr.length && !aus);
    } else hits.classList.remove('none');
    hits.textContent = text;
    hits.closest('.searchbar').classList.toggle('aktiv', !!S.filter);
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

