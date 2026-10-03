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
const {api, S} = load(['yaml.js', 'model.js', 'layout.js', 'render.js'],
  ['buildModel', 'makeGraph', 'ALGOS', 'separate', 'portPoint']);
const {buildModel, makeGraph, ALGOS, separate, portPoint} = api;

const {centerCrossings, edgePath, routedCrossings} = require('./geo');

const finite = n => Number.isFinite(n.x) && Number.isFinite(n.y);
const overlaps = (A, B)=> A.x < B.x + B.w && B.x < A.x + A.w && A.y < B.y + B.h && B.y < A.y + A.h;
const crossings = centerCrossings;

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
  const cross = routedCrossings(g, portPoint);   // echte rechtwinklige Führung
  t('Kanten in den Kanal kreuzen sich nicht', cross === 0, cross + ' Kreuzungen');
}

console.log('== Orthogonal: keine rücklaufenden Haken an den Ecken ==');
{
  const g = makeGraph(model, 1);            // echtes Modell, orthogonal
  ALGOS.ortho.fn(g.nodes, g.edges, 'TB');
  let hooks = 0;
  g.edges.forEach(e=>{
    const A = g.byId.get(e.from), B = g.byId.get(e.to);
    if(!A || !B || !e.portFrom) return;
    const raw = edgePath(e, A, B, portPoint);
    const p = raw.filter((q,i)=> i === 0 || Math.abs(q.x-raw[i-1].x) > 0.5 || Math.abs(q.y-raw[i-1].y) > 0.5);
    for(let i=1;i<p.length-1;i++){
      const a = p[i-1], b = p[i], c = p[i+1];
      const dot = (b.x-a.x)*(c.x-b.x) + (b.y-a.y)*(c.y-b.y);
      const l = Math.hypot(b.x-a.x, b.y-a.y) * Math.hypot(c.x-b.x, c.y-b.y);
      if(dot / (l || 1) < -0.1) hooks++;    // Segment läuft entgegen der Vorrichtung -> Haken
    }
  });
  t('orthogonale Kanten laufen an den Ecken nicht zurück', hooks === 0, hooks + ' Rückläufe');
  t('Willibald orthogonal: geroutete Züge kreuzungsfrei', routedCrossings(g, portPoint) === 0,
    routedCrossings(g, portPoint) + ' Kreuzungen');
}

console.log('== Orthogonal: lange Kante fällt gerade in den Anschluss (sap-finanz) ==');
{
  const fixture = path.join(__dirname, '..', 'models', 'sap-finanz.yaml');
  if(!fs.existsSync(fixture)){
    console.log('  (übersprungen: models/sap-finanz.yaml fehlt)');
  } else {
    const g = makeGraph(buildModel(fs.readFileSync(fixture, 'utf8')), 1);
    const A = g.byId.get('o:Werksmaterial'), B = g.byId.get('o:Rechnungsposition');
    const e = g.edges.find(x => x.from === 'o:Werksmaterial' && x.to === 'o:Rechnungsposition');
    if(!A || !B || !e){
      console.log('  (übersprungen: Werksmaterial/Rechnungsposition nicht im Modell)');
    } else {
      ALGOS.ortho.fn(g.nodes, g.edges, 'TB');
      const pts = edgePath(e, A, B, portPoint);
      const xs = pts.map(p => p.x);
      const lo = Math.min(xs[0], xs[xs.length-1]) - 1, hi = Math.max(xs[0], xs[xs.length-1]) + 1;
      // Die Kante überspannt mehrere Ebenen und soll gerade in den seitlichen
      // Anschluss fallen, statt bis zur Knotenmitte zu laufen und zurückzuknicken.
      t('Werksmaterial->Rechnungsposition schwingt nicht über das Ziel hinaus',
        xs.every(x => x >= lo && x <= hi), 'xs=' + xs.map(Math.round).join(','));
      t('sap-finanz orthogonal: höchstens 2 geroutete Kreuzungen',
        routedCrossings(g, portPoint) <= 2, routedCrossings(g, portPoint) + ' Kreuzungen');
    }
  }
}

