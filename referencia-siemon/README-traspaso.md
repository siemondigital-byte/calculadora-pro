# Centro de Comando — Paquete de traspaso (para Atlantis Global Realty)

Solo **código fuente**. Sin datos, sin secretos, sin `node_modules`. Para montar el
sistema completo de forma adaptable, usa además la skill **`centro-de-comando`**
(la guía viva con arquitectura, módulos, configuración-por-negocio y autocorrección).

> ⚠️ **No publiques este paquete en ningún lugar público.**

---

## 1. Contenido del paquete

```
motor-prospeccion/     Backend FastAPI (Python) — todos los .py + collectors/ + requirements.txt
web/                   Frontend PWA (React/Vite/Tailwind) — src/, public/, configs
infra/                 docker-compose.yml (real del VPS) + Dockerfile.motor + .env.example
n8n-workflows/         23 workflows exportados en JSON (importables en n8n)
README-traspaso.md     este archivo
```

**Placeholder a reemplazar:** los workflows de n8n traían el Bearer del CRM hardcodeado;
se reemplazó por **`REEMPLAZAR_CRM_PASSWORD`** (12 archivos). Al importar en el n8n de
Atlantis, cambia ese texto por el `CRM_PASSWORD` real del nuevo motor (en los nodos HTTP
"Guardar en CRM" / headers Authorization).

---

## 2. Versiones que están corriendo (Siemon, jul-2026)

| Pieza | Versión / imagen |
|---|---|
| **n8n** | **2.28.6** (`docker.n8n.io/n8nio/n8n`) |
| **Postiz** | `ghcr.io/gitroomhq/postiz-app:latest` (+ postgres/redis/temporal) |
| **Motor** | imagen propia `siemon-crm-motor` (FastAPI, se construye con `infra/Dockerfile.motor`) |
| **Web** | servida con `nginx:alpine` (build estático de Vite) |
| **Proxy** | **Traefik** (`n8n-traefik-1`), enруta por `Host(...)` con TLS automático |
| Umami | self-hosted (analítica) |

### Parche de LinkedIn en Postiz — ⚠️ IMPORTANTE
El OAuth de LinkedIn en Postiz falla por un bug: Postiz pide `prompt=none` (y scopes de
más). El fix es un **`sed` dentro del contenedor** (quita `prompt=none` de ~4 archivos de
`/app/dist` + ajusta scopes). **Estado actual: NO aplicado / revertido** (el contenedor
aún tiene `prompt=none`). Este parche:
- **Se pierde al RECREAR el contenedor** (`docker compose up` que recree Postiz). Tras
  reaplicarlo, usa **`docker restart postiz`** (restart, no recreate).
- Es un fix **solo en producción**, NO está en ningún repo.
Si Atlantis va a usar LinkedIn por Postiz, hay que volver a aplicarlo (o esperar que Postiz
lo corrija upstream). Facebook/Instagram/Threads además requieren **App Review de Meta**.

---

## 3. Crons activos (todos viven en n8n, no hay crontab del sistema)

| Workflow | Frecuencia | Qué hace |
|---|---|---|
| `siemon_leer_correos` | **cada 15 min** | escanea la bandeja (respuestas, rebotes, salida de nurturing) |
| `siemon_nurturing_horario` | **cada 1 h** + diario **9:00** | procesa la serie de nurturing con tope diario y espaciado |
| `siemon_recordatorio` | diario **7:00** + **cada 30 min** | recordatorios de seguimiento / push |
| `siemon_recordatorio_videollamada` | diario **7:00** + **cada 30 min** | recordatorios de videollamada |
| `siemon_mercado_semanal` | **semanal 8:00** | monitoreo de competencia / salud web |

Los demás workflows son por **webhook** (formularios guía/contacto, chatbot `/webhook/chat`,
booking, propuestas generar/aprobar/modificar, publicar en redes, outreach, unsubscribe,
post-llamada / no-asistencia / videocall).

