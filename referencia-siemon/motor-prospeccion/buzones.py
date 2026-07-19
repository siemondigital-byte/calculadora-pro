"""Almacen de buzones de correo (Hostinger u otros) para envio/recepcion de prospeccion.
Vive SOLO en el servidor (nunca se expone la contraseña al navegador)."""
import os
import json
import tempfile

RUTA = os.environ.get("BUZONES_DATA", "/data/buzones.json")


def leer():
    try:
        with open(RUTA) as f:
            return json.load(f)
    except Exception:
        return []


def guardar(lst):
    d = os.path.dirname(RUTA)
    os.makedirs(d, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=d)
    with os.fdopen(fd, "w") as f:
        json.dump(lst, f, ensure_ascii=False)
    os.replace(tmp, RUTA)


def buscar(bid):
    return next((b for b in leer() if b.get("id") == bid), None)
