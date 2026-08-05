# Handoff · Correos transaccionales de la Calculadora Pro (acceso + reset)

> Para el asistente que trabaje EN LOCAL (con acceso al VPS por SSH/terminal
> y al navegador del usuario). Contexto completo, estado real, el problema
> pendiente y su solución ya preparada. No inventes rutas ni nombres: todo
> lo que necesitas está aquí.

## 1 · Qué es este sistema

Ecosistema **Atlantis Global Realty / Ciclo de Riqueza Inmobiliaria**:

- **App** (Calculadora de Viabilidad Inmobiliaria Pro): estática, deploy en
  Vercel → `https://wealthcycle-app.atlantisglobalrealty.com`. Usuarios y
  login viven en **Supabase** (proyecto `qezbkxhwctxllyrtnvqu`).
- **n8n propio** (flujos + correos): `https://hooks.atlantisglobalrealty.com`,
  self-hosted **v2.30.7** en el VPS.
- **Motor del CRM** (FastAPI): `https://motor.atlantisglobalrealty.com`.
- **VPS**: Hostinger, Ubuntu, IP `72.61.78.29` (`srv1191172`). Terminal web en
  hPanel o `ssh root@72.61.78.29`.
- **Repo**: `siemondigital-byte/calculadora-pro`.
  - Rama del CRM/flujos: **`claude/new-session-3rjwcr`** (clonada en el VPS
    en `/root/atlantis`; la carpeta operativa es
    `/root/atlantis/centro-de-mando`).
  - Rama de la app: `feat/reset-password`, mergeada a **`main`** (Vercel
    despliega `main`).
- **Correo**: sale por **Gmail SMTP** (`atlantisglobalrealty@gmail.com`,
  app-password; credencial en n8n llamada **"SMTP account 2"**,
  smtp.gmail.com:587 STARTTLS o :465 SSL — ya probada y conecta). Los alias
  `cicloderiqueza@`, `wealthcycle@`, `contact@` y `andrea@` (buzón real,
  Hostinger) están verificados como "Send mail as" en ese Gmail.
  - Remitentes por convención: producto ES → `cicloderiqueza@…`, producto EN
    → `wealthcycle@…`, agencia → `contact@…` (ver CLAUDE.md §7).

## 2 · Flujos involucrados (n8n)

| Flujo | Webhook | Qué hace |
|---|---|---|
| Acceso app - alta y credenciales | `POST /webhook/alta-calculadora?k=<CRON_KEY>` | crea usuario en Supabase + correo con credenciales |
| Acceso app - recuperar password (solicitar) | `POST /webhook/password-reset-request` `{email, lang}` | token propio 60 min en tabla `password_resets` (REST de Supabase) + correo con enlace a `…/reset.html?token=…&lang=…` |
| Acceso app - recuperar password (confirmar) | `POST /webhook/password-reset-confirm` `{token, password}` | consume token (un solo uso), cambia password vía Admin API + aviso de seguridad |
| Compra confirmada | `POST /webhook/compra-cicloderiqueza` | registra compra en CRM + correo de bienvenida |
| Reembolso | `POST /webhook/reembolso-cicloderiqueza` | revoca acceso + registra trazabilidad en CRM (`cicloderiqueza.reembolsos`) |

Los JSON canónicos viven en `/root/atlantis/centro-de-mando/n8n/*.json`.
La app ya llama a esos webhooks (`auth-cliente.js` en `main`).

## 3 · Estado actual (verificado)

FUNCIONA:
- La app en Vercel: vista "Recupera tu acceso" + `reset.html`, bilingüe.
- n8n → Supabase: el contenedor ve `SUPABASE_URL=https://qezbkxhwctxllyrtnvqu.supabase.co`
  y `SUPABASE_SERVICE_KEY` (service_role) desde el `.env`; el token se guarda
  bien en `password_resets` (nodo "Supabase: guardar token" en verde).
- La credencial SMTP "SMTP account 2" conecta (probada en la UI).
- La tabla `password_resets` existe (SQL ya corrido, RLS activo).

ROTO (el único bloqueo):
- **El nodo de correo de los flujos ejecuta con una credencial fantasma.**
  Error en cada ejecución: `Credential with ID "REEMPLAZAR" does not exist
  for type "smtp"`. Causa raíz: los JSON originales traían
  `credentials.smtp.id = "REEMPLAZAR"` (placeholder que nunca se sustituyó
  — error del agente anterior, ya corregido en el repo). Las **versiones
  publicadas** en n8n aún lo arrastran.
- Agravante: en n8n 2.30 la UI **no persiste** el cambio de credencial en un
  flujo publicado (se guarda en el borrador/otra versión, la publicada sigue
  igual). El usuario ya lo intentó varias veces; no insistir por la UI.

