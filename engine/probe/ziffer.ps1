<#
  Probe: eine einzelne Ziffer im Feld neben einer Beschriftung. Befund der
  echten Läufe vom 29.10.2026: In der Kasse Nord las die OCR die Menge «1»
  hinter «Menge» in keinem Lauf, in der Kasse Süd (Beschriftung über dem Feld)
  in jedem. Die Probe tippt «1» ins Mengenfeld der Attrappe Nord und schreibt
  auf, was die OCR in der obersten Zeile liest, zwei-, drei- und vierfach
  vergrössert. Gemessen am 29.10.2026: zweifach und vierfach steht die «1» da,
  dreifach fehlt sie (E38). Die Probe misst nur und hält die CI nicht an.
#>
param([string] $Ausgabe = 'ziffer-ausgabe')
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '../src/Treiber/Windows.ps1')

$ordner = (New-Item -ItemType Directory -Force -Path $Ausgabe).FullName
$wurzel = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$befund = [ordered]@{}

function Format-Woerter($Woerter) {
  $teile = @($Woerter | Sort-Object Zeile, X | ForEach-Object { "«$($_.Text)» x=$($_.X)" })
  if ($teile.Count -eq 0) { return '(nichts)' }
  $teile -join ', '
}

$journal = Join-Path $ordner 'journal.json'
$start = Join-Path $wurzel 'attrappe/start.ps1'
$prozess = Start-Process pwsh -ArgumentList @('-NoProfile', '-File', $start, '-Variante', 'nord', '-Journal', $journal) -PassThru
try {
  $t = New-WindowsTreiber -Arbeitsordner (Join-Path $ordner 'bilder') -Skalierung 3
  $fenster = $null
  $bis = (Get-Date).AddSeconds(60)
  while ($null -eq $fenster -and (Get-Date) -lt $bis) {
    Start-Sleep -Milliseconds 300
    $fenster = $t.Fenster('Kasse Nord')
  }
  if ($null -eq $fenster) { throw 'Kasse Nord erschien nicht.' }
  $null = $t.Vordergrund($fenster)
  $vorher = $t.Bildschirm($fenster)
  $menge = $vorher.Woerter | Where-Object Text -EQ 'Menge' | Select-Object -First 1
  if ($null -eq $menge) { throw "OCR fand «Menge» nicht: $(Format-Woerter $vorher.Woerter)" }
  $null = $t.Klick($fenster.X + $menge.X + 70, $fenster.Y + $menge.Y + [int]($menge.H / 2))
  $null = $t.Taste('Escape')
  $null = $t.Tippen('1')
  $null = $t.Taste('Tab')
  Start-Sleep -Milliseconds 500

  foreach ($s in 2, 3, 4) {
    $basis = Join-Path $ordner "ganz-$s"
    $dateien = Save-Bildschirmfoto -Fenster $fenster -Basis $basis -Skalierung $s
    $ocr = Read-OcrWoerter -Skript $t.Ocr -Bild $dateien.Gross -Json "$basis.json" -Sprache 'de-DE' -Skalierung $s
    $befund["ganzes Fenster x$s, oberste Zeile"] = Format-Woerter ($ocr.Woerter | Where-Object { $_.Y -lt 50 })
  }
}
catch {
  $befund.Fehler = $_.Exception.Message
  Write-Output "::warning::Probe Ziffer: $($_.Exception.Message)"
}
finally {
  $befund | ConvertTo-Json -Depth 4 | Set-Content -Path (Join-Path $ordner 'befund.json') -Encoding utf8
  foreach ($k in $befund.Keys) { Write-Output ('{0,-40} {1}' -f $k, $befund[$k]) }
  if ($prozess -and -not $prozess.HasExited) { Stop-Process -Id $prozess.Id -Force }
}
