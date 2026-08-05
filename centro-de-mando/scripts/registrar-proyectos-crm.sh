#!/usr/bin/env bash
# Registra en el Centro de Mando (motor, workspace atlantis) TODOS los
# proyectos de proyectos-src/ — asi cada landing tiene su ficha en el CRM.
# Idempotente: re-correr actualiza los existentes por slug.
#
# Correr EN EL VPS desde /root/atlantis/centro-de-mando:
#
#   bash scripts/registrar-proyectos-crm.sh
set -euo pipefail

AQUI="$(cd "$(dirname "$0")/.." && pwd)"
[ -f "$AQUI/.env" ] || { echo "ERROR: no encuentro $AQUI/.env"; exit 1; }
set -a; . "$AQUI/.env"; set +a
: "${CRON_KEY:?CRON_KEY no esta en .env}"

for f in "$AQUI"/../proyectos-src/*/proyecto.json; do
  slug=$(basename "$(dirname "$f")")
  resp=$(curl -s -X POST "https://motor.atlantisglobalrealty.com/proyectos/upsert" \
    -H "Authorization: Bearer $CRON_KEY" -H 'Content-Type: application/json' \
    --data-binary @"$f")
  echo "  $slug -> $resp"
done
echo "Listo. Ficha de cada proyecto en el CRM (GET /proyectos)."
