# Layouts der Kassen-Attrappe laden und prüfen. Ein Fehler im Layout zeigte
# sich sonst erst als Fehlklick der Engine auf dem Windows-Läufer.

$script:LayoutArten = @('beschriftung', 'feld', 'knopf', 'anzeige', 'liste')
$script:LayoutAktionen = @('Hinzufuegen', 'Bar', 'Karte', 'Leeren', 'Suchen', 'Abschluss')
$script:LayoutAnzeigen = @('Positionen', 'Summe', 'Status', 'Treffer', 'Bonzeilen')

function Import-KassenLayout {
  [CmdletBinding()]
  param([Parameter(Mandatory)] [ValidateSet('nord', 'sued')] [string] $Variante)
  Import-PowerShellDataFile -LiteralPath (Join-Path $PSScriptRoot "../layouts/$Variante.psd1")
}

function Get-Elementname {
  param([hashtable] $Element, [int] $Nr)
  $name = if ($Element['Text']) { $Element['Text'] } else { $Element['Name'] }
  "Element $Nr ($($Element['Art']) '$name')"
}

function Test-Ueberlappung {
  param([int[]] $A, [int[]] $B)
  $A[0] -lt ($B[0] + $B[2]) -and $B[0] -lt ($A[0] + $A[2]) -and
  $A[1] -lt ($B[1] + $B[3]) -and $B[1] -lt ($A[1] + $A[3])
}

function Test-KassenLayout {
  <#
    .SYNOPSIS
    Liefert die Probleme eines Layouts als Texte; leer heisst gültig.
  #>
  [CmdletBinding()]
  [OutputType([string[]])]
  param([Parameter(Mandatory)] [hashtable] $Layout)
  $breite, $hoehe = $Layout['Groesse']
  $elemente = @($Layout['Elemente'])
  $probleme = [System.Collections.Generic.List[string]]::new()
  for ($i = 0; $i -lt $elemente.Count; $i++) {
    $e = $elemente[$i]
    $name = Get-Elementname $e ($i + 1)
    if ($script:LayoutArten -notcontains $e['Art']) { $probleme.Add("${name}: unbekannte Art") }
    $lage = @($e['Lage'])
    if ($lage.Count -ne 4) { $probleme.Add("${name}: Lage braucht X, Y, Breite, Höhe"); continue }
    if ($lage[0] -lt 0 -or $lage[1] -lt 0 -or ($lage[0] + $lage[2]) -gt $breite -or ($lage[1] + $lage[3]) -gt $hoehe) {
      $probleme.Add("$name liegt ausserhalb des Fensters")
    }
    if ($e['Art'] -eq 'knopf' -and $script:LayoutAktionen -notcontains $e['Aktion']) {
      $probleme.Add("${name}: unbekannte Aktion '$($e['Aktion'])'")
    }
    if ($e['Art'] -in 'anzeige', 'liste' -and $script:LayoutAnzeigen -notcontains $e['Name']) {
      $probleme.Add("${name}: unbekannte Anzeige '$($e['Name'])'")
    }
    if ($e['Art'] -in 'feld', 'anzeige', 'liste' -and -not $e['Name']) { $probleme.Add("${name}: Name fehlt") }
    for ($j = 0; $j -lt $i; $j++) {
      $andere = @($elemente[$j]['Lage'])
      if ($andere.Count -eq 4 -and (Test-Ueberlappung $lage $andere)) {
        $probleme.Add("$name überlappt $(Get-Elementname $elemente[$j] ($j + 1))")
      }
    }
  }
  $knopftexte = $elemente | Where-Object { $_['Art'] -eq 'knopf' } | ForEach-Object { $_['Text'].ToLowerInvariant() }
  foreach ($doppelt in ($knopftexte | Group-Object | Where-Object Count -GT 1)) {
    $probleme.Add("Knopftext doppelt: '$($doppelt.Name)'")
  }
  $felder = @($elemente | Where-Object { $_['Art'] -eq 'feld' } | ForEach-Object { $_['Name'] })
  $enter = $Layout['Enter']
  if ($enter) {
    foreach ($feld in $enter.Keys) {
      if ($felder -notcontains $feld) { $probleme.Add("Enter: Feld '$feld' gibt es nicht") }
      if ($script:LayoutAktionen -notcontains $enter[$feld]) { $probleme.Add("Enter: unbekannte Aktion '$($enter[$feld])'") }
    }
  }
  @($probleme)
}
