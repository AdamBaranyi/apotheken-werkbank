<#
  Kommandozeile der Werkbank-Engine.

    pwsh engine/werkbank.ps1 lint [-Pfad <ordner|datei>]
    pwsh engine/werkbank.ps1 run -Apotheke nord -Flow verkauf -Auftrag <json>
                                 [-Treiber windows|fake] [-DryRun] [-Bildfolge] [-Ausgabe <ordner>]
                                 [-Heilung aus|modell] [-Melden]

  -Heilung modell fragt bei einem Fehlschlag Claude Haiku 5.5 (ANTHROPIC_API_KEY).
  -Melden schickt den Bericht an den Flow-Monitor: WERKBANK_MONITOR_URL,
  WERKBANK_MONITOR_SCHLUESSEL (öffentlicher Schlüssel), WERKBANK_ENGINE_EMAIL,
  WERKBANK_ENGINE_PASSWORT. Zugangsdaten nur aus der Umgebung, nie als Argument.
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
  [string] $Ausgabe = (Join-Path $PSScriptRoot 'laeufe'),
  [ValidateSet('aus', 'modell')] [string] $Heilung = 'aus',
  [switch] $Melden
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

function Get-Meldeziel {
  # Zugangsdaten des Engine-Kontos aus der Umgebung; fehlt etwas, vor dem Lauf abbrechen.
  $namen = 'WERKBANK_MONITOR_URL', 'WERKBANK_MONITOR_SCHLUESSEL', 'WERKBANK_ENGINE_EMAIL', 'WERKBANK_ENGINE_PASSWORT'
  $fehlen = @($namen | Where-Object { -not [Environment]::GetEnvironmentVariable($_) })
  if ($fehlen.Count -gt 0) { throw "Für -Melden fehlen: $($fehlen -join ', ')" }
  @{
    Url = $env:WERKBANK_MONITOR_URL; Schluessel = $env:WERKBANK_MONITOR_SCHLUESSEL
    Email = $env:WERKBANK_ENGINE_EMAIL; Passwort = $env:WERKBANK_ENGINE_PASSWORT
  }
}

function Invoke-Run {
  param(
    [string] $Apotheke, [string] $Flow, [string] $Auftrag, [string] $Treiber, [bool] $DryRun,
    [bool] $Bildfolge, [string] $Ausgabe, [string] $Heilung, [bool] $Melden
  )
  if (-not $Apotheke -or -not $Flow) { throw 'run braucht -Apotheke und -Flow.' }
  $ziel = if ($Melden) { Get-Meldeziel } else { $null }
  $heiler = $null
  if ($Heilung -eq 'modell') {
    if (-not $env:ANTHROPIC_API_KEY) { throw 'Für -Heilung modell fehlt ANTHROPIC_API_KEY.' }
    $heiler = New-Heiler -Art modell -Schluessel $env:ANTHROPIC_API_KEY
  }
  $f = Import-Flow -Apotheke $Apotheke -Flow $Flow
  $daten = @{}
  if ($Auftrag) { $daten = Get-Content -LiteralPath $Auftrag -Raw -Encoding utf8 | ConvertFrom-Json -AsHashtable }
  $t = if ($Treiber -eq 'fake') {
    New-FakeTreiber -Variante $Apotheke
  }
  else { New-WindowsTreiber -Arbeitsordner (Join-Path $Ausgabe 'bilder-ocr') -Skalierung 3 }
  $bericht = Invoke-Flow -Flow $f -Treiber $t -Auftrag $daten -Optionen @{
    Ausgabe = $Ausgabe; DryRun = $DryRun; Bildfolge = $Bildfolge; Heiler = $heiler; Zaehlerordner = $Ausgabe
  }
  Write-Output "Lauf $($bericht.lauf): $($f.Apotheke)/$($f.Name), Treiber $($bericht.treiber), $($bericht.dauerMs) ms"
  Write-Output "Status: $($bericht.status)"
  foreach ($k in $bericht.werte.Keys) { Write-Output "  $k = $($bericht.werte[$k])" }
  if ($bericht.status -eq 'trocken') {
    $sichtbar = @($bericht.plan | Where-Object sichtbar).Count
    Write-Output "Anker sichtbar: $sichtbar von $(@($bericht.plan).Count) (die übrigen erscheinen erst im Ablauf)"
  }
  if ($bericht.fehler) { Write-Output "Fehler: $($bericht.fehler.meldung)"; if ($bericht.fehler.foto) { Write-Output "Bildschirm: $($bericht.fehler.foto)" } }
  foreach ($h in $bericht.heilungen) { Write-Output "Heilung: $($h.aktion) $($h.ziel)$($h.taste), $($h.ergebnis) $($h.grund)" }
  Write-Output "Bericht: $(Join-Path $Ausgabe $bericht.lauf)"
  if ($ziel) {
    $foto = if ($bericht.fehler -and $bericht.fehler.foto) { $bericht.fehler.foto } else { '' }
    Write-Output "Monitor: $((Send-Laufbericht -Bericht $bericht -Ziel $ziel -Foto $foto).Meldung)"
  }
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
        -DryRun $DryRun.IsPresent -Bildfolge $Bildfolge.IsPresent -Ausgabe $Ausgabe `
        -Heilung $Heilung -Melden $Melden.IsPresent
    }
    'kennung' { New-Kennung }
  }
}
catch {
  Write-Output "Fehler: $($_.Exception.Message)"
  $script:Exitcode = 1
}
exit $script:Exitcode
