/* Rauchtest: weiche Kantenführung im dichten, kombinierten Modell
   (willibald + Delta crm + Delta sap-finanz). Hier zeigten sich die
   Blitzmuster und Zickzack-Züge, die in den kleinen Fixture-Modellen nicht
   auftreten. Die Kastenmaße werden vereinheitlicht (152×38 wie im Browser),
   damit die Geometrie nicht an der Schriftmessung des Mini-DOM hängt.

   Ausnahme ist der letzte Abschnitt: er misst Kästen mit Domain, Business
   Keys und Quellen (den Inhalt der früheren Ansicht 2) in echten Maßen — die
   Darstellung, in der wirklich gearbeitet wird. Dort sind die
   Kästen unterschiedlich hoch und breit, die Ebenenreihenfolge fällt anders
   aus, und die Zahlen hängen an measure() im Mini-DOM. */
const fs = require('fs');
const path = require('path');
const {bootApp, makeT} = require('./start');

(async ()=>{
const {S, api, document} = await bootApp();
const {t, finish} = makeT();

// Der Start steht in der Hierarchie (oberste Stufe); dieses Thema prüft die
// Komplettansicht und stellt sie darum ausdrücklich her.
api.setMode('komplett');

const lies = f => fs.readFileSync(path.join(__dirname, '..', '..', 'models', f), 'utf8').replace(/\r\n?/g, '\n');

console.log('== Nach einem Ausweichen läuft der Rest gerade aufs Ziel ==');
{
  // Willibald pur (Kastenmaße wie im Browser): VereinsPartner → Bestellung
  // muss um Kunde herum (Ausweichpunkt), knickte danach aber auf Höhe der
  // WohnHistorie zurück zur alten Luftlinie (298→359→364→396, 15 px neben der
  // Geraden) — die Bezugslinie interpolierte stur von Anschluss zu Anschluss
  // statt vom zuletzt gesetzten Punkt zum Ziel.
  S.layout.dir = 'TB';
  S.graph.nodes.forEach(n=>{ n.w = 152; n.h = 38; });
  [...document.getElementById('layoutMenu').querySelectorAll('.opt[data-algo]')]
    .find(b => b.dataset.algo === 'hier').onclick();
  const e = S.graph.edges.find(x => x.from === 'o:VereinsPartner' && x.to === 'o:Bestellung');
  const B = S.graph.byId.get(e.to);
  t('VereinsPartner→Bestellung weicht mit zwei Stützpunkten aus',
    e.bends && e.bends.length === 2, 'bends=' + (e.bends ? e.bends.length : 0));
  if(e.bends && e.bends.length === 2){
    const p0 = e.bends[0], p2 = api.routePoints(e, S.graph.byId.get(e.from), B).pop();
    const t01 = (e.bends[1].y - p0.y) / (p2.y - p0.y);
    const soll = p0.x + (p2.x - p0.x) * t01;
    t('nach dem Ausweichpunkt läuft der Zug gerade aufs Ziel',
      Math.abs(e.bends[1].x - soll) <= 4,
      `Abweichung ${Math.abs(e.bends[1].x - soll).toFixed(1)} px`);
  }
}

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
// Pendeln, in beiden Achsen: QUER darf ein Zug EINMAL die Richtung wechseln
// (ein Bogen um eine belegte Spur), ab zwei pendelt er — das Blitzmuster.
// LÄNGS (in Flussrichtung) ist schon EIN Wechsel eine Kehre: die Kante fährt
// zurück und wieder vor. Genau das passierte bei den gespiegelten Richtungen
// (BT/RL), wo die Kanalpunkt-Paare in Ebenen-Reihenfolge statt gezeichneter
// Reihenfolge durchlaufen wurden.
const pendelt = dir=>{
  const zack = [];
  const vert = dir === 'TB' || dir === 'BT';
  S.graph.edges.forEach(e=>{
    const A = S.graph.byId.get(e.from), B = S.graph.byId.get(e.to);
    if(!A || !B || A === B || !e.bends || !e.portFrom) return;
    const pts = api.routePoints(e, A, B);
    const wechselIn = wert=>{
      let d0 = 0, w = 0;
      for(let i=1;i<pts.length;i++){
        const d = wert(pts[i]) - wert(pts[i-1]);
        if(Math.abs(d) < 24) continue;
        const s = Math.sign(d);
        if(d0 && s !== d0) w++;
        d0 = s;
      }
      return w;
    };
    const quer   = wechselIn(p => vert ? p.x : p.y);
    const laengs = wechselIn(p => vert ? p.y : p.x);
    if(quer >= 2 || laengs >= 1)
      zack.push(e.from.replace('o:','') + '>' + e.to.replace('o:','') + ` (quer ${quer}, längs ${laengs})`);
  });
  return zack;
};

console.log('== Weiche Züge pendeln nicht (Blitzmuster, Kehren) ==');
for(const dir of ['TB','BT','LR','RL']){
  layoutMit('hier', dir);
  const zack = pendelt(dir);
  t(`${dir}: kein weicher Zug pendelt oder kehrt um`, zack.length === 0, zack.join(', '));
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

console.log('== Kreuzungen: keine auffälligen X am Kasten, Gesamtzahl gedeckelt ==');
{
  // Zwei Maße: das auffällige X — zwei Kanten mit gemeinsamem Endknoten
  // kreuzen sich DIREKT vor diesem Kasten (fast immer durch die
  // Anschluss-Reihung vermeidbar; die Tauschsuche gewichtet den Ort der
  // Kreuzung) — und die Gesamtzahl als Deckel gegen Wildwuchs.
  // Die Deckel halten drei Gewinne fest. Mit den drei geordneten
  // Startordnungen allein kam dieses Modell auf 44 (TB) bzw. 42 (LR)
  // Kreuzungen, mit den gemischten Zusatzstarts auf 25 bzw. 21, mit dem
  // Spaltenversatz der Stützpunkte auf 21 bzw. 21 und mit der Wunschlage der
  // Anschlüsse auf 21 bzw. 20. Darum je Richtung ein eigener Deckel.
  const DECKEL = {TB: 21, LR: 20};
  const ccw=(p,q,r)=>(r.y-p.y)*(q.x-p.x)-(q.y-p.y)*(r.x-p.x);
  const cross=(a,b,c,d)=>{const d1=ccw(c,d,a),d2=ccw(c,d,b),d3=ccw(a,b,c),d4=ccw(a,b,d);
    return ((d1>0)!==(d2>0))&&((d3>0)!==(d4>0));};
  const sp=(a,b,c,d)=>{const rx=b.x-a.x,ry=b.y-a.y,sx=d.x-c.x,sy=d.y-c.y;
    const den=rx*sy-ry*sx; if(!den)return null;
    const tt=((c.x-a.x)*sy-(c.y-a.y)*sx)/den; return {x:a.x+rx*tt,y:a.y+ry*tt};};
  for(const dir of ['TB','LR']){
    layoutMit('hier', dir);
    const segs=[];
    S.graph.edges.forEach(e=>{
      const A=S.graph.byId.get(e.from),B=S.graph.byId.get(e.to);
      if(!A||!B||A===B)return;
      const pts=api.routePoints(e,A,B);
      for(let i=0;i<pts.length-1;i++)segs.push({e,a:pts[i],b:pts[i+1]});
    });
    let n=0, nah=[];
    for(let i=0;i<segs.length;i++)for(let j=i+1;j<segs.length;j++){
      const e1=segs[i].e,e2=segs[j].e;
      if(e1===e2)continue;
      if(cross(segs[i].a,segs[i].b,segs[j].a,segs[j].b)){
        n++;
        const gem=e1.from===e2.from||e1.from===e2.to?e1.from:e1.to===e2.from||e1.to===e2.to?e1.to:null;
        if(gem){
          const n0=S.graph.byId.get(gem), pt=sp(segs[i].a,segs[i].b,segs[j].a,segs[j].b);
          if(n0&&pt&&Math.hypot(pt.x-(n0.x+n0.w/2),pt.y-(n0.y+n0.h/2))<140)
            nah.push(gem.replace('o:',''));
        }
      }
    }
    t(`${dir}: höchstens 2 auffällige X direkt am Kasten`, nah.length <= 2, nah.length + ': ' + nah.join(', '));
    t(`${dir}: höchstens ${DECKEL[dir]} geroutete Kreuzungen insgesamt`,
      n <= DECKEL[dir], n + ' Kreuzungen');
  }
}

console.log('== Anschlüsse zeigen dorthin, wohin ihr Zug läuft ==');
{
  // Die Anschlüsse einer Kastenseite werden nicht nur RICHTIG GEREIHT, sondern
  // auch nach ihrer Zielrichtung gelegt. Gleichmäßig gerastert bekam eine
  // Kante, die weit zur Seite zieht, ihren Rasterplatz statt des äußeren
  // Randes — und knickte gleich hinter dem Anschluss ab. Gemessen wird der
  // Winkel zwischen der Seitennormalen des Kastens und dem ersten Segment:
  // 0° heißt senkrecht heraus, große Werte heißen sofortiges Abknicken.
  const NORM = {T:{x:0,y:-1}, B:{x:0,y:1}, L:{x:-1,y:0}, R:{x:1,y:0}};
  const mittlererKnick = ()=>{
    let summe = 0, zahl = 0;
    S.graph.edges.forEach(e=>{
      const A = S.graph.byId.get(e.from), B = S.graph.byId.get(e.to);
      if(!A || !B || A === B || !e.portFrom) return;
      const pts = api.routePoints(e, A, B);
      for(const [port, p, q] of [[e.portFrom, pts[0], pts[1]],
                                 [e.portTo, pts[pts.length-1], pts[pts.length-2]]]){
        if(!port || !p || !q) continue;
        const n0 = NORM[port.side]; if(!n0) continue;
        const vx = q.x - p.x, vy = q.y - p.y;
        const len = Math.hypot(vx, vy); if(len < 1) continue;
        const cos = Math.max(-1, Math.min(1, (n0.x*vx + n0.y*vy) / len));
        summe += Math.acos(cos) * 180 / Math.PI; zahl++;
      }
    });
    return zahl ? summe / zahl : 0;
  };
  // Vor der Wunschlage: 44,9° (TB) und 25,0° (LR).
  for(const [dir, grenze] of [['TB', 43], ['LR', 24.7]]){
    layoutMit('hier', dir);
    const w = mittlererKnick();
    t(`${dir}: mittlerer Knick am Anschluss unter ${grenze}°`, w < grenze, w.toFixed(1) + '°');
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
  // Mit den gemischten Startordnungen waren es drei (die kreuzungsärmere
  // Ebenenreihenfolge schickte einen Zug mehr auf einen Umweg); die Wunschlage
  // der Anschlüsse holt den wieder zurück.
  t('höchstens 2 Züge müssen ihr Intervall verlassen', raus.length <= 2, raus.length + ': ' + raus.join(', '));
}

console.log('== Domain, Keys und Quellen in echten Kastenmaßen (die Darstellung der Praxis) ==');
{
  /* Alles darüber vereinheitlicht die Kästen auf 152×38, damit die Geometrie
     nicht an der Schriftmessung des Mini-DOM hängt. Die Ansicht, in der
     wirklich gearbeitet wird, zeigt aber Domain und Quellen — und dann sind
     die Kästen zwischen 76 und 175 px hoch und unterschiedlich breit. Das
     ergibt eine ANDERE Ebenenreihenfolge und andere Zahlen; ungeprüft war
     davon bisher nichts.

     Anlass: ein Nutzer hat diese Ansicht von Hand nachgebessert (23 auf 19
     Kreuzungen) und den Export geschickt. Aus den Handgriffen ließ sich keine
     Regel gewinnen — jeder Kandidat wurde gemessen und war den Preis nicht
     wert. Was bleibt, ist der Deckel: dass eine künftige Änderung diese
     Anordnung nicht verschlechtert.

     Die Zahlen hängen an measure() im Mini-DOM. Ändert sich dessen
     Schriftmessung, sind sie neu zu eichen. */
  // Inhalt der früheren Ansicht 2: Domain, Business Keys und Quellen im Kasten
  S.content[1] = {desc:false, domain:true, keys:true, sources:true, attrs:false, keysOnly:false, types:true};
  api.setView();
  const echt = (algo, dir)=>{
    S.layout.dir = dir;
    [...document.getElementById('layoutMenu').querySelectorAll('.opt[data-algo]')]
      .find(b => b.dataset.algo === algo).onclick();
  };
  // Eigene Geometriehelfer: die weiter oben sind an ihre Blöcke gebunden.
  const ccw2 = (p,q,r)=> (r.y-p.y)*(q.x-p.x) - (q.y-p.y)*(r.x-p.x);
  const kreuzt2 = (a,b,c,d)=>{
    const d1=ccw2(c,d,a), d2=ccw2(c,d,b), d3=ccw2(a,b,c), d4=ccw2(a,b,d);
    return ((d1>0)!==(d2>0)) && ((d3>0)!==(d4>0));
  };
  const schnittpunkt = (a,b,c,d)=>{
    const rx=b.x-a.x, ry=b.y-a.y, sx=d.x-c.x, sy=d.y-c.y;
    const den = rx*sy - ry*sx;
    if(!den) return null;
    const u = ((c.x-a.x)*sy - (c.y-a.y)*sx) / den;
    return {x:a.x + rx*u, y:a.y + ry*u};
  };
  const trifftKasten = (a,b,r)=>{
    if(Math.max(a.x,b.x) < r.x || Math.min(a.x,b.x) > r.x+r.w
    || Math.max(a.y,b.y) < r.y || Math.min(a.y,b.y) > r.y+r.h) return false;
    const drin = p => p.x > r.x && p.x < r.x+r.w && p.y > r.y && p.y < r.y+r.h;
    if(drin(a) || drin(b)) return true;
    const E = [{x:r.x,y:r.y},{x:r.x+r.w,y:r.y},{x:r.x+r.w,y:r.y+r.h},{x:r.x,y:r.y+r.h}];
    for(let i=0;i<4;i++){
      const c = E[i], d = E[(i+1)%4];
      if(((ccw2(a,b,c)>0)!==(ccw2(a,b,d)>0)) && ((ccw2(c,d,a)>0)!==(ccw2(c,d,b)>0))) return true;
    }
    return false;
  };
  const zaehle = ()=>{
    const segs = [];
    S.graph.edges.forEach(e=>{
      const A = S.graph.byId.get(e.from), B = S.graph.byId.get(e.to);
      if(!A || !B || A === B) return;
      const pts = api.routePoints(e, A, B);
      for(let i=0;i<pts.length-1;i++) segs.push({e, a:pts[i], b:pts[i+1]});
    });
    let n = 0, nah = 0, schnitte = 0;
    for(let i=0;i<segs.length;i++) for(let j=i+1;j<segs.length;j++){
      const e1 = segs[i].e, e2 = segs[j].e;
      if(e1 === e2) continue;
      if(!kreuzt2(segs[i].a, segs[i].b, segs[j].a, segs[j].b)) continue;
      n++;
      const gem = e1.from === e2.from || e1.from === e2.to ? e1.from
                : e1.to === e2.from  || e1.to === e2.to    ? e1.to : null;
      if(!gem) continue;
      const n0 = S.graph.byId.get(gem), pt = schnittpunkt(segs[i].a, segs[i].b, segs[j].a, segs[j].b);
      if(n0 && pt && Math.hypot(pt.x-(n0.x+n0.w/2), pt.y-(n0.y+n0.h/2)) < 140) nah++;
    }
    S.graph.edges.forEach(e=>{
      const A = S.graph.byId.get(e.from), B = S.graph.byId.get(e.to);
      if(!A || !B || A === B || !e.bends) return;
      const pts = api.routePoints(e, A, B);
      if(S.graph.nodes.some(nd=>{
        if(nd.hidden || nd.id === e.from || nd.id === e.to) return false;
        for(let i=0;i<pts.length-1;i++) if(trifftKasten(pts[i], pts[i+1], nd)) return true;
        return false;
      })) schnitte++;
    });
    return {n, nah, schnitte};
  };
  const DECKEL = {hier: {TB:23, BT:22, LR:20, RL:20},
                  ortho:{TB:17, BT:17, LR:22, RL:23}};
  for(const algo of ['hier', 'ortho']) for(const dir of ['TB','BT','LR','RL']){
    echt(algo, dir);
    const r = zaehle();
    t(`${algo} ${dir}: höchstens ${DECKEL[algo][dir]} geroutete Kreuzungen`,
      r.n <= DECKEL[algo][dir], r.n + ' Kreuzungen');
    t(`${algo} ${dir}: kein auffälliges X am Kasten, kein Schnitt`,
      r.nah === 0 && r.schnitte === 0, `${r.nah} X, ${r.schnitte} Schnitte`);
  }
  api.setView();
}

finish();
})();
