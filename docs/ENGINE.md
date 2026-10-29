# Engine: eine Kasse nur über den Bildschirm bedienen

Die Werkbank-Engine bedient eine Windows-Kasse ohne Schnittstelle so, wie ein Mensch es tut:
Bildschirmfoto, Text und Lage per OCR lesen, Maus und Tastatur steuern, das Ergebnis wieder per
OCR prüfen. Was sie an einer Kasse tut, steht nicht im Code, sondern in einem **Flow** je
Apotheke (`flows/<apotheke>/<flow>.yaml`). Ziel ist die eigene Kassen-Attrappe (WinForms-Fenster
in zwei Layouts = zwei Apotheken); echte Kassensoftware kommt in diesem Repo nicht vor.

## Aufbau

| Schicht         | Datei                                                   | Aufgabe                                                                                                      |
| --------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Treiber-Vertrag | `engine/src/Treiber/*.ps1`                              | `Fenster(titel)`, `Bildschirm(fenster)`, `Vordergrund`, `Klick(x, y)`, `Tippen(text)`, `Taste(name)`, `Foto` |
| Windows-Treiber | `Windows.ps1`, `Win32.cs`, `ocr51.ps1`                  | echtes Fenster, `CopyFromScreen`, `Windows.Media.Ocr`, `SendInput`                                           |
| Fake-Treiber    | `Fake.ps1` + `attrappe/src/Simulation.ps1`              | dieselbe Kasse als Wörter mit Lage, für Pester auf dem Mac und unter Linux                                   |
| Lauf            | `Lauf.ps1`, `Schritte.ps1`, `Warten.ps1`, `Bericht.ps1` | Schritte ausführen, warten, wiederholen, wo es sicher ist, Bericht schreiben                                 |
| Flows           | `Flow.ps1`, `flow.schema.json`, `Auftrag.ps1`           | laden, prüfen (`lint`), Variablen einsetzen, Aufträge prüfen                                                 |

Die Kassen-Attrappe (`attrappe/`) hat eine Logik (`Kasse.ps1`), zwei Layouts
(`layouts/nord.psd1`, `layouts/sued.psd1`) und zwei Oberflächen: das echte WinForms-Fenster
(`Fenster.ps1`) und die Simulation für den Fake-Treiber. Beide bauen auf demselben Layout und
derselben Logik auf; jeder Text, den die Engine liest, entsteht an einem Ort.

## Aufrufen

```bash
pwsh engine/werkzeuge.ps1                       # Module in festen Fassungen
pwsh engine/werkbank.ps1 lint                   # alle Flows prüfen
pwsh engine/werkbank.ps1 run -Apotheke nord -Flow verkauf -Auftrag flows/beispiele/verkauf-bar.json -Treiber fake
pwsh engine/werkbank.ps1 run -Apotheke nord -Flow verkauf -Auftrag flows/beispiele/verkauf-bar.json -DryRun
pwsh engine/tests/pester.ps1                    # alle Tests ohne Bildschirm
node scripts/sabotage.mjs engine                # jede Schutzfunktion einmal kaputt
```

Unter Windows mit Bildschirm läuft `run` ohne `-Treiber fake` gegen das echte Fenster
(`pwsh attrappe/start.ps1 -Variante nord`). Exit-Codes: 0 erledigt, 1 abgebrochen, 2 unklar.

## Ein Flow

```yaml
flow: verkauf
apotheke: nord
fenster: Kasse Nord # Teil des Fenstertitels
eingaben: [kennung, positionen, zahlung, gegeben?] # ? = optional
dialoge: # Stufe 1: bekannte Dialoge wegklicken
  - text: Neue Preisliste verfügbar
    klicke: Später
fehler: [Gegeben reicht nicht, Bon ist leer] # Meldungen, die sofort abbrechen
schritte:
  - klicke: Bon leeren
    danach: Neuer Bon
    wiederholbar: true
  - eingeben: { neben: PZN, dx: 60, text: '${pos.pzn}' }
  - klicke: Bar
    kritisch: true
  - lies: { muster: 'Beleg (\d+) gebucht', als: beleg, zeit: 15 }
```

