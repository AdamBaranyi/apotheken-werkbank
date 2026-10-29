<#
  Prototyp «Rezeptdatensatz -> Kasse»: bucht alle Datensätze aus daten/rezepte
  über die Engine an der Kasse und schreibt die Messung als Markdown.

  Aufruf: pwsh prototypen/rezept-zur-kasse/start.ps1 [-Heute 2026-10-29] [-Treiber fake|windows] [-Kasse nord|sued]
  Windows braucht das Fenster der Kassen-Attrappe (pwsh attrappe/start.ps1).
#>
param(
  [string] $Heute = (Get-Date).ToString('yyyy-MM-dd'),
  [ValidateSet('fake', 'windows')] [string] $Treiber = 'fake',
  [ValidateSet('nord', 'sued')] [string] $Kasse = 'nord',
  [string] $Ordner = (Join-Path $PSScriptRoot 'daten/rezepte')
)
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot '../../engine/Werkbank.Engine.psd1')
. (Join-Path $PSScriptRoot 'Rezept.ps1')

$ausgabe = Join-Path ([IO.Path]::GetTempPath()) "werkbank-rezepte-$([guid]::NewGuid())"
$t = if ($Treiber -eq 'fake') { New-FakeTreiber -Variante $Kasse } else { New-WindowsTreiber -Arbeitsordner (Join-Path $ausgabe 'ocr') -Skalierung 3 }
$optionen = if ($Treiber -eq 'fake') { @{ Takt = 0.25; Schlafen = $false; Ausgabe = $ausgabe } } else { @{ Ausgabe = $ausgabe } }
$start = Get-Date
$ergebnis = @(Invoke-RezeptStapel -Ordner $Ordner -Heute ([datetime]$Heute) -Treiber $t -Optionen $optionen -Kasse $Kasse)
$gesamt = [int]((Get-Date) - $start).TotalMilliseconds

$de = [System.Globalization.CultureInfo]::GetCultureInfo('de-DE')
function Format-Sekunden([double] $Ms) { ($Ms / 1000).ToString('0.0', $de) + ' s' }

Write-Output "| Datensatz | Ergebnis | Beleg | Dauer | Grund |"
Write-Output "| --- | --- | --- | --- | --- |"
foreach ($e in $ergebnis) {
  Write-Output "| $($e.Datei) | $($e.Ergebnis) | $($e.Beleg) | $(Format-Sekunden $e.DauerMs) | $($e.Grund) |"
}
$zaehlen = { param($wert) @($ergebnis | Where-Object Ergebnis -EQ $wert).Count }
$gebucht = & $zaehlen 'gebucht'
$doppelt = & $zaehlen 'schon gebucht'
$mensch = $ergebnis.Count - $gebucht - $doppelt
$schnitt = if ($gebucht) { ($ergebnis | Where-Object Ergebnis -EQ 'gebucht' | Measure-Object DauerMs -Average).Average } else { 0 }
Write-Output ''
Write-Output ("$($ergebnis.Count) Datensätze, Treiber $Treiber, Kasse ${Kasse}: $gebucht gebucht, $doppelt doppelt erkannt, " +
  "$mensch für einen Menschen; $(Format-Sekunden $schnitt) je Buchung, $(Format-Sekunden $gesamt) gesamt.")
