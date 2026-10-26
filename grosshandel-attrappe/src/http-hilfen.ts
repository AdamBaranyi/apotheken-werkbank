import type { IncomingMessage, ServerResponse } from 'node:http';

/** Kopfzeilen für jede Antwort: nichts zwischenspeichern, Typen nicht raten lassen. */
export function grundkopf(res: ServerResponse): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Referrer-Policy', 'no-referrer');
}

export function senden(
  res: ServerResponse,
  status: number,
  text: string,
  typ = 'text/xml; charset=utf-8',
  kopf: Record<string, string> = {},
): void {
  res.writeHead(status, { 'Content-Type': typ, ...kopf });
  res.end(text);
}

/**
 * Liest den Körper bis zu einer Grenze (Pflichtenheft Kap. 2.3.7: höchstens
 * 200 000 Byte). Schon ein zu grosses Content-Length reicht zur Ablehnung, ohne
 * etwas zu lesen; ohne Angabe wird beim Lesen gezählt. null heisst zu gross.
 */
export function koerperLesen(req: IncomingMessage, maxBytes: number): Promise<string | null> {
  const angegeben = Number(req.headers['content-length'] ?? Number.NaN);
  if (Number.isFinite(angegeben) && angegeben > maxBytes) return Promise.resolve(null);
  return new Promise((ok, fehler) => {
    const teile: Buffer[] = [];
    let groesse = 0;
    req.on('data', (teil: Buffer) => {
      groesse += teil.length;
      if (groesse > maxBytes) {
        req.removeAllListeners('data');
        req.resume();
        ok(null);
        return;
      }
      teile.push(teil);
    });
    req.on('end', () => ok(Buffer.concat(teile).toString('utf8')));
    req.on('error', fehler);
  });
}

/**
 * Herkunft für die Grenze der Fehlversuche. Hinter einem Proxy (Caddy) nur
 * dessen letzter Eintrag in X-Forwarded-For, und nur, wenn ausdrücklich
 * eingeschaltet – sonst könnte jeder seine Herkunft selbst setzen.
 */
export function herkunft(req: IncomingMessage, proxyVertrauen: boolean): string {
  const weitergeleitet = req.headers['x-forwarded-for'];
  if (proxyVertrauen && typeof weitergeleitet === 'string') {
    const letzte = weitergeleitet.split(',').at(-1)?.trim();
    if (letzte) return letzte;
  }
  return req.socket.remoteAddress ?? 'unbekannt';
}
