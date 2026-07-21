#!/usr/bin/env bash
# Parche unico para un VPS desplegado ANTES de los flujos de acceso a la app:
# el compose.compartido.yml generado por el bootstrap viejo no pasa las
# variables de Supabase al contenedor de n8n, y el instalador viejo no
# importaba flujos nuevos. Este script:
# 1) inyecta SUPABASE_URL / SUPABASE_SERVICE_KEY al compose si faltan,
# 2) valida que el .env tenga valores reales (no placeholders),
# 3) recrea n8n-atlantis para que las tome y lo comprueba,
# 4) corre el instalador actualizado (importa solo los flujos que falten),
# 5) verifica el efecto: los 3 flujos de acceso listados y sus webhooks vivos.
#
# Uso (root, en el VPS, DESPUES de `git pull` en /root/atlantis):
#   bash /root/atlantis/centro-de-mando/scripts/parche-acceso-app.sh
set -euo pipefail

DIR_CM="/root/atlantis/centro-de-mando"
CONT="centro-de-mando-n8n-atlantis-1"
DOMINIO="hooks.atlantisglobalrealty.com"
cd "$DIR_CM"

echo "== 1/5 Variables de Supabase en el compose =="
if grep -q 'SUPABASE_URL' compose.compartido.yml; then
  echo "   ya estaban en el compose."
else
  sed -i '/NODE_FUNCTION_ALLOW_BUILTIN=crypto/a\      # Supabase de la Calculadora Pro (los flujos los leen como $env.*).\n      - SUPABASE_URL=${SUPABASE_URL:-}\n      - SUPABASE_SERVICE_KEY=${SUPABASE_SERVICE_KEY:-}' compose.compartido.yml
  if ! grep -q 'SUPABASE_URL' compose.compartido.yml; then
    echo "ERROR: no encontre el ancla NODE_FUNCTION_ALLOW_BUILTIN=crypto en el compose;" >&2
    echo "pegale este archivo al agente: $DIR_CM/compose.compartido.yml" >&2
    exit 1
  fi
  echo "   inyectadas al servicio n8n-atlantis."
fi

echo "== 1b/5 Permitir \$env.* en los flujos (n8n 2.x lo bloquea) =="
if grep -q 'N8N_BLOCK_ENV_ACCESS_IN_NODE' compose.compartido.yml; then
  echo "   ya estaba permitido."
else
  sed -i '/NODE_FUNCTION_ALLOW_BUILTIN=crypto/a\      - N8N_BLOCK_ENV_ACCESS_IN_NODE=false' compose.compartido.yml
  grep -q 'N8N_BLOCK_ENV_ACCESS_IN_NODE' compose.compartido.yml \
    || { echo "ERROR: no pude inyectar N8N_BLOCK_ENV_ACCESS_IN_NODE" >&2; exit 1; }
  echo "   inyectado N8N_BLOCK_ENV_ACCESS_IN_NODE=false."
fi

echo "== 2/5 Valores reales en el .env =="
for var in SUPABASE_URL SUPABASE_SERVICE_KEY; do
  val=$(grep "^$var=" .env | cut -d= -f2- || true)
  case "$val" in
    ''|*TU-PROYECTO*|*PEGAR_*)
      echo "ERROR: $var no tiene un valor real en $DIR_CM/.env" >&2
      echo "(agregalo con: echo '$var=...' >> $DIR_CM/.env)" >&2
      exit 1;;
  esac
done
echo "   .env correcto."

echo "== 3/5 Recreando n8n-atlantis con las variables =="
docker compose -f compose.compartido.yml --env-file .env up -d --force-recreate n8n-atlantis
URL_DENTRO=$(docker exec "$CONT" printenv SUPABASE_URL 2>/dev/null || true)
if [ -z "$URL_DENTRO" ]; then
  echo "ERROR: el contenedor sigue sin SUPABASE_URL despues de recrearlo." >&2
  exit 1
fi
echo "   el contenedor ve SUPABASE_URL=$URL_DENTRO"

echo "== 4/5 Instalador de flujos (importa los que falten) =="
# los errores "Cannot publish archived Workflow" del final son duplicados
# viejos archivados en n8n: no rompen nada, se ignoran
bash scripts/instalar-flujos-n8n.sh || true

echo "== 5/5 Verificacion de los 3 flujos de acceso =="
LISTA=$(docker exec -u node "$CONT" n8n list:workflow 2>/dev/null || true)
for nombre in "Acceso app - alta y credenciales" \
              "Acceso app - recuperar password (solicitar)" \
              "Acceso app - recuperar password (confirmar)"; do
  if echo "$LISTA" | grep -qF "$nombre"; then marca=x; else marca=' '; fi
  echo "[$marca] flujo \"$nombre\" importado"
done
# el alta sin ?k= debe responder 401 (el flujo vive y rechaza sin clave);
# 404 significaria que el webhook no quedo registrado
code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 \
  -X POST "https://$DOMINIO/webhook/alta-calculadora" \
  -H 'Content-Type: application/json' -d '{"ping":true}' || true)
echo "[$([ "$code" = "401" ] && echo x || echo ' ')] webhook /alta-calculadora sin clave -> $code (esperado 401)"

# prueba real de punta a punta: si responde {"ok":true} es que el flujo llego
# hasta el envio (token -> Supabase -> correo); el correo debe aterrizar en la
# bandeja del correo de prueba en ~1 min. Se puede pasar otro correo: bash $0 otro@x.com
CORREO_PRUEBA="${1:-siemondigital@gmail.com}"
echo
echo "== Prueba real: correo de recuperacion a $CORREO_PRUEBA =="
RESP=$(curl -s --max-time 30 -X POST "https://$DOMINIO/webhook/password-reset-request" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$CORREO_PRUEBA\",\"lang\":\"es\"}" || true)
if echo "$RESP" | grep -q '"ok"'; then
  echo "[x] el flujo completo funciono ($RESP). Revisa la bandeja de $CORREO_PRUEBA (y spam)."
else
  echo "[ ] el flujo NO completo (respuesta: '$RESP')."
  echo "    Mira la ejecucion roja en https://$DOMINIO -> Overview -> Executions."
fi
echo
echo "PENDIENTE MANUAL (una vez): en https://$DOMINIO abre cada uno de los 3"
echo "flujos 'Acceso app ...', y en su nodo de correo asigna la credencial SMTP"
echo "(la misma de los demas flujos). Sin eso todo funciona menos el envio."
