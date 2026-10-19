/* =====================================================================
   12 — Übernahme: Geschäftsobjekte aus den Quelltabellen
   Jede Tabelle mit „business_object" legt ihr Geschäftsobjekt an oder
   ergänzt es. Die Herkunft wird festgehalten: Table_Sources am Objekt,
   Relation_Sources an der Beziehung, attribut_sources am Attribut. Jeder Lauf
   gleicht alle zugeordneten Tabellen ab: Fehlendes kommt dazu, Übernommenes
   wird aus den Quellen erneuert, Weggefallenes entfernt; ohne neue Daten
   ändert ein Lauf nichts.
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

/* Den Beschreibungsblock einer Tabelle erneuern: der Block mit ihrer
   Herkunftszeile bekommt den aktuellen Text, leer entfällt er. Ohne Block
   wird angehängt, außer der Text steht schon da. Von Hand geschriebener
   Text (ohne Herkunftszeile) bleibt; ändert sich nichts, kommt die
   Beschreibung unverändert zurück. */
function descErneuern(desc, tabelle, text){
  const marke = qtMarke(tabelle);
  const bloecke = desc ? String(desc).split(/\n\s*\n/) : [];
  const i = bloecke.findIndex(b => b.trim() === marke || b.replace(/\s+$/, '').endsWith('\n' + marke));
  if(i >= 0){
    const neu = text ? text + '\n' + marke : null;
    if(bloecke[i] === neu) return desc;
    if(neu) bloecke[i] = neu; else bloecke.splice(i, 1);
    return bloecke.join('\n\n');
  }
  if(!text || descEnthalten(desc, text)) return desc;
  return desc ? desc + '\n\n' + text + '\n' + marke : text + '\n' + marke;
}

/* Einen Zusatzwert aus der Quelle anhängen: was noch fehlt, kommt hinten
   dazu, aus einem Einzelwert wird so eine Liste. Bringt die Quelle nichts
   Neues, kommt der Wert unverändert zurück. Entfernt wird nichts — ein
   Zusatzwert trägt keine Herkunft. */
function zwAnhaengen(alt, neu){
  const bisher = alsListe(alt);
  const dazu = alsListe(neu).filter((w, i, l) => !bisher.includes(w) && l.indexOf(w) === i);
  return dazu.length ? zwAus(bisher.concat(dazu)) : alt;
}

/* Die Rechnung ohne Seiteneffekt: welche Objekte sich wie ändern. Jede
   zugeordnete Tabelle wird bei jedem Lauf abgeglichen — Fehlendes kommt dazu,
   schon Übernommenes wird aus der Quelle erneuert. Jeder Schritt trägt
   nichts doppelt ein; ändert sich nichts, bleibt der Text gleich. */
