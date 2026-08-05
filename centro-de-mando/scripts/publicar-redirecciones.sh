#!/usr/bin/env bash
# Publica las redirecciones que el libro cita:
#   /calculadora   -> app Calculadora Pro
#   /endeudamiento -> app Calculadora Pro (modulo de capacidad de endeudamiento)
# Paginas estaticas con meta refresh (no tocan el .htaccess del WordPress).
#
# Correr EN EL VPS desde /root/atlantis/centro-de-mando:
#
#   bash scripts/publicar-redirecciones.sh
set -euo pipefail

DOMINIO="atlantisglobalrealty.com"
DESTINO="https://wealthcycle-app.atlantisglobalrealty.com/"

CONT=$(docker ps --format '{{.Names}}' | grep -m1 '^centro-de-mando-motor' || true)
[ -n "$CONT" ] || { echo "ERROR: no encuentro el contenedor centro-de-mando-motor"; exit 1; }

STAGE=$(mktemp -d)
trap 'rm -rf "$STAGE"' EXIT
for ruta in calculadora endeudamiento; do
  mkdir -p "$STAGE/$ruta"
  cat > "$STAGE/$ruta/index.html" <<HTML
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="refresh" content="0;url=$DESTINO">
<link rel="canonical" href="$DESTINO">
<title>Calculadora de Viabilidad Inmobiliaria Pro</title>
<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0A0A0C;color:#F4EFE6;font-family:Figtree,Inter,Helvetica,Arial,sans-serif}a{color:#E6C788}</style>
</head>
<body>
<p>Te llevamos a la Calculadora&hellip; Si no avanza, <a href="$DESTINO">entra aquí</a>.</p>
<script>location.replace("$DESTINO");</script>
</body>
</html>
HTML
done

docker exec "$CONT" rm -rf /tmp/redirecciones
docker cp "$STAGE" "$CONT:/tmp/redirecciones"

docker exec -i "$CONT" python3 - <<'PY'
import os
from ftplib import FTP
from pathlib import Path

paquete = Path("/tmp/redirecciones")
f = FTP()
f.connect(os.environ["FTP_HOST"].replace("ftp://", ""),
          int(os.environ.get("FTP_PORT", "21")), timeout=30)
f.login(os.environ.get("FTP_USER", ""), os.environ.get("FTP_PASS", ""))
destino = (os.environ.get("FTP_DIR") or "").strip().rstrip("/")
if destino:
    f.cwd(destino)
for p in sorted(paquete.rglob("*")):
    if not p.is_file():
        continue
    remoto = str(p.relative_to(paquete)).replace("\\", "/")
    try:
        f.mkd(remoto.rsplit("/", 1)[0])
    except Exception:
        pass
    with open(p, "rb") as fh:
        f.storbinary(f"STOR {remoto}", fh)
    print("  subido", remoto)
f.quit()
PY

docker exec "$CONT" rm -rf /tmp/redirecciones

echo
echo "== Verificacion (200 y que el HTML apunte a la app) =="
for u in "https://$DOMINIO/calculadora/" "https://$DOMINIO/endeudamiento/" "https://$DOMINIO/calculadora" "https://$DOMINIO/endeudamiento"; do
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 20 "$u" || echo ERR)
  echo "  [$code] $u"
done
curl -s --max-time 20 "https://$DOMINIO/calculadora/" | grep -o 'url=[^"]*' | head -1
