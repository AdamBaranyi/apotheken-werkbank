# Rezept für einen Prototyp in zwei Stunden

Ein Prototyp beantwortet eine Frage, bevor jemand ein Produkt baut. Er ist klein, mit erfundenen
Daten, und endet mit einer Messung und einem Entscheid. Was danach kommt, ist ein eigenes Vorhaben.

## Die sechs Schritte

| Schritt                | Zeit   | Ergebnis                                                              |
| ---------------------- | ------ | --------------------------------------------------------------------- |
| 1. Frage               | 10 min | Ein Satz, der mit Ja oder Nein oder einer Zahl endet                  |
| 2. Nutzer              | 10 min | Wer hat das Problem, was tut diese Person heute stattdessen           |
| 3. Kleinste Oberfläche | 15 min | Was mindestens sichtbar sein muss, um die Frage zu beantworten        |
| 4. Attrappen-Daten     | 20 min | Erfundene Daten mit den schwierigen Fällen, nicht nur dem glatten Weg |
| 5. Bauen und messen    | 50 min | Auf Bestehendem aufbauen; Messung von Anfang an mitschreiben          |
| 6. Entscheid           | 15 min | Weiter, ändern oder lassen, mit Grund und den offenen Fragen          |

## Regeln

- **Nur was die Frage braucht.** Kein Login, kein Design, keine Einstellungen, wenn die Frage sie
  nicht braucht. Bestehende Teile wiederverwenden (hier: Engine, Flows, Kassen-Attrappe).
- **Schwierige Fälle zuerst in die Daten.** Ein Prototyp, der nur den glatten Weg zeigt, beweist
  nichts. Abgelaufen, doppelt, unbekannt, falsch geschrieben gehören hinein.
- **Messen statt behaupten.** Wie viele Fälle laufen durch, wie viele braucht einen Menschen, wie
  lange dauert einer. Die Zahlen stehen im Entscheid.
- **Tests, aber schlank.** Die Regeln, die über Geld oder Gesundheit entscheiden, bekommen Tests;
  der Rest nicht.
- **Ehrlich enden.** Der Entscheid sagt auch, was der Prototyp nicht beantwortet.

## Umgesetzt

- [`prototypen/rezept-zur-kasse/`](../prototypen/rezept-zur-kasse/README.md): Ein erfundener
  Rezeptdatensatz aus einer Telemedizin-Attrappe legt über die Engine den Verkauf in der
  Kassen-Attrappe an.
