# Fragen und Antworten zum Projekt

Fragen, die zu diesem Repo naheliegen, mit Antworten aus dem, was hier gebaut und gemessen wurde.
Belege stehen in den verlinkten Dateien.

## Engine

**1. Warum bedient die Engine eine Kasse über den Bildschirm statt über eine Schnittstelle?**
Weil viele Kassensysteme keine Schnittstelle für diese Abläufe haben, oder nur eine teure, die
einen Teil abdeckt. Wo es eine Schnittstelle gibt, ist sie besser; die Engine ist der Weg, wenn es
keine gibt. ([UEBERBLICK.md](UEBERBLICK.md))

**2. Was ist ein Flow?** Ein Arbeitsablauf an einer bestimmten Kasse als YAML-Datei: Klicke,
Eingeben, Taste, Warten, Lesen, mit Fenstertitel, Beschriftungen und Abständen dieser Kasse. Eine
neue Apotheke auszurollen heisst, einen Flow mit ihren Werten anzulegen, mit `lint` und Trockenlauf
zu prüfen und freizugeben. ([ENGINE.md](ENGINE.md))

**3. Wie verhindert die Engine eine doppelte Buchung?** Jeder Auftrag hat eine Kennung, die als
Referenz auf dem Beleg steht. Bevor ein Verkauf beginnt, sucht der Flow die Kennung im Journal der
Kasse; gibt es einen Beleg, endet der Lauf mit «bereits gebucht». Ein buchender Klick wird nie
wiederholt. (E33)

**4. Was heisst «unklar»?** Ein buchender Schritt ist gesendet, aber die Bestätigung kam nicht.
Die Engine rät nicht und klickt nicht noch einmal. Ein neuer Lauf mit derselben Kennung klärt es
über die Referenz. Dasselbe Muster wie beim Bestellen über MSV3: ID vor dem Senden, nachfragen
statt neu senden. (E25, E33)

**5. Wie sicher liest die OCR?** Gemessen auf Segoe UI 9 pt: 18 von 20 Prüfwörtern in echter
Grösse, 20 von 20 dreifach hochskaliert. Da `Windows.Media.Ocr` keine Sicherheit je Wort liefert,
vergleicht die Engine selbst mit Schwelle, Kurzwörter und Kennungen genau, und gleicht O/0, I/l/1
und ähnliche Verwechslungen aus. (E32)

**6. Was war der überraschendste Fehler?** Die blinkende Schreibmarke im Feld. Die OCR las die
Menge «1» als «1|», und ob ein Lauf gelang, hing davon ab, ob die Marke beim Bildschirmfoto gerade
an war. Gefunden hat es erst der echte Lauf auf Windows; jetzt verlässt die Engine das Feld vor der
Prüfung, und die Simulation zeigt die Marke auch. (E37)

**7. Wie testet man eine Bildschirm-Automatisierung ohne Windows?** Mit einem Fake-Treiber, der
dieselbe Kasse als Wörter mit Lage zeigt, wie eine OCR sie liefert, gebaut auf demselben Layout und
derselben Logik wie das echte Fenster. Dazu Chaos: springendes und wanderndes Fenster, langsame
Kasse, Nullen als O, Dialoge, Schreibmarke. Was die Simulation anders macht, finden die echten
Läufe auf Windows-Läufern der CI. (E31)

**8. Was passiert bei einem Dialog, mit dem niemand gerechnet hat?** Stufe 1 klickt bekannte
Dialoge aus dem Flow weg. Ein unbekannter führt zum Abbruch mit Bildschirmfoto, oder zur
Selbstheilung: Ein Modell schlägt eine Aktion vor, die Engine führt nur aus, was der Flow erlaubt.
(E35)

**9. Was, wenn das Modell etwas Falsches vorschlägt?** Dann passiert es nicht. Ausgeführt wird
nur ein Klickziel aus der Liste des Flows, das eindeutig sichtbar ist, dazu Escape oder Warten.
Ein Vorschlag «Karte» wird im Test abgelehnt; eine Sabotage hält fest, dass die Prüfung wirkt.

**10. Kann ein Text auf dem Bildschirm das Modell manipulieren?** Er kann es beeinflussen, aber
keinen Knopf freischalten, den der Flow nicht erlaubt. Darum liegt die Sicherheit in der Liste,
nicht im Modell. Bei einer echten Kasse kommen Gesundheitsdaten dazu: Ein Modell darf dort nur
laufen, wo die Daten bleiben dürfen.

