BeforeAll {
  Import-Module (Join-Path $PSScriptRoot '../Werkbank.Engine.psd1') -Force
  $script:Flows = Join-Path $PSScriptRoot '../../flows'

  # Ohne Schlafen und mit festem Takt zählen Wartezeiten in Bildern: 8 s
  # Wartezeit sind bei 0,25 s Takt 32 Bilder. So ist jeder Lauf bestimmt.
  function Get-Optionen([hashtable] $Mehr = @{}) {
    $o = @{ Takt = 0.25; Schlafen = $false; Ausgabe = (Join-Path $TestDrive 'laeufe') }
    foreach ($k in $Mehr.Keys) { $o[$k] = $Mehr[$k] }
    $o
  }

  # 3 x 3,95 + 1 x 12,90 = 24,75 €; gegeben 50,00 €.
  function New-Auftrag([string] $Zahlung = 'bar', [bool] $Rezept = $true) {
    @{
      kennung    = 'K7-QX4M'
      positionen = @(
        @{ pzn = '99100008'; menge = 3 }
        @{ pzn = '99104118'; menge = 1; rezept = $Rezept }
      )
      zahlung    = $Zahlung
      gegeben    = '50,00'
    }
  }

  function Invoke-Testlauf($Treiber, [string] $Apotheke = 'nord', [string] $Flow = 'verkauf', $Auftrag = (New-Auftrag), [hashtable] $Mehr = @{}) {
    $f = Import-Flow -Apotheke $Apotheke -Flow $Flow -Wurzel $script:Flows
    Invoke-Flow -Flow $f -Treiber $Treiber -Auftrag $Auftrag -Optionen (Get-Optionen $Mehr)
  }
}

