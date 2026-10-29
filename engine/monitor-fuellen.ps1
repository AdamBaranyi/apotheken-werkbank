<#
  Füllt den Flow-Monitor mit Läufen des Test-Treibers, eine Art je Status:
  erledigt, schon gebucht, geheilt, abgebrochen mit Bildschirm, unklar,
  Tagesabschluss, und ein Verkauf der Apotheke Süd (den Nord nicht sieht).
  Für die Demo und die Browser-Tests. Die Engine-Konten kommen aus
  .lokal/engine.json (scripts/lokal-einrichten.ts), nie aus dem Repo.

  Aufruf: pwsh engine/monitor-fuellen.ps1
#>
param([string] $Konten = (Join-Path $PSScriptRoot '../.lokal/engine.json'))
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot 'Werkbank.Engine.psd1')

$ziele = @{}
foreach ($k in (Get-Content -LiteralPath $Konten -Raw | ConvertFrom-Json -AsHashtable)) {
  $ziele[$k.kasse] = @{ Url = $k.url; Schluessel = $k.schluessel; Email = $k.email; Passwort = $k.passwort }
}
$ausgabe = Join-Path ([IO.Path]::GetTempPath()) "werkbank-monitor-$([guid]::NewGuid())"
$optionen = @{ Takt = 0.25; Schlafen = $false; Ausgabe = $ausgabe; Zaehlerordner = $ausgabe }

function Invoke-Szenario {
  param([string] $Name, [string] $Kasse, [string] $Flow, [hashtable] $Auftrag, $Treiber, [hashtable] $Mehr = @{})
  $o = $optionen.Clone()
  foreach ($k in $Mehr.Keys) { $o[$k] = $Mehr[$k] }
  $bericht = Invoke-Flow -Flow (Import-Flow -Apotheke $Kasse -Flow $Flow) -Treiber $Treiber -Auftrag $Auftrag -Optionen $o
  $foto = if ($bericht.fehler -and $bericht.fehler.foto) { $bericht.fehler.foto } else { '' }
  $meldung = Send-Laufbericht -Bericht $bericht -Ziel $ziele[$Kasse] -Foto $foto
  if (-not $meldung.Ok) { throw "${Name}: $($meldung.Meldung)" }
  Write-Output ('{0,-34} {1,-16} {2}' -f $Name, $bericht.status, $meldung.Meldung)
}

function New-Karte([string] $Kennung, [string] $Pzn, [int] $Menge) {
  @{ kennung = $Kennung; zahlung = 'karte'; positionen = @(@{ pzn = $Pzn; menge = $Menge }) }
}

$nord = New-FakeTreiber -Variante nord
$bar = @{
  kennung = 'K7-QX4M'; zahlung = 'bar'; gegeben = '50,00'
  positionen = @(@{ pzn = '99100008'; menge = 3 }, @{ pzn = '99104118'; menge = 1; rezept = $true })
}
$heiler = New-Heiler -Art attrappe -Vorschlaege @(
  @{ aktion = 'klicke'; ziel = 'OK'; taste = ''; begruendung = 'Der Dialog meldet nur wenig Papier; OK schliesst ihn.' }
)

Invoke-Szenario 'Verkauf bar mit Rezept' nord verkauf $bar $nord
Invoke-Szenario 'Derselbe Auftrag noch einmal' nord verkauf $bar $nord
Invoke-Szenario 'Unbekannter Dialog, geheilt' nord verkauf (New-Karte 'M4-TR7C' '99102740' 1) `
(New-FakeTreiber -Variante nord -Chaos @{ UnbekanntNach = 3 }) @{ Heiler = $heiler }
Invoke-Szenario 'Unbekannter Dialog ohne Heilung' nord verkauf (New-Karte 'P3-HN9D' '99102740' 1) `
(New-FakeTreiber -Variante nord -Chaos @{ UnbekanntNach = 3 })
Invoke-Szenario 'Kasse bestätigt nicht' nord verkauf (New-Karte 'T6-CW2R' '99113703' 2) `
(New-FakeTreiber -Variante nord -Chaos @{ Langsam = 100 })
Invoke-Szenario 'Tagesabschluss' nord abschluss @{} $nord
Invoke-Szenario 'Verkauf Süd mit Karte' sued verkauf (New-Karte 'Y8-FJ4E' '99102740' 1) (New-FakeTreiber -Variante sued)
