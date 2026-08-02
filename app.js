/* Rundgang-App
 *
 * Drei getrennte Speicher:
 *   KONFIG    = Kontrollpunkte (Name, zugeordneter NFC-Tag) + Objektname.
 *               Bleibt über alle Schichten hinweg bestehen, nur Admin ändert das.
 *   AKTUELL   = laufender Rundgang (Haken, Uhrzeiten, Mitarbeiter, Vorkommnisse).
 *               Wird von "Neuer Rundgang" geleert.
 *   ADMIN     = Prüfsumme des PIN.
 */

const KONFIG_KEY = "rundgang.konfig.v3";
const AKTUELL_KEY = "rundgang.aktuell.v3";
const ADMIN_KEY = "rundgang.admin.v1";
const ALT_KONFIG_KEY = "rundgang.konfig.v2";
const ALT_AKTUELL_KEY = "rundgang.aktuell.v2";
const ALT_V1_KEY = "rundgang.v1";

const STANDARD_PIN = "1234";

// Sichtbare Versionskennung, damit sich am Bildschirm sofort prüfen lässt,
// ob ein Handy die neueste Version geladen hat (unten auf der Seite).
const APP_VERSION = "v4 - 2026-08-02";

const STANDARDPUNKTE = [
  "Haupteingang",
  "Tiefgarage",
  "Lager / Warenannahme",
  "Bürotrakt 1. OG",
  "Notausgang Hinterhof"
];

const el = {};
for (const id of ["liste", "datum", "objekt", "fortschritt", "meldung", "mitarbeiter",
  "vorkommnisse", "nfcScan", "admin", "adminBereich", "punktHinzu", "objektAendern",
  "pinAendern", "abmelden", "pdf", "teilen", "drucken", "neu", "druck"]) {
  el[id] = document.getElementById(id);
}

const nfcVerfuegbar = "NDEFReader" in window;

let konfig = ladeKonfig();
let aktuell = ladeAktuell();
let adminAktiv = sessionStorage.getItem("rundgang.admin.offen") === "ja";
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
  if (gespeichert && Array.isArray(gespeichert.punkte) && gespeichert.punkte.length) {
    return gespeichert;
  }

  // Aus älteren App-Versionen übernehmen, damit nichts verloren geht.
  const v2 = lies(ALT_KONFIG_KEY);
  if (Array.isArray(v2) && v2.length) return { objekt: "", punkte: v2 };

  const v1 = lies(ALT_V1_KEY);
  const namen = v1 && Array.isArray(v1.punkte) ? v1.punkte.map(p => p.name) : STANDARDPUNKTE;
  return { objekt: "", punkte: namen.map(name => ({ id: neueId(), name, tagId: null })) };
}

function ladeAktuell() {
  const gespeichert = lies(AKTUELL_KEY) || lies(ALT_AKTUELL_KEY);
  if (gespeichert && gespeichert.status) {
    return Object.assign(leererRundgang(), gespeichert);
  }
  return leererRundgang();
}

function leererRundgang() {
  return {
    begonnen: new Date().toISOString(),
    mitarbeiter: "",
    status: {},
    vorkommnisse: ""
  };
}

function speichern() {
  localStorage.setItem(KONFIG_KEY, JSON.stringify(konfig));
  localStorage.setItem(AKTUELL_KEY, JSON.stringify(aktuell));
}

/* ---------- Anzeige ---------- */

function uhrzeit(iso) {
  return new Date(iso).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}

function datum(iso) {
  return new Date(iso).toLocaleDateString("de-DE",
    { day: "2-digit", month: "2-digit", year: "numeric" });
}

function meldung(text, warnung) {
  el.meldung.textContent = text;
  el.meldung.classList.toggle("warnung", !!warnung);
  el.meldung.classList.add("sichtbar");
}

function meldungWeg() {
  el.meldung.classList.remove("sichtbar");
}

function erledigteAnzahl() {
  return konfig.punkte.filter(p => aktuell.status[p.id]?.erledigt).length;
}

