# Fake-Treiber: dieselbe Kasse ohne Windows. Bildschirme kommen aus der
# Simulation der Kassen-Attrappe als Wörter mit Lage, wie aus einer OCR. So
# laufen alle Flows und die Lauf-Logik in Pester auf dem Mac und unter Linux.
#
# Zusätzlich zum Chaos der Simulation kann das Fenster vor einem bestimmten
# Klick springen: Der Klick trifft dann die alte Stelle, wie wenn jemand das
# Fenster zwischen Bildschirmfoto und Klick verschiebt.

function New-FakeTreiber {
  [CmdletBinding()]
  param(
    [ValidateSet('nord', 'sued')] [string] $Variante = 'nord',
    [hashtable] $Chaos = @{},
    [int[]] $Ursprung = @(60, 60),
    [int] $SprungVorKlick = 0,
    [int[]] $Sprung = @(40, 30)
  )
  if (-not (Get-Command New-KassenSimulation -ErrorAction SilentlyContinue)) {
    Import-Module (Join-Path $PSScriptRoot '../../../attrappe/Kassen.Attrappe.psd1') -Global:$false
  }
  $treiber = [pscustomobject]@{
    Art            = 'fake'
    Simulation     = New-KassenSimulation -Variante $Variante -Chaos $Chaos -Ursprung $Ursprung
    Klicks         = 0
    Bilder         = 0
    SprungVorKlick = $SprungVorKlick
    Sprung         = $Sprung
  }
  $treiber | Add-Member -MemberType ScriptMethod -Name Fenster -Value {
    param([string] $Titel)
    $s = $this.Simulation
    if ($s.Layout.Titel.IndexOf($Titel, [StringComparison]::OrdinalIgnoreCase) -lt 0) { return $null }
    [pscustomobject]@{ Handle = 1; Titel = $s.Layout.Titel; X = $s.Ursprung.X; Y = $s.Ursprung.Y; Breite = $s.Layout.Groesse[0]; Hoehe = $s.Layout.Groesse[1] }
  }
  $treiber | Add-Member -MemberType ScriptMethod -Name Bildschirm -Value {
    param($Fenster)
    $null = $Fenster # Der Vertrag verlangt das Fenster; die Simulation kennt es selbst.
    $this.Bilder++
    Get-SimulationsBild -Simulation $this.Simulation
  }
  $treiber | Add-Member -MemberType ScriptMethod -Name Vordergrund -Value {
    param($Fenster)
    $null = $Fenster # Die Simulation ist immer vorne.
    $true
  }
  $treiber | Add-Member -MemberType ScriptMethod -Name Klick -Value {
    param([int] $X, [int] $Y)
    $this.Klicks++
    if ($this.Klicks -eq $this.SprungVorKlick) {
      $this.Simulation.Ursprung.X += $this.Sprung[0]
      $this.Simulation.Ursprung.Y += $this.Sprung[1]
    }
    Send-SimulationsKlick -Simulation $this.Simulation -X $X -Y $Y
    $true
  }
  $treiber | Add-Member -MemberType ScriptMethod -Name Tippen -Value {
    param([string] $Text)
    Send-SimulationsText -Simulation $this.Simulation -Text $Text
    $true
  }
  $treiber | Add-Member -MemberType ScriptMethod -Name Taste -Value {
    param([string] $Name)
    Send-SimulationsTaste -Simulation $this.Simulation -Name $Name
    $true
  }
  $treiber | Add-Member -MemberType ScriptMethod -Name Foto -Value {
    # Statt eines Bildes eine Textkarte: jede OCR-Zeile mit ihrer Lage.
    param($Bild, [string] $Basis)
    $ziel = "$Basis.txt"
    $zeilen = $Bild.Woerter | Group-Object Zeile | ForEach-Object {
      $w = @($_.Group | Sort-Object X)
      '{0,4} {1,4}  {2}' -f $w[0].X, $w[0].Y, (($w.Text) -join ' ')
    }
    Set-Content -LiteralPath $ziel -Value $zeilen -Encoding utf8
    $ziel
  }
  $treiber
}
