// ⚡ Service Worker - improved (safer caching, navigation fallback, skipWaiting)
const CACHE_NAME = 'flashcards-cache-v2';

const urlsToCache = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './data.json', // dữ liệu mẫu lokal
  //'./icon-192.png',
  './icon-512.png',
  './manifest.json',
  './icon.png', // nếu có, không có thì sẽ bị bỏ qua an toàn
];

// Install: attempt to fetch & cache each resource but don't fail whole install on single error
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const absoluteUrls = urlsToCache.map(
        (u) => new URL(u, self.location).href
      );
      await Promise.all(
        absoluteUrls.map(async (url) => {
          try {
            const res = await fetch(url, { cache: 'no-store' });
            if (res && res.ok) await cache.put(url, res.clone());
          } catch (err) {
            // ignore single-file errors to avoid blocking install
            console.warn('SW: không thể cache', url, err);
          }
        })
      );
      await self.skipWaiting();
    })()
  );
});

// Activate: cleanup old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.map((key) =>
          key !== CACHE_NAME ? caches.delete(key) : Promise.resolve()
        )
      );
      await self.clients.claim();
    })()
  );
});

// Fetch: stale-while-revalidate for assets, network-first for navigation (HTML)
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const requestUrl = new URL(event.request.url);

  // Navigation requests (load page) -> network first, fallback to cached index.html
  const isNavigation =
    event.request.mode === 'navigate' ||
    (event.request.headers.get('accept') || '').includes('text/html');

  if (isNavigation) {
    event.respondWith(
      (async () => {
        try {
          const networkResponse = await fetch(event.request);
          // cache fresh index.html for future offline
          if (networkResponse && networkResponse.ok) {
            const cache = await caches.open(CACHE_NAME);
            await cache.put(
              new URL('./index.html', self.location).href,
              networkResponse.clone()
            );
          }
          return networkResponse;
        } catch (err) {
          // fallback to cached index.html
          const cache = await caches.open(CACHE_NAME);
          const cached = await cache.match(
            new URL('./index.html', self.location).href
          );
          if (cached) return cached;
          return new Response('<h1>Offline</h1><p>Không thể tải trang.</p>', {
            headers: { 'Content-Type': 'text/html' },
            status: 503,
          });
        }
      })()
    );
    return;
  }

  // For other requests: try cache first, then network (stale-while-revalidate)
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cachedResponse = await cache.match(event.request);
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.ok)
            cache.put(event.request, networkResponse.clone());
          return networkResponse;
        })
        .catch(() => null);

      // Return cached if available, otherwise wait for network
      return (
        cachedResponse ||
        (await fetchPromise) ||
        new Response('Offline', { status: 503 })
      );
    })()
  );
});

// Allow page to force activate new SW
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
