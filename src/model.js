/* =====================================================================
   2 — Modell aufbauen und prüfen
   ===================================================================== */
const CARD_LABEL = {
  exactly_one:'genau 1', zero_or_one:'0 oder 1',
  zero_or_many:'0 bis n', one_or_many:'1 bis n', many:'n'
};

/* Eine Beziehung kann auf vier Arten notiert sein:
     A  - to: Position                    (Name optional über "name:")
          name: enthält
     B  - enthält:                        Name als Schlüssel, Rumpf eingerückt
            to: Position
     C  - enthält:                        wie B, aber flach eingerückt
          to: Position
     D  relationships:                    Abbildung statt Liste
          enthält:
            to: Position
   Reservierte Felder, die nie als Name gelten. */
const REL_FIELDS = new Set(['to','name','label','bezeichnung','rolle','cardinality','kardinalitaet']);

function readRel(entry, keyName){
  if(!entry || typeof entry !== 'object') return null;
  let name = keyName || null, body = entry;

  if(!entry.to){                                    // Form B / D: Rumpf unter dem Namen
    const k = Object.keys(entry).find(k =>
      !REL_FIELDS.has(k) && entry[k] && typeof entry[k] === 'object' && entry[k].to);
    if(k){ name = name || k; body = entry[k]; }
  }
  if(!body.to) return null;

  const explicit = body.name || body.label || body.bezeichnung || body.rolle || null;
  if(!explicit && !name && body === entry){         // Form C: Name als wertloser Schlüssel
    const k = Object.keys(entry).find(k => !REL_FIELDS.has(k) && entry[k] === null);
    if(k) name = k;
  }

  const card = body.cardinality || body.kardinalitaet || null;
  return {
    to: body.to,
    name: explicit || name || null,
    from: (card && card.from) || null,
    toCard: (card && card.to) || null
  };
}

function readRels(raw, objName, messages){
  let list = [];
  if(Array.isArray(raw)) list = raw.map(r => readRel(r));
  else if(raw && typeof raw === 'object')
    list = Object.entries(raw).map(([k, v]) => readRel(v && typeof v === 'object' ? v : {}, k));
  const bad = list.filter(r => !r).length;
  if(bad) messages.push({level:'err', group:'Beziehung unlesbar', obj:objName, title:`${objName}: ${bad} Beziehung(en) unlesbar`,
    body:'Ein Eintrag unter "relationships" enthält kein Ziel. Erwartet wird "to:" — entweder direkt oder im Rumpf unter dem Beziehungsnamen.'});
  return list.filter(Boolean);
}

