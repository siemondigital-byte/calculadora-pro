#!/usr/bin/env bash
# Instalador del motor de prospeccion.
# El NUCLEO (OSM + analisis + CLI + API) corre en Python 3.9+ (el que ya tienes).
# El colector de Google Maps necesita Python 3.10+ y Scrapling.
set -e
cd "$(dirname "$0")"

PY="${PYTHON:-python3}"
echo "Usando: $($PY --version)"

echo "1/3  Creando entorno virtual (.venv)…"
$PY -m venv .venv
source .venv/bin/activate

echo "2/3  Instalando dependencias del nucleo…"
pip install --quiet --upgrade pip
pip install --quiet fastapi "uvicorn[standard]" requests beautifulsoup4

# Google Maps: solo si el Python es 3.10+
VER=$($PY -c 'import sys;print(sys.version_info[:2]>=(3,10))')
if [ "$VER" = "True" ]; then
  echo "3/3  Python 3.10+ detectado -> instalando Scrapling (Google Maps)…"
  pip install --quiet "scrapling[fetchers]" || echo "   (Scrapling fallo; el nucleo funciona igual sin Google Maps)"
  python -m scrapling install || echo "   (recuerda correr 'scrapling install' para los navegadores)"
else
  echo "3/3  Python <3.10 -> se omite Google Maps. El nucleo (OSM) funciona igual."
  echo "     Para Google Maps: instala Python 3.11 desde python.org y corre  PYTHON=python3.11 ./setup.sh"
fi

echo ""
echo "Listo. Activa el entorno con:  source .venv/bin/activate"
echo "Prueba:  python cli.py --sector dentista --ciudad 'Barcelona, España' --servicio automatizacion --n 15"
echo "API:     uvicorn app:app --port 8010"
