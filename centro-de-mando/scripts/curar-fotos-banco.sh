#!/usr/bin/env bash
# Trae al repo candidatas de fotografia del BANCO integrado del CRM
# (Pexels/Unsplash/Pixabay via motor /blog/fotos, claves en el vault) para la
# web nueva de Atlantis. Descarga ~16 fotos de arquitectura con su archivo de
# creditos (autor + banco + pagina) y las sube al repo para curaduria.
#
# Correr EN EL VPS desde /root/atlantis:
#
#   bash centro-de-mando/scripts/curar-fotos-banco.sh
set -euo pipefail

cd /root/atlantis
CONT=$(docker ps --format '{{.Names}}' | grep -m1 '^centro-de-mando-motor' || true)
[ -n "$CONT" ] || { echo "ERROR: no encuentro el contenedor centro-de-mando-motor"; exit 1; }

docker exec "$CONT" rm -rf /tmp/fotos-banco
docker exec -i "$CONT" python3 - <<'PY'
import json
import os

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
            except Exception as e:
                print("  fallo", nombre, str(e)[:80])
json.dump(creditos, open("/tmp/fotos-banco/creditos.json", "w"), ensure_ascii=False, indent=1)
print(f"OK: {len(creditos)} candidatas con creditos")
if not creditos:
    print("NINGUNA foto: agrega una API key gratis de Pexels/Pixabay/Unsplash en")
    print("el Centro de Mando (Accesos) y re-corre este script.")
PY

rm -rf fotos-banco
docker cp "$CONT:/tmp/fotos-banco" fotos-banco
docker exec "$CONT" rm -rf /tmp/fotos-banco
du -sh fotos-banco
git add fotos-banco && git commit -m "Candidatas del banco de imagenes para la web nueva (con creditos)" && git push -u origin claude/new-session-3rjwcr
