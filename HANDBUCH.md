# Benutzerhandbuch — Geschäftsobjekt-Explorer

Diese Anleitung beschreibt die Bedienung des Werkzeugs. Was es überhaupt ist
und wozu es dient, steht in der [README.md](README.md); zum Aufbau der drei
Dateien siehe den [Anhang](#anhang-die-dateien) am Ende.

**Inhalt**

- [1. Loslegen](#1-loslegen)
- [2. Der Bildschirm](#2-der-bildschirm)
- [3. Quelle und Domäne als eigene Elemente](#3-quelle-und-domäne-als-eigene-elemente)
- [4. Objekte finden und lesen](#4-objekte-finden-und-lesen)
- [5. Suchen](#5-suchen)
- [6. Im Diagramm bewegen](#6-im-diagramm-bewegen)
- [7. Auswählen, verschieben, ausrichten](#7-auswählen-verschieben-ausrichten)
- [8. Anordnen](#8-anordnen)
- [9. Kanten von Hand](#9-kanten-von-hand)
- [10. Was im Kasten steht](#10-was-im-kasten-steht)
- [11. Hierarchie: redaktionelle Diagramme](#11-hierarchie-redaktionelle-diagramme)
- [12. Prüfung](#12-prüfung)
- [13. Geschäftsobjekte bearbeiten](#13-geschäftsobjekte-bearbeiten)
- [14. Laden, Speichern, Weitergeben](#14-laden-speichern-weitergeben)
- [15. Tastenkürzel](#15-tastenkürzel)
- [16. Wenn etwas klemmt](#16-wenn-etwas-klemmt)
- [Anhang: die Dateien](#anhang-die-dateien)

---

## 1. Loslegen

Die Anwendung ist **eine einzige HTML-Datei**:
`dist/geschaeftsobjekt-explorer.html`. Sie wird im Browser geöffnet — per
Doppelklick oder Ziehen ins Browserfenster. Es wird nichts installiert, nichts
nachgeladen und nichts an Dritte übertragen; die Datei läuft ohne Netz.

Beim ersten Start ist ein **Beispielmodell** eingebaut (Willibald). Ein eigenes
Modell kommt auf zwei Wegen hinein:

- **YAML-Datei auf die Zeichenfläche ziehen** — es erscheint „YAML-Datei hier
  ablegen", und das Modell wird sofort gezeichnet.
- **„Datei & Export → Geschäftsobjekte (YAML) …"** in der Kopfzeile.

Der Arbeitsstand — Anordnung, Kantenzüge, ausgeblendete Objekte, Einstellungen
— wird **im Browser gemerkt** und beim nächsten Öffnen wiederhergestellt. Jeder
Tab behält dabei sein eigenes Modell. Verlassen kann man sich darauf nicht
dauerhaft: Wer einen Stand aufheben oder weitergeben will, speichert ihn über
„Datei & Export" (Kapitel 14).

## 2. Der Bildschirm

**Kopfzeile**, von links nach rechts:

| Bereich | Bedeutung |
| --- | --- |
| Titel und Dateiname | welches Modell gerade geladen ist |
| **Komplettansicht \| Hierarchie** | die beiden Arbeitsweisen (Kapitel 3 bzw. 11) |
| **Anordnen ▾** | Verfahren, Richtung, Kanten neu ziehen (Kapitel 8) |
| **Inhalt ▾** | was in den Kästen steht (Kapitel 10) |
| **Einpassen** | alles ins Bild rücken (Taste `F`) |
| **Einstellungen** | Quelle und Domäne als eigene Elemente (Kapitel 3), Bearbeiten ein- und ausschalten, Zusatzattribute wählen (Kapitel 13) |
| **Datei & Export** | Laden, Speichern, Export (Kapitel 14) |

**Seitenleiste** links: oben das **Suchfeld** — es steht bewusst *über* den
Reitern, weil es aufs Diagramm wirkt und aus jedem Reiter erreichbar sein soll.
Darunter die Reiter:

- **Beschreibung** — nur im Hierarchie-Modus: der Text zum gewählten Diagramm.
- **Objekte** — die Liste aller Objekte, nach Domänen gruppiert, mit Häkchen
  für „im Diagramm zeigen". Ganz unten die **Notation** (welches Kantenende
  welche Kardinalität bedeutet).
- **Details** — alles zum gewählten Objekt.
- **Prüfung** — Auffälligkeiten im Modell, mit Zähler am Reiter (nur in der
  Komplettansicht).

**Zeichenfläche** rechts: das Diagramm auf einem Raster. Unten rechts die
Zoomanzeige mit `−` und `+`, unten mittig die **Ausrichten-Leiste** (erscheint,
sobald mindestens zwei Objekte markiert sind) und darunter eine Zeile mit den
wichtigsten Kürzeln. Kurze Rückmeldungen („12 Objekte geladen", „Kante
gewählt") blendet das Werkzeug unten links ein.

## 3. Quelle und Domäne als eigene Elemente

Die Komplettansicht zeigt das ganze Modell: die Objekte und ihre fachlichen
Beziehungen. Die Kästen tragen ab Werk nur den Objektnamen; Domain, Business
Keys, Quellen, Attribute und Beschreibung lassen sich über „Inhalt" dazunehmen
(Kapitel 10).

Unter **Einstellungen → Als eigenes Element** lassen sich zwei Angaben aus dem
Kasten herausnehmen und als **eigener Kasten** daneben stellen:

- **Quellen** — jede Quelle eines Objekts wird ein eigener Kasten, verbunden
  über eine Linie mit der Beschriftung „quelle".
- **Domäne** — die Domäne eines Objekts wird ein eigener Kasten, verbunden über
  eine Linie mit der Beschriftung „Domäne".

Beide Haken sind unabhängig und gelten in der Komplettansicht **und** in der
Hierarchie. Jedes Objekt bekommt seine **eigenen** Kästen, auch wenn mehrere
Objekte dieselbe Quelle oder Domäne haben. So läuft keine Linie quer durchs
Diagramm zu einem gemeinsamen Knoten. Die Linien tragen keine Kardinalität,
denn eine Zuordnung ist keine fachliche Beziehung. Ist ein Element
eingeschaltet, ist der passende Punkt im Inhalt-Menü gesperrt.

Die Kästen stehen **neben ihrem Objekt**. Bei einer Anordnung nach unten oder
oben (und bei „Organisch") stehen sie rechts davon, bei einer Anordnung nach
links oder rechts darunter. Bei „Kreisförmig" stehen sie **außerhalb des
Kreises**, als Reihe hinter ihrem Objekt. Schaltet man ein Element ohne
Neuanordnung ein, kommen die neuen Kästen rechts neben ihr Objekt. Die übrigen
Kästen bleiben liegen.

Wird ein Objekt **verschoben** — mit der Maus, den Pfeiltasten, über die
Ausrichten-Leiste oder durch Anordnen eines markierten Bereichs —, wandern
seine Kästen mit. Ein Kasten lässt sich auch allein greifen und an eine andere
Stelle ziehen; sein Objekt bleibt dabei liegen. Wird ein Objekt ausgeblendet,
verschwinden seine Kästen mit; einzeln aus- und einblenden lassen sie sich
nicht.

## 4. Objekte finden und lesen

### Die Objektliste

Der Reiter **Objekte** listet alle Objekte des Modells, gruppiert nach ihrer
**Domain** (Objekte ohne Domain unter „Ohne Domain"). Zu jedem Eintrag steht
rechts eine Kurzbilanz: `3 BK · 12 A · 4 B` — Business Keys, Attribute,
Beziehungen. Quellen- und Domänenkästen (Kapitel 3) stehen nicht in der Liste,
sie gehören zu ihrem Objekt.

- **Klick auf den Namen** wählt das Objekt aus, zentriert es und schaltet auf
  den Reiter „Details". Strg- oder Umschalt-Klick nimmt es zur Auswahl hinzu
  oder wieder heraus.
- **Häkchen** schaltet ein Objekt im Diagramm ein und aus.
- **Klick auf den Gruppennamen** klappt eine Domäne zu; **alle** / **keine**
  daneben blenden die ganze Gruppe ein oder aus, oben `Anzeigen: alle | keine`
  das ganze Modell. Der Zähler zeigt `sichtbar / gesamt`.

Ausgeblendete Objekte sind nicht gelöscht: sie behalten ihre Lage und kommen
über das Häkchen unverändert zurück.

### Der Reiter „Details"

Zu einem gewählten Geschäftsobjekt stehen dort Name, Domain, Beschreibung,
Business Keys, Quellen, die Attribute (mit Typ, `?` für nullable und den
Marken `PK`/`FK`, darunter gegebenenfalls das Verweisziel `→ Kunde.KundeID`)
sowie die **ausgehenden und eingehenden Beziehungen** mit Name und
Kardinalitäten.

In jeder Beziehungszeile führen zwei Schaltflächen weiter:

- der **Objektname** springt zum Objekt am anderen Ende,
- **Kante** wählt genau diese Verbindung im Diagramm aus und rückt sie in die
  Mitte — praktisch, wenn man die Linie im Gewirr nicht trifft.

**„Verknüpfte Objekte ins Diagramm holen"** blendet alle über Beziehungen
verbundenen Objekte ein und legt sie um das gewählte herum: Nachbarn, zu denen
„eins" führt, an den Anfang der Flussrichtung, „viele"-Nachbarn ans Ende.
Bereits sichtbare Objekte bleiben, wo sie sind. So baut man sich Schritt für
Schritt einen Ausschnitt auf, statt mit allen Objekten anzufangen.

Ist ein **Quellenkasten** gewählt, zeigt der Reiter, welche Objekte die
Quelle versorgt; bei einem **Domänenkasten** alle Objekte der Domäne. Sind **mehrere Objekte** gewählt, zeigt er die Liste der Auswahl.

### Umgebung hervorheben

Ist **genau ein** Objekt gewählt, hebt das Diagramm dieses Objekt samt seinen
direkten Nachbarn hervor und blendet alles Übrige ab. Bei einer gewählten
**Kante** bleiben nur deren beide Enden hell. Eine Mehrfachauswahl tut das
nicht — sie dient dem Ordnen, nicht dem Erkunden.

## 5. Suchen

Das Feld über den Reitern hebt passende Objekte hervor und blendet den Rest ab;
rechts daneben steht die Trefferzahl (`4/37`).

Gesucht wird in allem, was ein Objekt beschreibt: **Objektname, Domain,
Business Keys, Quellen, Attributnamen samt Verweisziel und Beziehungsnamen**.
„KundeID" zeigt also auch, wer darauf verweist. Ein Quellen- oder
Domänenkasten wird zusätzlich über sein Objekt gefunden.

**Datentypen bleiben außen vor** — „int" träfe sonst fast jedes Objekt.

Das Feld leeren stellt die normale Darstellung wieder her. Solange der Cursor
im Feld steht, gelten die Tastenkürzel nicht (man tippt ja Text); `Esc`
verlässt das Feld.

## 6. Im Diagramm bewegen

| Aktion | Bedienung |
| --- | --- |
| Schwenken | auf den Hintergrund fassen und ziehen |
| Zoomen | Mausrad, oder `−` / `+` unten rechts (15 % bis 300 %) |
| Alles ins Bild | Schaltfläche **Einpassen** oder Taste `F` |

## 7. Auswählen, verschieben, ausrichten

**Auswählen**

| Aktion | Bedienung |
| --- | --- |
| Ein Objekt | anklicken (nochmals klicken hebt die Auswahl auf) |
| Einzeln dazu/weg | Strg+Klick (auch Umschalt+Klick) |
| Bereich | **Umschalt+Ziehen** zieht einen Rahmen auf |
| Alles Sichtbare | Strg+A |
| Auswahl aufheben | `Esc` oder Klick auf den Hintergrund |

**Verschieben**

Ein markiertes Objekt ziehen bewegt die **ganze Auswahl**. Dabei gilt: Kanten
*innerhalb* der Auswahl wandern starr mit — ihre Knicke bleiben also erhalten.
Kanten, die die Auswahlgrenze überschreiten, werden gelöst und neu gezogen;
von Hand bearbeitete Kanten bleiben unangetastet.

Die **Pfeiltasten** verschieben die Auswahl fein (4 Punkte), mit **Umschalt**
um ein Rasterfeld (24 Punkte). **Entf** blendet die Auswahl aus.

**Ausrichten und verteilen**

Sobald mindestens zwei Objekte markiert sind, erscheint unten die
Ausrichten-Leiste: linksbündig, horizontal zentriert, rechtsbündig; oben,
vertikal zentriert, unten; waagrecht bzw. senkrecht gleichmäßig verteilen (ab
drei Objekten). Danach werden die betroffenen Kanten neu gezogen — außer den
von Hand bearbeiteten.

**Rückgängig**

Strg+Z nimmt die letzte Aktion zurück, Strg+Y (oder Strg+Umschalt+Z) stellt sie
wieder her; bis zu 20 Schritte. Das gilt für alles am Modell: Anordnen,
Ausblenden, Kanten umlenken, Bearbeiten — sogar ein eingespieltes Delta lässt
sich so wieder herausnehmen. Auch jede **Einstellung** ist ein Schritt im
Verlauf: Quelle/Domäne als eigene Elemente, „Geschäftsobjekte bearbeiten" und
die Auswahl der Zusatzattribute.

## 8. Anordnen

Das Menü **Anordnen ▾** hat drei Abschnitte.

**Verfahren** — die Wahl ordnet sofort neu an:

- **Hierarchisch** — Ebenen entlang der Flussrichtung; der Normalfall für
  Datenmodelle.
- **Orthogonal** — wie hierarchisch, aber mit rechtwinkligen Kantenzügen.
- **Organisch** — kräftebasiert, ohne feste Richtung.
- **Kreisförmig** — die Objekte auf einem Kreis, auch unverbundene.

**Richtung** — `↓ ↑ → ←` (oben nach unten, unten nach oben, links nach rechts,
rechts nach links). Sie gilt nur für die beiden hierarchischen Verfahren und
ist sonst ausgegraut; wählt man dort eine Richtung, schaltet das Werkzeug auf
„Hierarchisch".

**Kanten**

- **Kanten neu ziehen** — alle Kantenzüge verwerfen und automatisch neu legen.
  Ist ein Bereich markiert, betrifft das nur dessen Kanten.
- **Nur die gewählte Kante** — zieht die eine, gerade ausgewählte Kante neu
  (sonst nicht anwählbar).

> **Teilbereich anders anordnen.** Sind **mindestens zwei** Objekte markiert,
> wirkt das gewählte Verfahren **nur auf diese Auswahl** — der übrige Plan
> bleibt liegen, und die Auswahl behält ihre Mitte. So bekommt zum Beispiel
> eine Objektgruppe eine kreisförmige Anordnung, während der Rest hierarchisch
> bleibt.

Überlappende Beziehungsbeschriftungen werden dabei automatisch entzerrt — beim
Auto-Layout, beim Anordnen einer Auswahl, beim Neuziehen von Kanten und nach
dem Verschieben. Von Hand platzierte Beschriftungen bleiben stehen.

## 9. Kanten von Hand

Ein **Klick auf eine Kante** wählt sie aus; erst dann erscheinen ihre Griffe.
(Trifft man die Linie nicht, hilft die Schaltfläche „Kante" im Reiter Details.)

| Griff | Wirkung |
| --- | --- |
| **Stützpunkt** (Punkt auf der Linie) | ziehen verschiebt den Knick; er rastet sanft auf die Nachbarpunkte ein |
| **Zusatzpunkt** (kleiner Griff in der Segmentmitte) | anfassen fügt einen neuen Knick ein und zieht ihn gleich mit |
| **Teilstück** einer rechtwinkligen Kante | quer verschieben — die Stufe wandert, die Ecken bleiben rechtwinklig |
| **Anschlusspunkt** am Kastenrand | ziehen legt fest, wo die Kante am Kasten ansetzt |
| **Scheitel** eines Selbstbezugs | verschiebt die Schleife |
| **Beschriftung** | frei entlang der Kante ziehen |

- **Alt+Klick** auf einen Stützpunkt entfernt ihn.
- **Doppelklick auf die Kante** (zweimal binnen einer knappen Sekunde) löscht
  *alle* Stützpunkte und Anschlusspunkte und stellt die kürzeste Verbindung
  her.
- Eine von Hand angefasste Kante gilt als **manuell**: sie wird beim
  Verschieben der Kästen und beim Ausrichten nicht mehr automatisch neu
  gezogen. Über „Anordnen → Kanten neu ziehen" gibt man sie wieder frei.
- Eine von Hand verschobene **Beschriftung** bleibt beim automatischen
  Entzerren, wo sie ist.

> **Sieht eine Kante falsch aus?** Erst die Kästen ordentlich legen, dann
> „Kanten neu ziehen", und erst zuletzt einzelne Züge von Hand korrigieren.

## 10. Was im Kasten steht

Das Menü **Inhalt ▾** bestimmt, welche Bestandteile eines Objekts im Kasten
erscheinen. Die Auswahl gilt für die Komplettansicht und die Hierarchie
gleichermaßen:

- Beschreibung
- Domain *(gesperrt, solange die Domäne als eigenes Element steht)*
- Business Keys
- Quellen *(gesperrt, solange die Quellen als eigene Elemente stehen)*
- Attribute
  - nur Schlüsselattribute *(zeigt nur PK und FK)*
  - Datentypen zeigen
- **Beschriftung: Beziehungsnamen** — die Namen an den Kanten ein- und
  ausblenden

Nach einer Änderung werden die Kästen neu vermessen; die Lagen bleiben, aber
die Größen ändern sich. Bei größeren Umstellungen lohnt danach ein „Anordnen"
oder wenigstens „Kanten neu ziehen".

## 11. Hierarchie: redaktionelle Diagramme

Die Komplettansicht zeigt *alles*. Der Modus **Hierarchie** zeigt **erzählte
Ausschnitte**: einen Baum aus Diagrammen — üblich ist Übersicht → Domänen →
Spezialthemen —, jedes mit eigener Objektauswahl, eigener Anordnung und einem
erklärenden Text.

**Baum links.** Jede Zeile ist ein Diagramm; die Zahl rechts nennt die Anzahl
seiner Objekte. `▸`/`▾` klappt Unterdiagramme auf und zu, ein Klick wählt das
Diagramm und zeichnet es.

**Beschreibung.** Der Reiter „Beschreibung" zeigt den Text zum gewählten
Diagramm. „Bearbeiten" öffnet ein Textfeld, „Speichern" übernimmt. Erlaubt ist
leichtes Markdown: `# Überschrift` (bis `###`), `**fett**`, `*kursiv*`,
`` `code` ``, Aufzählungen mit `-` oder `1.`, Zitate mit `>`, Links als
`[Text](https://…)`.

**Struktur ändern** — die Leiste über dem Baum:

| Schaltfläche | Wirkung |
| --- | --- |
| **＋ Unterdiagramm** | ein Diagramm unter dem gewählten anlegen |
| **＋ Domäne** | ein neues Diagramm auf oberster Ebene |
| **Umbenennen** | das gewählte Diagramm umbenennen |
| **Löschen** | das gewählte Diagramm samt Unterdiagrammen entfernen |

**Umhängen per Ziehen:** ein Diagramm im Baum aufnehmen und über einem anderen
fallen lassen — an dessen **oberer Kante** wird es davor eingeordnet, an der
**unteren** danach, in der **Mitte** wird es zum Unterdiagramm. In sich selbst
lässt sich ein Diagramm nicht verschieben. Gespeicherte Anordnungen und Texte
wandern mit.

**Objekte je Diagramm.** Der Reiter „Objekte" zeigt auch hier das ganze Modell;
angehakt sind die Objekte, die *dieses* Diagramm zeigt. Häkchen setzen holt ein
Objekt hinzu, Häkchen entfernen nimmt es aus dem Diagramm (nicht aus dem
Modell). Neu hinzugekommene Kästen werden unter die schon platzierten gesetzt,
damit die bestehende Anordnung liegen bleibt. Auch „Verknüpfte Objekte ins
Diagramm holen" (Reiter Details) arbeitet hier je Diagramm.

Anordnen, Kanten umlenken und die Suche funktionieren wie in der
Komplettansicht. Das Inhalt-Menü und die Elemente aus Kapitel 3 gelten hier
genauso; Quellen- und Domänenkästen erscheinen nur an den Objekten, die das
Diagramm zeigt.

## 12. Prüfung

Beim Laden prüft das Werkzeug das Modell und sammelt Auffälligkeiten im Reiter
**Prüfung**. Der Zähler am Reiter nennt die Gesamtzahl und ist grau, solange
nur Infos dabei sind.

Es gibt drei Stufen: **Fehler** (etwas wird nicht gezeichnet, z. B. ein
unbekanntes Beziehungsziel), **Hinweis** (fehlende Domain, kein Business Key,
keine Quelle, doppelte Beziehung, unbekannte Kardinalität, doppelter
Attributname …) und **Info** (Selbstbezug, freistehendes Objekt, mehrfach
genutzte Quelle, unbenannte Beziehungen).

Gleichartige Meldungen sind zu einer aufklappbaren Gruppe zusammengefasst
(`12×`). Ein **Klick auf den Objektnamen** in einer Meldung springt zum Objekt:
es wird ausgewählt, bei Bedarf eingeblendet und zentriert — die Liste bleibt
dabei stehen, damit man Hinweise der Reihe nach abarbeiten kann.

## 13. Geschäftsobjekte bearbeiten

Ab Werk ist das Werkzeug ein **Betrachter**: Fachdaten lassen sich nicht
verstellen. Das Bearbeiten wird im Menü **Einstellungen** über den Punkt
**„Geschäftsobjekte bearbeiten"** eingeschaltet (Haken). Danach erscheinen
„Bearbeiten" im Reiter Details und „＋ Objekt" über der Objektliste.

Der Schalter wird gemerkt und wandert in den HTML-Export und in die
Positionsinformationen mit — so gibt man einen Stand zum Ansehen weiter, an dem
sich nichts verstellen lässt. Anordnen, Kanten umlenken und die Hierarchie
bleiben davon unberührt.

**Das Formular** (Details → Bearbeiten) umfasst Name, Domain, Beschreibung,
Business Keys und Quellen (jeweils durch Komma getrennt), die **Attribute**
(Name, Typ, `PK` / `FK` / `null`, Verweisziel in der Form `Objekt.Attribut`;
`×` entfernt eine Zeile, „＋ Attribut" hängt eine an) und die **ausgehenden
Beziehungen** (Ziel aus der Liste, Name, Kardinalität an Quelle und Ziel).
„Speichern" übernimmt, „Abbrechen" verwirft. Gespeichert wird nur, was
vollständig ist: jedes Attribut braucht einen Namen, jede Beziehung ein Ziel,
und der Objektname darf nicht doppelt vorkommen.

**Anlegen und Löschen.** „＋ Objekt" über der Liste fragt nach einem Namen und
öffnet das Formular gleich. „Objekt löschen …" unten im Formular nimmt das
Objekt heraus — samt der Beziehungen, die auf es zeigen; die Nachfrage nennt
deren Anzahl.

**Umbenennen zieht mit:** `to:` und `references:` in allen anderen Objekten,
die gespeicherte Anordnung, die Kantenzüge und die Hierarchiebeschreibung.

Geschrieben wird **in die vorhandene YAML hinein**: geändert wird nur die
bearbeitete Stelle. Kommentare, Reihenfolge, Einrückung und Schreibvarianten
des Übrigen bleiben stehen. Jede Bearbeitung ist eine Aktion im Verlauf —
Strg+Z nimmt sie zurück.

**Zusatzattribute.** Jeder Schlüssel in der YAML, den die App nicht selbst
auswertet — etwa `schema.org:` an einem Objekt oder an einem Attribut —, gilt
als Zusatzattribut. Feldnamen dürfen Buchstaben, Ziffern und `_ - / .`
enthalten. **Einstellungen → „Zusatzattribute …"** listet, was das geladene
Modell mitbringt, getrennt nach Geschäftsobjekten und Attributen und mit der
Zahl der Vorkommen. Eingeschaltete Felder erscheinen im Formular (am Objekt
unter „Quellen", am Attribut als weitere Zeile) und lesend in den Details.
Ausgeschaltete bleiben in der Datei unberührt stehen, auch wenn das Attribut
daneben geändert wird. Ein geleertes Feld bleibt als Platzhalter (`schema.org:`)
stehen, wenn es schon in der Datei stand. Angeboten werden nur Einzelwerte;
Listen und Abbildungen bleiben unangetastet. Die Auswahl wird wie der
Bearbeiten-Schalter gemerkt und mitgegeben; Strg+Z nimmt sie zurück.

## 14. Laden, Speichern, Weitergeben

Alles über **Datei & Export**.

**Laden**

| Punkt | Wirkung |
| --- | --- |
| Geschäftsobjekte (YAML) … | ersetzt das Modell (auch per Ziehen auf die Fläche) |
| Delta Geschäftsobjekte (YAML) … | **ergänzt** das Modell (siehe unten) |
| Hierarchiebeschreibung (YAML) … | ersetzt den Diagrammbaum |
| Positionsinformationen (JSON) … | übernimmt Anordnungen, Kantenzüge und Einstellungen |

**Ein Delta einspielen** vereinigt zwei Modelle: gleichnamige Objekte werden zu
einem **Superset** aus beiden Fassungen. Näheres im [Anhang A](#delta-zwei-modelle-vereinigen).
Das Einspielen ist eine ganz normale Aktion — Strg+Z nimmt es wieder heraus.

**Speichern** — die drei Dateien einzeln:

| Punkt | Ergebnis |
| --- | --- |
| Geschäftsobjekte (YAML) | das Modell, mit allen Bearbeitungen |
| Hierarchiebeschreibung (YAML) | der Diagrammbaum, `…-hierarchie.yaml` |
| Positionsinformationen (JSON) | Anordnungen, Kantenzüge, Einstellungen |

**Diagramm exportieren**

- **Stand als HTML sichern** — eine eigenständige HTML-Datei, die das Modell,
  die Anordnung, die Hierarchie und die Einstellungen mitbringt. Sie ist wieder
  die volle Anwendung, nur mit diesem Stand als Startpunkt: das Format zum
  Weitergeben.
- **Diagramm als SVG** — das aktuelle Diagramm als Vektorgrafik.
- **Diagramm als PNG** — mit Maßstab **1×** (Bildschirmgröße), **2×**
  (Standard) oder **4×** (etwa für Druck).

## 15. Tastenkürzel

| Taste | Wirkung |
| --- | --- |
| `F` | Einpassen |
| Strg+A | alle sichtbaren Objekte wählen |
| Pfeiltasten | Auswahl fein verschieben |
| Umschalt+Pfeiltasten | Auswahl um ein Rasterfeld verschieben |
| `Entf` | Auswahl ausblenden |
| Strg+Z | rückgängig |
| Strg+Y, Strg+Umschalt+Z | wiederherstellen |
| `Esc` | Dialog schließen, Kante abwählen, Auswahl aufheben, Menüs zu |
| Umschalt+Ziehen | Auswahlrahmen |
| Strg+Klick | einzeln zur Auswahl hinzu oder weg |
| Alt+Klick auf Stützpunkt | Stützpunkt löschen |
| Doppelklick auf Kante | Stützpunkte löschen, kürzeste Verbindung |
| Mausrad | zoomen |

In Eingabefeldern (Suche, Beschreibung, Formular) gelten die Kürzel nicht;
`Esc` verlässt das Feld.

## 16. Wenn etwas klemmt

**„Speichern im Browser fehlgeschlagen (Speicher voll?)"** — bei großen
Modellen läuft der Browserspeicher über. Den Stand über „Datei & Export →
Positionsinformationen (JSON)" sichern und bei Bedarf wieder laden.

**„… kommt in dieser Ansicht nicht vor"** — der Sprung aus der Prüfliste
zielt auf ein Objekt, das es im Diagramm nicht gibt.

**Objekte sind verschwunden.** Vermutlich mit `Entf` ausgeblendet: im Reiter
Objekte das Häkchen wieder setzen oder `Anzeigen: alle` wählen. Strg+Z geht
auch.

**Kanten springen beim Verschieben.** Das ist gewollt: Kanten über die
Auswahlgrenze werden neu gezogen. Wer einen Zug behalten will, fasst ihn einmal
von Hand an (Kapitel 9) — dann bleibt er.

**Mehrere Tabs zeigen verschiedene Modelle.** Ebenfalls gewollt: jeder Tab
behält beim Neuladen sein eigenes Modell. Ein neuer Tab startet mit dem zuletzt
gespeicherten Stand.

**Das Bild ist leer.** „Einpassen" (`F`) holt alles zurück ins Sichtfeld.

**Nach dem Neubauen der Anwendung sieht man den alten Stand.** Die Seite im
Browser **neu laden** — sonst läuft weiter die zuvor geladene Fassung.

---

# Anhang: die Dateien

Ein vollständiger Arbeitsstand besteht aus drei Dateien, die einzeln geladen
und gespeichert werden. Nur die erste ist Pflicht.

## Anhang A — Geschäftsobjekte (YAML)

Das Modell: welche Geschäftsobjekte es gibt, wie sie beschrieben sind und wie
sie zusammenhängen.

```yaml
meta:                       # optional: Herkunft und Lizenz der Daten
  titel: Willibald
  urheber: DDVUG e.V.
  lizenz: CC BY 4.0
  lizenz_url: https://creativecommons.org/licenses/by/4.0/

BusinessObjects:            # Pflichtabschnitt
  Bestellung:
    Domain: Willibald                          # fachliche Domäne
    desc: Repräsentiert einen Kundenauftrag.   # Beschreibung
    business_keys:                             # fachliche Schlüssel
    - BestellungID
    sources:                                   # Quellsysteme/-tabellen
    - Bestellung
    - Bestellung_VRS
    attributes:
    - name: BestellungID
      type: bigint
      nullable: false
      primary_key: true                        # PK
    - name: KundeID
      type: char(13)
      foreign_key: true                        # FK
      references: Kunde.KundeID                # Verweisziel: Objekt.Attribut
    relationships:
    - to: Position                             # Zielobjekt (Pflicht)
      name: enthält                            # Beziehungsname (optional)
      cardinality:
        from: exactly_one                      # Kardinalität an der Quelle
        to: zero_or_many                       # … und am Ziel
```

### Felder

| Ebene | Feld | Bedeutung |
| --- | --- | --- |
| `meta` | `titel`, `urheber`, `lizenz`, `lizenz_url`, `hinweis` | Herkunft der Daten; wird beim Speichern mitgeführt |
| Objekt | `Domain` | fachliche Domäne; gruppiert die Objektliste |
| | `desc` | Beschreibung (auch mehrzeilig) |
| | `business_keys` | Liste fachlicher Schlüssel |
| | `sources` | Liste der Quellsysteme oder -tabellen |
| | `attributes` | Liste der Attribute |
| | `relationships` | Liste der ausgehenden Beziehungen |
| Attribut | `name` | Pflicht; ohne Namen wird der Eintrag übergangen |
| | `type` | Datentyp, z. B. `char(13)` |
| | `nullable` | `true` zeigt im Kasten ein `?` hinter dem Typ |
| | `primary_key`, `foreign_key` | zeigen im Kasten `PK` bzw. `FK` |
| | `references` | Verweisziel `Objekt.Attribut` |
| Beziehung | `to` | Zielobjekt; Pflicht |
| | `name` | Beschriftung an der Kante |
| | `cardinality.from` / `.to` | Kardinalität an Quelle und Ziel |

### Kardinalitäten

| Wert | Bedeutung | Zeichen am Kantenende |
| --- | --- | --- |
| `exactly_one` | genau eins | zwei Querstriche |
| `zero_or_one` | null oder eins | Kreis und Querstrich |
| `zero_or_many` | null bis viele | Krähenfuß und Kreis |
| `one_or_many` | eins bis viele | Krähenfuß und Querstrich |
| `many` | viele | Krähenfuß |

Ein unbekannter Wert wird gemeldet, wie „genau eins" gezeichnet und beim
Anordnen auch so behandelt. Fehlt die Kardinalität ganz, bleibt das Kantenende
blank.

### Was der Leser verzeiht

Der eingebaute YAML-Leser deckt die für dieses Metamodell nötige Teilmenge ab
und ist absichtlich nachsichtig:

- **Tabulatoren** in der Einrückung sind erlaubt (ein Tab = vier Leerzeichen);
  es gibt einen Hinweis, weil echtes YAML das verbietet.
- **Feldnamen deutsch wie englisch:** `Domain`/`domain`,
  `desc`/`beschreibung`/`description`; als Wurzel neben `BusinessObjects` auch
  `businessObjects`, `business_objects`, `Geschaeftsobjekte`; als
  Beziehungsname auch `label`, `bezeichnung`, `rolle`; statt `cardinality` auch
  `kardinalitaet`; statt `business_keys` auch `BusinessKeys`. Stehen beide
  Schreibweisen da, gilt die erstgenannte; beim Bearbeiten wird die
  vorhandene weitergeschrieben.
- **Mehrzeilige Texte** als Blockskalar (`desc: |`, `|-`, `>`, `>-`) oder als
  eingerückte Fortsetzungszeilen.
- **Kommentare** mit `#` — auch am Zeilenende, sofern nicht in
  Anführungszeichen.

Nicht ausgewertet wird die **Inline-Notation** (`{…}` und `[…]` mit Inhalt);
solche Werte werden gemeldet und übergangen — bitte als eingerückten Block
schreiben. Doppelte Schlüssel auf derselben Ebene werden gemeldet: der spätere
gewinnt.

**Vier Schreibweisen für Beziehungen** werden gelesen:

```yaml
relationships:              # A: Name als Feld
- to: Position
  name: enthält

relationships:              # B: Name als Schlüssel, Rumpf eingerückt
- enthält:
    to: Position

relationships:              # C: Name als Schlüssel ohne Wert
- enthält:
  to: Position

relationships:              # D: Abbildung statt Liste
  enthält:
    to: Position
```

### Was geprüft wird

Der Reiter „Prüfung" meldet unter anderem: unbekanntes Beziehungsziel,
unbekanntes Verweisziel, fehlende Domain, fehlender Business Key, fehlende
Quelle, doppelter Attributname, unbekannte Kardinalität, doppelte Beziehung,
Selbstbezug, freistehendes Objekt, mehrfach genutzte Quelle, unbenannte
Beziehungen sowie Schlüssel auf oberster Ebene, die zu keinem Objekt gehören.

Als **doppelt** gilt eine Beziehung nur, wenn zwischen denselben Objekten eine
**gleichnamige** noch einmal steht. Zwei verschieden benannte Beziehungen —
auch benannt gegen unbenannt — sind zwei Sachverhalte und in Ordnung.

### Delta: zwei Modelle vereinigen

„Delta Geschäftsobjekte (YAML) …" spielt eine weitere Modelldatei ein, die die
Objekte **ergänzt**:

- Objekte, die es noch nicht gibt, kommen hinzu.
- Bei gleichem Namen entsteht ein **Superset**: Quellen, Business Keys,
  Attribute und Beziehungen werden vereinigt.
- **Dieselbe Sache** ist dabei ein Attribut mit gleichem Namen bzw. eine
  Beziehung mit gleichem Ziel *und* gleichem Namen — dort gilt die Fassung des
  Deltas. Unterschiedlich benannte Beziehungen zum selben Ziel bleiben als zwei
  Beziehungen erhalten.
- **Einzelwerte** wie Domain und Beschreibung nimmt das Delta.

So lassen sich zwei Modelle zusammenführen, die dieselben Objekte aus
verschiedenen Blickwinkeln beschreiben. Kommentare und Reihenfolge der
Grunddatei bleiben erhalten.

## Anhang B — Hierarchiebeschreibung (YAML)

Der Baum der redaktionellen Diagramme: welche Objekte ein Diagramm zeigt, sein
Text und seine Unterdiagramme.

```yaml
Übersicht:                                     # oberstes Diagramm
  beschreibung: "Überblick über das Modell."   # Text (leichtes Markdown)
  objekte:                                     # Objektnamen wie im Modell
    - Kunde
    - Bestellung
  Details:                                     # Unterdiagramme, rekursiv gleich
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
  Diagramme). Der Name des Knotens ist zugleich sein Titel im Baum.
- Alternativ gelesen werden `objects` statt `objekte`, `text` oder
  `description` statt `beschreibung` sowie `details`/`kinder` statt `Details`.
- Objektnamen, die es im Modell nicht gibt, werden übergangen und gemeldet.
- Die Datei lässt sich vollständig **in der App** bearbeiten (Kapitel 11) und
  über „Speichern" wieder ausgeben. Beschreibungen stehen in der Ausgabe als
  einzeilige Werte mit `\n`-Escapes — der Leser stellt sie verlustfrei her.

## Anhang C — Positionsinformationen (JSON)

Alles, was nicht zum Modell gehört, sondern zu seiner Darstellung. Die Datei
entsteht beim Arbeiten von selbst; sie wird nicht von Hand geschrieben. Sie zu
speichern lohnt, um eine Anordnung aufzuheben oder an andere weiterzugeben —
oder als Sicherung, wenn der Browserspeicher voll ist.

Sie enthält:

| Feld | Inhalt |
| --- | --- |
| `verfahren` | gewähltes Anordnungsverfahren, Richtung, Beziehungsnamen an/aus |
| `ansichten` | die Lage jedes Kastens (Schlüssel `1`; Einträge `2` und `3` älterer Dateien werden ignoriert) |
| `kantenzuege` | Stützpunkte, Anschlusspunkte und Beschriftungslagen |
| `inhalt` | was in den Kästen steht |
| `elemente` | ob Quelle und Domäne als eigene Elemente stehen |
| `ausgeblendet` | die derzeit nicht gezeigten Objekte |
| `pflegeAn` | ob „Geschäftsobjekte bearbeiten" eingeschaltet ist |
| `uebersichtText` | die Hierarchiebeschreibung |
| `hierarchie` | je Diagramm: Anordnung, Kantenzüge, sichtbare Objekte, Text |

Der HTML-Export („Stand als HTML sichern") trägt dieselben Angaben zusammen mit
dem Modell in einer Datei — für die Weitergabe ist er der bequemere Weg.
