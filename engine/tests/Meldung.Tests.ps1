BeforeAll {
  Import-Module (Join-Path $PSScriptRoot '../Werkbank.Engine.psd1') -Force

  $script:Ziel = @{ Url = 'http://127.0.0.1:54401'; Schluessel = 'sb_publishable_test'; Email = 'engine.nord@werkbank.test'; Passwort = 'Geheim123geheim' }
  $script:Bericht = [pscustomobject]@{
    lauf = 'L-20261029-201500-K7QX'; flow = 'verkauf'; apotheke = 'nord'; kennung = 'K7-QX4M'; treiber = 'fake'
    status = 'ok'; beginn = '2026-10-29T20:15:00.0000000+01:00'; dauerMs = 4200
    heilungen = @([pscustomobject]@{ aktion = 'klicke'; ziel = 'OK' }); schritte = @(); werte = @{ beleg = '1001' }
  }
  function New-HttpFehler([int] $Status) {
    [Microsoft.PowerShell.Commands.HttpResponseException]::new("HTTP $Status", [System.Net.Http.HttpResponseMessage]::new($Status))
  }
  function Get-Koerper($Body) {
    $text = if ($Body -is [byte[]]) { [Text.Encoding]::UTF8.GetString($Body) } else { [string]$Body }
    $text | ConvertFrom-Json -AsHashtable
  }
}

Describe 'Send-Laufbericht' {
  BeforeEach {
    $script:Aufrufe = [System.Collections.Generic.List[hashtable]]::new()
    Mock -ModuleName Werkbank.Engine Invoke-RestMethod {
      $script:Aufrufe.Add(@{ Uri = $Uri; Headers = $Headers; Body = (Get-Koerper $Body) })
      if ($Uri -like '*/auth/v1/token*') { return [pscustomobject]@{ access_token = 'token-abc' } }
    }
  }

  It 'meldet sich mit dem Engine-Konto an und schickt den Lauf ohne Apotheke' {
    $r = Send-Laufbericht -Bericht $script:Bericht -Ziel $script:Ziel
    $r.Ok | Should -BeTrue
    $script:Aufrufe[0].Uri | Should -Be 'http://127.0.0.1:54401/auth/v1/token?grant_type=password'
    $script:Aufrufe[0].Headers.apikey | Should -Be 'sb_publishable_test'
    $script:Aufrufe[0].Body.email | Should -Be 'engine.nord@werkbank.test'
    $lauf = $script:Aufrufe[1]
    $lauf.Uri | Should -Be 'http://127.0.0.1:54401/rest/v1/engine_laeufe'
    $lauf.Headers.Authorization | Should -Be 'Bearer token-abc'
    $lauf.Headers.Prefer | Should -Be 'return=minimal'
    $lauf.Body.lauf | Should -Be 'L-20261029-201500-K7QX'
    $lauf.Body.kasse | Should -Be 'nord'
    $lauf.Body.dauer_ms | Should -Be 4200
    $lauf.Body.heilungen | Should -Be 1
    $lauf.Body.bericht.werte.beleg | Should -Be '1001'
    $lauf.Body.ContainsKey('apotheke_id') | Should -BeFalse
    $lauf.Body.id | Should -Be $r.Id
  }

  It 'schickt das Bildschirmfoto als bytea zu derselben Lauf-ID' {
    $foto = Join-Path $TestDrive 'fehler.txt'
    Set-Content -LiteralPath $foto -Value 'Bondrucker' -NoNewline -Encoding utf8
    $r = Send-Laufbericht -Bericht $script:Bericht -Ziel $script:Ziel -Foto $foto
    $f = $script:Aufrufe[2]
    $f.Uri | Should -Be 'http://127.0.0.1:54401/rest/v1/engine_fotos'
    $f.Body.lauf_id | Should -Be $r.Id
    $f.Body.art | Should -Be 'text'
    # «Bondrucker» in UTF-8 als Hex, mit dem Präfix für bytea.
    $f.Body.inhalt | Should -Be '\x426F6E647275636B6572'
  }

  It 'nimmt einen schon gemeldeten Lauf als erledigt' {
    Mock -ModuleName Werkbank.Engine Invoke-RestMethod {
      if ($Uri -like '*/auth/v1/token*') { return [pscustomobject]@{ access_token = 'token-abc' } }
      throw (New-HttpFehler 409)
    }
    $r = Send-Laufbericht -Bericht $script:Bericht -Ziel $script:Ziel
    $r.Ok | Should -BeTrue
    $r.Meldung | Should -Match 'schon gemeldet'
  }

  It 'meldet eine gescheiterte Anmeldung ohne das Passwort zu nennen' {
    Mock -ModuleName Werkbank.Engine Invoke-RestMethod { throw (New-HttpFehler 400) }
    $r = Send-Laufbericht -Bericht $script:Bericht -Ziel $script:Ziel
    $r.Ok | Should -BeFalse
    $r.Meldung | Should -Match 'Anmeldung'
    $r.Meldung | Should -Not -Match 'Geheim123geheim'
  }
}
