/* =====================================================================
   12 — Übernahme: Geschäftsobjekte aus den Quelltabellen
   Jede Tabelle mit „business_object" legt ihr Geschäftsobjekt an oder
   ergänzt es. Die Herkunft wird festgehalten: Table_Sources am Objekt,
   Relation_Sources an der Beziehung, attribut_sources am Attribut. Steht die
   Tabelle schon in Table_Sources, gilt sie als übernommen und wird
   übersprungen — so lässt sich die Übernahme gefahrlos wiederholen.
   Geschrieben wird über dieselbe Text-Chirurgie wie beim Bearbeiten
   (goObjektAnlegen, goObjektAendern): nur die betroffenen Stellen ändern sich.
   ===================================================================== */
const qtMarke = tabelle => '--->aus ' + tabelle + ' kopiert';
// Eine Attributquelle System.Tabelle.Spalte zerlegen
const qtSpalte  = q => String(q).split('.').slice(2).join('.');
const qtTabelle = q => String(q).split('.').slice(0, 2).join('.');

const leeresObjekt = name => ({name, domains:[], domain:null, desc:null, keys:[], sources:[],
  attrs:[], rels:[], extra:{}, tabQuellen:[]});

/* Welche Tabelle welchem Geschäftsobjekt zugeordnet ist — fortgeschrieben:
   Zeigt eine Beziehung einer zugeordneten Tabelle auf eine ohne Zuordnung,
   wird diese ihrem eigenen Namen zugeordnet (Webshop.Lager → Lager). Bis sich
   nichts mehr ändert, damit auch Ketten erfasst werden. */
function zuordnungFortschreiben(tabellen){
  const zu = new Map(Object.values(tabellen).filter(t => t.bo).map(t => [t.name, t.bo]));
  const neu = [];
  for(let weiter = true; weiter;){
    weiter = false;
    for(const t of Object.values(tabellen)){
      if(!zu.has(t.name)) continue;
      t.rels.forEach(b=>{
        const z = tabellen[b.to];
        if(!z || zu.has(z.name)) return;
        zu.set(z.name, z.tabelle || z.name);
        neu.push(z);
        weiter = true;
      });
    }
  }
  return {zu, neu};
}

/* Steht der Text schon in der Beschreibung — als Ganzes oder als ein schon
   angehängter Teil (Teile durch Leerzeile getrennt, ohne Herkunftszeile)? */
const descEnthalten = (desc, text)=>
  String(desc || '').split(/\n\s*\n/).map(b => b.replace(/\n?--->aus \S+ kopiert\s*$/, '').trim()).includes(text);

