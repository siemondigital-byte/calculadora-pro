/* Calculadora de Viabilidad Inmobiliaria Pro — service worker (PWA).
   Estrategia:
   - Navegaciones (HTML): network-first con caída al caché (funciona offline).
   - Estáticos propios (css/js/iconos/manifest): stale-while-revalidate.
   - Terceros (fonts, supabase-js CDN): se dejan pasar a la red, sin cachear.
   Sube CACHE_VERSION cuando cambies el shell para forzar actualización. */
const CACHE_VERSION = 'crd-pwa-v2';
const CORE = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './i18n.js',
  './data.js',
  './finance.js',
  './config.js',
  './supabase.js',
  './reset.html',
  './auth-cliente.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(CORE).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;

  // Terceros (Google Fonts, CDN de supabase-js): red directa, sin interceptar.
  if (!sameOrigin) return;

  // Navegaciones: red primero, caché como respaldo offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match('./index.html')))
    );
    return;
  }

  // Estáticos propios: responde del caché y revalida en segundo plano.
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE_VERSION).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
