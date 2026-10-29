# Echte Läufe: Windows-Treiber (Bildschirmfoto, OCR, SendInput) gegen das
# WinForms-Fenster der Kassen-Attrappe. Läuft nur mit -NurWindows auf einem
# Windows mit Bildschirm (CI: windows-2025). Was gebucht wurde, prüfen die Tests
# am Journal, das die Attrappe nach jeder Buchung schreibt, nicht an der OCR.

Describe 'Engine gegen die echte Kassen-Attrappe' -Tag 'Windows' {
  BeforeAll {
    Import-Module (Join-Path $PSScriptRoot '../Werkbank.Engine.psd1') -Force
    $script:Wurzel = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
    $script:Ausgabe = if ($env:WERKBANK_AUSGABE) { $env:WERKBANK_AUSGABE } else { Join-Path $TestDrive 'ausgabe' }
    $null = New-Item -ItemType Directory -Force -Path $script:Ausgabe
    $script:Treiber = New-WindowsTreiber -Arbeitsordner (Join-Path ([IO.Path]::GetTempPath()) 'werkbank-ocr') -Skalierung 3

    function Start-Attrappe([string] $Variante, [string[]] $Chaos = @()) {
      $journal = Join-Path $script:Ausgabe ('journal-{0}-{1}.json' -f $Variante, (Get-Random))
      $argumente = @('-NoProfile', '-File', (Join-Path $script:Wurzel 'attrappe/start.ps1'), '-Variante', $Variante, '-Journal', $journal) + $Chaos
      $prozess = Start-Process -FilePath pwsh -ArgumentList $argumente -PassThru
      $titel = if ($Variante -eq 'nord') { 'Kasse Nord' } else { 'Kassensystem Süd' }
      $bis = (Get-Date).AddSeconds(60)
      while ((Get-Date) -lt $bis -and -not ((Test-Path -LiteralPath $journal) -and $script:Treiber.Fenster($titel))) {
        Start-Sleep -Milliseconds 300
      }
      if (-not $script:Treiber.Fenster($titel)) { throw "Die Attrappe $Variante erschien nicht." }
      @{ Prozess = $prozess; Journal = $journal }
    }
    function Stop-Attrappe($Attrappe) {
      if ($Attrappe -and -not $Attrappe.Prozess.HasExited) { Stop-Process -Id $Attrappe.Prozess.Id -Force }
    }
    function Read-Journal($Attrappe) {
      Get-Content -LiteralPath $Attrappe.Journal -Raw -Encoding utf8 | ConvertFrom-Json
    }
    function Invoke-Echt([string] $Apotheke, [string] $Flow, [hashtable] $Auftrag) {
      $f = Import-Flow -Apotheke $Apotheke -Flow $Flow -Wurzel (Join-Path $script:Wurzel 'flows')
      $bericht = Invoke-Flow -Flow $f -Treiber $script:Treiber -Auftrag $Auftrag -Optionen @{
        Ausgabe = (Join-Path $script:Ausgabe 'laeufe'); Bildfolge = $true
      }
      Write-Host "  Lauf $($bericht.lauf): $($bericht.status), $($bericht.dauerMs) ms, OCR $($bericht.ocr)"
      if ($bericht.fehler) { Write-Host "  Fehler: $($bericht.fehler.meldung)" }
      $bericht
    }
    # 3 x 3,95 + 1 x 12,90 = 24,75 €.
    $script:Bar = @{
      kennung = 'K7-QX4M'; zahlung = 'bar'; gegeben = '50,00'
      positionen = @(@{ pzn = '99100008'; menge = 3 }, @{ pzn = '99104118'; menge = 1; rezept = $true })
    }
    # 1 x 5,49 + 2 x 4,49 = 14,47 €.
    $script:Karte = @{
      kennung = 'M4-TR7C'; zahlung = 'karte'
      positionen = @(@{ pzn = '99102740'; menge = 1 }, @{ pzn = '99113703'; menge = 2 })
    }
  }

  Context 'Apotheke Nord' {
    BeforeAll { $script:Nord = Start-Attrappe 'nord' }
    AfterAll { Stop-Attrappe $script:Nord }

    It 'bucht einen Verkauf mit Rx und Bargeld' {
      $bericht = Invoke-Echt 'nord' 'verkauf' $script:Bar
      $bericht.status | Should -Be 'ok'
      $bericht.werte.beleg | Should -Be '1001'
      $j = Read-Journal $script:Nord
      @($j.belege).Count | Should -Be 1
      $j.belege[0].SummeCent | Should -Be 2475
      $j.belege[0].Referenz | Should -Be 'K7-QX4M'
    }

    It 'bucht denselben Auftrag kein zweites Mal' {
      (Invoke-Echt 'nord' 'verkauf' $script:Bar).status | Should -Be 'bereits-gebucht'
      @((Read-Journal $script:Nord).belege).Count | Should -Be 1
    }

    It 'bucht mit Karte' {
      (Invoke-Echt 'nord' 'verkauf' $script:Karte).status | Should -Be 'ok'
      $j = Read-Journal $script:Nord
      @($j.belege).Count | Should -Be 2
      $j.belege[1].SummeCent | Should -Be 1447
      $j.belege[1].Zahlung | Should -Be 'karte'
    }

    It 'schliesst den Tag ab und liest Belege und Summe' {
      $bericht = Invoke-Echt 'nord' 'abschluss' @{}
      $bericht.status | Should -Be 'ok'
      $bericht.werte.belege | Should -Be '2'
      $bericht.werte.summe | Should -Be '39,22'
      (Read-Journal $script:Nord).abschluesse | Should -Be 1
    }
  }

  Context 'Apotheke Süd' {
    BeforeAll { $script:Sued = Start-Attrappe 'sued' }
    AfterAll { Stop-Attrappe $script:Sued }

    It 'bucht mit Bestätigung, bar und mit Karte' {
      (Invoke-Echt 'sued' 'verkauf' $script:Bar).status | Should -Be 'ok'
      (Invoke-Echt 'sued' 'verkauf' $script:Karte).status | Should -Be 'ok'
      $j = Read-Journal $script:Sued
      @($j.belege).Count | Should -Be 2
      $j.belege[0].SummeCent | Should -Be 2475
      $j.belege[1].SummeCent | Should -Be 1447
    }

    It 'führt den Kassenschnitt aus' {
      $bericht = Invoke-Echt 'sued' 'abschluss' @{}
      $bericht.status | Should -Be 'ok'
      $bericht.werte.summe | Should -Be '39,22'
    }
  }

  Context 'Chaos' {
    It 'übersteht Preisliste, langsame Kasse und ein wanderndes Fenster' {
      $a = Start-Attrappe 'nord' @('-DialogNach', '3', '-Langsam', '2500', '-WandernX', '12', '-WandernY', '8')
      try {
        $bericht = Invoke-Echt 'nord' 'verkauf' $script:Karte
        $bericht.status | Should -Be 'ok'
        @($bericht.dialoge).Count | Should -Be 1
        @((Read-Journal $a).belege).Count | Should -Be 1
      }
      finally { Stop-Attrappe $a }
    }

    It 'bricht bei einem unbekannten Dialog ab, bucht nichts und hält den Bildschirm fest' {
      $a = Start-Attrappe 'nord' @('-UnbekanntNach', '3')
      try {
        $bericht = Invoke-Echt 'nord' 'verkauf' $script:Karte
        $bericht.status | Should -Be 'abgebrochen'
        Test-Path -LiteralPath $bericht.fehler.foto | Should -BeTrue
        @((Read-Journal $a).belege).Count | Should -Be 0
      }
      finally { Stop-Attrappe $a }
    }
  }
}
