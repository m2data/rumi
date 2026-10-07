# Regressionstest für den Geschäftsobjekt-Explorer

Alles in `test/`, keine Abhängigkeiten, nur Node.

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

**`geo.js`** bündelt die Geometrie-Helfer der Tests (Streckenschnitt,
Kreuzungszählung Zentrum-zu-Zentrum und entlang gerouteter Segmente,
Kantenpfad-Aufbau). Neue Tests nutzen diese Zähler statt eigener Kopien —
sonst messen zwei Tests still Verschiedenes.

**`model.test.js`** prüft `yaml.js` + `model.js` (auch die Modellart der
Quelltabellen): YAML-Rundlauf (Tabs wie
Leerzeichen), Aufbau von Objekten, Attributen und Beziehungen sowie die
Prüfregeln (unbekanntes Ziel, fehlende Domain, doppelte Beziehung, Selbstbezug …)
und einen Rundlauf am ausgelieferten Modell.

**`layout.test.js`** prüft `layout.js` (mit `render.js` fürs orthogonale
Verfahren): alle vier Anordnungsverfahren liefern brauchbare Koordinaten,
`separate()` löst Überdeckungen auf, kein Knoten verdeckt einen anderen, und die
Kantenführung bleibt bei einer Kette kreuzungsfrei.

**`outline.test.js`** prüft `hierarchie.js`: `buildOutline()` liest die Übersicht
zu einem Diagramm-Baum (Beschreibung, Objektliste, Kinder), vergibt pfadbasierte
Kennungen und meldet Objekte, die es im Modell nicht gibt. Dazu der kleine
Markdown-Renderer (`renderMarkdown`): Überschriften, fett/kursiv, Listen, Links
und HTML-Maskierung gegen Einschleusen.

**`smoke.js`** ist der Läufer des Rauchtests: er startet die Themendateien
unter **`rauch/`** nacheinander, jede in einem eigenen Node-Prozess mit einer
frischen App-Instanz — die Themen teilen also keinen Zustand und lassen sich
auch einzeln ausführen (`node test/rauch/kanten.js`). Der gemeinsame Start
(HTML laden, App im Mini-DOM booten) liegt in `rauch/start.js`. Die Themen:

- **`kanten.js`** — Kanten bearbeiten: auswählen, Stützpunkte, Anschlusspunkte,
  Segmente, Doppelklick, Ortho-Formen, Selbstbezug.
- **`beschriftung.js`** — Beziehungsbeschriftungen: frei verschiebbar auf Kante
  und Schleife, automatisches Entzerren.
- **`auswahl.js`** — Auswahl und Tastatur: Klick-Verhalten, Bereichs-Layout,
  Pfeiltasten/Entf, Rückgängig/Wiederherstellen, Ausrichten und Verteilen über
  die Leiste, Strg+Klick/Escape/Strg+A, Anordnen-Menü.
- **`zeiger.js`** — was auf der leeren Fläche beginnt: Rahmen aufziehen,
  Schwenken, Zoom (Rad, Knöpfe, Grenzen), dazu das Versetzen eines Mittelstücks
  in einem Zug, der schon Knicke hat.
- **`anzeige.js`** — Seitenleiste und Kästen: Inhaltsauswahl, Prüfliste
  (Gruppen, Sprung zum Objekt), Objektliste, Kastengeometrie.
- **`elemente.js`** — Quelle und Domäne als eigene Elemente (Einstellungen):
  je Objekt eigene Kästen rechts daneben, gesperrter Inhalt-Eintrag, Ein- und
  Ausblenden mit dem Objekt, gemerkte Einstellung, dasselbe in der Hierarchie.
- **`hierarchie.js`** — Hierarchie-Modus: Baum, Ausschnitte, Beschreibung,
  Strukturänderungen, verknüpfte Objekte, Markdown im Export.
- **`sitzung.js`** — Sitzung, Dateien, Export: Speicher-Quota, PNG-Maßstab und
  -Limit, Delta-Merge, Tab-eigene Sitzung, keine externen Quellen; dazu das
  Dateimenü Knopf für Knopf, die Ladewege über die Dateifelder und das Ablegen
  einer Datei auf der Zeichenfläche; dazu „Stand speichern" in dieselbe Datei
  (Dateizugriff vorhanden, Dialog abgebrochen, Dateizugriff fehlt → Download).
- **`pflege.js`** — Geschäftsobjekte bearbeiten: Einstellung „Geschäftsobjekte
  bearbeiten" (Vorgabe aus, Haken im Menü „Einstellungen", nicht im Verlauf),
  Formular im Reiter „Details", Text-Chirurgie am Modell-YAML (Kommentare und
  Formatierung unberührter Stellen bleiben), Umbenennen samt Verweisen und
  Kennungen, Anlegen, Löschen, Rückgängig; Zusatzattribute (Dialog, Feldnamen
  mit `_ - / .`, Lesen/Schreiben von Bestellung und Bestellung_VRS neben
  `schema.org`, Erhalt beim Neuschreiben eines Attributs).
- **`quellen.js`** — die Ebene der Quelltabellen: Schalter „Quelltabellen
  verwenden" (Vorgabe aus, im Verlauf), Bereich mit den automatischen
  Diagrammen je Quellsystem (geschützt) und eigenen Gegenüberstellungen, das
  Geschäftsobjekt als eigenes Element (einmal je Diagramm, nur dort),
  „Quelltabellen bearbeiten" (Quellsystem, Zuordnung, nur geänderte Zeilen,
  Umbenennen, Anlegen, Löschen), das Nachziehen der Zuordnung beim Umbenennen
  eines Geschäftsobjekts, die beiden Dateien laden und speichern, Stand und
  ältere Positionsinformationen.
