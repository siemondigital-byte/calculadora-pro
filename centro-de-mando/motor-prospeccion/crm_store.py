"""Store del CRM. Dos backends, misma interfaz leer()/guardar():

- 'sqlite' (recomendado): base transaccional en /data/crm.db, UNA FILA por
  workspace+coleccion. Atomico (WAL), sin corrupcion por escritura a medias.
  Ademas escribe un ESPEJO /data/crm.json (export + rollback instantaneo).
- 'json' (legado): un solo archivo /data/crm.json (comportamiento anterior).

Se elige con CRM_BACKEND=sqlite|json (default 'json': desplegar no cambia nada;
se pasa a 'sqlite' en el .env del VPS cuando la migracion este verificada).

Nunca llamar guardar() directo desde un endpoint o cron: usar app.guardar_seguro(),
que hace merge contra el disco (fill-missing + lapidas + union por id) antes de escribir.
"""
import glob
import json
import os
import shutil
import sqlite3
import threading
from datetime import date

DATA_DIR = os.environ.get("DATA_DIR", "/data")
CRM_PATH = os.path.join(DATA_DIR, "crm.json")
DB_PATH = os.path.join(DATA_DIR, "crm.db")
BACKUP_DIR = os.path.join(DATA_DIR, "backups")
BACKUPS_MAX = 10
BACKEND = (os.environ.get("CRM_BACKEND") or "json").strip().lower()

_lock = threading.Lock()

_SCALAR = "::scalar::"   # valor de nivel superior que NO es dict (p.ej. workspace, _rev)
_EMPTY = "::empty::"     # workspace con dict vacio (para preservarlo)


# ---------------- JSON (legado / espejo) ----------------

def _leer_json():
    if not os.path.exists(CRM_PATH):
        return None
    try:
        with open(CRM_PATH, encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return None


def _escribir_json(data):
    os.makedirs(DATA_DIR, exist_ok=True)
    tmp = CRM_PATH + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False)
    os.replace(tmp, CRM_PATH)


def _backup_diario():
    """Respaldo diario del crm.json + secretos cifrados + base sqlite.
    Conserva los BACKUPS_MAX mas recientes de cada uno."""
    try:
        os.makedirs(BACKUP_DIR, exist_ok=True)
        hoy = date.today().isoformat()
        objetivos = [
            (CRM_PATH, "crm-", ".json"),
            (os.path.join(DATA_DIR, "secretos.json"), "secretos-", ".json"),
            (DB_PATH, "crmdb-", ".db"),
        ]
        for origen, pref, ext in objetivos:
            if not os.path.exists(origen):
                continue
            destino = os.path.join(BACKUP_DIR, pref + hoy + ext)
            if not os.path.exists(destino):
                shutil.copy2(origen, destino)
                for viejo in sorted(glob.glob(os.path.join(BACKUP_DIR, pref + "*" + ext)))[:-BACKUPS_MAX]:
                    try:
                        os.remove(viejo)
                    except OSError:
                        pass
    except Exception:
        pass


# ---------------- SQLite ----------------

def _conn():
    c = sqlite3.connect(DB_PATH, timeout=30)
    c.execute("PRAGMA journal_mode=WAL")
    c.execute("PRAGMA busy_timeout=30000")
    c.execute("CREATE TABLE IF NOT EXISTS col (biz TEXT, name TEXT, val TEXT, PRIMARY KEY(biz,name))")
    return c


def _leer_sqlite():
    if not os.path.exists(DB_PATH):
        return _leer_json()                 # aun sin migrar: cae al espejo
    try:
        c = _conn()
        rows = c.execute("SELECT biz,name,val FROM col").fetchall()
        c.close()
    except Exception:
        return _leer_json()
    if not rows:
        return _leer_json()                 # base vacia: seguridad, usa el espejo
    d = {}
    for biz, name, val in rows:
        v = json.loads(val)
        if name == _SCALAR:
            d[biz] = v
        elif name == _EMPTY:
            d.setdefault(biz, {})
        else:
            d.setdefault(biz, {})[name] = v
    return d


def _escribir_sqlite(data):
    rows = []
    for biz, bv in (data or {}).items():
        if isinstance(bv, dict):
            if not bv:
                rows.append((biz, _EMPTY, "{}"))
            else:
                for name, v in bv.items():
                    rows.append((biz, name, json.dumps(v, ensure_ascii=False)))
        else:
            rows.append((biz, _SCALAR, json.dumps(bv, ensure_ascii=False)))
    c = _conn()
    try:
        c.execute("BEGIN IMMEDIATE")        # transaccion: todo o nada
        c.execute("DELETE FROM col")
        c.executemany("INSERT INTO col (biz,name,val) VALUES (?,?,?)", rows)
        c.commit()
    finally:
        c.close()


# ---------------- API publica ----------------

def leer():
    with _lock:
        if BACKEND == "sqlite":
            return _leer_sqlite()
        return _leer_json()


def guardar(data):
    with _lock:
        os.makedirs(DATA_DIR, exist_ok=True)
        _backup_diario()
        if BACKEND == "sqlite":
            _escribir_sqlite(data)          # fuente de verdad
            try:
                _escribir_json(data)        # espejo/export (rollback instantaneo)
            except Exception:
                pass
        else:
            _escribir_json(data)
    return data
