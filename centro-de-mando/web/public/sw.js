/* Service worker del Centro de Mando.
   REGLA (autocorreccion #1): incrementar CACHE en CADA deploy (v1 -> v2 ...).
   Estrategia: network-first para navegacion y API (nunca cachear /crm/);
   cache-first para assets hasheados. skipWaiting + clients.claim para que el
   SW nuevo tome control apenas se reabra la app. */
const CACHE = "atlantis-cm-v4";

self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(["/"])));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((claves) =>
        Promise.all(claves.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // API del motor: no interceptar

  if (req.mode === "navigate" || url.pathname.startsWith("/crm")) {
    // network-first: HTML y API siempre frescos
    e.respondWith(
      fetch(req)
        .then((resp) => {
          if (req.mode === "navigate" && resp.ok) {
            const copia = resp.clone();
            caches.open(CACHE).then((c) => c.put("/", copia));
          }
          return resp;
        })
        .catch(() => caches.match("/"))
    );
    return;
  }

  // assets: cache-first (los nombres van hasheados por Vite)
  e.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((resp) => {
          if (resp.ok) {
            const copia = resp.clone();
            caches.open(CACHE).then((c) => c.put(req, copia));
          }
          return resp;
        })
    )
  );
});

self.addEventListener("push", (e) => {
  let datos = {};
  try {
    datos = e.data ? e.data.json() : {};
  } catch {
    datos = { body: e.data && e.data.text() };
  }
  e.waitUntil(
    self.registration.showNotification(datos.title || "Centro de Mando", {
      body: datos.body || "",
      icon: "/icono.svg",
      data: { url: datos.url || "/" },
    })
  );
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const destino = (e.notification.data && e.notification.data.url) || "/";
  e.waitUntil(
    self.clients.matchAll({ type: "window" }).then((ventanas) => {
      for (const v of ventanas) {
        if ("focus" in v) {
          v.navigate(destino);
          return v.focus();
        }
      }
      return self.clients.openWindow(destino);
    })
  );
});
