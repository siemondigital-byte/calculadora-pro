# Plan de implementación — Centro de Mando · Atlantis Global Realty

> Plan ejecutable para montar el Centro de Mando de **Atlantis Global Realty** en un
> repo dedicado (`atlantis-centro-de-mando`), siguiendo la skill `centro-de-comando`
> (arquitectura, módulos, integraciones, despliegue, autocorrección) y el `CLAUDE.md`
> del dominio. Este documento ES la configuración por negocio ya llenada + las fases
> de construcción con sus verificaciones.
>
> Regla transversal: **verifica el efecto, no la intención.** Cada fase cierra solo
> cuando su verificación end-to-end pasa (ver `.claude/skills/centro-de-comando/references/autocorreccion.md`).

---

## 0 · Encuadre

El Centro de Mando es la plataforma de **Atlantis Global Realty**. El infoproducto
**Ciclo de Riqueza Inmobiliaria (44 USD)** es **una de las líneas de negocio** que la
plataforma parametriza, no el centro del sistema. Se modela con el patrón de
**workspaces** ya probado (Siemon: `siemon` + `academia`):

| Workspace | Línea de negocio | Qué administra |
|---|---|---|
| `atlantis` (principal) | Inmobiliaria / arquitectos de patrimonio | Prospección de inversionistas, consultas de diagnóstico, pipeline de proyectos sobre planos, web corporativa `atlantisglobalrealty.com`, contenido y analítica de marca |
| `cicloderiqueza` | Infoproducto 44 USD (ES/EN) | Leads → compradores del libro-método, afiliados/embajadores YouTube, `app_usuarios` de la Calculadora Pro, embudo bilingüe, nurturing, pauta Meta |

