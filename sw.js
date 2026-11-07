/* Service worker: deja la app disponible sin señal dentro del supermercado.
   Al publicar cambios, sube el número de VERSION para que los teléfonos descarguen la nueva versión. */
const VERSION = "super-v1";
const ARCHIVOS = [
  "/",
  "/styles.css",
  "/app.js",
  "/manifest.webmanifest",
  "/icons/icon.svg",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon.png",
  "/fonts/barlow-latin-400-normal.woff2",
  "/fonts/barlow-latin-500-normal.woff2",
  "/fonts/barlow-latin-600-normal.woff2",
  "/fonts/barlow-condensed-latin-600-normal.woff2",
  "/fonts/barlow-condensed-latin-700-normal.woff2"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Primero la copia guardada (rápido y sin señal); en paralelo se actualiza desde la red.
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  const esPagina = req.mode === "navigate";
  const clave = esPagina ? "/" : req;

  const red = fetch(req)
    .then(async (res) => {
      if (res && res.ok && res.type === "basic" && !res.redirected) {
        const cache = await caches.open(VERSION);
        await cache.put(clave, res.clone());
      }
      return res;
    })
    .catch(() => null);

  event.waitUntil(red.then(() => undefined));
  event.respondWith(
    caches.match(clave, { ignoreSearch: esPagina }).then(
      (guardado) =>
        guardado ||
        red.then((res) => res || new Response("Sin conexión", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } }))
    )
  );
});
