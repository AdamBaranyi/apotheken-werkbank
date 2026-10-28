# Entscheide

Nummeriert und nie gelöscht. Überholte Entscheide bekommen einen Nachtrag, sie verschwinden
nicht. Jeder Eintrag sagt, was entschieden wurde, warum, und was es kostet.

## E1 — Name «Apotheken-Werkbank»

_26.10.2026._ Die Namensprüfung (Marken CH, EU, DE über WIPO und Swissreg, Zefix, Domains,
GitHub, npm, PyPI, App Store, Websuche) fand den Namen nirgends. Gelb nur wegen einer
deutschen Marke «Werkbank» einer Agentur in Klasse 42; für ein nicht kommerzielles
Portfolio-Repo ohne Bedeutung. Der Arbeitsname der Engine, «Kassenflow», ist dagegen belegt:
Eine aktive Kassen-App heisst so. Die Engine bekommt einen anderen Namen (E11).

## E2 — Markt Deutschland, Oberfläche auf Deutsch für Deutschland

_26.10.2026._ Die Apotheken, für die solche Werkzeuge gebaut werden, sind deutsche
Vor-Ort-Apotheken. Darum PZN als Hauptkennzeichen, deutsche Mehrwertsteuer als Vorgabe und
die Oberfläche in `de-DE`: Beträge «12,50 €», ß wie in deutscher Apothekensoftware. Code,
Doku und Commits bleiben in Schweizer Schreibweise (ss). Das Land ist in der Konfiguration
umschaltbar.

## E3 — Web-App auf Vercel, Grosshandel auf einem eigenen Server

_26.10.2026._ Die Web-App läuft auf Vercel (Hobby), weil genau dort die Eigenheiten zu
lernen sind: kurzlebige Funktionen statt Dauerprozess, eine Region, Umgebungen je Preview,
Datenbankverbindungen über den Pooler, Cron statt Hintergrundschleife. Funktionen und
Datenbank liegen beide in Frankfurt (`fra1`, Supabase `eu-central-1`). Die
Grosshandel-Attrappe braucht einen Dauerprozess für SOAP und läuft darum im Container auf
einem eigenen Server hinter Caddy; so reden Bestell-Tool und Grosshandel über das Netz. Ein
Spiegel der Web-App auf dem eigenen Server kommt höchstens am Ende dazu.

## E4 — Windows nur auf den Läufern von GitHub

_26.10.2026._ Die Engine braucht Windows für Bildschirmfoto, OCR und Eingabe. Eine VM auf
dem Arbeitsrechner gibt es nicht; die Windows-Läufer sind für öffentliche Repos kostenlos.
Preis: Jede Probe am echten Fenster heisst pushen und warten, Fehler sieht man über
Bildschirmfotos und Videos aus der CI. Auf dem Mac laufen die Tests gegen einen Test-Treiber.

## E5 — Selbstheilung mit einem kleinen Modell, mit Deckel

_26.10.2026._ Die Selbstheilung der Engine nutzt Claude Haiku 5.5 über einen eigenen
Schlüssel nur für dieses Repo, mit Monatslimit in der Konsole des Anbieters und im Code
höchstens drei Rettungsversuche je Lauf sowie einem Tagesdeckel. Rechnung vom 26.10.2026:
Ein Versuch mit Bildschirmfoto kostet weniger als 0,1 Rappen. Echte Aufrufe nur auf `main`
und von Hand; Pull Requests und Tests nutzen eine Attrappe des Modells. Bildschirmfotos
stammen ausschliesslich von der Kassen-Attrappe mit erfundenen Daten.

## E6 — Merge nach grüner CI, nur für den geprüften Commit

_26.10.2026._ Pull Requests werden nach grüner CI gemergt, und zwar nur, wenn die Läufe zum
aktuellen Kopf des Branches grün sind. Ohne Branch-Regeln würde `gh pr merge` sonst auch
einen ungeprüften Push übernehmen.

## E7 — Was nicht in dieses Repo gehört

_26.10.2026._ Das Repo ist öffentlich und ein Übungsprojekt. Es nennt keine Firma und keine
fremden Produkte und enthält keine Vorbereitung auf ein bestimmtes Gespräch. Fragen und
Antworten zum Projekt stehen neutral in `docs/FRAGEN.md`.

## E8 — Werkzeugfassungen

