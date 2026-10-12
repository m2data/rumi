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

const leeresObjekt = name => ({name, domains:[], domain:null, desc:null, keys:[], sources:[],
  attrs:[], rels:[], extra:{}, tabQuellen:[]});

/* Die Rechnung ohne Seiteneffekt: welche Objekte sich wie ändern. */
function uebernahmeRechnen(goModell, quellModell, zusatzKeys){
  const tabellen = quellModell.objects;
  const ziel = name => (tabellen[name] && tabellen[name].bo) || null;   // Tabelle → ihr Geschäftsobjekt
  const entwuerfe = new Map();
  const r = {entwuerfe, angelegt:0, ergaenzt:0, uebersprungen:0, ohneZiel:0, ungueltig:[]};

  for(const t of Object.values(tabellen)){
    if(!t.bo) continue;
    if(PF_VERBOTEN.test(t.bo)){ if(!r.ungueltig.includes(t.bo)) r.ungueltig.push(t.bo); continue; }
    if(!entwuerfe.has(t.bo)){
      const alt = goModell.objects[t.bo] || leeresObjekt(t.bo);
      entwuerfe.set(t.bo, {alt, e: pfEntwurfAus(alt), neu: !goModell.objects[t.bo], geaendert: false});
    }
    const ent = entwuerfe.get(t.bo), e = ent.e;
    if(e.tabQuellen.includes(t.name)){ r.uebersprungen++; continue; }

    t.domains.forEach(d=>{ if(!e.domains.includes(d)) e.domains.push(d); });
    if(t.desc){
      const block = t.desc + '\n' + qtMarke(t.name);
      e.desc = e.desc ? e.desc + '\n\n' + block : block;
    }
    if(!e.keys.length) e.keys = t.keys.slice();
    // Attribute nur in ein Objekt ohne Attribute — sonst stünden zwei Fassungen nebeneinander
    if(!e.attrs.length) e.attrs = t.attrs.map(a=>{
      const teile = String(a.ref || '').split('.');
      const zielGo = a.ref ? ziel(teile.slice(0, 2).join('.')) : null;
      return {name:a.name, type:a.type||'', nullable:!!a.nullable, pk:!!a.pk, ak:!!a.ak, fk:!!a.fk,
              ref: zielGo ? zielGo + (teile[2] ? '.' + teile[2] : '') : '',
              quelle: t.name + '.' + a.name, extra:Object.assign({}, a.extra), _alt:null};
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

/* Rechnen und in den Modelltext schreiben. Gibt das Ergebnis zurück; hat sich
   etwas geändert (r.geaendert), sind S.yamlText und S.model neu. Ansicht,
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
  r.geaendert = text !== S.yamlText;
  if(r.geaendert){ S.yamlText = text; S.model = buildModel(text); }
  return r;
}

const uebernahmeText = r => `Übernahme: ${r.angelegt} angelegt, ${r.ergaenzt} ergänzt, ${r.uebersprungen} übersprungen`
  + (r.ohneZiel ? `, ${r.ohneZiel} Beziehung(en) ohne Geschäftsobjekt am Ziel` : '')
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
