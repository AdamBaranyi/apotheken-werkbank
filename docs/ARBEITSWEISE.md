# Arbeitsweise

Wie dieses Repo entsteht. Der grösste Teil des Codes wird von einem KI-Agenten geschrieben
(Claude Code); verantwortet wird er vom Menschen: Er legt fest, was gebaut wird, prüft, was
herauskommt, und entscheidet, was bleibt. Diese Datei hält fest, wie das hier konkret aussieht,
damit es nachprüfbar ist und nicht nur behauptet.

## Spezifikation vor Code

- **Ein schriftlicher Auftrag zuerst:** Ziel, Umfang, Regeln, Ablauf in Abenden mit Gates und
  einer Kürzungsreihenfolge, falls die Zeit nicht reicht. Offene Fragen werden gebündelt
  gestellt und beantwortet, bevor gebaut wird; die Antworten stehen in `docs/ENTSCHEIDE.md`.
- **Fertig heisst grün:** Ein Teil gilt erst als fertig, wenn seine Prüfungen in der CI laufen
  und grün sind. Was nur lokal oder nur auf dem Papier geprüft ist, steht als offen im Bericht.

## Prüfen gegen das echte System

- Datenbankregeln werden gegen eine echte Datenbank mit denselben Rollen geprüft, nicht gegen
  Attrappen; die Engine gegen ein echtes Windows mit echter OCR.
- Skripte (Sicherheitslauf, Meldungen) werden im Ablauf geprüft: fremde Programme ersetzt eine
  Attrappe, die jeden Aufruf mitschreibt und unbekannte Aufrufe meldet.

## Sabotage

Jede Prüfung muss einmal rot gesehen werden. Dafür wird absichtlich ein Fehler eingebaut
(eine Zeile zu viel, eine fehlende Regel, ein vertauschter Wert), der passende Test muss
scheitern, danach wird zurückgebaut. Eine Sabotage, die grün bleibt, ist ein Befund über den
Test – oder über überflüssigen Code.

## Was die KI vorschlug und was verworfen wurde

Ergänzt an jedem Abend. Format: Vorschlag, Entscheid, Grund.

| Datum      | Vorschlag                                              | Entscheid | Grund                                                          |
| ---------- | ------------------------------------------------------ | --------- | -------------------------------------------------------------- |
| 26.10.2026 | Engine «Kassenflow» nennen                             | verworfen | Name einer aktiven Kassen-App (E1)                             |
| 26.10.2026 | Gesprächsvorbereitung als `docs/GESPRAECH.md` ins Repo | verworfen | öffentliches Repo, verrät den Anlass (E7)                      |
| 26.10.2026 | Pester 6 statt 5                                       | verworfen | bekannte Schnittstelle zählt mehr als die neueste Fassung (E8) |
