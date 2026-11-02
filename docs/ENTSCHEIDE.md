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

_Nachtrag 29.10.2026._ Die Engine bekommt keinen eigenen Markennamen: Sie heisst
«Werkbank-Engine», das Modul `Werkbank.Engine`, der Befehl `engine/werkbank.ps1`. Der Name des
Repos ist geprüft (E1); jeder neue Name bräuchte eine eigene Prüfung und sagte nicht mehr als
«die Engine der Werkbank».

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
verrät. Die Zwei-Faktor-Anmeldung fehlt in der Demo bewusst, und die Anmeldung sagt das; im
Betrieb käme sie über Supabase dazu (TOTP mit einer Authenticator-App, `[auth.mfa.totp]`).

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

_Nachtrag 28.10.2026._ Derselbe Schlüssel heisst nur dann derselbe Beleg, wenn auch der Inhalt
gleich ist: Zahlung und Positionen, beim Storno das Original. Sonst meldet die Datenbank WK011
mit der Nummer des vorhandenen Belegs. Vorher lieferte sie still den alten Beleg, etwa wenn nach
einem Abbruch der Bon geändert und erneut gebucht wurde. Gefunden in der Durchsicht vor dem
Merge.

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

_Nachtrag 28.10.2026._ Prüfen und Zählen geschehen in einem Aufruf (`privat.bremse_versuchen`)
unter einer Sperre je Schlüssel (`pg_advisory_xact_lock`, in fester Reihenfolge). Vorher sahen
gleichzeitige Versuche denselben alten Stand und kamen zusammen über die Grenze. Jeder
Anmeldeversuch zählt vor der Prüfung des Passworts, ein gelungener gibt seine Zählung frei
(`privat.bremse_freigeben`). Antwortet die Datenbank nicht, sperrt die Anmeldung: Liesse sie
durch, könnte jemand die Bremse mit vielen Verbindungen überlasten (die Rolle hat höchstens 20)
und danach unbegrenzt raten. Beim Grosshändler geht Bestellen weiter vor. Die Seite Bestellen
fragt die Vertragsdaten je Zugang höchstens alle fünf Minuten ab, und jede Anfrage zählt. Je
Versuch bleibt es bei einer eigenen Verbindung: Auf Vercel ruht eine Instanz zwischen Anfragen,
eine gemerkte Verbindung wäre danach oft tot und hiesse bei der Anmeldung «gestört». Preis: Ist
nur der Pooler gestört, kommt niemand herein, obwohl Supabase die Anmeldung annähme.

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

_Nachtrag 28.10.2026._ Die Statusabfrage gibt es erst eine Minute nach der letzten Änderung:
Gleich nach einem Abbruch verarbeitet der Grosshändler die Bestellung vielleicht noch, und
«nicht angekommen» lüde zum zweiten Bestellen ein. Ein Fault ohne MSV3-Angaben (etwa von einem
Proxy) heisst «unklar», nicht «abgelehnt»; ebenso «Antwort verfügbar» ohne Antwort. Derselbe
Schlüssel mit anderen Mengen meldet WB004 statt still die alte Bestellung.

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

## E28 — Rundgang auf Knopfdruck

_28.10.2026._ Adams Wunsch: ein Rundgang wie in seinen anderen Apps, der zeigt, wie man die
Werkbank benutzt und was schon fertig ist. Der Knopf «Rundgang» steht in der Leiste; er öffnet
einen echten modalen Dialog (Fokusfalle und Escape vom Browser), Schritt für Schritt einmal durch
die ganze Werkbank: 14 Schritte über Bestellen, Bestellungen, Kasse, Belege, Tagesabschluss und
Flow-Monitor; er wechselt selbst die Seite, die Leiste und mit ihr der Dialog bleiben stehen. Das
erklärte Element wird hervorgehoben; fehlt es gerade (leerer Bon), bleibt nur der Text. Anders als
in Evidarium öffnet er sich beim ersten Besuch noch nicht von selbst: Dafür müssten alle
Browser-Tests als Besucher beginnen, die ihn schon kennen. Das folgt mit dem lokalen Speicher.

