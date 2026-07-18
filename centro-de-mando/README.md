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

## Desplegar (F0, cuando haya VPS)

1. DNS: `crm.`, `motor.`, `hooks.` → IP del VPS. TLS con Traefik o certbot.
2. En el VPS: clonar, crear `.env` con `CRM_PASSWORD`, `CRON_KEY`,
   `TOKEN_SECRET`, `ANTHROPIC_API_KEY` (el resto de claves van por el vault
   desde la UI de Accesos, nunca en `.env`).
3. `cd web && npm ci && VITE_MOTOR_URL=https://motor.atlantisglobalrealty.com npm run build`
4. `docker compose up -d --build`
5. Verificación obligatoria (checklist completo en
   `docs/plan-centro-de-mando-atlantis.md` y en la skill `despliegue.md`):
   - `curl https://motor.../` → 200; sin Bearer → 503/401.
   - Login en `crm...`, crear un lead, `GET /crm/data` confirma el efecto.

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
