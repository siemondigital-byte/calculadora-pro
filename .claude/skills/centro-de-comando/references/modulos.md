# Módulos del Centro de Mando

Catálogo de los módulos (vistas del CRM). Para cada uno: qué hace, el archivo de frontend, los endpoints del motor que usa, y cómo se parametriza por negocio. NO incluye el kit-instagram-web (excluido a propósito).

El nav se agrupa por secciones y admite varios **workspaces** (Siemon usa `siemon` = agencia y `academia` = infoproductos). Cada workspace tiene su nav y su slice de datos.

---

## Sección: Panel

### Panel
- **Qué:** tablero con KPIs — cobrado del mes vs anterior, por cobrar, top clientes, próximas actividades, barra de meta del mes vs cobrado.
- **Front:** inline en `App.jsx` (`PanelSiemon`).
- **Config:** meta del mes (`data.<ws>.metas[YYYY-MM]`, la pone la usuaria, NO fija), moneda.

---

## Sección: Comercial y clientes

### Prospección
- **Qué:** encuentra negocios/creadores que encajan con el ICP y los mete como prospectos; promueve a leads. Colectores enchufables (directorios/OSM, YouTube, web). Re-enriquecer, descartar (blocklist).
- **Front:** `Prospeccion.jsx`, `ProspectoDrawer.jsx`, `OutreachPanel.jsx`.
- **Endpoints:** `POST /prospectar`, `/reenriquecer`, `/prospectos/enriquecer`, `/prospectos/analizar`, `/prospectos/capturar`.
- **Config:** ICP por PROBLEMA (no tamaño), país/ciudad ("Ciudad, País" para OSM/Nominatim), canales activos, rúbrica de score por servicio. Guardarraíles: solo datos públicos de negocios, respeta robots.txt/ToS/rate-limit, GDPR/Habeas Data.

### Correo en frío
- **Qué:** outreach por email. Gestión de buzones (SMTP/IMAP), envío, lectura de bandeja con clasificación IA de respuestas, redacción IA consciente de la conversación, prospecto manual, log de enviados, pixel de apertura, rebotes.
- **Front:** `CorreoFrioView.jsx`.
- **Endpoints:** `/buzones`(+`/probar`,`/eliminar`), `/enviar_correo`, `/enviados`, `/leer_correos`, `/generar_mensaje`, `/prospectos/enriquecer`, `GET /px/{tid}`.
- **Config:** buzones, voz de marca, `campana` (oferta parametrizable para ir probando), cadencia de seguimiento (de config, no constante). El estado del prospecto es único y compartido con Prospección.

### Nurturing
- **Qué:** secuencia de correos por fases (bienvenida/convencer/ventas) con cadencia en días. Auto-inscribe leads elegibles; sale de la serie al responder/agendar/darse de baja/volverse Cliente. Deliverability: tope diario + espaciado + pixel + baja HMAC.
- **Front:** `NurturingView.jsx` + `SelectorMedia.jsx` (imagen del correo).
- **Endpoints:** `/nurturing/generar`, `/procesar` (cron diario), `/sincronizar`, `GET /nurturing/px|r|baja`.
- **Config:** persona + oferta, remitente (`hello@`), nº de correos y cadencia, `topeDiario`, autoInscribir. La secuencia la GENERA la IA desde la config; no se envía hasta revisar y "Activar" (exige todos los pasos listos). SPF/DKIM/DMARC en DNS.

### Leads / Pipeline / Seguimiento
- **Leads** (`Leads` inline): lista de leads, drawer con insight IA, propuesta personalizada (url+clave), campos ricos (web, perfil, nicho, ubicación, seguidores, relación).
- **Pipeline** (`Pipeline` inline): kanban por etapas con "Mover a:", probabilidad/prioridad por lead, forecast ponderado por columna. Mover etapa fija `followUpDate` según la cadencia (config, no constante).
- **Seguimiento** (`SeguimientoView.jsx`, badge de pendientes): tareas agrupadas Vencidas/Hoy/Esta semana/Más adelante + botón IA por etapa (guion llamada/agenda/WhatsApp/referido).
- **Endpoints:** `/crm/insight_lead`, `/generar_mensaje`, `/crm/no_shows`, `/crm/buscar_lead` (los dos últimos con forma Airtable para n8n).
- **Config:** etapas (STAGES), fuentes (LEAD_SOURCES), canales, probabilidad por etapa, cadencia de toques.

