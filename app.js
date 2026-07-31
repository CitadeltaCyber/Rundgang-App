/* Rundgang-App
 *
 * Zwei getrennte Speicher:
 *   KONFIG  = die Kontrollpunkte selbst (Name, zugeordneter NFC-Tag).
 *             Bleibt über alle Schichten hinweg bestehen.
 *   AKTUELL = der laufende Rundgang (was ist abgehakt, wann, Vorkommnisse).
 *             Wird von "Neuer Rundgang" geleert.
 */

const KONFIG_KEY = "rundgang.konfig.v2";
const AKTUELL_KEY = "rundgang.aktuell.v2";
const ALT_KEY = "rundgang.v1"; // Speicher der ersten Version

const STANDARDPUNKTE = [
  "Haupteingang",
  "Tiefgarage",
  "Lager / Warenannahme",
  "Bürotrakt 1. OG",
  "Notausgang Hinterhof"
];

const el = {
  liste: document.getElementById("liste"),
  datum: document.getElementById("datum"),
  fortschritt: document.getElementById("fortschritt"),
  meldung: document.getElementById("meldung"),
  vorkommnisse: document.getElementById("vorkommnisse"),
  nfcScan: document.getElementById("nfcScan"),
  bearbeiten: document.getElementById("bearbeiten"),
  punktHinzu: document.getElementById("punktHinzu"),
  neu: document.getElementById("neu")
};

const nfcVerfuegbar = "NDEFReader" in window;

let konfig = ladeKonfig();
let aktuell = ladeAktuell();
let bearbeitenModus = false;
let leser = null;        // laufender NFC-Leser
let zuordnenFuer = null; // ID des Punktes, dem der nächste Tag zugeordnet wird

/* ---------- Speichern und Laden ---------- */

function neueId() {
  return "p" + Math.random().toString(36).slice(2, 8);
}

function lies(key) {
  try {
    const roh = localStorage.getItem(key);
    return roh ? JSON.parse(roh) : null;
  } catch (e) {
    return null; // kaputte Daten ignorieren statt abstürzen
  }
}

function ladeKonfig() {
  const gespeichert = lies(KONFIG_KEY);
  if (Array.isArray(gespeichert) && gespeichert.length) return gespeichert;

  // Namen aus der ersten App-Version übernehmen, falls vorhanden
  const alt = lies(ALT_KEY);
  const namen = alt && Array.isArray(alt.punkte)
    ? alt.punkte.map(p => p.name)
    : STANDARDPUNKTE;

  return namen.map(name => ({ id: neueId(), name, tagId: null }));
}

function ladeAktuell() {
  const gespeichert = lies(AKTUELL_KEY);
  if (gespeichert && gespeichert.status) return gespeichert;
  return leererRundgang();
}

function leererRundgang() {
  return { begonnen: new Date().toISOString(), status: {}, vorkommnisse: "" };
}

function speichern() {
  localStorage.setItem(KONFIG_KEY, JSON.stringify(konfig));
  localStorage.setItem(AKTUELL_KEY, JSON.stringify(aktuell));
}

/* ---------- Anzeige ---------- */

function uhrzeit(iso) {
  return new Date(iso).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}

function meldung(text, warnung) {
  el.meldung.textContent = text;
  el.meldung.classList.toggle("warnung", !!warnung);
  el.meldung.classList.add("sichtbar");
}

function meldungWeg() {
  el.meldung.classList.remove("sichtbar");
}

function zeichnen() {
  el.datum.textContent = new Date(aktuell.begonnen).toLocaleDateString("de-DE", {
    day: "2-digit", month: "2-digit", year: "numeric"
  });

  el.liste.replaceChildren();
  konfig.forEach((punkt, i) => {
    el.liste.append(bearbeitenModus ? zeileBearbeiten(punkt, i) : zeileAbhaken(punkt, i));
  });

  const erledigt = konfig.filter(p => aktuell.status[p.id]?.erledigt).length;
  el.fortschritt.textContent =
    erledigt + " von " + konfig.length + " Kontrollpunkten erledigt";

  el.punktHinzu.hidden = !bearbeitenModus;
}

