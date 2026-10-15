// Service worker de l'application installée.
// Il ne garde AUCUNE donnée de l'agence ni du candidat : seule la page
// « Pas de connexion » est mise de côté, pour l'afficher à la place de
// l'erreur du navigateur quand le réseau manque. Tout le reste passe par le
// réseau, comme sans service worker.
// Changer VERSION quand la page hors connexion change.
const VERSION = "v1";
const CACHE = `offline-${VERSION}`;
const OFFLINE_URL = "/offline";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.add(new Request(OFFLINE_URL, { cache: "reload" })))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Préchargement des pages pendant le démarrage du service worker
      if (self.registration.navigationPreload) {
        await self.registration.navigationPreload.enable();
      }
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  // Pages seulement : les fichiers, images et appels d'API ne sont pas touchés
  if (event.request.mode !== "navigate") return;
  event.respondWith(
    (async () => {
      try {
        const preloaded = await event.preloadResponse;
        return preloaded || (await fetch(event.request));
      } catch {
        const cached = await caches.match(OFFLINE_URL);
        return cached || Response.error();
      }
    })(),
  );
});
