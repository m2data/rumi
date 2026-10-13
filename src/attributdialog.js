/* =====================================================================
   13 — Attribute zusammenführen, trennen, umbenennen
   Kommen Attribute eines Geschäftsobjekts aus mehreren Quelltabellen, führt
   die Übernahme gleichnamige zusammen. Alles andere entscheidet man hier:
   markierte Attribute werden eins (das oberste bleibt, die Quellen der
   anderen kommen dazu), eine Quelle lässt sich wieder abtrennen, und jedes
   Attribut lässt sich umbenennen. Erst „Übernehmen" schreibt — über die
   Text-Chirurgie der Pflege, in einem Verlaufsschritt; Business Keys und
   „references" in allen Objekten ziehen mit.
   ===================================================================== */
let adEntwurf = null;           // {objekt, attrs:[{…, orig}], weg:[{orig, zu}]}

/* Eine Quellspalte im Tabellenmodell — für Typ und Schlüssel, soweit geladen. */
function adSpalte(q){
  const t = S.quellModell && S.quellModell.objects[qtTabelle(q)];
  return {t, sp: t ? t.attrs.find(x => x.name === qtSpalte(q)) || null : null};
}
const adKuerzel = a => [a.pk && 'PK', a.ak && 'AK', a.fk && 'FK'].filter(Boolean).join(' ');

function attributDialogAuf(id){
  const n = S.graph.byId.get(id);
  if(!pflegeErlaubt() || S.mode === 'quellen' || !n || n.kind !== 'object') return;
  closeMenus();
  if(S.pflege){ S.pflege = null; pfEntwurf = null; }          // ein offenes Formular gälte nicht mehr
  const o = n.ref;
  adEntwurf = {objekt: o.name,
    attrs: pfEntwurfAus(o).attrs.map(a => Object.assign(a, {orig: a.name})),
    weg: []};
  adZeichnen();
  $('attrDlg').hidden = false;
}
function attributDialogZu(){ adEntwurf = null; $('attrDlg').hidden = true; }

function adZeichnen(){
  const e = adEntwurf;
  $('attrDlgTitel').textContent = 'Attribute zusammenführen — ' + e.objekt;
  $('attrDlgListe').innerHTML =
    `<div class="empty">Markierte Attribute werden eins: das oberste bleibt mit Namen und Eigenschaften, die Quellen
       der anderen kommen dazu. Eine Quelle lässt sich wieder abtrennen. Namen lassen sich hier ändern;
       Business Keys und Verweise ziehen beim Übernehmen mit.</div>`
    + e.attrs.map((a, i)=>`<div class="ad-attr">
        <div class="pfz"><input type="checkbox" class="ad-mark" data-i="${i}" aria-label="Attribut markieren">
          <input class="ad-name" data-i="${i}" aria-label="Name des Attributs">
          <span class="ad-eig">${esc([a.type, adKuerzel(a)].filter(Boolean).join(' '))}</span></div>
        ${a.quellen.map((q, k)=>{
          const {sp} = adSpalte(q);
          const typ = sp && sp.type ? sp.type : '';
          const anders = typ && a.type && typ !== a.type;
          return `<div class="ad-q${anders ? ' anders' : ''}"${anders ? ' title="Typ weicht vom Attribut ab"' : ''}>← ${esc(q)}${typ ? ' · ' + esc(typ) : ''}${sp && adKuerzel(sp) ? ' · ' + adKuerzel(sp) : ''}
            ${a.quellen.length > 1 ? `<button class="pfadd" data-ab="${i}" data-k="${k}" title="Diese Quelle wird ein eigenes Attribut">abtrennen</button>` : ''}</div>`;
        }).join('') || '<div class="ad-q empty">ohne Quelle</div>'}</div>`).join('');
  // Werte erst jetzt setzen: als Attribut im Markup gingen Sonderzeichen verloren
  e.attrs.forEach((a, i)=>{ $('attrDlgListe').querySelector('.ad-name[data-i="' + i + '"]').value = a.name; });
  $('attrDlgListe').querySelectorAll('[data-ab]').forEach(b=> b.addEventListener('click', ()=> adAbtrennen(+b.dataset.ab, +b.dataset.k)));
}

/* Getippte Namen einsammeln, bevor die Liste neu entsteht. */
function adLesen(){
  adEntwurf.attrs.forEach((a, i)=>{
    const f = $('attrDlgListe').querySelector('.ad-name[data-i="' + i + '"]');
    if(f) a.name = f.value.trim();
  });
}

