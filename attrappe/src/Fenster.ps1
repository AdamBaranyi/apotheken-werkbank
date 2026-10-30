# Die Kassen-Attrappe als echtes WinForms-Fenster (nur Windows). Aufbau aus
# dem Layout, Verhalten wie die Simulation: Das erste Feld hat den Fokus,
# Escape leert ein Feld, Enter löst die Aktion des Feldes aus, Dialoge sind
# modal, eine langsame Buchung sperrt das Fenster. Nach jeder Buchung und
# jedem Abschluss schreibt das Fenster das Journal als JSON; daran prüfen die
# Tests, was wirklich gebucht wurde.

$script:Kf = $null

function Show-KassenAttrappe {
  [CmdletBinding()]
  param(
    [ValidateSet('nord', 'sued')] [string] $Variante = 'nord',
    [string] $Journal = '',
    [hashtable] $Chaos = @{},
    [int[]] $Ursprung = @(40, 40)
  )
  if (-not $IsWindows) { throw 'Das Fenster der Kassen-Attrappe gibt es nur unter Windows.' }
  Add-Type -AssemblyName System.Windows.Forms, System.Drawing
  $null = [System.Windows.Forms.Application]::SetHighDpiMode([System.Windows.Forms.HighDpiMode]::PerMonitorV2)
  [System.Windows.Forms.Application]::EnableVisualStyles()
  $layout = Import-KassenLayout -Variante $Variante
  $script:Kf = @{
    Layout   = $layout
    Kasse    = New-KassenZustand -Texte $layout['Texte']
    Felder   = [ordered]@{}
    Anzeigen = @{}
    Journal  = $Journal
    Chaos    = @{
      Langsam = [int]$Chaos['Langsam']; DialogNach = [int]$Chaos['DialogNach']
      UnbekanntNach = [int]$Chaos['UnbekanntNach']; Wandern = $Chaos['Wandern']
    }
    Gezeigt  = @{ preisliste = $false; unbekannt = $false }
    Aktionen = 0
  }
  $form = [System.Windows.Forms.Form]::new()
  $form.Text = $layout.Titel
  $form.FormBorderStyle = [System.Windows.Forms.FormBorderStyle]::FixedSingle
  $form.MaximizeBox = $false
  $form.ClientSize = [System.Drawing.Size]::new($layout.Groesse[0], $layout.Groesse[1])
  $form.StartPosition = [System.Windows.Forms.FormStartPosition]::Manual
  $form.Location = [System.Drawing.Point]::new($Ursprung[0], $Ursprung[1])
  $form.Font = [System.Drawing.Font]::new([string]$layout.Schrift.Name, [single]$layout.Schrift.Punkt)
  $script:Kf.Form = $form
  foreach ($e in $layout.Elemente) { $form.Controls.Add((New-FensterElement $e)) }
  $form.Add_Shown({ $script:Kf.Felder[0].Focus() | Out-Null })
  Update-FensterAnzeige
  Save-FensterJournal
  [System.Windows.Forms.Application]::Run($form)
}

function New-FensterElement {
  param([hashtable] $Element)
  $x, $y, $b, $h = $Element.Lage
  switch ($Element.Art) {
    { $_ -in 'beschriftung', 'anzeige' } {
      $c = [System.Windows.Forms.Label]::new()
      $c.AutoSize = $false
      $c.TextAlign = [System.Drawing.ContentAlignment]::MiddleLeft
      if ($Element.Art -eq 'beschriftung') { $c.Text = $Element.Text } else { $script:Kf.Anzeigen[$Element.Name] = $c }
    }
    'feld' {
      $c = [System.Windows.Forms.TextBox]::new()
      $c.Name = $Element.Name
      $c.Add_KeyDown({ param($quelle, $taste) Invoke-FensterTaste $quelle $taste })
      if ($Element.Name -eq 'suche') { $c.Add_TextChanged({ $script:Kf.Kasse.Treffer = ''; Update-FensterAnzeige }) }
      $script:Kf.Felder[$Element.Name] = $c
    }
    'knopf' {
      $c = [System.Windows.Forms.Button]::new()
      $c.Text = $Element.Text
      $c.Tag = $Element.Aktion
      $c.Add_Click({ param($quelle) Invoke-FensterAktion ([string]$quelle.Tag) })
    }
    'liste' {
      $c = [System.Windows.Forms.ListBox]::new()
      $c.IntegralHeight = $false
      $c.SelectionMode = [System.Windows.Forms.SelectionMode]::None
      $script:Kf.Anzeigen[$Element.Name] = $c
    }
  }
  $c.Location = [System.Drawing.Point]::new($x, $y)
  $c.Size = [System.Drawing.Size]::new($b, $h)
  $c
}

