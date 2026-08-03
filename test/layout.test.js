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
  ['buildModel', 'makeGraph', 'ALGOS', 'separate']);
const {buildModel, makeGraph, ALGOS, separate} = api;

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

console.log('\n' + (fail ? `${fail} Prüfung(en) fehlgeschlagen, ${pass} bestanden`
                          : `Alle ${pass} Prüfungen bestanden`));
process.exit(fail ? 1 : 0);
