// Minimaler Service Worker: legt die App-Dateien im Cache ab,
// damit der Rundgang auch ohne Empfang funktioniert.
const CACHE = "rundgang-v3";
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
    caches.match(event.request).then(treffer => treffer || fetch(event.request))
  );
});
