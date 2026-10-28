/**
 * Liste der Sabotagen: Datei, Suchtext, Ersatz und die Tests, die es merken
 * müssen. Neue Schutzfunktion, neuer Eintrag – in derselben Änderung.
 */
const A = 'grosshandel-attrappe';

export const SABOTAGEN = [
  {
    name: 'DTD wird nicht mehr abgewiesen',
    datei: `${A}/src/soap/umschlag.ts`,
    suche: 'if (/<!(DOCTYPE|ENTITY)/i.test(xml)) {',
    ersatz: 'if (false && /<!(DOCTYPE|ENTITY)/i.test(xml)) {',
    tests: [`${A}/test/server.test.ts`],
  },
  {
    name: 'Fehlversuche werden nicht gezählt',
    datei: `${A}/src/server.ts`,
    suche: 'fehlversuche.zaehlen(quelle, jetzt.getTime());',
    ersatz: 'void quelle;',
    tests: [`${A}/test/server.test.ts`],
  },
  {
    name: 'Grösse wird nicht begrenzt',
    datei: `${A}/src/server.ts`,
    suche: 'const MAX_BYTES = 200_000;',
    ersatz: 'const MAX_BYTES = 2_000_000;',
    tests: [`${A}/test/server.test.ts`],
  },
  {
    name: 'Bestellbuch trennt Mandanten nicht',
    datei: `${A}/src/fachlich/bestellbuch.ts`,
    suche: 'const eintrag = this.#bestellungen.get(`${kundenkennung}|${bestellId}`);',
    ersatz:
      'const eintrag = [...this.#bestellungen].find(([k]) => k.endsWith(`|${bestellId}`))?.[1];',
    tests: [`${A}/test/server.test.ts`],
  },
  {
    name: 'Funktion wird unter fremder Adresse angenommen',
    datei: `${A}/src/server.ts`,
    suche: 'if (aufruf.funktion !== funktionsname) {',
    ersatz: 'if (false) {',
    tests: [`${A}/test/server.test.ts`],
  },
  {
    name: 'Verbund ohne passende Liefervorgabe',
    datei: `${A}/src/fachlich/zuteilung.ts`,
    suche: "if (erlaubt(vorgabe, 'MaxVerbund')) {",
    ersatz: 'if (true) {',
    tests: [`${A}/test/zuteilung.test.ts`],
  },
  {
    name: 'Puffer von 59 Sekunden fehlt',
    datei: `${A}/src/fachlich/touren.ts`,
    suche: 'const PUFFER_MS = 59_000;',
    ersatz: 'const PUFFER_MS = 0;',
    tests: [`${A}/test/touren.test.ts`],
  },
  {
    name: 'PZN-Prüfziffer falsch gewichtet',
    datei: `${A}/src/fachlich/pzn.ts`,
    suche: 'summe += Number(siebenStellen[i]) * (i + 1);',
    ersatz: 'summe += Number(siebenStellen[i]) * (i + 2);',
    tests: [`${A}/test/pzn.test.ts`],
  },
  {
    name: 'Web-App ruft jede Grosshändler-Adresse auf (SSRF)',
    datei: 'web/lib/msv3/client.ts',
    suche: 'if (!umgebung().grosshandelErlaubt.includes(basisUrl)) {',
    ersatz: 'if (false) {',
    tests: ['web/lib/msv3/client.test.ts'],
  },
  {
    name: 'SOAP-Fault wird nicht übersetzt',
    datei: 'web/lib/msv3/client.ts',
    suche: '  if (fault) {',
    ersatz: '  if (false && fault) {',
    tests: ['web/lib/msv3/client.test.ts'],
  },
  {
    name: 'GCM nimmt gekürzte Prüfwerte an',
    datei: 'web/lib/verschluesselung.ts',
    suche: 'const GCM = { authTagLength: 16 } as const;',
    ersatz: 'const GCM = {} as const;',
    tests: ['web/lib/verschluesselung.test.ts'],
  },
  {
    name: 'Falscher Schlüssel bringt die Seite zum Absturz',
    datei: 'web/lib/zugang.ts',
    suche: '  } catch {\n    throw new Msv3Fehler(',
    ersatz: '  } catch (roh) {\n    if (roh) throw roh;\n    throw new Msv3Fehler(',
    tests: ['web/lib/zugang.test.ts'],
  },
  {
    name: 'Abmelden nimmt fremde Herkunft an',
    datei: 'web/lib/herkunft.ts',
    suche: 'return new URL(origin).host === host;',
    ersatz: 'return true;',
    tests: ['web/lib/herkunft.test.ts'],
  },
  {
    name: 'Server-Aktionen ohne Sitzung werden umgeleitet (#1)',
    datei: 'web/lib/zutritt.ts',
    suche: '&& !serverAktion;',
    ersatz: ';',
    tests: ['web/lib/zutritt.test.ts'],
  },
  {
    name: 'Deploy baut ohne frische Basis-Abbilder',
    datei: 'infra/deploy.sh',
    suche: 'docker build --pull -f',
    ersatz: 'docker build -f',
    tests: ['tests/deploy-skript.test.ts'],
  },
  {
    name: 'Deploy läuft ohne Mandanten weiter',
    datei: 'infra/deploy.sh',
    suche: 'if [ ! -f "$WERKBANK_MANDANTEN" ]; then',
    ersatz: 'if false; then',
    tests: ['tests/deploy-skript.test.ts'],
  },
  {
    name: 'Audit schluckt den Exit-Code',
    datei: 'scripts/audit.sh',
    suche: 'bun audit --audit-level="$stufe" ${ausnahmen[@]+"${ausnahmen[@]}"}',
    ersatz: 'bun audit --audit-level="$stufe" ${ausnahmen[@]+"${ausnahmen[@]}"} || true',
    tests: ['tests/audit-skript.test.ts'],
  },
];
