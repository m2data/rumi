/* ---------- Editierbare Stützpunkte ---------- */
function routePoints(e, A, B){
  const bends = e.bends || [];
  // Endpunkte über den gemeinsamen Helfer edgeEnd (siehe render.js) — dieselbe
  // Bestimmung wie in edgeMarkup(), damit Griffe und gezeichnete Linie exakt
  // aufeinanderliegen. Ziel ist der erste/letzte Knick bzw. die Nachbarmitte.
  const zielVon  = bends.length ? bends[0]               : {x:B.x+B.w/2, y:B.y+B.h/2};
  const zielNach = bends.length ? bends[bends.length-1]  : {x:A.x+A.w/2, y:A.y+A.h/2};
  return [edgeEnd(A, e.portFrom, zielVon), ...bends, edgeEnd(B, e.portTo, zielNach)];
}

/* Nächster Punkt auf dem Polygonzug zu (x,y) und dessen Bogenlängen-Anteil t.
   Für das freie Verschieben der Beschriftung entlang der Kante. */
function nearestOnPoly(pts, x, y){
  if(pts.length < 2) return {t:0.5};
  const seg = []; let total = 0;
  for(let i=0;i<pts.length-1;i++){ const l = Math.hypot(pts[i+1].x-pts[i].x, pts[i+1].y-pts[i].y); seg.push(l); total += l; }
  if(total < 1e-6) return {t:0.5};
  let best = {d:Infinity, t:0.5}, acc = 0;
  for(let i=0;i<pts.length-1;i++){
    const ax=pts[i].x, ay=pts[i].y, dx=pts[i+1].x-ax, dy=pts[i+1].y-ay, len2=dx*dx+dy*dy || 1;
    let u = ((x-ax)*dx + (y-ay)*dy)/len2; u = Math.max(0, Math.min(1, u));
    const qx=ax+dx*u, qy=ay+dy*u, dd=Math.hypot(x-qx, y-qy);
    if(dd < best.d) best = {d:dd, t:(acc + u*seg[i])/total};
    acc += seg[i];
  }
  return best;
}

/* Die rechtwinkligen Ecken, die eine ortho-Kante ohne Stützpunkte aufspannt.
   edgeMarkup zeichnet daraus die Stufe; als echte Knicke abgelegt, bekommt die
   Kante die üblichen Segment- und Stützpunktgriffe (sonst bliebe eine diagonal
   gezogene Ortho-Kante unbearbeitbar). Bei bereits achsparalleler Lage: keine. */
function orthoCorners(p1, p2, side){
  const vert = side === 'T' || side === 'B';
  if(vert){
    if(Math.abs(p1.x - p2.x) < 1) return [];
    const my = Math.round((p1.y + p2.y) / 2);
    return [{x:Math.round(p1.x), y:my}, {x:Math.round(p2.x), y:my}];
  }
  if(Math.abs(p1.y - p2.y) < 1) return [];
  const mx = Math.round((p1.x + p2.x) / 2);
  return [{x:mx, y:Math.round(p1.y)}, {x:mx, y:Math.round(p2.y)}];
}

/* Eine knicklose Ortho-Kante in eine mit echten Ecken überführen, sobald die
   direkte Verbindung schräg läuft (etwa nach dem Ziehen eines Anschlusspunkts).
   Gibt true zurück, wenn Knicke gesetzt wurden. */
function materializeOrtho(e){
  if(!e.ortho || (e.bends && e.bends.length)) return false;
  const A = S.graph.byId.get(e.from), B = S.graph.byId.get(e.to);
  if(!A || !B || A === B) return false;
  const ref = e.portFrom || e.portTo;
  if(!ref) return false;
  const p1 = e.portFrom ? portPoint(A, e.portFrom) : clipToBox(A, {x:B.x+B.w/2, y:B.y+B.h/2});
  const p2 = e.portTo   ? portPoint(B, e.portTo)   : clipToBox(B, {x:A.x+A.w/2, y:A.y+A.h/2});
  const c = orthoCorners(p1, p2, ref.side);
  if(!c.length) return false;
  e.bends = c;
  return true;
}

