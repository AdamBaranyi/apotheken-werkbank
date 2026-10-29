# Bildschirm lesen und auf Zustände warten. Grundsätze:
# - Jede Prüfung fotografiert neu; kein Klick auf Koordinaten von gestern.
# - Bekannte Dialoge (aus dem Flow) klickt die Engine weg, bevor sie weitermacht.
# - Eine Fehlermeldung der Kasse bricht sofort ab, aber nur eine neue: Was beim
#   Start des Laufs schon dastand, ist alt, bis es einmal verschwunden ist.
#   Alles, was danach erscheint, ist eine Folge dieses Laufs.
# - Gewartet wird bis zu einer Zahl von Bildern und, wenn geschlafen wird,
#   bis zu einer Zeit. Ohne Schlafen (Tests) zählen nur die Bilder.

function Get-Stand {
  param([hashtable] $Lauf)
  $bild = $null
  for ($runde = 0; $runde -lt 4; $runde++) {
    $f = $Lauf.Treiber.Fenster($Lauf.Flow.Fenster)
    if ($null -eq $f) { throw "Fenster '$($Lauf.Flow.Fenster)' nicht gefunden." }
    $null = $Lauf.Treiber.Vordergrund($f)
    $bild = $Lauf.Treiber.Bildschirm($f)
    $Lauf.Bild = $bild
    $Lauf.Fenster = $f
    if ($bild.PSObject.Properties['Sprache'] -and $bild.Sprache) { $Lauf.Bericht.ocr = $bild.Sprache }
    $aktuell = @(Get-Fehlerzeilen $Lauf $bild)
    $Lauf.FehlerVorher = @($Lauf.FehlerVorher | Where-Object { $aktuell -contains $_ })
    $dialog = $Lauf.Flow.Dialoge | Where-Object { Find-Text -Bild $bild -Text $_.text } | Select-Object -First 1
    if (-not $dialog) { return $bild }
    $knopf = Find-Text -Bild $bild -Text $dialog.klicke
    if (-not $knopf) { return $bild }
    $null = $Lauf.Treiber.Klick($f.X + $knopf.MitteX, $f.Y + $knopf.MitteY)
    $Lauf.Bericht.dialoge.Add([pscustomobject]@{ text = $dialog.text; klick = $dialog.klicke; zeit = (Get-Date).ToString('o') })
  }
  $bild
}

function Get-Zeilentext {
  param($Bild, [int] $Zeile)
  (@($Bild.Woerter | Where-Object Zeile -EQ $Zeile | Sort-Object X).Text) -join ' '
}

function Get-Fehlerzeilen {
  # Zeilen mit einer Fehlermeldung aus der Liste des Flows.
  param([hashtable] $Lauf, $Bild)
  foreach ($text in $Lauf.Flow.Fehler) {
    $f = Find-Text -Bild $Bild -Text $text
    if ($f) { Get-Zeilentext $Bild $f.Zeile }
  }
}

function Find-Ziel {
  # Wie Find-Text, aber ein Ziel an zwei gleich guten Stellen ist mehrdeutig:
  # Die Engine klickt dann nicht und rät nicht.
  param($Bild, [string] $Text, [switch] $Genau)
  $alle = @(Find-Text -Bild $Bild -Text $Text -Genau:$Genau -Alle)
  if ($alle.Count -eq 0) { return $null }
  $gleich = @($alle | Where-Object { [math]::Abs($_.Wert - $alle[0].Wert) -lt 0.001 })
  if ($gleich.Count -gt 1) { return [pscustomobject]@{ Mehrdeutig = $true; Anzahl = $gleich.Count } }
  $alle[0] | Add-Member -NotePropertyName Mehrdeutig -NotePropertyValue $false -PassThru -Force
}

function ConvertTo-Suche {
  param([hashtable] $Lauf, $Suche)
  if ($Suche -is [string]) { $Suche = @{ text = $Suche } }
  $texte = if ($Suche['eins-von']) { @($Suche['eins-von']) } else { @($Suche['text']) }
  @{
    Texte    = @($texte | ForEach-Object { Expand-Text -Text $_ -Kontext $Lauf.Kontext })
    Genau    = [bool]$Suche['genau']
    Schwelle = if ($Suche['schwelle']) { [double]$Suche['schwelle'] } else { 0.85 }
    Zeit     = if ($Suche['zeit']) { [double]$Suche['zeit'] } else { 0 }
  }
}

