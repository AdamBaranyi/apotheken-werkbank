import type { Msv3Fehler } from './fehler.ts';

/**
 * Baut Antworten als Text. Jeder Wert geht durch xmlText(); Elementnamen
 * stammen nur aus diesem Code, nie aus der Anfrage.
 */
export const NAMENSRAUM = 'http://werkbank.example/msv3/v1.0';

export function xmlText(wert: string | number | boolean): string {
  return String(wert)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Ein Element im MSV3-Namensraum; undefined lässt es weg (optionales Feld). */
export function el(name: string, wert: string | number | boolean | undefined): string {
  return wert === undefined ? '' : `<m:${name}>${xmlText(wert)}</m:${name}>`;
}

/** Ein Element mit fertigem Inhalt aus anderen el()- oder gruppe()-Aufrufen. */
export function gruppe(name: string, inhalt: string): string {
  return `<m:${name}>${inhalt}</m:${name}>`;
}

export function umschlag(koerper: string): string {
  return (
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" ' +
    `xmlns:m="${NAMENSRAUM}"><soapenv:Body>${koerper}</soapenv:Body></soapenv:Envelope>`
  );
}

export function fault(fehler: Msv3Fehler): string {
  const detail = gruppe(
    'msv3Fehler',
    el('exceptiontyp', fehler.exceptiontyp) +
      el('errorCode', fehler.errorCode) +
      el('technischerText', fehler.technischerText) +
      el('endanwenderText', fehler.endanwenderText),
  );
  return umschlag(
    '<soapenv:Fault>' +
      `<faultcode>soapenv:${fehler.seite}</faultcode>` +
      `<faultstring xml:lang="de">${xmlText(fehler.endanwenderText)}</faultstring>` +
      `<detail>${detail}</detail>` +
      '</soapenv:Fault>',
  );
}