### Facturación / Clientes
- **Facturación** (`FacturacionView.jsx`): facturas con numeración auto, estados (Vencida calculada), IVA/retención, PDF con logo/marca, envío por correo con mensaje IA editable, KPIs cobrado/pendiente/vencido + gastos + balance + evolución + alertas. Crear desde lead con valor prefill.
- **Clientes** (`ClientesView.jsx`): leads con status Cliente; KPIs; origen visible; facturas por cliente; crear cliente manual; botón Facturar.
- **Endpoints:** `/facturas/mensaje`, `/facturas/pdf`, `/facturas/enviar`, `/gc/subir` (logo).
- **Config:** prefijo de numeración, moneda, IVA/ret por defecto, logo, presets de gastos.

### Ofertas / Propuesta personalizada
- **Qué:** deck standalone personalizable post-llamada. Placeholders `[ ... ]` (no `{{}}`), WhatsApp por `deck-config`. El agente calcula precios (tamaño+complejidad+horas+alcance+urgencia) y genera hallazgos/entregables/métricas. Flujo n8n genera, cifra (AES-GCM+PBKDF2), sube por FTP, guarda url+clave en el lead, y manda correo de aprobación humana.
- **Front:** `Ofertas` inline + bloque en `LeadDrawer`.
- **Endpoints:** `/propuestas/guardar` (n8n con CRON_KEY), `/proto/generar`, `/proto/publicar` (prototipo "lo que puedo hacer por ti").
- **Config:** frentes de servicio, rúbrica de precios, WhatsApp del responsable.

### Fuentes / Canales / Agenda
- **Fuentes** (`FuentesView.jsx`): enlaces UTM por superficie e idioma; leads por fuente; mapeo `fuente`=utm_source.
- **Canales** (`Canales` inline): canales de adquisición.
- **Agenda** (`Agenda` inline): agenda y envíos.
- **Config:** superficies e idiomas para generar los UTM.

### Estudio de mercado
- **Qué:** (1) Salud de tu web (auditoría SEO propia con histórico), (2) Competencia (descubrir por Serper, precalificar con Haiku, rastrear SEO+señales, monitoreo semanal), (3) Análisis e insights (auditoría de negocio honesta). Retroalimenta viral/blog/ads con `insightsMercado(data)` como contexto.
- **Front:** `MercadoView.jsx`.
- **Endpoints:** `/seo/auditar`, `/seo/soluciones`, `/mercado/descubrir|precalificar|rastrear|monitorear`, `/auditoria/negocio`.
- **Config:** dominio propio, competidores, país para keywords.

---

## Sección: Contenido

