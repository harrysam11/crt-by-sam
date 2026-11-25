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

  // Never intercept APIs or socket traffic.
  if (url.origin !== self.location.origin ||
      url.pathname.startsWith('/api') ||
      url.protocol === 'ws:' ||
      url.protocol === 'wss:') return;

  // Always ask the deployed server for the app shell first. This prevents
  // users from being pinned to an old index.html and old hashed bundles.
  if (event.request.mode === 'navigate' || url.pathname === '/index.html') {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' })
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', copy)));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match('/index.html');
          return cached || Response.error();
        })
    );
    return;
  }

  // Vite's content-hashed assets are safe to cache by their immutable URL.
  if (/\.(?:js|css|woff2|svg|png|webp|jpg|jpeg)$/.test(url.pathname)) {
    event.respondWith(
      caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
        if (response && response.ok) {
          const copy = response.clone();
          event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)));
        }
        return response;
      }))
    );
  }
});
