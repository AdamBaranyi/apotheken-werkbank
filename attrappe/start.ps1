<#
  Startet die Kassen-Attrappe als Fenster (nur Windows).

  Aufruf:  pwsh attrappe/start.ps1 -Variante nord [-Journal <json>] [-Langsam <ms>]
           [-DialogNach <n>] [-UnbekanntNach <n>] [-WandernX <px> -WandernY <px>]

  Chaos für Tests: -Langsam verzögert jede Buchung und sperrt so lange das
  Fenster, -DialogNach blendet nach der n-ten Aktion «Neue Preisliste» ein,
  -UnbekanntNach einen Dialog, den kein Flow kennt, -WandernX/Y verschiebt das
  Fenster nach jeder Aktion.
#>
param(
  [ValidateSet('nord', 'sued')] [string] $Variante = 'nord',
  [string] $Journal = '',
  [ValidateRange(0, 60000)] [int] $Langsam = 0,
  [ValidateRange(0, 1000)] [int] $DialogNach = 0,
  [ValidateRange(0, 1000)] [int] $UnbekanntNach = 0,
  [ValidateRange(-200, 200)] [int] $WandernX = 0,
  [ValidateRange(-200, 200)] [int] $WandernY = 0,
  [ValidateRange(0, 2000)] [int] $X = 40,
  [ValidateRange(0, 2000)] [int] $Y = 40
)
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot 'Kassen.Attrappe.psd1')
$chaos = @{ Langsam = $Langsam; DialogNach = $DialogNach; UnbekanntNach = $UnbekanntNach }
if ($WandernX -or $WandernY) { $chaos.Wandern = @($WandernX, $WandernY) }
Show-KassenAttrappe -Variante $Variante -Journal $Journal -Chaos $chaos -Ursprung @($X, $Y)
