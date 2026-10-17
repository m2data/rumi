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
- [17. Quelltabellen](#17-quelltabellen)
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

Der Browser merkt sich **nichts**: Eine HTML-Datei zeigt beim Öffnen genau den
Stand, der in ihr steckt — oder, wenn keiner eingebacken ist, das mitgelieferte
Beispiel. Den Arbeitsstand — Anordnung, Kantenzüge, ausgeblendete Objekte,
Einstellungen — hebt man über „Datei & Export → Stand speichern" auf
(Kapitel 14). Wer den Tab schließt oder neu lädt, solange es ungesicherte
Änderungen gibt, wird vom Browser gefragt, ob er die Seite wirklich verlassen
will. Bloßes Umschalten zwischen Ansichten und Diagrammen zählt dabei nicht als
Änderung.

## 2. Der Bildschirm

**Kopfzeile**, von links nach rechts:

| Bereich | Bedeutung |
| --- | --- |
| Titel und Dateiname | welches Modell gerade geladen ist |
| **Komplettansicht \| Hierarchie** | die beiden Arbeitsweisen (Kapitel 3 bzw. 11); mit „Quelltabellen verwenden" kommt **Quelltabellen** dazu (Kapitel 17) |
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

Die **Breite der Seitenleiste** lässt sich an ihrer Kante zur Zeichenfläche
mit der Maus ziehen — von 220 Pixeln bis 60 % der Fensterbreite, höchstens
640 Pixel. Das Diagramm bleibt dabei an seiner Stelle stehen. Ein Doppelklick
auf die Kante stellt die Standardbreite wieder her. Die Breite ist eine reine
Ansichtssache: sie wird nirgends gespeichert und gilt bis zum Neuladen.

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

Unter **Einstellungen → Als eigenes Element** lassen sich drei Angaben aus dem
Kasten herausnehmen und als **eigener Kasten** daneben stellen:

- **Quellen** — jede Quelle eines Objekts wird ein eigener Kasten, verbunden
  über eine Linie mit der Beschriftung „quelle".
- **Quelltabellen** — jede Tabelle aus `Table_Sources` eines Objekts wird ein
  eigener Kasten, verbunden über eine Linie mit der Beschriftung „Quelltabelle".
- **Domäne** — die **führende** Domäne eines Objekts wird ein eigener Kasten,
  verbunden über eine Linie mit der Beschriftung „Domäne". Ohne führende
  Domäne (mehrere Domänen, keine festgelegt — Kapitel 13) gibt es keinen.

Die Haken sind unabhängig und gelten **je Diagramm**: die Komplettansicht und
jedes Diagramm der Hierarchie haben ihre eigenen. Wer sie in einem Diagramm
setzt, ändert kein anderes; das Menü zeigt immer den Stand des gewählten.
„Quellen" und „Quelltabellen" gibt es bei den Quelltabellen (Kapitel 17) nicht. Jedes Objekt bekommt seine **eigenen** Kästen, auch wenn mehrere
Objekte dieselbe Quelle oder Domäne haben. So läuft keine Linie quer durchs
Diagramm zu einem gemeinsamen Knoten. Die Linien tragen keine Kardinalität,
denn eine Zuordnung ist keine fachliche Beziehung. Ist ein Element
eingeschaltet, ist der passende Punkt im Inhalt-Menü gesperrt.

Die Kästen stehen **neben ihrem Objekt**. Bei einer Anordnung nach unten oder
oben (und bei „Organisch") stehen sie rechts davon, bei einer Anordnung nach
links oder rechts darunter. Bei „Kreisförmig" stehen sie **außerhalb des
Kreises**, als Reihe hinter ihrem Objekt; ein unverbundenes Objekt steht
neben dem Kreis, seine Kästen rechts davon. Schaltet man ein Element ohne
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
**führenden Domäne** (Objekte ohne führende Domäne unter „Ohne Domain"). Zu jedem Eintrag steht
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
Marken `PK`/`AK`/`FK`, darunter gegebenenfalls das Verweisziel `→ Kunde.KundeID`)
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
- **Kreisförmig** — die Objekte auf einem Kreis.

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
- Quelltabellen *(die Einträge aus `Table_Sources`; gesperrt, solange sie als eigene Elemente stehen)*
- Attribute
  - nur Schlüsselattribute *(zeigt nur PK, AK und FK)*
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

Es gibt drei Stufen: **Fehler** (etwas wird nicht gezeichnet oder ist
widersprüchlich, z. B. ein unbekanntes Beziehungsziel oder ein Attribut, das
zugleich PK und AK ist), **Hinweis** (fehlende Domain, kein Business Key,
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

**Das Formular** (Details → Bearbeiten) umfasst Name, Domain, Beschreibung und
Business Keys (Domain und Keys jeweils durch Komma getrennt; eine Domäne wird
als Einzelwert geschrieben, mehrere als Liste), die **führende Domäne**
(Auswahl aus den Domänen), die **Quellen** (siehe unten), die **Attribute**
(Name, Typ, `PK` / `AK` / `FK` / `null`, Verweisziel in der Form `Objekt.Attribut`;
`×` entfernt eine Zeile, „＋ Attribut" hängt eine an) und die **ausgehenden
Beziehungen** (Ziel aus der Liste, Name, Kardinalität an Quelle und Ziel).
„Speichern" übernimmt, „Abbrechen" verwirft. Gespeichert wird nur, was
vollständig ist: jedes Attribut braucht einen Namen, jede Beziehung ein Ziel,
und der Objektname darf nicht doppelt vorkommen.

**Quellen ordnen und gruppieren.** Die Quellen stehen als Liste, die
**wichtigste zuerst**; ↑ und ↓ verschieben eine Zeile, „＋ Quelle“ hängt eine
an, × entfernt sie. Quellen können sich **überschneiden** (dieselben Kunden im
Webshop und in der Roadshow): mindestens zwei markieren und „Markierte
gruppieren“ — sie bilden eine Gruppe und tragen deren Marke („∩1“). Quellen
einer Gruppe überschneiden sich, Gruppen untereinander und Quellen ohne Gruppe
sind **disjunkt**. „Gruppe auflösen“ macht die markierten wieder disjunkt;
bleibt eine Gruppe mit nur einer Quelle übrig, entfällt sie beim Speichern.
Unter der Liste steht, wie viele disjunkte Einheiten es sind — bei fünf
Quellen mit zwei Gruppen zu je zwei sind es drei. Die Details zeigen die
Quellen nummeriert mit ihrer Gruppenmarke.

**Führende Domäne.** Hat ein Objekt mehrere Domänen, wird nur die führende
angezeigt — als Unterzeile im Kasten, als Domänen-Element und als Gruppe der
Objektliste; die Details nennen alle und markieren die führende. Ohne
festgelegte führende Domäne wird keine angezeigt, und die Prüfung meldet
„mehrere Domänen, keine führende". Bei genau einer Domäne ist diese von selbst
führend. Gespeichert wird sie als `leading_domain`; steht sie nicht unter
Domain, wird sie trotzdem angezeigt und gemeldet.

**Attribute zusammenführen.** Kommen die Attribute eines Objekts aus mehreren
Quelltabellen (Kapitel 17), bringt der Dialog „Attribute zusammenführen …“ sie
in Ordnung — erreichbar in den Details und im Kontextmenü eines
Geschäftsobjekts, wenn „Geschäftsobjekte bearbeiten“ an ist. Je Attribut eine
Zeile mit Namen, Typ und Schlüsseln, darunter seine Quellen
(`Webshop.Bestellung.KundeID · char(13) · PK`); weicht der Typ einer Quelle ab,
ist sie markiert.

- **Zusammenführen:** mindestens zwei markieren, „Markierte zusammenführen“ —
  das oberste bleibt mit Namen und Eigenschaften, die Quellen der anderen
  kommen dazu, die anderen entfallen.
- **Abtrennen:** an einer Quelle eines Attributs mit mehreren Quellen. Sie wird
  ein eigenes Attribut direkt darunter, mit den Eigenschaften ihrer Spalte und
  deren Namen; ist er vergeben, mit dem Tabellennamen angehängt
  (`BestellungID_Bestellung_VRS`), notfalls zusätzlich mit dem Quellsystem.
- **Umbenennen:** im Namensfeld.

„Übernehmen“ schreibt alles in einem Schritt (Strg+Z nimmt es zurück);
Business Keys und `references` in allen Objekten ziehen mit — auch ein
Verweis auf ein entfallenes Attribut zeigt danach auf das bleibende. Namen
müssen eindeutig sein und dürfen kein `:`, `#`, `"` oder `.` enthalten.
„Abbrechen“ verwirft alles.

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

### Projektordner (für Git)

Wer das Modell in einem Git-Repository pflegt, legt alle Dateien zusammen in
einen Ordner. Sie heißen nach dem **Modellnamen oben links**:

| Datei | Inhalt |
| --- | --- |
| `Name.yaml` | Geschäftsobjekte (Anhang A) |
| `Name_hier.yaml` | Hierarchiebeschreibung (Anhang B) |
| `Name_pos.json` | Positionsinformationen (Anhang C) |
| `Name_quellen.yaml` | Quelltabellen (Anhang D), sobald welche geladen oder eingeschaltet sind |
| `Name_quellhier.yaml` | Quelltabellen-Diagramme (Anhang E), ebenso |

- **Projektordner öffnen …** lädt alle Dateien des Ordners auf einmal. Die
  Geschäftsobjekt-Datei ist die `.yaml` ohne Zusatz; die übrigen werden über
  ihren Namen gefunden. Fehlt eine, ist das kein Fehler, sie wird übersprungen.
  Liegen mehrere Geschäftsobjekt-Dateien im Ordner, zählt die mit passender
  `_pos.json`. Bleibt es mehrdeutig, wird nichts geladen, und die Meldung nennt
  die Dateien. Unterordner werden nicht durchsucht.
- **Projekt speichern** (Strg+S) schreibt alle Dateien auf einmal in den Ordner,
  der im Dialog gewählt wird. Ihr Inhalt
  ist derselbe wie bei den Einzelpunkten unter „Speichern". Einzige Ausnahme:
  Die `_pos.json` enthält im Projekt die Texte der Hierarchie und der
  Quelltabellen-Diagramme **nicht**, denn sie stehen schon in `_hier.yaml` und
  `_quellhier.yaml`. So zeigt Git jede Änderung nur einmal.
- Ist ein Projektordner offen, speichert **Strg+S** das Projekt. Sonst sichert
  es wie bisher in die HTML-Datei.
- Wird der Modellname geändert, entstehen beim nächsten Speichern neue Dateien
  unter dem neuen Namen. Die alten bleiben liegen. Die Meldung nennt sie, und
  sie sollten entfernt werden, sonst ist das nächste Öffnen nicht eindeutig.

> **Welcher Browser?** Nur **Chrome und Edge** schreiben direkt in den Ordner
> zurück. Beim Öffnen und beim Speichern geht jedes Mal der Ordnerdialog auf.
> Vorgeschlagen ist der offene Projektordner, sonst der zuletzt gewählte, auch
> nach dem Neuladen. Bestätigen genügt. Wer einen anderen Ordner wählt, wechselt
> damit den Projektordner: Gespeichert wird dorthin, und ab dann wird er
> vorgeschlagen. Der Browser fragt dabei nach der Erlaubnis, im Ordner zu
> schreiben.
>
> **Firefox und Safari** können einen Ordner nur **lesen**. „Projektordner
> öffnen …" lädt dort genauso alle Dateien. Der Browser fragt vorher, ob er die
> Dateien „hochladen" darf; sie verlassen den Rechner dabei nicht. „Projekt
> speichern" lädt die Dateien dagegen **herunter**: Sie landen im
> Download-Ordner und müssen von dort ins Projektverzeichnis kopiert werden.
> Beim ersten Mal fragt der Browser eventuell, ob die Seite mehrere Dateien
> herunterladen darf. Das muss erlaubt werden, sonst kommt nur die erste an.
>
> Die Anwendung muss über `http(s)` geöffnet sein, nicht per Doppelklick als
> Datei, sonst gibt der Browser keinen Ordnerzugriff.

Die HTML-Datei („Stand speichern (HTML)") bleibt das Format zum
**Weitergeben**: Sie bringt alles in einer Datei mit, eignet sich aber nicht für
Git.

### Einzelne Dateien

**Laden**

| Punkt | Wirkung |
| --- | --- |
| Geschäftsobjekte (YAML) … | ersetzt das Modell (auch per Ziehen auf die Fläche) |
| Delta Geschäftsobjekte (YAML) … | **ergänzt** das Modell (siehe unten) |
| Hierarchiebeschreibung (YAML) … | ersetzt den Diagrammbaum |
| Positionsinformationen (JSON) … | übernimmt Anordnungen, Kantenzüge und Einstellungen |
| Quelltabellen (YAML) … | ersetzt die Tabellen; fragt nach verwaisten Geschäftsobjekten (Kapitel 17) |
| Delta Quelltabellen (YAML) … | **ergänzt** die Tabellen, löscht nichts (Kapitel 17) |

**Ein Delta einspielen** vereinigt zwei Modelle: gleichnamige Objekte werden zu
einem **Superset** aus beiden Fassungen. Näheres im [Anhang A](#delta-zwei-modelle-vereinigen).
Das Einspielen ist eine ganz normale Aktion — Strg+Z nimmt es wieder heraus.

**Speichern** — die drei Dateien einzeln:

| Punkt | Ergebnis |
| --- | --- |
| Geschäftsobjekte (YAML) | das Modell, mit allen Bearbeitungen |
| Hierarchiebeschreibung (YAML) | der Diagrammbaum, `Name_hier.yaml` |
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
| Strg+S | Projekt speichern, ist kein Projektordner offen: Stand in die HTML (Kapitel 14) |
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

**„Hierarchiebeschreibung nicht geladen: …"** (ebenso „Quelltabellen-Diagramme
nicht geladen") — die Datei ist keine Diagrammdatei, meist eine verwechselte
Geschäftsobjekt- oder Quelltabellen-Datei. Die Meldung nennt den richtigen
Ladeweg; die bisherigen Diagramme bleiben unverändert.

**„Projekt speichern" lädt nur herunter.** Der Browser kann nicht in einen
Ordner schreiben. Das gilt für Firefox und Safari sowie für eine per
Doppelklick geöffnete Datei. Die Dateien liegen dann im Download-Ordner und
gehören von dort ins Projektverzeichnis. Direkt in den Ordner schreiben nur
Chrome und Edge, mit über `http(s)` geöffneter Seite (Kapitel 14).

**„Mehrere Geschäftsobjekt-Dateien im Ordner"** — meist liegen nach einem
geänderten Modellnamen noch die Dateien unter dem alten Namen daneben. Die
nicht mehr gebrauchten entfernen, dann ist das Öffnen wieder eindeutig.

**Der Knopf „Quelltabellen" fehlt.** Er erscheint erst mit „Einstellungen →
Quelltabellen verwenden" (Kapitel 17).

**Das Bild ist leer.** „Einpassen" (`F`) holt alles zurück ins Sichtfeld.

**Nach dem Neubauen der Anwendung sieht man den alten Stand.** Die Seite im
Browser **neu laden** — sonst läuft weiter die zuvor geladene Fassung.

## 17. Quelltabellen

Unter `source_systems` steht bei einem Geschäftsobjekt nur ein Name. Die Ebene
der **Quelltabellen** formuliert diese Einträge aus: jede Tabelle mit fast
denselben Feldern wie ein Geschäftsobjekt (Beschreibung, Attribute,
Beziehungen zwischen Tabellen), dazu genau **ein Quellsystem**, genau **eine
Domäne** und das **Geschäftsobjekt**, dem sie zugeordnet ist. Eine oder
mehrere Tabellen können demselben Geschäftsobjekt zugeordnet sein — kommen
sie aus verschiedenen Domänen, führt das Geschäftsobjekt die Liste dieser
Domänen samt einer führenden (Kapitel 13). Die Tabellen stehen in einer
eigenen Datei (Anhang D).

Eindeutig ist eine Tabelle erst **mit ihrem Quellsystem**: `Bestellung` kann es
im Webshop und in der Roadshow geben. Überall — im Kasten, in der Liste, in den
Details, in Verweisen und Diagrammen — heißt sie darum `Webshop.Bestellung`.

**Einschalten.** Die Ebene ist zunächst **aus** — das Werkzeug verhält sich
dann genau wie ohne sie. „Einstellungen → Quelltabellen verwenden" schaltet sie
ein: in der Kopfzeile erscheint der Knopf **Quelltabellen**, im Menü „Datei &
Export" die beiden Dateien der Quelltabellen, unter „Einstellungen" die
Schalter „Quelltabellen bearbeiten" und „Geschäftsobjekt". Der Schalter wird
gemerkt und wandert in Positionsinformationen und Stand mit; Strg+Z nimmt ihn
zurück. Wer ihn im Bereich selbst ausschaltet, landet in der Hierarchie.
Mitgeliefert sind die Quelltabellen zum Willibald-Beispiel.

**Der Bereich** ist gebaut wie die Hierarchie (Kapitel 11): links der Baum,
darunter die Beschreibung, rechts das Diagramm.

- Ganz oben steht **„Quellsysteme"** mit allen Tabellen und darunter **je
  Quellsystem ein Diagramm** mit genau dessen Tabellen. Diese Diagramme
  entstehen aus den Tabellen — kommt ein Quellsystem hinzu oder wechselt eine
  Tabelle ihr System, folgt der Baum von selbst. Umbenennen, löschen,
  verschieben oder Unterdiagramme anlegen lässt sich an ihnen nichts;
  Anordnung, Auswahl der gezeigten Tabellen und Beschreibung schon.
- Daneben lassen sich **eigene Diagramme** anlegen („＋ Diagramm",
  „＋ Unterdiagramm"), etwa um Tabellen aus mehreren Quellsystemen
  gegenüberzustellen. Tabellen kommen wie in der Hierarchie über die Häkchen der
  Objektliste hinein. Diese Diagramme stehen in einer eigenen Datei (Anhang E).
- Die **Objektliste** gruppiert nach Quellsystem; die **Prüfung** gilt den
  Tabellen; die **Suche** findet auch Quellsystem und Geschäftsobjekt.
- „Quellen" und „Quelltabellen" als eigenes Element gibt es hier nicht; sie
  gehören zu den Geschäftsobjekten.

**Geschäftsobjekt als eigenes Element.** „Einstellungen → Geschäftsobjekt"
stellt das zugeordnete Geschäftsobjekt als eigenen Kasten ins Diagramm — anders
als Quelle und Domäne **nur einmal je Diagramm**, verbunden mit allen seinen
Tabellen (gestrichelte Kante „Geschäftsobjekt"). So sieht man, welche Tabellen
dasselbe Objekt beliefern. Der Kasten ist sichtbar, solange es eine seiner
Tabellen ist; eingeschaltet in einem schon gelegten Diagramm kommt er rechts
neben seine Tabellen, das Übrige bleibt liegen. Das Element gibt es nur bei den
Quelltabellen; der Haken gilt wie alle unter „Als eigenes Element" je Diagramm.

**Bearbeiten.** „Einstellungen → Quelltabellen bearbeiten" funktioniert wie
„Geschäftsobjekte bearbeiten" (Kapitel 13), nur für die Tabellen: Formular im
Reiter „Details", „＋ Objekt" über der Liste, Löschen, Strg+Z. Im Formular
stehen **Tabelle** (der Name ohne System) und **Quellsystem** getrennt, statt
„Quellen" gibt es eine Auswahl **Geschäftsobjekt**. **Domain** nimmt genau
einen Wert auf (mehrere werden abgelehnt), eine führende Domäne gibt es an
Tabellen nicht. Ein Punkt ist in Tabelle und Quellsystem nicht erlaubt, er
trennt beide. „＋ Objekt" fragt nach
`System.Tabelle` und setzt die Tabelle in den Abschnitt ihres Systems.
Geschrieben wird in die Tabellen-YAML, nur an der bearbeiteten Stelle.
Umbenennen einer Tabelle zieht `to:`, `references:`, die Diagramme und die
Anordnung mit. Ein anderes Quellsystem **hängt die Tabelle um**: sie wandert in
den Abschnitt des neuen Systems (fehlt er, entsteht er am Ende; ein leer
gewordener Abschnitt entfällt), und alle Verweise auf sie ziehen mit. Wird ein **Geschäftsobjekt** umbenannt, zieht seine Zuordnung in
den Tabellen mit; wird es gelöscht, bleibt die Zuordnung stehen — die nächste
Übernahme legt es wieder an.

**Geschäftsobjekte übernehmen.** Aus den Tabellen entstehen die
Geschäftsobjekte, die sie unter `business_object` nennen. Die Übernahme läuft
**beim Laden einer Quelltabellen-Datei** und über **„Datei & Export →
Geschäftsobjekte übernehmen"**; sie ist ein Schritt im Verlauf (Strg+Z), ändert
sich nichts, entsteht keiner. Der Schalter „Geschäftsobjekte bearbeiten" wird
dafür nicht gebraucht. Je Tabelle mit Zuordnung:

| | Objekt fehlt → **anlegen** | Objekt vorhanden → **aktualisieren** |
| --- | --- | --- |
| Domain | die der Tabelle | fehlende Domänen kommen in die Liste; hatte das Objekt genau eine, wird sie `leading_domain`, damit die Anzeige bleibt |
| Quellen | das Quellsystem der Tabelle (`Webshop`) | fehlendes Quellsystem wird hinten angehängt; vorhandene Quellen, Reihenfolge und Gruppen bleiben, entfernt wird nichts |
| Beschreibung | die der Tabelle, darunter `--->aus Webshop.Bestellung kopiert` | ihr Block (Text mit dieser Herkunftszeile) wird erneuert; gibt es ihn noch nicht, wird angehängt — **nicht**, wenn derselbe Text schon dasteht |
| Business Keys | die Primärschlüssel (`primary_key`) der Tabelle | fehlende Primärschlüssel werden angehängt |
| Attribute | alle, je mit `attribut_sources: [Webshop.Bestellung.KundeID]` | alle; gleichnamige werden eins, Eigenschaften aus übereinstimmenden Quellen (s. u.) |
| Beziehungen | übernommen, Ziel umgesetzt | übernommen, Ziel umgesetzt |
| Zusatzfelder | die unter „Zusatzattribute …" eingeschalteten | dieselben, wo das Objekt keinen Wert hat |
| `Table_Sources` | `Webshop.Bestellung` | Tabelle angehängt |

- **Ziel umsetzen:** `to: Webshop.Position` wird zum Geschäftsobjekt der
  Zieltabelle (`to: Position`). Gibt es am Objekt schon eine Beziehung mit
  gleichem Ziel und gleichem Namen, kommt keine zweite dazu, nur ihre Herkunft:
  `Relation_Sources` nennt dann `Webshop.Bestellung→Webshop.Position` und
  `Roadshow.Bestellung_VRS→Roadshow.Position_VRS`.
- **Ziel ohne Geschäftsobjekt:** Zeigt eine Beziehung auf eine Tabelle ohne
  `business_object`, wird sie ihrem eigenen Namen zugeordnet
  (`Webshop.Lager` → Geschäftsobjekt `Lager`). Die Zuordnung wird in die
  Tabellen-YAML geschrieben, danach wird die Tabelle wie jede andere
  übernommen; gibt es das Objekt schon, wird es ergänzt. Das gilt auch weiter
  entlang einer Kette (Lager → Regal). Die Rückmeldung nennt die so
  angelegten Objekte, und der Reiter „Prüfung" zeigt sie als Info „aus
  Beziehungsziel angelegt" — bis zur nächsten Übernahme oder bis ein anderes
  Modell geladen wird; das steht in keinen Daten.
- **Attribute:** Jedes Attribut jeder Tabelle kommt ins Objekt. **Gleichnamige
  werden eins** — gleicher Name wie das Attribut am Objekt oder wie eine Spalte
  in dessen `attribut_sources` (so findet auch ein umbenanntes Attribut neue
  Quellen); die Quelle kommt in `attribut_sources` dazu (eine Liste, z. B.
  `[Webshop.Bestellung.BestellungID, Roadshow.Bestellung_VRS.BestellungID]`).
  Alle anderen kommen als eigene Attribute dazu und lassen sich im Dialog
  „Attribute zusammenführen“ vereinen (Kapitel 13). Steht eine Quelle schon an
  einem Attribut, bleibt sie dort — abgetrennte Attribute werden nicht wieder
  vereint.
- **Eigenschaften der Attribute:** Stimmen alle Quellspalten eines Attributs in
  einer Eigenschaft überein (Typ, nullable, PK/AK/FK, Verweis), bekommt das
  Attribut diesen Wert — auch ein von Hand angelegtes, das so seine erste
  Quelle bekommt. Weichen sie ab, bleibt der Wert am Attribut, und die Prüfung
  meldet „Quellen mit abweichendem Typ“. Der Name bleibt immer (Umbenennen im
  Dialog gilt).
- **Primärschlüssel:** Das Attribut, auf dem eine Spalte mit `primary_key`
  landet, wird Business Key des Objekts, wenn es den Schlüssel noch nicht gibt.
- **Verweise umsetzen:** `references: Webshop.Kunde.KundeID` wird
  `Kunde.KundeID`.
- **Aktualisieren:** Jeder Lauf gleicht **alle** zugeordneten Tabellen ab, auch
  schon übernommene: Fehlendes kommt dazu, Übernommenes wird erneuert, nichts
  wird doppelt eingetragen; ohne neue Daten ändert ein Lauf nichts. Ist eine
  Spalte weggefallen, verschwindet sie aus `attribut_sources` (das Attribut
  bleibt). Ist eine Tabelle einem anderen oder keinem Objekt mehr zugeordnet,
  verschwindet sie beim bisherigen aus `Table_Sources`, `attribut_sources`,
  `Relation_Sources` und der Beschreibung. Eine Tabelle, die in der geladenen
  Tabellendatei gar nicht vorkommt, bleibt unangetastet — sie kann aus einer
  anderen Datei stammen.
- **Verwaiste Geschäftsobjekte beim Laden:** Ein Geschäftsobjekt gehört zur
  bisherigen Tabellendatei, wenn es aus ihren Tabellen stammt (`Table_Sources`)
  oder eine ihrer Tabellen es unter `business_object` nennt — so auch die
  Objekte zur mitgelieferten Vorlage, die nie übernommen wurde. Bleibt ihm in
  der neu geladenen Datei keine Tabelle und nennt die neue Datei es auch nicht,
  ist es verwaist, und das Laden fragt, ob die verwaisten Objekte mitgelöscht
  werden. Von Hand angelegte Objekte ohne Bezug zu Tabellen zählen nicht dazu. **Ja** löscht sie samt der Beziehungen auf sie und
  ihrer Einträge in der Hierarchie; Objekte, die noch eine Tabelle der neuen
  Datei haben, bleiben und verlieren nur die Herkunft aus den weggefallenen
  Tabellen. **Nein** lässt alles stehen. Ohne verwaiste Objekte kommt keine
  Frage. Das Ganze ist ein Schritt im Verlauf.
- **Delta Quelltabellen:** „Datei & Export → Delta Quelltabellen (YAML) …"
  ersetzt die Tabellen nicht, sondern ergänzt sie — wie das Delta der
  Geschäftsobjekte: neue Tabellen kommen in den Abschnitt ihres Systems (ein
  neues System entsteht am Ende), gleichnamige werden zusammengeführt
  (Spalten und Beziehungen beider Fassungen bleiben, gleichnamige und
  Einzelwerte wie Domain, desc, business_object nimmt das Delta). Gelöscht
  wird nichts, gefragt wird darum auch nicht. Danach läuft die Übernahme.
- Die Rückmeldung zählt je Geschäftsobjekt: „Übernahme: 1 angelegt, 5
  aktualisiert, 3 unverändert".
- Ein Objektname mit `:`, `#` oder `"` wird nicht angelegt und gemeldet.

---

# Anhang: die Dateien

Ein vollständiger Arbeitsstand besteht aus drei Dateien, die einzeln geladen
und gespeichert werden; mit den Quelltabellen (Kapitel 17) kommen zwei dazu.
Nur die erste ist Pflicht.

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
    source_systems:                            # Quellsysteme/-tabellen
    - Bestellung
    - Bestellung_VRS
    attributes:
    - name: BestellungID
      type: bigint
      nullable: false
      primary_key: true                        # PK
    - name: Auftragsnummer
      type: char(10)
      alternate_key: true                      # AK (nie zugleich PK)
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
| Objekt | `Domain` | fachliche Domäne, eine (`Domain: Willibald`) oder mehrere als Liste |
| | `leading_domain` | die führende Domäne (auch `Leading_Domain`, `Führende_Domäne`); nur sie wird angezeigt und gruppiert die Objektliste. Bei genau einer Domain ist diese führend |
| | `desc` | Beschreibung (auch mehrzeilig) |
| | `business_keys` | Liste fachlicher Schlüssel |
| | `source_systems` | Liste der Quellsysteme oder -tabellen, **die wichtigste zuerst**. Ein Eintrag ist ein Name (`- Kunde`) oder, wenn die Quelle zu einer Gruppe sich überschneidender Quellen gehört, `- name: Bestellung` mit `overlap_group: 1`. Quellen derselben Gruppe überschneiden sich, alle anderen sind disjunkt; eine Gruppe mit nur einer Quelle wird gemeldet |
| | `Table_Sources` | Liste der Quelltabellen (`System.Tabelle`), aus denen das Objekt übernommen wurde (Kapitel 17) |
| | `attributes` | Liste der Attribute |
| | `relationships` | Liste der ausgehenden Beziehungen; je Beziehung optional `Relation_Sources`: Liste der Quellbeziehungen `System.Tabelle→System.Tabelle` |
| Attribut | `name` | Pflicht; ohne Namen wird der Eintrag übergangen |
| | `type` | Datentyp, z. B. `char(13)` |
| | `nullable` | `true` zeigt im Kasten ein `?` hinter dem Typ |
| | `primary_key`, `alternate_key`, `foreign_key` | zeigen im Kasten `PK`, `AK` bzw. `FK`; PK und AK zugleich ist ein Fehler |
| | `references` | Verweisziel `Objekt.Attribut` |
| | `attribut_sources` | Liste der Herkünfte `System.Tabelle.Spalte`, gesetzt von der Übernahme (Kapitel 17); ein Einzelwert wird auch gelesen |
| Beziehung | `to` | Zielobjekt; Pflicht |
| | `name` | Beschriftung an der Kante |
| | `cardinality.from` / `.to` | Kardinalität an Quelle und Ziel |
| | `Relation_Sources` | Liste der Quellbeziehungen `System.Tabelle→System.Tabelle` (Kapitel 17) |

### Kardinalitäten

| Wert | Bedeutung | Zeichen am Kantenende |
| --- | --- | --- |
| `exactly_one` | genau eins | zwei Querstriche |
| `zero_or_one` | null oder eins | Kreis und Querstrich |
| `zero_or_many` | null bis viele | Krähenfuß und Kreis |
| `one_or_many` | eins bis viele | Krähenfuß und Querstrich |

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
  `kardinalitaet`; statt `business_keys` auch `BusinessKeys`; statt
  `source_systems` auch das ältere `sources`. Stehen beide Schreibweisen da,
  gilt die erstgenannte; beim Bearbeiten wird die vorhandene weitergeschrieben.
- **Mehrzeilige Texte** als Blockskalar (`desc: |`, `|-`, `|+`, `>`, `>-`),
  als eingerückte Fortsetzungszeilen (eine Leerzeile wird ein Zeilenumbruch)
  oder in `'…'`/`"…"` über mehrere Zeilen, wie YAML-Werkzeuge lange Texte
  schreiben (mit `\`-Fortsetzung und Escapes wie `\uHHHH`). Ein unsichtbarer
  Zeilentrenner (U+2028, etwa aus Word eingefügt) gilt als Zeilenumbruch.
- **Kommentare** mit `#` — auch am Zeilenende, sofern nicht in
  Anführungszeichen.
- **Was YAML sonst kennt:** Inline-Listen und -Abbildungen (`[a, b]`,
  `{a: 1}`, auch über mehrere Zeilen), Anker, Alias und Merge (`&k`, `*k`,
  `<<: *k`), Tags wie `!!str`, Schlüssel in Anführungszeichen, `? schlüssel`,
  Listen in Listen, `null`/`Null`/`~`, Zahlen wie `1e3` oder `0x1F`, ein `---`
  am Anfang und `...` am Ende.

Was der Leser nicht versteht, verwirft er nicht still: jede solche Stelle steht
mit Zeilennummer in der Prüfliste — eine Zeile ohne `schlüssel: wert`, eine
tiefer eingerückte Zeile ohne Elternschlüssel, ein Anführungszeichen ohne
Schluss, ein Alias ohne Anker, ein eigenes Tag, ein zweites Dokument nach
`---` (gelesen wird nur das erste). Doppelte Schlüssel auf derselben Ebene
werden gemeldet: der spätere gewinnt.

**Gespeichert wird einheitlich:** Beim Herunterladen der Modell- und der
Quelltabellen-YAML, bei „Stand speichern“ und beim Speichern im Formular
stehen alle Beschreibungen als Block `desc: |`, anderer mehrzeiliger Text
ebenso; einzeiliger Text schlicht, wo es geht, sonst in `"…"`; Inline-Listen
als Blockliste. Kommentare, Reihenfolge und Einrückung bleiben, ebenso Zahlen,
Anker und Tags; die Zeilenenden werden LF.

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
Quelle, doppelter Attributname, Attribut zugleich PK und AK, unbekannte
Kardinalität, doppelte Beziehung, Selbstbezug, freistehendes Objekt, mehrfach genutzte Quelle, unbenannte
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
- Im Projektordner heißt sie `Name_hier.yaml` (Kapitel 14).

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
| `elemente` | ob in der Komplettansicht Quelle, Quelltabelle und Domäne als eigene Elemente stehen (die Diagramme tragen ihre unter `hierarchie` bzw. `quelltabellen`; ältere Dateien mit nur diesem Eintrag geben ihn an die Komplettansicht) |
| `ausgeblendet` | die derzeit nicht gezeigten Objekte |
| `pflegeAn` | ob „Geschäftsobjekte bearbeiten" eingeschaltet ist |
| `uebersichtText` | die Hierarchiebeschreibung |
| `hierarchie` | je Diagramm: Anordnung, Kantenzüge, sichtbare Objekte, Text, eigene Elemente |
| `quelltabellen` | Schalter „Quelltabellen verwenden" (`an`) und „… bearbeiten" (`pflegeAn`), die Diagramm-YAML (`uebersichtText`) und je Diagramm Anordnung, Kantenzüge, sichtbare Tabellen, Text, eigene Elemente. Fehlt der Eintrag (ältere Datei), gelten die Vorgaben. |

Der HTML-Export („Stand als HTML sichern") trägt dieselben Angaben zusammen mit
dem Modell in einer Datei — für die Weitergabe ist er der bequemere Weg. Er
enthält auch die Quelltabellen-YAML.

Im Projektordner heißt die Datei `Name_pos.json` und enthält `uebersichtText` und
`quelltabellen.uebersichtText` **nicht**, denn diese Texte stehen dort in
`Name_hier.yaml` und `Name_quellhier.yaml` (Kapitel 14).

## Anhang D — Quelltabellen (YAML)

Eine eigene Datei, aufgebaut wie die Geschäftsobjekte (Anhang A) — nur heißt
der Abschnitt `SourceTables`, darunter steht **je Quellsystem ein Abschnitt**
mit seinen Tabellen, und jede Tabelle trägt statt der Liste `source_systems`
ihre Zuordnung zu einem Geschäftsobjekt:

```yaml
SourceTables:                       # auch: Quelltabellen, source_tables
  Webshop:                          # Quellsystem
    Bestellung:                     # Tabelle, Kennung Webshop.Bestellung
      business_object: Bestellung   # auch: Geschäftsobjekt
      Domain: Willibald
      attributes:
      - name: BestellungID
        primary_key: true           # wird Business Key des Geschäftsobjekts
      - name: KundeID
        foreign_key: true
        references: Webshop.Kunde.KundeID   # System.Tabelle.Spalte
      relationships:                # zwischen Tabellen, auch über Systeme hinweg
      - to: Webshop.Position        # System.Tabelle
        name: enthält
  Roadshow:
    Bestellung:                     # gleicher Name, andere Tabelle: Roadshow.Bestellung
      business_object: Bestellung
```

- `Domain` ist an einer Quelltabelle **ein Wert**. Steht doch eine Liste da,
  gilt die erste Domäne, und die Prüfung meldet „mehrere Domänen an einer
  Quelltabelle"; `leading_domain` wird an Tabellen nicht ausgewertet. Die
  Domänenliste mit führender Domäne gehört ans Geschäftsobjekt: die Übernahme
  hängt die Domäne jeder Tabelle an dessen Liste an.
- Quelltabellen haben **keine Business Keys**: die des Geschäftsobjekts kommen
  aus den Attributen mit `primary_key`. Ein `business_keys` aus älteren Dateien
  wird nicht gelesen und bleibt beim Bearbeiten unverändert stehen.
- Eindeutig ist `System.Tabelle`. Ein Punkt im System- oder Tabellennamen ist
  ein Fehler.
- Verweise werden **voll qualifiziert** geschrieben: `to: System.Tabelle`,
  `references: System.Tabelle.Spalte`. Ein Verweis ohne System wird im eigenen
  System gesucht und als „Verweis ohne Quellsystem" gemeldet.
- Ältere Dateien (bis 2026-10-07) führen die Tabellen direkt unter
  `SourceTables` und das System im Feld `source_system:` (auch
  `Source_System:`). Sie werden weiter gelesen und gepflegt; ein Eintrag gilt
  als solche Tabelle, sobald er Tabellenfelder trägt (`source_system`,
  `business_object`, `attributes`, `business_keys`, `Domain`, `desc`,
  `relationships`).
- Geprüft wird wie bei den Geschäftsobjekten, dazu: **kein Quellsystem**
  (Hinweis, nur in der älteren Form möglich), **Quellsystem widersprüchlich**
  (Hinweis: `source_system:` passt nicht zum Abschnitt — es gilt der
  Abschnitt) und **ohne Geschäftsobjekt** (Info). Nennt `business_object` ein
  Objekt, das es nicht gibt, ist das kein Befund: die Übernahme legt es an
  (Kapitel 17).

## Anhang E — Quelltabellen-Diagramme (YAML)

Die eigenen Diagramme des Bereichs Quelltabellen, aufgebaut wie die
Hierarchiebeschreibung (Anhang B); die Liste heißt `tabellen` (`objekte` wird
auch gelesen) und nennt `System.Tabelle`. Die Diagramme der Quellsysteme
stehen **nicht** darin, sie entstehen aus den Tabellen.

```yaml
Bestellung Webshop/Roadshow:
  beschreibung: "Dieselbe Bestellung aus zwei Systemen"
  tabellen:
    - Webshop.Bestellung
    - Roadshow.Bestellung_VRS
```

Ein Name ohne System (ältere Dateien) gilt, wenn genau eine Tabelle so heißt;
gibt es ihn in mehreren Systemen, wird er gemeldet und nicht gezeigt.
Anordnungen, die vor dem 2026-10-08 in diesen Diagrammen gelegt wurden, hängen
an den alten Kennungen und werden neu gelegt.

Im Projektordner heißt die Datei `Name_quellhier.yaml` (Kapitel 14).
