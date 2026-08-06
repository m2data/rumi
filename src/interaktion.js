/* =====================================================================
   9 — Zeiger-Interaktion auf der Zeichenfläche
   Eine Zustandsmaschine mit genau EINER aktiven Interaktion: `zeiger.art`
   benennt sie ausdrücklich, statt acht paralleler Variablen (drag, pan,
   bendDrag, …), deren Kombinationen früher für Fehler sorgten (Klick wählte
   sofort wieder ab, der zweite Klick eines Doppelklicks traf einen Griff,
   verlorene pointerups ließen alte Züge weiterlaufen).

   Arten und ihre Daten:
     beschriftung  {e}                                Label entlang der Kante
     schleife      {e, n}                             Selbstbezug am Scheitel
     stuetzpunkt   {e, i, sx, sy, ox, oy}             Knick verschieben
     anschluss     {e, which, n}                      Anschlusspunkt am Kasten
     segment       {e, axis, ends, sx, sy, base}      Ortho-Teilstück quer
     knoten        {n, items, inner, outer, sx, sy,   Knoten/Auswahl ziehen
                    moved, wasSel, additive}
     rahmen        {x0, y0, x1, y1}                   Auswahlrahmen (Umschalt)
     schwenk       {sx, sy, ox, oy}                   Zeichenfläche schieben
   ===================================================================== */

let zeiger = null;
let lastEdgeTap = null;             // für die Doppelklick-Erkennung auf Kanten

/* Der Auswahlrahmen, falls gerade einer aufgezogen wird (für drawHandles). */
function bandRect(){ return (zeiger && zeiger.art === 'rahmen') ? zeiger : null; }

/* Zeigerlage in Weltkoordinaten der Zeichenfläche */
function weltPunkt(ev){
  const r = svg.getBoundingClientRect();
  return {x:(ev.clientX - r.left - S.t.x)/S.t.k, y:(ev.clientY - r.top - S.t.y)/S.t.k};
}

