# Die Aktionen eines Flows, je ein Versuch. Ergebnis ist eine Hashtable:
#   Ok          geklappt
#   Gesendet    eine Eingabe ging an die Kasse (Klick oder Taste)
#   Endgueltig  kein neuer Versuch (Kasse meldet Fehler, Ziel mehrdeutig)
#   KasseFehler die Kasse hat ausdrücklich abgelehnt, also nichts gebucht
#   Ende        Status, mit dem der Lauf vorzeitig endet (beenden-wenn)

$script:StandardZeit = @{ 'warte-bis' = 0; pruefe = 1; lies = 0; eingabe = 2 }

function Get-Aktion {
  param([System.Collections.IDictionary] $Schritt)
  foreach ($a in 'klicke', 'eingeben', 'taste', 'warte-bis', 'pruefe', 'lies', 'beenden-wenn', 'fuer-jede') {
    if ($Schritt.Contains($a)) { return $a }
  }
}

function Get-Zielname {
  # Kurzer Name des Ziels für den Bericht, mit eingesetzten Werten.
  param([System.Collections.IDictionary] $Schritt, [hashtable] $Kontext = @{})
  $name = Get-Zielvorlage $Schritt
  try { Expand-Text -Text $name -Kontext $Kontext } catch { $name }
}

function Get-Zielvorlage {
  param([System.Collections.IDictionary] $Schritt)
  switch (Get-Aktion $Schritt) {
    'klicke' { return [string]$Schritt.klicke }
    'eingeben' { if ($Schritt.eingeben['neben']) { return $Schritt.eingeben.neben } return $Schritt.eingeben.unter }
    'taste' { return [string]$Schritt.taste }
    'lies' { return [string]$Schritt.lies.muster }
    'beenden-wenn' { return [string]$Schritt['beenden-wenn'].text }
    default {
      $s = $Schritt[(Get-Aktion $Schritt)]
      if ($s -is [string]) { return $s }
      if ($s['eins-von']) { return (@($s['eins-von']) -join ' | ') }
      return [string]$s['text']
    }
  }
}

function Get-Schrittzeit {
  param([hashtable] $Lauf, [System.Collections.IDictionary] $Schritt, [double] $Standard)
  if ($Schritt['zeit']) { return [double]$Schritt.zeit }
  if ($Standard -gt 0) { return $Standard }
  [double]$Lauf.Optionen.Zeit
}

function Get-Vorbereitet {
  # Frisches Bild vor einer Aktion. Steht dort eine neue Fehlermeldung der
  # Kasse, etwa als Folge des letzten Schritts, geht es nicht weiter.
  param([hashtable] $Lauf)
  $bild = Get-Stand $Lauf
  $fehler = Test-NeuerKassenfehler $Lauf $bild
  if ($fehler) { return @{ Fehler = @{ Ok = $false; Endgueltig = $true; KasseFehler = $true; Meldung = "Kasse meldet: $fehler" } } }
  @{ Bild = $bild }
}

function Complete-Aktion {
  param([hashtable] $Lauf, [System.Collections.IDictionary] $Schritt, [hashtable] $Ergebnis)
  if (-not $Schritt.Contains('danach')) { $Ergebnis.Ok = $true; return $Ergebnis }
  $w = Wait-Suche $Lauf $Schritt.danach (Get-Schrittzeit $Lauf $Schritt 0) $null
  $w.Gesendet = $true
  $w
}

function Invoke-Klicke {
  param([hashtable] $Lauf, [System.Collections.IDictionary] $Schritt)
  $text = Expand-Text -Text $Schritt.klicke -Kontext $Lauf.Kontext
  $v = Get-Vorbereitet $Lauf
  if ($v['Fehler']) { return $v.Fehler }
  $ziel = Find-Ziel -Bild $v.Bild -Text $text
  if ($null -eq $ziel) { return @{ Ok = $false; Meldung = "Ziel nicht gefunden: $text" } }
  if ($ziel.Mehrdeutig) { return @{ Ok = $false; Endgueltig = $true; Meldung = "Ziel mehrdeutig: $text steht an $($ziel.Anzahl) Stellen" } }
  $null = $Lauf.Treiber.Klick($Lauf.Fenster.X + $ziel.MitteX, $Lauf.Fenster.Y + $ziel.MitteY)
  if ($Schritt['kritisch']) { $Lauf.KritischGesendet = $true }
  Complete-Aktion $Lauf $Schritt @{ Gesendet = $true; Wert = $ziel.Wert }
}

function Invoke-Taste {
  param([hashtable] $Lauf, [System.Collections.IDictionary] $Schritt)
  $v = Get-Vorbereitet $Lauf
  if ($v['Fehler']) { return $v.Fehler }
  $null = $Lauf.Treiber.Taste([string]$Schritt.taste)
  if ($Schritt['kritisch']) { $Lauf.KritischGesendet = $true }
  Complete-Aktion $Lauf $Schritt @{ Gesendet = $true }
}

