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
DOMINIO_HOOKS="${DOMINIO_HOOKS:-hooks.atlantisglobalrealty.com}"
DOMINIO_PUBLICAR="${DOMINIO_PUBLICAR:-publicar.atlantisglobalrealty.com}"
# CON_N8N=1 levanta un n8n PROPIO de Atlantis (workflows separados, dominio propio).
# CON_POSTIZ=1 levanta un Postiz PROPIO (requiere ~1 GB de RAM adicional).
CON_N8N="${CON_N8N:-1}"
CON_POSTIZ="${CON_POSTIZ:-0}"

echo "== Centro de Mando · Atlantis — bootstrap en VPS compartido =="
cd "$DIR_CM"

# 0. Recursos: avisar si la RAM disponible es poca
LIBRE_MB=$(free -m | awk '/^Mem:/{print $7}')
TOTAL_MB=$(free -m | awk '/^Mem:/{print $2}')
echo "-- RAM: ${LIBRE_MB} MB disponibles de ${TOTAL_MB} MB"
if [ "${LIBRE_MB:-0}" -lt 900 ]; then
  echo "   AVISO: hay poca RAM libre. El motor+web de Atlantis necesitan ~500 MB."
  echo "   Si el VPS se queda corto, sube el plan o apaga servicios que no uses."
fi

# Modo SOLO_VERIFICAR=1: reporte del estado del VPS SIN instalar ni tocar nada.
if [ "${SOLO_VERIFICAR:-0}" = "1" ]; then
  echo
  echo "== SOLO VERIFICACION (no se instala nada) =="
  echo "-- Disco:"
  df -h / | tail -1
  echo "-- Contenedores corriendo y su memoria:"
  docker stats --no-stream --format 'table {{.Name}}\t{{.MemUsage}}\t{{.CPUPerc}}' 2>/dev/null || docker ps --format '{{.Names}}'
  echo "-- Traefik detectado:"
  T=$(docker ps --format '{{.Names}}\t{{.Image}}' | awk -F'\t' 'tolower($2) ~ /traefik/ {print $1; exit}')
  if [ -n "$T" ]; then
    echo "   $T (red: $(docker inspect "$T" -f '{{range $k,$v := .NetworkSettings.Networks}}{{$k}}{{end}}' | head -c 60))"
  else
    echo "   NO ENCONTRADO: se necesitaria el bootstrap normal con Caddy"
  fi
  echo
  echo "Veredicto de RAM:"
  if [ "${LIBRE_MB:-0}" -ge 1800 ]; then
    echo "  OK para motor+web+n8n de Atlantis Y el Postiz propio (CON_POSTIZ=1)."
  elif [ "${LIBRE_MB:-0}" -ge 900 ]; then
    echo "  OK para motor+web+n8n de Atlantis. Para el Postiz propio, sube el plan de RAM primero."
  else
    echo "  JUSTO: sube el plan de RAM antes de instalar (o revisa que servicios se pueden apagar)."
  fi
  echo
  echo "Copia TODO este resultado y pegaselo al agente. Nada fue modificado."
  exit 0
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
    echo "POSTIZ_JWT_SECRET=$(openssl rand -hex 32)"
    echo "POSTIZ_DB_PASS=$(openssl rand -hex 16)"
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
YML

