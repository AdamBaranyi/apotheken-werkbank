<#
  Probe: eine einzelne Ziffer im Feld neben einer Beschriftung. Befund der
  echten Läufe vom 29.10.2026: In der Kasse Nord las die OCR die Menge «1»
  hinter «Menge» in keinem Lauf, in der Kasse Süd (Beschriftung über dem Feld)
  in jedem. Die Probe tippt «1» ins Mengenfeld der Attrappe Nord und schreibt
  auf, was die OCR liest: das ganze Fenster in drei Skalierungen und nur das
  Feld, mit Rand. Sie misst nur und hält die CI nicht an.
#>
param([string] $Ausgabe = 'ziffer-ausgabe')
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '../src/Treiber/Windows.ps1')

$ordner = (New-Item -ItemType Directory -Force -Path $Ausgabe).FullName
$wurzel = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$befund = [ordered]@{}

function Save-Ausschnitt {
  # Schneidet ein Rechteck aus dem Foto, setzt es mit Rand auf die Farbe des
  # Fensters und vergrössert es für die OCR.
  param([string] $Roh, [int[]] $Lage, [int] $Rand, [int] $Skalierung, [string] $Ziel)
  $quelle = [System.Drawing.Bitmap]::new($Roh)
  try {
    $neu = [System.Drawing.Bitmap]::new(($Lage[2] + 2 * $Rand) * $Skalierung, ($Lage[3] + 2 * $Rand) * $Skalierung)
    try {
      $g = [System.Drawing.Graphics]::FromImage($neu)
      try {
        $g.Clear($quelle.GetPixel(2, 2))
        $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $hin = [System.Drawing.Rectangle]::new($Rand * $Skalierung, $Rand * $Skalierung, $Lage[2] * $Skalierung, $Lage[3] * $Skalierung)
        $her = [System.Drawing.Rectangle]::new($Lage[0], $Lage[1], $Lage[2], $Lage[3])
        $g.DrawImage($quelle, $hin, $her, [System.Drawing.GraphicsUnit]::Pixel)
      }
      finally { $g.Dispose() }
      $neu.Save($Ziel, [System.Drawing.Imaging.ImageFormat]::Png)
    }
    finally { $neu.Dispose() }
  }
  finally { $quelle.Dispose() }
}

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

  $layout = Import-PowerShellDataFile -LiteralPath (Join-Path $wurzel 'attrappe/layouts/nord.psd1')
  $feld = @(@($layout.Elemente | Where-Object { $_['Name'] -eq 'menge' })[0].Lage)
  $mitBeschriftung = @(196, $feld[1], $feld[0] + $feld[2] - 196, $feld[3])
  $roh = Join-Path $ordner 'ganz-3.png'
  foreach ($a in @(@{ Name = 'nur das Feld'; Lage = $feld }, @{ Name = 'Beschriftung und Feld'; Lage = $mitBeschriftung })) {
    foreach ($s in 3, 4) {
      $datei = Join-Path $ordner ('ausschnitt-{0}-x{1}.png' -f $a.Lage[0], $s)
      Save-Ausschnitt -Roh $roh -Lage $a.Lage -Rand 12 -Skalierung $s -Ziel $datei
      $ocr = Read-OcrWoerter -Skript $t.Ocr -Bild $datei -Json "$datei.json" -Sprache 'de-DE' -Skalierung $s
      $befund["$($a.Name) x$s"] = Format-Woerter $ocr.Woerter
    }
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
