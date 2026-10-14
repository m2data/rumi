/* =====================================================================
   10 — Pflege: Geschäftsobjekte und ihre Beziehungen bearbeiten

   Die Modelldatei bleibt die Datei des Nutzers: geändert wird nur die
   Stelle, die er angefasst hat. Deshalb wird das YAML nicht neu erzeugt,
   sondern wie beim Delta-Einspielen zeilenweise umgeschrieben — mit
   denselben Zerlegern (splitBusinessObjects, splitObjectFields,
   splitListItems, listItemKey). Kommentare, Reihenfolge, Einrückung und
   Schreibvarianten unberührter Stellen überleben so jede Bearbeitung.
   ===================================================================== */

/* Die Felder eines Objektblocks, die die Pflege verantwortet. Ein Feld kann
   deutsch wie englisch heißen (siehe buildModel) — dann wird der vorhandene
   Schlüssel weiterbenutzt, sonst der erste als Vorgabe. */
const PF_FELDER = [
  {rolle:'domain',  keys:['Domain','domain']},
  {rolle:'leading', keys:['leading_domain','Leading_Domain','Führende_Domäne']},
  {rolle:'desc',    keys:['desc','beschreibung','description']},
  {rolle:'keys',    keys:['business_keys','BusinessKeys']},
  {rolle:'sources', keys:['source_systems','sources']},
  {rolle:'attrs',   keys:['attributes']},
  {rolle:'rels',    keys:['relationships']},
  // Herkunft aus den Quelltabellen (uebernahme.js)
  {rolle:'tabquellen', keys:['Table_Sources']},
  // nur an Quelltabellen; an Geschäftsobjekten bleiben beide leer und unberührt
  {rolle:'system',  keys:['source_system','Source_System']},
  {rolle:'bo',      keys:['business_object','Business_Object','Geschäftsobjekt','Geschaeftsobjekt']}
];
const PF_EINZEL = ['desc','leading','system','bo'];

/* Welche Datei die Pflege gerade bearbeitet: im Bereich der Quelltabellen
   deren YAML, sonst das Geschäftsobjekt-Modell. */
