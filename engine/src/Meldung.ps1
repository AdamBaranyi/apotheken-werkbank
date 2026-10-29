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

function Get-Meldetoken {
  # Sitzung des Engine-Kontos. Das Ziel merkt sie sich: eine Anmeldung je
  # Konto statt je Lauf (Supabase begrenzt Anmeldungen je IP).
  param([hashtable] $Ziel, [switch] $Neu)
  if ($Ziel['Token'] -and -not $Neu) { return $Ziel.Token }
  $anmeldung = @{ email = $Ziel.Email; password = $Ziel.Passwort } | ConvertTo-Json -Compress
  try {
    $sitzung = Invoke-RestMethod -Method Post -Uri "$($Ziel.Url.TrimEnd('/'))/auth/v1/token?grant_type=password" `
      -Headers @{ apikey = $Ziel.Schluessel } -ContentType 'application/json' `
      -Body ([Text.Encoding]::UTF8.GetBytes($anmeldung)) -TimeoutSec 20
  }
  catch { throw "Anmeldung des Engine-Kontos gescheitert ($(Get-HttpStatus $_.Exception))." }
  $Ziel.Token = $sitzung.access_token
  $Ziel.Token
}

function Send-Meldeanfrage {
  # Schreibt mit der Sitzung über die REST-Schnittstelle; ist sie abgelaufen
  # (401), meldet sich die Engine einmal neu an.
  param([hashtable] $Ziel, [string] $Pfad, [string] $Json)
  for ($versuch = 1; $versuch -le 2; $versuch++) {
    $kopf = @{
      apikey        = $Ziel.Schluessel
      Authorization = "Bearer $(Get-Meldetoken $Ziel -Neu:($versuch -gt 1))"
      Prefer        = 'return=minimal'
    }
    try {
      $null = Invoke-RestMethod -Method Post -Uri "$($Ziel.Url.TrimEnd('/'))$Pfad" -Headers $kopf `
        -ContentType 'application/json' -Body ([Text.Encoding]::UTF8.GetBytes($Json)) -TimeoutSec 30
      return
    }
    catch {
      if ((Get-HttpStatus $_.Exception) -eq 401 -and $versuch -eq 1) { continue }
      throw
    }
  }
}

function Send-Laufbericht {
  <#
    .SYNOPSIS
    Meldet einen Laufbericht (und optional das Bildschirmfoto) an den
    Flow-Monitor. Ziel: @{ Url; Schluessel (öffentlicher Schlüssel); Email;
    Passwort }; es merkt sich die Sitzung für weitere Meldungen.
  #>
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)] $Bericht,
    [Parameter(Mandatory)] [hashtable] $Ziel,
    [string] $Foto = ''
  )
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
    # Nur Vorschläge, die geholfen haben: Der Monitor zeigt damit «geheilt».
    heilungen = @($Bericht.heilungen | Where-Object { $_.ergebnis -eq 'geholfen' }).Count
    bericht   = $Bericht
  }
  try { Send-Meldeanfrage -Ziel $Ziel -Pfad '/rest/v1/engine_laeufe' -Json (ConvertTo-Json -InputObject $zeile -Depth 10 -Compress) }
  catch {
    $status = Get-HttpStatus $_.Exception
    # 409: Diese Laufkennung steht schon im Monitor, etwa nach einem Abbruch der Verbindung.
    if ($status -eq 409) { return @{ Ok = $true; Id = $null; Meldung = 'Lauf war schon gemeldet.' } }
    $grund = if ($status) { "Meldung des Laufs gescheitert ($status)." } else { $_.Exception.Message }
    return @{ Ok = $false; Meldung = $grund }
  }
  if ($Foto -and (Test-Path -LiteralPath $Foto)) {
    $bytes = [IO.File]::ReadAllBytes($Foto)
    $art = if ($Foto.EndsWith('.png')) { 'png' } else { 'text' }
    $bild = @{ lauf_id = $id; art = $art; inhalt = '\x' + [Convert]::ToHexString($bytes) } | ConvertTo-Json -Compress
    try { Send-Meldeanfrage -Ziel $Ziel -Pfad '/rest/v1/engine_fotos' -Json $bild }
    catch { return @{ Ok = $true; Id = $id; Meldung = "Lauf gemeldet, Foto nicht ($(Get-HttpStatus $_.Exception))." } }
  }
  @{ Ok = $true; Id = $id; Meldung = 'Lauf gemeldet.' }
}