function zeichnen() {
  el.datum.textContent = datum(aktuell.begonnen);
  el.objekt.textContent = konfig.objekt || "";

  el.liste.replaceChildren();
  konfig.punkte.forEach((punkt, i) => {
    el.liste.append(adminAktiv ? zeileBearbeiten(punkt, i) : zeileAbhaken(punkt, i));
  });

  el.fortschritt.textContent =
    erledigteAnzahl() + " von " + konfig.punkte.length + " Kontrollpunkten erledigt";

  el.adminBereich.hidden = !adminAktiv;
  el.admin.setAttribute("aria-pressed", String(adminAktiv));
  el.admin.textContent = adminAktiv ? "Admin: Fertig" : "Admin";
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
  const punkt = konfig.punkte.find(p => p.id === id);
  if (!confirm("Kontrollpunkt „" + punkt.name + "“ wirklich löschen?")) return;
  konfig.punkte = konfig.punkte.filter(p => p.id !== id);
  delete aktuell.status[id];
  speichern();
  zeichnen();
}

el.punktHinzu.addEventListener("click", () => {
  konfig.punkte.push({ id: neueId(), name: "Neuer Kontrollpunkt", tagId: null });
  speichern();
  zeichnen();
  const felder = el.liste.querySelectorAll('input[type="text"]');
  const letztes = felder[felder.length - 1];
  if (letztes) { letztes.focus(); letztes.select(); }
});

el.mitarbeiter.addEventListener("input", () => {
  aktuell.mitarbeiter = el.mitarbeiter.value;
  speichern();
});

el.vorkommnisse.addEventListener("input", () => {
  aktuell.vorkommnisse = el.vorkommnisse.value;
  speichern();
});

el.neu.addEventListener("click", () => {
  if (!confirm("Neuen Rundgang starten? Der aktuelle Stand wird gelöscht.\n\n" +
    "Tipp: vorher den Bericht als PDF sichern.")) return;

  const vorheriger = aktuell.mitarbeiter;
  aktuell = leererRundgang();
  aktuell.mitarbeiter = vorheriger; // meist dieselbe Person in der nächsten Schicht
  el.vorkommnisse.value = "";
  el.mitarbeiter.value = vorheriger;
  speichern();
  zeichnen();
  meldungWeg();
});

/* ---------- Admin ---------- */

async function pruefsumme(pin) {
  if (crypto?.subtle) {
    const daten = new TextEncoder().encode("rundgang:" + pin);
    const puffer = await crypto.subtle.digest("SHA-256", daten);
    return [...new Uint8Array(puffer)].map(b => b.toString(16).padStart(2, "0")).join("");
  }
  return "unverschluesselt:" + pin; // nur falls der Browser kein SHA-256 kann
}

async function pinPruefen(eingabe) {
  const gespeichert = localStorage.getItem(ADMIN_KEY) || await pruefsumme(STANDARD_PIN);
  return (await pruefsumme(eingabe)) === gespeichert;
}

el.admin.addEventListener("click", async () => {
  if (adminAktiv) { // "Fertig" - Ansicht schließen, angemeldet bleiben
    adminAktiv = false;
    zuordnenFuer = null;
    zeichnen();
    return;
  }

  const eingabe = prompt("Admin-PIN eingeben:");
  if (eingabe === null) return;

  if (!(await pinPruefen(eingabe))) {
    meldung("Falscher PIN.", true);
    return;
  }

  adminAktiv = true;
  sessionStorage.setItem("rundgang.admin.offen", "ja");
  zeichnen();

  if (!localStorage.getItem(ADMIN_KEY)) {
    meldung("Angemeldet mit dem Standard-PIN " + STANDARD_PIN +
      ". Bitte jetzt über „PIN ändern“ einen eigenen PIN vergeben.", true);
  } else {
    meldungWeg();
  }
});

el.abmelden.addEventListener("click", () => {
  adminAktiv = false;
  sessionStorage.removeItem("rundgang.admin.offen");
  zeichnen();
  meldung("Abgemeldet.");
});

