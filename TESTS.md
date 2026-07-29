# Regressionstest für den Geschäftsobjekt-Explorer

Zwei Dateien in `test/`, keine Abhängigkeiten, nur Node.

    node test/smoke.js [pfad/zur/geschaeftsobjekt-explorer.html]

Ohne Pfadangabe wird die gebaute Datei `dist/geschaeftsobjekt-explorer.html`
geprüft. Zusammenbau und Prüfung hängen so zusammen:

    node build.js && node test/smoke.js

Rückgabewert 0 bei Erfolg, 1 bei mindestens einem Fehlschlag — damit lässt sich
der Aufruf in einen Pre-Commit-Hook oder eine Pipeline hängen.

## Was die Dateien tun

**`domshim.js`** ist ein sehr kleines DOM: HTML-Parser, Selektoren, `classList`,
`dataset`, `innerHTML`, Ereignisverteilung. Gerade genug, um die App wirklich zu
starten. Kein Browser, kein npm-Paket.

**`harness.js`** lädt einzelne `src`-Module (statt der gebauten Datei) in einen
gemeinsamen Gültigkeitsbereich und reicht `document`/`S` hinein. Damit prüfen
Modell- und Layout-Test einzelne Funktionen, ohne die ganze App zu starten.

**`model.test.js`** prüft `yaml.js` + `model.js`: YAML-Rundlauf (Tabs wie
Leerzeichen), Aufbau von Objekten, Attributen und Beziehungen sowie die
Prüfregeln (unbekanntes Ziel, fehlende Domain, doppelte Beziehung, Selbstbezug …)
und einen Rundlauf am ausgelieferten Modell.

**`layout.test.js`** prüft `layout.js` (mit `render.js` fürs orthogonale
Verfahren): alle vier Anordnungsverfahren liefern brauchbare Koordinaten,
`separate()` löst Überdeckungen auf, kein Knoten verdeckt einen anderen, und die
Kantenführung bleibt bei einer Kette kreuzungsfrei.

**`outline.test.js`** prüft `hierarchie.js`: `buildOutline()` liest die Übersicht
zu einem Diagramm-Baum (Beschreibung, Objektliste, Kinder), vergibt pfadbasierte
Kennungen und meldet Objekte, die es im Modell nicht gibt.

**`smoke.js`** lädt die HTML-Datei, führt ihr Skript aus und **klickt die App
durch**: Kante anklicken, Stützpunkt einsetzen, ziehen, Anschlusspunkt versetzen,
Teilstück verschieben, Ansicht wechseln, Knoten ziehen, Inhalt umschalten.

## Warum das nötig ist

Prüfungen am reinen Modell — Layoutgüte, Kreuzungen, YAML-Rundlauf — laufen ohne
DOM und sagen nichts darüber aus, **ob man die Funktion erreicht**. Ein
hängengebliebener Zustandsschalter, ein fehlendes Element, ein Ereignis, das nicht
mehr ankommt: alles davon lässt die Rechenlogik intakt und macht die Bedienung
trotzdem unbenutzbar. Genau diese Lücke schließt der Rauchtest.

## Nach jeder Änderung

    node build.js && node test/smoke.js && node test/model.test.js && node test/layout.test.js && node test/outline.test.js && echo "ok"

Bei neuen Funktionen gehört eine Prüfung dazu, die den **Bedienweg** abbildet,
nicht nur das Ergebnis der Berechnung.
