import { randomUUID } from 'node:crypto';
import { als, type Welt } from './hilfen.ts';

/** Erfundene Artikel aus daten/artikel.json, die die Kassentests brauchen. */
export const PROBATIN = '99100008'; // 3,95 €, Arzneimittel, ohne Rezept
export const FICTOLAT = '99104118'; // 12,90 €, rezeptpflichtig
export const VITAMIN = '99113703'; // 4,49 €, Lebensmittel
export const PFLASTER = '99112336'; // 11,99 €, sonstiges

export interface Gebucht {
  id: string;
  belegnummer: number;
}

export interface Zahlung {
  zahlart: 'bar' | 'karte';
  gegeben?: number;
}

export interface Position {
  pzn: string;
  menge: number;
  rezept_vorgelegt?: boolean;
}

/** Bucht einen Verkauf wie die Kasse (RPC verkauf_buchen); das Ergebnis bleibt für den Test stehen. */
export function buchen(
  w: Welt,
  wer: string,
  apotheke: string,
  positionen: Position[],
  zahlung: Zahlung = { zahlart: 'karte' },
  id: string = randomUUID(),
) {
  return als<Gebucht>(
    w,
    wer,
    'select * from public.verkauf_buchen($1, $2, $3, $4, $5::jsonb)',
    [id, apotheke, zahlung.zahlart, zahlung.gegeben ?? null, JSON.stringify(positionen)],
    { behalten: true },
  );
}

export function stornieren(w: Welt, wer: string, original: string, id: string = randomUUID()) {
  return als<Gebucht>(w, wer, 'select * from public.verkauf_stornieren($1, $2)', [id, original], {
    behalten: true,
  });
}

export async function beleg(w: Welt, wer: string, id: string) {
  const { zeilen } = await als<{
    summe_cent: number;
    rueckgeld_cent: number | null;
    storniert_durch: string | null;
  }>(
    w,
    wer,
    'select summe_cent, rueckgeld_cent, storniert_durch from public.belege where id = $1',
    [id],
  );
  return zeilen[0];
}
