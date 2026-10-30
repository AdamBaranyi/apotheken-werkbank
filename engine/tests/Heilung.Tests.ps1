BeforeAll {
  Import-Module (Join-Path $PSScriptRoot '../Werkbank.Engine.psd1') -Force
  $script:Flows = Join-Path $PSScriptRoot '../../flows'

  function Get-Optionen($Heiler, [hashtable] $Mehr = @{}) {
    # Je Aufruf ein eigener Tageszähler; wer ihn teilen will, gibt ihn mit.
    $o = @{ Takt = 0.25; Schlafen = $false; Ausgabe = (Join-Path $TestDrive 'laeufe'); Heiler = $Heiler; Zaehlerordner = (Join-Path $TestDrive "zaehler-$([guid]::NewGuid())") }
    foreach ($k in $Mehr.Keys) { $o[$k] = $Mehr[$k] }
    $o
  }
  function New-Auftrag {
    @{ kennung = 'M4-TR7C'; zahlung = 'karte'; positionen = @(@{ pzn = '99102740'; menge = 1 }, @{ pzn = '99113703'; menge = 2 }) }
  }
  function Invoke-Testlauf($Treiber, $Heiler, [hashtable] $Mehr = @{}) {
    $f = Import-Flow -Apotheke nord -Flow verkauf -Wurzel $script:Flows
    Invoke-Flow -Flow $f -Treiber $Treiber -Auftrag (New-Auftrag) -Optionen (Get-Optionen $Heiler $Mehr)
  }
  function New-Vorschlag([string] $Aktion, [string] $Ziel = '', [string] $Taste = '') {
    @{ aktion = $Aktion; ziel = $Ziel; taste = $Taste; begruendung = 'Test' }
  }
}

Describe 'Selbstheilung im Lauf' {
  It 'schliesst einen unbekannten Dialog mit einem erlaubten Klick und bucht danach' {
    $t = New-FakeTreiber -Variante nord -Chaos @{ UnbekanntNach = 3 }
    $h = New-Heiler -Art attrappe -Vorschlaege @(New-Vorschlag klicke 'OK')
    $bericht = Invoke-Testlauf $t $h
    $bericht.status | Should -Be 'ok'
    $t.Simulation.Kasse.Journal.Count | Should -Be 1
    $bericht.heilungen[0].ausgefuehrt | Should -BeTrue
    $bericht.heilungen[0].ergebnis | Should -Be 'geholfen'
    $h.Anfragen[0].Bildtext | Should -Match 'Bondrucker: Papier fast leer'
    $h.Anfragen[0].Klickbar | Should -Contain 'OK'
  }

  It 'prüft und klickt nach der Antwort des Modells auf einem frischen Bild (Durchsicht 29.10.)' {
    $t = New-FakeTreiber -Variante nord -Chaos @{ UnbekanntNach = 3 }
    $h = New-Heiler -Art attrappe -Vorschlaege @(New-Vorschlag klicke 'OK')
    $sim = $t.Simulation
    $h | Add-Member -Force -MemberType ScriptMethod -Name Vorschlag -Value ({
        param($Anfrage)
        $this.Anfragen.Add($Anfrage)
        # Während das Modell antwortet, verschiebt jemand das Kassenfenster.
        $sim.Ursprung.X += 40
        $sim.Ursprung.Y += 30
        @{ aktion = 'klicke'; ziel = 'OK'; taste = ''; begruendung = 'Test' }
      }.GetNewClosure())
    $bericht = Invoke-Testlauf $t $h
    $bericht.heilungen[0].ergebnis | Should -Be 'geholfen'
    $bericht.status | Should -Be 'ok'
  }

  It 'führt einen Vorschlag ausserhalb der erlaubten Liste nie aus' {
    $t = New-FakeTreiber -Variante nord -Chaos @{ UnbekanntNach = 3 }
    $h = New-Heiler -Art attrappe -Vorschlaege @(New-Vorschlag klicke 'Karte')
    $bericht = Invoke-Testlauf $t $h
    $bericht.status | Should -Be 'abgebrochen'
    $bericht.heilungen[0].erlaubt | Should -BeFalse
    $bericht.heilungen[0].grund | Should -Match 'nicht erlaubt'
    $t.Simulation.Kasse.Journal.Count | Should -Be 0
  }

  It 'klickt kein erlaubtes Ziel, das nicht auf dem Bildschirm steht' {
    $t = New-FakeTreiber -Variante nord -Chaos @{ UnbekanntNach = 3 }
    $h = New-Heiler -Art attrappe -Vorschlaege @(New-Vorschlag klicke 'Schliessen')
    $bericht = Invoke-Testlauf $t $h
    $bericht.status | Should -Be 'abgebrochen'
    $bericht.heilungen[0].grund | Should -Match 'nicht sichtbar'
  }

  It 'fragt höchstens dreimal je Lauf' {
    $t = New-FakeTreiber -Variante nord -Chaos @{ UnbekanntNach = 3 }
    $h = New-Heiler -Art attrappe -Vorschlaege @(New-Vorschlag warten)
    $bericht = Invoke-Testlauf $t $h
    $bericht.status | Should -Be 'abgebrochen'
    $h.Anfragen.Count | Should -Be 3
    @($bericht.heilungen).Count | Should -Be 3
  }

  It 'hält den Tagesdeckel ein, auch über Läufe hinweg' {
    $t = New-FakeTreiber -Variante nord -Chaos @{ UnbekanntNach = 3 }
    $h = New-Heiler -Art attrappe -Vorschlaege @(New-Vorschlag warten)
    $gemeinsam = @{ HeilungenJeTag = 4; Zaehlerordner = (Join-Path $TestDrive 'zaehler-tag') }
    $erst = Invoke-Testlauf $t $h -Mehr $gemeinsam
    @($erst.heilungen).Count | Should -Be 3
    $t2 = New-FakeTreiber -Variante nord -Chaos @{ UnbekanntNach = 3 }
    $zweit = Invoke-Testlauf $t2 $h -Mehr $gemeinsam
    $h.Anfragen.Count | Should -Be 4
    $zweit.heilungen[-1].grund | Should -Match 'Tagesdeckel'
  }

  It 'bricht ab, wenn das Modell abbrechen vorschlägt' {
    $t = New-FakeTreiber -Variante nord -Chaos @{ UnbekanntNach = 3 }
    $h = New-Heiler -Art attrappe -Vorschlaege @(New-Vorschlag abbrechen)
    $bericht = Invoke-Testlauf $t $h
    $bericht.status | Should -Be 'abgebrochen'
    $h.Anfragen.Count | Should -Be 1
  }
}

