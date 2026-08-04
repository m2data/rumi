/* =====================================================================
   5 — SVG-Zeichnung
   ===================================================================== */
/* einsetzen: svg.css */

const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

function nodeMarkup(n, cls){
  const headH = n.sub ? HEAD_H : HEAD_ONLY_H;
  const r = 4;
  let s = `<g class="node ${n.kind} ${cls}" data-id="${esc(n.id)}" transform="translate(${n.x},${n.y})">`;
  s += `<rect class="n-box" width="${n.w}" height="${n.h}" rx="${r}"/>`;
  s += `<path class="n-head" d="M0 ${r}a${r} ${r} 0 0 1 ${r}-${r}h${n.w-2*r}a${r} ${r} 0 0 1 ${r} ${r}v${headH-r}H0z"/>`;
  if(n.sub){
    s += `<text class="n-title" x="${PAD_X}" y="18">${esc(n.name)}</text>`;
    s += `<text class="n-sub" x="${PAD_X}" y="33">${esc(n.sub)}</text>`;
  } else {
    s += `<text class="n-title" x="${PAD_X}" y="${headH/2 + 5}">${esc(n.name)}</text>`;
  }
  let y = headH + 7;
  if(n.desc && n.desc.length){
    const boxH = DESC_PAD*2 + n.desc.length * DESC_LH;
    s += `<rect class="n-desc-bg" x="${PAD_X}" y="${y}" width="${n.w - PAD_X*2}" height="${boxH}" rx="3"/>`;
    n.desc.forEach((line, k)=>{
      s += `<text class="n-desc" x="${PAD_X + DESC_PAD}" y="${y + DESC_PAD + 9 + k*DESC_LH}">${esc(line)}</text>`;
    });
    y += boxH + 7;
  }
  for(const row of n.rows){
    if(row.kind === 'sep'){
      s += `<line class="n-sep" x1="${PAD_X}" y1="${y + GAP_SEC/2}" x2="${n.w-PAD_X}" y2="${y + GAP_SEC/2}"/>`;
      y += GAP_SEC; continue;
    }
    const cy = y + ROW_H/2;
    const tag = row.kind === 'key' ? 'BK' : row.kind === 'src' ? 'src' : 'attr';
    s += `<text class="n-tag ${row.kind}" x="${PAD_X}" y="${cy+3.5}">${tag}</text>`;
    if(row.kind === 'attr'){
      const a = row.a;
      s += `<text class="n-row" x="${PAD_X+PREFIX_W}" y="${cy+4}">${esc(a.name)}</text>`;
      if(a.tags)
        s += `<text class="n-attr-tag" x="${PAD_X+PREFIX_W+measure(a.name, F_ROW)+6}" y="${cy+3.5}">${esc(a.tags)}</text>`;
      if(a.type)
        s += `<text class="n-attr-type" x="${n.w-PAD_X}" y="${cy+3.5}" text-anchor="end">${esc(a.type)}</text>`;
    } else {
      s += `<text class="n-row${row.kind === 'src' ? ' dimtext' : ''}" x="${PAD_X+PREFIX_W}" y="${cy+4}">${esc(row.text)}</text>`;
    }
    y += ROW_H;
  }
  return s + `</g>`;
}

function clipToBox(n, toward){
  const cx = n.x + n.w/2, cy = n.y + n.h/2;
  const dx = toward.x - cx, dy = toward.y - cy;
  if(!dx && !dy) return {x:cx, y:cy};
  const sx = dx ? (n.w/2 + 2)/Math.abs(dx) : Infinity;
  const sy = dy ? (n.h/2 + 2)/Math.abs(dy) : Infinity;
  const s = Math.min(sx, sy);
  return {x: cx + dx*s, y: cy + dy*s};
}

function portPoint(n, port){
  const t = Math.min(0.92, Math.max(0.08, port.t));
  if(port.side === 'T') return {x: n.x + n.w*t, y: n.y};
  if(port.side === 'B') return {x: n.x + n.w*t, y: n.y + n.h};
  if(port.side === 'L') return {x: n.x,         y: n.y + n.h*t};
  return {x: n.x + n.w, y: n.y + n.h*t};
}

