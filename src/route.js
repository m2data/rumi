/* ---------- Kanten neu ziehen, ohne Knoten zu bewegen ----------
   Wegsuche auf einem Gitter aus Knotenkanten und den Kanälen dazwischen.
   A* mit drei Strafen: Länge, Richtungswechsel und Wiederbenutzung einer
   Strecke, die schon eine andere Kante belegt. Letzteres hält die Kanten
   auseinander, statt sie alle durch dieselbe Gasse zu schicken. */
const RT = {margin:24, bend:34, share:60, inflate:7};

function nearestPort(n, x, y){
  const c = [
    {side:'T', d:Math.abs(y - n.y),         t:(x - n.x)/n.w},
    {side:'B', d:Math.abs(y - (n.y + n.h)), t:(x - n.x)/n.w},
    {side:'L', d:Math.abs(x - n.x),         t:(y - n.y)/n.h},
    {side:'R', d:Math.abs(x - (n.x + n.w)), t:(y - n.y)/n.h}
  ];
  c.forEach(o=>{ if(o.t < 0) o.d -= o.t * 140; else if(o.t > 1) o.d += (o.t - 1) * 140; });
  c.sort((p,q)=> p.d - q.d);
  return {side:c[0].side, t:Math.min(0.92, Math.max(0.08, c[0].t))};
}

function outward(p, side, d){
  if(side === 'T') return {x:p.x, y:p.y - d};
  if(side === 'B') return {x:p.x, y:p.y + d};
  if(side === 'L') return {x:p.x - d, y:p.y};
  return {x:p.x + d, y:p.y};
}

function buildGrid(nodes, extraX, extraY){
  const M = RT.margin;
  const xs = new Set(extraX), ys = new Set(extraY);
  nodes.forEach(n=>{
    xs.add(n.x - M); xs.add(n.x + n.w + M);
    ys.add(n.y - M); ys.add(n.y + n.h + M);
  });
  const grow = set=>{
    const a = [...set].sort((p,q)=> p - q), out = [];
    for(let i=0; i<a.length; i++){
      out.push(a[i]);
      if(i < a.length-1 && a[i+1] - a[i] > 2*M) out.push((a[i] + a[i+1]) / 2);
    }
    return out;
  };
  return {gx:grow(xs), gy:grow(ys)};
}

function blockedAt(x, y, rects, k){
  if(k === undefined) k = RT.inflate;
  for(const r of rects)
    if(x > r.x - k && x < r.x + r.w + k && y > r.y - k && y < r.y + r.h + k) return true;
  return false;
}

function astar(grid, rects, from, to, usage, inflate){
  const {gx, gy} = grid;
  const W = gx.length, H = gy.length;
  const near = (arr, v)=>{
    let b = 0, bd = Infinity;
    arr.forEach((a,i)=>{ const d = Math.abs(a - v); if(d < bd){ bd = d; b = i; } });
    return b;
  };
  const si = near(gx, from.x), sj = near(gy, from.y);
  const ti = near(gx, to.x),   tj = near(gy, to.y);
  const free = new Uint8Array(W*H);
  for(let i=0;i<W;i++) for(let j=0;j<H;j++)
    free[j*W+i] = blockedAt(gx[i], gy[j], rects, inflate) ? 0 : 1;
  free[sj*W+si] = 1; free[tj*W+ti] = 1;
  if(!free[sj*W+si] || !free[tj*W+ti]) return null;

  const cost = new Float64Array(W*H).fill(Infinity);
  const prev = new Int32Array(W*H).fill(-1);
  const dirs = new Int8Array(W*H).fill(-1);
  const hEst = (i,j)=> Math.abs(gx[i] - gx[ti]) + Math.abs(gy[j] - gy[tj]);
  const open = [{i:si, j:sj, f:hEst(si,sj)}];
  cost[sj*W+si] = 0;
  const step = [[1,0],[-1,0],[0,1],[0,-1]];

  while(open.length){
    let bi = 0;
    for(let k=1;k<open.length;k++) if(open[k].f < open[bi].f) bi = k;
    const cur = open.splice(bi,1)[0];
    const ci = cur.i, cj = cur.j, id = cj*W + ci;
    if(ci === ti && cj === tj) break;
    for(let d=0; d<4; d++){
      const ni = ci + step[d][0], nj = cj + step[d][1];
      if(ni < 0 || nj < 0 || ni >= W || nj >= H) continue;
      const nid = nj*W + ni;
      if(!free[nid]) continue;
      const len = Math.abs(gx[ni] - gx[ci]) + Math.abs(gy[nj] - gy[cj]);
      const mx = (gx[ni] + gx[ci]) / 2, my = (gy[nj] + gy[cj]) / 2;
      if(blockedAt(mx, my, rects, inflate)) continue;
      const key = d < 2 ? 'h' + cj + ':' + Math.min(ci,ni) : 'v' + ci + ':' + Math.min(cj,nj);
      const c = cost[id] + len
              + (dirs[id] >= 0 && (dirs[id] >> 1) !== (d >> 1) ? RT.bend : 0)
              + (usage.get(key) || 0) * RT.share;
      if(c < cost[nid]){
        cost[nid] = c; prev[nid] = id; dirs[nid] = d;
        open.push({i:ni, j:nj, f:c + hEst(ni,nj)});
      }
    }
  }
  if(!isFinite(cost[tj*W + ti])) return null;
  const path = [];
  let id = tj*W + ti;
  while(id >= 0){ path.push({x:gx[id % W], y:gy[(id / W) | 0], id}); id = prev[id]; }
  path.reverse();
  for(let k=1;k<path.length;k++){
    const a = path[k-1], b = path[k];
    const ai = a.id % W, aj = (a.id / W)|0, bi2 = b.id % W, bj = (b.id / W)|0;
    const key = aj === bj ? 'h' + aj + ':' + Math.min(ai,bi2) : 'v' + ai + ':' + Math.min(aj,bj);
    usage.set(key, (usage.get(key) || 0) + 1);
  }
  return path.map(q=>({x:q.x, y:q.y}));
}

