-- Befunde der Durchsicht vor dem Merge (docs/SECURITY.md, «Behobene Befunde»).
--
-- 1 Gleicher Schlüssel, anderer Inhalt. Die ID eines Belegs, eines Stornos und
--   einer Bestellung stammt aus dem Seitenaufbau, damit ein Doppelklick nichts
--   doppelt bucht. Kam derselbe Schlüssel mit anderem Inhalt (nach einem
--   Abbruch den Bon geändert, mit «Zurück» zur alten Seite), lieferten die
--   Funktionen still den alten Beleg oder die alte Bestellung, als wäre der
--   neue Vorgang gebucht. Jetzt vergleichen sie den Inhalt und melden WK011
--   oder WB004 mit der Nummer des Vorhandenen.
-- 2 Die Bremse prüfte und zählte in zwei Aufrufen. Gleichzeitige Versuche
--   sahen alle denselben alten Stand und kamen zusammen über die Grenze. Jetzt
--   geschieht beides in einem Aufruf unter einer Sperre je Schlüssel.

-- 1a Kasse: gleicher Schlüssel nur mit gleicher Zahlung und gleichen Positionen.
create or replace function public.verkauf_buchen(
  p_id uuid, p_apotheke uuid, p_zahlart text, p_gegeben_cent integer, p_positionen jsonb
) returns table (id uuid, belegnummer integer)
language plpgsql security invoker set search_path = ''
as $$
#variable_conflict use_column
declare
  v_alt public.verkaeufe;
begin
  if jsonb_typeof(p_positionen) is distinct from 'array' or jsonb_array_length(p_positionen) = 0 then
    raise exception using errcode = 'WK001', message = 'Ein Beleg braucht mindestens eine Position.';
  end if;
  -- Kein «on conflict do nothing»: Der Trigger hätte den Zähler schon erhöht,
  -- und es entstünde eine Lücke in den Belegnummern.
  select * into v_alt from public.verkaeufe v where v.id = p_id;
  if found then
    -- Positionen als Mengen mit Wiederholung vergleichen, in beiden Richtungen.
    if v_alt.apotheke_id is distinct from p_apotheke
      or v_alt.storno_von is not null
      or v_alt.zahlart is distinct from p_zahlart
      or v_alt.gegeben_cent is distinct from p_gegeben_cent
      or exists (
        (select p.pzn, p.menge, p.rezept_vorgelegt
           from public.verkaufspositionen p where p.verkauf_id = p_id
         except all
         select x.pzn, x.menge, coalesce(x.rezept_vorgelegt, false)
           from jsonb_to_recordset(p_positionen) as x (pzn text, menge integer, rezept_vorgelegt boolean))
        union all
        (select x.pzn, x.menge, coalesce(x.rezept_vorgelegt, false)
           from jsonb_to_recordset(p_positionen) as x (pzn text, menge integer, rezept_vorgelegt boolean)
         except all
         select p.pzn, p.menge, p.rezept_vorgelegt
           from public.verkaufspositionen p where p.verkauf_id = p_id)
      ) then
      raise exception using errcode = 'WK011', message = format(
        'Unter diesem Vorgang ist schon Beleg %s gebucht, mit anderem Inhalt. '
        'Bitte Beleg %s prüfen und die Kasse neu laden.', v_alt.belegnummer, v_alt.belegnummer);
    end if;
    return query select v_alt.id, v_alt.belegnummer;
    return;
  end if;
  insert into public.verkaeufe (id, apotheke_id, zahlart, gegeben_cent)
    values (p_id, p_apotheke, p_zahlart, p_gegeben_cent);
  insert into public.verkaufspositionen (verkauf_id, pzn, menge, rezept_vorgelegt)
    select p_id, x.pzn, x.menge, coalesce(x.rezept_vorgelegt, false)
    from jsonb_to_recordset(p_positionen) as x (pzn text, menge integer, rezept_vorgelegt boolean);
  return query select v.id, v.belegnummer from public.verkaeufe v where v.id = p_id;
end $$;

-- 1b Storno: gleicher Schlüssel nur für dasselbe Original.
create or replace function public.verkauf_stornieren(p_id uuid, p_original uuid)
returns table (id uuid, belegnummer integer)
language plpgsql security invoker set search_path = ''
as $$
#variable_conflict use_column
declare
  v_alt public.verkaeufe;
  v_apotheke uuid;
begin
  select * into v_alt from public.verkaeufe v where v.id = p_id;
  if found then
    if v_alt.storno_von is distinct from p_original then
      raise exception using errcode = 'WK011', message = format(
        'Unter diesem Vorgang ist schon Beleg %s gebucht, für einen anderen Beleg. '
        'Bitte die Seite neu laden.', v_alt.belegnummer);
    end if;
    return query select v_alt.id, v_alt.belegnummer;
    return;
  end if;
  select o.apotheke_id into v_apotheke from public.verkaeufe o where o.id = p_original;
  if not found then
    raise exception using errcode = 'WK004', message = 'Diesen Beleg gibt es nicht.';
  end if;
  -- Zahlart, Land und Preise übernimmt der Trigger aus dem Original.
  insert into public.verkaeufe (id, apotheke_id, zahlart, storno_von)
    values (p_id, v_apotheke, 'karte', p_original);
  insert into public.verkaufspositionen (verkauf_id, pzn, menge)
    select p_id, p.pzn, -p.menge from public.verkaufspositionen p where p.verkauf_id = p_original;
  return query select v.id, v.belegnummer from public.verkaeufe v where v.id = p_id;
