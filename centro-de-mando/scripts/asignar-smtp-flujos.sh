#!/usr/bin/env bash
# Asigna la credencial SMTP a los nodos de correo de los flujos de acceso
# POR DENTRO (sin la UI, que en n8n 2.x a veces no persiste el cambio):
# 1) exporta las credenciales de la instancia y toma el id real de la SMTP,
# 2) inyecta ese id en los 4 flujos y los re-importa por id (reemplazo),
# 3) publica, reinicia n8n y verifica,
# 4) dispara la prueba real del correo de recuperacion e informa.
#
# Uso (root, en el VPS, DESPUES de `git pull` en /root/atlantis):
#   bash /root/atlantis/centro-de-mando/scripts/asignar-smtp-flujos.sh [correo-de-prueba] [nombre-credencial]
set -euo pipefail

DIR_CM="/root/atlantis/centro-de-mando"
CONT="centro-de-mando-n8n-atlantis-1"
DOMINIO="hooks.atlantisglobalrealty.com"
CORREO_PRUEBA="${1:-siemondigital@gmail.com}"
NOMBRE_CRED="${2:-SMTP account 2}"
cd "$DIR_CM"

CRON_KEY=$(grep '^CRON_KEY=' .env | cut -d= -f2)
[ -n "$CRON_KEY" ] || { echo "ERROR: no encontre CRON_KEY en $DIR_CM/.env" >&2; exit 1; }

echo "== 1/4 Buscando la credencial SMTP en la instancia =="
docker exec -u node "$CONT" n8n export:credentials --all \
  --output=/home/node/.n8n/creds-export.json >/dev/null 2>&1
CRED=$(NOMBRE_CRED="$NOMBRE_CRED" python3 - <<'PY'
import json, os, sys
d = json.load(open('n8n-data/creds-export.json'))
smtp = [c for c in d if c.get('type') == 'smtp']
if not smtp:
    sys.exit('ERROR: no hay ninguna credencial SMTP en n8n; creala primero en la UI.')
pref = [c for c in smtp if c.get('name') == os.environ['NOMBRE_CRED']]
c = (pref or smtp)[-1]
print(c['id'] + '|' + c['name'])
PY
)
rm -f n8n-data/creds-export.json
CRED_ID="${CRED%%|*}"; CRED_NOMBRE="${CRED#*|}"
echo "   usare: \"$CRED_NOMBRE\" (id $CRED_ID)"

echo "== 2/4 Inyectando la credencial y re-importando por id =="
LISTA=$(docker exec -u node "$CONT" n8n list:workflow 2>/dev/null || true)
[ -n "$LISTA" ] || { echo "ERROR: no pude leer la lista de workflows" >&2; exit 1; }
rm -rf n8n-data/flujos-smtp
mkdir -p n8n-data/flujos-smtp
IDS=""
for f in n8n/acceso-app-*.json n8n/compra-confirmada.json; do
  NOMBRE=$(sed -n 's/.*"name": "\([^"]*\)".*/\1/p' "$f" | head -1)
  ID=$(echo "$LISTA" | grep -F "|$NOMBRE" | head -1 | cut -d'|' -f1)
  [ -n "$ID" ] || { echo "   AVISO: '$NOMBRE' no esta importado; lo salto."; continue; }
  ID="$ID" CRED_ID="$CRED_ID" CRED_NOMBRE="$CRED_NOMBRE" CRON_KEY="$CRON_KEY" \
  python3 - "$f" <<'PY'
import json, os, sys
f = sys.argv[1]
d = json.load(open(f))
d['id'] = os.environ['ID']
for n in d['nodes']:
    if n['type'].endswith('emailSend'):
        n['credentials'] = {'smtp': {'id': os.environ['CRED_ID'],
                                     'name': os.environ['CRED_NOMBRE']}}
t = json.dumps(d, ensure_ascii=False, indent=1)
t = t.replace('REEMPLAZAR_CRON_KEY', os.environ['CRON_KEY'])
open('n8n-data/flujos-smtp/' + os.path.basename(f), 'w').write(t)
PY
  IDS="$IDS $ID"
  echo "   listo: $NOMBRE"
done
[ -n "$IDS" ] || { echo "ERROR: ningun flujo encontrado en n8n" >&2; exit 1; }
chown -R 1000:1000 n8n-data/flujos-smtp
docker exec -u node "$CONT" n8n import:workflow --separate \
  --input=/home/node/.n8n/flujos-smtp
rm -rf n8n-data/flujos-smtp

echo "== 3/4 Publicando y reiniciando =="
for id in $IDS; do
  docker exec -u node "$CONT" n8n publish:workflow --id="$id" >/dev/null 2>&1 \
    || echo "   (no pude publicar $id)"
done
docker restart "$CONT" >/dev/null
ARRANQUE=$(docker inspect -f '{{.State.StartedAt}}' "$CONT")
echo -n "   esperando el rearranque"
for i in $(seq 1 40); do
  if docker logs --since "$ARRANQUE" "$CONT" 2>&1 | grep -q "Editor is now accessible"; then
    break
  fi
  echo -n "."; sleep 4
done
echo

echo "== 4/4 Prueba real: correo de recuperacion a $CORREO_PRUEBA =="
code=000
for i in $(seq 1 6); do
  code=$(curl -s -o /tmp/resp-reset.txt -w '%{http_code}' --max-time 30 \
    -X POST "https://$DOMINIO/webhook/password-reset-request" \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"$CORREO_PRUEBA\",\"lang\":\"es\"}" || true)
  [ "$code" = "200" ] && break
  sleep 6
done
RESP=$(cat /tmp/resp-reset.txt 2>/dev/null || true)
echo "   respuesta: HTTP $code $RESP"
sleep 3
echo "   ultimo envio segun n8n:"
docker logs --since 2m "$CONT" 2>&1 | grep -iE 'accepted|rejected|smtp|Enviar' | tail -5 || true
echo
echo "Si arriba no hay errores, el correo debe estar en la bandeja de"
echo "$CORREO_PRUEBA en ~1 minuto (revisa tambien Spam). Si algo fallo,"
echo "pegale esta salida completa al agente."
