<#
  Texterkennung mit Windows.Media.Ocr fuer den Windows-Treiber der Engine.

  Laeuft in Windows PowerShell 5.1: PowerShell 7 baut auf .NET, und .NET kennt
  die WinRT-Typen seit Version 5 nicht mehr ohne Zusatzpaket. Darum ruft der
  Treiber dieses Skript als Unterprozess auf (powershell.exe).

  Aufruf:  powershell.exe -NoProfile -NonInteractive -File ocr51.ps1 -Bild <png> -Ausgabe <json> [-Sprache de-DE]
  Ergebnis: UTF-8-JSON mit Sprache, verfuegbaren Sprachen und Zeilen mit Woertern
  samt Lage in Pixeln des Bildes. Absichtlich nur ASCII in dieser Datei:
  Windows PowerShell 5.1 liest Skripte ohne BOM als ANSI.
#>
param(
  [Parameter(Mandatory = $true)] [string] $Bild,
  [Parameter(Mandatory = $true)] [string] $Ausgabe,
  [string] $Sprache = 'de-DE'
)
$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null = [Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime]
$null = [Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType = WindowsRuntime]
$null = [Windows.Foundation.IAsyncOperation`1, Windows.Foundation, ContentType = WindowsRuntime]
$null = [Windows.Graphics.Imaging.SoftwareBitmap, Windows.Foundation, ContentType = WindowsRuntime]
$null = [Windows.Graphics.Imaging.BitmapDecoder, Windows.Graphics, ContentType = WindowsRuntime]
$null = [Windows.Storage.Streams.RandomAccessStream, Windows.Storage.Streams, ContentType = WindowsRuntime]
$null = [Windows.Globalization.Language, Windows.Globalization, ContentType = WindowsRuntime]

# WinRT liefert nur asynchrone Methoden; GetAwaiter macht daraus einen Aufruf,
# der auf das Ergebnis wartet.
$awaiter = [WindowsRuntimeSystemExtensions].GetMember('GetAwaiter').Where({
    $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
  }, 'First')[0]

function Abwarten($Operation, [Type] $Typ) {
  $awaiter.MakeGenericMethod($Typ).Invoke($null, @($Operation)).GetResult()
}

$wunsch = New-Object Windows.Globalization.Language $Sprache
if ([Windows.Media.Ocr.OcrEngine]::IsLanguageSupported($wunsch)) {
  $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage($wunsch)
}
else {
  $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
}
if ($null -eq $engine) { throw 'Keine OCR-Sprache verfuegbar.' }

$pfad = (Resolve-Path -LiteralPath $Bild).Path
$datei = Abwarten ([Windows.Storage.StorageFile]::GetFileFromPathAsync($pfad)) ([Windows.Storage.StorageFile])
$strom = Abwarten ($datei.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
try {
  $decoder = Abwarten ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($strom)) ([Windows.Graphics.Imaging.BitmapDecoder])
  $bitmap = Abwarten ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
  $ergebnis = Abwarten ($engine.RecognizeAsync($bitmap)) ([Windows.Media.Ocr.OcrResult])
}
finally {
  $strom.Dispose()
}

$zeilen = New-Object System.Collections.ArrayList
$nr = 0
foreach ($zeile in $ergebnis.Lines) {
  $woerter = New-Object System.Collections.ArrayList
  foreach ($wort in $zeile.Words) {
    $r = $wort.BoundingRect
    $null = $woerter.Add(@{
        Text = $wort.Text
        X    = [int][math]::Round($r.X)
        Y    = [int][math]::Round($r.Y)
        B    = [int][math]::Round($r.Width)
        H    = [int][math]::Round($r.Height)
      })
  }
  $null = $zeilen.Add(@{ Nr = $nr; Text = $zeile.Text; Woerter = $woerter })
  $nr++
}

$verfuegbar = @([Windows.Media.Ocr.OcrEngine]::AvailableRecognizerLanguages | ForEach-Object { $_.LanguageTag })
$aus = @{
  Sprache    = $engine.RecognizerLanguage.LanguageTag
  Verfuegbar = $verfuegbar
  Zeilen     = $zeilen
}
$json = ConvertTo-Json -InputObject $aus -Depth 6 -Compress
[IO.File]::WriteAllText($Ausgabe, $json, (New-Object Text.UTF8Encoding $false))