function Invoke-Eingeben {
  # Klick ins Feld neben oder unter dem Anker, Feld leeren (Escape), tippen,
  # und prüfen, dass genau dieser Text im Feld steht. Wiederholbar, weil das
  # Leeren jeden halben Versuch davor wegräumt.
  param([hashtable] $Lauf, [System.Collections.IDictionary] $Schritt)
  $e = $Schritt.eingeben
  $ankerText = Expand-Text -Text $(if ($e['neben']) { $e.neben } else { $e.unter }) -Kontext $Lauf.Kontext
  $text = Expand-Text -Text $e.text -Kontext $Lauf.Kontext
  $v = Get-Vorbereitet $Lauf
  if ($v['Fehler']) { return $v.Fehler }
  $anker = Find-Ziel -Bild $v.Bild -Text $ankerText
  if ($null -eq $anker) { return @{ Ok = $false; Meldung = "Anker nicht gefunden: $ankerText" } }
  if ($anker.Mehrdeutig) { return @{ Ok = $false; Endgueltig = $true; Meldung = "Anker mehrdeutig: $ankerText steht an $($anker.Anzahl) Stellen" } }
  if ($e['neben']) {
    $x = $anker.X + $(if ($null -ne $e['dx']) { [int]$e.dx } else { 60 })
    $y = $anker.MitteY
  }
  else {
    $x = $anker.X + $(if ($null -ne $e['dx']) { [int]$e.dx } else { 10 })
    $y = $anker.Y + $(if ($null -ne $e['dy']) { [int]$e.dy } else { 30 })
  }
  $null = $Lauf.Treiber.Klick($Lauf.Fenster.X + $x, $Lauf.Fenster.Y + $y)
  $null = $Lauf.Treiber.Taste('Escape')
  if ($text -eq '') { return @{ Ok = $true; Gesendet = $true } }
  $null = $Lauf.Treiber.Tippen($text)
  # Die Schreibmarke klebt am letzten Zeichen; die OCR las im ersten
  # Windows-Lauf «1» als «1|» und eine Kennung erst beim dritten Bild. Darum:
  # Feld mit Tab verlassen, prüfen, mit Umschalt+Tab zurück, damit ein Enter
  # danach wieder in diesem Feld wirkt.
  $null = $Lauf.Treiber.Taste('Tab')
  $bereich = @{ X = $x - 60; Y = $y - 14; B = 300; H = 28 }
  $w = Wait-Suche $Lauf @{ text = $text; genau = [bool]$e['genau'] } $script:StandardZeit.eingabe $bereich
  $w.Gesendet = $true
  if ($w.Ok) { $null = $Lauf.Treiber.Taste('ShiftTab') }
  if (-not $w.Ok -and -not $w['KasseFehler']) { $w.Meldung = "Eingabe nicht sichtbar: '$text' bei $ankerText" }
  $w
}

function Invoke-Lesen {
  param([hashtable] $Lauf, [System.Collections.IDictionary] $Schritt)
  $l = $Schritt.lies
  $w = Wait-Muster $Lauf $l.muster (Get-Schrittzeit $Lauf $l $script:StandardZeit.lies)
  if (-not $w.Ok) { return $w }
  $namen = @($l.als)
  for ($i = 0; $i -lt $namen.Count -and $i -lt $w.Gruppen.Count; $i++) {
    $Lauf.Kontext[$namen[$i]] = $w.Gruppen[$i]
    $Lauf.Bericht.werte[$namen[$i]] = $w.Gruppen[$i]
  }
  @{ Ok = $true; Wert = $w.Text }
}

function Invoke-BeendenWenn {
  param([hashtable] $Lauf, [System.Collections.IDictionary] $Schritt)
  $b = $Schritt['beenden-wenn']
  $text = Expand-Text -Text $b.text -Kontext $Lauf.Kontext
  $bild = Get-Stand $Lauf
  if (Find-Text -Bild $bild -Text $text -Genau:([bool]$b['genau'])) { return @{ Ok = $true; Ende = $b.status } }
  @{ Ok = $true }
}

function Invoke-SchrittAktion {
  # Ein Versuch eines Schritts.
  param([hashtable] $Lauf, [System.Collections.IDictionary] $Schritt)
  switch (Get-Aktion $Schritt) {
    'klicke' { return Invoke-Klicke $Lauf $Schritt }
    'taste' { return Invoke-Taste $Lauf $Schritt }
    'eingeben' { return Invoke-Eingeben $Lauf $Schritt }
    'warte-bis' { return Wait-Suche $Lauf $Schritt['warte-bis'] (Get-Schrittzeit $Lauf $Schritt 0) $null }
    'pruefe' { return Wait-Suche $Lauf $Schritt.pruefe (Get-Schrittzeit $Lauf $Schritt $script:StandardZeit.pruefe) $null }
    'lies' { return Invoke-Lesen $Lauf $Schritt }
    'beenden-wenn' { return Invoke-BeendenWenn $Lauf $Schritt }
  }
  throw "Unbekannte Aktion in Schritt: $($Schritt.Keys -join ', ')"
}

function Test-Wiederholbar {
  # Eingeben darf neu versucht werden (es leert das Feld zuerst). Ein Klick
  # oder eine Taste nur, wenn sie gar nicht gesendet wurden oder der Flow es
  # erlaubt; ein kritischer Schritt, der gesendet ist, nie. Warten wird nicht
  # wiederholt: Die Zeit im Flow ist das ganze Budget.
  param([System.Collections.IDictionary] $Schritt, [hashtable] $Ergebnis)
  $aktion = Get-Aktion $Schritt
  if ($aktion -eq 'eingeben') { return $true }
  if ($aktion -notin 'klicke', 'taste') { return $false }
  if (-not $Ergebnis['Gesendet']) { return $true }
  if ($Schritt['kritisch']) { return $false }
  [bool]$Schritt['wiederholbar']
}
