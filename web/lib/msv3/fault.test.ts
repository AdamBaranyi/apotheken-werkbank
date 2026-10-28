import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { aufrufen, type Msv3Fehler, type Zugang } from './client';

/*
 * Ein SOAP-Fault ohne MSV3-Angaben (etwa von einem Proxy vor dem Grosshändler)
 * sagt nicht, ob die Funktion ausgeführt wurde. Er darf darum nicht als
 * ServerException gelten, die «nicht ausgeführt» heisst: Eine Bestellung
 * hiesse sonst «abgelehnt», obwohl sie vielleicht angekommen ist.
 */
let server: Server;
let zugang: Zugang;
let antwort = '';

const fault = (detail: string) =>
  '<?xml version="1.0" encoding="UTF-8"?>' +
  '<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body><s:Fault>' +
  `<faultcode>s:Server</faultcode><faultstring>Fehler</faultstring>${detail}` +
  '</s:Fault></s:Body></s:Envelope>';

const msv3 = (typ: string) =>
  `<detail><msv3Fehler><exceptiontyp>${typ}</exceptiontyp><errorCode>S1</errorCode>` +
  '<endanwenderText>Wartung.</endanwenderText></msv3Fehler></detail>';

beforeAll(async () => {
  server = createServer((_anfrage, a) => {
    a.writeHead(500, { 'Content-Type': 'text/xml; charset=utf-8' }).end(antwort);
  });
  await new Promise<void>((bereit) => server.listen(0, '127.0.0.1', bereit));
  const basisUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/msv3`;
  zugang = { basisUrl, kundenkennung: 'kunde', passwort: 'passwort' };
  process.env.SUPABASE_URL = 'http://127.0.0.1:54401';
  process.env.SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_test';
  process.env.ZUGANG_SCHLUESSEL = Buffer.alloc(32).toString('base64');
  process.env.GROSSHANDEL_ERLAUBT = basisUrl;
});
afterAll(() => {
  server.close();
});

async function fehlerBei(xml: string): Promise<Msv3Fehler> {
  antwort = xml;
  return (await aufrufen(zugang, 'bestellen', '', false).catch((e: unknown) => e)) as Msv3Fehler;
}

describe('SOAP-Fault', () => {
  it('ohne MSV3-Angaben: ClientException C-FAULT statt ServerException', async () => {
    const f = await fehlerBei(fault(''));
    expect([f.exceptiontyp, f.errorCode]).toEqual(['ClientException', 'C-FAULT']);
    expect(f.endanwenderText).toBe('Der Grosshändler meldet einen Fehler ohne nähere Angaben.');
  });

  it('mit einem Typ, den MSV3 nicht kennt: ebenso', async () => {
    for (const typ of ['Erfunden', 'TimeoutException', '']) {
      const f = await fehlerBei(fault(msv3(typ)));
      expect([f.exceptiontyp, f.errorCode], typ).toEqual(['ClientException', 'C-FAULT']);
    }
  });

  it('mit MSV3-Angaben: der gemeldete Typ, Code und Text', async () => {
    const f = await fehlerBei(fault(msv3('ServerException')));
    expect([f.exceptiontyp, f.errorCode, f.endanwenderText]).toEqual([
      'ServerException',
      'S1',
      'Wartung.',
    ]);
  });
});
