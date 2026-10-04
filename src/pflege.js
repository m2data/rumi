/* =====================================================================
   10 — Pflege: Geschäftsobjekte und ihre Beziehungen bearbeiten

   Die Modelldatei bleibt die Datei des Nutzers: geändert wird nur die
   Stelle, die er angefasst hat. Deshalb wird das YAML nicht neu erzeugt,
   sondern wie beim Delta-Einspielen zeilenweise umgeschrieben — mit
   denselben Zerlegern (splitBusinessObjects, splitObjectFields,
   splitListItems, listItemKey). Kommentare, Reihenfolge, Einrückung und
   Schreibvarianten unberührter Stellen überleben so jede Bearbeitung.
   ===================================================================== */

/* Ein Wert fürs YAML. Angeführt wird nur, wo es sein muss — sonst läse sich
   die Datei nach der ersten Bearbeitung anders als davor. */
function yWert(v){
  const s = String(v == null ? '' : v);
  if(s === '' || /^\s|\s$/.test(s) || /[#"'\n\t]/.test(s) || /:(\s|$)/.test(s)
     || /^[-?:,[\]{}&*!|>%@`]/.test(s) || /^(true|false|null|~)$/i.test(s)
     || /^-?\d+(\.\d+)?$/.test(s))
    return '"' + s.replace(/\\/g,'\\\\').replace(/"/g,'\\"').replace(/\n/g,'\\n').replace(/\t/g,'\\t') + '"';
  return s;
}

/* Die Felder eines Objektblocks, die die Pflege verantwortet. Ein Feld kann
   deutsch wie englisch heißen (siehe buildModel) — dann wird der vorhandene
   Schlüssel weiterbenutzt, sonst der erste als Vorgabe. */
const PF_FELDER = [
  {rolle:'domain',  keys:['Domain','domain']},
  {rolle:'desc',    keys:['desc','beschreibung','description']},
  {rolle:'keys',    keys:['business_keys','BusinessKeys']},
  {rolle:'sources', keys:['source_systems','sources']},
  {rolle:'attrs',   keys:['attributes']},
  {rolle:'rels',    keys:['relationships']}
];
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
  if(a.fk)       z.push(i + 'foreign_key: true');
  if(a.ref)      z.push(i + 'references: ' + yWert(a.ref));
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
  return z;
}

const pfExtraGleich = (x = {}, y = {}) =>
  [...new Set([...Object.keys(x), ...Object.keys(y)])].every(k => x[k] === y[k]);
const pfAttrGleich = (a, b) => a.name === b.name && (a.type||'') === (b.type||'')
  && !!a.nullable === !!b.nullable && !!a.pk === !!b.pk && !!a.fk === !!b.fk && (a.ref||'') === (b.ref||'')
  && pfExtraGleich(a.extra, b.extra);
const pfRelGleich = (a, b) => a.to === b.to && (a.name||'') === (b.name||'')
  && (a.from||'') === (b.from||'') && (a.toCard||'') === (b.toCard||'');

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
  if(rolle === 'domain' || rolle === 'desc'){
    const neu = (rolle === 'domain' ? e.domain : e.desc) || '';
    const vor = (rolle === 'domain' ? alt.domain : alt.desc) || '';
    if(neu === vor) return f ? f.lines : [];
    return neu ? [' '.repeat(col) + key + ': ' + yWert(neu)] : [];
  }
  if(rolle === 'keys' || rolle === 'sources'){
    const werte = rolle === 'keys' ? e.keys : e.sources;
    const alte = new Set(rolle === 'keys' ? alt.keys : alt.sources);
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
function goObjektAendern(text, name, e, alt){
  const B = splitBusinessObjects(text);
  if(!B) return null;
  const idx = B.blocks.findIndex(b => b.name === name);
  if(idx < 0) return null;
  const blk = B.blocks[idx];
  const F = splitObjectFields(blk.lines);
  const col = F.fieldCol != null ? F.fieldCol : yCol(blk.lines[0]) + 2;
  const zeilen = [F.head, ...F.vorspann];
  const fertig = new Set();
  const extra = e.extra || {};
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
  B.blocks[idx] = {name, lines: zeilen};
  return pfZusammen(B);
}

/* Verweise auf ein Objekt in einem fremden Block umschreiben (`nach`) oder die
   Beziehung entfernen (`nach === null`). „to:" gilt nur auf der Eintragsebene:
   unter „cardinality:" steht dasselbe Wort für etwas ganz anderes. */
function pfVerweise(lines, von, nach){
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
        if(ziel !== von){ behalten.push(...it.lines); return; }
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
        const teile = m[2].split('.');
        if(teile[0] !== von) return l;
        teile[0] = nach;
        return m[1] + yWert(teile.join('.'));
      }));
      return;
    }
    out.push(...f.lines);
  });
  return out;
}

/* Umbenennen heißt: Kopfzeile, jedes „to:" darauf und jedes „references:"
   darauf. Bliebe eines stehen, zerfiele das Modell in zwei Hälften. */
function goUmbenennen(text, alt, neu){
  const B = splitBusinessObjects(text);
  if(!B) return null;
  B.blocks = B.blocks.map(b=>{
    let lines = b.lines;
    if(b.name === alt)
      lines = [lines[0].replace(/^(\s*)"?[^":]+"?\s*:/, '$1' + neu + ':'), ...lines.slice(1)];
    return {name: b.name === alt ? neu : b.name, lines: pfVerweise(lines, alt, neu)};
  });
  return pfZusammen(B);
}

/* Löschen nimmt den Block heraus und mit ihm die Beziehungen, die auf ihn
   zeigen — sonst bliebe ein Ziel zurück, das es nicht mehr gibt. Ein
   „references:" auf das Objekt bleibt stehen und wird in der Prüfung
   gemeldet: es steckt in einem Attribut, das dem Nutzer gehört. */
function goObjektLoeschen(text, name){
  const B = splitBusinessObjects(text);
  if(!B) return null;
  B.blocks = B.blocks.filter(b => b.name !== name)
    .map(b => ({name: b.name, lines: pfVerweise(b.lines, name, null)}));
  return pfZusammen(B);
}

function goObjektAnlegen(text, name){
  const B = splitBusinessObjects(text);
  if(!B) return null;
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
  um(S.saved[1]);
  Object.values(S.hierSaved).forEach(um);
  if(S.hidden.has(altId)){ S.hidden.delete(altId); S.hidden.add(neuId); }
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
  S.routes[1] = routen(S.routes[1]);
  Object.keys(S.hierRoutes).forEach(k => { S.hierRoutes[k] = routen(S.hierRoutes[k]); });
}

/* ---------- Den neuen Modelltext übernehmen ---------- */
/* Derselbe Weg wie beim Delta: Modell neu bauen, Ansicht auffrischen. Der
   Verlauf schreibt den Modelltext mit, Strg+Z nimmt die Bearbeitung also
   wieder zurück. Ohne Einpassen — beim Tippen soll der Ausschnitt stehen. */
function pfUebernehmen(text, selId, meldung){
  let modell;
  try{ modell = buildModel(text); }
  catch(err){ toast('Der geänderte Modelltext ist nicht lesbar: ' + err.message); return false; }
  S.model = modell;
  S.yamlText = text;
  S.pflege = null; pfEntwurf = null;
  if(!S.outline) parseOutline();
  renderMessages(); syncLayoutMenu();
  if(selId && modell.objects[selId.slice(2)]){ S.sel = new Set([selId]); S.selected = selId; }
  else { S.sel = new Set(); S.selected = null; }
  setView({autoFit:false});
  if(S.mode === 'hierarchie') setMode('hierarchie');
  toast(meldung);
  return true;
}

const PF_VERBOTEN = /[:#"]/;
function pfNamePruefen(name){
  if(!name){ toast('Der Name darf nicht leer sein'); return false; }
  if(PF_VERBOTEN.test(name)){ toast('Ein Name darf kein :, # oder " enthalten'); return false; }
  return true;
}

/* ---------- Formular im Reiter „Details" ---------- */
let pfEntwurf = null;          // Arbeitsstand: erst beim Speichern wird daraus YAML

function pflegeStart(id){
  const n = S.graph.byId.get(id);
  if(!S.pflegeAn || !n || n.kind !== 'object') return;
  const o = n.ref;
  pfEntwurf = {
    name: o.name, domain: o.domain || '', desc: o.desc || '',
    keys: o.keys.slice(), sources: o.sources.slice(),
    // Am Objekt nur die eingeschalteten: nur sie verantwortet die Pflege.
    extra: Object.fromEntries(S.zusatzAn.objekt.map(k => [k, k in o.extra ? o.extra[k] : ''])),
    attrs: o.attrs.map(a=>({name:a.name, type:a.type||'', nullable:!!a.nullable,
                            pk:!!a.pk, fk:!!a.fk, ref:a.ref||'', extra:Object.assign({}, a.extra), _alt:a})),
    rels:  o.rels.map(r=>({to:r.to, name:r.name||'', from:r.from||'', toCard:r.toCard||'', _alt:r}))
  };
  S.pflege = id;
  setSidePane('details');
  renderDetails();
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
  e.domain = $('pfDomain').value.trim();
  e.desc = $('pfDesc').value.trim();
  e.keys = liste($('pfKeys').value);
  e.sources = liste($('pfSources').value);
  const feld = (sel, i)=> box.querySelector(sel + '[data-i="' + i + '"]');
  S.zusatzAn.objekt.forEach((k, z)=>{ e.extra[k] = feld('.pfo-extra', z).value.trim(); });
  e.attrs.forEach((a, i)=>{
    a.name = feld('.pfa-name', i).value.trim();
    a.type = feld('.pfa-type', i).value.trim();
    a.ref  = feld('.pfa-ref', i).value.trim();
    a.pk   = feld('.pfa-pk', i).checked;
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
  const ziele = Object.keys(S.model.objects).sort((a,b)=> a.localeCompare(b, 'de'));
  const wahl = (klasse, i, werte, titel)=>
    `<select class="${klasse}" data-i="${i}" aria-label="${titel}">`
    + werte.map(([v,l])=>`<option value="${esc(v)}">${esc(l)}</option>`).join('') + `</select>`;
  const karten = [['', '—'], ...Object.keys(CARD_LABEL).map(k=>[k, CARD_LABEL[k]])];

  box.innerHTML =
    `<div class="hd-bar"><h2 class="hd-title">Bearbeiten</h2>
       <span class="hd-actions"><button class="hd-btn ok" id="pfSave">Speichern</button>
       <button class="hd-btn" id="pfCancel">Abbrechen</button></span></div>
     <div class="pf">
       <label class="pfr"><span>Name</span><input id="pfName"></label>
       <label class="pfr"><span>Domain</span><input id="pfDomain"></label>
       <label class="pfr col"><span>Beschreibung</span><textarea id="pfDesc" rows="3"></textarea></label>
       <label class="pfr col"><span>Business Keys</span><input id="pfKeys" placeholder="durch Komma getrennt"></label>
       <label class="pfr col"><span>Quellen</span><input id="pfSources" placeholder="durch Komma getrennt"></label>
       ${S.zusatzAn.objekt.map((k,z)=>`<label class="pfr col"><span>${esc(k)}</span><input class="pfo-extra" data-i="${z}"></label>`).join('')}

       <div class="grouphead">ATTRIBUTE</div>
       ${e.attrs.map((a,i)=>`<div class="pfa">
          <div class="pfz"><input class="pfa-name" data-i="${i}" placeholder="Name" aria-label="Attributname">
            <input class="pfa-type" data-i="${i}" placeholder="Typ" aria-label="Datentyp">
            <button class="pfx" data-weg="attr" data-i="${i}" title="Attribut entfernen" aria-label="Attribut entfernen">×</button></div>
          <div class="pfz">
            <label class="pfk"><input type="checkbox" class="pfa-pk" data-i="${i}">PK</label>
            <label class="pfk"><input type="checkbox" class="pfa-fk" data-i="${i}">FK</label>
            <label class="pfk"><input type="checkbox" class="pfa-null" data-i="${i}">null</label>
            <input class="pfa-ref" data-i="${i}" placeholder="verweist auf Objekt.Attribut" aria-label="Verweisziel">
          </div>
          ${S.zusatzAn.attribut.map(k=>`<div class="pfz"><span class="pfk">${esc(k)}</span>
            <input class="pfa-extra" data-i="${i}" placeholder="${esc(k)}" aria-label="${esc(k)}"></div>`).join('')}</div>`).join('')}
       <button class="pfadd" data-neu="attr">＋ Attribut</button>

       <div class="grouphead">BEZIEHUNGEN AUSGEHEND</div>
       ${e.rels.map((r,i)=>`<div class="pfb">
          <div class="pfz">${wahl('pfb-to', i, ziele.concat(ziele.includes(r.to) ? [] : [r.to]).map(z=>[z,z]), 'Ziel der Beziehung')}
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
  $('pfDomain').value = e.domain;
  $('pfDesc').value = e.desc;
  $('pfKeys').value = e.keys.join(', ');
  $('pfSources').value = e.sources.join(', ');
  const feld = (sel, i)=> box.querySelector(sel + '[data-i="' + i + '"]');
  S.zusatzAn.objekt.forEach((k, z)=>{ feld('.pfo-extra', z).value = e.extra[k]; });
  e.attrs.forEach((a,i)=>{
    const zf = box.querySelectorAll('.pfa-extra[data-i="' + i + '"]');
    S.zusatzAn.attribut.forEach((k, z)=>{ zf[z].value = k in a.extra ? a.extra[k] : ''; });
    feld('.pfa-name', i).value = a.name;
    feld('.pfa-type', i).value = a.type;
    feld('.pfa-ref', i).value = a.ref;
    feld('.pfa-pk', i).checked = a.pk;
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
}

function pfZeileNeu(art){
  pfLesen();
  if(art === 'attr') pfEntwurf.attrs.push({name:'', type:'', nullable:false, pk:false, fk:false, ref:'', extra:{}, _alt:null});
  else {
    const ziele = Object.keys(S.model.objects);
    pfEntwurf.rels.push({to: ziele[0] || '', name:'', from:'', toCard:'', _alt:null});
  }
  renderDetails();
}

function pfZeileWeg(art, i){
  pfLesen();
  (art === 'attr' ? pfEntwurf.attrs : pfEntwurf.rels).splice(i, 1);
  renderDetails();
}

function pflegeSpeichern(){
  pfLesen();
  const e = pfEntwurf, altName = S.pflege.slice(2), alt = S.model.objects[altName];
  if(!alt) return;
  const neuName = e.name;
  if(!pfNamePruefen(neuName)) return;
  if(neuName !== altName && S.model.objects[neuName]){ toast(`„${neuName}" gibt es schon`); return; }
  if(e.attrs.some(a => !a.name)){ toast('Jedes Attribut braucht einen Namen'); return; }
  if(e.rels.some(r => !r.to)){ toast('Jede Beziehung braucht ein Ziel'); return; }

  let text = goObjektAendern(S.yamlText, altName, e, alt);
  if(text == null){ toast('Das Objekt steht so nicht im Modelltext'); return; }
  if(neuName !== altName){
    text = goUmbenennen(text, altName, neuName);
    pfIdsUmbenennen('o:' + altName, 'o:' + neuName);
    S.outlineText = uebersichtObjekt(S.outlineText, altName, neuName);
    S.outline = null;
  }
  pfUebernehmen(text, 'o:' + neuName, 'Gespeichert');
}

/* Anlegen und Löschen fragen über den Bedienweg nach; die Arbeit steckt in
   pflegeObjektNeu/pflegeObjektWeg, damit sie auch ohne Dialog prüfbar ist. */
function pflegeNeu(){
  const name = (prompt('Name des neuen Geschäftsobjekts:') || '').trim();
  if(name) pflegeObjektNeu(name);
}
function pflegeObjektNeu(name){
  name = String(name || '').trim();
  if(!S.pflegeAn || !pfNamePruefen(name)) return;
  if(S.model.objects[name]){ toast(`„${name}" gibt es schon`); return; }
  const text = goObjektAnlegen(S.yamlText, name);
  if(text == null){ toast('Im Modelltext fehlt der Abschnitt "BusinessObjects"'); return; }
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
const pfEingehend = name => Object.values(S.model.objects)
  .reduce((s,o)=> s + (o.name === name ? 0 : o.rels.filter(r => r.to === name).length), 0);

function pflegeObjektWeg(name){
  if(!S.pflegeAn || !S.model.objects[name]) return;
  const text = goObjektLoeschen(S.yamlText, name);
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
  if(!S.pflegeAn){ S.pflege = null; pfEntwurf = null; }   // offenes Formular schließen
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
  const z = S.model.zusatz;
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
    const o = S.model.objects[S.pflege.slice(2)], alt = pfEntwurf.extra;
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
}

$('btnEinst').addEventListener('click', syncEinstMenu);
$('optPflege').addEventListener('click', ()=> pflegeSchalten(!S.pflegeAn));
$('optQuelle').addEventListener('click', ()=> elementSchalten('quelle'));
$('optDomaene').addEventListener('click', ()=> elementSchalten('domaene'));
$('optZusatz').addEventListener('click', zusatzAuf);
$('zusatzZu').addEventListener('click', zusatzZu);
$('zusatzDlg').addEventListener('click', e=>{ if(e.target === $('zusatzDlg')) zusatzZu(); });
