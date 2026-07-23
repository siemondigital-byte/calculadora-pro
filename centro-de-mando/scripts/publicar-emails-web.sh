#!/usr/bin/env bash
# Publica web-emails/ en el hosting bajo /emails/ (versiones web de los correos).
# Correr EN EL VPS desde /root/atlantis/centro-de-mando (usa el FTP del motor):
#
#   bash scripts/publicar-emails-web.sh
#
# Lee FTP_HOST / FTP_USER / FTP_PASSWORD / FTP_DIR del .env del compose (los
# mismos que usa el motor para publicar la web). No imprime credenciales.
set -euo pipefail

AQUI="$(cd "$(dirname "$0")/.." && pwd)"
PAQUETE="$AQUI/../web-emails"
[ -d "$PAQUETE" ] || { echo "ERROR: no existe $PAQUETE (corre primero generar-web-emails.py)"; exit 1; }
[ -f "$AQUI/.env" ] || { echo "ERROR: no encuentro $AQUI/.env"; exit 1; }

set -a; . "$AQUI/.env"; set +a
: "${FTP_HOST:?FTP_HOST no esta en .env}"
: "${FTP_USER:?FTP_USER no esta en .env}"
: "${FTP_PASSWORD:?FTP_PASSWORD no esta en .env}"

PAQUETE="$PAQUETE" python3 - <<'PY'
import os
from ftplib import FTP
from pathlib import Path

paquete = Path(os.environ["PAQUETE"]).resolve()
base = (os.environ.get("FTP_DIR") or "").strip().rstrip("/")

ftp = FTP(os.environ["FTP_HOST"], timeout=30)
ftp.login(os.environ["FTP_USER"], os.environ["FTP_PASSWORD"])
if base:
    ftp.cwd(base)

def asegurar(d):
    try:
        ftp.mkd(d)
    except Exception:
        pass

asegurar("emails")
asegurar("emails/assets")
subidos = 0
for f in sorted(paquete.rglob("*")):
    if not f.is_file():
        continue
    remoto = "emails/" + str(f.relative_to(paquete)).replace("\\", "/")
    with open(f, "rb") as fh:
        ftp.storbinary(f"STOR {remoto}", fh)
    subidos += 1
    print("  subido", remoto)
ftp.quit()
print(f"OK: {subidos} archivos publicados bajo /emails/")
PY

echo
echo "Verifica: https://atlantisglobalrealty.com/emails/descarga-guia.html"
echo "          https://atlantisglobalrealty.com/emails/assets/wordmark.png"