- **`fuehrung.js`** — weiche Kantenführung im dichten kombinierten Modell
  (willibald + Delta crm + sap-finanz): kein Pendeln zwischen den Seiten
  (Blitzmuster), kaum Züge außerhalb ihres Anschluss-Intervalls (Kringel),
  Anschlüsse zeigen dorthin, wohin ihr Zug läuft (Knickwinkel). Der letzte
  Abschnitt deckelt zusätzlich **Kästen mit Domain, Business Keys und Quellen
  in echten Maßen** (der Inhalt der früheren Ansicht 2) in allen vier
  Richtungen und beiden Verfahren — die Darstellung der Praxis, deren
  Geometrie sich von der vereinheitlichten deutlich unterscheidet.
- **`ortho.js`** — rechtwinklige Führung im dichten Modell `verquer_bo.yaml`:
  keine Haken weit außerhalb des Anschluss-Intervalls, parallele Beziehungen
  zwischen denselben zwei Objekten kreuzen einander nicht, Deckel je
  Flussrichtung. Dazu die Gegenprobe, dass die weiche Führung unberührt
  bleibt. Zwei Abweichungen von den übrigen Themen, beide notwendig, um die
  gemeldete Anordnung überhaupt zu treffen: das Modell wird **geladen** statt
  als Delta ergänzt (sonst liegt es auf dem ausgelieferten Willibald-Modell,
  und dessen elf Objekte verschieben Ebenen und Reihenfolge), und die
  Kastenmaße bleiben, wie die App sie rechnet, statt vereinheitlicht zu
  werden. Beides war zuvor falsch — der Test bestand, während der gemeldete
  Fehler unverändert im Bild stand.

Ein neuer Rauchtest gehört in die passende Themendatei; wächst ein Thema aus
dem Rahmen, bekommt es eine eigene Datei — der Läufer nimmt jede `*.js` unter
`rauch/` automatisch mit.

## Abdeckung messen

    node test/abdeckung.js

Baut zusammen, lässt die vier Einstiege noch einmal mit eingeschalteter
V8-Coverage laufen und rechnet das Ergebnis auf die Dateien in `src/` zurück:
eine Tabelle je Modul und die längsten ungedeckten Strecken mit Zeilennummern.
Der Aufruf gehört **nicht** in die Pflichtkette — er führt die Suite ein zweites
Mal aus und ist zum Nachsehen da, wo Prüfungen fehlen, nicht als Tor.

Zwei Dinge daran sind nicht offensichtlich:

- Die App läuft in den Tests über `new Function` (gebaute HTML bzw. Module aus
  `src/`); V8 meldet solche Skripte ohne Namen. `abdeckung-hook.js` wird deshalb
  vorgeschaltet und schreibt die Rümpfe mit, zugeordnet wird über die Länge.
- Gemessen wird je Prozess getrennt und danach **verodert**. Verschmilzt man die
  Bereiche aller Prozesse vor der Auswertung, löscht ein in Prozess A nie
  betretener Zweig, was Prozess B durchlaufen hat — die Quote hängt dann an der
  Dateireihenfolge und fällt um mehr als zehn Punkte zu tief aus.

## Warum das nötig ist

Prüfungen am reinen Modell — Layoutgüte, Kreuzungen, YAML-Rundlauf — laufen ohne
DOM und sagen nichts darüber aus, **ob man die Funktion erreicht**. Ein
hängengebliebener Zustandsschalter, ein fehlendes Element, ein Ereignis, das nicht
mehr ankommt: alles davon lässt die Rechenlogik intakt und macht die Bedienung
trotzdem unbenutzbar. Genau diese Lücke schließt der Rauchtest.

## Nach jeder Änderung

    node build.js && node test/smoke.js && node test/model.test.js && node test/layout.test.js && node test/outline.test.js && echo "ok"

## Definition of Done

Jede Änderung gilt erst als fertig, wenn sie einen Test hat:

- **Fehlerbehebung:** ein Test, der auf dem *alten* Stand **fehlschlägt** und mit
  dem Fix besteht. Nur so ist bewiesen, dass der Test den Fehler wirklich
  abdeckt (Beispiel: Selbstbezug verschiebbar — der Test scheitert, solange die
  Schleife keinen Griff bekommt).
- **Feature:** ein Test, der den **Bedienweg** abbildet (klicken, ziehen,
  umschalten), nicht nur das Rechenergebnis.
- **Reines Refactoring** darf ohne neuen Test auskommen, wenn die
  Verhaltensgleichheit anders belegt ist (z. B. byte-/zeichengleiche Ausgabe).

**Layout-Geometrie prüfen:** über den Bedienweg (Klick auf das Verfahren im
Anordnen-Menü), nicht per direktem `ALGOS.…fn(...)`. Der direkte Aufruf umgeht
`runByComponent`, dessen Tiefensuche die Knotenreihenfolge und damit die
Ebenenzuteilung bestimmt — der Test misst sonst eine andere Anordnung als die
App und behauptet Geometrie, die es im Browser nicht gibt. Dazu die Kastenmaße
vereinheitlichen (`n.w = 152; n.h = 38`), sonst hängt das Ergebnis an der
Schriftmessung des Mini-DOM. Beispiele in [`rauch/fuehrung.js`](test/rauch/fuehrung.js).

## Absicherung im Hook

Der Pre-Commit-Hook liegt versioniert unter `hooks/` und wird pro Klon einmalig
aktiviert:

    git config core.hooksPath hooks

Er baut zusammen, lässt alle Tests laufen (bricht bei rot ab) und **weist darauf
hin**, wenn `src/` ohne `test/` geändert wurde — als Erinnerung an die Definition
of Done. Der Hinweis blockiert nicht (Refactorings sind erlaubt), macht das
Weglassen eines Tests aber sichtbar.
