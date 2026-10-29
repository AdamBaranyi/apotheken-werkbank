BeforeAll {
  Import-Module (Join-Path $PSScriptRoot '../Werkbank.Engine.psd1') -Force
  . (Join-Path $PSScriptRoot 'Hilfen.ps1')
}

Describe 'Get-Aehnlichkeit' {
  It 'verzeiht der OCR einen fehlenden Umlaut' {
    $wert = Get-Aehnlichkeit -A 'Hinzufügen' -B 'Hinzufugen'
    $wert | Should -BeGreaterOrEqual 0.85
    $wert | Should -BeLessThan 1
  }

  It 'liest O als 0 und I als 1 in Nummern' {
    Get-Aehnlichkeit -A '99100008' -B '99I0OO08' | Should -Be 1
  }

  It 'ignoriert Gross- und Kleinschreibung und doppelte Leerzeichen' {
    Get-Aehnlichkeit -A 'Neuer Bon' -B 'neuer   BON' | Should -Be 1
  }

  It 'trennt verschiedene Wörter deutlich' {
    Get-Aehnlichkeit -A 'Tagesabschluss' -B 'Hinzufügen' | Should -BeLessThan 0.5
  }
}

Describe 'Find-Text' {
  BeforeAll {
    $bild = New-TestBild @(
      @{ X = 16; Y = 20; Text = 'PZN 99100008' }
      @{ X = 100; Y = 50; Text = 'Rezept liegt vor?' }
      @{ X = 16; Y = 80; Text = 'Ja Nein' }
      @{ X = 16; Y = 110; Text = 'Referenz K7-QX4N: unbekannt' }
      @{ X = 16; Y = 140; Text = '99100008 Probatin 400 mg' }
      @{ X = 300; Y = 170; Text = 'Verkauf suchen' }
      @{ X = 16; Y = 170; Text = 'Verkauf buchen' }
    )
  }

  It 'findet eine Phrase über mehrere Wörter und meldet ihre ganze Lage' {
    $t = Find-Text -Bild $bild -Text 'Rezept liegt vor?'
    $t.X | Should -Be 100
    $t.Y | Should -Be 50
    $t.B | Should -Be 119
    $t.H | Should -Be 14
    $t.MitteX | Should -Be 159
    $t.MitteY | Should -Be 57
  }

  It 'setzt keine Phrase aus zwei Zeilen zusammen' {
    Find-Text -Bild $bild -Text 'Nein Referenz' | Should -BeNullOrEmpty
  }

  It 'verlangt bei kurzen Wörtern genaue Gleichheit, auch bei tiefer Schwelle' {
    Find-Text -Bild $bild -Text 'Jo' -Schwelle 0.5 | Should -BeNullOrEmpty
    (Find-Text -Bild $bild -Text 'Ja').X | Should -Be 16
  }

  It 'zählt überlappende Fundstellen derselben Wörter nur einmal' {
    $b = New-TestBild @(@{ X = 16; Y = 20; Text = 'Beleg 1001 gebucht .' })
    @(Find-Text -Bild $b -Text 'Beleg 1001 gebucht' -Alle).Count | Should -Be 1
  }

  It 'nimmt bei zwei ähnlichen Knöpfen den genau passenden' {
    (Find-Text -Bild $bild -Text 'Verkauf buchen').X | Should -Be 16
  }

  It 'findet unscharf, aber mit -Genau nur das exakte Zeichen' {
    (Find-Text -Bild $bild -Text 'Referenz K7-QX4M: unbekannt').Wert | Should -BeGreaterThan 0.9
    Find-Text -Bild $bild -Text 'Referenz K7-QX4M: unbekannt' -Genau | Should -BeNullOrEmpty
    (Find-Text -Bild $bild -Text 'referenz k7-qx4n: unbekannt' -Genau).Y | Should -Be 110
  }

  It 'sucht nur im Bereich, wenn einer angegeben ist' {
    $oben = Find-Text -Bild $bild -Text '99100008'
    $oben.Y | Should -Be 20
    $unten = Find-Text -Bild $bild -Text '99100008' -Bereich @{ X = 0; Y = 130; B = 400; H = 30 }
    $unten.Y | Should -Be 140
  }

  It 'liefert mit -Alle jede Fundstelle' {
    @(Find-Text -Bild $bild -Text '99100008' -Alle).Count | Should -Be 2
  }

  It 'vergleicht Zahlen genau: «Positionen 2» ist nicht «Positionen 1» (Durchsicht 29.10.)' {
    $b = New-TestBild @(@{ X = 16; Y = 54; Text = 'Positionen 1' })
    Find-Text -Bild $b -Text 'Positionen 2' | Should -BeNullOrEmpty
    (Find-Text -Bild $b -Text 'Positionen 1').Y | Should -Be 54
  }

  It 'nimmt einen Betrag nur mit denselben Ziffern' {
    Find-Text -Bild (New-TestBild @(@{ X = 16; Y = 20; Text = '1234,60' })) -Text '1234,50' | Should -BeNullOrEmpty
    Find-Text -Bild (New-TestBild @(@{ X = 16; Y = 20; Text = '123,50' })) -Text '1234,50' | Should -BeNullOrEmpty
  }

  It 'stört sich nicht an einem Buchstaben, den die OCR als Ziffer las («1m» für «Im», Befund Süd)' {
    $b = New-TestBild @(
      @{ X = 16; Y = 70; Text = '1m Vorgang 1' }
      @{ X = 16; Y = 100; Text = '1m Vorgang 2' }
    )
    (Find-Text -Bild $b -Text 'Im Vorgang 1').Y | Should -Be 70
    (Find-Text -Bild $b -Text 'Im Vorgang 2').Y | Should -Be 100
    (Find-Text -Bild (New-TestBild @(@{ X = 16; Y = 70; Text = 'Im Vorgang1' })) -Text 'Im Vorgang 1').Y | Should -Be 70
  }

  It 'gleicht in Zahlen weiter Verwechslungen, Punkt statt Komma und geteilte Wörter aus' {
    $b = New-TestBild @(
      @{ X = 16; Y = 20; Text = 'Positionen l' }
      @{ X = 16; Y = 50; Text = 'Summe 1 5.34 EUR' }
      @{ X = 16; Y = 80; Text = '991O4118' }
    )
    (Find-Text -Bild $b -Text 'Positionen 1').Y | Should -Be 20
    (Find-Text -Bild $b -Text 'Summe 15,34 EUR').Y | Should -Be 50
    (Find-Text -Bild $b -Text '99104118').Y | Should -Be 80
  }
}
