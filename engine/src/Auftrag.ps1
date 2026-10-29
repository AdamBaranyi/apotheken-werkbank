# Aufträge prüfen, bevor die Engine die Kasse anfasst. Ein Auftrag ist eine
# Hashtable (aus JSON): Kennung, Positionen, Zahlart, bei Bargeld der Betrag.

# Kennungen ohne Zeichen, die eine OCR verwechselt: keine 0 und 1, kein B, G,
# I, L, O, S, U, Z. Die Engine vergleicht Kennungen genau; ein Lesefehler soll
# auffallen, nicht eine andere Kennung ergeben.
$script:KennungZeichen = '23456789ACDEFHJKMNPQRTVWXY'

function New-Kennung {
  <#
    .SYNOPSIS
    Neue Kennung für einen Auftrag, etwa «K7-QX4M».
  #>
  [CmdletBinding()]
  [OutputType([string])]
  param()
  $z = $script:KennungZeichen
  $teil = { param([int] $n) -join (1..$n | ForEach-Object { $z[[System.Security.Cryptography.RandomNumberGenerator]::GetInt32($z.Length)] }) }
  "$(& $teil 2)-$(& $teil 4)"
}

function ConvertTo-Wahr {
  param($Wert)
  if ($Wert -is [string]) { return $Wert -eq 'true' }
  [bool]$Wert
}

function ConvertTo-Positionen {
  param($Liste)
  $positionen = @($Liste | Where-Object { $null -ne $_ })
  if ($positionen.Count -lt 1 -or $positionen.Count -gt 20) { throw 'Ein Auftrag braucht 1 bis 20 Positionen.' }
  $gesehen = @{}
  $nr = 0
  foreach ($p in $positionen) {
    $nr++
    $pzn = [string]$p['pzn']
    if ($pzn -notmatch '^\d{8}$') { throw "Position ${nr}: PZN '$pzn' hat nicht acht Ziffern." }
    if ($gesehen.ContainsKey($pzn)) { throw "Position ${nr}: PZN $pzn doppelt; die Kasse fasst gleiche Artikel zusammen." }
    $gesehen[$pzn] = $true
    $menge = 0
    if (-not [int]::TryParse([string]$p['menge'], [ref]$menge) -or $menge -lt 1 -or $menge -gt 99) {
      throw "Position ${nr}: Menge '$($p['menge'])' liegt nicht zwischen 1 und 99."
    }
    @{ pzn = $pzn; menge = $menge; rezept = (ConvertTo-Wahr $p['rezept']) }
  }
}

function Test-Auftrag {
  <#
    .SYNOPSIS
    Prüft einen Auftrag gegen die Eingaben eines Flows und liefert ihn
    vereinheitlicht zurück; bei einem Fehler bricht der Aufruf ab.
  #>
  [CmdletBinding()]
  [OutputType([hashtable])]
  param([Parameter(Mandatory)] $Flow, [Parameter(Mandatory)] [hashtable] $Auftrag)
  $a = @{}
  foreach ($k in $Auftrag.Keys) { $a[$k] = $Auftrag[$k] }
  foreach ($e in $Flow.Eingaben) {
    if (-not $a.ContainsKey($e) -or $null -eq $a[$e]) { throw "Auftrag unvollständig: es fehlt '$e'." }
  }
  foreach ($e in $Flow.Optional) {
    if (-not $a.ContainsKey($e) -or $null -eq $a[$e]) { $a[$e] = '' }
  }
  $z = $script:KennungZeichen
  if ($a.ContainsKey('kennung') -and [string]$a.kennung -cnotmatch "^[$z]{2}-[$z]{4}$") {
    throw "Kennung ungültig: '$($a.kennung)'. Erlaubt sind 2 und 4 Zeichen aus 2–9 und Buchstaben ohne B, G, I, L, O, S, U, Z."
  }
  if ($a.ContainsKey('positionen')) { $a.positionen = @(ConvertTo-Positionen $a.positionen) }
  if ($a.ContainsKey('zahlung')) {
    if ($a.zahlung -notin 'bar', 'karte') { throw "Zahlung ungültig: '$($a.zahlung)' (bar oder karte)." }
    if ($a.zahlung -eq 'bar' -and [string]$a['gegeben'] -notmatch '^\d{1,6}([.,]\d{1,2})?$') {
      throw "Bei Bargeld braucht der Auftrag 'gegeben' als Betrag, etwa 50,00."
    }
  }
  $a
}
