/* TriFlow — fonctionnement sans réseau.
   Le site (page, styles, scripts, polices, bibliothèque Supabase) est gardé sur l'appareil :
   l'appli s'ouvre même sans réseau. Les données, elles, restent gérées par l'appli (copie locale + envoi au retour du réseau).
   La base Supabase n'est jamais mise en cache ici. */
const CACHE = 'triflow-v1';
const SHELL = ['./', 'index.html', 'manifest.json', 'icon-192.png', 'apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(
    caches
      .keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const put = (req, res) => {
  if (res && (res.ok || res.type === 'opaque')) {
    const copy = res.clone();
    caches.open(CACHE).then(async c => {
      await c.put(req, copy);
      // une nouvelle version d'un fichier (?v=…) remplace l'ancienne
      const u = new URL(typeof req === 'string' ? req : req.url, self.location.href);
      if (u.searchParams.has('v'))
        for (const k of await c.keys()) {
          const ku = new URL(k.url);
          if (ku.pathname === u.pathname && ku.search !== u.search) c.delete(k);
        }
    });
  }
  return res;
};

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (/supabase\.co$/.test(url.hostname)) return; // base de données : jamais en cache
  // Page : d'abord le réseau (dernière version), sinon la copie
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then(r => put('index.html', r))
        .catch(() => caches.match('index.html'))
    );
    return;
  }
  // Planning Tridel (présences) : réseau d'abord, copie si hors ligne
  if (/\/planning\/planning-\d{4}\.json$/.test(url.pathname)) {
    e.respondWith(
      fetch(req)
        .then(r => put(req, r))
        .catch(() => caches.match(req))
    );
    return;
  }
  // Styles, scripts versionnés (?v=), polices, bibliothèques : la copie d'abord, sinon le réseau
  const same = url.origin === self.location.origin;
  const lib = /(cdn\.jsdelivr\.net|fonts\.googleapis\.com|fonts\.gstatic\.com|unpkg\.com)$/.test(url.hostname);
  if (same || lib) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => put(req, r))));
  }
});
