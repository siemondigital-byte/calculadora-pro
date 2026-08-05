# Handoff: Correos de credenciales · Ciclo de Riqueza Inmobiliaria

## Overview
Los 3 correos de credenciales de la marca, en español e inglés (6 archivos), en dos versiones cada uno:
- **Mail Compra** — correo de acceso tras la compra: credenciales del aplicativo (`{{ $json.email }}` / `{{ $json.password }}`), CTA al Área de Miembros, al aplicativo y a los descargables, y primeros pasos.
- **Mail Embajadores** — alta de embajador: credenciales personales del aplicativo + credenciales UNIVERSALES fijas del Área de Miembros (embajadores@atlantisglobalrealty.com / CicloEmbajadores44), CTAs y recursos. Lo dispara el registro en la página `sitio-embudo/embajadores/` (payload incluye `token` de invitación que el flujo debe validar).
- **Mail Cambio Contraseña** — reset: CTA "Crear nueva contraseña" → `{{ $json.resetUrl }}` (con `?token=…`), chips "vence en 60 minutos · un solo uso", enlace fallback copiable y caja de seguridad "¿No fuiste tú?" (ignorar el correo; nunca pedimos la contraseña por correo).

## Estas plantillas SON el entregable de producción
No hay framework que portar: cada HTML se pega tal cual en el nodo *Send Email* de n8n (campo HTML, `emailFormat: html`). El trabajo de Code es integrarlas al flujo (variables reales, URLs), publicar la versión web y mantener la coherencia en correos nuevos.

## Dos versiones por correo (regla clave)
- **`dist-email/`** — versión para clientes de correo (n8n/SMTP). Incluye la barra "Ver este correo en el navegador" y el link del footer, apuntando a `{{ $json.webUrl }}`. Es la que se envía.
- **`dist-web/`** — versión "ver en navegador" para publicar en el servidor. **NO contiene** la barra superior ni el link "Ver en navegador" (eliminados del HTML, no solo ocultos). Al publicarla, reemplazar los `{{ $json.* }}` server-side con los datos del envío; el script del final solo rellena datos demo al abrir el archivo localmente y puede quitarse en producción.
Ambas comparten markup y tokens; cualquier cambio de diseño debe aplicarse a las dos.

## Requisitos duros de compatibilidad (NO romper)
- Layout 100% `<table role="presentation">`, ancho fijo 600px — nunca flex/grid (Outlook).
- Todos los estilos inline; el único `<style>` trae solo resets + dark mode + breakpoint móvil.
- Dark mode vía `@media (prefers-color-scheme: dark)` con clases utilitarias (`.email-bg .card .ink .body-text .muted .gold .hairline .cred-box .cred-value .ring .ring-dot .ring-gap .pill .btn-primary .btn-secondary .footer-line`) y `!important`. Mantener `<meta name="color-scheme">` + `supported-color-schemes`.
- Sin `<form>/<input>/<button>` — toda acción es `<a>`; botones bulletproof (`<td>` con bgcolor + `<a display:block>`), sin hover-dependencia.
- Preheader oculto (`display:none;max-height:0;mso-hide:all` + relleno `&#847;&zwnj;&nbsp;`).
- Logo órbita en CSS puro (Gmail elimina SVG): anillo 27px oro + rectángulo `.ring-gap` que abre el cuadrante superior-derecho (mismo color que la tarjeta: `#FBF8F1` light / `#0F1B2D` dark) + punto 6px corrido 2px a la izquierda de las 12. El círculo nunca debe verse cerrado.
- Credenciales en caja navy `.cred-box` con valores en mono (`'SF Mono','Courier New'`) y `word-break:break-all`.
- Móvil ≤620px: contenedor fluido, padding 24px, botones full-width.
- Comentario MSO `OfficeDocumentSettings` en `<head>` — conservar.

## Variables n8n (modo expresión)
Compra/Embajadores: `{{ $json.nombre }}`, `{{ $json.email }}`, `{{ $json.password }}`, `{{ $json.membersUrl }}`, `{{ $json.appUrl }}`, `{{ $json.downloadsUrl }}`. Cambio contraseña: `{{ $json.nombre }}`, `{{ $json.resetUrl }}`. Todos: `{{ $json.webUrl }}` (opcional, versión web publicada).
Cada archivo lista sus variables en el comentario del `<head>`. El campo `lang` del lead decide plantilla ES o EN.

**Seguridad:** la contraseña enviada es temporal — el flujo debe forzar cambio al primer acceso. Nunca enviar contraseñas definitivas por correo. El `resetUrl` debe generarse con token de un solo uso y expiración de 60 minutos; el correo ya comunica ambas condiciones.

## Design Tokens
- **Light (base inline):** fondo `#ECE6DA`; tarjeta `#FBF8F1`; tinta `#0F1B2D`; cuerpo `#3C4452`; muted `#8A7F6A`; oro `#A67C34`; botón primario `#0F1B2D`/`#F4EFE6` radius 3px; secundario outline; caja credenciales `#0F1B2D` borde `rgba(166,124,52,0.40)`.
- **Dark (overrides):** fondo `#0A0A0C`; tarjeta `#0F1B2D`; tinta `#F4EFE6`; oro `#E6C788`; botón `#E6C788`/`#0A0A0C`; caja `#060608`.
- **Tipografía:** `Bodoni Moda` 700–800 titulares (H1 56px → 40px móvil, palabra acentuada en oro itálica); `Instrument Sans` UI/cuerpo; mono para credenciales. Google Fonts con fallback Georgia/Helvetica.

## QA
- Abrir cada `dist-web/` en navegador: datos demo rellenos, SIN "ver en navegador".
- Envío de prueba desde n8n: barra y link presentes; dark mode correcto en Apple Mail/iOS.
- Móvil ≤620px sin desbordes; ninguna variable sin reemplazar en producción.

## Files
- `dist-email/Mail Compra.html` + `EN` — correo de acceso (enviar).
- `dist-email/Mail Embajadores.html` + `EN` — correo de embajadores (enviar).
- `dist-email/Mail Cambio Contrasena.html` + `EN` — correo de reset (enviar).
- `dist-web/…` — los mismos 6 sin "ver en navegador" (publicar como página).

## Pendiente
La página de destino del `resetUrl` (cambiar contraseña: medidor de fuerza, checklist de requisitos, countdown 60:00) aún no existe — construirla con el mismo lenguaje visual de `sitio-embudo/`.
