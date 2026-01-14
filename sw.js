// sw.js — Offline Cache für iPad RSVP Reader
const CACHE = "rsvp-reader-v21";
const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./manifest.webmanifest",
  "./jszip.min.js",
  "./lib/epub.min.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => (k === CACHE ? null : caches.delete(k))))
    )
  );
  self.clients.claim();
});

// Cache-first für App-Dateien
self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Nur GET cachen
  if (req.method !== "GET") return;

  event.respondWith(
    caches.match(req).then((hit) => {
      if (hit) return hit;
      return fetch(req).then((res) => {
        // Nur gleiche Origin cachen
        try {
          const url = new URL(req.url);
          if (url.origin === self.location.origin) {
            const copy = res.clone();
            caches.open(CACHE).then(cache => cache.put(req, copy));
          }
        } catch {}
        return res;
      }).catch(() => caches.match("./index.html"));
    })
  );
});
