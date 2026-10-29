<#
  Führt die Pester-Tests der Engine und der Kassen-Attrappe aus.
  Ohne Windows bleiben die Tests mit dem Tag «Windows» aussen vor: Sie brauchen
  einen echten Bildschirm, echte OCR und echte Eingabe.

  Aufruf:  pwsh engine/tests/pester.ps1 [-Pfad <Datei oder Ordner> ...] [-NurWindows]
  Exit-Code 0 nur, wenn alles grün ist.
#>
param(
  [string[]] $Pfad = @(
    (Join-Path $PSScriptRoot '.'),
    (Join-Path $PSScriptRoot '../../attrappe/tests')
  ),
  [switch] $NurWindows,
  [string] $Bericht
)
$ErrorActionPreference = 'Stop'
Import-Module Pester -RequiredVersion 5.9.1

$konfig = New-PesterConfiguration
$konfig.Run.Path = @($Pfad | Where-Object { Test-Path $_ })
$konfig.Run.Exit = $true
$konfig.Output.Verbosity = 'Detailed'
$konfig.Output.StackTraceVerbosity = 'FirstLine'
$konfig.Output.RenderMode = 'Plaintext'
$konfig.Should.ErrorAction = 'Stop'
if ($NurWindows) {
  $konfig.Filter.Tag = @('Windows')
}
else {
  $konfig.Filter.ExcludeTag = @('Windows')
}
if ($Bericht) {
  $konfig.TestResult.Enabled = $true
  $konfig.TestResult.OutputPath = $Bericht
  $konfig.TestResult.OutputFormat = 'JUnitXml'
}
Invoke-Pester -Configuration $konfig
