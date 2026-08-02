/* Rundgang-App
 *
 * Speicher:
 *   KONFIG   = Liste von Objekten (Liegenschaften), je mit Namen und
 *              Kontrollpunkten (Name, zugeordneter NFC-Tag). Bleibt über
 *              alle Schichten hinweg bestehen, nur Admin ändert das.
 *   AKTUELL  = laufender Rundgang JE OBJEKT (Haken, Uhrzeiten, Fotos,
 *              Mitarbeiter, Vorkommnisse). Wird beim Wechseln des Objekts
 *              nicht verworfen - jedes Objekt hat seinen eigenen Stand.
 *   VERLAUF  = die letzten abgeschlossenen Berichte, als Sicherheitsnetz
 *              falls jemand vergisst, das PDF vorher zu sichern.
 *   ADMIN    = Prüfsumme des PIN.
 */

const KONFIG_KEY = "rundgang.konfig.v4";
const AKTUELL_KEY = "rundgang.aktuell.v4";
const VERLAUF_KEY = "rundgang.verlauf.v1";
const ADMIN_KEY = "rundgang.admin.v1";

// Schlüssel früherer Versionen, nur zur einmaligen Übernahme beim Umstieg.
const ALT_KONFIG_KEY_V3 = "rundgang.konfig.v3";
const ALT_AKTUELL_KEY_V3 = "rundgang.aktuell.v3";
const ALT_KONFIG_KEY_V2 = "rundgang.konfig.v2";
const ALT_V1_KEY = "rundgang.v1";

const STANDARD_PIN = "1234";
const VERLAUF_MAX = 10;
const FOTO_MAX_BREITE = 1000;
const FOTO_QUALITAET = 0.6;

// Sichtbare Versionskennung, damit sich am Bildschirm sofort prüfen lässt,
// ob ein Handy die neueste Version geladen hat (unten auf der Seite).
const APP_VERSION = "v6 - 2026-08-02";

const STANDARDPUNKTE = [
  "Haupteingang",
  "Tiefgarage",
  "Lager / Warenannahme",
  "Bürotrakt 1. OG",
  "Notausgang Hinterhof"
];