_26.10.2026._ PowerShell 7.6 (aktuelle Linie mit Langzeitpflege) statt der ursprünglich
geplanten 7.5. Pester 5.9.1 statt Pester 6: Pester 6 ist seit Juli 2026 stabil, aber 5 wird
gepflegt und seine Schnittstelle ist bekannt; der Wechsel ist ein eigener Schritt nach dem
Training. Für alle Pakete und Actions gilt eine Wartezeit von sieben Tagen.

## E9 — Actions an Commits geheftet

_26.10.2026._ Ein Tag wie `v7` kann umgebogen werden (geschehen 2026 bei einem bekannten
Scanner). Darum `uses: owner/action@<commit> # vX.Y.Z`; Dependabot hebt beides zusammen.

## E10 — Prototyp «Rezeptdatensatz → Kasse»

_26.10.2026._ Von drei Ideen (Lieferengpass-Radar, Paket-Konfigurator, Rezeptdatensatz →
Kasse) verbindet nur diese alle Teile: Ein erfundener Datensatz aus einer
Telemedizin-Attrappe legt über die Engine den Verkauf in der Kassen-Attrappe an. Der
Lieferengpass-Radar fiele im Hobby-Tarif ohnehin auf einen täglichen Cron zurück.

## E11 — Neuer Name der Engine

_Offen, entschieden an Abend 3._

## E12 — Eigener SOAP-Server, node-soap als Prüfer

_26.10.2026._ Die Grosshandel-Attrappe nimmt SOAP selbst entgegen (Node, `fast-xml-parser`,
Zod) statt über den Server des Pakets `soap`. Grund: Grösse, Anmeldung, Grenze je Mandant und
das Abweisen jeder DTD laufen so nachweislich **vor** dem Parsen, in einer Reihenfolge, die im
Code steht. `soap` bleibt im Projekt als generischer Client, der seine Aufrufe allein aus der WSDL
erzeugt (`test/konformitaet.test.ts`); läuft er durch, passen WSDL und Server zusammen. Preis:
etwas mehr eigener Code für Umschlag und Antworten.

## E13 — Eine Artikeldatei für beide Hälften

_26.10.2026._ `daten/artikel.json` liefert dem Grosshandel den Bestand und der Web-App die
Artikel der Apotheke. Zwei Listen liefen sonst auseinander (andere PZN, andere Namen), und der
Fehler fiele erst in der Oberfläche auf. Beim Laden prüft Zod jede PZN samt Prüfziffer.

## E14 — Lager und Bestellbuch im Speicher

_26.10.2026._ Die Attrappe hält Lager und Bestellungen im Speicher; ein Neustart setzt beides
zurück. Für eine Übungsattrappe reicht das, und die Demo beginnt so immer mit demselben
Bestand. Ein echter virtueller Grosshandel bräuchte eine Datenbank, damit der Bestellstatus
sieben Tage lang abrufbar bleibt (Pflichtenheft Kap. 6.3); das steht als Grenze in der Fallstudie.

## E15 — Gestaltung «Tourenband»

_26.10.2026._ Eine Werkzeug-Oberfläche, kein Schaufenster. Die wichtigste Frage am
Bestell-Bildschirm lautet «Schaffe ich die nächste Tour?», darum stehen die Bestellfenster des
Tages als Band ganz oben, mit der aktuellen Uhrzeit darauf. Eine Schriftfamilie (Atkinson
Hyperlegible Next, lokal ausgeliefert), weil sie 0 und O, 1 und l unterscheidet – wichtig, wo
Menschen PZN lesen und abtippen. Status nie nur über Farbe: Jeder Anteil hat Wort, Muster und
Farbe. Schrift ab 16 px, hell als Vorgabe, 320 px ohne Querscrollen.

## E16 — Anmeldung ohne Registrierung

_26.10.2026._ Nur E-Mail und Passwort; Konten legt die Einrichtung an, niemand registriert sich
selbst. Gemessen: `[auth.email] enable_signup = false` schaltet bei Supabase den ganzen
E-Mail-Anbieter ab, auch die Anmeldung. Neue Konten verhindert `[auth] enable_signup = false`.
Dieselbe Meldung für unbekannte Adresse und falsches Passwort, damit die Anmeldung keine Konten
verrät.

## E17 — Der Browser spricht nur mit der App

