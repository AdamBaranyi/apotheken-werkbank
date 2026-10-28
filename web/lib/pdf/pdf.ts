/**
 * Ein kleiner PDF-Schreiber für Kassenbelege: eine Seite in der Breite einer
 * Bonrolle, Schrift Courier (eine der 14 Standardschriften, die jedes
 * Anzeigeprogramm mitbringt, darum nicht eingebettet), Text in WinAnsi. Ein
 * Bon braucht nur Textzeilen; eine Bibliothek brächte Schriftdateien, die auf
 * Vercel erst gefunden werden müssen, oder ist seit Jahren ohne Pflege (E24).
 *
 * Bis auf die Kennzeile bleibt die Datei ASCII: Zeichen ab 0x80 stehen als
 * Oktalfolge im Text. Ein Zeichen ist damit ein Byte, und die Versätze im
 * Verzeichnis (xref) stimmen ohne Umrechnung.
 */
export interface PdfZeile {
  text: string;
  fett?: boolean;
}

export interface PdfAuftrag {
  titel: string;
  /** Seitenbreite in Punkt; eine Bonrolle mit 80 mm hat 226,8 pt. */
  breitePt: number;
  zeilen: PdfZeile[];
  schriftPt?: number;
  randPt?: number;
}

/** WinAnsi weicht nur zwischen 0x80 und 0x9F von Latin-1 ab. */
const SONDER: Record<string, number> = {
  '€': 0x80,
  '‚': 0x82,
  '„': 0x84,
  '…': 0x85,
  '‰': 0x89,
  '‹': 0x8b,
  '‘': 0x91,
  '’': 0x92,
  '“': 0x93,
  '”': 0x94,
  '•': 0x95,
  '–': 0x96,
  '—': 0x97,
  '™': 0x99,
  '›': 0x9b,
};

/** Text als WinAnsi-Bytes; Steuerzeichen und alles ohne Platz in WinAnsi wird «?». */
export function winAnsi(text: string): Uint8Array {
  const bytes: number[] = [];
  for (const zeichen of text) {
    const code = zeichen.codePointAt(0) ?? 0x3f;
    const latin1 = (code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff);
    bytes.push(latin1 ? code : (SONDER[zeichen] ?? 0x3f));
  }
  return Uint8Array.from(bytes);
}

/** Ein PDF-String: Klammern und Rückstrich maskiert, damit Text nie zu Befehlen wird. */
function pdfText(text: string): string {
  let aus = '';
  for (const b of winAnsi(text)) {
    if (b === 0x28 || b === 0x29 || b === 0x5c) aus += `\\${String.fromCharCode(b)}`;
    else if (b < 0x80) aus += String.fromCharCode(b);
    else aus += `\\${b.toString(8).padStart(3, '0')}`;
  }
  return `(${aus})`;
}

const zahl = (n: number) => String(Number(n.toFixed(2)));

function inhaltBauen(zeilen: PdfZeile[], schriftPt: number, randPt: number, hoehe: number) {
  const abstand = schriftPt * 1.25;
  let inhalt = `BT\n${zahl(abstand)} TL\n${zahl(randPt)} ${zahl(hoehe - randPt - schriftPt)} Td\n`;
  let schrift = '';
  zeilen.forEach((z, i) => {
    const gewuenscht = z.fett ? '/F2' : '/F1';
    if (i > 0) inhalt += 'T*\n';
    if (gewuenscht !== schrift) {
      inhalt += `${gewuenscht} ${zahl(schriftPt)} Tf\n`;
      schrift = gewuenscht;
    }
    inhalt += `${pdfText(z.text)} Tj\n`;
  });
  return `${inhalt}ET`;
}

export function pdfBauen({ titel, breitePt, zeilen, schriftPt = 8, randPt = 12 }: PdfAuftrag) {
  const hoehe = randPt * 2 + Math.max(zeilen.length, 1) * schriftPt * 1.25;
  const inhalt = inhaltBauen(zeilen, schriftPt, randPt, hoehe);
  const schrift = (name: string) =>
    `<< /Type /Font /Subtype /Type1 /BaseFont /${name} /Encoding /WinAnsiEncoding >>`;
  const objekte = [
    '<< /Type /Catalog /Pages 2 0 R /Lang (de-DE) /ViewerPreferences << /DisplayDocTitle true >> >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${zahl(breitePt)} ${zahl(hoehe)}] ` +
      '/Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>',
    schrift('Courier'),
    schrift('Courier-Bold'),
    `<< /Length ${inhalt.length} >>\nstream\n${inhalt}\nendstream`,
    `<< /Title ${pdfText(titel)} /Producer (Apotheken-Werkbank) >>`,
  ];
  // Die zweite Zeile mit vier Bytes über 0x7F sagt Programmen: Binärdatei.
  let datei = '%PDF-1.7\n%âãÏÓ\n';
  const versaetze: number[] = [];
  objekte.forEach((objekt, i) => {
    versaetze.push(datei.length);
    datei += `${i + 1} 0 obj\n${objekt}\nendobj\n`;
  });
  const verzeichnis = datei.length;
  datei += `xref\n0 ${objekte.length + 1}\n0000000000 65535 f \n`;
  for (const v of versaetze) datei += `${String(v).padStart(10, '0')} 00000 n \n`;
  datei += `trailer\n<< /Size ${objekte.length + 1} /Root 1 0 R /Info 7 0 R >>\n`;
  datei += `startxref\n${verzeichnis}\n%%EOF\n`;
  return Uint8Array.from(Buffer.from(datei, 'latin1'));
}
