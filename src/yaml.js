/* =====================================================================
   1 — Toleranter YAML-Leser
   Liest die für dieses Metamodell nötige YAML-Teilmenge und akzeptiert
   dabei Tabs als Einrückung (echtes YAML verbietet das).
   ===================================================================== */
const TAB_WIDTH = 4;

/* Escapes einer Zeichenkette in "…" auflösen — dieselben, die YAML kennt
   (\ , \/, \xHH, \uHHHH …), nicht nur \n \t \" \\. Andere Werkzeuge schreiben
   sie, etwa \ am Anfang einer Folgezeile für ein erhaltenes Leerzeichen. */
const Y_ESC = {'0':'\0', a:'\x07', b:'\b', t:'\t', '\t':'\t', n:'\n', v:'\v', f:'\f', r:'\r', e:'\x1b',
  ' ':' ', '"':'"', '/':'/', '\\':'\\', N:'\u0085', _:'\u00a0', L:'\u2028', P:'\u2029'};
const yUnescape = s => s.replace(/\\(x[0-9a-fA-F]{2}|u[0-9a-fA-F]{4}|U[0-9a-fA-F]{8}|[\s\S])/g, (m, c)=>
  c.length > 1 ? String.fromCodePoint(parseInt(c.slice(1), 16)) : (c in Y_ESC ? Y_ESC[c] : m));
