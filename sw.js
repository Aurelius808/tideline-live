/*
 * Tideline service worker — offline support, dependency-free.
 *
 * Why: this is a 2am, sleep-deprived, maybe-no-signal companion. After one online
 * visit, the whole app must keep working with no connection.
 *
 * Strategy:
 *  - Page navigations: network-first (so a new release shows when online), falling
 *    back to the cached shell when offline.
 *  - Same-origin static assets (hashed JS/CSS/fonts/icons): stale-while-revalidate
 *    — instant from cache, refreshed in the background.
 *  - GET only; never caches POSTs or cross-origin. The app is local-first, so there
 *    are no API calls or user data here to cache anyway.
 */
const CACHE = 'tideline-v2';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

function cachePut(request, response) {
  if (response && response.status === 200 && response.type === 'basic') {
    caches.open(CACHE).then((cache) => cache.put(request, response)).catch(() => {});
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          cachePut(request, response.clone());
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          return cached || (await caches.match('./index.html')) || Response.error();
        }),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          cachePut(request, response.clone());
          return response;
        })
        .catch(() => cached || Response.error());
      return cached || network;
    }),
  );
});
