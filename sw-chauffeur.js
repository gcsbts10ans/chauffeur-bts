/* BTS Chauffeurs — service worker
   Stratégie :
   - L'app (HTML) : réseau d'abord → toujours la dernière version dès que tu remplaces le fichier
     (le cache ne sert que de secours hors-ligne)
   - Librairies CDN (Leaflet, Firebase) : cache d'abord (stables, versionnées)
   Incrémenter CACHE en cas de besoin de purge forcée. */
const CACHE = 'chauffeur-v28';
const CDN = ['unpkg.com', 'www.gstatic.com'];

self.addEventListener('install', e => {
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k.startsWith('chauffeur-') && k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;

  // Librairies CDN : cache d'abord
  if (CDN.some(d => url.hostname === d)) {
    e.respondWith(
      caches.open(CACHE).then(c =>
        c.match(e.request).then(hit => hit || fetch(e.request).then(r => { c.put(e.request, r.clone()); return r; }))
      )
    );
    return;
  }

  // App + même origine : réseau d'abord, cache en secours
  if (url.origin === self.location.origin) {
    // Pour le HTML (navigation), forcer le vrai réseau (bypass cache HTTP du navigateur/CDN)
    const isDoc = e.request.mode === 'navigate' || e.request.destination === 'document';
    const req = isDoc ? new Request(e.request.url, { cache: 'reload', credentials: 'same-origin' }) : e.request;
    e.respondWith(
      fetch(req).then(r => {
        const copy = r.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
        return r;
      }).catch(() => caches.match(e.request))
    );
  }
  // Le reste (Firestore, OSRM, géocodage, Apps Script) : direct réseau, pas de cache
});
