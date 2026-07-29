# Umzug ins Git-Verzeichnis

Ausgangslage: eine HTML-Datei, 140 KB, rund 2600 Zeilen, mit Teststrecke.
Der Vorschlag hält den entscheidenden Vorteil fest — **das Ergebnis bleibt eine
einzelne Datei zum Weitergeben** — und trennt trotzdem die Quellen.

## Struktur

    willibald-explorer/
      src/
        index.html          Gerüst, Kopfzeile, Seitenleiste
        style.css           Dokumentstile
        svg.css             Stile im Diagramm (werden ins SVG eingebettet)
        yaml.js             toleranter Leser
        model.js            Modellaufbau und Prüfungen
        layout.js           die vier Anordnungsverfahren
        route.js            Wegsuche und Kantenführung
        render.js           SVG-Erzeugung
        edit.js             Griffe, Ziehen, Auswahl
        app.js              Zustand, Ereignisse, Speicherung
      test/
        domshim.js          Mini-DOM
        smoke.js            Bedienwege
        model.test.js       YAML-Rundlauf, Prüfregeln
        layout.test.js      Kreuzungen, verdeckte Knoten, Überdeckung
      models/
        willibald-attr.yaml
      build.js              fügt src/ zu einer HTML-Datei zusammen
      dist/
        geschaeftsobjekt-explorer.html

**Umgesetzter Stand.** Der Code lag in zehn nummerierten Abschnitten vor, die
sich nicht ganz mit der Liste oben decken. Tatsächlich geschnitten wurde entlang
dieser Abschnitte, jede Datei bleibt ein zusammenhängendes Stück (so ist der
Zusammenbau nachweislich byte-identisch):

- `render.js` enthält nur die SVG-Markup-Erzeugung (`nodeMarkup`, `edgeMarkup`).
- `app.js` hält Zustand und das Anstoßen des Zeichnens (`initSvg`, `draw`).
- `ui.js` kam hinzu für Ansicht, Seitenleiste, Eingabe und Kopfzeile — die
  Ereignis- und Bedienschicht. Sie ist von `app.js` durch die dazwischenliegenden
  `route.js`/`edit.js` getrennt und deshalb eine eigene Datei statt Teil von `app.js`.

`model.test.js` und `layout.test.js` liegen in `test/` und laufen über
`harness.js`, das einzelne `src`-Module ohne Browser lädt. Zusammen mit dem
Rauchtest `smoke.js` prüft der Pre-Commit-Hook alle drei.

`build.js` ist bewusst simpel: Dateien einlesen, in das Gerüst einsetzen,
schreiben. Kein Bündler, keine Abhängigkeiten, kein `node_modules`.

## Ablauf

    node build.js && node test/smoke.js && node test/layout.test.js

Als `pre-commit`-Hook eingetragen, kommt nichts Kaputtes ins Verzeichnis.

## Reihenfolge beim Aufteilen

1. Verzeichnis anlegen, aktuelle Datei als `dist/` ablegen, erster Commit —
   damit gibt es sofort einen Stand zum Zurückkehren.
2. `build.js` schreiben und die Datei unverändert durchlaufen lassen.
   Prüfen, dass die Teststrecke danach weiterhin grün ist.
3. Erst dann Modul für Modul herausschneiden, **nach jedem Schnitt testen**.

Schritt 2 ist der wichtige: Solange der Zusammenbau nicht bewiesen ist, darf
nichts zerlegt werden.

## Regel für neue Funktionen

Zu jeder neuen Funktion gehört eine Prüfung in `smoke.js`, die den **Bedienweg**
abbildet, nicht nur das Rechenergebnis. Genau diese Lücke hat die verlorene
Kantenbearbeitung und den Text am Kastenrand durchrutschen lassen.
