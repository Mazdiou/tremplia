// Service worker de l'application installée.
// Il ne garde AUCUNE donnée de l'agence ni du candidat : seule la page
// « Pas de connexion » est mise de côté, pour l'afficher à la place de
// l'erreur du navigateur quand le réseau manque. Tout le reste passe par le
// réseau, comme sans service worker.
// Il affiche aussi les notifications envoyées par le serveur (Web Push,
// voir src/features/notifications), même quand l'appli est fermée.
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

// Notifications

// Contenu envoyé par le serveur : { title, body, url, tag }.
// Chaque envoi affiche TOUJOURS une notification : Safari (iPhone) retire
// l'abonnement d'un site qui reçoit des envois sans rien afficher, et
// Chrome affiche alors un message générique à la place.
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    // Contenu illisible : notification générique ci-dessous
  }
  const url = typeof data.url === "string" && data.url.startsWith("/") ? data.url : "/dashboard";
  event.waitUntil(
    self.registration.showNotification(data.title || "Tremplia", {
      body: data.body || "",
      tag: data.tag || undefined,
      // Même tag (plusieurs messages d'un dossier) : remplace l'ancienne et
      // prévient de nouveau
      renotify: Boolean(data.tag),
      icon: "/icons/icon-192.png",
      badge: "/icons/badge-96.png",
      lang: "fr",
      data: { url },
    }),
  );
});

// Toucher la notification : ouvre la page, dans une fenêtre déjà ouverte
// de l'appli si possible
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/dashboard", self.location.origin);
  if (target.origin !== self.location.origin) return;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      // L'espace candidat et celui de l'agence sont deux applis distinctes
      const student = target.pathname.startsWith("/student");
      const same = windows.find(
        (c) => new URL(c.url).pathname.startsWith("/student") === student,
      );
      if (same) {
        try {
          await same.focus();
          if (same.url !== target.href) await same.navigate(target.href);
          return;
        } catch {
          // Fenêtre que ce service worker ne contrôle pas : nouvelle fenêtre
        }
      }
      await self.clients.openWindow(target.href);
    })(),
  );
});
