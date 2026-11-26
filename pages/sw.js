/* ZonaLimaSegura · Service Worker
   Permite usar la Landing Page sin conexión (HU-13, HU-27, HU-41).
   Estrategia "primero la red": con internet siempre se carga la versión
   más reciente publicada y se actualiza la copia guardada; sin internet
   se responde con la copia guardada en el dispositivo. */
const CACHE = 'zls-offline-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    fetch(req, { cache: 'no-cache' })
      .then(res => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(cache => cache.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.open(CACHE).then(cache => cache.match(req, { ignoreSearch: true })))
  );
});
