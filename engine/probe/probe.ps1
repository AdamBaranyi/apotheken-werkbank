<#
  Gate von Abend 3: Läuft auf dem Windows-Läufer, was die Engine braucht?
  Fenster zeigen, finden und nach vorne holen, Bildschirmfoto, OCR (welche
  Sprachen, welche Skalierung liest am besten), Klick und Eingabe per
  SendInput. Schreibt Befunde und Bilder in den Ausgabeordner.
#>
param([string] $Ausgabe = 'probe-ausgabe')
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '../src/Treiber/Windows.ps1')

$ordner = (New-Item -ItemType Directory -Force -Path $Ausgabe).FullName
$befund = [ordered]@{
  PowerShell     = $PSVersionTable.PSVersion.ToString()
  Betriebssystem = [Environment]::OSVersion.VersionString
  Interaktiv     = [Environment]::UserInteractive
  Benutzer       = [Environment]::UserName
}

function Test-Erkannt {
  # Welche erwarteten Wörter stehen in der OCR? Vergleich ohne Gross/Klein.
  param($Woerter, [string[]] $Erwartet)
  $alle = @($Woerter | ForEach-Object { $_.Text.ToLowerInvariant() })
  $treffer = @($Erwartet | Where-Object { $alle -contains $_.ToLowerInvariant() })
  [ordered]@{ Quote = "$($treffer.Count)/$($Erwartet.Count)"; Fehlend = @($Erwartet | Where-Object { $treffer -notcontains $_ }) }
}

$wahrheit = Join-Path $ordner 'eingabe.txt'
$fensterSkript = Join-Path $PSScriptRoot 'fenster.ps1'
$prozess = Start-Process pwsh -ArgumentList @('-NoProfile', '-File', $fensterSkript, '-Wahrheit', $wahrheit) -PassThru
try {
  $t = New-WindowsTreiber -Arbeitsordner (Join-Path $ordner 'bilder')
  $befund.DpiBewusst = $t.DpiBewusst
  $befund.Bildschirm = ([Werkbank.Win32]::Bildschirm()) -join ' x '

  $fenster = $null
  $bis = (Get-Date).AddSeconds(40)
  while ($null -eq $fenster -and (Get-Date) -lt $bis) {
    Start-Sleep -Milliseconds 300
    $fenster = $t.Fenster('Werkbank-Probe')
  }
  if ($null -eq $fenster) {
    $befund.Fenstertitel = @([Werkbank.Win32]::Titel())
    throw 'Probefenster nicht gefunden.'
  }
  $befund.Fenster = "$($fenster.X),$($fenster.Y) $($fenster.Breite) x $($fenster.Hoehe)"
  $befund.Dpi = [Werkbank.Win32]::Dpi($fenster.Handle)
  $befund.Vordergrund = $t.Vordergrund($fenster)

  $erwartet = @('PZN', '99100008', 'Probatin', '400', 'mg', 'Filmtabletten', 'Hinzufügen', 'Menge',
    'Rückgeld', '12,85', '€', 'Größe', 'Summe', '15,34', 'EUR', 'Rezept', 'liegt', 'vor?', 'Feld:', 'Buchen')
  $skalen = [ordered]@{}
  foreach ($s in 1, 2, 3, 4) {
    $basis = Join-Path $ordner "skala-$s"
    $start = Get-Date
    $dateien = Save-Bildschirmfoto -Fenster $fenster -Basis $basis -Skalierung $s
    $ocr = Read-OcrWoerter -Skript $t.Ocr -Bild $dateien.Gross -Json "$basis.json" -Sprache 'de-DE' -Skalierung $s
    $skalen["x$s"] = Test-Erkannt -Woerter $ocr.Woerter -Erwartet $erwartet
    $skalen["x$s"].DauerMs = [int]((Get-Date) - $start).TotalMilliseconds
    $befund.OcrSprache = $ocr.Sprache
    $befund.OcrVerfuegbar = $ocr.Verfuegbar
  }
  $befund.Skalen = $skalen

  $bild = $t.Bildschirm($fenster)
  $befund.Zeilen = @($bild.Woerter | Group-Object Zeile | ForEach-Object { ($_.Group.Text) -join ' ' })
  $feld = $bild.Woerter | Where-Object Text -EQ 'Feld:' | Select-Object -First 1
  $knopf = $bild.Woerter | Where-Object Text -EQ 'Buchen' | Select-Object -First 1
  if ($null -eq $feld -or $null -eq $knopf) { throw 'OCR fand «Feld:» oder «Buchen» nicht.' }

  $befund.KlickFeld = $t.Klick($fenster.X + $feld.X + $feld.B + 40, $fenster.Y + $feld.Y + [int]($feld.H / 2))
  Start-Sleep -Milliseconds 300
  $befund.Getippt = $t.Tippen('99104118')
  Start-Sleep -Milliseconds 300
  $befund.KlickKnopf = $t.Klick($fenster.X + $knopf.X + [int]($knopf.B / 2), $fenster.Y + $knopf.Y + [int]($knopf.H / 2))
  Start-Sleep -Milliseconds 1500
  $befund.Wahrheit = if (Test-Path $wahrheit) { Get-Content $wahrheit -Raw } else { '(keine Datei)' }
  $befund.EingabeStimmt = $befund.Wahrheit -eq '99104118'

  $danach = $t.Bildschirm($fenster)
  $befund.ZeilenDanach = @($danach.Woerter | Group-Object Zeile | ForEach-Object { ($_.Group.Text) -join ' ' })
  $befund.OcrDauerMs = $danach.DauerMs
}
catch {
  $befund.Fehler = $_.Exception.Message
  throw
}
finally {
  $befund | ConvertTo-Json -Depth 6 | Set-Content -Path (Join-Path $ordner 'befund.json') -Encoding utf8
  $befund | ConvertTo-Json -Depth 6
  if ($prozess -and -not $prozess.HasExited) { Stop-Process -Id $prozess.Id -Force }
}
