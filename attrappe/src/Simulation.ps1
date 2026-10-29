# Bildschirm-Simulation der Kassen-Attrappe für den Fake-Treiber der Engine:
# zeigt das Fenster als Wörter mit Lage (wie eine OCR), nimmt Klicks, Tippen
# und Tasten an und verhält sich dabei wie das WinForms-Fenster: Das erste Feld
# hat zu Beginn den Fokus, Escape leert ein Feld, Enter löst die Aktion des
# Feldes aus, ein Dialog sperrt das Fenster, eine laufende Buchung auch. Dazu Chaos für die Tests: langsame
# Buchung, wanderndes Fenster, Nullen als O, Dialoge mitten im Ablauf.

$script:Worthoehe = 14

function New-KassenSimulation {
  [CmdletBinding()]
  param(
    [ValidateSet('nord', 'sued')] [string] $Variante = 'nord',
    [hashtable] $Layout,
    [hashtable] $Chaos = @{},
    [int[]] $Ursprung = @(60, 60)
  )
  if (-not $Layout) { $Layout = Import-KassenLayout -Variante $Variante }
  $probleme = @(Test-KassenLayout -Layout $Layout)
  if ($probleme.Count -gt 0) { throw "Layout ungültig: $($probleme -join '; ')" }
  $felder = [ordered]@{}
  foreach ($e in @($Layout.Elemente | Where-Object { $_['Art'] -eq 'feld' })) { $felder[$e.Name] = '' }
  @{
    Layout     = $Layout
    Kasse      = New-KassenZustand -Texte $Layout['Texte']
    Felder     = $felder
    Fokus      = @($felder.Keys)[0]
    Dialog     = $null
    Ursprung   = @{ X = $Ursprung[0]; Y = $Ursprung[1] }
    Chaos      = @{
      Langsam       = [int]$Chaos['Langsam']
      Wandern       = $Chaos['Wandern']
      Verlesen      = [bool]$Chaos['Verlesen']
      Schreibmarke  = [bool]$Chaos['Schreibmarke']
      Unlesbar      = @($Chaos['Unlesbar'] | Where-Object { $_ })
      Unsichtbar    = @($Chaos['Unsichtbar'] | Where-Object { $_ })
      Flackern      = [string]$Chaos['Flackern']
      DialogNach    = [int]$Chaos['DialogNach']
      UnbekanntNach = [int]$Chaos['UnbekanntNach']
    }
    Gezeigt    = @{ preisliste = $false; unbekannt = $false }
    Aktionen   = 0
    Bilder     = 0
    Ausstehend = $null
  }
}

function Add-SimWorte {
  # Legt die Wörter eines Textes als eine OCR-Zeile ab.
  param($Liste, [string] $Text, [int] $X, [int] $Y, [int] $Zeichenbreite, [ref] $Zeile)
  if ([string]::IsNullOrWhiteSpace($Text)) { return }
  $x = $X
  foreach ($wort in ($Text -split ' ' | Where-Object { $_ })) {
    $Liste.Add([pscustomobject]@{ Text = $wort; X = $x; Y = $Y; B = $Zeichenbreite * $wort.Length; H = $script:Worthoehe; Zeile = $Zeile.Value })
    $x += $Zeichenbreite * ($wort.Length + 1)
  }
  $Zeile.Value++
}

function Get-SimMitteY([int[]] $Lage) { [int]($Lage[1] + $Lage[3] / 2 - $script:Worthoehe / 2) }

