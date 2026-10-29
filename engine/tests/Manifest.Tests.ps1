# Die Modulmanifeste von Engine und Kassen-Attrappe: gültig, und sie
# exportieren genau die Funktionen, die es gibt. Ein Name im Manifest ohne
# Funktion fiele sonst erst beim Aufruf auf, eine Funktion ohne Eintrag gar nicht.

Describe 'Modulmanifeste' {
  It '<Name> ist gültig und exportiert nur Funktionen, die es gibt' -ForEach @(
    @{ Name = 'Werkbank.Engine'; Pfad = (Join-Path $PSScriptRoot '../Werkbank.Engine.psd1') }
    @{ Name = 'Kassen.Attrappe'; Pfad = (Join-Path $PSScriptRoot '../../attrappe/Kassen.Attrappe.psd1') }
  ) {
    $manifest = Test-ModuleManifest -Path $Pfad -ErrorAction Stop
    $modul = Import-Module $Pfad -Force -PassThru
    $vorhanden = @($modul.ExportedFunctions.Keys | Sort-Object)
    $versprochen = @($manifest.ExportedFunctions.Keys | Sort-Object)
    $vorhanden | Should -Be $versprochen
    @(Import-PowerShellDataFile $Pfad).FunctionsToExport.Count | Should -Be $vorhanden.Count
  }
}
