/* Sehr kleines DOM, gerade groß genug, um die App zu starten und Zeigerereignisse
   auszulösen. Kein Anspruch auf Vollständigkeit — nur auf das, was die App nutzt. */

const VOID = new Set(['br','hr','img','input','meta','link','path','rect','circle','line','use','stop','polygon','ellipse']);

function parseHTML(src, parent){
  let i = 0;
  const stack = [parent];
  while(i < src.length){
    const lt = src.indexOf('<', i);
    if(lt < 0){ break; }
    if(lt > i){
      const txt = src.slice(i, lt);
      if(txt.trim()) stack[stack.length-1].appendText(txt);
    }
    if(src.startsWith('<!--', lt)){ i = src.indexOf('-->', lt) + 3; continue; }
    if(src.startsWith('<!', lt)){ i = src.indexOf('>', lt) + 1; continue; }
    const gt = findTagEnd(src, lt);
    const raw = src.slice(lt+1, gt);
    i = gt + 1;
    if(raw[0] === '/'){
      const name = raw.slice(1).trim().toLowerCase();
      for(let k = stack.length-1; k > 0; k--){
        if(stack[k].tag === name){ stack.length = k; break; }
      }
      continue;
    }
    const selfClose = raw.trimEnd().endsWith('/');
    const body = selfClose ? raw.trimEnd().slice(0, -1) : raw;
    const mName = body.match(/^([A-Za-z][\w:-]*)/);
    if(!mName) continue;
    const tag = mName[1].toLowerCase();
    const el = new El(tag);
    for(const m of body.slice(mName[0].length).matchAll(/([\w:@.-]+)(?:\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+)))?/g)){
      el.attrs[m[1].toLowerCase()] = m[3] !== undefined ? m[3] : (m[4] !== undefined ? m[4] : (m[5] !== undefined ? m[5] : ''));
    }
    stack[stack.length-1].append(el);
    if(!selfClose && !VOID.has(tag)) stack.push(el);
  }
}

function findTagEnd(src, from){
  let q = null;
  for(let k = from+1; k < src.length; k++){
    const c = src[k];
    if(q){ if(c === q) q = null; continue; }
    if(c === '"' || c === "'"){ q = c; continue; }
    if(c === '>') return k;
  }
  return src.length;
}

class El {
  constructor(tag){
    this.tag = tag; this.attrs = {}; this.children = []; this.parent = null;
    this.text = ''; this.listeners = {}; this.disabled = false; this.hidden = false;
    this.style = {};
  }
  append(el){ el.parent = this; this.children.push(el); }
  appendText(t){ this.text += t; }
  appendChild(el){ this.append(el); return el; }
  remove(){ if(this.parent) this.parent.children = this.parent.children.filter(c => c !== this); }

  get id(){ return this.attrs.id; }
  get className(){ return this.attrs.class || ''; }
  set className(v){ this.attrs.class = v; }
  get textContent(){
    return this.text + this.children.map(c => c.textContent).join('');
  }
  set textContent(v){ this.text = String(v); this.children = []; }

  get classList(){
    const self = this;
    const list = () => (self.attrs.class || '').split(/\s+/).filter(Boolean);
    return {
      contains: c => list().includes(c),
      add: (...cs)=>{ const l = list(); cs.forEach(c=>{ if(!l.includes(c)) l.push(c); }); self.attrs.class = l.join(' '); },
      remove: (...cs)=>{ self.attrs.class = list().filter(c => !cs.includes(c)).join(' '); },
      toggle: (c, on)=>{
        const has = list().includes(c);
        const want = on === undefined ? !has : !!on;
        if(want) self.classList.add(c); else self.classList.remove(c);
        return want;
      }
    };
  }
  get dataset(){
    const d = {};
    for(const k in this.attrs) if(k.startsWith('data-'))
      d[k.slice(5).replace(/-([a-z])/g, (_,c)=>c.toUpperCase())] = this.attrs[k];
    return d;
  }
  setAttribute(k, v){ this.attrs[k.toLowerCase()] = String(v); }
  getAttribute(k){ const v = this.attrs[k.toLowerCase()]; return v === undefined ? null : v; }
  removeAttribute(k){ delete this.attrs[k.toLowerCase()]; }
  hasAttribute(k){ return this.attrs[k.toLowerCase()] !== undefined; }

  set innerHTML(v){ this.children = []; this.text = ''; parseHTML(String(v), this); }
  get innerHTML(){ return this.children.map(c => c.outerHTML).join(''); }
  get outerHTML(){
    const a = Object.entries(this.attrs).map(([k,v])=> ` ${k}="${v}"`).join('');
    if(VOID.has(this.tag) && !this.children.length) return `<${this.tag}${a}/>`;
    return `<${this.tag}${a}>${this.text}${this.children.map(c => c.outerHTML).join('')}</${this.tag}>`;
  }

