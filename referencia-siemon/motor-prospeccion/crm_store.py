"""Almacen del CRM en el propio VPS (reemplaza a Supabase). Guarda TODO el
documento `data` de la app como un JSON en un volumen Docker. Single-user (Andrea),
escritura atomica con lock. Sin dependencias externas."""
import os
import json
import threading

RUTA = os.environ.get("CRM_DATA", "/data/crm.json")
_lock = threading.Lock()


def leer():
    try:
        with open(RUTA, encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return None


def guardar(data):
    with _lock:
        os.makedirs(os.path.dirname(RUTA) or ".", exist_ok=True)
        # respaldo diario del estado anterior (recuperacion ante borrados accidentales)
        try:
            import datetime, glob, shutil
            bdir = os.path.join(os.path.dirname(RUTA) or ".", "backups")
            os.makedirs(bdir, exist_ok=True)
            bpath = os.path.join(bdir, "crm-" + datetime.date.today().isoformat() + ".json")
            if os.path.exists(RUTA) and not os.path.exists(bpath):
                shutil.copyfile(RUTA, bpath)
                for viejo in sorted(glob.glob(os.path.join(bdir, "crm-*.json")))[:-10]:
                    os.remove(viejo)
        except Exception:
            pass
        tmp = RUTA + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False)
        os.replace(tmp, RUTA)          # atomico: no se corrompe si falla a media escritura
    return data
