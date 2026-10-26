#!/usr/bin/env bash
# Liest den Bericht des täglichen Laufs und hält genau ein Issue «Sicherheitsmeldungen»:
# anlegen beim ersten Fund, ergänzen nur bei geänderter Kennungsliste, schliessen ohne Funde.
# Aufruf: bash scripts/sicherheits-meldung.sh <bericht> <exit-code von scripts/audit.sh>
# Braucht GH_TOKEN (issues: write) und GH_REPO.
set -euo pipefail

if [ $# -lt 2 ]; then
  echo "Aufruf: $0 <bericht> <exit-code von scripts/audit.sh>" >&2
  exit 2
fi
bericht="$1"
status="$2"
titel="Sicherheitsmeldungen"
label="sicherheit"
zuweisung="${ZUWEISUNG:-AdamBaranyi}"
heute=$(date -u +%F)

# bun färbt seine Kopfzeile auch ohne Terminal; ins Issue gehört nur Text.
esc=$(printf '\033')
inhalt=$(sed "s/${esc}\[[0-9;]*m//g" "$bericht")
ids=$(printf '%s\n' "$inhalt" | grep -o -E 'GHSA-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}' | sort -u || true)
stand=$(printf '%s' "$ids" | sha256sum | cut -c1-12)

# Ohne --label und ohne --search: Beide schicken gh über den Suchindex, und der
# hinkt nach — ein zweiter Lauf kurz nach dem ersten fände das neue Issue nicht
# und legte ein zweites an. Ohne Filter liest gh die Issues direkt.
#
# Gefiltert wird darum erst hier, und nicht nur nach dem Titel: Im öffentlichen
# Repo kann jedes Konto ein Issue «Sicherheitsmeldungen» eröffnen und seinen
# Text mit der Markierung des aktuellen Stands füllen; der Lauf hielte dann
# jede neue Meldung für bekannt und bliebe stumm. Gezählt wird nur ein Issue,
# das der Bot dieses Workflows angelegt hat und das das Label trägt; Labels
# setzen Konten ohne Rechte im Repo nicht.
nummer=$(gh issue list --state open --limit 200 --json number,title,author,labels \
  --jq "[.[] | select(.title == \"$titel\" and .author.login == \"app/github-actions\" and any(.labels[]; .name == \"$label\"))][0].number // empty")

if [ -z "$ids" ]; then
  # Keine Kennung, aber ein Fehlercode: Der Audit selbst ist gescheitert, etwa
  # weil die Registry nicht antwortet. Dann nichts schliessen und rot werden —
  # ein Wächter, der still aufhört, ist schlechter als ein roter Lauf.
  if [ "$status" != "0" ]; then
    echo "::error::bun audit ist ohne Ergebnis gescheitert (Exit $status). Das Issue bleibt, wie es ist." >&2
    exit 1
  fi
  # Sauber: Das Issue bleibt offen und sagt «keine Befunde». Schliessen und beim
  # nächsten Fund neu anlegen hiess jedes Mal zuweisen und mailen (Oktober 2026).
  if [ -n "$nummer" ]; then
    sauber=$(printf '<!-- stand:sauber -->\nStand %s: keine Befunde. Prüfung ab moderat mit den Ausnahmen aus scripts/audit.sh.\n\nDas Issue bleibt offen und zeigt den letzten Stand; der tägliche Lauf schreibt nur bei Änderungen. Bitte nicht schliessen.' "$heute")
    bisher=$(gh issue view "$nummer" --json body --jq .body)
    case "$bisher" in
      *"stand:sauber"*) echo "Weiterhin keine Befunde, keine Änderung." ;;
      *) gh issue edit "$nummer" --body "$sauber" ;;
    esac
  fi
  exit 0
fi

koerper=$(printf '<!-- stand:%s -->\nStand %s, Prüfung ab moderat mit den Ausnahmen aus scripts/audit.sh:\n\n```\n%s\n```\n\nRegel: high und critical mit Fix sofort (Laufzeit) oder mit dem nächsten Update-PR (Werkzeuge); moderate beim nächsten Update-PR; ohne Fix namentlich und befristet ausnehmen (docs/SECURITY.md).' "$stand" "$heute" "$inhalt")

if [ -z "$nummer" ]; then
  gh label create "$label" --color B60205 --description "Befunde des täglichen Sicherheitslaufs" 2>/dev/null || true
  gh issue create --title "$titel" --label "$label" --assignee "$zuweisung" --body "$koerper"
else
  # Erst lesen, dann vergleichen: `gh … | grep -q` kann unter pipefail am
  # vorzeitig geschlossenen Rohr scheitern und meldete dann eine Änderung.
  bisher=$(gh issue view "$nummer" --json body --jq .body)
  if [[ "$bisher" != *"stand:$stand"* ]]; then
    gh issue edit "$nummer" --body "$koerper"
    gh issue comment "$nummer" --body "$(printf 'Geänderte Befunde am %s:\n\n```\n%s\n```' "$heute" "$inhalt")"
  fi
fi
