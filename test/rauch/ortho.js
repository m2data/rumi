/* Rauchtest: rechtwinklige Führung im dichten Modell (models/verquer_bo.yaml).
   Hier zeigte sich der Haken, den die weiche Führung nicht kennt: eine
   Stützspalte weit AUSSERHALB des Intervalls zwischen den beiden Anschlüssen
   schickt den Zug erst von seinem Ziel weg und dann zurück — und was er dabei
   quert, kreuzt er zweimal. Die Kastenmaße werden vereinheitlicht (152×38 wie
   im Browser), damit die Geometrie nicht an der Schriftmessung hängt. */
const fs = require('fs');
const path = require('path');
const {bootApp, makeT} = require('./start');

(async ()=>{
const {S, api, document} = await bootApp();
const {t, finish} = makeT();

const fixture = path.join(__dirname, '..', '..', 'models', 'verquer_bo.yaml');
if(!fs.existsSync(fixture)){
  console.log('  (übersprungen: models/verquer_bo.yaml fehlt)');
  finish();
  return;
}
api.loadDelta(fs.readFileSync(fixture, 'utf8').replace(/\r\n?/g, '\n'));
document.getElementById('showAll').onclick();

const layoutMit = (algo, dir)=>{
  S.layout.dir = dir;
  S.graph.nodes.forEach(n=>{ n.w = 152; n.h = 38; });
  [...document.getElementById('layoutMenu').querySelectorAll('.opt[data-algo]')]
    .find(b => b.dataset.algo === algo).onclick();
};

const ccw = (p,q,r)=> (r.y-p.y)*(q.x-p.x) - (q.y-p.y)*(r.x-p.x);
const kreuzt = (a,b,c,d)=>{
  const d1=ccw(c,d,a), d2=ccw(c,d,b), d3=ccw(a,b,c), d4=ccw(a,b,d);
  return ((d1>0)!==(d2>0)) && ((d3>0)!==(d4>0));
};
const segmente = ()=>{
  const segs = [];
  S.graph.edges.forEach(e=>{
    const A = S.graph.byId.get(e.from), B = S.graph.byId.get(e.to);
    if(!A || !B || A === B) return;
    const pts = api.routePoints(e, A, B);
    for(let i=0;i<pts.length-1;i++) segs.push({e, a:pts[i], b:pts[i+1]});
  });
  return segs;
};
const kreuzungenZwischen = (vonA, nachA, vonB, nachB)=>{
  const passt = (e, v, n) => e.from === 'o:'+v && e.to === 'o:'+n;
  const segs = segmente();
  let n = 0;
  for(let i=0;i<segs.length;i++) for(let j=i+1;j<segs.length;j++){
    const e1 = segs[i].e, e2 = segs[j].e;
    if(e1 === e2) continue;
    const paar = (passt(e1, vonA, nachA) && passt(e2, vonB, nachB))
              || (passt(e2, vonA, nachA) && passt(e1, vonB, nachB));
    if(paar && kreuzt(segs[i].a, segs[i].b, segs[j].a, segs[j].b)) n++;
  }
  return n;
};

console.log('== Der gemeldete Fall: Besteckkasten kreuzt sich nicht selbst ==');
{
  // Drei parallele Beziehungen Besteckkasten→Spülbürste liefen in einem weiten
  // Haken nach links (bis x≈97, obwohl beide Anschlüsse zwischen 232 und 325
  // liegen) und querten dabei zweimal die Spalte, in der Besteckkasten→
  // Dosenöffner schnurgerade hinunterläuft.
  layoutMit('ortho', 'TB');
  const n = kreuzungenZwischen('Besteckkasten', 'Dosenöffner', 'Besteckkasten', 'Spülbürste');
  t('TB: Besteckkasten→Dosenöffner kreuzt Besteckkasten→Spülbürste nicht', n === 0, n + ' Kreuzungen');
  const s = kreuzungenZwischen('Besteckkasten', 'Spülbürste', 'Besteckkasten', 'Spülbürste');
  t('TB: die parallelen Besteckkasten→Spülbürste kreuzen einander nicht', s === 0, s + ' Kreuzungen');
}

console.log('== Rechtwinklige Züge bleiben nahe an ihrem Anschluss-Intervall ==');
{
  // Vor dem gruppenweisen Kappen: 17 Züge (TB) bzw. 8 (LR) verließen ihr
  // Intervall, der größte um 283 px.
  for(const [dir, grenze] of [['TB', 13], ['LR', 6]]){
    layoutMit('ortho', dir);
    const q = (dir === 'TB' || dir === 'BT') ? 'x' : 'y';
    let raus = 0;
    S.graph.edges.forEach(e=>{
      const A = S.graph.byId.get(e.from), B = S.graph.byId.get(e.to);
      if(!A || !B || A === B || !e.bends || !e.portFrom) return;
      const pts = api.routePoints(e, A, B);
      const lo = Math.min(pts[0][q], pts[pts.length-1][q]) - 30;
      const hi = Math.max(pts[0][q], pts[pts.length-1][q]) + 30;
      if(pts.some(p => p[q] < lo || p[q] > hi)) raus++;
    });
    t(`${dir}: höchstens ${grenze} Züge verlassen ihr Intervall`, raus <= grenze, raus + ' Züge');
  }
}

console.log('== Gesamtzahl der Kreuzungen gedeckelt ==');
{
  // Vor dem Kappen: TB 91, BT 90, RL 81 — jetzt 71, 75, 78.
  for(const [dir, grenze] of [['TB', 75], ['BT', 78], ['LR', 75], ['RL', 80]]){
    layoutMit('ortho', dir);
    const segs = segmente();
    let n = 0;
    for(let i=0;i<segs.length;i++) for(let j=i+1;j<segs.length;j++){
      if(segs[i].e === segs[j].e) continue;
      if(kreuzt(segs[i].a, segs[i].b, segs[j].a, segs[j].b)) n++;
    }
    t(`${dir}: höchstens ${grenze} geroutete Kreuzungen`, n <= grenze, n + ' Kreuzungen');
  }
}

console.log('== Die weiche Führung bleibt unberührt ==');
{
  // Das Kappen läuft nur im rechtwinkligen Zweig; vorgeschaltet verschöbe es
  // der weichen Führung bloß den Ausgangsstand.
  for(const [dir, grenze] of [['TB', 89], ['LR', 76]]){
    layoutMit('hier', dir);
    const segs = segmente();
    let n = 0;
    for(let i=0;i<segs.length;i++) for(let j=i+1;j<segs.length;j++){
      if(segs[i].e === segs[j].e) continue;
      if(kreuzt(segs[i].a, segs[i].b, segs[j].a, segs[j].b)) n++;
    }
    t(`${dir}: hierarchisch weiterhin höchstens ${grenze} Kreuzungen`, n <= grenze, n + ' Kreuzungen');
  }
}

finish();
})();
