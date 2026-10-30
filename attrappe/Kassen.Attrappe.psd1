@{
  RootModule        = 'Kassen.Attrappe.psm1'
  ModuleVersion     = '0.1.0'
  GUID              = 'aa8a202c-adca-43a8-9a61-0f9eb3843d23'
  Author            = 'Adam Baranyi'
  Copyright         = '(c) 2026 Adam Baranyi. Alle Rechte vorbehalten.'
  Description       = 'Kassen-Attrappe der Apotheken-Werkbank: Logik, Layouts, Bildschirm-Simulation und WinForms-Fenster.'
  PowerShellVersion = '7.4'
  FunctionsToExport = @(
    'New-KassenZustand'
    'Add-KassenPosition'
    'Resolve-KassenRueckfrage'
    'Invoke-KassenZahlung'
    'Find-KassenBeleg'
    'Close-KassenTag'
    'Clear-KassenBon'
    'Get-KassenAnzeige'
    'Import-KassenLayout'
    'Test-KassenLayout'
    'New-KassenSimulation'
    'Get-SimulationsBild'
    'Send-SimulationsKlick'
    'Send-SimulationsText'
    'Send-SimulationsTaste'
    'Show-KassenAttrappe'
  )
  CmdletsToExport   = @()
  VariablesToExport = @()
  AliasesToExport   = @()
}
