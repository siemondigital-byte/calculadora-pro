# Guía paso a paso — VPS, DNS y despliegue del Centro de Mando

> Para quien lo hace por primera vez. Tiempo total: ~30 minutos (más la espera
> del DNS). Al final tendrás el CRM en vivo en `crm.atlantisglobalrealty.com`.

---

## Parte 1 · Contratar el VPS (10 min)

1. Entra a **hostinger.com** → sección **VPS**.
2. Elige el plan **KVM 2** (2 vCPU / 8 GB RAM) — recomendado porque el stack
   corre motor + web + n8n + (luego) Postiz y Umami. El KVM 1 (4 GB) alcanza
   para empezar, pero quedará justo al agregar Postiz.
3. Al configurarlo:
   - **Ubicación:** el data center más cercano a tu público (EE. UU. para LATAM
     suele ir bien).
   - **Sistema operativo:** elige **"OS con panel" NO** — selecciona
     **Ubuntu 24.04 LTS limpio** (sin panel). Docker hace todo.
   - **Contraseña root:** créala y guárdala en tu gestor de contraseñas.
4. Espera a que aparezca "Running" en el panel del VPS.
5. Copia la **IP del VPS** (algo como `147.93.x.x`) — la usarás en la Parte 2.

## Parte 2 · DNS (5 min + espera de propagación)

En el panel donde administras el dominio `atlantisglobalrealty.com`
(hPanel → Dominios → DNS / Nameservers si el dominio está en Hostinger):

1. Crea **3 registros tipo A**, todos apuntando a la IP del VPS:

   | Tipo | Nombre | Contenido | TTL |
   |---|---|---|---|
   | A | `crm` | IP del VPS | 300 |
   | A | `motor` | IP del VPS | 300 |
   | A | `hooks` | IP del VPS | 300 |

2. **No toques** los registros existentes (el `@`, `www`, MX de correo, ni los
   subdominios `cicloderiqueza`/`wealthcycle` — esos siguen donde están).
3. Espera 5–30 min. Verifica en https://dnschecker.org buscando
   `crm.atlantisglobalrealty.com`: debe mostrar la IP del VPS.

> ⚠️ Este paso debe estar listo ANTES del despliegue: los certificados TLS se
> emiten automáticamente y solo funcionan si el dominio ya apunta al VPS.

## Parte 3 · Despliegue (10 min, un comando)

1. En hPanel → tu VPS → botón **"Terminal del navegador"** (o entra por SSH:
   `ssh root@IP-DEL-VPS` con la contraseña de la Parte 1).
2. Pega estos dos comandos (uno por uno):

   ```bash
   git clone --branch claude/new-session-3rjwcr https://github.com/siemondigital-byte/calculadora-pro.git /root/atlantis
   ```
   > Si el repo es privado, GitHub pedirá usuario y un **Personal Access Token**
   > (github.com → Settings → Developer settings → Tokens → Generate, con
   > permiso `repo`). El token se usa como contraseña.

   ```bash
   bash /root/atlantis/centro-de-mando/scripts/bootstrap-vps.sh
   ```

3. El script hace todo solo: instala Docker, genera las claves (CRM, cron,
   tokens, push), construye el motor y la web, levanta n8n y Caddy (TLS
   automático) y corre el checklist de verificación.
4. **IMPORTANTE:** el script imprime una línea así:
   ```
   CLAVE DE ACCESO AL CRM (guardala y rotala luego desde Accesos):
   Xk3jf9dKw2mQp7Lz
   ```
   Guárdala: es tu contraseña para entrar al CRM.

## Parte 4 · Verificación (5 min)

1. Abre **https://crm.atlantisglobalrealty.com** → debe salir la pantalla de
   login negra con el logo dorado. Entra con la clave del paso anterior.
2. Crea un lead de prueba en Leads, recarga la página y confirma que sigue ahí.
3. Abre **https://motor.atlantisglobalrealty.com** → debe responder
   `{"ok":true,"servicio":"centro-de-mando-atlantis"}`.
4. Si algo no responde: en la terminal del VPS,
   `cd /root/atlantis/centro-de-mando && docker compose logs --tail 50`.

## Parte 5 · Activaciones post-despliegue (cuando puedas)

En orden de impacto:

1. **ANTHROPIC_API_KEY** (activa toda la IA: nurturing, contenido, asistente,
   soluciones SEO): consíguela en console.anthropic.com → API Keys, y en el VPS:
   ```bash
   nano /root/atlantis/centro-de-mando/.env     # pegar en ANTHROPIC_API_KEY=
   cd /root/atlantis/centro-de-mando && docker compose up -d motor
   ```
2. **Buzón de correo:** crea `hello@atlantisglobalrealty.com` en tu proveedor de
   correo y agrégalo en el CRM → Accesos → Buzones ("Guardar y probar conexión").
   Revisa que el dominio tenga SPF/DKIM/DMARC (en Hostinger correo vienen solos).
3. **n8n** (crons y webhooks): entra a https://hooks.atlantisglobalrealty.com,
   crea tu cuenta de administrador, e importa los flujos de
   `centro-de-mando/n8n/` (Workflows → Import from File). En cada nodo "Motor"
   reemplaza `REEMPLAZAR_CRON_KEY` por el valor de `CRON_KEY` que está en
   `/root/atlantis/centro-de-mando/.env`, y activa cada workflow.
4. **Claves por el vault** (CRM → Accesos, nunca por chat): `YOUTUBE_API_KEY`
   (prospección de embajadores), `FB_PIXEL_ID` + `FB_CAPI_TOKEN` (medición),
   `FAL_API_KEY` (imágenes/video IA), `SERPER_API_KEY` (competencia).
5. **FTP del hosting web** (para que el Maquetador publique la web pública): en
   el `.env` del VPS agrega `FTP_HOST`, `FTP_USER`, `FTP_PASS` (los datos FTP
   del hosting donde vive atlantisglobalrealty.com) y `docker compose up -d motor`.
6. **Plataformas de venta** (Hotmart/ClickBank/ThriveCart): apunta sus webhooks
   de compra y reembolso a las URLs de los flujos n8n importados.

## Problemas comunes

| Síntoma | Causa | Arreglo |
|---|---|---|
| El navegador dice "no seguro" / no carga | DNS aún no propagado cuando arrancó Caddy | Espera al DNS y `docker compose restart caddy` |
| Login del CRM da error | Clave equivocada | La clave está en `/root/atlantis/centro-de-mando/.env` (CRM_PASSWORD) |
| "no space left on device" | Disco lleno de imágenes viejas | `docker system prune -af` |
| Un fix de la web "no se ve" | Caché del service worker | Cierra POR COMPLETO la pestaña/app del CRM y ábrela una vez |
| Los flujos n8n dan 401 | Falta reemplazar el placeholder | Pon la `CRON_KEY` real en los nodos "Motor" |
