# Integraciones — servicios externos, claves y setup 1-vez

El Centro de Mando orquesta varios servicios. Cada uno tiene: para qué sirve, dónde vive la clave (siempre server-side, ver autocorrección #7), y el setup manual que el dueño del negocio hace una sola vez. Parametriza dominios y cuentas por negocio.

Regla transversal: las claves se guardan por el vault (`/secreto/guardar`, allowlist `_SECRETOS_PERMITIDOS`), nunca en `.env` versionado ni en el navegador ni en el chat.

---

## Anthropic (Claude) — el cerebro del motor

- **Para qué:** genera prospección, correo frío, nurturing, blog, viral, ads, propuestas, insights, clasificación de respuestas, traducción.
- **Clave:** `ANTHROPIC_API_KEY` (env del contenedor motor).
- **Helper:** `_claude_json(prompt, max_tokens, model, reintentos)` extrae JSON. Config crítica: `thinking={"type":"disabled"}` + piso de 4000 tokens + reintentos (ver autocorrección: Claude devolvía vacío con thinking activo). Modelo por defecto `claude-sonnet-5`; rutas baratas usan Haiku (traducir, precalificar competencia, insight de lead).
- **Marca:** system prompt de marca inyectado (`_VIRAL_MARCA`) + limpiador `_sin_em_dash`.

## FAL — imagen/video IA

- **Para qué:** `/gc/imagen` (FLUX text→image, prompt optimizado ES→EN por Claude), `/gc/video` (Seedance image→video, cola con `request_id` + `/gc/estado` polling), portadas de blog (`/blog/imagen` → WebP hosteado).
- **Clave:** `FAL_API_KEY` (vault). La usuaria la pega en el módulo Estudio ("Conectar FAL"); nunca en `.env`.

## Postiz — publicación en redes

- **Para qué:** publicar contenido/ads en redes conectadas (LinkedIn, Bluesky, YouTube, IG/FB…). Motor: `/redes/integraciones` (proxy), `/publicar`.
- **Clave:** `POSTIZ_API_KEY` (vault) + `POSTIZ_URL` (base `https://publicar.<dominio>/api`, API pública `/public/v1`).
- **Trampas (ver autocorrección):**
  - Publicar SIEMPRE como `type:"schedule"` con `date=ahora+1min` (el "now" falla callado).
  - LinkedIn no conecta por `prompt=none` + scopes de más: parche `sed` DENTRO del contenedor + `docker restart` (no `compose up`, que revierte). Se pierde al actualizar Postiz.
  - IG/FB requieren app de Meta (App ID/Secret en el `.env` de Postiz) con redirect `https://publicar.<dominio>/integrations/social/{facebook,instagram}`.
- **Respaldo nativo:** workflow n8n que publica IG/FB por API nativa si Postiz no está.
- **Setup 1-vez:** conectar cada cuenta por OAuth en la consola de Postiz (lo hace la usuaria).

## Umami — analítica web (self-hosted)

- **Para qué:** visitas, visitantes, top pages, referrers/UTM, serie diaria. Motor `/analitica/resumen` (vía red interna).
- **Claves:** `UMAMI_URL`, `UMAMI_WEBSITE_ID`, `UMAMI_USER`, `UMAMI_PASS` (env motor).
- **Setup 1-vez:** instalar Umami (containers umami+umami-db), DNS A `analitica.<dominio>`, inyectar el script en las páginas públicas.

## Hostinger / FTP — web pública

- **Para qué:** publicar la web de marketing (home, propuesta, blog, guía) desde el Maquetador. `web_pub.py`: copia canónica en `/data/webfiles`, `publicar()` por FTP con respaldo previo en `versiones/<ts>/`.
- **Claves:** `FTP_HOST`, `FTP_PORT` (21), `FTP_USER`, `FTP_PASS` (env motor).
- **Trampa:** repo local ≠ prod; `curl+diff` antes de publicar (autocorrección #8). La web pública (Hostinger shared) puede estar en un host distinto al VPS.

## n8n — automatizaciones y webhooks

- **Para qué:** formularios (guía, contacto), chatbot, booking, propuestas, nurturing diario, leer correos, monitoreo de mercado, recordatorios push, respaldo externo. `hooks.<dominio>`.
- **Auth a motor:** los nodos httpRequest llevan Bearer; usa `CRON_KEY` estable para que rotar la clave de login no los rompa (autocorrección #9).
- **Trampas:** webhook se des-registra al editar activo (re-activar + curl al path real); inactivo = delete+recreate; editar la sqlite solo con contenedor detenido + borrar wal/shm; `NODE_FUNCTION_ALLOW_BUILTIN=crypto` para el cifrado de propuestas.
- **Convención de leads:** los forms mandan `source`/`type` fijo (ej. `guia-ia`) + `fuente`=utm_source; entran a `/crm/lead` (upsert por email). Ver autocorrección #12.

## Buzones de correo (SMTP/IMAP) — correo frío y nurturing

- **Para qué:** enviar correo en frío (`/enviar_correo`), leer bandeja y clasificar respuestas (`/leer_correos`), enviar nurturing desde `hello@`.
- **Claves:** por buzón en `/data/buzones.json` (server-only, NO en crm.json). Defaults Hostinger (smtp.hostinger.com:465 / imap.hostinger.com:993; auto-detecta Titan). `BCC_OUTREACH` para copia oculta.
- **Setup 1-vez:** la usuaria agrega sus buzones con la contraseña del webmail (no "contraseña de app") + "Probar conexión".
- **Deliverability:** SPF (include del proveedor) + DKIM + DMARC en el DNS. Tope diario + espaciado + pixel de apertura + baja con token HMAC.

## Meta Conversions API (CAPI) — medición server-side de Ads

- **Para qué:** enviar eventos Lead/Purchase/Contact server-side a Meta (hashea PII con SHA-256). `/capi/estado`, `/capi/test`, `/capi/evento`.
- **Claves (vault):** `FB_CAPI_TOKEN`, `FB_PIXEL_ID`, `FB_CAPI_TEST` (opcional).
- **UI:** tarjeta "Conversions API" en el módulo Ads. Pendiente típico: auto-disparar Lead (nuevo lead) y Purchase (factura pagada).

## Inteligencia de keywords / SEO (varias fuentes)

- **Google Search Console (gratis, API oficial):** reusa el OAuth de Google. `/oauth/gsc/*`, `/blog/gsc_*`. Setup 1-vez: registrar redirect `https://<motor>/oauth/gsc/callback` + habilitar Search Console API + verificar el sitio.
- **AnswerThePublic (API Alpha):** preguntas long-tail con volumen. Token `ATP_TOKEN` (vault). `atp.py`, `/blog/atp_*`. 1 búsqueda = 1 crédito; cachea en `/data/atp_cache.json`.
- **DataForSEO:** keywords (usa Google Ads por debajo) + Google Trends. `DATAFORSEO_LOGIN`/`PASSWORD` (vault). `dataforseo.py`, `/blog/dfs_*`. La cuenta debe estar VERIFICADA o da 403.
- **Google Ads Keyword Planner:** import por CSV (`/blog/kwplanner_importar`), gratis.
- **Apify (Ubersuggest):** `APIFY_TOKEN`; actor `radeance/ubersuggest-scraper` (10 corridas/mes gratis, cachea). El `semrush-scraper` NO sirve. (En Siemon se sacó de la UI por redundante con ATP+Planner.)
- **Serper:** descubrir competidores y resolver webs (`SERPER_API_KEY`). Reemplaza a DuckDuckGo (bloqueado desde el VPS).

## YouTube — prospección de creadores y estudio de canal

- **Datos públicos:** `YOUTUBE_API_KEY` para tendencias/outliers (`/ideas`) y analítica pública de canal (`/canal_analitica`).
- **Analítica privada (OAuth):** `YT_OAUTH_CLIENT_ID`/`SECRET` + `YT_ANALYTICS_REFRESH` (vault). `/oauth/youtube/*`, `/canal_analitica_privada`. Setup 1-vez: crear OAuth Client (Web) en Google Cloud, redirect `https://<motor>/oauth/youtube/callback`, habilitar YouTube Data + Analytics API, la usuaria como test user. Client ID termina en `.apps.googleusercontent.com`, Secret empieza `GOCSPX-` (si pega su correo/otra cosa, da 401).

## Push (Web Push / VAPID)

- **Para qué:** recordatorios diarios (seguimientos + artículo pendiente). `/push/*`.
- **Claves:** `VAPID_PUBLIC_KEY`/`PRIVATE_KEY` (generadas con openssl). Suscripciones en `siemon.pushSubs`.
- **iOS:** requiere instalar la PWA en pantalla de inicio (iOS 16.4+).

## Google Ads (nativo) — opcional

- **Para qué:** campañas + volúmenes exactos. Requiere developer token (aprobación manual de Google, días) + OAuth2 + customer ID. `GOOGLE_ADS_DEV_TOKEN`/`GOOGLE_ADS_TOKEN`/`GOOGLE_ADS_CUSTOMER` (vault, `_ADS_KEYS`).
- Para keywords es redundante con DataForSEO; útil cuando hay campañas activas.
