#!/usr/bin/env bash
# Bootstrap del Centro de Mando en un VPS (Hostinger u otro, Ubuntu/Debian).
# Uso, desde la terminal del navegador del VPS (hPanel > VPS > Terminal), como root:
#
#   bash <(curl -fsSL https://raw.githubusercontent.com/siemondigital-byte/calculadora-pro/claude/new-session-3rjwcr/centro-de-mando/scripts/bootstrap-vps.sh)
#
# (Si el repo es privado, primero: git clone con un token y ejecutar
#  bash calculadora-pro/centro-de-mando/scripts/bootstrap-vps.sh)
#
# Idempotente: se puede correr varias veces; no pisa el .env ni los datos.
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/siemondigital-byte/calculadora-pro.git}"
RAMA="${RAMA:-claude/new-session-3rjwcr}"
DESTINO="${DESTINO:-/root/atlantis}"
DIR_CM="$DESTINO/centro-de-mando"

echo "== Centro de Mando · Atlantis — bootstrap =="

# 1. Docker
if ! command -v docker >/dev/null 2>&1; then
  echo "-- Instalando Docker..."
  curl -fsSL https://get.docker.com | sh
fi
if ! docker compose version >/dev/null 2>&1; then
  echo "ERROR: docker compose (plugin) no disponible. Instala docker-compose-plugin." >&2
  exit 1
fi

# 2. Codigo
if ! command -v git >/dev/null 2>&1; then
  apt-get update -q && apt-get install -y -q git
fi
if [ -d "$DIR_CM" ]; then
  echo "-- Repo ya presente; actualizando ($RAMA)..."
  git -C "$DESTINO" fetch origin "$RAMA" && git -C "$DESTINO" checkout "$RAMA" && git -C "$DESTINO" pull origin "$RAMA"
else
  echo "-- Clonando $REPO_URL ($RAMA)..."
  git clone --branch "$RAMA" "$REPO_URL" "$DESTINO"
fi
cd "$DIR_CM"

# 3. Secretos (.env): se generan UNA vez y no se vuelven a tocar
if [ ! -f .env ]; then
  echo "-- Generando .env con claves nuevas..."
  CRM_PASSWORD="$(openssl rand -base64 18 | tr -d '/+=' | cut -c1-20)"
  # claves VAPID para push web (privada en PEM, publica en base64url cruda)
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
  echo "   CLAVE DE ACCESO AL CRM (guardala y rotala luego desde Accesos):"
  echo "   $CRM_PASSWORD"
  echo
  echo "   ANTHROPIC_API_KEY quedo vacia en $DIR_CM/.env: pegala ahi y"
  echo "   corre 'docker compose up -d motor' para activar la IA."
else
  echo "-- .env ya existe; no se toca."
fi

# 4. Levantar
echo "-- Construyendo y levantando contenedores..."
docker compose up -d --build

# 5. Verificacion (el efecto, no la intencion)
echo "-- Verificando..."
sleep 5
docker compose ps
IP_PUBLICA="$(curl -fsS --max-time 5 https://api.ipify.org 2>/dev/null || hostname -I | awk '{print $1}')"
echo
echo "== Checklist =="
echo "[ ] DNS: crm/motor/hooks.atlantisglobalrealty.com -> $IP_PUBLICA (registros A)"
echo "    Sin el DNS apuntando, Caddy no puede emitir los certificados TLS."
for h in motor.atlantisglobalrealty.com crm.atlantisglobalrealty.com hooks.atlantisglobalrealty.com; do
  code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "https://$h/" || true)"
  echo "[$([ "$code" != "000" ] && echo x || echo ' ')] https://$h -> $code"
done
echo "[ ] Auth fail-closed: curl -s https://motor.atlantisglobalrealty.com/crm/data (sin Bearer) debe dar 401"
echo "[ ] Login en https://crm.atlantisglobalrealty.com con la clave de arriba"
echo "[ ] Crear un lead de prueba y confirmar que persiste al recargar"
echo
echo "Listo. Logs: cd $DIR_CM && docker compose logs -f --tail 50"
