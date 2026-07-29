/* =====================================================================
   11 — Hierarchie: redaktionelle Diagramme
   Liest die Übersicht (Baum aus Diagrammen) und normalisiert sie zu Knoten
   mit stabiler Kennung, Beschreibung, Objektliste und Kindern. Jeder Knoten
   ist ein Diagramm: ein Ausschnitt des Modells mit erklärendem Text.
   ===================================================================== */
function buildOutline(text, model){
  const {doc, notes} = readYaml(text);
  const messages = notes.slice();
  const known = model && model.objects ? new Set(Object.keys(model.objects)) : null;
  const TRENNER = '›';                       // › im Pfad, wie edgeKey es nutzt

  function node(name, raw, pfad){
    const def = (raw && typeof raw === 'object') ? raw : {};
    const liste = Array.isArray(def.objekte) ? def.objekte
                : Array.isArray(def.objects) ? def.objects : [];
    const objekte = liste.filter(Boolean).map(String);
    if(known) objekte.forEach(o=>{
      if(!known.has(o)) messages.push({level:'warn', title:`${name}: Objekt „${o}“ unbekannt`,
        body:`„${o}“ ist im Modell nicht definiert und erscheint im Diagramm nicht.`});
    });
    const id = pfad.concat(name).join(TRENNER);
    const kinderRaw = def.Details || def.details || def.kinder || null;
    const kinder = (kinderRaw && typeof kinderRaw === 'object' && !Array.isArray(kinderRaw))
      ? Object.entries(kinderRaw).map(([k, v]) => node(k, v, pfad.concat(name)))
      : [];
    return {
      id, name,
      beschreibung: def.beschreibung || def.text || def.description || '',
      objekte, kinder
    };
  }

  const roots = (doc && typeof doc === 'object' && !Array.isArray(doc))
    ? Object.entries(doc).map(([k, v]) => node(k, v, []))
    : [];
  return {roots, messages};
}

/* Knoten im Baum anhand seiner Kennung finden. */
function outlineFind(roots, id){
  const stack = [...roots];
  while(stack.length){
    const n = stack.pop();
    if(n.id === id) return n;
    stack.push(...n.kinder);
  }
  return null;
}

/* Alle Knoten in Anzeigereihenfolge (Tiefensuche), z. B. für „erstes Diagramm“. */
function outlineFlat(roots){
  const out = [];
  const walk = ns => ns.forEach(n=>{ out.push(n); walk(n.kinder); });
  walk(roots);
  return out;
}
