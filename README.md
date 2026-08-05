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
  anordenbar; verknüpfte Objekte lassen sich zu einer Auswahl hinzuholen.
- **Anordnen**: hierarchisch, orthogonal, organisch, kreisförmig; Kanten von
  Hand umlenken, Anschlusspunkte und Selbstbezüge verschieben. Ist ein Bereich
  markiert (mindestens zwei Objekte), wirkt das gewählte Verfahren nur auf ihn —
  so lässt sich für einen Teil ein anderes Auto-Layout verwenden, der übrige
  Plan bleibt liegen.
- **Auswählen**: Umschalt+Ziehen wählt einen Rahmen, Strg+Klick einzelne Objekte
  dazu oder weg. **Rückgängig/Wiederherstellen** der letzten 10 Aktionen mit
  Strg+Z bzw. Strg+Y (auch Strg+Umschalt+Z).
- **Inhalt**: je Ansicht wählen, was im Kasten steht (Beschreibung, Domain,
  Business Keys, Quellen, Attribute, Datentypen, Beziehungsnamen).
- **Laden/Speichern** der drei Dateien (siehe unten) und **Export** als
  eigenständige HTML, SVG oder PNG.
- Alles offline, ohne externe Abhängigkeiten. Schriften optional lokal
  einbettbar (`node fonts-einbetten.js <ordner-mit-woff2>`).

## Die drei Dateien

Über „Datei & Export → Laden/Speichern" werden drei Dateien einzeln geladen und
gespeichert:

1. **Geschäftsobjekte** – YAML (`models/willibald-attr.yaml`)
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
  in mehreren Schreibweisen notiert sein.
- **Kardinalitäten:** `exactly_one`, `zero_or_one`, `zero_or_many`,
  `one_or_many`, `many`.
- Die App prüft das Modell und meldet Auffälligkeiten (unbekanntes Ziel,
  fehlende Domain, doppelte Beziehung, Selbstbezug …) im Reiter „Prüfung".

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
                hierarchie, ui)
    build.js    fügt src/ + models/ zur einzelnen dist-Datei zusammen
    dist/       geschaeftsobjekt-explorer.html (die Datei zum Weitergeben)
    models/     Beispiel-YAML (Geschäftsobjekte + Hierarchie)
    test/       Rauch-/Modell-/Layout-/Outline-Tests (nur Node, ohne Abhängigkeiten)
    hooks/      pre-commit (baut, testet, warnt bei Code ohne Test);
                aktiv über: git config core.hooksPath hooks
    fonts-einbetten.js   Schriften optional lokal einbetten
