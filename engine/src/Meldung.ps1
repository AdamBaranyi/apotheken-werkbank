# Läufe an den Flow-Monitor melden. Die Engine meldet sich mit einem eigenen
# Konto bei Supabase an (kein Mitglied: Es darf nur melden) und schreibt über
# die REST-Schnittstelle in engine_laeufe und engine_fotos. Welche Apotheke,
# setzt die Datenbank. Scheitert die Meldung, bleibt der Lauf, wie er war: Der
# Bericht liegt weiter als JSON im Ausgabeordner.

function Get-HttpStatus {
  param($Fehler)
  if ($Fehler -is [Microsoft.PowerShell.Commands.HttpResponseException]) { return [int]$Fehler.Response.StatusCode }
  $null
}

function Send-Laufbericht {
  <#
    .SYNOPSIS
    Meldet einen Laufbericht (und optional das Bildschirmfoto) an den
    Flow-Monitor. Ziel: @{ Url; Schluessel (öffentlicher Schlüssel); Email; Passwort }.
  #>
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)] $Bericht,
    [Parameter(Mandatory)] [hashtable] $Ziel,
    [string] $Foto = ''
  )
  $basis = $Ziel.Url.TrimEnd('/')
  $kopf = @{ apikey = $Ziel.Schluessel }
  try {
    $anmeldung = @{ email = $Ziel.Email; password = $Ziel.Passwort } | ConvertTo-Json -Compress
    $sitzung = Invoke-RestMethod -Method Post -Uri "$basis/auth/v1/token?grant_type=password" -Headers $kopf `
      -ContentType 'application/json' -Body ([Text.Encoding]::UTF8.GetBytes($anmeldung)) -TimeoutSec 20
  }
  catch {
    return @{ Ok = $false; Meldung = "Anmeldung des Engine-Kontos gescheitert ($(Get-HttpStatus $_.Exception))." }
  }
  $kopf.Authorization = "Bearer $($sitzung.access_token)"
  $kopf.Prefer = 'return=minimal'
  $id = [guid]::NewGuid().ToString()
  $zeile = [ordered]@{
    id        = $id
    lauf      = $Bericht.lauf
    flow      = $Bericht.flow
    kasse     = $Bericht.apotheke
    status    = $Bericht.status
    kennung   = [string]$Bericht.kennung
    beginn    = $Bericht.beginn
    dauer_ms  = [int]$Bericht.dauerMs
    treiber   = $Bericht.treiber
    heilungen = @($Bericht.heilungen).Count
    bericht   = $Bericht
  }
  try {
    $json = ConvertTo-Json -InputObject $zeile -Depth 10 -Compress
    $null = Invoke-RestMethod -Method Post -Uri "$basis/rest/v1/engine_laeufe" -Headers $kopf `
      -ContentType 'application/json' -Body ([Text.Encoding]::UTF8.GetBytes($json)) -TimeoutSec 20
  }
  catch {
    $status = Get-HttpStatus $_.Exception
    # 409: Diese Laufkennung steht schon im Monitor, etwa nach einem Abbruch der Verbindung.
    if ($status -eq 409) { return @{ Ok = $true; Id = $null; Meldung = 'Lauf war schon gemeldet.' } }
    return @{ Ok = $false; Meldung = "Meldung des Laufs gescheitert ($status)." }
  }
  if ($Foto -and (Test-Path -LiteralPath $Foto)) {
    $bytes = [IO.File]::ReadAllBytes($Foto)
    $art = if ($Foto.EndsWith('.png')) { 'png' } else { 'text' }
    $bild = @{ lauf_id = $id; art = $art; inhalt = '\x' + [Convert]::ToHexString($bytes) } | ConvertTo-Json -Compress
    try {
      $null = Invoke-RestMethod -Method Post -Uri "$basis/rest/v1/engine_fotos" -Headers $kopf `
        -ContentType 'application/json' -Body ([Text.Encoding]::UTF8.GetBytes($bild)) -TimeoutSec 30
    }
    catch {
      return @{ Ok = $true; Id = $id; Meldung = "Lauf gemeldet, Foto nicht ($(Get-HttpStatus $_.Exception))." }
    }
  }
  @{ Ok = $true; Id = $id; Meldung = 'Lauf gemeldet.' }
}
