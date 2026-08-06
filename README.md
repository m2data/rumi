# rumi — Geschäftsobjekt-Explorer

Ein Werkzeug, das ein Unternehmensdatenmodell anzeigt: welche Geschäftsobjekte
es gibt, wie sie zusammenhängen, aus welchen Quellen sie stammen und mit welchen
Attributen sie beschrieben sind. Die Anwendung ist eine einzelne HTML-Datei,
läuft offline und lädt nichts nach.

## Was das Tool kann

- **Komplettansicht** mit drei Ansichten:
  - Ansicht 1 – Geschäftsobjektmodell
  - Ansicht 2 – Geschäftsobjektquellen
  - Ansicht 3 – Quellenbezogene Sicht
- **Hierarchie** – redaktionell gestaltete Diagramme: ein Baum aus Diagrammen
  (Übersicht → Domänen → Themen), jedes zeigt nur einen Ausschnitt der Objekte
  und hat einen Beschreibungstext (leichtes Markdown). Diagramme sind frei
  anordenbar; verknüpfte Objekte lassen sich zu einer Auswahl hinzuholen. Im Baum
  lassen sich Diagramme per Ziehen umsortieren und umhängen (obere/untere Kante =
  davor/danach, Mitte = als Unterdiagramm).
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
  **Rückgängig/Wiederherstellen** der letzten 10 Aktionen mit
  Strg+Z bzw. Strg+Y (auch Strg+Umschalt+Z).
- **Inhalt**: je Ansicht wählen, was im Kasten steht (Beschreibung, Domain,
  Business Keys, Quellen, Attribute, Datentypen, Beziehungsnamen).
- **Suchen**: das Feld über den Reitern der Seitenleiste — also aus jedem
  Reiter erreichbar — hebt passende Objekte im Diagramm hervor und blendet den
  Rest ab; rechts daneben steht die Trefferzahl. Gesucht wird in allem, was ein
  Objekt beschreibt: Name, Domain, Business Keys, Quellen, Attributnamen samt
  Verweisziel und Beziehungsnamen — „KundeID" zeigt also auch, wer darauf
  verweist. Datentypen bleiben außen vor, „int" träfe sonst fast jedes Objekt.
- **Laden/Speichern** der drei Dateien (siehe unten) und **Export** als
  eigenständige HTML, SVG oder PNG (Maßstab 1×, 2× oder 4×, etwa für Druck).
- Alles offline, ohne externe Abhängigkeiten. Schriften optional lokal
  einbettbar (`node fonts-einbetten.js <ordner-mit-woff2>`).

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
   Blickwinkeln beschreiben, zusammenführen.
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
    sources:                                # Quellsysteme/-tabellen
    - Bestellung
    - Bestellung_VRS
    attributes:
    - name: BestellungID
      type: bigint
      nullable: false
      primary_key: true                     # Primärschlüssel (PK)
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
- **Kardinalitäten:** `exactly_one`, `zero_or_one`, `zero_or_many`,
  `one_or_many`, `many`.
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
                interaktion, hierarchie, ui)
    build.js    fügt src/ + models/ zur einzelnen dist-Datei zusammen
    dist/       geschaeftsobjekt-explorer.html (die Datei zum Weitergeben)
    models/     Beispiel-YAML (Geschäftsobjekte + Hierarchie)
    test/       Rauch-/Modell-/Layout-/Outline-Tests (nur Node, ohne Abhängigkeiten)
    hooks/      pre-commit (baut, testet, warnt bei Code ohne Test);
                aktiv über: git config core.hooksPath hooks
    fonts-einbetten.js   Schriften optional lokal einbetten
