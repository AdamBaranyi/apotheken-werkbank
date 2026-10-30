# Lädt alle Teile der Engine aus src/. Die Dateien enthalten nur Funktionen;
# welche nach aussen sichtbar sind, steht im Manifest (FunctionsToExport).
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 3.0

foreach ($datei in Get-ChildItem -Path (Join-Path $PSScriptRoot 'src') -Filter *.ps1 -Recurse) {
  # ocr51.ps1 läuft als Unterprozess in Windows PowerShell 5.1, nicht hier.
  if ($datei.Name -eq 'ocr51.ps1') { continue }
  . $datei.FullName
}
