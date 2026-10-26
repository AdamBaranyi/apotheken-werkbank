#!/usr/bin/env bash
# Baut das Abbild der Grosshandel-Attrappe und startet es wie auf vps1 (nur
# lesbar, ohne Rechte), mit einem Mandanten, der nur für diesen Lauf gilt.
# Dann drei Anfragen: Gesundheit, ohne Anmeldung (401), mit Anmeldung (200).
# Läuft in der CI bei jedem Pull Request, lokal mit: bash infra/abbild-pruefen.sh
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

ABBILD=werkbank-grosshandel:pruefung
NAME=werkbank-pruefung
VOLUME=werkbank-pruefung-mandanten
PORT="${PRUEF_PORT:-3599}"
KENNUNG=pruef0001
PASSWORT="$(LC_ALL=C tr -dc 'A-Za-z0-9' </dev/urandom | head -c 24 || true)"

aufraeumen() {
  docker rm -f "$NAME" >/dev/null 2>&1 || true
  docker volume rm "$VOLUME" >/dev/null 2>&1 || true
}
trap aufraeumen EXIT
aufraeumen

echo "== Abbild bauen"
docker build --pull -q -f grosshandel-attrappe/Dockerfile -t "$ABBILD" .

# Die Mandantendatei entsteht im Abbild selbst, mit dessen Hash-Funktion.
echo "== Mandant für diesen Lauf"
docker volume create "$VOLUME" >/dev/null
docker run --rm --user root -e KENNUNG="$KENNUNG" -e PASSWORT="$PASSWORT" -v "$VOLUME:/m" \
  --entrypoint node "$ABBILD" --input-type=module -e "
    import { writeFileSync } from 'node:fs';
    import { passwortHashen } from '/app/grosshandel-attrappe/src/anmeldung.ts';
    const passwortHash = await passwortHashen(process.env.PASSWORT);
    writeFileSync('/m/mandanten.json', JSON.stringify([{ kundenkennung: process.env.KENNUNG,
      name: 'Prüfung', passwortHash, btmErlaubnis: false, vertrag: 'standard' }]));"

echo "== Starten wie auf vps1"
docker run -d --name "$NAME" --read-only --cap-drop ALL --security-opt no-new-privileges:true \
  -p "127.0.0.1:$PORT:3501" -e MANDANTEN_DATEI=/run/werkbank/mandanten.json -e NACHTBETRIEB=nie \
  -v "$VOLUME:/run/werkbank:ro" "$ABBILD" >/dev/null
for _ in $(seq 1 30); do
  curl -fsS "http://127.0.0.1:$PORT/gesundheit" >/dev/null 2>&1 && break
  sleep 1
done

pruefe() {
  local erwartet="$1" code
  shift
  code="$(curl -s -o /dev/null -w '%{http_code}' "$@")"
  if [ "$code" != "$erwartet" ]; then
    echo "Erwartet $erwartet, bekam $code" >&2
    docker logs "$NAME" >&2
    exit 1
  fi
  echo "ok $erwartet"
}

UMSCHLAG='<?xml version="1.0" encoding="UTF-8"?><s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" xmlns:m="http://werkbank.example/msv3/v1.0"><s:Body><m:verbindungTesten><m:clientSoftwareKennung>Pruefung</m:clientSoftwareKennung></m:verbindungTesten></s:Body></s:Envelope>'
ZIEL="http://127.0.0.1:$PORT/msv3/v1.0/verbindungTesten"

echo "== Anfragen"
pruefe 200 "http://127.0.0.1:$PORT/gesundheit"
pruefe 401 -X POST -H 'Content-Type: text/xml; charset=utf-8' --data "$UMSCHLAG" "$ZIEL"
pruefe 200 -X POST -u "$KENNUNG:$PASSWORT" -H 'Content-Type: text/xml; charset=utf-8' --data "$UMSCHLAG" "$ZIEL"
echo "Abbild geprüft."
