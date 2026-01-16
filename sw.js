// sw.js — RSVP Reader (robust cache)
// - kein cache.addAll() (weil 1x 404 = INSTALL FAIL)
// - cached einzeln und überspringt kaputte Requests

const CACHE = "rsvp-cache-v12";

// WICHTIG: nur Dateien rein, die es wirklich gibt.
// Wenn du Pfade änderst, hier anpassen.
const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./manifest.webmanifest",
  "./lib/jszip.min.js",
  "./lib/epub.min.js",

  // OPTIONAL: wenn du favicon wirklich hast:
  // "./favicon.ico",
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);

    // Einzelnes Caching, damit 404 nicht alles killt
    for (const url of ASSETS) {
      try {
        const req = new Request(url, { cache: "reload" });
        const res = await fetch(req);
        if (!res || !res.ok) {
          console.warn("[SW] skip (not ok):", url, res?.status);
          continue;
        }
        await cache.put(req, res);
        // console.log("[SW] cached:", url);
      } catch (e) {
        console.warn("[SW] skip (fetch failed):", url, e);
      }
    }

    self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    // alte caches weg
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => (k !== CACHE ? caches.delete(k) : Promise.resolve())));
    self.clients.claim();
  })());
});

// Cache-first für Same-Origin GET, fallback network, fallback cached index
self.addEventListener("fetch", (event) => {
  const req = event.request;

  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Nur same-origin cachen/bedienen (GitHub Pages)
  if (url.origin !== self.location.origin) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);

    const cached = await cache.match(req);
    if (cached) return cached;

    try {
      const res = await fetch(req);
      // nur ok responses cachen
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    } catch (e) {
      // offline fallback: index.html
      const fallback = await cache.match("./index.html");
      return fallback || new Response("Offline.", { status: 200, headers: { "Content-Type": "text/plain" } });
    }
  })());
});