_26.10.2026._ Der Browser ruft weder Supabase noch den Grosshändler direkt auf. Seiten und
Server-Aktionen fragen Supabase mit der Sitzung der angemeldeten Person; welche Zeilen sie sieht,
entscheidet die Datenbank (RLS). Die App hat keinen Geheimschlüssel von Supabase. Grosshändler
ruft nur der Server auf, und nur Adressen aus `GROSSHANDEL_ERLAUBT`: Die Adresse eines Zugangs
steht in der Datenbank, ohne Freigabeliste liesse sich die App auf interne Adressen lenken (SSRF).
Die Passwörter der Zugänge liegen mit AES-256-GCM verschlüsselt in der Datenbank, der Schlüssel
nur in der Umgebung des Servers.

## E18 — Browser-Tests gegen den Produktionsbuild

_26.10.2026._ In der CI laufen die Playwright-Tests gegen `next start`, nicht gegen den
Entwicklungsserver: Nur so stimmen CSP, Kopfzeilen und Verhalten mit dem Deploy überein. Drei
Breiten (320, 768, 1440 px), auf jedem Bildschirm axe, Schriftgrösse und Querscrollen.

## E19 — Vorschau mit eigenem Schlüssel

_26.10.2026._ Vercel baut für jeden Pull Request eine Vorschau, auch für Updates von
Dependabot, also für Code, den noch niemand geprüft hat. Die Vorschau bekommt darum einen
eigenen `ZUGANG_SCHLUESSEL`, einen Zufallswert, der nirgends gespeichert ist. Gelangt eine
Vorschau an ihre Umgebung, kann sie die Zugänge der Produktion trotzdem nicht entschlüsseln;
«Bestellen» zeigt dort die Meldung «Die gespeicherten Zugangsdaten lassen sich nicht lesen».
Geprüft wird das Bestellen vor dem Merge in der CI, nicht in der Vorschau.

## E20 — Attrappe ohne veröffentlichten Port

_26.10.2026._ Auf vps1 hängt die Attrappe nur im Netz des gemeinsamen Caddy, unter dem Namen
`werkbank-grosshandel`. Kein Port auf dem Server: Docker umgeht ufw bei veröffentlichten Ports,
ohne Port gibt es nichts zu umgehen. Dazu läuft der Container nur lesbar, ohne Linux-Rechte und
als Benutzer `node`.

## E21 — Produktionszugänge ohne Klartext

_26.10.2026._ `scripts/produktion-zugaenge.ts` erzeugt je Apotheke ein Passwort für die
Attrappe und schreibt es nur zweifach verwandelt weg: als scrypt-Hash für vps1 und als
Geheimtext für Supabase. Der Klartext existiert nur während des Laufs. Die Konten der
Demo-Apotheken legt Adam selbst in Supabase an, mit Passwörtern aus seinem Passwortmanager;
die SQL verknüpft sie nur und bricht ab, solange sie fehlen.

## E22 — Kasse: Belege nur anhängen, Regeln an den Tabellen

_27.10.2026._ Ein Beleg wird nie geändert oder gelöscht; korrigiert wird mit einem Storno, einem
Gegenbeleg mit denselben Positionen und Preisen. Wer bucht, schickt nur PZN, Menge,
Rezept-Häkchen und Zahlung; Preis, Steuersatz, Belegnummer und Summen setzt die Datenbank. Die
Regeln stehen als Trigger, Prüfungen und RLS an den Tabellen, nicht in einer Funktion: So gelten
sie auch für einen direkten Aufruf der REST-Schnittstelle mit dem eigenen Token. Die beiden
Funktionen der Kasse laufen mit den Rechten der aufrufenden Person (SECURITY INVOKER, kein
Advisor-Befund); nur die Trigger haben Besitzerrechte und liegen im Schema `privat`. Positionen
lassen sich nur in derselben Anfrage wie der Kopf anhängen (`erstellt_am = now()`).
Belegnummern laufen je Apotheke lückenlos über einen Zähler in derselben Transaktion; ein
Abbruch rollt ihn mit zurück. Gegen den Doppelklick dient die ID aus dem Seitenaufbau, nicht
`on conflict do nothing`: Der Trigger hätte den Zähler vorher schon erhöht. Steuersätze hängen
an Land und Steuergruppe, nicht am Artikel (ein Arzneimittel trägt in Deutschland 19 %, in der
Schweiz 2,6 %). Stornieren darf nur, wer die Apotheke führt; den Tag schliesst jedes Mitglied
ab. Preis: mehr SQL, und Trigger sind schwerer zu lesen als eine einzelne Funktion.

