import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { entschluesseln, verschluesseln } from './verschluesselung';

describe('Verschlüsselung der Grosshändler-Passwörter', () => {
  const schluessel = randomBytes(32);

  it('ergibt nach dem Entschlüsseln wieder den Klartext', () => {
    const gespeichert = verschluesseln('geheimesPasswort123', schluessel);
    expect(gespeichert.startsWith('v1:')).toBe(true);
    expect(gespeichert).not.toContain('geheimesPasswort123');
    expect(entschluesseln(gespeichert, schluessel)).toBe('geheimesPasswort123');
  });

  it('verschlüsselt denselben Text jedes Mal anders (zufälliger IV)', () => {
    expect(verschluesseln('gleich', schluessel)).not.toBe(verschluesseln('gleich', schluessel));
  });

  it('scheitert mit einem anderen Schlüssel', () => {
    const gespeichert = verschluesseln('geheim', schluessel);
    expect(() => entschluesseln(gespeichert, randomBytes(32))).toThrow();
  });

  it('merkt, wenn der Geheimtext verändert wurde', () => {
    const [v, iv, tag, text] = verschluesseln('geheim', schluessel).split(':') as [
      string,
      string,
      string,
      string,
    ];
    const gekippt = Buffer.from(text, 'base64');
    gekippt[0] = (gekippt[0] ?? 0) ^ 1;
    expect(() =>
      entschluesseln([v, iv, tag, gekippt.toString('base64')].join(':'), schluessel),
    ).toThrow();
  });

  it('lehnt einen gekürzten Prüfwert ab (immer 16 Byte)', () => {
    const [v, iv, tag, text] = verschluesseln('geheim', schluessel).split(':') as [
      string,
      string,
      string,
      string,
    ];
    const kurz = Buffer.from(tag, 'base64').subarray(0, 4).toString('base64');
    expect(() => entschluesseln([v, iv, kurz, text].join(':'), schluessel)).toThrow();
  });
});