console.log('== Orthogonal: Mehrfachstart hält die Kreuzungen niedrig (crm) ==');
{
  const fixture = path.join(__dirname, '..', 'models', 'crm.yaml');
  if(!fs.existsSync(fixture)){
    console.log('  (übersprungen: models/crm.yaml fehlt)');
  } else {
    const g = makeGraph(buildModel(fs.readFileSync(fixture, 'utf8')), 1);
    ALGOS.ortho.fn(g.nodes, g.edges, 'TB');
    const c = crossings(g.nodes, g.edges);
    // Vor dem deterministischen Mehrfachstart waren es 7, mit den drei
    // geordneten Starts 4; mit den gemischten Zusatzstarts 2.
    t('crm orthogonal: höchstens 2 Kreuzungen (Zentrum-zu-Zentrum)', c <= 2, c + ' Kreuzungen');
    // Kreuzungsbewusste Spur- und Anschlussvergabe: geroutet 9 -> 3 -> 1.
    t('crm orthogonal: höchstens 1 geroutete Kreuzung',
      routedCrossings(g, portPoint) <= 1, routedCrossings(g, portPoint) + ' Kreuzungen');
    // Überbreite leere Korridore werden geschlossen (vorher ~664 px Lücke).
    const iv = g.nodes.map(n => [n.x, n.x + n.w]).sort((a,b)=> a[0]-b[0]);
    let maxGap = 0, end = iv[0][1];
    for(const [lo, hi] of iv){ if(lo - end > maxGap) maxGap = lo - end; end = Math.max(end, hi); }
    t('crm: keine leere Spalte breiter als 200px', maxGap <= 200, 'größte Lücke=' + Math.round(maxGap));
  }
}

console.log('== Weiche Führung: leichte Schräge statt Treppe (Blitzmuster) ==');
{
  // Kante über eine Zwischenebene hinweg (A -> C neben der Kette A -> B -> C).
  // Rechtwinklig braucht sie das Punktepaar an den Bandgrenzen (senkrecht durchs
  // Band, quer im Kanal); weich gezeichnet wurde daraus ein Blitz, wo eine
  // leichte Schräge genügt — jetzt: EIN Punkt in Bandmitte je Zwischenebene.
  const m = buildModel(`BusinessObjects:
  A:
    relationships:
    - to: B
      cardinality:
        from: exactly_one
        to: zero_or_many
    - to: C
      cardinality:
        from: exactly_one
        to: zero_or_many
  B:
    relationships:
    - to: C
      cardinality:
        from: exactly_one
        to: zero_or_many
  C:
    Domain: x
`);
  const lang = g => g.edges.find(e => e.from === 'o:A' && e.to === 'o:C');
  const gh = makeGraph(m, 1);
  ALGOS.hier.fn(gh.nodes, gh.edges, 'TB');
  const eh = lang(gh);
  t('hierarchisch: ein Stützpunkt je Zwischenebene',
    eh.bends && eh.bends.length === 1, 'bends=' + (eh.bends ? eh.bends.length : 0));
  {
    // und der liegt in der Bandmitte der Zwischenebene — die Kante läuft schräg
    const B = gh.byId.get('o:B');
    t('der Punkt liegt auf Höhe der Zwischenebene',
      Math.abs(eh.bends[0].y - (B.y + B.h/2)) <= 1,
      eh.bends[0].y + ' vs ' + (B.y + B.h/2));
  }
  const go = makeGraph(m, 1);
  ALGOS.ortho.fn(go.nodes, go.edges, 'TB');
  const eo = lang(go);
  t('orthogonal: weiterhin das Punktepaar an den Bandgrenzen',
    eo.bends && eo.bends.length === 2, 'bends=' + (eo.bends ? eo.bends.length : 0));

  // Kein Zickzack: die Querlage eines weichen Zugs wechselt unterwegs nicht
  // die Richtung. Produkt→Position pendelte früher 494→429→494→298 — die
  // Ausweichlage sprang auf die Anschlusslage zurück, statt an den Rand der
  // belegten Zone; die Kante machte eine Kurve zum Modell hin, nur weil dort
  // Platz war.
  {
    const g = makeGraph(model, 1);
    ALGOS.hier.fn(g.nodes, g.edges, 'TB');
    const zack = [];
    g.edges.forEach(e=>{
      const A = g.byId.get(e.from), B = g.byId.get(e.to);
      if(!A || !B || A === B || !e.bends || !e.portFrom) return;
      const pts = [portPoint(A, e.portFrom), ...e.bends, portPoint(B, e.portTo)];
      let dir = 0;
      for(let i=1;i<pts.length;i++){
        const d = pts[i].x - pts[i-1].x;
        if(Math.abs(d) < 24) continue;
        const s = Math.sign(d);
        if(dir && s !== dir){ zack.push(e.from.replace('o:','') + '>' + e.to.replace('o:','')); break; }
        dir = s;
      }
    });
    t('Willibald hierarchisch: kein weicher Zug wechselt die Querrichtung',
      zack.length === 0, zack.join(', '));
  }
}

