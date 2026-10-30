# Text auf dem Bildschirm finden. Die OCR liest nie ganz sicher: Umlaute
# fehlen, O wird zu 0, Wörter zerfallen oder kleben zusammen. Darum vergleicht
# die Engine unscharf mit einer Schwelle, kurze Wörter und Kennungen aber genau.

if (-not ('Werkbank.TextAbgleich' -as [type])) {
  Add-Type -Path (Join-Path $PSScriptRoot 'TextAbgleich.cs')
}

function ConvertTo-Vergleichstext {
  # Einheitliche Schreibweise für den Vergleich: Kleinbuchstaben, ein
  # Leerzeichen, gerade Striche und Anführungszeichen.
  param([AllowEmptyString()] [string] $Text)
  $t = $Text -replace '[‐-―−]', '-'
  $t = $t -replace '[‘’‚‛]', "'"
  $t = $t -replace '[“”„‟]', '"'
  $t = $t -replace '…', '...'
  ($t -replace '\s+', ' ').Trim().ToLowerInvariant()
}

function Get-Aehnlichkeit {
  <#
    .SYNOPSIS
    Ähnlichkeit zweier Texte zwischen 0 und 1, so wie die OCR sie braucht:
    ohne Gross/Klein, und Zeichen, die sie mit Ziffern verwechselt, zählen gleich.
  #>
  [CmdletBinding()]
  [OutputType([double])]
  param(
    [Parameter(Mandatory)] [AllowEmptyString()] [string] $A,
    [Parameter(Mandatory)] [AllowEmptyString()] [string] $B
  )
  $a = ConvertTo-Vergleichstext $A
  $b = ConvertTo-Vergleichstext $B
  $roh = [Werkbank.TextAbgleich]::Aehnlichkeit($a, $b)
  $ziffern = [Werkbank.TextAbgleich]::Aehnlichkeit([Werkbank.TextAbgleich]::Ziffern($a), [Werkbank.TextAbgleich]::Ziffern($b))
  [math]::Max($roh, $ziffern)
}

function Test-ImBereich {
  param($Wort, [hashtable] $Bereich)
  $mx = $Wort.X + $Wort.B / 2
  $my = $Wort.Y + $Wort.H / 2
  $mx -ge $Bereich.X -and $mx -le ($Bereich.X + $Bereich.B) -and
  $my -ge $Bereich.Y -and $my -le ($Bereich.Y + $Bereich.H)
}

function Get-Kandidatenwert {
  # Wert eines Kandidaten: genau 1 oder 0 bei kurzen Zielen und bei -Genau,
  # sonst die unscharfe Ähnlichkeit.
  param([string] $Kandidat, [string] $Ziel, [bool] $Genau, [bool] $Kurz)
  if ($Genau) { return [double]($Kandidat -eq $Ziel) }
  if ($Kurz) {
    $gleich = $Kandidat -eq $Ziel -or
    [Werkbank.TextAbgleich]::Ziffern($Kandidat) -eq [Werkbank.TextAbgleich]::Ziffern($Ziel)
    return [double]$gleich
  }
  # Zahlen tragen die Bedeutung (Menge, Betrag, Zähler): Sie müssen genau so
  # dastehen. Sonst galt «Positionen 1» als «Positionen 2» (0,917, E40).
  if (-not (Test-ZahlenGleich -Kandidat $Kandidat -Ziel $Ziel)) { return 0.0 }
  Get-Aehnlichkeit -A $Kandidat -B $Ziel
}

function Get-Zahlform {
  # Ein Wort als Zahl, nach Ausgleich der OCR-Verwechslungen (O/0, l/1 …) und
  # mit Komma statt Punkt; leer, wenn es keine Zahl ist. Ohne Ziffer zählen nur
  # ein bis zwei Zeichen, die die OCR mit Ziffern verwechselt («l» für «1»).
  param([string] $Wort)
  $z = [Werkbank.TextAbgleich]::Ziffern($Wort) -replace '\.', ','
  if (($Wort -match '\d' -or $Wort -match '^[oil|!sbz]{1,2}$') -and $z -match '^[\d,]+$') { return $z }
  ''
}