function tidyPath(pts){
  const out = [];
  pts.forEach(q=>{
    if(out.length && Math.abs(out[out.length-1].x - q.x) < 0.5 && Math.abs(out[out.length-1].y - q.y) < 0.5) return;
    out.push(q);
  });
  const res = [out[0]];
  for(let i=1; i<out.length-1; i++){
    const a = res[res.length-1], b = out[i], c = out[i+1];
    const col = (Math.abs(a.x-b.x) < 0.5 && Math.abs(b.x-c.x) < 0.5)
             || (Math.abs(a.y-b.y) < 0.5 && Math.abs(b.y-c.y) < 0.5);
    if(!col) res.push(b);
  }
  res.push(out[out.length-1]);
  return res;
}

function rerouteEdges(list){
  const ortho = S.layout.algo === 'ortho';
  const byId = S.graph.byId;
  const rects = visNodes();
  const cand = list.filter(e=>{
    const A = byId.get(e.from), B = byId.get(e.to);
    return A && B && A !== B && !A.hidden && !B.hidden;
  });
  if(!cand.length) return 0;

  // 1 — Seite aus der tatsächlichen Lage, Anschlusspunkte darauf verteilen
  const plan = cand.map(e=>{
    e.bends = null; e.ortho = false; e.portFrom = null; e.portTo = null; e.manual = false;
    const A = byId.get(e.from), B = byId.get(e.to);
    const ac = {x:A.x + A.w/2, y:A.y + A.h/2}, bc = {x:B.x + B.w/2, y:B.y + B.h/2};
    e.portFrom = nearestPort(A, bc.x, bc.y);
    e.portTo   = nearestPort(B, ac.x, ac.y);
    return {e, A, B};
  });

  const slots = new Map();
  const add = (id, side, ref)=>{
    const k = id + '|' + side;
    if(!slots.has(k)) slots.set(k, []);
    slots.get(k).push(ref);
  };
  plan.forEach(({e, A, B})=>{
    add(e.from, e.portFrom.side, {port:e.portFrom, other:B});
    add(e.to,   e.portTo.side,   {port:e.portTo,   other:A});
  });
  for(const grp of slots.values()){
    if(grp.length < 2) continue;
    const along = (grp[0].port.side === 'T' || grp[0].port.side === 'B') ? 'x' : 'y';
    grp.sort((p,q)=>
      (along === 'x' ? p.other.x + p.other.w/2 : p.other.y + p.other.h/2) -
      (along === 'x' ? q.other.x + q.other.w/2 : q.other.y + q.other.h/2));
    const spread = 0.66 / (grp.length - 1);
    grp.forEach((r,i)=>{ r.port.t = 0.5 + (i - (grp.length-1)/2) * spread; });
  }

  // 2 — Gitter aus Knotenkanten, Kanälen und den Anschlusspunkten
  const ex = [], ey = [];
  plan.forEach(({e, A, B})=>{
    const p1 = portPoint(A, e.portFrom), p2 = portPoint(B, e.portTo);
    const s1 = outward(p1, e.portFrom.side, RT.margin);
    const s2 = outward(p2, e.portTo.side,   RT.margin);
    ex.push(p1.x, p2.x, s1.x, s2.x); ey.push(p1.y, p2.y, s1.y, s2.y);
  });
  const grid = buildGrid(rects, ex, ey);
  const usage = new Map();

  // Kurze Kanten zuerst: sie haben weniger Ausweichraum
  plan.sort((a,b)=>{
    const d = (r)=> Math.abs(r.A.x - r.B.x) + Math.abs(r.A.y - r.B.y);
    return d(a) - d(b);
  });

  plan.forEach(({e, A, B})=>{
    const p1 = portPoint(A, e.portFrom), p2 = portPoint(B, e.portTo);
    const s1 = outward(p1, e.portFrom.side, RT.margin);
    const s2 = outward(p2, e.portTo.side,   RT.margin);
    let mid = astar(grid, rects, s1, s2, usage, RT.inflate);
    if(!mid) mid = astar(grid, rects, s1, s2, usage, 1);   // enger, aber immer noch außen herum
    e.ortho = ortho;
    if(!mid){                                   // wirklich kein Weg: einfache Z-Führung
      const vert = e.portFrom.side === 'T' || e.portFrom.side === 'B';
      const m = vert ? (p1.y + p2.y)/2 : (p1.x + p2.x)/2;
      e.bends = vert ? [{x:p1.x, y:m}, {x:p2.x, y:m}] : [{x:m, y:p1.y}, {x:m, y:p2.y}];
      return;
    }
    const full = tidyPath([p1, s1, ...mid, s2, p2]);
    const inner = full.slice(1, -1);
    e.bends = inner.length ? inner : null;
  });

  spreadLabels(cand);          // Beschriftungen der neu gezogenen Kanten entzerren
  draw();
  return cand.length;
}

