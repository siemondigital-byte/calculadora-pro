#!/usr/bin/env bash
# Publica web-emails/ en el hosting bajo /emails/ y VERIFICA que quedo servido.
#
# Correr EN EL VPS desde /root/atlantis/centro-de-mando:
#
#   bash scripts/publicar-emails-web.sh
#
# - La subida corre DENTRO del contenedor del motor, con el mismo FTP que el
#   motor usa para publicar la web corporativa (FTP_HOST/FTP_USER/FTP_PASS).
# - Detecta la carpeta publica del dominio (docroot): si la raiz del FTP no
#   trae el sitio (index.html/index.php), busca public_html o
#   domains/<dominio>/public_html. FTP_DIR en el entorno la fuerza a mano.
# - Al final pide por HTTP dos URLs publicadas y muestra el codigo (200 = ok).
set -euo pipefail

AQUI="$(cd "$(dirname "$0")/.." && pwd)"
PAQUETE="$AQUI/../web-emails"
[ -d "$PAQUETE" ] || { echo "ERROR: no existe $PAQUETE (corre primero generar-web-emails.py)"; exit 1; }

CONT=$(docker ps --format '{{.Names}}' | grep -m1 'motor' || true)
[ -n "$CONT" ] || { echo "ERROR: no encuentro el contenedor del motor corriendo"; exit 1; }

if ! docker exec "$CONT" sh -c '[ -n "$FTP_HOST" ]'; then
  echo "ERROR: el contenedor del motor no tiene FTP_HOST configurado."
  echo "Agrega FTP_HOST, FTP_USER y FTP_PASS al entorno del motor (los datos"
  echo "FTP de Hostinger, hPanel > Archivos > Cuentas FTP) y recrea el motor."
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

def listar():
    try:
        return set(f.nlst())
    except Exception:
        return set()

# --- ubicar el docroot del dominio ---
forzado = (os.environ.get("FTP_DIR") or "").strip().rstrip("/")
if forzado:
    f.cwd(forzado)
else:
    for _ in range(3):
        ls = listar()
        if "index.html" in ls or "index.php" in ls:
            break  # aqui vive el sitio
        if "public_html" in ls:
            f.cwd("public_html"); continue
        if "domains" in ls:
            try:
                f.cwd("domains/atlantisglobalrealty.com/public_html"); continue
            except Exception:
                pass
        break
ls = listar()
print("docroot FTP:", f.pwd(), "| sitio presente:", "index.html" in ls or "index.php" in ls)
if "index.html" not in ls and "index.php" not in ls:
    print("AVISO: en esta carpeta NO estan los archivos del sitio. Si la")
    print("verificacion HTTP de abajo falla, el dominio no se sirve desde esta")
    print("cuenta FTP (revisar en hPanel donde vive atlantisglobalrealty.com).")

def asegurar(d):
    try:
        f.mkd(d)
    except Exception:
        pass

asegurar("emails")
asegurar("emails/assets")
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
echo "== Verificacion HTTP (debe decir 200) =="
for u in \
  "https://atlantisglobalrealty.com/emails/assets/candado.png" \
  "https://atlantisglobalrealty.com/emails/mail-cambio-contrasena.html"; do
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 20 "$u" || echo ERR)
  echo "  [$code] $u"
done