const el = {};
for (const id of ["liste", "datum", "uhr", "objektAuswahl", "fortschritt", "meldung",
  "mitarbeiter", "vorkommnisse", "nfcScan", "admin", "adminBereich", "punktHinzu",
  "objektHinzufuegen", "objektUmbenennen", "objektLoeschen", "pinAendern", "abmelden",
  "pdf", "teilen", "drucken", "verlauf", "verlaufDialog", "verlaufListe",
  "verlaufSchliessen", "neu", "druck"]) {
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

function ladeKonfigV3Kompat() {
  const v3 = lies(ALT_KONFIG_KEY_V3);
  if (v3 && Array.isArray(v3.punkte) && v3.punkte.length) return v3;

  const v2 = lies(ALT_KONFIG_KEY_V2);
  if (Array.isArray(v2) && v2.length) return { objekt: "", punkte: v2 };

  const v1 = lies(ALT_V1_KEY);
  const namen = v1 && Array.isArray(v1.punkte) ? v1.punkte.map(p => p.name) : STANDARDPUNKTE;
  return { objekt: "", punkte: namen.map(name => ({ id: neueId(), name, tagId: null })) };
}

function ladeKonfig() {
  const v4 = lies(KONFIG_KEY);
  if (v4 && Array.isArray(v4.objekte) && v4.objekte.length) return v4;

  // Ältere Versionen kannten nur ein einzelnes Objekt - als erstes Objekt übernehmen.
  const v3 = ladeKonfigV3Kompat();
  const id = neueId();
  return { objekte: [{ id, name: v3.objekt || "Objekt 1", punkte: v3.punkte }], aktiv: id };
}

function ladeAktuell() {
  const v4 = lies(AKTUELL_KEY);
  if (v4 && typeof v4 === "object") return v4;

  const v3 = lies(ALT_AKTUELL_KEY_V3);
  if (v3 && v3.status) return { [konfig.objekte[0].id]: v3 };
  return {};
}

function leererRundgang() {
  return {
    begonnen: new Date().toISOString(),
    mitarbeiter: "",
    status: {},
    vorkommnisse: ""
  };
}

function rundgang(objektId) {
  if (!aktuell[objektId]) aktuell[objektId] = leererRundgang();
  return aktuell[objektId];
}

function aktivesObjekt() {
  return konfig.objekte.find(o => o.id === konfig.aktiv) || konfig.objekte[0];
}

function aktuellerRundgang() {
  return rundgang(aktivesObjekt().id);
}

function findePunktMitId(id) {
  for (const objekt of konfig.objekte) {
    const punkt = objekt.punkte.find(p => p.id === id);
    if (punkt) return { objekt, punkt };
  }
  return null;
}

function findePunktMitTag(uid) {
  for (const objekt of konfig.objekte) {
    const punkt = objekt.punkte.find(p => p.tagId === uid);
    if (punkt) return { objekt, punkt };
  }
  return null;
}

function speichern() {
  localStorage.setItem(KONFIG_KEY, JSON.stringify(konfig));
  try {
    localStorage.setItem(AKTUELL_KEY, JSON.stringify(aktuell));
  } catch (e) {
    meldung("Der Speicher des Handys ist voll (meist wegen vieler Fotos). " +
      "Bitte den Bericht als PDF sichern und einen neuen Rundgang starten.", true);
  }
}

/* ---------- Anzeige ---------- */

// Immer deutsche Zeit (Europe/Berlin), unabhaengig davon, wie das jeweilige
// Diensthandy eingestellt ist - sonst passen die Zeiten zwischen Kollegen
// mit unterschiedlicher Handy-Zeitzone nicht zusammen.
const ZEITZONE = "Europe/Berlin";

function uhrzeit(iso) {
  return new Date(iso).toLocaleTimeString("de-DE",
    { hour: "2-digit", minute: "2-digit", timeZone: ZEITZONE });
}

function datum(iso) {
  return new Date(iso).toLocaleDateString("de-DE",
    { day: "2-digit", month: "2-digit", year: "numeric", timeZone: ZEITZONE });
}

function uhrAktualisieren() {
  el.uhr.textContent = new Date().toLocaleTimeString("de-DE",
    { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: ZEITZONE });
}

function meldung(text, warnung) {
  el.meldung.textContent = text;
  el.meldung.classList.toggle("warnung", !!warnung);
  el.meldung.classList.add("sichtbar");
}

function meldungWeg() {
  el.meldung.classList.remove("sichtbar");
}

function erledigteAnzahl(objekt, rund) {
  return objekt.punkte.filter(p => rund.status[p.id]?.erledigt).length;
}

function populateObjektAuswahl(objekt) {
  el.objektAuswahl.replaceChildren();
  konfig.objekte.forEach(o => {
    const opt = document.createElement("option");
    opt.value = o.id;
    opt.textContent = o.name;
    if (o.id === objekt.id) opt.selected = true;
    el.objektAuswahl.append(opt);
  });
}

function zeichnen() {
  const objekt = aktivesObjekt();
  const rund = aktuellerRundgang();

  el.datum.textContent = datum(rund.begonnen);
  populateObjektAuswahl(objekt);

  el.liste.replaceChildren();
  objekt.punkte.forEach((punkt, i) => {
    el.liste.append(adminAktiv
      ? zeileBearbeiten(objekt, punkt, i)
      : zeileAbhaken(rund, punkt, i));
  });

  el.fortschritt.textContent =
    erledigteAnzahl(objekt, rund) + " von " + objekt.punkte.length + " Kontrollpunkten erledigt";

  el.adminBereich.hidden = !adminAktiv;
  el.admin.setAttribute("aria-pressed", String(adminAktiv));
  el.admin.textContent = adminAktiv ? "Admin: Fertig" : "Admin";
}

function zeileAbhaken(rund, punkt, i) {
  const stand = rund.status[punkt.id] || {};

  const li = document.createElement("li");
  const zeile = document.createElement("div");
  zeile.className = "zeile";

  const label = document.createElement("label");
  label.className = "ankreuzen";

  const box = document.createElement("input");
  box.type = "checkbox";
  box.checked = !!stand.erledigt;
  box.addEventListener("change", () => abhaken(punkt.id, box.checked, "hand"));

  const spalte = document.createElement("div");
  spalte.className = "punkt";

  const name = document.createElement("span");
  name.className = "name";
  name.textContent = (i + 1) + ". " + punkt.name;

  const hinweis = document.createElement("span");
  hinweis.className = "nfcHinweis";
  hinweis.textContent = stand.quelle === "nfc" ? "per NFC" : (punkt.tagId ? "NFC-Tag hinterlegt" : "");

  spalte.append(name, hinweis);
  label.append(box, spalte);

  const zeitSpalte = document.createElement("span");
  zeitSpalte.className = "uhrzeitSpalte" + (stand.erledigt ? " erledigt" : "");
  zeitSpalte.textContent = stand.erledigt ? uhrzeit(stand.zeit) : "--:--";

  zeile.append(label, zeitSpalte);
  li.append(zeile);

  const extraZeile = document.createElement("div");
  extraZeile.className = "extraZeile";

  if (stand.notiz) {
    const notizText = document.createElement("p");
    notizText.className = "notizText";
    notizText.textContent = "Notiz: " + stand.notiz;
    extraZeile.append(notizText);
  }

  const notizKnopf = document.createElement("button");
  notizKnopf.type = "button";
  notizKnopf.className = "klein";
  notizKnopf.textContent = stand.notiz ? "Notiz bearbeiten" : "+ Notiz";
  notizKnopf.addEventListener("click", () => notizBearbeiten(punkt));

  const fotoKnopf = document.createElement("button");
  fotoKnopf.type = "button";
  fotoKnopf.className = "klein";
  fotoKnopf.textContent = stand.foto ? "Foto ersetzen" : "+ Foto";
  fotoKnopf.addEventListener("click", () => fotoAufnehmen(punkt));

  extraZeile.append(notizKnopf, fotoKnopf);
  li.append(extraZeile);

  if (stand.foto) {
    const vorschau = document.createElement("div");
    vorschau.className = "fotoVorschau";

    const bild = document.createElement("img");
    bild.src = stand.foto;
    bild.alt = "Foto zu " + punkt.name;

    const entfernen = document.createElement("button");
    entfernen.type = "button";
    entfernen.className = "klein gefahr";
    entfernen.textContent = "Foto entfernen";
    entfernen.addEventListener("click", () => fotoEntfernen(punkt));

    vorschau.append(bild, entfernen);
    li.append(vorschau);
  }

  return li;
}

function zeileBearbeiten(objekt, punkt, i) {
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

/* ---------- Aktionen an Kontrollpunkten ---------- */

function abhaken(id, erledigt, quelle) {
  const rund = aktuellerRundgang();
  const vorher = rund.status[id] || {};
  // Notiz und Foto bleiben erhalten, egal ob der Haken gesetzt oder entfernt wird.
  const behalten = { notiz: vorher.notiz, foto: vorher.foto, fotoBreite: vorher.fotoBreite, fotoHoehe: vorher.fotoHoehe };

  if (erledigt) {
    // Uhrzeit festhalten - ein Haken ohne Zeitstempel ist als Nachweis wertlos.
    rund.status[id] = { ...behalten, erledigt: true, zeit: new Date().toISOString(), quelle };
  } else if (behalten.notiz || behalten.foto) {
    rund.status[id] = { ...behalten, erledigt: false };
  } else {
    delete rund.status[id];
  }
  speichern();
  zeichnen();
}

function notizBearbeiten(punkt) {
  const rund = aktuellerRundgang();
  const bisher = rund.status[punkt.id]?.notiz || "";
  const neu = prompt("Auffälligkeit bei „" + punkt.name + "“ (leer lassen zum Entfernen):", bisher);
  if (neu === null) return;

  const stand = rund.status[punkt.id] || {};
  const text = neu.trim();
  const aktualisiert = { ...stand, notiz: text || undefined };

  if (!aktualisiert.erledigt && !aktualisiert.notiz && !aktualisiert.foto) {
    delete rund.status[punkt.id];
  } else {
    rund.status[punkt.id] = aktualisiert;
  }
  speichern();
  zeichnen();
}

function fotoAufnehmen(punkt) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.capture = "environment";

  input.addEventListener("change", () => {
    const datei = input.files[0];
    if (!datei) return;

    const leser = new FileReader();
    leser.onload = () => {
      const bild = new Image();
      bild.onload = () => {
        const skalierung = Math.min(1, FOTO_MAX_BREITE / bild.width);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(bild.width * skalierung);
        canvas.height = Math.round(bild.height * skalierung);
        canvas.getContext("2d").drawImage(bild, 0, 0, canvas.width, canvas.height);

        const rund = aktuellerRundgang();
        const stand = rund.status[punkt.id] || {};
        rund.status[punkt.id] = {
          ...stand,
          foto: canvas.toDataURL("image/jpeg", FOTO_QUALITAET),
          fotoBreite: canvas.width,
          fotoHoehe: canvas.height
        };
        speichern();
        zeichnen();
      };
      bild.src = leser.result;
    };
    leser.readAsDataURL(datei);
  });

  input.click();
}

function fotoEntfernen(punkt) {
  const rund = aktuellerRundgang();
  const stand = rund.status[punkt.id];
  if (!stand?.foto) return;
  if (!confirm("Foto zu „" + punkt.name + "“ entfernen?")) return;

  const aktualisiert = { ...stand, foto: undefined, fotoBreite: undefined, fotoHoehe: undefined };
  if (!aktualisiert.erledigt && !aktualisiert.notiz) {
    delete rund.status[punkt.id];
  } else {
    rund.status[punkt.id] = aktualisiert;
  }
  speichern();
  zeichnen();
}

function punktLoeschen(id) {
  const objekt = aktivesObjekt();
  const punkt = objekt.punkte.find(p => p.id === id);
  if (!confirm("Kontrollpunkt „" + punkt.name + "“ wirklich löschen?")) return;
  objekt.punkte = objekt.punkte.filter(p => p.id !== id);
  delete aktuellerRundgang().status[id];
  speichern();
  zeichnen();
}

el.punktHinzu.addEventListener("click", () => {
  aktivesObjekt().punkte.push({ id: neueId(), name: "Neuer Kontrollpunkt", tagId: null });
  speichern();
  zeichnen();
  const felder = el.liste.querySelectorAll('input[type="text"]');
  const letztes = felder[felder.length - 1];
  if (letztes) { letztes.focus(); letztes.select(); }
});

el.mitarbeiter.addEventListener("input", () => {
  aktuellerRundgang().mitarbeiter = el.mitarbeiter.value;
  speichern();
});

el.vorkommnisse.addEventListener("input", () => {
  aktuellerRundgang().vorkommnisse = el.vorkommnisse.value;
  speichern();
});

/* ---------- Objekte (Liegenschaften) ---------- */

el.objektAuswahl.addEventListener("change", () => {
  konfig.aktiv = el.objektAuswahl.value;
  speichern();
  zeichnen();
  meldungWeg();
  const rund = aktuellerRundgang();
  el.mitarbeiter.value = rund.mitarbeiter || "";
  el.vorkommnisse.value = rund.vorkommnisse || "";
});

el.objektHinzufuegen.addEventListener("click", () => {
  const name = prompt("Name des neuen Objekts:");
  if (!name || !name.trim()) return;
  const id = neueId();
  konfig.objekte.push({ id, name: name.trim(), punkte: [] });
  konfig.aktiv = id;
  speichern();
  zeichnen();
  el.mitarbeiter.value = "";
  el.vorkommnisse.value = "";
});

el.objektUmbenennen.addEventListener("click", () => {
  const objekt = aktivesObjekt();
  const name = prompt("Neuer Name für dieses Objekt:", objekt.name);
  if (name === null || !name.trim()) return;
  objekt.name = name.trim();
  speichern();
  zeichnen();
});

el.objektLoeschen.addEventListener("click", () => {
  if (konfig.objekte.length <= 1) {
    meldung("Das letzte verbleibende Objekt kann nicht gelöscht werden.", true);
    return;
  }
  const objekt = aktivesObjekt();
  if (!confirm("Objekt „" + objekt.name + "“ mit allen Kontrollpunkten wirklich löschen?")) return;
  konfig.objekte = konfig.objekte.filter(o => o.id !== objekt.id);
  delete aktuell[objekt.id];
  konfig.aktiv = konfig.objekte[0].id;
  speichern();
  zeichnen();
  const rund = aktuellerRundgang();
  el.mitarbeiter.value = rund.mitarbeiter || "";
  el.vorkommnisse.value = rund.vorkommnisse || "";
});

/* ---------- Neuer Rundgang + Verlauf als Sicherheitsnetz ---------- */

function rundIstLeer(rund) {
  return Object.keys(rund.status).length === 0 && !rund.vorkommnisse.trim();
}

function verlaufSpeichern(verlauf) {
  while (verlauf.length) {
    try {
      localStorage.setItem(VERLAUF_KEY, JSON.stringify(verlauf));
      return;
    } catch (e) {
      // Speicher voll (meist wegen Fotos) - ältesten Eintrag entfernen, nochmal versuchen.
      verlauf.pop();
    }
  }
  localStorage.removeItem(VERLAUF_KEY);
}

function verlaufSchnappschuss(objekt, rund) {
  if (rundIstLeer(rund)) return;
  const verlauf = lies(VERLAUF_KEY) || [];
  verlauf.unshift({
    id: neueId(),
    objekt: objekt.name,
    datum: datum(rund.begonnen),
    mitarbeiter: rund.mitarbeiter || "nicht angegeben",
    ergebnis: erledigteAnzahl(objekt, rund) + " von " + objekt.punkte.length,
    zeilen: berichtZeilen(objekt, rund)
  });
  verlaufSpeichern(verlauf.slice(0, VERLAUF_MAX));
}

el.neu.addEventListener("click", () => {
  const objekt = aktivesObjekt();
  const rund = aktuellerRundgang();
  const offene = objekt.punkte.length - erledigteAnzahl(objekt, rund);

  let hinweis = "Neuen Rundgang für „" + objekt.name + "“ starten?\n\n" +
    "Der aktuelle Stand wird im Verlauf gesichert und dann zurückgesetzt.";
  if (offene > 0) {
    hinweis = "Achtung: " + offene + " von " + objekt.punkte.length +
      " Kontrollpunkten sind noch NICHT erledigt.\n\n" + hinweis;
  }
  if (!confirm(hinweis)) return;

  verlaufSchnappschuss(objekt, rund);

  const vorheriger = rund.mitarbeiter;
  aktuell[objekt.id] = leererRundgang();
  aktuell[objekt.id].mitarbeiter = vorheriger; // meist dieselbe Person in der nächsten Schicht
  el.vorkommnisse.value = "";
  el.mitarbeiter.value = vorheriger;
  speichern();
  zeichnen();
  meldungWeg();
});

el.verlauf.addEventListener("click", () => {
  const eintraege = lies(VERLAUF_KEY) || [];
  el.verlaufListe.replaceChildren();

  if (!eintraege.length) {
    const li = document.createElement("li");
    li.textContent = "Noch keine früheren Berichte gespeichert.";
    el.verlaufListe.append(li);
  }

  eintraege.forEach(eintrag => {
    const li = document.createElement("li");
    li.className = "verlaufEintrag";

    const info = document.createElement("span");
    info.textContent = eintrag.objekt + " · " + eintrag.datum + " · " +
      eintrag.mitarbeiter + " (" + eintrag.ergebnis + ")";

    const knopf = document.createElement("button");
    knopf.type = "button";
    knopf.className = "klein";
    knopf.textContent = "PDF";
    knopf.addEventListener("click", () => verlaufPdfHerunterladen(eintrag));

    li.append(info, knopf);
    el.verlaufListe.append(li);
  });

  el.verlaufDialog.showModal();
});

el.verlaufSchliessen.addEventListener("click", () => el.verlaufDialog.close());

function verlaufPdfHerunterladen(eintrag) {
  const adresse = URL.createObjectURL(pdfErzeugen(eintrag.zeilen));
  const link = document.createElement("a");
  link.href = adresse;
  link.download = "Rundgang_" + eintrag.objekt.replace(/[^\wäöüÄÖÜß-]+/g, "_") + "_" +
    eintrag.datum.split(".").reverse().join("-") + ".pdf";
  link.click();
  setTimeout(() => URL.revokeObjectURL(adresse), 30000);
}

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
  const punkt = aktivesObjekt().punkte.find(p => p.id === punktId);
  meldung("Handy jetzt an den Tag für „" + punkt.name + "“ halten.");
}

