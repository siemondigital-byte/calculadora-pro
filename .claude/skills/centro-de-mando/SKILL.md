---
name: centro-de-mando
description: Construir, operar, desplegar y depurar el Centro de Mando (CRM + motor FastAPI + PWA React + n8n + integraciones). Úsala SIEMPRE que se toque el motor, la web del CRM, la web pública, n8n o cualquier integración del sistema. Contiene la arquitectura, el catálogo de módulos, las integraciones con sus claves y setup, el ritual de despliegue verificable, y (lo más valioso) el archivo de autocorrección con las trampas reales ya sufridas y cómo no repetirlas.
---

# Centro de Mando — skill

El Centro de Mando es el sistema operativo de un negocio: prospecta, contacta, nutre, cierra, factura, crea contenido, publica, mide y se corrige. Esta skill reúne todo lo aprendido construyéndolo y operándolo.

## Regla de oro (antes de tocar nada)

**Verifica el efecto, no la intención.** Un 200 no es evidencia; un fix desplegado que la caché no sirve no es un fix; una config que existe pero no está cableada no funciona. Cada cambio se da por terminado solo cuando su verificación end-to-end pasa.

## Cómo usar esta skill

Lee el archivo que corresponda a lo que vas a hacer:

| Archivo | Cuándo leerlo |
|---|---|
| [autocorreccion.md](autocorreccion.md) | **SIEMPRE, antes de cualquier cambio.** Trampas reales (síntoma → causa → prevención → verificación): caché del service worker, PUT parcial que borra datos, webhooks n8n, proxy sin Range, secretos, repo≠prod, etc. |
| [arquitectura.md](arquitectura.md) | Antes de tocar el motor, el store, el merge seguro, el frontend o el data model. Explica el principio rector: un solo JSON (`/data/crm.json`) con read-modify-write + merge seguro. |
| [modulos.md](modulos.md) | Para ubicar un módulo del CRM: qué hace, su archivo de frontend, sus endpoints y su config parametrizable. |
| [integraciones.md](integraciones.md) | Para conectar o depurar un servicio externo (Anthropic, FAL, Postiz, Umami, FTP, n8n, buzones, CAPI, keywords/SEO, YouTube, Push). Dónde vive cada clave y el setup 1-vez. |
| [despliegue.md](despliegue.md) | Para desplegar motor, web PWA o web pública, o editar workflows de n8n. Incluye el checklist verificable de cada camino. |

Nota: `despliegue.md` referencia un `configuracion-por-negocio.md` (parámetros por negocio) que aún no forma parte de esta skill.

## Principios transversales

1. **Un solo documento, merge seguro:** todo el estado vive en `/data/crm.json`; nunca escrituras parciales sin `guardar_seguro()` (autocorrección #2).
2. **Secretos server-side:** vault con allowlist; nunca en `.env` versionado, ni en el navegador, ni en el chat (autocorrección #7).
3. **Cada deploy de web incrementa el CACHE de `sw.js`** y la usuaria cierra por completo la app una vez (autocorrección #1).
4. **Repo local ≠ producción:** `curl + diff` antes de tocar archivos públicos (autocorrección #8).
5. **Todo parametrizable:** cero valores hardcodeados de metas, precios, cadencias o voz; un solo origen de verdad por parámetro (autocorrección #10).
6. **Cero em dashes** en todo texto que sale al público (correos, web, posts, propuestas).
