---
name: automatizacion-correos
description: >
  Sistema completo de automatizacion de correo para un negocio: secuencias de nurturing multi-campana,
  prospeccion en frio (multi-toque), seguimiento post-interaccion, tracking (aperturas, clics, rebotes,
  respuestas), entregabilidad (SPF/DKIM/DMARC, topes y espaciado), aprobacion humana y baja con un clic,
  todo en la VOZ DE LA MARCA y orquestado desde un motor (backend) + n8n. Product-agnostic por config.json.
  Construido a partir del Centro de Mando de Siemon Digital; aqui se reusa para OTRO negocio (ej. una
  agencia inmobiliaria) adaptando la config.
---

# Skill: Automatizacion de Correos (nurturing + prospeccion + tracking)

## Cuando usarla
Para montar (o replicar) un sistema de correo que: capta un lead, lo inscribe en una secuencia
automatica en la voz de la marca, hace seguimiento en frio a prospectos, mide todo (aperturas, clics,
rebotes, respuestas), respeta la entregabilidad y la ley (baja con un clic), y deja que un humano
apruebe antes de enviar. No es un "enviador de spam": es acompanamiento con permiso, medible y con marca.

## Config (marca, envio, negocio) — `config.json`
Copia `config.example.json` a `config.json` y ajusta. Campos clave:
- `marca`: nombre, voz (tono, lexico, reglas), firma, colores, dominio.
- `envio`: `remitente`, `smtp` (host/puerto/usuario), `imap` (host/puerto), `dominio_envio`, `responder_a`.
  (Las claves NO van aqui: van en el vault de secretos del motor.)
- `entregabilidad`: `tope_diario`, `espaciado_min` (minutos entre envios), `warmup`.
- `negocio`: ICP, ofertas/lead-magnets, y los TEMAS de las secuencias (para inmobiliaria: compradores,
  vendedores, inversionistas, post-visita).
- `tracking`: `pixel` on/off, `utm` on/off.
- `n8n`: url + si se dispara el procesador por cron.

## Arquitectura (no cambiar el orden de montaje)
1. **Entregabilidad PRIMERO** (sin esto, todo cae en spam). En el DNS del dominio de envio:
   - **SPF** (TXT): autoriza el servidor/SMTP que envia.
   - **DKIM** (TXT): firma criptografica de cada correo (la da el proveedor SMTP).
   - **DMARC** (TXT `_dmarc`): politica (empieza en `p=none` para observar, sube a `quarantine`).
   - Usa un **subdominio de envio** dedicado (ej. `envios.tudominio.com`) para no arriesgar el dominio
     principal. **Warm-up**: pocos correos/dia al inicio, sube gradual. HTML sobrio (sin imagenes pesadas
     ni exceso de links), version texto, y SIEMPRE enlace de baja. Verifica con mail-tester antes de escalar.
2. **Motor (backend) + modelo de datos.** Una estructura de campanas (ver abajo). Endpoints:
   - `POST /nurturing/generar` — la IA redacta la secuencia de una campana en la voz de la marca.
   - `POST /nurturing/procesar` — envia lo que esta VENCIDO segun la cadencia (respeta tope y espaciado).
   - `GET  /nurturing/px` — pixel de apertura (1x1 gif) que marca "abrio".
   - `GET  /nurturing/r` — redireccion de clics (cuenta el clic y manda al destino con UTM).
   - `GET  /nurturing/baja` — baja con un clic (token HMAC firmado, sin login).
   - `POST /nurturing/sincronizar` — lee el buzon por IMAP y SACA de la secuencia a quien respondio.
   - `POST /enviar_correo` / `POST /leer_correos` — envio manual y lectura IMAP (Enviados, rebotes).
3. **n8n cron.** Un flujo horario que llama `/nurturing/procesar` (con una clave CRON) para que la
   secuencia avance sola. Otro (o el mismo) llama `/nurturing/sincronizar` para detectar respuestas/rebotes.
4. **Aprobacion humana.** Nada se envia sin que la persona apruebe: la IA redacta -> humano revisa/edita en
   el CRM -> se activa la campana. La cadencia (horas por paso) es EDITABLE.
5. **Captacion (lead intake).** Formularios web -> n8n -> alta del lead en el CRM con `source`/UTM, e
   inscripcion automatica en la campana que corresponda por su disparador.