console.log('== Alle vier Flussrichtungen sind gleichwertig ==');
{
  // Kette: der Fluss läuft in die gewählte Richtung
  const kette = buildModel(`BusinessObjects:
  A:
    relationships:
    - to: B
  B:
    relationships:
    - to: C
  C:
    Domain: x
`);
  const posIn = (dir, g, id)=>{ const n = g.byId.get(id); return (dir === 'TB' || dir === 'BT') ? n.y : n.x; };
  const erwartet = {TB:(a,b)=>a<b, BT:(a,b)=>a>b, LR:(a,b)=>a<b, RL:(a,b)=>a>b};
  for(const dir of ['BT','LR','RL']){
    const g = makeGraph(kette, 1);
    ALGOS.hier.fn(g.nodes, g.edges, dir);
    const p = id => posIn(dir, g, id);
    t(`${dir}: Kette läuft in Flussrichtung`,
      erwartet[dir](p('o:A'), p('o:B')) && erwartet[dir](p('o:B'), p('o:C')),
      [p('o:A'), p('o:B'), p('o:C')].join(' → '));
  }

  // LR: die 1-Seite steht am Flussanfang (links), auch bei verkehrter Notation
  {
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
    ALGOS.hier.fn(g.nodes, g.edges, 'LR');
    const E = g.byId.get('o:Eltern'), K = g.byId.get('o:Kind');
    t('LR: 1-Seite links, n-Seite rechts', E.x + E.w <= K.x, `Eltern x=${E.x}, Kind x=${K.x}`);
  }

  // LR: Trabant (1:1) hängt unten, und die Einzelkind-Kette bleibt trotz des
  // aufgeblähten Elternteils waagrecht in einer Linie — die parentC-Korrektur
  // rechnete die Aufblähung bisher nur bei senkrechtem Fluss heraus.
  {
    const m = buildModel(`BusinessObjects:
  Haupt:
    relationships:
    - to: Detail
      cardinality:
        from: exactly_one
        to: exactly_one
    - to: Kind
      cardinality:
        from: exactly_one
        to: zero_or_many
  Detail:
    Domain: x
  Kind:
    relationships:
    - to: Enkel
      cardinality:
        from: exactly_one
        to: zero_or_many
  Enkel:
    Domain: x
`);
    const g = makeGraph(m, 1);
    ALGOS.hier.fn(g.nodes, g.edges, 'LR');
    const n = id => g.byId.get(id);
    const cy = id => n(id).y + n(id).h/2;
    const H = n('o:Haupt'), D = n('o:Detail');
    t('LR: 1:1-Detail hängt unter dem Hauptobjekt',
      D.y >= H.y + H.h - 1 && D.x < H.x + H.w && D.x + D.w > H.x,
      `Haupt(${H.x},${H.y},h=${H.h}), Detail(${D.x},${D.y})`);
    t('LR: Einzelkind-Kette waagrecht in einer Linie (trotz Trabant am Elternteil)',
      Math.abs(cy('o:Haupt') - cy('o:Kind')) <= 1 && Math.abs(cy('o:Kind') - cy('o:Enkel')) <= 1,
      [cy('o:Haupt'), cy('o:Kind'), cy('o:Enkel')].map(Math.round).join(' , '));
  }

  // Willibald orthogonal: in JEDER Richtung kreuzungsfrei geroutet. Das
  // Langkanten-Geraderücken erzeugte bei LR 5 und bei RL 3 Kreuzungen, weil das
  // Geradstück keinem Kanal gehört und die Spurvergabe es nicht ausweichen
  // lassen kann — seitdem wird es zurückgenommen, wenn es neu kreuzt.
  for(const dir of ['TB','BT','LR','RL']){
    const g = makeGraph(model, 1);
    ALGOS.ortho.fn(g.nodes, g.edges, dir);
    t(`${dir}: Willibald orthogonal kreuzungsfrei geroutet`,
      routedCrossings(g, portPoint) === 0, routedCrossings(g, portPoint) + ' Kreuzungen');
    let bad = 0;
    for(let i = 0; i < g.nodes.length; i++) for(let j = i + 1; j < g.nodes.length; j++)
      if(overlaps(g.nodes[i], g.nodes[j])) bad++;
    t(`${dir}: keine Überlappungen`, bad === 0, bad + ' Überlappungen');
  }

  // Korridor-Kompaktierung wirkt auch quer zum waagrechten Fluss (leere Zeilen)
  {
    const fixture = path.join(__dirname, '..', 'models', 'crm.yaml');
    if(fs.existsSync(fixture)){
      const g = makeGraph(buildModel(fs.readFileSync(fixture, 'utf8')), 1);
      ALGOS.ortho.fn(g.nodes, g.edges, 'LR');
      const iv = g.nodes.map(n => [n.y, n.y + n.h]).sort((a,b)=> a[0]-b[0]);
      let maxGap = 0, end = iv[0][1];
      for(const [lo, hi] of iv){ if(lo - end > maxGap) maxGap = lo - end; end = Math.max(end, hi); }
      t('crm LR: keine leere Zeile höher als 150px', maxGap <= 150, 'größte Lücke=' + Math.round(maxGap));
      t('crm LR: höchstens 1 geroutete Kreuzung',
        routedCrossings(g, portPoint) <= 1, routedCrossings(g, portPoint) + ' Kreuzungen');
    } else console.log('  (crm-Teil übersprungen: models/crm.yaml fehlt)');
  }
}

