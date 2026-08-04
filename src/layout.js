/* =====================================================================
   4 — Automatische Anordnung
   Vier Verfahren. "Hierarchisch" und "Orthogonal" teilen sich den
   Ebenenalgorithmus (Sugiyama) und unterscheiden sich in der Kantenführung.
   ===================================================================== */
const ALGOS = {
  hier:  {name:'Hierarchisch', dir:true,  fn:(ns,es,dir)=> layered(ns, es, dir, false)},
  ortho: {name:'Orthogonal',   dir:true,  fn:(ns,es,dir)=> layered(ns, es, dir, true)},
  org:   {name:'Organisch',    dir:false, fn:(ns,es)=> organic(ns, es)},
  circ:  {name:'Kreisförmig',  dir:false, fn:(ns,es)=> circular(ns, es)}
};

function adjacency(nodes, edges){
  const idx = new Map(nodes.map((n,i)=>[n.id,i]));
  const out = nodes.map(()=>[]), und = nodes.map(()=>[]);
  edges.forEach(e=>{
    const a = idx.get(e.from), b = idx.get(e.to);
    if(a === undefined || b === undefined || a === b) return;
    out[a].push(b); und[a].push(b); und[b].push(a);
  });
  return {idx, out, und};
}

function boundsOf(list){
  return {
    x: Math.min(...list.map(n=>n.x)),      y: Math.min(...list.map(n=>n.y)),
    w: Math.max(...list.map(n=>n.x+n.w)) - Math.min(...list.map(n=>n.x)),
    h: Math.max(...list.map(n=>n.y+n.h)) - Math.min(...list.map(n=>n.y))
  };
}

/* Zusammenhangskomponenten getrennt anordnen und anschließend nebeneinander
   packen. Sonst zieht ein einzelner freistehender Knoten das ganze Bild breit. */
function runByComponent(nodes, edges, dir, fn){
  const {und} = adjacency(nodes, edges);
  const seen = nodes.map(()=>false), groups = [];
  nodes.forEach((_,s)=>{
    if(seen[s]) return;
    const stack = [s], grp = [];
    seen[s] = true;
    while(stack.length){
      const v = stack.pop(); grp.push(nodes[v]);
      und[v].forEach(w=>{ if(!seen[w]){ seen[w] = true; stack.push(w); } });
    }
    groups.push(grp);
  });

  if(groups.length === 1){ fn(nodes, edges, dir); return; }

  const boxes = groups.map(grp=>{
    const ids = new Set(grp.map(n=>n.id));
    const own = edges.filter(e => ids.has(e.from) && ids.has(e.to));
    fn(grp, own, dir);
    return Object.assign({grp, own}, boundsOf(grp));
  });

  boxes.sort((a,b)=> b.w*b.h - a.w*a.h);
  const gap = 34;
  const target = Math.sqrt(boxes.reduce((s,b)=> s + (b.w+gap)*(b.h+gap), 0) * 1.5);
  let x = 0, y = 0, rowH = 0;
  boxes.forEach(b=>{
    if(x > 0 && x + b.w > target){ x = 0; y += rowH + gap; rowH = 0; }
    const dx = x - b.x, dy = y - b.y;
    b.grp.forEach(n=>{ n.x += dx; n.y += dy; });
    // Kantenzüge liegen in Weltkoordinaten und müssen mitwandern
    b.own.forEach(e=>{ if(e.bends) e.bends.forEach(q=>{ q.x += dx; q.y += dy; }); });
    x += b.w + gap;
    rowH = Math.max(rowH, b.h);
  });
}

