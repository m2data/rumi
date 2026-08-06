/* Rauchtest: weiche Kantenführung im dichten, kombinierten Modell
   (willibald + Delta crm + Delta sap-finanz). Hier zeigten sich die
   Blitzmuster und Zickzack-Züge, die in den kleinen Fixture-Modellen nicht
   auftreten. Die Kastenmaße werden vereinheitlicht (152×38 wie im Browser),
   damit die Geometrie nicht an der Schriftmessung des Mini-DOM hängt. */
const fs = require('fs');
const path = require('path');
const {bootApp, makeT} = require('./start');

(async ()=>{
const {S, api, document} = await bootApp();
const {t, finish} = makeT();

const lies = f => fs.readFileSync(path.join(__dirname, '..', '..', 'models', f), 'utf8').replace(/\r\n?/g, '\n');
api.loadDelta(lies('crm.yaml'));
api.loadDelta(lies('sap-finanz.yaml'));

console.log('== Kombiniertes Modell geladen ==');
t('34 Geschäftsobjekte nach beiden Deltas', Object.keys(S.model.objects).length === 34,
  Object.keys(S.model.objects).length + '');

// Alle Objekte sichtbar, Kastenmaße vereinheitlichen
document.getElementById('showAll').onclick();
const layoutMit = (algo, dir)=>{
  S.layout.dir = dir;
  S.graph.nodes.forEach(n=>{ n.w = 152; n.h = 38; });
  [...document.getElementById('layoutMenu').querySelectorAll('.opt[data-algo]')]
    .find(b => b.dataset.algo === algo).onclick();
};
// Pendeln: die Querlage eines Zugs wechselt unterwegs MEHRFACH die Richtung.
// EIN Wechsel ist legitim (ein Bogen um eine belegte Spur); ab zwei pendelt
// die Kante zwischen den Seiten — das Blitzmuster.
const pendelt = dir=>{
  const zack = [];
  S.graph.edges.forEach(e=>{
    const A = S.graph.byId.get(e.from), B = S.graph.byId.get(e.to);
    if(!A || !B || A === B || !e.bends || !e.portFrom) return;
    const pts = api.routePoints(e, A, B);
    const q = p => (dir === 'TB' || dir === 'BT') ? p.x : p.y;
    let d0 = 0, wechsel = 0;
    for(let i=1;i<pts.length;i++){
      const d = q(pts[i]) - q(pts[i-1]);
      if(Math.abs(d) < 24) continue;
      const s = Math.sign(d);
      if(d0 && s !== d0) wechsel++;
      d0 = s;
    }
    if(wechsel >= 2) zack.push(e.from.replace('o:','') + '>' + e.to.replace('o:',''));
  });
  return zack;
};

console.log('== Weiche Züge pendeln nicht (Blitzmuster) ==');
for(const dir of ['TB','LR']){
  layoutMit('hier', dir);
  const zack = pendelt(dir);
  t(`${dir}: kein weicher Zug pendelt zwischen den Seiten`, zack.length === 0, zack.join(', '));
}

console.log('== Kanten laufen an fremden Kästen vorbei, nicht hindurch ==');
{
  const segRect = (a, b, r)=>{
    if(Math.max(a.x,b.x) < r.x || Math.min(a.x,b.x) > r.x+r.w
    || Math.max(a.y,b.y) < r.y || Math.min(a.y,b.y) > r.y+r.h) return false;
    const cr = (p,q,s)=> (s.y-p.y)*(q.x-p.x) - (q.y-p.y)*(s.x-p.x);
    const drin = p => p.x > r.x && p.x < r.x+r.w && p.y > r.y && p.y < r.y+r.h;
    if(drin(a) || drin(b)) return true;
    const E = [{x:r.x,y:r.y},{x:r.x+r.w,y:r.y},{x:r.x+r.w,y:r.y+r.h},{x:r.x,y:r.y+r.h}];
    for(let i=0;i<4;i++){
      const c = E[i], d = E[(i+1)%4];
      if(((cr(a,b,c)>0)!==(cr(a,b,d)>0)) && ((cr(c,d,a)>0)!==(cr(c,d,b)>0))) return true;
    }
    return false;
  };
  const schnitte = ()=>{
    const s = [];
    S.graph.edges.forEach(e=>{
      const A = S.graph.byId.get(e.from), B = S.graph.byId.get(e.to);
      if(!A || !B || A === B || !e.bends) return;
      const pts = api.routePoints(e, A, B);
      if(S.graph.nodes.some(n=>{
        if(n.hidden || n.id === e.from || n.id === e.to) return false;
        for(let i=0;i<pts.length-1;i++) if(segRect(pts[i], pts[i+1], n)) return true;
        return false;
      })) s.push(e.from.replace('o:','') + '>' + e.to.replace('o:',''));
    });
    return s;
  };
  for(const dir of ['TB','LR']){
    layoutMit('hier', dir);
    const s = schnitte();
    t(`${dir}: kein geführter Zug schneidet einen fremden Kasten`, s.length === 0, s.join(', '));
  }
}

console.log('== Kein weicher Zug verlässt sein Anschluss-Intervall (Kringel) ==');
{
  layoutMit('hier', 'TB');
  const raus = [];
  S.graph.edges.forEach(e=>{
    const A = S.graph.byId.get(e.from), B = S.graph.byId.get(e.to);
    if(!A || !B || A === B || !e.bends || !e.portFrom) return;
    const pts = api.routePoints(e, A, B);
    const lo = Math.min(pts[0].x, pts[pts.length-1].x) - 30;
    const hi = Math.max(pts[0].x, pts[pts.length-1].x) + 30;
    if(e.bends.some(p => p.x < lo || p.x > hi))
      raus.push(e.from.replace('o:','') + '>' + e.to.replace('o:',''));
  });
  // Wo alle Ebenen belegt sind, bleibt ein Umweg erlaubt — aber nicht viele.
  t('höchstens 2 Züge müssen ihr Intervall verlassen', raus.length <= 2, raus.length + ': ' + raus.join(', '));
}

finish();
})();