svg.addEventListener('pointerdown', ev=>{
  // Sicherheitsnetz: ein verlorenes pointerup ließe sonst eine alte Interaktion
  // weiterlaufen und alle folgenden Bewegungen abfangen.
  zeiger = null;
  const t = ev.target;

  // Beschriftung entlang der Kante verschieben
  if(t.dataset && t.dataset.lbl){
    const e = S.graph.edges.find(x => x.id === t.dataset.lbl);
    if(e){
      svg.setPointerCapture(ev.pointerId);
      zeiger = {art:'beschriftung', e};
      ev.preventDefault(); return;
    }
  }

  // Doppelklick auf eine Kante (zweimal dieselbe binnen 350 ms) löscht alle
  // Stützpunkte. Ganz vorne geprüft, weil nach dem Auswählen Segment- und
  // Zusatzpunkt-Griffe über der Linie liegen — sonst würde der zweite Klick
  // einen Stützpunkt setzen statt zu löschen. Ein nativer dblclick käme wegen
  // des Neuzeichnens bei jedem Klick ohnehin nicht zustande.
  {
    const egEl = t.closest && t.closest('.eg');
    const onHandle = (t.classList && (t.classList.contains('hnd') || t.classList.contains('seg')
                    || t.classList.contains('gh') || t.classList.contains('pt')))
                    || (t.dataset && t.dataset.loop);
    const edgeId = egEl ? egEl.dataset.id : (onHandle ? S.selEdge : null);
    if(edgeId){
      if(lastEdgeTap && lastEdgeTap.id === edgeId && ev.timeStamp - lastEdgeTap.t < 350){
        lastEdgeTap = null;
        const e = S.graph.edges.find(x => x.id === edgeId);
        if(e && (e.bends && e.bends.length || e.portFrom || e.portTo)){
          // Auf die kürzeste Verbindung zurücksetzen: Stützpunkte UND Anschluss-
          // punkte lösen, gerade Direktlinie. Neue Stützpunkte folgen danach
          // wieder dem gewählten Verfahren.
          e.bends = null; e.portFrom = null; e.portTo = null; e.ortho = false; e.manual = true;
          S.selEdge = edgeId; S.selected = null; S.sel.clear();
          draw(); renderDetails(); syncLayoutMenu(); updateAlignBar(); persist();
          toast('Stützpunkte gelöscht — kürzeste Verbindung');
        }
        ev.preventDefault(); return;
      }
      lastEdgeTap = {id: edgeId, t: ev.timeStamp};
    }
  }

  // Selbstbezug-Schleife am Scheitel verschieben (vor dem Anschlusspunkt prüfen)
  if(t.dataset && t.dataset.loop){
    const e = S.graph.edges.find(x => x.id === S.selEdge);
    const n = e && S.graph.byId.get(e.from);
    if(!e || !n) return;
    svg.setPointerCapture(ev.pointerId);
    zeiger = {art:'schleife', e, n};
    ev.preventDefault(); return;
  }

  // Stützpunkt greifen oder entfernen
  if(t.classList && t.classList.contains('hnd')){
    const e = S.graph.edges.find(x => x.id === S.selEdge);
    const i = +t.dataset.bend;
    if(!e || !e.bends) return;
    if(ev.altKey){
      e.bends.splice(i, 1);
      if(!e.bends.length) e.bends = null;
      e.manual = true; e.ortho = S.layout.algo === 'ortho';   // im Ortho-Modus eckig bleiben
      drawEdges(); persist();
      ev.preventDefault(); return;
    }
    // Zeiger auf der Zeichenfläche fangen, nicht auf dem Griff: der Griff wird
    // beim Neuzeichnen ersetzt und würde die Erfassung mitnehmen.
    svg.setPointerCapture(ev.pointerId);
    zeiger = {art:'stuetzpunkt', e, i, sx:ev.clientX, sy:ev.clientY, ox:e.bends[i].x, oy:e.bends[i].y};
    ev.preventDefault(); return;
  }

  // Anschlusspunkt am Knoten verschieben
  if(t.classList && t.classList.contains('pt')){
    const e = S.graph.edges.find(x => x.id === S.selEdge);
    if(!e) return;
    const which = t.dataset.port === 'from' ? 'portFrom' : 'portTo';
    const n = S.graph.byId.get(which === 'portFrom' ? e.from : e.to);
    if(!n) return;
    if(!e[which]){
      if(e.from === e.to){
        // Selbstbezug: aus der aktuellen Schleifengeometrie übernehmen, damit
        // der Anschlusspunkt beim Anfassen nicht wegspringt.
        const g = loopGeom(n, e), p = which === 'portFrom' ? g.p1 : g.p2;
        e[which] = nearestPort(n, p.x, p.y);
      } else {
        const o = S.graph.byId.get(which === 'portFrom' ? e.to : e.from);
        e[which] = nearestPort(n, o.x + o.w/2, o.y + o.h/2);
      }
    }
    svg.setPointerCapture(ev.pointerId);
    zeiger = {art:'anschluss', e, which, n};
    ev.preventDefault(); return;
  }

  // Teilstück einer rechtwinkligen Kante quer verschieben
  if(t.classList && t.classList.contains('seg')){
    const e = S.graph.edges.find(x => x.id === S.selEdge);
    const A = e && S.graph.byId.get(e.from), B = e && S.graph.byId.get(e.to);
    if(!e || !A || !B) return;
    const i = +t.dataset.seg;
    const pts = routePoints(e, A, B);
    const axis = Math.abs(pts[i].x - pts[i+1].x) < 1 ? 'x' : 'y';
    // Enden des Teilstücks: Stützpunkt oder Anschlusspunkt am Knoten
    const ends = [i, i+1].map(k=>{
      if(k === 0) return {port:'portFrom', node:A};
      if(k === pts.length-1) return {port:'portTo', node:B};
      return {bend: k-1};
    });
    svg.setPointerCapture(ev.pointerId);
    zeiger = {art:'segment', e, axis, ends, sx:ev.clientX, sy:ev.clientY,
              base: axis === 'x' ? pts[i].x : pts[i].y};
    ev.preventDefault(); return;
  }

  // Neuen Stützpunkt einfügen und sofort ziehen
  if(t.classList && t.classList.contains('gh')){
    const e = S.graph.edges.find(x => x.id === S.selEdge);
    const A = e && S.graph.byId.get(e.from), B = e && S.graph.byId.get(e.to);
    if(!e || !A || !B) return;
    const i = +t.dataset.add;
    const pts = routePoints(e, A, B);
    const p = pts[i], q = pts[i+1];
    const m = {x:(p.x + q.x)/2, y:(p.y + q.y)/2};
    e.bends = e.bends || [];
    e.manual = true;
    e.ortho = S.layout.algo === 'ortho';   // Form nach dem zuletzt gewählten Verfahren
    svg.setPointerCapture(ev.pointerId);

    if(e.ortho && !e.bends.length){
      // Direktverbindung (noch ohne Stützpunkte): sauberer Stufenzug mit ZWEI
      // Punkten — wie eine automatisch gezogene Kante, nicht vier Punkte. Damit
      // alle drei Strecken rechtwinklig sind, werden die Anschlusspunkte
      // senkrecht zur Flussrichtung mittig gesetzt (sonst projiziert edgeEnd vom
      // Zentrum und das erste Stück liefe schräg). Das mittlere Teilstück wird
      // gezogen.
      const flowVert = S.layout.dir === 'TB' || S.layout.dir === 'BT';
      if(flowVert){
        const down = (A.y + A.h/2) <= (B.y + B.h/2);
        e.portFrom = {side: down ? 'B' : 'T', t:0.5};
        e.portTo   = {side: down ? 'T' : 'B', t:0.5};
        const fx = Math.round(A.x + A.w/2), tx = Math.round(B.x + B.w/2), yMid = Math.round(m.y);
        e.bends = [{x:fx, y:yMid}, {x:tx, y:yMid}];
        zeiger = {art:'segment', e, axis:'y', ends:[{bend:0}, {bend:1}], sx:ev.clientX, sy:ev.clientY, base:yMid};
      } else {
        const right = (A.x + A.w/2) <= (B.x + B.w/2);
        e.portFrom = {side: right ? 'R' : 'L', t:0.5};
        e.portTo   = {side: right ? 'L' : 'R', t:0.5};
        const fy = Math.round(A.y + A.h/2), ty = Math.round(B.y + B.h/2), xMid = Math.round(m.x);
        e.bends = [{x:xMid, y:fy}, {x:xMid, y:ty}];
        zeiger = {art:'segment', e, axis:'x', ends:[{bend:0}, {bend:1}], sx:ev.clientX, sy:ev.clientY, base:xMid};
      }
      drawEdges();
    } else if(e.ortho){
      // Mittelsegment eines bestehenden Zuges versetzen: vier Punkte halten die
      // beiden Stub-Enden achsparallel (paarweise deckungsgleich bis zum Ziehen).
      const vert = Math.abs(p.x - q.x) < 1;
      const d = Math.min(24, Math.hypot(q.x - p.x, q.y - p.y) / 4);
      const mk = (o)=> vert ? {x:m.x, y:Math.round(m.y + o)} : {x:Math.round(m.x + o), y:m.y};
      e.bends.splice(i, 0, mk(-d), mk(-d), mk(d), mk(d));
      drawEdges();
      zeiger = {art:'segment', e, axis: vert ? 'x' : 'y',
                ends: [{bend:i+1}, {bend:i+2}],
                sx:ev.clientX, sy:ev.clientY,
                base: vert ? m.x : m.y};
    } else {
      e.bends.splice(i, 0, m);
      drawEdges();
      zeiger = {art:'stuetzpunkt', e, i, sx:ev.clientX, sy:ev.clientY, ox:m.x, oy:m.y};
    }
    ev.preventDefault(); return;
  }

  // Kante auswählen (Doppelklick zum Stützpunkt-Löschen ist oben behandelt)
  const eg = t.closest && t.closest('.eg');
  if(eg){
    const id = eg.dataset.id;
    S.selEdge = (S.selEdge === id) ? null : id;
    S.selected = null; S.sel.clear();
    draw(); renderDetails(); syncLayoutMenu(); updateAlignBar();
    document.querySelectorAll('#objectList button').forEach(b=> b.setAttribute('aria-current','false'));
    ev.preventDefault(); return;
  }

  // Knoten (bzw. die ganze Auswahl) greifen
  const g = ev.target.closest('.node');
  if(g){
    const n = S.graph.byId.get(g.dataset.id);
    if(!n) return;
    g.setPointerCapture(ev.pointerId);
    const wasSel = S.sel.has(n.id);
    const additive = ev.shiftKey || ev.ctrlKey || ev.metaKey;
    // Wird ein Knoten aus der Auswahl gegriffen, wandert die ganze Auswahl mit.
    // Bei additivem Klick nicht vorwählen — das erledigt select() beim Loslassen.
    if(!wasSel && !additive) setSelection([n.id]);
    const moving = new Set(S.sel.size ? S.sel : [n.id]);
    const items = [...moving].map(id=>{
      const nn = S.graph.byId.get(id);
      return nn && !nn.hidden
        ? {n:nn, g:gNodes.querySelector('[data-id="' + CSS.escape(id) + '"]'), ox:nn.x, oy:nn.y}
        : null;
    }).filter(x => x && x.g);

    // Kanten innerhalb der Auswahl wandern starr mit; Kanten nach außen werden
    // gelöst und neu gezogen — aber erst beim tatsächlichen Verschieben (siehe
    // pointermove), nicht schon beim bloßen Anklicken.
    const inner = [], outer = [];
    S.graph.edges.forEach(e=>{
      const a = moving.has(e.from), b = moving.has(e.to);
      if(a && b && e.bends) inner.push({e, orig: e.bends.map(q=>({x:q.x, y:q.y}))});
      else if(a !== b && !e.manual) outer.push(e);
    });
    zeiger = {art:'knoten', n, items, inner, outer, sx:ev.clientX, sy:ev.clientY,
              moved:false, wasSel, additive};
    ev.preventDefault();
    return;
  }

  // Hintergrund: Kante abwählen, Rahmen aufziehen (Umschalt) oder schwenken
  if(S.selEdge){ S.selEdge = null; draw(); }
  if(ev.shiftKey){
    const w = weltPunkt(ev);
    zeiger = {art:'rahmen', x0:w.x, y0:w.y, x1:w.x, y1:w.y};
    svg.setPointerCapture(ev.pointerId);
    ev.preventDefault();
    return;
  }
  if(S.sel.size) setSelection([]);
  zeiger = {art:'schwenk', sx:ev.clientX, sy:ev.clientY, ox:S.t.x, oy:S.t.y};
  svg.setPointerCapture(ev.pointerId);
  svg.classList.add('panning');
});

