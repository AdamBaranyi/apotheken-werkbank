<#
  Statische Prüfung der PowerShell-Dateien mit PSScriptAnalyzer.
  Quellcode streng nach engine/PSScriptAnalyzerSettings.psd1; Testdateien
  zusätzlich ohne PSUseDeclaredVarsMoreThanAssignments, weil Pester Variablen
  aus BeforeAll in den It-Blöcken nutzt, was die Regel nicht sieht, und mit
  Write-Host für das Protokoll der CI.
  Exit-Code 1 bei jedem Befund.
#>
$ErrorActionPreference = 'Stop'
Import-Module PSScriptAnalyzer -RequiredVersion 1.25.0
$wurzel = Resolve-Path (Join-Path $PSScriptRoot '..')
$einstellungen = Import-PowerShellDataFile (Join-Path $PSScriptRoot 'PSScriptAnalyzerSettings.psd1')
$testeinstellungen = $einstellungen.Clone()
# Tests schreiben ihre Zwischenstände mit Write-Host ins Protokoll der CI.
$testeinstellungen.ExcludeRules = @($einstellungen.ExcludeRules) + 'PSUseDeclaredVarsMoreThanAssignments' + 'PSAvoidUsingWriteHost'

$dateien = Get-ChildItem -Path (Join-Path $wurzel 'engine'), (Join-Path $wurzel 'attrappe'), (Join-Path $wurzel 'prototypen') `
  -Recurse -Include *.ps1, *.psm1, *.psd1 -ErrorAction SilentlyContinue |
  Where-Object { $_.FullName -notmatch '[\\/]laeufe[\\/]' }
$abstuerze = [System.Collections.Generic.List[string]]::new()
$befunde = foreach ($datei in $dateien) {
  $regeln = if ($datei.Name -like '*.Tests.ps1' -or $datei.Name -eq 'Hilfen.ps1') { $testeinstellungen } else { $einstellungen }
  # Stürzt der Analyzer bei einer Datei ab, zählt das als Befund mit Dateiname,
  # statt die ganze Prüfung ohne Hinweis zu beenden.
  try { Invoke-ScriptAnalyzer -Path $datei.FullName -Settings $regeln -ErrorAction Stop }
  catch { $abstuerze.Add("$([IO.Path]::GetRelativePath($wurzel, $datei.FullName)): Analyzer abgestürzt: $($_.Exception.Message)") }
}
foreach ($b in $befunde) {
  $pfad = [IO.Path]::GetRelativePath($wurzel, $b.ScriptPath)
  Write-Output "${pfad}:$($b.Line) $($b.RuleName): $($b.Message)"
}
foreach ($a in $abstuerze) { Write-Output $a }
$anzahl = @($befunde).Count + $abstuerze.Count
Write-Output "$(@($dateien).Count) Dateien geprüft, $anzahl Befunde."
if ($anzahl -gt 0) { exit 1 }