function Invoke-FensterTaste {
  param($Feld, $Taste)
  if ($Taste.KeyCode -eq [System.Windows.Forms.Keys]::Escape) {
    $Feld.Clear()
    $Taste.SuppressKeyPress = $true
    return
  }
  if ($Taste.KeyCode -ne [System.Windows.Forms.Keys]::Enter) { return }
  $Taste.SuppressKeyPress = $true
  $enter = $script:Kf.Layout['Enter']
  if ($enter -and $enter.Contains($Feld.Name)) { Invoke-FensterAktion $enter[$Feld.Name] }
}

function Get-FeldText([string] $Name) {
  if ($script:Kf.Felder.Contains($Name)) { return $script:Kf.Felder[$Name].Text }
  ''
}

function Clear-Feld([string] $Name) {
  if ($script:Kf.Felder.Contains($Name)) { $script:Kf.Felder[$Name].Clear() }
}

function Invoke-FensterAktion {
  param([string] $Aktion)
  $k = $script:Kf.Kasse
  switch ($Aktion) {
    'Hinzufuegen' {
      $r = Add-KassenPosition -Kasse $k -Pzn (Get-FeldText 'pzn') -Menge (Get-FeldText 'menge')
      if ($r.Ok) {
        Clear-Feld 'pzn'
        Clear-Feld 'menge'
      }
      Update-FensterAnzeige
      if ($r.Ok -and $r.Rueckfrage) { Show-FensterDialog (New-KassenDialog -Art rezept -Kasse $k) }
      $script:Kf.Felder['pzn'].Focus() | Out-Null
    }
    { $_ -in 'Bar', 'Karte' } {
      if ($script:Kf.Layout['Bestaetigen']) {
        Show-FensterDialog (New-KassenDialog -Art bestaetigen -Kasse $k -Text $script:Kf.Layout.Bestaetigen -Ziel $Aktion)
      }
      else { Start-FensterZahlung $Aktion }
    }
    'Leeren' { Clear-KassenBon -Kasse $k }
    'Suchen' { Find-KassenBeleg -Kasse $k -Referenz (Get-FeldText 'suche') | Out-Null }
    'Abschluss' {
      Close-KassenTag -Kasse $k | Out-Null
      Save-FensterJournal
    }
  }
  Complete-FensterAktion
}

function Show-FensterDialog {
  # Modaler Dialog, 300 x 120, mittig über der Kasse; Knöpfe rechts unten.
  param([hashtable] $Dialog)
  $d = [System.Windows.Forms.Form]::new()
  $d.Text = 'Hinweis'
  $d.FormBorderStyle = [System.Windows.Forms.FormBorderStyle]::FixedDialog
  $d.MinimizeBox = $false
  $d.MaximizeBox = $false
  $d.ShowInTaskbar = $false
  $d.StartPosition = [System.Windows.Forms.FormStartPosition]::CenterParent
  $d.ClientSize = [System.Drawing.Size]::new(300, 120)
  $d.Font = $script:Kf.Form.Font
  $text = [System.Windows.Forms.Label]::new()
  $text.Text = $Dialog.Text
  $text.AutoSize = $true
  $text.Location = [System.Drawing.Point]::new(16, 20)
  $d.Controls.Add($text)
  $lage = Get-DialogLage -Dialog $Dialog -Breite 300 -Hoehe 120
  foreach ($k in $lage.Knoepfe) {
    $knopf = [System.Windows.Forms.Button]::new()
    $knopf.Text = $k.Knopf.Text
    $knopf.Tag = $k.Knopf.Antwort
    $knopf.Location = [System.Drawing.Point]::new($k.Lage[0], $k.Lage[1])
    $knopf.Size = [System.Drawing.Size]::new($k.Lage[2], $k.Lage[3])
    $knopf.Add_Click({ param($quelle) $quelle.FindForm().Tag = $quelle.Tag; $quelle.FindForm().Close() })
    $d.Controls.Add($knopf)
    if ($Dialog.Escape -and $k.Knopf.Antwort -eq $Dialog.Escape) { $d.CancelButton = $knopf }
  }
  $null = $d.ShowDialog($script:Kf.Form)
  $antwort = [string]$d.Tag
  if (-not $antwort) { $antwort = [string]$Dialog.Escape }
  $d.Dispose()
  $zahlung = Invoke-KassenDialogAntwort -Kasse $script:Kf.Kasse -Dialog $Dialog -Antwort $antwort
  # Eine Antwort zählt als Aktion, wie in der Simulation.
  $script:Kf.Aktionen++
  Update-FensterAnzeige
  if ($zahlung) { Start-FensterZahlung $zahlung }
}