/* Ein Kanten-Endpunkt am Knoten: der gesetzte Anschlusspunkt, sonst der Schnitt
   mit dem Kasten Richtung Ziel (erster/letzter Knick bzw. Nachbarmitte). Jeder
   Endpunkt wird unabhängig bestimmt. Gemeinsam genutzt von routePoints() (Griffe)
   und edgeMarkup() (gezeichnete Linie), damit beide denselben Punkt sehen. */
function edgeEnd(node, port, toward){
  return port ? portPoint(node, port) : clipToBox(node, toward);
}

/* Geometrie einer Selbstbezug-Schleife. Der Scheitel liegt bei e.loop (Versatz
   zur Knotenmitte, damit die Schleife beim Verschieben des Knotens mitwandert);
   ohne e.loop steht sie oben rechts außen. Die zwei Anschlusspunkte ergeben sich
   aus der Richtung zum Scheitel. */
const SIDE_OUT = {T:{x:0, y:-1}, B:{x:0, y:1}, L:{x:-1, y:0}, R:{x:1, y:0}};
const isManyCard = c => !!c && /many/.test(c);

function loopGeom(A, e){
  const O = {x:A.x + A.w/2, y:A.y + A.h/2};
  const off = e.loop || {dx:A.w/2 + 42, dy:-(A.h/2 + 42)};
  const apex = {x:O.x + off.dx, y:O.y + off.dy};
  // Standard: die "eins"-Seite geht rechts hinaus, die "viele"-Seite oben hinein.
  let s1 = 'R', t1 = 0.35, s2 = 'T', t2 = 0.62;
  if(isManyCard(e.fromCard) && !isManyCard(e.toCard)){ s1 = 'T'; t1 = 0.62; s2 = 'R'; t2 = 0.35; }
  const side1 = e.portFrom ? e.portFrom.side : s1;
  const side2 = e.portTo   ? e.portTo.side   : s2;
  const p1 = e.portFrom ? portPoint(A, e.portFrom) : portPoint(A, {side:s1, t:t1});
  const p2 = e.portTo   ? portPoint(A, e.portTo)   : portPoint(A, {side:s2, t:t2});
  // Die Kurve verlässt jeden Anschlusspunkt senkrecht zur Kastenseite (saubere
  // Marken); Steglänge wächst mit dem Abstand zum Scheitel (Größe der Schleife).
  const d1 = SIDE_OUT[side1] || SIDE_OUT.R, d2 = SIDE_OUT[side2] || SIDE_OUT.T;
  const r1 = Math.max(46, Math.hypot(apex.x - p1.x, apex.y - p1.y) * 0.7);
  const r2 = Math.max(46, Math.hypot(apex.x - p2.x, apex.y - p2.y) * 0.7);
  const c1 = {x:p1.x + d1.x*r1, y:p1.y + d1.y*r1};
  const c2 = {x:p2.x + d2.x*r2, y:p2.y + d2.y*r2};
  return {
    p1, p2, apex, c1, c2,
    a1: Math.atan2(d1.y, d1.x),
    a2: Math.atan2(d2.y, d2.x),
    mid: {x:(p1.x + 3*c1.x + 3*c2.x + p2.x)/8, y:(p1.y + 3*c1.y + 3*c2.y + p2.y)/8}
  };
}

const fx = v => v.toFixed(1);

/* Weicher Zug durch die Stützpunkte */
function smoothPath(pts){
  let d = `M${fx(pts[0].x)} ${fx(pts[0].y)}`;
  for(let i=1; i<pts.length-1; i++){
    const m = {x:(pts[i].x + pts[i+1].x)/2, y:(pts[i].y + pts[i+1].y)/2};
    d += `Q${fx(pts[i].x)} ${fx(pts[i].y)} ${fx(m.x)} ${fx(m.y)}`;
  }
  const l = pts[pts.length-1];
  return d + `L${fx(l.x)} ${fx(l.y)}`;
}

/* Doppelte, kollineare und rücklaufende Zwischenpunkte entfernen. Ohne das
   zeichnet die Eckenrundung aus einem kurzen Rücklauf einen „Haken". */
