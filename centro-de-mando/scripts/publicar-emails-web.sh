#!/usr/bin/env bash
# Publica web-emails/ en el hosting bajo /emails/ y VERIFICA que quedo servido.
#
# Correr EN EL VPS desde /root/atlantis/centro-de-mando:
#
#   bash scripts/publicar-emails-web.sh
#
# Encuentra la carpeta publica REAL de atlantisglobalrealty.com con un canario:
# sube un archivo de prueba a cada carpeta candidata del FTP y pide por HTTP
# cual responde (efecto, no intencion). Publica ahi y verifica con curl.
# FTP_DIR en el entorno del motor salta la deteccion y fuerza la carpeta.
set -euo pipefail

AQUI="$(cd "$(dirname "$0")/.." && pwd)"
PAQUETE="$AQUI/../web-emails"
DOMINIO="atlantisglobalrealty.com"
[ -d "$PAQUETE" ] || { echo "ERROR: no existe $PAQUETE (corre primero generar-web-emails.py)"; exit 1; }

# OJO: en el VPS conviven dos motores (atlantis y siemon); usar SIEMPRE el de
# este compose, no "el primero que se llame motor".
CONT=$(docker ps --format '{{.Names}}' | grep -m1 '^centro-de-mando-motor' || true)
[ -n "$CONT" ] || { echo "ERROR: no encuentro el contenedor centro-de-mando-motor corriendo"; exit 1; }
echo "usando contenedor: $CONT"

if ! docker exec "$CONT" sh -c '[ -n "$FTP_HOST" ]'; then
  echo "ERROR: el contenedor del motor no tiene FTP_HOST configurado."
  exit 1
fi

docker exec "$CONT" rm -rf /tmp/web-emails
docker cp "$PAQUETE" "$CONT:/tmp/web-emails"

docker exec -i -e DOMINIO="$DOMINIO" "$CONT" python3 - <<'PY'
import io
import os
import sys
from ftplib import FTP
from pathlib import Path

import httpx

DOMINIO = os.environ["DOMINIO"]
paquete = Path("/tmp/web-emails")

f = FTP()
f.connect(os.environ["FTP_HOST"].replace("ftp://", ""),
          int(os.environ.get("FTP_PORT", "21")), timeout=30)
f.login(os.environ.get("FTP_USER", ""), os.environ.get("FTP_PASS", ""))
raiz = f.pwd()

def existe_dir(ruta):
    try:
        f.cwd(ruta); f.cwd(raiz)
        return True
    except Exception:
        f.cwd(raiz)
        return False

# --- candidatas a carpeta publica del dominio ---
forzado = (os.environ.get("FTP_DIR") or "").strip().rstrip("/")
if forzado:
    candidatas = [forzado]
else:
    candidatas = [raiz]
    if existe_dir("public_html"):
        candidatas.append("public_html")
    if existe_dir("domains"):
        f.cwd("domains")
        for d in f.nlst():
            if d in (".", ".."):
                continue
            ruta = f"domains/{d}/public_html"
            f.cwd(raiz)
            if existe_dir(ruta):
                candidatas.append(ruta)
        f.cwd(raiz)

# --- canario: que carpeta sirve el dominio de verdad ---
ganadora = None
canarios = []
for i, c in enumerate(candidatas):
    try:
        f.cwd(c)
        nombre = f"canario-emails-{i}.txt"
        f.storbinary(f"STOR {nombre}", io.BytesIO(str(i).encode()))
        canarios.append((c, nombre))
    except Exception as e:
        print(f"   (no pude escribir en {c}: {e})")
    finally:
        f.cwd(raiz)
for i, (c, nombre) in enumerate(canarios):
    try:
        r = httpx.get(f"https://{DOMINIO}/{nombre}", timeout=15)
        ok = r.status_code == 200 and r.text.strip() == str(candidatas.index(c))
    except Exception:
        ok = False
    print(f"   candidata {c}: HTTP {'200 <- AQUI vive el dominio' if ok else 'no'}")
    if ok and not ganadora:
        ganadora = c
for c, nombre in canarios:  # limpiar canarios
    try:
        f.cwd(c); f.delete(nombre)
    except Exception:
        pass
    finally:
        f.cwd(raiz)

if not ganadora:
    print()
    print("ERROR: ninguna carpeta de esta cuenta FTP sirve a", DOMINIO)
    print("El dominio se sirve desde OTRO hosting (otra cuenta FTP u otro plan,")
    print("p. ej. el sitio esta en un hosting compartido distinto al del FTP del")
    print("motor). En hPanel: Sitios web > atlantisglobalrealty.com > Archivos >")
    print("Cuentas FTP, y pon esos datos como FTP_HOST/FTP_USER/FTP_PASS del motor.")
    sys.exit(2)

# --- publicar en la ganadora ---
f.cwd(ganadora)
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
print(f"OK: {subidos} archivos subidos a {ganadora}/emails/")
f.quit()
PY

docker exec "$CONT" rm -rf /tmp/web-emails

echo
echo "== Verificacion HTTP (debe decir 200) =="
for u in \
  "https://$DOMINIO/emails/assets/candado.png" \
  "https://$DOMINIO/emails/mail-cambio-contrasena.html"; do
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 20 "$u" || echo ERR)
  echo "  [$code] $u"
done
