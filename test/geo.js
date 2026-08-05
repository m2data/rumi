/* Gemeinsame Geometrie-Helfer für die Tests: Kreuzungszählung und Kantenpfade.
   Eine Stelle statt je Testdatei eigener Kopien — sonst driften die Zähler
   auseinander und messen still Verschiedenes. */

const ccw = (p, q, r)=> (r.y - p.y) * (q.x - p.x) - (q.y - p.y) * (r.x - p.x);

/* Schneiden sich die Strecken s(a,b) und u(a,b) echt? Berührung am Endpunkt
   zählt nicht. */
function segsCross(s, u){
  const d1 = ccw(u.a, u.b, s.a), d2 = ccw(u.a, u.b, s.b);
  const d3 = ccw(s.a, s.b, u.a), d4 = ccw(s.a, s.b, u.b);
  return ((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0));
}

/* Kreuzungen der Luftlinien (Zentrum zu Zentrum). Kanten, die einen Knoten
   teilen, zählen nicht als Kreuzung. */
function centerCrossings(nodes, edges){
  const by = new Map(nodes.map(n => [n.id, {x: n.x + n.w/2, y: n.y + n.h/2}]));
  const segs = edges.map(e => ({a: by.get(e.from), b: by.get(e.to), from: e.from, to: e.to}))
                    .filter(s => s.a && s.b);
  let n = 0;
  for(let i = 0; i < segs.length; i++) for(let j = i + 1; j < segs.length; j++){
    const s = segs[i], u = segs[j];
    if([s.from, s.to].some(id => id === u.from || id === u.to)) continue;
    if(segsCross(s, u)) n++;
  }
  return n;
}

/* Voller Kantenpfad: Anschlusspunkt, Stützpunkte, Anschlusspunkt.
   portPoint stammt aus der geladenen App (render.js). */
function edgePath(e, A, B, portPoint){
  return [portPoint(A, e.portFrom), ...(e.bends || []), portPoint(B, e.portTo)];
}

/* Kreuzungen der tatsächlich gerouteten Segmente zwischen verschiedenen Kanten. */
function routedCrossings(g, portPoint){
  const segs = [];
  g.edges.forEach(e=>{
    const A = g.byId.get(e.from), B = g.byId.get(e.to);
    if(!A || !B || A === B || !e.portFrom) return;
    const pts = edgePath(e, A, B, portPoint);
    for(let i = 0; i < pts.length - 1; i++) segs.push({e, a: pts[i], b: pts[i+1]});
  });
  let n = 0;
  for(let i = 0; i < segs.length; i++) for(let j = i + 1; j < segs.length; j++){
    if(segs[i].e === segs[j].e) continue;
    if(segsCross(segs[i], segs[j])) n++;
  }
  return n;
}

module.exports = {ccw, segsCross, centerCrossings, edgePath, routedCrossings};
