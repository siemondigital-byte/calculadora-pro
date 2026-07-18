"""Store del CRM: un solo JSON (/data/crm.json), escritura atomica, lock y backups.

Nunca llamar guardar() directo desde un endpoint o cron: usar app.guardar_seguro(),
que hace merge contra el disco (fill-missing + lapidas) antes de escribir.
"""
import json
import os
import shutil
import threading
from datetime import date

DATA_DIR = os.environ.get("DATA_DIR", "/data")
CRM_PATH = os.path.join(DATA_DIR, "crm.json")
BACKUP_DIR = os.path.join(DATA_DIR, "backups")
BACKUPS_MAX = 10

_lock = threading.Lock()


def leer():
    with _lock:
        if not os.path.exists(CRM_PATH):
            return None
        with open(CRM_PATH, encoding="utf-8") as f:
            return json.load(f)


def guardar(data):
    with _lock:
        os.makedirs(DATA_DIR, exist_ok=True)
        _backup_diario()
        tmp = CRM_PATH + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False)
        os.replace(tmp, CRM_PATH)


def _backup_diario():
    if not os.path.exists(CRM_PATH):
        return
    os.makedirs(BACKUP_DIR, exist_ok=True)
    destino = os.path.join(BACKUP_DIR, f"crm-{date.today().isoformat()}.json")
    if not os.path.exists(destino):
        shutil.copy2(CRM_PATH, destino)
    respaldos = sorted(
        f for f in os.listdir(BACKUP_DIR)
        if f.startswith("crm-") and f.endswith(".json")
    )
    for viejo in respaldos[:-BACKUPS_MAX]:
        try:
            os.remove(os.path.join(BACKUP_DIR, viejo))
        except OSError:
            pass