/* Eine Kante von ihrer bisherigen Führung lösen und nach dem zuletzt gewählten
   Verfahren neu formen. Nötig, sobald Knoten bewegt werden (Ziehen, Pfeiltasten,
   Ausrichten, Auswahl anordnen): die alten Stützpunkte passen dann nicht mehr.
   Im Ortho-Modus bleibt die Kante rechtwinklig — Anschlussseiten aus der Lage
   der Kästen, dazwischen eine Stufe; liegen sich die Anschlüsse gegenüber, wird
   daraus eine gerade Linie. Sonst führt sie wieder frei von Mitte zu Mitte. */
function loosenEdge(e){
  e.bends = null; e.portFrom = null; e.portTo = null;
  const A = S.graph.byId.get(e.from), B = S.graph.byId.get(e.to);
  e.ortho = S.layout.algo === 'ortho' && !!A && !!B && A !== B;
  if(!e.ortho) return;
  const ac = {x:A.x + A.w/2, y:A.y + A.h/2}, bc = {x:B.x + B.w/2, y:B.y + B.h/2};
  e.portFrom = nearestPort(A, bc.x, bc.y);
  e.portTo   = nearestPort(B, ac.x, ac.y);
  const c = orthoCorners(portPoint(A, e.portFrom), portPoint(B, e.portTo), e.portFrom.side);
  e.bends = c.length ? c : null;
}

/* Beschriftungen, die sich überdecken, entlang ihrer Kante auseinanderschieben.
   Greedy — jede bewegliche Beschriftung nimmt die Position (aus einer
   Kandidatenliste rund um die Mitte), die möglichst nicht mit bereits
   platzierten überlappt. Von Hand platzierte (labelManual) und Kanten außerhalb
   von `scope` bleiben stehen und wirken nur als Hindernis. Ohne scope werden
   alle automatischen Beschriftungen neu verteilt (nach dem Auto-Layout). */
function spreadLabels(scope){
  if(S.layout.labels === false) return;
  const F = '500 10px "IBM Plex Mono", monospace';
  const edges = visEdges().filter(e => e.label && e.from !== e.to);
  const scopeSet = scope ? new Set(scope) : null;
  const rectAt = (e, t)=>{
    const A = S.graph.byId.get(e.from), B = S.graph.byId.get(e.to);
    if(!A || !B) return null;
    const p = polyPoint(routePoints(e, A, B), t);
    const w = measure(e.label, F) + 8;
    return {x:p.x - w/2 - 1, y:p.y - 8, w:w + 2, h:16};
  };
  const hit = (r, s)=> r && s && r.x < s.x+s.w && s.x < r.x+r.w && r.y < s.y+s.h && s.y < r.y+r.h;
  const cand = [0.5, 0.42, 0.58, 0.34, 0.66, 0.26, 0.74, 0.2, 0.8];
  const placed = [], movable = [];
  edges.forEach(e=>{
    if(e.labelManual || (scopeSet && !scopeSet.has(e))){
      const r = rectAt(e, e.labelT != null ? e.labelT : 0.5);
      if(r) placed.push(r);
    } else movable.push(e);
  });
  movable.forEach(e=>{
    let bestT = 0.5, bestRect = null, bestN = Infinity;
    for(const t of cand){
      const r = rectAt(e, t); if(!r) continue;
      const n = placed.reduce((c, pr)=> c + (hit(r, pr) ? 1 : 0), 0);
      if(n < bestN){ bestN = n; bestT = t; bestRect = r; if(n === 0) break; }
    }
    e.labelT = (bestT === 0.5) ? null : bestT;   // 0.5 ist der Standard -> nichts merken
    if(bestRect) placed.push(bestRect);
  });
}

function selectionBox(){
  const list = [...S.sel].map(id => S.graph.byId.get(id)).filter(n => n && !n.hidden);
  if(list.length < 2) return null;
  const pad = 12;
  return {
    x: Math.min(...list.map(n=>n.x)) - pad, y: Math.min(...list.map(n=>n.y)) - pad,
    w: Math.max(...list.map(n=>n.x+n.w)) - Math.min(...list.map(n=>n.x)) + pad*2,
    h: Math.max(...list.map(n=>n.y+n.h)) - Math.min(...list.map(n=>n.y)) + pad*2
  };
}

