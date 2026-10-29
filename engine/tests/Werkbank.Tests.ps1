BeforeAll {
  $script:Cli = Join-Path $PSScriptRoot '../werkbank.ps1'
  $script:Beispiel = Join-Path $PSScriptRoot '../../flows/beispiele/verkauf-bar.json'

  function Invoke-Werkbank([string[]] $Argumente) {
    $ausgabe = & pwsh -NoProfile -File $script:Cli @Argumente 2>&1
    @{ Code = $LASTEXITCODE; Text = ($ausgabe | Out-String) }
  }
}

Describe 'werkbank.ps1' {
  It 'lint prüft alle Flows und endet mit 0' {
    $r = Invoke-Werkbank @('lint')
    $r.Code | Should -Be 0
    $r.Text | Should -Match '4 Flows geprüft, keine Befunde'
  }

  It 'lint meldet Befunde mit Datei und endet mit 1' {
    $pfad = Join-Path $TestDrive 'flows/test/probe.yaml'
    $null = New-Item -ItemType Directory -Force -Path (Split-Path $pfad)
    Set-Content -LiteralPath $pfad -Encoding utf8 -Value "flow: probe`napotheke: test`nfenster: Kasse`nschritte:`n  - klicke: Bar`n    kritisch: true`n    wiederholbar: true`n"
    $r = Invoke-Werkbank @('lint', '-Pfad', (Split-Path (Split-Path $pfad)))
    $r.Code | Should -Be 1
    $r.Text | Should -Match 'probe.yaml: Schritt 1: kritisch und wiederholbar'
  }

  It 'run bucht mit dem Fake-Treiber und nennt Status und Beleg' {
    $r = Invoke-Werkbank @('run', '-Apotheke', 'nord', '-Flow', 'verkauf', '-Auftrag', $script:Beispiel, '-Treiber', 'fake', '-Ausgabe', (Join-Path $TestDrive 'laeufe'))
    $r.Code | Should -Be 0
    $r.Text | Should -Match 'Status: ok'
    $r.Text | Should -Match 'beleg = 1001'
  }

  It 'run -DryRun gibt nichts ein und zählt die sichtbaren Anker' {
    $r = Invoke-Werkbank @('run', '-Apotheke', 'nord', '-Flow', 'verkauf', '-Auftrag', $script:Beispiel, '-Treiber', 'fake', '-DryRun')
    $r.Code | Should -Be 0
    $r.Text | Should -Match 'Status: trocken'
    $r.Text | Should -Match 'Anker sichtbar: \d+ von \d+'
  }

  It 'run meldet einen ungültigen Auftrag verständlich und endet mit 1' {
    $auftrag = Join-Path $TestDrive 'kaputt.json'
    Set-Content -LiteralPath $auftrag -Encoding utf8 -Value '{ "kennung": "K0-QX4M", "positionen": [], "zahlung": "bar" }'
    $r = Invoke-Werkbank @('run', '-Apotheke', 'nord', '-Flow', 'verkauf', '-Auftrag', $auftrag, '-Treiber', 'fake')
    $r.Code | Should -Be 1
    $r.Text | Should -Match 'Kennung ungültig'
    $r.Text | Should -Not -Match 'bei <ScriptBlock>|at <ScriptBlock>'
  }

  It 'run -Melden nennt fehlende Zugangsdaten, bevor es die Kasse anfasst' {
    $alt = $env:WERKBANK_MONITOR_URL
    try {
      $env:WERKBANK_MONITOR_URL = $null
      $r = Invoke-Werkbank @('run', '-Apotheke', 'nord', '-Flow', 'verkauf', '-Auftrag', $script:Beispiel, '-Treiber', 'fake', '-Melden')
      $r.Code | Should -Be 1
      $r.Text | Should -Match 'Für -Melden fehlen: WERKBANK_MONITOR_URL'
      $r.Text | Should -Not -Match 'Status:'
    }
    finally { $env:WERKBANK_MONITOR_URL = $alt }
  }

  It 'run -Heilung modell verlangt den Schlüssel des Modells' {
    $alt = $env:ANTHROPIC_API_KEY
    try {
      $env:ANTHROPIC_API_KEY = $null
      $r = Invoke-Werkbank @('run', '-Apotheke', 'nord', '-Flow', 'verkauf', '-Auftrag', $script:Beispiel, '-Treiber', 'fake', '-Heilung', 'modell')
      $r.Code | Should -Be 1
      $r.Text | Should -Match 'ANTHROPIC_API_KEY'
    }
    finally { $env:ANTHROPIC_API_KEY = $alt }
  }

  It 'kennung liefert eine neue Kennung' {
    $r = Invoke-Werkbank @('kennung')
    $r.Code | Should -Be 0
    $r.Text.Trim() | Should -Match '^[2-9ACDEFHJKMNPQRTVWXY]{2}-[2-9ACDEFHJKMNPQRTVWXY]{4}$'
  }
}
