/**
 * CRT Institutional Terminal - Progressive Web App Service Worker.
 * Navigation is network-first so production deployments cannot be hidden by
 * a stale cached app shell. Hashed build assets remain cache-first for speed.
 */
const CACHE_NAME = 'crt-terminal-v2.2';
const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icons/icon-192.svg',
  '/icons/icon-512.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);

  if (url.origin !== self.location.origin ||
      url.pathname.startsWith('/api') ||
      url.protocol === 'ws:' ||
      url.protocol === 'wss:') return;

  // Fetch the app shell from production first; cache only as offline fallback.
  if (event.request.mode === 'navigate' || url.pathname === '/index.html') {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' }).then(async (response) => {
        if (response && response.ok) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put('/index.html', response.clone());
        }
        return response;
      }).catch(async () => {
        return (await caches.match('/index.html')) || Response.error();
      })
    );
    return;
  }

  // Vite content-hashed assets can be safely cached by immutable URL.
  if (/\.(?:js|css|woff2|svg|png|webp|jpg|jpeg)$/.test(url.pathname)) {
    event.respondWith(
      caches.match(event.request).then(async (cached) => {
        if (cached) return cached;
        const response = await fetch(event.request);
        if (response && response.ok) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(event.request, response.clone());
        }
        return response;
      })
    );
  }
});