function tagGelesen(uid) {
  if (zuordnenFuer) {
    const punkt = aktivesObjekt().punkte.find(p => p.id === zuordnenFuer);
    zuordnenFuer = null;
    if (!punkt) return;

    const treffer = findePunktMitTag(uid);
    if (treffer && treffer.punkt.id !== punkt.id) {
      meldung("Dieser Tag gehört bereits zu „" + treffer.punkt.name + "“ (" + treffer.objekt.name + ").", true);
      return;
    }
    punkt.tagId = uid;
    speichern();
    zeichnen();
    meldung("Tag zu „" + punkt.name + "“ gespeichert.");
    return;
  }

  const treffer = findePunktMitTag(uid);
  if (!treffer) {
    meldung("Unbekannter Tag (" + uid + "). Unter „Admin“ einem Kontrollpunkt zuordnen.", true);
    return;
  }

  const objektGewechselt = treffer.objekt.id !== konfig.aktiv;
  if (objektGewechselt) konfig.aktiv = treffer.objekt.id;

  abhaken(treffer.punkt.id, true, "nfc");
  if (navigator.vibrate) navigator.vibrate(120);
  meldung((objektGewechselt ? "Objekt „" + treffer.objekt.name + "“ - " : "") +
    "„" + treffer.punkt.name + "“ um " + uhrzeit(new Date().toISOString()) + " Uhr abgehakt.");
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

function berichtZeilen(objekt, rund) {
  const jetzt = new Date().toISOString();
  const zeilen = [
    { text: "Rundgang-Bericht", stil: "titel" },
    { text: "Objekt: " + objekt.name, stil: "kopf" },
    { text: "Datum: " + datum(rund.begonnen), stil: "normal" },
    { text: "Mitarbeiter: " + (rund.mitarbeiter || "nicht angegeben"), stil: "normal" },
    { text: "Rundgang begonnen: " + uhrzeit(rund.begonnen) + " Uhr", stil: "normal" },
    { text: "Bericht erstellt: " + datum(jetzt) + ", " + uhrzeit(jetzt) + " Uhr", stil: "normal" },
    { text: "", stil: "normal" },
    { text: "Kontrollpunkte", stil: "kopf" }
  ];

  objekt.punkte.forEach((punkt, i) => {
    const stand = rund.status[punkt.id];
    const ergebnis = stand?.erledigt
      ? "erledigt " + uhrzeit(stand.zeit) + " Uhr" + (stand.quelle === "nfc" ? " (NFC)" : "")
      : "NICHT ERLEDIGT";
    zeilen.push({ text: (i + 1) + ". " + punkt.name, rechts: ergebnis, stil: "normal" });

    if (stand?.notiz) {
      for (const stueck of umbrechen("   Auffaellig: " + stand.notiz, 95)) {
        zeilen.push({ text: stueck, stil: "klein" });
      }
    }
    if (stand?.foto) {
      zeilen.push({ bild: stand.foto, breitePx: stand.fotoBreite, hoehePx: stand.fotoHoehe });
    }
  });

  zeilen.push(
    { text: "", stil: "normal" },
    {
      text: "Ergebnis: " + erledigteAnzahl(objekt, rund) + " von " + objekt.punkte.length +
        " Kontrollpunkten erledigt", stil: "kopf"
    },
    { text: "", stil: "normal" },
    { text: "Besondere Vorkommnisse", stil: "kopf" }
  );

  const text = rund.vorkommnisse.trim();
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

function dateiname(objekt, rund) {
  const d = new Date(rund.begonnen);
  const teil = n => String(n).padStart(2, "0");
  const objektName = (objekt.name || "Rundgang").replace(/[^\wäöüÄÖÜß-]+/g, "_");
  return "Rundgang_" + objektName + "_" +
    d.getFullYear() + "-" + teil(d.getMonth() + 1) + "-" + teil(d.getDate()) + ".pdf";
}

el.pdf.addEventListener("click", () => {
  const objekt = aktivesObjekt();
  const rund = aktuellerRundgang();
  const adresse = URL.createObjectURL(pdfErzeugen(berichtZeilen(objekt, rund)));
  const link = document.createElement("a");
  link.href = adresse;
  link.download = dateiname(objekt, rund);
  link.click();
  setTimeout(() => URL.revokeObjectURL(adresse), 30000);
  meldung("PDF erstellt: " + dateiname(objekt, rund) + " (liegt in den Downloads).");
});

el.teilen.addEventListener("click", async () => {
  const objekt = aktivesObjekt();
  const rund = aktuellerRundgang();
  const zeilen = berichtZeilen(objekt, rund);
  const datei = new File([pdfErzeugen(zeilen)], dateiname(objekt, rund), { type: "application/pdf" });
  const titel = "Rundgang " + datum(rund.begonnen) + " - " + objekt.name;

  if (navigator.canShare?.({ files: [datei] })) {
    try {
      await navigator.share({ files: [datei], title: titel });
    } catch (fehler) {
      if (fehler.name !== "AbortError") meldung("Weiterleiten abgebrochen.", true);
    }
    return;
  }

  // Kein Datei-Versand möglich (z. B. am Rechner): Bericht als Text weitergeben.
  const text = zeilen
    .filter(z => !z.bild)
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
  const objekt = aktivesObjekt();
  const rund = aktuellerRundgang();
  el.druck.replaceChildren();

  for (const zeile of berichtZeilen(objekt, rund)) {
    if (zeile.bild) {
      const img = document.createElement("img");
      img.className = "d-bild";
      img.src = zeile.bild;
      el.druck.append(img);
      continue;
    }
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

  const fund = findePunktMitId(treffer[1]);
  if (!fund) {
    meldung("Der Tag zeigt auf einen Kontrollpunkt, den es nicht mehr gibt.", true);
    return;
  }

  const objektGewechselt = fund.objekt.id !== konfig.aktiv;
  if (objektGewechselt) konfig.aktiv = fund.objekt.id;

  abhaken(fund.punkt.id, true, "nfc");
  if (navigator.vibrate) navigator.vibrate(120);
  meldung((objektGewechselt ? "Objekt „" + fund.objekt.name + "“ - " : "") +
    "„" + fund.punkt.name + "“ per NFC abgehakt.");
}

// Erst den Deep-Link auswerten (kann das aktive Objekt wechseln), danach
// die Eingabefelder aus dem dann tatsächlich aktiven Rundgang befüllen.
deepLinkPruefen();

const startRund = aktuellerRundgang();
el.mitarbeiter.value = startRund.mitarbeiter || "";
el.vorkommnisse.value = startRund.vorkommnisse || "";
document.getElementById("version").textContent = "Version " + APP_VERSION;
speichern();
zeichnen();
uhrAktualisieren();
setInterval(uhrAktualisieren, 1000);

if (!nfcVerfuegbar) {
  el.nfcScan.textContent = "NFC (nur Android)";
}

// Service Worker: macht die App offline nutzbar (Tiefgarage, Keller, kein Netz).
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
