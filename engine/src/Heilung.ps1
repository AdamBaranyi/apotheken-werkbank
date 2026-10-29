# Selbstheilung (Stufe 2). Scheitert ein Schritt auch nach den Wiederholungen,
# fragt die Engine einen Heiler nach genau einer Aktion. Sie führt nur aus,
# was erlaubt ist: einen Text aus der Liste «heilung.klickbar» des Flows, der
# eindeutig auf dem Bildschirm steht, Escape, kurz warten. Danach versucht sie
# den Schritt noch einmal. Deckel: höchstens drei Fragen je Lauf und eine Zahl
# je Tag über alle Läufe (Zähler in einer Datei).

function Get-Bildtext {
  param($Bild)
  ($Bild.Woerter | Group-Object Zeile | ForEach-Object { (@($_.Group | Sort-Object X).Text) -join ' ' }) -join "`n"
}

function Get-Tageszaehlerpfad {
  param([hashtable] $Lauf)
  $ordner = $Lauf.Optionen.Zaehlerordner
  if (-not $ordner) { $ordner = Join-Path ([IO.Path]::GetTempPath()) 'werkbank-heilung' }
  $null = New-Item -ItemType Directory -Force -Path $ordner
  Join-Path $ordner ('heilung-{0}.json' -f (Get-Date).ToString('yyyy-MM-dd'))
}

function Read-Tageszaehler {
  param([string] $Pfad)
  if (-not (Test-Path -LiteralPath $Pfad)) { return 0 }
  [int](Get-Content -LiteralPath $Pfad -Raw | ConvertFrom-Json).anzahl
}

function Test-Heilbar {
  # Heilen lohnt nur, wenn ein neuer Versuch danach sicher ist; eine
  # ausdrückliche Ablehnung der Kasse heilt kein Klick.
  param([System.Collections.IDictionary] $Schritt, [hashtable] $Ergebnis)
  if ($Ergebnis['KasseFehler'] -or $Ergebnis['Endgueltig']) { return $false }
  if ((Get-Aktion $Schritt) -notin 'klicke', 'taste') { return $true }
  if (-not $Ergebnis['Gesendet']) { return $true }
  -not $Schritt['kritisch'] -and [bool]$Schritt['wiederholbar']
}

function Test-Vorschlag {
  # Prüft einen Vorschlag gegen die Liste des Flows und den Bildschirm.
  param([hashtable] $Lauf, [hashtable] $Vorschlag, $Bild)
  switch ($Vorschlag.aktion) {
    'klicke' {
      $ziel = [string]$Vorschlag.ziel
      if (-not ($Lauf.Flow.Klickbar | Where-Object { $_ -ieq $ziel })) { return @{ Ok = $false; Grund = "Ziel nicht erlaubt: '$ziel'" } }
      $z = Find-Ziel -Bild $Bild -Text $ziel
      if ($null -eq $z) { return @{ Ok = $false; Grund = "Ziel nicht sichtbar: '$ziel'" } }
      if ($z.Mehrdeutig) { return @{ Ok = $false; Grund = "Ziel mehrdeutig: '$ziel'" } }
      return @{ Ok = $true; Ziel = $z }
    }
    'taste' {
      if ($Vorschlag.taste -ne 'Escape') { return @{ Ok = $false; Grund = "Taste nicht erlaubt: '$($Vorschlag.taste)'" } }
      return @{ Ok = $true }
    }
    'warten' { return @{ Ok = $true } }
    'abbrechen' { return @{ Ok = $false; Grund = 'Der Heiler schlägt Abbruch vor' } }
  }
  @{ Ok = $false; Grund = "Aktion unbekannt: '$($Vorschlag.aktion)'" }
}

function Add-Heilungsbericht {
  param([hashtable] $Lauf, [string] $Nr, [hashtable] $Vorschlag, [bool] $Erlaubt, [string] $Grund)
  $eintrag = [pscustomobject]@{
    schritt     = $Nr
    aktion      = [string]$Vorschlag['aktion']
    ziel        = [string]$Vorschlag['ziel']
    taste       = [string]$Vorschlag['taste']
    begruendung = [string]$Vorschlag['begruendung']
    erlaubt     = $Erlaubt
    ausgefuehrt = $Erlaubt
    grund       = $Grund
    ergebnis    = if ($Erlaubt) { 'offen' } else { 'abgelehnt' }
    kostenUsd   = [double]$Vorschlag['kostenUsd']
    dauerMs     = [int]$Vorschlag['dauerMs']
    heiler      = $Lauf.Optionen.Heiler.Modell
  }
  $Lauf.Bericht.heilungen.Add($eintrag)
}

