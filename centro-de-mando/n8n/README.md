# Flujos de n8n — Centro de Mando Atlantis

Plantillas para importar en `hooks.atlantisglobalrealty.com` (n8n → Workflows →
Import from file). Después de importar, en cada nodo "Motor" reemplaza
`REEMPLAZAR_CRON_KEY` por la `CRON_KEY` del `.env` del VPS (los nodos usan la
CRON_KEY estable, no la clave de login: rotar la clave no los rompe).

| Flujo | Archivo | Dispara |
|---|---|---|
| Compra confirmada | `compra-confirmada.json` | Webhook de Hotmart/ClickBank/ThriveCart → `/compra/registrar` → correo de bienvenida con credenciales de la Calculadora Pro |
| Reembolso | `reembolso.json` | Webhook de reembolso → `/compra/reembolso` (revoca app y bonos) |
| Monitoreo de mercado | `monitoreo-mercado.json` | Cron lunes 8:11am → `/mercado/monitorear` (re-audita tu web y todos los competidores seguidos; actualiza históricos) |
| Formulario web → lead | `formulario-web.json` | Webhooks `/webhook/formulario-atlantis` y `/webhook/formulario-cicloderiqueza` → `/crm/lead` (con utm_source como fuente, ip/ua para CAPI). Apunta los formularios de las webs a esas URLs |
| Respaldo diario del CRM | `respaldo-crm.json` | Cron 3:17am → `GET /crm/data` → copia íntegra de `crm.json` en el volumen de n8n (`/home/node/.n8n/respaldos/crm-<día>.json`, 7 rotativos, uno por día de la semana) |
| Acceso app · alta | `acceso-app-alta.json` | `POST /webhook/alta-calculadora?k=<CRON_KEY>` → genera contraseña segura (crypto), crea el usuario en Supabase (`email_confirm:true`) y envía el correo de credenciales con la marca |
| Acceso app · reset (solicitar) | `acceso-app-reset-solicitar.json` | `POST /webhook/password-reset-request` `{email, lang}` → token propio de 60 min en `password_resets` → correo con el enlace `app…/reset.html?token=…`. Responde siempre `{ok:true}` (anti-enumeración) |
| Acceso app · reset (confirmar) | `acceso-app-reset-confirmar.json` | `POST /webhook/password-reset-confirm` `{token, password}` → consume el token (un solo uso, atómico), cambia la contraseña por la Admin API y envía el aviso de seguridad |

## Acceso a la Calculadora Pro (alta + recuperación de contraseña)

Los tres flujos `acceso-app-*` reproducen el sistema de correos transaccionales
del handoff de Supabase, con la marca Atlantis (acento champagne, Inter,
wordmark). Decisiones clave:

- **Sin correos de Supabase Auth**: n8n envía todo por SMTP; Supabase es solo la
  base de usuarios (Admin API con la service_role). No actives el SMTP de
  Supabase ni sus plantillas (duplicaría correos).
- **Token propio en vez del reset PKCE de Supabase**: el enlace funciona en
  cualquier navegador/dispositivo (el PKCE falla con `Auth session missing!` al
  abrir el correo en otro equipo).
- **Supabase por variables de entorno**: los nodos leen `$env.SUPABASE_URL` y
  `$env.SUPABASE_SERVICE_KEY`, que el compose del bootstrap ya pasa al
  contenedor `n8n-atlantis` (defínelas en el `.env` del VPS). La tabla
  `password_resets` se accede por el REST de Supabase → **no hace falta
  credencial Postgres en n8n**.
- **Contraseñas y tokens con `crypto`** (no `Math.random`): el compose ya trae
  `NODE_FUNCTION_ALLOW_BUILTIN=crypto`.
- **Remitente por idioma (convención de CLAUDE.md §7)**: los correos del
  producto salen como `cicloderiqueza@atlantisglobalrealty.com` (ES) o
  `wealthcycle@atlantisglobalrealty.com` (EN); el nodo "Armar correo" elige y
  el nodo de envío usa `{{ $json.from }}`. `contact@` queda reservado para la
  agencia (llamadas/asesoría). Ambos alias deben existir en Hostinger y estar
  verificados como "Send mail as" en el Gmail que envía.
