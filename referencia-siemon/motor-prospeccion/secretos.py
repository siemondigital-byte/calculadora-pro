"""Almacen de secretos (claves de API) server-side. Nunca se exponen al navegador."""
import os
import json
import tempfile

RUTA = os.environ.get("SECRETS_DATA", "/data/secretos.json")


def leer():
    try:
        with open(RUTA) as f:
            return json.load(f)
    except Exception:
        return {}


def guardar(d):
    carp = os.path.dirname(RUTA)
    os.makedirs(carp, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=carp)
    with os.fdopen(fd, "w") as f:
        json.dump(d, f)
    os.replace(tmp, RUTA)


def get(clave, default=""):
    return os.environ.get(clave) or leer().get(clave) or default


def set_(clave, valor):
    d = leer()
    d[clave] = valor
    guardar(d)