function dropCollinear(pts){
  const out = [];
  for(const q of pts){
    const p = out[out.length-1];
    if(p && Math.abs(q.x - p.x) < 0.5 && Math.abs(q.y - p.y) < 0.5) continue;   // Duplikat
    out.push({x:q.x, y:q.y});
  }
  let i = 1;
  while(i < out.length - 1){
    const a = out[i-1], b = out[i], c = out[i+1];
    const cross = (b.x-a.x)*(c.y-a.y) - (b.y-a.y)*(c.x-a.x);
    if(Math.abs(cross) < 1) out.splice(i, 1);   // a,b,c auf einer Geraden -> b weg (auch Überschwinger)
    else i++;
  }
  return out;
}

/* Rechtwinklig mit abgerundeten Ecken */
function orthoPath(pts, r = 7){
  const p = dropCollinear(pts);
  if(p.length < 3) return `M${fx(p[0].x)} ${fx(p[0].y)}L${fx(p[p.length-1].x)} ${fx(p[p.length-1].y)}`;
  let d = `M${fx(p[0].x)} ${fx(p[0].y)}`;
  for(let i=1; i<p.length-1; i++){
    const a = p[i-1], b = p[i], c = p[i+1];
    const d1 = Math.hypot(b.x-a.x, b.y-a.y) || 1;
    const d2 = Math.hypot(c.x-b.x, c.y-b.y) || 1;
    const rr = Math.min(r, d1/2, d2/2);
    const s = {x: b.x + (a.x-b.x)/d1*rr, y: b.y + (a.y-b.y)/d1*rr};
    const t = {x: b.x + (c.x-b.x)/d2*rr, y: b.y + (c.y-b.y)/d2*rr};
    d += `L${fx(s.x)} ${fx(s.y)}Q${fx(b.x)} ${fx(b.y)} ${fx(t.x)} ${fx(t.y)}`;
  }
  const l = p[p.length-1];
  return d + `L${fx(l.x)} ${fx(l.y)}`;
}

function markerMarkup(p, ang, card){
  if(!card) return '';                               // ohne Kardinalität: blanke Linie
  const ux = Math.cos(ang), uy = Math.sin(ang);      // vom Knoten weg
  const px = -uy, py = ux;
  const at = (d, o=0) => `${(p.x + ux*d + px*o).toFixed(1)} ${(p.y + uy*d + py*o).toFixed(1)}`;
  const bar = d => `<path class="e-mk" d="M${at(d,-5.5)}L${at(d,5.5)}"/>`;
  const fork = () => `<path class="e-mk" d="M${at(11)}L${at(0,-5.5)}M${at(11)}L${at(0,0)}M${at(11)}L${at(0,5.5)}"/>`;
  const dot = d => `<circle class="e-dot" cx="${(p.x+ux*d).toFixed(1)}" cy="${(p.y+uy*d).toFixed(1)}" r="3.6"/>`;
  switch(card){
    case 'exactly_one':  return bar(8) + bar(13);
    case 'zero_or_one':  return dot(14) + bar(8);
    case 'zero_or_many': return fork() + dot(15.5);
    case 'one_or_many':  return fork() + bar(15);
    case 'many':         return fork();
    default:             return bar(9);
  }
}

