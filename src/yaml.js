/* =====================================================================
   1 — Toleranter YAML-Leser
   Liest die für dieses Metamodell nötige YAML-Teilmenge und akzeptiert
   dabei Tabs als Einrückung (echtes YAML verbietet das).
   ===================================================================== */
const TAB_WIDTH = 4;

function readYaml(text){
  const notes = [];
  const src = text.replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n');
  if(src.includes('\t')) notes.push({level:'warn', title:'Tabulatoren in der Einrückung',
    body:`Die Datei rückt teilweise mit Tabulatoren ein. YAML erlaubt das nicht — ein normaler Parser bricht hier ab. Diese App rechnet einen Tab in ${TAB_WIDTH} Leerzeichen um.`});

  const lines = [];
  src.split('\n').forEach((raw, idx)=>{
    const expanded = raw.replace(/\t/g, ' '.repeat(TAB_WIDTH));
    const stripped = expanded.replace(/\s+#.*$/, '');
    if(!stripped.trim() || /^\s*#/.test(stripped)) return;
    lines.push({indent: stripped.match(/^ */)[0].length, content: stripped.trim(), n: idx+1});
  });

  let i = 0;
  const isItem = s => /^-(\s|$)/.test(s);

  function scalar(v){
    if(v === '' || v === '~' || v === 'null') return null;
    if(/^"(.*)"$/.test(v) || /^'(.*)'$/.test(v)) return v.slice(1,-1);
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