svg.addEventListener('pointermove', ev=>{
  if(!zeiger) return;
  const z = zeiger;

  // Wird an einer Kante gezogen, zählt der vorherige Klick nicht als erster
  // Teil eines Doppelklicks.
  if(z.art !== 'knoten' && z.art !== 'rahmen' && z.art !== 'schwenk') lastEdgeTap = null;

  if(z.art === 'beschriftung'){
    const w = weltPunkt(ev);
    const e = z.e, A = S.graph.byId.get(e.from), B = S.graph.byId.get(e.to);
    if(A && B){
      if(A === B){
        // Selbstbezug: den Zeiger auf den nächstgelegenen Punkt der Schleife legen
        const g = loopGeom(A, e);
        let bestT = 0.5, bd = Infinity;
        for(let i = 0; i <= 64; i++){
          const t = i/64, p = loopPoint(g, t), d = Math.hypot(p.x - w.x, p.y - w.y);
          if(d < bd){ bd = d; bestT = t; }
        }
        e.labelT = bestT;
      } else {
        e.labelT = nearestOnPoly(routePoints(e, A, B), w.x, w.y).t;
      }
      e.labelManual = true;                    // von Hand platziert: bleibt beim Entzerren stehen
      drawEdges();
    }
    return;
  }
  if(z.art === 'schleife'){
    const w = weltPunkt(ev);
    const n = z.n;
    z.e.loop = {dx: Math.round(w.x - (n.x + n.w/2)), dy: Math.round(w.y - (n.y + n.h/2))};
    z.e.manual = true;
    drawEdges();
    return;
  }
  if(z.art === 'anschluss'){
    const w = weltPunkt(ev);
    z.e[z.which] = nearestPort(z.n, w.x, w.y);
    alignStub(z.e, z.which);
    z.e.manual = true;
    drawEdges();
    return;
  }
  if(z.art === 'segment'){
    const delta = (z.axis === 'x' ? ev.clientX - z.sx : ev.clientY - z.sy) / S.t.k;
    const v = Math.round(z.base + delta);
    z.ends.forEach(end=>{
      if(end.bend !== undefined){
        if(!z.e.bends || !z.e.bends[end.bend]) return;
        z.e.bends[end.bend][z.axis] = v;
      } else {
        // Anschlusspunkt kann nur längs seiner Knotenkante rutschen
        const port = z.e[end.port], n = end.node;
        if(!port) return;
        const along = (port.side === 'T' || port.side === 'B') ? 'x' : 'y';
        if(along !== z.axis) return;
        const t2 = along === 'x' ? (v - n.x) / n.w : (v - n.y) / n.h;
        port.t = Math.min(0.92, Math.max(0.08, t2));
      }
    });
    z.e.manual = true;
    drawEdges();
    return;
  }
  if(z.art === 'stuetzpunkt'){
    let x = z.ox + (ev.clientX - z.sx)/S.t.k;
    let y = z.oy + (ev.clientY - z.sy)/S.t.k;
    // Sanftes Einrasten auf die Nachbarpunkte hält rechtwinklige Züge sauber
    const A = S.graph.byId.get(z.e.from), B = S.graph.byId.get(z.e.to);
    const pts = routePoints(z.e, A, B);
    [pts[z.i], pts[z.i + 2]].forEach(q=>{
      if(!q) return;
      if(Math.abs(q.x - x) < 7) x = q.x;
      if(Math.abs(q.y - y) < 7) y = q.y;
    });
    z.e.bends[z.i] = {x:Math.round(x), y:Math.round(y)};
    z.e.manual = true;
    drawEdges();
    return;
  }
  if(z.art === 'knoten'){
    const dx = (ev.clientX - z.sx)/S.t.k, dy = (ev.clientY - z.sy)/S.t.k;
    if(!z.moved && Math.abs(dx) + Math.abs(dy) > 2) z.moved = true;   // erst ab echter Bewegung
    z.items.forEach(it=>{
      it.n.x = Math.round(it.ox + dx); it.n.y = Math.round(it.oy + dy);
      it.g.setAttribute('transform', `translate(${it.n.x},${it.n.y})`);
    });
    z.inner.forEach(({e, orig})=>{
      e.bends = orig.map(q=>({x:Math.round(q.x + dx), y:Math.round(q.y + dy)}));
    });
    // Kanten über die Auswahlgrenze folgen der Bewegung: bei jedem Schritt neu
    // geformt, damit sie im Ortho-Modus rechtwinklig bleiben.
    if(z.moved) z.outer.forEach(loosenEdge);
    drawEdges();
    return;
  }
  if(z.art === 'rahmen'){
    const w = weltPunkt(ev);
    z.x1 = w.x; z.y1 = w.y;
    drawHandles();
    return;
  }
  if(z.art === 'schwenk'){
    S.t.x = z.ox + (ev.clientX - z.sx);
    S.t.y = z.oy + (ev.clientY - z.sy);
    applyTransform();
  }
});

