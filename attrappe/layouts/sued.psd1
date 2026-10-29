# Kassen-Attrappe «Apotheke Süd»: andere Wörter, Beschriftungen über den
# Feldern, Tahoma 10 pt, und vor jedem Abschluss eine Rückfrage. So braucht
# dieselbe Aufgabe hier einen eigenen Flow. Lage = X, Y, Breite, Höhe.
@{
  Variante    = 'sued'
  Titel       = 'Kassensystem Süd (Attrappe)'
  Groesse     = @(620, 560)
  Schrift     = @{ Name = 'Tahoma'; Punkt = 10; Zeichenbreite = 8 }
  Texte       = @{
    Rueckfrage   = 'Verordnung vorhanden?'
    Positionen   = 'Im Vorgang {0}'
    Summe        = 'Gesamt {0}'
    GebuchtBar   = 'Vorgang {0} abgeschlossen, zurück {1}'
    GebuchtKarte = 'Vorgang {0} abgeschlossen, EC-Zahlung'
  }
  Enter       = @{ pzn = 'Hinzufuegen'; menge = 'Hinzufuegen'; suche = 'Suchen' }
  Bestaetigen = 'Verkauf wirklich abschliessen?'
  Elemente    = @(
    @{ Art = 'beschriftung'; Text = 'Artikelnr.'; Lage = @(16, 10, 130, 20) }
    @{ Art = 'beschriftung'; Text = 'Anzahl'; Lage = @(160, 10, 60, 20) }
    @{ Art = 'feld'; Name = 'pzn'; Lage = @(16, 32, 130, 24) }
    @{ Art = 'feld'; Name = 'menge'; Lage = @(160, 32, 60, 24) }
    @{ Art = 'knopf'; Text = 'Übernehmen'; Aktion = 'Hinzufuegen'; Lage = @(236, 30, 130, 28) }
    @{ Art = 'anzeige'; Name = 'Positionen'; Lage = @(16, 70, 190, 20) }
    @{ Art = 'anzeige'; Name = 'Summe'; Lage = @(220, 70, 220, 20) }
    @{ Art = 'liste'; Name = 'Bonzeilen'; Lage = @(16, 100, 588, 170) }
    @{ Art = 'beschriftung'; Text = 'Vorgang-Nr.'; Lage = @(16, 282, 130, 20) }
    @{ Art = 'beschriftung'; Text = 'Betrag erhalten'; Lage = @(200, 282, 150, 20) }
    @{ Art = 'feld'; Name = 'referenz'; Lage = @(16, 304, 130, 24) }
    @{ Art = 'feld'; Name = 'gegeben'; Lage = @(200, 304, 90, 24) }
    @{ Art = 'knopf'; Text = 'EC-Karte'; Aktion = 'Karte'; Lage = @(16, 342, 110, 30) }
    @{ Art = 'knopf'; Text = 'Bar'; Aktion = 'Bar'; Lage = @(136, 342, 90, 30) }
    @{ Art = 'knopf'; Text = 'Storno Bon'; Aktion = 'Leeren'; Lage = @(236, 342, 120, 30) }
    @{ Art = 'anzeige'; Name = 'Status'; Lage = @(16, 384, 588, 22) }
    @{ Art = 'beschriftung'; Text = 'Vorgangssuche'; Lage = @(16, 418, 150, 20) }
    @{ Art = 'feld'; Name = 'suche'; Lage = @(16, 440, 130, 24) }
    @{ Art = 'knopf'; Text = 'Suchen'; Aktion = 'Suchen'; Lage = @(156, 438, 90, 28) }
    @{ Art = 'anzeige'; Name = 'Treffer'; Lage = @(16, 476, 588, 22) }
    @{ Art = 'knopf'; Text = 'Kassenschnitt'; Aktion = 'Abschluss'; Lage = @(16, 512, 150, 30) }
  )
}
