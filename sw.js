/* ═══════════════════════════════════════════════════════════════════════════════
   ORBIX STUDIO — Progressive Web App (PWA) Service Worker
   Offline CAD engine, cache-first app shell & resilient background sync
   ═══════════════════════════════════════════════════════════════════════════════ */

const CACHE_NAME = 'orbix-studio-v48';
const STATIC_ASSETS = [
  './',
  './logo.jpeg',
  './icon.svg',
  './icon-192.png',
  './manifest.json'
];

// Installation: Cache App Shell
self.addEventListener('install', (event) => {
  if (self.location && self.location.protocol.indexOf('http') !== 0) {
    return self.skipWaiting();
  }
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.allSettled(
        STATIC_ASSETS.map((url) =>
          cache.add(url).catch((err) => {
            console.warn('[PWA ServiceWorker] Pre-cache skipped:', url, err);
          })
        )
      );
    }).then(() => self.skipWaiting())
  );
});

// Activation: Clean Up Old Caches Immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            console.log('[PWA ServiceWorker] Purging legacy cache:', name);
            return caches.delete(name);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Strategy:
// - API calls (/api/): Network-First, fallback to cached response
// - Local app code (.js, .css, .html): Network-First, fallback to cache
// - External assets: Stale-While-Revalidate
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Skip non-GET requests and non-http(s) schemes
  if (request.method !== 'GET' || !url.protocol.startsWith('http')) {
    return;
  }

  // Never intercept or cache protected client quote portals or quote APIs
  if (
    url.pathname.startsWith('/api/client-portal/') ||
    url.pathname.startsWith('/api/client-quotes') ||
    url.pathname === '/client-quote.html' ||
    /^\/quote\/.+/.test(url.pathname)
  ) {
    event.respondWith(fetch(request, { cache: 'no-store' }));
    return;
  }

  // 1. Backend REST API: Never cache auth/session routes; network-first for other GET endpoints
  if (url.pathname.startsWith('/api/')) {
    if (url.pathname === '/api/me' || url.pathname === '/api/login' || url.pathname === '/api/logout') {
      event.respondWith(
        fetch(request).catch(() => {
          return new Response(
            JSON.stringify({ success: false, offline: true, error: 'Offline or connection timeout' }),
            { status: 503, statusText: 'Service Unavailable', headers: { 'Content-Type': 'application/json' } }
          );
        })
      );
      return;
    }
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const resClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, resClone));
          }
          return networkResponse;
        })
        .catch(() => {
          return caches.match(request).then((cachedResponse) => {
            if (cachedResponse) return cachedResponse;
            return new Response(
              JSON.stringify({ offline: true, error: 'Offline mode active', projects: [] }),
              { headers: { 'Content-Type': 'application/json' } }
            );
          });
        })
    );
    return;
  }

  // 2. Local Static Assets & App Shell:
  // - Versioned (?v=...) JS/CSS, /assets/*, and images: Cache-First for instant repeat loads!
  // - HTML / SPA navigation & unversioned files: Network-First so new deploys appear immediately.
  if (url.origin === location.origin) {
    const isImmutableVersioned =
      url.search.indexOf('v=') !== -1 ||
      url.pathname.indexOf('/assets/') === 0 ||
      /\.(png|jpg|jpeg|gif|svg|webp|ico|woff2?|glb|gltf)$/i.test(url.pathname);

    if (isImmutableVersioned && request.mode !== 'navigate') {
      event.respondWith(
        caches.match(request).then((cached) => {
          if (cached) return cached;
          return fetch(request).then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const resClone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, resClone));
            }
            return networkResponse;
          }).catch(() => {
            if (request.destination === 'image' || url.pathname.match(/\.(svg|png|jpg|jpeg|gif|webp|ico)$/i)) {
              return new Response(
                '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>',
                { headers: { 'Content-Type': 'image/svg+xml' } }
              );
            }
            return new Response('Offline — asset unavailable', { status: 503, headers: { 'Content-Type': 'text/plain' } });
          });
        })
      );
      return;
    }

    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const resClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, resClone));
          }
          return networkResponse;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;

          // SPA navigation routes (/3d-studio, /2d-plan, etc.) fallback to app shell (index.html)
          if (request.mode === 'navigate' || !url.pathname.includes('.')) {
            const appShell = await caches.match('./index.html') || await caches.match('./');
            if (appShell) return appShell;
          }

          // Fallback for image requests when offline or missing to avoid 503 red console errors
          if (request.destination === 'image' || url.pathname.match(/\.(svg|png|jpg|jpeg|gif|webp|ico)$/i)) {
            return new Response(
              '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>',
              { headers: { 'Content-Type': 'image/svg+xml' } }
            );
          }

          // Return a safe 503 Service Unavailable Response object instead of undefined
          return new Response('Offline — resource temporarily unavailable', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: { 'Content-Type': 'text/plain' }
          });
        })
    );
    return;
  }

  // 3. External assets & CDNs: Stale-While-Revalidate
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const resClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, resClone));
          }
          return networkResponse;
        })
        .catch(() => {
          return cachedResponse || new Response('', { status: 404 });
        });

      return cachedResponse || fetchPromise;
    })
  );
});

// Handle update messages from client
self.addEventListener('message', (event) => {
  if (event.data && event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
});
