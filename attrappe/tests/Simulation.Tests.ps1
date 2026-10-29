BeforeAll {
  Import-Module (Join-Path $PSScriptRoot '../Kassen.Attrappe.psd1') -Force

  # Kleines Layout: Zeichen 7 px breit, Wörter 14 px hoch und in ihrem Element
  # senkrecht zentriert. «PZN» liegt so bei X 10, Y 10 + 12 - 7 = 15.
  $script:Mini = @{
    Variante = 'test'; Titel = 'Testkasse'; Groesse = @(400, 300)
    Schrift = @{ Name = 'Segoe UI'; Punkt = 9; Zeichenbreite = 7 }
    Texte = @{}; Enter = @{ pzn = 'Hinzufuegen' }; Bestaetigen = ''
    Elemente = @(
      @{ Art = 'beschriftung'; Text = 'PZN'; Lage = @(10, 10, 40, 24) }
      @{ Art = 'feld'; Name = 'pzn'; Lage = @(60, 10, 100, 24) }
      @{ Art = 'knopf'; Text = 'Hinzufügen'; Aktion = 'Hinzufuegen'; Lage = @(170, 8, 110, 28) }
      @{ Art = 'anzeige'; Name = 'Positionen'; Lage = @(10, 50, 150, 20) }
      @{ Art = 'anzeige'; Name = 'Status'; Lage = @(10, 80, 300, 20) }
      @{ Art = 'liste'; Name = 'Bonzeilen'; Lage = @(10, 110, 380, 100) }
      @{ Art = 'knopf'; Text = 'Bar'; Aktion = 'Bar'; Lage = @(10, 220, 80, 28) }
      @{ Art = 'feld'; Name = 'gegeben'; Lage = @(100, 222, 80, 24) }
    )
  }

  function Get-Wort($Bild, [string] $Text) {
    $Bild.Woerter | Where-Object Text -CEQ $Text | Select-Object -First 1
  }
  function Get-Zeilen($Bild) {
    @($Bild.Woerter | Group-Object Zeile | ForEach-Object { ($_.Group | Sort-Object X).Text -join ' ' })
  }
  function Send-InsFeld($Sim, [string] $Text) {
    # Ursprung 40/60: Feld «pzn» liegt auf dem Bildschirm bei 100..200 / 70..94.
    Send-SimulationsKlick -Simulation $Sim -X 110 -Y 82
    Send-SimulationsText -Simulation $Sim -Text $Text
  }
}

