<#
  Kommandozeile der Werkbank-Engine.

    pwsh engine/werkbank.ps1 lint [-Pfad <ordner|datei>]
    pwsh engine/werkbank.ps1 run -Apotheke nord -Flow verkauf -Auftrag <json>
                                 [-Treiber windows|fake] [-DryRun] [-Bildfolge] [-Ausgabe <ordner>]
    pwsh engine/werkbank.ps1 kennung

  Exit-Codes: 0 erledigt (ok, bereits gebucht, nichts offen, trocken),
  1 abgebrochen oder ungültige Eingabe, 2 unklar: Ein buchender Schritt ist
  gesendet, die Bestätigung fehlt. Dann denselben Auftrag noch einmal laufen
  lassen; die Engine prüft über die Kennung, ob er schon gebucht ist.
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory, Position = 0)] [ValidateSet('lint', 'run', 'kennung')] [string] $Befehl,
  [string] $Pfad = (Join-Path $PSScriptRoot '../flows'),
  [string] $Apotheke,
  [string] $Flow,
  [string] $Auftrag,
  [ValidateSet('windows', 'fake')] [string] $Treiber = 'windows',
  [switch] $DryRun,
  [switch] $Bildfolge,
  [string] $Ausgabe = (Join-Path $PSScriptRoot 'laeufe')
)
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot 'Werkbank.Engine.psd1')
$script:Exitcode = 0

function Invoke-Lint {
  param([string] $Pfad)
  $befunde = @(Test-Flow -Pfad $Pfad)
  $anzahl = @(Get-ChildItem -LiteralPath $Pfad -Recurse -Filter *.yaml -ErrorAction SilentlyContinue).Count
  if (Test-Path -LiteralPath $Pfad -PathType Leaf) { $anzahl = 1 }
  foreach ($b in $befunde) { Write-Output "$(Split-Path $b.Datei -Leaf): $($b.Meldung)" }
  if ($befunde.Count -gt 0) {
    Write-Output "$anzahl Flows geprüft, $($befunde.Count) Befunde."
    $script:Exitcode = 1
    return
  }
  Write-Output "$anzahl Flows geprüft, keine Befunde."
}

function Invoke-Run {
  param([string] $Apotheke, [string] $Flow, [string] $Auftrag, [string] $Treiber, [bool] $DryRun, [bool] $Bildfolge, [string] $Ausgabe)
  if (-not $Apotheke -or -not $Flow) { throw 'run braucht -Apotheke und -Flow.' }
  $f = Import-Flow -Apotheke $Apotheke -Flow $Flow
  $daten = @{}
  if ($Auftrag) { $daten = Get-Content -LiteralPath $Auftrag -Raw -Encoding utf8 | ConvertFrom-Json -AsHashtable }
  $t = if ($Treiber -eq 'fake') {
    New-FakeTreiber -Variante $Apotheke
  }
  else { New-WindowsTreiber -Arbeitsordner (Join-Path $Ausgabe 'bilder-ocr') -Skalierung 3 }
  $bericht = Invoke-Flow -Flow $f -Treiber $t -Auftrag $daten -Optionen @{
    Ausgabe = $Ausgabe; DryRun = $DryRun; Bildfolge = $Bildfolge
  }
  Write-Output "Lauf $($bericht.lauf): $($f.Apotheke)/$($f.Name), Treiber $($bericht.treiber), $($bericht.dauerMs) ms"
  Write-Output "Status: $($bericht.status)"
  foreach ($k in $bericht.werte.Keys) { Write-Output "  $k = $($bericht.werte[$k])" }
  if ($bericht.status -eq 'trocken') {
    $sichtbar = @($bericht.plan | Where-Object sichtbar).Count
    Write-Output "Anker sichtbar: $sichtbar von $(@($bericht.plan).Count) (die übrigen erscheinen erst im Ablauf)"
  }
  if ($bericht.fehler) { Write-Output "Fehler: $($bericht.fehler.meldung)"; if ($bericht.fehler.foto) { Write-Output "Bildschirm: $($bericht.fehler.foto)" } }
  Write-Output "Bericht: $(Join-Path $Ausgabe $bericht.lauf)"
  $script:Exitcode = switch ($bericht.status) {
    { $_ -in 'ok', 'bereits-gebucht', 'nichts-offen', 'trocken' } { 0 }
    'unklar' { 2 }
    default { 1 }
  }
}

try {
  switch ($Befehl) {
    'lint' { Invoke-Lint -Pfad $Pfad }
    'run' {
      Invoke-Run -Apotheke $Apotheke -Flow $Flow -Auftrag $Auftrag -Treiber $Treiber `
        -DryRun $DryRun.IsPresent -Bildfolge $Bildfolge.IsPresent -Ausgabe $Ausgabe
    }
    'kennung' { New-Kennung }
  }
}
catch {
  Write-Output "Fehler: $($_.Exception.Message)"
  $script:Exitcode = 1
}
exit $script:Exitcode
