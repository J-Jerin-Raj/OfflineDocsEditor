// Offline Docs - Lightweight Service Worker
const CACHE_NAME = 'offline-docs-v7';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/style.css?v=6',
  '/style.css',
  '/script.js?v=7',
  '/script.js',
  '/vendor/quill.min.js',
  '/vendor/quill.snow.css',
  '/vendor/socket.io.min.js',
  '/favicon.svg',
  '/manifest.json'
];

// Install: Cache all static shell assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate: Clean up old caches if any
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: Stale-while-revalidate for static assets, network-only for API
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip POST requests, API routes, and Socket.IO long-polling/transports
  if (event.request.method !== 'GET' || url.pathname.startsWith('/socket.io/') || url.pathname.startsWith('/api/')) {
    return;
  }

  // Network-first for /load API
  if (url.pathname === '/load') {
    event.respondWith(
      fetch(event.request).catch(() => {
        // If offline and server not reachable, return a minimal fallback
        return new Response(JSON.stringify({ ops: [] }), {
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }

  // Cache-first / Stale-While-Revalidate for app assets
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Update cache in the background
        fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse));
          }
        }).catch(() => {}); // ignore network errors when offline
        return cachedResponse;
      }

      return fetch(event.request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
        return networkResponse;
      });
    })
  );
});
