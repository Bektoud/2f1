# Prüfbericht

**Datum:** 10. November 2026

**Ausgabedatei:** `index.html`

**Grösse:** 32’858’066 Bytes (32,86 MB / 31,34 MiB)

## Daten und Bildarchiv

- Genau 128 Angebote; Nummern 1 bis 128 und 128 eindeutige IDs.
- Alle Firmen, Angebotstexte, Dealtypen, Kategorien und IDs der eingebetteten Daten stimmen mit der Eingabe-JSON überein. `region` und `hinweis` sind ebenfalls übernommen.
- 118 unterschiedliche Firmen, 86 reine 2für1-Angebote, 37 reine 50-%-Rabatt-Angebote und 5 weitere Dealtypen/Kombinationen.
- Kategorien: Essen & Trinken 27, Ausgang & Nachtleben 5, Freizeit & Sport 46, Einkaufen & Dienstleistungen 39, Wellness & Beauty 11.
- Das ZIP enthält 128 ID-Ordner und ein Manifest. Die Dateipfade sind lexikografisch sortiert; das Manifest folgt den Angebotsnummern. Die Zuordnung benutzt das Manifest und die IDs, nicht die Reihenfolge.
- Alle 382 vorhandenen JPG-Dateien anhand von Magic Bytes und durch Dekodieren geprüft. Keine unzugeordneten Bilder und keine Formatfehler.
- Zwei fehlende Rückseiten: Nr. 71 und Nr. 121.
- Eine falsche Rückseite: Nr. 70 ist bytegleich mit der Vorderseite von Museum.BL, Nr. 57. Der Befund wurde zusätzlich visuell geprüft.
- Die drei Ersatzdarstellungen wurden vor der Umsetzung bestätigt. Die alternative stärkere Kompression wurde angeboten; gewählt wurde die schonende Variante mit ungefähr 33 MB.
- Alle 381 unterschiedlichen, verwendbaren Bildinhalte der Ausgabedatei erfolgreich als WebP dekodiert. Bildabmessungen geprüft; sämtliche 125 richtigen Rückseiten behalten 1206 × 1700 Pixel.
- Komprimierte Vorder- und Rückseiten stichprobenweise visuell mit den Originalen verglichen. Der Text bleibt in voller Bildansicht lesbar; zusätzlich steht ein Zoom zur Verfügung.
- Keine externen Foto-URLs in der Ausgabedatei. Alle statischen Ressourcen sind eingebettete Daten oder Dokumentfragmente. Externe Verbindungen sind zusätzlich durch die Content Security Policy ausgeschlossen.
- JavaScript-Syntax mit `node --check` geprüft. Endgrösse und SHA-256 gegen `bildpruefung.json` geprüft.
- Die sieben Highlights verweisen auf die Angebote 126, 45, 119, 61, 17, 53 und 103. Ortsangaben, Leistungen, Einlösebedingungen und Gültigkeiten wurden mit den Original-Rückseiten abgeglichen.

## Überarbeitung des Einstiegs

- Das bisherige Dashboard mit Werbetexten, Kennzahlen und Zielgruppen wurde durch eine horizontal scrollbare Auswahl von sieben grösseren Angeboten ersetzt.
- sole uno, FC Basel, aquabasilea, Seilpark Balmberg, Restaurant Seegarten, Kino Sputnik und Metzgerei Zimmermann werden mit sachlichen Zusatzinformationen vorgestellt.
- Der Kopfbereich zeigt Region und Ausgabe. Oberflächentexte, Leerzustände und Hilfetexte sind neutral formuliert.
- Der technische Abschnitt zu Daten und Bildern steht in `README.md` und wurde aus dem Seitenfuss entfernt.
- Vorschaubilder füllen ihre Bildfläche; die schmalen seitlichen Leerstreifen durch das bisherige Einpassen sind beseitigt. Die vollständigen Gutscheinseiten bleiben im Detailfenster einpassbar und vergrösserbar.
- Die Highlights blättern alle fünf Sekunden automatisch weiter, einschliesslich Rückkehr zum ersten Angebot. Interaktion beendet die Automatik bis zum Neuladen; manuelles Blättern bleibt möglich.

