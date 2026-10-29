BeforeAll {
  Import-Module (Join-Path $PSScriptRoot '../../../engine/Werkbank.Engine.psd1') -Force
  . (Join-Path $PSScriptRoot '../Rezept.ps1')
  $script:Daten = Join-Path $PSScriptRoot '../daten/rezepte'
  $script:Heute = [datetime]'2026-10-29'

  function Get-Rezept([string] $Datei) {
    Get-Content -LiteralPath (Join-Path $script:Daten $Datei) -Raw | ConvertFrom-Json -AsHashtable
  }
}

Describe 'Test-Rezept' {
  It 'nimmt einen vollständigen, gültigen Datensatz an' {
    Test-Rezept -Rezept (Get-Rezept 'tm-102.json') -Heute $script:Heute | Should -BeNullOrEmpty
  }

  It 'lehnt ein abgelaufenes Rezept ab' {
    Test-Rezept -Rezept (Get-Rezept 'tm-104-abgelaufen.json') -Heute $script:Heute | Should -Be 'Rezept abgelaufen am 20.10.2026'
  }

  It 'lehnt eine PZN mit falscher Prüfziffer vor der Kasse ab' {
    Test-Rezept -Rezept (Get-Rezept 'tm-106-pruefziffer.json') -Heute $script:Heute | Should -Be 'PZN 99104119: Prüfziffer falsch'
  }

  It 'lehnt einen Datensatz ohne Positionen ab' {
    Test-Rezept -Rezept (Get-Rezept 'tm-109-unvollstaendig.json') -Heute $script:Heute | Should -Contain 'Positionen fehlen'
  }

  It 'lehnt eine Menge über 20 ab' {
    $r = Get-Rezept 'tm-101.json'
    $r.positionen[0].menge = 21
    Test-Rezept -Rezept $r -Heute $script:Heute | Should -Be 'PZN 99104118: Menge 21 liegt nicht zwischen 1 und 20'
  }
}

Describe 'Kennung und Auftrag' {
  It 'leitet aus derselben Rezept-ID immer dieselbe Kennung ab, im Alphabet der Engine' {
    $a = Get-RezeptKennung 'TM-2026-000101'
    $a | Should -Be (Get-RezeptKennung 'TM-2026-000101')
    $a | Should -Match '^[2-9ACDEFHJKMNPQRTVWXY]{2}-[2-9ACDEFHJKMNPQRTVWXY]{4}$'
    $a | Should -Not -Be (Get-RezeptKennung 'TM-2026-000102')
  }

  It 'macht aus dem Rezept einen Auftrag mit Rezept-Häkchen auf jeder Position' {
    $auftrag = ConvertTo-Auftrag -Rezept (Get-Rezept 'tm-102.json')
    $auftrag.kennung | Should -Be (Get-RezeptKennung 'TM-2026-000102')
    $auftrag.zahlung | Should -Be 'karte'
    @($auftrag.positionen).Count | Should -Be 2
    $auftrag.positionen | ForEach-Object { $_.rezept | Should -BeTrue }
  }
}

Describe 'Stapel aus der Telemedizin-Attrappe' {
  It 'bucht die gültigen, erkennt das doppelte und lässt die übrigen für einen Menschen liegen' {
    $treiber = New-FakeTreiber -Variante nord
    $optionen = @{ Takt = 0.25; Schlafen = $false; Ausgabe = (Join-Path $TestDrive 'laeufe') }
    $ergebnis = @(Invoke-RezeptStapel -Ordner $script:Daten -Heute $script:Heute -Treiber $treiber -Optionen $optionen)
    $ergebnis.Count | Should -Be 10
    @($ergebnis | Where-Object Ergebnis -EQ 'gebucht').Count | Should -Be 5
    ($ergebnis | Where-Object Datei -EQ 'tm-107-doppelt.json').Ergebnis | Should -Be 'schon gebucht'
    @($ergebnis | Where-Object Ergebnis -EQ 'abgelehnt').Datei | Should -Be @('tm-104-abgelaufen.json', 'tm-106-pruefziffer.json', 'tm-109-unvollstaendig.json')
    ($ergebnis | Where-Object Datei -EQ 'tm-105-unbekannt.json').Ergebnis | Should -Be 'abgebrochen'
    $journal = $treiber.Simulation.Kasse.Journal
    $journal.Count | Should -Be 5
    $journal[0].Referenz | Should -Be (Get-RezeptKennung 'TM-2026-000101')
    # Jede rezeptpflichtige Position ist mit «Rezept liegt vor» gebucht.
    $rx = @('99104118', '99106850', '99108228', '99109593', '99110969')
    $positionen = @($journal | ForEach-Object { $_.Positionen })
    @($positionen | Where-Object { $_.Pzn -in $rx }).Count | Should -Be 5
    @($positionen | Where-Object { $_.Pzn -in $rx -and -not $_.Rezept }).Count | Should -Be 0
  }
}
