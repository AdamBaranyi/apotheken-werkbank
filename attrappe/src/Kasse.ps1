# Logik der Kassen-Attrappe, ohne Oberfläche. Das WinForms-Fenster und die
# Bildschirm-Simulation des Fake-Treibers rufen dieselben Funktionen auf; jeder
# Text, den die Engine später per OCR liest, entsteht hier.

$script:KassenTexte = @{
  Rueckfrage   = 'Rezept liegt vor?'
  Positionen   = 'Positionen {0}'
  Summe        = 'Summe {0}'
  GebuchtBar   = 'Beleg {0} gebucht, Rückgeld {1}'
  GebuchtKarte = 'Beleg {0} gebucht, Kartenzahlung'
}
$script:Deutsch = [System.Globalization.CultureInfo]::GetCultureInfo('de-DE')

function Format-Euro {
  param([long] $Cent)
  ([decimal]$Cent / 100).ToString('N2', $script:Deutsch) + ' €'
}

function Test-Pzn {
  # PZN-8: Die Ziffern 1 bis 7 mal 1 bis 7, Summe modulo 11 ist die
  # Prüfziffer; ergibt sich 10, gibt es die Nummer nicht.
  param([string] $Pzn)
  if ($Pzn -notmatch '^\d{8}$') { return $false }
  $summe = 0
  for ($i = 0; $i -lt 7; $i++) { $summe += ($i + 1) * [int]::Parse($Pzn[$i]) }
  $pruef = $summe % 11
  $pruef -ne 10 -and $pruef -eq [int]::Parse($Pzn[7])
}

function ConvertFrom-Betrag {
  # «20», «20,5», «20,50» oder «20.50» in Cent; sonst $null.
  param([string] $Text)
  $t = $Text.Trim()
  if ($t -notmatch '^(\d{1,6})(?:[.,](\d{1,2}))?$') { return $null }
  $nachkomma = if ($Matches[2]) { $Matches[2].PadRight(2, '0') } else { '00' }
  [long]$Matches[1] * 100 + [long]$nachkomma
}

function New-KassenZustand {
  [CmdletBinding()]
  param(
    [string] $Artikelpfad = (Join-Path $PSScriptRoot '../../daten/artikel.json'),
    [hashtable] $Texte = @{}
  )
  $artikel = @{}
  foreach ($a in (Get-Content -LiteralPath $Artikelpfad -Raw -Encoding utf8 | ConvertFrom-Json).artikel) {
    $artikel[$a.pzn] = @{ Name = "$($a.name) $($a.packung)"; PreisCent = [long]$a.preisCent; Rx = [bool]$a.rezeptpflichtig }
  }
  $alleTexte = $script:KassenTexte.Clone()
  foreach ($k in $Texte.Keys) { $alleTexte[$k] = $Texte[$k] }
  @{
    Artikel        = $artikel
    Texte          = $alleTexte
    Bon            = [System.Collections.Generic.List[object]]::new()
    Journal        = [System.Collections.Generic.List[object]]::new()
    NaechsteNummer = 1001
    Abschluesse    = 0
    Status         = 'Neuer Bon'
    Treffer        = ''
    Rueckfrage     = $null
  }
}

function Get-KassenSumme {
  param([hashtable] $Kasse)
  [long](($Kasse.Bon | ForEach-Object { $_.Menge * $_.PreisCent } | Measure-Object -Sum).Sum)
}

function Add-Bonzeile {
  param([hashtable] $Kasse, [string] $Pzn, [int] $Menge, [bool] $Rezept)
  $da = $Kasse.Bon | Where-Object Pzn -EQ $Pzn | Select-Object -First 1
  if ($da) {
    $da.Menge += $Menge
    $da.Rezept = $da.Rezept -or $Rezept
  }
  else {
    $a = $Kasse.Artikel[$Pzn]
    $Kasse.Bon.Add(@{ Pzn = $Pzn; Name = $a.Name; Menge = $Menge; PreisCent = $a.PreisCent; Rezept = $Rezept })
  }
  $Kasse.Status = "Hinzugefügt: $Pzn"
}

function Add-KassenPosition {
  [CmdletBinding()]
  param([Parameter(Mandatory)] [hashtable] $Kasse, [AllowEmptyString()] [string] $Pzn, [AllowEmptyString()] [string] $Menge)
  $pzn = $Pzn.Trim()
  $mengeText = $Menge.Trim()
  if (-not (Test-Pzn $pzn)) {
    $Kasse.Status = "PZN ungültig: $pzn"
    return @{ Ok = $false }
  }
  if (-not $Kasse.Artikel.ContainsKey($pzn)) {
    $Kasse.Status = "Artikel unbekannt: $pzn"
    return @{ Ok = $false }
  }
  $anzahl = 1
  if ($mengeText -ne '' -and (-not [int]::TryParse($mengeText, [ref]$anzahl) -or $anzahl -lt 1 -or $anzahl -gt 99)) {
    $Kasse.Status = "Menge ungültig: $mengeText"
    return @{ Ok = $false }
  }
  if ($Kasse.Artikel[$pzn].Rx) {
    $Kasse.Rueckfrage = @{ Text = $Kasse.Texte.Rueckfrage; Pzn = $pzn; Menge = $anzahl }
    return @{ Ok = $true; Rueckfrage = $Kasse.Texte.Rueckfrage }
  }
  Add-Bonzeile -Kasse $Kasse -Pzn $pzn -Menge $anzahl -Rezept $false
  @{ Ok = $true; Rueckfrage = $null }
}

