#!/usr/bin/env bash
# Auto-actualizacion del Centro de Mando de Atlantis (corre por cron cada 5 min).
# Si hay commits nuevos en la rama, hace pull y reconstruye SOLO lo que cambio
# (web y/o motor). NUNCA toca n8n, ni los datos, ni nada de Siemon.
set -euo pipefail

DIR="/root/atlantis"
RAMA="claude/new-session-3rjwcr"
LOG="/root/atlantis/auto-actualizacion.log"

cd "$DIR"
git fetch origin "$RAMA" --quiet 2>/dev/null || exit 0
LOCAL=$(git rev-parse HEAD)
REMOTO=$(git rev-parse "origin/$RAMA")
[ "$LOCAL" = "$REMOTO" ] && exit 0

echo "[$(date '+%F %T')] actualizando ${LOCAL:0:7} -> ${REMOTO:0:7}" >> "$LOG"
git pull --ff-only origin "$RAMA" >> "$LOG" 2>&1
CAMBIOS=$(git diff --name-only "$LOCAL" "$REMOTO")

cd "$DIR/centro-de-mando"
if echo "$CAMBIOS" | grep -q "^centro-de-mando/web/"; then
  echo "  reconstruyendo la web del CRM..." >> "$LOG"
  docker compose -f compose.compartido.yml --env-file .env up -d --build web >> "$LOG" 2>&1
fi
if echo "$CAMBIOS" | grep -q "^centro-de-mando/motor-prospeccion/"; then
  echo "  reconstruyendo el motor..." >> "$LOG"
  docker compose -f compose.compartido.yml --env-file .env up -d --build motor >> "$LOG" 2>&1
fi
if echo "$CAMBIOS" | grep -q "^centro-de-mando/n8n/"; then
  echo "  AVISO: hay cambios en flujos de n8n; se instalan de forma coordinada, no automatica." >> "$LOG"
fi
echo "  listo." >> "$LOG"