function zeileAbhaken(punkt, i) {
  const stand = aktuell.status[punkt.id] || {};

  const li = document.createElement("li");
  const label = document.createElement("label");
  label.className = "zeile";

  const box = document.createElement("input");
  box.type = "checkbox";
  box.checked = !!stand.erledigt;
  box.addEventListener("change", () => abhaken(punkt.id, box.checked, "hand"));

  const spalte = document.createElement("div");
  spalte.className = "punkt";

  const name = document.createElement("span");
  name.className = "name";
  name.textContent = (i + 1) + ". " + punkt.name;

  const zeit = document.createElement("span");
  zeit.className = "zeit";
  if (stand.erledigt) {
    zeit.textContent = "kontrolliert um " + uhrzeit(stand.zeit) + " Uhr" +
      (stand.quelle === "nfc" ? " · per NFC" : "");
  } else if (punkt.tagId) {
    zeit.textContent = "NFC-Tag hinterlegt";
  }

  spalte.append(name, zeit);
  label.append(box, spalte);
  li.append(label);
  return li;
}

function zeileBearbeiten(punkt, i) {
  const li = document.createElement("li");
  const zeile = document.createElement("div");
  zeile.className = "zeile";

  const feld = document.createElement("input");
  feld.type = "text";
  feld.value = punkt.name;
  feld.setAttribute("aria-label", "Name von Kontrollpunkt " + (i + 1));
  feld.addEventListener("input", () => {
    punkt.name = feld.value;
    speichern();
  });

  const loeschen = document.createElement("button");
  loeschen.type = "button";
  loeschen.className = "klein gefahr";
  loeschen.textContent = "Löschen";
  loeschen.addEventListener("click", () => punktLoeschen(punkt.id));

  zeile.append(feld, loeschen);

  const tagZeile = document.createElement("div");
  tagZeile.className = "tagZeile";

  const info = document.createElement("span");
  info.className = "tagInfo" + (punkt.tagId ? " hat" : "");
  info.textContent = punkt.tagId ? "Tag: " + punkt.tagId : "Kein NFC-Tag zugeordnet";
  tagZeile.append(info);

  if (nfcVerfuegbar) {
    const zuordnen = document.createElement("button");
    zuordnen.type = "button";
    zuordnen.className = "klein";
    zuordnen.textContent = punkt.tagId ? "Tag neu zuordnen" : "Tag zuordnen";
    zuordnen.addEventListener("click", () => tagZuordnenStarten(punkt.id));

    const beschreiben = document.createElement("button");
    beschreiben.type = "button";
    beschreiben.className = "klein";
    beschreiben.textContent = "Tag beschreiben";
    beschreiben.addEventListener("click", () => tagBeschreiben(punkt));

    tagZeile.append(zuordnen, beschreiben);
  }

  if (punkt.tagId) {
    const entfernen = document.createElement("button");
    entfernen.type = "button";
    entfernen.className = "klein";
    entfernen.textContent = "Tag entfernen";
    entfernen.addEventListener("click", () => {
      punkt.tagId = null;
      speichern();
      zeichnen();
    });
    tagZeile.append(entfernen);
  }

  const box = document.createElement("div");
  box.append(zeile, tagZeile);
  li.append(box);
  return li;
}

/* ---------- Aktionen ---------- */

function abhaken(id, erledigt, quelle) {
  if (erledigt) {
    // Uhrzeit festhalten - ein Haken ohne Zeitstempel ist als Nachweis wertlos.
    aktuell.status[id] = { erledigt: true, zeit: new Date().toISOString(), quelle };
  } else {
    delete aktuell.status[id];
  }
  speichern();
  zeichnen();
}

function punktLoeschen(id) {
  const punkt = konfig.find(p => p.id === id);
  if (!confirm("Kontrollpunkt „" + punkt.name + "“ wirklich löschen?")) return;
  konfig = konfig.filter(p => p.id !== id);
  delete aktuell.status[id];
  speichern();
  zeichnen();
}

el.punktHinzu.addEventListener("click", () => {
  konfig.push({ id: neueId(), name: "Neuer Kontrollpunkt", tagId: null });
  speichern();
  zeichnen();
  const felder = el.liste.querySelectorAll('input[type="text"]');
  const letztes = felder[felder.length - 1];
  if (letztes) { letztes.focus(); letztes.select(); }
});

el.bearbeiten.addEventListener("click", () => {
  bearbeitenModus = !bearbeitenModus;
  el.bearbeiten.setAttribute("aria-pressed", String(bearbeitenModus));
  el.bearbeiten.textContent = bearbeitenModus ? "Fertig" : "Bearbeiten";
  zuordnenFuer = null;
  meldungWeg();
  zeichnen();
});

el.vorkommnisse.addEventListener("input", () => {
  aktuell.vorkommnisse = el.vorkommnisse.value;
  speichern();
});

el.neu.addEventListener("click", () => {
  if (!confirm("Neuen Rundgang starten? Der aktuelle Stand wird gelöscht.")) return;
  aktuell = leererRundgang();
  el.vorkommnisse.value = "";
  speichern();
  zeichnen();
  meldungWeg();
});