| Schritt        | Was er tut                                                                                                                 |
| -------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `klicke`       | Text suchen und in seine Mitte klicken; mit `danach` auf den neuen Zustand warten                                          |
| `eingeben`     | Feld neben (`dx` ab linkem Rand des Ankers) oder unter (`dy` ab oberem Rand) einem Anker anklicken, leeren, tippen, prüfen |
| `taste`        | Enter, Escape, Tab oder Backspace                                                                                          |
| `warte-bis`    | warten, bis ein Text (oder einer aus `eins-von`) erscheint                                                                 |
| `pruefe`       | wie `warte-bis`, aber kurz                                                                                                 |
| `lies`         | warten, bis eine Zeile zum Muster passt, und die Gruppen als Werte merken                                                  |
| `beenden-wenn` | ist der Text sichtbar, endet der Lauf mit dem genannten Status (`bereits-gebucht`, `nichts-offen`, `ok`)                   |
| `fuer-jede`    | Schritte je Eintrag einer Liste aus dem Auftrag; `${pos.nr}` zählt ab 1                                                    |

Zusätze: `wenn: { wert, ist }`, `wenn-sichtbar: <text>`, `danach`, `wiederholbar`, `kritisch`,
`zeit` (Sekunden), `genau` (exakter Vergleich, für Kennungen). `lint` prüft das Schema, genau eine
Aktion je Schritt, unbekannte Schlüssel, Variablen (Eingaben, gelesene Werte, Schleifenvariable nur
in ihrer Schleife), reguläre Ausdrücke, `kritisch` gegen `wiederholbar` und ob Datei und Ordner zu
Flow und Apotheke passen.

## Ein Auftrag

```json
{
  "kennung": "K7-QX4M",
  "zahlung": "bar",
  "gegeben": "50,00",
  "positionen": [
    { "pzn": "99100008", "menge": 3 },
    { "pzn": "99104118", "menge": 1, "rezept": true }
  ]
}
```

Die **Kennung** besteht aus Zeichen, die eine OCR nicht verwechselt (2–9 und Buchstaben ohne B, G,
I, L, O, S, U, Z). Sie steht als Referenz auf dem Beleg; vor jedem Verkauf sucht der Flow sie im
Journal der Kasse.

## Stabil halten: die Regeln

1. **Jede Prüfung fotografiert neu.** Kein Klick auf Koordinaten eines älteren Bildes. Die Lage
   rechnet die Engine relativ zum Fenster, das sie vor jedem Bild neu sucht; ein verschobenes
   Fenster stört so nicht.
2. **Nach einer Aktion zählt nur ein neuer Zustand.** Die Attrappe löscht das alte Suchergebnis,
   sobald jemand ins Suchfeld tippt, und «Bon leeren» setzt die Statuszeile zurück. Sonst läse
   die Engine die Antwort von gestern.
3. **Fehlermeldungen der Kasse brechen sofort ab.** Alt ist nur, was beim Start schon dastand,
   und nur bis es verschwindet. Gemessen im Test: Ohne diese Regel lief ein Verkauf weiter, nachdem
   die Kasse einen Rx-Artikel ohne Rezept abgelehnt hatte, und buchte eine von zwei Positionen.
4. **Wiederholt wird nur, was sicher ist.** `eingeben` immer (es leert das Feld zuerst), ein Klick
   oder eine Taste nur, wenn sie nicht gesendet wurden oder der Flow es erlaubt. Warten wird nicht
   wiederholt; die Zeit im Flow ist das ganze Budget.
5. **Ein kritischer Schritt wird nie zweimal gesendet.** Fehlt danach die Bestätigung, heisst der
   Status «unklar» (Exit-Code 2). Ein neuer Lauf mit derselben Kennung findet den Beleg über die
   Referenz und endet mit «bereits gebucht». Dasselbe Muster wie beim Bestellen über MSV3: Die ID
   steht vor dem Senden fest, und nach einem Abbruch fragt man nach, statt neu zu senden.
6. **Mehrdeutig heisst nicht klicken.** Steht ein Ziel an zwei gleich guten Stellen, bricht der
   Schritt ab. Die Layouts sind so gebaut, dass kein Knopftext zweimal vorkommt (`Test-KassenLayout`).
