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

## Bug-Kette

Ein gefundener Fehler läuft immer gleich durch: Issue mit Schritten zum Nachstellen und
vermuteter Ursache, ein Test, der den Fehler zeigt und zuerst rot in die CI geht, dann der Fix
im selben Pull Request, grüner Lauf, Merge mit «Fixes #…». Eine Sabotage hält fest, dass der
Test den Fehler wirklich fängt.

Erstes Beispiel: #1, gefunden beim Bau der Kasse. Lief die Sitzung ab, während ein Formular
offen war, endete das Senden auf einer englischen Fehlerseite, weil `proxy.ts` auch Aufrufe von
Server-Aktionen umleitete. Pull Request #2: erster Commit nur der Test (rot), zweiter der Fix.

## Was die KI vorschlug und was verworfen wurde

Ergänzt an jedem Abend. Format: Vorschlag, Entscheid, Grund.

| Datum      | Vorschlag                                                              | Entscheid | Grund                                                                                                           |
| ---------- | ---------------------------------------------------------------------- | --------- | --------------------------------------------------------------------------------------------------------------- |
| 26.10.2026 | Engine «Kassenflow» nennen                                             | verworfen | Name einer aktiven Kassen-App (E1)                                                                              |
| 26.10.2026 | Gesprächsvorbereitung als `docs/GESPRAECH.md` ins Repo                 | verworfen | öffentliches Repo, verrät den Anlass (E7)                                                                       |
| 26.10.2026 | Pester 6 statt 5                                                       | verworfen | bekannte Schnittstelle zählt mehr als die neueste Fassung (E8)                                                  |
| 26.10.2026 | SOAP-Server mit dem Paket `soap`                                       | verworfen | Grenzen und Anmeldung sollen sichtbar vor dem Parsen laufen; `soap` prüft stattdessen als Client die WSDL (E12) |
| 26.10.2026 | MSV3-Operationen aus dem Gedächtnis modellieren                        | verworfen | Pflichtenheft 1.0h als öffentliche Quelle gefunden, Namen von dort (docs/MSV3.md)                               |
| 26.10.2026 | Registrierung mit `[auth.email] enable_signup = false` sperren         | verworfen | gemessen: sperrt auch die Anmeldung; richtig ist `[auth] enable_signup = false` (E16)                           |
| 26.10.2026 | Verschlüsselung im Einrichtungsskript als eigene Kopie                 | verworfen | im Review: zwei Kopien laufen auseinander; das Skript nutzt jetzt die Funktion der App                          |
| 26.10.2026 | AES-GCM ohne `authTagLength`                                           | verworfen | im Review: Node 24 nahm einen auf 4 Byte gekürzten Prüfwert an; Test und Sabotage ergänzt                       |
| 26.10.2026 | SSRF-Test nur gegen 169.254.169.254                                    | ergänzt   | unter Sabotage fiele er nur durch Zeitüberschreitung auf; zuerst eine erreichbare, nicht freigegebene Adresse   |
| 26.10.2026 | Vorschau-Deploys mit dem Schlüssel der Produktion                      | verworfen | ungeprüfter Code in Vorschauen; eigener Zufallsschlüssel (E19)                                                  |
| 26.10.2026 | Demo-Konten per SQL direkt in `auth.users` anlegen                     | verworfen | Passwörter gehören in Adams Passwortmanager, nicht in den Verlauf einer KI (E21)                                |
| 27.10.2026 | Kasse über SECURITY-DEFINER-Funktionen in `public` schreiben           | verworfen | je Funktion ein Advisor-Befund; Regeln an den Tabellen gelten für jeden Weg (E22)                               |
| 27.10.2026 | Doppelklick mit `on conflict do nothing` abfangen                      | verworfen | der Trigger zählte vorher hoch: Lücke in den Belegnummern (E22)                                                 |
| 27.10.2026 | Bremse als Funktion für anon über REST                                 | verworfen | Advisor 0028, für jeden mit dem öffentlichen Schlüssel erreichbar (E23)                                         |
| 27.10.2026 | 5 Fehlversuche je Konto                                                | verworfen | im Browser-Test gemessen: sperrt das echte Konto; jetzt Konto und IP 5, Konto 10 (E23)                          |
| 27.10.2026 | TLS zum Pooler mit `rejectUnauthorized: false`                         | verworfen | CA von Supabase mitgeliefert, Fingerabdruck notiert (E23)                                                       |
| 27.10.2026 | Beleg-PDF mit einer Bibliothek                                         | verworfen | ohne Pflege oder mit Schriftdateien zur Laufzeit; ein Bon ist eine Spalte Text (E24)                            |
| 27.10.2026 | Bestellen mit Liefervorgabe «Normal»                                   | verworfen | im Test gemessen: liefert weniger, als die Verfügbarkeit zeigte (E25)                                           |
| 27.10.2026 | Mengen still runden (2,5 → 2)                                          | verworfen | bei einer verbindlichen Bestellung eine Meldung statt einer stillen Änderung                                    |
| 27.10.2026 | Lighthouse als Abhängigkeit im Lockfile                                | verworfen | brächte Fehler-Client und Puppeteer in jede Installation; `npx` mit fester Fassung (E26)                        |
| 28.10.2026 | Gleicher Schlüssel liefert immer den vorhandenen Beleg                 | verworfen | Durchsicht vor dem Merge: Ein geänderter Bon erschiene still als der alte; Inhalt verglichen, WK011 (E22)       |
| 28.10.2026 | Bremse prüft und zählt in zwei Aufrufen                                | verworfen | Durchsicht: gleichzeitige Versuche kamen zusammen über die Grenze; ein Aufruf unter Sperre (E23)                |
| 28.10.2026 | Anmeldung bei gestörter Bremse durchlassen                             | verworfen | Durchsicht: erst überlasten, dann unbegrenzt raten; die Anmeldung sperrt jetzt (E23)                            |
| 28.10.2026 | Statusabfrage gleich nach dem Abbruch                                  | verworfen | Durchsicht: «nicht angekommen» zu früh lädt zum zweiten Bestellen ein (E25)                                     |
| 28.10.2026 | Fault ohne MSV3-Angaben als ServerException                            | verworfen | Durchsicht: Ob ausgeführt, weiss niemand; jetzt «unklar» (E25)                                                  |
| 29.10.2026 | Deutsche OCR-Sprache auf dem Läufer nachinstallieren                   | verworfen | gemessen: Abbruch nach 12 Minuten; Englisch liest Umlaute, ß und € (E32)                                        |
| 29.10.2026 | Vor der OCR doppelt hochskalieren                                      | verworfen | gemessen: 19 von 20 Prüfwörtern, dreifach 20 von 20 (E32)                                                       |
| 29.10.2026 | Checkbox «Rezept liegt vor» in der Kassen-Attrappe                     | verworfen | eine OCR sieht keinen Haken; Rückfrage als Dialog mit Text                                                      |
| 29.10.2026 | Knopf «Suchen» neben der Beschriftung «Referenz suchen»                | verworfen | zweimal «suchen» auf dem Bildschirm, die Engine dürfte nicht klicken                                            |
| 29.10.2026 | Status «Beleg gebucht (Karte)»                                         | verworfen | nach einer Kartenzahlung stünde zweimal «Karte» auf dem Bildschirm                                              |
| 29.10.2026 | Flows nur mit dem JSON-Schema prüfen                                   | ergänzt   | Test-Json nennt bei verschachtelten Fehlern keine Stelle; eigene Prüfung mit Schrittnummer (E30)                |
| 29.10.2026 | Alte Fehlermeldungen vor jeder Aktion neu merken                       | verworfen | im Test buchte ein Verkauf weiter, nachdem die Kasse einen Rx-Artikel abgelehnt hatte (E34)                     |
| 29.10.2026 | Warteschritte wie Aktionen wiederholen                                 | verworfen | verdreifacht die Frist; aus «unklar» wurde im Test «ok» (E33)                                                   |
| 29.10.2026 | Suchergebnis der Kasse stehen lassen, bis die nächste Suche fertig ist | verworfen | die Engine könnte das alte Ergebnis lesen; Tippen ins Suchfeld löscht es jetzt                                  |
