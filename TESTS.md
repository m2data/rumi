# Regressionstest für den Geschäftsobjekt-Explorer

Zwei Dateien, keine Abhängigkeiten, nur Node.

    node smoke.js [pfad/zur/geschaeftsobjekt-explorer.html]

Ohne Pfadangabe wird `geschaeftsobjekt-explorer.html` im selben Ordner geprüft.
Rückgabewert 0 bei Erfolg, 1 bei mindestens einem Fehlschlag — damit lässt sich
der Aufruf in einen Pre-Commit-Hook oder eine Pipeline hängen.

## Was die Dateien tun

**`domshim.js`** ist ein sehr kleines DOM: HTML-Parser, Selektoren, `classList`,
`dataset`, `innerHTML`, Ereignisverteilung. Gerade genug, um die App wirklich zu
starten. Kein Browser, kein npm-Paket.

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

    node smoke.js && echo "ok"

Bei neuen Funktionen gehört eine Prüfung dazu, die den **Bedienweg** abbildet,
nicht nur das Ergebnis der Berechnung.
