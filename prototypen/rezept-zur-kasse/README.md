# Prototyp: Rezeptdatensatz → Kasse

Nach [`docs/PROTOTYP-REZEPT.md`](../../docs/PROTOTYP-REZEPT.md), in zwei Stunden. Alle Daten sind
erfunden: Telemedizin-Attrappe, Ärztin, Patienten-Pseudonyme, Artikel.

## 1. Frage

Kann ein Rezeptdatensatz, der elektronisch von einer Telemedizin-Plattform kommt, ohne Abtippen als
Verkauf in der Kasse landen? Und wie viele Fälle muss danach noch ein Mensch anfassen?

## 2. Nutzer

Die PTA am HV-Tisch. Heute liest sie das Rezept am Bildschirm, tippt jede PZN und Menge in die Kasse,
bestätigt «Rezept liegt vor» und kassiert. Bei vielen Rezepten aus der Telemedizin ist das reine
Abschreibarbeit, mit Tippfehlern als Risiko.

## 3. Kleinste Oberfläche

Keine eigene. Ein Ordner mit Datensätzen geht hinein, die bestehende Engine bucht über den Flow
`nord/verkauf` an der Kassen-Attrappe, heraus kommt eine Tabelle mit Ergebnis und Grund je
Datensatz. Wiederverwendet: Engine, Flow, Kassen-Attrappe, Kennung als Referenz gegen Doppelbuchung.

## 4. Attrappen-Daten

Zehn Datensätze in [`daten/rezepte/`](daten/rezepte), mit den schwierigen Fällen zuerst:
abgelaufen (`tm-104`), PZN mit falscher Prüfziffer (`tm-106`), Artikel, den die Kasse nicht kennt
(`tm-105`), unvollständig (`tm-109`) und ein Rezept, das die Plattform zweimal schickt (`tm-107` =
`tm-101`). Die Kennung für die Engine leitet sich aus der Rezept-ID ab (SHA-256, Alphabet der Engine);
dasselbe Rezept hat darum immer dieselbe Kennung und wird kein zweites Mal gebucht.

## 5. Messung

`pwsh prototypen/rezept-zur-kasse/start.ps1 -Heute 2026-10-29`, Test-Treiber, Kasse Nord:

| Datensatz                  | Ergebnis      | Grund                                             |
| -------------------------- | ------------- | ------------------------------------------------- |
| tm-101, 102, 103, 108, 110 | gebucht       | Belege 1001 bis 1005, jede Rx-Position mit Rezept |
| tm-107-doppelt             | schon gebucht | Kennung im Journal gefunden, nichts gebucht       |
| tm-104-abgelaufen          | abgelehnt     | Rezept abgelaufen am 20.10.2026                   |
| tm-106-pruefziffer         | abgelehnt     | PZN 99104119: Prüfziffer falsch                   |
| tm-109-unvollstaendig      | abgelehnt     | Positionen fehlen                                 |
| tm-105-unbekannt           | abgebrochen   | Kasse meldet: Artikel unbekannt: 12345678         |

**5 von 10 automatisch gebucht, 1 Doppel ohne Menschen erkannt, 4 mit klarem Grund für einen
Menschen.** Drei davon fing die Prüfung vor der Kasse ab, einen die Kasse selbst; gebucht wurde in
keinem dieser Fälle. Dauer mit dem Test-Treiber 1,0 s je Buchung; mit echter OCR auf Windows dauert
ein Verkauf dieser Grösse nach den Läufen der Engine etwa 35 bis 45 s, fast ganz für das Lesen des
Bildschirms (rund 1,5 s je Bild).

## 6. Entscheid

**Weiter, aber mit anderem Ziel: vorbereiten statt buchen.** Technisch trägt der Weg: kein Abtippen,
keine Doppelbuchung, jeder Fehler mit Grund. Für eine echte Apotheke fehlt aber, was der Prototyp
bewusst nicht beantwortet:

- **Pharmazeutische Prüfung.** Ein Rezept wird vor der Abgabe von Fachpersonal geprüft
  (Plausibilität, Wechselwirkungen, Dosierung). Darum sollte die Engine den Bon nur **vorbereiten**
  und das Kassieren dem Menschen lassen: ein Flow ohne kritischen Schritt.
- **Woher die Daten wirklich kommen.** Echte E-Rezepte laufen über die Telematikinfrastruktur,
  signiert (QES), mit einem Abgabedatensatz zurück. Ein JSON aus einer Plattform ist eine Annahme.
- **Kassenrezept, Zuzahlung, BtM, Kühlware.** Nicht abgebildet; der Prototyp nimmt nur
  Kartenzahlung für Selbstzahler.

Nächster Schritt wäre eine Stunde mit einer PTA: Hilft ein vorbereiteter Bon, und welche der vier
Fälle für einen Menschen kommen im Alltag wirklich vor?

## Tests

`pwsh engine/tests/pester.ps1 -Pfad prototypen/rezept-zur-kasse/tests`: Prüfregeln, Kennung und
der ganze Stapel gegen den Test-Treiber; zwei Sabotagen (abgelaufenes Rezept, Kennung je Lauf neu)
in `scripts/sabotagen-engine.mjs`.
