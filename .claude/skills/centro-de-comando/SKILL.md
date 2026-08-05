---
name: centro-de-comando
description: >
  Replicar, montar y operar el "Centro de Mando / Centro de Comando" — un CRM y sistema
  operativo de negocio completo (motor FastAPI + web PWA React + n8n + Postiz + Umami +
  FTP + FAL + Anthropic) — para CUALQUIER empresa o modelo de negocio, como un SISTEMA VIVO
  que se adapta y se auto-corrige. Úsala cuando pidan: "montar/replicar el centro de mando",
  "un CRM propio a la medida", "sistema operativo del negocio", "panel de control del negocio",
  prospección + correo en frío + nurturing + pipeline + facturación + contenido + blog SEO +
  maquetador + publicación en redes + analítica + ads en una sola estructura adaptable.
  Triggers EN: "build/replicate the command center", "custom business CRM / operating system",
  "living business dashboard", "adapt the command center to a new business". Incluye el sistema
  de AUTOCORRECCIÓN con las trampas reales de despliegue (caché del service worker, PUT parcial
  que borra datos, webhook n8n, proxy sin Range, secretos, repo vs producción).
---

# Centro de Comando — skill para replicarlo en cualquier negocio

Esta skill te permite montar, replicar y operar el **Centro de Mando**: un CRM y sistema operativo de negocio completo, ya construido para Siemon Digital y diseñado para **replicarse, ajustarse y adaptarse a cualquier empresa** como un **sistema vivo**. No es un producto enlatado: es una estructura que se parametriza por negocio y se auto-corrige con el uso.

## Qué es (en una frase)
Un solo sistema que prospecta → contacta → nutre → cierra → factura, y en paralelo crea contenido → publica → mide → se corrige. Cuatro piezas: **motor** (FastAPI/Python en Docker), **web** (PWA React/Vite/Tailwind), **n8n** (automatizaciones), e **integraciones** (Postiz, Umami, FTP/Hostinger, FAL, Anthropic, buzones, CAPI, keywords, YouTube, Push).

## Principio rector (interiorízalo antes de tocar nada)
Todo el estado del negocio vive en **un único JSON** (`/data/crm.json`). El frontend lo lee entero, lo muta y lo escribe entero (**read-modify-write**). El backend protege cada escritura con un **merge seguro** (fill-missing + lápidas). Romper esto borra datos silenciosamente. Ver `references/autocorreccion.md` #2.

