# Correos + recuperación de contraseña (n8n + Supabase)

Adaptación del handoff a la Calculadora. Correos por **n8n + SMTP** (no los de
Supabase). El reset usa **token propio** (no el PKCE de Supabase, que falla si el
usuario abre el correo en otro dispositivo).

## Qué se entregó (rama `feat/reset-password`)
- `reset.html` — página "nueva contraseña" (marca Atlantis).
- `auth-cliente.js` — cliente del navegador (pedir / confirmar reset).
- `index.html` — enlace "¿Olvidaste tu contraseña?" ya cableado.
- `automatizacion/n8n-reset-solicitar-crd.json` — genera token + envía enlace.
- `automatizacion/n8n-reset-confirmar-crd.json` — valida token + cambia contraseña.
- `password-resets.sql` — tabla de tokens (60 min, un solo uso).

---

## Montaje (una vez)

### 1 · Proveedor SMTP — **Brevo** (300/día gratis) o **Resend** (3.000/mes)
No uses Gmail ni el SMTP del hosting (el handoff lo probó: no entregan bien).
Verifica tu dominio (SPF + DKIM) en el proveedor → así el correo llega y no cae en spam.
> Si "sale bien" pero no llega: revisa que el dominio tenga `v=spf1 include:_spf.TU-PROVEEDOR.com ~all`.

### 2 · Credenciales en n8n (3)
- **SMTP** (tipo `SMTP`): host/port/user/password del proveedor. Sender: `Ciclo de Riqueza <no-reply@TU-DOMINIO>`.
- **Supabase API** (ya la tienes: `Supabase Atlantis (service)`).
- **Postgres** (para la tabla de tokens): datos de **Project Settings → Database** de Supabase
  (host, puerto 5432, base `postgres`, user `postgres`, y la **contraseña de la base** que pusiste al crear el proyecto).

### 3 · Tabla de tokens
Supabase → **SQL Editor** → pega `password-resets.sql` → **Run**.

### 4 · Importar los 2 workflows
- Import from File → cada `n8n-reset-*-crd.json`.
- En cada nodo asigna las credenciales (Supabase API donde dice `REEMPLAZA_AL_IMPORTAR`, Postgres, SMTP).
- Revisa el **sender** del nodo *Enviar correo* (que coincida con tu dominio verificado).
- **Actívalos**.
- (CORS ya viene restringido a `https://siemondigital-byte.github.io`.)

### 5 · Conectar el cliente
- Copia la **URL de producción** de cada webhook (nodo Webhook → Production URL):
  - `.../webhook/crd-reset-solicitar`
  - `.../webhook/crd-reset-confirmar`
- Ponlas en `auth-cliente.js` → `CONFIG.RESET_REQUEST_URL` y `RESET_CONFIRM_URL`
  (reemplaza `TU-N8N.example.com`). Commit.

### 6 · Mergear
Solo **después** del paso 5, mergea `feat/reset-password` a `main`. Si mergeas antes,
el enlace del login responde "no se pudo enviar".

### 7 · Probar de punta a punta
Login → "¿Olvidaste tu contraseña?" → llega el correo → botón abre `reset.html?token=…`
→ requisitos en verde → Guardar → entra con la nueva. Reabrir el mismo enlace → debe fallar (un solo uso).

---

## Correo de bienvenida (alta por compra)
El workflow de compra (`n8n-compra-crd.json`) ya crea la cuenta y genera contraseña;
falta conectar el nodo de correo con la plantilla de bienvenida (`01-bienvenida…`).
Cuando elijas el proveedor SMTP te dejo ese nodo cableado también.

> **Mejora recomendada del handoff:** cambiar la generación de contraseña de
> `Math.random()` a `crypto` (más segura, sin caracteres ambiguos). Ver
> `password-policy.md` del handoff — lo aplico cuando montemos el correo de alta.