function Get-SimulationsBild {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)] [hashtable] $Simulation,
    # Zweiter Blick: dasselbe Bild in anderer Grösse gelesen. Die Zeit läuft
    # nicht weiter, und was nur dreifach unlesbar ist, steht da.
    [switch] $AndereGroesse
  )
  $s = $Simulation
  if (-not $AndereGroesse) {
    Step-SimAusstehend $s
    $s.Bilder++
  }
  # Flackern: Eine Anzeige fehlt in jedem zweiten Bild, als wäre sie halb neu gezeichnet.
  $flackerAus = $s.Chaos.Flackern -and $s.Bilder % 2 -eq 0
  $zb = $s.Layout.Schrift.Zeichenbreite
  $anzeige = Get-KassenAnzeige -Kasse $s.Kasse
  if ($s.Ausstehend) { $anzeige.Status = 'Bitte warten …' }
  $woerter = [System.Collections.Generic.List[object]]::new()
  $zeile = 0
  foreach ($e in $s.Layout.Elemente) {
    $lage = @($e.Lage)
    switch ($e.Art) {
      'beschriftung' { Add-SimWorte $woerter $e.Text $lage[0] (Get-SimMitteY $lage) $zb ([ref]$zeile) }
      'anzeige' {
        $text = [string]$anzeige[$e.Name]
        if (-not ($flackerAus -and $text.Contains($s.Chaos.Flackern))) {
          Add-SimWorte $woerter $text $lage[0] (Get-SimMitteY $lage) $zb ([ref]$zeile)
        }
      }
      'feld' {
        # Die Schreibmarke klebt am letzten Zeichen, wie im echten Fenster.
        $text = [string]$s.Felder[$e.Name]
        if ($s.Chaos.Schreibmarke -and $s.Fokus -eq $e.Name -and -not $s.Dialog) { $text += '|' }
        # Unlesbar: eine Angabe, die die OCR dreifach nicht findet (Kasse Nord: «1» hinter
        # «Menge»), vierfach aber schon. Unsichtbar: in keiner Grösse.
        $weg = $s.Chaos.Unsichtbar -contains $text -or (-not $AndereGroesse -and $s.Chaos.Unlesbar -contains $text)
        if (-not $weg) {
          Add-SimWorte $woerter $text ($lage[0] + 3) (Get-SimMitteY $lage) $zb ([ref]$zeile)
        }
      }
      'knopf' {
        $x = [int]($lage[0] + ($lage[2] - $zb * $e.Text.Length) / 2)
        Add-SimWorte $woerter $e.Text $x (Get-SimMitteY $lage) $zb ([ref]$zeile)
      }
      'liste' {
        $zeilen = @($anzeige[$e.Name])
        for ($i = 0; $i -lt $zeilen.Count -and (2 + $i * 16 + $script:Worthoehe) -le $lage[3]; $i++) {
          Add-SimWorte $woerter $zeilen[$i] ($lage[0] + 3) ($lage[1] + 2 + $i * 16) $zb ([ref]$zeile)
        }
      }
    }
  }
  $breite, $hoehe = $s.Layout.Groesse
  if ($s.Dialog) {
    $d = Get-DialogLage -Dialog $s.Dialog -Breite $breite -Hoehe $hoehe
    $sichtbar = @($woerter | Where-Object { -not (Test-SimInLage ($_.X + $_.B / 2) ($_.Y + $_.H / 2) $d.Lage) })
    $woerter = [System.Collections.Generic.List[object]]::new()
    foreach ($w in $sichtbar) { $woerter.Add($w) }
    Add-SimWorte $woerter $s.Dialog.Text ($d.Lage[0] + 16) ($d.Lage[1] + 20) $zb ([ref]$zeile)
    foreach ($k in $d.Knoepfe) {
      $x = [int]($k.Lage[0] + ($k.Lage[2] - $zb * $k.Knopf.Text.Length) / 2)
      Add-SimWorte $woerter $k.Knopf.Text $x (Get-SimMitteY $k.Lage) $zb ([ref]$zeile)
    }
  }
  if ($s.Chaos.Verlesen) {
    foreach ($w in $woerter) { if ($w.Text -match '\d') { $w.Text = $w.Text.Replace('0', 'O') } }
  }
  [pscustomobject]@{
    Fenster = [pscustomobject]@{ Handle = 1; Titel = $s.Layout.Titel; X = $s.Ursprung.X; Y = $s.Ursprung.Y; Breite = $breite; Hoehe = $hoehe }
    Woerter = @($woerter)
    Pfad    = $null
  }
}

