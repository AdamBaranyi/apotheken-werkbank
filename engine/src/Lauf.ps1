# Ein Lauf: Selbsttest, dann die Schritte des Flows der Reihe nach, mit
# Wiederholung, wo sie sicher ist, und einem Bericht am Ende.
#
# Status am Ende:
#   ok               alles getan
#   bereits-gebucht  die Kennung hatte schon einen Beleg (nichts getan)
#   nichts-offen     nichts abzuschliessen
#   abgebrochen      nichts Buchendes gesendet, oder die Kasse hat abgelehnt
#   unklar           ein buchender Schritt ist gesendet, die Bestätigung fehlt;
#                    ein neuer Lauf mit derselben Kennung klärt das über die Referenz
#   trocken          Trockenlauf, keine Eingabe

$script:Laufvorgaben = @{
  Takt           = 0.3
  Schlafen       = $true
  Wiederholungen = 2
  Zeit           = 8
  Ausgabe        = ''
  Bildfolge      = $false
  DryRun         = $false
}

function Test-Bedingung {
  param([hashtable] $Lauf, [System.Collections.IDictionary] $Schritt)
  if (-not $Schritt.Contains('wenn')) { return $true }
  $wert = Expand-Text -Text $Schritt.wenn.wert -Kontext $Lauf.Kontext
  $wert -eq [string]$Schritt.wenn.ist
}

