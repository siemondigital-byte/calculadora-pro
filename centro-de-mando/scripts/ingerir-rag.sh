#!/usr/bin/env bash
# Ingesta el conocimiento destilado de la sesion (centro-de-mando/rag-ingesta/
# *.json) al RAG del motor (Voyage + Qdrant) y verifica EN VIVO con una
# busqueda. Cada archivo es un array de {doc_id, tipo, texto}; el doc_id
# determinista 'fuente:tema' hace que re-ingerir ACTUALICE, no duplique.
#
# Requiere VOYAGE_API_KEY en el Centro de Mando > Accesos (o en el entorno)
# y el Qdrant del VPS alcanzable (QDRANT_URL).
#
# Correr EN EL VPS desde /root/atlantis (tras git pull; si cambio el codigo
# del motor, antes: cd centro-de-mando && docker compose up -d --build motor):
#
#   bash centro-de-mando/scripts/ingerir-rag.sh
set -euo pipefail

AQUI="$(cd "$(dirname "$0")/.." && pwd)"
CONT=$(docker ps --format '{{.Names}}' | grep -m1 '^centro-de-mando-motor' || true)
[ -n "$CONT" ] || { echo "ERROR: no encuentro el contenedor centro-de-mando-motor"; exit 1; }

ls "$AQUI"/rag-ingesta/*.json >/dev/null 2>&1 \
  || { echo "ERROR: no hay archivos en $AQUI/rag-ingesta/"; exit 1; }

docker exec "$CONT" rm -rf /tmp/rag-ingesta
docker cp "$AQUI/rag-ingesta" "$CONT:/tmp/rag-ingesta"

estado=0
docker exec -i "$CONT" python3 - <<'PY' || estado=$?
import json
import os
import sys
from pathlib import Path

import httpx

BASE = "http://127.0.0.1:8000"
H = {"Authorization": "Bearer " + os.environ["CRON_KEY"]}
# Voyage gratis: 3 RPM; el motor reintenta con espera, asi que damos margen
c = httpx.Client(timeout=300)

# el motor puede estar recien reconstruido: esperar a que escuche
import time
for _ in range(60):
    try:
        c.get(f"{BASE}/", timeout=5)
        break
    except Exception:
        time.sleep(2)
else:
    print("ERROR: el motor no respondio en 120s; mira docker logs del contenedor")
    sys.exit(2)

st = c.get(f"{BASE}/rag/estado", headers=H).json()
if not st.get("voyage"):
    print("ERROR: falta VOYAGE_API_KEY. Agregala en Centro de Mando > Accesos")
    print("(clave gratis en dash.voyageai.com) y re-corre este script.")
    sys.exit(2)
if not st.get("ok"):
    print(f"ERROR: el RAG no responde ({st.get('error')}). Revisa que el Qdrant")
    print("del VPS este arriba y que QDRANT_URL apunte a el en el compose/.env.")
    sys.exit(2)
print(f"RAG arriba: {st.get('puntos', 0)} fragmento(s) antes de la ingesta")

fallos, ultimo = 0, None
for archivo in sorted(Path("/tmp/rag-ingesta").glob("*.json")):
    if archivo.name.startswith("_"):
        continue          # _verificaciones.json y similares no son documentos
    docs = json.loads(archivo.read_text(encoding="utf-8"))
    print(f"== {archivo.name}: {len(docs)} documento(s) ==")
    for d in docs:
        r = c.post(f"{BASE}/rag/aprender", headers=H, json=d).json()
        if r.get("ok"):
            print(f"   ingerido: {d.get('doc_id')}")
            ultimo = d
        else:
            fallos += 1
            print(f"   FALLO {d.get('doc_id')}: {r.get('error', r)}")

st = c.get(f"{BASE}/rag/estado", headers=H).json()
print(f"\nRAG despues de la ingesta: {st.get('puntos', 0)} fragmento(s)")

# verificacion en vivo: el ultimo doc ingerido + las consultas declaradas
pruebas = []
if ultimo:
    pruebas.append({"consulta": " ".join(ultimo["texto"].split()[:8]),
                    "esperado": ultimo["doc_id"]})
extra = Path("/tmp/rag-ingesta/_verificaciones.json")
if extra.exists():
    pruebas += json.loads(extra.read_text(encoding="utf-8"))
for p in pruebas:
    r = c.post(f"{BASE}/rag/buscar", headers=H,
               json={"q": p["consulta"], "k": 5}).json()
    ids = [x.get("doc_id") for x in r.get("resultados", [])]
    if p["esperado"] in ids:
        print(f"VERIFICADO: '{p['esperado']}' responde a \"{p['consulta']}\"")
    else:
        fallos += 1
        print(f"FALLO de verificacion: '{p['esperado']}' no aparece para "
              f"\"{p['consulta']}\" ({ids})")

sys.exit(1 if fallos else 0)
PY
docker exec "$CONT" rm -rf /tmp/rag-ingesta
[ "$estado" -eq 0 ] && echo "INGESTA COMPLETA." || echo "INGESTA CON FALLOS (revisa arriba)."
exit "$estado"
