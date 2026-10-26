#!/usr/bin/env bash
# Attrappe für gh in den Tests von scripts/sicherheits-meldung.sh.
# Hält höchstens ein offenes Issue in $ATTRAPPE_DIR, wendet --jq mit dem echten
# jq an und schreibt jeden Aufruf in `aufrufe`. Unbekannte Aufrufe landen in
# `unbekannt` und scheitern.
set -euo pipefail
d="$ATTRAPPE_DIR"

option() {
  local name="$1"
  shift
  while [ $# -gt 0 ]; do
    if [ "$1" = "$name" ]; then
      printf '%s' "$2"
      return 0
    fi
    shift
  done
}

filter="$(option --jq "$@")"
antworten() {
  if [ -n "$filter" ]; then jq -r "$filter"; else cat; fi
}

case "${1:-} ${2:-}" in
  "issue list")
    printf 'issue list state=%s label=%s search=%s\n' \
      "$(option --state "$@")" "$(option --label "$@")" "$(option --search "$@")" >> "$d/aufrufe"
    # Mit --label oder --search fragt gh den Suchindex. Der kennt ein eben
    # angelegtes Issue noch nicht; die Attrappe spielt das nach.
    if [ -n "$(option --label "$@")$(option --search "$@")" ]; then
      echo '[]' | antworten
      exit 0
    fi
    # Wie gh: neueste zuerst. Fremde Issues (fremd.json, von Konten ohne Rechte
    # im Repo) sind neuer als das eigene; das eigene stammt vom Bot und trägt
    # das Label.
    fremd="$(cat "$d/fremd.json" 2>/dev/null || echo '[]')"
    if [ -f "$d/nummer" ]; then
      eigen=$(jq -n --argjson n "$(cat "$d/nummer")" \
        '[{number: $n, title: "Sicherheitsmeldungen", author: {login: "app/github-actions"}, labels: [{name: "sicherheit"}]}]')
    else
      eigen='[]'
    fi
    jq -n --argjson f "$fremd" --argjson e "$eigen" '[$f[] | del(.body)] + $e' | antworten
    ;;
  "issue view")
    echo "issue view $3" >> "$d/aufrufe"
    if [ -f "$d/nummer" ] && [ "$3" = "$(cat "$d/nummer")" ]; then
      jq -n --rawfile body "$d/body" '{body: $body}' | antworten
    else
      jq --argjson n "$3" '[.[] | select(.number == $n)][0] | {body: .body}' "$d/fremd.json" | antworten
    fi
    ;;
  "issue create")
    printf 'issue create title=%s label=%s assignee=%s\n' \
      "$(option --title "$@")" "$(option --label "$@")" "$(option --assignee "$@")" >> "$d/aufrufe"
    option --body "$@" > "$d/body"
    echo 7 > "$d/nummer"
    echo "https://github.com/AdamBaranyi/Apotheken-Werkbank/issues/7"
    ;;
  "issue edit")
    echo "issue edit $3" >> "$d/aufrufe"
    option --body "$@" > "$d/body"
    ;;
  "issue comment")
    echo "issue comment $3" >> "$d/aufrufe"
    option --body "$@" > "$d/kommentar"
    ;;
  "issue close")
    echo "issue close $3" >> "$d/aufrufe"
    option --comment "$@" > "$d/kommentar"
    rm -f "$d/nummer"
    ;;
  "label create")
    echo "label create $3" >> "$d/aufrufe"
    ;;
  *)
    echo "$*" >> "$d/unbekannt"
    exit 1
    ;;
esac
