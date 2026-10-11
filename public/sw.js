// Fikr service worker.
// Caches the app shell and fonts. Never caches API, auth or anything cross-origin.
// A new worker waits until the person taps "Update now" (or the next cold start).
const VERSION = 'fikr-v2';
const SHELL = VERSION + '-shell';
const ASSETS = VERSION + '-assets';

const PRECACHE = [
  '/today', '/welcome', '/offline',
  '/icons/icon.svg', '/icons/icon-192x192.png', '/icons/icon-512x512.png', '/icons/apple-touch-icon.png',
  '/fonts/bricolage-500.woff2', '/fonts/bricolage-700.woff2', '/fonts/bricolage-800.woff2',
  '/fonts/figtree-400.woff2', '/fonts/figtree-500.woff2', '/fonts/figtree-600.woff2', '/fonts/caveat-600.woff2',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(ASSETS).then((cache) => Promise.all(PRECACHE.map((u) => cache.add(u).catch(() => {}))))
  );
  // No skipWaiting here. The page asks for it.
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) => Promise.all(names.filter((n) => !n.startsWith(VERSION)).map((n) => caches.delete(n)))).then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
  if (event.data === 'CLEAR_CACHES') event.waitUntil(caches.keys().then((names) => Promise.all(names.map((n) => caches.delete(n)))));
});

const isStaticAsset = (url) =>
  url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/fonts/') || url.pathname.startsWith('/icons/');

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return; // auth and data: network only, never cached
  if (url.searchParams.has('_rsc') || request.headers.get('RSC')) return;

  // Fonts, icons and hashed build files do not change: cache first.
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.open(ASSETS).then(async (cache) => {
        const hit = await cache.match(request);
        if (hit) return hit;
        const res = await fetch(request);
        if (res.ok) cache.put(request, res.clone());
        return res;
      })
    );
    return;
  }

  // Pages: network first, fall back to the cached shell so the app opens without signal.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok && !res.headers.get('Cache-Control')?.includes('no-store')) caches.open(SHELL).then((c) => c.put(request, res.clone()));
          return res;
        })
        .catch(async () => (await caches.match(request)) || (await caches.match('/today')) || (await caches.match('/offline')) || Response.error())
    );
  }
});

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { /* plain text */ }
  // Title is the short fact. Body is one line of why.
  event.waitUntil(self.registration.showNotification(data.title || 'Fikr', {
    body: data.body || '',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-192x192.png',
    tag: data.tag || undefined,
    data: { url: data.url || '/today' },
  }));
});

// Every notification works with a plain tap.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || '/today', self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      const open = wins.find((w) => 'focus' in w);
      if (open) return open.navigate(target).then((c) => (c || open).focus());
      return self.clients.openWindow(target);
    })
  );
});
