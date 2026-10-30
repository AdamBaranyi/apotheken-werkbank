# Selbstheilung mit dem echten Modell (Claude Haiku 5.5) gegen das echte
# Fenster der Kassen-Attrappe: Ein Dialog, den kein Flow kennt, blockiert den
# Verkauf. Läuft nur mit -NurModell auf Windows, mit ANTHROPIC_API_KEY; in der
# CI nur von Hand oder auf main (E5). Ein Lauf kostet weniger als 0,1 Rappen.

Describe 'Selbstheilung mit Claude Haiku 5.5' -Tag 'Modell' {
  BeforeAll {
    Import-Module (Join-Path $PSScriptRoot '../Werkbank.Engine.psd1') -Force
    $script:Wurzel = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
    $script:Ausgabe = if ($env:WERKBANK_AUSGABE) { $env:WERKBANK_AUSGABE } else { Join-Path $TestDrive 'ausgabe' }
    $null = New-Item -ItemType Directory -Force -Path $script:Ausgabe
  }

  It 'schliesst einen unbekannten Dialog und bucht danach' -Skip:(-not $IsWindows -or -not $env:ANTHROPIC_API_KEY) {
    $journal = Join-Path $script:Ausgabe 'journal-modell.json'
    $argumente = @('-NoProfile', '-File', (Join-Path $script:Wurzel 'attrappe/start.ps1'), '-Variante', 'nord', '-Journal', $journal, '-UnbekanntNach', '3')
    $prozess = Start-Process -FilePath pwsh -ArgumentList $argumente -PassThru
    try {
      $treiber = New-WindowsTreiber -Arbeitsordner (Join-Path ([IO.Path]::GetTempPath()) 'werkbank-ocr-modell') -Skalierung 3
      $bis = (Get-Date).AddSeconds(60)
      while ((Get-Date) -lt $bis -and -not ((Test-Path -LiteralPath $journal) -and $treiber.Fenster('Kasse Nord'))) { Start-Sleep -Milliseconds 300 }
      $heiler = New-Heiler -Art modell -Schluessel $env:ANTHROPIC_API_KEY
      $flow = Import-Flow -Apotheke nord -Flow verkauf -Wurzel (Join-Path $script:Wurzel 'flows')
      $auftrag = @{ kennung = 'Q7-WX3K'; zahlung = 'karte'; positionen = @(@{ pzn = '99102740'; menge = 1 }, @{ pzn = '99113703'; menge = 2 }) }
      $bericht = Invoke-Flow -Flow $flow -Treiber $treiber -Auftrag $auftrag -Optionen @{
        Ausgabe = (Join-Path $script:Ausgabe 'laeufe'); Bildfolge = $true; Heiler = $heiler; Zaehlerordner = $script:Ausgabe
      }
      foreach ($h in $bericht.heilungen) {
        Write-Host "  Vorschlag: $($h.aktion) '$($h.ziel)$($h.taste)', erlaubt $($h.erlaubt), $($h.ergebnis), $($h.kostenUsd) USD: $($h.begruendung)"
      }
      $bericht.status | Should -Be 'ok'
      $bericht.heilungen[0].ziel | Should -Be 'OK'
      $bericht.heilungen[0].ergebnis | Should -Be 'geholfen'
      ($bericht.heilungen | Measure-Object -Property kostenUsd -Sum).Sum | Should -BeLessThan 0.01
      @((Get-Content -LiteralPath $journal -Raw | ConvertFrom-Json).belege).Count | Should -Be 1
    }
    finally {
      if (-not $prozess.HasExited) { Stop-Process -Id $prozess.Id -Force }
    }
  }
}