**11. Was kostet die Selbstheilung?** Ein Vorschlag mit Bildschirmfoto kostet mit Claude Haiku 5.5
etwa 0,0002 $. Deckel: drei Fragen je Lauf, eine Zahl je Tag, dazu ein Monatslimit beim Anbieter.

## Web-App, Daten, Sicherheit

**12. Wie trennen sich die Apotheken?** Mit Row Level Security in Postgres, getestet in beiden
Rollen, als Mitglied und als Fremder. Die Web-App fragt immer mit der Sitzung der angemeldeten
Person; einen Geheimschlüssel der Datenbank hat sie nicht. (E17)

**13. Wie meldet die Engine an den Flow-Monitor, ohne zu viel zu dürfen?** Mit einem eigenen
Konto, das kein Mitglied ist: Es schreibt Läufe und Fotos seiner Apotheke und liest nichts, nicht
einmal die eigenen Läufe. Die Apotheke setzt die Datenbank. (E36)

**14. Wie verhindert die Kasse doppelte Belege bei einem Doppelklick?** Die ID entsteht beim
Seitenaufbau; derselbe Schlüssel mit demselben Inhalt liefert denselben Beleg, mit anderem Inhalt
einen Fehler. Belegnummern laufen lückenlos über einen Zähler in derselben Transaktion. (E22)

**15. Was fehlt der Kasse, um echt zu sein?** Eine TSE (§ 6 KassenSichV) mit Signatur je Buchung
und ein DSFinV-K-Export. Jeder Beleg der Werkbank sagt, dass das fehlt. ([KASSE.md](KASSE.md))

**16. Wie ist die Anmeldung gegen Raten geschützt?** Eine Bremse in Postgres zählt Fehlversuche
je Konto und IP, prüft und zählt in einem Schritt unter Sperre und sperrt, wenn sie gestört ist.
Eine Sperre nur je Konto wäre selbst ein Angriff. (E23)

## Arbeitsweise

**17. Wie stellst du sicher, dass Code von einem KI-Agenten stimmt?** Spezifikation zuerst, Tests
vor dem Code, eine Sabotage für jede Schutzfunktion, eine zweite Durchsicht vor dem Merge und die
CI als Tor. Gemergt wird nur der geprüfte Commit. ([ARBEITSWEISE.md](ARBEITSWEISE.md))

**18. Was ist eine Sabotage?** Ein absichtlich eingebauter Fehler: eine fehlende Regel, ein
vertauschter Wert. Der passende Test muss rot werden; danach wird zurückgebaut. Eine Sabotage, die
grün bleibt, zeigte hier zweimal einen Test, der nicht prüfte, was er versprach.

**19. Was hast du verworfen?** Unter anderem: Deutsch für die OCR nachzuinstallieren (über zwölf
Minuten), Wartezeiten wie Aktionen zu wiederholen (aus «unklar» wurde «ok»), Fehlermeldungen vor
jeder Aktion neu als alt zu merken (ein Verkauf buchte nach einer Ablehnung weiter). Die Liste steht
mit Gründen in [ARBEITSWEISE.md](ARBEITSWEISE.md).

**20. Wie schnell entsteht ein Prototyp?** In zwei Stunden nach festem Rezept: Frage, Nutzer,
kleinste Oberfläche, Attrappen-Daten mit den schwierigen Fällen, Messung, Entscheid.
([PROTOTYP-REZEPT.md](PROTOTYP-REZEPT.md))

**21. Was hat der Prototyp ergeben?** Von zehn erfundenen Rezeptdatensätzen buchte die Engine
fünf, erkannte ein doppeltes und liess vier mit Grund für einen Menschen liegen. Entscheid:
weiter, aber den Bon nur vorbereiten, weil ein Rezept vor der Abgabe pharmazeutisch geprüft wird.
([Prototyp](../prototypen/rezept-zur-kasse/README.md))

**22. Was würdest du als Nächstes bauen?** Die OCR als dauernden Prozess statt als Neustart je
Bild (heute etwa 1,5 Sekunden je Bild), einen Flow «Bon vorbereiten» ohne buchenden Schritt und
eine Datenbank für den Grosshandel, damit Bestellstatus sieben Tage abrufbar bleiben.
