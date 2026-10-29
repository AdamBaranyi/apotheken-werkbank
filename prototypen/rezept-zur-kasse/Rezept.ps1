# Prototyp «Rezeptdatensatz -> Kasse»: Ein erfundener Rezeptdatensatz aus
# einer Telemedizin-Attrappe wird geprüft, zu einem Auftrag der Engine und als
# Verkauf in der Kassen-Attrappe gebucht. Braucht das Modul Werkbank.Engine.

$script:KennungZeichen = '23456789ACDEFHJKMNPQRTVWXY'
$script:Datum = [System.Globalization.CultureInfo]::GetCultureInfo('de-DE')

function Test-PznPruefziffer {
  # PZN-8: Ziffern 1 bis 7 mal 1 bis 7, Summe modulo 11 ist die Prüfziffer.
  param([string] $Pzn)
  if ($Pzn -notmatch '^\d{8}$') { return $false }
  $summe = 0
  for ($i = 0; $i -lt 7; $i++) { $summe += ($i + 1) * [int]::Parse($Pzn[$i]) }
  ($summe % 11) -ne 10 -and ($summe % 11) -eq [int]::Parse($Pzn[7])
}

function Test-Rezept {
  <#
    .SYNOPSIS
    Probleme eines Rezeptdatensatzes, bevor die Kasse ihn sieht; leer heisst gut.
  #>
  param([Parameter(Mandatory)] [hashtable] $Rezept, [Parameter(Mandatory)] [datetime] $Heute)
  foreach ($feld in 'rezeptId', 'gueltigBis', 'zahlung') {
    if (-not $Rezept[$feld]) { "Feld $feld fehlt" }
  }
  $positionen = @($Rezept['positionen'] | Where-Object { $_ })
  if ($positionen.Count -eq 0) { 'Positionen fehlen' }
  if ($positionen.Count -gt 10) { 'Mehr als 10 Positionen' }
  if ($Rezept['gueltigBis']) {
    $bis = [datetime]::ParseExact([string]$Rezept.gueltigBis, 'yyyy-MM-dd', $null)
    if ($bis.Date -lt $Heute.Date) { "Rezept abgelaufen am $($bis.ToString('dd.MM.yyyy', $script:Datum))" }
  }
  if ($Rezept['zahlung'] -and $Rezept.zahlung -ne 'karte') { "Zahlung $($Rezept.zahlung) wird im Prototyp nicht gebucht" }
  foreach ($p in $positionen) {
    $pzn = [string]$p['pzn']
    if (-not (Test-PznPruefziffer $pzn)) { "PZN ${pzn}: Prüfziffer falsch"; continue }
    $menge = 0
    if (-not [int]::TryParse([string]$p['menge'], [ref]$menge) -or $menge -lt 1 -or $menge -gt 20) {
      "PZN ${pzn}: Menge $($p['menge']) liegt nicht zwischen 1 und 20"
    }
  }
}

function Get-RezeptKennung {
  <#
    .SYNOPSIS
    Kennung für die Engine aus der Rezept-ID: immer dieselbe für dasselbe
    Rezept, darum findet die Engine ein doppelt geschicktes Rezept im Journal.
  #>
  param([Parameter(Mandatory)] [string] $RezeptId)
  $hash = [System.Security.Cryptography.SHA256]::HashData([Text.Encoding]::UTF8.GetBytes($RezeptId))
  $z = $script:KennungZeichen
  $zeichen = -join (0..5 | ForEach-Object { $z[$hash[$_] % $z.Length] })
  "$($zeichen.Substring(0, 2))-$($zeichen.Substring(2, 4))"
}

function ConvertTo-Auftrag {
  # Jede Position mit Rezept-Häkchen: Der Datensatz ist das Rezept.
  param([Parameter(Mandatory)] [hashtable] $Rezept)
  @{
    kennung    = Get-RezeptKennung $Rezept.rezeptId
    zahlung    = 'karte'
    positionen = @($Rezept.positionen | ForEach-Object { @{ pzn = [string]$_.pzn; menge = [int]$_.menge; rezept = $true } })
  }
}

function Invoke-RezeptStapel {
  <#
    .SYNOPSIS
    Bucht alle Rezeptdatensätze eines Ordners über die Engine an einer Kasse und
    liefert je Datensatz Ergebnis, Grund, Beleg und Dauer.
  #>
  param(
    [Parameter(Mandatory)] [string] $Ordner,
    [Parameter(Mandatory)] [datetime] $Heute,
    [Parameter(Mandatory)] $Treiber,
    [hashtable] $Optionen = @{},
    [string] $Kasse = 'nord'
  )
  $flow = Import-Flow -Apotheke $Kasse -Flow verkauf -Wurzel (Join-Path $PSScriptRoot '../../flows')
  foreach ($datei in (Get-ChildItem -LiteralPath $Ordner -Filter *.json | Sort-Object Name)) {
    $start = Get-Date
    $rezept = Get-Content -LiteralPath $datei.FullName -Raw | ConvertFrom-Json -AsHashtable
    $probleme = @(Test-Rezept -Rezept $rezept -Heute $Heute)
    $zeile = [ordered]@{ Datei = $datei.Name; RezeptId = [string]$rezept['rezeptId']; Kennung = ''; Ergebnis = ''; Grund = ''; Beleg = ''; DauerMs = 0 }
    if ($probleme.Count -gt 0) {
      $zeile.Ergebnis = 'abgelehnt'
      $zeile.Grund = $probleme -join '; '
    }
    else {
      $auftrag = ConvertTo-Auftrag -Rezept $rezept
      $zeile.Kennung = $auftrag.kennung
      $bericht = Invoke-Flow -Flow $flow -Treiber $Treiber -Auftrag $auftrag -Optionen $Optionen
      $zeile.Ergebnis = switch ($bericht.status) { 'ok' { 'gebucht' } 'bereits-gebucht' { 'schon gebucht' } default { $_ } }
      $zeile.Beleg = [string]$bericht.werte['beleg']
      if ($bericht.fehler) { $zeile.Grund = $bericht.fehler.meldung }
    }
    $zeile.DauerMs = [int]((Get-Date) - $start).TotalMilliseconds
    [pscustomobject]$zeile
  }
}
