# Regeln für PSScriptAnalyzer in engine/ und attrappe/. Geprüft wird ab
# «Warning»; jede Ausnahme steht hier mit Grund.
@{
  Severity     = @('Error', 'Warning')
  ExcludeRules = @(
    # Alle Skripte laufen in PowerShell 7, das UTF-8 ohne BOM liest. Einzige
    # Ausnahme ist engine/src/Treiber/ocr51.ps1 für Windows PowerShell 5.1:
    # Diese Datei enthält nur ASCII.
    'PSUseBOMForUnicodeEncodedFile'
    # New-, Start- und Update-Funktionen bauen hier Objekte im Speicher oder
    # aktualisieren ein Fenster; sie ändern keinen Zustand des Systems, den
    # -WhatIf schützen müsste.
    'PSUseShouldProcessForStateChangingFunctions'
    # Ruft intern Test-ModuleManifest auf und stürzte auf dem Linux-Läufer
    # zweimal ab («Value cannot be null (Parameter 'name')»), bei derselben
    # Datei einmal nicht. Unsere Manifeste sind neu geschrieben, ohne veraltete
    # Felder; ihre Gültigkeit prüft engine/tests/Manifest.Tests.ps1.
    'PSAvoidUsingDeprecatedManifestFields'
  )
}
