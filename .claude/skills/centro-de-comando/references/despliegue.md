# Despliegue — checklist verificable

El Centro de Mando vive en un VPS (Docker + nginx + Traefik). Hay dos artefactos que se despliegan por caminos distintos: el **motor** (FastAPI) y la **web** (PWA). Además la **web pública** de marketing se publica por FTP desde el propio CRM (Maquetador). Cada camino tiene su ritual; saltarse un paso es la causa #1 de "lo desplegué y no se ve".

Referencia de infra (ejemplo Siemon; parametrízalo por negocio en `configuracion-por-negocio.md`):
- Web PWA (CRM): `crm.<dominio>` → nginx sirve `/root/<proyecto>/web` (build de `web/`, Vite/React).
- Motor (FastAPI): `prospeccion.<dominio>` (o `motor.<dominio>`) → `/root/<proyecto>/motor` (código de `motor-prospeccion/`). Auth por header `Authorization: Bearer <clave>`.
- Datos: `/data/crm.json` (única fuente de verdad), `/data/secretos.json` (server-only), `/data/buzones.json`, `/data/backups/`, medios en `/data/gc_media` servidos en `/media/*`.
- n8n: `hooks.<dominio>` (webhooks/automatizaciones). Postiz: `publicar.<dominio>`. Umami: `analitica.<dominio>`.

---

## A. Desplegar el MOTOR (FastAPI)

1. **Verifica repo vs prod si tocas la web pública** (no aplica al motor, pero tenlo presente para archivos públicos — ver autocorrección #8).
2. Copia el código al VPS:
   ```
   scp motor-prospeccion/*.py mi-vps:/root/<proyecto>/motor/
   ```
3. Reconstruye y levanta:
   ```
   ssh mi-vps "cd /root/<proyecto> && docker compose up -d --build motor"
   ```
4. **Verificación (obligatoria):**
   - Health/ping del motor: `curl -s https://<motor>/  ` (o el endpoint de salud) → 200.
   - Auth: `curl` con la clave correcta → 200; sin clave o clave mala → 401/503.
   - El endpoint que tocaste: llámalo con datos reales y confirma el **efecto** (no solo el 200). Si escribe al store, `GET /crm/data` y confirma que el dato quedó y que NO borró otras claves.
   - Revisa logs: `ssh mi-vps "docker logs --tail 50 <contenedor-motor>"`.

---

## B. Desplegar la WEB (PWA / CRM) — el ritual del service worker

**El paso que todos olvidan: subir `sw.js` con el CACHE incrementado.** Sin esto, el fix está en vivo pero la caché sirve el bundle viejo (ver autocorrección #1).

1. **Bump del service worker:** edita `web/public/sw.js` e incrementa `const CACHE = "...-vN"` (v109 → v110 …). Este paso es obligatorio en CADA deploy de web.
2. Build:
   ```
   cd web && npm run build
   ```
3. Sube el build:
   ```
   rsync -az --delete web/dist/ mi-vps:/root/<proyecto>/web/
   ```
4. Recarga nginx:
   ```
   ssh mi-vps "docker exec <contenedor-web> nginx -s reload"
   ```
5. **Verificación (obligatoria):**
   - `curl -s https://<crm>/ | grep -o 'index-[^"]*\.js'` → toma el nombre del bundle y `curl` ese bundle + grep del código del fix. Confirma que el fix está en vivo.
   - `curl -s https://<crm>/sw.js | grep CACHE` → confirma la versión nueva.
   - **Dile a la usuaria que cierre por completo el Centro de Mando (todas las pestañas/ventanas o la app instalada) y lo abra una sola vez.** Un refresh NO basta. Solo así el SW nuevo toma control y baja el código fresco.

---

## C. Publicar la WEB PÚBLICA (marketing) — desde el Maquetador, por FTP

La web pública (home, propuesta, blog, guía) NO se despliega por scp; se publica por FTP desde el módulo Maquetador (`web_pub.py`).

1. **Compara repo vs prod antes** (autocorrección #8): `curl -s https://<sitio>/<ruta> | diff - <archivo-repo>`. Sincroniza repo ← prod si prod va adelante.
2. La copia canónica vive en `/data/webfiles`. Editar en el editor visual escribe la canónica con respaldo previo en `/data/webfiles/versiones/<ts>/`.
3. Publica con doble confirmación (publica EN VIVO): `/web/publicar`. El diff (`/web/diff`) muestra qué cambió antes de publicar.
4. **Verificación:** `curl` a la URL pública y confirma el cambio; el blog público (`/blog/publicos`) se actualiza sin re-subir (lee del API).

---

## D. Automatizaciones (n8n)

- Para editar un workflow **activo**: `PUT` + re-activar (toggle) y `curl` al path REAL del webhook → 200 (autocorrección #3).
- Para un workflow **inactivo**: `DELETE` + `POST` (no `PUT`+activar).
- Usa `curl --data-binary @file`.
- Si rotaste la clave del motor, revisa que los nodos httpRequest usen la `CRON_KEY` estable (autocorrección #9).

---

## Checklist rápido (pegar en cada deploy)

```
MOTOR
[ ] scp motor-prospeccion/*.py → /root/<proyecto>/motor/
[ ] docker compose up -d --build motor
[ ] curl health 200 + auth 401 sin clave
[ ] endpoint tocado: efecto verificado end-to-end (no solo 200)
[ ] GET /crm/data confirma que no se borró nada

WEB (PWA/CRM)
[ ] bump sw.js CACHE vN → vN+1   <-- NO OLVIDAR
[ ] npm run build
[ ] rsync dist/ → /root/<proyecto>/web/
[ ] docker exec web nginx -s reload
[ ] curl bundle en vivo + grep del fix
[ ] curl /sw.js confirma versión nueva
[ ] usuaria CIERRA por completo el CRM y lo reabre una vez

WEB PÚBLICA (si aplica)
[ ] curl+diff repo vs prod
[ ] /web/diff revisado
[ ] /web/publicar (doble confirmación) + curl verifica

N8N (si aplica)
[ ] activo: PUT + re-activar; inactivo: delete+recreate
[ ] curl al path real del webhook 200
[ ] nodos usan CRON_KEY estable
```
