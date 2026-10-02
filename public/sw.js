/* RunMatch AI: retired service worker.
 *
 * Earlier builds registered a worker that served the app's JavaScript from a cache first
 * (stale-while-revalidate) and the entry bundle has a fixed file name. After a publish,
 * returning visitors kept running the previous build, sometimes a mix of old and new files.
 *
 * Browsers re-check this file on their own. This version deletes every cache it (or an
 * earlier version) created, unregisters itself, and reloads open tabs so they load the
 * current build straight from the network. It has no fetch handler, so it never serves
 * anything. Keep it in place for a few months, then it can be deleted.
 */
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
      } catch {
        /* nothing to clean */
      }
      try {
        await self.registration.unregister();
      } catch {
        /* already gone */
      }
      try {
        const clients = await self.clients.matchAll({ type: 'window' });
        clients.forEach((client) => client.navigate(client.url));
      } catch {
        /* the next navigation loads the current build anyway */
      }
    })(),
  );
});