## E23 — Bremse über eine eigene Datenbankrolle

_27.10.2026._ Vor der Anmeldung gibt es keine Sitzung, Supabase sieht nur die IP des Servers, den
Hook für Passwortversuche gibt es erst im bezahlten Tarif, und ein Zähler im Speicher einer
Vercel-Funktion sähe nur die eigenen Anfragen. Eine Funktion für anon über REST wäre für jeden
mit dem öffentlichen Schlüssel erreichbar (Advisor 0028). Darum: Rolle `werkbank_bremse`, die
genau zwei Funktionen im Schema `privat` ausführen darf, erreicht über den Pooler von Supabase
(Transaktionsmodus, IPv4) mit TLS gegen die CA von Supabase. In der Datenbank stehen nur
HMAC-Werte. Grenzen in 15 Minuten: 5 Fehlversuche je Konto und IP, 10 je Konto, 30 je IP; beim
Grosshändler 60 Aufrufe je Minute und Apotheke. Die IP gilt nur auf Vercel, wo der Rand
`x-real-ip` setzt. Antwortet die Datenbank nicht, lässt die Bremse durch und protokolliert es.
Gemessen: «5 je Konto» allein sperrte im Test das echte Konto – jeder könnte die Apotheke so
aussperren. Preis: ein weiteres Geheimnis (`BREMSE_DATENBANK_URL`) und eine
Datenbankverbindung je Anmeldung.

## E24 — Beleg als PDF ohne Bibliothek

_27.10.2026._ Ein Kassenbon ist eine Spalte Text. Ein eigener Schreiber von gut 100 Zeilen
erzeugt ihn: eine Seite in der Breite einer 80-mm-Rolle, Courier (eine der 14 Standardschriften,
nicht eingebettet), WinAnsi, Zeichen ab 0x80 als Oktalfolge. pdf-lib hat seit 2021 kein Release,
PDFKit lädt Schriftdateien zur Laufzeit, die auf Vercel erst gebündelt werden müssten, und Chrome
ohne Kopf ist für eine Funktion zu gross. Die Tests prüfen jeden Versatz im Verzeichnis aufs Byte
und dass Klammern im Text keine Befehle werden. Preis: kein getaggtes PDF; barrierefrei ist die
HTML-Ansicht des Belegs.

## E25 — Bestellen mit Liefervorgabe «MaxVerbund»

_27.10.2026._ Gemessen im Test: Mit der Liefervorgabe «Normal» liefert die Attrappe nur aus dem
Hauptlager, obwohl die Verfügbarkeit den Verbund schon anzeigte – die Apotheke bekäme weniger,
als sie gesehen hat. «MaxVerbund» liefert aus Hauptlager und zweitem Lager; Nachlieferung und
Dispo bleiben «möglich» und werden nicht still mitbestellt. Die Bestellung steht vor dem Senden
in der Datenbank, ihre ID ist die Bestell-ID beim Grosshändler. Der Status folgt nur den
Antworten (Pflichtenheft Kap. 2.3.6): Exception des Servers heisst «abgelehnt», Abbruch oder
unlesbare Antwort «unklar», dann klärt die Statusabfrage. Preis: Wer Nachlieferung will, bestellt
sie heute nicht aus der Werkbank.

## E26 — Lighthouse: hart, was nicht vom Rechner abhängt

_27.10.2026._ In der CI gelten Barrierefreiheit und gute Praxis ab 95 als Grenze; die Leistung
steht mit dem Leistungsindex des Läufers im Protokoll, weil sie auf geteilten Läufern stark
schwankt. Hart zählt sie lokal mit `--streng` (Median aus drei Messungen, ruhiger Rechner). SEO
wird nicht gemessen: Die Werkbank steht hinter einer Anmeldung und sagt «noindex». Lighthouse
läuft über `npx` in fester, über sieben Tage alter Fassung; als Abhängigkeit brächte es unter
anderem einen Fehler-Client und Puppeteer in jede Installation. Preis: Seine Unterpakete stehen
in keinem Lockfile (docs/SECURITY.md).

## E27 — Dunkel nach Systemeinstellung

_27.10.2026._ Hell bleibt die Vorgabe; wünscht das System dunkel, tauschen dieselben Variablen
ihre Werte. Text hält dort mindestens 4,5 : 1, Feldränder 3 : 1. Die Browser-Tests laufen
zusätzlich dunkel in 390 px, und axe prüft die Kontraste auch dort.