## E29 — Auffrischung der Gestaltung

_28.10.2026._ Die Werkzeug-Oberfläche aus E15 bleibt, aber ruhiger und zeitgemässer: getönte
Leinwand mit einer hellen Arbeitsfläche, dunkle App-Leiste, feine Linien statt schwarzer Rahmen,
etwas grössere Rundungen. Schrift, Datenfarben mit Wort und Muster und die Regeln zu Grösse und
Kontrast bleiben. Die Jetzt-Marke im Tourenband steht nur noch im Fortschrittsstreifen; vorher lief
sie zu manchen Uhrzeiten mitten durch den Text der laufenden Tour.

## E30 — Flows als YAML, geprüft von Schema und eigenem lint

_29.10.2026._ Ein Flow ist eine YAML-Datei je Apotheke, gelesen mit `powershell-yaml` 0.4.12
(Januar 2025, weit über der Wartezeit). YAML erlaubt Kommentare, und ein Mensch, der eine neue
Apotheke ausrollt, liest es leichter als JSON. `engine/flow.schema.json` prüft den Aufbau (auch im
Editor), `Test-Flow` den Sinn: Variablen, Schleifen, Muster, Dateinamen. Gemessen: `Test-Json`
meldet bei einem Fehler in einem verschachtelten Schritt nur «ungültig», ohne Stelle; darum prüft
die Engine den Aufbau der Schritte zusätzlich selbst und nennt die Schrittnummer. Preis: ein
Modul mehr, das mit Pester und PSScriptAnalyzer in festen Fassungen installiert wird
(`engine/werkzeuge.ps1`).

## E31 — Ein Fake-Treiber aus derselben Attrappe

_29.10.2026._ Der Fake-Treiber zeigt die Kasse als Wörter mit Lage, wie eine OCR sie liefert. Er
baut auf demselben Layout und derselben Kassenlogik wie das WinForms-Fenster auf und ahmt dessen
Verhalten nach: Fokus im ersten Feld, Escape leert, Enter löst die Aktion des Feldes aus, Dialoge
sind modal, eine langsame Buchung sperrt das Fenster. So laufen alle Flows und die ganze
Lauf-Logik in Pester auf dem Mac und unter Linux, mit Chaos (springendes und wanderndes Fenster,
langsame Kasse, Nullen als O, Dialoge). Was die Simulation anders macht als Windows, finden die
echten Läufe in der Windows-CI. Preis: Das Verhalten steht zweimal im Code, als Fenster und als
Simulation.

## E32 — OCR mit Windows.Media.Ocr, Englisch, dreifach skaliert

_29.10.2026._ Gate von Abend 3, gemessen auf `windows-2025`: echte Sitzung mit Bildschirm
(1024 × 768, 96 DPI), Fenster, Bildschirmfoto, Klick und Eingabe über `SendInput` funktionieren.
Die OCR kennt nur Englisch; Deutsch nachzuinstallieren brach nach 12 Minuten ab. Englisch liest
Umlaute, ß und € trotzdem richtig. Trefferquote auf Segoe UI 9 pt: einfach 18/20, doppelt 19/20,
dreifach 20/20. Die OCR läuft in Windows PowerShell 5.1 als Unterprozess, weil PowerShell 7 die
WinRT-Typen nur mit einem Zusatzpaket kennt; Tesseract wäre der dritte Weg gewesen. Da die OCR
keine Sicherheit je Wort liefert, vergleicht die Engine selbst (Levenshtein, Schwelle 0,85, kurze
Wörter und Kennungen genau). Preis: jedes Bild etwa 1,5 Sekunden.

## E33 — Kritische Schritte, «unklar» und die Kennung als Referenz