function alignStub(e, which){
  if(!e.ortho || !e.bends || !e.bends.length) return;
  const n = S.graph.byId.get(which === 'portFrom' ? e.from : e.to);
  const port = e[which];
  if(!n || !port) return;
  const p = portPoint(n, port);
  const b = which === 'portFrom' ? e.bends[0] : e.bends[e.bends.length - 1];
  if(port.side === 'T' || port.side === 'B') b.x = Math.round(p.x);
  else                                       b.y = Math.round(p.y);
}

function drawHandles(){
  if(!gHandles) return;
  let extra = '';
  const box = selectionBox();
  if(box) extra += `<rect class="selbox" x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" rx="5"/>`;
  const band = bandRect();     // Auswahlrahmen, falls gerade einer aufgezogen wird
  if(band) extra += `<rect class="band" x="${Math.min(band.x0,band.x1)}" y="${Math.min(band.y0,band.y1)}" width="${Math.abs(band.x1-band.x0)}" height="${Math.abs(band.y1-band.y0)}"/>`;
  const e = S.selEdge && S.graph.edges.find(x => x.id === S.selEdge);
  const A = e && S.graph.byId.get(e.from), B = e && S.graph.byId.get(e.to);
  if(!e || !A || !B || A.hidden || B.hidden){ gHandles.innerHTML = extra; return; }
  if(A === B){                                       // Selbstbezug: Scheitel + zwei Anschlusspunkte
    const g = loopGeom(A, e);
    gHandles.innerHTML = extra +
      `<circle class="pt lp" cx="${g.apex.x.toFixed(1)}" cy="${g.apex.y.toFixed(1)}" r="6" data-loop="1"><title>Schleife verschieben</title></circle>` +
      `<circle class="pt" cx="${g.p1.x.toFixed(1)}" cy="${g.p1.y.toFixed(1)}" r="5.5" data-port="from"><title>Anschlusspunkt an ${esc(A.name)} verschieben</title></circle>` +
      `<circle class="pt" cx="${g.p2.x.toFixed(1)}" cy="${g.p2.y.toFixed(1)}" r="5.5" data-port="to"><title>Anschlusspunkt an ${esc(A.name)} verschieben</title></circle>`;
    return;
  }
  const pts = routePoints(e, A, B);
  let s = '';
  if(e.ortho){
    // Rechtwinklige Kante: Teilstücke quer verschieben …
    for(let i=0; i<pts.length-1; i++){
      const p = pts[i], q = pts[i+1];
      const vert = Math.abs(p.x - q.x) < 1, horiz = Math.abs(p.y - q.y) < 1;
      if(!vert && !horiz) continue;
      const len = Math.hypot(q.x - p.x, q.y - p.y);
      if(len < 16) continue;
      s += `<line class="seg ${vert ? 'v' : 'h'}" x1="${p.x.toFixed(1)}" y1="${p.y.toFixed(1)}" x2="${q.x.toFixed(1)}" y2="${q.y.toFixed(1)}" data-seg="${i}"><title>Teilstück quer verschieben</title></line>`;
    }
    // … und in der Mitte einen Knick einsetzen, wenn Platz dafür ist
    for(let i=0; i<pts.length-1; i++){
      const p = pts[i], q = pts[i+1];
      const vert = Math.abs(p.x - q.x) < 1, horiz = Math.abs(p.y - q.y) < 1;
      if(!vert && !horiz) continue;
      if(Math.hypot(q.x - p.x, q.y - p.y) < 44) continue;
      const m = {x:(p.x + q.x)/2, y:(p.y + q.y)/2};
      s += `<circle class="gh ortho" cx="${m.x.toFixed(1)}" cy="${m.y.toFixed(1)}" r="5" data-add="${i}"><title>Knick einsetzen und quer ziehen</title></circle>`;
    }
    // Sicherheitsnetz: entstand kein Zusatzpunkt-Griff (z. B. eine schräge
    // Direktverbindung), einen am längsten Segment anbieten — sonst ließe sich
    // dort kein Stützpunkt mehr setzen.
    if(!/class="gh/.test(s)){
      let best = 0, bl = -1;
      for(let i=0; i<pts.length-1; i++){ const l = Math.hypot(pts[i+1].x-pts[i].x, pts[i+1].y-pts[i].y); if(l > bl){ bl = l; best = i; } }
      const p = pts[best], q = pts[best+1], m = {x:(p.x+q.x)/2, y:(p.y+q.y)/2};
      s += `<circle class="gh" cx="${m.x.toFixed(1)}" cy="${m.y.toFixed(1)}" r="5.5" data-add="${best}"><title>Stützpunkt einfügen</title></circle>`;
    }
  } else {
    for(let i=0; i<pts.length-1; i++){
      const m = {x:(pts[i].x + pts[i+1].x)/2, y:(pts[i].y + pts[i+1].y)/2};
      s += `<circle class="gh" cx="${m.x.toFixed(1)}" cy="${m.y.toFixed(1)}" r="5.5" data-add="${i}"><title>Stützpunkt einfügen</title></circle>`;
    }
  }
  (e.bends || []).forEach((q,i)=>{
    s += `<rect class="hnd" x="${(q.x-5).toFixed(1)}" y="${(q.y-5).toFixed(1)}" width="10" height="10" rx="2" data-bend="${i}"><title>Ziehen zum Verschieben, Alt-Klick entfernt</title></rect>`;
  });
  const p1 = pts[0], p2 = pts[pts.length-1];
  s += `<circle class="pt" cx="${p1.x.toFixed(1)}" cy="${p1.y.toFixed(1)}" r="5.5" data-port="from"><title>Anschlusspunkt an ${esc(A.name)} verschieben</title></circle>`;
  s += `<circle class="pt" cx="${p2.x.toFixed(1)}" cy="${p2.y.toFixed(1)}" r="5.5" data-port="to"><title>Anschlusspunkt an ${esc(B.name)} verschieben</title></circle>`;
  gHandles.innerHTML = extra + s;
}

