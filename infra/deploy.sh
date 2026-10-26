#!/usr/bin/env bash
# Grosshandel-Attrappe auf vps1 ausrollen. Läuft als root:
#
#   sudo /opt/apotheken-werkbank/infra/deploy.sh [commit-oder-branch]
#
# Holen, frisch bauen, starten, auf «gesund» warten. Nichts darin, was sich
# nicht ein zweites Mal ausführen liesse. Erste Einrichtung: docs/BETRIEB.md.
set -euo pipefail

WURZEL="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# Anders nur im Test (tests/deploy-skript.test.ts). `sudo` setzt die Umgebung
# zurück; aufgerufen wie oben gilt immer der feste Pfad.
export WERKBANK_MANDANTEN="${WERKBANK_MANDANTEN:-/etc/apotheken-werkbank/mandanten.json}"
COMPOSE=(docker compose -f "$WURZEL/infra/compose.prod.yml")
ZIEL="${1:-main}"

melde() { printf '\n== %s\n' "$*"; }

# Ohne Mandanten startet die Attrappe nicht; lieber hier abbrechen als nach
# dem Bauen. Die Datei enthält nur scrypt-Hashes, bleibt aber root und dem
# Benutzer im Container (uid 1000) vorbehalten.
if [ ! -f "$WERKBANK_MANDANTEN" ]; then
  echo "Abbruch: $WERKBANK_MANDANTEN fehlt (erzeugt von scripts/produktion-zugaenge.ts, siehe docs/BETRIEB.md)." >&2
  exit 1
fi
chown root:1000 "$WERKBANK_MANDANTEN"
chmod 440 "$WERKBANK_MANDANTEN"

melde "Stand holen: $ZIEL"
git -C "$WURZEL" fetch --prune origin
git -C "$WURZEL" checkout --detach "origin/$ZIEL" 2>/dev/null || git -C "$WURZEL" checkout --detach "$ZIEL"
VERSION="$(git -C "$WURZEL" rev-parse --short HEAD)"

# Mit --pull: Basis-Abbilder (node, bun) baut der Hersteller unter derselben
# Nummer neu, wenn darunter eine Lücke geschlossen wird.
melde "Abbild bauen: werkbank-grosshandel:$VERSION"
docker build --pull -f "$WURZEL/grosshandel-attrappe/Dockerfile" -t "werkbank-grosshandel:$VERSION" "$WURZEL"
export WERKBANK_VERSION="$VERSION"

# --wait zählt den Healthcheck aus compose.prod.yml, nicht nur den Start.
melde "Starten und warten, bis der Dienst gesund ist"
"${COMPOSE[@]}" up -d --wait --wait-timeout 120 --remove-orphans
"${COMPOSE[@]}" ps
echo
echo "Fertig: $VERSION"