_29.10.2026._ Ein Schritt, der bucht, heisst im Flow `kritisch` und wird nie zweimal gesendet. Fehlt
danach die Bestätigung, endet der Lauf mit «unklar». Jeder Verkauf trägt die Kennung des Auftrags
als Referenz auf dem Beleg, und jeder Verkaufs-Flow sucht sie zuerst im Journal der Kasse: Ein
zweiter Lauf mit derselben Kennung endet mit «bereits gebucht». Das ist dasselbe Muster wie beim
Bestellen (E25): ID vor dem Senden, nach einem Abbruch nachfragen statt neu senden. Kennungen
bestehen nur aus Zeichen, die eine OCR nicht verwechselt; die Engine vergleicht sie genau. Gemessen
im Test: Wiederholte die Engine auch reine Warteschritte, verdreifachte sich die Frist, und ein
Lauf, der «unklar» melden sollte, meldete «ok». Warten wird darum nicht wiederholt. Preis: Ein
Lauf, der «unklar» endet, braucht einen zweiten Lauf oder einen Menschen.

## E34 — Fehlermeldungen der Kasse: neu gegen alt

_29.10.2026._ Steht eine Meldung aus der Fehlerliste des Flows auf dem Bildschirm, bricht der Lauf
ab: Die Kasse hat abgelehnt, also nichts gebucht («abgebrochen», auch nach einem kritischen
Schritt). Alt ist nur, was beim Start des Laufs schon dastand, und nur, bis es verschwindet. Die
erste Fassung merkte vor jeder Aktion alle sichtbaren Meldungen als alt. Gemessen im Test: Nach
«Ohne Rezept nicht abgegeben» lief ein Verkauf weiter und buchte eine von zwei Positionen. Preis:
Meldet die Kasse einen Fehler, den der Flow nicht kennt, merkt die Engine es erst, wenn der
erwartete Zustand ausbleibt.

## E35 — Selbstheilung: das Modell schlägt vor, die Liste entscheidet

_29.10.2026._ Scheitert ein Schritt, fragt die Engine einen Heiler nach genau einer Aktion. Das
Modell (Claude Haiku 5.5, E5) bekommt Bildschirmfoto, erkannten Text, den gescheiterten Schritt und
die Klickziele aus `heilung.klickbar` des Flows; die Antwort legt ein JSON-Schema über
`output_config.format` fest, mit `effort: low`. Ausgeführt wird nur ein Ziel aus der Liste, das
eindeutig sichtbar ist, dazu Escape oder Warten; danach ein neuer Versuch, aber nie für einen
gesendeten buchenden Schritt. So hängt die Sicherheit nicht am Modell: Ein Bildschirmtext, der dem
Modell etwas einflüstert, erreicht höchstens einen Knopf, den der Flow ohnehin erlaubt. Deckel: drei
Fragen je Lauf, eine Zahl je Tag, dazu das Monatslimit im Konto des Anbieters. Gemessen in den
Tests: Ein Vorschlag «Karte» wird abgelehnt, ein unsichtbares «Schliessen» auch. Preis: Was nicht
auf der Liste steht, heilt die Engine nicht, selbst wenn das Modell richtig läge.

## E36 — Flow-Monitor über Engine-Konten, die keine Mitglieder sind

_29.10.2026._ Die Engine meldet ihre Läufe mit einem eigenen Supabase-Konto, das in
`engine_konten` steht und nicht in `mitglieder`. Alle bestehenden Regeln fragen `mitglieder`; ein
Engine-Konto sieht darum ohne eine geänderte Regel weder Belege noch Bestellungen noch Zugänge. Es
darf Läufe und Fotos seiner Apotheke schreiben; die Apotheke setzt die Datenbank, ein Foto hängt
über einen zusammengesetzten Fremdschlüssel an einem Lauf derselben Apotheke, und nichts wird
geändert. Verworfen: eine Route der Web-App mit eigenem Gerätetoken (bräuchte eine weitere
Datenbankrolle und ein Geheimnis in Vercel) und eine Rolle «engine» in `mitglieder` (jede Regel und
`zugang_fuer_bestellung` hätten sie ausschliessen müssen). Fotos liegen als `bytea` in der Datenbank,
nicht im Speicher von Supabase, der in der CI nicht läuft. Preis: je Apotheke ein Konto mehr, das die
Einrichtung anlegt; in der Produktion legt Adam es an (E21).

