#!/usr/bin/env bash
# Instala los flujos de Atlantis en el n8n propio (hooks.atlantisglobalrealty.com):
# 1) arregla el permiso del volumen (causa tipica del bucle de reinicio),
# 2) importa los 5 flujos con la CRON_KEY real ya puesta,
# 3) los activa y reinicia n8n para registrar webhooks y crons (autocorreccion #3),
# 4) verifica el efecto: dominio 200 + webhooks respondiendo.
#
# Uso (root, en el VPS): bash /root/atlantis/centro-de-mando/scripts/instalar-flujos-n8n.sh
set -euo pipefail

DIR_CM="/root/atlantis/centro-de-mando"
CONT="centro-de-mando-n8n-atlantis-1"
DOMINIO="hooks.atlantisglobalrealty.com"

cd "$DIR_CM"
CRON_KEY=$(grep '^CRON_KEY=' .env | cut -d= -f2)
if [ -z "$CRON_KEY" ]; then
  echo "ERROR: no encontre CRON_KEY en $DIR_CM/.env" >&2
  exit 1
fi

echo "== 1/4 Permisos del volumen de n8n =="
mkdir -p n8n-data
chown -R 1000:1000 n8n-data
docker restart "$CONT" >/dev/null
echo -n "   esperando a que n8n arranque"
for i in $(seq 1 30); do
  estado=$(docker inspect -f '{{.State.Status}} {{.State.Restarting}}' "$CONT" 2>/dev/null || echo "")
  if docker logs "$CONT" 2>&1 | tail -5 | grep -q "Editor is now accessible"; then
    break
  fi
  echo -n "."
  sleep 4
done
echo
if ! docker logs "$CONT" 2>&1 | tail -20 | grep -q "Editor is now accessible"; then
  echo "   n8n aun no reporta arranque. Ultimas lineas del log:"
  docker logs "$CONT" --tail 15 2>&1
  echo "   (pegale este log al agente si el problema persiste)"
  exit 1
fi
echo "   n8n arriba."

echo "== 2/4 Importando flujos (con la CRON_KEY puesta) =="
rm -rf n8n-data/flujos-atlantis
mkdir -p n8n-data/flujos-atlantis
for f in n8n/*.json; do
  sed "s/REEMPLAZAR_CRON_KEY/$CRON_KEY/g" "$f" > "n8n-data/flujos-atlantis/$(basename "$f")"
done
chown -R 1000:1000 n8n-data/flujos-atlantis
docker exec -u node "$CONT" n8n import:workflow --separate \
  --input=/home/node/.n8n/flujos-atlantis
rm -rf n8n-data/flujos-atlantis

echo "== 3/4 Activando y registrando webhooks =="
docker exec -u node "$CONT" n8n update:workflow --all --active=true
# reinicio para que los triggers (webhooks + crons) queden registrados
docker restart "$CONT" >/dev/null
echo -n "   esperando el rearranque"
for i in $(seq 1 30); do
  if docker logs "$CONT" --since 30s 2>&1 | grep -q "Editor is now accessible"; then
    break
  fi
  echo -n "."
  sleep 4
done
echo

echo "== 4/4 Verificacion (el efecto, no la intencion) =="
code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "https://$DOMINIO/" || true)
echo "[$([ "$code" = "200" ] && echo x || echo ' ')] https://$DOMINIO -> $code (esperado 200)"
for path in compra-cicloderiqueza reembolso-cicloderiqueza; do
  wcode=$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 \
    -X POST "https://$DOMINIO/webhook/$path" \
    -H 'Content-Type: application/json' -d '{"ping":true}' || true)
  echo "[$([ "$wcode" = "200" ] && echo x || echo ' ')] webhook /$path -> $wcode (esperado 200)"
done
echo
echo "Flujos instalados: compra confirmada, reembolso, nurturing diario (9:03am),"
echo "leer bandeja (15 min), recordatorios push (8:07am)."
echo
echo "PENDIENTE MANUAL (una vez): abre https://$DOMINIO, crea tu usuario admin"
echo "(pantalla 'Set up owner account'), y en el flujo 'Compra confirmada' abre el"
echo "nodo 'Correo de bienvenida' y asignale una credencial SMTP (tu buzon hello@)."
echo "Sin eso, todo funciona menos el envio del correo de bienvenida."