/* ---------- Ebenenverfahren ---------- */
function layered(nodes, edges, dir, ortho){
  const vertical = dir === 'TB' || dir === 'BT';
  const flip = dir === 'BT' || dir === 'RL';
  const SIB = vertical ? 40 : 26;
  const LAY = vertical ? 84 : 100;
  const SAT_GAP = 24, SAT_SEP = 14;
  const allNodes = nodes;
  if(!nodes.length) return;

  /* 0 — Quellknoten als Trabanten an ihr Geschäftsobjekt binden.
     Eine Quelle ist eine Sackgasse. Bleibt sie in der Ebenenrechnung, schiebt
     sie sich zwischen die Objekte und zerschneidet den fachlichen Fluss. */
  const deg = new Map(), inc = new Map();
  nodes.forEach(n=>{ deg.set(n.id, 0); inc.set(n.id, []); });
  edges.forEach(e=>{
    if(e.from === e.to || !deg.has(e.from) || !deg.has(e.to)) return;
    deg.set(e.from, deg.get(e.from)+1); deg.set(e.to, deg.get(e.to)+1);
    inc.get(e.from).push(e); inc.get(e.to).push(e);
  });
  const nodeAll = new Map(nodes.map(n=>[n.id, n]));
  const sat = new Map(), isSat = new Set();
  const isOne = c => c === 'exactly_one' || c === 'zero_or_one';
  const oneToOne = e => isOne(e.fromCard) && isOne(e.toCard);   // beide ausdrücklich „eins"
  nodes.forEach(n=>{
    if(deg.get(n.id) !== 1) return;
    const e = inc.get(n.id)[0];
    const pid = e.from === n.id ? e.to : e.from;
    const is11 = n.kind !== 'source' && oneToOne(e);
    if(n.kind !== 'source' && !is11) return;                 // 1:n-Blatt bleibt in der Hierarchie (unten)
    if(n.kind === 'source' && deg.get(pid) <= 1) return;     // Paar aus zwei Quell-Sackgassen bleibt
    if(is11 && deg.get(pid) === 1 && n.id < pid) return;     // reines 1:1-Paar: der „kleinere" bleibt Anker
    if(isSat.has(pid)) return;                               // nicht an einen Trabanten hängen
    if(!sat.has(pid)) sat.set(pid, []);
    sat.get(pid).push(n);
    isSat.add(n.id);
  });

  const shrunk = new Map();
  for(const [pid, list] of sat){
    const p = nodeAll.get(pid);
    shrunk.set(pid, {w:p.w, h:p.h});
    if(vertical){                    // Fluss nach unten: Trabanten nach rechts
      p.w = p.w + SAT_GAP + Math.max(...list.map(l=>l.w));
      p.h = Math.max(p.h, list.reduce((s,l)=> s + l.h + SAT_SEP, 0) - SAT_SEP);
    } else {                         // Fluss nach rechts: Trabanten nach unten
      p.h = p.h + SAT_GAP + Math.max(...list.map(l=>l.h));
      p.w = Math.max(p.w, list.reduce((s,l)=> s + l.w + SAT_SEP, 0) - SAT_SEP);
    }
  }
  if(isSat.size){
    nodes = nodes.filter(n => !isSat.has(n.id));
    edges = edges.filter(e => !isSat.has(e.from) && !isSat.has(e.to));
  }
  const N = nodes.length;
  if(!N){ placeSatellites(); return; }

  function placeSatellites(){
    for(const [pid, list] of sat){
      const p = nodeAll.get(pid), s = shrunk.get(pid);
      const bx = p.x, by = p.y, bw = p.w, bh = p.h;
      p.w = s.w; p.h = s.h;
      if(vertical){
        p.x = bx; p.y = Math.round(by + (bh - s.h)/2);
        const lh = list.reduce((t,l)=> t + l.h + SAT_SEP, 0) - SAT_SEP;
        let ly = by + (bh - lh)/2;
        list.forEach(l=>{ l.x = Math.round(bx + s.w + SAT_GAP); l.y = Math.round(ly); ly += l.h + SAT_SEP; });
      } else {
        p.x = Math.round(bx + (bw - s.w)/2); p.y = by;
        const lw = list.reduce((t,l)=> t + l.w + SAT_SEP, 0) - SAT_SEP;
        let lx = bx + (bw - lw)/2;
        list.forEach(l=>{ l.x = Math.round(lx); l.y = Math.round(by + s.h + SAT_GAP); lx += l.w + SAT_SEP; });
      }
      list.forEach((l,i)=>{
        const e = inc.get(l.id)[0];
        const fromParent = e.from === pid;
        const t = (i + 1) / (list.length + 1);
        const pSide = vertical ? 'R' : 'B', lSide = vertical ? 'L' : 'T';
        e.bends = null; e.ortho = false;
        e.portFrom = {side: fromParent ? pSide : lSide, t: fromParent ? t : 0.5};
        e.portTo   = {side: fromParent ? lSide : pSide, t: fromParent ? 0.5 : t};
      });
    }
  }

  /* Rangfolge nach der 1:n-Richtung: die „viele"-Seite ist das Kind (tiefere
     Ebene), die „1"-Seite der Elternteil. Nur wenn die Kardinalität nichts
     hergibt, zählt die notierte Kantenrichtung from->to. */
  const idx = new Map(nodes.map((n,i)=>[n.id, i]));
  const out = nodes.map(()=>[]);
  edges.forEach(e=>{
    const a = idx.get(e.from), b = idx.get(e.to);
    if(a === undefined || b === undefined || a === b) return;
    const fromMany = isManyCard(e.fromCard), toMany = isManyCard(e.toCard);
    let parent = a, child = b;                       // Standard: from -> to
    if(fromMany && !toMany){ parent = b; child = a; } // from ist die n-Seite -> umkehren
    out[parent].push(child);
  });

  /* 1 — Zyklen brechen (Rückwärtskanten der Tiefensuche verwerfen) */
  const color = new Array(N).fill(0), fwd = nodes.map(()=>[]);
  const dfs = v=>{
    color[v] = 1;
    for(const w of out[v]){ if(color[w] === 1) continue; fwd[v].push(w); if(!color[w]) dfs(w); }
    color[v] = 2;
  };
  for(let v=0; v<N; v++) if(!color[v]) dfs(v);

  /* 2 — Ebenen über den längsten Pfad */
  const pre = nodes.map(()=>[]);
  fwd.forEach((ws,v)=> ws.forEach(w=> pre[w].push(v)));
  const layer = new Array(N).fill(-1);
  const rank = v=>{
    if(layer[v] >= 0) return layer[v];
    layer[v] = 0;
    let m = 0;
    for(const p of pre[v]) m = Math.max(m, rank(p) + 1);
    return layer[v] = m;
  };
  for(let v=0; v<N; v++) rank(v);

  /* Wurzelknoten dicht an ihre Nachfolger heranziehen — verkürzt lange Kanten */
  for(let pass=0; pass<3; pass++)
    for(let v=0; v<N; v++)
      if(!pre[v].length && fwd[v].length){
        const m = Math.min(...fwd[v].map(w=>layer[w])) - 1;
        if(m > layer[v]) layer[v] = m;
      }

  const L = Math.max(...layer) + 1;
  const rows = Array.from({length:L}, ()=>[]);
  const items = nodes.map((n,i)=>{
    const it = {n, lay:layer[i], dummy:false, c:0};
    rows[layer[i]].push(it);
    return it;
  });
  const cs = it => it.dummy ? 10 : (vertical ? it.n.w : it.n.h);   // quer
  const ms = it => it.dummy ? 0  : (vertical ? it.n.h : it.n.w);   // längs
  // Zwischen Stützpunkten genügt ein schmaler Kanal
  const gap = (a,b) => (a.dummy || b.dummy) ? SIB * 0.42 : SIB;

  /* 3 — Stützpunkte für Kanten über mehrere Ebenen.
         Ohne sie schneidet eine lange Kante quer durch fremde Knoten. */
  const down = new Map(), up = new Map();
  const link = (a,b)=>{
    if(!down.has(a)) down.set(a, []); down.get(a).push(b);
    if(!up.has(b)) up.set(b, []); up.get(b).push(a);
  };
  const chain = new Map();
  edges.forEach(e=>{
    const a = idx.get(e.from), b = idx.get(e.to);
    e.bends = null; e.ortho = false; e.portFrom = null; e.portTo = null;
    if(a === undefined || b === undefined || a === b) return;
    const rev = layer[b] < layer[a];
    const s = rev ? b : a, t = rev ? a : b;
    if(layer[t] - layer[s] <= 1){ link(items[s], items[t]); chain.set(e, {ds:[], rev}); return; }
    const ds = [];
    let prev = items[s];
    for(let l = layer[s]+1; l < layer[t]; l++){
      const d = {n:null, lay:l, dummy:true, c:0};
      rows[l].push(d); ds.push(d);
      link(prev, d); prev = d;
    }
    link(prev, items[t]);
    chain.set(e, {ds: rev ? ds.slice().reverse() : ds, rev});
  });

  /* 4 — Reihenfolge je Ebene, Median-Heuristik mit Kreuzungszählung */
  const countCross = ()=>{
    let c = 0;
    for(let i=0; i<L-1; i++){
      const pos = new Map(rows[i+1].map((x,k)=>[x,k]));
      const ps = [];
      rows[i].forEach((x,k)=> (down.get(x)||[]).forEach(y=>{
        const p = pos.get(y); if(p !== undefined) ps.push([k,p]);
      }));
      for(let a=0;a<ps.length;a++) for(let b=a+1;b<ps.length;b++)
        if((ps[a][0]-ps[b][0])*(ps[a][1]-ps[b][1]) < 0) c++;
    }
    return c;
  };
  const medianOf = (arr)=>{
    if(!arr.length) return null;
    const s = arr.slice().sort((a,b)=>a-b);
    return s.length % 2 ? s[(s.length-1)/2] : (s[s.length/2-1] + s[s.length/2]) / 2;
  };

  let best = rows.map(r=>r.slice()), bestC = countCross();
  for(let pass=0; pass<16 && bestC > 0; pass++){
    const godown = pass % 2 === 0;
    for(let k=1; k<L; k++){
      const i = godown ? k : L-1-k;
      const prev = rows[godown ? i-1 : i+1];
      if(!prev) continue;
      const pos = new Map(prev.map((x,j)=>[x,j]));
      const ref = godown ? up : down;
      const key = new Map();
      rows[i].forEach((x,j)=>{
        const m = medianOf((ref.get(x)||[]).map(y=>pos.get(y)).filter(v=>v!==undefined));
        key.set(x, m === null ? j : m);
      });
      rows[i] = rows[i].slice().sort((p,q)=> key.get(p) - key.get(q));
    }
    const c = countCross();
    if(c < bestC){ bestC = c; best = rows.map(r=>r.slice()); }
  }
  for(let i=0;i<L;i++) rows[i] = best[i];

  /* 4b — Transponieren: benachbarte Knoten einer Ebene tauschen, solange es die
          lokalen Kreuzungen senkt. Räumt Kreuzungen weg, die die Median-Ordnung
          stehen lässt. */
  const pairCross = (i, x, y)=>{                       // Kreuzungen, wenn x links von y
    let c = 0;
    for(const [rel, adj] of [[up, rows[i-1]], [down, rows[i+1]]]){
      if(!adj) continue;
      const pos = new Map(adj.map((n,k)=>[n,k]));
      const px = (rel.get(x)||[]).map(n=>pos.get(n)).filter(v=>v!==undefined);
      const py = (rel.get(y)||[]).map(n=>pos.get(n)).filter(v=>v!==undefined);
      for(const a of px) for(const b of py) if(a > b) c++;
    }
    return c;
  };
  for(let pass=0, moved=true; moved && pass<8; pass++){
    moved = false;
    for(let i=0;i<L;i++){
      const row = rows[i];
      for(let j=0;j<row.length-1;j++){
        if(pairCross(i, row[j], row[j+1]) > pairCross(i, row[j+1], row[j])){
          const t = row[j]; row[j] = row[j+1]; row[j+1] = t; moved = true;
        }
      }
    }
  }

  /* 5 — Querkoordinaten: dicht packen, dann per Median geraderücken */
  rows.forEach(r=>{
    let c = 0;
    r.forEach((it,k)=>{
      if(k) c += gap(r[k-1], it);
      it.c = c + cs(it)/2;
      c += cs(it);
    });
    r.forEach(it=> it.c -= c/2);
  });
  const tidy = r=>{
    for(let k=1;k<r.length;k++){
      const need = r[k-1].c + cs(r[k-1])/2 + gap(r[k-1], r[k]) + cs(r[k])/2;
      if(r[k].c < need) r[k].c = need;
    }
    for(let k=r.length-2;k>=0;k--){
      const cap = r[k+1].c - cs(r[k+1])/2 - gap(r[k], r[k+1]) - cs(r[k])/2;
      if(r[k].c > cap) r[k].c = cap;
    }
  };
  /* Prioritäts-Ausrichtung (nach Sugiyama): jeder Knoten möchte auf den Median
     seiner Nachbarn (in Bezugsrichtung). Knoten mit mehr Nachbarn und vor allem
     Stützpunkte (halten lange Kanten gerade) haben Vorrang — sie dürfen ihre
     schwächeren Nachbarn verschieben, aber nicht umgekehrt. Das zentriert den
     Baum, ohne dass sich eine einseitige Drift aufschaukelt. */
  const sep = (a,b) => cs(a)/2 + gap(a,b) + cs(b)/2;        // Mindestabstand Mitte–Mitte
  const prio = it => it.dummy ? Infinity : ((up.get(it)||[]).length + (down.get(it)||[]).length);
  const alignRow = (i, ref)=>{
    const row = rows[i], n = row.length;
    const want = row.map(it=>medianOf((ref.get(it)||[]).map(y=>y.c)));
    const orderIdx = row.map((_,k)=>k).sort((a,b)=> prio(row[b])-prio(row[a]) || a-b);
    for(const k of orderIdx){
      const d = want[k];
      if(d === null) continue;
      if(d > row[k].c){                                    // nach rechts, bis zur nächsten „Wand"
        let limit = Infinity, acc = 0;
        for(let j=k+1;j<n;j++){
          acc += sep(row[j-1], row[j]);
          if(prio(row[j]) >= prio(row[k])){ limit = row[j].c - acc; break; }
        }
        row[k].c = Math.min(d, limit);
        for(let j=k+1;j<n;j++){
          const need = row[j-1].c + sep(row[j-1], row[j]);
          if(row[j].c < need) row[j].c = need; else break;
        }
      } else if(d < row[k].c){                             // symmetrisch nach links
        let limit = -Infinity, acc = 0;
        for(let j=k-1;j>=0;j--){
          acc += sep(row[j], row[j+1]);
          if(prio(row[j]) >= prio(row[k])){ limit = row[j].c + acc; break; }
        }
        row[k].c = Math.max(d, limit);
        for(let j=k-1;j>=0;j--){
          const cap = row[j+1].c - sep(row[j], row[j+1]);
          if(row[j].c > cap) row[j].c = cap; else break;
        }
      }
    }
  };
  for(let pass=0; pass<14; pass++){
    const godown = pass % 2 === 0;
    for(let k=1;k<L;k++){
      const i = godown ? k : L-1-k;
      alignRow(i, godown ? up : down);
    }
  }

  /* 5b — Einzelnes „to many"-Kind genau unter sein Elternteil rücken.
          Hat ein Objekt nur diese eine Kante nach unten (genau eine 1:n-Beziehung)
          und hängt das Kind nur an diesem einen Elternteil, stehen beide in einer
          senkrechten Linie. tidy() rückt sie danach nur auseinander, wenn die Reihe
          es sonst überfüllt — „solange nichts dagegen spricht". */
  // Trabanten hängen bei senkrechtem Fluss rechts am Elternteil, das dabei
  // linksbündig bleibt — die reale Mitte des Elternteils liegt dann links von c.
  const parentC = p=>{
    const s = shrunk.get(p.n.id);
    return (vertical && s) ? p.c - (cs(p)/2 - s.w/2) : p.c;
  };
  for(let pass=0; pass<6; pass++)
    for(let i=1;i<L;i++)
      rows[i].forEach(k=>{
        if(k.dummy) return;
        const ups = up.get(k) || [];
        if(ups.length !== 1 || ups[0].dummy) return;     // genau ein echtes Elternteil
        const p = ups[0];
        if((down.get(p) || []).length !== 1) return;      // Elternteil hat nur dieses eine Kind
        k.c = parentC(p);
        tidy(rows[i]);
      });

  /* 6 — Längsachse und Rückschreiben */
  const order = [];
  for(let i=0;i<L;i++) order.push(i);
  if(flip) order.reverse();
  const mainOf = new Array(L).fill(0);
  const bands = [];
  let mainPos = 0;
  order.forEach(i=>{
    const thick = rows[i].length ? Math.max(...rows[i].map(ms)) : 0;
    mainOf[i] = mainPos + thick/2;
    bands.push([mainPos, mainPos + thick]);
    mainPos += thick + LAY;
  });
  // Freie Kanäle zwischen den Bändern — dort darf rechtwinklig quergelaufen werden
  const chans = [];
  for(let k=0; k<bands.length-1; k++) chans.push((bands[k][1] + bands[k+1][0]) / 2);
  const posOf = new Array(L);
  order.forEach((i,k)=> posOf[i] = k);
  const chanBefore = i => posOf[i] > 0 ? chans[posOf[i]-1] : bands[posOf[i]][0] - LAY/2;
  const chanAfter  = i => posOf[i] < chans.length ? chans[posOf[i]] : bands[posOf[i]][1] + LAY/2;
  items.forEach(it=>{
    const m = mainOf[it.lay];
    if(vertical){ it.n.x = Math.round(it.c - it.n.w/2); it.n.y = Math.round(m - it.n.h/2); }
    else        { it.n.y = Math.round(it.c - it.n.h/2); it.n.x = Math.round(m - it.n.w/2); }
  });
  // Ein Stützpunkt wird zu zwei Punkten an den Bandgrenzen. Dadurch läuft die
  // Kante senkrecht durch das Band und versetzt nur im freien Kanal seitlich.
  const ptAt = (c, mv) => vertical ? {x:c, y:mv} : {x:mv, y:c};
  const dpts = (ds, rev) => ds.flatMap(d => rev
    ? [ptAt(d.c, chanAfter(d.lay)), ptAt(d.c, chanBefore(d.lay))]
    : [ptAt(d.c, chanBefore(d.lay)), ptAt(d.c, chanAfter(d.lay))]);

  /* 7 — Kantenzüge und Anschlusspunkte */
  const nodeOf = new Map(nodes.map(n=>[n.id, n]));
  const sideFor = (goesForward, isSource)=>{
    const fwdSide = vertical ? (flip ? 'T' : 'B') : (flip ? 'L' : 'R');
    const backSide = vertical ? (flip ? 'B' : 'T') : (flip ? 'R' : 'L');
    return (goesForward === isSource) ? fwdSide : backSide;
  };

  edges.forEach(e=>{
    const info = chain.get(e);
    if(!info) return;
    e.ortho = ortho;
    e.bends = info.ds.length ? dpts(info.ds, info.rev) : null;
    const a = idx.get(e.from), b = idx.get(e.to);
    if(a === undefined || b === undefined || a === b) return;
    if(layer[a] === layer[b]) return;                 // gleiche Ebene: freie Führung
    const forward = layer[b] > layer[a];
    e.portFrom = {side: sideFor(forward, true),  t: 0.5};
    e.portTo   = {side: sideFor(forward, false), t: 0.5};
  });

  /* Anschlusspunkte über die Kante verteilen, statt alles aus der Mitte laufen zu lassen */
  const ports = new Map();
  const addPort = (nodeId, side, ref)=>{
    const key = nodeId + '|' + side;
    if(!ports.has(key)) ports.set(key, []);
    ports.get(key).push(ref);
  };
  edges.forEach(e=>{
    if(e.portFrom) addPort(e.from, e.portFrom.side, {e, which:'portFrom', other:e.to});
    if(e.portTo)   addPort(e.to,   e.portTo.side,   {e, which:'portTo',   other:e.from});
  });
  const crossOf = ref=>{
    const b = ref.e.bends;
    let p;
    if(b && b.length) p = ref.which === 'portFrom' ? b[0] : b[b.length-1];
    else {
      const other = nodeOf.get(ref.other);
      p = other ? {x:other.x + other.w/2, y:other.y + other.h/2} : {x:0, y:0};
    }
    return vertical ? p.x : p.y;
  };
  for(const list of ports.values()){
    if(list.length < 2) continue;
    list.sort((p,q)=> crossOf(p) - crossOf(q));
    const spread = 0.36 / (list.length - 1);
    list.forEach((ref,i)=>{
      ref.e[ref.which].t = 0.5 + (i - (list.length-1)/2) * spread;
    });
  }

  /* Lange Kanten möglichst gerade in den Zielanschluss fallen lassen: die
     Stützspalten auf die Querlage des Zielports ziehen, soweit die Ebene dort
     frei ist. Sonst läuft die Kante bis zur Knotenmitte und versetzt am Ende
     zurück zum seitlichen Port (unnötiger Haken). */
  edges.forEach(e=>{
    const info = chain.get(e);
    if(!info || !info.ds.length || !e.portTo) return;
    const B = nodeOf.get(e.to);
    if(!B) return;
    const target = vertical ? B.x + B.w * e.portTo.t : B.y + B.h * e.portTo.t;
    info.ds.forEach(d=>{
      const blocked = rows[d.lay].some(it=>{
        if(it.dummy) return false;
        const half = cs(it)/2 + SIB * 0.3;
        return target > it.c - half && target < it.c + half;
      });
      if(!blocked) d.c = target;
    });
    e.bends = dpts(info.ds, info.rev);
  });

  // Reihenfolge zählt: erst endgültige Lagen, dann die Kantenführung darauf rechnen.
  // Das Ebenenverfahren erzeugt keine Überlappungen, separate() würde nur stören.
  placeSatellites();
  if(ortho) orthogonalize(edges, nodeOf, vertical, chans, LAY);
}

