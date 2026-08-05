# Handoff n8n — para el agente con acceso a la instancia

La app (calculadora + Supabase) ya está **live en `main`**. Falta solo montar los
correos/recuperación en n8n y conectar 2 URLs. Todo lo de la app queda hecho.

## Contexto
- n8n: `https://hooks.atlantisglobalrealty.com`
- Supabase: `https://qezbkxhwctxllyrtnvqu.supabase.co` (Publishable key ya en `config.js`; la **Secret key** solo va en n8n).
- Rama con la parte de cliente lista: **`feat/reset-password`** (sin mergear todavía).

## Lo que hay que hacer en n8n (3 workflows en esta carpeta)
1. `n8n-compra-crd.json` — compra → crea usuario + contraseña (crypto) → **correo de bienvenida** (plantilla 01) → reembolso revoca.
2. `n8n-reset-solicitar-crd.json` — genera token (tabla `password_resets`) + envía enlace.
3. `n8n-reset-confirmar-crd.json` — valida token + cambia contraseña en Supabase.

### Credenciales que usan (crear en n8n y asignar por tipo)
- **Supabase API** (Host + Secret key) → nodos `httpRequest` con `nodeCredentialType: supabaseApi`.
- **SMTP** (Brevo/Resend, dominio verificado con SPF/DKIM) → nodos `emailSend`.
- **Postgres** (datos de Supabase → Project Settings → Database) → nodos `postgres`.

### Pasos
1. Corre `../password-resets.sql` en el SQL Editor de Supabase (tabla de tokens).
2. Crea las 3 credenciales; en cada nodo reemplaza el id `REEMPLAZA_AL_IMPORTAR`.
3. Crea los workflows (por API o import) y **actívalos**.
4. En n8n, restringe CORS del webhook a `https://siemondigital-byte.github.io` (ya viene puesto en el JSON).
5. Verifica `NODE_FUNCTION_ALLOW_BUILTIN=crypto` (para la contraseña segura; hay fallback si no).

## El ÚNICO cambio que queda en el código
Copia las **Production URL** de los 2 webhooks de reset y ponlas en
`auth-cliente.js` → `CONFIG` (raíz del repo):

```js
export const CONFIG = {
  RESET_REQUEST_URL: "https://hooks.atlantisglobalrealty.com/webhook/crd-reset-solicitar",
  RESET_CONFIRM_URL: "https://hooks.atlantisglobalrealty.com/webhook/crd-reset-confirmar",
  APP: "calculadora",
};
```
(Ajusta el host/prefijo `/webhook/` al que muestre tu n8n.)

## Cerrar
Con las URLs puestas, **mergea `feat/reset-password` a `main`**. GitHub Pages
redepliega y queda: login real + alta por compra + "olvidé mi contraseña" de
punta a punta. Antes de mergear, el enlace de reset responde "no se pudo enviar"
(por eso no se mergea hasta tener las URLs).

## Prueba final
1. Compra de prueba → llega correo con contraseña → entra.
2. Login → "¿Olvidaste tu contraseña?" → correo → `reset.html?token=…` → nueva contraseña → entra.
3. Reabrir el mismo enlace → debe fallar (un solo uso).
