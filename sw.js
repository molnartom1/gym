
const CACHE = 'edzes-app-v1';
const RUNTIME = 'edzes-runtime-v1';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-180.png'
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(APP_SHELL))
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => (k !== CACHE && k !== RUNTIME) ? caches.delete(k) : null));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  // Navigation requests: network-first with cache fallback (for offline)
  if (e.request.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        const net = await fetch(e.request);
        const cache = await caches.open(CACHE);
        cache.put('./', net.clone());
        return net;
      } catch (err) {
        const cache = await caches.open(CACHE);
        return (await cache.match('./')) || (await cache.match('./index.html'));
      }
    })());
    return;
  }

  // Same-origin media & static: cache-first
  if (url.origin === self.location.origin && ['image','video','style','script','font'].includes(e.request.destination)) {
    e.respondWith((async () => {
      const cache = await caches.open(RUNTIME);
      const cached = await cache.match(e.request);
      if (cached) return cached;
      try {
        const net = await fetch(e.request);
        cache.put(e.request, net.clone());
        return net;
      } catch (err) {
        return fetch(e.request);
      }
    })());
    return;
  }

  // Default: network-first fallback to cache
  e.respondWith((async () => {
    try {
      const net = await fetch(e.request);
      return net;
    } catch (err) {
      const cache = await caches.open(RUNTIME);
      const cached = await cache.match(e.request);
      if (cached) return cached;
      throw err;
    }
  })());
});
