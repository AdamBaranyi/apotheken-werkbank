# Sicherheit

Gilt ab dem ersten Commit. Dieses Repo ist öffentlich; es enthält keine echten Daten, keine
echten Zugänge und keine Geheimnisse. Geheimnisse liegen nur in Vercel, Supabase und den
Secrets von GitHub Actions.

## Automatische Prüfungen

| Wann                                          | Was                                                                                       | Folge                                                                                                                    |
| --------------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Jeder Push auf `main`, jeder Pull Request     | gitleaks über die ganze Historie, Format, Dateilänge, Tests, `bash scripts/audit.sh high` | rot blockiert                                                                                                            |
| Täglich 06:17 UTC (`sicherheit-taeglich.yml`) | gitleaks, `bun audit` ab moderat                                                          | rot nur bei einem Geheimnis oder wenn der Audit selbst scheitert; Befunde kommen in **ein** Issue «Sicherheitsmeldungen» |
| Wöchentlich (Dependabot)                      | Updates mit sieben Tagen Wartezeit, Minor und Patch als ein Sammel-PR                     | gemergt wird nur, was grün ist                                                                                           |
| Montags (`erinnerung-woechentlich.yml`)       | offene Pull Requests                                                                      | Erinnerungs-Issue, nur wenn etwas offen ist                                                                              |
| Monatlich (`erinnerung-monatlich.yml`)        | Wartungsliste                                                                             | Issue mit Checkliste                                                                                                     |

Lokal: `bunfig.toml` setzt `exact = true` und eine Wartezeit von sieben Tagen
(`minimumReleaseAge`). Actions sind an Commits geheftet, nicht an Tags.

Die beiden Skripte des täglichen Laufs werden im Ablauf getestet, mit Attrappen für `bun`
und `gh` vorn auf `PATH` (`tests/`), nicht an ihrem Text.

## Umgang mit Befunden

- **high und critical mit Fix:** sofort, wenn das Paket zur Laufzeit erreichbar ist; sonst
  mit dem nächsten Update-PR. Die CI blockiert ab high ohnehin jeden Pull Request.
- **moderate:** mit dem nächsten Update-PR.
- **Ohne Fix:** namentlich und befristet ausnehmen, im Skript und hier, mit Grund und Datum
  «prüfen bis». `tests/audit-skript.test.ts` hält Skript und diese Datei deckungsgleich.
- **Transitive Pakete:** zuerst prüfen, ob der Bereich des Elternpakets die behobene Fassung
  erlaubt (dann genügt das Lockfile), sonst ein enges Override auf genau eine Fassung.
- **Wartezeit und dringender Fix:** das Paket für genau einen `bun install` in
  `minimumReleaseAgeExcludes` eintragen, danach wieder entfernen.

## Ausnahmen

Keine.

## Regeln im Code

Umgesetzt (Abend 1):

- Seiten und Server-Aktionen prüfen die Sitzung selbst; das Layout allein ist keine Sperre.
  Die Datenbank prüft dieselbe Zugehörigkeit noch einmal über Row Level Security, mit Tests
  als anon, als Mitglied, als Mitarbeiter und als Fremder (`supabase/tests/`).
- Zod an jeder Grenze: Formulare, Umgebung des Servers, Antworten des Grosshändlers.
- Zugänge zum Grosshandel verschlüsselt (AES-256-GCM, Prüfwert immer 16 Byte), der Schlüssel
  nur in der Umgebung des Servers. Aufrufe nur an Adressen aus `GROSSHANDEL_ERLAUBT` (SSRF).
- Content Security Policy mit Nonce je Anfrage, Sicherheits-Kopfzeilen, keine Anfragen an
  Dritte; die Browser-Tests prüfen das in jeder Breite.
- Funktionen mit SECURITY DEFINER stehen nicht im veröffentlichten Schema, bis auf eine
  begründete (siehe unten); `supabase/tests/schnittstelle.test.ts` prüft das wie der Advisor.