## E37 — Eingaben ohne Schreibmarke prüfen

_29.10.2026._ Befund des ersten Laufs auf Windows: Die blinkende Schreibmarke klebt am letzten
Zeichen des Feldes mit dem Fokus. Kennungen im Suchfeld stimmten darum erst beim zweiten oder
dritten Bild, in Süd gar nicht (Abbruch nach drei Versuchen). `eingeben` verlässt das Feld nach dem
Tippen mit Tab, prüft den Text und kehrt mit Umschalt+Tab zurück, damit ein Enter danach wieder im
richtigen Feld wirkt. Gemessen im nächsten Lauf: jede Kennung beim ersten Versuch. Die Simulation
zeigt die Marke als Chaos, ein Test und eine Sabotage halten den Fehler fest. Zuerst stand hier, die
OCR habe die Menge «1» als «1|» gelesen. Das war aus dem Bildschirmfoto geschlossen, nicht gemessen:
Ohne Marke scheiterte dieselbe «1» genau gleich (E38). Preis: Eine echte Kasse könnte
beim Verlassen eines Feldes etwas prüfen oder auslösen; dann braucht ihr Flow einen anderen Weg.

## E38 — Eine einzelne Ziffer neben einer Beschriftung

_29.10.2026._ Befund der echten Läufe: In der Kasse Nord fand die Engine die Menge «1» im Feld
neben «Menge» in keinem Lauf, die «3» davor in jedem. Süd, wo die Beschriftung über dem Feld steht,
las dieselbe «1» in jedem Lauf. Die Schreibmarke war es nicht: Der Lauf ohne Marke scheiterte genau
gleich. Damit sich das klären liess, nennt eine nicht sichtbare Eingabe seither die Wörter, die die
OCR im Feld las, und ein Abbruch hält den Bildschirm als Text im Bericht fest. Die Probe
`engine/probe/ziffer.ps1` las dieselbe Zeile zweifach und vierfach mit «1», dreifach ohne. Die
Skalierung bleibt dreifach (20 von 20 Prüfwörtern, E32); findet die Engine einen Text bis zum Ende
der Frist nicht, liest sie das letzte Bild noch einmal vierfach, bevor sie scheitert. Offen: immer
vierfach. Die Probe las vierfach alle 20 Prüfwörter, in 1,1 statt 1,0 Sekunden je Bild; die echten
Läufe sind aber dreifach mit zweitem Blick geprüft, nicht vierfach. Preis: Ein Fehlschlag dauert ein
Bild länger.

## E39 — Verkaufen nur, wenn «unbekannt» dasteht

_29.10.2026._ Gefunden bei der Arbeit an E38: Der Verkaufs-Flow wartete nach der Suche auf eine der
Zeilen «Referenz …: unbekannt» oder «… Beleg» und beendete den Lauf, wenn er im nächsten Bild «Beleg»
las. Fehlte die Zeile in diesem Bild (die OCR übersieht etwas, das Fenster ist halb gezeichnet),
verkaufte er ein zweites Mal. Ein Test mit dem Chaos «Flackern» (die Zeile fehlt in jedem zweiten
Bild) zeigte genau das: zwei Belege für eine Kennung. Jetzt prüft der Flow nach «beenden-wenn», dass
«unbekannt» sicher dasteht; sonst bricht der Lauf ab und bucht nichts. Eine Sabotage hält fest, dass
der Test die fehlende Prüfung findet. Preis: Ein Lauf, der die Zeile in keinem Bild liest, endet mit
«abgebrochen» statt zu verkaufen; ein Mensch oder ein neuer Lauf klärt ihn.

## E40 — Zahlen im Suchtext genau vergleichen