Describe 'Invoke-Flow mit dem Fake-Treiber' {
  It 'bucht in Nord einen Verkauf mit Rx, Bargeld und Kundenreferenz' {
    $t = New-FakeTreiber -Variante nord
    $bericht = Invoke-Testlauf $t
    $bericht.status | Should -Be 'ok'
    $bericht.werte.beleg | Should -Be '1001'
    $journal = $t.Simulation.Kasse.Journal
    $journal.Count | Should -Be 1
    $journal[0].SummeCent | Should -Be 2475
    $journal[0].RueckgeldCent | Should -Be 2525
    $journal[0].Referenz | Should -Be 'K7-QX4M'
    ($journal[0].Positionen | Where-Object Pzn -EQ '99104118').Rezept | Should -BeTrue
  }

  It 'bucht denselben Auftrag kein zweites Mal' {
    $t = New-FakeTreiber -Variante nord
    (Invoke-Testlauf $t).status | Should -Be 'ok'
    (Invoke-Testlauf $t).status | Should -Be 'bereits-gebucht'
    $t.Simulation.Kasse.Journal.Count | Should -Be 1
  }

  It 'bucht in Süd mit Bestätigung und Karte' {
    $t = New-FakeTreiber -Variante sued
    $bericht = Invoke-Testlauf $t -Apotheke sued -Auftrag (New-Auftrag -Zahlung karte)
    $bericht.status | Should -Be 'ok'
    $t.Simulation.Kasse.Journal[0].Zahlung | Should -Be 'karte'
    $t.Simulation.Kasse.Journal[0].SummeCent | Should -Be 2475
  }

  It 'bricht ab, wenn das Fenster der Kasse fehlt' {
    $t = New-FakeTreiber -Variante nord
    $bericht = Invoke-Testlauf $t -Apotheke sued
    $bericht.status | Should -Be 'abgebrochen'
    $bericht.fehler.meldung | Should -Match 'Fenster'
    $t.Klicks | Should -Be 0
  }

  It 'bricht ab und bucht nichts, wenn die Kasse einen Rx-Artikel ohne Rezept ablehnt' {
    $t = New-FakeTreiber -Variante nord
    $bericht = Invoke-Testlauf $t -Auftrag (New-Auftrag -Rezept $false)
    $bericht.status | Should -Be 'abgebrochen'
    $bericht.fehler.meldung | Should -Match 'Ohne Rezept nicht abgegeben'
    $t.Simulation.Kasse.Journal.Count | Should -Be 0
    Get-Content -LiteralPath $bericht.fehler.foto -Raw | Should -Match 'Ohne Rezept'
  }

  It 'lässt sich von einer alten Fehlermeldung beim Start nicht aufhalten' {
    $t = New-FakeTreiber -Variante nord
    $t.Simulation.Kasse.Status = 'Gegeben reicht nicht: fehlt 1,85 €'
    (Invoke-Testlauf $t).status | Should -Be 'ok'
  }

  It 'erkennt dieselbe Meldung wieder, wenn sie verschwunden war und neu erscheint' {
    # 24,75 € mit 10,00 € bezahlt: Es fehlen 14,75 €, genau wie in der alten Meldung.
    $t = New-FakeTreiber -Variante nord
    $t.Simulation.Kasse.Status = 'Gegeben reicht nicht: fehlt 14,75 €'
    $auftrag = New-Auftrag
    $auftrag.gegeben = '10,00'
    $bericht = Invoke-Testlauf $t -Auftrag $auftrag
    $bericht.status | Should -Be 'abgebrochen'
    $bericht.fehler.meldung | Should -Match 'fehlt 14,75'
    $t.Simulation.Kasse.Journal.Count | Should -Be 0
  }

  It 'meldet «unklar», wenn die Buchung nicht bestätigt wird; der nächste Lauf klärt es über die Referenz' {
    $t = New-FakeTreiber -Variante nord -Chaos @{ Langsam = 100 }
    $erst = Invoke-Testlauf $t
    $erst.status | Should -Be 'unklar'
    # Die Kasse bucht doch noch, nachdem der erste Lauf aufgegeben hat.
    1..101 | ForEach-Object { $null = $t.Bildschirm($null) }
    $t.Simulation.Kasse.Journal.Count | Should -Be 1
    (Invoke-Testlauf $t).status | Should -Be 'bereits-gebucht'
    $t.Simulation.Kasse.Journal.Count | Should -Be 1
  }

  It 'klickt einen buchenden Knopf nie zweimal, auch wenn der erste Klick danebengeht' {
    # Klicks: Bon leeren, Belegsuche, PZN, Menge, Kundenreferenz, Gegeben, Bar.
    $t = New-FakeTreiber -Variante nord -SprungVorKlick 7
    $auftrag = New-Auftrag
    $auftrag.positionen = @(@{ pzn = '99100008'; menge = 3 })
    $bericht = Invoke-Testlauf $t -Auftrag $auftrag
    $bericht.status | Should -Be 'unklar'
    ($bericht.schritte | Where-Object ziel -EQ 'Bar').versuche | Should -Be 1
    $t.Simulation.Kasse.Journal.Count | Should -Be 0
  }

  It 'sendet einen kritischen Schritt nie zweimal, auch wenn ein Flow ihn wiederholbar nennt' {
    # lint verbietet das; Invoke-Flow nimmt aber jedes Flow-Objekt an.
    # Mit «danach» scheitert der Klick selbst, wenn er danebengeht.
    $f = Import-Flow -Apotheke nord -Flow verkauf -Wurzel $script:Flows
    $bar = $f.Schritte | Where-Object { $_['klicke'] -eq 'Bar' }
    $bar['wiederholbar'] = $true
    $bar['danach'] = 'gebucht'
    $t = New-FakeTreiber -Variante nord -SprungVorKlick 7
    $auftrag = New-Auftrag
    $auftrag.positionen = @(@{ pzn = '99100008'; menge = 3 })
    $bericht = Invoke-Flow -Flow $f -Treiber $t -Auftrag $auftrag -Optionen (Get-Optionen)
    $bericht.status | Should -Be 'unklar'
    $t.Simulation.Kasse.Journal.Count | Should -Be 0
  }

  It 'wiederholt eine Eingabe, deren Klick danebengeht' {
    $t = New-FakeTreiber -Variante nord -SprungVorKlick 2
    $bericht = Invoke-Testlauf $t
    $bericht.status | Should -Be 'ok'
    ($bericht.schritte | Where-Object ziel -EQ 'Belegsuche').versuche | Should -Be 2
  }

  It 'schliesst einen bekannten Dialog und läuft weiter' {
    $t = New-FakeTreiber -Variante nord -Chaos @{ DialogNach = 2 }
    $bericht = Invoke-Testlauf $t
    $bericht.status | Should -Be 'ok'
    $bericht.dialoge[0].text | Should -Be 'Neue Preisliste verfügbar'
  }

  It 'wartet auf eine langsame Kasse' {
    $t = New-FakeTreiber -Variante nord -Chaos @{ Langsam = 5 }
    (Invoke-Testlauf $t).status | Should -Be 'ok'
  }

  It 'liest Eingaben trotz Schreibmarke im Feld (Befund des ersten Windows-Laufs)' {
    $t = New-FakeTreiber -Variante nord -Chaos @{ Schreibmarke = $true }
    $bericht = Invoke-Testlauf $t
    $bericht.status | Should -Be 'ok'
    ($bericht.schritte | Where-Object ziel -EQ 'Belegsuche').versuche | Should -Be 1
  }

  It 'nennt bei einer unsichtbaren Eingabe, was die OCR dort las, und hält den Bildschirm als Text fest' {
    $t = New-FakeTreiber -Variante nord -Chaos @{ Unlesbar = @('1') }
    $bericht = Invoke-Testlauf $t
    $bericht.status | Should -Be 'abgebrochen'
    $bericht.fehler.meldung | Should -Match "Eingabe nicht sichtbar: '1' bei Menge; gelesen: «Menge», «Hinzufügen»"
    # Der Bildschirm beim Abbruch: erste Position drin, zweite PZN getippt.
    $bericht.fehler.bildtext | Should -Match 'Hinzugefügt: 99100008'
    $bericht.fehler.bildtext | Should -Match '99104118'
    $t.Simulation.Kasse.Journal.Count | Should -Be 0
  }

  It 'versteht die Kasse auch, wenn die OCR Nullen als O liest' {
    $t = New-FakeTreiber -Variante nord -Chaos @{ Verlesen = $true }
    $bericht = Invoke-Testlauf $t
    $bericht.status | Should -Be 'ok'
    $bericht.werte.beleg | Should -Be '1001'
  }

  It 'bricht bei einem unbekannten Dialog ohne Heilung ab und hält den Bildschirm fest' {
    $t = New-FakeTreiber -Variante nord -Chaos @{ UnbekanntNach = 3 }
    $bericht = Invoke-Testlauf $t
    $bericht.status | Should -Be 'abgebrochen'
    Get-Content -LiteralPath $bericht.fehler.foto -Raw | Should -Match 'Bondrucker: Papier fast leer'
    $t.Simulation.Kasse.Journal.Count | Should -Be 0
  }

  It 'klickt nicht, wenn das Ziel an zwei Stellen steht' {
    $pfad = Join-Path $TestDrive 'flows/nord/probe.yaml'
    $null = New-Item -ItemType Directory -Force -Path (Split-Path $pfad)
    Set-Content -LiteralPath $pfad -Encoding utf8 -Value "flow: probe`napotheke: nord`nfenster: Kasse Nord`nschritte:`n  - klicke: Bon`n"
    $t = New-FakeTreiber -Variante nord
    $bericht = Invoke-Flow -Flow (Import-Flow -Pfad $pfad) -Treiber $t -Optionen (Get-Optionen)
    $bericht.status | Should -Be 'abgebrochen'
    $bericht.fehler.meldung | Should -Match 'mehrdeutig'
    $t.Klicks | Should -Be 0
  }

  It 'gibt im Trockenlauf nichts ein und meldet, welche Anker es sieht' {
    $t = New-FakeTreiber -Variante nord
    $bericht = Invoke-Testlauf $t -Mehr @{ DryRun = $true }
    $bericht.status | Should -Be 'trocken'
    $t.Klicks | Should -Be 0
    ($bericht.plan | Where-Object text -EQ 'Kundenreferenz').sichtbar | Should -BeTrue
    ($bericht.plan | Where-Object text -EQ 'Rezept liegt vor?').sichtbar | Should -BeFalse
  }

  It 'schreibt den Bericht als JSON und mit -Bildfolge ein Bild je Schritt' {
    $t = New-FakeTreiber -Variante nord
    $bericht = Invoke-Testlauf $t -Mehr @{ Bildfolge = $true }
    $ordner = Join-Path $TestDrive "laeufe/$($bericht.lauf)"
    $json = Get-Content -LiteralPath (Join-Path $ordner 'bericht.json') -Raw | ConvertFrom-Json
    $json.status | Should -Be 'ok'
    $json.kennung | Should -Be 'K7-QX4M'
    # Im Bericht stehen die eingesetzten Werte, nicht die Vorlage des Flows.
    ($json.schritte | Where-Object art -EQ 'beenden-wenn').ziel | Should -Be 'Referenz K7-QX4M: Beleg'
    @(Get-ChildItem -LiteralPath (Join-Path $ordner 'bilder')).Count | Should -BeGreaterThan 10
  }

  It 'schliesst den Tag ab und liest Belege und Summe' {
    $t = New-FakeTreiber -Variante nord
    (Invoke-Testlauf $t).status | Should -Be 'ok'
    $bericht = Invoke-Testlauf $t -Flow abschluss -Auftrag @{}
    $bericht.status | Should -Be 'ok'
    $bericht.werte.belege | Should -Be '1'
    $bericht.werte.summe | Should -Be '24,75'
    (Invoke-Testlauf $t -Flow abschluss -Auftrag @{}).status | Should -Be 'nichts-offen'
  }
}
