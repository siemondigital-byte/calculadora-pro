# HANDOFF · Alimentar el RAG de ATLANTIS con lo que sabe tu ventana de contexto

**Para:** los agentes creadores del ecosistema Atlantis — el que construyó el **Centro de Mando**
(`/root/atlantis/centro-de-mando`, motor FastAPI + web PWA) y el que construyó el **aplicativo**
(Calculadora Pro, repo `ciclo-calculadora-pro`).
**Pedido de Andrea (2026-08-01):** lo que cada uno aprendió construyendo NO puede morir en su
ventana de contexto. Se destila y se ingiere al RAG de Atlantis, que YA está en vivo.

## El RAG de Atlantis (ya funciona — solo hay que alimentarlo)

- Colección `atlantis` en el Qdrant del VPS, embeddings Voyage, búsqueda híbrida.
- **Cómo ingerir:** `POST https://motor.atlantisglobalrealty.com/rag/aprender` con
  `Authorization: Bearer <clave del CRM o CRON_KEY>` y body `{"texto": "...", "tipo": "decision|voz|trampa|negocio|estado"}`.
  También desde la UI: CRM → **Base de conocimiento** → "Enséñale algo" o "Subir documento";
  y las conversaciones exportadas de Claude van en su pestaña **Conversaciones Claude**.
- Todo lo ingerido alimenta de inmediato lo que el sistema genera (contenido, ads, propuestas,
  ideas) vía `_memoria_marca`.

## La regla

**Al final de cada sesión de trabajo (y tras cada decisión o arreglo importante), destila tu
contexto e ingiérelo.** La ventana es memoria de corto plazo; el RAG es la memoria del negocio.
Caso real: este RAG estuvo semanas implementado con solo 2 fragmentos — vivo pero muerto de
hambre. Un RAG vale lo que se le da de comer.

## Qué destilar (en orden de valor)

1. **Decisiones de Andrea y su porqué** ("se decidió X y no Y porque Z").
2. **Correcciones de voz** — cada texto generado que Andrea reescribió: antes → después → regla.
   (Recuerda la voz de Atlantis: banca privada sobria, anti-guru, sin em dashes, '44 USD',
   riesgos nombrados, disclaimers educativos.)
3. **Hechos del negocio que no están en el código**: condiciones de proyectos, el DEAL VARIABLE
   con embajadores (comisión negociable / pago fijo / colaboración), políticas, procesos.
4. **Trampas resueltas** (síntoma → causa → arreglo → prevención). Si costó >30 min, se ingiere.
   El que hizo el CRM: sus lecciones de motor/web/deploy (p.ej. deploy SIEMPRE con
   `compose.compartido.yml`). El que hizo la Calculadora Pro: auth, gating vitalicio,
   revocación por reembolso, integración con `/app/validar`, despliegues.
5. **Estado del sistema**: qué quedó desplegado, qué a medias, siguiente paso.

## Qué NO ingerir (innegociable)

- Secretos (claves, tokens, contraseñas) — JAMÁS.
- PII de compradores/leads (emails, teléfonos, nombres con datos sensibles). Patrones sí,
  datos personales no.
- Ruido sin destilar (logs crudos, intentos fallidos sin lección).

## Formato

Documentos cortos y autocontenidos (300-1500 caracteres), UNO por tema. Si ingieres por el
endpoint, empieza el texto con un título en la primera línea (`# tema`) — mejora el mapa y la
búsqueda. Re-ingerir el mismo tema actualiza el conocimiento; sé consistente con los títulos.

## Ritual de cierre de sesión (checklist)

- [ ] Decisiones de Andrea → `tipo: decision`
- [ ] Correcciones de lo generado → `tipo: voz`
- [ ] Hechos nuevos del negocio → `tipo: negocio`
- [ ] Trampas que costaron tiempo → `tipo: trampa`
- [ ] Estado y siguiente paso → `tipo: estado`
- [ ] Verificar EN VIVO: CRM → Base de conocimiento → preguntar por lo recién ingerido y
      confirmar que aparece (o `POST /rag/buscar {"q": "..."}`).