Umgesetzt (Abend 2):

- Kasse: Belege werden nur angehängt; Preise, Steuersätze, Nummern und Summen setzt die
  Datenbank, die Rezeptpflicht prüft sie selbst. Die Regeln stehen an den Tabellen und gelten
  auch für direkte Aufrufe der REST-Schnittstelle (E22, `supabase/tests/kasse.test.ts`).
- Bestellungen: ID vor dem Senden, Status nur entlang der Antworten des Grosshändlers (E25).
- Bremse für Anmeldung und Grosshändler über eine eigene Datenbankrolle, nur HMAC-Werte, TLS
  gegen die CA von Supabase (E23). Prüfen und Zählen in einem Aufruf unter Sperre; ist sie
  gestört, sperrt die Anmeldung.
- Sitzungs-Cookies `httpOnly`, `SameSite=Lax`, im Produktionsbuild `Secure`; die Browser-Tests
  prüfen, dass kein Skript sie lesen kann.
- Dazu `Cross-Origin-Resource-Policy: same-origin` und eine längere `Permissions-Policy`;
  Seiten mit Daten und der Beleg als PDF gehen mit `no-store` hinaus.
- Server-Aktionen ohne Sitzung leitet `proxy.ts` nicht um; die Aktion leitet selbst um (#1).

Umgesetzt (Abend 3 und 4, Engine):

- Nie doppelt buchen: Kennung des Auftrags als Referenz auf dem Beleg, ein buchender Schritt wird
  nie zweimal gesendet («unklar» statt raten), verkauft wird nur, wenn die Kasse die Kennung
  sicher als «unbekannt» meldet (E33, E39).
- Selbstheilung: Ausgeführt wird nur ein Ziel aus `heilung.klickbar` des Flows, das eindeutig
  sichtbar ist, dazu Escape oder Warten; Deckel drei je Lauf und 20 je Tag. Der Systemprompt sagt,
  dass Bildschirmtext Daten sind, keine Anweisung; die Sicherheit hängt aber an der Liste, nicht
  am Modell (E35). Vier Sabotagen halten Liste, Sichtbarkeit und Deckel fest.
- Der API-Schlüssel kommt nur aus der Umgebung, bleibt modulintern und steht in keinem Bericht.
  Aufrufe mit dem echten Modell laufen in der CI nur auf `main` oder von Hand, nie in einem Pull
  Request (E5).
- Engine-Konten sind keine Mitglieder: Sie fügen Läufe und Fotos ein und lesen nichts. Die Apotheke
  setzt die Datenbank (Spalte ohne Insert-Recht), ein Foto hängt über einen zusammengesetzten
  Fremdschlüssel nur an einem Lauf derselben Apotheke (E36, `supabase/tests/engine.test.ts`).
- Fotos im Flow-Monitor liest die Web-App mit der Sitzung der angemeldeten Person; es gilt
  dieselbe Regel je Apotheke wie für alle Daten.

## Bewusst offen

| Meldung                                                | Wo                                                                   | Grund                                                                                                                                                                                                 |
| ------------------------------------------------------ | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Advisor 0029 (SECURITY DEFINER, aufrufbar)             | `public.zugang_fuer_bestellung`                                      | Der Server holt damit im Namen der angemeldeten Person den Geheimtext eines Zugangs der eigenen Apotheke (E17). Ohne den Schlüssel des Servers ist er nutzlos; anon darf die Funktion nicht aufrufen. |
| Advisor 0005 (Index unbenutzt)                         | alle Indizes für Fremdschlüssel und Regeln (Stand 28.10.2026: sechs) | Frische Datenbank ohne Last; die Indizes tragen die Regeln je Apotheke, die Fremdschlüssel und die Zähler der Bremse.                                                                                 |
| Lighthouse über `npx`                                  | CI, `scripts/lighthouse.mjs`                                         | Feste, über sieben Tage alte Fassung; ihre Unterpakete stehen in keinem Lockfile. Der Lauf hat keine Geheimnisse und nur Leserechte (E26).                                                            |
| CA von Supabase aus der Kette übernommen               | `web/lib/supabase-ca.ts`                                             | Gleicher Fingerabdruck an zwei Pooler-Adressen; der Abgleich mit dem Download im Dashboard steht noch aus.                                                                                            |
| Bremse beim Grosshändler lässt bei Ausfall durch       | `web/lib/bremse.ts`                                                  | Bestellen geht vor; der Ausfall steht im Protokoll. Die Anmeldung sperrt dagegen (E23).                                                                                                               |
| Ohne `BREMSE_DATENBANK_URL` keine eigene Bremse        | Umgebung auf Vercel                                                  | Vorschauen haben keine Rolle für die Bremse; dann begrenzt nur Supabase. In der Produktion gehört sie gesetzt (BETRIEB.md, Schritt 8).                                                                |
| Status einer Bestellung schreibt das Mitglied          | `public.bestellungen`                                                | Kopie der Antwort des Grosshändlers, nur entlang erlaubter Wechsel; massgeblich bleibt der Grosshändler (Statusabfrage). Vorgesehen: Statuswechsel nur über eine eigene Rolle des Servers.            |
| Bildschirmfotos und Bildschirmtext im Monitor          | `engine_fotos`, `engine_laeufe.bericht`                              | Hier zeigen sie nur die Attrappe. Bei einer echten Kasse stehen Gesundheitsdaten darauf: Speicherort, Frist und Zugriff gehören dann vorher geklärt.                                                  |
| Selbstheilung schickt ein Bildschirmfoto an ein Modell | `engine/src/Heiler.ps1`                                              | Hier nur die Attrappe. Bei einer echten Kasse nur mit einem Modell, bei dem die Daten bleiben dürfen (E35).                                                                                           |

## Behobene Befunde

| Datum      | Befund                                                                                                                      | Behebung                                                                                          |
| ---------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| 26.10.2026 | Ein Zugang mit falschem Schlüssel liess die Seite Bestellen abstürzen                                                       | Meldung statt Absturz, Test und Sabotage                                                          |
| 26.10.2026 | AES-GCM nahm in Node 24 einen auf 4 Byte gekürzten Prüfwert an                                                              | `authTagLength: 16`, Test und Sabotage                                                            |
| 26.10.2026 | Abmelden mit Origin «null» gab einen Fehler 500                                                                             | Herkunft geprüft ohne Absturz, 403; Test und Sabotage                                             |
| 26.10.2026 | Advisor 0029: Hilfsfunktionen der Regeln über `/rest/v1/rpc` aufrufbar                                                      | Umzug ins Schema `privat`, Test wie der Advisor, Sabotage                                         |
| 27.10.2026 | Abgelaufene Sitzung: Senden eines Formulars endete auf einer Fehlerseite (#1)                                               | `proxy.ts` leitet Server-Aktionen nicht um, die Aktion selbst schon; Test, Sabotage               |
| 27.10.2026 | Fünf Fehlversuche je Konto sperrten das echte Konto (Aussperren als Angriff)                                                | Grenzen je Konto und IP, je Konto höher (E23); im Browser-Test gemessen                           |
| 27.10.2026 | Die Sabotage-Runde verfälschte Ersatztexte mit `$$` (Dollar-Quoting)                                                        | Ersatz per Funktion statt als Zeichenkette                                                        |
| 28.10.2026 | Gleicher Schlüssel mit anderem Inhalt lieferte still den alten Beleg oder die alte Bestellung                               | Inhalt verglichen, WK011 und WB004 mit der Nummer des Vorhandenen; Tests, Sabotagen               |
| 28.10.2026 | Bremse prüfte und zählte in zwei Schritten: gleichzeitige Versuche kamen über die Grenze                                    | Ein Aufruf unter Sperre je Schlüssel; Test mit zwei Verbindungen, Sabotage                        |
| 28.10.2026 | Anmeldung liess bei gestörter Bremse durch (erst überlasten, dann raten)                                                    | Anmeldung sperrt bei Störung; Test, Sabotage                                                      |
| 28.10.2026 | Statusabfrage gleich nach einem Abbruch konnte zum zweiten Bestellen einladen                                               | Abfrage erst eine Minute nach der letzten Änderung, auch in der Aktion; Test, Sabotage            |
| 28.10.2026 | Fault ohne MSV3-Angaben und «Antwort verfügbar» ohne Antwort galten als erledigt                                            | beide «unklar»; Tests, Sabotagen                                                                  |
| 28.10.2026 | Seite Bestellen fragte bei jedem Aufruf ungebremst beim Grosshändler nach                                                   | Vertragsdaten fünf Minuten gemerkt, jede Anfrage in der Bremse; Test, Sabotagen                   |
| 28.10.2026 | Enter im Mengenfeld der Kasse buchte sofort                                                                                 | Enter führt zurück zur Erfassung; Browser-Test                                                    |
| 29.10.2026 | Der Verkaufs-Flow verkaufte, wenn die Zeile «Beleg» in einem Bild fehlte (zweite Buchung)                                   | Verkauf nur bei gelesenem «unbekannt» (E39); Test mit flackernder Zeile, Sabotage                 |
| 29.10.2026 | Zahlen im Suchtext unscharf: «Positionen 1» galt als «Positionen 2», ein verlorenes Enter ergab einen Beleg ohne Position   | Ziffern genau nach Ausgleich der OCR-Verwechslungen (E40); Tests, Sabotage                        |
| 29.10.2026 | Tagesabschluss nicht kritisch: Fehlte die Bestätigung, hiess es «abgebrochen», obwohl abgeschlossen war                     | `kritisch` im Flow, Status «unklar»; Test, Sabotage                                               |
| 29.10.2026 | Der Trockenlauf klickte bekannte Dialoge weg                                                                                | Trockenlauf klickt nichts; Test, Sabotage                                                         |
| 29.10.2026 | Die Selbstheilung klickte auf Koordinaten von vor der Frage ans Modell                                                      | Prüfen und Klicken auf einem frischen Bild; Test, Sabotage                                        |
| 29.10.2026 | Knopf eines bekannten Dialogs im ganzen Fenster gesucht, ohne Prüfung auf Mehrdeutigkeit                                    | nur rund um den Dialogtext und nur eindeutig; Test, Sabotage                                      |
| 29.10.2026 | Kasse nicht vorne: Eingaben hätten ein anderes Programm erreicht; bei zwei gleichen Fenstern nahm die Engine das erste      | Abbruch vor der nächsten Eingabe, vorne zählt auch ein Dialog derselben Anwendung; Test, Sabotage |
| 29.10.2026 | Tagesdeckel der Selbstheilung hing am Ausgabeordner, der Zähler hatte keine Sperre                                          | fester Ort je Benutzer, Lesen und Erhöhen unter Sperre; Tests, Sabotage                           |
| 29.10.2026 | Kennungen mit sechs Zeichen: ab rund 20 000 Belegen eine doppelte wahrscheinlich                                            | neue Kennungen mit acht Zeichen (E41); Test, Sabotage                                             |
| 29.10.2026 | Prototyp: Ein kaputter Datensatz beendete den ganzen Stapel                                                                 | jeder Datensatz für sich, mit Grund in der Tabelle; Test                                          |
| 29.10.2026 | Ein Dialog wurde ein zweites Mal geklickt, solange er nach dem Klick noch zu sehen war; der Klick ging ins Fenster dahinter | warten, bis der Dialog verschwunden ist; Test mit Nachbild, Sabotage                              |
| 02.11.2026 | follow-redirects 1.16.1 (hoch) über `soap`; nur im Test der Attrappe, nicht im Abbild                                       | Lockfile auf 1.16.2 nach Ablauf der Wartezeit, ohne Ausnahme; Audit ohne Befund                   |