Cada workspace tiene su `config`, su nav y su slice de datos dentro del mismo
`crm.json`. **Nada se hardcodea**: metas, precios, cadencias, voz, canales y moneda
se leen de `data.<ws>.config` (autocorrección #10).

---

## 1 · Brief de configuración (llenado desde el CLAUDE.md)

### 1.1 Workspace `atlantis`

- **Identidad:** Atlantis Global Realty — *"No somos una agencia de real estate.
  Somos arquitectos de patrimonio."* Dominio: `atlantisglobalrealty.com`.
- **ICP (por problema):** profesionales 25–52 que ganan bien pero no invierten; sin
  plan patrimonial; muchos no conscientes del problema (Schwartz 1–2). Subsegmento
  clave: mujer 30–50, ambiciosa, con ingresos y sin plan. Mercado: LATAM, España,
  hispanos en EE. UU. (+ anglo en EN).
- **Oferta:** metodología + acceso a proyectos sobre planos de constructoras
  verificadas. Opera **por comisión**; NUNCA se presenta como fondo ni vehículo de
  inversión (compliance dura).
- **Lead magnet / CTA principal:** **consulta de diagnóstico gratuita (~60 min)** —
  es diagnóstico, no venta. `type`/`source` fijo del formulario: `diagnostico`.
- **Voz:** banca privada sobria, tuteo neutro latinoamericano, anti-gurú, firma
  institucional (cero nombres propios de persona), riesgos nombrados de frente,
  disclaimer educativo visible.
- **Estética:** lujo oscuro editorial — negro `#0A0A0C`, navy `#0F1B2D`, oro
  champagne `#E6C788`, crema `#F4EFE6`, gris `#D7D7D9`; Bodoni Moda + Instrument
  Sans; motivo de la línea de oro que orbita. AA, foco visible, alt text.
- **Moneda:** USD. **Meta mensual:** `data.atlantis.metas[YYYY-MM]` (la pone la
  usuaria, nunca fija).
- **Idiomas:** ES (base) + EN.

### 1.2 Workspace `cicloderiqueza`

- **Producto:** libro-método (8 partes / 56 capítulos) + Calculadora Pro (este
  repo, bono con gating "gratis de por vida para los primeros N") + Bono 01 + Bono
  02 + consulta de diagnóstico. Precio **44 USD** (regular 99 USD, descuento real).
  Garantía 7 días: reembolso revoca acceso vitalicio a la app y los bonos.
- **Rutas de tráfico:** (1) upsell post-compra del ecosistema; (2) afiliados
  YouTube (5 verticales: productividad/hábitos, mentalidad, finanzas e inversión,
  crecimiento personal, crecimiento profesional) + Meta Ads con lookalikes.
- **Plataformas de venta:** Hotmart / ClickBank / ThriveCart (webhooks → n8n).
- **URLs canónicas:** `cicloderiqueza.atlantisglobalrealty.com` (ES),
  `wealthcycle.atlantisglobalrealty.com` (EN), `/afiliados` y `/affiliates/`.
- **Correos n8n existentes:** flujos comprador y embajador con variables
  `nombre`, `email`, `password`, `membersUrl`, `appUrl`, `downloadsUrl`, `webUrl`.
- **Voz y guardarraíles:** los mismos de §1.1 + "44 USD" siempre (nunca "$44"),
  cero estadísticas inventadas, cero testimonios ficticios, sin escasez artificial.

---

## 2 · Repo destino y estructura

Repo nuevo: **`atlantis-centro-de-mando`** (la Calculadora Pro sigue en
`calculadora-pro`, como repo aparte del aplicativo).

```
atlantis-centro-de-mando/
├── CLAUDE.md                  ← copia del CLAUDE.md del dominio (ya en calculadora-pro)
├── .claude/skills/centro-de-comando/   ← copia de la skill (ya en calculadora-pro)
├── motor-prospeccion/         ← backend FastAPI (Docker)
│   ├── app.py                 ← endpoints, _auth fail-closed, _merge_con_servidor,
│   │                            guardar_seguro, _claude_json (thinking off, piso 4000)
│   ├── crm_store.py           ← JSON atómico + lock + backups diarios (últimos 10)
│   ├── secretos.py            ← vault /data/secretos.json + allowlist
│   ├── web_pub.py             ← publicar web pública por FTP + versiones + diff
│   ├── nurturing.py, asistente.py, publicar.py, buzones.py
│   ├── pipeline.py, collectors/, resolver.py, enrich.py, scoring.py, ideas.py
│   ├── keywords.py, atp.py, dataforseo.py, seo.py
│   └── models.py, config.py
├── web/                       ← PWA React/Vite/Tailwind
│   ├── public/sw.js           ← CACHE vN (bump obligatorio por deploy)
│   └── src/ (App.jsx shell + *View.jsx por módulo, db.js, main.jsx)
├── n8n/                       ← workflows exportados (JSON) versionados
└── docker-compose.yml         ← motor, web (nginx), n8n, postiz, umami
```

---

## 3 · Data model (adaptación de entidades)

`crm.json` = `{ workspace, atlantis, cicloderiqueza }`. Slices:

**Comunes a ambos workspaces** (mismo motor genérico): `leads`, `prospectos`,
`outreach`, `nurturing`, `enlacesUTM`, `publicaciones`, `enviados`, `borrados`
(lápidas), `metas[YYYY-MM]`, `config`, `blogArticulos`, `keywords`,
`competidores`, `saludHistorial`, `pushSubs`, `accesos`.

**Específicos de `atlantis`:** `consultas` (agendamiento del diagnóstico: lead,
fecha, estado, link/QR), `proyectos` (proyectos sobre planos: constructora, ciudad,
etapa, fechas de entrega — para contenido y seguimiento comercial).

**Específicos de `cicloderiqueza`:**
- `compradores` — plataforma (Hotmart/ClickBank/ThriveCart), transacción, idioma,
  acceso a miembros, acceso a app, bonos, estado de garantía/reembolso.
- `afiliados` — canal YouTube, vertical, audiencia, Ambassador Fit Score, estado,
  comisión, materiales, tracking de referidos.
- `app_usuarios` — usuarios de la Calculadora Pro: email, credencial generada por
  n8n, nº de orden de compra, flag `vitalicio` (gating primeros N, N en config),
  `revocado` (si hay reembolso).

Los estados del embudo, fuentes y probabilidades por etapa son **config por
workspace** (STAGES/LEAD_SOURCES editables), no constantes.

---

## 4 · Fases de implementación

Cada fase termina con su verificación (columna V). Orden pensado para que el
sistema sea útil desde la fase 2.

### F0 · Infraestructura (requiere accesos de la usuaria)
- VPS con Docker + Traefik/nginx. DNS: `crm.`, `motor.`, `hooks.`, `publicar.`,
  `analitica.` bajo `atlantisglobalrealty.com`.
- `docker-compose.yml` con motor, web, n8n, Postiz, Umami.
- **V:** cada subdominio responde con TLS válido; contenedores healthy.

### F1 · Motor núcleo (el corazón anti-pérdida)
- `crm_store.py` (escritura atómica + lock + backup diario), `_auth` fail-closed
  (Bearer, `compare_digest`, 503 sin clave, `CRON_KEY` para n8n, `TOKEN_SECRET`
  estable aparte), `_merge_con_servidor` + `guardar_seguro` (fill-missing, merges
  específicos, lápidas `borrados`/`revivir`), vault `secretos.py` con allowlist,
  `_claude_json` (thinking disabled, piso 4000 tokens, reintentos, `_sin_em_dash`).
- Endpoints base: `GET/PUT /crm/data`, `/crm/login`, `/crm/lead` (público, upsert
  por email), `/secreto/guardar|estado`, `/admin/cambiar_clave`.
- **V (autocorrección #2):** PUT parcial NO borra claves omitidas; carrera
  UI+cron no pisa datos; lápida borra y no resucita; `/secreto/estado` devuelve
  máscara, nunca el valor; sin clave → 503; clave mala → 401.

### F2 · Web PWA shell + módulos comerciales
- Shell `App.jsx` con workspaces `atlantis`/`cicloderiqueza`, nav por sección,
  responsive móvil (drawer), login, interceptor 401, patrón commit (`loadData`/
  `saveData` completo, `reload` que no pisa ediciones), `sw.js` network-first para
  HTML/API + `skipWaiting`/`clients.claim`, manifest PWA, push VAPID.
- Módulos: Panel (KPIs + meta de `metas[YYYY-MM]`), Leads, Pipeline (kanban,
  `followUpDate` por cadencia de config), Seguimiento, **Consultas** (diagnóstico
  Atlantis), Fuentes/UTM, Accesos.
- **V:** flujo lead → etapa → seguimiento end-to-end; cambiar la cadencia en
  config cambia el follow-up real (autocorrección #10); bump de CACHE + cierre
  completo de la app sirve el bundle nuevo (autocorrección #1).

### F3 · Línea infoproducto (workspace `cicloderiqueza`)
- Módulos Compradores, Afiliados/Embajadores, App usuarios (Calculadora Pro).
- n8n: webhooks de compra (Hotmart/ClickBank/ThriveCart) → alta de comprador +
  credenciales de la app + correo de bienvenida (flujo comprador); flujo
  embajador (acceso de cortesía); webhook de reembolso → revocación (app + bonos)
  dentro de la garantía de 7 días; gating "primeros N vitalicios" con N en config.
- **V:** compra de prueba (sandbox) crea comprador + app_usuario + correo con las
  variables correctas; reembolso de prueba revoca; webhook re-activado tras cada
  edición por API (autocorrección #3) y `curl` al path real → 200 + efecto.

### F4 · Prospección y outreach
- Prospección genérica (colectores → resolver → enriquecer → puntuar) con ICP por
  problema; módulo **youtube-embajadores** para las 5 verticales (Ambassador Fit
  Score → `prospectos` → `afiliados` con `lead_source='Prospección YouTube'`).
- Correo en frío + Nurturing (secuencia generada por IA desde la config de cada
  workspace, tope diario, baja HMAC, salida al responder/agendar/comprar).
  Cron IMAP cada 15 min (UID ascendente, sin truncar — autocorrección IMAP).
- **V:** prospecto YouTube llega con score y contacto; respuesta de correo lo
  saca del nurturing; SPF/DKIM/DMARC verificados en DNS.
- Guardarraíles: solo datos públicos, robots.txt/ToS/rate-limit, Habeas Data/GDPR.

### F5 · Contenido, web pública y ads
- Contenido/Viral/Estudio (FAL) + Blog SEO bilingüe + Calendario, todo con la voz
  §1 inyectada como system prompt y los pilares sobre los dolores del avatar.
- Maquetador para `atlantisglobalrealty.com` y las landings del producto
  (ES/EN): copia canónica en `/data/webfiles`, publicar por FTP con doble
  confirmación, **`curl+diff` repo vs prod antes de tocar** (autocorrección #8).
- Publicación por Postiz (`type:"schedule"` +1 min, nunca "now") con UTM por
  superficie/idioma; Umami mide; CAPI dispara Lead (nuevo lead) y Purchase
  (compra 44 USD) server-side con `FB_PIXEL_ID` + `FB_CAPI_TOKEN`.
- Ads: plan Meta + lookalikes, campañas creadas SIEMPRE en pausa, precio 44 USD,
  garantía 7 días y disclaimer educativo en todo creativo.
- **V:** post de prueba aparece en QUEUE de Postiz; visita con
  `?utm_source=instagram` produce lead con `fuente="instagram"` y el formulario
  marca `type` fijo aunque no haya UTM (autocorrección #12); `/capi/test` →
  `events_received:1`.

### F6 · Crons vivos y cierre
- n8n: leer bandeja (15 min), nurturing diario (9am), monitoreo de mercado
  semanal, recordatorios push diarios, respaldo externo cifrado semanal — con los
  parámetros de **Atlantis**, no los de Siemon. Nodos con `CRON_KEY`.
- Asistente flotante que ejecuta sobre el CRM (pasa por `guardar_seguro`).
- **V:** checklist completo de `despliegue.md` en verde; simulacro de las 12
  trampas de `autocorreccion.md` con su verificación cada una.

---

## 5 · Claves e insumos que debe aportar la usuaria (por fase)

| Fase | Insumo |
|---|---|
| F0 | Acceso SSH al VPS, DNS de `atlantisglobalrealty.com`, FTP del hosting web |
| F1 | `ANTHROPIC_API_KEY`; se generan `CRM_PASSWORD`, `CRON_KEY`, `TOKEN_SECRET`, VAPID |
| F3 | Credenciales/webhooks de Hotmart, ClickBank y/o ThriveCart; N del gating vitalicio; URL del área de miembros |
| F4 | Buzones SMTP/IMAP (remitente tipo `hello@atlantisglobalrealty.com`), `YOUTUBE_API_KEY`, `SERPER_API_KEY` |
| F5 | `FAL_API_KEY`, `POSTIZ_API_KEY` + cuentas OAuth, `UMAMI_WEBSITE_ID`, `FB_PIXEL_ID` + `FB_CAPI_TOKEN`, GSC/ATP/DataForSEO opcionales |

Todas por el vault (`/secreto/guardar`), nunca por chat ni `.env` versionado
(autocorrección #7). Si una clave se pega en el chat: se regenera.

---

## 6 · Pendientes y decisiones abiertas

1. **Crear el repo `atlantis-centro-de-mando`** y agregarlo a la sesión
   (`add_repo`) → ahí se ejecuta este plan desde F1 (F0 en el VPS).
2. **Skill `ads`**: la usuaria la agregará; al llegar, parametrizarla con §1.
3. **MailerLite vs buzones propios** para transaccionales del infoproducto: el
   CLAUDE.md menciona n8n/MailerLite; decidir en F3 (el motor soporta buzones
   SMTP propios; MailerLite sería integración adicional).
4. **Integración app_usuarios ↔ Calculadora Pro**: definir cómo valida la app el
   acceso (hoy `index.html` estático). Opciones: login contra el motor
   (`/app/validar`) o credenciales estáticas generadas por n8n. Recomendado:
   endpoint en el motor, para que la revocación por reembolso sea inmediata.
5. **Alcance del monitoreo de competencia** para la línea inmobiliaria
   (competidores y keywords los define la usuaria en config).
