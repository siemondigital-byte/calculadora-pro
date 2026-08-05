# Suite de correos transaccionales — Atlantis Global Realty

24 plantillas (12 × ES/EN) con estilos 100% inline, en dos salidas:
- **`dist-n8n/`** — para pegar directo en el nodo **Email Send** de n8n (`emailFormat: html`); incluye el link "¿No se ve bien? Ábrelo en tu navegador" ({{browser_url}}).
- **`dist-web/`** — versión "ver en navegador" (misma pieza sin la barra superior de visualización). Tema oscuro único (decisión de marca). Remitente: `contact@atlantisglobalrealty.com`. Añadir header `List-Unsubscribe: <{{unsubscribe_url}}>`.

## Merge tags
`{{nombre}} {{fecha}} {{hora}} {{zona_horaria}} {{telefono}} {{meeting_url}} {{calendar_url}} {{reschedule_url}} {{book_url}} {{presentation_url}} {{guide_url}} {{browser_url}} {{privacy_url}} {{unsubscribe_url}}`
En n8n, sustituir por expresiones según el shape del webhook (ej. `{{ $json.fields.Name || "" }}`). El campo `lang` del lead decide plantilla ES o EN.

## Asuntos y preheaders

| # | Archivo ES / EN | Asunto ES | Preheader ES | Asunto EN |
|---|---|---|---|---|
| 01 | solicitud-recibida / request-received | Recibimos tu solicitud | El siguiente paso: agenda tu llamada de diagnóstico de 15 minutos. | We received your request |
| 02 | confirmacion-llamada / call-confirmed | Tu llamada quedó confirmada | Te llamamos el {{fecha}} a las {{hora}}. | Your call is confirmed |
| 03 | recordatorio-llamada / call-reminder | Recordatorio: tu llamada se acerca | Te llamamos el {{fecha}} a las {{hora}}. | Reminder: your call is coming up |
| 04 | post-llamada / post-call | El siguiente paso: tu videollamada | Agenda tu videollamada de diagnóstico de 30 minutos. | Next step: your video call |
| 05 | confirmacion-videollamada / video-call-confirmed | Tu videollamada quedó confirmada | Nos vemos el {{fecha}} a las {{hora}}. | Your video call is confirmed |
| 06 | post-videollamada / post-video-call | Tu presentación está lista | La propuesta que revisamos, con escenarios y siguientes pasos. | Your presentation is ready |
| 07 | reagendar-llamada / reschedule-call | Elige una nueva fecha para tu llamada | Reagenda tu llamada de 15 minutos cuando te venga bien. | Pick a new time for your call |
| 08 | reagendar-videollamada / reschedule-video-call | Elige una nueva fecha para tu videollamada | Reagenda tu videollamada de 30 minutos cuando te venga bien. | Pick a new time for your video call |
| 09 | no-show / no-show | No pudimos encontrarnos | Reagendemos tu cita — sin problema. | We couldn't reach you |
| 10 | cancelacion / cancellation | Tu cita quedó cancelada | Cuando quieras retomar, la agenda queda abierta. | Your appointment was cancelled |
| 11 | cierre / closing | Gracias por tu tiempo | La puerta queda abierta — y la guía es tuya. | Thank you for your time |
| 12 | descarga-guia / guide-download | Tu guía está lista | Descarga tu guía: dónde invertir en 2026. | Your guide is ready |

## Notas de producción
- **Logo**: va incrustado en base64 para que el diseño siempre se vea; Gmail bloquea data-URI — reemplazar el `src` del `<img>` por la URL pública de `wordmark.png` (comentario en cada archivo... buscar `data:image/png`).
- Sin `<form>/<input>/<script>`: todas las acciones son `<a>`. Botón sin dependencia de hover. Preheader oculto con `mso-hide:all`.
- Flujo típico n8n: Webhook → Set (normaliza nombre, fecha localizada, tz) → IF `lang` → Email Send ES / EN.
- QA: probar merge tags con datos reales; verificar que ninguna URL quede relativa.
