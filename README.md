# Rundgang-App

Eine App für Sicherheitsrundgänge: Kontrollpunkte abhaken – per Hand oder per
NFC-Tag –, besondere Vorkommnisse festhalten und am Schichtende einen Bericht
als PDF erzeugen, weiterleiten oder drucken.

Die App läuft im Browser des Smartphones und kann auf den Startbildschirm gelegt
werden. Es ist **kein** App Store, kein Entwicklerkonto und keine Installation
nötig.

## Was die App kann

- Kontrollpunkte abhaken, mit automatischem Zeitstempel und eigener Uhrzeit-Spalte
- Laufende Uhr oben in der App, immer in deutscher Zeit (Europe/Berlin) –
  unabhängig davon, wie die Zeitzone des jeweiligen Diensthandys eingestellt ist
- **Notiz je Kontrollpunkt:** Knopf „+ Notiz" unter jedem Punkt, für
  Auffälligkeiten genau an diesem Ort (bleibt auch beim Ent-/Abhaken erhalten
  und erscheint im PDF-Bericht)
- Mitarbeitername oder Kürzel pro Rundgang
- **NFC-Tags:** Handy an den Tag halten, der Punkt hakt sich selbst ab
- **Admin-Bereich mit PIN:** Kontrollpunkte umbenennen, hinzufügen, löschen,
  NFC-Tags zuordnen, Objektnamen setzen
- Textfeld für allgemeine besondere Vorkommnisse (zusätzlich zu den Notizen an
  einzelnen Kontrollpunkten)
- **Bericht als PDF**, per WhatsApp o. ä. weiterleiten oder drucken
- Alles wird sofort auf dem Handy gespeichert, funktioniert offline
- „Neuer Rundgang" setzt die Haken zurück – Kontrollpunkte bleiben erhalten

## Admin-Bereich

Knopf **Admin** → PIN eingeben. Der Standard-PIN ist **1234** und sollte sofort
über *PIN ändern* ersetzt werden.

Im Admin-Bereich lassen sich Kontrollpunkte umbenennen, hinzufügen und löschen,
NFC-Tags zuordnen sowie der Objektname setzen (erscheint im Bericht). *Abmelden*
schließt den Bereich wieder; ohne Abmelden bleibt er bis zum Schließen der App
offen.

> **Wichtig – was dieser Schutz leistet und was nicht:** Die App läuft komplett
> auf dem Handy, ohne Server. Der PIN verhindert, dass im Dienst versehentlich
> oder beiläufig Kontrollpunkte verstellt werden. Er ist **kein** Schutz gegen
> jemanden, der es gezielt darauf anlegt – wer sich auskennt, kann den
> Browser-Speicher direkt bearbeiten. Für einen echten Zugangsschutz mit
> Benutzerkonten braucht es einen Server; das wäre der nächste größere Ausbau.

## Bericht: PDF, Weiterleiten, Drucken

Am Ende der Schicht – oder sofort bei besonderen Vorkommnissen:

- **Bericht als PDF** – erzeugt die PDF-Datei und legt sie in den Downloads ab
- **Weiterleiten** – öffnet das Teilen-Menü des Handys, dort WhatsApp, E-Mail,
  Signal usw. auswählen. Die PDF-Datei hängt direkt an
- **Drucken** – öffnet den Druckdialog; dort lässt sich auch „Als PDF speichern"
  wählen

Der Bericht enthält Objekt, Datum, Mitarbeiter, Beginn des Rundgangs, jeden
Kontrollpunkt mit Uhrzeit und Vermerk „(NFC)", nicht erledigte Punkte als
`NICHT ERLEDIGT`, das Gesamtergebnis und die besonderen Vorkommnisse.

Die PDF wird direkt auf dem Handy erzeugt (`pdf.js` in diesem Projekt) – ohne
Server und ohne Nachladen fremder Bibliotheken, damit es auch offline geht.

## NFC: Zwei Wege, weil iPhone und Android sich unterscheiden

**Web-Apps können NFC nur unter Android (Chrome) selbst lesen.** Apple erlaubt
das im iPhone-Browser nicht. Deshalb unterstützt die App zwei Wege, die sich mit
denselben Tags kombinieren lassen.

### Weg 1 – Android: Scan in der App

1. **Admin** → beim gewünschten Punkt auf **Tag zuordnen**
2. Handy an den Tag halten – die Kennung des Tags wird dem Punkt zugeordnet
3. **Admin: Fertig** → oben auf **NFC-Scan starten**
4. Ab jetzt hakt jeder erkannte Tag seinen Punkt automatisch ab

### Weg 2 – iPhone und Android: Tag mit Adresse beschreiben