Describe 'Bildschirm-Simulation der Kasse' {
  BeforeEach {
    $sim = New-KassenSimulation -Layout $script:Mini -Ursprung @(40, 60)
  }

  It 'zeigt Beschriftung, Knopftext und Anzeige an der Lage aus dem Layout' {
    $bild = Get-SimulationsBild -Simulation $sim
    $bild.Fenster.X | Should -Be 40
    $pzn = Get-Wort $bild 'PZN'
    $pzn.X | Should -Be 10
    $pzn.Y | Should -Be 15
    $pzn.B | Should -Be 21
    (Get-Wort $bild 'Hinzufügen').X | Should -Be 190
    (Get-Wort $bild 'Positionen').Y | Should -Be 53
    (Get-Wort $bild '0').X | Should -Be 87
  }

  It 'legt nach Klick ins Feld, Tippen und Enter die Position an und leert das Feld' {
    Send-InsFeld $sim '99100008'
    (Get-Wort (Get-SimulationsBild -Simulation $sim) '99100008').X | Should -Be 63
    Send-SimulationsTaste -Simulation $sim -Name Enter
    $zeilen = Get-Zeilen (Get-SimulationsBild -Simulation $sim)
    $zeilen | Should -Contain 'Positionen 1'
    $zeilen | Should -Contain '99100008 Probatin 400 mg Filmtabletten 20 St. 1 x 3,95'
    $sim.Felder.pzn | Should -Be ''
  }

  It 'leert mit Escape das Feld, das den Fokus hat' {
    Send-InsFeld $sim '991'
    Send-SimulationsTaste -Simulation $sim -Name Escape
    $sim.Felder.pzn | Should -Be ''
  }

  It 'gibt dem ersten Feld den Fokus, wie ein frisch geöffnetes Fenster' {
    Send-SimulationsText -Simulation $sim -Text '991'
    $sim.Felder.pzn | Should -Be '991'
  }

  It 'verliert Tippen, wenn ein Knopf den Fokus hat' {
    Send-SimulationsKlick -Simulation $sim -X 60 -Y 294
    Send-SimulationsText -Simulation $sim -Text '99100008'
    $sim.Felder.pzn | Should -Be ''
    $sim.Felder.gegeben | Should -Be ''
  }

  It 'zeigt die Rx-Rückfrage als Dialog, verdeckt was darunter liegt und sperrt das Fenster' {
    Send-InsFeld $sim '99100008'
    Send-SimulationsTaste -Simulation $sim -Name Enter
    Send-InsFeld $sim '99104118'
    Send-SimulationsTaste -Simulation $sim -Name Enter
    $bild = Get-SimulationsBild -Simulation $sim
    Get-Zeilen $bild | Should -Contain 'Rezept liegt vor?'
    # Dialog 300 x 120 mittig: 50..350 / 90..210. «Probatin» (Mitte 104/119)
    # liegt darunter, die PZN davor (Mitte 41/119) nicht.
    Get-Wort $bild 'Probatin' | Should -BeNullOrEmpty
    Get-Wort $bild '99100008' | Should -Not -BeNullOrEmpty
    Send-SimulationsKlick -Simulation $sim -X 280 -Y 82
    $sim.Kasse.Status | Should -Be 'Hinzugefügt: 99100008'
    $ja = Get-Wort $bild 'Ja'
    Send-SimulationsKlick -Simulation $sim -X (40 + $ja.X + 3) -Y (60 + $ja.Y + 7)
    $sim.Kasse.Bon.Count | Should -Be 2
    $sim.Kasse.Bon[1].Rezept | Should -BeTrue
    $sim.Dialog | Should -BeNullOrEmpty
  }

  It 'meldet eine langsame Buchung erst nach einigen Bildern' {
    $sim = New-KassenSimulation -Layout $script:Mini -Ursprung @(40, 60) -Chaos @{ Langsam = 2 }
    Send-InsFeld $sim '99100008'
    Send-SimulationsTaste -Simulation $sim -Name Enter
    Send-SimulationsKlick -Simulation $sim -X 150 -Y 294
    Send-SimulationsText -Simulation $sim -Text '5'
    Send-SimulationsKlick -Simulation $sim -X 60 -Y 294
    Get-Zeilen (Get-SimulationsBild -Simulation $sim) | Should -Contain 'Bitte warten …'
    Get-Zeilen (Get-SimulationsBild -Simulation $sim) | Should -Contain 'Bitte warten …'
    Get-Zeilen (Get-SimulationsBild -Simulation $sim) | Should -Contain 'Beleg 1001 gebucht, Rückgeld 1,05 €'
  }

  It 'löscht das alte Suchergebnis, sobald jemand in die Suche tippt' {
    $layout = $script:Mini.Clone()
    $layout.Elemente = @($script:Mini.Elemente) + @(
      @{ Art = 'feld'; Name = 'suche'; Lage = @(200, 222, 80, 24) }
      @{ Art = 'anzeige'; Name = 'Treffer'; Lage = @(10, 260, 380, 20) }
    )
    $layout.Enter = @{ pzn = 'Hinzufuegen'; suche = 'Suchen' }
    $sim = New-KassenSimulation -Layout $layout -Ursprung @(40, 60)
    # Suchfeld 200..280 / 222..246, auf dem Bildschirm 240..320 / 282..306.
    Send-SimulationsKlick -Simulation $sim -X 250 -Y 294
    Send-SimulationsText -Simulation $sim -Text 'K7-QX4M'
    Send-SimulationsTaste -Simulation $sim -Name Enter
    $sim.Kasse.Treffer | Should -Be 'Referenz K7-QX4M: unbekannt'
    Send-SimulationsTaste -Simulation $sim -Name Escape
    $sim.Kasse.Treffer | Should -Be ''
    Send-SimulationsText -Simulation $sim -Text 'K'
    Send-SimulationsTaste -Simulation $sim -Name Enter
    Send-SimulationsText -Simulation $sim -Text '7'
    $sim.Kasse.Treffer | Should -Be ''
  }

  It 'nimmt während einer langsamen Buchung keine Eingaben an' {
    $sim = New-KassenSimulation -Layout $script:Mini -Ursprung @(40, 60) -Chaos @{ Langsam = 3 }
    Send-InsFeld $sim '99100008'
    Send-SimulationsTaste -Simulation $sim -Name Enter
    Send-SimulationsKlick -Simulation $sim -X 150 -Y 294
    Send-SimulationsText -Simulation $sim -Text '5'
    Send-SimulationsKlick -Simulation $sim -X 60 -Y 294
    Send-InsFeld $sim '99102740'
    Send-SimulationsTaste -Simulation $sim -Name Enter
    $sim.Felder.pzn | Should -Be ''
    $sim.Kasse.Bon.Count | Should -Be 1
  }

  It 'verschiebt das Fenster nach jeder Aktion; alte Koordinaten treffen nichts mehr' {
    $sim = New-KassenSimulation -Layout $script:Mini -Ursprung @(40, 60) -Chaos @{ Wandern = @(30, 20) }
    Send-InsFeld $sim '99100008'
    Send-SimulationsTaste -Simulation $sim -Name Enter
    (Get-SimulationsBild -Simulation $sim).Fenster.X | Should -Be 70
    Send-SimulationsKlick -Simulation $sim -X 60 -Y 294
    $sim.Kasse.Status | Should -Be 'Hinzugefügt: 99100008'
    Send-SimulationsKlick -Simulation $sim -X 90 -Y 314
    $sim.Kasse.Status | Should -Be 'Betrag ungültig: '
  }

  It 'liest Nullen als O, wenn die OCR schlecht ist' {
    $sim = New-KassenSimulation -Layout $script:Mini -Ursprung @(40, 60) -Chaos @{ Verlesen = $true }
    Send-InsFeld $sim '99100008'
    Get-Wort (Get-SimulationsBild -Simulation $sim) '991OOOO8' | Should -Not -BeNullOrEmpty
  }

  It 'fragt vor dem Buchen nach, wenn das Layout es verlangt' {
    $layout = $script:Mini.Clone()
    $layout.Bestaetigen = 'Verkauf wirklich abschliessen?'
    $sim = New-KassenSimulation -Layout $layout -Ursprung @(40, 60)
    Send-InsFeld $sim '99100008'
    Send-SimulationsTaste -Simulation $sim -Name Enter
    Send-SimulationsKlick -Simulation $sim -X 150 -Y 294
    Send-SimulationsText -Simulation $sim -Text '5'
    Send-SimulationsKlick -Simulation $sim -X 60 -Y 294
    $bild = Get-SimulationsBild -Simulation $sim
    Get-Zeilen $bild | Should -Contain 'Verkauf wirklich abschliessen?'
    $sim.Kasse.Journal.Count | Should -Be 0
    $ja = Get-Wort $bild 'Ja'
    Send-SimulationsKlick -Simulation $sim -X (40 + $ja.X + 3) -Y (60 + $ja.Y + 7)
    $sim.Kasse.Journal.Count | Should -Be 1
  }

  It 'blendet nach einer Aktion die Preisliste ein; Escape heisst «Später»' {
    $sim = New-KassenSimulation -Layout $script:Mini -Ursprung @(40, 60) -Chaos @{ DialogNach = 1 }
    Send-InsFeld $sim '99100008'
    Send-SimulationsTaste -Simulation $sim -Name Enter
    Get-Zeilen (Get-SimulationsBild -Simulation $sim) | Should -Contain 'Neue Preisliste verfügbar'
    Send-SimulationsTaste -Simulation $sim -Name Escape
    $sim.Dialog | Should -BeNullOrEmpty
  }

  It 'zeigt einen unbekannten Dialog, den nur «OK» schliesst' {
    $sim = New-KassenSimulation -Layout $script:Mini -Ursprung @(40, 60) -Chaos @{ UnbekanntNach = 1 }
    Send-InsFeld $sim '99100008'
    Send-SimulationsTaste -Simulation $sim -Name Enter
    Send-SimulationsTaste -Simulation $sim -Name Escape
    $bild = Get-SimulationsBild -Simulation $sim
    Get-Zeilen $bild | Should -Contain 'Bondrucker: Papier fast leer'
    $ok = Get-Wort $bild 'OK'
    Send-SimulationsKlick -Simulation $sim -X (40 + $ok.X + 3) -Y (60 + $ok.Y + 7)
    $sim.Dialog | Should -BeNullOrEmpty
  }
}
