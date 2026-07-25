#!/usr/bin/env bash
# Verifica por HTTP TODO lo publicado en atlantisglobalrealty.com:
# las 30 versiones web de correos + assets, las paginas del embudo (con y sin
# .html) y los legales. Correr EN EL VPS desde /root/atlantis/centro-de-mando:
#
#   bash scripts/verificar-web.sh
set -uo pipefail

AQUI="$(cd "$(dirname "$0")/.." && pwd)"
DOMINIO="atlantisglobalrealty.com"

URLS=()
# versiones web de correos + assets (lo que exista en el paquete del repo)
for f in "$AQUI/../web-emails"/*.html; do
  URLS+=("https://$DOMINIO/emails/$(basename "$f")")
done
for f in "$AQUI/../web-emails/assets"/*; do
  URLS+=("https://$DOMINIO/emails/assets/$(basename "$f")")
done
# paginas del embudo
URLS+=(
  "https://$DOMINIO/download-guide.html" "https://$DOMINIO/download-guide"
  "https://$DOMINIO/book-call.html"      "https://$DOMINIO/book-call"
  "https://$DOMINIO/book-videocall.html" "https://$DOMINIO/book-videocall"
  "https://$DOMINIO/unsubscribe/"        "https://$DOMINIO/unsubscribe"
  "https://$DOMINIO/guia/" "https://$DOMINIO/agendar-llamada/" "https://$DOMINIO/agendar-video/"
  "https://$DOMINIO/legales/privacidad.html" "https://$DOMINIO/legales/privacy.html"
  "https://$DOMINIO/legales/terminos.html"   "https://$DOMINIO/legales/terms.html"
  "https://$DOMINIO/assets/base.css" "https://$DOMINIO/assets/app.js"
)

ok=0; mal=0
for u in "${URLS[@]}"; do
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 20 "$u" || echo ERR)
  if [ "$code" = "200" ] || [ "$code" = "301" ] || [ "$code" = "302" ]; then
    ok=$((ok + 1))
  else
    mal=$((mal + 1))
    echo "  [$code] $u"
  fi
done
echo
echo "RESULTADO: $ok correctas · $mal con problema"
[ "$mal" = "0" ] && echo "TODO PUBLICADO Y RESPONDIENDO." || echo "Arriba estan SOLO las URLs con problema."
