/* =====================================================================
   1 — Toleranter YAML-Leser
   Liest YAML, wie es Menschen und Werkzeuge für dieses Metamodell schreiben,
   und akzeptiert dabei Tabs als Einrückung (echtes YAML verbietet das). Was
   er nicht versteht, verwirft er nicht still: jede solche Stelle steht mit
   Zeilennummer in den Hinweisen (notes) und damit in der Prüfliste.
   ===================================================================== */
const TAB_WIDTH = 4;

/* Escapes einer Zeichenkette in "…" auflösen — dieselben, die YAML kennt
   (\ , \/, \xHH, \uHHHH …), nicht nur \n \t \" \\. Andere Werkzeuge schreiben
   sie, etwa \ am Anfang einer Folgezeile für ein erhaltenes Leerzeichen. */
const Y_ESC = {'0':'\0', a:'\x07', b:'\b', t:'\t', '\t':'\t', n:'\n', v:'\v', f:'\f', r:'\r', e:'\x1b',
  ' ':' ', '"':'"', '/':'/', '\\':'\\', N:'\u0085', _:' ', L:'\u2028', P:'\u2029'};
const yUnescape = s => s.replace(/\\(x[0-9a-fA-F]{2}|u[0-9a-fA-F]{4}|U[0-9a-fA-F]{8}|[\s\S])/g, (m, c)=>
  c.length > 1 ? String.fromCodePoint(parseInt(c.slice(1), 16)) : (c in Y_ESC ? Y_ESC[c] : m));
const yEscape = s => s.replace(/\\/g,'\\\\').replace(/"/g,'\\"').replace(/\n/g,'\\n').replace(/\t/g,'\\t');
const yColw = s => s.replace(/\t/g, ' '.repeat(TAB_WIDTH)).match(/^ */)[0].length;

// Position des schließenden Anführungszeichens q ab p, sonst -1
function yEnde(s, p, q){
  for(let i = p; i < s.length; i++){
    if(q === '"' && s[i] === '\\'){ i++; continue; }
    if(s[i] === q){ if(q === "'" && s[i+1] === "'"){ i++; continue; } return i; }
  }
  return -1;
}

// Kopf einer Zeile mit Wert: „schlüssel: ", „- schlüssel: " oder „- "; der Schlüssel auch in Anführungszeichen
const Y_KOPF = /^(\s*(?:-\s+)?(?:"(?:[^"\\]|\\.)*"|'(?:[^']|'')*'|[^:#'"\s\-?][^:]*|-[^\s:][^:]*):[ \t]+|\s*-[ \t]+)/;

/* Zeichenketten in Anführungszeichen, die über mehrere Zeilen laufen, in einen
   einzeiligen "…"-Wert umschreiben — wie bei den Blockskalaren. Gefaltet wird
   nach YAML: ein Umbruch wird Leerzeichen, n Leerzeilen werden n Umbrüche, in
   "…" hebt ein \ am Zeilenende den Umbruch auf; in '…' ist '' ein Apostroph.
   So schreiben YAML-Werkzeuge lange Texte. Schließt die Zeichenkette nicht,
   bevor eine Zeile höchstens so weit eingerückt ist wie ihr Schlüssel, bleibt
   alles, wie es war — ein Apostroph am Wertanfang verschluckt nichts. */
