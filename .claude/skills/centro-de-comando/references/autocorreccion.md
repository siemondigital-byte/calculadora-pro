# Autocorrección — trampas reales y cómo NO repetirlas

Este archivo es lo más valioso de la skill. Cada entrada nació de un error real que ocurrió al construir el Centro de Mando de Siemon: algo que "no funcionaba", quedaba desconectado, o borraba datos. El formato es siempre el mismo:

> **Síntoma** → **Causa raíz** → **Prevención** → **Verificación**

Antes de dar por terminado cualquier cambio, corre la **Verificación** correspondiente. "Respondió 200" o "el código ya está" NO es evidencia de que funciona: comprueba el efecto end-to-end.

Regla de oro que atraviesa TODO este archivo: **verifica el efecto, no la intención.** Un endpoint que devuelve 200 pero no crea el post, un fix en el bundle que la caché no sirve, una config que existe pero no está cableada... todos "parecen" hechos y no lo están.

---

## 1. Caché del service worker de la PWA (el error #1 más frecuente)

- **Síntoma:** desplegaste un fix del frontend, confirmaste que está en vivo, y la usuaria dice "sigue sin funcionar / lo veo igual".
- **Causa raíz:** el CRM es una PWA con service worker (`web/public/sw.js`, `const CACHE = "...-vN"`). El SW viejo instalado en el navegador/app sigue controlando la pestaña y sirviendo el bundle cacheado. Un `Cmd+Shift+R` NO basta: el SW no cede el control hasta que se cierran TODAS las pestañas/ventanas/la app instalada.
- **Prevención:**
  1. Primero descarta que sea bug de código: `curl -s https://<crm>/ | grep -o 'index-[^"]*\.js'` y luego `curl` a ese bundle + grep del fix. Si el fix YA está en vivo, no es código, es caché.
  2. Cada vez que despliegues web, **incrementa el número de CACHE en `sw.js`** (v4 → v5 …). Es obligatorio, no opcional.
  3. `sw.js` debe usar `skipWaiting()` + `clients.claim()` para que el SW nuevo tome control apenas se reabra.
- **Verificación:** pide a la usuaria que **cierre por completo el Centro de Mando (todas las pestañas/ventanas, o la app instalada en el móvil) y lo abra una sola vez**. Ahí el SW nuevo baja el código fresco. En iOS el PWA se instala desde "Añadir a pantalla de inicio" (iOS 16.4+ para push).

---

## 2. PUT parcial a `/crm/data` borra datos (el más peligroso)

- **Síntoma:** guardaste un cambio pequeño (quitar un competidor, tocar un flag) y desapareció casi todo el CRM: leads, prospectos, ofertas, un workspace entero.
- **Causa raíz:** `crm_store.guardar()` REEMPLAZA el archivo con lo que le llega. Un `PUT /crm/data` con payload PARCIAL (solo `{siemon:{borrados:...}}`) nukea todo lo omitido. Es un footgun silencioso: cualquier payload incompleto (tuyo, de un cron, o de una pestaña vieja del navegador) borra sin avisar. La causa raíz REAL de las pérdidas fue que los escritores del motor (leer_correos, nurturing, monitorear, auto_revision) hacían `leer → procesar minutos → guardar directo`, pisando los commits de la UI SIN pasar por el merge.
- **Prevención:**
  1. **Nunca escribas parcial.** Siempre **full read-modify-write**: `GET /crm/data` → muta en memoria el objeto completo → `PUT` el objeto completo.
  2. En el motor, `_merge_con_servidor` debe hacer **fill-missing**: al inicio rellena las claves de nivel superior y las de `siemon` que el entrante NO traiga (así un envío parcial ya no borra).
  3. **TODOS** los escritores server-side (crons, IMAP, nurturing) deben pasar por un `guardar_seguro()` que hace merge contra el disco al momento de guardar — nunca `crm_store.guardar()` directo.
  4. Para BORRAR un ítem de una lista (no puedes hacerlo por omisión), usa la señal de **lápida**: `PUT {data:{siemon:{borrados:{competidores:["https://url"]}}}}`. El merge respeta la lápida y NO resucita el ítem. La UI lo levanta solo con la señal inversa (`revivir`) al re-agregar.
  5. Respaldos diarios automáticos en `/data/backups/crm-YYYY-MM-DD.json` (últimos 10). Backup externo cifrado por FTP semanal.
