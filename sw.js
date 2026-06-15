/* Service worker for the NLHE Poker Trainer PWA.
   Strategy:
   - HTML navigations are NETWORK-FIRST (so a deployed update is picked up on the next
     load — never a stale index), falling back to cache when offline.
   - Everything else same-origin (icons, jpgs, the big background videos) is
     CACHE-FIRST with background fill, since those are immutable-ish static assets.
   - Cache name is versioned: bump CACHE on any shell change to evict old entries.
   NOTE: service workers only run over http(s), not file:// — this activates once hosted. */
const CACHE = 'nlhe-v2';
const SHELL = [
  './',
  './index.html',
  './preflop-trainer.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './street-bg.jpg',
  './jungle-bg.jpg',
  './jurassic-bg.jpg',
  './royal-bg.jpg'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()).catch(() => {}));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function isHtmlRequest(req) {
  if (req.mode === 'navigate') return true;
  const accept = req.headers.get('accept') || '';
  return accept.includes('text/html');
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  if (isHtmlRequest(req)) {
    // Network-first: fresh HTML when online, cached shell when offline.
    e.respondWith((async () => {
      try {
        const res = await fetch(req);
        if (res && res.ok) { try { const c = await caches.open(CACHE); c.put(req, res.clone()); } catch (_) {} }
        return res;
      } catch (err) {
        const cached = await caches.match(req);
        return cached || caches.match('./index.html').then((r) => r || Response.error());
      }
    })());
    return;
  }

  // Static assets: cache-first, fill the cache from the network on miss.
  e.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) return cached;
    try {
      const res = await fetch(req);
      try {
        const u = new URL(req.url);
        if (u.origin === location.origin && res.ok) { const c = await caches.open(CACHE); c.put(req, res.clone()); }
      } catch (_) {}
      return res;
    } catch (err) {
      return cached || Response.error();
    }
  })());
});