const QT_HEAD = /^\s*(SourceTables|sourceTables|source_tables|Quelltabellen)\s*:\s*(#.*)?$/;
const aktText = ()=> S.mode === 'quellen' ? quellTextAkt() : S.yamlText;
const aktZerleger = ()=> S.mode === 'quellen' ? splitQuellTabellen : splitBusinessObjects;
const pfRolle = key => (PF_FELDER.find(f => f.keys.includes(key)) || {}).rolle || null;
const pfStd   = rolle => PF_FELDER.find(f => f.rolle === rolle).keys[0];

const pfZusammen = B => {
  const t = [...B.pre, ...B.blocks.reduce((s,b)=> s.concat(b.lines), []), ...B.post].join('\n');
  return t.endsWith('\n') ? t : t + '\n';
};

/* ---------- Zeilen für einen geänderten Eintrag ---------- */
function pfAttrZeilen(a, col, altEintrag){
  const e = ' '.repeat(col), i = ' '.repeat(col + 2);
  const z = [e + '- name: ' + yWert(a.name)];
  if(a.type)     z.push(i + 'type: ' + yWert(a.type));
  if(a.nullable) z.push(i + 'nullable: true');
  if(a.pk)       z.push(i + 'primary_key: true');
  if(a.ak)       z.push(i + 'alternate_key: true');
  if(a.fk)       z.push(i + 'foreign_key: true');
  if(a.ref)      z.push(i + 'references: ' + yWert(a.ref));
  if(a.quellen && a.quellen.length){
    z.push(i + 'attribut_sources:');
    a.quellen.forEach(q => z.push(i + '- ' + yWert(q)));
  }
  // Zusatzattribute gehören zum Eintrag, auch die ausgeschalteten: sonst
  // verschwänden sie, sobald das Attribut neu geschrieben wird. Ein leerer
  // Wert bleibt als Platzhalter stehen, wenn er schon in der Datei stand.
  const vorher = (a._alt && a._alt.extra) || {};
  Object.entries(a.extra || {}).forEach(([k, v])=>{
    if(v !== '') z.push(i + k + ': ' + yWert(v));
    else if(k in vorher) z.push(i + k + ':');
  });
  // Was als Liste oder Abbildung am Attribut hängt, kennt das Modell nicht als
  // Wert — es kommt mit seinen ursprünglichen Zeilen zurück.
  if(altEintrag){
    const ic = yCol(altEintrag.lines[0]);
    let mit = false;
    altEintrag.lines.slice(1).forEach(l=>{
      const m = !yBlank(l) && yCol(l) === ic + 2 ? l.match(/^\s*"?([A-Za-z_][\w.\/-]*)"?\s*:\s*(.*)$/) : null;
      if(m) mit = !ATTR_KEYS.has(m[1]) && !(m[1] in (a.extra || {})) && (m[2] === '' || m[2].startsWith('#'));
      if(mit && l.trim() !== '') z.push(l);
    });
  }
  return z;
}
/* Ein Zusatzattribut am Objekt: Einzelwert wie Domain. Unverändert bleibt die
   Zeile stehen; geleert bleibt der Schlüssel als Platzhalter, wenn es ihn gab. */
function pfZusatzZeilen(k, f, col, e, alt){
  const neu = e.extra[k], vor = alt.extra && alt.extra[k];
  if(f){
    if(vor === undefined || neu === vor) return f.lines;   // Liste/Abbildung oder unverändert
    const nachspann = pfNachspann(f.lines.slice());
    return [' '.repeat(col) + f.key + ':' + (neu === '' ? '' : ' ' + yWert(neu)), ...nachspann];
  }
  return neu === '' ? [] : [' '.repeat(col) + k + ': ' + yWert(neu)];
}
function pfRelZeilen(r, col){
  const e = ' '.repeat(col), i = ' '.repeat(col + 2), j = ' '.repeat(col + 4);
  const z = [e + '- to: ' + yWert(r.to)];
  if(r.name) z.push(i + 'name: ' + yWert(r.name));
  if(r.from || r.toCard){
    z.push(i + 'cardinality:');
    if(r.from)   z.push(j + 'from: ' + r.from);
    if(r.toCard) z.push(j + 'to: ' + r.toCard);
  }
  if(r.quellen && r.quellen.length){
    z.push(i + 'Relation_Sources:');
    r.quellen.forEach(q => z.push(i + '- ' + yWert(q)));
  }
  return z;
}

const pfExtraGleich = (x = {}, y = {}) =>
  [...new Set([...Object.keys(x), ...Object.keys(y)])].every(k => x[k] === y[k]);
const pfAttrGleich = (a, b) => a.name === b.name && (a.type||'') === (b.type||'')
  && !!a.nullable === !!b.nullable && !!a.pk === !!b.pk && !!a.ak === !!b.ak && !!a.fk === !!b.fk && (a.ref||'') === (b.ref||'')
  && (a.quellen||[]).join('\u0000') === (b.quellen||[]).join('\u0000') && pfExtraGleich(a.extra, b.extra);
const pfRelGleich = (a, b) => a.to === b.to && (a.name||'') === (b.name||'')
  && (a.from||'') === (b.from||'') && (a.toCard||'') === (b.toCard||'')
  && (a.quellen||[]).join('\u0000') === (b.quellen||[]).join('\u0000');

/* Die Kopfzeile eines Listenfeldes. Steht hinter dem Doppelpunkt nichts (oder
   nur ein Kommentar), bleibt die vorhandene Zeile Zeichen für Zeichen stehen.
   Trägt sie schon einen Wert — „source_systems: []" schreiben andere Werkzeuge so, und
   eine Inline-Liste „[Q1]" ebenso —, taugt sie nicht als Kopf einer Blockliste:
   die Einträge darunter ergäben kein YAML mehr, und das Gepflegte wäre beim
   nächsten Lesen still verschwunden. Dann wird die Zeile neu geschrieben, ein
   Zeilenkommentar wandert mit. */
function pfListKopf(f, col, key){
  if(!f) return ' '.repeat(col) + key + ':';
  const l = f.lines[0];
  const m = l.match(/^\s*"?[\w.\/-]+"?\s*:\s*(.*)$/);
  const rest = m ? m[1].trim() : '';
  if(rest === '' || rest.startsWith('#')) return l;
  const komm = rest.match(/#.*$/);
  return ' '.repeat(yCol(l)) + key + ':' + (komm ? '  ' + komm[0] : '');
}

/* Leerzeilen am Ende trennen vom Folgenden — vom nächsten Feld, vom nächsten
   Objekt. Sie gehören darum nicht an den letzten Eintrag oder das letzte Feld,
   auch wenn die Zerleger sie dort einsortieren: käme darunter etwas dazu,
   rutschte die Leerzeile mitten hinein. Abgestreift (und zurückgegeben) wird
   nur die echte Leerzeile; eine Kommentarzeile bleibt, wo sie steht — yBlank
   zählt Kommentare mit und ist hier das falsche Prädikat. `lines` wird gekürzt,
   die ersten `behalten` Zeilen bleiben stehen. */
function pfNachspann(lines, behalten = 1){
  const raus = [];
  while(lines.length > behalten && lines[lines.length - 1].trim() === '')
    raus.unshift(lines.pop());
  return raus;
}

/* Ein Listenfeld neu setzen. Einträge, die unverändert blieben, kommen mit
   ihren ursprünglichen Zeilen zurück — nur Geänderte und Neue werden
   geschrieben. `schluessel(w)` liefert den listItemKey des unveränderten
   Vorbilds oder null. */
function pfListe(f, col, key, werte, schluessel, erzeuge){
  if(!werte.length) return [];
  const {items, itemCol} = f ? splitListItems(f) : {items:[], itemCol:null};
  const ic = itemCol == null ? col : itemCol;
  /* Was zwischen Kopfzeile und erstem Eintrag steht — ein Kommentar zur ganzen
     Liste, eine Leerzeile —, kennt splitListItems nicht: es gehört zu keinem
     Eintrag und verschwände beim Neuschreiben. Eine Leerzeile ohne Eintrag
     dahinter trennt allerdings nach unten und zählt zum Nachspann. */
  const davor = [];
  if(f) for(let i = 1; i < f.lines.length && yBlank(f.lines[i]); i++) davor.push(f.lines[i]);
  const vorspann  = items.length ? davor : davor.filter(l => l.trim() !== '');
  const nachspann = items.length ? pfNachspann(items[items.length - 1].lines)
                                 : davor.filter(l => l.trim() === '');
  const vorhanden = new Map();
  items.forEach(it=>{
    const k = listItemKey(it);
    if(!vorhanden.has(k)) vorhanden.set(k, it);
    // Ein einfacher Wert trägt seinen Zeilenkommentar im Schlüssel mit
    // („- Q1  # Hauptquelle"). Ohne diesen zweiten Schlüssel gälte der
    // Eintrag als geändert und würde neu geschrieben — der Kommentar wäre weg.
    if(k.startsWith('wert:')){
      const rein = 'wert:' + k.slice(5).replace(/\s+#.*$/, '').replace(/^"(.*)"$/, '$1').trim();
      if(!vorhanden.has(rein)) vorhanden.set(rein, it);
    }
  });
  const out = [pfListKopf(f, col, key), ...vorspann];
  werte.forEach(w=>{
    const k = schluessel(w);
    const it = k ? vorhanden.get(k) : null;
    if(it) out.push(...it.lines);
    else out.push(...erzeuge(w, ic, vorhanden));
  });
  return out.concat(nachspann);
}

/* Die Zeilen eines Feldes nach der Bearbeitung. `f` ist das vorhandene Feld
   (oder null, wenn es das Feld noch nicht gibt), `alt` das Objekt aus dem
   Modell — daran hängt die Entscheidung „unverändert, also unangetastet". */
function pfFeldZeilen(rolle, f, col, e, alt){
  const key = f ? f.key : pfStd(rolle);
  if(rolle === 'desc'){
    // Eine geänderte Beschreibung immer als Block „desc: |"; unveränderte stellt
    // erst yamlEinheitlich beim Speichern über das Formular um — Übernahme
    // und Attributdialog lassen unberührten Text Zeichen für Zeichen stehen.
    const neu = e.desc || '', vor = alt.desc || '';
    if(neu === vor) return f ? f.lines : [];
    if(!neu) return [];
    const zeilen = yBlock(col, key, neu) || [' '.repeat(col) + key + ': ' + yWert(neu)];
    return f ? zeilen.concat(pfNachspann(f.lines.slice())) : zeilen;
  }
  if(PF_EINZEL.includes(rolle)){
    const neu = e[rolle] || '', vor = alt[rolle] || '';
    if(neu === vor) return f ? f.lines : [];
    return neu ? [' '.repeat(col) + key + ': ' + yWert(neu)] : [];
  }
  if(rolle === 'domain'){
    // Eine Domäne bleibt ein Einzelwert, mehrere werden eine Liste; was schon
    // als Liste dasteht, bleibt eine
    const liste = o => o.domains || (o.domain ? [o.domain] : []);
    const neu = liste(e), vor = liste(alt);
    if(neu.join('\u0000') === vor.join('\u0000')) return f ? f.lines : [];
    if(!neu.length) return [];
    // Eine Quelltabelle hat genau eine Domäne: immer als Einzelwert, auch statt einer älteren Liste
    if(neu.length === 1 && (alt.tabelle !== undefined || !(f && splitListItems(f).items.length))) return [' '.repeat(col) + key + ': ' + yWert(neu[0])];
    return pfListe(f, col, key, neu, w => vor.includes(w) ? 'wert:' + w : null, (w, ic)=> [' '.repeat(ic) + '- ' + yWert(w)]);
  }
  if(rolle === 'tabquellen' && !e.tabQuellen) return f ? f.lines : [];
  if(rolle === 'sources'){
    // Reihenfolge = Wichtigkeit. Ein unveränderter Eintrag (gleicher Name,
    // gleiche Gruppe) kommt mit seinen Zeilen zurück, auch verschoben; die
    // Kurzform heißt bei listItemKey „wert:", die Langform „attr:" (name:)
    const gNeu = e.quellGruppe || {}, gAlt = alt.quellGruppe || {}, alte = new Set(alt.sources);
    const gruppeWert = g => /^[\w-]+$/.test(g) ? g : yWert(g);
    return pfListe(f, col, key, e.sources,
      w => !alte.has(w) || (gNeu[w] || null) !== (gAlt[w] || null) ? null : (gAlt[w] ? 'attr:' : 'wert:') + w,
      (w, ic)=> gNeu[w]
        ? [' '.repeat(ic) + '- name: ' + yWert(w), ' '.repeat(ic + 2) + 'overlap_group: ' + gruppeWert(gNeu[w])]
        : [' '.repeat(ic) + '- ' + yWert(w)]);
  }
  if(rolle === 'keys' || rolle === 'tabquellen'){
    const werte = {keys: e.keys, tabquellen: e.tabQuellen}[rolle];
    const alte = new Set({keys: alt.keys, tabquellen: alt.tabQuellen || []}[rolle]);
    return pfListe(f, col, key, werte,
      w => alte.has(w) ? 'wert:' + w : null,
      (w, ic)=> [' '.repeat(ic) + '- ' + yWert(w)]);
  }
  if(rolle === 'attrs')
    return pfListe(f, col, key, e.attrs,
      a => (a._alt && pfAttrGleich(a, a._alt)) ? 'attr:' + a._alt.name : null,
      (a, ic, vorhanden)=> pfAttrZeilen(a, ic, a._alt ? vorhanden.get('attr:' + a._alt.name) : null));
  return pfListe(f, col, key, e.rels,
    r => (r._alt && pfRelGleich(r, r._alt)) ? 'bez:' + r._alt.to + '\u0000' + (r._alt.name || '') : null, pfRelZeilen);
}

/* ---------- Die vier Eingriffe in den Modelltext ---------- */

/* Ein Objekt nach dem Formularstand umschreiben. Felder, die die Pflege nicht
   verantwortet, bleiben an ihrem Platz stehen. */
function goObjektAendern(text, name, e, alt, zerleger = splitBusinessObjects){
  const B = zerleger(text);
  if(!B) return null;
  const idx = B.blocks.findIndex(b => b.name === name);
  if(idx < 0) return null;
  const blk = B.blocks[idx];
  const F = splitObjectFields(blk.lines);
  const col = F.fieldCol != null ? F.fieldCol : yCol(blk.lines[0]) + 2;
  const zeilen = [F.head, ...F.vorspann];
  const fertig = new Set();
  const extra = e.extra || {};
  // Eine gruppierte Quelltabelle hat ihr System im Abschnitt, nicht im Feld:
  // ein Systemwechsel hängt sie um (goUmbenennen), statt source_system zu schreiben.
  if(blk.flach === false) fertig.add('system');
  // Quelltabellen haben keine Business Keys; ein Feld aus älteren Dateien bleibt, wie es ist
  if(blk.flach !== undefined) fertig.add('keys');
  F.fields.forEach(f=>{
    const rolle = pfRolle(f.key);
    if(!rolle && f.key in extra && !fertig.has('+' + f.key)){
      fertig.add('+' + f.key);
      zeilen.push(...pfZusatzZeilen(f.key, f, col, e, alt));
      return;
    }
    if(!rolle || fertig.has(rolle)){ zeilen.push(...f.lines); return; }
    fertig.add(rolle);
    zeilen.push(...pfFeldZeilen(rolle, f, col, e, alt));
  });
  // Ein noch fehlendes Feld gehört vor die trennenden Leerzeilen am Blockende,
  // nicht dahinter — sonst stünde es hinter der Lücke zum nächsten Objekt.
  const nachspann = pfNachspann(zeilen);
  PF_FELDER.forEach(({rolle})=>{
    if(!fertig.has(rolle)) zeilen.push(...pfFeldZeilen(rolle, null, col, e, alt));
  });
  Object.keys(extra).forEach(k=>{
    if(!fertig.has('+' + k)) zeilen.push(...pfZusatzZeilen(k, null, col, e, alt));
  });
  zeilen.push(...nachspann);
  blk.lines = zeilen;
  return pfZusammen(B);
}

/* Verweise auf ein Objekt in einem fremden Block umschreiben (`nach`) oder die
   Beziehung entfernen (`nach === null`). „to:" gilt nur auf der Eintragsebene:
   unter „cardinality:" steht dasselbe Wort für etwas ganz anderes. */
function pfVerweise(lines, von, nach, system){
  // Eine Quelltabelle der flachen Form verweist ohne System; gemeint ist ihr eigenes
  const voll = (w, teile)=> system && w.split('.').length === teile ? system + '.' + w : w;
  const F = splitObjectFields(lines);
  if(F.fieldCol == null) return lines;
  const out = [F.head, ...F.vorspann];
  F.fields.forEach(f=>{
    const rolle = pfRolle(f.key);
    if(rolle === 'rels'){
      const {items} = splitListItems(f);
      if(!items.length){ out.push(...f.lines); return; }
      const behalten = [];
      items.forEach(it=>{
        const k = listItemKey(it);
        const ziel = k.startsWith('bez:') ? k.slice(4).split('\u0000')[0] : null;
        if(ziel === null || voll(ziel, 1) !== von){ behalten.push(...it.lines); return; }
        if(nach === null) return;
        const ic = yCol(it.lines[0]);
        behalten.push(...it.lines.map(l=>{
          if(yCol(l) > ic + 2) return l;
          const m = l.match(/^(\s*-?\s*to\s*:\s*)"?[^"#]*"?\s*$/);
          return m ? m[1] + yWert(nach) : l;
        }));
      });
      if(behalten.length) out.push(f.lines[0], ...behalten);
      return;
    }
    if(rolle === 'attrs' && nach !== null){
      out.push(...f.lines.map(l=>{
        const m = l.match(/^(\s*references\s*:\s*)"?([^"#]*?)"?\s*$/);
        if(!m) return l;
        // Ziel ist alles vor der Spalte: Kunde.KundeID wie Webshop.Kunde.KundeID
        const w = voll(m[2], 2);
        if(!w.startsWith(von + '.')) return l;
        return m[1] + yWert(nach + w.slice(von.length));
      }));
      return;
    }
    out.push(...f.lines);
  });
  return out;
}

/* Umbenennen heißt: Kopfzeile, jedes „to:" darauf und jedes „references:"
   darauf. Bliebe eines stehen, zerfiele das Modell in zwei Hälften. Bei den
   Quelltabellen steht im Kopf nur der Tabellenname; wechselt das System, wird
   die Tabelle in dessen Abschnitt umgehängt. */
function goUmbenennen(text, alt, neu, zerleger = splitBusinessObjects){
  const B = zerleger(text);
  if(!B) return null;
  const kopf = B.kopfName ? B.kopfName(neu) : neu;
  B.blocks.forEach(b=>{
    if(b.name === alt){
      b.lines = [b.lines[0].replace(/^(\s*)"?[^":]+"?\s*:/, '$1' + kopf + ':'), ...b.lines.slice(1)];
      b.name = neu;
    }
    b.lines = pfVerweise(b.lines, alt, neu, b.system);
  });
  if(B.umhaengen) B.umhaengen(neu);
  return pfZusammen(B);
}

/* Löschen nimmt den Block heraus und mit ihm die Beziehungen, die auf ihn
   zeigen — sonst bliebe ein Ziel zurück, das es nicht mehr gibt. Ein
   „references:" auf das Objekt bleibt stehen und wird in der Prüfung
   gemeldet: es steckt in einem Attribut, das dem Nutzer gehört. */
function goObjektLoeschen(text, name, zerleger = splitBusinessObjects){
  const B = zerleger(text);
  if(!B) return null;
  const i = B.blocks.findIndex(b => b.name === name);
  if(i >= 0) B.blocks.splice(i, 1);
  B.blocks.forEach(b=>{ b.lines = pfVerweise(b.lines, name, null, b.system); });
  if(B.aufraeumen) B.aufraeumen();            // ein leerer Systemabschnitt entfällt
  return pfZusammen(B);
}

function goObjektAnlegen(text, name, zerleger = splitBusinessObjects){
  const B = zerleger(text);
  if(!B) return null;
  if(B.einhaengen){                           // Quelltabelle: in den Abschnitt ihres Systems
    const p = name.indexOf('.');
    B.einhaengen({name, lines: [name.slice(p + 1) + ':']}, name.slice(0, p));
    return pfZusammen(B);
  }
  const col = B.childCol != null ? B.childCol : 2;
  B.blocks.push({name, lines: [' '.repeat(col) + name + ':']});
  return pfZusammen(B);
}

/* Ein Objektname in der Hierarchiebeschreibung: umbenennen oder (neu === null)
   aus allen Diagrammen nehmen. Die Übersicht führt Objekte ausschließlich als
   Listeneinträge, Diagrammnamen sind Abbildungsschlüssel — beides lässt sich
   an der Zeile unterscheiden. */
function uebersichtObjekt(text, alt, neu){
  const raus = [];
  const zeilen = String(text || '').split('\n');
  zeilen.forEach((l, i)=>{
    const m = l.match(/^(\s*-\s*)"?(.*?)"?\s*$/);
    if(!m || m[2] !== alt) return;
    if(neu === null) raus.push(i); else zeilen[i] = m[1] + neu;
  });
  return zeilen.filter((_, i)=> !raus.includes(i)).join('\n');
}

/* Kennungen sind aus dem Namen gebaut (o:Kunde). Beim Umbenennen müssen alle
   Ablagen mitwandern, sonst gilt der Kasten als neu: die Anordnung wäre
   vergessen und mit ihr jeder von Hand gezogene Kantenzug. */
function pfIdsUmbenennen(altId, neuId){
  const um = m => { if(m && m[altId] !== undefined){ m[neuId] = m[altId]; delete m[altId]; } };
  // Die Komplettansicht zeigt nur Geschäftsobjekte; eine Tabelle gleichen
  // Namens darf deren Lage nicht mitnehmen. Der Baum ist der des Bereichs.
  const komplett = S.mode !== 'quellen';
  if(komplett) um(S.saved[1]);
  Object.values(S.hierSaved).forEach(um);
  if(komplett && S.hidden.has(altId)){ S.hidden.delete(altId); S.hidden.add(neuId); }
  Object.keys(S.hierShown).forEach(k=>{
    S.hierShown[k] = (S.hierShown[k] || []).map(id => id === altId ? neuId : id);
  });
  const schluessel = k=>{
    const i = k.indexOf('\u203a');
    if(i < 0) return k;
    const rest = k.slice(i+1), j = rest.lastIndexOf('#');
    const von = k.slice(0, i), nach = j < 0 ? rest : rest.slice(0, j), ord = j < 0 ? '' : rest.slice(j);
    return (von === altId ? neuId : von) + '\u203a' + (nach === altId ? neuId : nach) + ord;
  };
  const routen = m=>{
    const out = {};
    Object.keys(m || {}).forEach(k => { out[schluessel(k)] = m[k]; });
    return out;
  };
  if(komplett) S.routes[1] = routen(S.routes[1]);
  Object.keys(S.hierRoutes).forEach(k => { S.hierRoutes[k] = routen(S.hierRoutes[k]); });
}

/* ---------- Den neuen Modelltext übernehmen ---------- */
/* Derselbe Weg wie beim Delta: Modell neu bauen, Ansicht auffrischen. Der
   Verlauf schreibt den Modelltext mit, Strg+Z nimmt die Bearbeitung also
   wieder zurück. Ohne Einpassen — beim Tippen soll der Ausschnitt stehen. */
function pfUebernehmen(text, selId, meldung){
  const quellen = S.mode === 'quellen';
  let modell;
  try{ modell = quellen ? buildModel(text, 'quelle') : buildModel(text); }
  catch(err){ toast('Der geänderte Modelltext ist nicht lesbar: ' + err.message); return false; }
  if(quellen){ S.quellText = text; S.quellModell = modell; }
  else { S.model = modell; S.yamlText = text; quellModellBauen(); }   // die Zuordnung prüft gegen die neuen Namen
  S.pflege = null; pfEntwurf = null;
  if(!S.outline) parseOutline();
  renderMessages(); syncLayoutMenu();
  S.sel = new Set(); S.selected = null;
  ansichtNeu({autoFit:false});
  // Erst danach auswählen: in Hierarchie und Quelltabellen wählt der Neuaufbau
  // das Diagramm neu, hebt die Auswahl auf und stellt den Reiter „Beschreibung"
  // vor — das gespeicherte Objekt war dann nicht mehr zu sehen.
  if(selId && S.graph.byId.has(selId)){
    S.sel = new Set([selId]); S.selected = selId;
    draw(); setSidePane('details'); renderDetails();
  }
  // Im Bereich der Quelltabellen legt kein setView den Stand ab; ohne diesen
  // Aufruf fehlte die Bearbeitung im Verlauf, Strg+Z nähme die Aktion davor.
  writeStore();
  toast(meldung);
  return true;
}

/* Ein umbenanntes Geschäftsobjekt in der Zuordnung der Quelltabellen
   nachziehen („business_object:"). Nur das Feld selbst, kein gleichlautender
   Wert anderswo; ändert sich nichts, bleibt der Text unberührt. */
function quellBoUmbenennen(text, alt, neu){
  const B = splitQuellTabellen(text);
  if(!B) return text;
  let geaendert = false;
  B.blocks.forEach(b=>{
    if(!b.name) return;                         // Kopf eines Systemabschnitts
    const F = splitObjectFields(b.lines);
    b.lines = b.lines.map(l=>{
      const m = !yBlank(l) && yCol(l) === F.fieldCol
        && l.match(/^(\s*"?(?:business_object|Business_Object|Geschäftsobjekt|Geschaeftsobjekt)"?\s*:\s*)"?([^"#]*?)"?(\s+#.*)?\s*$/);
      if(!m || m[2].trim() !== alt) return l;
      geaendert = true;
      return m[1] + yWert(neu) + (m[3] || '');
    });
  });
  return geaendert ? pfZusammen(B) : text;
}

const PF_VERBOTEN = /[:#"]/;
function pfNamePruefen(name){
  if(!name){ toast('Der Name darf nicht leer sein'); return false; }
  if(PF_VERBOTEN.test(name)){ toast('Ein Name darf kein :, # oder " enthalten'); return false; }
  return true;
}
/* Quelltabellen: Tabellenname und Quellsystem einzeln geprüft — der Punkt
   ist ihr Trenner und darf in keinem der beiden stehen. */
function qtNamePruefen(tabelle, system){
  if(!pfNamePruefen(tabelle)) return false;
  if(!system){ toast('Eine Quelltabelle braucht ein Quellsystem'); return false; }
  if(!pfNamePruefen(system)) return false;
  if(tabelle.includes('.') || system.includes('.')){ toast('Tabelle und Quellsystem dürfen keinen Punkt enthalten'); return false; }
  return true;
}

/* Jeder Bereich hat seinen Schalter: die Geschäftsobjekte „Geschäftsobjekte
   bearbeiten", die Quelltabellen „Quelltabellen bearbeiten". */
const pflegeErlaubt = ()=> S.mode === 'quellen' ? S.quellPflegeAn : S.pflegeAn;

/* ---------- Formular im Reiter „Details" ---------- */
let pfEntwurf = null;          // Arbeitsstand: erst beim Speichern wird daraus YAML

function pflegeStart(id){
  const n = S.graph.byId.get(id);
  if(!pflegeErlaubt() || !n || n.kind !== 'object') return;
  pfEntwurf = pfEntwurfAus(n.ref);
  S.pflege = id;
  // Das Formular steht in den Details des gewählten Objekts. Nach dem Anlegen
  // hat der Neuaufbau des Diagramms die Auswahl aufgehoben — dann blieb es leer.
  if(S.selected !== id || S.sel.size !== 1){ S.sel = new Set([id]); S.selected = id; draw(); }
  setSidePane('details');
  renderDetails();
}

/* Der Arbeitsstand zu einem Objekt aus dem Modell — für das Formular und für
   die Übernahme aus den Quelltabellen, die damit genauso schreibt. */
function pfEntwurfAus(o){
  return {
    name: o.tabelle || o.name,                       // Quelltabelle: ohne System, das hat ein eigenes Feld
    domains: o.domains.slice(), leading: o.leading || '', desc: o.desc || '', tabQuellen: o.tabQuellen.slice(),
    keys: o.keys.slice(), sources: o.sources.slice(), quellGruppe: Object.assign({}, o.quellGruppe),
    // Arbeitsliste fürs Formular: Zeile für Zeile, die Gruppe hängt an der Zeile, nicht am Namen
    quellListe: (o.sources || []).map(s => ({name: s, gruppe: (o.quellGruppe || {})[s] || null})),
    system: o.system || '', bo: o.bo || '',          // nur bei Quelltabellen belegt
    // Am Objekt nur die eingeschalteten: nur sie verantwortet die Pflege.
    extra: Object.fromEntries(S.zusatzAn.objekt.map(k => [k, k in o.extra ? o.extra[k] : ''])),
    attrs: o.attrs.map(a=>({name:a.name, type:a.type||'', nullable:!!a.nullable,
                            pk:!!a.pk, ak:!!a.ak, fk:!!a.fk, ref:a.ref||'', quellen:a.quellen.slice(), extra:Object.assign({}, a.extra), _alt:a})),
    rels:  o.rels.map(r=>({to:r.to, name:r.name||'', from:r.from||'', toCard:r.toCard||'', quellen:r.quellen.slice(), _alt:r}))
  };
}

function pflegeEnde(){
  S.pflege = null; pfEntwurf = null;
  renderDetails();
}

/* Den Formularstand einsammeln. Geschieht vor jedem Umbau der Liste und vor
   dem Speichern — sonst verlöre ein Tippen den Wert, sobald eine Zeile
   dazukommt oder wegfällt. */
function pfLesen(){
  const box = $('detailBody');
  if(!pfEntwurf || !box || !$('pfName')) return;
  const e = pfEntwurf;
  const liste = s => s.split(',').map(x => x.trim()).filter(Boolean);
  e.name = $('pfName').value.trim();
  e.domains = liste($('pfDomain').value);
  if($('pfLeading')) e.leading = $('pfLeading').value;
  // Zeilentrenner U+2028/U+2029 (aus Word eingefügt) wie beim Lesen als Umbruch
  e.desc = $('pfDesc').value.replace(/[\u2028\u2029]/g, '\n').trim();
  if($('pfKeys')) e.keys = liste($('pfKeys').value);
  e.quellListe.forEach((q, i)=>{ const f = box.querySelector('.pfq-name[data-i="' + i + '"]'); if(f) q.name = f.value.trim(); });
  if($('pfSystem')){ e.system = $('pfSystem').value.trim(); e.bo = $('pfBO').value; }
  const feld = (sel, i)=> box.querySelector(sel + '[data-i="' + i + '"]');
  S.zusatzAn.objekt.forEach((k, z)=>{ e.extra[k] = feld('.pfo-extra', z).value.trim(); });
  e.attrs.forEach((a, i)=>{
    a.name = feld('.pfa-name', i).value.trim();
    a.type = feld('.pfa-type', i).value.trim();
    a.ref  = feld('.pfa-ref', i).value.trim();
    a.pk   = feld('.pfa-pk', i).checked;
    a.ak   = feld('.pfa-ak', i).checked;
    a.fk   = feld('.pfa-fk', i).checked;
    a.nullable = feld('.pfa-null', i).checked;
    const zf = box.querySelectorAll('.pfa-extra[data-i="' + i + '"]');
    S.zusatzAn.attribut.forEach((k, z)=>{
      const v = zf[z].value.trim();
      // Leer und vorher nicht da: kein Platzhalter anlegen.
      if(v === '' && !(a._alt && k in a._alt.extra)) delete a.extra[k];
      else a.extra[k] = v;
    });
  });
  e.rels.forEach((r, i)=>{
    r.to     = feld('.pfb-to', i).value.trim();
    r.name   = feld('.pfb-name', i).value.trim();
    r.from   = feld('.pfb-from', i).value;
    r.toCard = feld('.pfb-toc', i).value;
  });
}

function pflegeFormular(box){
  const e = pfEntwurf;
  const ziele = Object.keys(aktModell().objects).sort((a,b)=> a.localeCompare(b, 'de'));
  const wahl = (klasse, i, werte, titel)=>
    `<select class="${klasse}" data-i="${i}" aria-label="${titel}">`
    + werte.map(([v,l])=>`<option value="${esc(v)}">${esc(l)}</option>`).join('') + `</select>`;
  const karten = [['', '—'], ...Object.keys(CARD_LABEL).map(k=>[k, CARD_LABEL[k]])];
  // Quelltabellen: genau ein Quellsystem und die Zuordnung zu einem Geschäftsobjekt
  const quellen = S.mode === 'quellen';
  const gos = Object.keys(S.model.objects).sort((a,b)=> a.localeCompare(b, 'de'));
  if(e.bo && !gos.includes(e.bo)) gos.push(e.bo);        // unbekannte Zuordnung bleibt wählbar
  // Führende Domäne: eine der Domänen; eine nicht gelistete bleibt wählbar
  const leit = e.domains.concat(e.leading && !e.domains.includes(e.leading) ? [e.leading] : []);
  const wahlLeading = `<select id="pfLeading" aria-label="Führende Domäne">`
    + [['', '—'], ...leit.map(d => [d, d])].map(([v,l])=>`<option value="${esc(v)}">${esc(l)}</option>`).join('') + `</select>`;
  const wahlGO = `<select id="pfBO" aria-label="Geschäftsobjekt">`
    + [['', '—'], ...gos.map(g => [g, g])].map(([v,l])=>`<option value="${esc(v)}">${esc(l)}</option>`).join('') + `</select>`;

  box.innerHTML =
    `<div class="hd-bar"><h2 class="hd-title">Bearbeiten</h2>
       <span class="hd-actions"><button class="hd-btn ok" id="pfSave">Speichern</button>
       <button class="hd-btn" id="pfCancel">Abbrechen</button></span></div>
     <div class="pf">
       <label class="pfr"><span>${quellen ? 'Tabelle' : 'Name'}</span><input id="pfName"></label>
       <label class="pfr"><span>Domain</span><input id="pfDomain"${quellen ? '' : ' placeholder="eine oder mehrere, durch Komma getrennt"'}></label>
       ${quellen ? '' : `<label class="pfr"><span>Führende Domäne</span>${wahlLeading}</label>`}
       <label class="pfr col"><span>Beschreibung</span><textarea id="pfDesc" rows="3"></textarea></label>
       ${quellen ? '' : '<label class="pfr col"><span>Business Keys</span><input id="pfKeys" placeholder="durch Komma getrennt"></label>'}
       ${quellen
         ? `<label class="pfr"><span>Quellsystem</span><input id="pfSystem"></label>
            <label class="pfr"><span>Geschäftsobjekt</span>${wahlGO}</label>`
         : pfQuellenMarkup(e)}
       ${S.zusatzAn.objekt.map((k,z)=>`<label class="pfr col"><span>${esc(k)}</span><input class="pfo-extra" data-i="${z}"></label>`).join('')}

       <div class="grouphead">ATTRIBUTE</div>
       ${e.attrs.map((a,i)=>`<div class="pfa">
          <div class="pfz"><input class="pfa-name" data-i="${i}" placeholder="Name" aria-label="Attributname">
            <input class="pfa-type" data-i="${i}" placeholder="Typ" aria-label="Datentyp">
            <button class="pfx" data-weg="attr" data-i="${i}" title="Attribut entfernen" aria-label="Attribut entfernen">×</button></div>
          <div class="pfz">
            <label class="pfk"><input type="checkbox" class="pfa-pk" data-i="${i}">PK</label>
            <label class="pfk"><input type="checkbox" class="pfa-ak" data-i="${i}">AK</label>
            <label class="pfk"><input type="checkbox" class="pfa-fk" data-i="${i}">FK</label>
            <label class="pfk"><input type="checkbox" class="pfa-null" data-i="${i}">null</label>
            <input class="pfa-ref" data-i="${i}" placeholder="verweist auf Objekt.Attribut" aria-label="Verweisziel">
          </div>
          ${S.zusatzAn.attribut.map(k=>`<div class="pfz"><span class="pfk">${esc(k)}</span>
            <input class="pfa-extra" data-i="${i}" placeholder="${esc(k)}" aria-label="${esc(k)}"></div>`).join('')}</div>`).join('')}
       <button class="pfadd" data-neu="attr">＋ Attribut</button>

       <div class="grouphead">BEZIEHUNGEN AUSGEHEND</div>
       <datalist id="pfZiele">${ziele.map(z=>`<option value="${esc(z)}"></option>`).join('')}</datalist>
       ${e.rels.map((r,i)=>`<div class="pfb">
          <div class="pfz"><input class="pfb-to" data-i="${i}" list="pfZiele" placeholder="${quellen ? 'System.Tabelle' : 'Ziel'}, auch neu" aria-label="Ziel der Beziehung">
            <button class="pfx" data-weg="rel" data-i="${i}" title="Beziehung entfernen" aria-label="Beziehung entfernen">×</button></div>
          <div class="pfz"><input class="pfb-name" data-i="${i}" placeholder="Name der Beziehung" aria-label="Beziehungsname">
            ${wahl('pfb-from', i, karten, 'Kardinalität an der Quelle')}<span class="pfsep">:</span>
            ${wahl('pfb-toc', i, karten, 'Kardinalität am Ziel')}</div></div>`).join('')}
       <button class="pfadd" data-neu="rel">＋ Beziehung</button>

       <button class="pfweg" id="pfDelete">Objekt löschen …</button>
     </div>`;

  // Werte erst jetzt setzen: als Attribut im Markup gingen Anführungszeichen
  // und Zeilenumbrüche durch die Maskierung verloren.
  $('pfName').value = e.name;
  $('pfDomain').value = e.domains.join(', ');
  if(!quellen) $('pfLeading').value = e.leading;
  $('pfDesc').value = e.desc;
  if(!quellen) $('pfKeys').value = e.keys.join(', ');
  const feld = (sel, i)=> box.querySelector(sel + '[data-i="' + i + '"]');
  if(quellen){ $('pfSystem').value = e.system; $('pfBO').value = e.bo; }
  else e.quellListe.forEach((q, i)=>{ feld('.pfq-name', i).value = q.name; });
  S.zusatzAn.objekt.forEach((k, z)=>{ feld('.pfo-extra', z).value = e.extra[k]; });
  e.attrs.forEach((a,i)=>{
    const zf = box.querySelectorAll('.pfa-extra[data-i="' + i + '"]');
    S.zusatzAn.attribut.forEach((k, z)=>{ zf[z].value = k in a.extra ? a.extra[k] : ''; });
    feld('.pfa-name', i).value = a.name;
    feld('.pfa-type', i).value = a.type;
    feld('.pfa-ref', i).value = a.ref;
    feld('.pfa-pk', i).checked = a.pk;
    feld('.pfa-ak', i).checked = a.ak;
    feld('.pfa-fk', i).checked = a.fk;
    feld('.pfa-null', i).checked = a.nullable;
  });
  e.rels.forEach((r,i)=>{
    feld('.pfb-to', i).value = r.to;
    feld('.pfb-name', i).value = r.name;
    feld('.pfb-from', i).value = r.from;
    feld('.pfb-toc', i).value = r.toCard;
  });

  $('pfSave').addEventListener('click', pflegeSpeichern);
  $('pfCancel').addEventListener('click', pflegeEnde);
  $('pfDelete').addEventListener('click', ()=> pflegeLoeschen());
  box.querySelectorAll('[data-neu]').forEach(b=> b.addEventListener('click', ()=> pfZeileNeu(b.dataset.neu)));
  box.querySelectorAll('[data-weg]').forEach(b=> b.addEventListener('click', ()=> pfZeileWeg(b.dataset.weg, +b.dataset.i)));
  box.querySelectorAll('[data-qzug]').forEach(b=> b.addEventListener('click', ()=> pfQuelleVerschieben(+b.dataset.i, +b.dataset.qzug)));
  if($('pfqGruppieren')) $('pfqGruppieren').addEventListener('click', ()=> pfQuellenGruppieren(true));
  if($('pfqLoesen')) $('pfqLoesen').addEventListener('click', ()=> pfQuellenGruppieren(false));
}

/* ---------- Quellen: Reihenfolge und überschneidende Gruppen ----------
   Je Quelle eine Zeile; oben steht die wichtigste. Markierte lassen sich zu
   einer Gruppe zusammenfassen: Quellen einer Gruppe überschneiden sich,
   Gruppen untereinander und Quellen ohne Gruppe sind disjunkt. */
function pfQuellenMarkup(e){
  const zeilen = e.quellListe.map((q, i)=>`<div class="pfz pfq">
      <input type="checkbox" class="pfq-mark" data-i="${i}" aria-label="Quelle markieren">
      <span class="pfq-nr">${i + 1}.</span>
      <input class="pfq-name" data-i="${i}" placeholder="Quelle" aria-label="Quelle">
      <span class="pfq-grp" title="${q.gruppe ? 'überschneidet sich mit den anderen Quellen der Gruppe ' + esc(q.gruppe) : 'disjunkt'}">${q.gruppe ? '∩' + esc(q.gruppe) : ''}</span>
      <button class="pfx" data-qzug="-1" data-i="${i}" title="wichtiger: nach oben" aria-label="nach oben"${i ? '' : ' disabled'}>↑</button>
      <button class="pfx" data-qzug="1" data-i="${i}" title="weniger wichtig: nach unten" aria-label="nach unten"${i < e.quellListe.length - 1 ? '' : ' disabled'}>↓</button>
      <button class="pfx" data-weg="src" data-i="${i}" title="Quelle entfernen" aria-label="Quelle entfernen">×</button></div>`).join('');
  const n = new Set(e.quellListe.map((q, i)=> q.gruppe ? 'g:' + q.gruppe : 'q:' + i)).size;   // je Gruppe eine, sonst je Quelle
  return `<div class="grouphead">QUELLEN (WICHTIGSTE ZUERST)</div>${zeilen}
     <div class="pfz"><button class="pfadd" data-neu="src">＋ Quelle</button>
       <button class="pfadd" id="pfqGruppieren" title="Die markierten Quellen überschneiden sich">Markierte gruppieren</button>
       <button class="pfadd" id="pfqLoesen" title="Die markierten Quellen werden wieder disjunkt">Gruppe auflösen</button></div>
     ${e.quellListe.length ? `<div class="pfq-info">${n} disjunkte Einheit${n === 1 ? '' : 'en'}</div>` : ''}`;
}

function pfQuelleVerschieben(i, d){
  pfLesen();
  const l = pfEntwurf.quellListe, j = i + d;
  if(j < 0 || j >= l.length) return;
  [l[i], l[j]] = [l[j], l[i]];
  renderDetails();
}

/* Gruppieren: die markierten bilden eine neue Gruppe (kleinste freie Nummer)
   und verlassen ihre bisherige. Auflösen: die markierten werden disjunkt. */
function pfQuellenGruppieren(zusammen){
  pfLesen();
  const box = $('detailBody'), l = pfEntwurf.quellListe;
  const mark = l.map((_, i)=> !!(box.querySelector('.pfq-mark[data-i="' + i + '"]') || {}).checked);
  const gew = l.filter((_, i)=> mark[i]);
  if(zusammen && gew.length < 2){ toast('Mindestens zwei Quellen markieren'); return; }
  if(!gew.length){ toast('Erst Quellen markieren'); return; }
  let neu = null;
  if(zusammen){
    const belegt = new Set(l.filter((_, i)=> !mark[i]).map(q => q.gruppe).filter(Boolean));
    for(let k = 1; !neu; k++) if(!belegt.has(String(k))) neu = String(k);
  }
  gew.forEach(q => q.gruppe = neu);
  renderDetails();
}

/* Vor dem Schreiben: Namensliste und Gruppen aus der Arbeitsliste; eine Gruppe
   mit nur einer Quelle bedeutet nichts und entfällt. */
function pfQuellenUebernehmen(e){
  const l = e.quellListe.filter(q => q.name);
  const anzahl = {};
  l.forEach(q => { if(q.gruppe) anzahl[q.gruppe] = (anzahl[q.gruppe] || 0) + 1; });
  e.sources = l.map(q => q.name);
  e.quellGruppe = Object.fromEntries(l.filter(q => q.gruppe && anzahl[q.gruppe] > 1).map(q => [q.name, q.gruppe]));
}

function pfZeileNeu(art){
  pfLesen();
  if(art === 'src') pfEntwurf.quellListe.push({name:'', gruppe:null});
  else if(art === 'attr') pfEntwurf.attrs.push({name:'', type:'', nullable:false, pk:false, ak:false, fk:false, ref:'', extra:{}, _alt:null});
  // Ohne Vorgabe: ein vorbelegtes Ziel filterte die Vorschlagsliste auf sich selbst
  else pfEntwurf.rels.push({to:'', name:'', from:'', toCard:'', _alt:null});
  renderDetails();
}

function pfZeileWeg(art, i){
  pfLesen();
  ({src: pfEntwurf.quellListe, attr: pfEntwurf.attrs, rel: pfEntwurf.rels})[art].splice(i, 1);
  renderDetails();
}

function pflegeSpeichern(){
  pfLesen();
  const e = pfEntwurf, altName = S.pflege.slice(2), alt = aktModell().objects[altName];
  if(!alt) return;
  const quellen = S.mode === 'quellen';
  if(quellen ? !qtNamePruefen(e.name, e.system) : !pfNamePruefen(e.name)) return;
  if(quellen && e.domains.length > 1){ toast('Eine Quelltabelle hat genau eine Domäne'); return; }
  if(!quellen) pfQuellenUebernehmen(e);
  const neuName = quellen ? e.system + '.' + e.name : e.name;   // Kennung System.Tabelle
  if(neuName !== altName && aktModell().objects[neuName]){ toast(`„${neuName}" gibt es schon`); return; }
  if(e.attrs.some(a => !a.name)){ toast('Jedes Attribut braucht einen Namen'); return; }
  if(e.rels.some(r => !r.to)){ toast('Jede Beziehung braucht ein Ziel'); return; }
  // Ein Ziel, das es noch nicht gibt, wird als leeres Objekt angelegt — mit
  // derselben Prüfung wie „Neu"; eine Quelltabelle als System.Tabelle
  const neueZiele = [...new Set(e.rels.map(r => r.to))]
    .filter(z => z !== neuName && z !== altName && !aktModell().objects[z]);
  for(const z of neueZiele){
    if(quellen){
      const teile = z.split('.');
      if(teile.length !== 2){ toast(`Ein neues Ziel als System.Tabelle angeben, etwa Webshop.Bestellung — nicht „${z}"`); return; }
      if(!qtNamePruefen(teile[1], teile[0])) return;
    } else if(!pfNamePruefen(z)) return;
  }

  let text = goObjektAendern(aktText(), altName, e, alt, aktZerleger());
  if(text == null){ toast('Das Objekt steht so nicht im Modelltext'); return; }
  neueZiele.forEach(z => { text = goObjektAnlegen(text, z, aktZerleger()); });
  if(neuName !== altName){
    text = goUmbenennen(text, altName, neuName, aktZerleger());
    pfIdsUmbenennen('o:' + altName, 'o:' + neuName);
    S.outlineText = uebersichtObjekt(S.outlineText, altName, neuName);
    S.outline = null;
    // Ein Geschäftsobjekt heißt auch in der Zuordnung der Quelltabellen neu
    if(S.mode !== 'quellen'){
      const q = quellBoUmbenennen(quellTextAkt(), altName, neuName);
      if(q !== quellTextAkt()) S.quellText = q;
    }
  }
  text = yamlEinheitlich(text);                    // die ganze Datei einheitlich, wie beim Herunterladen
  pfUebernehmen(text, 'o:' + neuName, 'Gespeichert' + (neueZiele.length ? ', neu angelegt: ' + neueZiele.join(', ') : ''));
}

/* Anlegen und Löschen fragen über den Bedienweg nach; die Arbeit steckt in
   pflegeObjektNeu/pflegeObjektWeg, damit sie auch ohne Dialog prüfbar ist. */
function pflegeNeu(){
  const name = (prompt(S.mode === 'quellen' ? 'Neue Quelltabelle als System.Tabelle:' : 'Name des neuen Geschäftsobjekts:') || '').trim();
  if(name) pflegeObjektNeu(name);
}
function pflegeObjektNeu(name){
  name = String(name || '').trim();
  if(!pflegeErlaubt()) return;
  if(S.mode === 'quellen'){
    const teile = name.split('.');
    if(teile.length !== 2){ toast('Eine neue Quelltabelle als System.Tabelle angeben, etwa Webshop.Bestellung'); return; }
    if(!qtNamePruefen(teile[1].trim(), teile[0].trim())) return;
    name = teile[0].trim() + '.' + teile[1].trim();
  } else if(!pfNamePruefen(name)) return;
  if(aktModell().objects[name]){ toast(`„${name}" gibt es schon`); return; }
  const text = goObjektAnlegen(aktText(), name, aktZerleger());
  if(text == null){ toast(`Im Modelltext fehlt der Abschnitt "${S.mode === 'quellen' ? 'SourceTables' : 'BusinessObjects'}"`); return; }
  if(pfUebernehmen(text, 'o:' + name, `„${name}" angelegt`)) pflegeStart('o:' + name);
}

/* Ohne Argument das offene Formular, mit Kennung ein beliebiges Objekt — aus
   dem Kontextmenü heraus ist kein Formular offen. */
function pflegeLoeschen(id = S.pflege){
  if(!id) return;
  const name = id.slice(2);
  const rein = pfEingehend(name);
  if(confirm(`„${name}" aus dem Modell löschen?`
    + (rein ? ` ${rein} eingehende Beziehung(en) werden mit entfernt.` : ''))) pflegeObjektWeg(name);
}
const pfEingehend = name => Object.values(aktModell().objects)
  .reduce((s,o)=> s + (o.name === name ? 0 : o.rels.filter(r => r.to === name).length), 0);

function pflegeObjektWeg(name){
  if(!pflegeErlaubt() || !aktModell().objects[name]) return;
  const text = goObjektLoeschen(aktText(), name, aktZerleger());
  if(text == null){ toast('Das Objekt steht so nicht im Modelltext'); return; }
  S.outlineText = uebersichtObjekt(S.outlineText, name, null);
  S.outline = null;
  pfUebernehmen(text, null, `„${name}" gelöscht`);
}

$('objNew').addEventListener('click', pflegeNeu);

/* ---------- Einstellungen ----------
   Ein Menü in der Kopfzeile. „Geschäftsobjekte bearbeiten" ist ein Haken:
   aus ist die Vorgabe — das Werkzeug ist zuerst ein Betrachter, und ein
   weitergegebener Stand (HTML-Export, Positionsinformationen) trägt die
   Einstellung mit, statt jedem Leser das Bearbeiten anzubieten. Ausgeschaltet
   betrifft das nur die Fachdaten: anordnen, Kanten umlenken und die Hierarchie
   bleiben. „Zusatzattribute …" öffnet einen Dialog. */
function pflegeSchalten(an){
  S.pflegeAn = !!an;
  if(!pflegeErlaubt()){ S.pflege = null; pfEntwurf = null; }   // offenes Formular schließen
  $('optPflege').setAttribute('aria-checked', String(S.pflegeAn));
  renderObjectList(); renderDetails();
  writeStore();
  toast(S.pflegeAn ? 'Bearbeiten eingeschaltet' : 'Bearbeiten ausgeschaltet');
}

/* Zusatzattribute: angeboten wird, was das Modell an unbekannten Schlüsseln
   mitbringt. Eingeschaltet erscheinen sie im Formular und in den Details;
   ausgeschaltet bleiben sie in der Datei unberührt stehen. */
function zusatzAuf(){
  closeMenus();
  const z = aktModell().zusatz;
  const gruppe = (ebene, titel, einheit)=>{
    const liste = [...z[ebene]];
    return `<div class="grouphead">${titel}</div>` + (liste.length
      ? liste.map(([k, n])=>`<label class="einst"><input type="checkbox" data-ebene="${ebene}" data-k="${esc(k)}"${S.zusatzAn[ebene].includes(k) ? ' checked' : ''}>
          <span><strong>${esc(k)}</strong>an ${n} ${einheit}</span></label>`).join('')
      : '<div class="empty">keine</div>');
  };
  $('zusatzListe').innerHTML =
    `<div class="empty">Übernommen wird jeder Schlüssel aus der YAML, den die App nicht selbst auswertet.
       Eingeschaltete Felder lassen sich beim Bearbeiten pflegen und stehen in den Details.</div>`
    + gruppe('objekt', 'AN GESCHÄFTSOBJEKTEN', 'Objekten')
    + gruppe('attribut', 'AN ATTRIBUTEN', 'Attributen');
  $('zusatzListe').querySelectorAll('input[data-ebene]').forEach(c=>
    c.addEventListener('change', ()=> zusatzSchalten(c.dataset.ebene, c.dataset.k, c.checked)));
  $('zusatzDlg').hidden = false;
}
function zusatzZu(){ $('zusatzDlg').hidden = true; }

/* Wie der Pflegeschalter gemerkt und ein Schritt im Verlauf. Ein offenes
   Formular behält, was schon getippt ist. */
function zusatzSchalten(ebene, k, an){
  pfLesen();
  const liste = S.zusatzAn[ebene].filter(x => x !== k);
  if(an) liste.push(k);
  S.zusatzAn = Object.assign({}, S.zusatzAn, {[ebene]: liste});
  if(pfEntwurf && ebene === 'objekt'){
    const o = aktModell().objects[S.pflege.slice(2)], alt = pfEntwurf.extra;
    pfEntwurf.extra = Object.fromEntries(liste.map(x =>
      [x, x in alt ? alt[x] : (o && x in o.extra ? o.extra[x] : '')]));
  }
  renderDetails();
  writeStore();
}

/* Quelle bzw. Domäne als eigener Kasten neben jedem Objekt — in der
   Komplettansicht wie in der Hierarchie. Wie der Pflegeschalter gemerkt und
   ein Schritt im Verlauf. Neu aufgebaut wird ohne Einpassen; die neuen Kästen
   setzt der Aufbau rechts neben ihr Objekt. */
function elementSchalten(k){
  S.elemente = Object.assign({}, S.elemente, {[k]: !S.elemente[k]});
  syncEinstMenu();
  neuAufbauen();
  writeStore();
}
function syncEinstMenu(){
  $('optPflege').setAttribute('aria-checked', String(S.pflegeAn));
  $('optQuelle').setAttribute('aria-checked', String(!!S.elemente.quelle));
  $('optDomaene').setAttribute('aria-checked', String(!!S.elemente.domaene));
  $('optQuellen').setAttribute('aria-checked', String(S.quellenAn));
  $('optQuellPflege').setAttribute('aria-checked', String(S.quellPflegeAn));
  $('optGO').setAttribute('aria-checked', String(!!S.elemente.geschaeftsobjekt));
  document.body.classList.toggle('quellen-an', S.quellenAn);   // blendet alles zu den Quelltabellen ein
}

/* „Quelltabellen verwenden": ohne den Haken gibt es den Bereich nicht —
   kein Modus, keine Dateien, keine Schalter. Wer ihn im Bereich selbst
   abschaltet, landet in der Hierarchie. Gemerkt und ein Schritt im Verlauf. */
function quellenSchalten(an){
  S.quellenAn = !!an;
  syncEinstMenu();
  if(!S.quellenAn && S.mode === 'quellen'){ S.pflege = null; pfEntwurf = null; setMode('hierarchie'); }
  writeStore();
  toast(S.quellenAn ? 'Quelltabellen eingeschaltet' : 'Quelltabellen ausgeschaltet');
}
/* „Quelltabellen bearbeiten": dasselbe wie „Geschäftsobjekte bearbeiten",
   nur für den Bereich der Quelltabellen. */
function quellPflegeSchalten(an){
  S.quellPflegeAn = !!an;
  if(!S.quellPflegeAn && S.mode === 'quellen'){ S.pflege = null; pfEntwurf = null; }
  syncEinstMenu();
  renderObjectList(); renderDetails();
  writeStore();
  toast(S.quellPflegeAn ? 'Bearbeiten der Quelltabellen eingeschaltet' : 'Bearbeiten der Quelltabellen ausgeschaltet');
}

$('btnEinst').addEventListener('click', syncEinstMenu);
$('optPflege').addEventListener('click', ()=> pflegeSchalten(!S.pflegeAn));
$('optQuellen').addEventListener('click', ()=> quellenSchalten(!S.quellenAn));
$('optQuellPflege').addEventListener('click', ()=> quellPflegeSchalten(!S.quellPflegeAn));
$('optGO').addEventListener('click', ()=> elementSchalten('geschaeftsobjekt'));
$('optQuelle').addEventListener('click', ()=> elementSchalten('quelle'));
$('optDomaene').addEventListener('click', ()=> elementSchalten('domaene'));
$('optZusatz').addEventListener('click', zusatzAuf);
$('zusatzZu').addEventListener('click', zusatzZu);
$('zusatzDlg').addEventListener('click', e=>{ if(e.target === $('zusatzDlg')) zusatzZu(); });
