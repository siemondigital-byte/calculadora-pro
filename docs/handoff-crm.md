# Handoff · Centro de Mando / CRM Atlantis — para el siguiente agente

> Lee primero `CLAUDE.md` (raíz del repo): es la fuente de verdad del dominio,
> la voz de marca y los guardarraíles. Este handoff cubre lo operativo: dónde
> vive cada cosa, cómo se despliega y qué está pendiente. Complementos:
> `docs/voz-del-metodo.md` (destilado del libro; la comunicación orbita ese
> modelo sin nombrarlo) y `centro-de-mando/HANDOFF-CORREOS-ACCESO.md` (histórico
> de los flujos de acceso).

## 1 · Mapa del repo (`siemondigital-byte/calculadora-pro`, rama `claude/new-session-3rjwcr`)

| Ruta | Qué es |
|---|---|
| `CLAUDE.md` | Config del producto, voz, no-negociables. Gana ante cualquier default. |
| `centro-de-mando/` | El CRM completo que corre en el VPS. |
| `centro-de-mando/motor-prospeccion/` | Motor FastAPI (`app.py` = endpoints; `nurturing.py`, `buzones.py`, `crm_store.py`, etc.). Auth: `Bearer CRON_KEY`. Tests en `tests/`. |
| `centro-de-mando/web/` | Panel PWA React/Vite del Centro de Mando (UI del CRM, vault de Accesos). |
| `centro-de-mando/n8n/` | Flujos exportados (acceso app, compra, embudo, nurturing diario, `proyectos-drive.json`, etc.). `REEMPLAZAR_CRON_KEY` se sustituye al desplegar. |
| `centro-de-mando/scripts/` | Generadores (python, corren en local/sandbox) y publicadores (`publicar-*.sh`, `curar-fotos-banco.sh`, corren EN el VPS). |
| `centro-de-mando/docker-compose.yml` + `Caddyfile` | Infra del VPS. |
| `emails/credenciales-app/` | Plantillas de correos de credenciales (dist-email = para n8n, dist-web = versión web). |
| `emails/embudo-atlantis/` | Correos del embudo + `sitio/` (páginas del funnel: guía, agendar, unsubscribe, legales, `assets/base.css`, `app.js`). |
| `web-emails/` | Paquete generado de versiones web de correos (30 páginas + `assets/*.png`). Generado por `generar-web-emails.py`; no editar a mano. |
| `web-atlantis/` | Web nueva de Atlantis: `index.html` (home v1) + `proyectos/` (landings generadas). |
| `proyectos-src/` | Fuente de proyectos: `<slug>/proyecto.json` + `imagenes/`. `_*` = borrador, nunca se publica. Ver su `README.md`. |
| `docs/` | Voz del método, secuencias de nurturing aprobadas, plan, guía VPS/DNS, manual de marca. |
| `automatizacion-correos/`, `referencia-siemon/` | Material de referencia; no tocar salvo pedido explícito. |

## 2 · Realidad de producción (lo que NO se ve en el repo)

- **VPS Hostinger** (`srv1191172`, solo la terminal del dueño llega a él; el
  sandbox del agente NO puede: el proxy bloquea `*.atlantisglobalrealty.com`,
  no hay SSH). Repo clonado en `/root/atlantis`; credenciales git de SOLO
  lectura → **nunca** commit/push desde el VPS; los push los hace el agente
  desde su entorno.
- **Contenedores**: motor = `docker ps | grep -m1 '^centro-de-mando-motor'`
  (¡existe un `siemon-motor` ajeno, no usar grep laxo!); n8n =
  `centro-de-mando-n8n-atlantis-1`. `docker exec -i` (la `-i` es esencial
  para heredocs).
- **FTP** (publica al docroot de WordPress directamente): credenciales en el
  entorno del contenedor motor Y de respaldo en `/root/atlantis/centro-de-mando/.env`
  (los `publicar-*.sh` ya hacen fallback). La verificación HTTP siempre con
  `curl` desde el host del VPS, nunca dentro del contenedor.
- **Correo**: todo sale por SMTP Brevo (`smtp-relay.brevo.com:587`, credencial
  n8n "SMTP Brevo" id `BrevoSmtpAtlantis1`; login relay ≠ From). Remitentes:
  `cicloderiqueza@` (ES), `wealthcycle@` (EN), `contact@` (agencia). Mail-tester
  9.5/10 con el SPF/DKIM/DMARC actual: no tocar DNS sin motivo.
- **OJO con `actualizar-flujos-acceso.sh`**: re-importar flujos borra la
  credencial SMTP de los nodos de correo → re-correr `asignar-smtp-flujos.sh`
  después, siempre.