/* Die Rechnung ohne Seiteneffekt: welche Objekte sich wie ändern. */
function uebernahmeRechnen(goModell, quellModell, zusatzKeys){
  const tabellen = quellModell.objects;
  const {zu, neu} = zuordnungFortschreiben(tabellen);
  const ziel = name => { const b = zu.get(name); return b && !PF_VERBOTEN.test(b) ? b : null; };
  const entwuerfe = new Map();
  const r = {entwuerfe, angelegt:0, ergaenzt:0, uebersprungen:0, ohneZiel:0, ungueltig:[], zuordnen:[], ausZiel:[]};

  for(const t of Object.values(tabellen)){
    const bo = zu.get(t.name);
    if(!bo) continue;
    if(PF_VERBOTEN.test(bo)){ if(!r.ungueltig.includes(bo)) r.ungueltig.push(bo); continue; }
    if(!entwuerfe.has(bo)){
      const alt = goModell.objects[bo] || leeresObjekt(bo);
      entwuerfe.set(bo, {alt, e: pfEntwurfAus(alt), neu: !goModell.objects[bo], geaendert: false});
    }
    const ent = entwuerfe.get(bo), e = ent.e;
    if(neu.includes(t)){
      r.zuordnen.push({t, bo});                       // business_object in die Tabellen-YAML
      if(ent.neu && !r.ausZiel.includes(bo)) r.ausZiel.push(bo);
    }
    if(e.tabQuellen.includes(t.name)){ r.uebersprungen++; continue; }

    // Wird aus einer Domäne eine Liste, bleibt die bisherige führend — sonst
    // verschwände die Anzeige bei einem Objekt, das bisher eine hatte
    const bisher = e.domains.length === 1 && !e.leading ? e.domains[0] : null;
    t.domains.forEach(d=>{ if(!e.domains.includes(d)) e.domains.push(d); });
    if(bisher && e.domains.length > 1) e.leading = bisher;
    // Eine Beschreibung, die schon dasteht, wird nicht noch einmal angehängt
    const text = String(t.desc || '').trim();
    if(text && !descEnthalten(e.desc, text)){
      const block = text + '\n' + qtMarke(t.name);
      e.desc = e.desc ? e.desc + '\n\n' + block : block;
    }
    const kopie = a=>{
      const teile = String(a.ref || '').split('.');
      const zielGo = a.ref ? ziel(teile.slice(0, 2).join('.')) : null;
      return {name:a.name, type:a.type||'', nullable:!!a.nullable, pk:!!a.pk, ak:!!a.ak, fk:!!a.fk,
              ref: zielGo ? zielGo + (teile[2] ? '.' + teile[2] : '') : '',
              quellen:[t.name + '.' + a.name], extra:Object.assign({}, a.extra), _alt:null};
    };
    // Jedes Attribut kommt ins Objekt. Gleichnamige werden eins: gleicher Name
    // wie das Objekt-Attribut oder wie eine Spalte in dessen Quellen (so
    // findet auch ein umbenanntes Attribut neue Quellen). Steht die Quelle
    // schon an einem Attribut, bleibt es dabei — Getrenntes bleibt getrennt.
    // Das vorhandene Attribut behält seine Eigenschaften.
    t.attrs.forEach(a=>{
      const q = t.name + '.' + a.name;
      let da = e.attrs.find(x => x.quellen.includes(q));
      if(!da){
        da = e.attrs.find(x => x.name === a.name) || e.attrs.find(x => x.quellen.some(s => qtSpalte(s) === a.name));
        if(da) da.quellen = da.quellen.concat(q);
        else e.attrs.push(da = kopie(a));
      }
      // Ein Primärschlüssel wird Business Key — unter dem Namen am Objekt
      if(a.pk && !e.keys.includes(da.name)) e.keys.push(da.name);
    });
    t.rels.forEach(b=>{
      const zielGo = ziel(b.to);
      if(!zielGo){ r.ohneZiel++; return; }
      const herkunft = t.name + '→' + b.to;
      const da = e.rels.find(x => x.to === zielGo && (x.name || '') === (b.name || ''));
      if(da){ if(!da.quellen.includes(herkunft)) da.quellen = da.quellen.concat(herkunft); }
      else e.rels.push({to:zielGo, name:b.name||'', from:b.from||'', toCard:b.toCard||'', quellen:[herkunft], _alt:null});
    });
    // Zusatzfelder nur, wenn sie unter „Zusatzattribute …" eingeschaltet sind
    zusatzKeys.forEach(k=>{ if(t.extra[k] && !e.extra[k]) e.extra[k] = t.extra[k]; });
    e.tabQuellen.push(t.name);
    if(!ent.geaendert){ ent.geaendert = true; if(ent.neu) r.angelegt++; else r.ergaenzt++; }
  }
  return r;
}

/* Rechnen und schreiben: das Geschäftsobjekt-Modell und — für Tabellen, die
   erst als Beziehungsziel eine Zuordnung bekamen — die Tabellen-YAML. Hat
   sich etwas geändert (r.geaendert), sind beide Modelle neu gebaut. Ansicht,
   Ablage und Verlauf sind Sache des Aufrufers. */