function expandFlowScalars(text){
  const raw = text.split('\n');
  const fortgesetzt = s => /(^|[^\\])(\\\\)*\\$/.test(s);      // endet auf ein ungerades \
  const out = [];
  for(let i = 0; i < raw.length; i++){
    const k0 = raw[i].match(Y_KOPF);
    const m = k0 && raw[i].slice(k0[1].length).match(/^(["'])([\s\S]*)$/);
    if(!m || yEnde(m[2], 0, m[1]) >= 0){ out.push(raw[i]); continue; }
    const q = m[1], keyCol = yColw(raw[i]), teile = [m[2]];
    let j = i + 1, schluss = -1;
    for(; j < raw.length; j++){
      if(raw[j].trim() !== '' && yColw(raw[j]) <= keyCol) break;
      const k = yEnde(raw[j], 0, q);
      if(k >= 0){ teile.push(raw[j].slice(0, k)); schluss = k; break; }
      teile.push(raw[j]);
    }
    if(schluss < 0){ out.push(raw[i]); continue; }
    let s = '', leer = 0;
    teile.forEach((t, k)=>{
      const erste = k === 0, letzte = k === teile.length - 1;
      let z = erste ? t : t.replace(/^[ \t]+/, '');
      // Leerraum am Zeilenende fällt weg — außer er ist in "…" maskiert
      if(!letzte){ const w = z.match(/[ \t]*$/)[0]; if(w && !(q === '"' && fortgesetzt(z.slice(0, z.length - w.length + 1)))) z = z.slice(0, z.length - w.length); }
      if(!erste && !letzte && z === ''){ leer++; return; }
      if(!erste){
        if(q === '"' && fortgesetzt(s)) s = s.slice(0, -1);
        else s += leer ? '\n'.repeat(leer) : ' ';
      }
      leer = 0;
      s += z;
    });
    const wert = q === '"' ? yUnescape(s) : s.replace(/''/g, "'");
    out.push(k0[1] + '"' + yEscape(wert) + '"' + raw[j].slice(schluss + 1));
    // Leerzeilen, die im Wert aufgingen, als solche stehen lassen — die Zeilennummern bleiben so stimmig
    for(let z = i + 1; z <= j; z++) out.push('');
    i = j;
  }
  return out.join('\n');
}

/* Inline-Listen und -Abbildungen, die über mehrere Zeilen laufen ([a,⏎ b]),
   zu einer Zeile zusammenziehen, bis die Klammern aufgehen. PyYAML bricht
   lange Inline-Listen so um. Gleicher Abbruch wie oben. */
function expandFlowCollections(text){
  const raw = text.split('\n');
  const offen = s=>{                       // Klammertiefe außerhalb von Anführungszeichen
    let t = 0;
    for(let i = 0; i < s.length; i++){
      const c = s[i];
      if(c === '"' || c === "'"){ const e = yEnde(s, i + 1, c); if(e < 0) return t; i = e; continue; }
      if(c === '#' && (i === 0 || /\s/.test(s[i-1]))) return t;
      if(c === '[' || c === '{') t++;
      else if(c === ']' || c === '}') t--;
    }
    return t;
  };
  const out = [];
  for(let i = 0; i < raw.length; i++){
    const k0 = raw[i].match(Y_KOPF);
    const wert = k0 ? raw[i].slice(k0[1].length) : '';
    if(!/^[[{]/.test(wert) || offen(wert) <= 0){ out.push(raw[i]); continue; }
    const keyCol = yColw(raw[i]);
    let s = raw[i], j = i + 1, zu = false;
    for(; j < raw.length; j++){
      if(raw[j].trim() === '') continue;
      if(yColw(raw[j]) <= keyCol) break;
      s += ' ' + raw[j].trim();
      if(offen(s.slice(k0[1].length)) <= 0){ zu = true; break; }
    }
    if(!zu){ out.push(raw[i]); continue; }
    out.push(s);
    for(let z = i + 1; z <= j; z++) out.push('');
    i = j;
  }
  return out.join('\n');
}

/* Blockskalare (key: | , |- , |+ , > …) in einen escapten einzeiligen Wert
   umschreiben, den der übrige Leser als "…\n…" versteht. „|" ohne Zusatz
   verliert hier — anders als in YAML — auch den letzten Umbruch: so liest
   sich „desc: |" genau wie geschrieben (yBlock baut darauf). „+" behält die
   Leerzeilen am Ende. */
function expandBlockScalars(text){
  const raw = text.split('\n');
  const head = /^(\s*)([^:#][^:]*):[ \t]*([|>])([-+]?)\d*[ \t]*(?:#.*)?$/;
  const out = [];
  for(let i = 0; i < raw.length; i++){
    const m = raw[i].match(head);
    if(!m){ out.push(raw[i]); continue; }
    const keyCol = yColw(m[1]), folded = m[3] === '>', chomp = m[4];
    const block = [];
    let j = i + 1;
    for(; j < raw.length; j++){
      if(raw[j].trim() === ''){ block.push(''); continue; }
      if(yColw(raw[j]) <= keyCol) break;
      // nur Tabs der Einrückung umrechnen — ein Tab im Text bleibt einer
      block.push(raw[j].replace(/^[ \t]+/, m => m.replace(/\t/g, ' '.repeat(TAB_WIDTH))));
    }
    let nachlauf = 0;
    while(block.length && block[block.length-1] === ''){ block.pop(); nachlauf++; }   // Leerzeilen am Ende gehören nicht dazu
    const common = Math.min(Infinity, ...block.filter(b => b !== '').map(b => b.match(/^ */)[0].length));
    const body = block.map(b => b === '' ? '' : b.slice(common));
    let content;
    if(folded){
      let s = '';
      for(const l of body) s += l === '' ? '\n' : ((s === '' || s.endsWith('\n')) ? '' : ' ') + l;
      content = s;
    } else content = body.join('\n');
    content = content.replace(/\n+$/, '');
    if(chomp === '+') content += '\n'.repeat(1 + nachlauf);
    out.push(m[1] + m[2] + ': "' + yEscape(content) + '"');
    for(let z = i + 1; z < j - nachlauf; z++) out.push('');
    for(let z = 0; z < nachlauf; z++) out.push('');
    i = j - 1;
  }
  return out.join('\n');
}

/* Ein Text als Blockskalar „key: |": jede Zeile eingerückt darunter, so dass
   Zeilenumbrüche in der Datei sichtbar sind und nichts maskiert wird. Der
   Block wird probehalber zurückgelesen; ginge dabei etwas verloren (eine Zeile
   nur aus Leerzeichen, ein Tab am Zeilenanfang …), kommt null zurück und der
   Aufrufer schreibt wie bisher einen maskierten Einzeiler. */
function yBlock(col, key, text){
  const s = String(text);
  const zeilen = [' '.repeat(col) + key + ': |',
    ...s.split('\n').map(l => l === '' ? '' : ' '.repeat(col + 2) + l)];
  try{
    const probe = readYaml(['x:', ...zeilen.map(l => l === '' ? '' : '  ' + l.slice(col))].join('\n') + '\n').doc;
    if(probe.x && probe.x[key] === s) return zeilen;
  }catch(_){}
  return null;
}

/* Ein Wert fürs YAML. Angeführt wird nur, wo es sein muss — sonst läse sich
   die Datei nach der ersten Bearbeitung anders als davor. Ob es sein muss,
   entscheidet zuletzt der Leser selbst: was schlicht nicht als derselbe Text
   zurückkäme (1e3 als Zahl, NULL als null …), wird angeführt. */
function yWert(v){
  const s = String(v == null ? '' : v);
  if(s === '' || /^\s|\s$/.test(s) || /[#"'\n\t]/.test(s) || /:(\s|$)/.test(s)
     || /^[-?:,[\]{}&*!|>%@`]/.test(s) || /^(true|false|null|~)$/i.test(s)
     || /^-?\d+(\.\d+)?$/.test(s) || readYaml('x: ' + s).doc.x !== s)
    return '"' + yEscape(s) + '"';
  return s;
}

// Wo auf der Zeile ein Kommentar beginnt (außerhalb von Anführungszeichen), sonst -1
function yKommentarAb(s){
  let q = null;
  for(let i = 0; i < s.length; i++){
    const c = s[i];
    if(q === '"' && c === '\\'){ i++; continue; }
    if(q){ if(c === q) q = null; continue; }
    if(c === '"' || c === "'"){ q = c; continue; }
    if(c === '#' && (i === 0 || /\s/.test(s[i-1]))) return i;
  }
  return -1;
}

/* Eine ganze YAML-Datei in einheitliche Schreibweise bringen — so wird jede
   Datei gespeichert. Kommentare, Reihenfolge und Einrückung bleiben; neu
   geschrieben werden nur Einzelwerte:
     - Beschreibungen (desc, beschreibung, description) immer als Block „|",
       Leerraum am Rand fällt weg wie im Formular,
     - anderer Text mit Zeilenumbruch ebenfalls als Block,
     - einzeiliger Text schlicht, wo es geht, sonst in "…" (yWert),
     - Inline-Listen und -Abbildungen aus Einzelwerten als Block.
   Unberührt bleiben Zahlen, Wahrheitswerte, null, Werte mit Anker, Alias oder
   Tag und Zeilen mit Kommentar. Jeder neu geschriebene Wert wird probehalber
   gelesen; käme er nicht genauso zurück, bleiben die alten Zeilen stehen. */
const Y_DESC = /^(desc|beschreibung|description)$/;
function yamlEinheitlich(text){
  const zeilen = String(text).replace(/\r\n?/g, '\n').split('\n');
  const out = [];
  // Wert eines Feldes, als stünde es allein unter „x" — die erste Zeile ohne ihren Kopf
  const lesen = (feld, kopf, col)=>{
    try{
      const probe = ['x:', ...feld.map((l, k)=> k === 0 ? '  w: ' + l.slice(kopf.length).trim()
        : (l.trim() === '' ? '' : '  ' + l.replace(/^[ \t]+/, m => m.replace(/\t/g, ' '.repeat(TAB_WIDTH))).slice(col)))].join('\n');
      const r = readYaml(probe + '\n');
      return r.doc.x ? {v: r.doc.x.w} : null;
    }catch(_){ return null; }
  };
  const skalarText = v => typeof v === 'string' ? yWert(v) : v === null ? 'null' : String(v);
  const einfach = v => v === null || ['string', 'number', 'boolean'].includes(typeof v) && !(typeof v === 'string' && v.includes('\n'));
  for(let i = 0; i < zeilen.length; i++){
    const l = zeilen[i];
    const k = /^\s*#/.test(l) ? null : l.match(Y_KOPF);
    const wertText = k ? l.slice(k[1].length) : '';
    if(!k || wertText.trim() === '' || yKommentarAb(wertText) >= 0 || /^[&*!]/.test(wertText)){ out.push(l); continue; }
    const vorne = l.match(/^\s*(-\s+)?/)[0];
    const col = vorne.replace(/\t/g, ' '.repeat(TAB_WIDTH)).length;   // Spalte des Schlüssels, hinter „- "
    const istEintrag = !/:[ \t]+$/.test(k[1]);  // „- wert" ohne Schlüssel
    const key = istEintrag ? null : k[1].slice(vorne.length).replace(/:[ \t]+$/, '').replace(/^["']|["']$/g, '');
    const kopf = k[1].replace(/[ \t]+$/, '');
    let j = i + 1;
    while(j < zeilen.length && (zeilen[j].trim() === '' || yColw(zeilen[j]) > (istEintrag ? yColw(l) : col))) j++;
    while(j > i + 1 && zeilen[j-1].trim() === '') j--;
    const feld = zeilen.slice(i, j);
    const block = /^[|>]/.test(wertText);
    // Kommentarzeilen mitten im Wert gingen beim Neuschreiben verloren
    if(!block && feld.slice(1).some(z => /^\s*#/.test(z))){ out.push(...feld); i = j - 1; continue; }
    const gelesen = lesen(feld, kopf, istEintrag ? yColw(l) : col);
    if(!gelesen){ out.push(...feld); i = j - 1; continue; }
    let soll = gelesen.v, neu = null;
    const ein = ' '.repeat((istEintrag ? yColw(l) : col) + 2);
    const alsBlock = s => [kopf + ' |', ...s.split('\n').map(z => z === '' ? '' : ein + z)];
    if(typeof soll === 'string'){
      if(key && Y_DESC.test(key)){
        soll = soll.trim();
        if(soll !== '') neu = alsBlock(soll);
      } else neu = soll.includes('\n') ? alsBlock(soll) : [kopf + ' ' + yWert(soll)];
    } else if(Array.isArray(soll) && soll.length && !istEintrag && soll.every(einfach)){
      neu = [kopf, ...soll.map(v => ' '.repeat(col) + '- ' + skalarText(v))];
    } else if(soll && typeof soll === 'object' && !Array.isArray(soll) && Object.keys(soll).length && !istEintrag
              && Object.values(soll).every(einfach)){
      neu = [kopf, ...Object.entries(soll).map(([a, v]) => ein + yWert(a) + ': ' + skalarText(v))];
    }
    const pruef = neu && lesen(neu, kopf, istEintrag ? yColw(l) : col);
    if(neu && pruef && JSON.stringify(pruef.v) === JSON.stringify(soll)) out.push(...neu);
    else out.push(...feld);
    i = j - 1;
  }
  return out.join('\n');
}

function readYaml(text){
  const notes = [];
  const warn = (title, body) => notes.push({level:'warn', title, body});
  const src = expandBlockScalars(expandFlowCollections(expandFlowScalars(text.replace(/^﻿/,'').replace(/\r\n?/g,'\n'))));
  if(/^[ ]*\t/m.test(src)) warn('Tabulatoren in der Einrückung',
    `Die Datei rückt teilweise mit Tabulatoren ein. YAML erlaubt das nicht — ein normaler Parser bricht hier ab. Diese App rechnet einen Tab in ${TAB_WIDTH} Leerzeichen um.`);

  // Kommentar ab '# ' entfernen, aber nur außerhalb von Anführungszeichen —
  // sonst zerschneidet eine Beschreibung wie "Preis # Stück" den Wert. Ein
  // maskiertes \" beendet die Zeichenkette nicht.
  const stripComment = s=>{
    let q = null;
    for(let i=0; i<s.length; i++){
      const c = s[i];
      if(q === '"' && c === '\\'){ i++; continue; }
      if(q){ if(c === q) q = null; continue; }
      if(c === '"' || c === "'"){ q = c; continue; }
      if(c === '#' && (i === 0 || /\s/.test(s[i-1]))) return s.slice(0, i);
    }
    return s;
  };
  const kurz = s => s.length > 60 ? s.slice(0, 60) + ' …' : s;

  // Zeilen sammeln; jede merkt sich, wie viele Leerzeilen ihr vorausgehen
  const lines = [];
  let leer = 0, ende = -1;
  const roh = src.split('\n');
  for(let idx = 0; idx < roh.length; idx++){
    const raw = roh[idx];
    // Tabs nur in der Einrückung umrechnen — ein Tab im Wert bleibt einer
    const expanded = raw.replace(/^[ \t]+/, m => m.replace(/\t/g, ' '.repeat(TAB_WIDTH)));
    const stripped = stripComment(expanded);
    if(!stripped.trim()){ if(!raw.trim()) leer++; continue; }
    if(/^\s*#/.test(stripped)) continue;
    // Dokumentgrenzen: „---" am Anfang und „..." am Ende übergehen
    if(/^(---|\.\.\.)\s*$/.test(stripped)){
      if(lines.length || stripped.startsWith('...')){ ende = idx; break; }
      continue;
    }
    lines.push({indent: stripped.match(/^ */)[0].length, content: stripped.trim(), n: idx+1, leer});
    leer = 0;
  }
  if(ende >= 0){
    const weiter = roh.slice(ende + 1).findIndex(l => l.trim() && !/^\s*#/.test(l) && !/^(---|\.\.\.)\s*$/.test(l.trim()));
    if(weiter >= 0) warn(`Weiteres Dokument ab Zeile ${ende + 1} nicht gelesen`,
      'Die Datei enthält nach „---" ein zweites YAML-Dokument. Gelesen wird nur das erste.');
  }

  let i = 0;
  const isItem = s => /^-(\s|$)/.test(s);
  const anker = {};
  const kopie = v => v === undefined ? null : JSON.parse(JSON.stringify(v));

  // U+2028/U+2029 (Zeilentrenner, etwa aus Word eingefügt) gelten als Zeilenumbruch
  const zeilentrenner = s => s.replace(/[\u2028\u2029]/g, '\n');
  function scalar(v, n){
    if(v === '' || /^(null|Null|NULL|~)$/.test(v)) return null;
    // Doppelte Anführungszeichen: Escapes auflösen, damit mehrzeilige Texte
    // einzeilig gespeichert und wieder gelesen werden können.
    if(/^"[\s\S]*"$/.test(v) && yEnde(v, 1, '"') === v.length - 1) return zeilentrenner(yUnescape(v.slice(1,-1)));
    if(/^'[\s\S]*'$/.test(v) && yEnde(v, 1, "'") === v.length - 1) return zeilentrenner(v.slice(1,-1).replace(/''/g, "'"));
    if(/^["']/.test(v) && yEnde(v, 1, v[0]) < 0)
      warn(`Anführungszeichen ohne Schluss (Zeile ${n})`, `Der Wert ${kurz(v)} beginnt mit ${v[0]}, das nirgends schließt — er wird als Text samt Anführungszeichen gelesen.`);
    if(/^(true|false)$/i.test(v)) return v.toLowerCase() === 'true';
    // Zahlen nach dem YAML-1.2-Kernschema; ein Datum bleibt Text
    if(/^[-+]?(\.\d+|\d+(\.\d*)?)([eE][-+]?\d+)?$/.test(v)) return Number(v);
    if(/^0x[0-9a-fA-F]+$/.test(v)) return parseInt(v, 16);
    if(/^0o[0-7]+$/.test(v)) return parseInt(v.slice(2), 8);
    if(/^[-+]?\.(inf|Inf|INF)$/.test(v)) return v[0] === '-' ? -Infinity : Infinity;
    if(/^\.(nan|NaN|NAN)$/.test(v)) return NaN;
    return zeilentrenner(v);
  }

  // Inline-Liste [a, b] und Inline-Abbildung {a: 1}, auch verschachtelt
  function parseFlow(s, n){
    let p = 0;
    const ws = ()=>{ while(p < s.length && /\s/.test(s[p])) p++; };
    const schlicht = (stop)=>{ const a = p; while(p < s.length && !stop(s[p], s[p+1])) p++; return s.slice(a, p).trim(); };
    const quoted = ()=>{ const q = s[p], e = yEnde(s, p + 1, q); if(e < 0) throw 0; const r = s.slice(p, e + 1); p = e + 1; return r; };
    function wert(imMap){
      ws();
      const c = s[p];
      if(c === '['){
        p++; const arr = [];
        for(;;){ ws(); if(s[p] === ']'){ p++; return arr; } arr.push(wert(false)); ws();
          if(s[p] === ','){ p++; continue; } if(s[p] === ']'){ p++; return arr; } throw 0; }
      }
      if(c === '{'){
        p++; const obj = {};
        for(;;){
          ws(); if(s[p] === '}'){ p++; return obj; }
          const k = s[p] === '"' || s[p] === "'" ? scalar(quoted(), n)
            : schlicht((x, y)=> x === ',' || x === '}' || (x === ':' && (y === undefined || /[\s,\]}]/.test(y))));
          ws();
          let v = null;
          if(s[p] === ':'){ p++; v = wert(true); }
          obj[String(k)] = v; ws();
          if(s[p] === ','){ p++; continue; } if(s[p] === '}'){ p++; return obj; } throw 0;
        }
      }
      if(c === '"' || c === "'") return scalar(quoted(), n);
      if(c === '*'){ p++; return alias(schlicht(x => x === ',' || x === ']' || x === '}' || /\s/.test(x)), n); }
      const v = schlicht(x => x === ',' || x === ']' || x === '}');
      return v === '' && !imMap ? null : scalar(v, n);
    }
    try{
      const v = wert(false); ws();
      if(p === s.length) return v;
    }catch(_){}
    warn(`Inline-Notation nicht lesbar (Zeile ${n})`, `${kurz(s)} — die Klammern gehen nicht auf. Der Wert wird als Text gelesen.`);
    return s;
  }

  function alias(name, n){
    if(Object.prototype.hasOwnProperty.call(anker, name)) return kopie(anker[name]);
    warn(`Alias *${name} ohne Anker (Zeile ${n})`, `Zu *${name} steht vorher kein &${name}. Der Wert bleibt leer.`);
    return null;
  }

  /* Anker (&name) und Tag (!…) vor einem Wert abtrennen. */
  function eigenschaften(v, n){
    let anke = null, tag = null;
    for(;;){
      const a = v.match(/^&([^\s,\[\]{}]+)\s*/);
      if(a){ anke = a[1]; v = v.slice(a[0].length); continue; }
      const t = v.match(/^(!!?[^\s,\[\]{}]*)\s*/);
      if(t){ tag = t[1]; v = v.slice(t[0].length); continue; }
      break;
    }
    if(tag && !/^!!(str|int|float|bool|null|map|seq|binary|timestamp|set|omap)$/.test(tag)){
      warn(`Tag ${tag} nicht ausgewertet (Zeile ${n})`, 'Eigene Tags kennt die App nicht; der Wert wird ohne sie gelesen.');
      tag = null;
    }
    return {anke, tag, rest: v.trim()};
  }

  /* Ein Einzelwert hinter „schlüssel:" oder „- ": Alias, Inline-Sammlung oder
     Skalar, ein Tag erzwingt den Typ. */
  function einzelwert(roh, n){
    const {anke, tag, rest} = eigenschaften(roh, n);
    let v;
    if(/^\*/.test(rest)) v = alias(rest.slice(1), n);
    else if(/^[[{]/.test(rest)) v = parseFlow(rest, n);
    else if(tag === '!!str'){ const s = scalar(rest, n); v = /^["']/.test(rest) ? s : rest; }
    else if(tag === '!!int' || tag === '!!float'){ const s = scalar(rest, n); v = Number(s); }
    else if(tag === '!!bool'){ const s = scalar(rest, n); v = s === true || /^true$/i.test(String(s)); }
    else if(tag === '!!null') v = null;
    else v = scalar(rest, n);
    if(anke) anker[anke] = v;
    return {v, anke, tag, leer: rest === '', schlicht: !/^["'[{*]/.test(rest) && !tag};
  }

  /* „schlüssel: wert" zerlegen; der Schlüssel endet am ersten Doppelpunkt mit
     Leerraum oder Zeilenende dahinter (http://x ist kein Schlüssel) und darf
     in Anführungszeichen stehen. */
  function zerlege(c, n){
    if(c[0] === '"' || c[0] === "'"){
      const e = yEnde(c, 1, c[0]);
      if(e < 0) return null;
      const m = c.slice(e + 1).match(/^\s*:(?:\s+([\s\S]*))?$/);
      return m ? {key: String(scalar(c.slice(0, e + 1), n)), val: (m[1] || '').trim()} : null;
    }
    const m = c.match(/^([\s\S]*?):(?:\s+([\s\S]*))?$/);
    if(!m || !m[1].trim() || /^[[{]/.test(c)) return null;
    return {key: m[1].trim(), val: (m[2] || '').trim()};
  }

  function parseNode(){
    const ln = lines[i];
    if(!ln) return null;
    return isItem(ln.content) ? parseSeq(ln.indent) : parseMap(ln.indent);
  }
  function parseMap(indent){
    const obj = {};
    while(i < lines.length){
      const ln = lines[i];
      if(ln.indent < indent) break;
      if(ln.indent > indent){
        warn(`Zeile ${ln.n} nicht gelesen: ${kurz(ln.content)}`, 'Die Zeile ist tiefer eingerückt, gehört aber zu keinem Schlüssel darüber.');
        i++; continue;
      }
      if(isItem(ln.content)) break;
      // „? schlüssel" und „: wert" darunter
      if(/^\?(\s|$)/.test(ln.content)){
        const k = ln.content.replace(/^\?\s*/, ''), nx = lines[i+1];
        const wert = nx && nx.indent === indent && /^:(\s|$)/.test(nx.content) ? nx.content.replace(/^:\s*/, '') : '';
        lines[i] = {indent, content: '"' + yEscape(String(scalar(k, ln.n))) + '": ' + wert, n: ln.n, leer: ln.leer};
        if(wert !== '' || (nx && /^:(\s|$)/.test(nx.content))) lines.splice(i + 1, 1);
        continue;
      }
      const m = zerlege(ln.content, ln.n);
      if(!m){
        warn(`Zeile ${ln.n} nicht gelesen: ${kurz(ln.content)}`, 'Die Zeile hat keine Form „schlüssel: wert" und steht nicht in einer Liste.');
        i++; continue;
      }
      const {key, val} = m;
      if(Object.prototype.hasOwnProperty.call(obj, key))
        warn(`Schlüssel "${key}" doppelt (Zeile ${ln.n})`,
          'Bei gleichnamigen Schlüsseln auf derselben Ebene überschreibt der spätere den früheren — der erste Wert geht verloren.');
      i++;
      const w = einzelwert(val, ln.n);
      if(!w.leer){
        let v = w.v;
        // Fortsetzungszeilen eines mehrzeiligen Textes anhängen (YAML-Faltung)
        if(typeof v === 'string' && w.schlicht){
          while(i < lines.length && lines[i].indent > indent && !isItem(lines[i].content)){
            if(zerlege(lines[i].content, lines[i].n))
              warn(`Zeile ${lines[i].n} als Fortsetzung des Textes gelesen`,
                `„${kurz(lines[i].content)}" sieht aus wie „schlüssel: wert", steht aber tiefer als „${key}" mit Wert. Sie wird an dessen Text angehängt.`);
            v += (lines[i].leer ? '\n'.repeat(lines[i].leer) : ' ') + zeilentrenner(lines[i].content);
            i++;
          }
        }
        obj[key] = v;
        continue;
      }
      const nx = lines[i];
      let v;
      if(nx && nx.indent > indent) v = parseNode();
      else if(nx && nx.indent === indent && isItem(nx.content)) v = parseSeq(indent);
      else v = null;
      if(w.anke) anker[w.anke] = v;
      obj[key] = v;
    }
    // Merge-Schlüssel „<<: *anker" bzw. „<<: [*a, *b]": eigene Schlüssel gehen vor
    if(Object.prototype.hasOwnProperty.call(obj, '<<')){
      const quellen = [].concat(obj['<<']).filter(q => q && typeof q === 'object' && !Array.isArray(q));
      const eigen = Object.assign({}, obj); delete eigen['<<'];
      const neu = {};
      quellen.slice().reverse().forEach(q => Object.assign(neu, q));
      Object.assign(neu, eigen);
      Object.keys(obj).forEach(k => delete obj[k]);
      Object.assign(obj, neu);
    }
    return obj;
  }
  function parseSeq(indent){
    const arr = [];
    while(i < lines.length){
      const ln = lines[i];
      if(ln.indent !== indent || !isItem(ln.content)) break;
      const rest = ln.content.replace(/^-\s*/, '');
      if(rest === ''){ i++; arr.push(lines[i] && lines[i].indent > indent ? parseNode() : null); continue; }
      const versatz = ln.content.length - rest.length;
      // Liste in der Liste: „- - x"
      if(isItem(rest)){
        lines[i] = {indent: indent + versatz, content: rest, n: ln.n, leer: ln.leer};
        arr.push(parseSeq(indent + versatz));
        continue;
      }
      const m = /^[[{"'*&!]/.test(rest) ? null : zerlege(rest, ln.n);
      const qm = !m && /^["']/.test(rest) ? zerlege(rest, ln.n) : null;     // „- "a b": 1"
      if(m || qm){
        const nx = lines[i+1];
        let itemIndent = indent + 2;
        if((m || qm).val !== '' && nx && nx.indent > indent && !isItem(nx.content)) itemIndent = nx.indent;
        lines[i] = {indent: itemIndent, content: rest, n: ln.n, leer: ln.leer};
        arr.push(parseMap(itemIndent));
      } else { arr.push(einzelwert(rest, ln.n).v); i++; }
    }
    return arr;
  }

  const doc = parseMap(lines.length ? lines[0].indent : 0);
  if(i < lines.length)
    warn(`Ab Zeile ${lines[i].n} nicht gelesen: ${kurz(lines[i].content)}`,
      'Die Einrückung passt nicht zur obersten Ebene der Datei; der Rest wird nicht gelesen.');
  return {doc, notes};
}
