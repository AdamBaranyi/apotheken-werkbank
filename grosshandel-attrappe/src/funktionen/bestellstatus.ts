import { el, gruppe } from '../soap/antwort.ts';
import { Msv3Fehler } from '../soap/fehler.ts';
import { pruefen, statusAnfrage } from '../schema.ts';
import type { Funktion } from './kontext.ts';

/**
 * bestellstatusAbfragen (Kap. 6.3): Nach einem Verbindungsabbruch prüft die
 * Apotheke damit, ob eine Bestellung angekommen ist, statt doppelt zu
 * bestellen. Antwort am selben Tag vollständig, danach sieben Tage nur
 * «nicht mehr verfügbar».
 */
export const bestellstatusAbfragen: Funktion = (inhalt, kontext) => {
  const anfrage = pruefen(statusAnfrage, inhalt);
  if (kontext.nachtbetrieb) {
    throw new Msv3Fehler(
      'ServerException',
      'S-NACHTBETRIEB',
      'Die Warenwirtschaft des Grosshändlers ist gerade nicht verfügbar (Nachtbetrieb).',
    );
  }
  const { status, antwortXml } = kontext.buch.status(
    kontext.mandant.kundenkennung,
    anfrage.bestellId,
    kontext.jetzt,
  );
  return gruppe('bestellstatusAbfragenAntwort', el('status', status) + (antwortXml ?? ''));
};
