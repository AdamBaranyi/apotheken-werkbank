# Betrieb

Drei Teile, drei Orte – wie bei einem echten Bestell-Tool, das mit einem Grosshändler spricht:

| Teil                    | Wo                                       | Region             |
| ----------------------- | ---------------------------------------- | ------------------ |
| Web-App                 | Vercel (Hobby), Root Directory `web`     | Frankfurt (`fra1`) |
| Datenbank und Anmeldung | Supabase (Gratis)                        | Frankfurt          |
| Grosshandel-Attrappe    | eigener Server vps1, Docker hinter Caddy | Deutschland        |

Die Web-App ruft die Attrappe über das Netz auf, wie ein echtes Bestell-Tool einen echten
Grosshändler. Ein SOAP-Dienst braucht einen Dauerprozess; Vercel-Funktionen bieten keinen.

## Geheimnisse und wo sie liegen

| Was                                 | Wo                                                                    |
| ----------------------------------- | --------------------------------------------------------------------- |
| `ZUGANG_SCHLUESSEL` (AES-256-GCM)   | Vercel (Produktion, als Secret) und lokal in `.lokal/produktion/`     |
| Schlüssel der Vorschau              | nur Vercel (Preview), eigener Zufallswert, nirgends gespeichert (E19) |
| Passwörter der Grosshändler-Zugänge | nirgends im Klartext: als Hash auf vps1, als Geheimtext in Supabase   |
| Passwörter der Demo-Konten          | Passwortmanager von Adam; Claude sieht sie nie                        |

`.lokal/` steht in `.gitignore`, `.vercelignore` und `.dockerignore`. Vercel und Docker laden
ohne die beiden Freigabelisten alles hoch, was im Ordner liegt, auch was Git ignoriert.

## Erste Einrichtung

Einmalig, in dieser Reihenfolge. Befehle mit `sudo` führt Adam aus.

1. **DNS:** A-Eintrag `grosshandel.adambaranyi.xyz` auf die IPv4 von vps1, im Zonen-Editor
   des Hosters. Kein AAAA-Eintrag, solange IPv6 auf vps1 nicht läuft.
2. **Caddy:** Den Block aus `infra/caddy/werkbank-grosshandel.caddy` in den gemeinsamen Caddy
   übernehmen (Caddyfile im Repository von Tallyroom) und dort
   `WERKBANK_GROSSHANDEL_SITE_ADDRESS=grosshandel.adambaranyi.xyz` setzen. Caddy holt das
   Zertifikat selbst, sobald der DNS-Eintrag stimmt.
3. **Repository auf vps1:** öffentlich, ohne Deploy-Schlüssel:
   `sudo git clone https://github.com/AdamBaranyi/Apotheken-Werkbank.git /opt/apotheken-werkbank`
4. **Zugänge erzeugen** (auf dem Mac): `node scripts/produktion-zugaenge.ts` schreibt
   `.lokal/produktion/mandanten.json` (Hashes für vps1) und `.lokal/produktion/zugaenge.sql`
   (Geheimtext für Supabase). Beide gehören zusammen.
5. **Mandanten auf vps1:**
   `scp .lokal/produktion/mandanten.json vps1:/tmp/werkbank-mandanten.json`, dann auf vps1
   `sudo install -D -m 440 -o root -g 1000 /tmp/werkbank-mandanten.json /etc/apotheken-werkbank/mandanten.json`
   und die Kopie in `/tmp` löschen.
6. **Ausrollen:** `sudo /opt/apotheken-werkbank/infra/deploy.sh`. Das Skript holt `main`, baut
   das Abbild mit frischen Basis-Abbildern und wartet, bis der Dienst gesund ist. Es hat keinen
   veröffentlichten Port; erreichbar ist es nur über das Netz von Caddy.
7. **Supabase:** Unter Authentication die Registrierung abschalten («Allow new users to sign
   up» aus) und die beiden Konten anlegen (`inhaber.nord@werkbank.test`,
   `mitarbeit.sued@werkbank.test`, «Auto Confirm User»). Danach `zugaenge.sql` im SQL-Editor
   ausführen; ohne die Konten bricht sie mit einer Meldung ab.
8. **Prüfen:** `https://grosshandel.adambaranyi.xyz/gesundheit` antwortet «ok»; nach der
   Anmeldung in der Web-App zeigt «Bestellen» die Bestellfenster.

## Laufend

- **Attrappe neu ausrollen oder Abbilder erneuern:** `sudo /opt/apotheken-werkbank/infra/deploy.sh`
  (auch ohne neuen Commit; monatlich in der Wartungsliste). Ein Neustart setzt Lager und
  Bestellungen zurück (E14).
- **Neue Passwörter für die Zugänge:** Schritt 4, dann 5, 6 und die SQL aus Schritt 7. Nur
  beides zusammen: Hash und Geheimtext müssen zum selben Passwort gehören
  (`tests/produktion-zugaenge.test.ts`).
- **Datenbank:** Migrationen aus `supabase/migrations/`; in der Cloud tragen sie dieselben
  Versionen wie die Dateinamen. Danach die Advisors ansehen; bewusst Offenes steht in
  `docs/SECURITY.md`.
- **Web-App:** Jeder Push auf `main` geht nach der Verbindung mit GitHub auf Vercel; bis dahin
  von Hand mit `bunx vercel@64.5.0 deploy --prod` aus dem Wurzelordner.

## Wo was steht

| Datei                                    | Zweck                                                     |
| ---------------------------------------- | --------------------------------------------------------- |
| `grosshandel-attrappe/Dockerfile`        | Abbild der Attrappe (Node 24, nur ihre Pakete)            |
| `infra/compose.prod.yml`                 | Dienst auf vps1: nur lesbar, ohne Rechte, mit Healthcheck |
| `infra/deploy.sh`                        | Ausrollen; getestet in `tests/deploy-skript.test.ts`      |
| `infra/caddy/werkbank-grosshandel.caddy` | Vorlage für den gemeinsamen Caddy                         |
| `scripts/produktion-zugaenge.ts`         | Zugänge für die Produktion                                |
| `web/vercel.json`                        | Region und Installation auf Vercel                        |