- **El alta NO es pública**: exige `?k=<CRON_KEY>` (el instalador la deja
  puesta). Los dos webhooks de reset sí son públicos por diseño: el de
  solicitar solo dispara un correo al dueño de la cuenta y en el de confirmar
  el token ES la credencial.

Pasos para activarlos:

1. Corre `n8n/sql-password-resets.sql` en Supabase → SQL Editor (crea la tabla
   con RLS activo).
2. Verifica que el `.env` del VPS tenga `SUPABASE_URL` y `SUPABASE_SERVICE_KEY`
   (los del proyecto de la Calculadora) y corre el instalador de flujos.
3. En n8n, asigna la credencial **SMTP** a los tres nodos de correo (la misma
   de los demás flujos). Consejo del handoff: usa **Brevo** o **Resend** con el
   dominio verificado (SPF/DKIM); el SMTP del hosting acepta y no entrega, y
   Gmail topa en ~500/día.
4. La app llama a `password-reset-request` / `password-reset-confirm` (el
   cliente `auth-cliente.js` + `reset.html` del handoff ya apuntan a esos
   nombres). Cuando el dominio final de la app esté fijo, restringe el CORS de
   esos dos webhooks (nodo Webhook → Options → Allowed Origins) y ponle rate
   limit en Traefik si quieres endurecerlo.
5. El enlace del correo apunta a `https://wealthcycle-app.atlantisglobalrealty.com/reset.html`;
   si la app vive en otra URL, cámbiala en el nodo "Armar correo" del flujo de
   solicitar.

## Restaurar un respaldo del CRM

Los respaldos diarios viven en el volumen de n8n del VPS
(`/root/atlantis/n8n-data/respaldos/crm-<día>.json`). Para restaurar:

```bash
cd /root/atlantis
docker compose -f compose.compartido.yml stop motor-atlantis
cp n8n-data/respaldos/crm-lunes.json data/crm.json   # el día que quieras
docker compose -f compose.compartido.yml start motor-atlantis
```

## Integración con la Calculadora Pro (Supabase)

El acceso de los compradores a la app lo administra **Supabase** (rama
`feat/pro-supabase`, flujo `automatizacion/n8n-compra-crd.json`). El flujo
completo de una compra encadena AMBOS sistemas:

```
Webhook plataforma → n8n-compra-crd (Supabase: crear usuario, gating, correo)
                   → HTTP Request extra al motor: POST /compra/registrar
                     (CRM: comprador + lead Comprador + CAPI Purchase)
Reembolso          → revocar_acceso (Supabase) + POST /compra/reembolso (CRM)
```

Al importar `n8n-compra-crd.json`, agrégale al final un nodo HTTP Request al
motor (Bearer = CRON_KEY) con el mismo payload normalizado; y al camino de
reembolso, otro hacia `/compra/reembolso`. Así el CRM siempre refleja compras
y reembolsos aunque el acceso viva en Supabase.

## Configuración en las plataformas de venta

- **Hotmart:** Herramientas → Webhook (Postback). URL: la del nodo Webhook del
  flujo importado (léela del nodo, no la adivines). Eventos: compra aprobada y
  reembolso.
- **ClickBank / ThriveCart:** apuntar sus notificaciones (INS / webhooks) a las
  mismas URLs. Los nodos "Normalizar" mapean los campos de cada plataforma a
  `{email, nombre, plataforma, transaccion, idioma}` — ajusta ahí si el payload
  difiere.

## Trampas conocidas (skill: autocorreccion #3 y #9)

- Editar un workflow ACTIVO por API des-registra el webhook: re-activar
  (toggle) y `curl` al path REAL → debe dar 200.
- Workflow INACTIVO editado por API: borrar + recrear, no PUT + activar.
- El correo de bienvenida usa las variables ya definidas del ecosistema:
  `nombre`, `email`, `password`, `membersUrl`, `appUrl`, `downloadsUrl`, `webUrl`.
