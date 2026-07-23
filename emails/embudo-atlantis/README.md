# Handoff: Embudo web + correos transaccionales — Atlantis Global Realty

## Overview
Páginas clave del embudo de captación de Atlantis Global Realty (agencia de inversión inmobiliaria internacional) y sus correos transaccionales:
agendamiento de diagnóstico (llamada 15 min y videollamada 30 min), landing de lead magnet, baja de correos, legales ES/EN, y 4 plantillas de email.

## About the Design Files
- `sitio/` es **HTML/CSS/JS estático listo para desplegar** en cualquier hosting (Hostinger, Netlify, S3…). No requiere build ni frameworks. Puede publicarse tal cual, o recrearse en el stack del sitio existente (WordPress/Elementor) respetando las especificaciones de este documento.
- `emails/` son **plantillas HTML de correo** en dos salidas: `dist-n8n/` (con link "ver en navegador", para pegar en el nodo Email Send de n8n) y `dist-web/` (versión "ver en navegador", sin esa barra). 12 correos × ES/EN cada una; tabla de asuntos/preheaders en `emails/README-suite.md`.
- `sitio/index.html` es un **índice interno de QA** — no publicar; solo enlaza las demás páginas.

## Fidelity
**High-fidelity.** Colores, tipografía, espaciados y estados son finales y están alineados con atlantisglobalrealty.com (producción) y el Manual de Marca v1.

## Design Tokens
Colores (definidos en `sitio/assets/base.css` como CSS custom properties):
- `--bg: #040606` — fondo (negro del sitio en producción)
- `--surface: #0F1B2D` — navy de tarjetas/paneles
- `--accent: #C9A87E` — oro tostado (botones, énfasis, iconos). *El manual de marca define #E6C788; producción usa #C9A87E y este es el aplicado.*
- `--ink: #F4EFE6` — crema, texto principal
- `--gris: #D7D7D9` — texto secundario / leads
- `--muted: rgba(244,239,230,.55)` — metadatos
- `--line: rgba(201,168,126,.16)` — bordes hairline
- Inputs claros: fondo `#E9E6DF`, texto `#14242F`, placeholder `#70747a`
- Error: `#c98a7a`

Tipografía:
- **Figtree** (Google Fonts, 400/500/600/700) — titulares y cuerpo. Fallback: Inter (variable, autoalojada en `sitio/assets/fonts/Inter-Variable.ttf`).
- **Pondar** (`sitio/assets/fonts/Pondar.otf`) — SOLO identidad (wordmark). Sin tildes: nunca en texto corrido.
- H1: Figtree 500, `clamp(36px, 5vw, 54px)`, line-height 1.14; la frase clave va en `<b>` color oro peso 500 **con subrayado dibujado** (SVG inline como background, curva `M3 8 Q100 -3 197 6`, trazo 2.2 oro).
- Eyebrow `.ml`: Figtree 700, 12px, letter-spacing .14em, uppercase, oro, precedido por **icono de 4 cuadraditos dorados** (11×11px, gap central) hecho con 4 linear-gradients.
- Botón `.btn`: rectangular (radius 2px), fondo oro, texto `#0A0A0C` Figtree 700 13px uppercase letter-spacing .08em, padding 17px 34px.
- Etiquetas de formulario: Figtree 700 10.5px uppercase .14em muted.

Otros:
- Tarjetas `.card`: navy, borde `--line`, radius 4px, sombra `0 30px 60px -20px rgba(0,0,0,.55)`.
- Cajas de pasos `.steps li`: borde `1px dashed rgba(201,168,126,.45)`, numeración "01/02/03" oro 11px 700 .18em (patrón STEP del sitio).
- Chips `.fact`: borde hairline radius 2px, punto dorado 6px, texto 11px 700 uppercase.
- Fondo de página: radial dorado muy sutil arriba-derecha (`radial-gradient(1100px 600px at 88% -8%, var(--accent-soft), transparent 60%)`).
- Sin tema claro: **tema oscuro único** (decisión de marca).

## Screens / Views
Todas las páginas comparten: topbar (lockup `wordmark.png` alto 52px, enlaza al índice + selector ES/EN), footer (© año dinámico, disclaimer educativo, links legales, dominio), grid `max-width 1180px`, breakpoints ≤920px (1 columna) y ≤520px.