function Test-SimInLage([double] $X, [double] $Y, [int[]] $Lage) {
  $X -ge $Lage[0] -and $X -lt ($Lage[0] + $Lage[2]) -and $Y -ge $Lage[1] -and $Y -lt ($Lage[1] + $Lage[3])
}

function Send-SimulationsKlick {
  [CmdletBinding()]
  param([Parameter(Mandatory)] [hashtable] $Simulation, [Parameter(Mandatory)] [int] $X, [Parameter(Mandatory)] [int] $Y)
  $s = $Simulation
  if ($s.Ausstehend) { return }
  $cx = $X - $s.Ursprung.X
  $cy = $Y - $s.Ursprung.Y
  if ($s.Dialog) {
    $breite, $hoehe = $s.Layout.Groesse
    $d = Get-DialogLage -Dialog $s.Dialog -Breite $breite -Hoehe $hoehe
    $knopf = $d.Knoepfe | Where-Object { Test-SimInLage $cx $cy $_.Lage } | Select-Object -First 1
    if ($knopf) { Resolve-SimDialog $s $knopf.Knopf.Antwort }
    return
  }
  $element = $s.Layout.Elemente | Where-Object { $_.Art -in 'feld', 'knopf' -and (Test-SimInLage $cx $cy @($_.Lage)) } |
    Select-Object -First 1
  if (-not $element) { return }
  if ($element.Art -eq 'feld') { $s.Fokus = $element.Name; return }
  $s.Fokus = $null
  Invoke-SimAktion $s $element.Aktion
}

function Send-SimulationsText {
  [CmdletBinding()]
  param([Parameter(Mandatory)] [hashtable] $Simulation, [Parameter(Mandatory)] [AllowEmptyString()] [string] $Text)
  if ($Simulation.Ausstehend -or $Simulation.Dialog -or -not $Simulation.Fokus) { return }
  $Simulation.Felder[$Simulation.Fokus] += $Text
  if ($Simulation.Fokus -eq 'suche') { $Simulation.Kasse.Treffer = '' }
}

function Send-SimulationsTaste {
  [CmdletBinding()]
  param([Parameter(Mandatory)] [hashtable] $Simulation, [Parameter(Mandatory)] [ValidateSet('Enter', 'Escape', 'Tab', 'ShiftTab', 'Backspace')] [string] $Name)
  $s = $Simulation
  if ($s.Ausstehend) { return }
  if ($s.Dialog) {
    # Wie in WinForms: Enter drückt den ersten Knopf, Escape bricht ab, wenn
    # der Dialog das erlaubt.
    if ($Name -eq 'Enter') { Resolve-SimDialog $s $s.Dialog.Knoepfe[0].Antwort }
    elseif ($Name -eq 'Escape' -and $s.Dialog.Escape) { Resolve-SimDialog $s $s.Dialog.Escape }
    return
  }
  if (-not $s.Fokus) { return }
  switch ($Name) {
    'Escape' {
      $s.Felder[$s.Fokus] = ''
      # Wie TextChanged im Fenster: Ein geändertes Suchfeld löscht das alte Ergebnis.
      if ($s.Fokus -eq 'suche') { $s.Kasse.Treffer = '' }
    }
    'Backspace' { $t = $s.Felder[$s.Fokus]; if ($t.Length -gt 0) { $s.Felder[$s.Fokus] = $t.Substring(0, $t.Length - 1) } }
    { $_ -in 'Tab', 'ShiftTab' } {
      $namen = @($s.Felder.Keys)
      $schritt = if ($Name -eq 'Tab') { 1 } else { $namen.Count - 1 }
      $s.Fokus = $namen[([array]::IndexOf($namen, $s.Fokus) + $schritt) % $namen.Count]
    }
    'Enter' {
      $enter = $s.Layout['Enter']
      if ($enter -and $enter.Contains($s.Fokus)) { Invoke-SimAktion $s $enter[$s.Fokus] }
    }
  }
}