console.log('== Quelle und Domäne als eigene Kästen stehen neben ihrem Objekt ==');
{
  /* Jedes Objekt hat seine eigenen Anhängsel. Sie stehen quer zum Fluss dicht
     neben ihm — bei ↓/↑ und den richtungslosen Verfahren rechts, bei →/←
     darunter — und überlappen nichts. Mehrere stapeln sich um die Mitte des
     Objekts, ein Stapel darf also über das Objekt hinausragen.

     Kreuzungen: Deckel aus der Messung bei Einführung. Fast alles Zusätzliche
     sind fachliche Kanten, weil die Objekte mit ihren Anhängseln breiter werden —
     verquer_bo hierarchisch ↓ kreuzt allein durch breitere Kästen 70 → 104,
     ganz ohne Anhängsel. (Die frühere Ansicht 3 mit gemeinsamen
     Quellknoten lag dort bei 101.) */
  const neben = (n, p, rechts)=> rechts
    ? n.x - (p.x + p.w) >= 0 && n.x - (p.x + p.w) <= 30 && Math.abs((n.y + n.h/2) - (p.y + p.h/2)) <= 200
    : n.y - (p.y + p.h) >= 0 && n.y - (p.y + p.h) <= 30 && Math.abs((n.x + n.w/2) - (p.x + p.w/2)) <= 400;
  const DECKEL = {
    'willibald-attr.yaml': {hier:[1,1,1,1], ortho:[0,0,0,0]},
    'crm.yaml':            {hier:[4,4,2,2], ortho:[1,1,1,1]},
    'sap-finanz.yaml':     {hier:[1,1,1,1], ortho:[1,1,1,1]},
    'verquer_bo.yaml':     {hier:[122,123,87,91], ortho:[73,73,63,67]}
  };
  for(const f of ['willibald-attr.yaml', 'crm.yaml', 'sap-finanz.yaml', 'verquer_bo.yaml']){
    const fixture = path.join(__dirname, '..', 'models', f);
    if(!fs.existsSync(fixture)) continue;
    const m = buildModel(fs.readFileSync(fixture, 'utf8'));
    for(const k of Object.keys(ALGOS)) for(const dir of ALGOS[k].dir ? ['TB','BT','LR','RL'] : ['TB']){
      S.elemente = {quelle:true, domaene:true};
      const g = makeGraph(m);
      ALGOS[k].fn(g.nodes, g.edges, dir);
      const anh = g.nodes.filter(n => n.eltern);
      const rechts = !ALGOS[k].dir || dir === 'TB' || dir === 'BT';
      const falsch = anh.filter(n => !neben(n, g.byId.get(n.eltern), rechts));
      const wo = `${f} ${k} ${dir}`;
      t(`${wo}: alle ${anh.length} Anhängsel neben ihrem Objekt`, anh.length > 0 && !falsch.length,
        falsch.slice(0, 3).map(n => n.id).join(', '));
      let bad = 0;
      for(let i = 0; i < g.nodes.length; i++) for(let j = i + 1; j < g.nodes.length; j++)
        if(overlaps(g.nodes[i], g.nodes[j])) bad++;
      t(`${wo}: keine Überlappungen`, bad === 0, bad + ' Überlappungen');
      if(k === 'hier' || k === 'ortho'){
        const max = DECKEL[f][k][['TB','BT','LR','RL'].indexOf(dir)];
        const r = routedCrossings(g, portPoint);
        t(`${wo}: höchstens ${max} geroutete Kreuzungen`, r <= max, r + ' Kreuzungen');
      }
    }
  }
  S.elemente = {};
}

console.log('\n' + (fail ? `${fail} Prüfung(en) fehlgeschlagen, ${pass} bestanden`
                          : `Alle ${pass} Prüfungen bestanden`));
process.exit(fail ? 1 : 0);
