'use server';

import { z } from 'zod';
import { arbeitsplatzLaden } from '@/lib/apotheke';
import { grosshandelBremse } from '@/lib/bremse';
import { verfuegbarkeitAnfragen } from '@/lib/msv3/anfragen';
import { Msv3Fehler } from '@/lib/msv3/client';
import type { Anteil } from '@/lib/msv3/schema';
import { zugangLaden } from '@/lib/zugang';
import { positionenLesen, positionenSchema } from './eingabe';

export interface PruefStand {
  mengen: Record<string, number>;
  ergebnisse?: Record<string, Anteil[]>;
  spezifisch?: boolean;
  fehler?: string;
}

const eingabe = z.object({ zugangId: z.uuid(), positionen: positionenSchema });

/** Verfügbarkeit beim Grosshändler anfragen (unverbindlich, reserviert nichts). */
export async function pruefen(_vorher: PruefStand, form: FormData): Promise<PruefStand> {
  const platz = await arbeitsplatzLaden();
  const positionen = positionenLesen(form);
  const mengen = Object.fromEntries(
    positionen.filter((p) => Number.isFinite(p.menge)).map((p) => [p.pzn, p.menge]),
  );
  if (!platz) return { mengen, fehler: 'Dieses Konto gehört zu keiner Apotheke.' };
  const geprueft = eingabe.safeParse({ zugangId: form.get('zugangId'), positionen });
  if (!geprueft.success) {
    return { mengen, fehler: geprueft.error.issues[0]?.message ?? 'Eingabe ungültig.' };
  }
  const gebremst = await grosshandelBremse(platz.apotheke.id);
  if (gebremst) return { mengen, fehler: gebremst };
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
