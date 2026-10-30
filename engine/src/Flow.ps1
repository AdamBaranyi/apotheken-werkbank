# Flows laden und prüfen. Ein Flow ist eine YAML-Datei je Apotheke:
# flows/<apotheke>/<flow>.yaml. Das Schema (engine/flow.schema.json) prüft den
# Aufbau, dieser Code den Sinn: Variablen, Schleifen, Muster, Dateinamen.

$script:FlowSchema = Join-Path $PSScriptRoot '../flow.schema.json'
$script:VariablenMuster = '\$\{([a-zA-Z][a-zA-Z0-9]*(?:\.[a-zA-Z][a-zA-Z0-9]*)*)\}'

function Format-Wert {
  param($Wert)
  if ($Wert -is [bool]) { return $Wert.ToString().ToLowerInvariant() }
  if ($Wert -is [System.IFormattable]) { return $Wert.ToString($null, [cultureinfo]::InvariantCulture) }
  [string]$Wert
}

function Get-Pfadwert {
  param($Kontext, [string] $Pfad)
  $wert = $Kontext
  foreach ($teil in $Pfad -split '\.') {
    if ($wert -is [System.Collections.IDictionary] -and $wert.Contains($teil)) { $wert = $wert[$teil]; continue }
    if ($null -ne $wert -and $wert -isnot [System.Collections.IDictionary] -and $wert.PSObject.Properties[$teil]) {
      $wert = $wert.PSObject.Properties[$teil].Value
      continue
    }
    throw "Wert fehlt: '$Pfad'"
  }
  $wert
}

function Expand-Text {
  <#
    .SYNOPSIS
    Setzt ${name} und ${name.feld} aus dem Kontext ein. Fehlt ein Wert, bricht
    der Aufruf ab, statt eine Lücke zu tippen.
  #>
  [CmdletBinding()]
  [OutputType([string])]
  param([Parameter(Mandatory)] [AllowEmptyString()] [string] $Text, [Parameter(Mandatory)] [hashtable] $Kontext)
  $ergebnis = [System.Text.StringBuilder]::new()
  $pos = 0
  foreach ($m in [regex]::Matches($Text, $script:VariablenMuster)) {
    $null = $ergebnis.Append($Text, $pos, $m.Index - $pos)
    $null = $ergebnis.Append((Format-Wert (Get-Pfadwert $Kontext $m.Groups[1].Value)))
    $pos = $m.Index + $m.Length
  }
  $null = $ergebnis.Append($Text, $pos, $Text.Length - $pos)
  $ergebnis.ToString()
}

function Read-FlowDatei {
  param([string] $Pfad)
  ConvertFrom-Yaml -Yaml (Get-Content -LiteralPath $Pfad -Raw -Encoding utf8)
}

function Get-Texte {
  # Alle Zeichenketten in einem Schritt, ohne die Unterschritte einer Schleife.
  param($Wert, [switch] $OhneSchritte)
  if ($Wert -is [string]) { return $Wert }
  if ($Wert -is [System.Collections.IDictionary]) {
    foreach ($k in $Wert.Keys) {
      if ($OhneSchritte -and $k -eq 'schritte') { continue }
      Get-Texte $Wert[$k]
    }
    return
  }
  if ($Wert -is [System.Collections.IEnumerable]) { foreach ($w in $Wert) { Get-Texte $w } }
}

