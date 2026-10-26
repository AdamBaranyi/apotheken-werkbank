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
