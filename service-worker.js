// service-worker.js
const CACHE_VERSION = 'v1';
const CACHE_NAME = `flashcard-cache-${CACHE_VERSION}`;

// Các file tĩnh + data.json cần cache để offline
const FILES_TO_CACHE = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/data.json',
  '/manifest.json',
  '/icon-192.png',
];

// --- Install: cache tất cả ---
self.addEventListener('install', (event) => {
  console.log('[SW] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(FILES_TO_CACHE))
  );
  self.skipWaiting();
});

// --- Activate: xóa cache cũ ---
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
  );
  self.clients.claim();
});

// --- Fetch: network-first cho data.json, cache-first cho file tĩnh ---
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (url.pathname.endsWith('data.json')) {
    // network-first cho dữ liệu
    event.respondWith(
      fetch(event.request)
        .then((resp) => {
          // clone response để lưu cache
          const clone = resp.clone();
          caches
            .open(CACHE_NAME)
            .then((cache) => cache.put(event.request, clone));
          return resp;
        })
        .catch(() => caches.match(event.request)) // fallback cache
    );
  } else {
    // cache-first cho file tĩnh
    event.respondWith(
      caches.match(event.request).then((cached) => {
        return cached || fetch(event.request).catch(() => cached);
      })
    );
  }
});
