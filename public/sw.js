const CACHE_NAME = "laurel-cache-v1";
const OFFLINE_URL = "/offline.html";

const ASSET_CACHE = "laurel-assets-v1";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(["/", "/index.html", OFFLINE_URL, "/manifest.webmanifest", "/favicon.ico"]);
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.map((key) => {
          if (![CACHE_NAME, ASSET_CACHE].includes(key)) {
            return caches.delete(key);
          }
        })
      );
      await self.clients.claim();
    })()
  );
});

function isSupabase(url) {
  return /https:\/\/.*\.supabase\.co/i.test(url);
}

function isAssetRequest(request) {
  const url = new URL(request.url);
  return url.pathname.startsWith("/assets/") || url.pathname.endsWith(".css") || url.pathname.endsWith(".js") || url.pathname.endsWith(".woff2") || url.pathname.endsWith(".png") || url.pathname.endsWith(".jpg") || url.pathname.endsWith(".jpeg") || url.pathname.endsWith(".svg");
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  if (isSupabase(request.url)) {
    return; // network-only for Supabase
  }

  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const preload = await event.preloadResponse;
          if (preload) return preload;
          const networkResponse = await fetch(request);
          const cache = await caches.open(CACHE_NAME);
          cache.put("/index.html", networkResponse.clone());
          return networkResponse;
        } catch (err) {
          const cache = await caches.open(CACHE_NAME);
          const cachedOffline = await cache.match(OFFLINE_URL);
          return cachedOffline || new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain" } });
        }
      })()
    );
    return;
  }

  if (isAssetRequest(request)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(ASSET_CACHE);
        const cached = await cache.match(request);
        const fetchPromise = fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              cache.put(request, networkResponse.clone());
            }
            return networkResponse;
          })
          .catch(() => null);
        return cached || fetchPromise || fetch(request);
      })()
    );
    return;
  }

  event.respondWith(
    (async () => {
      try {
        return await fetch(request);
      } catch (err) {
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(request);
        return (
          cached || new Response("Sem conexão e sem cache disponível", { status: 503, headers: { "Content-Type": "text/plain" } })
        );
      }
    })()
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

