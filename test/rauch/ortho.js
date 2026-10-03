/* Rauchtest: rechtwinklige Führung im dichten Modell (models/verquer_bo.yaml).
   Hier zeigte sich der Haken, den die weiche Führung nicht kennt: eine
   Stützspalte weit AUSSERHALB des Intervalls zwischen den beiden Anschlüssen
   schickt den Zug erst von seinem Ziel weg und dann zurück — und was er dabei
   quert, kreuzt er zweimal. */
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
/* Das Modell wird GELADEN, nicht als Delta ergänzt. Als Delta läge es auf dem
   ausgelieferten Willibald-Modell, und die elf zusätzlichen Objekte ändern
   Ebenenzuteilung wie Reihenfolge — die Anordnung wäre eine andere als die,
   die der Nutzer vor sich hat. Genau daran ist die Nachstellung eines
   gemeldeten Falls zuvor gescheitert. */
await api.loadYaml(fs.readFileSync(fixture, 'utf8').replace(/\r\n?/g, '\n'), 'verquer_bo.yaml');
document.getElementById('showAll').onclick();
// Domain, Business Keys und Quellen im Kasten — der Inhalt der früheren
// Ansicht 2, wie im Bericht
S.content[1] = {desc:false, domain:true, keys:true, sources:true, attrs:false, keysOnly:false, types:true};
api.setView();

/* Anders als in fuehrung.js werden die Kastenmaße hier NICHT vereinheitlicht.
   Der gemeldete Fall hängt daran: mit 152×38 fallen die Kästen anders aus, die
   Ebenenreihenfolge kippt, und die Konstellation entsteht gar nicht. Gemessen
   wird deshalb mit den Maßen, die die App selbst rechnet — die stammen aus
   measure() im Mini-DOM und sind damit im Repo deterministisch, hängen aber an
   dessen Schriftmessung. Ändert die sich, sind die Zahlen hier neu zu eichen. */