const yEscape = s => s.replace(/\\/g,'\\\\').replace(/"/g,'\\"').replace(/\n/g,'\\n').replace(/\t/g,'\\t');

/* Zeichenketten in Anführungszeichen, die über mehrere Zeilen laufen, in einen
   einzeiligen "…"-Wert umschreiben — wie bei den Blockskalaren. Gefaltet wird
   nach YAML: ein Umbruch wird Leerzeichen, n Leerzeilen werden n Umbrüche, in
   "…" hebt ein \ am Zeilenende den Umbruch auf; in '…' ist '' ein Apostroph.
   So schreiben YAML-Werkzeuge lange Texte. Schließt die Zeichenkette nicht,
   bevor eine Zeile höchstens so weit eingerückt ist wie ihr Schlüssel, bleibt
   alles, wie es war — ein Apostroph am Wertanfang verschluckt nichts. */
function expandFlowScalars(text){
  const raw = text.split('\n');
  const colw = s => s.replace(/\t/g, ' '.repeat(TAB_WIDTH)).match(/^ */)[0].length;
  const head = /^(\s*(?:-\s+)?[^:#'"\s][^:]*:[ \t]+|\s*-[ \t]+)(["'])([\s\S]*)$/;
  // Position des schließenden Anführungszeichens ab p, sonst -1
  const ende = (s, p, q)=>{
    for(let i = p; i < s.length; i++){
      if(q === '"' && s[i] === '\\'){ i++; continue; }
      if(s[i] === q){ if(q === "'" && s[i+1] === "'"){ i++; continue; } return i; }
    }
    return -1;
  };
  const fortgesetzt = s => /(^|[^\\])(\\\\)*\\$/.test(s);      // endet auf ein ungerades \
  const out = [];
  for(let i = 0; i < raw.length; i++){
    const m = raw[i].match(head);
    if(!m || ende(m[3], 0, m[2]) >= 0){ out.push(raw[i]); continue; }
    const q = m[2], keyCol = colw(raw[i]), teile = [m[3]];
    let j = i + 1, schluss = -1;
    for(; j < raw.length; j++){
      if(raw[j].trim() !== '' && colw(raw[j]) <= keyCol) break;
      const k = ende(raw[j], 0, q);
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
    out.push(m[1] + '"' + yEscape(wert) + '"' + raw[j].slice(schluss + 1));
    i = j;
  }
  return out.join('\n');
}

/* Blockskalare (key: | , |- , > , >- \u2026) in einen escapten einzeiligen Wert
   umschreiben, den der \u00FCbrige Leser als "\u2026\n\u2026" versteht. Die eigentliche Logik
   (Zeilen falten, Einr\u00FCckung, Kommentare) bleibt so unver\u00E4ndert. */
function expandBlockScalars(text){
  const raw = text.split('\n');
  const colw = s => s.replace(/\t/g, ' '.repeat(TAB_WIDTH)).match(/^ */)[0].length;
  const head = /^(\s*)([^:#][^:]*):[ \t]*([|>])([-+]?)\d*[ \t]*(?:#.*)?$/;
  const out = [];
  for(let i = 0; i < raw.length; i++){
    const m = raw[i].match(head);
    if(!m){ out.push(raw[i]); continue; }
    const keyCol = colw(m[1]), folded = m[3] === '>', chomp = m[4];
    const block = [];
    let j = i + 1;
    for(; j < raw.length; j++){
      if(raw[j].trim() === ''){ block.push(''); continue; }
      if(colw(raw[j]) <= keyCol) break;
      // nur Tabs der Einrückung umrechnen — ein Tab im Text bleibt einer
      block.push(raw[j].replace(/^[ \t]+/, m => m.replace(/\t/g, ' '.repeat(TAB_WIDTH))));
    }
    while(block.length && block[block.length-1] === '') block.pop();   // Leerzeilen am Ende geh\u00F6ren nicht dazu
    const common = Math.min(Infinity, ...block.filter(b => b !== '').map(b => b.match(/^ */)[0].length));
    const body = block.map(b => b === '' ? '' : b.slice(common));
    let content;
    if(folded){
      let s = '';
      for(const l of body) s += l === '' ? '\n' : ((s === '' || s.endsWith('\n')) ? '' : ' ') + l;
      content = s;
    } else content = body.join('\n');
    if(chomp !== '+') content = content.replace(/\n+$/, '');           // '-' und Standard: kein Nachlauf
    const esc = content.replace(/\\/g,'\\\\').replace(/"/g,'\\"').replace(/\n/g,'\\n').replace(/\t/g,'\\t');
    out.push(m[1] + m[2] + ': "' + esc + '"');
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

function readYaml(text){
  const notes = [];
  const src = expandBlockScalars(expandFlowScalars(text.replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n')));
  if(src.includes('\t')) notes.push({level:'warn', title:'Tabulatoren in der Einrückung',
    body:`Die Datei rückt teilweise mit Tabulatoren ein. YAML erlaubt das nicht — ein normaler Parser bricht hier ab. Diese App rechnet einen Tab in ${TAB_WIDTH} Leerzeichen um.`});

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

  const lines = [];
  src.split('\n').forEach((raw, idx)=>{
    const expanded = raw.replace(/\t/g, ' '.repeat(TAB_WIDTH));
    const stripped = stripComment(expanded);
    if(!stripped.trim() || /^\s*#/.test(stripped)) return;
    lines.push({indent: stripped.match(/^ */)[0].length, content: stripped.trim(), n: idx+1});
  });

  let i = 0;
  const isItem = s => /^-(\s|$)/.test(s);

  // U+2028/U+2029 (Zeilentrenner, etwa aus Word eingefügt) gelten als Zeilenumbruch
  const zeilentrenner = s => s.replace(/[\u2028\u2029]/g, '\n');
  function scalar(v){
    if(v === '' || v === '~' || v === 'null') return null;
    // Doppelte Anführungszeichen: Escapes auflösen, damit mehrzeilige Texte
    // einzeilig gespeichert und wieder gelesen werden können.
    if(/^"[\s\S]*"$/.test(v)) return zeilentrenner(yUnescape(v.slice(1,-1)));
    if(/^'[\s\S]*'$/.test(v)) return zeilentrenner(v.slice(1,-1).replace(/''/g, "'"));
    if(/^(true|false)$/i.test(v)) return v.toLowerCase() === 'true';
    if(/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
    return zeilentrenner(v);
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
      if(ln.indent > indent){ i++; continue; }
      if(isItem(ln.content)) break;
      // [\s\S] statt . — sonst fiele eine Zeile mit U+2028 still heraus
      const m = ln.content.match(/^([^:]+):\s*([\s\S]*)$/);
      if(!m){ i++; continue; }
      const key = m[1].trim(), val = m[2].trim();
      if(Object.prototype.hasOwnProperty.call(obj, key))
        notes.push({level:'warn', title:`Schlüssel "${key}" doppelt (Zeile ${ln.n})`,
          body:'Bei gleichnamigen Schlüsseln auf derselben Ebene überschreibt der spätere den früheren — der erste Wert geht verloren.'});
      i++;
      if(val !== ''){
        if(val === '[]'){ obj[key] = []; continue; }
        if(val === '{}'){ obj[key] = {}; continue; }
        if(/^[[{]/.test(val))
          notes.push({level:'warn', title:`Inline-Notation bei "${key}" (Zeile ${ln.n})`,
            body:'Werte in geschweiften oder eckigen Klammern werden nicht ausgewertet. Bitte als eingerückten Block schreiben.'});
        let v = scalar(val);
        // Fortsetzungszeilen eines mehrzeiligen Textes anhängen (YAML-Faltung)
        if(typeof v === 'string'){
          while(i < lines.length && lines[i].indent > indent
                && !isItem(lines[i].content)
                && !/^[^\s:][^:]*:(\s|$)/.test(lines[i].content)){
            v += ' ' + lines[i].content;
            i++;
          }
        }
        obj[key] = v; continue;
      }
      const nx = lines[i];
      if(nx && nx.indent > indent) obj[key] = parseNode();
      else if(nx && nx.indent === indent && isItem(nx.content)) obj[key] = parseSeq(indent);
      else obj[key] = null;
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
      const m = rest.match(/^([^:]+):\s*([\s\S]*)$/);
      if(m){
        const nx = lines[i+1];
        let itemIndent = indent + 2;
        if(m[2].trim() !== '' && nx && nx.indent > indent && !isItem(nx.content)) itemIndent = nx.indent;
        lines[i] = {indent: itemIndent, content: rest, n: ln.n};
        arr.push(parseMap(itemIndent));
      } else { arr.push(scalar(rest)); i++; }
    }
    return arr;
  }

  const doc = parseMap(lines.length ? lines[0].indent : 0);
  return {doc, notes};
}

