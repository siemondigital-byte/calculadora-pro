#!/usr/bin/env bash
# Actualiza EN SITIO los 3 flujos de acceso ya importados en el n8n del VPS:
# les inyecta su id actual y los re-importa (import con id = reemplazo, sin
# duplicar). Editar un flujo por CLI des-registra su webhook (autocorreccion
# #3), por eso al final re-publica, reinicia n8n y verifica el efecto.
# OJO: el reemplazo borra la credencial SMTP asignada a los nodos de correo;
# hay que re-asignarla en la UI despues de correr esto.
#
# Uso (root, en el VPS, DESPUES de `git pull` en /root/atlantis):
#   bash /root/atlantis/centro-de-mando/scripts/actualizar-flujos-acceso.sh
set -euo pipefail

DIR_CM="/root/atlantis/centro-de-mando"
CONT="centro-de-mando-n8n-atlantis-1"
DOMINIO="hooks.atlantisglobalrealty.com"
cd "$DIR_CM"

CRON_KEY=$(grep '^CRON_KEY=' .env | cut -d= -f2)
[ -n "$CRON_KEY" ] || { echo "ERROR: no encontre CRON_KEY en $DIR_CM/.env" >&2; exit 1; }

echo "== 1/3 Preparando los flujos con su id actual =="
LISTA=$(docker exec -u node "$CONT" n8n list:workflow 2>/dev/null || true)
[ -n "$LISTA" ] || { echo "ERROR: no pude leer la lista de workflows de n8n" >&2; exit 1; }

rm -rf n8n-data/flujos-actualizar
mkdir -p n8n-data/flujos-actualizar
IDS=""
for f in n8n/acceso-app-*.json n8n/compra-confirmada.json n8n/embudo-*.json; do
  NOMBRE=$(sed -n 's/.*"name": "\([^"]*\)".*/\1/p' "$f" | head -1)
  ID=$(echo "$LISTA" | grep -F "|$NOMBRE" | head -1 | cut -d'|' -f1)
  if [ -z "$ID" ]; then
    echo "   AVISO: '$NOMBRE' no esta importado; corre primero scripts/instalar-flujos-n8n.sh"
    continue
  fi
  ID="$ID" CRON_KEY="$CRON_KEY" python3 - "$f" <<'PY'
import json, os, sys
f = sys.argv[1]
d = json.load(open(f))
d['id'] = os.environ['ID']
t = json.dumps(d, ensure_ascii=False, indent=1)
t = t.replace('REEMPLAZAR_CRON_KEY', os.environ['CRON_KEY'])
open('n8n-data/flujos-actualizar/' + os.path.basename(f), 'w').write(t)
PY
  IDS="$IDS $ID"
  echo "   listo: $NOMBRE -> id $ID"
done
[ -n "$IDS" ] || { echo "ERROR: ningun flujo de acceso encontrado en n8n" >&2; exit 1; }

echo "== 2/3 Re-importando (reemplazo por id) y re-publicando =="
chown -R 1000:1000 n8n-data/flujos-actualizar
docker exec -u node "$CONT" n8n import:workflow --separate \
  --input=/home/node/.n8n/flujos-actualizar
rm -rf n8n-data/flujos-actualizar
for id in $IDS; do
  docker exec -u node "$CONT" n8n publish:workflow --id="$id" 2>/dev/null \
    || echo "   (no pude publicar $id; activalo con el toggle en la UI)"
done
docker restart "$CONT" >/dev/null
ARRANQUE=$(docker inspect -f '{{.State.StartedAt}}' "$CONT")
echo -n "   esperando el rearranque"
for i in $(seq 1 40); do
  if docker logs --since "$ARRANQUE" "$CONT" 2>&1 | grep -q "Editor is now accessible"; then
    break
  fi
  echo -n "."
  sleep 4
done
echo

echo "== 3/3 Verificacion =="
code=000
for i in $(seq 1 6); do
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 \
    -X POST "https://$DOMINIO/webhook/alta-calculadora" \
    -H 'Content-Type: application/json' -d '{"ping":true}' || true)
  [ "$code" = "401" ] && break
  sleep 6
done
echo "[$([ "$code" = "401" ] && echo x || echo ' ')] webhook /alta-calculadora sin clave -> $code (esperado 401)"
echo
echo "PENDIENTE MANUAL: el reemplazo borro la credencial SMTP de los nodos de"
echo "correo. En https://$DOMINIO abre cada flujo 'Acceso app ...', entra al"
echo "nodo de correo y asignale la credencial SMTP. Guarda cada flujo."
