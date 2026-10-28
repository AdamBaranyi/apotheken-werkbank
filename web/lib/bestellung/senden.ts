import 'server-only';
import { bestellen, bestellstatusAbfragen, type Bestellauftrag } from '@/lib/msv3/anfragen';
import { Msv3Fehler } from '@/lib/msv3/client';
import { zugangLaden } from '@/lib/zugang';
import { ausAntwort, ausFehler, ausStatus, type Ergebnis } from './status';

/** Sendet die Bestellung und übersetzt Antwort oder Fehler in einen Status. */
export async function sendenUndAuswerten(
  zugangId: string,
  auftrag: Bestellauftrag,
): Promise<Ergebnis> {
  try {
    const zugang = await zugangLaden(zugangId);
    if (!zugang) {
      return {
        status: 'abgelehnt',
        meldung: 'Diesen Grosshändler-Zugang gibt es für Ihre Apotheke nicht.',
        antwort: null,
      };
    }
    return ausAntwort(await bestellen(zugang, auftrag));
  } catch (fehler) {
    if (fehler instanceof Msv3Fehler) return ausFehler(fehler);
    // Unbekannter Fehler nach dem Senden: Ob bestellt ist, weiss niemand.
    console.error('Bestellung: unerwarteter Fehler beim Senden', (fehler as Error).name);
    return {
      status: 'unklar',
      meldung:
        'Beim Senden ging etwas schief. Ob die Bestellung angekommen ist, zeigt die Statusabfrage.',
      antwort: null,
    };
  }
}

/**
 * Fragt beim Grosshändler nach. Scheitert die Abfrage selbst, bleibt die
 * Bestellung unklar: Eine gescheiterte Abfrage sagt nichts über die Bestellung.
 */
export async function statusUndAuswerten(zugangId: string, bestellId: string): Promise<Ergebnis> {
  try {
    const zugang = await zugangLaden(zugangId);
    if (!zugang) {
      return { status: 'unklar', meldung: 'Der Zugang zum Grosshändler fehlt.', antwort: null };
    }
    return ausStatus(await bestellstatusAbfragen(zugang, bestellId));
  } catch (fehler) {
    const text =
      fehler instanceof Msv3Fehler ? fehler.endanwenderText : 'Die Statusabfrage ist gescheitert.';
    return { status: 'unklar', meldung: `${text} Bitte später erneut abfragen.`, antwort: null };
  }
}
