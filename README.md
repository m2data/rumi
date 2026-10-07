# rumi — Geschäftsobjekt-Explorer

Ein Werkzeug, das ein Unternehmensdatenmodell anzeigt: welche Geschäftsobjekte
es gibt, wie sie zusammenhängen, aus welchen Quellen sie stammen und mit welchen
Attributen sie beschrieben sind. Die Anwendung ist eine einzelne HTML-Datei,
läuft offline und lädt nichts nach.

Zur Bedienung siehe das [Benutzerhandbuch](HANDBUCH.md); diese Seite gibt den
Überblick.

## Was das Tool kann

- **Komplettansicht** – das ganze Geschäftsobjektmodell. Unter
  „Einstellungen" lassen sich **Quellen** und **Domäne** als eigene Kästen
  rechts neben jedes Objekt stellen (verbunden über „quelle" bzw. „Domäne");
  das gilt auch in der Hierarchie.
- **Hierarchie** – redaktionell gestaltete Diagramme: ein Baum aus Diagrammen
  (Übersicht → Domänen → Themen), jedes zeigt nur einen Ausschnitt der Objekte
  und hat einen Beschreibungstext (leichtes Markdown). Diagramme sind frei
  anordenbar; verknüpfte Objekte lassen sich zu einer Auswahl hinzuholen. Im Baum
  lassen sich Diagramme per Ziehen umsortieren und umhängen (obere/untere Kante =
  davor/danach, Mitte = als Unterdiagramm).
- **Pflegen** – zunächst **ausgeschaltet**: im Menü „Einstellungen" der
  Kopfzeile über „Geschäftsobjekte bearbeiten" einschalten. Dann lassen sich
  Geschäftsobjekte und ihre Beziehungen
  im Reiter „Details"
  bearbeiten: Name, Domain, Beschreibung, Business Keys, Quellen, Attribute
  (Typ, nullable, PK/AK/FK, Verweisziel) und ausgehende Beziehungen (Ziel, Name,
  Kardinalitäten). „＋ Objekt" über der Objektliste legt ein neues Objekt an,
  „Objekt löschen" nimmt eines samt der Beziehungen darauf wieder heraus.
  Umbenennen zieht `to:` und `references:` in allen anderen Objekten mit,
  ebenso Anordnung, Kantenzüge und die Hierarchiebeschreibung. Geschrieben wird
  **in die vorhandene YAML hinein**: geändert wird nur die bearbeitete Stelle —
  Kommentare, Reihenfolge, Einrückung und Schreibvarianten des Übrigen bleiben
  stehen. Jede Bearbeitung ist eine Aktion im Verlauf, Strg+Z nimmt sie zurück.
  Der Schalter selbst ist keine: er wird gemerkt und wandert in Export und
  Positionsinformationen mit — so gibt man einen Stand zum Ansehen weiter, an
  dem sich die Fachdaten nicht verstellen lassen. Anordnen, Kanten umlenken und
  die Hierarchie bleiben davon unberührt.
- **Zusatzattribute** – jeder Schlüssel an einem Objekt oder Attribut, den die
  App nicht selbst auswertet (etwa `schema.org:`), wird übernommen.
  „Einstellungen → Zusatzattribute …" schaltet je Feld ein, ob es im Formular
  gepflegt und in den Details gezeigt wird; ausgeschaltete bleiben in der Datei
  unberührt stehen.
- **Anordnen**: hierarchisch, orthogonal, organisch, kreisförmig; Kanten von
  Hand umlenken, Anschlusspunkte und Selbstbezüge verschieben (Doppelklick auf
  eine Kante löscht alle ihre Stützpunkte und wählt die kürzeste Verbindung).
  Beziehungsbeschriftungen sitzen auf der Kante und lassen sich frei entlang der
  Beziehung ziehen; überlappende Beschriftungen werden beim Auto-Layout, beim
  Anordnen einer Auswahl, beim Neuziehen von Kanten und nach dem Verschieben
  automatisch entzerrt — von Hand platzierte bleiben stehen. Ist ein Bereich
  markiert (mindestens zwei Objekte), wirkt das gewählte Verfahren nur auf ihn —
  so lässt sich für einen Teil ein anderes Auto-Layout verwenden, der übrige
  Plan bleibt liegen.
- **Auswählen**: Umschalt+Ziehen wählt einen Rahmen, Strg+Klick einzelne Objekte
  dazu oder weg. Die **Pfeiltasten** verschieben die Auswahl (fein, mit Umschalt
  um ein Rasterfeld), **Entf** blendet sie aus.
  **Rückgängig/Wiederherstellen** der letzten 20 Aktionen mit
  Strg+Z bzw. Strg+Y (auch Strg+Umschalt+Z); auch ein eingespieltes
  Delta-Modell und jede geänderte Einstellung lassen sich so zurücknehmen.
- **Inhalt**: wählen, was im Kasten steht (Beschreibung, Domain,
  Business Keys, Quellen, Attribute, Datentypen, Beziehungsnamen).
