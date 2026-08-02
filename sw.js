// Task System Service Worker
// Network-first for the HTML (so updates land), cache-first for static assets.
const CACHE_NAME = 'task-system-v0.18.0';
const APP_SHELL = [
  '/task-system/',
  '/task-system/index.html',
  '/task-system/manifest.json',
  '/task-system/icon-192.png',
  '/task-system/icon-512.png',
  '/task-system/icon-180.png',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(c =>
      // no-store: never seed the cache from Safari's HTTP cache
      Promise.all(APP_SHELL.map(url =>
        fetch(url, { cache: 'no-store' })
          .then(r => (r.ok ? c.put(url, r) : null))
          .catch(() => null)
      ))
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Never touch cross-origin requests (Cloudflare Worker, Google APIs)
  if (url.origin !== self.location.origin) return;

  // HTML: always ask the network, and force past the HTTP cache.
  // Without cache:'no-store' the browser can answer this "network" request
  // from its own cache and serve stale HTML indefinitely.
  if (e.request.mode === 'navigate' || url.pathname.endsWith('.html')) {
    e.respondWith(
      fetch(e.request, { cache: 'no-store' })
        .then(r => {
          const clone = r.clone();
          caches.open(CACHE_NAME).then(c => c.put('/task-system/index.html', clone));
          return r;
        })
        .catch(() => caches.match('/task-system/index.html'))
    );
    return;
  }

  // Everything else: cache-first, refill in the background
  e.respondWith(
    caches.match(e.request).then(r =>
      r || fetch(e.request).then(res => {
        if (res.ok && e.request.method === 'GET') {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
        }
        return res;
      })
    )
  );
});

// Let the page ask for an immediate takeover
self.addEventListener('message', e => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});
