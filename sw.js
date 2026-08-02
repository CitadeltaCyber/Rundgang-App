// Minimaler Service Worker: legt die App-Dateien im Cache ab,
// damit der Rundgang auch ohne Empfang funktioniert.
//
// Strategie: zuerst das Netz versuchen, damit ein neues Update sofort
// ankommt. Nur wenn kein Netz da ist (Tiefgarage, Keller), aus dem
// Cache liefern. So bleibt die App offline nutzbar, ohne dass sich alte
// Versionen hartnäckig halten.
const CACHE = "rundgang-v6";
const DATEIEN = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./pdf.js",
  "./manifest.webmanifest",
  "./icon.svg"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(DATEIEN)));
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(namen =>
      Promise.all(namen.filter(name => name !== CACHE).map(name => caches.delete(name)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    fetch(event.request)
      .then(antwort => {
        const kopie = antwort.clone();
        caches.open(CACHE).then(cache => cache.put(event.request, kopie));
        return antwort;
      })
      .catch(() => caches.match(event.request))
  );
});
