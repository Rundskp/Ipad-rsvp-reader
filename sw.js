/* =============================================================
   sw.js — RSVP Reader (robust cache)
   ============================================================= */

// Version erhöht, um Update zu erzwingen
const CACHE = "rsvp-cache-v101";

const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./manifest.webmanifest",
  "./lib/jszip.min.js",
  "./lib/epub.min.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    for (const url of ASSETS) {
      try {
        const req = new Request(url, { cache: "reload" });
        const res = await fetch(req);
        if (!res || !res.ok) {
          console.warn("[SW] skip (not ok):", url, res?.status);
          continue;
        }
        await cache.put(req, res);
      } catch (e) {
        console.warn("[SW] skip (fetch failed):", url, e);
      }
    }
    self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => (k !== CACHE ? caches.delete(k) : Promise.resolve())));
    self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);

    // WICHTIG: ignoreSearch: true erlaubt URLs wie index.html?text=...
    // ohne dass der Cache "nicht gefunden" meldet.
    const cached = await cache.match(req, { ignoreSearch: true });
    if (cached) return cached;

    try {
      const res = await fetch(req);
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    } catch (e) {
      const fallback = await cache.match("./index.html", { ignoreSearch: true });
      return fallback || new Response("Offline.", { status: 200, headers: { "Content-Type": "text/plain" } });
    }
  })());
});