- **Vault del CRM** (Centro de Mando → Accesos, vive en `/data/buzones.json` y
  secretos del motor): `PEXELS_KEY` ya cargada; `UNSPLASH_KEY`/`PIXABAY_KEY`
  opcionales. Los secretos NUNCA van al chat ni al repo.
- **URLs vivas**: home WordPress intacta; borrador de home nueva en `/nueva/`;
  `/proyectos/`, `/emails/…`, `/assets/fotos/atlantis-0{1,2,3}.jpg` (fotos
  curadas: Pexels, autores Jan van der Wolf, 鲨柿笔亚, Germán Latasa — mantener
  créditos), `/banco-candidatas/` (galería de curaduría, temporal),
  `/calculadora` y `/endeudamiento` (redirects a la app), páginas del embudo
  (`/download-guide`, `/book-call`, `/book-videocall`, `/unsubscribe/`).

## 3 · Flujos de trabajo (cómo cambiar cada cosa)

- **Correos de credenciales**: editar fuentes en `emails/credenciales-app/`,
  correr `integrar-correos-diseno.py` (inyecta en los JSON de n8n) y
  `generar-web-emails.py` (versiones web). Diseño aprobado: tarjeta navy sobre
  fondo exterior BLANCO `#FFFFFF`, footer gris `#4A4F57`, iconos PNG en
  `/emails/assets/` (Gmail elimina SVG/absolute/webfonts). NO reintroducir
  fondos oscuros exteriores ni SVG inline.
- **Web nueva / landings**: editar `web-atlantis/index.html` o
  `proyectos-src/<slug>/` → `python3 centro-de-mando/scripts/generar-landing-proyecto.py`
  → commit+push → el dueño pega EN el VPS:
  `cd /root/atlantis && git pull && bash centro-de-mando/scripts/publicar-web-atlantis.sh`.
- **Proyectos nuevos**: brochure PDF → `POST /proyectos/extraer` (IA arma la
  ficha SOLO con datos presentes, nunca inventa) o el flujo n8n
  `proyectos-drive.json` (vigila el Drive de atlantisglobalrealty@gmail.com;
  aún sin credencial OAuth asignada). Upsert idempotente por slug.
- **Nurturing**: motor (`nurturing.py`) con cadencia, tope diario, tracking de
  apertura/clic (`/nurturing/r` con HMAC), bajas con resubscribe y filtro
  `tiposElegibles`. Campaña Inversionista cargada y activa (solo leads
  `type='guia'`). Secuencias aprobadas en `docs/secuencias-nurturing-atlantis.md`.
- **Verificación web**: `bash centro-de-mando/scripts/verificar-web.sh` (en el
  VPS) recorre ~60 URLs y reporta solo fallos.

## 4 · Reglas duras para el siguiente agente

1. Voz: tuteo neutro LATAM, anti-gurú, sin nombres propios de persona, precio
   "44 USD", disclaimer educativo, riesgos nombrados, cero cifras/testimonios
   inventados, sin escasez artificial, sin em dashes en el copy.
2. **The Money Command (TMC) no se menciona jamás** en piezas de Atlantis/Ciclo.
3. El dueño ejecuta lo MÍNIMO en su terminal: bloques de un solo pegado, listos.
   Todo lo demás (código, git, push, generación, Drive vía MCP) lo hace el agente.
   El agente reporta honesto: si algo no corrió, se dice.
4. Nada de secretos en chat/repo/artefactos; van al `.env` del VPS, al vault del
   CRM o a credenciales n8n (importadas por CLI si el navegador corrompe el campo).
5. Commits con mensaje claro en español; nunca desde el VPS.

## 5 · Pendientes conocidos (estado al 2026-07-30)

- [ ] **Aprobación de la home** `/nueva/` por el dueño → luego switch a raíz
      CON respaldo del WordPress actual (script de switch aún no existe).
- [ ] **Primer proyecto real**: falta el brochure de la constructora + renders
      en `proyectos-src/<slug>/` (hoy solo existe `_ejemplo`).
- [ ] **n8n vigilar Drive**: crear OAuth de Google (cuenta
      atlantisglobalrealty@gmail.com), asignar credencial en el flujo
      "Proyectos · vigilar Drive de Atlantis", poner el folder ID y activar.
- [ ] **Cal.com**: faltan los dos links de eventos del dueño para inyectar
      `CAL_LINK` en `book-call` / `book-videocall` (webhook `cal-booking` ya vivo).
- [ ] Campañas Comprador/Vendedor (assets: PDF guía del comprador, página de
      valoración) y disparadores post-visita.
- [ ] URLs de privacidad/términos corporativos ES en la config del sitio.
- [ ] Limpiar `/banco-candidatas/` del sitio cuando ya no haga falta la galería.
