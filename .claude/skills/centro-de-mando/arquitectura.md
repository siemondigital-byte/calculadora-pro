# Arquitectura del Centro de Mando

El Centro de Mando es el sistema operativo de un negocio: prospecta, contacta, nutre, cierra, factura, crea contenido, publica, mide y se corrige. Cuatro piezas y un principio.

## Principio rector: un solo documento, merge seguro

Todo el estado del negocio vive en **un único JSON** (`/data/crm.json`). El frontend lo lee entero, lo muta en memoria y lo escribe entero (read-modify-write). El backend nunca acepta escrituras parciales sin protección. Esto es lo que hace el sistema robusto y, a la vez, es su mayor footgun si se rompe (ver autocorrección #2). Interiorízalo antes de tocar nada.

---

## 1. Motor (backend FastAPI, Python)

`motor-prospeccion/app.py` (~5.400 líneas) + módulos hermanos. Corre en Docker en el VPS (`prospeccion.<dominio>`). CORS abierto, `/media` sirve archivos estáticos.

### Módulos del motor
- `app.py` — todos los endpoints, auth, merge, helper de Claude.
- `crm_store.py` — store JSON: escritura atómica (`.tmp`+`os.replace`), lock de hilo, backup diario a `/data/backups` (últimos 10).
- `secretos.py` — vault de claves (`/data/secretos.json`), `leer/guardar/get/set_`, escritura atómica; nunca expone el valor.
- `web_pub.py` — publica la web pública por FTP; copia canónica en `/data/webfiles`, versiones/restaurar, diff legible, aplicar soluciones SEO.
- `publicar.py` — Postiz (schedule +1min).
- `nurturing.py` — secuencia de correos, inscripción, envío, salida por engagement.
- `asistente.py` — asistente que ejecuta sobre el CRM.
- `pipeline.py` / `collectors/` / `resolver.py` / `enrich.py` / `enrich_social.py` / `scoring.py` / `ideas.py` — prospección (colectores enchufables → resolver web → enriquecer → puntuar → ordenar; agnóstico a la fuente).
- `keywords.py` / `atp.py` / `dataforseo.py` / `seo.py` — inteligencia SEO y auditoría.
- `buzones.py` — SMTP/IMAP.
- `models.py` / `config.py`.

### Auth (fail-closed)
- `_auth(authorization)`: header `Authorization: Bearer <clave>`, `hmac.compare_digest`. Acepta `clave_actual()` (rotatable, leída de `clave.txt` o env `CRM_PASSWORD`) **o** `CRON_KEY` (interna para n8n). Si no hay clave configurada → **503** (nunca abierto por accidente). Token malo → 401. Nunca la clave por query (va a logs).
- `secreto_tokens()` = `TOKEN_SECRET` estable, separado de la clave de login: firma tokens (baja de nurturing, aprobar blog) y cifra respaldos, para que rotar la clave no rompa enlaces vivos.
- **Endpoints públicos** (sin `_auth`, con token HMAC firmado si mutan): `/crm/lead`, `/newsletter/alta`, `/blog/comentario(s)`, `/nurturing/px|r|baja`, `/px/{tid}`, `/blog/publicos`, aprobar/rechazar blog.

### El merge seguro (`_merge_con_servidor` + `guardar_seguro`)
Corazón anti-pérdida. Lo usan `PUT /crm/data` y TODOS los escritores del motor (nunca `crm_store.guardar` directo). Qué hace:
- **Fill-missing:** cualquier clave de nivel superior o de `siemon.*` que esté en disco pero NO en el payload, se copia de vuelta. Un envío parcial ya no borra. (Una clave enviada explícitamente, aunque vacía, se respeta; solo las omitidas se preservan.)
- **Merges específicos:** `outreach` (unión, conversación más larga gana), `nurturing.inscritos` (paso mayor gana; métricas = max; `abiertoPor` = unión), `saludHistorial` (historial más largo), `competidores` (por url, el más completo), `enlacesUTM` (unión por id).
- **Lápidas (tombstones):** `siemon.borrados` = unión pegajosa de borrados (competidores, enlacesUTM); una pestaña vieja no puede resucitar lo borrado. Solo se levanta con la señal `siemon.revivir`. Topado a 300.
- Envuelto en try/except: si el merge falla, guarda igual (comportamiento previo).

### Helper de Claude
`_claude_json(prompt, max_tokens, model, reintentos)`: extrae el primer `[...]`/`{...}` con regex, `json.loads(strict=False)`. **thinking deshabilitado** (con thinking activo, el modelo gastaba todo el presupuesto pensando y devolvía vacío), **piso 4000 tokens**, reintentos. Modelo por defecto `claude-sonnet-5`; Haiku en rutas baratas.

---

## 2. Web (frontend PWA React/Vite/Tailwind)

`web/src/` — `App.jsx` (shell de ~960 líneas) + muchos `*View.jsx`. Build Vite servido por nginx en `crm.<dominio>`.

### Comunicación con el motor (`db.js`)
- Base: `VITE_MOTOR_URL || https://<motor>`.
- Token en `localStorage` (`siemon_crm_token`); se manda `Authorization: Bearer <token>`. `POST /crm/login` con la clave; si 200, la clave misma se guarda como token.
- **Interceptor 401:** parchea `window.fetch` una vez; cualquier 401 del motor (salvo `/crm/login`) → limpia token + recarga (vuelve al login).

### Patrón commit (read-modify-write)
- `loadData()` = `GET /crm/data` → `data` (null → `seed()`).
- `saveData(d)` = `PUT /crm/data` con `{data: d}` **completo**, nunca parche.
- `commit(next)` = optimista: `setData(next)` ya, marca timestamp, incrementa `savingRef`, dispara `saveData`.
- `reload()` = refetch, pero **aborta** si hay guardado en curso o hubo edición local `< 4000ms` (no pisa lo no guardado). Se llama al reenfocar la pestaña, para traer escrituras server-side (respuestas clasificadas, leads de formulario) sin stompear.
- Cada View recibe `commit` y `data` y hace `commit({ ...data, <slice cambiado> })`.

### PWA / service worker
- `public/sw.js`: `CACHE = "...-vN"` (bump obligatorio por deploy). Estrategia **network-first para HTML y APIs** (nunca cachea navegación ni `/crm/`); assets hasheados cache-first. `install`→`skipWaiting()`; `activate` borra cachés ≠ actual + `clients.claim()`. Maneja `push` y `notificationclick`.
- `main.jsx`: gate de login, registra el SW, botón de salir + campana de push (VAPID). Instalación PWA nativa vía `manifest.webmanifest` (standalone).

### Puentes entre módulos (flujo conectado)
- **Deep link `#v=`** (correos enlazan `crm.<dominio>/#v=blogseo&art=<id>`).
- **Calendario → Contenido/Publicar** (`irACrear`→`draftExterno`→carga en Publicar).
- **EstudioUnificado** orquesta 3 etapas: **Identificar (tendencia/Viral) → Crear (estudio img/video/diseño) → Publicar (Postiz/nativo con UTM)**. `irAEstudio`, `irAPublicar`, `irAEditor`.
- El flujo macro: tendencia (outliers YT) → contenido/ads/guion → estudio (imagen/video) → Publicar con enlace UTM → lead atribuido → pipeline → seguimiento → propuesta → factura.

---

## 3. n8n (automatizaciones y webhooks)

`hooks.<dominio>`. Modelo borrador/publicado. Orquesta: formularios (guía/contacto), chatbot consultivo, booking y recordatorios, generación de propuesta (cifrada, sube por FTP, guarda en el lead), y los **crons vivos**: leer bandeja (15 min), nurturing (diario 9am), monitoreo de mercado (semanal), recordatorios push (diario), respaldo externo (semanal). Los nodos httpRequest usan `CRON_KEY`. Ver trampas en autocorrección #3, #9.

---

## 4. Integraciones externas

Anthropic (cerebro), FAL (imagen/video), Postiz (redes), Umami (analítica), Hostinger/FTP (web pública), buzones SMTP/IMAP (correo), Meta CAPI (medición Ads), fuentes de keywords (GSC/ATP/DataForSEO/Planner/Apify/Serper), YouTube (creadores + estudio), Web Push. Detalle en `integraciones.md`.

---

## Data model — claves de `siemon.*` (el slice principal)

`crm.json` = `{ workspace, siemon, academia }`. `siemon.*`:
`leads`, `prospectos`, `outreach` (con `conversacion`), `nurturing` (`inscritos`/`metricas`/`bajas`), `competidores`, `enlacesUTM`, `saludHistorial`, `saludWeb`, `blogArticulos`, `comentarios`, `keywords`, `blogKeywordsCuradas`, `gscConsultas`, `enviados`, `pushSubs`, `borrados` (lápidas), `firmaFields`, `facturaLogo`, `integraciones`, `publicaciones` (atribución por `utm_campaign`), `facturas`, `gastos`, `ofertas`, `clientes` (front-owned), `viralIdeas`, `adsLanzamiento`, `campana` (oferta parametrizable de outreach), `metas[YYYY-MM]`, `pilaresTendencia`, `checklistWeb`, `candidatosMercado`, `descartados`, `accesos`, `blogConfig`. `academia.*` = catálogo/inscritos/comunidad.

Nota: el backend solo toca un subconjunto (leads, prospectos, outreach, nurturing, competidores, enlacesUTM, saludHistorial, blogArticulos, comentarios, keywords, enviados, pushSubs, publicaciones, borrados) y **preserva el resto por merge**. Facturas/ofertas/clientes son front-owned.