function Start-FensterZahlung {
  param([string] $Art)
  $ms = $script:Kf.Chaos.Langsam
  if ($ms -le 0) {
    Complete-FensterZahlung $Art
    return
  }
  # Langsame Kasse: Das Fenster ist gesperrt, bis die Buchung durch ist.
  $script:Kf.Form.Enabled = $false
  $script:Kf.Anzeigen['Status'].Text = 'Bitte warten …'
  $uhr = [System.Windows.Forms.Timer]::new()
  $uhr.Interval = $ms
  $uhr.Tag = $Art
  $uhr.Add_Tick({ param($quelle) $quelle.Stop(); $quelle.Dispose(); $script:Kf.Form.Enabled = $true; Complete-FensterZahlung ([string]$quelle.Tag) })
  $uhr.Start()
}

function Complete-FensterZahlung {
  param([string] $Art)
  $art = if ($Art -eq 'Bar') { 'bar' } else { 'karte' }
  $beleg = Invoke-KassenZahlung -Kasse $script:Kf.Kasse -Art $art -Gegeben (Get-FeldText 'gegeben') -Referenz (Get-FeldText 'referenz')
  if ($beleg) {
    Clear-Feld 'gegeben'
    Clear-Feld 'referenz'
    Save-FensterJournal
  }
  Update-FensterAnzeige
}

function Complete-FensterAktion {
  # Nach jeder Aktion: Anzeige, Chaos-Dialoge, wanderndes Fenster.
  $kf = $script:Kf
  $kf.Aktionen++
  Update-FensterAnzeige
  $c = $kf.Chaos
  if ($c.Wandern) {
    $kf.Form.Location = [System.Drawing.Point]::new($kf.Form.Location.X + $c.Wandern[0], $kf.Form.Location.Y + $c.Wandern[1])
  }
  if ($c.DialogNach -gt 0 -and $kf.Aktionen -ge $c.DialogNach -and -not $kf.Gezeigt.preisliste) {
    $kf.Gezeigt.preisliste = $true
    $null = $kf.Form.BeginInvoke([Action] { Show-FensterDialog (New-KassenDialog -Art preisliste -Kasse $script:Kf.Kasse) })
  }
  elseif ($c.UnbekanntNach -gt 0 -and $kf.Aktionen -ge $c.UnbekanntNach -and -not $kf.Gezeigt.unbekannt) {
    $kf.Gezeigt.unbekannt = $true
    $null = $kf.Form.BeginInvoke([Action] { Show-FensterDialog (New-KassenDialog -Art unbekannt -Kasse $script:Kf.Kasse) })
  }
}

function Update-FensterAnzeige {
  $a = Get-KassenAnzeige -Kasse $script:Kf.Kasse
  foreach ($name in 'Positionen', 'Summe', 'Status', 'Treffer') {
    if ($script:Kf.Anzeigen.ContainsKey($name)) { $script:Kf.Anzeigen[$name].Text = $a[$name] }
  }
  $liste = $script:Kf.Anzeigen['Bonzeilen']
  if ($liste) {
    $liste.BeginUpdate()
    $liste.Items.Clear()
    foreach ($z in $a.Bonzeilen) { $null = $liste.Items.Add($z) }
    $liste.EndUpdate()
  }
}

function Save-FensterJournal {
  if (-not $script:Kf.Journal) { return }
  $daten = [ordered]@{
    belege      = @($script:Kf.Kasse.Journal)
    abschluesse = $script:Kf.Kasse.Abschluesse
    status      = $script:Kf.Kasse.Status
  }
  $json = ConvertTo-Json -InputObject $daten -Depth 6
  [IO.File]::WriteAllText($script:Kf.Journal, $json, [Text.UTF8Encoding]::new($false))
}
