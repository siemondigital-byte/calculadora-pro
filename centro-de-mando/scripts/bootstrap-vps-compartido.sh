#!/usr/bin/env bash
# Bootstrap del Centro de Mando de Atlantis en un VPS COMPARTIDO que ya corre
# el stack de Siemon (Traefik + n8n + Postiz + Umami + motor/web de Siemon).
#
# Que hace distinto al bootstrap normal:
# - NO instala Caddy (el Traefik existente ya ocupa 80/443): detecta el Traefik,
#   su red y su certresolver, y registra motor+web de Atlantis con labels.
# - NO levanta otro n8n: los flujos de Atlantis se importan en el n8n existente.
# - Todo lo de Atlantis vive en /root/atlantis con su propio /data (aislado de
#   los datos de Siemon).
#
# Uso (como root, en el VPS existente):
#   git clone --branch claude/new-session-3rjwcr https://github.com/siemondigital-byte/calculadora-pro.git /root/atlantis
#   bash /root/atlantis/centro-de-mando/scripts/bootstrap-vps-compartido.sh
set -euo pipefail

DIR_CM="/root/atlantis/centro-de-mando"
DOMINIO_CRM="${DOMINIO_CRM:-crm.atlantisglobalrealty.com}"
DOMINIO_MOTOR="${DOMINIO_MOTOR:-motor.atlantisglobalrealty.com}"

echo "== Centro de Mando · Atlantis — bootstrap en VPS compartido =="
cd "$DIR_CM"

# 0. Recursos: avisar si la RAM disponible es poca
LIBRE_MB=$(free -m | awk '/^Mem:/{print $7}')
echo "-- RAM disponible: ${LIBRE_MB} MB"
if [ "${LIBRE_MB:-0}" -lt 900 ]; then
  echo "   AVISO: hay poca RAM libre. El motor+web de Atlantis necesitan ~500 MB."
  echo "   Si el VPS se queda corto, sube el plan o apaga servicios que no uses."
fi

# 1. Detectar Traefik existente
TRAEFIK=$(docker ps --format '{{.Names}}\t{{.Image}}' | awk -F'\t' 'tolower($2) ~ /traefik/ {print $1; exit}')
if [ -z "$TRAEFIK" ]; then
  echo "ERROR: no encontre un contenedor Traefik corriendo. Usa el bootstrap normal (bootstrap-vps.sh)." >&2
  exit 1
fi
RED=$(docker inspect "$TRAEFIK" -f '{{range $k,$v := .NetworkSettings.Networks}}{{$k}}{{"\n"}}{{end}}' | head -1)
ARGS=$(docker inspect "$TRAEFIK" -f '{{join .Args " "}}' 2>/dev/null || true)
RESOLVER=$(echo "$ARGS" | grep -oE 'certificatesresolvers\.[A-Za-z0-9_-]+' | head -1 | cut -d. -f2)
RESOLVER="${RESOLVER:-letsencrypt}"
ENTRYPOINT=$(echo "$ARGS" | grep -oE 'entry[Pp]oints\.[A-Za-z0-9_-]+\.address=:443' | head -1 | cut -d. -f2)
ENTRYPOINT="${ENTRYPOINT:-websecure}"
echo "-- Traefik: $TRAEFIK · red: $RED · certresolver: $RESOLVER · entrypoint: $ENTRYPOINT"

# 2. Secretos (.env): una sola vez
if [ ! -f .env ]; then
  echo "-- Generando .env con claves nuevas..."
  CRM_PASSWORD="$(openssl rand -base64 18 | tr -d '/+=' | cut -c1-20)"
  mkdir -p data
  openssl ecparam -genkey -name prime256v1 -noout -out data/vapid_private.pem
  chmod 600 data/vapid_private.pem
  VAPID_PUB="$(openssl ec -in data/vapid_private.pem -pubout -outform DER 2>/dev/null | tail -c 65 | base64 | tr -d '=\n' | tr '+/' '-_')"
  {
    echo "CRM_PASSWORD=$CRM_PASSWORD"
    echo "CRON_KEY=$(openssl rand -hex 24)"
    echo "TOKEN_SECRET=$(openssl rand -hex 32)"
    echo "ANTHROPIC_API_KEY="
    echo "VAPID_PUBLIC_KEY=$VAPID_PUB"
    echo "VAPID_PRIVATE_KEY=/data/vapid_private.pem"
  } > .env
  chmod 600 .env
  echo
  echo "   CLAVE DE ACCESO AL CRM DE ATLANTIS (guardala; rotala luego desde Accesos):"
  grep CRM_PASSWORD .env | cut -d= -f2
  echo
