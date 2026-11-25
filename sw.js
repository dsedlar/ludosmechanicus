// Ludos Mechanicus service worker — offline app shell + faster loads.
// Bump CACHE when the shell changes to retire old caches.
const CACHE = 'ludos-v1';

// Core local files that make up the app shell (relative, so it works under the
// GitHub Pages subpath /ludosmechanicus/).
const CORE = [
  './',
  './index.html',
  './budget.js',
  './meals-engine.js',
  './meal-plan.html',
  './manifest.webmanifest',
  './icon.svg',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png'
];

self.addEventListener('install', e => {
  self.skipWaiting();
  // Cache each item individually so one 404 doesn't abort the whole install.
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(CORE.map(u => c.add(u).catch(() => {})))));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Decide what we're allowed to handle. Firebase / Firestore / auth must pass
// straight through to the network (their own offline layer handles them).
function isFirebase(url) {
  const h = url.host;
  if (h.endsWith('googleapis.com') && !h.startsWith('fonts.')) return true;  // firestore/identitytoolkit/securetoken, keep fonts.
  if (/firebaseio\.com$|firebasestorage\.app$|\.firebaseapp\.com$/.test(h)) return true;
  return false;
}
function isCacheable(url) {
  if (url.origin === self.location.origin) return true;   // our own files
  return /cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net|unpkg\.com|fonts\.googleapis\.com|fonts\.gstatic\.com|www\.gstatic\.com/.test(url.host);
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;                 // never touch writes (Firestore POST/PUT)
  const url = new URL(req.url);
  if (isFirebase(url)) return;                      // let Firebase own its requests

  // App navigation → network-first (fresh when online), fall back to the cached shell offline.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then(r => { const cp = r.clone(); caches.open(CACHE).then(c => c.put('./index.html', cp)); return r; })
        .catch(() => caches.match('./index.html').then(m => m || caches.match('./')))
    );
    return;
  }

  // Assets (our files + approved CDNs) → stale-while-revalidate.
  if (isCacheable(url)) {
    e.respondWith(
      caches.match(req).then(cached => {
        const net = fetch(req)
          .then(r => { if (r && r.status === 200) { const cp = r.clone(); caches.open(CACHE).then(c => c.put(req, cp)); } return r; })
          .catch(() => cached);
        return cached || net;
      })
    );
  }
});