function goAusQuellenUebernehmen(){
  const r = uebernahmeRechnen(S.model, S.quellModell, S.zusatzAn.objekt);
  let text = S.yamlText;
  for(const [name, ent] of r.entwuerfe){
    if(!ent.geaendert) continue;
    if(ent.neu) text = goObjektAnlegen(text, name);
    if(text != null) text = goObjektAendern(text, name, ent.e, ent.alt);
    if(text == null){ toast('Im Modelltext fehlt der Abschnitt "BusinessObjects"'); r.geaendert = false; return r; }
  }
  let qtext = quellTextAkt();
  r.zuordnen.forEach(({t, bo})=>{
    const e = Object.assign(pfEntwurfAus(t), {bo});
    qtext = goObjektAendern(qtext, t.name, e, t, splitQuellTabellen) || qtext;
  });
  r.geaendert = text !== S.yamlText || qtext !== quellTextAkt();
  if(text !== S.yamlText){ S.yamlText = text; S.model = buildModel(text); }
  if(qtext !== quellTextAkt()){ S.quellText = qtext; quellModellBauen(); }
  // Die Info in der Prüfung: steht in keinen Daten, gilt bis zur nächsten Übernahme
  if(r.geaendert) S.uebernahmeMeldungen = r.ausZiel.map(bo=>{
    const tab = r.zuordnen.filter(z => z.bo === bo).map(z => z.t.name);
    return {level:'info', group:'aus Beziehungsziel angelegt', obj:bo, title:`${bo}: aus Beziehungsziel angelegt`,
      body:`Eine Beziehung der Quelltabellen zeigte auf ${tab.join(', ')} ohne Geschäftsobjekt. Die Übernahme hat „${bo}" angelegt und die Tabelle ihm zugeordnet.`};
  });
  return r;
}

/* Prüfung über beide Modelle: hat ein Attribut des Geschäftsobjekts Quellen,
   deren Spalten einen anderen Typ tragen als es selbst oder als einander?
   Es gilt der Typ am Attribut — gemeldet wird, damit es jemand entscheidet. */
function typAbweichungen(){
  if(!S.quellenAn || !S.quellModell || !S.model) return [];
  const out = [];
  for(const o of Object.values(S.model.objects)) for(const a of o.attrs){
    const typen = a.quellen.map(q=>{
      const t = S.quellModell.objects[qtTabelle(q)];
      const sp = t && t.attrs.find(x => x.name === qtSpalte(q));
      return sp && sp.type ? {q, typ: sp.type} : null;
    }).filter(Boolean);
    if(new Set(typen.map(x => x.typ).concat(a.type ? [a.type] : [])).size < 2) continue;
    out.push({level:'warn', group:'Quellen mit abweichendem Typ', obj:o.name, title:`${o.name}.${a.name}: Quellen mit abweichendem Typ`,
      body:`Am Attribut ${a.type || '—'}; ${typen.map(x => x.q + ': ' + x.typ).join(', ')}. Es gilt der Typ am Attribut.`});
  }
  return out;
}

const uebernahmeText = r => `Übernahme: ${r.angelegt} angelegt, ${r.ergaenzt} ergänzt, ${r.uebersprungen} übersprungen`
  + (r.ausZiel.length ? `, ${r.ausZiel.length} aus Beziehungsziel angelegt: ${r.ausZiel.join(', ')}` : '')
  + (r.ohneZiel ? `, ${r.ohneZiel} Beziehung(en) ohne Ziel` : '')
  + (r.ungueltig.length ? `, ungültiger Name: ${r.ungueltig.join(', ')}` : '');

/* Menü „Datei & Export → Geschäftsobjekte übernehmen": ein Schritt im
   Verlauf, ohne Änderung keiner. */
function uebernahmeAusfuehren(){
  if(S.pflege){ toast('Erst das offene Bearbeiten-Formular speichern oder abbrechen'); return; }
  const r = goAusQuellenUebernehmen();
  if(r.geaendert){
    renderMessages(); syncLayoutMenu();
    ansichtNeu({autoFit:false});
    writeStore();
  }
  toast(uebernahmeText(r));
}