else
  echo "-- .env ya existe; no se toca."
fi

# 3. Compose para VPS compartido (sin caddy, sin n8n; labels de Traefik)
cat > compose.compartido.yml <<YML
services:
  motor:
    build: ./motor-prospeccion
    restart: unless-stopped
    environment:
      - CRM_PASSWORD=\${CRM_PASSWORD}
      - CRON_KEY=\${CRON_KEY}
      - TOKEN_SECRET=\${TOKEN_SECRET}
      - ANTHROPIC_API_KEY=\${ANTHROPIC_API_KEY:-}
      - CLAUDE_MODEL=claude-sonnet-5
      - MOTOR_URL=https://$DOMINIO_MOTOR
      - VAPID_PUBLIC_KEY=\${VAPID_PUBLIC_KEY:-}
      - VAPID_PRIVATE_KEY=\${VAPID_PRIVATE_KEY:-/data/vapid_private.pem}
      - FTP_HOST=\${FTP_HOST:-}
      - FTP_PORT=\${FTP_PORT:-21}
      - FTP_USER=\${FTP_USER:-}
      - FTP_PASS=\${FTP_PASS:-}
    volumes:
      - ./data:/data
    networks: [proxy]
    labels:
      - traefik.enable=true
      - traefik.http.routers.atlantis-motor.rule=Host(\`$DOMINIO_MOTOR\`)
      - traefik.http.routers.atlantis-motor.entrypoints=$ENTRYPOINT
      - traefik.http.routers.atlantis-motor.tls.certresolver=$RESOLVER
      - traefik.http.services.atlantis-motor.loadbalancer.server.port=8000

  web:
    build:
      context: ./web
      args:
        VITE_MOTOR_URL: https://$DOMINIO_MOTOR
    restart: unless-stopped
    networks: [proxy]
    labels:
      - traefik.enable=true
      - traefik.http.routers.atlantis-crm.rule=Host(\`$DOMINIO_CRM\`)
      - traefik.http.routers.atlantis-crm.entrypoints=$ENTRYPOINT
      - traefik.http.routers.atlantis-crm.tls.certresolver=$RESOLVER
      - traefik.http.services.atlantis-crm.loadbalancer.server.port=80

networks:
  proxy:
    external: true
    name: $RED
YML

echo "-- Construyendo y levantando motor + web de Atlantis..."
docker compose -f compose.compartido.yml --env-file .env up -d --build

# 4. Verificacion
sleep 6
docker compose -f compose.compartido.yml ps
echo
echo "== Checklist =="
echo "[ ] DNS: $DOMINIO_CRM y $DOMINIO_MOTOR -> IP de ESTE VPS (registros A)"
for h in "$DOMINIO_MOTOR" "$DOMINIO_CRM"; do
  code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 12 "https://$h/" || true)"
  echo "[$([ "$code" != "000" ] && echo x || echo ' ')] https://$h -> $code"
done
echo "[ ] curl -s https://$DOMINIO_MOTOR/crm/data (sin Bearer) debe dar 401"
echo "[ ] Login en https://$DOMINIO_CRM con la clave impresa arriba"
echo
echo "n8n: importa los flujos de $DIR_CM/n8n/ en el n8n EXISTENTE del VPS"
echo "(hooks.siemondigital.com) y pon la CRON_KEY de $DIR_CM/.env en los nodos Motor."
echo "Los stacks de Siemon y Atlantis quedan aislados: datos en /root/atlantis/centro-de-mando/data."
