import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { als, alsBesitzer, poolSchliessen, weltAbbauen, weltBauen, type Welt } from './hilfen.ts';

/*
 * Flow-Monitor: Die Engine meldet ihre Läufe mit einem eigenen Konto. Ein
 * Engine-Konto ist kein Mitglied: Es darf Läufe und Bildschirmfotos seiner
 * Apotheke melden und sonst nichts, nicht einmal die eigenen Läufe lesen.
 * Lesen dürfen die Mitglieder der Apotheke. Läufe werden nie geändert.
 */
let w: Welt;
let engineNord: string;
let engineSued: string;

async function engineKonto(apotheke: string): Promise<string> {
  const id = randomUUID();
  await alsBesitzer(
    w,
    `insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
     values ($1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', $2, '', now(), now())`,
    [id, `engine.${id}@werkbank.test`],
  );
  await alsBesitzer(
    w,
    `insert into public.engine_konten (user_id, apotheke_id, bezeichnung) values ($1, $2, 'Kasse 1')`,
    [id, apotheke],
  );
  return id;
}

function lauf(id = randomUUID(), bericht: unknown = { schritte: [] }) {
  return [id, `L-20261029-120000-${'K7QX'}`, JSON.stringify(bericht)] as const;
}

const MELDEN = `insert into public.engine_laeufe
  (id, lauf, flow, kasse, status, kennung, beginn, dauer_ms, treiber, heilungen, bericht)
  values ($1, $2, 'verkauf', 'nord', 'ok', 'K7-QX4M', now(), 4200, 'windows', 0, $3::jsonb)`;

beforeEach(async () => {
  w = await weltBauen();
  engineNord = await engineKonto(w.nord);
  engineSued = await engineKonto(w.sued);
});
afterEach(async () => {
  await weltAbbauen(w);
});
afterAll(async () => {
  await poolSchliessen();
});

describe('Engine-Konto', () => {
  it('meldet einen Lauf; die Apotheke und wer meldete setzt die Datenbank', async () => {
    const id = randomUUID();
    const gemeldet = await als(w, engineNord, MELDEN, [...lauf(id)], { behalten: true });
    expect(gemeldet.fehler).toBeUndefined();
    const { zeilen } = await als<{ apotheke_id: string; gemeldet_von: string }>(
      w,
      w.inhaberNord,
      'select apotheke_id, gemeldet_von from public.engine_laeufe where id = $1',
      [id],
    );
    expect(zeilen).toEqual([{ apotheke_id: w.nord, gemeldet_von: engineNord }]);
  });

  it('kann keine Apotheke angeben, also keinen Lauf für eine fremde melden', async () => {
    const { fehler } = await als(
      w,
      engineNord,
      `insert into public.engine_laeufe (id, apotheke_id, lauf, flow, kasse, status, beginn, dauer_ms, treiber, bericht)
       values ($1, $2, 'L-20261029-120000-K7QX', 'verkauf', 'nord', 'ok', now(), 1, 'fake', '{}')`,
      [randomUUID(), w.sued],
    );
    expect(fehler).toBe('42501');
  });

  it('liest weder Läufe noch Belege, Bestellungen oder Zugänge', async () => {
    await als(w, engineNord, MELDEN, [...lauf()], { behalten: true });
    for (const tabelle of [
      'engine_laeufe',
      'belege',
      'bestellungen',
      'grosshaendler_zugaenge',
      'mitglieder',
    ]) {
      const { zeilen } = await als(w, engineNord, `select 1 from public.${tabelle}`);
      expect(zeilen, tabelle).toHaveLength(0);
    }
  });

  it('meldet dieselbe Laufkennung nur einmal', async () => {
    await als(w, engineNord, MELDEN, [...lauf()], { behalten: true });
    const { fehler } = await als(w, engineNord, MELDEN, [...lauf()]);
    expect(fehler).toBe('23505');
  });

  it('meldet ein Foto nur zu einem Lauf der eigenen Apotheke', async () => {
    const eigen = randomUUID();
    const fremd = randomUUID();
    await als(w, engineNord, MELDEN, [...lauf(eigen)], { behalten: true });
    await als(w, engineSued, MELDEN, [...lauf(fremd)], { behalten: true });
    const FOTO = `insert into public.engine_fotos (lauf_id, art, inhalt) values ($1, 'text', $2)`;
    expect(
      (await als(w, engineNord, FOTO, [eigen, Buffer.from('PZN 99100008')])).fehler,
    ).toBeUndefined();
    expect((await als(w, engineNord, FOTO, [fremd, Buffer.from('fremd')])).fehler).toBe('23503');
  });

  it('hält die Grössen ein: Bericht bis 200 kB, Foto bis 1 MB', async () => {
    const gross = { text: 'x'.repeat(210_000) };
    expect((await als(w, engineNord, MELDEN, [...lauf(randomUUID(), gross)])).fehler).toBe('23514');
    const id = randomUUID();
    await als(w, engineNord, MELDEN, [...lauf(id)], { behalten: true });
    const { fehler } = await als(
      w,
      engineNord,
      `insert into public.engine_fotos (lauf_id, art, inhalt) values ($1, 'png', $2)`,
      [id, Buffer.alloc(1_048_577)],
    );
    expect(fehler).toBe('23514');
  });
});

describe('Mitglieder', () => {
  it('sehen die Läufe und Fotos ihrer Apotheke, nicht die der anderen', async () => {
    const nord = randomUUID();
    const sued = randomUUID();
    await als(w, engineNord, MELDEN, [...lauf(nord)], { behalten: true });
    await als(w, engineSued, MELDEN, [...lauf(sued)], { behalten: true });
    await als(
      w,
      engineNord,
      `insert into public.engine_fotos (lauf_id, art, inhalt) values ($1, 'text', 'Bild')`,
      [nord],
      { behalten: true },
    );
    const laeufe = await als<{ id: string }>(
      w,
      w.inhaberNord,
      'select id from public.engine_laeufe',
    );
    expect(laeufe.zeilen.map((z) => z.id)).toEqual([nord]);
    const fotos = await als<{ lauf_id: string }>(
      w,
      w.mitarbeiterSued,
      'select lauf_id from public.engine_fotos',
    );
    expect(fotos.zeilen).toHaveLength(0);
    const fremd = await als(w, w.fremd, 'select id from public.engine_laeufe');
    expect(fremd.zeilen).toHaveLength(0);
  });

  it('melden keine Läufe', async () => {
    const { fehler } = await als(w, w.inhaberNord, MELDEN, [...lauf()]);
    expect(fehler).toBe('42501');
  });

  it('ändern und löschen keine Läufe, auch die Engine nicht', async () => {
    const id = randomUUID();
    await als(w, engineNord, MELDEN, [...lauf(id)], { behalten: true });
    for (const wer of [w.inhaberNord, engineNord]) {
      const aendern = await als(
        w,
        wer,
        `update public.engine_laeufe set status = 'ok' where id = $1`,
        [id],
      );
      expect(aendern.fehler).toBe('42501');
      const loeschen = await als(w, wer, 'delete from public.engine_laeufe where id = $1', [id]);
      expect(loeschen.fehler).toBe('42501');
    }
  });
});

describe('ohne Anmeldung', () => {
  it('sieht und meldet nichts', async () => {
    for (const tabelle of ['engine_konten', 'engine_laeufe', 'engine_fotos']) {
      expect((await als(w, 'anon', `select 1 from public.${tabelle}`)).fehler, tabelle).toBe(
        '42501',
      );
    }
    expect((await als(w, 'anon', MELDEN, [...lauf()])).fehler).toBe('42501');
  });
});
