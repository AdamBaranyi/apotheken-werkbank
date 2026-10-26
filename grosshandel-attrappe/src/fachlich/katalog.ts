import { z } from 'zod';
import daten from '../../../daten/artikel.json' with { type: 'json' };
import { istGueltigePzn } from './pzn.ts';
import type { Artikel } from './typen.ts';

/*
 * Eine Quelle für beide Hälften: daten/artikel.json liefert dem Grosshandel
 * den Bestand und der Web-App die Artikel der Apotheke. Geprüft beim Laden,
 * damit ein Tippfehler in der Datei nicht still als Bestand 0 durchgeht.
 */
const grosshandelSchema = z.object({
  bestand: z.number().int().min(0),
  verbundBestand: z.number().int().min(0),
  nachlieferbar: z.boolean(),
  lagerartikel: z.boolean(),
  btm: z.boolean(),
  sperre: z.enum(['NurDirekt', 'AusserHandel', 'NichtGefuehrt', 'Transportausschluss']).optional(),
});

const artikelSchema = z.object({
  pzn: z.string().refine(istGueltigePzn, 'PZN mit falscher Prüfziffer'),
  name: z.string().min(1),
  packung: z.string().min(1),
  grosshandel: grosshandelSchema,
});

const dateiSchema = z.object({ artikel: z.array(artikelSchema).min(1) });

export function katalogLaden(roh: unknown = daten): Artikel[] {
  const geprueft = dateiSchema.parse(roh);
  const pzns = new Set<string>();
  return geprueft.artikel.map((a) => {
    if (pzns.has(a.pzn)) throw new Error(`PZN doppelt im Katalog: ${a.pzn}`);
    pzns.add(a.pzn);
    const { sperre, ...rest } = a.grosshandel;
    return { pzn: a.pzn, name: `${a.name}, ${a.packung}`, ...rest, ...(sperre ? { sperre } : {}) };
  });
}
