import { randomInt } from 'node:crypto';
import { passwortHashen } from '../src/anmeldung.ts';

/**
 * Legt die Zugangsdaten für einen Mandanten an, so wie ein Grosshändler sie
 * einer Apotheke gibt. Das Passwort erscheint genau einmal hier; in die
 * Mandantendatei kommt nur der Hash.
 *
 * Aufruf: node scripts/mandant-anlegen.ts <kundenkennung> <name> <standard|spaet> [btm]
 */
const ZEICHEN = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';

const [kundenkennung, name, vertrag, btm] = process.argv.slice(2);
if (!kundenkennung || !name || (vertrag !== 'standard' && vertrag !== 'spaet')) {
  console.error(
    'Aufruf: node scripts/mandant-anlegen.ts <kundenkennung> <name> <standard|spaet> [btm]',
  );
  process.exit(2);
}

const passwort = Array.from({ length: 24 }, () => ZEICHEN[randomInt(ZEICHEN.length)]).join('');
const eintrag = {
  kundenkennung,
  name,
  passwortHash: await passwortHashen(passwort),
  btmErlaubnis: btm === 'btm',
  vertrag,
};
console.error(`Passwort für ${kundenkennung} (nur jetzt sichtbar): ${passwort}`);
console.log(JSON.stringify(eintrag));