function edgeMarkup(e, g, cls){
  const A = g.byId.get(e.from), B = g.byId.get(e.to);
  if(!A || !B) return '';
  let path, p1, p2, a1, a2, mid;

  if(A === B){                                       // Schleife auf sich selbst
    const g = loopGeom(A, e);
    path = `M${fx(g.p1.x)} ${fx(g.p1.y)}C${fx(g.c1.x)} ${fx(g.c1.y)} ${fx(g.c2.x)} ${fx(g.c2.y)} ${fx(g.p2.x)} ${fx(g.p2.y)}`;
    p1 = g.p1; p2 = g.p2; a1 = g.a1; a2 = g.a2; mid = g.mid;
  }
  else if(e.bends && e.bends.length){                // geführte Kante über Stützpunkte
    p1 = edgeEnd(A, e.portFrom, e.bends[0]);
    p2 = edgeEnd(B, e.portTo, e.bends[e.bends.length-1]);
    const pts = [p1, ...e.bends, p2];
    path = e.ortho ? orthoPath(pts) : smoothPath(pts);
    a1 = Math.atan2(pts[1].y - p1.y, pts[1].x - p1.x);
    a2 = Math.atan2(pts[pts.length-2].y - p2.y, pts[pts.length-2].x - p2.x);
    mid = e.bends[Math.floor((e.bends.length-1)/2)];
  }
  else if(e.portFrom || e.portTo){                   // mindestens ein gesetzter Anschlusspunkt
    p1 = edgeEnd(A, e.portFrom, {x:B.x+B.w/2, y:B.y+B.h/2});
    p2 = edgeEnd(B, e.portTo, {x:A.x+A.w/2, y:A.y+A.h/2});
    if(e.ortho){
      const vert = (e.portFrom || e.portTo).side === 'T' || (e.portFrom || e.portTo).side === 'B';
      const pts = vert
        ? [p1, {x:p1.x, y:(p1.y+p2.y)/2}, {x:p2.x, y:(p1.y+p2.y)/2}, p2]
        : [p1, {x:(p1.x+p2.x)/2, y:p1.y}, {x:(p1.x+p2.x)/2, y:p2.y}, p2];
      path = orthoPath(pts);
      a1 = Math.atan2(pts[1].y-p1.y, pts[1].x-p1.x);
      a2 = Math.atan2(pts[2].y-p2.y, pts[2].x-p2.x);
      mid = {x:(p1.x+p2.x)/2, y:(p1.y+p2.y)/2};
    } else {
      path = `M${fx(p1.x)} ${fx(p1.y)}L${fx(p2.x)} ${fx(p2.y)}`;
      a1 = Math.atan2(p2.y-p1.y, p2.x-p1.x);
      a2 = a1 + Math.PI;
      mid = {x:(p1.x+p2.x)/2, y:(p1.y+p2.y)/2};
    }
  }
  else {                                             // freie Führung, Bogen bei Mehrfachkanten
    const ca = {x:A.x + A.w/2, y:A.y + A.h/2}, cb = {x:B.x + B.w/2, y:B.y + B.h/2};
    const mx = (ca.x + cb.x)/2, my = (ca.y + cb.y)/2;
    const len = Math.hypot(cb.x-ca.x, cb.y-ca.y) || 1;
    const nx = -(cb.y-ca.y)/len, ny = (cb.x-ca.x)/len;
    const cv = (e.curve||0) * (e.canon || 1);
    const c = {x: mx + nx*cv, y: my + ny*cv};
    p1 = edgeEnd(A, e.portFrom, c); p2 = edgeEnd(B, e.portTo, c);   // portlos: Schnitt Richtung Bogenscheitel
    path = `M${fx(p1.x)} ${fx(p1.y)}Q${fx(c.x)} ${fx(c.y)} ${fx(p2.x)} ${fx(p2.y)}`;
    a1 = Math.atan2(c.y-p1.y, c.x-p1.x);
    a2 = Math.atan2(c.y-p2.y, c.x-p2.x);
    mid = {x:(p1.x + 2*c.x + p2.x)/4, y:(p1.y + 2*c.y + p2.y)/4};
  }

  let s = `<g class="eg ${e.kind} ${cls}" data-id="${e.id}">`;
  if(!S.exporting) s += `<path class="e-hit" d="${path}"/>`;
  s += `<path class="e-path" d="${path}"/>`;
  s += markerMarkup(p1, a1, e.fromCard);
  s += markerMarkup(p2, a2, e.toCard);
  if(e.label && S.layout.labels !== false){
    const w = measure(e.label, '500 10px "IBM Plex Mono", monospace') + 8;
    s += `<rect class="e-lbl-bg" x="${fx(mid.x-w/2)}" y="${fx(mid.y-7)}" width="${w.toFixed(1)}" height="14" rx="2"/>`;
    s += `<text class="e-lbl" x="${fx(mid.x)}" y="${fx(mid.y+3.5)}" text-anchor="middle">${esc(e.label)}</text>`;
  }
  return s + `</g>`;
}