## Filosofía: sistema VIVO y ADAPTABLE
- **Nada se hardcodea.** Meta de facturación, precios, cadencias, voz de marca, nicho, canales, moneda: todo se lee de una config editable por la usuaria. Si ves un valor fijo en el flujo, cámbialo por la config real (autocorrección #10).
- **Se auto-ajusta:** crons de fondo (leer bandeja, nurturing diario, monitoreo de mercado, recordatorios, respaldos), nurturing que saca gente al responder/agendar, seguimientos que se fijan por cadencia parametrizable, atribución UTM que se cierra sola, estudio de mercado que retroalimenta el contenido, auto-checklist del maquetador.
- **Verifica el efecto, no la intención.** "200" o "el código ya está" no prueba que funcione. Comprueba end-to-end.

---

## Cómo usar esta skill

### Caso A — Montar un Centro de Mando NUEVO para otro negocio
1. **Configura el negocio primero.** Lee `references/configuracion-por-negocio.md` y llena el brief con el dueño: identidad/posicionamiento (ICP por PROBLEMA, no por tamaño), **voz de marca** (impregna TODO el contenido), metas (adaptables, no fijas), moneda, oferta gratuita/lead magnet, canales, región/idioma, integraciones.
2. **Entiende la arquitectura.** Lee `references/arquitectura.md` (motor, web, merge seguro, auth, PWA) y `references/modulos.md` (qué hace cada módulo y cómo se parametriza).
3. **Conecta las integraciones.** Sigue `references/integraciones.md` para claves (siempre server-side, vault) y el setup 1-vez de cada servicio.
4. **Despliega por partes** siguiendo `references/despliegue.md` (motor: scp+compose; web: bump sw vN + build + rsync + reabrir; web pública: FTP desde Maquetador). Corre las verificaciones.
5. **Activa los crons vivos** de n8n con los parámetros de ESE negocio.
6. **Antes de cerrar cada cambio, pasa por `references/autocorreccion.md`.**

### Caso B — Operar / extender el Centro de Mando existente
1. Ubica el módulo en `references/modulos.md` (front + endpoints).
2. Haz el cambio respetando el patrón commit (read-modify-write completo) y la config parametrizable.
3. Despliega con el ritual correcto (`references/despliegue.md`) — **el bump de `sw.js` y reabrir la app no son opcionales**.
4. Corre la verificación de la trampa correspondiente en `references/autocorreccion.md`.

---

## Sistema de AUTOCORRECCIÓN (lee esto SIEMPRE antes de dar algo por hecho)
`references/autocorreccion.md` documenta cada error real que ocurrió al construir el sistema, en formato **síntoma → causa → prevención → verificación**. Los críticos:
1. **Caché del service worker:** tras desplegar web, sube `sw.js` con `CACHE vN` incrementado y haz que la usuaria CIERRE por completo la app y la reabra (un refresh NO basta). Si "un fix no se ve", es la caché.
2. **PUT parcial borra datos:** SIEMPRE full read-modify-write; el merge rellena claves omitidas; para borrar usa lápidas; respaldos en `/data/backups`.
3. **Webhook n8n se des-registra** al editar activo: re-activar + `curl` al path REAL; inactivo = delete+recreate.
4. **Proxy sin Range:** no enrutes muchos `<video>` de preview por `/gc/proxy` (descargan enteros y congelan); usa URL directa + `preload="none"`.
5. **Coverr solo inglés:** traduce la búsqueda antes de consultar.
6. **Pixabay:** `lang=es` para español; sus videos son horizontales (no filtres duro, ordena coincidentes primero).
7. **Secretos:** vault server-side, allowlist `_SECRETOS_PERMITIDOS`, nunca en chat/navegador.
8. **Repo vs producción:** `curl+diff` antes de desplegar la web pública.
9. **Tokens en nodos n8n:** el Bearer debe coincidir con la clave; usa `CRON_KEY` estable.
10. **Config desconectada:** cablea la config real, no valores hardcodeados; verifica end-to-end.
11. **Efectos solo en canvas:** preview en vivo (render still) para WYSIWYG.
12. **Fuente del lead:** sin UTM queda "directo"; marca el origen por `type`/`leadSource` igual.

Más trampas de operación (Postiz "now", parches en contenedor, sqlite de n8n, IMAP, `_claude_json` vacío, cero em dashes) al final de ese archivo.

---

## Archivos de referencia
- `references/arquitectura.md` — las 4 piezas, auth, merge seguro, patrón commit, PWA, data model.
- `references/modulos.md` — catálogo de módulos (front + endpoints + config).
- `references/configuracion-por-negocio.md` — el brief de configuración y cómo se parametriza cada módulo; "sistema vivo".
- `references/autocorreccion.md` — las trampas reales y cómo evitarlas (síntoma→causa→prevención→verificación).
- `references/despliegue.md` — checklist verificable de despliegue (motor / web / web pública / n8n).
- `references/integraciones.md` — servicios externos, claves y setup 1-vez.

## Reglas duras que atraviesan todo
- **Voz de marca primero:** todo el texto que sale (prospección, correo, nurturing, blog, viral, ads, chatbot, propuestas, web) suena a la marca configurada. En Siemon: siempre afirmativo, cero comparaciones, **cero em dashes**.
- **Adaptable, no enlatado:** replica la ESTRUCTURA, parametriza el CONTENIDO.
- **Prioriza lo que llena/cierra pipeline** sobre lo cosmético (la meta de facturación es el norte, configurable).
- **Guardarraíles de prospección:** solo datos públicos de negocios; respeta robots.txt/ToS/rate-limit y protección de datos.