end $$;

-- 1c Bestellung: gleicher Schlüssel nur mit gleichem Zugang und gleichen Mengen.
create or replace function public.bestellung_anlegen(p_id uuid, p_zugang uuid, p_positionen jsonb)
returns table (id uuid, auftrag_id uuid, support_id integer, neu boolean)
language plpgsql security invoker set search_path = ''
as $$
#variable_conflict use_column
declare
  v_alt public.bestellungen;
  v_apotheke uuid;
begin
  if jsonb_typeof(p_positionen) is distinct from 'array' or jsonb_array_length(p_positionen) = 0 then
    raise exception using errcode = 'WB003', message = 'Eine Bestellung braucht mindestens eine Position.';
  end if;
  select * into v_alt from public.bestellungen b where b.id = p_id;
  if found then
    if v_alt.zugang_id is distinct from p_zugang
      or exists (
        (select p.pzn, p.menge from public.bestellpositionen p where p.bestellung_id = p_id
         except all
         select x.pzn, x.menge from jsonb_to_recordset(p_positionen) as x (pzn text, menge integer))
        union all
        (select x.pzn, x.menge from jsonb_to_recordset(p_positionen) as x (pzn text, menge integer)
         except all
         select p.pzn, p.menge from public.bestellpositionen p where p.bestellung_id = p_id)
      ) then
      raise exception using errcode = 'WB004', message = format(
        'Unter diesem Vorgang ist schon Bestellung %s angelegt, mit anderen Mengen. '
        'Bitte Bestellung %s prüfen und die Seite neu laden.', v_alt.support_id, v_alt.support_id);
    end if;
    return query select v_alt.id, v_alt.auftrag_id, v_alt.support_id, false;
    return;
  end if;
  select z.apotheke_id into v_apotheke from public.grosshaendler_zugaenge z where z.id = p_zugang;
  if not found then
    raise exception using errcode = 'WB002',
      message = 'Diesen Grosshändler-Zugang gibt es für Ihre Apotheke nicht.';
  end if;
  insert into public.bestellungen (id, apotheke_id, zugang_id) values (p_id, v_apotheke, p_zugang);
  insert into public.bestellpositionen (bestellung_id, pzn, menge)
    select p_id, x.pzn, x.menge from jsonb_to_recordset(p_positionen) as x (pzn text, menge integer);
  return query
    select b.id, b.auftrag_id, b.support_id, true from public.bestellungen b where b.id = p_id;
end $$;

-- 2 Bremse in einem Schritt. Die Sperren gelten bis zum Ende der Transaktion,
--   auch hinter dem Pooler (Transaktionsmodus). Versuche mit gleichen Schlüsseln
--   kommen nacheinander dran; weil alle in der Reihenfolge der Sperrnummern
--   sperren, blockieren sich zwei nie gegenseitig. Jede Abfrage nach dem Warten
--   sieht, was der Vorgänger eingetragen hat.
drop function privat.bremse_frei(text[], integer[], integer);
drop function privat.bremse_zaehlen(text[]);

-- Zählt einen Versuch je Schlüssel und gibt die Nummern der Einträge zurück;
-- null, wenn ein Schlüssel seine Grenze im Fenster schon erreicht hat. Dann
-- zählt nichts. Räumt dabei alles älter als einen Tag weg.
create function privat.bremse_versuchen(
  p_schluessel text[], p_grenzen integer[], p_fenster_sekunden integer
) returns bigint[]
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_sperre bigint;
  v_ids bigint[];
begin
  if cardinality(p_schluessel) is distinct from cardinality(p_grenzen)
    or cardinality(p_schluessel) not between 1 and 10
    or exists (select 1 from unnest(p_grenzen) as g where g is null or g < 1)
    or p_fenster_sekunden is null or p_fenster_sekunden not between 1 and 86400 then
    raise exception using errcode = '22023', message =
      'Ein bis zehn Schlüssel mit je einer Grenze ab 1; das Fenster liegt zwischen 1 s und einem Tag.';
  end if;
  for v_sperre in
    select distinct hashtextextended('werkbank-bremse:' || s, 0) as h
    from unnest(p_schluessel) as s order by h
  loop
    perform pg_advisory_xact_lock(v_sperre);
  end loop;
  delete from privat.bremsen where zeitpunkt < now() - interval '1 day';
  if exists (
    select 1 from unnest(p_schluessel, p_grenzen) as g (schluessel, grenze)
    where (
      select count(*) from privat.bremsen b
      where b.schluessel = g.schluessel
        and b.zeitpunkt > now() - make_interval(secs => p_fenster_sekunden)
    ) >= g.grenze
  ) then
    return null;
  end if;
  with neu as (
    insert into privat.bremsen (schluessel) select unnest(p_schluessel) returning id
  )
  select array_agg(neu.id order by neu.id) into v_ids from neu;
  return v_ids;
end $$;

-- Ein Versuch, der gelungen ist, zählt nicht mehr (etwa eine Anmeldung).
create function privat.bremse_freigeben(p_ids bigint[]) returns void
language sql volatile security definer set search_path = ''
as $$
  delete from privat.bremsen where id = any (p_ids);
$$;

revoke all on function privat.bremse_versuchen(text[], integer[], integer) from public, anon, authenticated;
revoke all on function privat.bremse_freigeben(bigint[]) from public, anon, authenticated;
grant execute on function privat.bremse_versuchen(text[], integer[], integer) to werkbank_bremse;
grant execute on function privat.bremse_freigeben(bigint[]) to werkbank_bremse;
