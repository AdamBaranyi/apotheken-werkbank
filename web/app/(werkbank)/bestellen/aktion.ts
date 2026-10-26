'use server';

import { z } from 'zod';
import { arbeitsplatzLaden } from '@/lib/apotheke';
import { verfuegbarkeitAnfragen } from '@/lib/msv3/anfragen';
import { Msv3Fehler } from '@/lib/msv3/client';
import type { Anteil } from '@/lib/msv3/schema';
import { zugangLaden } from '@/lib/zugang';

export interface PruefStand {
  mengen: Record<string, number>;
  ergebnisse?: Record<string, Anteil[]>;
  spezifisch?: boolean;
  fehler?: string;
}

const eingabe = z.object({
  zugangId: z.uuid(),
  positionen: z
    .array(z.object({ pzn: z.string().regex(/^\d{8}$/), menge: z.number().int().min(1).max(9999) }))
    .min(1, 'Bitte bei mindestens einem Artikel eine Menge eintragen.')
    .max(50, 'Höchstens 50 Artikel je Anfrage.'),
});

function positionenLesen(form: FormData) {
  const positionen: { pzn: string; menge: number }[] = [];
  for (const [schluessel, wert] of form.entries()) {
    const pzn = /^menge-(\d{8})$/.exec(schluessel)?.[1];
    const menge = Number(wert);
    if (pzn && String(wert).trim() !== '' && Number.isFinite(menge) && menge > 0) {
      positionen.push({ pzn, menge: Math.floor(menge) });
    }
  }
  return positionen;
}

/** Verfügbarkeit beim Grosshändler anfragen (unverbindlich, reserviert nichts). */
export async function pruefen(_vorher: PruefStand, form: FormData): Promise<PruefStand> {
  const platz = await arbeitsplatzLaden();
  const positionen = positionenLesen(form);
  const mengen = Object.fromEntries(positionen.map((p) => [p.pzn, p.menge]));
  if (!platz) return { mengen, fehler: 'Dieses Konto gehört zu keiner Apotheke.' };
  const geprueft = eingabe.safeParse({ zugangId: form.get('zugangId'), positionen });
  if (!geprueft.success) {
    return { mengen, fehler: geprueft.error.issues[0]?.message ?? 'Eingabe ungültig.' };
  }
  try {
    const zugang = await zugangLaden(geprueft.data.zugangId);
    if (!zugang)
      return { mengen, fehler: 'Diesen Grosshändler-Zugang gibt es für Ihre Apotheke nicht.' };
    const antwort = await verfuegbarkeitAnfragen(zugang, geprueft.data.positionen);
    const ergebnisse = Object.fromEntries(antwort.artikel.map((a) => [a.pzn, a.anteil]));
    return { mengen, ergebnisse, spezifisch: antwort.rTyp === 'Spezifisch' };
  } catch (fehler) {
    if (fehler instanceof Msv3Fehler) return { mengen, fehler: fehler.endanwenderText };
    throw fehler;
  }
}