function Test-FlowSchritte {
  # Prüft Schritte mit den bekannten Namen (Eingaben, gelesene Werte,
  # Schleifenvariable). Liefert Meldungen; ergänzt gelesene Werte in $Bekannt.
  param([object[]] $Schritte, [System.Collections.Generic.HashSet[string]] $Bekannt, [string[]] $Eingaben, [string] $Praefix)
  $nr = 0
  foreach ($s in $Schritte) {
    $nr++
    $name = "Schritt $Praefix$nr"
    foreach ($text in (Get-Texte $s -OhneSchritte)) {
      foreach ($m in [regex]::Matches($text, $script:VariablenMuster)) {
        $wurzel = ($m.Groups[1].Value -split '\.')[0]
        if (-not $Bekannt.Contains($wurzel)) { "${name}: Variable '$wurzel' ist unbekannt" }
      }
    }
    if ($s['kritisch'] -and $s['wiederholbar']) { "${name}: kritisch und wiederholbar schliessen sich aus" }
    if ($s.Contains('lies')) {
      try { $null = [regex]::new($s.lies.muster) }
      catch { "${name}: Muster ungültig: $($_.Exception.InnerException.Message)" }
      foreach ($als in @($s.lies.als)) { $null = $Bekannt.Add($als) }
    }
    if ($s.Contains('fuer-jede')) {
      if ($Eingaben -notcontains $s['fuer-jede']) { "${name}: Liste '$($s['fuer-jede'])' ist keine Eingabe" }
      $innen = [System.Collections.Generic.HashSet[string]]::new($Bekannt)
      $null = $innen.Add($s.als)
      Test-FlowSchritte -Schritte @($s.schritte) -Bekannt $innen -Eingaben $Eingaben -Praefix "$Praefix$nr."
    }
  }
}

$script:Aktionen = @('klicke', 'eingeben', 'taste', 'warte-bis', 'pruefe', 'lies', 'beenden-wenn', 'fuer-jede')
$script:Zusaetze = @('id', 'beschreibung', 'wenn', 'wenn-sichtbar', 'danach', 'wiederholbar', 'kritisch', 'zeit', 'als', 'schritte')

function Test-FlowAufbau {
  # Klare Meldungen mit Schrittnummer; Test-Json sagt bei verschachtelten
  # Fehlern oft nur «ungültig».
  param([object[]] $Schritte, [string] $Praefix)
  $nr = 0
  foreach ($s in $Schritte) {
    $nr++
    $name = "Schritt $Praefix$nr"
    if ($s -isnot [System.Collections.IDictionary]) { "${name}: Schritt muss ein Objekt sein"; continue }
    $aktionen = @($s.Keys | Where-Object { $script:Aktionen -contains $_ } | Sort-Object)
    if ($aktionen.Count -ne 1) { "${name}: genau eine Aktion erwartet, gefunden: $(if ($aktionen) { $aktionen -join ', ' } else { 'keine' })" }
    foreach ($k in ($s.Keys | Sort-Object)) {
      if ($script:Aktionen -notcontains $k -and $script:Zusaetze -notcontains $k) { "${name}: unbekannter Schlüssel '$k'" }
    }
    if ($s.Contains('fuer-jede') -and $s['schritte']) { Test-FlowAufbau -Schritte @($s.schritte) -Praefix "$Praefix$nr." }
  }
}

function Get-Eingabeliste {
  # «gegeben?» ist eine optionale Eingabe namens «gegeben».
  param([hashtable] $Daten)
  @($Daten['eingaben'] | Where-Object { $_ } | ForEach-Object { ([string]$_).TrimEnd('?') })
}

function Test-FlowDaten {
  param([hashtable] $Daten, [string] $Pfad)
  $json = ConvertTo-Json -InputObject $Daten -Depth 30
  $gueltig = Test-Json -Json $json -SchemaFile $script:FlowSchema -ErrorAction SilentlyContinue -ErrorVariable fehler
  if (-not $gueltig) {
    # Ohne gültigen Aufbau lohnt die Prüfung des Sinns nicht.
    $meldungen = @($fehler | ForEach-Object { 'Schema: ' + ($_.Exception.Message -replace '^[^:]+:\s*', '') })
    $meldungen += @(Test-FlowAufbau -Schritte @($Daten['schritte']) -Praefix '')
    if ($meldungen.Count -eq 0) { $meldungen = @('Schema: Aufbau ungültig (Editor mit engine/flow.schema.json zeigt die Stelle)') }
    return $meldungen
  }
  $datei = [IO.Path]::GetFileNameWithoutExtension($Pfad)
  $ordner = Split-Path (Split-Path $Pfad -Parent) -Leaf
  if ($Daten.flow -ne $datei) { "Flow '$($Daten.flow)' steht in der Datei '$datei.yaml'" }
  if ($Daten.apotheke -ne $ordner) { "Apotheke '$($Daten.apotheke)' steht im Ordner '$ordner'" }
  $eingaben = Get-Eingabeliste $Daten
  $bekannt = [System.Collections.Generic.HashSet[string]]::new([string[]]($eingaben + 'lauf'))
  Test-FlowSchritte -Schritte @($Daten.schritte) -Bekannt $bekannt -Eingaben $eingaben -Praefix ''
}

