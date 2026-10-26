#!/usr/bin/env bash
# Prüft die Abhängigkeiten. Aufruf: bash scripts/audit.sh high|moderate
# Jede Ausnahme steht hier mit Kennung und ist in docs/SECURITY.md begründet
# (Paket, Stufe, Laufzeit oder Werkzeug, Grund, Datum, prüfen bis).
set -euo pipefail
stufe="${1:-high}"
case "$stufe" in
  low | moderate | high | critical) ;;
  *)
    # Ein Tippfehler darf die Prüfung nicht still abschwächen.
    echo "Unbekannte Stufe: $stufe (erlaubt: low, moderate, high, critical)" >&2
    exit 2
    ;;
esac
ausnahmen=(
)
# Die Form ${a[@]+…} hält auch eine leere Liste aus: bash 3.2 (macOS) bricht
# sonst unter set -u ab. Leer ist das Ziel.
bun audit --audit-level="$stufe" ${ausnahmen[@]+"${ausnahmen[@]}"}
