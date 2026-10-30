@{
  RootModule        = 'Werkbank.Engine.psm1'
  ModuleVersion     = '0.1.0'
  GUID              = '7462fe53-32b3-4f57-992b-901c9eb1868e'
  Author            = 'Adam Baranyi'
  Copyright         = '(c) 2026 Adam Baranyi. Alle Rechte vorbehalten.'
  Description       = 'Engine der Apotheken-Werkbank: bedient eine Kasse nur über Bildschirmfoto, OCR und Eingabe.'
  PowerShellVersion = '7.4'
  RequiredModules   = @(@{ ModuleName = 'powershell-yaml'; RequiredVersion = '0.4.12' })
  FunctionsToExport = @(
    'Get-Aehnlichkeit'
    'Find-Text'
    'Expand-Text'
    'Test-Flow'
    'Import-Flow'
    'Test-Auftrag'
    'New-Kennung'
    'Invoke-Flow'
    'New-FakeTreiber'
    'New-WindowsTreiber'
    'New-Heiler'
    'Send-Laufbericht'
  )
  CmdletsToExport   = @()
  VariablesToExport = @()
  AliasesToExport   = @()
}
