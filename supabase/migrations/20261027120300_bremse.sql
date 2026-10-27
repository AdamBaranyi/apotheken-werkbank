-- Bremse gegen zu viele Versuche: Anmeldung und Aufrufe beim Grosshändler.
--
-- Die Zähler liegen in der Datenbank, damit alle Funktionen auf Vercel
-- dieselbe Grenze sehen; ein Zähler im Speicher einer Funktion sähe nur die
-- eigenen Anfragen. Die Web-App erreicht die Bremse über eine eigene Rolle mit
-- Passwort über den Pooler von Supabase, nicht über die REST-Schnittstelle:
-- Vor der Anmeldung gibt es keine Sitzung, und eine Funktion für anon in einem
-- veröffentlichten Schema wäre für alle mit dem öffentlichen Schlüssel
-- erreichbar (Advisor 0028). Die Rolle darf genau diese zwei Funktionen
-- ausführen. Ihr Passwort setzt die Einrichtung, nie eine Migration (E23).

create table privat.bremsen (
  schluessel text not null check (char_length(schluessel) between 1 and 200),
  zeitpunkt timestamptz not null default now()
);
create index bremsen_schluessel_idx on privat.bremsen (schluessel, zeitpunkt);
create index bremsen_zeitpunkt_idx on privat.bremsen (zeitpunkt);
revoke all on privat.bremsen from public, anon, authenticated;

-- Frei, solange jeder Schlüssel im Fenster unter seiner Grenze bleibt.
create function privat.bremse_frei(
  p_schluessel text[], p_grenzen integer[], p_fenster_sekunden integer
) returns boolean
language plpgsql stable security definer set search_path = ''
as $$
begin
  if cardinality(p_schluessel) is distinct from cardinality(p_grenzen)
    or p_fenster_sekunden is null or p_fenster_sekunden not between 1 and 86400 then
    raise exception using errcode = '22023',
      message = 'Zu jedem Schlüssel gehört eine Grenze; das Fenster liegt zwischen 1 s und einem Tag.';
  end if;
  return not exists (
    select 1 from unnest(p_schluessel, p_grenzen) as g (schluessel, grenze)
    where (
      select count(*) from privat.bremsen b
      where b.schluessel = g.schluessel
        and b.zeitpunkt > now() - make_interval(secs => p_fenster_sekunden)
    ) >= g.grenze
  );
end $$;

-- Zählt einen Versuch je Schlüssel und räumt dabei alles älter als einen Tag weg.
create function privat.bremse_zaehlen(p_schluessel text[]) returns void
language sql volatile security definer set search_path = ''
as $$
  delete from privat.bremsen where zeitpunkt < now() - interval '1 day';
  insert into privat.bremsen (schluessel) select unnest(p_schluessel);
$$;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'werkbank_bremse') then
    create role werkbank_bremse with login noinherit connection limit 20;
  end if;
end $$;
alter role werkbank_bremse set statement_timeout = '2s';

grant usage on schema privat to werkbank_bremse;
revoke all on function privat.bremse_frei(text[], integer[], integer) from public, anon, authenticated;
revoke all on function privat.bremse_zaehlen(text[]) from public, anon, authenticated;
grant execute on function privat.bremse_frei(text[], integer[], integer) to werkbank_bremse;
grant execute on function privat.bremse_zaehlen(text[]) to werkbank_bremse;
