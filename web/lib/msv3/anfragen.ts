import 'server-only';
import { aufrufen, Msv3Fehler, xmlText, type Zugang } from './client';
import {
  verfuegbarkeitSchema,
  vertragsdatenSchema,
  type Verfuegbarkeit,
  type Vertragsdaten,
} from './schema';

/** Kennung dieser Software, die jede Anfrage mitschickt (Pflichtenheft Kap. 2.3.3). */
const SOFTWARE = 'Apotheken-Werkbank 0.1';

function geprueft<T>(
  schema: { safeParse: (x: unknown) => { success: boolean; data?: T } },
  wert: unknown,
): T {
  const ergebnis = schema.safeParse(wert);
  if (!ergebnis.success || ergebnis.data === undefined) {
    throw new Msv3Fehler(
      'ClientException',
      'C-SCHEMA',
      'Antwort des Grosshändlers hat ein unerwartetes Format.',
    );
  }
  return ergebnis.data;
}

export async function vertragsdatenAbfragen(zugang: Zugang): Promise<Vertragsdaten> {
  const inhalt = `<m:clientSoftwareKennung>${xmlText(SOFTWARE)}</m:clientSoftwareKennung>`;
  const antwort = await aufrufen(zugang, 'vertragsdatenAbfragen', inhalt, true);
  return geprueft(vertragsdatenSchema, antwort).vertragsdaten;
}

export interface Anfrageposition {
  pzn: string;
  menge: number;
}

export async function verfuegbarkeitAnfragen(
  zugang: Zugang,
  positionen: readonly Anfrageposition[],
): Promise<Verfuegbarkeit> {
  const artikel = positionen
    .map(
      (p) =>
        `<m:artikel><m:pzn>${xmlText(p.pzn)}</m:pzn><m:menge>${xmlText(p.menge)}</m:menge></m:artikel>`,
    )
    .join('');
  const inhalt = `<m:clientSoftwareKennung>${xmlText(SOFTWARE)}</m:clientSoftwareKennung>${artikel}`;
  const antwort = await aufrufen(zugang, 'verfuegbarkeitAnfragen', inhalt, true);
  return geprueft(verfuegbarkeitSchema, antwort);
}
