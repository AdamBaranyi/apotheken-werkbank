# Hilfen für die Pester-Tests der Engine. Nur Testcode.

function New-TestBild {
  <#
    Baut ein Bild wie aus der OCR: jede Zeile mit Lage, jedes Zeichen 7 px breit,
    Wörter durch 7 px getrennt, Höhe 14 px. So lassen sich erwartete Lagen von
    Hand nachrechnen: «Rezept liegt vor?» ab X 100 hat die Wörter bei 100, 149
    und 191.
  #>
  param([Parameter(Mandatory)] [object[]] $Zeilen)
  $nr = 0
  $woerter = foreach ($zeile in $Zeilen) {
    $x = $zeile.X
    foreach ($text in ($zeile.Text -split ' ')) {
      [pscustomobject]@{ Text = $text; X = $x; Y = $zeile.Y; B = 7 * $text.Length; H = 14; Zeile = $nr }
      $x += 7 * $text.Length + 7
    }
    $nr++
  }
  [pscustomobject]@{
    Fenster = [pscustomobject]@{ X = 0; Y = 0; Breite = 800; Hoehe = 600 }
    Woerter = @($woerter)
    Pfad    = $null
  }
}
