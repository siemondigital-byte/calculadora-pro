// Service worker: PWA instalable. La app (HTML/JS) SIEMPRE de la red para no quedar
// desactualizada; solo cacheo iconos/logo para el arranque offline.
const CACHE = "siemon-crm-v114";
const SHELL = ["/siemon-logo.svg", "/siemon-logo-hor.png", "/icon-192.png", "/icon-512.png"];

self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL).catch(() => {})));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // navegaciones (HTML) y APIs: siempre red (nunca versión vieja)
  if (req.mode === "navigate" || url.pathname.startsWith("/crm/") || url.host !== self.location.host) return;
  // estáticos con hash o iconos: cache-first
  e.respondWith(
    caches.match(req).then((m) => m || fetch(req).then((r) => {
      if (r.ok) { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return r;
    }))
  );
});

// notificaciones push del Centro de Mando
self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) {}
  e.waitUntil(self.registration.showNotification(d.titulo || "Centro de Mando", {
    body: d.cuerpo || "", icon: "/icon-192.png", badge: "/icon-192.png",
    data: { url: d.url || "/" },
  }));
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || "/";
  e.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then((ws) => {
    for (const w of ws) { if (w.url.startsWith(self.location.origin)) { w.focus(); return; } }
    return clients.openWindow(url);
  }));
});
