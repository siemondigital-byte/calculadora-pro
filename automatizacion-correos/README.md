# Automatizacion de Correos · Kit (skill)

Sistema de correo automatizado para un negocio: nurturing multi-campana, prospeccion en frio, seguimiento
post-interaccion, tracking (aperturas/clics/rebotes/respuestas), entregabilidad (SPF/DKIM/DMARC, topes,
espaciado), aprobacion humana y baja con un clic, en la voz de la marca. Basado en el Centro de Mando de
Siemon Digital; aqui se reusa para OTRO negocio (preset: Atlantis Global Realty, inmobiliaria).

## Archivos
1. **.claude/skills/automatizacion-correos/SKILL.md** — la skill completa (arquitectura, modelo de datos, endpoints, guardarrailes, orden de montaje).
2. **config.example.json** — preset del negocio (marca/voz, envio, entregabilidad, secuencias). Copiar a `config.json`.
3. **PROMPTS.md** — prompts listos para pegar (montar el sistema, redactar secuencias, cadencia, frio, entregabilidad).

## Como usarlo (en el proyecto de Atlantis)
1. Descomprime este kit en la raiz del proyecto de Atlantis (crea la carpeta `.claude/skills/...`).
2. Abre Claude Code ahi y pega el **Prompt 1** de PROMPTS.md.
3. El agente monta el sistema por partes; tu apruebas cada correo antes de activarlo.

## Requisitos honestos
- Un **dominio de envio** (idealmente subdominio, ej. `envios.atlantisglobalrealty.com`) con acceso al DNS para SPF/DKIM/DMARC.
- Un **proveedor SMTP/IMAP** (o buzon con esas capacidades). Las claves van al vault del motor, no al codigo.
- Un **motor/backend** donde vivan los endpoints y **n8n** (o equivalente) para el cron horario.
- **Warm-up**: empezar con pocos correos/dia y subir gradual; verificar con mail-tester.

## Guardarrailes (no negociables)
- Baja con un clic SIEMPRE y honrarla al instante. Solo permiso (nada de listas compradas). Topes y espaciado.
- Secretos fuera del codigo. Voz de marca, sin urgencia agresiva ni promesas de rentabilidad.
- No publicar este kit en repos publicos: contiene la receta de tu operacion.