## Browserprüfungen

**30 erfolgreiche Prüfgruppen**, jeweils 15 in:

- Chromium 158.0.8127.18
- Firefox 159.0

Die Website wurde direkt über `file://` geöffnet; das Netzwerk des Browser-Kontexts war deaktiviert. Getestet wurde die vollständige generierte Datei, nicht die Vorlage.

| Bereich | Verifiziert |
| --- | --- |
| Vollständigkeit | Genau 128 sichtbare Karten ohne Filter; fünf Gruppen; korrekte, aus den Daten berechnete Filterzahlen; Region und Ausgabe im Kopfbereich |
| Angebotstexte | Präfixentfernung bei einfachen Deals; Gross-/Kleinschreibung erhalten; gemischte Deals und die Rabatt-Obergrenze bei Nr. 95 bleiben vollständig |
| Filter | Alle 24 Kombinationen aus sechs Kategorie-Auswahlen und vier Deal-Auswahlen; Zustandsattribute; Live-Trefferzahl |
| Suche | Firmen- und Stichwortsuche, mehrere Suchbegriffe, Gross-/Kleinschreibung und Suche mit/ohne Akzente |
| Leerzustand | Keine Treffer, hilfreiche Meldung und vollständiges Zurücksetzen aller Filter |
| Highlights | Sieben korrekte Verweise mit Zusatzangaben; Vor-/Zurück-Knöpfe, Direktwahl, horizontales Scrollen, Pfeiltasten, Home und End; Öffnen der Details und Rückgabe des Fokus |
| Automatisches Blättern | Mit Browser-Testuhr geprüft: erster Wechsel nach fünf Sekunden, alle sieben Angebote, Rückkehr zum Anfang; die jeweils ausgewählte Karte ist vollständig sichtbar |
| Interaktionsstopp | Mauszeiger über den Highlights, Touch auf eine Karte und Tastaturfokus beenden die Automatik; auch nach Verlassen des Bereichs bleibt sie aus, manuelle Pfeile funktionieren weiterhin |
| Automatik-Pausen | Kein Wechsel ausserhalb des sichtbaren Bereichs, bei reduzierter Bewegung oder während geöffneter Dialoge; automatisches Weiterblättern setzt danach ohne vorherige Interaktion wieder ein |
| Highlight-Tastatur | Tab-Reihenfolge zwischen Angebotsaufruf und Merk-Knopf; beim Fokussieren eines weiteren Highlights wird dessen Karte in den sichtbaren Bereich gescrollt |
| Vorschaubilder | Bündiger Abschluss links und rechts, auch im dunklen Modus; kleine Angebotskarten und grössere Highlight-Darstellung visuell geprüft |
| Detailfenster | Öffnen per Karte, Bildfläche und Tastatur; Vorder-/Rückseiten; passende Alternativtexte; vollständiges Einpassen statt Abschneiden |
| Stabile Darstellung | Identische Grösse des Bildbereichs beim Seitenwechsel, einschliesslich Ersatzdarstellungen |
| Zoom | Volle eingebettete Auflösung, Scrollen mit Tastatur, Einpassen; kein seitliches Scrollen der Seite |
| Navigation | Vor-/Zurück-Knöpfe und Pfeiltasten; Ringnavigation in der Gesamtliste und einer gefilterten Liste |
| Schliessen und Fokus | Schliessknopf, Escape, Hintergrundklick, Fokus beim Öffnen und Rückgabe an den Auslöser; Fokusbegrenzung mit Tab/Shift+Tab |
| Fehlende Bilder | Ersatz-Rückseiten Nr. 70, 71 und 121 mit korrektem Deal, Firma, Angebotstext, Kategorie und Bildhinweis |
| Merken | Herz-Klick öffnet kein Detailfenster; synchroner Zustand in Karte, Highlights und Detail, auch beim Blättern |
| Gemerkt-Filter | Kombination mit Suche, Kategorie und Deal; Filter verändern die Merkliste nicht |
| Sitzungsdauer | Auswahl bleibt beim Neuladen; ein neuer Tab startet mit leerer Merkliste |
| Merkliste | Gruppierung, alphabetische Firmenreihenfolge, Detailaufruf, Einzelentfernung und hilfreicher Leerzustand |
| Verschachtelte Fenster | Detail aus der Merkliste; Rückkehr auch dann korrekt, wenn der ursprüngliche Eintrag inzwischen entfernt wurde |
| Liste leeren | Rückfrage, Abbrechen, bestätigtes Leeren, deaktivierter Export, Ansage der Änderung und leere Auswahl nach Neuladen |
| Speicher-Fallback | Lesender und schreibender Zugriff auf blockiertes `sessionStorage` werfen Fehler; die Merkliste funktioniert dennoch im Arbeitsspeicher |
| Responsive Layout | 320, 390, 768, 1024 und 1440 Pixel Breite; kein horizontaler Seitenüberlauf; beide Fenster auf schmalem Bildschirm |
| Erscheinungsbild | Heller und dunkler Gerätemodus, einschliesslich Merkliste; Screenshots visuell geprüft |
| Reduzierte Bewegung | `prefers-reduced-motion: reduce` deaktiviert automatisches Blättern, sanftes Scrollen der Seite und Highlights sowie Übergänge; Änderungen der Einstellung werden unmittelbar berücksichtigt |
| Laufzeit/Offline | Keine externen HTTP(S)-Requests, keine JavaScript- oder Konsolenfehler; Gutscheinseiten werden erst bei Bedarf dekodiert |

