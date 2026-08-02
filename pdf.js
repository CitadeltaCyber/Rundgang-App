/* Erzeugt eine PDF-Datei direkt auf dem Handy - ohne Server und ohne
 * fremde Bibliotheken, damit die App offline und ohne Nachladen funktioniert.
 *
 * Aufruf:  pdfErzeugen([{ text, rechts, stil }, ...])  ->  Blob
 * Stile:   "titel" | "kopf" | "normal" | "klein"
 * Fotos:   { bild: "data:image/jpeg;base64,...", breitePx, hoehePx }
 */

const SEITE = { breite: 595, hoehe: 842, rand: 50 }; // A4 in PDF-Punkten
const SPALTE_RECHTS = 330;
const BILD_MAX_BREITE = 260; // pt
const BILD_MAX_HOEHE = 320;  // pt

const STILE = {
  titel:  { schrift: "F2", groesse: 16, hoehe: 26 },
  kopf:   { schrift: "F2", groesse: 11, hoehe: 20 },
  normal: { schrift: "F1", groesse: 10, hoehe: 15 },
  klein:  { schrift: "F1", groesse: 8,  hoehe: 12 }
};

// PDF-Standardschriften können nur Latin-1. Typografische Zeichen ersetzen,
// damit aus Anführungszeichen und Gedankenstrichen kein Kauderwelsch wird.
function latin1(text) {
  const ersetzt = String(text)
    .replace(/[„“”»«]/g, '"')
    .replace(/[‚‘’]/g, "'")
    .replace(/[–—]/g, "-")
    .replace(/[·•]/g, "-")
    .replace(/…/g, "...")
    .replace(/ /g, " ");
  let raus = "";
  for (const zeichen of ersetzt) {
    raus += zeichen.charCodeAt(0) <= 255 ? zeichen : "?";
  }
  return raus;
}

function maskieren(text) {
  return text.replace(/([\\()])/g, "\\$1");
}

function textBefehl(inhalt, schrift, groesse, x, y) {
  return "BT /" + schrift + " " + groesse + " Tf " +
    x + " " + y + " Td (" + maskieren(latin1(inhalt)) + ") Tj ET\n";
}

function jpegBytesAusDatenUrl(dataUrl) {
  return atob(dataUrl.slice(dataUrl.indexOf(",") + 1));
}

function bildGroesse(breitePx, hoehePx) {
  let breite = Math.min(BILD_MAX_BREITE, SEITE.breite - 2 * SEITE.rand);
  let hoehe = breite * (hoehePx / breitePx);
  if (hoehe > BILD_MAX_HOEHE) {
    hoehe = BILD_MAX_HOEHE;
    breite = hoehe * (breitePx / hoehePx);
  }
  return { breite, hoehe };
}

function pdfErzeugen(zeilen) {
  // 1. Zeilen (Text und Fotos) auf Seiten verteilen.
  const seiten = [];
  const bilder = []; // { bytes, breitePx, hoehePx, name }
  let strom = "";
  let y = SEITE.hoehe - SEITE.rand;

  for (const zeile of zeilen) {
    if (zeile.bild) {
      const { breite, hoehe } = bildGroesse(zeile.breitePx, zeile.hoehePx);
      if (y - hoehe < SEITE.rand) {
        seiten.push(strom);
        strom = "";
        y = SEITE.hoehe - SEITE.rand;
      }
      y -= hoehe;
      const name = "Im" + bilder.length;
      bilder.push({
        bytes: jpegBytesAusDatenUrl(zeile.bild),
        breitePx: zeile.breitePx,
        hoehePx: zeile.hoehePx,
        name
      });
      strom += "q " + breite.toFixed(2) + " 0 0 " + hoehe.toFixed(2) + " " +
        SEITE.rand + " " + y.toFixed(2) + " cm /" + name + " Do Q\n";
      y -= 8;
      continue;
    }

    const stil = STILE[zeile.stil] || STILE.normal;
    if (y - stil.hoehe < SEITE.rand) {
      seiten.push(strom);
      strom = "";
      y = SEITE.hoehe - SEITE.rand;
    }
    y -= stil.hoehe;
    if (zeile.text) {
      strom += textBefehl(zeile.text, stil.schrift, stil.groesse, SEITE.rand, y);
    }
    if (zeile.rechts) {
      strom += textBefehl(zeile.rechts, stil.schrift, stil.groesse, SPALTE_RECHTS, y);
    }
  }
  seiten.push(strom);

  // 2. Objekte aufbauen. Nummern: 1 Katalog, 2 Seitenbaum, 3+4 Schriften,
  //    danach je Seite ein Seiten- und ein Inhaltsobjekt, danach die Fotos.
  const objekte = [];
  const ersteSeite = 5;
  const seitenIds = seiten.map((_, i) => ersteSeite + i * 2);
  const bildIds = bilder.map((_, i) => ersteSeite + seiten.length * 2 + i);

  objekte[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objekte[2] = "<< /Type /Pages /Kids [" +
    seitenIds.map(id => id + " 0 R").join(" ") +
    "] /Count " + seiten.length + " >>";
  objekte[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
  objekte[4] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";

  const xObjectEintraege = bilder
    .map((b, i) => "/" + b.name + " " + bildIds[i] + " 0 R")
    .join(" ");

  seiten.forEach((inhalt, i) => {
    const seitenId = seitenIds[i];
    objekte[seitenId] = "<< /Type /Page /Parent 2 0 R " +
      "/MediaBox [0 0 " + SEITE.breite + " " + SEITE.hoehe + "] " +
      "/Resources << /Font << /F1 3 0 R /F2 4 0 R >>" +
      (xObjectEintraege ? " /XObject << " + xObjectEintraege + " >>" : "") + " >> " +
      "/Contents " + (seitenId + 1) + " 0 R >>";
    objekte[seitenId + 1] =
      "<< /Length " + inhalt.length + " >>\nstream\n" + inhalt + "endstream";
  });

  bilder.forEach((b, i) => {
    objekte[bildIds[i]] = "<< /Type /XObject /Subtype /Image /Width " + b.breitePx +
      " /Height " + b.hoehePx + " /ColorSpace /DeviceRGB /BitsPerComponent 8 " +
      "/Filter /DCTDecode /Length " + b.bytes.length + " >>\nstream\n" + b.bytes + "endstream";
  });

  // 3. Datei zusammensetzen und dabei die Byte-Positionen merken (für xref).
  //    Nach latin1()/atob() ist jedes Zeichen genau ein Byte, Länge = Position.
  let datei = "%PDF-1.4\n";
  const positionen = [];

  for (let nr = 1; nr < objekte.length; nr++) {
    positionen[nr] = datei.length;
    datei += nr + " 0 obj\n" + objekte[nr] + "\nendobj\n";
  }

  const xrefStart = datei.length;
  datei += "xref\n0 " + objekte.length + "\n0000000000 65535 f \n";
  for (let nr = 1; nr < objekte.length; nr++) {
    datei += String(positionen[nr]).padStart(10, "0") + " 00000 n \n";
  }
  datei += "trailer\n<< /Size " + objekte.length + " /Root 1 0 R >>\n" +
    "startxref\n" + xrefStart + "\n%%EOF\n";

  const bytes = new Uint8Array(datei.length);
  for (let i = 0; i < datei.length; i++) bytes[i] = datei.charCodeAt(i) & 0xff;
  return new Blob([bytes], { type: "application/pdf" });
}
