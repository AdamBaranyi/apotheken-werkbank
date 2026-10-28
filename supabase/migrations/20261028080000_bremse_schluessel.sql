-- Advisor 0004: Jede Tabelle bekommt einen Primärschlüssel, auch die Zähler
-- der Bremse. Die Bremse selbst liest nur Schlüssel und Zeitpunkt.
alter table privat.bremsen add column id bigint generated always as identity primary key;