/* Rechtwinklige Kantenführung.
   Läuft in zwei Durchgängen: erst wird ermittelt, welcher Kanal jeder Querlauf
   benutzt, dann bekommt jeder Querlauf darin eine eigene Spur. Ohne das liegen
   alle Kanten eines Kanals auf derselben Linie übereinander. */
function orthogonalize(edges, nodeOf, vertical, chans, LAY){
  const chanAt = (a, b)=>{
    const lo = Math.min(a,b) - 1, hi = Math.max(a,b) + 1;
    let best = -1, bd = Infinity;
    for(let i=0; i<chans.length; i++){
      if(chans[i] < lo || chans[i] > hi) continue;
      const d = Math.abs(chans[i] - (a + b)/2);
      if(d < bd){ bd = d; best = i; }
    }
    return best;
  };

  const plans = new Map(), runs = [];
  edges.forEach(e=>{
    const A = nodeOf.get(e.from), B = nodeOf.get(e.to);
    if(!A || !B || A === B || !e.portFrom) return;
    const pts = [portPoint(A, e.portFrom), ...(e.bends || []), portPoint(B, e.portTo)];
    const steps = [];
    for(let i=0; i<pts.length-1; i++){
      const p = pts[i], q = pts[i+1];
      const across = vertical ? Math.abs(p.x - q.x) : Math.abs(p.y - q.y);
      if(across <= 1) continue;
      const a = vertical ? p.y : p.x, b = vertical ? q.y : q.x;   // Längsachse
      const pc = vertical ? p.x : p.y, qc = vertical ? q.x : q.y; // Querachse
      const st = {i, ci: chanAt(a, b), mid: (a + b) / 2, off: 0,
                  lo: Math.min(pc, qc), hi: Math.max(pc, qc),
                  up:   a <= b ? pc : qc,   // Endpunkt zur Quelle hin (kleinere Längsachse)
                  down: a <= b ? qc : pc};  // Endpunkt zum Ziel hin (größere Längsachse)
      steps.push(st);
      if(st.ci >= 0) runs.push(st);
    }
    plans.set(e, {pts, steps});
  });

  // Überlappende Querläufe im selben Kanal auf getrennte Spuren legen
  const byChan = new Map();
  runs.forEach(r=>{
    if(!byChan.has(r.ci)) byChan.set(r.ci, []);
    byChan.get(r.ci).push(r);
  });
  for(const list of byChan.values()){
    const K = list.length;
    if(K < 2) continue;
    // Vertikale Zwangsbedingungen: liegt der Ziel-Endpunkt von j im Querlauf von i,
    // muss i darüber liegen (sonst schneidet j's senkrechter Zielanschluss i);
    // liegt der Quell-Endpunkt von j in i, muss i darunter liegen. Daraus eine
    // Reihenfolge der Spuren ableiten, statt nur dicht zu packen.
    // Endpunkte einschließen: teilt ein Lauf eine Spalte mit dem Anschlusspunkt
    // eines anderen, müssen sie trotzdem geordnet werden.
    const inside = (x, r)=> x > r.lo - 0.5 && x < r.hi + 0.5;
    const higher = list.map(()=>[]);          // higher[i] = Läufe, über denen i liegen muss
    for(let i=0;i<K;i++) for(let j=0;j<K;j++){
      if(i === j) continue;
      if(inside(list[j].down, list[i])) higher[i].push(j);   // i über j
      if(inside(list[j].up,   list[i])) higher[j].push(i);   // j über i
    }
    const level = new Array(K).fill(0);       // Ebene per Relaxation (Zyklen nach K Runden ab)
    for(let pass=0; pass<K; pass++){
      let ch = false;
      for(let i=0;i<K;i++) for(const j of higher[i])
        if(level[j] < level[i] + 1){ level[j] = level[i] + 1; ch = true; }
      if(!ch) break;
    }
    const order = list.map((_,i)=>i).sort((p,q)=> level[p]-level[q] || list[p].lo-list[q].lo);
    const step = Math.min(16, (LAY * 0.62) / (K - 1));
    order.forEach((idx, pos)=>{ list[idx].off = (pos - (K-1)/2) * step; });
  }

  for(const [e, {pts, steps}] of plans){
    const res = [];
    for(let i=0; i<pts.length-1; i++){
      const st = steps.find(s => s.i === i);
      if(st){
        const m = (st.ci >= 0 ? chans[st.ci] : st.mid) + st.off;
        if(vertical) res.push({x:pts[i].x, y:m}, {x:pts[i+1].x, y:m});
        else         res.push({x:m, y:pts[i].y}, {x:m, y:pts[i+1].y});
      }
      if(i < pts.length - 2) res.push(pts[i+1]);
    }
    // Rücklaufende/kollineare Zwischenpunkte raus (sonst Haken an den Ecken).
    // pts[0]/pts[letzter] sind die Anschlusspunkte und dienen nur als Anker.
    const clean = dropCollinear([pts[0], ...res, pts[pts.length-1]]);
    e.bends = clean.length > 2 ? clean.slice(1, -1) : (res.length ? res : null);
  }
}

