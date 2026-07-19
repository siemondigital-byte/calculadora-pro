# Atlantis Global Realty — Calculadora Pro + Centro de Mando

Mapa del repositorio (rama de trabajo: `claude/new-session-3rjwcr`).

## ¿Dónde está cada cosa?

| Qué buscas | Dónde está |
|---|---|
| **Guía de despliegue VPS/DNS paso a paso** | [`docs/guia-vps-dns-despliegue.md`](docs/guia-vps-dns-despliegue.md) |
| **Plan maestro del proyecto** (fases, decisiones, pendientes) | [`docs/plan-centro-de-mando-atlantis.md`](docs/plan-centro-de-mando-atlantis.md) |
| **Centro de Mando** (CRM completo: motor + web + infra) | [`centro-de-mando/`](centro-de-mando/) — su [`README`](centro-de-mando/README.md) |
| **Flujos de n8n** listos para importar + cómo conectarlos | [`centro-de-mando/n8n/README.md`](centro-de-mando/n8n/README.md) |
| **Scripts de despliegue** (VPS propio / VPS compartido) | [`centro-de-mando/scripts/`](centro-de-mando/scripts/) |
| **La skill del Centro de Comando** (arquitectura, módulos, autocorrección) | [`.claude/skills/centro-de-comando/`](.claude/skills/centro-de-comando/) |
| **Contexto de marca y producto** (voz, reglas, avatar) | [`CLAUDE.md`](CLAUDE.md) |
| **Código de referencia de Siemon** (solo lectura, para portar) | [`referencia-siemon/`](referencia-siemon/) |
| **La Calculadora Pro** (app del producto) | [`index.html`](index.html) *(la versión con Supabase vive en la rama `feat/pro-supabase`)* |

## Arquitectura en una frase

- **Centro de Mando** (`crm.atlantisglobalrealty.com`): el CRM/sistema operativo
  del negocio. Única usuaria; autenticación contra su propio motor. Sin Supabase.
- **Calculadora Pro**: producto de venta multiusuario; sus compradores se
  administran con **Supabase** (rama `feat/pro-supabase`).
- **El flujo de compra en n8n une ambos**: alta en Supabase (acceso a la app) +
  registro en el CRM (comprador, pipeline, CAPI).

## Estado del despliegue

VPS compartido con el stack de Siemon (aislados entre sí). Dominios:
`crm.` / `motor.` / `hooks.atlantisglobalrealty.com`. Postiz propio
(`publicar.`) pendiente de RAM. Detalle vivo en el plan y la guía de docs/.