Describe 'Vorschlag des Modells' {
  BeforeAll {
    # Kleinstes gültiges PNG (1 x 1 Pixel), damit ein Bild mitgeht.
    $script:Png = Join-Path $TestDrive 'bild.png'
    [IO.File]::WriteAllBytes($script:Png, [Convert]::FromBase64String('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGD4DwABBAEAwS2OUAAAAABJRU5ErkJggg=='))
    $script:Anfrage = @{
      Flow = 'nord/verkauf'; Schritt = 'eingeben neben PZN'; Meldung = 'Eingabe nicht sichtbar'
      Bildtext = "Bondrucker: Papier fast leer`nOK"; Png = $script:Png; Klickbar = @('OK', 'Später')
    }
    function New-Antwort([string] $Json, [string] $Stopp = 'end_turn') {
      [pscustomobject]@{
        stop_reason = $Stopp
        content     = @([pscustomobject]@{ type = 'text'; text = $Json })
        usage       = [pscustomobject]@{ input_tokens = 1000; output_tokens = 100 }
      }
    }
    function New-HttpFehler([int] $Status) {
      [Microsoft.PowerShell.Commands.HttpResponseException]::new("HTTP $Status", [System.Net.Http.HttpResponseMessage]::new($Status))
    }
  }

  It 'schickt Bild, Kontext und Schema an Haiku 5.5 und liest genau eine Aktion' {
    Mock -ModuleName Werkbank.Engine Invoke-RestMethod { New-Antwort '{"aktion":"klicke","ziel":"OK","taste":"","begruendung":"Dialog schliessen"}' }
    $h = New-Heiler -Art modell -Schluessel 'sk-test-geheim'
    $v = $h.Vorschlag($script:Anfrage)
    $v.aktion | Should -Be 'klicke'
    $v.ziel | Should -Be 'OK'
    $v.kostenUsd | Should -Be 0.00015
    Should -Invoke -ModuleName Werkbank.Engine Invoke-RestMethod -Times 1 -Exactly -ParameterFilter {
      $k = [Text.Encoding]::UTF8.GetString($Body) | ConvertFrom-Json -AsHashtable
      $Uri -eq 'https://api.anthropic.com/v1/messages' -and
      $Headers['anthropic-version'] -eq '2026-10-21' -and $Headers['x-api-key'] -eq 'sk-test-geheim' -and
      $k.model -eq 'claude-haiku-5-5' -and -not $k.ContainsKey('temperature') -and
      $k.output_config.format.type -eq 'json_schema' -and
      (@($k.output_config.format.schema.properties.ziel.enum) -join '|') -eq 'OK|Später|' -and
      $k.messages[0].content[0].type -eq 'image' -and $k.messages[0].content[0].source.media_type -eq 'image/png'
    }
  }

  It 'versucht es bei 529 noch einmal und gibt bei 401 sofort auf, ohne den Schlüssel zu nennen' {
    Mock -ModuleName Werkbank.Engine Start-Sleep {}
    $script:Aufrufe = 0
    Mock -ModuleName Werkbank.Engine Invoke-RestMethod {
      $script:Aufrufe++
      if ($script:Aufrufe -eq 1) { throw (New-HttpFehler 529) }
      New-Antwort '{"aktion":"warten","ziel":"","taste":"","begruendung":"Kasse rechnet"}'
    }
    (New-Heiler -Art modell -Schluessel 'sk-test-geheim').Vorschlag($script:Anfrage).aktion | Should -Be 'warten'
    $script:Aufrufe | Should -Be 2

    $script:Aufrufe = 0
    Mock -ModuleName Werkbank.Engine Invoke-RestMethod { $script:Aufrufe++; throw (New-HttpFehler 401) }
    $fehler = { (New-Heiler -Art modell -Schluessel 'sk-test-geheim').Vorschlag($script:Anfrage) } | Should -Throw -PassThru
    $fehler.Exception.Message | Should -Match '401'
    $fehler.Exception.Message | Should -Not -Match 'sk-test-geheim'
    $script:Aufrufe | Should -Be 1
  }

  It 'nimmt eine Ablehnung des Modells als «abbrechen»' {
    Mock -ModuleName Werkbank.Engine Invoke-RestMethod { New-Antwort '' 'refusal' }
    (New-Heiler -Art modell -Schluessel 'sk-test').Vorschlag($script:Anfrage).aktion | Should -Be 'abbrechen'
  }
}

