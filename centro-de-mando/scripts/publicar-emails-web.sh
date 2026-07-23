#!/usr/bin/env bash
# Publica web-emails/ en el hosting bajo /emails/ y VERIFICA por HTTP.
#
# Correr EN EL VPS desde /root/atlantis/centro-de-mando:
#
#   bash scripts/publicar-emails-web.sh
#
# La cuenta FTP del sitio (u...atlantisglobalrealty.com) entra DIRECTO al
# public_html del dominio, asi que se sube en la raiz de la sesion. FTP_DIR
# en el entorno del motor fuerza otra carpeta si algun dia cambia el hosting.
# La verificacion HTTP corre en el HOST (desde dentro del contenedor no
# resuelve el dominio correctamente).
set -euo pipefail

AQUI="$(cd "$(dirname "$0")/.." && pwd)"
PAQUETE="$AQUI/../web-emails"
DOMINIO="atlantisglobalrealty.com"
[ -d "$PAQUETE" ] || { echo "ERROR: no existe $PAQUETE (corre primero generar-web-emails.py)"; exit 1; }

# en el VPS conviven dos motores (atlantis y siemon); usar SIEMPRE el de este compose
CONT=$(docker ps --format '{{.Names}}' | grep -m1 '^centro-de-mando-motor' || true)
[ -n "$CONT" ] || { echo "ERROR: no encuentro el contenedor centro-de-mando-motor corriendo"; exit 1; }
echo "usando contenedor: $CONT"

if ! docker exec "$CONT" sh -c '[ -n "$FTP_HOST" ]'; then
  echo "ERROR: el contenedor del motor no tiene FTP_HOST configurado (.env + recrear motor)."
  exit 1
fi

docker exec "$CONT" rm -rf /tmp/web-emails
docker cp "$PAQUETE" "$CONT:/tmp/web-emails"

docker exec -i "$CONT" python3 - <<'PY'
import os
from ftplib import FTP
from pathlib import Path

paquete = Path("/tmp/web-emails")
f = FTP()
f.connect(os.environ["FTP_HOST"].replace("ftp://", ""),
          int(os.environ.get("FTP_PORT", "21")), timeout=30)
f.login(os.environ.get("FTP_USER", ""), os.environ.get("FTP_PASS", ""))
destino = (os.environ.get("FTP_DIR") or "").strip().rstrip("/")
if destino:
    f.cwd(destino)
for d in ("emails", "emails/assets"):
    try:
        f.mkd(d)
    except Exception:
        pass
subidos = 0
for p in sorted(paquete.rglob("*")):
    if not p.is_file():
        continue
    remoto = "emails/" + str(p.relative_to(paquete))
    with open(p, "rb") as fh:
        f.storbinary(f"STOR {remoto}", fh)
    subidos += 1
print(f"OK: {subidos} archivos subidos a {f.pwd()}/emails/")
f.quit()
PY

docker exec "$CONT" rm -rf /tmp/web-emails

echo
echo "== Verificacion HTTP desde el host (debe decir 200) =="
fallo=0
for u in \
  "https://$DOMINIO/emails/assets/candado.png" \
  "https://$DOMINIO/emails/mail-cambio-contrasena.html" \
  "https://$DOMINIO/emails/descarga-guia.html"; do
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 20 "$u" || echo ERR)
  echo "  [$code] $u"
  [ "$code" = "200" ] || fallo=1
done
[ "$fallo" = "0" ] && echo "PUBLICACION VERIFICADA." || echo "AVISO: alguna URL no dio 200; pegale esta salida al agente."