# 3b. n8n PROPIO de Atlantis (workflows y credenciales separados de Siemon)
if [ "$CON_N8N" = "1" ]; then
cat >> compose.compartido.yml <<YML

  n8n-atlantis:
    image: n8nio/n8n:latest
    restart: unless-stopped
    environment:
      - N8N_HOST=$DOMINIO_HOOKS
      - N8N_PROTOCOL=https
      - WEBHOOK_URL=https://$DOMINIO_HOOKS/
      - GENERIC_TIMEZONE=America/Bogota
      - NODE_FUNCTION_ALLOW_BUILTIN=crypto
      # n8n >= 2.x bloquea \$env.* en los flujos por defecto; los flujos de
      # acceso leen SUPABASE_URL/SUPABASE_SERVICE_KEY con \$env, asi que se abre.
      - N8N_BLOCK_ENV_ACCESS_IN_NODE=false
      # Supabase de la Calculadora Pro (los flujos los leen como \$env.*).
      # Valores en el .env de esta carpeta; la service_role NUNCA va al navegador.
      - SUPABASE_URL=\${SUPABASE_URL:-}
      - SUPABASE_SERVICE_KEY=\${SUPABASE_SERVICE_KEY:-}
    volumes:
      - ./n8n-data:/home/node/.n8n
    networks: [proxy]
    labels:
      - traefik.enable=true
      - traefik.http.routers.atlantis-hooks.rule=Host(\`$DOMINIO_HOOKS\`)
      - traefik.http.routers.atlantis-hooks.entrypoints=$ENTRYPOINT
      - traefik.http.routers.atlantis-hooks.tls.certresolver=$RESOLVER
      - traefik.http.services.atlantis-hooks.loadbalancer.server.port=5678
YML
fi

# 3c. Postiz PROPIO de Atlantis (OAuth y cuentas de redes separados).
#     Pesa ~1 GB de RAM: activar con CON_POSTIZ=1 solo si el VPS tiene margen.
if [ "$CON_POSTIZ" = "1" ]; then
cat >> compose.compartido.yml <<YML

  postiz-atlantis:
    image: ghcr.io/gitroomhq/postiz-app:latest
    restart: unless-stopped
    environment:
      - MAIN_URL=https://$DOMINIO_PUBLICAR
      - FRONTEND_URL=https://$DOMINIO_PUBLICAR
      - NEXT_PUBLIC_BACKEND_URL=https://$DOMINIO_PUBLICAR/api
      - JWT_SECRET=\${POSTIZ_JWT_SECRET}
      - DATABASE_URL=postgresql://postiz:\${POSTIZ_DB_PASS}@postiz-atlantis-db:5432/postiz
      - REDIS_URL=redis://postiz-atlantis-redis:6379
      - BACKEND_INTERNAL_URL=http://localhost:3000
      - IS_GENERAL=true
      - DISABLE_REGISTRATION=false
      - STORAGE_PROVIDER=local
      - UPLOAD_DIRECTORY=/uploads
      - NEXT_PUBLIC_UPLOAD_DIRECTORY=/uploads
    volumes:
      - ./postiz-uploads:/uploads
    networks: [proxy, postiz-atlantis]
    depends_on: [postiz-atlantis-db, postiz-atlantis-redis]
    labels:
      - traefik.enable=true
      - traefik.http.routers.atlantis-publicar.rule=Host(\`$DOMINIO_PUBLICAR\`)
      - traefik.http.routers.atlantis-publicar.entrypoints=$ENTRYPOINT
      - traefik.http.routers.atlantis-publicar.tls.certresolver=$RESOLVER
      - traefik.http.services.atlantis-publicar.loadbalancer.server.port=5000

  postiz-atlantis-db:
    image: postgres:17-alpine
    restart: unless-stopped
    environment:
      - POSTGRES_USER=postiz
      - POSTGRES_PASSWORD=\${POSTIZ_DB_PASS}
      - POSTGRES_DB=postiz
    volumes:
      - ./postiz-db:/var/lib/postgresql/data
    networks: [postiz-atlantis]

  postiz-atlantis-redis:
    image: redis:7-alpine
    restart: unless-stopped
    networks: [postiz-atlantis]
YML
fi

# pie: definicion de redes (SIEMPRE al final, despues de todos los servicios)
cat >> compose.compartido.yml <<YML

networks:
  proxy:
    external: true
    name: $RED
YML
if [ "$CON_POSTIZ" = "1" ]; then
  printf '  postiz-atlantis:\n    driver: bridge\n' >> compose.compartido.yml
fi

echo "-- Construyendo y levantando el stack de Atlantis..."
docker compose -f compose.compartido.yml --env-file .env up -d --build

# 4. Verificacion
sleep 6
docker compose -f compose.compartido.yml ps
echo
echo "== Checklist =="
DOMINIOS="$DOMINIO_MOTOR $DOMINIO_CRM"
[ "$CON_N8N" = "1" ] && DOMINIOS="$DOMINIOS $DOMINIO_HOOKS"
[ "$CON_POSTIZ" = "1" ] && DOMINIOS="$DOMINIOS $DOMINIO_PUBLICAR"
echo "[ ] DNS: registros A hacia la IP de ESTE VPS para: $DOMINIOS"
for h in $DOMINIOS; do
  code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 12 "https://$h/" || true)"
  echo "[$([ "$code" != "000" ] && echo x || echo ' ')] https://$h -> $code"
done
echo "[ ] curl -s https://$DOMINIO_MOTOR/crm/data (sin Bearer) debe dar 401"
echo "[ ] Login en https://$DOMINIO_CRM con la clave impresa arriba"
echo
if [ "$CON_N8N" = "1" ]; then
  echo "n8n de Atlantis: entra a https://$DOMINIO_HOOKS, crea el usuario admin,"
  echo "importa los flujos de $DIR_CM/n8n/ y pon la CRON_KEY de $DIR_CM/.env en"
  echo "los nodos Motor. Solo veras los workflows de Atlantis (instancia propia)."
else
  echo "n8n: importa los flujos de $DIR_CM/n8n/ en el n8n existente del VPS y"
  echo "pon la CRON_KEY de $DIR_CM/.env en los nodos Motor."
fi
if [ "$CON_POSTIZ" = "1" ]; then
  echo "Postiz de Atlantis: entra a https://$DOMINIO_PUBLICAR, crea la cuenta y"
  echo "conecta las redes de Atlantis. Pon POSTIZ_URL=https://$DOMINIO_PUBLICAR/api"
  echo "en el .env del motor y la POSTIZ_API_KEY por el vault (CRM -> Accesos)."
fi
echo "Los stacks de Siemon y Atlantis quedan aislados: datos de Atlantis en $DIR_CM/data."