function Invoke-SimAktion {
  param([hashtable] $S, [string] $Aktion)
  $k = $S.Kasse
  switch ($Aktion) {
    'Hinzufuegen' {
      $r = Add-KassenPosition -Kasse $k -Pzn ([string]$S.Felder['pzn']) -Menge ([string]$S.Felder['menge'])
      if ($r.Ok) {
        foreach ($f in 'pzn', 'menge') { if ($S.Felder.Contains($f)) { $S.Felder[$f] = '' } }
        if ($r.Rueckfrage) { $S.Dialog = New-KassenDialog -Art rezept -Kasse $k }
      }
      $S.Fokus = 'pzn'
    }
    { $_ -in 'Bar', 'Karte' } {
      if ($S.Layout['Bestaetigen']) {
        $S.Dialog = New-KassenDialog -Art bestaetigen -Kasse $k -Text $S.Layout.Bestaetigen -Ziel $Aktion
      }
      else { Start-SimZahlung $S $Aktion }
    }
    'Leeren' { Clear-KassenBon -Kasse $k }
    'Suchen' { Find-KassenBeleg -Kasse $k -Referenz ([string]$S.Felder['suche']) | Out-Null }
    'Abschluss' { Close-KassenTag -Kasse $k | Out-Null }
  }
  Complete-SimAktion $S
}

function Resolve-SimDialog {
  param([hashtable] $S, [string] $Antwort)
  $dialog = $S.Dialog
  $S.Dialog = $null
  $zahlung = Invoke-KassenDialogAntwort -Kasse $S.Kasse -Dialog $dialog -Antwort $Antwort
  if ($zahlung) { Start-SimZahlung $S $zahlung }
  Complete-SimAktion $S
}

function Start-SimZahlung {
  param([hashtable] $S, [string] $Art)
  if ($S.Chaos.Langsam -gt 0) {
    $S.Ausstehend = @{ Rest = $S.Chaos.Langsam; Art = $Art }
    return
  }
  Complete-SimZahlung $S $Art
}

function Complete-SimZahlung {
  param([hashtable] $S, [string] $Art)
  $art = if ($Art -eq 'Bar') { 'bar' } else { 'karte' }
  $beleg = Invoke-KassenZahlung -Kasse $S.Kasse -Art $art -Gegeben ([string]$S.Felder['gegeben']) -Referenz ([string]$S.Felder['referenz'])
  if ($beleg) { foreach ($f in 'gegeben', 'referenz') { if ($S.Felder.Contains($f)) { $S.Felder[$f] = '' } } }
}

function Step-SimAusstehend {
  # Eine langsame Kasse meldet die Buchung erst nach einigen Bildern.
  param([hashtable] $S)
  if (-not $S.Ausstehend) { return }
  if ($S.Ausstehend.Rest -gt 0) { $S.Ausstehend.Rest--; return }
  $art = $S.Ausstehend.Art
  $S.Ausstehend = $null
  Complete-SimZahlung $S $art
}

function Complete-SimAktion {
  # Nach jeder Aktion: zählen, Chaos-Dialoge einblenden, Fenster wandern lassen.
  param([hashtable] $S)
  $S.Aktionen++
  $c = $S.Chaos
  if (-not $S.Dialog -and $c.DialogNach -gt 0 -and $S.Aktionen -ge $c.DialogNach -and -not $S.Gezeigt.preisliste) {
    $S.Dialog = New-KassenDialog -Art preisliste -Kasse $S.Kasse
    $S.Gezeigt.preisliste = $true
  }
  elseif (-not $S.Dialog -and $c.UnbekanntNach -gt 0 -and $S.Aktionen -ge $c.UnbekanntNach -and -not $S.Gezeigt.unbekannt) {
    $S.Dialog = New-KassenDialog -Art unbekannt -Kasse $S.Kasse
    $S.Gezeigt.unbekannt = $true
  }
  if ($c.Wandern) {
    $S.Ursprung.X += $c.Wandern[0]
    $S.Ursprung.Y += $c.Wandern[1]
  }
}
