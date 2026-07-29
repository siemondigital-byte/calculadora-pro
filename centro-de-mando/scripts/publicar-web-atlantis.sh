#!/usr/bin/env bash
# Publica la web nueva de Atlantis SIN tocar el WordPress actual:
#   - web-atlantis/proyectos/  ->  /proyectos/   (solo slugs publicables; los
#                                                 que empiezan con "_" son
#                                                 borradores y NO suben)
#   - web-atlantis/index.html  ->  /nueva/       (borrador de la home para
#                                                 aprobar; el switch a la raiz
#                                                 se hace aparte y con respaldo)
#
# Correr EN EL VPS desde /root/atlantis/centro-de-mando:
#
#   bash scripts/publicar-web-atlantis.sh
set -euo pipefail

AQUI="$(cd "$(dirname "$0")/.." && pwd)"
WEB="$AQUI/../web-atlantis"
DOMINIO="atlantisglobalrealty.com"
[ -d "$WEB" ] || { echo "ERROR: no existe $WEB (corre generar-landing-proyecto.py)"; exit 1; }

CONT=$(docker ps --format '{{.Names}}' | grep -m1 '^centro-de-mando-motor' || true)
[ -n "$CONT" ] || { echo "ERROR: no encuentro el contenedor centro-de-mando-motor"; exit 1; }
echo "usando contenedor: $CONT"

STAGE=$(mktemp -d)
trap 'rm -rf "$STAGE"' EXIT
mkdir -p "$STAGE/proyectos" "$STAGE/nueva"
cp "$WEB/proyectos/index.html" "$STAGE/proyectos/"
for d in "$WEB"/proyectos/*/; do
  slug=$(basename "$d")
  case "$slug" in _*) echo "   borrador (no sube): $slug"; continue;; esac
  cp -r "$d" "$STAGE/proyectos/$slug"
done
cp "$WEB/index.html" "$STAGE/nueva/index.html"
# la home en /nueva/ referencia assets/... de la raiz: reescribir a rutas absolutas
sed -i 's#href="assets/#href="/assets/#g; s#src="assets/#src="/assets/#g; s#href="proyectos/#href="/proyectos/#g; s#href="book-#href="/book-#g; s#href="download-guide#href="/download-guide#g; s#href="legales/#href="/legales/#g; s#href="unsubscribe/#href="/unsubscribe/#g' "$STAGE/nueva/index.html"

docker exec "$CONT" rm -rf /tmp/web-atlantis
docker cp "$STAGE" "$CONT:/tmp/web-atlantis"

# credenciales FTP: si el contenedor no las tiene (p. ej. se recreo sin ellas),
# tomarlas del .env del centro de mando y pasarlas con -e
ENV_CM="$AQUI/.env"
FTP_ENV=()
for v in FTP_HOST FTP_PORT FTP_USER FTP_PASS FTP_DIR; do
  if ! docker exec "$CONT" sh -c "printenv $v >/dev/null 2>&1"; then
    val=$(grep -m1 "^$v=" "$ENV_CM" 2>/dev/null | cut -d= -f2- || true)
    val="${val%\"}"; val="${val#\"}"
    [ -n "$val" ] && FTP_ENV+=(-e "$v=$val")
  fi
done

docker exec -i "${FTP_ENV[@]}" "$CONT" python3 - <<'PY'
import io
import os
import sys
from ftplib import FTP
from pathlib import Path

paquete = Path("/tmp/web-atlantis")
host = (os.environ.get("FTP_HOST") or "").replace("ftp://", "")
if not host or not os.environ.get("FTP_PASS"):
    print("ERROR: faltan credenciales FTP (FTP_HOST/FTP_USER/FTP_PASS); agregalas")
    print("a centro-de-mando/.env del VPS y re-corre este script.")
    sys.exit(3)
f = FTP()
f.connect(host, int(os.environ.get("FTP_PORT", "21")), timeout=30)
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
print(f"OK: {subidos} archivos subidos")

# fotos elegidas de la curaduria (/banco-candidatas/) -> /assets/fotos/
# copia servidor-a-servidor por FTP; si la galeria ya no existe, avisa y sigue
FOTOS = {
    "banco-candidatas/banco-03.jpg": "assets/fotos/atlantis-01.jpg",
    "banco-candidatas/banco-04.jpg": "assets/fotos/atlantis-02.jpg",
    "banco-candidatas/banco-06.jpg": "assets/fotos/atlantis-03.jpg",
}
asegurar("assets/fotos")
copiadas = 0
for origen, destino in FOTOS.items():
    try:
        buf = io.BytesIO()
        f.retrbinary(f"RETR {origen}", buf.write)
        buf.seek(0)
        f.storbinary(f"STOR {destino}", buf)
        copiadas += 1
    except Exception as e:  # noqa: BLE001
        print(f"  AVISO: no pude copiar {origen}: {str(e)[:70]}")
print(f"OK: {copiadas} fotos del banco copiadas a /assets/fotos/")
f.quit()
PY

docker exec "$CONT" rm -rf /tmp/web-atlantis

echo
echo "== Verificacion HTTP desde el host (debe decir 200) =="
for u in "https://$DOMINIO/proyectos/" "https://$DOMINIO/nueva/" \
         "https://$DOMINIO/assets/fotos/atlantis-01.jpg" \
         "https://$DOMINIO/assets/fotos/atlantis-02.jpg" \
         "https://$DOMINIO/assets/fotos/atlantis-03.jpg"; do
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 20 "$u" || echo ERR)
  echo "  [$code] $u"
done
echo
echo "La home NUEVA queda en borrador en https://$DOMINIO/nueva/ para tu revision."
echo "El indice de proyectos queda vivo en https://$DOMINIO/proyectos/."
