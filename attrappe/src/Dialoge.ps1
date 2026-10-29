# Dialoge der Kassen-Attrappe: Rückfrage zum Rezept, Bestätigung vor dem
# Abschluss (Süd) und zwei Störungen für Chaos-Tests. Fenster und Simulation
# nutzen dieselben Texte, Knöpfe und Antworten.

function New-KassenDialog {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)] [ValidateSet('rezept', 'bestaetigen', 'preisliste', 'unbekannt')] [string] $Art,
    [Parameter(Mandatory)] [hashtable] $Kasse,
    [string] $Text = '',
    [string] $Ziel = ''
  )
  switch ($Art) {
    'rezept' {
      @{ Art = $Art; Text = $Kasse.Texte.Rueckfrage; Escape = 'nein'; Ziel = ''
        Knoepfe = @(@{ Text = 'Ja'; Antwort = 'ja' }, @{ Text = 'Nein'; Antwort = 'nein' }) }
    }
    'bestaetigen' {
      @{ Art = $Art; Text = $Text; Escape = 'nein'; Ziel = $Ziel
        Knoepfe = @(@{ Text = 'Ja'; Antwort = 'ja' }, @{ Text = 'Nein'; Antwort = 'nein' }) }
    }
    'preisliste' {
      @{ Art = $Art; Text = 'Neue Preisliste verfügbar'; Escape = 'spaeter'; Ziel = ''
        Knoepfe = @(@{ Text = 'Später'; Antwort = 'spaeter' }, @{ Text = 'Jetzt laden'; Antwort = 'laden' }) }
    }
    'unbekannt' {
      # Kein Escape: Nur «OK» schliesst ihn. Den kennt kein Flow; hier soll
      # die Selbstheilung zeigen, was sie kann.
      @{ Art = $Art; Text = 'Bondrucker: Papier fast leer'; Escape = ''; Ziel = ''
        Knoepfe = @(@{ Text = 'OK'; Antwort = 'ok' }) }
    }
  }
}

function Invoke-KassenDialogAntwort {
  <#
    .SYNOPSIS
    Wendet eine Antwort an. Liefert die Zahlart zurück, wenn danach gebucht
    werden soll (Bestätigung mit «Ja»); das Buchen selbst macht der Aufrufer,
    weil Fenster und Simulation eine langsame Kasse verschieden nachbilden.
  #>
  [CmdletBinding()]
  param([Parameter(Mandatory)] [hashtable] $Kasse, [Parameter(Mandatory)] [hashtable] $Dialog, [string] $Antwort)
  switch ($Dialog.Art) {
    'rezept' {
      if ($Antwort -eq 'ja') { Resolve-KassenRueckfrage -Kasse $Kasse -Ja | Out-Null }
      else { Resolve-KassenRueckfrage -Kasse $Kasse | Out-Null }
    }
    'bestaetigen' {
      if ($Antwort -eq 'ja') { return $Dialog.Ziel }
      $Kasse.Status = 'Abschluss abgebrochen'
    }
    'preisliste' {
      if ($Antwort -eq 'laden') { $Kasse.Status = 'Preisliste geladen' }
    }
  }
  ''
}

function Get-DialogLage {
  # Dialoge stehen mittig im Fenster: 300 x 120, Knöpfe 80 x 28 rechts unten.
  param([hashtable] $Dialog, [int] $Breite, [int] $Hoehe)
  $x = [int](($Breite - 300) / 2)
  $y = [int](($Hoehe - 120) / 2)
  $n = @($Dialog.Knoepfe).Count
  $knoepfe = for ($i = 0; $i -lt $n; $i++) {
    @{ Knopf = $Dialog.Knoepfe[$i]; Lage = @(($x + 300 - 16 - 80 - ($n - 1 - $i) * 90), ($y + 120 - 16 - 28), 80, 28) }
  }
  @{ Lage = @($x, $y, 300, 120); Knoepfe = @($knoepfe) }
}
