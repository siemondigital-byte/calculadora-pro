# n8n · Automatización de compras → Supabase (Calculadora Pro)

Crea el acceso a la app cuando alguien compra, marca "gratis de por vida para los
primeros N", y revoca el acceso en reembolso. Corre **en tu backend (n8n)** con la
**service_role key** — nunca en el navegador.

## Qué hace (flujo)
```
Webhook (compra) → Normalizar → ¿Acción?
   ├─ compra    → Crear usuario Auth → registrar_compra → Enviar correo
   ├─ reembolso → revocar_acceso
   └─ ignorar   → (nada)
```

## Requisitos previos
1. Ya corriste `supabase-schema.sql` **y** `supabase-rpc.sql` en Supabase.
2. En n8n, define dos **variables de entorno** (Settings → Variables o env):
   - `SUPABASE_URL` = `https://TU-PROYECTO.supabase.co`
   - `SUPABASE_SERVICE_KEY` = la **service_role** key (Project Settings → API). *Secreta.*

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

## Embajadores
Los embajadores usan el **login universal del Área de Miembros** para el contenido de
cortesía (ya cubierto en tus correos), pero también reciben **acceso a la app**. Para
eso, duplica este workflow con un Webhook aparte (o una rama por `plataforma='embajador'`)
que solo hace *Crear usuario Auth* + *registrar_compra* (sin cobrar), o crea el usuario
manualmente en Supabase → Authentication → Add user.

## Seguridad
- La `service_role` key **solo** vive en n8n (variables de entorno). Nunca en el repo,
  el navegador o `config.js`.
- El webhook debería validar la firma/secreto de la plataforma (Hotmart *hottok*,
  ClickBank secret key) antes de actuar — agrégalo en *Normalizar* si tu plataforma lo
  provee.

## Archivos
- `supabase-rpc.sql` — funciones `registrar_compra`, `revocar_acceso`, `contar_compradores`.
- `n8n-compra-crd.json` — el workflow importable (n8n 1.x; si al importar pide otra
  versión de nodo, acéptala — la lógica no cambia).