/* ---------- Kräftebasiert ---------- */
function organic(nodes, edges){
  const N = nodes.length;
  if(!N) return;
  const R = 60 + N * 26;
  nodes.forEach((n,i)=>{ const a = i/N*Math.PI*2; n.x = Math.cos(a)*R; n.y = Math.sin(a)*R; });
  const k = 175;
  const {idx} = adjacency(nodes, edges);
  const links = edges.map(e=>[idx.get(e.from), idx.get(e.to)])
                     .filter(([a,b])=> a !== undefined && b !== undefined && a !== b);
  let temp = R * 0.6;
  for(let it=0; it<520; it++){
    const dx = new Float64Array(N), dy = new Float64Array(N);
    for(let a=0;a<N;a++) for(let b=a+1;b<N;b++){
      let ux = nodes[a].x - nodes[b].x, uy = nodes[a].y - nodes[b].y;
      const d = Math.hypot(ux, uy) || 0.01;
      const f = (k*k)/d;
      ux /= d; uy /= d;
      dx[a] += ux*f; dy[a] += uy*f; dx[b] -= ux*f; dy[b] -= uy*f;
    }
    for(const [a,b] of links){
      let ux = nodes[a].x - nodes[b].x, uy = nodes[a].y - nodes[b].y;
      const d = Math.hypot(ux, uy) || 0.01;
      const f = (d*d)/k;
      ux /= d; uy /= d;
      dx[a] -= ux*f; dy[a] -= uy*f; dx[b] += ux*f; dy[b] += uy*f;
    }
    for(let a=0;a<N;a++){                       // leichte Anziehung zur Mitte
      dx[a] -= nodes[a].x * 0.012; dy[a] -= nodes[a].y * 0.012;
      const d = Math.hypot(dx[a], dy[a]) || 0.01;
      const s = Math.min(d, temp)/d;
      nodes[a].x += dx[a]*s; nodes[a].y += dy[a]*s;
    }
    temp *= 0.988;
  }
  edges.forEach(e=>{ e.bends = null; e.ortho = false; e.portFrom = null; e.portTo = null; });
  separate(nodes, 26, 26);
}