function buildModel(text){
  const {doc, notes} = readYaml(text);
  const messages = notes.slice();

  const rootKey = ['BusinessObjects','businessObjects','business_objects','Geschaeftsobjekte']
    .find(k => doc && doc[k] && typeof doc[k] === 'object');
  if(!rootKey) throw new Error('Kein Abschnitt "BusinessObjects" gefunden.');

  /* Optionaler Kopf: Herkunft und Lizenz des Modells. Gehört zu den Daten,
     nicht zum Werkzeug — deshalb steht es in der Modelldatei. */
  const mRaw = (doc.meta && typeof doc.meta === 'object') ? doc.meta : {};
  const meta = {
    titel:     mRaw.titel || mRaw.title || null,
    urheber:   mRaw.urheber || mRaw.autor || mRaw.author || mRaw.quelle || null,
    lizenz:    mRaw.lizenz || mRaw.license || null,
    lizenzUrl: mRaw.lizenz_url || mRaw.license_url || mRaw.url || null,
    hinweis:   mRaw.hinweis || mRaw.note || null
  };
  const META_KEYS = new Set([rootKey, 'meta']);

  Object.keys(doc).forEach(k=>{
    if(!META_KEYS.has(k)) messages.push({level:'err', group:'Verwaister Schlüssel', title:`Verwaister Schlüssel "${k}"`,
      body:`"${k}" steht auf oberster Ebene, also außerhalb von ${rootKey}, und gehört zu keinem Geschäftsobjekt. Der Block wird ignoriert.`});
  });

  const objects = {};
  for(const [name, defRaw] of Object.entries(doc[rootKey])){
    const def = defRaw || {};
    const rels = readRels(def.relationships, name, messages);
    const attrs = (Array.isArray(def.attributes) ? def.attributes : []).filter(a => a && a.name).map(a=>({
      name: a.name,
      type: a.type || null,
      nullable: a.nullable === true,
      pk: a.primary_key === true,
      fk: a.foreign_key === true,
      ref: a.references || null
    }));
    objects[name] = {
      name,
      desc: def.desc || def.beschreibung || def.description || null,
      attrs,
      domain: def.Domain || def.domain || null,
      keys: Array.isArray(def.business_keys) ? def.business_keys.filter(Boolean) : [],
      sources: Array.isArray(def.sources) ? def.sources.filter(Boolean) : [],
      rels
    };
  }

  /* --- Prüfungen --- */
  const names = new Set(Object.keys(objects));
  const seenPair = new Set();
  const targeted = new Set();
  const srcUsage = new Map();

  for(const o of Object.values(objects)){
    if(!o.domain) messages.push({level:'warn', group:'keine Domain', obj:o.name, title:`${o.name}: keine Domain`, body:'Feld "Domain" fehlt.'});
    if(!o.keys.length) messages.push({level:'warn', group:'kein Business Key', obj:o.name, title:`${o.name}: kein Business Key`, body:'Ohne fachlichen Schlüssel lässt sich das Objekt nicht identifizieren.'});
    if(!o.sources.length) messages.push({level:'warn', group:'keine Quelle', obj:o.name, title:`${o.name}: keine Quelle`, body:'Dem Objekt ist kein Quellsystem zugeordnet. In Ansicht 3 bleibt es unverbunden.'});
    o.sources.forEach(s=>{
      if(!srcUsage.has(s)) srcUsage.set(s, []);
      srcUsage.get(s).push(o.name);
    });
    // Attributnamen müssen im Objekt eindeutig sein: sonst ist nicht bestimmbar,
    // welchen Eintrag ein "references" meint, und die Anzeige wiederholt sich.
    const attrSeen = new Set(), attrDup = new Set();
    o.attrs.forEach(a=>{ if(attrSeen.has(a.name)) attrDup.add(a.name); else attrSeen.add(a.name); });
    attrDup.forEach(n => messages.push({level:'warn', group:'Attribut doppelt', obj:o.name,
      title:`${o.name}.${n}: Attribut doppelt`,
      body:`Der Attributname "${n}" kommt in diesem Geschäftsobjekt mehrfach vor. Verweise über "references" treffen dann nicht eindeutig.`}));
    for(const r of o.rels){
      if(!names.has(r.to)){
        messages.push({level:'err', group:'Ziel unbekannt', obj:o.name, title:`${o.name} → ${r.to}: Ziel unbekannt`, body:`"${r.to}" ist unter ${rootKey} nicht definiert. Die Beziehung wird nicht gezeichnet.`});
        continue;
      }
      targeted.add(r.to);
      if(r.to === o.name) messages.push({level:'info', group:'Selbstbezug', obj:o.name, title:`${o.name}: Selbstbezug`, body:'Das Objekt verweist auf sich selbst — als Hierarchie meist gewollt, hier als Schleife gezeichnet.'});
      // Unbekannte Kardinalität fällt sonst nicht auf: gezeichnet wird ein
      // schlichter Strich, und die Anordnung nimmt die Seite als „eins" an.
      [['from', r.from], ['to', r.toCard]].forEach(([seite, wert])=>{
        if(wert && !CARD_LABEL[wert]) messages.push({level:'warn', group:'Kardinalität unbekannt', obj:o.name,
          title:`${o.name} → ${r.to}: Kardinalität "${wert}" unbekannt`,
          body:`Unter "cardinality: ${seite}" steht ein unbekannter Wert. Erlaubt sind ${Object.keys(CARD_LABEL).join(', ')}. `
             + 'Die Seite wird wie „genau eins" gezeichnet und auch beim Anordnen so behandelt.'});
      });
      // Zwei Beziehungen zwischen denselben Objekten sind nur dann dieselbe,
      // wenn sie auch gleich heissen. Verschiedene Namen — und ebenso benannt
      // gegen unbenannt — beschreiben verschiedene Sachverhalte.
      const pair = [o.name, r.to].sort().join('\u0000') + '\u0000' + (r.name || '');
      if(seenPair.has(pair) && r.to !== o.name)
        messages.push({level:'warn', group:'Beziehung doppelt', obj:o.name, title:`${o.name} ↔ ${r.to}: Beziehung doppelt`,
          body: (r.name ? `Die Beziehung „${r.name}" ist` : 'Eine unbenannte Beziehung ist')
            + ' zwischen diesen beiden Objekten mehrfach definiert, gegebenenfalls in beide Richtungen. Prüfen, welche fachlich führt. Unterschiedlich benannte Beziehungen gelten als verschieden und werden hier nicht gemeldet.'});
      seenPair.add(pair);
    }
  }
  for(const o of Object.values(objects)){
    if(!o.rels.length && !targeted.has(o.name))
      messages.push({level:'info', group:'freistehend', obj:o.name, title:`${o.name}: freistehend`, body:'Keine ein- oder ausgehenden Beziehungen. Das Objekt hängt im Modell isoliert.'});
  }
  for(const [s, users] of srcUsage)
    if(users.length > 1)
      messages.push({level:'info', group:'Quelle mehrfach genutzt', title:`Quelle "${s}" mehrfach genutzt`, body:`Verwendet von: ${users.join(', ')}.`});

  for(const o of Object.values(objects))
    for(const a of o.attrs){
      if(!a.ref) continue;
      const [tObj, tAttr] = String(a.ref).split('.');
      if(!names.has(tObj)){
        messages.push({level:'err', group:'Verweisziel unbekannt', obj:o.name, title:`${o.name}.${a.name}: Verweisziel unbekannt`,
          body:`"${a.ref}" zeigt auf das Geschäftsobjekt "${tObj}", das unter ${rootKey} nicht definiert ist.`});
        continue;
      }
      if(tAttr && objects[tObj].attrs.length && !objects[tObj].attrs.some(x => x.name === tAttr))
        messages.push({level:'warn', group:'Attribut im Ziel fehlt', obj:o.name, title:`${o.name}.${a.name}: Attribut im Ziel fehlt`,
          body:`"${a.ref}" verweist auf ein Attribut "${tAttr}", das bei ${tObj} nicht aufgeführt ist.`});
    }

  const allRels = Object.values(objects).reduce((s,o)=> s + o.rels.length, 0);
  const named = Object.values(objects).reduce((s,o)=> s + o.rels.filter(r=>r.name).length, 0);
  if(allRels && !named) messages.push({level:'info', title:'Beziehungen ohne Namen',
    body:`Keine der ${allRels} Beziehungen trägt eine Bezeichnung. Ergänze im YAML neben "to:" ein Feld "name:", dann erscheint der Name an der Kante im Diagramm.`});
  else if(allRels && named < allRels) messages.push({level:'info', title:'Beziehungsnamen unvollständig',
    body:`${named} von ${allRels} Beziehungen sind benannt. Die übrigen bleiben im Diagramm unbeschriftet.`});

  const rank = {err:0, warn:1, info:2};
  messages.sort((a,b)=> rank[a.level] - rank[b.level]);
  return {objects, messages, meta};
}