Describe 'Tageszähler der Selbstheilung (Durchsicht 29.10.)' {
  It 'liegt ohne Angabe bei den Daten des Benutzers, nicht im Ausgabeordner eines Laufs' {
    InModuleScope Werkbank.Engine {
      $pfad = Get-Tageszaehlerpfad @{ Optionen = @{ Ausgabe = (Join-Path $TestDrive 'lauf-1') } }
      $pfad | Should -BeLike ((Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'werkbank') + '*')
    }
  }

  It 'zählt unter Sperre: Wer die Datei hält, lässt den nächsten warten, und der Deckel hält' {
    InModuleScope Werkbank.Engine -Parameters @{ Ordner = (Join-Path $TestDrive 'sperre') } {
      param($Ordner)
      $null = New-Item -ItemType Directory -Force -Path $Ordner
      $pfad = Join-Path $Ordner 'heilung.json'
      (Step-Tageszaehler -Pfad $pfad -Deckel 3).Anzahl | Should -Be 1
      # Ein zweiter Zugriff hält die Datei offen, ohne selbst zu sperren: Der
      # Zähler darf dann nicht schreiben, er braucht die Datei für sich allein.
      $halten = [IO.File]::Open($pfad, 'Open', 'ReadWrite', 'ReadWrite')
      try { { Step-Tageszaehler -Pfad $pfad -Deckel 3 -Versuche 2 } | Should -Throw '*gesperrt*' }
      finally { $halten.Dispose() }
      (Step-Tageszaehler -Pfad $pfad -Deckel 3).Anzahl | Should -Be 2
      (Step-Tageszaehler -Pfad $pfad -Deckel 3).Ok | Should -BeTrue
      (Step-Tageszaehler -Pfad $pfad -Deckel 3).Ok | Should -BeFalse
    }
  }
}
