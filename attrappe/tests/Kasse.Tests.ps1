BeforeAll {
  Import-Module (Join-Path $PSScriptRoot '../Kassen.Attrappe.psd1') -Force
}

Describe 'Kassenlogik der Attrappe' {
  BeforeEach {
    $kasse = New-KassenZustand
  }

  It 'weist eine PZN mit falscher Prüfziffer ab' {
    $r = Add-KassenPosition -Kasse $kasse -Pzn '99100009' -Menge ''
    $r.Ok | Should -BeFalse
    $kasse.Status | Should -Be 'PZN ungültig: 99100009'
    $kasse.Bon.Count | Should -Be 0
  }

  It 'meldet eine gültige, aber unbekannte PZN' {
    Add-KassenPosition -Kasse $kasse -Pzn '12345678' -Menge '' | Out-Null
    $kasse.Status | Should -Be 'Artikel unbekannt: 12345678'
  }

  It 'nimmt ohne Menge eine Packung und fasst dieselbe PZN zusammen' {
    Add-KassenPosition -Kasse $kasse -Pzn '99100008' -Menge '' | Out-Null
    Add-KassenPosition -Kasse $kasse -Pzn ' 99100008 ' -Menge '4' | Out-Null
    $kasse.Bon.Count | Should -Be 1
    $kasse.Bon[0].Menge | Should -Be 5
    (Get-KassenAnzeige -Kasse $kasse).Summe | Should -Be 'Summe 19,75 €'
    (Get-KassenAnzeige -Kasse $kasse).Positionen | Should -Be 'Positionen 1'
  }

  It 'weist eine Menge ausserhalb von 1 bis 99 ab' {
    (Add-KassenPosition -Kasse $kasse -Pzn '99100008' -Menge '0').Ok | Should -BeFalse
    (Add-KassenPosition -Kasse $kasse -Pzn '99100008' -Menge 'drei').Ok | Should -BeFalse
    $kasse.Status | Should -Be 'Menge ungültig: drei'
    $kasse.Bon.Count | Should -Be 0
  }

  It 'fragt bei einem Rx-Artikel nach dem Rezept, bevor er auf den Bon kommt' {
    $r = Add-KassenPosition -Kasse $kasse -Pzn '99104118' -Menge '2'
    $r.Rueckfrage | Should -Be 'Rezept liegt vor?'
    $kasse.Bon.Count | Should -Be 0
    Resolve-KassenRueckfrage -Kasse $kasse -Ja | Out-Null
    $kasse.Bon[0].Pzn | Should -Be '99104118'
    $kasse.Bon[0].Menge | Should -Be 2
    $kasse.Bon[0].Rezept | Should -BeTrue
  }

  It 'lässt einen Rx-Artikel ohne Rezept weg' {
    Add-KassenPosition -Kasse $kasse -Pzn '99104118' -Menge '' | Out-Null
    Resolve-KassenRueckfrage -Kasse $kasse | Out-Null
    $kasse.Bon.Count | Should -Be 0
    $kasse.Status | Should -Be 'Ohne Rezept nicht abgegeben: 99104118'
  }

  It 'bucht bar mit Rückgeld, leert den Bon und zählt die Belegnummer hoch' {
    Add-KassenPosition -Kasse $kasse -Pzn '99100008' -Menge '3' | Out-Null
    $beleg = Invoke-KassenZahlung -Kasse $kasse -Art bar -Gegeben '20' -Referenz 'K7-QX4M'
    $beleg.Nummer | Should -Be 1001
    $beleg.SummeCent | Should -Be 1185
    $beleg.RueckgeldCent | Should -Be 815
    $kasse.Status | Should -Be 'Beleg 1001 gebucht, Rückgeld 8,15 €'
    $kasse.Bon.Count | Should -Be 0
    Add-KassenPosition -Kasse $kasse -Pzn '99102740' -Menge '' | Out-Null
    (Invoke-KassenZahlung -Kasse $kasse -Art karte -Gegeben '' -Referenz '').Nummer | Should -Be 1002
    $kasse.Status | Should -Be 'Beleg 1002 gebucht, Kartenzahlung'
    $kasse.Journal.Count | Should -Be 2
  }

  It 'bucht nicht, wenn das Bargeld nicht reicht' {
    Add-KassenPosition -Kasse $kasse -Pzn '99100008' -Menge '3' | Out-Null
    Invoke-KassenZahlung -Kasse $kasse -Art bar -Gegeben '10,00' -Referenz '' | Should -BeNullOrEmpty
    $kasse.Status | Should -Be 'Gegeben reicht nicht: fehlt 1,85 €'
    $kasse.Journal.Count | Should -Be 0
    $kasse.Bon.Count | Should -Be 1
  }

  It 'bucht keinen leeren Bon' {
    Invoke-KassenZahlung -Kasse $kasse -Art karte -Gegeben '' -Referenz '' | Should -BeNullOrEmpty
    $kasse.Status | Should -Be 'Bon ist leer'
    $kasse.Journal.Count | Should -Be 0
  }

  It 'findet einen Beleg nur über die ganze Referenz' {
    Add-KassenPosition -Kasse $kasse -Pzn '99100008' -Menge '' | Out-Null
    Invoke-KassenZahlung -Kasse $kasse -Art karte -Gegeben '' -Referenz 'K7-QX4M' | Out-Null
    Find-KassenBeleg -Kasse $kasse -Referenz 'K7-QX4M' | Out-Null
    $kasse.Treffer | Should -Be 'Referenz K7-QX4M: Beleg 1001'
    Find-KassenBeleg -Kasse $kasse -Referenz 'K7-QX4' | Out-Null
    $kasse.Treffer | Should -Be 'Referenz K7-QX4: unbekannt'
  }

  It 'schliesst den Tag mit Summe ab und danach ist nichts mehr offen' {
    Add-KassenPosition -Kasse $kasse -Pzn '99100008' -Menge '3' | Out-Null
    Invoke-KassenZahlung -Kasse $kasse -Art bar -Gegeben '20' -Referenz '' | Out-Null
    Add-KassenPosition -Kasse $kasse -Pzn '99102740' -Menge '' | Out-Null
    Invoke-KassenZahlung -Kasse $kasse -Art karte -Gegeben '' -Referenz '' | Out-Null
    Close-KassenTag -Kasse $kasse | Out-Null
    $kasse.Status | Should -Be 'Abschluss 1: 2 Belege, 17,34 €'
    Close-KassenTag -Kasse $kasse | Out-Null
    $kasse.Status | Should -Be 'Abschluss: keine offenen Belege'
  }
}
