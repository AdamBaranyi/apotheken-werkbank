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
  gegen die CA von Supabase (E23).
- Sitzungs-Cookies `httpOnly`, `SameSite=Lax`, im Produktionsbuild `Secure`; die Browser-Tests
  prüfen, dass kein Skript sie lesen kann.
- Dazu `Cross-Origin-Resource-Policy: same-origin` und eine längere `Permissions-Policy`;
  Seiten mit Daten und der Beleg als PDF gehen mit `no-store` hinaus.
- Server-Aktionen ohne Sitzung leitet `proxy.ts` nicht um; die Aktion leitet selbst um (#1).

Vorgesehen:

- Die Engine führt vorgeschlagene Aktionen eines Modells nur aus einer festen Liste aus, mit
  Deckel je Lauf und je Tag; Bildschirmfotos echter Kassen gehen nie an einen Dienst ausserhalb.

## Bewusst offen

| Meldung                                       | Wo                                             | Grund                                                                                                                                                                                                 |
| --------------------------------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Advisor 0029 (SECURITY DEFINER, aufrufbar)    | `public.zugang_fuer_bestellung`                | Der Server holt damit im Namen der angemeldeten Person den Geheimtext eines Zugangs der eigenen Apotheke (E17). Ohne den Schlüssel des Servers ist er nutzlos; anon darf die Funktion nicht aufrufen. |
| Advisor 0005 (Index unbenutzt)                | `mitglieder_user_idx`, `zugaenge_apotheke_idx` | Frische Datenbank; die Indizes tragen die Regeln je Apotheke und die Fremdschlüssel.                                                                                                                  |
| Lighthouse über `npx`                         | CI, `scripts/lighthouse.mjs`                   | Feste, über sieben Tage alte Fassung; ihre Unterpakete stehen in keinem Lockfile. Der Lauf hat keine Geheimnisse und nur Leserechte (E26).                                                            |
| CA von Supabase aus der Kette übernommen      | `web/lib/supabase-ca.ts`                       | Gleicher Fingerabdruck an zwei Pooler-Adressen; der Abgleich mit dem Download im Dashboard steht noch aus.                                                                                            |
| Bremse lässt bei Datenbankausfall durch       | `web/lib/bremse.ts`                            | Ein Ausfall soll die Apotheke nicht aussperren; Supabase begrenzt Anmeldungen zusätzlich, der Ausfall steht im Protokoll.                                                                             |
| Status einer Bestellung schreibt das Mitglied | `public.bestellungen`                          | Kopie der Antwort des Grosshändlers, nur entlang erlaubter Wechsel; massgeblich bleibt der Grosshändler (Statusabfrage).                                                                              |

## Behobene Befunde

| Datum      | Befund                                                                        | Behebung                                                                            |
| ---------- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| 26.10.2026 | Ein Zugang mit falschem Schlüssel liess die Seite Bestellen abstürzen         | Meldung statt Absturz, Test und Sabotage                                            |
| 26.10.2026 | AES-GCM nahm in Node 24 einen auf 4 Byte gekürzten Prüfwert an                | `authTagLength: 16`, Test und Sabotage                                              |
| 26.10.2026 | Abmelden mit Origin «null» gab einen Fehler 500                               | Herkunft geprüft ohne Absturz, 403; Test und Sabotage                               |
| 26.10.2026 | Advisor 0029: Hilfsfunktionen der Regeln über `/rest/v1/rpc` aufrufbar        | Umzug ins Schema `privat`, Test wie der Advisor, Sabotage                           |
| 27.10.2026 | Abgelaufene Sitzung: Senden eines Formulars endete auf einer Fehlerseite (#1) | `proxy.ts` leitet Server-Aktionen nicht um, die Aktion selbst schon; Test, Sabotage |
| 27.10.2026 | Fünf Fehlversuche je Konto sperrten das echte Konto (Aussperren als Angriff)  | Grenzen je Konto und IP, je Konto höher (E23); im Browser-Test gemessen             |
| 27.10.2026 | Die Sabotage-Runde verfälschte Ersatztexte mit `$$` (Dollar-Quoting)          | Ersatz per Funktion statt als Zeichenkette                                          |