## Tatsächlicher Textexport

In beiden Browsern wurde die Datei über den Exportknopf tatsächlich heruntergeladen und anschliessend byteweise geprüft:

- Dateiname `merkliste-JJJJ-MM-TT.txt`, mit lokalem Datum.
- Titel enthält den vollständigen Namen aus dem JSON-Feld `region`.
- Exportdatum und richtige Anzahl gemerkter Angebote enthalten.
- Kategorien in der Reihenfolge des Gutscheinbuchs; Firmen innerhalb der Kategorien mit `Intl.Collator('de-CH')` alphabetisch sortiert.
- Firma, Deal und vollständiger Original-Angebotstext jedes Eintrags vorhanden.
- Unter anderem `Café Bäckerei`, `Rössli`, `«HUUS»` und `«VOLKSSTIMME»` korrekt erhalten.
- Die ersten drei Bytes sind `EF BB BF` (UTF-8-BOM).
- Ausschliesslich CRLF-Zeilenumbrüche; keine einzelnen LF- oder CR-Zeichen.
- Einträge mit einfachen `[ ]`-Kästchen und Text-Trennlinien, ohne Markdown-Auszeichnung.
- Keine erfundenen Adressen, Öffnungszeiten oder Gültigkeiten. Ein kurzer eigener Hinweis verweist auf die Gutschein-Rückseite.
- Der Export ist bei leerer Merkliste deaktiviert.

## Automatisierte Barrierefreiheit

axe-core 4.14.0 wurde mit den Regelgruppen WCAG 2 A/AA und WCAG 2.1 A/AA ausgeführt. In beiden Browsern wurden die Hauptseite, das geöffnete Detailfenster und die geöffnete Merkliste jeweils im hellen und dunklen Modus geprüft: **keine automatisiert festgestellten Verstösse**.

Zusätzlich wurden Tastaturaktivierung, Tab-Reihenfolge der Fenster, Fokus-Rückgabe, Alternativtexte, Filterzustände, `aria-pressed` der Merk-Knöpfe und die Live-Region nach dem Leeren funktional getestet.

## Reproduzieren

```sh
python3 tools/build.py
python3 tests/check_build.py
npm run test:browser
```

Die Build- und Testabhängigkeiten sowie die Einrichtung der Browser sind in `README.md` beschrieben. `bildpruefung.json` enthält den maschinenlesbaren Originalbefund und den SHA-256-Fingerabdruck der fertigen Datei.
