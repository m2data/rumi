/* Rauchtest: Quelle und Domäne als eigene Elemente (Einstellungen). Ersetzt
   die früheren Ansichten 2 und 3: ein Haken je Element, gültig in
   Komplettansicht und Hierarchie. Jedes Objekt bekommt eigene Kästen, die
   rechts neben ihm stehen und mit ihm ein- und ausgeblendet werden. */
const {bootApp, makeT} = require('./start');

(async ()=>{
const {S, api, win, document, dispatch} = await bootApp();
const {t, finish} = makeT();

const haken = id => dispatch(document.getElementById(id), 'click', {});
const anh = ()=> S.graph.nodes.filter(n => n.eltern);
const rechtsDaneben = n =>{
  const p = S.graph.byId.get(n.eltern);
  return n.x >= p.x + p.w && n.x - (p.x + p.w) <= 30;
};

console.log('== Keine Ansicht-Reiter mehr ==');
{
  t('die Reiter Ansicht 1–3 sind weg', !document.querySelector('.view-btn'));
  t('Einstellungen bieten Quellen und Domäne', !!document.getElementById('optQuelle') && !!document.getElementById('optDomaene'));
}

console.log('== Komplettansicht: Quellen als eigene Elemente ==');
{
  api.setMode('komplett');
  api.setView();
  const lage = {};
  S.graph.nodes.forEach(n=>{ lage[n.id] = {x:n.x, y:n.y}; });
  t('vorher keine Anhängsel', anh().length === 0);

  haken('optQuelle');
  t('Haken ist gesetzt', document.getElementById('optQuelle').getAttribute('aria-checked') === 'true');
  const quellen = Object.values(S.model.objects).reduce((s, o)=> s + o.sources.length, 0);
  const q = anh().filter(n => n.kind === 'source');
  t('je Objekt und Quelle ein eigener Kasten', q.length === quellen, q.length + ' statt ' + quellen);
  const kq = S.graph.edges.filter(e => e.kind === 'quelle');
  t('verbunden über „quelle"', kq.length === quellen && kq.every(e => e.label === 'quelle' && !e.fromCard && !e.toCard));
  t('die gelegten Objekte bleiben liegen',
    Object.keys(lage).every(id => S.graph.byId.get(id).x === lage[id].x && S.graph.byId.get(id).y === lage[id].y));
  const falsch = q.filter(n => !rechtsDaneben(n));
  t('jede Quelle steht rechts neben ihrem Objekt', !falsch.length, falsch.map(n => n.id).join(', '));
  t('die Quellzeile verschwindet aus dem Kasten',
    S.graph.nodes.filter(n => !n.eltern).every(n => !n.rows.some(r => r.kind === 'src')));
  const opt = document.getElementById('contentList').querySelector('[data-content="sources"]');
  t('„Quellen" im Inhalt ist gesperrt', opt.classList.contains('off') && opt.getAttribute('aria-checked') === 'false');
  t('die Legende erklärt die Quellenkante', /Quelle, ohne Kardinalität/.test(document.getElementById('legend').innerHTML));
  t('die Objektliste zeigt nur Geschäftsobjekte',
    document.getElementById('objectList').querySelectorAll('.ochk').length === Object.keys(S.model.objects).length);
}

console.log('== Komplettansicht: Domäne als eigenes Element ==');
{
  haken('optDomaene');
  const d = anh().filter(n => n.kind === 'domain');
  const mitDomaene = Object.values(S.model.objects).filter(o => o.domain).length;
  t('je Objekt ein Domänenkasten', d.length === mitDomaene, d.length + ' statt ' + mitDomaene);
  t('verbunden über „Domäne"', S.graph.edges.filter(e => e.kind === 'domaene').every(e => e.label === 'Domäne'));
  const falsch = d.filter(n => !rechtsDaneben(n));
  t('jede Domäne steht rechts neben ihrem Objekt', !falsch.length, falsch.map(n => n.id).join(', '));
  const opt = document.getElementById('contentList').querySelector('[data-content="domain"]');
  t('„Domain" im Inhalt ist gesperrt', opt.classList.contains('off'));
  t('die Kante wird gezeichnet', /class="eg domaene/.test(document.getElementById('edges').innerHTML));
}

console.log('== Kreisförmig: Anhängsel außerhalb des Kreises ==');
{
  /* Über das Menü, also den Weg der App (je Zusammenhangskomponente). Ein
     unverbundenes Objekt (href_termintreue) steht neben dem Kreis, seine
     Anhängsel rechts davon. */
  const vorher = S.layout.algo;
  [...document.getElementById('layoutMenu').querySelectorAll('.opt[data-algo]')]
    .find(b => b.dataset.algo === 'circ').onclick();
  const rel = S.graph.edges.filter(e => e.kind === 'rel');
  const verbunden = n => rel.some(e => e.from === n.id || e.to === n.id);
  const obj = S.graph.nodes.filter(n => !n.eltern && !n.hidden && verbunden(n));
  const cx = obj.reduce((s,n)=> s + n.x + n.w/2, 0) / obj.length;
  const cy = obj.reduce((s,n)=> s + n.y + n.h/2, 0) / obj.length;
  const ab = n => Math.hypot(n.x + n.w/2 - cx, n.y + n.h/2 - cy);
  const amKreis = anh().filter(n => verbunden(S.graph.byId.get(n.eltern)));
  const innen = amKreis.filter(n => ab(n) <= ab(S.graph.byId.get(n.eltern)));
  t('alle Anhängsel am Kreis liegen außen', amKreis.length > 0 && !innen.length, innen.map(n => n.id).join(', '));
  const allein = S.graph.byId.get('o:href_termintreue');
  const kreisRand = Math.max(...obj.map(n => ab(n) + Math.hypot(n.w, n.h)/2));
  t('das unverbundene Objekt steht neben dem Kreis', ab(allein) > kreisRand, Math.round(ab(allein)) + ' / ' + Math.round(kreisRand));
  const seine = anh().filter(n => n.eltern === allein.id);
  t('seine Anhängsel stehen rechts davon', seine.length > 0 && seine.every(n => n.x >= allein.x + allein.w));
  [...document.getElementById('layoutMenu').querySelectorAll('.opt[data-algo]')]
    .find(b => b.dataset.algo === vorher).onclick();
}

console.log('== Ziehen: Anhängsel wandern mit, lassen sich aber allein ziehen ==');
{
  const svg = document.getElementById('canvas');
  const kasten = id => [...document.getElementById('nodes').querySelectorAll('.node')].find(g => g.dataset.id === id);
  const lage = id => { const n = S.graph.byId.get(id); return {x:n.x, y:n.y}; };
  const ziehe = (id, dx, dy)=>{
    dispatch(kasten(id), 'pointerdown', {clientX:0, clientY:0});
    dispatch(svg, 'pointermove', {clientX:dx, clientY:dy});
    dispatch(svg, 'pointerup', {clientX:dx, clientY:dy});
  };
  api.setSelection([]);
  const id = 'o:Bestellung';
  const eigene = anh().filter(n => n.eltern === id).map(n => n.id);
  const objVor = lage(id), anhVor = eigene.map(lage);
  ziehe(id, 60, 30);
  const ddx = lage(id).x - objVor.x, ddy = lage(id).y - objVor.y;
  t('das Objekt ist gewandert', ddx !== 0 || ddy !== 0);
  t('seine Anhängsel um denselben Versatz', eigene.length > 0 &&
    eigene.every((a, i)=> lage(a).x - anhVor[i].x === ddx && lage(a).y - anhVor[i].y === ddy),
    eigene.map((a, i)=> (lage(a).x - anhVor[i].x) + '/' + (lage(a).y - anhVor[i].y)).join(' ') + ' statt ' + ddx + '/' + ddy);
  t('markiert ist nur das Objekt', S.sel.size === 1 && S.sel.has(id));

  api.setSelection([]);
  const einer = eigene[0], objFest = lage(id), einerVor = lage(einer);
  ziehe(einer, 40, 40);
  t('ein Anhängsel lässt sich allein ziehen', lage(einer).x !== einerVor.x || lage(einer).y !== einerVor.y);
  t('sein Objekt bleibt dabei liegen', lage(id).x === objFest.x && lage(id).y === objFest.y);

  // Pfeiltasten: dasselbe
  api.setSelection([id]);
  const p0 = lage(id), a0 = eigene.map(lage);
  dispatch(svg, 'keydown', {key:'ArrowRight'});
  const px = lage(id).x - p0.x;
  t('Pfeiltaste verschiebt das Objekt', px > 0);
  t('und seine Anhängsel mit', eigene.every((a, i)=> lage(a).x - a0[i].x === px));
  api.setSelection([]);
}

console.log('== Anhängsel gehen mit ihrem Objekt ==');
{
  const id = 'o:Bestellung';
  const chk = document.getElementById('objectList').querySelector(`.ochk[data-id="${id}"]`);
  chk.checked = false; dispatch(chk, 'change', {});
  const eigene = anh().filter(n => n.eltern === id);
  t('ausgeblendetes Objekt nimmt seine Anhängsel mit', eigene.length > 0 && eigene.every(n => n.hidden));
  const chk2 = document.getElementById('objectList').querySelector(`.ochk[data-id="${id}"]`);
  chk2.checked = true; dispatch(chk2, 'change', {});
  t('eingeblendet sind sie wieder da', eigene.every(n => !n.hidden));
}

console.log('== Einstellung wird gemerkt ==');
{
  const sitzung = JSON.parse(win.sessionStorage.getItem('sitzung'));
  t('in der Sitzung abgelegt', sitzung.elemente && sitzung.elemente.quelle === true && sitzung.elemente.domaene === true,
    JSON.stringify(sitzung.elemente));
  const stand = Object.assign({}, sitzung, {elemente:{quelle:false, domaene:true}});
  await api.loadYaml(S.yamlText, S.fileName, stand);
  t('ein geladener Stand bringt seine Einstellung mit',
    S.elemente.quelle === false && S.elemente.domaene === true && anh().every(n => n.kind === 'domain') && anh().length > 0);
}

console.log('== Strg+Z nimmt die Einstellung zurück ==');
{
  const vor = S.elemente.quelle;
  haken('optQuelle');
  t('umgeschaltet', S.elemente.quelle === !vor);
  dispatch(document.getElementById('canvas'), 'keydown', {key:'z', ctrlKey:true});
  t('Strg+Z stellt den Haken zurück', S.elemente.quelle === vor);
  t('die Kästen folgen', anh().some(n => n.kind === 'source') === vor);
  t('und das Menü zeigt den alten Stand',
    document.getElementById('optQuelle').getAttribute('aria-checked') === String(vor));
  dispatch(document.getElementById('canvas'), 'keydown', {key:'y', ctrlKey:true});
  t('Strg+Y schaltet wieder um', S.elemente.quelle === !vor);
  haken('optQuelle');                         // Ausgangsstand für die folgenden Abschnitte
}

console.log('== Hierarchie: dieselben Elemente, nur für sichtbare Objekte ==');
{
  S.elemente = {quelle:true, domaene:true};
  api.setMode('hierarchie');
  const vis = S.graph.nodes.filter(n => !n.hidden);
  const objekte = vis.filter(n => !n.eltern), anhaengsel = vis.filter(n => n.eltern);
  t('Diagramm zeigt Anhängsel', anhaengsel.length > 0);
  t('nur an sichtbaren Objekten', anhaengsel.every(n => !S.graph.byId.get(n.eltern).hidden));
  t('jedes sichtbare Objekt hat seine Domäne',
    objekte.filter(n => n.ref.domain).every(n => anhaengsel.some(a => a.eltern === n.id && a.kind === 'domain')));
  const falsch = anhaengsel.filter(n => !rechtsDaneben(n));
  t('rechts neben ihrem Objekt', !falsch.length, falsch.map(n => n.id).join(', '));

  // Umschalten im Hierarchie-Modus: Gelegtes bleibt, Neues kommt rechts dazu
  haken('optQuelle');
  t('Quellen ausgeschaltet: keine Quellkästen mehr', !S.graph.nodes.some(n => n.kind === 'source'));
  const lage = {};
  S.graph.nodes.filter(n => !n.hidden && !n.eltern).forEach(n=>{ lage[n.id] = {x:n.x, y:n.y}; });
  haken('optQuelle');
  t('wieder eingeschaltet: die Objekte bleiben liegen',
    Object.keys(lage).every(id => S.graph.byId.get(id).x === lage[id].x && S.graph.byId.get(id).y === lage[id].y));
  const neu = S.graph.nodes.filter(n => !n.hidden && n.kind === 'source');
  t('und die Quellen stehen rechts daneben', neu.length > 0 && neu.every(rechtsDaneben),
    neu.filter(n => !rechtsDaneben(n)).map(n => n.id).join(', '));
}

finish();
})();
