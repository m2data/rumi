/* =====================================================================
   4 — Automatische Anordnung
   Vier Verfahren. "Hierarchisch" und "Orthogonal" teilen sich den
   Ebenenalgorithmus (Sugiyama) und unterscheiden sich in der Kantenführung.
   ===================================================================== */
const ALGOS = {
  hier:  {name:'Hierarchisch', dir:true,  fn:(ns,es,dir)=> layered(ns, es, dir, false)},
  ortho: {name:'Orthogonal',   dir:true,  fn:(ns,es,dir)=> layered(ns, es, dir, true)},
  org:   {name:'Organisch',    dir:false, fn:(ns,es)=> mitAnhaengseln(ns, es, organic)},
  circ:  {name:'Kreisförmig',  dir:false, fn:(ns,es)=> kreisMitAnhaengseln(ns, es)}
};

/* Anhängsel (Quelle/Domäne als eigener Kasten, n.eltern gesetzt) stehen rechts
   neben ihrem Objekt, mehrere untereinander. Das Ebenenverfahren erledigt das
   selbst über seine Trabanten — es muss, weil die orthogonale Kantenführung
   die endgültigen Kästen braucht. Für Organisch und Kreisförmig: Anhängsel
   herausnehmen, das Objekt um sie verbreitern, anordnen, dann ansetzen —
   beim Kreis nicht rechts, sondern außen (kreisMitAnhaengseln). */
const ANH_GAP = 24, ANH_SEP = 14;
function anhaengselJeObjekt(nodes){
  const ids = new Set(nodes.map(n => n.id)), m = new Map();
  nodes.forEach(n=>{
    if(!n.eltern || !ids.has(n.eltern)) return;
    if(!m.has(n.eltern)) m.set(n.eltern, []);
    m.get(n.eltern).push(n);
  });
  return m;
}

/* Rechts neben das Objekt setzen, senkrecht um dessen Mitte; die Kante läuft
   gerade von rechts nach links. */
function setzeRechts(p, list, edges){
  const lh = list.reduce((t,l)=> t + l.h + ANH_SEP, 0) - ANH_SEP;
  let ly = p.y + (p.h - lh)/2;
  list.forEach((l,i)=>{
    l.x = Math.round(p.x + p.w + ANH_GAP); l.y = Math.round(ly); ly += l.h + ANH_SEP;
    const e = edges.find(x => x.from === p.id && x.to === l.id);
    if(!e) return;
    e.bends = null; e.ortho = false;
    e.portFrom = {side:'R', t:(i + 1) / (list.length + 1)};
    e.portTo   = {side:'L', t:0.5};
  });
}

function mitAnhaengseln(nodes, edges, fn){
  const anh = anhaengselJeObjekt(nodes);
  if(!anh.size){ fn(nodes, edges); return; }
  const weg = new Set([...anh.values()].flat().map(n => n.id));
  const byId = new Map(nodes.map(n => [n.id, n]));
  const alt = new Map();
  for(const [pid, list] of anh){
    const p = byId.get(pid);
    alt.set(pid, {w:p.w, h:p.h});
    p.w = p.w + ANH_GAP + Math.max(...list.map(l => l.w));
    p.h = Math.max(p.h, list.reduce((s,l)=> s + l.h + ANH_SEP, 0) - ANH_SEP);
  }
  fn(nodes.filter(n => !weg.has(n.id)), edges.filter(e => !weg.has(e.from) && !weg.has(e.to)));
  for(const [pid, list] of anh){
    const p = byId.get(pid), s = alt.get(pid);
    p.y = Math.round(p.y + (p.h - s.h)/2);
    p.w = s.w; p.h = s.h;
    setzeRechts(p, list, edges);
  }
}

/* Kreis: Anhängsel stehen außerhalb, als Reihe quer zum Strahl vom
   Kreismittelpunkt (Schwerpunkt der Objekte) durch ihr Objekt. Vorab wird das
   Objekt in der Breite auf seine Reihe verbreitert, damit der Kreis genug
   Bogenlänge freihält; die Tiefe braucht keine Reserve, außen ist mehr Umfang.
   Gemessen an vier Modellen: so 0 Überlappungen, ohne Reserve 2 bis 6.
   Ragt die Reihe bei schrägem Strahl noch über eine Ecke des Objekts, rückt
   sie weiter hinaus. Angeordnet wird je Zusammenhangskomponente: ein
   unverbundenes Objekt steht neben dem Kreis, seine Anhängsel rechts davon. */
function kreisMitAnhaengseln(nodes, edges){
  const anh = anhaengselJeObjekt(nodes);
  if(!anh.size){ circular(nodes, edges); return; }
  const weg = new Set([...anh.values()].flat().map(n => n.id));
  const byId = new Map(nodes.map(n => [n.id, n]));
  const objekte = nodes.filter(n => !weg.has(n.id));
  const alt = new Map();
  for(const [pid, list] of anh){
    const p = byId.get(pid);
    alt.set(pid, p.w);
    p.w = Math.max(p.w, list.reduce((s,l)=> s + l.w + ANH_SEP, -ANH_SEP));
  }
  circular(objekte, edges.filter(e => !weg.has(e.from) && !weg.has(e.to)));
  for(const [pid, w] of alt){ const p = byId.get(pid); p.x = Math.round(p.x + (p.w - w)/2); p.w = w; }

  const cx = objekte.reduce((s,n)=> s + n.x + n.w/2, 0) / objekte.length;
  const cy = objekte.reduce((s,n)=> s + n.y + n.h/2, 0) / objekte.length;
  // Abstand von der Kastenmitte zum Rand entlang der Richtung (ux, uy)
  const rand = (n, ux, uy)=> Math.min(Math.abs(ux) > 1e-9 ? (n.w/2) / Math.abs(ux) : Infinity,
                                      Math.abs(uy) > 1e-9 ? (n.h/2) / Math.abs(uy) : Infinity);
  for(const [pid, list] of anh){
    const p = byId.get(pid), px = p.x + p.w/2, py = p.y + p.h/2;
    const d = Math.hypot(px - cx, py - cy);
    const ux = d > 1e-6 ? (px - cx)/d : 1, uy = d > 1e-6 ? (py - cy)/d : 0;   // einzelnes Objekt: rechts
    const tx = -uy, ty = ux;
    const quer = list.map(l => 2 * rand(l, tx, ty));
    const breit = quer.reduce((a,b)=> a + b + ANH_SEP, -ANH_SEP);
    const setze = r=>{
      let t = -breit/2;
      list.forEach((l,i)=>{
        const m = t + quer[i]/2;
        l.x = Math.round(px + ux*r + tx*m - l.w/2); l.y = Math.round(py + uy*r + ty*m - l.h/2);
        t += quer[i] + ANH_SEP;
      });
    };
    const frei = ()=> list.every(l => !(l.x < p.x + p.w + ANH_GAP/2 && p.x - ANH_GAP/2 < l.x + l.w
                                     && l.y < p.y + p.h + ANH_GAP/2 && p.y - ANH_GAP/2 < l.y + l.h));
    let r = rand(p, ux, uy) + ANH_GAP + Math.max(...list.map(l => rand(l, ux, uy)));
    setze(r);
    while(!frei()){ r += 4; setze(r); }
  }
  edges.forEach(e=>{ if(weg.has(e.to)){ e.bends = null; e.ortho = false; e.portFrom = null; e.portTo = null; } });
}