const layoutMit = (algo, dir)=>{
  S.layout.dir = dir;
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

/* Umweg eines Zuges: wie weit läuft er aus dem Intervall zwischen seinen
   beiden Anschlüssen heraus (quer zur Flussrichtung)? */
const umwegVon = (e, dir)=>{
  const A = S.graph.byId.get(e.from), B = S.graph.byId.get(e.to);
  if(!A || !B || A === B || !e.bends || !e.portFrom) return 0;
  const q = (dir === 'TB' || dir === 'BT') ? 'x' : 'y';
  const pts = api.routePoints(e, A, B);
  const lo = Math.min(pts[0][q], pts[pts.length-1][q]);
  const hi = Math.max(pts[0][q], pts[pts.length-1][q]);
  return pts.reduce((m,p)=> Math.max(m, lo - p[q], p[q] - hi), 0);
};
const mitLabel = txt => S.graph.edges.find(e => e.label === txt);
const alleKreuzungen = ()=>{
  const segs = segmente();
  let n = 0;
  for(let i=0;i<segs.length;i++) for(let j=i+1;j<segs.length;j++){
    if(segs[i].e === segs[j].e) continue;
    if(kreuzt(segs[i].a, segs[i].b, segs[j].a, segs[j].b)) n++;
  }
  return n;
};

console.log('== Der gemeldete Fall: „Tasse" holt nicht um einen Kasten aus ==');
{
  /* Die Beziehung „Tasse" (Besteckkasten → Spülbürste) lief außen um das
     Nudelholz herum: ihre Stützspalte lag 146 px außerhalb des Intervalls
     zwischen ihren Anschlüssen, obwohl der andere Rand derselben Sperrzone
     mitten im Intervall liegt. Die Seitenwahl nahm stur den Rand, aus dessen
     Richtung die Spalte kam, und die Gruppenprüfung verwarf das Hereinholen,
     weil es eine Kreuzung kostete — sie kannte den Umweg nicht. */
  layoutMit('ortho', 'TB');
  const e = mitLabel('Tasse');
  t('die Beziehung „Tasse" ist im Modell', !!e);
  if(e) t('TB: „Tasse" holt höchstens 30 px aus (vorher 146)',
          umwegVon(e, 'TB') <= 30, Math.round(umwegVon(e, 'TB')) + ' px');
  const s = kreuzungenZwischen('Besteckkasten', 'Spülbürste', 'Besteckkasten', 'Spülbürste');
  t('TB: die drei parallelen Besteckkasten→Spülbürste kreuzen einander nicht',
    s === 0, s + ' Kreuzungen');

  /* Der zuerst gemeldete Fall. Zwei Kreuzungen waren es: eine gleich unter dem
     Kasten, weil die Anschlussreihung nicht mehr zu den Stützspalten passte
     (Dosenöffner saß links, seine Spalte lag rechts) — die ist mit dem
     Nachsortieren weg. Die zweite bleibt und ist struktureller Natur: „Tasse"
     läuft rechts am Nudelholz vorbei, Dosenöffner links, und beide Ziele
     liegen darunter nebeneinander. Beide auf dieselbe Seite zu zwingen kostet
     mehr Kreuzungen, als es spart — bei vier verschiedenen Gewichtungen der
     Umwegstrafe gemessen. */
  const d = kreuzungenZwischen('Besteckkasten', 'Dosenöffner', 'Besteckkasten', 'Spülbürste');
  t('TB: Besteckkasten→Dosenöffner kreuzt →Spülbürste höchstens einmal (vorher zweimal)',
    d <= 1, d + ' Kreuzungen');
}

console.log('== Rechtwinklig: Kreuzungen je Flussrichtung ==');
{
  // Vor der umwegbewussten Gruppenprüfung: TB 64, BT 63, LR 60, RL 59;
  // vor der Nachsortierung der Anschlüsse TB 60, BT 57, LR 60, RL 59.
  for(const [dir, grenze] of [['TB', 58], ['BT', 56], ['LR', 57], ['RL', 56]]){
    layoutMit('ortho', dir);
    const n = alleKreuzungen();
    t(`${dir}: höchstens ${grenze} geroutete Kreuzungen`, n <= grenze, n + ' Kreuzungen');
  }
}

console.log('== Rechtwinklig: Züge bleiben nahe an ihrem Anschluss-Intervall ==');
{
  // Vor der Korrektur: 13 Züge (TB) bzw. 8 (LR) außerhalb.
  for(const [dir, grenze] of [['TB', 13], ['LR', 8]]){
    layoutMit('ortho', dir);
    let raus = 0;
    S.graph.edges.forEach(e=>{ if(umwegVon(e, dir) > 30) raus++; });
    t(`${dir}: höchstens ${grenze} Züge holen mehr als 30 px aus`, raus <= grenze, raus + ' Züge');
  }
}

console.log('== Weiche Führung: „Tasse" läuft gerade, ohne Umweg-Veto ==');
{
  /* Das Umweg-Veto in fuehreBeste() ist wieder draußen. Es war gegen einen
     hierarchischen Umweg gebaut, den der Commit davor („Die Luftlinie darf
     keine neuen Kästen anschneiden") längst beseitigt hatte — die Vorlage
     stammte aus einem älteren Export. Statt zu helfen hob es den Umweg von 0
     auf 14 px und kostete acht Kreuzungen. */
  layoutMit('hier', 'TB');
  const e = mitLabel('Tasse');
  if(e) t('TB: „Tasse" läuft hierarchisch ohne Umweg', umwegVon(e, 'TB') <= 5,
          Math.round(umwegVon(e, 'TB')) + ' px');
  for(const [dir, grenze] of [['TB', 68], ['BT', 66], ['LR', 57], ['RL', 55]]){
    layoutMit('hier', dir);
    const n = alleKreuzungen();
    t(`${dir}: hierarchisch höchstens ${grenze} Kreuzungen`, n <= grenze, n + ' Kreuzungen');
  }
}

finish();
})();
