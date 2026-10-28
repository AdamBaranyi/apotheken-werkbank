import 'server-only';
import { grosshandelBremse } from '@/lib/bremse';
import { vertragsdatenAbfragen } from '@/lib/msv3/anfragen';
import { Msv3Fehler } from '@/lib/msv3/client';
import type { Vertragsdaten } from '@/lib/msv3/schema';
import { zugangLaden } from '@/lib/zugang';

/**
 * Vertragsdaten (Bestellfenster, Touren) für die Seite «Bestellen»: je Zugang
 * höchstens alle fünf Minuten beim Grosshändler, und jede Anfrage zählt in der
 * Bremse (E23). Gemerkt wird im Speicher der Instanz; eine neue Instanz fragt
 * einmal neu. Fehler werden nicht gemerkt.
 */
const GUELTIG_MS = 5 * 60_000;
const HOECHSTENS = 200;
const gemerkt = new Map<string, { bis: number; vertrag: Vertragsdaten }>();

export async function vertragLaden(
  apothekeId: string,
  zugangId: string,
  jetzt: number = Date.now(),
): Promise<Vertragsdaten | string> {
  const schluessel = `${apothekeId}:${zugangId}`;
  const vorhanden = gemerkt.get(schluessel);
  if (vorhanden && vorhanden.bis > jetzt) return vorhanden.vertrag;
  const gebremst = await grosshandelBremse(apothekeId);
  if (gebremst) return gebremst;
  try {
    const zugang = await zugangLaden(zugangId);
    if (!zugang) return 'Der Zugang zum Grosshändler fehlt.';
    const vertrag = await vertragsdatenAbfragen(zugang);
    if (gemerkt.size >= HOECHSTENS) gemerkt.clear();
    gemerkt.set(schluessel, { bis: jetzt + GUELTIG_MS, vertrag });
    return vertrag;
  } catch (fehler) {
    if (fehler instanceof Msv3Fehler) return fehler.endanwenderText;
    throw fehler;
  }
}
