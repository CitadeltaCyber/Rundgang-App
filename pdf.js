/* Erzeugt eine PDF-Datei direkt auf dem Handy - ohne Server und ohne
 * fremde Bibliotheken, damit die App offline und ohne Nachladen funktioniert.
 *
 * Aufruf:  pdfErzeugen([{ text, rechts, stil }, ...])  ->  Blob
 * Stile:   "titel" | "kopf" | "normal" | "klein"
 */

const SEITE = { breite: 595, hoehe: 842, rand: 50 }; // A4 in PDF-Punkten
const SPALTE_RECHTS = 330;

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
    .replace(/ /g, " ");
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

function pdfErzeugen(zeilen) {
  // 1. Zeilen auf Seiten verteilen
  const seiten = [];
  let strom = "";
  let y = SEITE.hoehe - SEITE.rand;

  for (const zeile of zeilen) {
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
  //    danach je Seite ein Seiten- und ein Inhaltsobjekt.
  const objekte = [];
  const ersteSeite = 5;
  const seitenIds = seiten.map((_, i) => ersteSeite + i * 2);

  objekte[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objekte[2] = "<< /Type /Pages /Kids [" +
    seitenIds.map(id => id + " 0 R").join(" ") +
    "] /Count " + seiten.length + " >>";
  objekte[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
  objekte[4] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";

  seiten.forEach((inhalt, i) => {
    const seitenId = seitenIds[i];
    objekte[seitenId] = "<< /Type /Page /Parent 2 0 R " +
      "/MediaBox [0 0 " + SEITE.breite + " " + SEITE.hoehe + "] " +
      "/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> " +
      "/Contents " + (seitenId + 1) + " 0 R >>";
    objekte[seitenId + 1] =
      "<< /Length " + inhalt.length + " >>\nstream\n" + inhalt + "endstream";
  });

  // 3. Datei zusammensetzen und dabei die Byte-Positionen merken (für xref).
  //    Nach latin1() ist jedes Zeichen genau ein Byte, Länge = Position.
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
