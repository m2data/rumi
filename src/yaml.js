/* =====================================================================
   1 — Toleranter YAML-Leser
   Liest die für dieses Metamodell nötige YAML-Teilmenge und akzeptiert
   dabei Tabs als Einrückung (echtes YAML verbietet das).
   ===================================================================== */
const TAB_WIDTH = 4;

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
      block.push(raw[j].replace(/\t/g, ' '.repeat(TAB_WIDTH)));
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

function readYaml(text){
  const notes = [];
  const src = expandBlockScalars(text.replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n'));
  if(src.includes('\t')) notes.push({level:'warn', title:'Tabulatoren in der Einrückung',
    body:`Die Datei rückt teilweise mit Tabulatoren ein. YAML erlaubt das nicht — ein normaler Parser bricht hier ab. Diese App rechnet einen Tab in ${TAB_WIDTH} Leerzeichen um.`});

  // Kommentar ab '# ' entfernen, aber nur außerhalb von Anführungszeichen —
  // sonst zerschneidet eine Beschreibung wie "Preis # Stück" den Wert.
  const stripComment = s=>{
    let q = null;
    for(let i=0; i<s.length; i++){
      const c = s[i];
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

  function scalar(v){
    if(v === '' || v === '~' || v === 'null') return null;
    // Doppelte Anführungszeichen: Escapes auflösen (\n \t \" \\), damit
    // mehrzeilige Texte einzeilig gespeichert und wieder gelesen werden können.
    if(/^"(.*)"$/.test(v)) return v.slice(1,-1).replace(/\\(["\\nt])/g, (m,c)=> c === 'n' ? '\n' : c === 't' ? '\t' : c);
    if(/^'(.*)'$/.test(v)) return v.slice(1,-1);
    if(/^(true|false)$/i.test(v)) return v.toLowerCase() === 'true';
    if(/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
    return v;
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
      const m = ln.content.match(/^([^:]+):\s*(.*)$/);
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
      const m = rest.match(/^([^:]+):\s*(.*)$/);
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

