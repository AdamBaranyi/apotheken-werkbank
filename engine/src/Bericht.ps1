# Laufbericht: was die Engine tat, wie oft, wie lange, mit welchem Ergebnis.
# Er geht als JSON in den Ausgabeordner und an den Flow-Monitor.

function New-LaufId {
  $z = '23456789ACDEFHJKMNPQRTVWXY'
  $zufall = -join (1..4 | ForEach-Object { $z[[System.Security.Cryptography.RandomNumberGenerator]::GetInt32($z.Length)] })
  "L-$((Get-Date).ToString('yyyyMMdd-HHmmss'))-$zufall"
}

function New-Laufbericht {
  param($Flow, $Treiber, [hashtable] $Auftrag, [string] $Id)
  [ordered]@{
    lauf      = $Id
    flow      = $Flow.Name
    apotheke  = $Flow.Apotheke
    kennung   = [string]$Auftrag['kennung']
    treiber   = $Treiber.Art
    status    = 'laeuft'
    beginn    = (Get-Date).ToString('o')
    ende      = $null
    dauerMs   = 0
    ocr       = $null
    schritte  = [System.Collections.Generic.List[object]]::new()
    dialoge   = [System.Collections.Generic.List[object]]::new()
    heilungen = [System.Collections.Generic.List[object]]::new()
    werte     = [ordered]@{}
    plan      = [System.Collections.Generic.List[object]]::new()
    fehler    = $null
  }
}

function Add-Schrittbericht {
  param([hashtable] $Lauf, [string] $Nr, [string] $Art, [string] $Ziel, [string] $Ergebnis, [int] $Versuche, [int] $DauerMs, [string] $Meldung, $Wert)
  $Lauf.Bericht.schritte.Add([pscustomobject]@{
      nr       = $Nr
      art      = $Art
      ziel     = $Ziel
      ergebnis = $Ergebnis
      versuche = $Versuche
      dauerMs  = $DauerMs
      meldung  = $Meldung
      wert     = $Wert
    })
}

function Save-Foto {
  # Hält den letzten Bildschirm fest. Der Treiber hängt die Endung an:
  # .png für Windows, .txt (Textkarte) für den Fake-Treiber.
  param([hashtable] $Lauf, [string] $Name)
  if (-not $Lauf.Ordner -or -not $Lauf.Bild) { return $null }
  $basis = Join-Path $Lauf.Ordner $Name
  $null = New-Item -ItemType Directory -Force -Path (Split-Path $basis -Parent)
  $Lauf.Treiber.Foto($Lauf.Bild, $basis)
}

function Complete-Laufbericht {
  param([hashtable] $Lauf, [string] $Status)
  $b = $Lauf.Bericht
  $b.status = $Status
  $b.ende = (Get-Date).ToString('o')
  $b.dauerMs = [int]((Get-Date) - $Lauf.Start).TotalMilliseconds
  $ergebnis = [pscustomobject]$b
  if ($Lauf.Ordner) {
    $null = New-Item -ItemType Directory -Force -Path $Lauf.Ordner
    $json = ConvertTo-Json -InputObject $ergebnis -Depth 8
    [IO.File]::WriteAllText((Join-Path $Lauf.Ordner 'bericht.json'), $json, [Text.UTF8Encoding]::new($false))
  }
  $ergebnis
}
