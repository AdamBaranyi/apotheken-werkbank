-- Hilfsfunktionen der Regeln aus dem veröffentlichten Schema nehmen (Advisor
-- 0029 von Supabase): In public wären sie über /rest/v1/rpc von aussen
-- aufrufbar. Die Regeln brauchen sie weiter; sie verweisen auf die Funktion
-- selbst, nicht auf ihren Namen, und folgen dem Umzug.
--
-- In public bleibt nur zugang_fuer_bestellung: Der Server ruft sie im Namen
-- der angemeldeten Person auf (E17). Sie gibt nur den Geheimtext der eigenen
-- Apotheke heraus, und ohne den Schlüssel des Servers ist er nutzlos.
-- supabase/tests/schnittstelle.test.ts hält das fest.

create schema privat;
revoke all on schema privat from public;
grant usage on schema privat to authenticated;

alter function public.meine_apotheken() set schema privat;
alter function public.ist_inhaber(uuid) set schema privat;
