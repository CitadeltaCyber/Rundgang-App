# Rundgang-App

Eine einfache App für Sicherheitsrundgänge: Kontrollpunkte abhaken – per Hand
oder per NFC-Tag – und besondere Vorkommnisse festhalten.

Die App läuft im Browser des Smartphones und kann auf den Startbildschirm gelegt
werden. Es ist **kein** App Store, kein Entwicklerkonto und keine Installation
nötig.

## Was die App kann

- Kontrollpunkte abhaken, mit automatischem Zeitstempel
- **Kontrollpunkte selbst bearbeiten:** umbenennen, hinzufügen, löschen
- **NFC-Tags:** Handy an den Tag halten, der Punkt hakt sich selbst ab
- Textfeld für besondere Vorkommnisse
- Alles wird sofort auf dem Handy gespeichert
- Funktioniert offline, z. B. in der Tiefgarage oder im Keller
- „Neuer Rundgang" setzt die Haken zurück – die Kontrollpunkte bleiben erhalten

## Kontrollpunkte bearbeiten

Oben auf **Bearbeiten** tippen. Dann lässt sich jeder Name direkt überschreiben,
unten neue Punkte hinzufügen und einzelne löschen. **Fertig** schließt den
Modus. Änderungen gelten sofort und bleiben gespeichert – es muss dafür nichts
mehr im Code geändert werden.

## NFC: Zwei Wege, weil iPhone und Android sich unterscheiden

Das ist der wichtigste Punkt bei NFC: **Web-Apps können NFC nur unter Android
(Chrome) selbst lesen.** Apple erlaubt das im iPhone-Browser nicht. Deshalb
unterstützt die App zwei Wege, die sich mit denselben Tags kombinieren lassen.

### Weg 1 – Android: Scan in der App

1. **Bearbeiten** → beim gewünschten Punkt auf **Tag zuordnen**
2. Handy an den Tag halten – die Kennung des Tags wird dem Punkt zugeordnet
3. **Fertig** → oben auf **NFC-Scan starten**
4. Ab jetzt hakt jeder erkannte Tag seinen Punkt automatisch ab

### Weg 2 – iPhone und Android: Tag mit Adresse beschreiben

1. Auf einem **Android**-Handy: **Bearbeiten** → **Tag beschreiben**
2. Handy an den Tag halten – darauf wird die Web-Adresse des Punktes
   gespeichert, z. B. `https://…/Rundgang-App/#punkt=p3f9a1`
3. Dieser Tag funktioniert danach auf **beiden** Systemen: iOS erkennt solche
   Adress-Tags von selbst, zeigt eine Meldung, und beim Antippen öffnet sich die
   App mit dem bereits abgehakten Punkt

Zum Programmieren der Tags wird also einmalig ein Android-Handy gebraucht;
benutzt werden können sie danach auch mit iPhones.

### Passende Tags kaufen

- **NTAG213 / NTAG215** sind Standard und funktionieren mit allen Handys
- Für Montage auf **Metall** (Türen, Schränke, Zäune) unbedingt
  „On-Metal"-Tags nehmen – normale Tags funktionieren dort nicht
- Für draußen: wetterfeste Ausführung (IP67) oder Hartplastik-Tokens

## Wichtig zu wissen

**Die Daten liegen nur lokal auf dem jeweiligen Handy**, im Speicher des
Browsers. Es gibt keinen Server, keine Anmeldung und keine Auswertung. Wer den
Browser-Speicher löscht, löscht auch die Rundgänge. Als Nachweis gegenüber
einem Kunden reicht das noch nicht.

**NFC ist ein Anwesenheitsnachweis, aber kein Fälschungsschutz.** Die Kennung
eines gewöhnlichen Tags lässt sich mit passender Technik auslesen und
kopieren. Gegenüber einem reinen Haken auf dem Display ist es ein deutlicher
Fortschritt – als gerichtsfester Beweis taugt es nicht.

**Datenschutz:** Sobald festgehalten wird, welcher Mitarbeiter wann wo war,
entstehen personenbezogene Daten und eine Form von Leistungskontrolle. In
Deutschland ist dafür je nach Betrieb eine Betriebsvereinbarung nötig, und die
Beschäftigten müssen informiert werden. Das sollte vor dem Echteinsatz geklärt
sein.

## Dateien

| Datei | Wozu |
|---|---|
| `index.html` | Aufbau der Seite |
| `app.js` | Die gesamte Logik: Abhaken, Bearbeiten, NFC, Speichern |
| `styles.css` | Aussehen |
| `manifest.webmanifest` | Damit die App auf den Startbildschirm kann |
| `sw.js` | Sorgt dafür, dass die App offline funktioniert |
| `icon.svg` | Das App-Symbol |

## Schritt für Schritt: App aufs Handy bringen

Damit die App über einen Link erreichbar ist, schalten wir GitHub Pages ein –
eine kostenlose Funktion von GitHub, die Dateien aus einem Repository als
Webseite veröffentlicht.

1. Repository auf github.com öffnen: `CitadeltaCyber/Rundgang-App`
2. Oben auf **Settings** klicken
3. Links in der Seitenleiste auf **Pages**
4. Unter *Source* **Deploy from a branch** auswählen
5. Als Branch den Branch mit diesem Code auswählen, als Ordner `/ (root)`
6. Auf **Save** klicken
7. 1–2 Minuten warten, dann erscheint oben auf derselben Seite die Adresse,
   ungefähr so: `https://citadeltacyber.github.io/Rundgang-App/`

### Auf dem Handy einrichten

**Android (Chrome):** Adresse im Browser öffnen → Menü (drei Punkte oben rechts)
→ *Zum Startbildschirm hinzufügen*

**iPhone (Safari):** Adresse in **Safari** öffnen (nicht Chrome) → Teilen-Symbol
unten → *Zum Home-Bildschirm*

NFC funktioniert nur über eine echte `https`-Adresse, also über GitHub Pages –
beim bloßen Öffnen der Datei vom Rechner aus bleibt der NFC-Knopf wirkungslos.