1. Auf einem **Android**-Handy: **Admin** → **Tag beschreiben**
2. Handy an den Tag halten – darauf wird die Web-Adresse des Punktes
   gespeichert, z. B. `https://…/#punkt=p3f9a1`
3. Dieser Tag funktioniert danach auf **beiden** Systemen: iOS erkennt solche
   Adress-Tags von selbst, zeigt eine Meldung, und beim Antippen öffnet sich die
   App mit dem bereits abgehakten Punkt

Zum Programmieren der Tags wird einmalig ein Android-Handy gebraucht; benutzt
werden können sie danach auch mit iPhones.

### Passende Tags kaufen

- **NTAG213 / NTAG215** sind Standard und funktionieren mit allen Handys
- Für Montage auf **Metall** (Türen, Schränke, Zäune) unbedingt
  „On-Metal"-Tags nehmen – normale Tags funktionieren dort nicht
- Für draußen: wetterfeste Ausführung (IP67) oder Hartplastik-Tokens

## Wichtig zu wissen

**Die Daten liegen nur lokal auf dem jeweiligen Handy**, im Speicher des
Browsers. Es gibt keinen Server und keine zentrale Auswertung. Wer den
Browser-Speicher löscht, löscht auch den laufenden Rundgang. Deshalb: **PDF vor
„Neuer Rundgang" sichern.**

**NFC ist ein Anwesenheitsnachweis, aber kein Fälschungsschutz.** Die Kennung
eines gewöhnlichen Tags lässt sich mit passender Technik auslesen und kopieren.

**Datenschutz:** Sobald festgehalten wird, welcher Mitarbeiter wann wo war,
entstehen personenbezogene Daten und eine Form von Leistungskontrolle. In
Deutschland ist dafür je nach Betrieb eine Betriebsvereinbarung nötig, und die
Beschäftigten müssen informiert werden. Das sollte vor dem Echteinsatz geklärt
sein.

## Dateien

| Datei | Wozu |
|---|---|
| `index.html` | Aufbau der Seite |
| `app.js` | Logik: Abhaken, Admin, NFC, Bericht, Speichern |
| `pdf.js` | Erzeugt die PDF-Datei auf dem Handy |
| `styles.css` | Aussehen, auch das Drucklayout |
| `manifest.webmanifest` | Damit die App auf den Startbildschirm kann |
| `sw.js` | Sorgt dafür, dass die App offline funktioniert |
| `icon.svg` | Das App-Symbol |

Aktuell **keine** `CNAME`-Datei – die App läuft über die Standardadresse
`https://citadeltacyber.github.io/Rundgang-App/`. Eine eigene Domain kommt erst
dazu, wenn die DNS-Einträge beim Domain-Anbieter gesetzt sind (siehe unten).

## Veröffentlichen mit GitHub Pages

1. Repository auf github.com öffnen: `CitadeltaCyber/Rundgang-App`
2. Oben auf **Settings**, links auf **Pages**
3. Unter *Source* **Deploy from a branch**, Branch auswählen, Ordner `/ (root)`
4. **Save**, dann 1–2 Minuten warten

### Eigene Domain einrichten (später)

**Wichtig:** Zuerst beim Domain-Anbieter die DNS-Einträge setzen, *danach*
im Repository die `CNAME`-Datei mit der eigenen Domain anlegen – nicht
umgekehrt, und niemals die eigene `github.io`-Adresse selbst als Domain
eintragen (das ist kein gültiger Wert).

Beim Anbieter in der DNS-Verwaltung anlegen:

| Typ | Name | Wert |
|---|---|---|
| CNAME | `www` | `citadeltacyber.github.io` |

Soll auch `citadeltacyber.io` ohne `www` funktionieren, zusätzlich vier
A-Einträge auf `@` anlegen:

```
185.199.108.153
185.199.109.153
185.199.110.153
185.199.111.153
```

Erst danach eine Datei `CNAME` mit dem Inhalt `www.citadeltacyber.io`
anlegen und unter *Settings → Pages* **Enforce HTTPS** einschalten, sobald es
anwählbar ist. Bis DNS-Änderungen greifen, kann es einige Stunden dauern.

### Auf dem Handy einrichten

**Android (Chrome):** Adresse öffnen → Menü (drei Punkte) → *Zum Startbildschirm
hinzufügen*

**iPhone (Safari):** Adresse in **Safari** öffnen (nicht Chrome) → Teilen-Symbol
→ *Zum Home-Bildschirm*

NFC funktioniert nur über eine echte `https`-Adresse, also über GitHub Pages –
beim Öffnen der Datei direkt vom Rechner bleibt der NFC-Knopf wirkungslos.
