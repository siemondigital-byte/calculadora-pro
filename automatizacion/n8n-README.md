# n8n · Automatización de compras → Supabase (Calculadora Pro)

Crea el acceso a la app cuando alguien compra, marca "gratis de por vida para los
primeros N", y revoca el acceso en reembolso. Corre **en tu backend (n8n)** con la
**service_role key** — nunca en el navegador.

## Qué hace (flujo)
```
Webhook (compra) → Normalizar (valida firma) → ¿Acción?
   ├─ compra    → Crear usuario Auth → registrar_compra ─┬→ Enviar correo
   │                                                     └→ Armar CRM → Sync CRM
   ├─ reembolso → revocar_acceso → Armar CRM → Sync CRM
   └─ ignorar   → (nada)
```
El *Sync CRM* corre en paralelo (no bloquea el correo) y con `onError: continue`,
así que un CRM caído nunca rompe el alta de la compra.

## Requisitos previos
1. Ya corriste `supabase-schema.sql` **y** `supabase-rpc.sql` en Supabase.
2. En n8n, define las **variables de entorno** (Settings → Variables o env):
   - `SUPABASE_URL` = `https://TU-PROYECTO.supabase.co`
   - `SUPABASE_SERVICE_KEY` = la **service_role** key (Project Settings → API). *Secreta.*
   - **(Opcionales) Validación de firma del checkout** — si las defines, el nodo
     *Normalizar* rechaza webhooks con firma inválida (accion → `ignorar`); si no,
     no valida (compatible con lo anterior):
     - `HOTMART_HOTTOK` = el *hottok* de tu webhook de Hotmart.
     - `THRIVECART_SECRET` = el *shared secret* de ThriveCart (Settings → Webhooks & API).
     - `CLICKBANK_SECRET` = tu secret de ClickBank *(placeholder: implementa el algoritmo
       exacto de `cverify` de tu cuenta en el nodo si lo activas; por defecto no bloquea)*.
   - **(Opcionales) Sincronización con el CRM (Centro de Mando)**:
     - `CRM_WEBHOOK_URL` = URL del webhook de entrada de tu CRM. Si está vacío, el nodo
       *Sync CRM* no hace nada (el alta de compra sigue igual).
     - `CRM_WEBHOOK_TOKEN` = token Bearer opcional para autenticar contra el CRM.

## Instalar
1. n8n → **Workflows → Import from File** → `n8n-compra-crd.json`.
2. Abre el nodo **Webhook Compra** → copia su URL de producción.
3. Pega esa URL como webhook/postback en tu plataforma:
   - **Hotmart**: Herramientas → Webhook (eventos: compra aprobada, reembolso, chargeback).
   - **ClickBank**: Account → Advanced Tools → Instant Notification URL (INS).
   - **ThriveCart**: Settings → Webhooks & API.
4. Activa el workflow.

## Ajustes que quizás toques
- **Mapeo de campos** (nodo *Normalizar*): trae lógica para Hotmart / ClickBank /
  ThriveCart. Si tu payload difiere, ajusta las rutas de `email`, `nombre`, `evento`.
- **Cupo "primeros N"** (nodo *registrar_compra*): cambia `p_cupo: 500` al número real.
- **Correo** (nodo *Enviar correo (conecta tu mail)*): reemplázalo por tu nodo de correo
  con la plantilla que ya tienes (`Mail Compra`). Pásale:
  - usuario: `{{ $('Normalizar').item.json.email }}`
  - contraseña: `{{ $('Normalizar').item.json.password }}`
  - `appUrl`, `membersUrl`, `downloadsUrl` según tu despliegue.
  > La contraseña se genera en *Normalizar* (`password`) y es la MISMA que se crea en
  > Auth, así que el correo y el login coinciden.

## Detalle de los nodos HTTP
- **Crear usuario Auth** → `POST {SUPABASE_URL}/auth/v1/admin/users`
  body: `{ email, password, email_confirm:true, user_metadata:{nombre} }`.
  El trigger de la BD crea la fila en `usuarios` automáticamente.
- **registrar_compra** → `POST {SUPABASE_URL}/rest/v1/rpc/registrar_compra`
  body: `{ p_uid: <id del usuario>, p_plataforma, p_cupo }`. Marca fecha, plataforma,
  `acceso_activo=true` y `acceso_vitalicio` = (compradores previos < cupo), atómico.
- **revocar_acceso** → `POST {SUPABASE_URL}/rest/v1/rpc/revocar_acceso`
  body: `{ p_email }`. Pone `acceso_activo=false` → la app bloquea al reentrar.

Todos llevan cabeceras `apikey` y `Authorization: Bearer` con `SUPABASE_SERVICE_KEY`.

## Conectar con el CRM (Centro de Mando)
Cada compra/reembolso puede empujarse al CRM para unir **compradores de la app ↔
leads del CRM**. Define `CRM_WEBHOOK_URL` (y opcional `CRM_WEBHOOK_TOKEN`) y el nodo
*Sync CRM* hace un `POST` con este payload JSON:

```json
{
  "source": "calculadora",
  "lead_source": "Compra hotmart",
  "email": "comprador@correo.com",
  "nombre": "Nombre Apellido",
  "plataforma": "hotmart",
  "evento": "compra",            // "compra" | "reembolso"
  "acceso_activo": true,          // false en reembolso
  "idioma": "es",
  "fecha": "2026-01-01T12:00:00.000Z"
}
```
En el CRM, crea un webhook de entrada que haga *upsert* del lead por `email` con
`lead_source` = "Prospección"/"Compra …" según tu convención, y que ponga el estado
en *cliente* (o *reembolsado* si `acceso_activo=false`). Si tu CRM espera otros
nombres de campo, ajusta el nodo *Armar CRM* (mapeo) sin tocar el resto del flujo.

## Embajadores
Los embajadores usan el **login universal del Área de Miembros** para el contenido de
cortesía (ya cubierto en tus correos), pero también reciben **acceso a la app**. Para
eso, duplica este workflow con un Webhook aparte (o una rama por `plataforma='embajador'`)
que solo hace *Crear usuario Auth* + *registrar_compra* (sin cobrar), o crea el usuario
manualmente en Supabase → Authentication → Add user.

## Seguridad
- La `service_role` key **solo** vive en n8n (variables de entorno). Nunca en el repo,
  el navegador o `config.js`.
- La validación de firma **ya viene integrada** en *Normalizar* para Hotmart (`hottok`)
  y ThriveCart (shared secret): define `HOTMART_HOTTOK` / `THRIVECART_SECRET` y los
  webhooks con firma inválida se ignoran. ClickBank queda como placeholder (implementa
  el `cverify` exacto de tu cuenta si lo activas).
- `CRM_WEBHOOK_URL` / `CRM_WEBHOOK_TOKEN` son secretos de integración: viven solo en n8n.

## Archivos
- `supabase-rpc.sql` — funciones `registrar_compra`, `revocar_acceso`, `contar_compradores`.
- `n8n-compra-crd.json` — el workflow importable (n8n 1.x; si al importar pide otra
  versión de nodo, acéptala — la lógica no cambia).