## 4 · La solución (ya preparada, un comando)

En el VPS, como root:

```bash
cd /root/atlantis && git pull --ff-only origin claude/new-session-3rjwcr && cd centro-de-mando && docker compose -f compose.compartido.yml --env-file .env up -d --build motor && bash scripts/asignar-smtp-flujos.sh
```

`scripts/asignar-smtp-flujos.sh` hace, por dentro (sin UI):
1. `n8n export:credentials` → toma el **id real** de "SMTP account 2".
2. Inyecta ese id en los nodos emailSend de los 5 flujos y los re-importa
   **por id** (reemplaza la versión que ejecuta el webhook), con la CRON_KEY
   del `.env` puesta.
3. `n8n publish:workflow` por id + reinicio del contenedor (re-registra
   webhooks — editar por CLI los des-registra; el reinicio lo arregla).
4. Dispara la prueba real: POST a `password-reset-request` con
   `siemondigital@gmail.com` y muestra el log del SMTP (`accepted`/`rejected`).

Acepta parámetros: `bash scripts/asignar-smtp-flujos.sh otro@correo.com "Nombre credencial"`.

El rebuild del motor en el mismo comando despliega la trazabilidad de
reembolsos (registro en `cicloderiqueza.reembolsos` del CRM).

## 5 · Definición de "terminado"

1. La salida del script muestra `accepted: [ 'siemondigital@gmail.com' ]`
   (o al menos ningún error) y el correo llega a esa bandeja (~1 min,
   revisar Spam) desde `cicloderiqueza@atlantisglobalrealty.com`.
2. En n8n → Executions, la ejecución nueva de "recuperar password
   (solicitar)" sale **toda en verde**.
3. Ciclo completo desde la app: `wealthcycle-app…` → "¿Olvidaste tu
   contraseña?" → correo → abrir enlace (`reset.html?token=…`) → guardar
   contraseña nueva → iniciar sesión con ella. El aviso "contraseña
   actualizada" (flujo confirmar) también debe llegar.
4. Alta de prueba (opcional): `POST /webhook/alta-calculadora?k=<CRON_KEY>`
   con `{"email":"…","nombre":"Prueba","lang":"es"}` crea el usuario en
   Supabase y envía credenciales. La CRON_KEY está en
   `/root/atlantis/centro-de-mando/.env` (NO pegarla en chats).

## 6 · Trampas conocidas (no tropezar dos veces)

- **UI de n8n 2.x + flujos publicados**: cambiar credencial desde la UI no
  llega a la versión publicada. Vía CLI: import por id → publish → restart.
- **`actualizar-flujos-acceso.sh` borra la credencial SMTP** de los nodos al
  reemplazar flujos (los JSON del repo no traen credenciales a propósito).
  Tras usarlo, correr SIEMPRE `asignar-smtp-flujos.sh`.
- **`SUPABASE_URL`** es la de la API (`https://<ref>.supabase.co`), NUNCA la
  del dashboard (`https://supabase.com/dashboard/...`). Ya quedó bien puesta;
  si se recrea el contenedor, verificar con
  `docker exec centro-de-mando-n8n-atlantis-1 printenv SUPABASE_URL`.
- **`docker compose up -d --force-recreate` sin `--env-file .env`** puede no
  aplicar variables: usar siempre `--env-file .env` desde
  `/root/atlantis/centro-de-mando`.
- El webhook responde `HTTP 200 {"ok":true}` **aunque el flujo falle después**
  en algunos modos: la verdad está en Executions, no en el curl.
- Errores `Cannot publish archived Workflow` al correr instaladores: son
  duplicados viejos archivados, inofensivos.
- Correos "a sí mismo" (`atlantisglobalrealty@gmail.com` → mismo buzón):
  Gmail los esconde de Recibidos; probar siempre con un correo externo.

## 7 · Pendientes menores (después del bloqueo)

- Restringir CORS de los 2 webhooks de reset al dominio de la app (nodo
  Webhook → Options → Allowed Origins) y rate-limit si se quiere endurecer.
- DKIM/SPF: el envío sale por Gmail; si más adelante el volumen crece,
  migrar a Brevo/Resend con dominio verificado (recomendación del handoff
  original; Gmail topa en ~500/día).
- Los flujos "Monitoreo de mercado", "Formulario web → lead", "Respaldo
  diario" y "Compra Calculadora Pro (Supabase+CRM)" ya están importados y
  activos; el de compra necesita la misma credencial SMTP (el script ya se
  la pone a "Compra confirmada"; verificar el de Supabase+CRM si se usa).
