import 'server-only';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/**
 * Passwörter der Grosshändler-Zugänge: AES-256-GCM, Schlüssel nur in der
 * Umgebung des Servers. In der Datenbank liegt «v1:iv:tag:geheimtext»; wer nur
 * die Datenbank hat, hat kein Passwort, wer nur den Schlüssel hat, auch nicht.
 */
export function verschluesseln(klartext: string, schluessel: Buffer): string {
  const iv = randomBytes(12);
  const chiffre = createCipheriv('aes-256-gcm', schluessel, iv);
  const geheim = Buffer.concat([chiffre.update(klartext, 'utf8'), chiffre.final()]);
  const tag = chiffre.getAuthTag();
  return ['v1', iv.toString('base64'), tag.toString('base64'), geheim.toString('base64')].join(':');
}

export function entschluesseln(gespeichert: string, schluessel: Buffer): string {
  const [version, iv, tag, geheim] = gespeichert.split(':');
  if (version !== 'v1' || !iv || !tag || !geheim) throw new Error('Unbekanntes Format');
  const entschluesselung = createDecipheriv('aes-256-gcm', schluessel, Buffer.from(iv, 'base64'));
  entschluesselung.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([
    entschluesselung.update(Buffer.from(geheim, 'base64')),
    entschluesselung.final(),
  ]).toString('utf8');
}
