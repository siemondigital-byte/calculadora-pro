# Centro de Mando · Atlantis Global Realty

Plataforma que administra el negocio de Atlantis en dos líneas (workspaces):
`atlantis` (inmobiliaria / arquitectos de patrimonio) y `cicloderiqueza`
(infoproducto a 44 USD). Construido siguiendo la skill `centro-de-comando`
(ver `.claude/skills/centro-de-comando/` y `docs/plan-centro-de-mando-atlantis.md`
en la raíz del repo).

## Estado

- **F1 · Motor núcleo: hecho y verificado** (34 chequeos: auth fail-closed,
  merge seguro fill-missing + lápidas, vault cifrado con allowlist, rotación de
  clave, backups diarios).
- **F2 · Web PWA: hecho y verificado** (13 chequeos E2E en navegador: login,
  leads, pipeline con forecast, seguimiento por cadencia de config, consultas,
  UTM con lápidas, compradores con revocación por reembolso, workspaces).
- F0 (VPS/DNS), F3 (webhooks de compra), F4 (prospección/outreach), F5
  (contenido/ads), F6 (crons): pendientes según el plan.

## Piezas

- `motor-prospeccion/` — FastAPI. Un solo `/data/crm.json`; toda escritura pasa
  por `guardar_seguro()` (merge anti-pérdida). Auth `Bearer` fail-closed +
  `CRON_KEY` estable para n8n. Vault de secretos con allowlist.
- `web/` — PWA React/Vite/Tailwind. Patrón commit (read-modify-write completo),
  interceptor 401, service worker con `CACHE vN`.
- `docker-compose.yml` + `nginx-web.conf` — motor + web + n8n.

## Desplegar (F0) — un solo comando en el VPS

La web se construye DENTRO de Docker (multi-stage) y Caddy emite el TLS solo:
el VPS no necesita Node ni certbot.

1. **DNS primero:** registros A de `crm.`, `motor.` y `hooks.`
   `atlantisglobalrealty.com` → IP del VPS (sin esto Caddy no emite TLS).
2. En la terminal del VPS (hPanel → VPS → Terminal del navegador), como root:
   ```
   git clone --branch claude/new-session-3rjwcr https://github.com/siemondigital-byte/calculadora-pro.git /root/atlantis
   bash /root/atlantis/centro-de-mando/scripts/bootstrap-vps.sh
   ```
   (Repo privado: usar `https://<TOKEN>@github.com/...` en el clone.)
   El script instala Docker si falta, genera `.env` con claves nuevas
   (imprime la clave de acceso al CRM una sola vez), levanta todo y corre el
   checklist de verificación.
3. Pegar `ANTHROPIC_API_KEY` en `/root/atlantis/centro-de-mando/.env` y
   `docker compose up -d motor` para activar la IA. El resto de claves van por
   el vault desde la UI de Accesos, nunca en `.env`.
4. Verificación obligatoria (checklist completo en
   `docs/plan-centro-de-mando-atlantis.md` y en la skill `despliegue.md`):
   - `curl https://motor.../` → 200; `/crm/data` sin Bearer → 401.
   - Login en `crm...`, crear un lead, recargar y confirmar que persiste.

## Ritual de cada deploy de web (no opcional)

1. Bump `web/public/sw.js`: `CACHE = "atlantis-cm-vN"` → `vN+1`.
2. `npm run build` + subir `dist/`.
3. `curl /sw.js | grep CACHE` confirma versión nueva.
4. La usuaria cierra POR COMPLETO la app (todas las pestañas o la PWA
   instalada) y la reabre una vez. Un refresh no basta.

## Verificaciones locales

- Motor: `python test_motor.py` (script en el historial de la sesión; se
  moverá a `tests/` en F3).
- Web: `npm run build` + E2E de Playwright (`e2e.mjs` de la sesión).