function uebernahmeRechnen(goModell, quellModell, zusatzAn, weg = new Set()){
  const tabellen = quellModell.objects;
  const {zu, neu} = zuordnungFortschreiben(tabellen);
  const ziel = name => { const b = zu.get(name); return b && !PF_VERBOTEN.test(b) ? b : null; };
  const entwuerfe = new Map();
  const r = {entwuerfe, ohneZiel:0, ungueltig:[], zuordnen:[], ausZiel:[]};
  const entFuer = bo=>{
    if(!entwuerfe.has(bo)){
      const alt = goModell.objects[bo] || leeresObjekt(bo);
      entwuerfe.set(bo, {alt, e: pfEntwurfAus(alt), neu: !goModell.objects[bo]});
    }
    return entwuerfe.get(bo);
  };
  const verweis = ref=>{                     // Webshop.Kunde.KundeID → Kunde.KundeID
    const teile = String(ref || '').split('.');
    const zielGo = ref ? ziel(teile.slice(0, 2).join('.')) : null;
    return zielGo ? zielGo + (teile[2] ? '.' + teile[2] : '') : '';
  };

  /* Weggefallenes zuerst — nur für Tabellen der geladenen Datei. Eine Tabelle,
     die hier gar nicht vorkommt, kann ebenso aus einer anderen Datei stammen:
     sie bleibt unangetastet. Außer sie steht in `weg`: dann fehlt sie in einer
     neu geladenen Datei, und der Nutzer hat ihr Entfernen bestätigt. */
  for(const o of Object.values(goModell.objects)){
    const betroffen = new Set([...o.tabQuellen, ...o.attrs.flatMap(a => a.quellen.map(qtTabelle)),
      ...o.rels.flatMap(x => x.quellen.map(h => h.split('→')[0]))].filter(n => tabellen[n] || weg.has(n)));
    if(!betroffen.size) continue;
    const e = entFuer(o.name).e;
    betroffen.forEach(n=>{
      const t = tabellen[n];
      if(zu.get(n) === o.name){
        // noch zugeordnet: Spalten und Beziehungen, die es nicht mehr gibt
        e.attrs.forEach(a => { a.quellen = a.quellen.filter(q => qtTabelle(q) !== n || t.attrs.some(s => s.name === qtSpalte(q))); });
        e.rels.forEach(x => { x.quellen = x.quellen.filter(h => h.split('→')[0] !== n || t.rels.some(b => n + '→' + b.to === h)); });
        return;
      }
      // einem anderen (oder keinem) Objekt zugeordnet: alles von ihr entfernen
      e.tabQuellen = e.tabQuellen.filter(x => x !== n);
      e.attrs.forEach(a => { a.quellen = a.quellen.filter(q => qtTabelle(q) !== n); });
      e.rels.forEach(x => { x.quellen = x.quellen.filter(h => h.split('→')[0] !== n); });
      e.desc = descErneuern(e.desc, n, '');
    });
  }

  for(const t of Object.values(tabellen)){
    const bo = zu.get(t.name);
    if(!bo) continue;
    if(PF_VERBOTEN.test(bo)){ if(!r.ungueltig.includes(bo)) r.ungueltig.push(bo); continue; }
    const ent = entFuer(bo), e = ent.e;
    if(neu.includes(t)){
      r.zuordnen.push({t, bo});                       // business_object in die Tabellen-YAML
      if(ent.neu && !r.ausZiel.includes(bo)) r.ausZiel.push(bo);
    }

    // Wird aus einer Domäne eine Liste, bleibt die bisherige führend — sonst
    // verschwände die Anzeige bei einem Objekt, das bisher eine hatte
    const bisher = e.domains.length === 1 && !e.leading ? e.domains[0] : null;
    t.domains.forEach(d=>{ if(!e.domains.includes(d)) e.domains.push(d); });
    if(bisher && e.domains.length > 1) e.leading = bisher;
    // Das Quellsystem wird Quelle — hinten angehängt, Gepflegtes bleibt wie es ist
    if(t.system && !e.sources.includes(t.system)) e.sources.push(t.system);
    e.desc = descErneuern(e.desc, t.name, String(t.desc || '').trim());
    const kopie = a => ({name:a.name, type:a.type||'', nullable:!!a.nullable, pk:!!a.pk, ak:!!a.ak, fk:!!a.fk,
      ref: verweis(a.ref), quellen:[t.name + '.' + a.name], extra:Object.assign({}, a.extra), _alt:null});
    // Jedes Attribut kommt ins Objekt. Gleichnamige werden eins: gleicher Name
    // wie das Objekt-Attribut oder wie eine Spalte in dessen Quellen (so
    // findet auch ein umbenanntes Attribut neue Quellen). Steht die Quelle
    // schon an einem Attribut, bleibt es dabei — Getrenntes bleibt getrennt.
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
      zusatzAn.attribut.forEach(k=>{ if(alsListe(a.extra[k]).length) da.extra[k] = zwAnhaengen(da.extra[k], a.extra[k]); });
    });
    t.rels.forEach(b=>{
      const zielGo = ziel(b.to);
      if(!zielGo){ r.ohneZiel++; return; }
      const herkunft = t.name + '→' + b.to;
      const da = e.rels.find(x => x.to === zielGo && (x.name || '') === (b.name || ''));
      if(da){ if(!da.quellen.includes(herkunft)) da.quellen = da.quellen.concat(herkunft); }
      else e.rels.push({to:zielGo, name:b.name||'', from:b.from||'', toCard:b.toCard||'', quellen:[herkunft], _alt:null});
    });
    // Zusatzfelder nur, wenn sie unter „Zusatzattribute …" eingeschaltet sind;
    // neue Werte werden angehängt
    zusatzAn.objekt.forEach(k=>{ if(alsListe(t.extra[k]).length) e.extra[k] = zwAnhaengen(e.extra[k], t.extra[k]); });
    if(!e.tabQuellen.includes(t.name)) e.tabQuellen.push(t.name);
  }

  /* Eigenschaften aus den Quellen: stimmen alle bekannten Quellspalten eines
     Attributs in einer Eigenschaft überein, gilt ihr Wert; weichen sie ab,
     bleibt der am Attribut (die Prüfung meldet abweichende Typen). Hängt nur
     an den Quellen, nicht an der Vorgeschichte — jeder Lauf ergibt dasselbe. */
  const eigenschaften = {type: s => s.type || '', nullable: s => !!s.nullable, pk: s => !!s.pk,
                         ak: s => !!s.ak, fk: s => !!s.fk, ref: s => verweis(s.ref)};
  for(const {e} of entwuerfe.values()) e.attrs.forEach(a=>{
    const spalten = a.quellen.map(q=>{ const t = tabellen[qtTabelle(q)]; return t && t.attrs.find(s => s.name === qtSpalte(q)); }).filter(Boolean);
    if(!spalten.length) return;
    Object.entries(eigenschaften).forEach(([k, wert])=>{
      const v = spalten.map(wert);
      if(v.every(x => x === v[0])) a[k] = v[0];
    });
  });
  return r;
}

/* Rechnen und schreiben: das Geschäftsobjekt-Modell und — für Tabellen, die
   erst als Beziehungsziel eine Zuordnung bekamen — die Tabellen-YAML. Gezählt
   wird je Geschäftsobjekt: angelegt, aktualisiert (der Text hat sich
   geändert) oder unverändert. Hat sich etwas geändert (r.geaendert), sind
   beide Modelle neu gebaut. Ansicht, Ablage und Verlauf sind Sache des
   Aufrufers. */