## Modelo de datos (campanas)
```
nurturing = { campanas: [{
  id, nombre, activa, autoInscribir,
  disparador: {tipo, valor, desc},        // quien ENTRA (ej. "descargo la guia", "visito propiedad")
  premisa: "contexto que la IA NUNCA contradice",
  config: {persona, oferta, lead_magnet, pautas, remitente},
  pasos:    [{id, fase, nombre, objetivo}],   // guion canonico
  cadencia: {paso_id: HORAS_desde_que_entra}, // editable por la persona
  secuencia:[{id, fase, nombre, asunto, cuerpo}], // lo redactado (aprobado)
  inscritos:{email: {inicio, paso, ultimoEnvio, estado, nombre}},
  metricas: {paso_id: {enviados, aperturas, clics}, bajas: n}
}]}
```
Reglas del motor de envio (`pendientes_de`): por cada inscrito activo, si `ahora >= inicio + cadencia[paso]`
y no se ha enviado ese paso, encolar. Aplicar **tope diario** y **espaciado** global. Marcar `ultimoEnvio`
y avanzar `paso`. Nunca reenviar un paso ya enviado.

## Salida de la secuencia (critico)
Sacar al inscrito (estado `convertido`/`respondio`) cuando: (a) RESPONDE el correo (lo detecta
`/nurturing/sincronizar` via IMAP, casando el remitente con un inscrito), (b) agenda/compra (form o webhook),
(c) se da de BAJA. Nunca seguir escribiendo a quien ya respondio: se siente robotico y quema la relacion.

## Prospeccion en frio + seguimiento post-interaccion
- **Frio multi-toque**: 3 toques espaciados a un prospecto que NO ha interactuado; cada toque NOMBRA el
  problema/oportunidad, aporta valor y baja la friccion; el 3ro es un cierre suave. Para/reduce si abre o responde.
- **Post-interaccion**: cuando alguien interactua (abre, hace clic, visita una propiedad, agenda), dispara
  un seguimiento parametrizable (plantillas por tipo de interaccion).

## Tracking y metricas
- **Apertura**: pixel `/px?c=<campana>&p=<paso>&e=<hashEmail>` (1x1 gif) al final del HTML.
- **Clic**: todos los links pasan por `/r?...&u=<destino>` (cuenta y redirige, agrega UTM).
- **Rebotes**: lectura IMAP de la bandeja (mensajes "Mail Delivery"/"Undelivered") -> marca el email como rebotado.
- **Enviados**: sube una copia a la carpeta IMAP "Enviados" para que la persona lo vea en su cliente de correo.
- **Respuestas**: IMAP casa el remitente con un inscrito -> lo saca de la secuencia y avisa.

## Marca y aprobacion
- Toda la redaccion en la VOZ de `config.marca.voz` (tono, lexico, reglas). Firma de marca al pie, con
  espacio configurable. Newsletter con plantilla de marca. La persona SIEMPRE aprueba/edita antes de activar.

## Guardarrailes (legales y de reputacion)
- **Baja con un clic SIEMPRE** (token HMAC, sin login) y honrarla al instante.
- **Solo permiso**: no comprar listas ni enviar a quien no opto o no tiene relacion legitima. En frio, valor
  real y contexto (por que le escribes), nunca spam masivo.
- **Topes y espaciado** para no quemar el dominio; warm-up al inicio.
- **Nada de urgencia agresiva ni promesas magicas**; afirmativo, humano, con la voz de la marca.
- **Secretos** (SMTP/IMAP/DKIM) en el vault del motor, NUNCA en el codigo ni en la config en claro.

## Integracion con el CRM
Modulo "Nurturing" (campanas, cadencia editable, metricas por paso, inscritos, bajas) + modulo "Correo en
frio" (prospectos, toques, seguimientos) + registro de "Enviados" y "Revisar bandeja" (rebotes/respuestas).

## Build order
1. Config con la marca/voz + envio + negocio del cliente (para Atlantis: inmobiliaria).
2. Entregabilidad (SPF/DKIM/DMARC + subdominio + warm-up). Verificar con mail-tester.
3. Motor: modelo de campanas + endpoints (generar/procesar/px/r/baja/sincronizar/enviar/leer).
4. n8n: cron horario -> /procesar y /sincronizar (con CRON_KEY).
5. UI en el CRM: Nurturing + Correo en frio + Enviados/Bandeja.
6. Secuencias base del negocio (aprobadas) + captacion (formularios -> alta + auto-inscripcion).

## Pruebas minimas
- Un lead entra por formulario -> se inscribe -> recibe el paso 1 a la hora correcta.
- Abrir el correo marca apertura; un clic cuenta y redirige; la baja saca al instante.
- Responder saca de la secuencia (no llegan mas correos).
- Un rebote se marca; los envios quedan en "Enviados".
- Nada se envio sin aprobacion; se respetaron tope y espaciado.