> "Respaldo externo": no había un workflow de backup dedicado en n8n. Los respaldos del
> CRM son internos del motor (`/data/backups`, snapshots antes de cada guardado). Si
> Atlantis quiere respaldo externo (a un bucket/Drive), es un workflow nuevo a crear.

---

## 4. Fixes aplicados DIRECTO en producción (repo ≠ prod)

1. **Parche LinkedIn de Postiz** (sección 2): `sed` en el contenedor, efímero, no en repo.
2. **La web pública** (index/proposal/blog/formulario) NO vive en este repo: el motor
   guarda la **copia canónica** en `/data/webfiles` y publica por FTP. Los últimos textos
   publicados pueden diferir del HTML semilla; el Maquetador es la fuente de verdad.
3. **Secretos de API** (Pexels/Pixabay/Coverr/Unsplash/FAL/CAPI/ATP/DataForSEO/GoogleAds)
   NO están en `.env`: se guardan cifrados vía la interfaz (Accesos → vault en
   `/data/secretos.json`). Hay que reconectarlos en Atlantis desde la UI.
4. **Postiz es compartido con The Money Command** (otra marca): en Atlantis conviene un
   Postiz propio o cuentas separadas.
5. **Los 3 `tmc_transaccional_*`** son plantillas de correo de OTRO negocio (The Money
   Command), incluidas como **ejemplo** del patrón de correos transaccionales
   (variables `nombre/email/password/membersUrl/appUrl/downloadsUrl/webUrl`). Hay que
   adaptarlas o descartarlas para Atlantis.

---

## 5. Deudas conocidas / trampas (además de la skill de autocorrección)

- **CAPI matching fino pendiente:** los eventos Lead/Purchase a Meta van con email/teléfono
  hasheados pero **sin IP ni user-agent** del visitante. Para el máximo match rate, editar
  los webhooks de n8n para pasar `ip` (x-forwarded-for) y `ua` (user-agent) al body de
  `/crm/lead`; el motor ya los acepta.
- **LinkedIn/Meta social:** LinkedIn roto por el bug de Postiz (arriba); Facebook/Instagram/
  Threads requieren App Review de Meta (proceso de Meta, fuera del código).
- **Dominios/URLs hardcodeados** a cambiar para Atlantis: `siemondigital.com` aparece como
  default en varios sitios (motor y front), el módulo **Prototipos** publica a
  `/loquepuedohacerporti/<slug>.html`, y `download-guide` / `proposal.html` / `book-call`
  son rutas de Siemon. Búscalas y renómbralas al dominio de Atlantis.
- **Datos semilla:** `web/src/prospectosSeed.js` y algunos defaults del front traen
  ejemplos de Siemon; se limpian al conectar el CRM real.
- **Umami:** cambiar `UMAMI_WEBSITE_ID` y volver a instrumentar la web de Atlantis.
- **PWA / service worker:** al desplegar la web hay que **subir `public/sw.js` con el CACHE
  `vN` incrementado** y **cerrar/reabrir** la app; un refresh no basta (ver skill).
- **Token del CRM en n8n:** reemplazar `REEMPLAZAR_CRM_PASSWORD` por el real (sección 1).

---

## 6. Arranque rápido (resumen; el detalle está en la skill `centro-de-comando`)

1. **Motor:** `cd motor-prospeccion` → build con `infra/Dockerfile.motor`; setear `.env`
   (ver `infra/.env.example`); `docker compose up -d --build motor`.
2. **Web:** `cd web` → `npm install` → `npm run build` → servir `dist/` con nginx (o el
   servicio `web` del compose). Ajustar `VITE_MOTOR_URL` al dominio del motor de Atlantis.
3. **n8n:** importar los JSON de `n8n-workflows/`, reconectar credenciales (SMTP/IMAP,
   Anthropic, Airtable si aplica), cambiar `REEMPLAZAR_CRM_PASSWORD`, y activar los cron.
4. **Proxy:** Traefik con `Host(...)` para `crm.atlantis...`, `prospeccion.atlantis...`,
   `hooks.atlantis...` (o el proxy que uses).
5. **Secretos de API:** conectarlos desde la interfaz (Accesos) y en Ads (CAPI).