/* ---------- Kreisförmig ---------- */
function circular(nodes, edges){
  const N = nodes.length;
  if(!N) return;
  const {und} = adjacency(nodes, edges);
  const deg = nodes.map((_,i)=> und[i].length);

  // Breitensuche vom bestvernetzten Knoten: hält Nachbarn auf dem Kreis beieinander
  let start = 0;
  deg.forEach((d,i)=>{ if(d > deg[start]) start = i; });
  const seen = new Array(N).fill(false), order = [];
  const q = [start]; seen[start] = true;
  while(q.length){
    const v = q.shift(); order.push(v);
    und[v].slice().sort((a,b)=> deg[b] - deg[a]).forEach(w=>{
      if(!seen[w]){ seen[w] = true; q.push(w); }
    });
  }
  for(let i=0;i<N;i++) if(!seen[i]) order.push(i);

  const need = order.map(v => Math.max(nodes[v].w, nodes[v].h) + 40);
  const per = need.reduce((a,b)=>a+b, 0);
  const R = Math.max(150, per / (2*Math.PI));
  let acc = 0;
  order.forEach((v,k)=>{
    const ang = (acc + need[k]/2) / per * Math.PI*2 - Math.PI/2;
    acc += need[k];
    nodes[v].x = Math.round(Math.cos(ang)*R - nodes[v].w/2);
    nodes[v].y = Math.round(Math.sin(ang)*R - nodes[v].h/2);
  });
  edges.forEach(e=>{ e.bends = null; e.ortho = false; e.portFrom = null; e.portTo = null; });
  separate(nodes, 22, 22);
}

/* ---------- Überlappungen auflösen ---------- */
function separate(nodes, padX = 26, padY = 26){
  for(let it=0; it<90; it++){
    let moved = false;
    for(let a=0; a<nodes.length; a++) for(let b=a+1; b<nodes.length; b++){
      const A = nodes[a], B = nodes[b];
      const ox = (A.w + B.w)/2 + padX - Math.abs((A.x + A.w/2) - (B.x + B.w/2));
      const oy = (A.h + B.h)/2 + padY - Math.abs((A.y + A.h/2) - (B.y + B.h/2));
      if(ox > 0 && oy > 0){
        moved = true;
        if(ox < oy){ const s = (A.x < B.x ? -1 : 1) * ox/2; A.x += s; B.x -= s; }
        else       { const s = (A.y < B.y ? -1 : 1) * oy/2; A.y += s; B.y -= s; }
      }
    }
    if(!moved) break;
  }
  nodes.forEach(n=>{ n.x = Math.round(n.x); n.y = Math.round(n.y); });
}