_29.10.2026._ Befund der Durchsicht vor dem Merge: Die Engine verglich ganze Suchtexte unscharf
(Levenshtein, Schwelle 0,85), Zahlen eingeschlossen. «Positionen 1» galt als «Positionen 2» (0,917),
und ein Enter, das ein Dialog schluckte, fiel nicht auf: Der Lauf meldete «ok», auf dem Beleg fehlte
eine Position. Ebenso galt «1234,60» als «1234,50» (0,857). Jetzt muss jede Zahl des Suchtexts genau
so im gelesenen Text stehen: als eigenes Wort, aus zwei Nachbarwörtern («1 5,34» für «15,34») oder am
Ende eines Worts («Vorgang1»), nach Ausgleich der OCR-Verwechslungen (O/0, l/1 …) und mit Punkt wie
Komma. Buchstaben bleiben unscharf. Die erste Fassung verlangte dieselbe Folge aller Ziffern und war
zu streng: Der echte Lauf in Süd las «Im Vorgang 1» als «1m Vorgang 1», das «1m» zählte als Zahl,
und kein Verkauf ging mehr durch. Tests spielen das geschluckte Enter und das «1m» nach, eine
Sabotage hält die Regel fest. Preis: Liest die OCR eine Ziffer falsch, die sie nicht verwechseln
darf, scheitert die Prüfung, statt durchzugehen; dafür gibt es den zweiten Blick (E38).

## E41 — Kennungen mit acht Zeichen

_29.10.2026._ Befund der Durchsicht: Mit 26 hoch 6 Kennungen ist ab rund 20 000 Belegen eine doppelte
wahrscheinlicher als nicht. Ein neuer Verkauf mit einer schon vergebenen Kennung endete als «bereits
gebucht», und der Verkauf fehlte. Neue Kennungen haben jetzt acht Zeichen (26 hoch 8, die Grenze
liegt bei rund einer halben Million); ältere mit sechs gelten weiter. Verworfen: beim gefundenen
Beleg
Summe und Positionen vergleichen; das bräuchte eine Lesestelle, die keine Kasse gleich zeigt. Preis:
zwei Zeichen mehr, die die OCR genau lesen muss.

## E42 — Anmeldung mit Willkommensfläche

_02.11.2026._ Bisher stand auf der Anmeldung nur die Karte, und nichts sagte, worum es geht. Ab
64rem teilt sich die Seite: links eine dunkle Fläche mit Zeichen, Name, dem Titel «Bestellen,
verkaufen, automatisieren.», einer Illustration und den drei Arbeitsfeldern; rechts die Anmeldung
als Karte. Schmal bleibt die Anmeldung oben, mit Name und Zweck darüber. Der Text steht im Code,
nicht im Bild: scharf, richtig geschrieben und für Screenreader lesbar. Die Illustration ist mit
Google Gemini erzeugt, nach einem Prompt mit den Farben der App und ohne Text, Logo, Rx-Zeichen
und Apotheken-A; sie zeigt den Ablauf von der Lieferwanne über Verfügbarkeit und Tourenband zur
Kasse mit Beleg und zum Roboterarm der Engine. Ein Hinweis auf der Seite fehlt bewusst: Die
Zeichnung täuscht nichts Echtes vor, und Gemini kennzeichnet sie maschinenlesbar (SynthID). Die
Fläche trägt genau die Randfarbe des Bildes (`#192c3e`), hell wie dunkel, damit keine Kante
entsteht. Das Bild kommt als WebP in zwei Grössen über `<picture>`: Die Bildoptimierung von Next
bleibt aus (next.config.ts), und schmal lädt die Seite gar kein Bild. Verworfen: ein Foto (zeigt
Ware, nicht die App) und eine eigene Zeichnung der Lieferwannen (dasselbe Problem). Preis: rund
110 KB Bild im Repo, und die Illustration wächst nicht mit, wenn sich die App ändert.

## E43 — Rundgang beim ersten Anmelden

