// Service worker: order push notifications and a friendly page when there is no connection. It does not make the site installable.
// It never stores anything private: API calls and signed photo links always go to the network.
const VERSION = 'v2';
const SHELL = 'shell-' + VERSION;
const ASSETS = 'assets-' + VERSION;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL).then((cache) => cache.add('/offline.html')).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== SHELL && k !== ASSETS).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/media/') || url.pathname === '/sw.js') return;

  // Pages: always the live version; the offline page only if the network is gone.
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match('/offline.html')));
    return;
  }

  // Built files have unique names, so once fetched they never change.
  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/pwa/')) {
    event.respondWith(
      caches.open(ASSETS).then(async (cache) => {
        const hit = await cache.match(request);
        if (hit) return hit;
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
      })
    );
  }
});

// Owner order notifications (Web Push).
self.addEventListener('push', (event) => {
  const d = event.data ? event.data.json() : {};
  event.waitUntil(self.registration.showNotification(d.title || 'New order', { body: d.body || '', tag: d.tag }));
});
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(self.clients.openWindow('/'));
});