/* =====================================================================
   3 — Geometrie der Knoten
   ===================================================================== */
const HEAD_ONLY_H = 38, HEAD_H = 44, ROW_H = 18, PAD_X = 13, MIN_W = 152, GAP_SEC = 9;
const PREFIX_W = 27;   // Spalte für die Kürzel "BK" und "src"
const measure = (()=>{ const c = document.createElement('canvas').getContext('2d');
  return (t, font)=>{ c.font = font; return c.measureText(String(t)).width; }; })();
const F_TITLE = '600 13.5px "Space Grotesk", sans-serif';
const F_SUB   = '400 10px "IBM Plex Mono", monospace';
const F_ROW   = '400 11.5px "IBM Plex Mono", monospace';
const F_TYPE  = '400 10px "IBM Plex Mono", monospace';
const F_TAGS  = '500 8.5px "IBM Plex Mono", monospace';
const F_DESC  = '400 10.5px "Space Grotesk", sans-serif';
const DESC_LH = 13, DESC_PAD = 7, MAX_W = 430;

/* Welche Bestandteile eines Geschäftsobjekts im Kasten stehen — je Ansicht.
   Die Vorgaben bilden die bisherigen Ansichten unverändert ab. */
const CONTENT_FIELDS = [
  {k:'desc',     label:'Beschreibung'},
  {k:'domain',   label:'Domain'},
  {k:'keys',     label:'Business Keys'},
  {k:'sources',  label:'Quellen'},
  {k:'attrs',    label:'Attribute'},
  {k:'keysOnly', label:'nur Schlüsselattribute', sub:'attrs'},
  {k:'types',    label:'Datentypen zeigen',      sub:'attrs'}
];
const CONTENT_DEFAULT = {
  1:{desc:false, domain:false, keys:false, sources:false, attrs:false, keysOnly:false, types:true},
  2:{desc:false, domain:true,  keys:true,  sources:true,  attrs:false, keysOnly:false, types:true},
  3:{desc:false, domain:true,  keys:true,  sources:false, attrs:false, keysOnly:false, types:true}
};
const contentOf = v => Object.assign({}, CONTENT_DEFAULT[v], S.content && S.content[v]);

