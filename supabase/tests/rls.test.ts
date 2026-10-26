import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { als, poolSchliessen, weltAbbauen, weltBauen, type Welt } from './hilfen.ts';

/*
 * Rechte je Apotheke, geprüft gegen die echte Datenbank mit denselben Rollen
 * wie in Supabase. 42501 heisst «keine Berechtigung». Eine Zeile, die RLS
 * ausblendet, fehlt einfach – darum zählen die Tests Zeilen, nicht nur Fehler.
 */
let w: Welt;
beforeEach(async () => {
  w = await weltBauen();
});
afterEach(async () => {
  await weltAbbauen(w);
});
afterAll(async () => {
  await poolSchliessen();
});

describe('ohne Anmeldung', () => {
  it('sieht nichts: Apotheken, Mitglieder, Artikel, Zugänge', async () => {
    for (const tabelle of ['apotheken', 'mitglieder', 'artikel', 'grosshaendler_zugaenge']) {
      const { fehler } = await als(w, 'anon', `select 1 from public.${tabelle} limit 1`);
      expect(fehler, tabelle).toBe('42501');
    }
  });

  it('darf die Funktion für Zugangsdaten nicht aufrufen', async () => {
    const { fehler } = await als(w, 'anon', 'select * from public.zugang_fuer_bestellung($1)', [
      w.zugangNord,
    ]);
    expect(fehler).toBe('42501');
  });
});

describe('Mitglied einer Apotheke', () => {
  it('sieht nur die eigene Apotheke und ihre Mitglieder', async () => {
    const apotheken = await als<{ id: string }>(
      w,
      w.inhaberNord,
      'select id from public.apotheken',
    );
    expect(apotheken.zeilen.map((z) => z.id)).toEqual([w.nord]);
    const mitglieder = await als<{ apotheke_id: string }>(
      w,
      w.inhaberNord,
      'select apotheke_id from public.mitglieder',
    );
    expect(mitglieder.zeilen.map((z) => z.apotheke_id)).toEqual([w.nord]);
  });

  it('sieht die Zugänge der eigenen Apotheke, aber nie das verschlüsselte Passwort', async () => {
    const sichtbar = await als<{ id: string }>(
      w,
      w.inhaberNord,
      'select id, kundenkennung from public.grosshaendler_zugaenge',
    );
    expect(sichtbar.zeilen.map((z) => z.id)).toEqual([w.zugangNord]);
    const passwort = await als(
      w,
      w.inhaberNord,
      'select passwort_verschluesselt from public.grosshaendler_zugaenge',
    );
    expect(passwort.fehler).toBe('42501');
  });

  it('bekommt das verschlüsselte Passwort nur über die Funktion und nur für die eigene Apotheke', async () => {
    const eigen = await als<{ passwort_verschluesselt: string }>(
      w,
      w.inhaberNord,
      'select passwort_verschluesselt from public.zugang_fuer_bestellung($1)',
      [w.zugangNord],
    );
    expect(eigen.zeilen[0]?.passwort_verschluesselt).toBe('v1:geheim-nord');
    const fremd = await als(w, w.inhaberNord, 'select * from public.zugang_fuer_bestellung($1)', [
      w.zugangSued,
    ]);
    expect(fremd.zeilen).toEqual([]);
  });

  it('kann weder Apotheken noch Mitgliedschaften anlegen', async () => {
    const apotheke = await als(
      w,
      w.inhaberNord,
      "insert into public.apotheken (name) values ('Neu')",
    );
    expect(apotheke.fehler).toBe('42501');
    const mitglied = await als(
      w,
      w.inhaberNord,
      "insert into public.mitglieder (apotheke_id, user_id, rolle) values ($1, $2, 'inhaber')",
      [w.sued, w.inhaberNord],
    );
    expect(mitglied.fehler).toBe('42501');
  });
});

describe('Zugänge verwalten', () => {
  const neu =
    "insert into public.grosshaendler_zugaenge (apotheke_id, bezeichnung, basis_url, kundenkennung, passwort_verschluesselt) values ($1, 'Neu', 'https://gh.test/msv3', 'neu1', 'v1:x') returning id";

  it('der Inhaber legt einen Zugang für die eigene Apotheke an', async () => {
    const ergebnis = await als(w, w.inhaberNord, neu, [w.nord]);
    expect(ergebnis.fehler).toBeUndefined();
    expect(ergebnis.zeilen).toHaveLength(1);
  });

  it('niemand legt einen Zugang für eine fremde Apotheke an', async () => {
    expect((await als(w, w.inhaberNord, neu, [w.sued])).fehler).toBe('42501');
    expect((await als(w, w.fremd, neu, [w.nord])).fehler).toBe('42501');
  });

  it('ein Mitarbeiter legt keinen Zugang an, auch nicht für die eigene Apotheke', async () => {
    expect((await als(w, w.mitarbeiterSued, neu, [w.sued])).fehler).toBe('42501');
  });

  it('ein Zugang lässt sich nicht in eine fremde Apotheke verschieben', async () => {
    const verschieben = await als(
      w,
      w.inhaberNord,
      'update public.grosshaendler_zugaenge set apotheke_id = $1 where id = $2',
      [w.sued, w.zugangNord],
    );
    expect(verschieben.fehler).toBe('42501');
  });

  it('fremde Zugänge lassen sich weder ändern noch löschen', async () => {
    const aendern = await als<{ id: string }>(
      w,
      w.inhaberNord,
      "update public.grosshaendler_zugaenge set bezeichnung = 'gekapert' where id = $1 returning id",
      [w.zugangSued],
    );
    expect(aendern.zeilen).toEqual([]);
    const loeschen = await als<{ id: string }>(
      w,
      w.inhaberNord,
      'delete from public.grosshaendler_zugaenge where id = $1 returning id',
      [w.zugangSued],
    );
    expect(loeschen.zeilen).toEqual([]);
  });
});

describe('Artikel', () => {
  it('angemeldete Benutzer lesen den Katalog, ändern ihn aber nicht', async () => {
    const lesen = await als<{ anzahl: string }>(
      w,
      w.fremd,
      'select count(*) as anzahl from public.artikel',
    );
    expect(Number(lesen.zeilen[0]?.anzahl)).toBeGreaterThan(0);
    const aendern = await als(w, w.inhaberNord, "update public.artikel set name = 'x'");
    expect(aendern.fehler).toBe('42501');
  });
});

describe('ohne Mitgliedschaft', () => {
  it('sieht keine Apotheke und keinen Zugang', async () => {
    expect((await als(w, w.fremd, 'select id from public.apotheken')).zeilen).toEqual([]);
    expect((await als(w, w.fremd, 'select id from public.grosshaendler_zugaenge')).zeilen).toEqual(
      [],
    );
  });
});
