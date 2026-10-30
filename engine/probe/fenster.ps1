<#
  Kleines Probefenster für das Gate von Abend 3: Kassenschrift (Segoe UI 9 pt),
  Umlaute, Euro, ein Eingabefeld und ein Knopf. «Buchen» schreibt den Inhalt
  des Feldes in die Wahrheitsdatei; daran misst die Probe, ob Klick und
  Eingabe wirklich ankamen.
#>
# $Wahrheit nutzt der Klick-Handler; das sieht die statische Prüfung nicht.
[Diagnostics.CodeAnalysis.SuppressMessageAttribute('PSReviewUnusedParameter', 'Wahrheit')]
param([Parameter(Mandatory)] [string] $Wahrheit)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms, System.Drawing
[System.Windows.Forms.Application]::SetHighDpiMode([System.Windows.Forms.HighDpiMode]::PerMonitorV2) | Out-Null
[System.Windows.Forms.Application]::EnableVisualStyles()

$schrift = [System.Drawing.Font]::new('Segoe UI', 9)
$form = [System.Windows.Forms.Form]::new()
$form.Text = 'Werkbank-Probe'
$form.Font = $schrift
$form.ClientSize = [System.Drawing.Size]::new(560, 260)
$form.StartPosition = 'Manual'
$form.Location = [System.Drawing.Point]::new(60, 60)
$form.TopMost = $true

function Add-Beschriftung([string] $Text, [int] $X, [int] $Y) {
  $l = [System.Windows.Forms.Label]::new()
  $l.Text = $Text
  $l.AutoSize = $true
  $l.Location = [System.Drawing.Point]::new($X, $Y)
  $form.Controls.Add($l)
  $l
}

$null = Add-Beschriftung 'PZN 99100008 Probatin 400 mg Filmtabletten' 16 16
$null = Add-Beschriftung 'Hinzufügen Menge Rückgeld 12,85 € Größe' 16 44
$null = Add-Beschriftung 'Summe 15,34 EUR Rezept liegt vor?' 16 72
$null = Add-Beschriftung 'Feld:' 16 112
$feld = [System.Windows.Forms.TextBox]::new()
$feld.Location = [System.Drawing.Point]::new(64, 108)
$feld.Size = [System.Drawing.Size]::new(160, 24)
$form.Controls.Add($feld)

$knopf = [System.Windows.Forms.Button]::new()
$knopf.Text = 'Buchen'
$knopf.Location = [System.Drawing.Point]::new(240, 106)
$knopf.Size = [System.Drawing.Size]::new(100, 28)
$form.Controls.Add($knopf)

$status = Add-Beschriftung 'Neuer Bon' 16 160
$knopf.Add_Click({
    [IO.File]::WriteAllText($Wahrheit, $feld.Text)
    $status.Text = "Gebucht: $($feld.Text)"
  })

[System.Windows.Forms.Application]::Run($form)
