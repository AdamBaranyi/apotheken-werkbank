# Lädt die Teile der Kassen-Attrappe aus src/. Nur Funktionen; sichtbar ist,
# was im Manifest steht.
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 3.0

foreach ($datei in Get-ChildItem -Path (Join-Path $PSScriptRoot 'src') -Filter *.ps1) {
  . $datei.FullName
}
