/* Rauchtest-Läufer: startet die Themendateien unter test/rauch/ nacheinander,
   jede in einem eigenen Node-Prozess mit einer frischen App-Instanz — so teilen
   die Themen keinen Zustand und lassen sich auch einzeln ausführen:

       node test/smoke.js [pfad/zur/geschaeftsobjekt-explorer.html]
       node test/rauch/kanten.js            (ein einzelnes Thema)

   Der Aufruf und der Rückgabewert (0 = alles grün) bleiben wie vor der
   Aufteilung, damit Hook und TESTS.md weiter gelten. */
const {spawnSync} = require('child_process');
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'rauch');
const themen = fs.readdirSync(dir)
  .filter(f => f.endsWith('.js') && f !== 'start.js')
  .sort();

let rot = [];
for(const f of themen){
  console.log('\n───── ' + f + ' ─────');
  const r = spawnSync(process.execPath, [path.join(dir, f), ...process.argv.slice(2)], {stdio:'inherit'});
  if(r.status) rot.push(f);
}

console.log('\n' + (rot.length
  ? 'Rauchtest: ' + rot.length + ' von ' + themen.length + ' Themen fehlgeschlagen — ' + rot.join(', ')
  : 'Rauchtest: alle ' + themen.length + ' Themen bestanden'));
process.exit(rot.length ? 1 : 0);