1. **`sitio/agendar-video/`** — Diagnóstico por videollamada (30 min). Grid `0.92fr 1.08fr`, gap 56px. Izq: eyebrow "Agendamiento", H1 "Agenda tu **diagnóstico** por videollamada", lead ("La consulta es un diagnóstico, no una venta"), 3 chips (30 minutos / Videollamada / Sin costo), "Qué veremos" 01–03. Der: `.card` con línea de zona horaria detectada (`Intl.DateTimeFormat().resolvedOptions().timeZone`) y **slot de Cal.com**: constante `CAL_LINK` al final del HTML — vacía muestra placeholder; con valor (`"equipo/evento"`) monta el embed inline oficial con `theme:"dark"`.
2. **`sitio/agendar-llamada/`** — Variante llamada 15 min. Igual estructura; copy y chips propios (15 minutos / Por teléfono / Sin costo) y su propio `CAL_LINK`.
3. **`sitio/guia/`** — Landing lead magnet «Dónde invertir en 2026». Izq: copy + bullets flecha dorada + formulario (Nombre, Correo, honeypot `input[name=website].hp`, botón, `p.status[aria-live]`, fine print). Der: **portada del ebook dibujada en CSS** (`.cover`, ratio 3/4.2, glow dorado, anillos, puntos, wordmark al 7% de opacidad, dominio al pie) — no usa imagen raster, se regenera con los tokens. Éxito: modal `.done` ("¡Tu guía va en camino!… revisa spam") — el PDF llega por correo, no se descarga directo.
4. **`sitio/unsubscribe/`** — Card centrada de 2 estados (confirmar baja → baja confirmada + re-suscribir). Lee `?email=` y `?token=` de la URL.
5. **`sitio/legales/`** — privacidad/terminos (ES) + privacy/terms (EN), enlazadas cruzado ES↔EN, layout documento 760px.

## Interactions & Behavior
- **i18n ES/EN**: diccionario `window.I18N={es:{…},en:{…}}` por página + `sitio/assets/app.js` que aplica `data-i18n` (texto), `data-i18n-html`, `data-i18n-ph` (placeholder) y reescribe `a[data-href-es]/[data-href-en]`. Idioma inicial: `localStorage['agr-lang']` o `navigator.language`; persiste al hacer clic en ES/EN.
- **Formularios**: validación inline (nombre no vacío, email regex); campo con error → clase `.bad` (borde `#c98a7a` + mensaje). Honeypot descarta el envío en silencio.
- **Webhooks n8n** (constantes al final de cada HTML, hoy vacías = modo demo con éxito simulado):
  - `WEBHOOK_LEAD_MAGNET` en guia — POST JSON `{name,email,lang,source:"guia"}`
  - `WEBHOOK_UNSUB` en unsubscribe — POST JSON `{email,token,action:"unsubscribe"|"resubscribe",lang}`
  - Fallo de fetch → mensaje con mailto a contact@atlantisglobalrealty.com.
- Botón hover: `filter:brightness(1.08)`. Links: oro → crema en hover.

## State Management
Sin framework: estado en variables locales + `localStorage['agr-lang']`. La página de baja alterna dos bloques (`#st-ask`/`#st-done`) con la clase `.hide`.

## Emails (`emails/`)
4 plantillas: `es/confirmacion-agendamiento.html`, `es/descarga-guia.html`, `en/booking-confirmation.html`, `en/guide-download.html`.
- Especificación de marca: wordmark arriba (imagen vía `{{wordmark_url}}` — subir `sitio/assets/wordmark.png` al hosting y usar su URL pública), **un mensaje por correo**, **un solo botón dorado** rectangular con texto oscuro uppercase, preheader oculto propio, disclaimer educativo y link de baja al pie.
- Colores: fondo `#040606`, card `#0F1B2D` borde `rgba(201,168,126,.16)` radius 16px, oro `#C9A87E`, texto `#F4EFE6`/`#D7D7D9`.
- Fuente: `Figtree,Inter,Helvetica,Arial` (los clientes de correo caerán a Helvetica/Arial — esperado).
- Merge tags: `{{name}} {{date}} {{time}} {{tz}} {{medio}} {{book_url}} {{guide_url}} {{unsubscribe_url}} {{wordmark_url}}`.
- Remitente: `contact@atlantisglobalrealty.com` (indicado en comentario dentro de cada archivo). Configurar header `List-Unsubscribe` apuntando al webhook de baja.

## Assets
- `sitio/assets/wordmark.png` — lockup oficial (ATLANTIS crema + GLOBAL REALTY oro), recortado, para fondo oscuro.
- `sitio/assets/logo.png` — ISO (A dorada en vórtice de puntos).
- `sitio/assets/fonts/` — Pondar.otf, Inter-Variable.ttf (autoalojadas; Pondar jamás desde CDN).
- Figtree se carga de Google Fonts en cada página.

## Deployment checklist
1. Poner `CAL_LINK` en ambas páginas de agendamiento (Cal.com → enlace del evento).
2. Poner las URLs de `WEBHOOK_LEAD_MAGNET` y `WEBHOOK_UNSUB` (flujos n8n).
3. Subir `wordmark.png` a una URL pública y configurarla como `{{wordmark_url}}` en n8n.
4. Publicar `sitio/` (sin `index.html` raíz o protegido). QA: ambos idiomas, móvil ≤920/≤520, honeypot, fetch caído (fallback mailto).

## Files
- `sitio/assets/base.css` — todos los tokens y componentes.
- `sitio/assets/app.js` — i18n + persistencia.
- `sitio/agendar-video/index.html`, `sitio/agendar-llamada/index.html`, `sitio/guia/index.html`, `sitio/unsubscribe/index.html`, `sitio/legales/*.html`, `sitio/index.html` (QA).
- `emails/es/*.html`, `emails/en/*.html`.
