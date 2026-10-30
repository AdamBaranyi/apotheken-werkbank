/**
 * Der Rundgang führt einmal durch die ganze Werkbank: Bestellen,
 * Bestellungen, Kasse, Belege, Tagesabschluss. Ein Schritt mit `pfad` öffnet
 * zuerst diese Seite. Ein Ziel zeigt auf das erklärte Element: ein
 * CSS-Selektor oder die Beschriftung eines Knopfs im Inhalt. Fehlt das Ziel
 * gerade (leerer Bon, nichts abzuschliessen), bleibt nur der Text.
 */
export type Ziel = { selektor: string } | { knopf: string };

export interface Schritt {
  titel: string;
  text: string;
  pfad?: string;
  ziel?: Ziel;
}

const TABELLE: Ziel = { selektor: '#inhalt table' };

export const SCHRITTE: readonly Schritt[] = [
  {
    titel: 'Willkommen in der Werkbank',
    text: 'Hier bestellt eine Apotheke beim Grosshändler über MSV3 und verkauft an der Kasse. Der Rundgang führt einmal durch alles, was schon fertig ist. Apotheken, Artikel und Grosshändler sind erfunden.',
  },
  {
    pfad: '/bestellen',
    titel: 'Bestellfenster heute',
    text: 'Die Touren stammen aus dem Vertrag mit dem Grosshändler. Die laufende Tour zeigt, wie viel Zeit bis zum Bestellschluss bleibt.',
    ziel: { selektor: 'section[aria-labelledby="touren-titel"]' },
  },
  {
    pfad: '/bestellen',
    titel: 'Mengen eintragen',
    text: 'Bei jedem Artikel, der fehlt, die Menge eintragen. «Rx» heisst rezeptpflichtig.',
    ziel: TABELLE,
  },
  {
    pfad: '/bestellen',
    titel: 'Verfügbarkeit prüfen',
    text: 'Fragt unverbindlich beim Grosshändler: was aus dem Hauptlager kommt, was später aus dem zweiten Lager, was fehlt und warum. Jeder Fall hat Wort, Farbe und Muster.',
    ziel: { knopf: 'Verfügbarkeit prüfen' },
  },
  {
    pfad: '/bestellen',
    titel: 'Verbindlich bestellen',
    text: 'Schickt die Mengen als Bestellung. Die Bestell-ID steht vorher fest: Bricht die Verbindung ab, wird nichts doppelt bestellt.',
    ziel: { knopf: 'Verbindlich bestellen' },
  },
  {
    pfad: '/bestellungen',
    titel: 'Bestellungen',
    text: 'Alle Bestellungen mit Zeit, Artikeln und der Antwort des Grosshändlers. Fehlt die Antwort, klärt die Statusabfrage in der Bestellung, ob sie angekommen ist.',
    ziel: TABELLE,
  },
  {
    pfad: '/kasse',
    titel: 'Artikel erfassen',
    text: 'An der Kasse die PZN eintippen oder scannen und Enter drücken. Die Prüfziffer fängt Tippfehler ab.',
    ziel: { selektor: '#pzn' },
  },
  {
    pfad: '/kasse',
    titel: 'Der Bon',
    text: 'Hier stehen die erfassten Artikel: Menge ändern oder entfernen. Ein rezeptpflichtiger Artikel braucht das Häkchen «Rezept liegt vor».',
    ziel: TABELLE,
  },
  {
    pfad: '/kasse',
    titel: 'Zahlung und Buchen',
    text: 'Bar mit Rückgeld oder Karte, ohne Zahlungsanbieter. Preise, Steuersätze und die lückenlose Belegnummer setzt beim Buchen die Datenbank.',
    ziel: { knopf: 'Verkauf buchen' },
  },
  {
    pfad: '/kasse/belege',
    titel: 'Belege',
    text: 'Die letzten Belege. Ein Klick öffnet den Beleg mit der Steuer je Satz und als PDF. Ein Beleg wird nie geändert: Ein Storno ist ein eigener Gegenbeleg, nur für die Inhaberin oder den Inhaber.',
    ziel: TABELLE,
  },
  {
    pfad: '/kasse/abschluss',
    titel: 'Seit dem letzten Abschluss',
    text: 'Belege und Umsatz seit dem letzten Abschluss, getrennt nach Bar und Karte.',
    ziel: { selektor: 'section[aria-labelledby="offen-titel"]' },
  },
  {
    pfad: '/kasse/abschluss',
    titel: 'Tag abschliessen',
    text: 'Schliesst den Zeitraum ab. Jeder Beleg landet in genau einem Abschluss; die früheren stehen darunter.',
    ziel: { knopf: 'Tag abschliessen' },
  },
  {
    titel: 'Geschafft',
    text: 'Das ist der Stand heute. Den Rundgang startest du jederzeit wieder oben rechts.',
    ziel: { selektor: 'nav[aria-label="Bereiche"]' },
  },
];
