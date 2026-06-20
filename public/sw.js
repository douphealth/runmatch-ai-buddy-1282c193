/* RunMatch AI — minimal offline-shell service worker.
 *
 * Strategy:
 *   - Precache the app shell (HTML, manifest) on install.
 *   - Runtime cache: stale-while-revalidate for same-origin static assets
 *     (JS chunks, CSS, images) so repeat visits feel instant and the app
 *     loads when offline.
 *   - Network-first for navigations so users always see the latest HTML
 *     when online, falling back to cached shell offline.
 *   - Never cache POST/PUT, cross-origin opaque API calls, or analytics.
 */

const VERSION = 'runmatch-v2-shoe-finder-scope';
const SHELL_CACHE = `${VERSION}-shell`;
const RUNTIME_CACHE = `${VERSION}-runtime`;
const APP_BASE = '/shoe-finder/';
const SHELL_URLS = [APP_BASE, `${APP_BASE}index.html`, `${APP_BASE}manifest.webmanifest`];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((c) => c.addAll(SHELL_URLS).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => !k.startsWith(VERSION))
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // This service worker must never handle the WordPress/apex site.
  if (!url.pathname.startsWith(APP_BASE)) return;

  // Skip Supabase functions, analytics, and anything dynamic.
  if (url.pathname.startsWith('/functions/') || url.pathname.startsWith('/api/')) return;

  // Navigations → network first, fall back to cached shell.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(RUNTIME_CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match(APP_BASE)))
    );
    return;
  }

  // Static assets → stale-while-revalidate.
  if (/\.(?:js|css|woff2?|png|jpg|jpeg|svg|webp|avif|ico)$/.test(url.pathname)) {
    event.respondWith(
      caches.open(RUNTIME_CACHE).then(async (cache) => {
        const cached = await cache.match(req);
        const fetchPromise = fetch(req)
          .then((res) => {
            if (res && res.status === 200) cache.put(req, res.clone());
            return res;
          })
          .catch(() => cached);
        return cached || fetchPromise;
      })
    );
  }
});