function Invoke-SchrittMitWiederholung {
  param([hashtable] $Lauf, [System.Collections.IDictionary] $Schritt, [string] $Nr)
  $versuch = 0
  while ($true) {
    $versuch++
    $start = Get-Date
    $r = Invoke-SchrittAktion $Lauf $Schritt
    $ergebnis = if ($r.Ok) { 'ok' } else { 'fehler' }
    Add-Schrittbericht -Lauf $Lauf -Nr $Nr -Art (Get-Aktion $Schritt) -Ziel (Get-Zielname $Schritt) -Ergebnis $ergebnis `
      -Versuche $versuch -DauerMs ([int]((Get-Date) - $start).TotalMilliseconds) -Meldung ([string]$r['Meldung']) -Wert $r['Wert']
    if ($r.Ok -or $r['Endgueltig']) { return $r }
    if ($versuch -gt $Lauf.Optionen.Wiederholungen -or -not (Test-Wiederholbar $Schritt $r)) { return $r }
    # Nur der letzte Versuch eines Schritts bleibt im Bericht stehen.
    $Lauf.Bericht.schritte.RemoveAt($Lauf.Bericht.schritte.Count - 1)
  }
}

function Invoke-Schrittliste {
  # Führt Schritte aus. Liefert $null, wenn alle durch sind, sonst das Ende:
  # @{ Status; Meldung; Nr }.
  param([hashtable] $Lauf, [object[]] $Schritte, [string] $Praefix)
  $nr = 0
  foreach ($s in $Schritte) {
    $nr++
    $name = "$Praefix$nr"
    if (-not (Test-Bedingung $Lauf $s)) { continue }
    if ($s.Contains('fuer-jede')) {
      $i = 0
      foreach ($eintrag in @($Lauf.Kontext[$s['fuer-jede']])) {
        $i++
        $element = @{}
        foreach ($k in $eintrag.Keys) { $element[$k] = $eintrag[$k] }
        $element.nr = $i
        $Lauf.Kontext[$s.als] = $element
        $ende = Invoke-Schrittliste $Lauf @($s.schritte) "$name.$i."
        if ($ende) { return $ende }
      }
      $Lauf.Kontext.Remove($s.als)
      continue
    }
    if ($s.Contains('wenn-sichtbar')) {
      $bild = Get-Stand $Lauf
      if (-not (Find-Text -Bild $bild -Text (Expand-Text -Text $s['wenn-sichtbar'] -Kontext $Lauf.Kontext))) { continue }
    }
    $r = Invoke-SchrittMitWiederholung $Lauf $s $name
    if ($Lauf.Optionen.Bildfolge) { $null = Save-Foto $Lauf ('bilder/{0:d3}-{1}' -f $Lauf.Bericht.schritte.Count, (Get-Aktion $s)) }
    if (-not $r.Ok) {
      $status = if (-not $r['KasseFehler'] -and $Lauf.KritischGesendet) { 'unklar' } else { 'abgebrochen' }
      return @{ Status = $status; Meldung = "Schritt ${name}: $($r.Meldung)"; Nr = $name }
    }
    if ($r['Ende']) { return @{ Status = $r.Ende } }
  }
  $null
}

function Get-Plantexte {
  # Alle Texte, die ein Flow auf dem Bildschirm sucht, mit eingesetzten Werten.
  param([hashtable] $Lauf, [object[]] $Schritte)
  foreach ($s in $Schritte) {
    if (-not (Test-Bedingung $Lauf $s)) { continue }
    if ($s.Contains('fuer-jede')) {
      $i = 0
      foreach ($eintrag in @($Lauf.Kontext[$s['fuer-jede']])) {
        $i++
        $element = @{ nr = $i }
        foreach ($k in $eintrag.Keys) { $element[$k] = $eintrag[$k] }
        $Lauf.Kontext[$s.als] = $element
        Get-Plantexte $Lauf @($s.schritte)
      }
      $Lauf.Kontext.Remove($s.als)
      continue
    }
    $roh = @()
    if ($s.Contains('wenn-sichtbar')) { $roh += $s['wenn-sichtbar'] }
    if ($s.Contains('danach')) { $roh += (ConvertTo-Suchtexte $s.danach) }
    switch (Get-Aktion $s) {
      'klicke' { $roh += $s.klicke }
      'eingeben' { $roh += $(if ($s.eingeben['neben']) { $s.eingeben.neben } else { $s.eingeben.unter }) }
      'warte-bis' { $roh += (ConvertTo-Suchtexte $s['warte-bis']) }
      'pruefe' { $roh += (ConvertTo-Suchtexte $s.pruefe) }
    }
    foreach ($t in $roh) {
      try { Expand-Text -Text $t -Kontext $Lauf.Kontext } catch { continue }
    }
  }
}

function ConvertTo-Suchtexte {
  param($Suche)
  if ($Suche -is [string]) { return $Suche }
  if ($Suche['eins-von']) { return @($Suche['eins-von']) }
  $Suche['text']
}

function Invoke-Flow {
  <#
    .SYNOPSIS
    Führt einen Flow mit einem Treiber und einem Auftrag aus und liefert den
    Laufbericht. Optionen: Takt, Schlafen, Wiederholungen, Zeit, Ausgabe,
    Bildfolge, DryRun.
  #>
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)] $Flow,
    [Parameter(Mandatory)] $Treiber,
    [hashtable] $Auftrag = @{},
    [hashtable] $Optionen = @{}
  )
  $o = $script:Laufvorgaben.Clone()
  foreach ($k in $Optionen.Keys) { $o[$k] = $Optionen[$k] }
  $auftragGeprueft = Test-Auftrag -Flow $Flow -Auftrag $Auftrag
  $id = New-LaufId
  $kontext = @{ lauf = @{ id = $id } }
  foreach ($k in $auftragGeprueft.Keys) { $kontext[$k] = $auftragGeprueft[$k] }
  $lauf = @{
    Id               = $id
    Flow             = $Flow
    Treiber          = $Treiber
    Optionen         = $o
    Kontext          = $kontext
    Bericht          = New-Laufbericht -Flow $Flow -Treiber $Treiber -Auftrag $auftragGeprueft -Id $id
    Ordner           = if ($o.Ausgabe) { Join-Path $o.Ausgabe $id } else { '' }
    Bild             = $null
    Fenster          = $null
    KritischGesendet = $false
    FehlerVorher     = @()
    Start            = Get-Date
  }
  $status = 'ok'
  try {
    $start = Get-Stand $lauf
    if (@($start.Woerter).Count -eq 0) { throw 'Selbsttest: Die OCR liefert keinen Text.' }
    # Was jetzt schon als Fehler dasteht, stammt nicht aus diesem Lauf.
    $lauf.FehlerVorher = @(Get-Fehlerzeilen $lauf $start)
    if ($o.DryRun) {
      foreach ($t in (Get-Plantexte $lauf @($Flow.Schritte) | Select-Object -Unique)) {
        $lauf.Bericht.plan.Add([pscustomobject]@{ text = $t; sichtbar = [bool](Find-Text -Bild $start -Text $t) })
      }
      $status = 'trocken'
    }
    else {
      $ende = Invoke-Schrittliste $lauf @($Flow.Schritte) ''
      if ($ende) {
        $status = $ende.Status
        if ($ende['Meldung']) {
          $lauf.Bericht.fehler = [pscustomobject]@{ schritt = $ende.Nr; meldung = $ende.Meldung; foto = (Save-Foto $lauf 'fehler') }
        }
      }
    }
  }
  catch {
    $status = if ($lauf.KritischGesendet) { 'unklar' } else { 'abgebrochen' }
    $lauf.Bericht.fehler = [pscustomobject]@{ schritt = $null; meldung = $_.Exception.Message; foto = (Save-Foto $lauf 'fehler') }
  }
  Complete-Laufbericht -Lauf $lauf -Status $status
}
