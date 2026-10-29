BeforeAll {
  Import-Module (Join-Path $PSScriptRoot '../Werkbank.Engine.psd1') -Force
  $script:Flows = Join-Path $PSScriptRoot '../../flows'

  function New-TestFlow([string] $Ordner, [string] $Name, [string] $Inhalt) {
    $pfad = Join-Path $TestDrive "flows/$Ordner/$Name.yaml"
    $null = New-Item -ItemType Directory -Force -Path (Split-Path $pfad)
    Set-Content -LiteralPath $pfad -Value $Inhalt -Encoding utf8
    $pfad
  }

  $script:Kopf = @'
flow: probe
apotheke: test
fenster: Testkasse
eingaben: [kennung, positionen]
schritte:
'@
}

Describe 'Import-Flow' {
  It 'findet den Flow einer Apotheke über Ordner und Namen' {
    $flow = Import-Flow -Apotheke sued -Flow verkauf -Wurzel $script:Flows
    $flow.Fenster | Should -Be 'Kassensystem Süd'
    $flow.Schritte[0].klicke | Should -Be 'Storno Bon'
  }

  It 'meldet einen Flow, den es nicht gibt, mit Pfad' {
    { Import-Flow -Apotheke ost -Flow verkauf -Wurzel $script:Flows } | Should -Throw '*ost*verkauf.yaml*'
  }
}

Describe 'Test-Flow (lint)' {
  It 'findet in den mitgelieferten Flows nichts' {
    Test-Flow -Pfad $script:Flows | Should -BeNullOrEmpty
  }

  It 'meldet einen Schritt mit zwei Aktionen' {
    $pfad = New-TestFlow 'test' 'probe' ($script:Kopf + "`n  - klicke: Bar`n    taste: Enter`n")
    (Test-Flow -Pfad $pfad).Meldung | Should -Contain 'Schritt 1: genau eine Aktion erwartet, gefunden: klicke, taste'
  }

  It 'meldet einen unbekannten Schlüssel in einem Unterschritt' {
    $inhalt = $script:Kopf + @'

  - fuer-jede: positionen
    als: pos
    schritte:
      - klicke: Bar
        warten: 3
'@
    (Test-Flow -Pfad (New-TestFlow 'test' 'probe' $inhalt)).Meldung | Should -Contain "Schritt 1.1: unbekannter Schlüssel 'warten'"
  }

  It 'kennt optionale Eingaben mit Fragezeichen' {
    $inhalt = ($script:Kopf -replace 'eingaben: \[kennung, positionen\]', 'eingaben: [kennung, gegeben?]') + "`n  - pruefe: '`${gegeben}'`n"
    Test-Flow -Pfad (New-TestFlow 'test' 'probe' $inhalt) | Should -BeNullOrEmpty
  }

  It 'meldet eine Variable, die der Flow nicht kennt' {
    $pfad = New-TestFlow 'test' 'probe' ($script:Kopf + "`n  - eingeben: { neben: PZN, dx: 60, text: '`${pso.pzn}' }`n")
    (Test-Flow -Pfad $pfad).Meldung | Should -Be "Schritt 1: Variable 'pso' ist unbekannt"
  }

  It 'kennt die Schleifenvariable nur in ihrer Schleife' {
    $inhalt = $script:Kopf + @'

  - fuer-jede: positionen
    als: pos
    schritte:
      - eingeben: { neben: PZN, dx: 60, text: '${pos.pzn}' }
  - eingeben: { neben: Menge, dx: 60, text: '${pos.menge}' }
'@
    $pfad = New-TestFlow 'test' 'probe' $inhalt
    (Test-Flow -Pfad $pfad).Meldung | Should -Be "Schritt 2: Variable 'pos' ist unbekannt"
  }

  It 'kennt Werte, die ein früherer Schritt gelesen hat' {
    $inhalt = $script:Kopf + @'

  - lies: { muster: 'Beleg (\d+)', als: beleg }
  - pruefe: 'Beleg ${beleg}'
'@
    Test-Flow -Pfad (New-TestFlow 'test' 'probe' $inhalt) | Should -BeNullOrEmpty
  }

  It 'meldet einen kritischen Schritt, der wiederholbar sein soll' {
    $pfad = New-TestFlow 'test' 'probe' ($script:Kopf + "`n  - klicke: Bar`n    kritisch: true`n    wiederholbar: true`n")
    (Test-Flow -Pfad $pfad).Meldung | Should -Be 'Schritt 1: kritisch und wiederholbar schliessen sich aus'
  }

  It 'meldet ein Muster, das kein regulärer Ausdruck ist' {
    $pfad = New-TestFlow 'test' 'probe' ($script:Kopf + "`n  - lies: { muster: 'Beleg (\d+', als: beleg }`n")
    (Test-Flow -Pfad $pfad).Meldung | Should -Match '^Schritt 1: Muster ungültig'
  }

  It 'meldet eine Schleife über eine Eingabe, die der Flow nicht nennt' {
    $inhalt = $script:Kopf + @'

  - fuer-jede: artikel
    als: a
    schritte:
      - pruefe: '${a.pzn}'
'@
    (Test-Flow -Pfad (New-TestFlow 'test' 'probe' $inhalt)).Meldung | Should -Be "Schritt 1: Liste 'artikel' ist keine Eingabe"
  }

  It 'meldet, wenn Datei und Ordner nicht zu Flow und Apotheke passen' {
    $pfad = New-TestFlow 'nord' 'kasse' ($script:Kopf + "`n  - klicke: Bar`n")
    $meldungen = (Test-Flow -Pfad $pfad).Meldung
    $meldungen | Should -Contain "Flow 'probe' steht in der Datei 'kasse.yaml'"
    $meldungen | Should -Contain "Apotheke 'test' steht im Ordner 'nord'"
  }

  It 'meldet kaputtes YAML als Befund statt abzustürzen' {
    $pfad = New-TestFlow 'test' 'probe' "flow: probe`nschritte: [`n  - klicke"
    $befund = @(Test-Flow -Pfad $pfad)
    $befund.Count | Should -Be 1
    $befund[0].Datei | Should -Be $pfad
    $befund[0].Meldung | Should -Match 'YAML'
  }
}

Describe 'Expand-Text' {
  It 'setzt verschachtelte Werte ein und schreibt Wahrheitswerte klein' {
    $kontext = @{ kennung = 'K7-QX4M'; pos = @{ pzn = '99100008'; rezept = $true; nr = 2 } }
    Expand-Text -Text 'Ref ${kennung}, ${pos.pzn} ${pos.rezept} ${pos.nr}' -Kontext $kontext |
      Should -Be 'Ref K7-QX4M, 99100008 true 2'
  }

  It 'bricht bei einem fehlenden Wert mit dessen Namen ab' {
    { Expand-Text -Text '${pos.menge}' -Kontext @{ pos = @{ pzn = '1' } } } | Should -Throw "*'pos.menge'*"
  }
}