### Contenido y estudio (EstudioUnificado)
Orquestador de 3 etapas (Identificar → Crear → Publicar). Envuelve:
- **Viral** (`ViralView.jsx`): motor de ideas de video corto (lotes de 20 puntuadas por 7 criterios + nivel de conciencia + formato), backlog con estados, guion de 5 partes, regla 80/20. `/viral/ideas`, `/viral/guion`.
- **Contenido** (`ContenidoView.jsx`): tendencias en el nicho (YT outliers), genera posts/ads, publica con enlace UTM. `/ideas`, `/generar_contenido`, `/traducir`, `/publicar`, `/redes/integraciones`, `/gc/subir`.
- **Estudio img/video** (`EstudioContenidoView.jsx`): FAL (imagen FLUX, video Seedance), diseño SVG de marca editable, carrusel, banco de fotos/video, titulares "Inspírame". `/gc/imagen|video|carrusel|diseno|titulares|subir|videos_banco|estado`, `/blog/fotos`.
- **Editor de video** (`VideoEditor.jsx`) y **Editor de imagen** (`EditorImagen.jsx`): filtros, logo, texto. WYSIWYG en vivo (render still, no solo al previsualizar — autocorrección #11). Exporta vía `/gc/proxy` (un solo video, para evitar canvas tainted).
- **Selector de media** (`SelectorMedia.jsx`): componente reutilizable (banco + IA + editor). Montado en Contenido, Blog y Nurturing. Quirks de Pixabay/Coverr en autocorrección #5, #6.
- **Config:** pilares de tendencia (editables, es+en), voz, nicho, contexto de mercado.

### Blog y SEO
- **Qué:** suite completa. Pestañas Blog / Palabras clave / Auditoría SEO. Genera ideas ancladas a keywords reales y artículos en voz de marca; keywords de GSC/ATP/DataForSEO/Planner + lista curada editable (★objetivo, prioridad máxima); portada e imágenes/video en el cuerpo; blog público que se actualiza sin re-subir.
- **Front:** `BlogSeoView.jsx` (el más grande).
- **Endpoints:** `/blog/articulo|ideas|keywords|keywords_cache|sugerir_keywords|curar_lista|fotos|imagen`, `/blog/dfs_*`, `/blog/gsc_*`, `/blog/atp_*`, `/blog/kwplanner_importar`, `/video/hero`, `/seo/auditar`. Público: `/blog/publicos`, comentarios, aprobar/rechazar.
- **Config:** keywords curadas (★objetivo), GSC del sitio, cabecera del blog (`blogConfig`).

### Maquetador (mi web)
- **Qué:** editor visual de la web pública (embebe `maquetador-editor.html`), inspector para editar textos/imágenes/enlaces/alt clicando, preview fiel, publicar EN VIVO por FTP con doble confirmación, versiones/restaurar, diff legible ("qué cambió"), aplicar soluciones SEO con empalmes quirúrgicos, checklist de fixes del estudio (⚡ auto-aplicables).
- **Front:** `MaquetadorView.jsx`.
- **Endpoints:** `/web/estado|leer|escribir|publicar|diff|versiones|restaurar|aplicar_soluciones|mejorar_texto|clave_formulario`.
- **Config:** copia canónica en `/data/webfiles`. Trampa: repo≠prod (autocorrección #8).

### Analítica
- **Qué:** dashboard de Umami + panel "qué cambiar según el estudio de mercado".
- **Front:** `AnaliticaView.jsx`. **Endpoint:** `/analitica/resumen`.
- **Config:** Umami website id.

### Calendario
- **Qué:** calendario de contenido; artículos/publicaciones programados; puente a Contenido (`irACrear`).
- **Front:** `CalendarioView.jsx`. Sin endpoints propios.

### Ads
- **Qué:** plan de lanzamiento (conjuntos de testeo, creativos por temperatura, escalado 80/20, checklist), crear campaña (Meta real, SIEMPRE en pausa), y tarjeta Conversions API (CAPI). Usa el estudio de mercado como fundamento.
- **Front:** `AdsView.jsx`.
- **Endpoints:** `/ads/plan|crear|config`, `/capi/estado|test`, `/secreto/guardar`, `/generar_contenido`.
- **Config:** presupuestos, pixel + CAPI token.

### Estudio YT
- **Qué:** guion de retención, títulos, miniatura, repurpose, calendario; tendencias bilingües editables; analítica pública y privada (OAuth).
- **Front:** `EstudioYtView.jsx`.
- **Endpoints:** `/yt_studio`, `/canal_analitica`, `/canal_analitica_privada`, `/ideas`, `/config/secreto(s)`, `/oauth/youtube/*`.
- **Config:** canal, pilares, OAuth de Google (ver integraciones).

---

## Sección: Configuración

### Accesos
- **Qué:** bóveda de credenciales (portales precargados) + cambiar clave del CRM + clave del formulario de diagnóstico.
- **Front:** `AccesosView.jsx`. **Endpoints:** `/admin/cambiar_clave`, `/web/clave_formulario`. Los secretos van al vault (nunca al navegador).

---

## Global (siempre montado)

- **Asistente flotante** (`AsistenteFlotante.jsx`): chat que EJECUTA sobre el CRM (crea leads, mueve pipeline, publica, prospecta). Devuelve sugerencias (chips) y visualizaciones (número/barras/tabla). `POST /asistente`. Pasa por el merge seguro y refresca el doc.
- **Enlaces rápidos** (`EnlacesRapidos.jsx`), **Modal**, **LeadDrawer**, toast.
- **Push:** campana de suscripción (VAPID) + recordatorios diarios.

---

## Workspace `academia` (segundo espacio, opcional)
Panel, Catálogo, Inscritos, Comunidad (inline en `App.jsx`). Datos en `academia.*`. Se activa solo si el negocio tiene una segunda línea (cursos/comunidad).

---

## Actualizaciones recientes (jul-18)

### Módulo Prototipos ("lo que puedo hacer por ti")
Prospección enviando a un contacto una landing hecha a la medida de SU negocio (una muestra, no propuesta con precios), publicada en su propia URL para compartir por WhatsApp/correo.
- Frontend: `PrototiposView.jsx`, nav bajo Prospección (view "prototipos"). Trae datos de un lead, genera, previsualiza (iframe srcDoc), publica y comparte. Persiste en `data.siemon.prototipos`.
- Motor: `/proto/generar` (Claude escribe HTML autocontenido con la estética de marca vía helper `_claude_texto`) y `/proto/publicar` (FTP vía `web_pub.publicar_html(remoto, html)`, valida ruta + mkdirs remoto).
- URL pública: `siemondigital.com/loquepuedohacerporti/<slug>.html`.
- Para adaptar a otro negocio: cambiar la estética/voz del prompt en `/proto/generar` y la carpeta base de la URL.

### Editor de video (Contenido) — capacidades completas
`VideoEditor.jsx` renderiza sobre `<canvas>` (export por MediaRecorder). Incluye: recorte, velocidad, filtros de color (B&N, violeta duotono, splash violeta, anaglifo 3D, glitch — mismos que el editor de imagen), orientación de salida (original/9:16/1:1/16:9, con cover-crop), texto con auto-ajuste (word-wrap + encoge), aparición "por partes" (cada renglón en su tramo), animaciones (fade/pop/deslizar/máquina de escribir), tipografía de marca (display bold / mono estilo footer en MAYÚSCULAS), color de texto (claro/violeta), fondo del texto (sin fondo con sombra / caja suave redondeada baja opacidad), y logo marca de agua con posición.
- CLAVE: los efectos solo se ven en `<canvas>`, no en el `<video>` crudo → se implementó un PREVIEW EN VIVO (renderStill dibuja un cuadro fijo con todo aplicado cuando cambian los ajustes) para que sea WYSIWYG. Ver [[autocorreccion]].

### Home SEO con keywords
`/seo/soluciones` acepta `keyword` + `keywords[]` y teje la keyword en title/description/H1/intro; devuelve además una sección `keywords` (objetivo, h1_sugerido, intro_sugerida, donde_reforzar). En MercadoView hay un input de keyword + chips desde `blogKeywordsCuradas`.

### Conversions API (Ads)
`/capi/estado`, `/capi/test`, `/capi/evento` en el motor; secretos `FB_CAPI_TOKEN`, `FB_PIXEL_ID`, `FB_CAPI_TEST`. Tarjeta de conexión en AdsView. Hashea email/telefono con SHA-256 y postea a graph.facebook.com/v21.0/{pixel}/events.

### Responsive (móvil)
El layout usa `flex md:flex-row`. En móvil hay barra superior con hamburguesa (`Menu`) + logo + vista actual; el `<aside>` es un drawer fijo (`fixed md:sticky`, `-translate-x-full` cerrado, `md:translate-x-0`) con backdrop; cada ítem del nav cierra el drawer (`setNavOpen(false)`). Los Views usan `p-5 md:p-8` y las tablas anchas hacen scroll horizontal (`overflow-x-auto`).

### CAPI — eventos automáticos (jul-18)
La conexión CAPI ya dispara eventos reales, server-side:
- **Lead**: en `/crm/lead`, SOLO al crear un lead nuevo (no en updates, para no duplicar), con `event_id="lead-<id>"`. Hashea email/telefono; usa ip/ua si el form los pasa (mejor matching → cablear n8n para enviar x-forwarded-for + user-agent).
- **Purchase**: en `FacturacionView.marcarPagada()` → POST `/capi/evento` con `{event:"Purchase", email (del lead por leadId), valor:total, moneda, event_id:"purchase-<id>"}`.
- Ambos best-effort (nunca rompen el flujo). Verificado: `/capi/test` y un Purchase de prueba devolvieron `events_received:1`.
- Para adaptar a otro negocio: los mismos hooks sirven; cambia el evento (Lead/Purchase/Contact/Schedule) según el embudo.

- CAPI matching fino HECHO: los webhooks n8n (guia/contacto/chat) pasan ip (x-forwarded-for) + ua (user-agent) al /crm/lead, y el evento Lead los envia a Meta como client_ip_address/client_user_agent. Patron a replicar en cualquier webhook de lead.

---

## SEO / Keywords — stack completo (jul-19)

El módulo **Blog y SEO** (`BlogSeoView.jsx`) alimenta una **lista curada de keywords** (`data.siemon.blogKeywordsCuradas`) que a su vez nutre: el recorrido SEO de la home (`/seo/soluciones` con keyword), los artículos del blog y el plan de Ads. Función central: `fusionarCuradas(filas, fuente, zona)` deduplica y añade.

### Fuentes de keywords (en orden de calidad, elegir según el negocio)
1. **Google Ads Keyword Planner (API)** — LA MÁS CONFIABLE (dato de Google). Motor `/keywords/google` → `customers/{cid}:generateKeywordIdeas` (v18), geo/idioma por país (`_GADS_GEO`/`_GADS_LANG`), devuelve keyword + volumen mensual + competencia + cpc. OAuth `/oauth/gads/start|callback` **reutiliza el cliente de YouTube** (`GADS_CLIENT_ID` cae a `YT_OAUTH_CLIENT_ID`); guarda `GADS_REFRESH`. Estado: `/keywords/google/estado`. UI en BlogSeoView ("Keyword Planner · API automática": conectar + buscar por tema/URL; cae al CSV si no está conectado).
2. **Google Search Console (API)** — las CONSULTAS REALES con las que ya llegan a la web (clics/impresiones/CTR/posición). OAuth `/oauth/gsc/start|callback` (scope `webmasters.readonly`, **mismo cliente de YouTube**). Endpoints `/blog/gsc_estado`, `/blog/gsc_sitios`, consulta de queries. Requiere la web verificada en Search Console. Gratis, sin trámite. Botón "Conectar Search Console" en BlogSeoView.
3. **AnswerThePublic** (preguntas reales) — `/blog/atp_*`, secreto `ATP_TOKEN`.
4. **DataForSEO** — variantes con volumen/dificultad; útil pero **trae ruido** (filtrar). Secretos `DATAFORSEO_LOGIN/PASSWORD`.
5. **Apify/Ubersuggest** — **DEPRECADO** (dejó de funcionar); no depender de él.
6. **Keyword Planner CSV** — importar el export manual (`/blog/kwplanner_importar`), fallback sin API.

### Secretos SEO (allowlist): 
`GOOGLE_ADS_DEV_TOKEN`, `GOOGLE_ADS_CUSTOMER`, `GOOGLE_ADS_LOGIN_CUSTOMER` (MCC), `GADS_CLIENT_ID/SECRET` (o reutiliza `YT_OAUTH_CLIENT_ID/SECRET`), `GADS_REFRESH`, `ATP_TOKEN`, `DATAFORSEO_LOGIN/PASSWORD`.

### Setup por negocio (para el token de Google Ads)
1. Crear **cuenta de Administrador (MCC)** en ads.google.com/home/tools/manager-accounts (gratis) — el **developer token** vive en su **API Center**, no en cuentas normales.
2. Pedir **acceso básico** al developer token (formulario en API Center) → aprobación de Google en **1-3 días** (el acceso de prueba solo sirve con cuentas de test).
3. Vincular la cuenta de anuncios normal a la MCC (Customer ID de esa cuenta = el `customer` a consultar; el ID de la MCC = `login-customer-id`).
4. En **Google Cloud Console** (mismo proyecto del OAuth de YouTube): habilitar **Google Ads API** y **Google Search Console API**, y agregar los scopes `adwords` y `webmasters.readonly` a la pantalla de consentimiento.
5. En el CRM: pegar developer token + Customer ID (+ MCC) → Guardar → "Conectar (autorizar)".
