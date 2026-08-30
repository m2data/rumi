/* Vorgeschaltetes Modul für test/abdeckung.js (--require).

   Sowohl rauch/start.js (gebaute HTML) als auch harness.js (Module aus src/)
   führen ihren Code über `new Function` aus. V8 meldet solche Skripte in der
   Coverage ohne url — der Rumpf ist dort nicht mehr zu erkennen. Deshalb legt
   dieser Hook einen Proxy um Function und schreibt jeden großen Rumpf einmal
   weg; abdeckung.js ordnet die Coverage später über die Skriptlänge zu. */
const fs = require('fs');
const crypto = require('crypto');

const DIR = process.env.ABDECKUNG_RUEMPFE;

function merken(args){
  try{
    const body = String(args[args.length - 1]);
    if(body.length < 5000) return;                 // nur die großen Konkatenate
    const params = args.slice(0, -1).map(String);
    const h = crypto.createHash('sha1').update(params.join(',') + '|' + body).digest('hex').slice(0, 12);
    const f = DIR + '/rumpf-' + h + '.json';
    if(!fs.existsSync(f)) fs.writeFileSync(f, JSON.stringify({params, body}));
  }catch(e){ /* Messung darf den Testlauf nie stören */ }
}

global.Function = new Proxy(Function, {
  construct(ziel, args){ merken(args); return Reflect.construct(ziel, args); },
  apply(ziel, self, args){ merken(args); return Reflect.apply(ziel, self, args); }
});