/* Kantenzüge sind an das Modell gebunden, nicht an die laufende Nummer */
function edgeKey(e){ return e.from + '\u203a' + e.to + '#' + (e.ord || 0); }

/* Kantenzüge des aktuellen Graphen als speicherbare Abbildung. */
function routesSnapshot(){
  const m = {};
  S.graph.edges.forEach(e=>{
    if(!e.bends && !e.portFrom && !e.loop && e.labelT == null) return;
    m[edgeKey(e)] = {
      b: e.bends ? e.bends.map(q=>[Math.round(q.x), Math.round(q.y)]) : null,
      pf: e.portFrom || null, pt: e.portTo || null,
      lp: e.loop || null,
      lt: e.labelT != null ? e.labelT : null,
      lm: !!e.labelManual,
      o: !!e.ortho, man: !!e.manual
    };
  });
  return m;
}

function applyRoutesFrom(m){
  m = m || {};
  S.graph.edges.forEach(e=>{
    const r = m[edgeKey(e)];
    if(!r) return;
    e.bends = r.b ? r.b.map(([x,y])=>({x, y})) : null;
    e.portFrom = r.pf || null;
    e.portTo = r.pt || null;
    e.loop = r.lp || null;
    e.labelT = (r.lt != null) ? r.lt : null;
    e.labelManual = !!r.lm;
    e.ortho = !!r.o;
    e.manual = !!r.man;
  });
}

function captureRoutes(){ S.routes[S.view] = routesSnapshot(); }
function applyRoutes(){ applyRoutesFrom(S.routes[S.view]); }

function applyTransform(){
  gViewport.setAttribute('transform', `translate(${S.t.x},${S.t.y}) scale(${S.t.k})`);
  $('zoomVal').textContent = Math.round(S.t.k*100) + '%';
}

function bbox(pad = 44){
  const ns = visNodes();
  if(!ns.length) return {x:-160, y:-120, w:320, h:240};
  const x0 = Math.min(...ns.map(n=>n.x)) - pad, y0 = Math.min(...ns.map(n=>n.y)) - pad;
  const x1 = Math.max(...ns.map(n=>n.x+n.w)) + pad, y1 = Math.max(...ns.map(n=>n.y+n.h)) + pad;
  return {x:x0, y:y0, w:x1-x0, h:y1-y0};
}

function fit(){
  const b = bbox();
  const r = svg.getBoundingClientRect();
  const k = Math.min(r.width/b.w, r.height/b.h, 1.6);
  S.t.k = k;
  S.t.x = r.width/2 - (b.x + b.w/2)*k;
  S.t.y = r.height/2 - (b.y + b.h/2)*k;
  applyTransform();
}

