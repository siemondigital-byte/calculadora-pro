#!/usr/bin/env bash
# Galeria de seleccion de fotografia para la web nueva de Atlantis.
#
# Trae candidatas del BANCO integrado del CRM (Pexels/Unsplash/Pixabay via
# motor /blog/fotos, claves en el vault) y las publica en el sitio como una
# galeria privada de curaduria:
#
#   https://atlantisglobalrealty.com/banco-candidatas/
#
# La duena la abre en el navegador y elige por numero ("la 03, la 07 y la 12");
# el agente integra las elegidas en la home y las landings. Requiere al menos
# una API key gratis en el Centro de Mando > Accesos: PEXELS_KEY (pexels.com/api),
# PIXABAY_KEY (pixabay.com/api/docs) o UNSPLASH_KEY.
#
# Correr EN EL VPS desde /root/atlantis:
#
#   bash centro-de-mando/scripts/curar-fotos-banco.sh
set -euo pipefail

DOMINIO="atlantisglobalrealty.com"
CONT=$(docker ps --format '{{.Names}}' | grep -m1 '^centro-de-mando-motor' || true)
[ -n "$CONT" ] || { echo "ERROR: no encuentro el contenedor centro-de-mando-motor"; exit 1; }

# credenciales FTP: si el contenedor no las tiene (p. ej. se recreo sin ellas),
# tomarlas del .env del centro de mando y pasarlas con -e
ENV_CM="$(cd "$(dirname "$0")/.." && pwd)/.env"
FTP_ENV=()
for v in FTP_HOST FTP_PORT FTP_USER FTP_PASS FTP_DIR; do
  if ! docker exec "$CONT" sh -c "printenv $v >/dev/null 2>&1"; then
    val=$(grep -m1 "^$v=" "$ENV_CM" 2>/dev/null | cut -d= -f2- || true)
    val="${val%\"}"; val="${val#\"}"
    [ -n "$val" ] && FTP_ENV+=(-e "$v=$val")
  fi
done

if docker exec "$CONT" test -f /tmp/fotos-banco/index.html 2>/dev/null; then
  echo "== Candidatas ya descargadas en el contenedor; paso directo a publicar =="
else
docker exec "$CONT" rm -rf /tmp/fotos-banco
docker exec -i "$CONT" python3 - <<'PY'
import json
import os
import sys

import httpx

BASE = "http://127.0.0.1:8000"
H = {"Authorization": "Bearer " + os.environ["CRON_KEY"]}
BUSQUEDAS = [
    "modern residential tower dusk",
    "luxury apartment building facade",
    "city skyline waterfront night",
    "modern penthouse interior",
]
os.makedirs("/tmp/fotos-banco", exist_ok=True)
creditos, n = [], 0
with httpx.Client(timeout=60) as c:
    for q in BUSQUEDAS:
        r = c.post(f"{BASE}/blog/fotos", headers=H,
                   json={"query": q, "orientation": "landscape"}).json()
        if not r.get("ok"):
            print(f"AVISO '{q}': {r.get('error')} {r.get('nota', '')}")
            continue
        for f in r["fotos"][:4]:
            n += 1
            nombre = f"banco-{n:02d}.jpg"
            try:
                img = c.get(f["url"], follow_redirects=True)
                open(f"/tmp/fotos-banco/{nombre}", "wb").write(img.content)
                creditos.append({"archivo": nombre, "busqueda": q,
                                 "autor": f.get("autor"), "banco": f.get("banco"),
                                 "pagina": f.get("pagina")})
                print("  descargada", nombre, "·", f.get("banco"), "·", f.get("autor"))
            except Exception as e:  # noqa: BLE001
                print("  fallo", nombre, str(e)[:80])

if not creditos:
    print("NINGUNA foto: agrega una API key gratis en el Centro de Mando > Accesos")
    print("(PEXELS_KEY, PIXABAY_KEY o UNSPLASH_KEY) y re-corre este script.")
    sys.exit(2)

json.dump(creditos, open("/tmp/fotos-banco/creditos.json", "w"),
          ensure_ascii=False, indent=1)

# galeria de seleccion (pagina simple, oscura, numerada)
tarjetas = "".join(
    f'<figure><img src="{c["archivo"]}" loading="lazy">'
    f'<figcaption><b>{c["archivo"][6:8]}</b> · {c["banco"]} · {c["autor"]}<br>'
    f'<span>{c["busqueda"]}</span></figcaption></figure>'
    for c in creditos)
open("/tmp/fotos-banco/index.html", "w").write(f"""<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>Seleccion de fotografia · uso interno</title>
<style>body{{margin:0;background:#0A0A0C;color:#F4EFE6;font-family:Figtree,Inter,Helvetica,Arial,sans-serif;padding:30px}}
h1{{font-weight:600;font-size:22px}}p{{color:#D7D7D9}}
.g{{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:18px;margin-top:22px}}
figure{{margin:0;border:1px solid rgba(201,168,126,.25);border-radius:6px;overflow:hidden}}
img{{width:100%;height:220px;object-fit:cover;display:block}}
figcaption{{padding:10px 14px;font-size:12.5px;color:#D7D7D9}}
figcaption b{{color:#E6C788;font-size:16px}}figcaption span{{color:#8a8f98}}</style>
</head><body>
<h1>Selección de fotografía · uso interno</h1>
<p>Dile al agente los números elegidos (ej. "usa la 03, la 07 y la 12").</p>
<div class="g">{tarjetas}</div>
</body></html>""")
print(f"OK: {len(creditos)} candidatas listas para publicar")
PY
fi

# publicar la galeria en el sitio (mismo FTP del motor)
docker exec -i "${FTP_ENV[@]}" "$CONT" python3 - <<'PY'
import os
import sys
from ftplib import FTP
from pathlib import Path

host = (os.environ.get("FTP_HOST") or "").replace("ftp://", "")
if not host or not os.environ.get("FTP_PASS"):
    print("ERROR: faltan credenciales FTP (ni el contenedor ni centro-de-mando/.env")
    print("las tienen). Agrega estas lineas a /root/atlantis/centro-de-mando/.env:")
    print("  FTP_HOST=88.223.85.106")
    print("  FTP_USER=u428247534.atlantisglobalrealty.com")
    print("  FTP_PASS=<la contrasena FTP de Hostinger>")
    print("y re-corre este script (las fotos descargadas se conservan).")
    sys.exit(3)

paquete = Path("/tmp/fotos-banco")
f = FTP()
f.connect(host, int(os.environ.get("FTP_PORT", "21")), timeout=30)
f.login(os.environ.get("FTP_USER", ""), os.environ.get("FTP_PASS", ""))
destino = (os.environ.get("FTP_DIR") or "").strip().rstrip("/")
if destino:
    f.cwd(destino)
try:
    f.mkd("banco-candidatas")
except Exception:
    pass
n = 0
for p in sorted(paquete.iterdir()):
    if p.is_file():
        with open(p, "rb") as fh:
            f.storbinary(f"STOR banco-candidatas/{p.name}", fh)
        n += 1
f.quit()
print(f"OK: {n} archivos publicados en /banco-candidatas/")
PY

docker exec "$CONT" rm -rf /tmp/fotos-banco
echo
code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 20 "https://$DOMINIO/banco-candidatas/" || echo ERR)
echo "  [$code] https://$DOMINIO/banco-candidatas/"
echo "Abre esa URL, mira las candidatas y dile al agente los numeros elegidos."
