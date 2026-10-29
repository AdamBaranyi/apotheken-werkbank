# Windows-Treiber: echtes Fenster, echtes Bildschirmfoto, echte OCR, echte
# Eingabe. Erfüllt denselben Vertrag wie der Fake-Treiber (docs/ENGINE.md):
#   Fenster(titel)      -> Fensterinfo der Client-Fläche oder $null
#   Bildschirm(fenster) -> Bild mit Wörtern (Lage relativ zur Client-Fläche)
#   Vordergrund(fenster), Klick(x, y) in Bildschirmkoordinaten,
#   Tippen(text), Taste(name, auch ShiftTab), Foto(bild, basis) -> Pfad mit Endung

$script:WindowsTasten = @{
  Enter     = [uint16]0x0D
  Escape    = [uint16]0x1B
  Tab       = [uint16]0x09
  Backspace = [uint16]0x08
}

function ConvertTo-Fensterinfo {
  param($Info)
  if ($null -eq $Info) { return $null }
  [pscustomobject]@{
    Handle = $Info.Handle
    Titel  = $Info.Titel
    X      = $Info.X
    Y      = $Info.Y
    Breite = $Info.Breite
    Hoehe  = $Info.Hoehe
  }
}

function Save-Bildschirmfoto {
  # Fotografiert die Client-Fläche und speichert sie zweifach: in echter Grösse
  # (Beleg) und hochskaliert für die OCR, die kleine Kassenschrift besser liest.
  param($Fenster, [string] $Basis, [int] $Skalierung)
  $roh = "$Basis.png"
  $gross = "$Basis-x$Skalierung.png"
  $bild = [System.Drawing.Bitmap]::new($Fenster.Breite, $Fenster.Hoehe)
  try {
    $g = [System.Drawing.Graphics]::FromImage($bild)
    try { $g.CopyFromScreen($Fenster.X, $Fenster.Y, 0, 0, $bild.Size) } finally { $g.Dispose() }
    $bild.Save($roh, [System.Drawing.Imaging.ImageFormat]::Png)
    $hoch = [System.Drawing.Bitmap]::new($bild.Width * $Skalierung, $bild.Height * $Skalierung)
    try {
      $g2 = [System.Drawing.Graphics]::FromImage($hoch)
      try {
        $g2.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $g2.DrawImage($bild, 0, 0, $hoch.Width, $hoch.Height)
      }
      finally { $g2.Dispose() }
      $hoch.Save($gross, [System.Drawing.Imaging.ImageFormat]::Png)
    }
    finally { $hoch.Dispose() }
  }
  finally { $bild.Dispose() }
  @{ Roh = $roh; Gross = $gross }
}

function Read-OcrWoerter {
  # Ruft ocr51.ps1 in Windows PowerShell 5.1 auf und rechnet die Lage zurück
  # auf echte Pixel der Client-Fläche.
  param([string] $Skript, [string] $Bild, [string] $Json, [string] $Sprache, [int] $Skalierung)
  $fehler = & powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass `
    -File $Skript -Bild $Bild -Ausgabe $Json -Sprache $Sprache 2>&1
  if ($LASTEXITCODE -ne 0) { throw "OCR gescheitert: $($fehler -join ' ')" }
  $daten = Get-Content -LiteralPath $Json -Raw -Encoding utf8 | ConvertFrom-Json
  $woerter = foreach ($zeile in $daten.Zeilen) {
    foreach ($w in $zeile.Woerter) {
      [pscustomobject]@{
        Text  = [string]$w.Text
        X     = [int][math]::Round($w.X / $Skalierung)
        Y     = [int][math]::Round($w.Y / $Skalierung)
        B     = [int][math]::Max(1, [math]::Round($w.B / $Skalierung))
        H     = [int][math]::Max(1, [math]::Round($w.H / $Skalierung))
        Zeile = [int]$zeile.Nr
      }
    }
  }
  @{ Woerter = @($woerter); Sprache = $daten.Sprache; Verfuegbar = @($daten.Verfuegbar) }
}

function New-WindowsTreiber {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)] [string] $Arbeitsordner,
    [ValidateRange(1, 4)] [int] $Skalierung = 2,
    [string] $Sprache = 'de-DE'
  )
  if (-not $IsWindows) { throw 'Der Windows-Treiber läuft nur unter Windows.' }
  if (-not ('Werkbank.Win32' -as [type])) {
    Add-Type -Path (Join-Path $PSScriptRoot 'Win32.cs')
  }
  Add-Type -AssemblyName System.Drawing
  $dpi = [Werkbank.Win32]::DpiBewusst()
  $ordner = (New-Item -ItemType Directory -Force -Path $Arbeitsordner).FullName

  $treiber = [pscustomobject]@{
    Art        = 'windows'
    Ordner     = $ordner
    Skalierung = $Skalierung
    Sprache    = $Sprache
    DpiBewusst = $dpi
    Nummer     = 0
    Ocr        = Join-Path $PSScriptRoot 'ocr51.ps1'
  }
  $treiber | Add-Member -MemberType ScriptMethod -Name Fenster -Value {
    param([string] $Titel)
    $liste = [Werkbank.Win32]::Suchen($Titel)
    if ($liste.Count -eq 0) { return $null }
    ConvertTo-Fensterinfo $liste[0]
  }
  $treiber | Add-Member -MemberType ScriptMethod -Name Bildschirm -Value {
    param($Fenster)
    $start = Get-Date
    $this.Nummer++
    $basis = Join-Path $this.Ordner ('bild-{0:d4}' -f $this.Nummer)
    $dateien = Save-Bildschirmfoto -Fenster $Fenster -Basis $basis -Skalierung $this.Skalierung
    $ocr = Read-OcrWoerter -Skript $this.Ocr -Bild $dateien.Gross -Json "$basis.json" `
      -Sprache $this.Sprache -Skalierung $this.Skalierung
    [pscustomobject]@{
      Fenster    = $Fenster
      Woerter    = $ocr.Woerter
      Pfad       = $dateien.Roh
      Sprache    = $ocr.Sprache
      Verfuegbar = $ocr.Verfuegbar
      DauerMs    = [int]((Get-Date) - $start).TotalMilliseconds
    }
  }
  $treiber | Add-Member -MemberType ScriptMethod -Name Vordergrund -Value {
    param($Fenster)
    [Werkbank.Win32]::Vordergrund($Fenster.Handle)
  }
  $treiber | Add-Member -MemberType ScriptMethod -Name Klick -Value {
    param([int] $X, [int] $Y)
    [Werkbank.Win32]::Klick($X, $Y)
  }
  $treiber | Add-Member -MemberType ScriptMethod -Name Tippen -Value {
    param([string] $Text)
    [Werkbank.Win32]::Tippen($Text)
  }
  $treiber | Add-Member -MemberType ScriptMethod -Name Taste -Value {
    param([string] $Name)
    if ($Name -eq 'ShiftTab') { return [Werkbank.Win32]::TasteMitUmschalt($script:WindowsTasten.Tab) }
    if (-not $script:WindowsTasten.ContainsKey($Name)) { throw "Unbekannte Taste: $Name" }
    [Werkbank.Win32]::Taste($script:WindowsTasten[$Name])
  }
  $treiber | Add-Member -MemberType ScriptMethod -Name Foto -Value {
    # Der Treiber hängt die Endung an und liefert den Pfad.
    param($Bild, [string] $Basis)
    $ziel = "$Basis.png"
    Copy-Item -LiteralPath $Bild.Pfad -Destination $ziel -Force
    $ziel
  }
  $treiber
}
