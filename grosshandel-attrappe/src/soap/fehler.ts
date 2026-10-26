/**
 * Fehler als SOAP-Fault nach Pflichtenheft Kap. 2.3.6: Exceptiontyp,
 * Errorcode, technischer Text und eine Meldung für Endanwender. Wirft der
 * Server einen solchen Fehler, wurde die Funktion nachweislich nicht
 * ausgeführt – darauf verlässt sich der Client.
 */
export type Exceptiontyp =
  'ServerException' | 'AuthorizationException' | 'DenialOfServiceException' | 'ValidationException';

export class Msv3Fehler extends Error {
  readonly exceptiontyp: Exceptiontyp;
  readonly errorCode: string;
  readonly endanwenderText: string;

  constructor(
    exceptiontyp: Exceptiontyp,
    errorCode: string,
    endanwenderText: string,
    technischerText?: string,
  ) {
    super(technischerText ?? endanwenderText);
    this.name = 'Msv3Fehler';
    this.exceptiontyp = exceptiontyp;
    this.errorCode = errorCode;
    this.endanwenderText = endanwenderText;
  }

  get technischerText(): string {
    return this.message;
  }

  /** Client-Fehler (Anfrage falsch) oder Server-Fehler, für den SOAP-faultcode. */
  get seite(): 'Client' | 'Server' {
    return this.exceptiontyp === 'ServerException' ? 'Server' : 'Client';
  }
}

export function validierungsfehler(code: string, text: string, technisch?: string): Msv3Fehler {
  return new Msv3Fehler('ValidationException', code, text, technisch);
}