function Set-Heilungsausgang {
  # Trägt beim letzten ausgeführten Vorschlag eines Schritts ein, ob er half.
  param([hashtable] $Lauf, [string] $Nr, [string] $Ergebnis)
  $offen = @($Lauf.Bericht.heilungen | Where-Object { $_.schritt -eq $Nr -and $_.ergebnis -eq 'offen' })
  foreach ($e in $offen) { $e.ergebnis = $Ergebnis }
}

function Invoke-Heilung {
  # Liefert $true, wenn eine erlaubte Aktion ausgeführt wurde und der Schritt
  # noch einmal versucht werden soll.
  param([hashtable] $Lauf, [System.Collections.IDictionary] $Schritt, [string] $Nr, [hashtable] $Ergebnis)
  $o = $Lauf.Optionen
  if (-not $o.Heiler -or -not (Test-Heilbar $Schritt $Ergebnis)) { return $false }
  if ($Lauf.Heilungen -ge $o.HeilungenJeLauf) { return $false }
  $zaehler = Get-Tageszaehlerpfad $Lauf
  $heute = Read-Tageszaehler $zaehler
  if ($heute -ge $o.HeilungenJeTag) {
    Add-Heilungsbericht -Lauf $Lauf -Nr $Nr -Vorschlag @{} -Erlaubt $false -Grund "Tagesdeckel erreicht ($($o.HeilungenJeTag) je Tag)"
    return $false
  }
  # Erst zählen, dann fragen: Auch eine Frage, die scheitert, kann kosten.
  $Lauf.Heilungen++
  Set-Content -LiteralPath $zaehler -Value (@{ anzahl = $heute + 1 } | ConvertTo-Json -Compress) -Encoding utf8
  $bild = Get-Stand $Lauf
  $anfrage = @{
    Flow     = "$($Lauf.Flow.Apotheke)/$($Lauf.Flow.Name)"
    Schritt  = "$(Get-Aktion $Schritt) $(Get-Zielname $Schritt $Lauf.Kontext)"
    Meldung  = [string]$Ergebnis['Meldung']
    Bildtext = Get-Bildtext $bild
    Png      = if ($bild.Pfad -and ([string]$bild.Pfad).EndsWith('.png')) { $bild.Pfad } else { $null }
    Klickbar = @($Lauf.Flow.Klickbar)
  }
  try { $vorschlag = $o.Heiler.Vorschlag($anfrage) }
  catch {
    Add-Heilungsbericht -Lauf $Lauf -Nr $Nr -Vorschlag @{} -Erlaubt $false -Grund "Heiler nicht erreichbar: $($_.Exception.Message)"
    return $false
  }
  $pruefung = Test-Vorschlag -Lauf $Lauf -Vorschlag $vorschlag -Bild $bild
  Add-Heilungsbericht -Lauf $Lauf -Nr $Nr -Vorschlag $vorschlag -Erlaubt $pruefung.Ok -Grund $(if ($pruefung.Ok) { '' } else { $pruefung.Grund })
  if (-not $pruefung.Ok) { return $false }
  switch ($vorschlag.aktion) {
    'klicke' { $null = $Lauf.Treiber.Klick($Lauf.Fenster.X + $pruefung.Ziel.MitteX, $Lauf.Fenster.Y + $pruefung.Ziel.MitteY) }
    'taste' { $null = $Lauf.Treiber.Taste('Escape') }
    'warten' {
      $bis = (Get-Date).AddSeconds(2)
      for ($i = 0; $i -lt (Get-Bilderzahl $Lauf 2); $i++) {
        $null = Get-Stand $Lauf
        if (-not (Wait-Pause $Lauf $bis)) { break }
      }
    }
  }
  $true
}
