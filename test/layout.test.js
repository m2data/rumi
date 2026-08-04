/* Layoutprüfung: Anordnungsverfahren, Kreuzungen, verdeckte Knoten, Überdeckung.
   Ohne DOM — yaml.js + model.js + layout.js. Rechnet auf dem Graphen, den auch
   die App anordnet. */
const fs = require('fs');
const path = require('path');
const {load} = require('./harness');

let fail = 0, pass = 0;
const t = (name, cond, info)=>{
  if(cond){ pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FEHL ' + name + (info ? '  → ' + info : '')); }
};

// render.js kommt dazu: das orthogonale Verfahren nutzt portPoint() daraus.
const {api} = load(['yaml.js', 'model.js', 'layout.js', 'render.js'],
  ['buildModel', 'makeGraph', 'ALGOS', 'separate', 'portPoint']);
const {buildModel, makeGraph, ALGOS, separate, portPoint} = api;

const center = n => ({x: n.x + n.w/2, y: n.y + n.h/2});
const finite = n => Number.isFinite(n.x) && Number.isFinite(n.y);
const overlaps = (A, B)=> A.x < B.x + B.w && B.x < A.x + A.w && A.y < B.y + B.h && B.y < A.y + A.h;

/* Kreuzt sich Strecke AB mit Strecke CD? Endpunkte, die einen Knoten teilen,
   zählen nicht als Kreuzung. */
function crossings(nodes, edges){
  const by = new Map(nodes.map(n => [n.id, center(n)]));
  const segs = edges.map(e => ({a: by.get(e.from), b: by.get(e.to), from: e.from, to: e.to}))
                    .filter(s => s.a && s.b);
  const ccw = (p, q, r)=> (r.y - p.y) * (q.x - p.x) - (q.y - p.y) * (r.x - p.x);
  let n = 0;
  for(let i = 0; i < segs.length; i++) for(let j = i + 1; j < segs.length; j++){
    const s = segs[i], u = segs[j];
    if([s.from, s.to].some(id => id === u.from || id === u.to)) continue;   // teilen einen Knoten
    const d1 = ccw(u.a, u.b, s.a), d2 = ccw(u.a, u.b, s.b);
    const d3 = ccw(s.a, s.b, u.a), d4 = ccw(s.a, s.b, u.b);
    if(((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0))) n++;
  }
  return n;
}

const real = fs.readFileSync(path.join(__dirname, '..', 'models', 'willibald-attr.yaml'), 'utf8');
const model = buildModel(real);

console.log('== Graph aus dem Modell ==');
const g0 = makeGraph(model, 1);
t('Knoten je Geschäftsobjekt', g0.nodes.length === 11, g0.nodes.length + ' Knoten');
t('Kanten aus Beziehungen', g0.edges.length > 0, g0.edges.length + ' Kanten');

console.log('== Alle vier Verfahren liefern brauchbare Koordinaten ==');
for(const k of Object.keys(ALGOS)){
  const g = makeGraph(model, 1);
  ALGOS[k].fn(g.nodes, g.edges, 'TB');
  t(`${ALGOS[k].name}: endliche Koordinaten`, g.nodes.every(finite));
  t(`${ALGOS[k].name}: positive Kastengrößen`, g.nodes.every(n => n.w > 0 && n.h > 0));
}

console.log('== Überdeckung: separate() trennt Kästen ==');
{
  const g = makeGraph(model, 1);
  ALGOS.org.fn(g.nodes, g.edges);                 // organisch überlappt gern
  separate(g.nodes);
  let bad = 0;
  for(let i = 0; i < g.nodes.length; i++) for(let j = i + 1; j < g.nodes.length; j++)
    if(overlaps(g.nodes[i], g.nodes[j])) bad++;
  t('kein Kastenpaar überlappt nach separate()', bad === 0, bad + ' Überlappungen');
}

console.log('== Verdeckte Knoten: keine zwei am selben Punkt ==');
for(const k of Object.keys(ALGOS)){
  const g = makeGraph(model, 1);
  ALGOS[k].fn(g.nodes, g.edges, 'TB');
  separate(g.nodes);
  const spots = new Set(g.nodes.map(n => Math.round(n.x) + ',' + Math.round(n.y)));
  t(`${ALGOS[k].name}: alle Knoten sichtbar getrennt`, spots.size === g.nodes.length,
    spots.size + ' von ' + g.nodes.length);
}

console.log('== Kreuzungen ==');
const chain = buildModel(`BusinessObjects:
  A:
    relationships:
    - to: B
  B:
    relationships:
    - to: C
  C:
    relationships:
    - to: D
  D:
    Domain: x
`);
{
  const g = makeGraph(chain, 1);
  ALGOS.hier.fn(g.nodes, g.edges, 'TB');
  t('Kette hierarchisch: kreuzungsfrei', crossings(g.nodes, g.edges) === 0);
  const y = id => g.byId.get(id).y;
  t('Kette hierarchisch: Ränge laufen abwärts',
    y('o:A') < y('o:B') && y('o:B') < y('o:C') && y('o:C') < y('o:D'),
    [y('o:A'), y('o:B'), y('o:C'), y('o:D')].join(' < '));
}
{
  const gh = makeGraph(model, 1); ALGOS.hier.fn(gh.nodes, gh.edges, 'TB');
  const gc = makeGraph(model, 1); ALGOS.circ.fn(gc.nodes, gc.edges);
  const ch = crossings(gh.nodes, gh.edges), cc = crossings(gc.nodes, gc.edges);
  t('Modell: hierarchisch kreuzt nicht mehr als kreisförmig', ch <= cc, `hier ${ch}, circ ${cc}`);
}

console.log('== 1:n-Richtung wird eingehalten ==');
{
  // Beziehung „verkehrt herum" notiert: from=Kind ist die n-Seite (viele),
  // to=Eltern die 1-Seite. Trotzdem muss Eltern (1) oben stehen (TB).
  const m = buildModel(`BusinessObjects:
  Kind:
    relationships:
    - to: Eltern
      cardinality:
        from: zero_or_many
        to: exactly_one
  Eltern:
    Domain: x
`);
  const g = makeGraph(m, 1);
  ALGOS.hier.fn(g.nodes, g.edges, 'TB');
  const E = g.byId.get('o:Eltern'), K = g.byId.get('o:Kind');
  t('1-Seite oben, n-Seite unten (TB) trotz verkehrter Notation',
    E.y + E.h <= K.y, `Eltern y=${E.y}, Kind y=${K.y}`);
}

console.log('== 1:1 steht nebeneinander ==');
const beside = (A, B) =>                             // B rechts neben A, senkrecht überlappend
  B.x >= A.x + A.w - 1 && B.y < A.y + A.h && B.y + B.h > A.y;
{
  // Haupt hat ein 1:n-Kind (bleibt unten) und ein 1:1-Detail (soll daneben).
  const m = buildModel(`BusinessObjects:
  Haupt:
    relationships:
    - to: Kind
      cardinality:
        from: exactly_one
        to: zero_or_many
    - to: Detail
      cardinality:
        from: exactly_one
        to: exactly_one
  Kind:
    Domain: x
  Detail:
    Domain: x
`);
  const g = makeGraph(m, 1);
  ALGOS.hier.fn(g.nodes, g.edges, 'TB');
  const H = g.byId.get('o:Haupt'), D = g.byId.get('o:Detail'), K = g.byId.get('o:Kind');
  t('1:1-Detail steht neben dem Hauptobjekt', beside(H, D),
    `Haupt(${H.x},${H.y},${H.w}), Detail(${D.x},${D.y})`);
  t('1:n-Kind bleibt darunter', K.y >= H.y + H.h, `Haupt y=${H.y}, Kind y=${K.y}`);
}
{
  // reines 1:1-Paar: die beiden nur miteinander verbunden -> nebeneinander
  const m = buildModel(`BusinessObjects:
  Aaa:
    relationships:
    - to: Bbb
      cardinality:
        from: exactly_one
        to: exactly_one
  Bbb:
    Domain: x
`);
  const g = makeGraph(m, 1);
  ALGOS.hier.fn(g.nodes, g.edges, 'TB');
  const A = g.byId.get('o:Aaa'), B = g.byId.get('o:Bbb');
  t('reines 1:1-Paar steht nebeneinander', beside(A, B) || beside(B, A),
    `Aaa(${A.x},${A.y}), Bbb(${B.x},${B.y})`);
}

console.log('== Einzelnes to-many-Kind steht genau unter dem Elternteil ==');
{
  // Kette, jedes Objekt hat genau ein 1:n-Kind -> alle senkrecht in einer Linie.
  const m = buildModel(`BusinessObjects:
  Kopf:
    relationships:
    - to: Rumpf
      cardinality:
        from: exactly_one
        to: zero_or_many
  Rumpf:
    relationships:
    - to: Fuss
      cardinality:
        from: exactly_one
        to: zero_or_many
  Fuss:
    Domain: x
`);
  const g = makeGraph(m, 1);
  ALGOS.hier.fn(g.nodes, g.edges, 'TB');
  const cx = id => { const n = g.byId.get(id); return n.x + n.w/2; };
  t('Kette 1:n: Kind genau unter Elternteil (senkrecht ausgerichtet)',
    Math.abs(cx('o:Kopf') - cx('o:Rumpf')) <= 1 && Math.abs(cx('o:Rumpf') - cx('o:Fuss')) <= 1,
    [cx('o:Kopf'), cx('o:Rumpf'), cx('o:Fuss')].map(v=>Math.round(v)).join(' , '));
}
{
  // Zwei to-many-Kinder: das Elternteil steht mittig, die Kinder daneben verteilt
  // (nicht beide senkrecht unter dem Elternteil).
  const m = buildModel(`BusinessObjects:
  Haupt:
    relationships:
    - to: LinksKind
      cardinality:
        from: exactly_one
        to: zero_or_many
    - to: RechtsKind
      cardinality:
        from: exactly_one
        to: zero_or_many
  LinksKind:
    Domain: x
  RechtsKind:
    Domain: x
`);
  const g = makeGraph(m, 1);
  ALGOS.hier.fn(g.nodes, g.edges, 'TB');
  const cx = id => { const n = g.byId.get(id); return n.x + n.w/2; };
  t('Zwei Kinder werden verteilt (nicht beide unter dem Elternteil)',
    Math.abs(cx('o:LinksKind') - cx('o:RechtsKind')) > 1,
    `links=${Math.round(cx('o:LinksKind'))}, rechts=${Math.round(cx('o:RechtsKind'))}`);
}

console.log('== Zusammenlaufender Baum bleibt zentriert (keine Seitendrift) ==');
{
  // Vier Eltern auf ein Kind, darunter eine Kette. Der untere Teil soll mittig
  // unter der breiten Elternreihe bleiben und das Diagramm nicht verbreitern —
  // früher rutschte er zur Seite (lange, schräge Kanten).
  const m = buildModel(`BusinessObjects:
  P1:
    relationships:
    - to: Hub
      cardinality:
        from: exactly_one
        to: zero_or_many
  P2:
    relationships:
    - to: Hub
      cardinality:
        from: exactly_one
        to: zero_or_many
  P3:
    relationships:
    - to: Hub
      cardinality:
        from: exactly_one
        to: zero_or_many
  P4:
    relationships:
    - to: Hub
      cardinality:
        from: exactly_one
        to: zero_or_many
  Hub:
    relationships:
    - to: Tail1
      cardinality:
        from: exactly_one
        to: zero_or_many
  Tail1:
    relationships:
    - to: Tail2
      cardinality:
        from: exactly_one
        to: zero_or_many
  Tail2:
    Domain: x
`);
  const g = makeGraph(m, 1);
  ALGOS.hier.fn(g.nodes, g.edges, 'TB');
  const cx = id => { const n = g.byId.get(id); return n.x + n.w/2; };
  const ps = ['o:P1','o:P2','o:P3','o:P4'].map(cx).sort((a,b)=>a-b);
  const W = Math.max(...g.nodes.map(n=>n.x+n.w)) - Math.min(...g.nodes.map(n=>n.x));
  const topW = ps[3] - ps[0] + g.byId.get('o:P1').w;      // Breite der Elternreihe
  t('untere Kette senkrecht ausgerichtet',
    Math.abs(cx('o:Hub')-cx('o:Tail1'))<=1 && Math.abs(cx('o:Tail1')-cx('o:Tail2'))<=1,
    [cx('o:Hub'),cx('o:Tail1'),cx('o:Tail2')].map(Math.round).join(' , '));
  t('Kette bleibt in der Spanne der Elternreihe (keine Drift)',
    cx('o:Hub') >= ps[0]-1 && cx('o:Hub') <= ps[3]+1,
    `Hub=${Math.round(cx('o:Hub'))}, Eltern ${Math.round(ps[0])}..${Math.round(ps[3])}`);
  t('Diagramm wird durch den unteren Teil nicht breiter',
    W <= topW + 40, `Breite=${Math.round(W)}, Elternreihe=${Math.round(topW)}`);
}

console.log('== Orthogonal: Querläufe im Kanal ohne Kreuzung sortiert ==');
{
  // P läuft senkrecht durch die Mittelspalte von Tief; M (links) und RR (Mitte)
  // laufen im selben Kanal quer. Werden die Spuren falsch sortiert, schneidet ein
  // Querlauf den senkrechten Anschluss eines anderen. Erwartung: kreuzungsfrei.
  const oneMany = to => `    - to: ${to}\n      cardinality:\n        from: exactly_one\n        to: zero_or_many\n`;
  const m = buildModel(`BusinessObjects:
  P:
    relationships:
${oneMany('A')}${oneMany('B')}${oneMany('Tief')}  A:
    relationships:
${oneMany('M')}  B:
    relationships:
${oneMany('M')}  M:
    relationships:
${oneMany('Tief')}  RR:
    relationships:
${oneMany('Tief')}  Tief:
    Domain: x
`);
  const g = makeGraph(m, 1);
  ALGOS.ortho.fn(g.nodes, g.edges, 'TB');
  // Kanten in Segmente zerlegen (echte rechtwinklige Führung) und Schnitte zählen.
  const segs = [];
  g.edges.forEach(e=>{
    const A = g.byId.get(e.from), B = g.byId.get(e.to);
    if(!A || !B || !e.portFrom) return;
    const pts = [portPoint(A, e.portFrom), ...(e.bends || []), portPoint(B, e.portTo)];
    for(let i = 0; i < pts.length - 1; i++) segs.push({e, a: pts[i], b: pts[i+1]});
  });
  const ccw = (p,q,r)=> (r.y-p.y)*(q.x-p.x) - (q.y-p.y)*(r.x-p.x);
  const hit = (s,u)=>{
    const d1=ccw(u.a,u.b,s.a), d2=ccw(u.a,u.b,s.b), d3=ccw(s.a,s.b,u.a), d4=ccw(s.a,s.b,u.b);
    return ((d1>0)!==(d2>0)) && ((d3>0)!==(d4>0));
  };
  let cross = 0;
  for(let i=0;i<segs.length;i++) for(let j=i+1;j<segs.length;j++){
    if(segs[i].e === segs[j].e) continue;
    if(hit(segs[i], segs[j])) cross++;
  }
  t('Kanten in den Kanal kreuzen sich nicht', cross === 0, cross + ' Kreuzungen');
}

console.log('\n' + (fail ? `${fail} Prüfung(en) fehlgeschlagen, ${pass} bestanden`
                          : `Alle ${pass} Prüfungen bestanden`));
process.exit(fail ? 1 : 0);
