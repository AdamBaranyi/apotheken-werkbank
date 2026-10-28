/**
 * Die Schritte des Rundgangs, je Seite. Ein Ziel zeigt auf das erklärte
 * Element: ein CSS-Selektor oder die Beschriftung eines Knopfs im Inhalt.
 * Fehlt das Ziel gerade (leerer Bon), bleibt der Text und nichts wird
 * hervorgehoben.
 */
export type Ziel = { selektor: string } | { knopf: string };

export interface Schritt {
  titel: string;
  text: string;
  ziel?: Ziel;
}

const WILLKOMMEN: Schritt = {
  titel: 'Willkommen in der Werkbank',
  text: 'Hier bestellt die Apotheke beim Grosshändler über MSV3 und verkauft an der Kasse. Apotheken, Artikel und Grosshändler sind erfunden.',
};

const BEREICHE: Schritt = {
  titel: 'Die Bereiche',
  text: 'Kasse, Belege und Tagesabschluss sind der Verkauf, Bestellen und Bestellungen der Einkauf beim Grosshändler. Den Rundgang gibt es auf jeder Seite.',
  ziel: { selektor: 'nav[aria-label="Bereiche"]' },
};

const JE_SEITE: Record<string, readonly Schritt[]> = {
  '/bestellen': [
    WILLKOMMEN,
    {
      titel: 'Bestellfenster heute',
      text: 'Die Touren stammen aus dem Vertrag mit dem Grosshändler. Die laufende Tour zeigt, wie viel Zeit bis zum Bestellschluss bleibt.',
      ziel: { selektor: 'section[aria-labelledby="touren-titel"]' },
    },
    {
      titel: 'Mengen eintragen',
      text: 'Bei jedem Artikel, der fehlt, die Menge eintragen. «Rx» heisst rezeptpflichtig.',
      ziel: { selektor: '#inhalt table' },
    },
    {
      titel: 'Verfügbarkeit prüfen',
      text: 'Fragt unverbindlich beim Grosshändler: was aus dem Hauptlager kommt, was später aus dem zweiten Lager, was fehlt und warum. Jeder Fall hat Wort, Farbe und Muster.',
      ziel: { knopf: 'Verfügbarkeit prüfen' },
    },
    {
      titel: 'Verbindlich bestellen',
      text: 'Schickt die Mengen als Bestellung. Die Bestell-ID steht vorher fest: Bricht die Verbindung ab, klärt die Statusabfrage, ob die Bestellung angekommen ist, statt doppelt zu bestellen.',
      ziel: { knopf: 'Verbindlich bestellen' },
    },
    BEREICHE,
  ],
  '/kasse': [
    WILLKOMMEN,
    {
      titel: 'Artikel erfassen',
      text: 'PZN eintippen oder scannen und Enter drücken. Die Prüfziffer fängt Tippfehler ab.',
      ziel: { selektor: '#pzn' },
    },
    {
      titel: 'Der Bon',
      text: 'Hier stehen die erfassten Artikel: Menge ändern oder entfernen. Ein rezeptpflichtiger Artikel braucht das Häkchen «Rezept liegt vor».',
      ziel: { selektor: '#inhalt table' },
    },
    {
      titel: 'Zahlung',
      text: 'Bar mit Rückgeld oder Karte; erscheint, sobald ein Artikel auf dem Bon steht. Gebucht wird ohne Zahlungsanbieter.',
      ziel: { selektor: '#inhalt fieldset' },
    },
    {
      titel: 'Verkauf buchen',
      text: 'Preise, Steuersätze und die lückenlose Belegnummer setzt die Datenbank. Danach folgt der Beleg, auch als PDF.',
      ziel: { knopf: 'Verkauf buchen' },
    },
    {
      titel: 'Belege und Tagesabschluss',
      text: 'Ein Beleg wird nie geändert: Ein Storno ist ein eigener Gegenbeleg, nur für die Inhaberin oder den Inhaber. Der Tagesabschluss zählt je Zahlart und Steuersatz.',
      ziel: { selektor: 'nav[aria-label="Bereiche"]' },
    },
  ],
};

/** Die Schritte für eine Seite; Seiten ohne eigene Schritte bekommen den kurzen Rundgang. */
export function schritteFuer(pfad: string): readonly Schritt[] {
  return JE_SEITE[pfad] ?? [WILLKOMMEN, BEREICHE];
}