/* ---------- NFC ---------- */

async function nfcStarten() {
  if (!nfcVerfuegbar) {
    meldung("Dieses Handy kann keine NFC-Tags in der App lesen. " +
      "Web-NFC gibt es nur in Chrome auf Android. Auf dem iPhone die Tags " +
      "antippen - iOS öffnet die App dann selbst. Abhaken von Hand geht immer.", true);
    return false;
  }
  if (leser) return true;

  try {
    leser = new NDEFReader();
    await leser.scan();
    leser.addEventListener("reading", e => tagGelesen(e.serialNumber));
    leser.addEventListener("readingerror", () =>
      meldung("Tag konnte nicht gelesen werden. Bitte noch einmal antippen.", true));
    return true;
  } catch (fehler) {
    leser = null;
    meldung("NFC konnte nicht gestartet werden: " + fehler.message +
      " (NFC in den Handy-Einstellungen einschalten und Zugriff erlauben.)", true);
    return false;
  }
}

el.nfcScan.addEventListener("click", async () => {
  if (await nfcStarten()) {
    el.nfcScan.setAttribute("aria-pressed", "true");
    el.nfcScan.textContent = "NFC aktiv";
    meldung("NFC ist aktiv. Handy an einen Kontrollpunkt halten.");
  }
});

async function tagZuordnenStarten(punktId) {
  if (!(await nfcStarten())) return;
  zuordnenFuer = punktId;
  const punkt = konfig.find(p => p.id === punktId);
  meldung("Handy jetzt an den Tag für „" + punkt.name + "“ halten.");
}

function tagGelesen(uid) {
  if (zuordnenFuer) {
    const punkt = konfig.find(p => p.id === zuordnenFuer);
    zuordnenFuer = null;
    if (!punkt) return;

    const schonVergeben = konfig.find(p => p.tagId === uid && p.id !== punkt.id);
    if (schonVergeben) {
      meldung("Dieser Tag gehört bereits zu „" + schonVergeben.name + "“.", true);
      return;
    }
    punkt.tagId = uid;
    speichern();
    zeichnen();
    meldung("Tag zu „" + punkt.name + "“ gespeichert.");
    return;
  }

  const punkt = konfig.find(p => p.tagId === uid);
  if (!punkt) {
    meldung("Unbekannter Tag (" + uid + "). Unter „Bearbeiten“ einem " +
      "Kontrollpunkt zuordnen.", true);
    return;
  }

  abhaken(punkt.id, true, "nfc");
  if (navigator.vibrate) navigator.vibrate(120);
  meldung("„" + punkt.name + "“ um " + uhrzeit(new Date().toISOString()) +
    " Uhr abgehakt.");
}

async function tagBeschreiben(punkt) {
  // Schreibt die App-Adresse mit Punkt-Kennung auf den Tag. Damit funktioniert
  // derselbe Tag auch auf dem iPhone: iOS liest solche Adress-Tags von selbst.
  const adresse = location.origin + location.pathname + "#punkt=" + punkt.id;
  try {
    meldung("Handy an den Tag halten, um ihn zu beschreiben ...");
    await new NDEFReader().write({ records: [{ recordType: "url", data: adresse }] });
    meldung("Tag für „" + punkt.name + "“ beschrieben.");
  } catch (fehler) {
    meldung("Tag konnte nicht beschrieben werden: " + fehler.message, true);
  }
}

/* ---------- Start ---------- */

function deepLinkPruefen() {
  // Aufruf über einen NFC-Tag mit Adresse, z. B. .../#punkt=p1a2b3
  const treffer = location.hash.match(/^#punkt=([\w-]+)$/);
  if (!treffer) return;

  history.replaceState(null, "", location.pathname + location.search);
  const punkt = konfig.find(p => p.id === treffer[1]);
  if (!punkt) {
    meldung("Der Tag zeigt auf einen Kontrollpunkt, den es nicht mehr gibt.", true);
    return;
  }
  abhaken(punkt.id, true, "nfc");
  if (navigator.vibrate) navigator.vibrate(120);
  meldung("„" + punkt.name + "“ per NFC abgehakt.");
}

el.vorkommnisse.value = aktuell.vorkommnisse || "";
speichern();
zeichnen();
deepLinkPruefen();

if (!nfcVerfuegbar) {
  el.nfcScan.textContent = "NFC (nur Android)";
}

// Service Worker: macht die App offline nutzbar (Tiefgarage, Keller, kein Netz).
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
