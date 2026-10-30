BeforeAll {
  Import-Module (Join-Path $PSScriptRoot '../Werkbank.Engine.psd1') -Force
  $script:Flow = Import-Flow -Apotheke nord -Flow verkauf -Wurzel (Join-Path $PSScriptRoot '../../flows')

  function New-Auftrag {
    @{ kennung = 'K7-QX4M'; positionen = @(@{ pzn = '99100008'; menge = 2 }); zahlung = 'karte' }
  }
}

Describe 'Test-Auftrag' {
  It 'ergänzt optionale Eingaben und Standardwerte' {
    $a = Test-Auftrag -Flow $script:Flow -Auftrag (New-Auftrag)
    $a.gegeben | Should -Be ''
    $a.positionen[0].rezept | Should -BeFalse
  }

  It 'verlangt jede Eingabe, die der Flow nennt' {
    $a = New-Auftrag
    $a.Remove('zahlung')
    { Test-Auftrag -Flow $script:Flow -Auftrag $a } | Should -Throw "*'zahlung'*"
  }

  It 'nimmt nur Kennungen ohne verwechselbare Zeichen' {
    $a = New-Auftrag
    $a.kennung = 'K0-QX4M'
    { Test-Auftrag -Flow $script:Flow -Auftrag $a } | Should -Throw '*Kennung*'
  }

  It 'lehnt dieselbe PZN zweimal ab' {
    $a = New-Auftrag
    $a.positionen = @(@{ pzn = '99100008'; menge = 1 }, @{ pzn = '99100008'; menge = 2 })
    { Test-Auftrag -Flow $script:Flow -Auftrag $a } | Should -Throw '*doppelt*'
  }

  It 'verlangt bei Bargeld einen Betrag' {
    $a = New-Auftrag
    $a.zahlung = 'bar'
    { Test-Auftrag -Flow $script:Flow -Auftrag $a } | Should -Throw '*gegeben*'
  }

  It 'lehnt eine Menge über 99 ab' {
    $a = New-Auftrag
    $a.positionen[0].menge = 100
    { Test-Auftrag -Flow $script:Flow -Auftrag $a } | Should -Throw '*Menge*'
  }

  It 'erzeugt Kennungen aus acht erlaubten Zeichen (Durchsicht 29.10.: Raum für Millionen Belege)' {
    1..50 | ForEach-Object { New-Kennung } | Should -Match '^[2-9ACDEFHJKMNPQRTVWXY]{2}-[2-9ACDEFHJKMNPQRTVWXY]{6}$'
  }

  It 'nimmt ältere Kennungen mit sechs Zeichen weiter an' {
    $a = New-Auftrag
    $a.kennung = 'K7-QX4M'
    (Test-Auftrag -Flow $script:Flow -Auftrag $a).kennung | Should -Be 'K7-QX4M'
    $a.kennung = 'K7-QX4MP9'
    (Test-Auftrag -Flow $script:Flow -Auftrag $a).kennung | Should -Be 'K7-QX4MP9'
  }
}
