BeforeAll {
  Import-Module (Join-Path $PSScriptRoot '../Kassen.Attrappe.psd1') -Force

  function New-Grundlayout {
    @{
      Variante = 'test'; Titel = 'Testkasse'; Groesse = @(400, 300)
      Schrift = @{ Name = 'Segoe UI'; Punkt = 9; Zeichenbreite = 7 }
      Texte = @{}; Enter = @{ pzn = 'Hinzufuegen' }; Bestaetigen = ''
      Elemente = @(
        @{ Art = 'beschriftung'; Text = 'PZN'; Lage = @(10, 10, 40, 24) }
        @{ Art = 'feld'; Name = 'pzn'; Lage = @(60, 10, 100, 24) }
        @{ Art = 'knopf'; Text = 'Hinzufügen'; Aktion = 'Hinzufuegen'; Lage = @(170, 8, 110, 28) }
      )
    }
  }
}

Describe 'Layouts der Kassen-Attrappe' {
  It 'Nord und Süd sind gültig' {
    Test-KassenLayout -Layout (Import-KassenLayout -Variante nord) | Should -BeNullOrEmpty
    Test-KassenLayout -Layout (Import-KassenLayout -Variante sued) | Should -BeNullOrEmpty
  }

  It 'findet ein Element ausserhalb des Fensters' {
    $l = New-Grundlayout
    $l.Elemente[1].Lage = @(350, 10, 100, 24)
    Test-KassenLayout -Layout $l | Should -Match 'ausserhalb'
  }

  It 'findet überlappende Elemente' {
    $l = New-Grundlayout
    $l.Elemente[2].Lage = @(150, 8, 110, 28)
    Test-KassenLayout -Layout $l | Should -Match 'überlappt'
  }

  It 'findet eine unbekannte Aktion und eine unbekannte Art' {
    $l = New-Grundlayout
    $l.Elemente[2].Aktion = 'Drucken'
    $l.Elemente[0].Art = 'bild'
    $probleme = (Test-KassenLayout -Layout $l) -join "`n"
    $probleme | Should -Match "unbekannte Aktion 'Drucken'"
    $probleme | Should -Match 'unbekannte Art'
  }

  It 'findet doppelte Knopftexte, die die Engine nicht unterscheiden könnte' {
    $l = New-Grundlayout
    $l.Elemente += @{ Art = 'knopf'; Text = 'Hinzufügen'; Aktion = 'Leeren'; Lage = @(170, 100, 110, 28) }
    Test-KassenLayout -Layout $l | Should -Match 'doppelt'
  }

  It 'findet eine Enter-Zuordnung auf ein Feld, das es nicht gibt' {
    $l = New-Grundlayout
    $l.Enter = @{ menge = 'Hinzufuegen' }
    Test-KassenLayout -Layout $l | Should -Match 'Enter'
  }
}
