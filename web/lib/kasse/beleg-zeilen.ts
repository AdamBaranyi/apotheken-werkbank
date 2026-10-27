import { betragText, satzText } from '@/lib/geld';
import type { PdfZeile } from '@/lib/pdf/pdf';
import { steuerBuchstaben, zeitText, type BelegDaten, type BelegPosition } from './beleg-daten';

/**
 * Der Beleg als Textzeilen für eine Bonrolle von 80 mm: 42 Zeichen in
 * Courier. Rechtsbündige Beträge gehen in einer Schrift mit fester Breite
 * ohne Messen. Die Seite im Browser zeigt dieselben Daten als HTML.
 */
export const BREITE = 42;
const STRICH = '-'.repeat(BREITE);

function zeile(links: string, rechts = ''): string {
  const platz = BREITE - rechts.length - 1;
  const kurz = links.length > platz ? `${links.slice(0, platz - 1)}…` : links;
  return kurz + ' '.repeat(Math.max(1, BREITE - kurz.length - rechts.length)) + rechts;
}

function mitte(text: string): string {
  return ' '.repeat(Math.max(0, Math.floor((BREITE - text.length) / 2))) + text;
}

/** Bricht an Leerzeichen um; Folgezeilen rücken ein. */
function umbrechen(text: string, einzug = ''): string[] {
  const zeilen: string[] = [];
  let aktuell = '';
  for (const wort of text.split(' ')) {
    const kandidat = aktuell ? `${aktuell} ${wort}` : wort;
    if (kandidat.length <= BREITE || !aktuell) aktuell = kandidat.slice(0, BREITE);
    else {
      zeilen.push(aktuell);
      aktuell = (einzug + wort).slice(0, BREITE);
    }
  }
  if (aktuell) zeilen.push(aktuell);
  return zeilen;
}

function positionZeilen(p: BelegPosition, buchstabe: string, b: BelegDaten): string[] {
  const geld = (cent: number) => betragText(cent, b.waehrung);
  const rx = p.rezeptpflichtig ? ' (Rx)' : '';
  const je = Math.abs(p.menge) === 1 ? '' : `je ${geld(p.einzelpreis_cent)}  `;
  return [
    ...umbrechen(`${p.menge} × ${p.name}${rx}`, '    '),
    zeile(`    ${p.packung}`, `${je}${geld(p.menge * p.einzelpreis_cent)} ${buchstabe}`),
  ];
}

function zahlungZeilen(b: BelegDaten): PdfZeile[] {
  const geld = (cent: number) => betragText(cent, b.waehrung);
  const summe = { text: zeile('SUMME', geld(b.summe_cent)), fett: true };
  if (b.storno_von) {
    const art = b.zahlart === 'bar' ? 'Auszahlung bar' : 'Gutschrift auf Karte';
    return [summe, { text: zeile(art, geld(-b.summe_cent)) }];
  }
  if (b.zahlart === 'karte')
    return [summe, { text: zeile('Bezahlt mit Karte', geld(b.summe_cent)) }];
  return [
    summe,
    { text: zeile('Bar gegeben', geld(b.gegeben_cent ?? 0)) },
    { text: zeile('Rückgeld', geld(b.rueckgeld_cent ?? 0)) },
  ];
}

function steuerZeilen(b: BelegDaten, buchstaben: Map<number, string>): string[] {
  const geld = (cent: number) => betragText(cent, b.waehrung).padStart(11);
  const kopf = `${'Satz'.padStart(9)}${'Netto'.padStart(11)}${'Steuer'.padStart(11)}${'Brutto'.padStart(11)}`;
  return [
    kopf,
    ...b.steuern.map(
      (s) =>
        `${buchstaben.get(s.satz_promille) ?? '?'} ${satzText(s.satz_promille).padStart(7)}` +
        `${geld(s.brutto_cent - s.steuer_cent)}${geld(s.steuer_cent)}${geld(s.brutto_cent)}`,
    ),
  ];
}

const HINWEIS =
  'Übungsbeleg der Apotheken-Werkbank mit erfundenen Daten. Ohne TSE: keine Seriennummer, ' +
  'kein Signaturzähler, kein Prüfwert – kein Beleg nach § 6 KassenSichV.';

export function belegZeilen(b: BelegDaten): PdfZeile[] {
  const buchstaben = steuerBuchstaben(b.steuern);
  const text = (t: string): PdfZeile => ({ text: t });
  return [
    { text: mitte(b.apotheke.slice(0, BREITE)), fett: true },
    text(STRICH),
    text(zeile(`Beleg ${b.belegnummer}`, zeitText(b.erstellt_am, b.land))),
    ...(b.storno_von ? [{ text: `STORNO zu Beleg ${b.storno_von.belegnummer}`, fett: true }] : []),
    text(STRICH),
    ...b.positionen.flatMap((p) =>
      positionZeilen(p, buchstaben.get(p.satz_promille) ?? '?', b).map(text),
    ),
    text(STRICH),
    ...zahlungZeilen(b),
    text(STRICH),
    ...steuerZeilen(b, buchstaben).map(text),
    ...(b.storniert_durch
      ? [text(STRICH), text(`Storniert durch Beleg ${b.storniert_durch.belegnummer}`)]
      : []),
    text(STRICH),
    ...umbrechen(HINWEIS).map(text),
  ];
}
