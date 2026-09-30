// Service Worker do LAVBOX.
// Estratégia: rede primeiro (sempre pega a versão nova após deploy) com fallback ao cache (app abre offline).
// Só intercepta GET do mesmo domínio: chamadas ao Supabase (REST/WebSocket) NUNCA passam pelo cache.
const VERSION = 'lavbox-v3';
const SHELL = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css',
  'vendor/supabase.js', 'vendor/leaflet/leaflet.js', 'vendor/leaflet/leaflet.css', 'vendor/leaflet/images/marker-icon.png', 'vendor/leaflet/images/marker-shadow.png',
  'js/lib/geo.js', 'js/views/map.js', 'js/main.js', 'js/api.js', 'js/config.js', 'js/ui.js',
  'js/adapters/supabase.js', 'js/adapters/local.js',
  'js/views/auth.js', 'js/views/cliente.js', 'js/views/lavador.js', 'js/views/common.js', 'js/views/palco.js', 'js/views/admin.js',
  'icons/icon-192.png', 'icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  e.respondWith(
    fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then((hit) => hit || caches.match('index.html'))));
});