function Get-Bilderzahl {
  param([hashtable] $Lauf, [double] $Zeit)
  [int][math]::Max(2, [math]::Ceiling($Zeit / $Lauf.Optionen.Takt))
}

function Wait-Pause {
  # Liefert $false, wenn die Zeit um ist.
  param([hashtable] $Lauf, [datetime] $Bis)
  if (-not $Lauf.Optionen.Schlafen) { return $true }
  if ((Get-Date) -ge $Bis) { return $false }
  Start-Sleep -Milliseconds ([int]($Lauf.Optionen.Takt * 1000))
  $true
}

function Test-NeuerKassenfehler {
  param([hashtable] $Lauf, $Bild)
  foreach ($zeile in @(Get-Fehlerzeilen $Lauf $Bild)) {
    if ($Lauf.FehlerVorher -notcontains $zeile) { return $zeile }
  }
  $null
}

function Wait-Suche {
  param([hashtable] $Lauf, $Suche, [double] $Zeit, [hashtable] $Bereich)
  $s = ConvertTo-Suche $Lauf $Suche
  if ($s.Zeit -gt 0) { $Zeit = $s.Zeit }
  $bis = (Get-Date).AddSeconds($Zeit)
  for ($i = 1; $i -le (Get-Bilderzahl $Lauf $Zeit); $i++) {
    $bild = Get-Stand $Lauf
    $fehler = Test-NeuerKassenfehler $Lauf $bild
    if ($fehler) { return @{ Ok = $false; Endgueltig = $true; KasseFehler = $true; Meldung = "Kasse meldet: $fehler" } }
    foreach ($t in $s.Texte) {
      $f = Find-Text -Bild $bild -Text $t -Genau:$s.Genau -Schwelle $s.Schwelle -Bereich $Bereich
      if ($f) { return @{ Ok = $true; Wert = $f.Wert; Text = $t } }
    }
    if (-not (Wait-Pause $Lauf $bis)) { break }
  }
  @{ Ok = $false; Meldung = "Nicht erschienen nach ${Zeit} s: $($s.Texte -join ' | ')" }
}

function ConvertFrom-OcrZiffern {
  # Ziffern, die die OCR als Buchstaben las, zurück in Ziffern.
  param([string] $Text)
  if ($Text -notmatch '^[\dOoIl|.,]+$') { return $Text }
  $Text -replace '[Oo]', '0' -replace '[Il|]', '1'
}

function Wait-Muster {
  # Wartet, bis eine Zeile zum Muster passt, und liest die Gruppen. Ziffern
  # dürfen dabei als O, I oder l gelesen sein.
  param([hashtable] $Lauf, [string] $Muster, [double] $Zeit)
  $tolerant = $Muster -replace '\\d', '[\dOoIl|]'
  $bis = (Get-Date).AddSeconds($Zeit)
  for ($i = 1; $i -le (Get-Bilderzahl $Lauf $Zeit); $i++) {
    $bild = Get-Stand $Lauf
    $fehler = Test-NeuerKassenfehler $Lauf $bild
    if ($fehler) { return @{ Ok = $false; Endgueltig = $true; KasseFehler = $true; Meldung = "Kasse meldet: $fehler" } }
    foreach ($zeile in ($bild.Woerter | Group-Object Zeile)) {
      $text = (@($zeile.Group | Sort-Object X).Text) -join ' '
      $m = [regex]::Match($text, $Muster, 'IgnoreCase')
      if (-not $m.Success) { $m = [regex]::Match($text, $tolerant, 'IgnoreCase') }
      if ($m.Success) {
        $gruppen = @(for ($g = 1; $g -lt $m.Groups.Count; $g++) { ConvertFrom-OcrZiffern $m.Groups[$g].Value })
        return @{ Ok = $true; Gruppen = $gruppen; Text = $text }
      }
    }
    if (-not (Wait-Pause $Lauf $bis)) { break }
  }
  @{ Ok = $false; Meldung = "Muster nicht gefunden nach ${Zeit} s: $Muster" }
}
