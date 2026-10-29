<#
  Installiert die PowerShell-Module der Engine in festen Fassungen, für die
  CI und für neue Rechner. Fassungen nur heben, wenn sie sieben Tage alt sind
  (E8); Pester bleibt bei 5.
#>
$ErrorActionPreference = 'Stop'
$module = [ordered]@{
  'Pester'           = '5.9.1'
  'PSScriptAnalyzer' = '1.25.0'
  'powershell-yaml'  = '0.4.12'
}
foreach ($m in $module.GetEnumerator()) {
  $da = Get-Module -ListAvailable -Name $m.Key | Where-Object { $_.Version -eq [version]$m.Value }
  if ($da) {
    Write-Output "$($m.Key) $($m.Value) ist da."
    continue
  }
  Install-PSResource -Name $m.Key -Version $m.Value -Scope CurrentUser -Repository PSGallery -TrustRepository -Quiet
  Write-Output "$($m.Key) $($m.Value) installiert."
}
