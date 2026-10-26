import { Bestellbuch } from './fachlich/bestellbuch.ts';
import { katalogLaden } from './fachlich/katalog.ts';
import { Lager } from './fachlich/lager.ts';
import { konfigurationLesen } from './konfiguration.ts';
import { serverErzeugen } from './server.ts';

const konfiguration = konfigurationLesen();
const server = serverErzeugen({
  mandanten: konfiguration.mandanten,
  lager: new Lager(katalogLaden()),
  buch: new Bestellbuch(),
  nachtbetrieb: konfiguration.nachtbetrieb,
  proxyVertrauen: konfiguration.proxyVertrauen,
  // Ein Eintrag je Anfrage: Pfad, Status, Mandant, Dauer. Nie Körper oder Passwörter.
  protokoll: (eintrag) => console.log(JSON.stringify(eintrag)),
});

server.listen(konfiguration.port, konfiguration.host, () => {
  console.log(
    `Grosshandel-Attrappe auf http://${konfiguration.host}:${konfiguration.port} ` +
      `(${konfiguration.mandanten.length} Mandanten)`,
  );
});

function beenden() {
  server.close(() => process.exit(0));
}
process.on('SIGTERM', beenden);
process.on('SIGINT', beenden);
