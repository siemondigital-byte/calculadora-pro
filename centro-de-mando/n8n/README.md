# Flujos de n8n — Centro de Mando Atlantis

Plantillas para importar en `hooks.atlantisglobalrealty.com` (n8n → Workflows →
Import from file). Después de importar, en cada nodo "Motor" reemplaza
`REEMPLAZAR_CRON_KEY` por la `CRON_KEY` del `.env` del VPS (los nodos usan la
CRON_KEY estable, no la clave de login: rotar la clave no los rompe).

| Flujo | Archivo | Dispara |
|---|---|---|
| Compra confirmada | `compra-confirmada.json` | Webhook de Hotmart/ClickBank/ThriveCart → `/compra/registrar` → correo de bienvenida con credenciales de la Calculadora Pro |
| Reembolso | `reembolso.json` | Webhook de reembolso → `/compra/reembolso` (revoca app y bonos) |

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