7. **Bekannte Dialoge** aus dem Flow klickt die Engine vor jedem Bild weg (Stufe 1). Ein unbekannter
   Dialog führt zum Abbruch mit Bildschirmfoto, oder zur Selbstheilung (Stufe 2).

## Fallstricke, gemessen

- **OCR-Sprache:** Auf dem Windows-Läufer gibt es nur Englisch. Deutsch nachzuinstallieren
  (`Add-WindowsCapability Language.OCR~~~de-DE`) brach nach 12 Minuten ab. Englisch liest Umlaute,
  ß und € trotzdem richtig.
- **Kleine Kassenschrift:** Segoe UI 9 pt, gelesen von `Windows.Media.Ocr`: einfach 18 von 20
  Prüfwörtern, doppelt hochskaliert 19 von 20 («15,34» wurde «1 5,34»), dreifach 20 von 20. Die
  Engine skaliert dreifach.
- **OCR-Vertrauen:** `Windows.Media.Ocr` liefert keinen Wert für die Sicherheit. Die Engine
  vergleicht darum selbst: Ähnlichkeit nach Levenshtein mit Schwelle 0,85, Wörter bis drei
  Zeichen genau, Kennungen mit `genau`. O/0, I/l/1, S/5, B/8 und Z/2 zählen gleich.
- **PowerShell 7 und WinRT:** .NET kennt die WinRT-Typen nicht mehr ohne Zusatzpaket. Die OCR
  läuft darum in Windows PowerShell 5.1 als Unterprozess (`ocr51.ps1`, nur ASCII). Preis: jedes Bild
  etwa 1,5 Sekunden, weil 5.1 jedes Mal neu startet.
- **DPI:** `SetProcessDpiAwarenessContext` vor dem ersten Bild, sonst stimmen Bildschirmfoto und
  Klickkoordinaten bei Skalierung über 100 % nicht überein. Der Läufer hat 96 DPI, 1024 × 768.
- **Fokus:** Eingaben gehen an das Fenster, das vorne ist. Die Engine holt das Kassenfenster vor
  jedem Bild nach vorne und prüft jede Eingabe im Feld. Tippen ins Leere fiel im Test als
  «Eingabe nicht sichtbar» auf und wurde wiederholt.
- **Felder leeren:** Die Attrappe leert ein Feld mit Escape. Ohne Leeren hängt ein zweiter Versuch
  den Text an den ersten («99100008» wird «9910000899100008»).

## Eine neue Apotheke ausrollen

1. Die Kasse ansehen: Fenstertitel, Beschriftungen, wo die Felder relativ zu ihnen liegen, welche
   Rückfragen kommen, welche Meldungen einen Fehler bedeuten.
2. Einen bestehenden Flow nach `flows/<apotheke>/` kopieren und Fenster, Anker, Abstände, Texte
   und Zusatzschritte anpassen.
3. `pwsh engine/werkbank.ps1 lint`, dann `run -DryRun` an der echten Kasse: Fenster gefunden,
   welche Anker sichtbar sind.
4. Gegen eine Testkasse oder einen Testmandanten laufen lassen, Bericht und Bildfolge ansehen.
5. Freigeben: Pull Request mit grüner CI.

## Tests

- **Pester ohne Bildschirm** (Mac, Linux, Windows): Textabgleich, Flows und `lint`, Aufträge,
  Kassenlogik, Layouts, Simulation, Läufe mit dem Fake-Treiber samt Chaos (springendes und
  wanderndes Fenster, langsame Kasse, Nullen als O, Dialoge), Kommandozeile.
- **Echte Läufe** (`engine/tests/Windows.Tests.ps1`, nur Windows): beide Apotheken, Bar und Karte,
  nie doppelt, Abschluss, Chaos im echten Fenster. Was gebucht wurde, prüfen die Tests am Journal,
  das die Attrappe schreibt, nicht an der OCR.
- **Sabotagen** (`scripts/sabotagen-engine.mjs`): jede Schutzfunktion einmal kaputt; der passende
  Test muss rot werden.