function Resolve-KassenRueckfrage {
  # Antwort auf «Rezept liegt vor?»: mit -Ja kommt der Artikel auf den Bon.
  [CmdletBinding()]
  param([Parameter(Mandatory)] [hashtable] $Kasse, [switch] $Ja)
  $offen = $Kasse.Rueckfrage
  if ($null -eq $offen) { return @{ Ok = $false } }
  $Kasse.Rueckfrage = $null
  if (-not $Ja) {
    $Kasse.Status = "Ohne Rezept nicht abgegeben: $($offen.Pzn)"
    return @{ Ok = $false }
  }
  Add-Bonzeile -Kasse $Kasse -Pzn $offen.Pzn -Menge $offen.Menge -Rezept $true
  @{ Ok = $true }
}

function Invoke-KassenZahlung {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)] [hashtable] $Kasse,
    [Parameter(Mandatory)] [ValidateSet('bar', 'karte')] [string] $Art,
    [AllowEmptyString()] [string] $Gegeben = '',
    [AllowEmptyString()] [string] $Referenz = ''
  )
  if ($Kasse.Bon.Count -eq 0) {
    $Kasse.Status = 'Bon ist leer'
    return
  }
  $summe = Get-KassenSumme $Kasse
  $gegebenCent = $summe
  if ($Art -eq 'bar') {
    $gegebenCent = ConvertFrom-Betrag $Gegeben
    if ($null -eq $gegebenCent) {
      $Kasse.Status = "Betrag ungültig: $Gegeben"
      return
    }
    if ($gegebenCent -lt $summe) {
      $Kasse.Status = "Gegeben reicht nicht: fehlt $(Format-Euro ($summe - $gegebenCent))"
      return
    }
  }
  $beleg = [pscustomobject]@{
    Nummer        = $Kasse.NaechsteNummer
    SummeCent     = $summe
    Zahlung       = $Art
    GegebenCent   = $gegebenCent
    RueckgeldCent = $gegebenCent - $summe
    Referenz      = $Referenz.Trim()
    Zeit          = (Get-Date).ToString('o')
    Positionen    = @($Kasse.Bon | ForEach-Object { [pscustomobject]@{ Pzn = $_.Pzn; Menge = $_.Menge; PreisCent = $_.PreisCent; Rezept = $_.Rezept } })
    Abschluss     = 0
  }
  $Kasse.Journal.Add($beleg)
  $Kasse.NaechsteNummer++
  $Kasse.Bon.Clear()
  $Kasse.Status = if ($Art -eq 'bar') {
    $Kasse.Texte.GebuchtBar -f $beleg.Nummer, (Format-Euro $beleg.RueckgeldCent)
  }
  else { $Kasse.Texte.GebuchtKarte -f $beleg.Nummer }
  $beleg
}

function Find-KassenBeleg {
  # Sucht über die ganze Referenz, nie über einen Teil: Die Engine prüft so,
  # ob ein Auftrag schon gebucht ist.
  [CmdletBinding()]
  param([Parameter(Mandatory)] [hashtable] $Kasse, [AllowEmptyString()] [string] $Referenz)
  $ref = $Referenz.Trim()
  if ($ref -eq '') {
    $Kasse.Treffer = 'Referenz fehlt'
    return
  }
  $beleg = $Kasse.Journal | Where-Object Referenz -CEQ $ref | Select-Object -First 1
  $Kasse.Treffer = if ($beleg) { "Referenz ${ref}: Beleg $($beleg.Nummer)" } else { "Referenz ${ref}: unbekannt" }
  $beleg
}

function Close-KassenTag {
  [CmdletBinding()]
  param([Parameter(Mandatory)] [hashtable] $Kasse)
  $offen = @($Kasse.Journal | Where-Object Abschluss -EQ 0)
  if ($offen.Count -eq 0) {
    $Kasse.Status = 'Abschluss: keine offenen Belege'
    return
  }
  $Kasse.Abschluesse++
  foreach ($b in $offen) { $b.Abschluss = $Kasse.Abschluesse }
  $summe = ($offen | Measure-Object -Property SummeCent -Sum).Sum
  $wort = if ($offen.Count -eq 1) { 'Beleg' } else { 'Belege' }
  $Kasse.Status = "Abschluss $($Kasse.Abschluesse): $($offen.Count) $wort, $(Format-Euro $summe)"
  @{ Nummer = $Kasse.Abschluesse; Belege = $offen.Count; SummeCent = $summe }
}

function Clear-KassenBon {
  [CmdletBinding()]
  param([Parameter(Mandatory)] [hashtable] $Kasse)
  $Kasse.Bon.Clear()
  $Kasse.Rueckfrage = $null
  $Kasse.Status = 'Neuer Bon'
}

function Get-KassenAnzeige {
  # Alle Texte, die das Fenster zeigt, an einem Ort.
  [CmdletBinding()]
  param([Parameter(Mandatory)] [hashtable] $Kasse)
  @{
    Status     = $Kasse.Status
    Treffer    = $Kasse.Treffer
    Summe      = $Kasse.Texte.Summe -f (Format-Euro (Get-KassenSumme $Kasse))
    Positionen = $Kasse.Texte.Positionen -f $Kasse.Bon.Count
    Bonzeilen  = @($Kasse.Bon | ForEach-Object {
        "$($_.Pzn) $($_.Name) $($_.Menge) x $(([decimal]$_.PreisCent / 100).ToString('N2', $script:Deutsch))"
      })
    Rueckfrage = if ($Kasse.Rueckfrage) { $Kasse.Rueckfrage.Text } else { $null }
  }
}
