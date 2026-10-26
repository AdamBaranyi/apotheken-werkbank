import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { validierungsfehler } from './fehler.ts';

/**
 * Liest einen SOAP-1.1-Umschlag. Ein SOAP-Dokument darf keine DTD enthalten
 * (SOAP 1.1, Kap. 3); hier wird jede Anfrage mit DOCTYPE oder ENTITY vor dem
 * Parsen abgewiesen – damit gibt es weder externe Entitäten noch
 * Entitäten-Bomben. Werte bleiben Zeichenketten (eine PZN mit führender Null
 * bleibt so erhalten); Zahlen prüft danach Zod.
 */
const LISTEN = new Set(['artikel', 'auftrag', 'position']);

const parser = new XMLParser({
  ignoreAttributes: true,
  removeNSPrefix: true,
  parseTagValue: false,
  trimValues: true,
  processEntities: true,
  htmlEntities: false,
  isArray: (name) => LISTEN.has(name),
});

export interface Aufruf {
  funktion: string;
  inhalt: unknown;
}

function objekt(wert: unknown): Record<string, unknown> | null {
  return typeof wert === 'object' && wert !== null && !Array.isArray(wert)
    ? (wert as Record<string, unknown>)
    : null;
}

export function umschlagLesen(xml: string): Aufruf {
  if (/<!(DOCTYPE|ENTITY)/i.test(xml)) {
    throw validierungsfehler('V-DTD', 'Die Anfrage ist ungültig.', 'DTD in SOAP nicht erlaubt');
  }
  if (XMLValidator.validate(xml) !== true) {
    throw validierungsfehler('V-XML', 'Die Anfrage ist ungültig.', 'XML nicht wohlgeformt');
  }
  const dokument = objekt(parser.parse(xml));
  const koerper = objekt(objekt(dokument?.Envelope)?.Body);
  const namen = Object.keys(koerper ?? {});
  if (!koerper || namen.length !== 1 || !namen[0]) {
    throw validierungsfehler(
      'V-UMSCHLAG',
      'Die Anfrage ist ungültig.',
      'Body mit genau einem Element erwartet',
    );
  }
  const funktion = namen[0];
  const inhalt = koerper[funktion];
  return { funktion, inhalt: inhalt === '' ? {} : inhalt };
}