function Test-Flow {
  <#
    .SYNOPSIS
    Prüft eine Flow-Datei oder alle Flows unter einem Ordner (lint). Liefert je
    Befund Datei und Meldung; leer heisst: alles in Ordnung.
  #>
  [CmdletBinding()]
  param([Parameter(Mandatory)] [string] $Pfad)
  $dateien = if (Test-Path -LiteralPath $Pfad -PathType Container) {
    Get-ChildItem -LiteralPath $Pfad -Recurse -Filter *.yaml | Sort-Object FullName | ForEach-Object FullName
  }
  else { (Resolve-Path -LiteralPath $Pfad).Path }
  foreach ($datei in $dateien) {
    try { $daten = Read-FlowDatei $datei }
    catch {
      [pscustomobject]@{ Datei = $datei; Meldung = "YAML ungültig: $($_.Exception.Message)" }
      continue
    }
    if ($daten -isnot [hashtable]) {
      [pscustomobject]@{ Datei = $datei; Meldung = 'YAML ungültig: oben muss ein Objekt stehen' }
      continue
    }
    foreach ($meldung in (Test-FlowDaten -Daten $daten -Pfad $datei)) {
      [pscustomobject]@{ Datei = $datei; Meldung = $meldung }
    }
  }
}

function Import-Flow {
  <#
    .SYNOPSIS
    Lädt einen Flow und prüft ihn; ein Flow mit Befunden läuft nicht.
  #>
  [CmdletBinding(DefaultParameterSetName = 'Name')]
  param(
    [Parameter(Mandatory, ParameterSetName = 'Name')] [string] $Apotheke,
    [Parameter(Mandatory, ParameterSetName = 'Name')] [string] $Flow,
    [Parameter(ParameterSetName = 'Name')] [string] $Wurzel = (Join-Path $PSScriptRoot '../../flows'),
    [Parameter(Mandatory, ParameterSetName = 'Pfad')] [string] $Pfad
  )
  if ($PSCmdlet.ParameterSetName -eq 'Name') {
    if ($Apotheke -notmatch '^[a-z][a-z0-9-]{1,30}$' -or $Flow -notmatch '^[a-z][a-z0-9-]{1,30}$') {
      throw "Ungültiger Name: $Apotheke/$Flow"
    }
    $Pfad = Join-Path $Wurzel "$Apotheke/$Flow.yaml"
  }
  if (-not (Test-Path -LiteralPath $Pfad -PathType Leaf)) { throw "Flow nicht gefunden: $Pfad" }
  $befunde = @(Test-Flow -Pfad $Pfad)
  if ($befunde.Count -gt 0) { throw "Flow ungültig ($Pfad): $($befunde.Meldung -join '; ')" }
  $d = Read-FlowDatei $Pfad
  [pscustomobject]@{
    Name         = $d.flow
    Apotheke     = $d.apotheke
    Beschreibung = [string]$d['beschreibung']
    Fenster      = $d.fenster
    Eingaben     = @($d['eingaben'] | Where-Object { $_ } | Where-Object { -not $_.EndsWith('?') })
    Optional     = @($d['eingaben'] | Where-Object { $_ } | Where-Object { $_.EndsWith('?') } | ForEach-Object { $_.TrimEnd('?') })
    Dialoge      = @($d['dialoge'] | Where-Object { $_ })
    Fehler       = @($d['fehler'] | Where-Object { $_ })
    Klickbar     = if ($d['heilung']) { @($d.heilung['klickbar']) } else { @() }
    Schritte     = @($d.schritte)
    Pfad         = (Resolve-Path -LiteralPath $Pfad).Path
  }
}