function adZusammenfuehren(){
  adLesen();
  const box = $('attrDlgListe'), e = adEntwurf;
  const mark = e.attrs.filter((_, i)=> (box.querySelector('.ad-mark[data-i="' + i + '"]') || {}).checked);
  if(mark.length < 2){ toast('Mindestens zwei Attribute markieren'); return; }
  const [bleibt, ...rest] = mark;
  rest.forEach(a=>{
    a.quellen.forEach(q => { if(!bleibt.quellen.includes(q)) bleibt.quellen = bleibt.quellen.concat(q); });
    if(a.orig) e.weg.push({orig: a.orig, zu: bleibt});
    // was schon auf ein entfallenes Attribut zeigte, zeigt jetzt aufs bleibende
    e.weg.forEach(w => { if(w.zu === a) w.zu = bleibt; });
  });
  e.attrs = e.attrs.filter(a => !rest.includes(a));
  adZeichnen();
}

/* Eine Quelle wird ein eigenes Attribut direkt unter ihrem bisherigen: mit
   den Eigenschaften ihrer Spalte, ohne geladene Tabelle mit denen des
   Attributs. Name: die Spalte; ist er vergeben, mit dem Tabellennamen,
   notfalls zusätzlich mit dem Quellsystem. */
function adAbtrennen(i, k){
  adLesen();
  const e = adEntwurf, a = e.attrs[i], q = a.quellen[k];
  a.quellen = a.quellen.filter(x => x !== q);
  const {sp} = adSpalte(q);
  const vergeben = n => e.attrs.some(x => x.name === n);
  const spalte = qtSpalte(q), [system, tabelle] = qtTabelle(q).split('.');
  let name = [spalte, spalte + '_' + tabelle, spalte + '_' + system + '_' + tabelle].find(n => !vergeben(n));
  for(let z = 2; !name; z++) if(!vergeben(spalte + '_' + tabelle + '_' + z)) name = spalte + '_' + tabelle + '_' + z;
  const verweis = ref=>{                      // Webshop.Kunde.KundeID → Kunde.KundeID (über die Zuordnung)
    if(!ref) return '';
    const z = S.quellModell && S.quellModell.objects[qtTabelle(ref)];
    return z && z.bo ? z.bo + (qtSpalte(ref) ? '.' + qtSpalte(ref) : '') : '';
  };
  const von = sp ? {type: sp.type || '', nullable: !!sp.nullable, pk: !!sp.pk, ak: !!sp.ak, fk: !!sp.fk, ref: verweis(sp.ref)}
                 : {type: a.type, nullable: a.nullable, pk: a.pk, ak: a.ak, fk: a.fk, ref: a.ref};
  e.attrs.splice(i + 1, 0, Object.assign({name, quellen: [q], extra: {}, _alt: null, orig: null}, von));
  adZeichnen();
}

/* Ein Attribut umbenennen heißt auch: jedes „references: Objekt.Alt" in der
   ganzen Datei zeigt danach auf Objekt.Neu. */
function goAttrVerweise(text, objekt, alt, neu){
  const rx = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const muster = new RegExp('^(\\s*references\\s*:\\s*)"?' + rx(objekt + '.' + alt) + '"?(\\s+#.*)?\\s*$');
  return String(text).split('\n').map(l=>{
    const m = l.match(muster);
    return m ? m[1] + yWert(objekt + '.' + neu) + (m[2] || '') : l;
  }).join('\n');
}

function adUebernehmen(){
  adLesen();
  const e = adEntwurf, o = S.model.objects[e.objekt];
  if(!o){ attributDialogZu(); return; }
  const namen = e.attrs.map(a => a.name);
  if(namen.some(n => !n)){ toast('Jedes Attribut braucht einen Namen'); return; }
  if(namen.some(n => /[:#".]/.test(n))){ toast('Ein Attributname darf kein :, #, " oder . enthalten'); return; }
  if(new Set(namen).size !== namen.length){ toast('Zwei Attribute heißen gleich'); return; }

  // Alt → neu: umbenannte und in ein anderes aufgegangene Attribute
  const umbenannt = new Map();
  e.attrs.forEach(a => { if(a.orig && a.orig !== a.name) umbenannt.set(a.orig, a.name); });
  e.weg.forEach(w => umbenannt.set(w.orig, w.zu.name));

  const entwurf = pfEntwurfAus(o);
  entwurf.attrs = e.attrs;
  entwurf.keys = [...new Set(entwurf.keys.map(k => umbenannt.get(k) || k))];
  let text = goObjektAendern(S.yamlText, o.name, entwurf, o);
  if(text == null){ toast('Das Objekt steht so nicht im Modelltext'); return; }
  umbenannt.forEach((neu, alt)=>{ text = goAttrVerweise(text, o.name, alt, neu); });
  attributDialogZu();
  if(text === S.yamlText){ toast('Nichts geändert'); return; }
  pfUebernehmen(text, 'o:' + o.name, 'Attribute übernommen');
}

$('attrMerge').addEventListener('click', adZusammenfuehren);
$('attrOk').addEventListener('click', adUebernehmen);
$('attrAbbruch').addEventListener('click', attributDialogZu);
$('attrDlg').addEventListener('click', ev=>{ if(ev.target === $('attrDlg')) attributDialogZu(); });