el.pinAendern.addEventListener("click", async () => {
  const neu = prompt("Neuen Admin-PIN eingeben (mindestens 4 Zeichen):");
  if (neu === null) return;
  if (neu.length < 4) {
    meldung("Der PIN muss mindestens 4 Zeichen haben.", true);
    return;
  }
  if (neu !== prompt("Neuen PIN zur Sicherheit wiederholen:")) {
    meldung("Die beiden Eingaben waren nicht gleich. PIN nicht geändert.", true);
    return;
  }
  localStorage.setItem(ADMIN_KEY, await pruefsumme(neu));
  meldung("Neuer PIN gespeichert. Bitte gut merken - er lässt sich nicht auslesen.");
});

el.objektAendern.addEventListener("click", () => {
  const name = prompt("Name des Objekts (erscheint im Bericht):", konfig.objekt || "");
  if (name === null) return;
  konfig.objekt = name.trim();
  speichern();
  zeichnen();
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
  const punkt = konfig.punkte.find(p => p.id === punktId);
  meldung("Handy jetzt an den Tag für „" + punkt.name + "“ halten.");
}

function tagGelesen(uid) {
  if (zuordnenFuer) {
    const punkt = konfig.punkte.find(p => p.id === zuordnenFuer);
    zuordnenFuer = null;
    if (!punkt) return;

    const schonVergeben = konfig.punkte.find(p => p.tagId === uid && p.id !== punkt.id);
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

  const punkt = konfig.punkte.find(p => p.tagId === uid);
  if (!punkt) {
    meldung("Unbekannter Tag (" + uid + "). Unter „Admin“ einem " +
      "Kontrollpunkt zuordnen.", true);
    return;
  }

  abhaken(punkt.id, true, "nfc");
  if (navigator.vibrate) navigator.vibrate(120);
  meldung("„" + punkt.name + "“ um " + uhrzeit(new Date().toISOString()) + " Uhr abgehakt.");
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

/* ---------- Bericht ---------- */

function berichtZeilen() {
  const jetzt = new Date().toISOString();
  const zeilen = [
    { text: "Rundgang-Bericht", stil: "titel" }
  ];

  if (konfig.objekt) zeilen.push({ text: "Objekt: " + konfig.objekt, stil: "kopf" });

  zeilen.push(
    { text: "Datum: " + datum(aktuell.begonnen), stil: "normal" },
    { text: "Mitarbeiter: " + (aktuell.mitarbeiter || "nicht angegeben"), stil: "normal" },
    { text: "Rundgang begonnen: " + uhrzeit(aktuell.begonnen) + " Uhr", stil: "normal" },
    { text: "Bericht erstellt: " + datum(jetzt) + ", " + uhrzeit(jetzt) + " Uhr", stil: "normal" },
    { text: "", stil: "normal" },
    { text: "Kontrollpunkte", stil: "kopf" }
  );

  konfig.punkte.forEach((punkt, i) => {
    const stand = aktuell.status[punkt.id];
    const ergebnis = stand?.erledigt
      ? "erledigt " + uhrzeit(stand.zeit) + " Uhr" + (stand.quelle === "nfc" ? " (NFC)" : "")
      : "NICHT ERLEDIGT";
    zeilen.push({ text: (i + 1) + ". " + punkt.name, rechts: ergebnis, stil: "normal" });
  });

  zeilen.push(
    { text: "", stil: "normal" },
    {
      text: "Ergebnis: " + erledigteAnzahl() + " von " + konfig.punkte.length +
        " Kontrollpunkten erledigt", stil: "kopf"
    },
    { text: "", stil: "normal" },
    { text: "Besondere Vorkommnisse", stil: "kopf" }
  );

  const text = aktuell.vorkommnisse.trim();
  if (text) {
    for (const absatz of text.split("\n")) {
      for (const stueck of umbrechen(absatz, 95)) {
        zeilen.push({ text: stueck, stil: "normal" });
      }
    }
  } else {
    zeilen.push({ text: "Keine besonderen Vorkommnisse.", stil: "normal" });
  }

  zeilen.push(
    { text: "", stil: "normal" },
    {
      text: "Erstellt mit der Rundgang-App. Die Zeiten stammen von der Uhr des " +
        "verwendeten Handys.", stil: "klein"
    }
  );

  return zeilen;
}

function umbrechen(text, breite) {
  if (text.length <= breite) return [text || ""];
  const zeilen = [];
  let zeile = "";
  for (const wort of text.split(" ")) {
    if (zeile && (zeile + " " + wort).length > breite) {
      zeilen.push(zeile);
      zeile = wort;
    } else {
      zeile = zeile ? zeile + " " + wort : wort;
    }
  }
  if (zeile) zeilen.push(zeile);
  return zeilen;
}

function dateiname() {
  const d = new Date(aktuell.begonnen);
  const teil = n => String(n).padStart(2, "0");
  const objekt = (konfig.objekt || "Rundgang").replace(/[^\wäöüÄÖÜß-]+/g, "_");
  return "Rundgang_" + objekt + "_" +
    d.getFullYear() + "-" + teil(d.getMonth() + 1) + "-" + teil(d.getDate()) + ".pdf";
}

function berichtPdf() {
  return pdfErzeugen(berichtZeilen());
}

el.pdf.addEventListener("click", () => {
  const adresse = URL.createObjectURL(berichtPdf());
  const link = document.createElement("a");
  link.href = adresse;
  link.download = dateiname();
  link.click();
  setTimeout(() => URL.revokeObjectURL(adresse), 30000);
  meldung("PDF erstellt: " + dateiname() + " (liegt in den Downloads).");
});

el.teilen.addEventListener("click", async () => {
  const datei = new File([berichtPdf()], dateiname(), { type: "application/pdf" });
  const titel = "Rundgang " + datum(aktuell.begonnen) +
    (konfig.objekt ? " - " + konfig.objekt : "");

  if (navigator.canShare?.({ files: [datei] })) {
    try {
      await navigator.share({ files: [datei], title: titel });
    } catch (fehler) {
      if (fehler.name !== "AbortError") meldung("Weiterleiten abgebrochen.", true);
    }
    return;
  }

  // Kein Datei-Versand möglich (z. B. am Rechner): Bericht als Text weitergeben.
  const text = berichtZeilen()
    .map(z => (z.rechts ? z.text + " - " + z.rechts : z.text))
    .join("\n");

  if (navigator.share) {
    try {
      await navigator.share({ title: titel, text });
    } catch (fehler) {
      if (fehler.name !== "AbortError") meldung("Weiterleiten abgebrochen.", true);
    }
    return;
  }

  window.open("https://wa.me/?text=" + encodeURIComponent(text), "_blank");
});

el.drucken.addEventListener("click", () => {
  el.druck.replaceChildren();
  for (const zeile of berichtZeilen()) {
    const p = document.createElement("p");
    p.className = "d-" + zeile.stil;
    p.textContent = zeile.text;
    if (zeile.rechts) {
      const rechts = document.createElement("span");
      rechts.textContent = zeile.rechts;
      p.append(rechts);
    }
    el.druck.append(p);
  }
  window.print();
});

/* ---------- Start ---------- */

function deepLinkPruefen() {
  // Aufruf über einen NFC-Tag mit Adresse, z. B. .../#punkt=p1a2b3
  const treffer = location.hash.match(/^#punkt=([\w-]+)$/);
  if (!treffer) return;

  history.replaceState(null, "", location.pathname + location.search);
  const punkt = konfig.punkte.find(p => p.id === treffer[1]);
  if (!punkt) {
    meldung("Der Tag zeigt auf einen Kontrollpunkt, den es nicht mehr gibt.", true);
    return;
  }
  abhaken(punkt.id, true, "nfc");
  if (navigator.vibrate) navigator.vibrate(120);
  meldung("„" + punkt.name + "“ per NFC abgehakt.");
}

el.mitarbeiter.value = aktuell.mitarbeiter || "";
el.vorkommnisse.value = aktuell.vorkommnisse || "";
document.getElementById("version").textContent = "Version " + APP_VERSION;
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