  descendants(){
    const out = [];
    const walk = n => n.children.forEach(c=>{ out.push(c); walk(c); });
    walk(this);
    return out;
  }
  matches(sel){ return matchSel(this, sel); }
  closest(sel){
    let n = this;
    while(n){ if(n.matches && n.matches(sel)) return n; n = n.parent; }
    return null;
  }
  querySelectorAll(sel){ return this.descendants().filter(e => matchSel(e, sel)); }
  querySelector(sel){ return this.querySelectorAll(sel)[0] || null; }
  addEventListener(type, fn){ (this.listeners[type] ||= []).push(fn); }
  removeEventListener(type, fn){ this.listeners[type] = (this.listeners[type]||[]).filter(f => f !== fn); }
  setPointerCapture(){} releasePointerCapture(){}
  getBoundingClientRect(){ return {left:0, top:0, width:1200, height:800, right:1200, bottom:800}; }
  focus(){} blur(){} click(){ dispatch(this, 'click', {}); }
  // Dateifelder: standardmäßig leer, für Tests des Ladewegs aber setzbar
  get files(){ return this._files || []; } set files(v){ this._files = v; }
  set value(v){ this._v = v; } get value(){ return this._v || ''; }
  set checked(v){ this._c = v; } get checked(){ return !!this._c; }
}

/* Selektoren: Tag, .klasse, #id, [attr], [attr="v"], Kombinationen und Nachfahren */
function matchSimple(el, part){
  const m = part.match(/^([a-zA-Z][\w-]*)?((?:[#.][\w:-]+|\[[^\]]+\])*)$/);
  if(!m) return false;
  if(m[1] && el.tag !== m[1].toLowerCase()) return false;
  const rest = m[2] || '';
  for(const tok of rest.match(/[#.][\w:-]+|\[[^\]]+\]/g) || []){
    if(tok[0] === '.'){ if(!el.classList.contains(tok.slice(1))) return false; }
    else if(tok[0] === '#'){ if(el.attrs.id !== tok.slice(1)) return false; }
    else {
      const a = tok.slice(1,-1).match(/^([\w:@.-]+)(?:\s*=\s*"?([^"\]]*)"?)?$/);
      if(!a) return false;
      const v = el.attrs[a[1].toLowerCase()];
      if(v === undefined) return false;
      if(a[2] !== undefined && v !== a[2]) return false;
    }
  }
  return true;
}
function matchSel(el, sel){
  for(const alt of sel.split(',')){
    const parts = alt.trim().split(/\s+/);
    if(!parts.length) continue;
    if(!matchSimple(el, parts[parts.length-1])) continue;
    let n = el.parent, k = parts.length - 2, ok = true;
    while(k >= 0){
      let found = false;
      while(n){ if(matchSimple(n, parts[k])){ found = true; n = n.parent; break; } n = n.parent; }
      if(!found){ ok = false; break; }
      k--;
    }
    if(ok) return true;
  }
  return false;
}

function dispatch(target, type, props){
  const ev = Object.assign({
    type, target, currentTarget:target, defaultPrevented:false,
    preventDefault(){ this.defaultPrevented = true; }, stopPropagation(){ this._stop = true; },
    clientX:0, clientY:0, deltaY:0, altKey:false, shiftKey:false, ctrlKey:false, metaKey:false,
    pointerId:1, key:''
  }, props);
  let n = target;
  while(n){
    (n.listeners[type] || []).forEach(fn => fn.call(n, ev));
    if(n['on'+type]) n['on'+type].call(n, ev);
    if(ev._stop) break;
    n = n.parent;
  }
  return ev;
}

function createDom(html){
  const body = html.replace(/<script[\s\S]*?<\/script>/gi, '')
                   .replace(/<style[\s\S]*?<\/style>/gi, '');
  const root = new El('#root');
  parseHTML(body, root);
  const byId = new Map();
  const document = {
    // dynamisch suchen: die App ersetzt ganze Teilbäume über innerHTML
    getElementById: id => root.descendants().find(e => e.attrs.id === id) || null,
    querySelector: s => root.querySelector(s),
    querySelectorAll: s => root.querySelectorAll(s),
    addEventListener: (t,f)=> (root.listeners[t] ||= []).push(f),
    createElement: tag=>{
      const el = new El(tag);
      if(tag === 'canvas') el.getContext = ()=>({ set font(v){}, measureText:t=>({width:String(t).length*6.6}) });
      return el;
    },
    createElementNS: (ns, tag)=> new El(tag),
    body: root,
    documentElement: root,
    get activeElement(){ return null; }
  };
  return {document, root, byId, dispatch, El};
}

module.exports = {createDom, dispatch, El};