- **Verificación:** tras cualquier cambio en el store, `GET /crm/data` y confirma que las claves grandes (leads, prospectos, facturas) siguen ahí con el mismo conteo. Simula una carrera: guarda desde la UI y desde un cron casi a la vez y verifica que ninguno pisa al otro.

---

## 3. El webhook de n8n se des-registra al editar por API

- **Síntoma:** editaste un workflow por API, todo "ok", pero el webhook responde 404 y los formularios/chat dejan de entrar.
- **Causa raíz:** al editar por API un workflow ACTIVO, el webhook puede quedar des-registrado hasta re-activarlo. Peor: en este n8n (modelo borrador/publicado), un `PUT /workflows/{id}` **publica** en workflows ACTIVOS pero en INACTIVOS solo actualiza el BORRADOR — al activar corre la versión publicada vieja, no tu edición.
- **Prevención:**
  1. Para un workflow ACTIVO: `PUT` y luego **re-activa** (toggle) para re-registrar el webhook.
  2. Para un workflow INACTIVO que quieres que ejecute lo nuevo: **borrar (`DELETE`) + recrear (`POST`)**, no `PUT`+activar (el id cambia, aceptable en pruebas).
  3. Usa `curl --data-binary @file` para PUT/POST (byte-safe). Concatenar la respuesta por chunks corrompió un carácter multibyte una vez.
- **Verificación:** `curl` al **path REAL** del webhook (no lo adivines: léelo del nodo Webhook del workflow) y confirma 200 + efecto. Ej: `curl -X POST https://<hooks>/webhook/<path-real> -d '{...}'`.

---

## 4. El proxy no soporta Range → previews de video congelan la app

- **Síntoma:** una galería/banco con muchos `<video>` de preview congela la pantalla o tarda eternidades.
- **Causa raíz:** `/gc/proxy` NO soporta HTTP Range. Si enrutas N `<video>` de preview por el proxy, cada uno intenta descargarse ENTERO (sin streaming por rangos) y bloquea todo.
- **Prevención:**
  1. Los previews de un banco de medios usan la **URL directa** del proveedor + `preload="none"` (cargan al hacer hover, no todos a la vez).
  2. El proxy se reserva para UN solo video (ej: el Editor de video, para exportar sin canvas tainted por CORS), no para listas.
- **Verificación:** abre la búsqueda de video con 15-20 resultados y confirma que la UI responde de inmediato y los videos solo cargan al hover.

---

## 5. Coverr solo entiende inglés