function wrapText(text, maxW, font){
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = '';
  words.forEach(word=>{
    const probe = cur ? cur + ' ' + word : word;
    if(cur && measure(probe, font) > maxW){ lines.push(cur); cur = word; }
    else cur = probe;
  });
  if(cur) lines.push(cur);
  return lines;
}

function attrText(a, showType){
  return {
    name: a.name,
    tags: (a.pk ? 'PK' : '') + (a.pk && a.fk ? ' ' : '') + (a.fk ? 'FK' : ''),
    type: showType && a.type ? a.type + (a.nullable ? ' ?' : '') : ''
  };
}

function makeGraph(model, view){
  const nodes = [], edges = [];
  const byId = new Map();

  const C = contentOf(view);
  for(const o of Object.values(model.objects)){
    const rows = [];
    if(C.keys) o.keys.forEach(k => rows.push({kind:'key', text:k}));
    if(C.sources && view !== 3 && o.sources.length){
      if(rows.length) rows.push({kind:'sep'});
      o.sources.forEach(s => rows.push({kind:'src', text:s}));
    }
    if(C.attrs){
      const list = C.keysOnly ? o.attrs.filter(a => a.pk || a.fk) : o.attrs;
      if(list.length){
        if(rows.length) rows.push({kind:'sep'});
        list.forEach(a => rows.push({kind:'attr', a: attrText(a, C.types)}));
      }
    }
    const showSub = C.domain && o.domain;
    const showDesc = C.desc && !!o.desc;

    let rowW = 0;
    rows.forEach(r=>{
      if(r.kind === 'sep') return;
      if(r.kind === 'attr'){
        const a = r.a;
        let rw = PAD_X*2 + PREFIX_W + measure(a.name, F_ROW);
        if(a.tags) rw += 7 + measure(a.tags, F_TAGS);
        if(a.type) rw += 16 + measure(a.type, F_TYPE);
        rowW = Math.max(rowW, rw);
      } else rowW = Math.max(rowW, measure(r.text, F_ROW) + PAD_X*2 + PREFIX_W);
    });
    let w = Math.max(MIN_W, measure(o.name, F_TITLE) + PAD_X*2 + 8, rowW);
    if(showSub) w = Math.max(w, measure(o.domain, F_SUB) + PAD_X*2 + 8);
    if(showDesc) w = Math.max(w, 238);
    // Der Deckel begrenzt die Verbreiterung durch die Beschreibung, darf aber
    // niemals eine Attributzeile abschneiden.
    w = Math.round(Math.min(w, Math.max(MAX_W, rowW)));

    const desc = showDesc ? wrapText(o.desc, w - PAD_X*2 - DESC_PAD*2, F_DESC) : [];
    const headH = showSub ? HEAD_H : HEAD_ONLY_H;
    // Rumpfhöhe in einem Stück rechnen, damit der untere Rand in jeder
    // Kombination entsteht — auch wenn nur die Beschreibung im Kasten steht.
    let body = 0;
    if(desc.length) body += 7 + DESC_PAD*2 + desc.length * DESC_LH;
    if(rows.length){
      body += 7;
      rows.forEach(r => body += (r.kind === 'sep' ? GAP_SEC : ROW_H));
    }
    if(body) body += 7;
    const hh = headH + body;
    const n = {id:'o:'+o.name, kind:'object', name:o.name, sub: showSub ? o.domain : null,
               desc, rows, w, h: Math.round(hh), x:0, y:0, ref:o};
    nodes.push(n); byId.set(n.id, n);
  }

  if(view === 3){
    const made = new Map();
    for(const o of Object.values(model.objects)){
      for(const s of o.sources){
        let id = made.get(s);
        if(!id){
          id = 's:'+s;
          const n = {id, kind:'source', name:s, sub:null, rows:[],
                     w: Math.max(126, Math.round(measure(s, F_TITLE) + PAD_X*2 + 8)),
                     h: HEAD_ONLY_H, x:0, y:0, ref:{name:s, users:[]}};
          nodes.push(n); byId.set(id, n); made.set(s, id);
        }
        byId.get(id).ref.users.push(o.name);
        // Quellzuordnung ist keine fachliche Beziehung, daher ohne Kardinalität
        edges.push({from:'o:'+o.name, to:id, kind:'quelle', label:'quelle',
                    fromCard:null, toCard:null});
      }
    }
  }

  for(const o of Object.values(model.objects))
    for(const r of o.rels)
      if(byId.has('o:'+r.to))
        edges.push({from:'o:'+o.name, to:'o:'+r.to, kind:'rel',
                    label:r.name || null, fromCard:r.from, toCard:r.toCard});

  // Mehrfachkanten zwischen demselben Paar auffächern.
  // Der Versatz wird gegen eine feste Referenzrichtung (alphabetisch) gerechnet,
  // sonst kippt bei der Gegenrichtung die Normale mit und beide Bögen fallen zusammen.
  const bucket = new Map();
  edges.forEach(e=>{
    e.canon = e.from < e.to ? 1 : -1;
    const k = [e.from, e.to].sort().join('\u0000');
    if(!bucket.has(k)) bucket.set(k, []);
    bucket.get(k).push(e);
  });
  for(const list of bucket.values()){
    if(list.length === 1){ list[0].curve = 0; continue; }
    const step = 34;
    list.sort((a,b)=> a.canon - b.canon || a.to.localeCompare(b.to));
    list.forEach((e, idx)=> e.curve = (idx - (list.length-1)/2) * step);
  }

  const ord = new Map();
  edges.forEach((e, idx)=>{
    e.id = 'e' + idx;
    const k = e.from + '\u203a' + e.to;
    e.ord = ord.has(k) ? ord.get(k) + 1 : 0;
    ord.set(k, e.ord);
  });
  return {nodes, edges, byId};
}

