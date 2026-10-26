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

Ergänzt, sobald es Code gibt. Vorgesehen sind:

- Jede Server Action und jeder Route Handler prüft Anmeldung und Zugehörigkeit zur Apotheke;
  die Datenbank prüft dasselbe noch einmal über Row Level Security, mit Tests in beiden
  Rollen.
- Zod an jeder Grenze: Formulare, Antworten der Grosshandel-Attrappe, Flow-Dateien,
  Laufberichte der Engine.
- Zugänge zum Grosshandel je Apotheke verschlüsselt in der Datenbank, der Schlüssel nur in
  der Umgebung des Servers.
- Content Security Policy mit Nonce, Sicherheits-Kopfzeilen, Rate-Limit auf Anmeldung und
  teuren Aktionen, keine Anfragen an Dritte ausser Supabase und Vercel.
- Die Engine führt vorgeschlagene Aktionen eines Modells nur aus einer festen Liste aus, mit
  Deckel je Lauf und je Tag; Bildschirmfotos echter Kassen gehen nie an einen Dienst ausserhalb.

## Behobene Befunde

Noch keine.