- **Síntoma:** buscas video de stock con una frase en español y Coverr devuelve nada o resultados irrelevantes.
- **Causa raíz:** Coverr solo indexa en inglés.
- **Prevención:** antes de consultar Coverr, **traduce la búsqueda a keywords en inglés** (Claude o un mapa simple). Además Coverr protege hotlink: HEAD da 301 pero GET/Range da 200 (los videos SÍ sirven en directo con Range 206) — no pases sus previews por el proxy (ver #4).
- **Verificación:** busca "reunión de negocios" y confirma que internamente consulta "business meeting" y trae resultados.

---

## 6. Pixabay: `lang=es` obligatorio y videos casi todos horizontales

- **Síntoma (foto):** buscas una frase en español y Pixabay devuelve fotos random (molinos, playas, estatuas) en vez de lo pedido.
- **Causa raíz:** sin el parámetro `lang`, Pixabay interpreta mal el español y cae a "populares".
- **Síntoma (video):** pides orientación vertical y salen 0 resultados.
- **Causa raíz:** los videos de Pixabay son casi todos horizontales; un filtro duro por orientación los borra todos.
- **Prevención:**
  1. Detecta si la búsqueda es español (acentos/stopwords) y manda `lang=es`; si no, `lang=en`. (Helper tipo `_banco_lang(q)`.)
  2. **No excluyas por orientación**: ordena los que coinciden primero (`_match`) y deja el resto detrás. Igual para Coverr.
- **Verificación:** búsqueda en español devuelve lo pedido; pedir vertical devuelve resultados (los verticales primero), no 0.

---

## 7. Secretos: server-side y allowlist; nunca en el chat ni en el navegador

- **Síntoma:** una clave (FAL, Anthropic, token de API) queda expuesta en logs, en el navegador, o pegada en el chat.
- **Causa raíz:** guardar claves en `.env` versionado, mandarlas al frontend, o pedir a la usuaria que las pegue en el chat.
- **Prevención:**
  1. Los secretos viven **server-side** en un vault (`/data/secretos.json`, cifrado), gestionados por endpoints `/secreto/guardar` + `/secreto/estado`.
  2. `/secreto/guardar` acepta SOLO claves de una **allowlist** (`_SECRETOS_PERMITIDOS`: FAL_API_KEY, ATP_TOKEN, POSTIZ_API_KEY, FB_CAPI_TOKEN, FB_PIXEL_ID, DATAFORSEO_LOGIN/PASSWORD, YT_OAUTH_*, etc.) y devuelve **solo una máscara**, nunca el valor.
  3. La UI (módulo Accesos + tarjetas de conexión por integración) tiene campos de tipo password que escriben al vault y NUNCA leen de vuelta el valor.
  4. Si la usuaria pega una clave en el chat: pídele que la **regenere** y la guarde por el campo seguro; no la persistas.
- **Verificación:** `/secreto/estado` devuelve `{clave: "****...xy", valido: true/false}` sin exponer el valor. Confirma que ningún endpoint devuelve el secreto en claro y que no aparece en el bundle del navegador.

---

## 8. Repo local ≠ producción (verifica con curl+diff antes de desplegar)

- **Síntoma:** despliegas el repo y pisas un fix que ya funcionaba en vivo, o dejas producción rota.
- **Causa raíz:** la usuaria a veces edita archivos directo en el hosting (File Manager) sin sincronizar de vuelta al repo. El repo local NO es la fuente de verdad de la web pública.
- **Prevención:** antes de editar/desplegar cualquier archivo público, compara contra producción:
  `curl -s https://<sitio>/<ruta> | diff - <archivo-repo>`. Si prod va adelante, sincroniza repo ← prod primero.
- **Verificación:** el diff está vacío (o solo muestra tu cambio intencional) antes de subir. Nunca asumas que el repo coincide con prod.

---

## 9. El Bearer del CRM está fijo en los nodos n8n y debe coincidir con la clave del motor

- **Síntoma:** un flujo de n8n que escribe al CRM empieza a dar 401 y los leads/propuestas dejan de entrar.
- **Causa raíz:** cada nodo `httpRequest` de n8n que llama al motor lleva el token Bearer HARDCODEADO. Si rotas la clave del motor (`CRM_PASSWORD` / clave vigente) y no actualizas los nodos, todos fallan. (Por eso el motor acepta también una `CRON_KEY` interna estable para los flujos.)
- **Prevención:**
  1. Al rotar la clave, actualiza **todos** los nodos httpRequest de n8n que llaman al motor (o mejor: haz que los flujos usen `CRON_KEY`, que no cambia).
  2. Mantén un `TOKEN_SECRET` **estable** aparte para firmar tokens (baja de nurturing, propuestas) y cifrar respaldos — así rotar la clave de login no rompe enlaces existentes.
- **Verificación:** tras rotar, `curl` con la clave nueva → 200, con la vieja → 401, y dispara un flujo de n8n de prueba que escriba al CRM y confirma que el registro aparece.

---

## 10. Config "desconectada": valores hardcodeados en vez de la config real

- **Síntoma:** existe un panel de configuración parametrizable, pero al operar el sistema usa otro valor (fijo) y los cambios de la usuaria no tienen efecto.
- **Causa raíz:** ejemplo real: `followUpPara(status)` usaba una constante fija de días en vez de leer la config parametrizable de seguimientos. La config existía en la UI pero no estaba cableada al flujo. Otros casos: `ideasTendencia` que solo persistía una vista, la meta del Panel hardcodeada en $10k en vez de leer `metas[YYYY-MM]`.
- **Prevención:**
  1. Cuando agregues una config parametrizable, **cablea la config real** en TODOS los puntos que la consumen; borra el valor hardcodeado.
  2. Un solo origen de verdad por parámetro (ej: la cadencia de seguimiento se lee de `data.<ws>.config`, no de una constante en dos archivos).
  3. Nunca hardcodees metas, precios, cadencias ni la voz: todo adaptable (es la filosofía del sistema vivo).
- **Verificación:** cambia el valor en la UI, dispara el flujo, y confirma que el flujo usó el valor NUEVO end-to-end (no el default).

---

## 11. Efectos que solo se ven "al previsualizar" (WYSIWYG roto)

- **Síntoma:** en el editor de video/imagen, el logo/texto/filtros que aplica la usuaria no se ven en el lienzo; solo aparecen al pulsar "previsualizar" o al exportar.
- **Causa raíz:** los efectos se aplicaban únicamente en el paso de render de preview/export, no en el canvas en vivo.
- **Prevención:** renderiza en vivo (render "still" sobre el frame actual) cada vez que cambia un parámetro, para que lo que se ve sea lo que se exporta (WYSIWYG). Mismo principio en el maquetador: la vista previa muestra EXACTAMENTE la copia canónica que se publicará.
- **Verificación:** mueve el logo / cambia un filtro y confirma que el cambio se ve **inmediatamente** en el lienzo, sin pulsar preview, y que el export coincide con lo que se veía.

---

## 12. Fuente del lead: "directo" tapa el canal real

- **Síntoma:** un lead que llegó por la guía/chatbot aparece con `fuente="directo"` y se pierde la atribución.
- **Causa raíz:** la `fuente` se deriva del `utm_source` de la URL; si el visitante entra sin UTM, queda `directo` aunque el formulario sea el de la guía.
- **Prevención:** distingue DOS campos y no los mezcles:
  - **`source` / `type`** = tipo de formulario, valor FIJO (`guia-ia`, `contacto`, `chatbot`). Marca el origen semántico.
  - **`fuente`** = canal real = `utm_source` (linkedin, instagram, web-principal…), default `directo`.
  Aunque `fuente="directo"`, marca el lead con `leadSource="Guía IA"` + `type="guia-ia"` para no perder de qué formulario vino. El valor de guía es EXACTAMENTE `guia-ia` (con guion): el valor del form y la opción del destino deben ser idénticos o el guardado falla.
- **Verificación:** entra a la guía sin UTM y confirma que el lead queda `fuente="directo"` PERO `leadSource`/`type` identifican la guía. Entra con `?utm_source=linkedin` y confirma `fuente="linkedin"`.

---

## Errores de operación adicionales (aprendidos en vivo)

- **Postiz "now" falla callado:** publicar con `type:"now"` + fecha exacta NO entra a la cola de Postiz (responde 200 pero 0 posts). Publica SIEMPRE como `type:"schedule"` con `date = ahora + 1 minuto`. Verificación: `GET` posts de Postiz y confirma que el post existe en estado QUEUE.
- **Parches dentro de un contenedor se pierden al recrearlo:** el fix de LinkedIn en Postiz (`sed` a `prompt=none` y a los scopes de más) vive DENTRO del contenedor; `docker restart` lo conserva, pero `compose up --build`/`pull` lo revierte. Reaplica el sed + restart tras cada actualización de Postiz.
- **n8n sqlite:** para editar la base de n8n, SIEMPRE opera el archivo del volumen en el host con el contenedor DETENIDO, y borra `-wal`/`-shm`. Nunca `docker cp` con el contenedor vivo (provoca corrupción por checkpoints de WAL stale). Ten un respaldo antes.
- **Node Function de n8n sin crypto:** el Code node no trae `require('crypto')` por defecto; requiere `NODE_FUNCTION_ALLOW_BUILTIN=crypto` en el `environment:` del servicio n8n del compose. Si el contenedor se recrea sin ella, el cifrado de propuestas rompe.
- **IMAP no saltar correos:** al leer bandeja, procesa por UID en orden ascendente y NO trunques con `[-50:]` mientras avanzas `ultima_uid` al máximo (pierdes correos si llegan >50 de una).
- **Auth fail-closed:** el `_auth` del motor debe cerrar (503) si falta la clave, nunca pasar si `CRM_PASSWORD` está vacío. Usa `compare_digest`. Nunca pases la clave por query (`?k=`) porque va a los logs; usa header `Authorization: Bearer`.
- **Anti-SSRF en el proxy:** `/gc/proxy` debe bloquear IPs privadas/metadata/redirects y topar el tamaño (ej. 300MB) para no ser un SSRF.
- **`_claude_json` (Claude que devuelve vacío):** con `thinking` habilitado, el modelo puede consumir TODO el presupuesto de tokens pensando y devolver texto vacío ("sin_json"). Fija `thinking={"type":"disabled"}` + un piso de tokens (≥4000, 7000 para planes largos) + reintentos. Verificación: el endpoint devuelve JSON válido, no vacío.
- **Regla de marca dura:** cero em dashes (`—`) en TODO el texto que sale (correos, web, posts, propuestas). Un limpiador `_sin_em_dash` en toda la generación.

---

## Trampas adicionales (jul-18)

### Proxy sin soporte de Range → previews de video congelan
- **Síntoma**: buscar videos de banco "no hace nada" / la app se congela.
- **Causa**: se enrutaron los `<video>` de resultados por `/gc/proxy`, que NO soporta Range; cada `<video preload="metadata">` descarga el archivo ENTERO; 18 a la vez saturan.
- **Prevención**: los previews del banco usan la URL directa del CDN (Coverr/Pexels sí soportan Range 206) + `preload="none"` (cargan al hover). El proxy solo para el Editor de video (un solo clip, para exportar sin canvas tainted).
- **Verificación**: `curl -r 0-1000 <url>` debe dar 206; abrir la búsqueda y ver que responde al instante.

### Coverr solo entiende inglés
- **Síntoma**: Coverr devuelve 0 con una búsqueda en español ("persona viendo computador...").
- **Causa**: Coverr no tiene soporte multi-idioma; su índice es de tags en inglés.
- **Prevención**: traducir la búsqueda a 2-4 keywords en inglés (Haiku, helper `_kw_en`) antes de consultar Coverr; fallback a la primera palabra si sigue vacío. Pexels usa `locale=es-ES`; Pixabay usa `lang=es`.
- **Verificación**: `curl` al endpoint con frase en español debe devolver resultados.

### Pixabay: idioma y orientación
- **Síntoma**: fotos random en español; video vertical devuelve 0.
- **Causa**: sin `lang=es` cae a populares; sus videos son casi todos horizontales y un filtro duro de orientación los borra todos.
- **Prevención**: pasar `lang` (es/en detectado); NO excluir por orientación, ordenar coincidentes primero.

### Efectos solo visibles en canvas (editor de video)
- **Síntoma**: "activo el logo/texto/filtro y no cambia nada".
- **Causa**: el logo/texto/filtros solo se dibujan en `<canvas>` durante "Previsualizar"; la vista por defecto es el `<video>` crudo.
- **Prevención**: PREVIEW EN VIVO — un `renderStill()` dibuja un cuadro fijo con todos los efectos aplicados cada vez que cambia un ajuste, y se muestra el canvas (no el video) cuando hay efectos activos. Mismo principio para la orientación (el preview se recorta con object-fit cover en vivo).
- **Regla transversal**: cuando un control "no hace nada", pregúntate si el efecto vive en una capa (canvas) distinta a la que el usuario está viendo.

### Auto-marcado / auto-detección (auto-checklist)
- Un checklist "automático" debe DETECTAR el estado real, no solo marcarse al hacer clic. Ej. el auto-checklist del Maquetador corre un dry-run al abrir y marca solos los puntos ⚡ ya aplicados. Lección: para "automático", conecta una verificación real (dry_run/diff), no un flag manual.

### FB Conversions API necesita token Y Pixel ID
- Un token de Ads no basta: CAPI requiere el **Pixel/Dataset ID** (15-16 dígitos). Sin él no se envían eventos. Leer ambos del vault de Accesos server-side; nunca mostrarlos.
