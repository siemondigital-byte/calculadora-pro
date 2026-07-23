#!/usr/bin/env bash
# Publica las paginas del embudo (emails/embudo-atlantis/sitio) en el hosting
# del dominio, junto al WordPress, y VERIFICA por HTTP.
#
# Correr EN EL VPS desde /root/atlantis/centro-de-mando:
#
#   bash scripts/publicar-sitio-embudo.sh
#
# Sube: /assets/ /guia/ /unsubscribe/ /agendar-llamada/ /agendar-video/ /legales/
# y genera las paginas canonicas de raiz que ya usan los correos y la config:
#   /download-guide.html  (desde guia/)
#   /book-call.html       (desde agendar-llamada/)
#   /book-videocall.html  (desde agendar-video/)
# El index.html del sitio del embudo es un indice interno de QA y NO se publica.
set -euo pipefail

AQUI="$(cd "$(dirname "$0")/.." && pwd)"
SITIO="$AQUI/../emails/embudo-atlantis/sitio"
DOMINIO="atlantisglobalrealty.com"
[ -d "$SITIO" ] || { echo "ERROR: no existe $SITIO"; exit 1; }

CONT=$(docker ps --format '{{.Names}}' | grep -m1 '^centro-de-mando-motor' || true)
[ -n "$CONT" ] || { echo "ERROR: no encuentro el contenedor centro-de-mando-motor"; exit 1; }
echo "usando contenedor: $CONT"

# --- armar el paquete en un directorio temporal ---
STAGE=$(mktemp -d)
trap 'rm -rf "$STAGE"' EXIT
for d in assets guia unsubscribe agendar-llamada agendar-video legales; do
  cp -r "$SITIO/$d" "$STAGE/$d"
done

# paginas canonicas de raiz: mismas paginas con rutas relativas ajustadas
# (../assets -> assets, ../legales -> legales; el lockup apunta a la home real)
raiz() {
  sed -e 's#\.\./index\.html#https://atlantisglobalrealty.com/#g' -e 's#\.\./##g' "$1" > "$2"
}
raiz "$SITIO/guia/index.html"            "$STAGE/download-guide.html"
raiz "$SITIO/agendar-llamada/index.html" "$STAGE/book-call.html"
raiz "$SITIO/agendar-video/index.html"   "$STAGE/book-videocall.html"

docker exec "$CONT" rm -rf /tmp/sitio-embudo
docker cp "$STAGE" "$CONT:/tmp/sitio-embudo"

docker exec -i "$CONT" python3 - <<'PY'
import os
from ftplib import FTP
from pathlib import Path

paquete = Path("/tmp/sitio-embudo")
f = FTP()
f.connect(os.environ["FTP_HOST"].replace("ftp://", ""),
          int(os.environ.get("FTP_PORT", "21")), timeout=30)
f.login(os.environ.get("FTP_USER", ""), os.environ.get("FTP_PASS", ""))
destino = (os.environ.get("FTP_DIR") or "").strip().rstrip("/")
if destino:
    f.cwd(destino)

hechos = set()
def asegurar(ruta):
    partes = []
    for p in ruta.split("/"):
        partes.append(p)
        d = "/".join(partes)
        if d not in hechos:
            try:
                f.mkd(d)
            except Exception:
                pass
            hechos.add(d)

subidos = 0
for p in sorted(paquete.rglob("*")):
    if not p.is_file():
        continue
    remoto = str(p.relative_to(paquete)).replace("\\", "/")
    if "/" in remoto:
        asegurar(remoto.rsplit("/", 1)[0])
    with open(p, "rb") as fh:
        f.storbinary(f"STOR {remoto}", fh)
    subidos += 1
print(f"OK: {subidos} archivos subidos a {f.pwd()}/")
f.quit()
PY

docker exec "$CONT" rm -rf /tmp/sitio-embudo

echo
echo "== Verificacion HTTP desde el host (debe decir 200) =="
fallo=0
for u in \
  "https://$DOMINIO/download-guide.html" \
  "https://$DOMINIO/book-call.html" \
  "https://$DOMINIO/book-videocall.html" \
  "https://$DOMINIO/unsubscribe/" \
  "https://$DOMINIO/assets/base.css"; do
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 20 "$u" || echo ERR)
  echo "  [$code] $u"
  [ "$code" = "200" ] || fallo=1
done
[ "$fallo" = "0" ] && echo "SITIO DEL EMBUDO PUBLICADO Y VERIFICADO." || echo "AVISO: alguna URL no dio 200; pegale esta salida al agente."