- **Suchen**: das Feld über den Reitern der Seitenleiste — also aus jedem
  Reiter erreichbar — hebt passende Objekte im Diagramm hervor und blendet den
  Rest ab; rechts daneben steht die Trefferzahl. Gesucht wird in allem, was ein
  Objekt beschreibt: Name, Domain, Business Keys, Quellen, Attributnamen samt
  Verweisziel und Beziehungsnamen — „KundeID" zeigt also auch, wer darauf
  verweist. Datentypen bleiben außen vor, „int" träfe sonst fast jedes Objekt.
- **Stand speichern** (Strg+S) schreibt den ganzen Stand — Modell, Hierarchie,
  Anordnung, Kantenzüge, Einstellungen — in eine **bestehende** HTML-Datei
  zurück, statt jedes Mal eine neue anzulegen. Der Dialog fragt vor jedem
  Speichern, welche Datei es sein soll; beim nächsten Öffnen ist alles wieder
  da. **Voraussetzung:** die Seite muss über `http(s)` geladen sein — den
  Dateizugriff gibt der Browser einer `file://`-Seite nicht (siehe
  [Zum Zurückschreiben: lokal ausliefern](#zum-zurückschreiben-lokal-ausliefern)).
  Fehlt er, wird stattdessen heruntergeladen und die App sagt warum.
- **Laden/Speichern** der drei Dateien (siehe unten) und **Export** als
  SVG oder PNG (Maßstab 1×, 2× oder 4×, etwa für Druck).
- Alles offline, ohne externe Abhängigkeiten. Schriften optional lokal
  einbettbar (`node fonts-einbetten.js <ordner-mit-woff2>`).

## Zum Zurückschreiben: lokal ausliefern

Eine direkt aus dem Dateisystem geöffnete Seite (`file://…`) bekommt vom
Browser keinen Schreibzugriff auf Dateien — die File System Access API
(`showSaveFilePicker`) steht dort nicht zur Verfügung, und es gibt keinen Weg
daran vorbei. „Stand speichern" fällt dann auf einen Download zurück, der eine
neue Datei anlegt.

Soll wirklich dieselbe Datei überschrieben werden, die Datei über einen
lokalen Server öffnen — offline bleibt dabei alles, es wird nichts
nachgeladen:

    npx http-server dist -p 8080     # oder: python -m http.server 8080 -d dist

und dann `http://localhost:8080/geschaeftsobjekt-explorer.html` aufrufen. Dort
schreibt Strg+S nach dem Dateidialog in genau die gewählte Datei.

Ohne Server bleibt der Download; in Chrome lässt er sich über die Einstellung
„Speicherort für jede Datei erfragen" auf die vorhandene Datei lenken, die
dann ersetzt wird. Firefox und Safari kennen die API überhaupt nicht — dort
gilt derselbe Weg.

## Die drei Dateien

Über „Datei & Export → Laden/Speichern" werden drei Dateien einzeln geladen und
gespeichert:

1. **Geschäftsobjekte** – YAML (`models/willibald-attr.yaml`). Über „Delta
   Geschäftsobjekte" lässt sich eine weitere YAML einspielen, die die Objekte
   *ergänzt*. Trägt ein Objekt denselben Namen, entsteht ein **Superset** aus
   beiden Fassungen: Quellen, Business Keys, Attribute und Beziehungen werden
   vereinigt. Dieselbe Sache ist dabei ein Attribut mit gleichem Namen bzw. eine
   Beziehung mit gleichem Ziel *und* gleichem Namen — dort gilt die Fassung des
   Deltas. Unterschiedlich benannte Beziehungen zum selben Ziel bleiben als zwei
   Beziehungen erhalten. Einzelwerte wie Domain und Beschreibung nimmt das
   Delta. So lassen sich zwei Modelle, die dieselben Objekte aus verschiedenen
   Blickwinkeln beschreiben, zusammenführen. Die Objekte selbst lassen sich
   auch **in der App** pflegen (siehe „Pflegen") und über „Speichern" wieder
   als diese YAML ausgeben.
2. **Hierarchiebeschreibung** – YAML (`models/williibald-übersicht.yaml`)
3. **Positionsinformationen** – JSON (Anordnungen, Kantenzüge und
   Diagramm-Bearbeitungen; wird beim Arbeiten automatisch gemerkt)

### 1. Geschäftsobjekt-Modell (YAML)

Beschreibt die Geschäftsobjekte mit ihren Attributen, Quellen und Beziehungen.

```yaml
meta:                       # optional: Herkunft/Lizenz der Daten
  titel: Willibald
  urheber: DDVUG e.V.
  lizenz: CC BY 4.0
  lizenz_url: https://creativecommons.org/licenses/by/4.0/

BusinessObjects:            # Pflichtabschnitt: benannte Geschäftsobjekte
  Bestellung:
    Domain: Willibald                       # fachliche Domäne
    desc: Repräsentiert einen Kundenauftrag …   # Beschreibung
    business_keys:                          # fachliche Schlüssel
    - BestellungID
    source_systems:                         # Quellsysteme/-tabellen
    - Bestellung
    - Bestellung_VRS
    schema.org: https://schema.org/Order    # Zusatzattribut (frei wählbar)
    attributes:
    - name: BestellungID
      type: bigint
      nullable: false
      primary_key: true                     # Primärschlüssel (PK)
    - name: Auftragsnummer
      type: char(10)
      alternate_key: true                   # Alternativschlüssel (AK), nie zugleich PK
    - name: KundeID
      type: char(13)
      foreign_key: true                     # Fremdschlüssel (FK)
      references: Kunde.KundeID              # Verweisziel Objekt.Attribut
    relationships:
    - to: Position                          # Zielobjekt
      name: enthält                         # Beziehungsname (optional)
      cardinality:
        from: exactly_one                   # Kardinalität an der Quelle
        to: zero_or_many                    # … und am Ziel
```

- Nur `BusinessObjects` ist Pflicht, alles andere optional. Der Leser ist
  tolerant: Tabs als Einrückung sind erlaubt, Feldnamen gibt es deutsch wie
  englisch (`Domain`/`domain`, `desc`/`beschreibung`, …), und Beziehungen dürfen
  in mehreren Schreibweisen notiert sein. Mehrzeilige Texte gehen auch als
  Blockskalar (`desc: |-` bzw. `>`).
- **Zusatzattribute:** Jeder weitere Schlüssel mit Einzelwert an einem Objekt
  oder Attribut (Buchstaben, Ziffern, `_ - / .`) wird mitgeführt und lässt
  sich über „Einstellungen → Zusatzattribute …" zur Pflege einschalten.
- **Kardinalitäten:** `exactly_one`, `zero_or_one`, `zero_or_many`,
  `one_or_many`.
- Die App prüft das Modell und meldet Auffälligkeiten (unbekanntes Ziel,
  fehlende Domain, doppelte Beziehung, unbekannte Kardinalität, doppelter
  Attributname, Selbstbezug …) im Reiter „Prüfung". Ein Klick auf den
  Objektnamen im Hinweis springt zum Objekt: auswählen, bei Bedarf einblenden,
  zentrieren.
  Als doppelt gilt eine Beziehung nur, wenn zwischen denselben Objekten eine
  **gleichnamige** noch einmal steht; zwei verschieden benannte Beziehungen
  (auch benannt gegen unbenannt) sind zwei Sachverhalte und in Ordnung.

### 2. Hierarchiebeschreibung (YAML)

Definiert den Baum der redaktionellen Diagramme: welche Objekte ein Diagramm
zeigt, seine Beschreibung und seine Unterdiagramme.

```yaml
Übersicht:                                  # oberstes Diagramm
  beschreibung: "Überblick über das Modell …"   # Text (leichtes Markdown)
  objekte:                                  # gezeigte Objekte (Namen wie im Modell)
    - Kunde
    - Bestellung
  Details:                                  # Unterdiagramme, rekursiv gleich aufgebaut
    webshop:
      beschreibung: "Bestellprozess im Webshop"
      objekte:
        - Bestellung
        - Position
      Details:
        Produkt:
          objekte:
            - Produkt
            - Kategorie
```

- Jeder Knoten ist ein Diagramm mit `beschreibung` (optional), `objekte` (Liste
  von Objektnamen aus dem Modell) und optional `Details` (untergeordnete
  Diagramme). Übliche Tiefe: Übersicht → Domänen → Spezialthemen, frei wählbar.
- Objektnamen, die es im Modell nicht gibt, werden ignoriert und als Hinweis
  gemeldet.
- Struktur, Objektmengen und Texte lassen sich auch **in der App** bearbeiten
  und über „Speichern" wieder als diese YAML ausgeben.

## Beispieldaten

Die Beispieldaten sind mit den Willibald-Daten der DDVUG e.V. entstanden. Diese
Daten stehen unter www.dwa-compare.info und unter der Creative-Commons-Lizenz
CC BY 4.0 zur Verfügung.

## Entwicklung

Die App wird aus `src/` mit `node build.js` zu
`dist/geschaeftsobjekt-explorer.html` zusammengebaut — kein Bündler, keine
Abhängigkeiten. Zu Tests und Absicherung siehe [TESTS.md](TESTS.md).

Projektstruktur:

    src/        Quellen: index.html (Gerüst), style.css/svg.css und die
                JS-Module (yaml, model, layout, render, app, route, edit,
                interaktion, hierarchie, pflege, ui)
    build.js    fügt src/ + models/ zur einzelnen dist-Datei zusammen
    dist/       geschaeftsobjekt-explorer.html (die Datei zum Weitergeben)
    models/     Beispiel-YAML (Geschäftsobjekte + Hierarchie)
    test/       Rauch-/Modell-/Layout-/Outline-Tests (nur Node, ohne Abhängigkeiten)
    hooks/      pre-commit (baut, testet, warnt bei Code ohne Test);
                aktiv über: git config core.hooksPath hooks
    fonts-einbetten.js   Schriften optional lokal einbetten