function endPointer(){
  if(!zeiger) return;
  const z = zeiger;
  zeiger = null;

  switch(z.art){
    case 'beschriftung':
    case 'schleife':
    case 'segment':
    case 'stuetzpunkt':
      persist();
      break;
    case 'anschluss':
      // Ortho-Kante ohne Knick, die jetzt schräg läuft, in echte Ecken überführen —
      // damit Segment- und Stützpunktgriffe erscheinen und sie bearbeitbar bleibt.
      if(materializeOrtho(z.e)) drawEdges();
      persist();
      break;
    case 'knoten':
      if(z.moved){
        // Beschriftungen der mitbewegten Kanten entzerren (manuelle bleiben stehen)
        const moved = new Set(z.items.map(it => it.n.id));
        spreadLabels(S.graph.edges.filter(e => moved.has(e.from) || moved.has(e.to)));
        drawEdges();
        persist();
      }
      else if(z.additive) select(z.n.id, false, true);        // additiv umschalten
      else if(z.wasSel && S.sel.size === 1) setSelection([]);  // erneuter Klick auf einzelne Auswahl -> abwählen
      else setSelection([z.n.id]);                             // einfacher Klick -> markiert lassen
      break;
    case 'rahmen': {
      const x0 = Math.min(z.x0, z.x1), x1 = Math.max(z.x0, z.x1);
      const y0 = Math.min(z.y0, z.y1), y1 = Math.max(z.y0, z.y1);
      const hit = visNodes().filter(n => n.x < x1 && n.x + n.w > x0 && n.y < y1 && n.y + n.h > y0);
      setSelection(hit.map(n=>n.id));
      if(hit.length) toast(hit.length + (hit.length === 1 ? ' Objekt gewählt' : ' Objekte gewählt'));
      break;
    }
    case 'schwenk':
      svg.classList.remove('panning');
      break;
  }
}
svg.addEventListener('pointerup', endPointer);
svg.addEventListener('pointercancel', endPointer);
svg.addEventListener('lostpointercapture', endPointer);