function goAusQuellenUebernehmen(weg){
  const r = uebernahmeRechnen(S.model, S.quellModell, S.zusatzAn, weg);
  Object.assign(r, {angelegt:0, aktualisiert:0, unveraendert:0});
  let text = S.yamlText;
  for(const [name, ent] of r.entwuerfe){
    const vorher = text;
    if(ent.neu) text = goObjektAnlegen(text, name);
    if(text != null) text = goObjektAendern(text, name, ent.e, ent.alt);
    if(text == null){ toast('Im Modelltext fehlt der Abschnitt "BusinessObjects"'); r.geaendert = false; return r; }
    if(ent.neu) r.angelegt++;
    else if(text !== vorher) r.aktualisiert++;
    else r.unveraendert++;
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

/* Prüfung über beide Modelle: was zwischen Geschäftsobjekten und
   Quelltabellen nicht zusammenpasst. Beim Laden eines Projekts läuft keine
   Übernahme — wird die Tabellen-Datei draußen geändert, zeigt die Herkunft an
   den Objekten ins Leere. Je Objekt und Art eine Meldung mit allen Verweisen;
   geändert wird nichts. */
function abgleichMeldungen(){
  if(!S.quellenAn || !S.quellModell || !S.model) return [];
  const tabellen = S.quellModell.objects;
  const systeme = new Set(Object.values(tabellen).map(t => t.system).filter(Boolean));
  const nachTabelle = new Map();
  Object.values(tabellen).forEach(t=>{
    const k = t.tabelle || t.name;
    if(!nachTabelle.has(k)) nachTabelle.set(k, []);
    nachTabelle.get(k).push(t.name);
  });
  // Steht die Tabelle unter genau einem anderen System, ist sie vermutlich umgezogen
  const mitHinweis = n=>{
    const andere = (nachTabelle.get(n.slice(n.indexOf('.') + 1)) || []).filter(x => x !== n);
    return andere.length === 1 ? `${n} (gibt es als ${andere[0]})` : n;
  };
  const out = [];
  const melde = (o, group, liste, text)=>{
    if(liste.length) out.push({level:'warn', group, obj:o.name, title:`${o.name}: ${group}`, body: text(liste.join(', '))});
  };
  for(const o of Object.values(S.model.objects)){
    const fehlt = new Set(), spalten = [], bez = [];
    const pruefe = n => { if(!tabellen[n]) fehlt.add(n); return !!tabellen[n]; };
    o.tabQuellen.forEach(pruefe);
    o.attrs.forEach(a => a.quellen.forEach(q=>{
      const n = qtTabelle(q);
      if(pruefe(n) && !tabellen[n].attrs.some(s => s.name === qtSpalte(q))) spalten.push(q);
    }));
    o.rels.forEach(x => x.quellen.forEach(h=>{
      const [von, nach] = h.split('→');
      const da = pruefe(von);
      if(pruefe(nach) && da && !tabellen[von].rels.some(b => b.to === nach)) bez.push(h);
    }));
    for(const m of String(o.desc || '').matchAll(/--->aus (\S+) kopiert/g)) pruefe(m[1]);
    melde(o, 'Quelltabelle fehlt', [...fehlt].map(mitHinweis),
      l => `Die Herkunft nennt ${l} — in den Quelltabellen gibt es keine solche Tabelle.`);
    melde(o, 'Quellspalte fehlt', spalten, l => `Die Attributquellen nennen ${l} — die Tabelle hat keine solche Spalte.`);
    melde(o, 'Quellbeziehung fehlt', bez, l => `Relation_Sources nennt ${l} — die Quelltabelle hat keine solche Beziehung.`);
    // Von Hand gepflegte Objekte dürfen freie Quellnamen tragen
    if(o.tabQuellen.length) melde(o, 'Quellsystem ohne Tabellen', o.sources.filter(s => !systeme.has(s)),
      l => `source_systems nennt ${l} — zu diesem System gibt es keine Quelltabelle.`);
  }
  const offen = new Map();
  Object.values(tabellen).forEach(t=>{
    const g = t.bo && S.model.objects[t.bo];
    if(!t.bo || (g && g.tabQuellen.includes(t.name))) return;
    if(!offen.has(t.bo)) offen.set(t.bo, []);
    offen.get(t.bo).push(t.name);
  });
  offen.forEach((namen, bo)=>{
    const g = S.model.objects[bo];
    out.push({level:'info', group:'noch nicht übernommen', obj: g ? bo : undefined, title:`${bo}: noch nicht übernommen`,
      body:`${namen.join(', ')} nennt ${bo} unter business_object, ` + (g ? 'das Objekt führt sie aber nicht unter Table_Sources.' : 'das Objekt gibt es noch nicht.')
        + ' „Geschäftsobjekte übernehmen" gleicht ab.'});
  });
  return out;
}

const uebernahmeText = r => `Übernahme: ${r.angelegt} angelegt, ${r.aktualisiert} aktualisiert, ${r.unveraendert} unverändert`
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
