# Rundgang-App

Eine sehr einfache App für Sicherheitsrundgänge: 5 Kontrollpunkte zum Abhaken und
ein Textfeld für besondere Vorkommnisse.

Die App läuft im Browser des Smartphones und kann auf den Startbildschirm gelegt
werden – sie sieht und verhält sich dann wie eine normale App. Es ist **kein**
App Store, kein Entwicklerkonto und keine Installation nötig.

## Was die App kann

- 5 Kontrollpunkte abhaken
- Beim Abhaken wird automatisch die Uhrzeit festgehalten
- Textfeld für besondere Vorkommnisse
- Alles wird sofort auf dem Handy gespeichert (auch wenn die App geschlossen wird)
- Funktioniert offline, z. B. in der Tiefgarage oder im Keller
- Knopf „Neuer Rundgang“ setzt alles für die nächste Schicht zurück

## Wichtig zu wissen

Die Daten liegen **nur lokal auf dem jeweiligen Handy**, im Speicher des Browsers.
Es gibt noch keinen Server, keine Anmeldung und keine Auswertung. Wer den
Browser-Speicher löscht, löscht auch die Rundgänge. Für einen echten Nachweis
gegenüber dem Kunden brauchen wir später einen Export (z. B. PDF oder E-Mail) –
das ist der nächste sinnvolle Schritt.

## Dateien

| Datei | Wozu |
|---|---|
| `index.html` | Die komplette App: Aussehen und Logik |
| `manifest.webmanifest` | Damit die App auf den Startbildschirm gelegt werden kann |
| `sw.js` | Sorgt dafür, dass die App offline funktioniert |
| `icon.svg` | Das App-Symbol |

## Kontrollpunkte ändern

In `index.html` ganz oben im Skript-Teil steht die Liste. Einfach die Texte
zwischen den Anführungszeichen ersetzen:

```js
const KONTROLLPUNKTE = [
  "Haupteingang",
  "Tiefgarage",
  "Lager / Warenannahme",
  "Bürotrakt 1. OG",
  "Notausgang Hinterhof"
];
```

Es dürfen auch mehr oder weniger als 5 Punkte sein.

## Schritt für Schritt: App aufs Handy bringen

Der Code liegt bereits auf GitHub im Repository `CitadeltaCyber/Rundgang-App`.
Damit die App über einen Link erreichbar ist, schalten wir GitHub Pages ein –
das ist eine kostenlose Funktion von GitHub, die Dateien aus einem Repository
als Webseite veröffentlicht.

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

Danach liegt das Symbol auf dem Startbildschirm und die App öffnet sich im
Vollbild, ohne Adressleiste.

### Vorher kurz am Rechner testen

Doppelklick auf `index.html` genügt für einen ersten Blick. Der Offline-Modus
funktioniert dabei noch nicht – der braucht eine echte Adresse (https), also
GitHub Pages.
