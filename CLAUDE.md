# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

---

## 5. Dieses Projekt

**Sprache:** Deutsch — Antworten, Code-Kommentare, Commit-Nachrichten, Oberfläche
und Testausgaben. Auch Bezeichner sind teils deutsch (`zeiger`, `stuetzpunkt`,
`knoten`); dem Vorbild der Umgebung folgen.

**Aufbau:** eine einzelne HTML-Datei, aus `src/` mit `node build.js` zu
`dist/geschaeftsobjekt-explorer.html` zusammengebaut. Kein Bündler, keine
Abhängigkeiten, nichts wird nachgeladen — keine CDN, keine externen Schriften.
Die Module (yaml, model, layout, render, app, route, edit, interaktion,
hierarchie, pflege, ui) landen in **einem** Gültigkeitsbereich; es gibt keine
Importe.
Näheres in [README.md](README.md).

**Nach jeder Änderung:**

    node build.js && node test/smoke.js && node test/model.test.js && node test/layout.test.js && node test/outline.test.js

Tests laufen selbstständig, gemeldet wird nur ein Fehlschlag. Zur Definition of
Done siehe [TESTS.md](TESTS.md): eine Fehlerbehebung braucht einen Test, der auf
dem *alten* Stand fehlschlägt, ein Feature einen Test des Bedienwegs.

**Prüfen im Browser:** nach `node build.js` die Seite **neu laden**, sonst wird
der alte Stand gemessen. Das war bisher die häufigste Quelle widersprüchlicher
Messungen.

**Layout beurteilt man in Zahlen, nicht am Bild:** vor und nach jeder Änderung
dieselben Kennzahlen messen — geroutete Kreuzungen, X direkt am Kasten (zwei
Kanten mit gemeinsamem Endknoten kreuzen sich davor), Pendeln und Kehren im
Zug, Schnitte durch fremde Kästen. Ein Bildschirmfoto zeigt nur, was zufällig
im Ausschnitt liegt; jede echte Verbesserung dieser Art war zuvor eine Zahl.

**Erst die Struktur, dann die Zeichnung:** sieht eine Kante falsch aus, zuerst
ihre Stützpunkte prüfen ([layout.js](src/layout.js)) — ein Eingriff in
[render.js](src/render.js) kaschiert sonst nur das Symptom. Und jeder
Ausweich- oder Rückfallzweig muss dieselbe Prüfung durchlaufen wie der
Hauptweg, sonst erzeugt er genau das Muster, das er verhindern soll.

**Commits:** deutsche Betreffzeile ohne Schlusspunkt, der Körper erklärt in
Fließtext das Warum. Das Build-Ergebnis `dist/geschaeftsobjekt-explorer.html`
gehört mit in den Commit, andere `dist/*.html` nicht. Nach jedem Commit nach
`origin/main` pushen.