function Test-ZahlenGleich {
  # Jede Zahl des Ziels steht genau so im Kandidaten: als eigenes Wort, aus zwei
  # Nachbarwörtern («1 5,34» für «15,34») oder am Ende eines Worts («Vorgang1»).
  # In einem Bezeichner («K7-QX4M») zählen seine Ziffern als Ganzes. Ein
  # Buchstabe, den die OCR als Ziffer las («1m» für «Im»), stört so nicht.
  param([string] $Kandidat, [string] $Ziel)
  $verlangt = @(foreach ($w in ($Ziel -split ' ')) {
      if ($w -notmatch '\d') { continue }
      $f = Get-Zahlform $w
      if ($f) { $f } else { 'id:' + ([Werkbank.TextAbgleich]::Ziffern($w) -replace '\D', '') }
    })
  if ($verlangt.Count -eq 0) { return $true }
  $woerter = @($Kandidat -split ' ' | Where-Object { $_ })
  $da = [System.Collections.Generic.HashSet[string]]::new()
  for ($i = 0; $i -lt $woerter.Count; $i++) {
    $f = Get-Zahlform $woerter[$i]
    if ($f) {
      $null = $da.Add($f)
      if ($i + 1 -lt $woerter.Count -and ($g = Get-Zahlform $woerter[$i + 1])) { $null = $da.Add($f + $g) }
      continue
    }
    if ($woerter[$i] -notmatch '\d') { continue }
    $z = [Werkbank.TextAbgleich]::Ziffern($woerter[$i]) -replace '\.', ','
    $null = $da.Add('id:' + ($z -replace '\D', ''))
    $ende = [regex]::Match($z, '[\d,]+$').Value
    if ($ende) { $null = $da.Add($ende) }
  }
  @($verlangt | Where-Object { -not $da.Contains($_) }).Count -eq 0
}

function New-Fundstelle {
  param([object[]] $Woerter, [double] $Wert)
  $x = ($Woerter | Measure-Object -Property X -Minimum).Minimum
  $y = ($Woerter | Measure-Object -Property Y -Minimum).Minimum
  $rechts = ($Woerter | ForEach-Object { $_.X + $_.B } | Measure-Object -Maximum).Maximum
  $unten = ($Woerter | ForEach-Object { $_.Y + $_.H } | Measure-Object -Maximum).Maximum
  [pscustomobject]@{
    Text    = ($Woerter.Text) -join ' '
    Wert    = [math]::Round($Wert, 3)
    X       = [int]$x
    Y       = [int]$y
    B       = [int]($rechts - $x)
    H       = [int]($unten - $y)
    MitteX  = [int][math]::Floor($x + ($rechts - $x) / 2)
    MitteY  = [int][math]::Floor($y + ($unten - $y) / 2)
    Zeile   = $Woerter[0].Zeile
    Woerter = $Woerter
  }
}

function Find-Text {
  <#
    .SYNOPSIS
    Sucht einen Text in den Wörtern eines Bildes, auch über mehrere Wörter einer
    Zeile, und liefert die beste Fundstelle mit Lage (oder alle mit -Alle).
    .PARAMETER Genau
    Nur exakte Gleichheit (ohne Gross/Klein). Für Kennungen und Referenzen:
    Ein unscharfer Treffer bei «A-20» statt «A-2» wäre eine falsche Buchung.
  #>
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)] $Bild,
    [Parameter(Mandatory)] [string] $Text,
    [ValidateRange(0.5, 1.0)] [double] $Schwelle = 0.85,
    [switch] $Genau,
    [hashtable] $Bereich,
    [switch] $Alle
  )
  $ziel = ConvertTo-Vergleichstext $Text
  if ($ziel.Length -eq 0) { throw 'Find-Text: leerer Suchtext.' }
  $anzahl = @($ziel -split ' ').Count
  $kurz = $ziel.Length -le 3

  $woerter = @($Bild.Woerter | Where-Object { $null -eq $Bereich -or (Test-ImBereich $_ $Bereich) })
  $kandidaten = [System.Collections.Generic.List[object]]::new()
  foreach ($gruppe in ($woerter | Group-Object -Property Zeile)) {
    $zeile = @($gruppe.Group | Sort-Object -Property X)
    for ($i = 0; $i -lt $zeile.Count; $i++) {
      $bis = [math]::Min($zeile.Count - $i, $anzahl + 1)
      for ($laenge = [math]::Max(1, $anzahl - 1); $laenge -le $bis; $laenge++) {
        $teil = @($zeile[$i..($i + $laenge - 1)])
        $kandidat = ConvertTo-Vergleichstext (($teil.Text) -join ' ')
        $wert = Get-Kandidatenwert -Kandidat $kandidat -Ziel $ziel -Genau $Genau.IsPresent -Kurz $kurz
        if ($wert -ge $Schwelle) { $kandidaten.Add((New-Fundstelle -Woerter $teil -Wert $wert)) }
      }
    }
  }

  # Beste zuerst; bei Gleichstand die obere, dann die linke. Überlappende
  # Kandidaten derselben Wörter zählen nur einmal.
  $belegt = [System.Collections.Generic.HashSet[string]]::new()
  $treffer = foreach ($k in ($kandidaten | Sort-Object -Property @{ Expression = 'Wert'; Descending = $true }, Y, X)) {
    $schluessel = @($k.Woerter | ForEach-Object { "$($_.Zeile):$($_.X):$($_.Y)" })
    if (@($schluessel | Where-Object { $belegt.Contains($_) }).Count -gt 0) { continue }
    foreach ($s in $schluessel) { $null = $belegt.Add($s) }
    $k
  }
  if ($Alle) { return @($treffer) }
  @($treffer) | Select-Object -First 1
}