_02.11.2026._ Der Rundgang startet beim ersten Anmelden eines Kontos einmal von selbst, danach
nur noch über den Knopf. Gemerkt wird das im Konto (`user_metadata.rundgang_gesehen`, gesetzt
von einer Server-Aktion), nicht im Browser: Wer sich an einem zweiten Gerät anmeldet, bekommt ihn
nicht noch einmal. Der Merker steht schon beim Start, damit ein Neuladen den Rundgang nicht
wiederholt. E28 hatte das zurückgestellt, weil sonst jeder Browser-Test im Rundgang hängen
bliebe: Die Testkonten aus `scripts/lokal-einrichten.ts` tragen den Merker darum schon, nur
`rundgang.nord@werkbank.test` nicht; sein Test setzt ihn vorher zurück. Preis: Die Kontodaten
kann jede Person selbst ändern; für einen Merker der Oberfläche genügt das.

## E44 — Rundgang-Karte rechts, der Arbeitsbereich macht Platz

_02.11.2026._ Beim Live-Test verdeckte die Karte unten Teile der Seite, etwa die Knöpfe unter der
Tabelle. Ab 64rem sitzt sie jetzt rechts in der Mitte, und solange der Rundgang läuft, rückt der
Arbeitsbereich nach links (`html[data-rundgang='offen']` in `globals.css`); so liegt keine
erklärte Stelle unter ihr, auch keine Tabelle über die ganze Breite. Schmal ist rechts kein
Platz: Die Karte bleibt unten, die Stelle rückt nach oben, und unter dem Arbeitsbereich entsteht
Platz zum Scrollen, damit auch die letzte Stelle darüber zu stehen kommt. Der Browser-Test prüft
das bei jedem Schritt: breit rechts und ohne Überlappung, schmal der Anfang der Stelle über der
Karte. Preis: Beim Öffnen springt der Inhalt einmal nach links.

_Abgelöst durch E46:_ Der Sprung beim Öffnen störte, und auf grossen Bildschirmen stand die Karte
weit weg vom Inhalt am Rand.

## E45 — Copyright in der Fusszeile

_02.11.2026._ Wie in den anderen Apps steht auf jeder Seite «© 2026 Adam Baranyi. Übungsprojekt
mit erfundenen Daten.», dazu das Impressum (adambaranyi.xyz) und der Quelltext auf GitHub, beide
in neuem Tab. Der Name ohne Akzente wie in der Lizenz. In der Werkbank unter dem Arbeitsbereich,
auf der Anmeldung unten in der rechten Spalte; dort ist dafür die Karte das `main`, und die
Willkommensfläche steht als eigene Region daneben. Der Browser-Test prüft Text und Verweise auf
der Anmeldung und in der Kasse.

## E46 — Rundgang-Karte beim erklärten Element, die Seite bleibt stehen

_02.11.2026._ Beim Live-Test sprang der Arbeitsbereich beim Öffnen nach links (E44), und auf
grossen Bildschirmen klebte die Karte am rechten Rand, weit weg von dem, was sie erklärt. Jetzt
verschiebt der Rundgang nichts mehr: Die Karte liegt über der Seite, direkt unter dem erklärten
Element oder darüber, mittig dazu, mit einem Zeiger darauf. Die Seite rollt so, dass Element und
Karte zusammen ins Fenster passen. Geht das nicht, weil eine Tabelle höher als das Fenster ist
oder die Seite nicht weiter rollt, liegt die Karte unten rechtsbündig über dem Element; dessen
Anfang bleibt frei. Ohne Element steht sie in der Mitte. Die Rechnung steht als reine Funktion in
`components/rundgang/lage.ts` (Unit-Tests), die Lage geht als CSS-Variablen über das CSSOM an
den Dialog, also ohne `style`-Attribut und CSP-fest. In der dunklen Leiste ist die Hervorhebung
hell, sonst sähe man sie im letzten Schritt nicht. Die Browser-Tests messen Kopf, Bereiche und
Arbeitsbereich vor und nach dem Öffnen (gleich auf den Pixel), prüfen bei jedem Schritt die Lage
der Karte und die Farbe der Hervorhebung in der Leiste. Preis: Bei hohen Tabellen deckt die Karte
den unteren Teil ab; dort ist die Seite während des Rundgangs ohnehin gesperrt.
