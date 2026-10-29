# Kassen-Attrappe «Apotheke Nord»: Beschriftungen links neben den Feldern,
# Segoe UI 9 pt wie viele Windows-Kassen. Lage = X, Y, Breite, Höhe in Pixeln
# der Client-Fläche. Dieselbe Datei baut das WinForms-Fenster und die
# Simulation des Fake-Treibers.
@{
  Variante    = 'nord'
  Titel       = 'Kasse Nord – Attrappe'
  Groesse     = @(620, 520)
  Schrift     = @{ Name = 'Segoe UI'; Punkt = 9; Zeichenbreite = 7 }
  Texte       = @{}
  Enter       = @{ pzn = 'Hinzufuegen'; menge = 'Hinzufuegen'; suche = 'Suchen' }
  Bestaetigen = ''
  Elemente    = @(
    @{ Art = 'beschriftung'; Text = 'PZN'; Lage = @(16, 16, 36, 24) }
    @{ Art = 'feld'; Name = 'pzn'; Lage = @(56, 16, 120, 24) }
    @{ Art = 'beschriftung'; Text = 'Menge'; Lage = @(196, 16, 50, 24) }
    @{ Art = 'feld'; Name = 'menge'; Lage = @(252, 16, 48, 24) }
    @{ Art = 'knopf'; Text = 'Hinzufügen'; Aktion = 'Hinzufuegen'; Lage = @(316, 14, 110, 28) }
    @{ Art = 'anzeige'; Name = 'Positionen'; Lage = @(16, 54, 160, 20) }
    @{ Art = 'anzeige'; Name = 'Summe'; Lage = @(200, 54, 200, 20) }
    @{ Art = 'liste'; Name = 'Bonzeilen'; Lage = @(16, 84, 588, 180) }
    @{ Art = 'beschriftung'; Text = 'Gegeben'; Lage = @(16, 280, 60, 24) }
    @{ Art = 'feld'; Name = 'gegeben'; Lage = @(84, 280, 90, 24) }
    @{ Art = 'beschriftung'; Text = 'Kundenreferenz'; Lage = @(196, 280, 110, 24) }
    @{ Art = 'feld'; Name = 'referenz'; Lage = @(312, 280, 130, 24) }
    @{ Art = 'knopf'; Text = 'Bar'; Aktion = 'Bar'; Lage = @(16, 316, 90, 30) }
    @{ Art = 'knopf'; Text = 'Karte'; Aktion = 'Karte'; Lage = @(116, 316, 90, 30) }
    @{ Art = 'knopf'; Text = 'Bon leeren'; Aktion = 'Leeren'; Lage = @(216, 316, 110, 30) }
    @{ Art = 'anzeige'; Name = 'Status'; Lage = @(16, 358, 588, 22) }
    @{ Art = 'beschriftung'; Text = 'Belegsuche'; Lage = @(16, 398, 120, 24) }
    @{ Art = 'feld'; Name = 'suche'; Lage = @(140, 398, 130, 24) }
    @{ Art = 'knopf'; Text = 'Suchen'; Aktion = 'Suchen'; Lage = @(280, 396, 90, 28) }
    @{ Art = 'anzeige'; Name = 'Treffer'; Lage = @(16, 434, 588, 22) }
    @{ Art = 'knopf'; Text = 'Tagesabschluss'; Aktion = 'Abschluss'; Lage = @(16, 472, 140, 30) }
  )
}