/* Anhängsel ohne gemerkte Lage an ein schon gelegtes Objekt setzen (Einstellung
   eingeschaltet, Objekt eingeblendet). Ist eines davon neu, rücken alle
   Anhängsel dieses Objekts neu an, sonst lägen sie übereinander. Kein
   separate(): gelegte Objekte sollen nicht verrutschen. */
function platziereAnhaengsel(g, neu){
  const eltern = new Set(neu.filter(n => n.eltern).map(n => n.eltern));
  for(const pid of eltern)
    setzeRechts(g.byId.get(pid), g.nodes.filter(n => n.eltern === pid), g.edges);
}

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

  /* 0 — Trabanten: Kästen, die neben einem anderen stehen statt in einer
     eigenen Ebene. Zwei Arten:
     - Anhängsel (Quelle, Domäne) an ihrem Geschäftsobjekt. Ein Anhängsel ist
       eine Sackgasse; bliebe es in der Ebenenrechnung, schöbe es sich
       zwischen die Objekte und zerschnitte den fachlichen Fluss.
     - Ein 1:1-Blatt an seinem Gegenüber. Ob ein Objekt Blatt ist, entscheiden
       nur die fachlichen Kanten: zählten die Anhängsel mit, verlöre jedes
       Objekt mit Quelle seinen Platz neben dem Gegenüber (Willibald: 0 → 3
       geroutete Kreuzungen).
     Hat ein 1:1-Trabant selbst Anhängsel, ist er Anker für sie: er wird um
     sie vergrößert, bevor er seinen eigenen Anker vergrößert, und setzt sie
     nach seiner eigenen Platzierung an. */
  const nodeAll = new Map(nodes.map(n=>[n.id, n]));
  const deg = new Map(), inc = new Map();
  nodes.forEach(n=>{ deg.set(n.id, 0); inc.set(n.id, []); });
  edges.forEach(e=>{
    if(e.from === e.to || !deg.has(e.from) || !deg.has(e.to)) return;
    if(nodeAll.get(e.from).eltern || nodeAll.get(e.to).eltern) return;   // Anhängsel zählen nicht
    deg.set(e.from, deg.get(e.from)+1); deg.set(e.to, deg.get(e.to)+1);
    inc.get(e.from).push(e); inc.get(e.to).push(e);
  });
  const sat = new Map(), isSat = new Set(), satEdge = new Map();
  const zuAnker = (pid, n, e)=>{
    if(!sat.has(pid)) sat.set(pid, []);
    sat.get(pid).push(n);
    isSat.add(n.id); satEdge.set(n.id, e);
  };
  const isOne = c => c === 'exactly_one' || c === 'zero_or_one';
  const oneToOne = e => isOne(e.fromCard) && isOne(e.toCard);   // beide ausdrücklich „eins"
  nodes.forEach(n=>{
    if(n.eltern || deg.get(n.id) !== 1) return;
    const e = inc.get(n.id)[0];
    const pid = e.from === n.id ? e.to : e.from;
    if(!oneToOne(e)) return;                                 // 1:n-Blatt bleibt in der Hierarchie (unten)
    if(deg.get(pid) === 1 && n.id < pid) return;             // reines 1:1-Paar: der „kleinere" bleibt Anker
    if(isSat.has(pid)) return;                               // nicht an einen Trabanten hängen
    zuAnker(pid, n, e);
  });
  // Anhängsel nach den 1:1-Trabanten: so steht ein Trabant als Anker seiner
  // Anhängsel in der Reihenfolge hinter seinem eigenen Anker.
  edges.forEach(e=>{
    const n = nodeAll.get(e.to);
    if(n && n.eltern === e.from && nodeAll.has(e.from)) zuAnker(e.from, n, e);
  });

  /* Mit Anhängseln wird der Anker nach BEIDEN Seiten vergrößert, sodass seine
     Mitte bleibt: Spalten, Stützpunkte und Anschlüsse rechnet das Verfahren auf
     die Mitte des vergrößerten Kastens. Einseitig vergrößert, rückte die echte
     Mitte beim Verkleinern zur Seite, und seine Kanten kreuzten sich
     (Willibald: 0 → 3 geroutete Kreuzungen). */
  const shrunk = new Map(), mittig = new Set();
  for(const [pid, list] of [...sat].reverse()){              // innere Anker zuerst vergrößern
    const p = nodeAll.get(pid);
    shrunk.set(pid, {w:p.w, h:p.h});
    const k = list.some(l => l.eltern) ? 2 : 1;
    if(k === 2) mittig.add(pid);
    if(vertical){                    // Fluss nach unten: Trabanten nach rechts
      p.w = p.w + k * (SAT_GAP + Math.max(...list.map(l=>l.w)));
      p.h = Math.max(p.h, list.reduce((s,l)=> s + l.h + SAT_SEP, 0) - SAT_SEP);
    } else {                         // Fluss nach rechts: Trabanten nach unten
      p.h = p.h + k * (SAT_GAP + Math.max(...list.map(l=>l.h)));
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
    for(const [pid, list] of sat){                           // äußere Anker zuerst setzen
      const p = nodeAll.get(pid), s = shrunk.get(pid);
      const bx = p.x, by = p.y, bw = p.w, bh = p.h;
      p.w = s.w; p.h = s.h;
      if(vertical){
        p.x = mittig.has(pid) ? Math.round(bx + (bw - s.w)/2) : bx;
        p.y = Math.round(by + (bh - s.h)/2);
        const lh = list.reduce((t,l)=> t + l.h + SAT_SEP, 0) - SAT_SEP;
        let ly = by + (bh - lh)/2;
        list.forEach(l=>{ l.x = Math.round(p.x + s.w + SAT_GAP); l.y = Math.round(ly); ly += l.h + SAT_SEP; });
      } else {
        p.x = Math.round(bx + (bw - s.w)/2);
        p.y = mittig.has(pid) ? Math.round(by + (bh - s.h)/2) : by;
        const lw = list.reduce((t,l)=> t + l.w + SAT_SEP, 0) - SAT_SEP;
        let lx = bx + (bw - lw)/2;
        list.forEach(l=>{ l.x = Math.round(lx); l.y = Math.round(p.y + s.h + SAT_GAP); lx += l.w + SAT_SEP; });
      }
      list.forEach((l,i)=>{
        const e = satEdge.get(l.id);
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

  /* Transponieren: benachbarte Knoten einer Ebene tauschen, solange es die
     lokalen Kreuzungen senkt. Räumt weg, was die Median-Ordnung stehen lässt. */
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
  const transpose = ()=>{
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
  };

  // Ein voller Median+Transponier-Lauf aus dem aktuellen rows-Stand; lässt rows
  // auf dem besten gefundenen Stand und gibt dessen Kreuzungszahl zurück.
  const orderPass = ()=>{
    let best = rows.map(r=>r.slice()), bestC = countCross();
    for(let pass=0; pass<24 && bestC > 0; pass++){
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
      transpose();
      const c = countCross();
      if(c < bestC){ bestC = c; best = rows.map(r=>r.slice()); }
    }
    for(let i=0;i<L;i++) rows[i] = best[i];
    return bestC;
  };

  // Mehrere deterministische Startordnungen probieren und die kreuzungsärmste
  // behalten — die Median-Heuristik bleibt sonst leicht in einem lokalen Minimum.
  const start0 = rows.map(r=>r.slice());
  const runFrom = init=>{ for(let i=0;i<L;i++) rows[i] = init[i].slice(); return orderPass(); };
  let bestC = runFrom(start0);
  let bestRows = rows.map(r=>r.slice());
  [ start0.map(r=>r.slice().reverse()),                       // jede Ebene umgekehrt
    start0.map(r=>r.slice().sort((a,b)=> (down.get(b)||[]).length + (up.get(b)||[]).length
                                       - (down.get(a)||[]).length - (up.get(a)||[]).length))  // stark verbundene zuerst
  ].forEach(init=>{
    const c = runFrom(init);
    if(c < bestC){ bestC = c; bestRows = rows.map(r=>r.slice()); }
  });
  // Die drei geordneten Starts liegen dicht beieinander und laufen oft in
  // dasselbe lokale Minimum. Gemischte Startordnungen aus einem FESTEN Keim
  // brechen daraus aus, ohne das Bild unvorhersehbar zu machen: dasselbe
  // Modell ergibt dieselbe Anordnung. Bei crm blieben die geordneten Starts
  // bei 3 Kreuzungen stehen, wo 1 erreichbar ist — mehr als 1 fand auch eine
  // Suche über tausende Startordnungen nicht.
  let keim = 20250806;
  const wuerfel = ()=> (keim = (keim * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  for(let s = 0; s < 16 && bestC > 0; s++){
    const c = runFrom(start0.map(r=>{
      const a = r.slice();
      for(let k=a.length-1; k>0; k--){                  // Fisher-Yates
        const j = Math.floor(wuerfel() * (k+1));
        const t = a[k]; a[k] = a[j]; a[j] = t;
      }
      return a;
    }));
    if(c < bestC){ bestC = c; bestRows = rows.map(r=>r.slice()); }
  }
  for(let i=0;i<L;i++) rows[i] = bestRows[i];

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
  // Trabanten hängen quer am Elternteil (senkrechter Fluss: rechts, waagrechter:
  // unten), das dabei am Querrand bündig bleibt — die reale Mitte des Elternteils
  // liegt dann um die halbe Aufblähung vor c.
  const parentC = p=>{
    const s = shrunk.get(p.n.id);
    if(!s) return p.c;
    return p.c - (cs(p)/2 - (vertical ? s.w : s.h)/2);
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

  /* 5c — Überbreite leere Korridore schließen: liegt quer über ALLE Ebenen ein
          Streifen ohne jeden Knoten/Stützpunkt, der breiter ist als nötig, wird
          alles rechts davon starr nach links gerückt. Rein translatorisch, also
          ohne neue Kreuzungen oder Überlappungen. */
  {
    const all = rows.flat();
    const iv = all.map(it => [it.c - cs(it)/2, it.c + cs(it)/2]).sort((a,b)=> a[0]-b[0]);
    const MAXGAP = SIB * 3;
    const cuts = []; let coverEnd = -Infinity;
    for(const [lo, hi] of iv){
      if(coverEnd !== -Infinity && lo - coverEnd > MAXGAP) cuts.push({at: coverEnd, amount: (lo - coverEnd) - MAXGAP});
      coverEnd = Math.max(coverEnd, hi);
    }
    if(cuts.length) all.forEach(it=>{
      let sh = 0; for(const c of cuts) if(it.c - cs(it)/2 > c.at + 0.5) sh += c.amount;
      it.c -= sh;
    });
  }

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
  // Die Paar-Reihenfolge folgt der GEZEICHNETEN Richtung (rev XOR flip):
  // chanBefore/chanAfter sind über die Ebenen-Indizes definiert, bei
  // gespiegelten Richtungen (BT/RL) liegen sie geometrisch vertauscht — mit
  // rev allein durchquerte die Kante das Band dort rückwärts und legte eine
  // Kehre (hoch–runter–hoch) in den Zug.
  const ptAt = (c, mv) => vertical ? {x:c, y:mv} : {x:mv, y:c};
  const dpts = (ds, rev) => ds.flatMap(d => (rev !== flip)
    ? [ptAt(d.c, chanAfter(d.lay)), ptAt(d.c, chanBefore(d.lay))]
    : [ptAt(d.c, chanBefore(d.lay)), ptAt(d.c, chanAfter(d.lay))]);
  // Weiche Führung: EIN Punkt in Bandmitte je Zwischenebene statt des Paars.
  // Das Paar erzwingt Treppen — senkrecht durchs Band, quer im Kanal —, die
  // weich gezeichnet als Blitzmuster erscheinen, wo eine leichte Schräge
  // genügt. Liegen die Spalten auf der Luftlinie, sind die Punkte kollinear
  // und die Kante wird eine einzige gerade Diagonale.
  const dptsSoft = ds => ds.map(d => ptAt(d.c, mainOf[d.lay]));
  const bendsOf = info => info.ds.length
    ? (ortho ? dpts(info.ds, info.rev) : dptsSoft(info.ds))
    : null;

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
    e.bends = bendsOf(info);
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
  const verteilePorts = ()=>{
    for(const list of ports.values()){
      if(list.length < 2) continue;
      list.sort((p,q)=> crossOf(p) - crossOf(q));
      // Die Spanne wächst mit der Zahl der Anschlüsse bis fast zur ganzen Seite:
      // 15 Beziehungen auf festen 36 % einer schmalen Kastenseite (waagrechter
      // Fluss) wären ein Strichbündel, an dem kein Name mehr zuzuordnen ist.
      const span = Math.min(0.84, Math.max(0.36, (list.length - 1) * 0.1));
      const spread = span / (list.length - 1);
      list.forEach((ref,i)=>{
        ref.e[ref.which].t = 0.5 + (i - (list.length-1)/2) * spread;
      });
    }
  };
  verteilePorts();

  /* Lange Kanten möglichst gerade in den Zielanschluss fallen lassen: die
     Stützspalten auf die Querlage des Zielports ziehen, soweit die Ebene dort
     frei ist. Sonst läuft die Kante bis zur Knotenmitte und versetzt am Ende
     zurück zum seitlichen Port (unnötiger Haken).

     Aber nur, wenn das Geradstück keine neuen Kreuzungen einhandelt: es
     durchquert fremde Ebenenbänder und gehört keinem Kanal — die spätere
     Spurvergabe kann es also nicht mehr ausweichen lassen. Bei waagrechtem
     Fluss (schmale Querachse, enge Anschlüsse) entstanden so bis zu fünf
     Kreuzungen, die vorher nicht da waren; kreuzt der gerade Zug mehr als der
     alte, wird er zurückgenommen. */
  const polyOf = e=>{
    const A = nodeOf.get(e.from), B = nodeOf.get(e.to);
    if(!A || !B || A === B) return null;
    const p1 = e.portFrom ? portPoint(A, e.portFrom) : {x:A.x + A.w/2, y:A.y + A.h/2};
    const p2 = e.portTo   ? portPoint(B, e.portTo)   : {x:B.x + B.w/2, y:B.y + B.h/2};
    return [p1, ...(e.bends || []), p2];
  };
  const segCross = (a,b,c,d)=>{
    const ccw = (p,q,r)=> (r.y-p.y)*(q.x-p.x) - (q.y-p.y)*(r.x-p.x);
    const d1 = ccw(c,d,a), d2 = ccw(c,d,b), d3 = ccw(a,b,c), d4 = ccw(a,b,d);
    return ((d1>0)!==(d2>0)) && ((d3>0)!==(d4>0));
  };
  const kreuzungen = e=>{
    const P = polyOf(e); if(!P) return 0;
    let n = 0;
    for(const o of edges){
      if(o === e) continue;
      const Q = polyOf(o); if(!Q) continue;
      for(let i=0;i<P.length-1;i++) for(let j=0;j<Q.length-1;j++)
        if(segCross(P[i], P[i+1], Q[j], Q[j+1])) n++;
    }
    return n;
  };
  edges.forEach(e=>{
    const info = chain.get(e);
    if(!info || !info.ds.length || !e.portTo) return;
    const B = nodeOf.get(e.to);
    if(!B) return;
    const target = vertical ? B.x + B.w * e.portTo.t : B.y + B.h * e.portTo.t;
    const vorher = kreuzungen(e);
    const alt = info.ds.map(d => d.c);
    info.ds.forEach(d=>{
      const blocked = rows[d.lay].some(it=>{
        if(it.dummy) return false;
        const half = cs(it)/2 + SIB * 0.3;
        return target > it.c - half && target < it.c + half;
      });
      if(!blocked) d.c = target;
    });
    e.bends = bendsOf(info);
    if(kreuzungen(e) > vorher){                  // gerade, aber neu kreuzend: zurücknehmen
      info.ds.forEach((d,k)=>{ d.c = alt[k]; });
      e.bends = bendsOf(info);
    }
  });

  /* Kringel kappen: eine Stützspalte weit AUSSERHALB des Intervalls zwischen
     den beiden Anschlüssen schickt den Zug erst von seinem Ziel weg und dann
     zurück. Rechtwinklig gezeichnet wird daraus ein Haken quer durch fremde
     Spalten — und was er dort quert, kreuzt er zweimal, einmal hin und einmal
     zurück. Die Spalten kommen aus der dichten Packung der Ebene; angefasst
     hat sie bisher nur das Geraderücken darüber, und das ist Alles-oder-
     nichts: es setzt jede Spalte auf die Ziellage oder gar keine.

     Zwei Dinge entscheiden hier über Erfolg oder Schaden:

     Gekappt wird je PARALLELGRUPPE, nicht je Kante. Mehrere Beziehungen
     zwischen denselben zwei Objekten sind für das Verfahren getrennte Kanten
     mit getrennten Stützspalten. Einzeln geprüft wurde davon eine
     zurückgenommen und die übrigen gekappt — und dann kreuzten sich die
     parallelen Züge gegenseitig, was vorher keine tat.

     Und nur rechtwinklig: die weiche Führung zieht ihre Spalten gleich darauf
     auf die Luftlinie und braucht die Schranke nicht — vorgeschaltet
     verschiebt sie ihr bloß den Ausgangsstand (im kombinierten Modell von 21
     auf 22 Kreuzungen). */
  if(ortho){
    const gruppen = new Map();
    edges.forEach(e=>{
      const info = chain.get(e);
      if(!info || !info.ds.length || !e.portFrom || !e.portTo) return;
      if(!nodeOf.get(e.from) || !nodeOf.get(e.to)) return;
      const k = e.from + '|' + e.to;
      if(!gruppen.has(k)) gruppen.set(k, []);
      gruppen.get(k).push(e);
    });
    const cOf = (n, port)=> vertical ? n.x + n.w * port.t : n.y + n.h * port.t;
    for(const grp of gruppen.values()){
      /* Bewertet wird die Gruppe nach Kreuzungen UND nach dem Umweg: wie weit
         ihre Stützspalten aus dem Intervall zwischen den Anschlüssen
         herauslaufen. Ohne den Umweg kannte die Prüfung nur die halbe
         Rechnung — gemessener Fall: eine Spalte 146 px außerhalb wurde nicht
         hereingeholt, weil das Hereinholen EINE Kreuzung kostete. Hundert
         Pixel Umweg wiegen darum eine Kreuzung, dieselbe Umrechnung wie in
         der Seitenwahl der weichen Führung. */
      const umwegVon = e2=>{
        const info2 = chain.get(e2);
        const A2 = nodeOf.get(e2.from), B2 = nodeOf.get(e2.to);
        if(!info2 || !A2 || !B2 || !e2.portFrom || !e2.portTo) return 0;
        const a2 = cOf(A2, e2.portFrom), b2 = cOf(B2, e2.portTo);
        const l2 = Math.min(a2, b2), h2 = Math.max(a2, b2);
        return info2.ds.reduce((m,d)=>
          Math.max(m, d.c < l2 ? l2 - d.c : d.c > h2 ? d.c - h2 : 0), 0);
      };
      const noten = () => grp.reduce((s,e2)=> s + kreuzungen(e2) + umwegVon(e2) / 100, 0);
      const merk = grp.map(e => chain.get(e).ds.map(d => d.c));
      let bewegt = false;
      const vorher = noten();
      grp.forEach(e=>{
        const info = chain.get(e);
        const A = nodeOf.get(e.from), B = nodeOf.get(e.to);
        const ca = cOf(A, e.portFrom), cb = cOf(B, e.portTo);
        const lo = Math.min(ca, cb), hi = Math.max(ca, cb);
        info.ds.forEach(d=>{
          const ziel = Math.min(hi, Math.max(lo, d.c));
          if(Math.abs(ziel - d.c) < 1) return;
          // Ist die Wunschlage von einem Kasten belegt, wird sie an den Rand
          // der (zusammengelegten) Sperrzone geschoben — und zwar an den, der
          // dem Intervall zugewandt ist. Nur „belegt, also gar nicht bewegen"
          // ließ die Spalte sonst zweihundert Pixel daneben stehen; genau das
          // ist der Haken, den das Kappen beseitigen soll.
          let zLo = ziel, zHi = ziel, drin = true, guard = 0;
          while(drin && guard++ < 6){
            drin = false;
            for(const it of rows[d.lay]){
              if(it.dummy) continue;
              const half = cs(it)/2 + SIB * 0.3;
              if(zHi > it.c - half && zLo < it.c + half && (it.c - half < zLo || it.c + half > zHi)){
                zLo = Math.min(zLo, it.c - half);
                zHi = Math.max(zHi, it.c + half);
                drin = true;
              }
            }
          }
          /* Genommen wird der Rand, aus dessen Richtung die Spalte kommt — es
             sei denn, der ANDERE bringt sie ganz ins Anschluss-Intervall und
             dieser bliebe weit draußen. Sonst bleibt eine Spalte, die außen
             begonnen hat, außen, obwohl der Kasten auf der anderen Seite
             gleich zu Ende ist. Immer den näheren Rand zu nehmen wäre zu
             grob: das kostete im Bestand durchweg Kreuzungen. */
          const raus = c => c < lo ? lo - c : c > hi ? c - hi : 0;
          const nah = d.c < ziel ? zLo : zHi, fern = d.c < ziel ? zHi : zLo;
          const neu = (zLo === ziel && zHi === ziel) ? ziel
                    : (raus(fern) === 0 && raus(nah) > 120 ? fern : nah);
          if(Math.abs(neu - d.c) < 1) return;
          // Nur nach INNEN: das Ausweichen darf den Haken nicht vergrößern.
          if(Math.abs(neu - (lo + hi)/2) > Math.abs(d.c - (lo + hi)/2)) return;
          d.c = neu; bewegt = true;
        });
        e.bends = bendsOf(info);
      });
      if(!bewegt) continue;
      if(noten() > vorher) grp.forEach((e,i)=>{
        const info = chain.get(e);
        info.ds.forEach((d,k)=>{ d.c = merk[i][k]; });
        e.bends = bendsOf(info);
      });
    }

    /* Anschluss-Reihenfolge an die jetzt endgültigen Spalten anpassen.
       verteilePorts() reiht jede Kastenseite nach der Querlage der ERSTEN
       Stützspalte — lief im rechtwinkligen Zweig aber nur ganz am Anfang,
       vor dem Geraderücken und vor dem Kappen. Passte die Reihung danach
       nicht mehr zu den Spalten, kreuzten sich zwei Kanten gleich unter dem
       Kasten und ein zweites Mal weiter unten, wo die Spalten sich wieder
       trafen. Gemeldeter Fall: Besteckkasten→Dosenöffner saß auf t=0.20 und
       damit links von Besteckkasten→Spülbürste (t=0.30), seine Spalte lag
       mit -367 aber rechts von deren -390.

       Die weiche Führung sortiert aus demselben Grund nach; der
       rechtwinkligen fehlte es. */
    verteilePorts();
  }

  /* Weiche Führung (hierarchisch): lange Kanten wirken natürlicher, wenn ihre
     Stützspalten der Luftlinie zwischen den Anschlüssen folgen, statt im
     Median-Kanal zu pendeln. Der Pendelzug — quer zum Kanal, senkrecht
     hindurch, wieder quer — liest sich rechtwinklig als Führung; weich
     verschliffen holt die Kurve aber weit aus und wirkt wie ein Kreis um die
     Kästen. Je Ebene wird die Spalte auf die Interpolation zwischen den
     Anschlüssen gezogen, mit denselben Prüfungen wie beim Geraderücken:
     nur wenn die Ebene dort frei ist und keine neuen Kreuzungen entstehen. */
  /* Schneidet die Strecke a–b das Rechteck r? Wird von der Rücknahmeprüfung der
     Interpolation UND von der Härtung darunter gebraucht — darum hier oben. */
  const schneidet = (a, b, r)=>{
    if(Math.max(a.x,b.x) < r.x || Math.min(a.x,b.x) > r.x+r.w
    || Math.max(a.y,b.y) < r.y || Math.min(a.y,b.y) > r.y+r.h) return false;
    const cr = (p,q,s)=> (s.y-p.y)*(q.x-p.x) - (q.y-p.y)*(s.x-p.x);
    const drin = p => p.x > r.x && p.x < r.x+r.w && p.y > r.y && p.y < r.y+r.h;
    if(drin(a) || drin(b)) return true;
    const ecken = [{x:r.x,y:r.y},{x:r.x+r.w,y:r.y},{x:r.x+r.w,y:r.y+r.h},{x:r.x,y:r.y+r.h}];
    for(let i=0;i<4;i++){
      const c = ecken[i], d = ecken[(i+1)%4];
      if(((cr(a,b,c)>0)!==(cr(a,b,d)>0)) && ((cr(c,d,a)>0)!==(cr(c,d,b)>0))) return true;
    }
    return false;
  };
  // Fremde Kästen, durch die der aktuelle Zug einer Kante schneidet
  const schnitteVon = e=>{
    const P = polyOf(e); if(!P) return 0;
    let s = 0;
    for(const n of nodes){
      if(n.id === e.from || n.id === e.to) continue;
      for(let i=0;i<P.length-1;i++) if(schneidet(P[i], P[i+1], n)){ s++; break; }
    }
    return s;
  };

  let interpoliereWeich = null;
  if(!ortho){
    /* Eine Kante auf die Luftlinie führen. Gibt {alt, warSchlecht, vorher}
       für die Rücknahme-Heuristik des Erstlaufs zurück (der Anschluss-Tausch
       weiter unten führt ohne sie — dort wacht die Gesamtbewertung). */
    const interpoliere = (e, seiteZwang)=>{
      const info = chain.get(e);
      if(!info || !info.ds.length) return null;
      const A = nodeOf.get(e.from), B = nodeOf.get(e.to);
      if(!A || !B) return null;
      const cOf = (n, port)=> vertical
        ? n.x + n.w * (port ? port.t : 0.5)
        : n.y + n.h * (port ? port.t : 0.5);
      const mOf = n => vertical ? n.y + n.h/2 : n.x + n.w/2;
      const ca = cOf(A, e.portFrom), cb = cOf(B, e.portTo);
      const ma = mOf(A), mb = mOf(B);
      if(Math.abs(mb - ma) < 1) return null;
      const vorher = kreuzungen(e);
      const vorherSchnitte = schnitteVon(e);
      const alt = info.ds.map(d => d.c);
      // Zwei Zugformen wiegen schwerer als eine Kreuzung mehr und werden darum
      // nie aus Kreuzungsgründen behalten: der Kringel (eine Spalte AUSSERHALB
      // des Anschluss-Intervalls — die Kante fährt erst vom Ziel weg) und das
      // Zickzack (die Querrichtung wechselt unterwegs — die Kante pendelt hin
      // und zurück, nur weil daneben Platz ist).
      const lo = Math.min(ca, cb) - 10, hi = Math.max(ca, cb) + 10;
      const zickzack = list=>{
        const f = [ca, ...list, cb];
        let dir = 0;
        for(let i=1;i<f.length;i++){
          const d = f[i] - f[i-1];
          if(Math.abs(d) < 24) continue;             // kleine Versätze zählen nicht
          const s = Math.sign(d);
          if(dir && s !== dir) return true;
          dir = s;
        }
        return false;
      };
      const warSchlecht = zickzack(alt) || info.ds.some(d => d.c < lo || d.c > hi);
      // Wunschlage auf der Luftlinie; ist sie durch Kästen belegt, wird sie an
      // den Rand der (zusammengelegten) Verbotszone geschoben — nicht zurück auf
      // eine Anschlusslage, das baute selbst ein Zickzack. Und: einmal gewählte
      // Ausweichseite beibehalten, sonst pendelt die Kante bei mehreren vollen
      // Ebenen zwischen links und rechts.
      let seite = seiteZwang || 0;
      const ausweich = (lay, wunsch)=>{
        let zLo = wunsch, zHi = wunsch, drin = true, guard = 0;
        while(drin && guard++ < 6){
          drin = false;
          for(const it of rows[lay]){
            if(it.dummy) continue;
            const half = cs(it)/2 + SIB * 0.3;
            if(zHi > it.c - half && zLo < it.c + half && (it.c - half < zLo || it.c + half > zHi)){
              zLo = Math.min(zLo, it.c - half);
              zHi = Math.max(zHi, it.c + half);
              drin = true;
            }
          }
        }
        if(zLo === wunsch && zHi === wunsch) return wunsch;   // frei
        if(!seite) seite = (wunsch - zLo <= zHi - wunsch) ? -1 : 1;
        return seite < 0 ? zLo : zHi;
      };
      // Sequenziell interpolieren: die Bezugslinie läuft vom zuletzt gesetzten
      // Punkt zum Ziel, nicht stur von Anschluss zu Anschluss. Nach einem
      // Ausweichen (Kasten im Weg) zielt der Rest damit direkt aufs Ziel —
      // sonst knickt die Kante an der nächsten Ebene zurück zur alten
      // Luftlinie, obwohl sie gerade weiterlaufen könnte.
      let refC = ca, refM = ma;
      info.ds.forEach(d=>{
        const ziel = refC + (cb - refC) * ((mainOf[d.lay] - refM) / (mb - refM));
        d.c = ausweich(d.lay, ziel);
        refC = d.c; refM = mainOf[d.lay];
      });
      e.bends = bendsOf(info);
      return {info, alt, warSchlecht, vorher, vorherSchnitte, seite};
    };
    /* Musste die Kante ausweichen, wird auch die GEGENSEITE durchgerechnet
       und die kreuzungsärmere behalten. Die nähere Seite ist sonst oft die
       falsche: läuft die Luftlinie durch einen Kasten, hinter dem das Ziel
       einer Geschwisterkante liegt, legt das nahe Ausweichen den Zug genau
       über diese Kante — ein Doppel-X, das kein Anschluss-Tausch mehr löst. */
    const fuehreBeste = e=>{
      const r = interpoliere(e);
      if(!r || !r.seite) return r;
      const zugA = {bends: e.bends ? e.bends.map(p=>({x:p.x, y:p.y})) : null,
                    cs: r.info.ds.map(d=>d.c)};
      const kA = kreuzungen(e);
      interpoliere(e, -r.seite);
      if(kA <= kreuzungen(e)){                    // Gegenseite nicht besser: zurück
        e.bends = zugA.bends;
        r.info.ds.forEach((d,k)=>{ d.c = zugA.cs[k]; });
      }
      return r;
    };
    edges.forEach(e=>{
      const r = fuehreBeste(e);
      /* Zwei Gründe zur Rücknahme. Der erste ist alt: die Luftlinie kreuzt
         mehr als der Median-Kanal — das gilt nur für Kanten, deren alter Zug
         in Ordnung war (ein Kringel oder Zickzack wiegt schwerer als eine
         Kreuzung mehr, siehe warSchlecht).

         Der zweite ist neu und gilt IMMER: die Luftlinie schneidet durch mehr
         fremde Kästen als vorher. ausweich() prüft nur die Ebene der Spalte
         selbst — die Schräge dorthin kann am Bandrand trotzdem in einen
         Nachbarkasten laufen. Dafür gibt es die Härtung, aber die kauft jeden
         Schnitt mit Kreuzungen zurück. In einem dichten Modell verdoppelte die
         Interpolation so die Schnitte (13 auf 28) und die Härtung legte 51
         Kreuzungen drauf, um sie wieder loszuwerden. Ein Zug, der neu durch
         Kästen schneidet, ist kein guter Zug — auch nicht für eine Kante,
         deren alter Zug schlecht aussah. */
      if(r && (schnitteVon(e) > r.vorherSchnitte
            || (!r.warSchlecht && kreuzungen(e) > r.vorher))){
        r.info.ds.forEach((d,k)=>{ d.c = r.alt[k]; });
        e.bends = bendsOf(r.info);
      }
    });
    interpoliereWeich = fuehreBeste;       // für Härtung und Anschluss-Tausch darunter
  }

  /* Weiche Diagonalen dürfen fremde Kästen nicht schneiden: die Spalte d.c ist
     zwar frei, aber die Schräge erreicht sie erst in Bandmitte und kann am
     Bandrand noch durch einen Nachbarkasten laufen. Wo das passiert, wird die
     Querung des betroffenen Bandes wieder senkrecht (das Punktepaar an den
     Bandgrenzen) — die Schräge bleibt auf die kastenfreien Kanäle beschränkt.
     Nur lokal: kollisionsfreie Kanten behalten ihre gerade Diagonale. */
  if(!ortho){
    const layOf = new Map(items.map(it => [it.n, it.lay]));
    const schneidet = (a, b, r)=>{
      if(Math.max(a.x,b.x) < r.x || Math.min(a.x,b.x) > r.x+r.w
      || Math.max(a.y,b.y) < r.y || Math.min(a.y,b.y) > r.y+r.h) return false;
      const cr = (p,q,s)=> (s.y-p.y)*(q.x-p.x) - (q.y-p.y)*(s.x-p.x);
      const drin = p => p.x > r.x && p.x < r.x+r.w && p.y > r.y && p.y < r.y+r.h;
      if(drin(a) || drin(b)) return true;
      const ecken = [{x:r.x,y:r.y},{x:r.x+r.w,y:r.y},{x:r.x+r.w,y:r.y+r.h},{x:r.x,y:r.y+r.h}];
      for(let i=0;i<4;i++){
        const c = ecken[i], d = ecken[(i+1)%4];
        if(((cr(a,b,c)>0)!==(cr(a,b,d)>0)) && ((cr(c,d,a)>0)!==(cr(c,d,b)>0))) return true;
      }
      return false;
    };
    const bendsMix = (info, hart)=> info.ds.flatMap((d,i)=> hart.has(i)
      ? ((info.rev !== flip) ? [ptAt(d.c, chanAfter(d.lay)), ptAt(d.c, chanBefore(d.lay))]
                             : [ptAt(d.c, chanBefore(d.lay)), ptAt(d.c, chanAfter(d.lay))])
      : [ptAt(d.c, mainOf[d.lay])]);
    const haerte = e=>{
      const info = chain.get(e);
      if(!info || !info.ds.length || !e.portFrom) return;
      const A = nodeOf.get(e.from), B = nodeOf.get(e.to);
      if(!A || !B) return;
      const hart = new Set();
      for(let runde = 0; runde <= info.ds.length; runde++){
        const pts = [portPoint(A, e.portFrom), ...bendsMix(info, hart), portPoint(B, e.portTo)];
        let neu = false;
        for(const n of nodes){
          if(n.id === e.from || n.id === e.to) continue;
          for(let i=0;i<pts.length-1;i++){
            if(!schneidet(pts[i], pts[i+1], n)) continue;
            const k = info.ds.findIndex(d => d.lay === layOf.get(n));
            if(k >= 0 && !hart.has(k)){ hart.add(k); neu = true; }
          }
        }
        if(!neu) break;
      }
      if(hart.size) e.bends = bendsMix(info, hart);
    };
    edges.forEach(haerte);

    /* Anschluss-Reihenfolge an die endgültige Führung anpassen: die erste
       Verteilung lief, BEVOR Luftlinie, Ausweichen und Härtung die
       Stützspalten verschoben haben. Kanten derselben Kastenseite kreuzten
       sich danach direkt am Kasten, nur weil ihre Reihung noch dem alten
       Stand entsprach — mit den finalen Zügen neu sortiert verschwindet das. */
    verteilePorts();

    /* Kreuzungsbewusster Anschluss-Tausch, wie ihn orthogonalize für die
       rechtwinklige Führung fährt: Nachbarn derselben Kastenseite probeweise
       tauschen — und die beiden Kanten dabei NEU FÜHREN (Luftlinie + Härtung
       zu den getauschten Anschlüssen), sonst zeigt der alte Zug weiter auf
       die alte Portlage und der Tausch verlagert die Kreuzung nur. Behalten
       wird, was die gezeichneten Züge seltener kreuzen lässt, ohne neu durch
       Kästen zu laufen (Schnitte zählen dreifach). */
    if(edges.length <= 200){
      const score = ()=>{
        const segsL = [];
        edges.forEach(e2=>{
          const P = polyOf(e2); if(!P) return;
          for(let i=0;i<P.length-1;i++) segsL.push({e:e2, a:P[i], b:P[i+1]});
        });
        const schnittpunkt = (a,b,c,d)=>{
          const rx = b.x-a.x, ry = b.y-a.y, sx = d.x-c.x, sy = d.y-c.y;
          const den = rx*sy - ry*sx;
          if(!den) return null;
          const t = ((c.x-a.x)*sy - (c.y-a.y)*sx) / den;
          return {x:a.x + rx*t, y:a.y + ry*t};
        };
        let s = 0;
        for(let i=0;i<segsL.length;i++) for(let j=i+1;j<segsL.length;j++){
          const e1 = segsL[i].e, e2 = segsL[j].e;
          if(e1 === e2) continue;
          if(segCross(segsL[i].a, segsL[i].b, segsL[j].a, segsL[j].b)){
            // Der ORT entscheidet mit: kreuzen sich zwei Kanten mit
            // gemeinsamem Endknoten direkt vor diesem Kasten, ist das das
            // auffällige X am Anschluss — fast immer durch die Reihung
            // vermeidbar und darum teuer. Dieselbe Kreuzung weit draußen
            // stört kaum mehr als jede andere.
            const gem = e1.from === e2.from || e1.from === e2.to ? e1.from
                      : e1.to === e2.from  || e1.to === e2.to    ? e1.to : null;
            if(!gem){ s += 1; continue; }
            const n0 = nodeOf.get(gem);
            const pt = schnittpunkt(segsL[i].a, segsL[i].b, segsL[j].a, segsL[j].b);
            const dist = (n0 && pt) ? Math.hypot(pt.x - (n0.x + n0.w/2), pt.y - (n0.y + n0.h/2)) : 1e9;
            s += dist < 140 ? 6 : 2;
          }
        }
        edges.forEach(e2=>{
          const P = polyOf(e2); if(!P) return;
          for(const n of nodes){
            if(n.id === e2.from || n.id === e2.to) continue;
            for(let i=0;i<P.length-1;i++)
              if(schneidet(P[i], P[i+1], n)){ s += 8; break; }
          }
        });
        return s;
      };
      const swapT = (a, b)=>{
        const tt = a.e[a.which].t; a.e[a.which].t = b.e[b.which].t; b.e[b.which].t = tt;
      };
      const merken = list => list.map(e2=>{
        const info = chain.get(e2);
        return {e:e2, bends: e2.bends ? e2.bends.map(p=>({x:p.x, y:p.y})) : null,
                cs: info ? info.ds.map(d=>d.c) : []};
      });
      // Zu welcher Kante ein Stützpunkt gehört — für den Spaltenversatz unten.
      const kanteVon = new Map();
      for(const [e2, info] of chain) info.ds.forEach(d => kanteVon.set(d, e2));

      const zurueck = snap => snap.forEach(s2=>{
        s2.e.bends = s2.bends;
        const info = chain.get(s2.e);
        if(info) info.ds.forEach((d,k)=>{ d.c = s2.cs[k]; });
      });
      let best = score();
      for(let pass=0; pass<4 && best>0; pass++){
        let besser = false;
        for(const grp of ports.values()){
          for(let p=0; p<grp.length-1; p++) for(let q=p+1; q<grp.length; q++){
            const beide = grp[p].e === grp[q].e ? [grp[p].e] : [grp[p].e, grp[q].e];
            const snap = merken(beide);
            swapT(grp[p], grp[q]);
            // Zwei Varianten: Züge behalten (oft löst der Tausch die Kreuzung
            // am Kasten, und die alten Züge passen weiter) oder neu führen
            // (wenn die Züge zur neuen Anschlusslage umziehen müssen). Die
            // bessere gewinnt — gegen den Stand ohne Tausch.
            const sBehalten = score();
            beide.forEach(e2=>{ interpoliereWeich(e2); haerte(e2); });
            const sNeu = score();
            if(sBehalten < best && sBehalten <= sNeu){
              best = sBehalten; besser = true;
              zurueck(snap);                       // Neuführung verwerfen, Tausch bleibt
            } else if(sNeu < best){
              best = sNeu; besser = true;          // Tausch samt Neuführung bleibt
            } else {
              swapT(grp[p], grp[q]); zurueck(snap);
            }
          }
        }
        /* Spaltenversatz — das Gegenstück zum Spur-Versatz der rechtwinkligen
           Führung. Dort bekommt jeder Querlauf eines Kanals ein eigenes `off`
           und die Vergabe wird gegen die GEZEICHNETEN Züge optimiert. Die
           weiche Führung hatte dafür kein Gegenstück: sie stellte ihre
           Anschlüsse zur Wahl, aber nie ihre Stützspalten. Die standen starr
           auf der Luftlinie — und die weiß nichts von den kurzen Kanten, über
           die eine lange Diagonale streicht, während sie ein Band durchquert.
           Genau dort lagen die Kreuzungen: fast jede paarte eine lange Kante
           gegen eine kurze.

           Nicht die Reihenfolge der Spalten ist der Hebel, sondern ihre Lage.
           Beide Tauschformen — eine Spalte mit ihrer Nachbarin, und zwei
           Kanten über alle gemeinsamen Ebenen — wurden gemessen und von der
           Note in 117 von 117 Fällen abgelehnt: die Ordnungssuche hatte die
           Reihung bereits gut gewählt. Der Versatz innerhalb des freien
           Spielraums dagegen nimmt an. */
        for(let li=0; li<L; li++){
          const reihe = rows[li].slice().sort((x,y)=> x.c - y.c);
          for(let p=0; p<reihe.length; p++){
            const d = reihe[p];
            if(!d.dummy) continue;
            const e2 = kanteVon.get(d);
            if(!e2) continue;
            // Freier Spielraum bis zu den Nachbarn der Ebene — Kästen wie
            // Stützpunkte. Innerhalb davon darf die Spalte wandern.
            const links = p > 0 ? reihe[p-1] : null, rechts = p < reihe.length-1 ? reihe[p+1] : null;
            const lo = links  ? links.c  + cs(links)/2  + gap(links, d)  + cs(d)/2 : d.c - LAY;
            const hi = rechts ? rechts.c - cs(rechts)/2 - gap(d, rechts) - cs(d)/2 : d.c + LAY;
            if(hi - lo < 2) continue;
            const snap = merken([e2]);
            let besteC = d.c, besteS = best;
            for(const c of [lo, hi, (lo + hi) / 2]){
              if(Math.abs(c - d.c) < 1) continue;
              d.c = c;
              e2.bends = bendsOf(chain.get(e2));
              haerte(e2);
              const s2 = score();
              if(s2 < besteS){ besteS = s2; besteC = c; }
              zurueck(snap);
            }
            if(besteS < best){
              d.c = besteC;
              e2.bends = bendsOf(chain.get(e2));
              haerte(e2);
              best = besteS; besser = true;
            }
          }
        }
        /* Anschlusslagen an die endgültige Zugrichtung rücken. verteilePorts()
           REIHT die Kanten einer Kastenseite richtig, verteilt sie dann aber
           GLEICHMÄSSIG über die Spanne. Eine Kante, die weit zur Seite zieht,
           bekommt damit nicht den äußeren Rand, sondern ihren Rasterplatz —
           und knickt gleich hinter dem Anschluss ab. Hier bekommt jede Kante
           ihre Wunschlage (dorthin, wo ihr Zug hinführt), monoton mit
           Mindestabstand in die Spanne projiziert: dasselbe Vor- und
           Rückwärtsschieben wie in tidy(). Die Reihung bleibt dabei erhalten,
           nur die Abstände folgen den Zielen. */
        for(const grp of ports.values()){
          if(grp.length < 2) continue;
          const port = ref => ref.e[ref.which];
          // Nach der AKTUELLEN Lage sortieren, nicht nach der Listenreihenfolge:
          // swapT() tauscht die t-Werte, ordnet die Liste aber nicht um. Die
          // Projektion würde sonst die alte Reihung erzwingen und damit genau
          // die Tausche zurücknehmen, die die Suche eben erst gefunden hat.
          const list = grp.slice().sort((a,b)=> port(a).t - port(b).t);
          const alt = list.map(ref => port(ref).t);
          const knoten = ref => nodeOf.get(ref.which === 'portFrom' ? ref.e.from : ref.e.to);
          const span = Math.min(0.84, Math.max(0.36, (list.length - 1) * 0.1));
          const lo = 0.5 - span/2, hi = 0.5 + span/2;
          const sep = Math.min(0.12, span / (list.length - 1));
          const wunsch = list.map(ref=>{
            const n0 = knoten(ref);
            if(!n0) return 0.5;
            const z = crossOf(ref);                       // wohin der Zug läuft
            const t = vertical ? (z - n0.x) / n0.w : (z - n0.y) / n0.h;
            return Math.min(hi, Math.max(lo, t));
          });
          const t = wunsch.slice();
          for(let i=1;i<t.length;i++) if(t[i] < t[i-1] + sep) t[i] = t[i-1] + sep;
          for(let i=t.length-2;i>=0;i--) if(t[i] > t[i+1] - sep) t[i] = t[i+1] - sep;
          if(t[0] < lo){ const d = lo - t[0]; t.forEach((_,i)=> t[i] += d); }
          list.forEach((ref,i)=>{ port(ref).t = Math.min(hi, Math.max(lo, t[i])); });
          // Gleichstand genügt: kostet die Wunschlage keine Kreuzung, ist sie
          // die bessere — sie nimmt den Knick gleich hinter dem Anschluss.
          // Fortgefahren wird aber nur bei echter Verbesserung, sonst liefe
          // die Schleife endlos.
          const s2 = score();
          if(s2 <= best){ if(s2 < best) besser = true; best = s2; }
          else list.forEach((ref,i)=>{ port(ref).t = alt[i]; });
        }
        if(!besser) break;
      }
    }
  }

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
  const chanOrders = [];                      // je Kanal: Spur-Reihenfolge (für die Nachbesserung)
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
    const apply = ()=> order.forEach((idx, pos)=>{ list[idx].off = (pos - (K-1)/2) * step; });
    apply();
    chanOrders.push({list, order, apply});
  }

  /* Der fertige Zug einer Kante bei den aktuellen Spur-Offsets: Anschlusspunkt,
     Kanalpunkte, Anschlusspunkt — bereinigt um Rückläufe und kollineare Punkte
     (sonst Haken an den Ecken). Dient der Bewertung und dem Rückschreiben. */
  const pathOf = ({pts, steps})=>{
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
    return dropCollinear([pts[0], ...res, pts[pts.length-1]]);
  };

  /* Kreuzungsbewusste Spurvergabe: die Zwangsbedingungen legen nur fest, was
     übereinander liegen MUSS — wo sie Spielraum lassen, werden benachbarte
     Spuren probeweise getauscht und der Tausch behalten, wenn die tatsächlich
     gezeichneten Züge dadurch seltener kreuzen. Deterministisch, endet spätestens
     nach vier Runden ohne Verbesserung. */
  const planList = [...plans.values()];
  const zaehlKreuzungen = ()=>{
    const segs = [];
    planList.forEach((p, ei)=>{
      const pts = pathOf(p);
      for(let i=0;i<pts.length-1;i++) segs.push({ei, a:pts[i], b:pts[i+1]});
    });
    const ccw = (p,q,r)=> (r.y-p.y)*(q.x-p.x) - (q.y-p.y)*(r.x-p.x);
    let n = 0;
    for(let i=0;i<segs.length;i++) for(let j=i+1;j<segs.length;j++){
      const s = segs[i], u = segs[j];
      if(s.ei === u.ei) continue;
      const d1=ccw(u.a,u.b,s.a), d2=ccw(u.a,u.b,s.b), d3=ccw(s.a,s.b,u.a), d4=ccw(s.a,s.b,u.b);
      if(((d1>0)!==(d2>0)) && ((d3>0)!==(d4>0))) n++;
    }
    return n;
  };
  /* Tausch-Züge für Anschlusspunkte: Kanten, die dieselbe Knotenseite nutzen,
     kreuzen sich sofort am Kasten, wenn ihre Reihenfolge nicht zur Lage der
     Gegenseiten passt (die Verteilung entstand vor dem Geraderücken der langen
     Kanten und kann veraltet sein). Nachbarn probeweise tauschen. */
  const portGroups = new Map();
  for(const e of plans.keys()){
    const reg = (id, which)=>{
      if(!e[which]) return;
      const k = id + '|' + e[which].side;
      if(!portGroups.has(k)) portGroups.set(k, []);
      portGroups.get(k).push({e, which});
    };
    reg(e.from, 'portFrom'); reg(e.to, 'portTo');
  }
  const refreshEnd = r=>{
    const plan = plans.get(r.e);
    const n = nodeOf.get(r.which === 'portFrom' ? r.e.from : r.e.to);
    const p = portPoint(n, r.e[r.which]);
    if(r.which === 'portFrom') plan.pts[0] = p; else plan.pts[plan.pts.length-1] = p;
  };
  const swapT = (a, b)=>{
    const t = a.e[a.which].t; a.e[a.which].t = b.e[b.which].t; b.e[b.which].t = t;
    refreshEnd(a); refreshEnd(b);
  };
  portGroups.forEach(grp => grp.sort((x, y)=> x.e[x.which].t - y.e[y.which].t));

  if((chanOrders.length || portGroups.size) && planList.length <= 200){   // Größen-Schutz: O(Segmente²) je Bewertung
    let best = zaehlKreuzungen();
    for(let pass=0; pass<4 && best>0; pass++){
      let besser = false;
      for(const ch of chanOrders){
        for(let p=0; p<ch.order.length-1; p++) for(let q=p+1; q<ch.order.length; q++){
          const a = ch.order[p]; ch.order[p] = ch.order[q]; ch.order[q] = a;
          ch.apply();
          const c = zaehlKreuzungen();
          if(c < best){ best = c; besser = true; }
          else { const b = ch.order[p]; ch.order[p] = ch.order[q]; ch.order[q] = b; ch.apply(); }
        }
      }
      for(const grp of portGroups.values()){
        for(let p=0; p<grp.length-1; p++) for(let q=p+1; q<grp.length; q++){
          swapT(grp[p], grp[q]);
          const c = zaehlKreuzungen();
          if(c < best){ best = c; besser = true; const t2 = grp[p]; grp[p] = grp[q]; grp[q] = t2; }
          else swapT(grp[p], grp[q]);   // zurück
        }
      }
      if(!besser) break;
    }
  }

  for(const [e, plan] of plans){
    const clean = pathOf(plan);
    e.bends = clean.length > 2 ? clean.slice(1, -1) : null;
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

