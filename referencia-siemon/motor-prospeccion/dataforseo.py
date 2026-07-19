"""Cliente de DataForSEO: el 'expansor' de SEO.
Metes UNA semilla y devuelve las variantes con VOLUMEN + DIFICULTAD + CPC (Google).
Auth HTTP Basic (login/clave de API, guardados en secretos, nunca al navegador).
Cachea por semilla+pais en /data/dfs_cache.json (DataForSEO es pago por uso).
"""
import os
import time
import math
import json as _json
import requests
import secretos as _sec

BASE = "https://api.dataforseo.com/v3"
CACHE_PATH = os.environ.get("DFS_CACHE", "/data/dfs_cache.json")
CACHE_DIAS = 30

_LOC = {"co": "Colombia", "mx": "Mexico", "es": "Spain", "ar": "Argentina",
        "us": "United States", "pe": "Peru", "cl": "Chile", "latam": "Mexico"}
_LANG = {"us": "English"}


def _cred():
    return (_sec.get("DATAFORSEO_LOGIN") or "").strip(), (_sec.get("DATAFORSEO_PASSWORD") or "").strip()


def hay_credenciales():
    lo, pw = _cred()
    return bool(lo and pw)


def _norm(s):
    import unicodedata
    s = unicodedata.normalize("NFKD", (s or "").strip().lower())
    return "".join(c for c in s if not unicodedata.combining(c))


def _cargar():
    try:
        with open(CACHE_PATH, "r", encoding="utf-8") as f:
            return _json.load(f)
    except Exception:
        return {}


def _guardar(c):
    try:
        with open(CACHE_PATH, "w", encoding="utf-8") as f:
            _json.dump(c, f, ensure_ascii=False)
    except Exception:
        pass


def _num(v):
    if v is None:
        return None
    try:
        return int(round(float(v)))
    except Exception:
        return None


def _oportunidad(f):
    vol = f.get("volumen") or 0
    dif = f.get("dificultad")
    vscore = min(80, 20 * math.log10(vol + 1)) if vol else 0
    dscore = (100 - dif) * 0.2 if isinstance(dif, (int, float)) else 8
    return round(vscore + dscore)


def verificar():
    """Comprueba las credenciales sin gastar (endpoint de usuario)."""
    lo, pw = _cred()
    if not (lo and pw):
        return {"ok": False, "error": "sin_credenciales"}
    try:
        r = requests.get(BASE + "/appendix/user_data", auth=(lo, pw), timeout=25)
        if r.status_code == 401:
            return {"ok": False, "error": "credenciales_invalidas"}
        if r.status_code >= 400:
            return {"ok": False, "error": f"dfs_{r.status_code}", "detalle": r.text[:200]}
        d = (((r.json().get("tasks") or [{}])[0]).get("result") or [{}])[0] or {}
        money = (d.get("money") or {})
        return {"ok": True, "saldo": money.get("balance"), "moneda": (money.get("currency") or "USD")}
    except Exception as e:
        return {"ok": False, "error": "dfs_conexion", "detalle": str(e)[:150]}


def tendencia(keyword, pais="co"):
    """Google Trends via DataForSEO: dice si el interes sube, baja o esta estable + busquedas en aumento."""
    kw = (keyword or "").strip()
    if not kw:
        return {"ok": False, "error": "falta keyword"}
    lo, pw = _cred()
    if not (lo and pw):
        return {"ok": False, "error": "sin_credenciales"}
    pais = (pais or "co").lower()
    loc = _LOC.get(pais, "Colombia")
    body = [{"keywords": [kw], "location_name": loc, "time_range": "past_12_months",
             "language_name": _LANG.get(pais, "Spanish")}]
    try:
        r = requests.post(BASE + "/keywords_data/google_trends/explore/live",
                          auth=(lo, pw), json=body, timeout=60)
    except Exception as e:
        return {"ok": False, "error": "dfs_conexion", "detalle": str(e)[:150]}
    if r.status_code >= 400:
        msg = ""
        try:
            msg = r.json().get("status_message") or ""
        except Exception:
            msg = r.text[:200]
        if "verify" in msg.lower() or "40104" in msg:
            return {"ok": False, "error": "verificar_cuenta"}
        return {"ok": False, "error": f"dfs_{r.status_code}", "detalle": msg[:200]}
    try:
        items = (((r.json().get("tasks") or [{}])[0].get("result") or [{}])[0] or {}).get("items") or []
    except Exception:
        return {"ok": False, "error": "respuesta_invalida"}
    serie, rising = [], []
    for it in items:
        t = it.get("type")
        if t == "google_trends_graph":
            for pt in (it.get("data") or []):
                vals = pt.get("values") or []
                v = next((x for x in vals if x is not None), None)
                if v is not None:
                    serie.append(v)
        elif t in ("google_trends_queries_list", "google_trends_topics_list"):
            for sub in (((it.get("data") or {}).get("rising")) or []):
                q = sub.get("query") or sub.get("topic_title")
                if q:
                    rising.append(q)
    direccion = "estable"
    if len(serie) >= 6:
        ini = sum(serie[:3]) / 3.0
        fin = sum(serie[-3:]) / 3.0
        if fin > ini * 1.2:
            direccion = "subiendo"
        elif fin < ini * 0.8:
            direccion = "bajando"
    return {"ok": True, "keyword": kw, "direccion": direccion, "en_aumento": rising[:6], "puntos": len(serie)}


def competencia(dominio, pais="co", limite=60):
    """Keywords por las que POSICIONA un competidor (ranked_keywords): keyword + volumen + dificultad + su posicion."""
    dom = (dominio or "").strip().lower()
    dom = dom.replace("https://", "").replace("http://", "").split("/")[0].strip()
    if not dom or "." not in dom:
        return {"ok": False, "error": "dominio_invalido", "nota": "Escribe un dominio válido (ej. automaxia.com)."}
    lo, pw = _cred()
    if not (lo and pw):
        return {"ok": False, "error": "sin_credenciales"}
    pais = (pais or "co").lower()
    loc = _LOC.get(pais, "Colombia")
    lang = _LANG.get(pais, "Spanish")
    body = [{"target": dom, "location_name": loc, "language_name": lang, "limit": limite,
             "order_by": ["keyword_data.keyword_info.search_volume,desc"]}]
    try:
        r = requests.post(BASE + "/dataforseo_labs/google/ranked_keywords/live",
                          auth=(lo, pw), json=body, timeout=90)
    except Exception as e:
        return {"ok": False, "error": "dfs_conexion", "detalle": str(e)[:150]}
    if r.status_code == 402:
        return {"ok": False, "error": "sin_saldo"}
    if r.status_code >= 400:
        msg = ""
        try:
            msg = r.json().get("status_message") or ""
        except Exception:
            msg = r.text[:200]
        if "verify" in msg.lower() or "40104" in msg:
            return {"ok": False, "error": "verificar_cuenta"}
        return {"ok": False, "error": f"dfs_{r.status_code}", "detalle": msg[:200]}
    try:
        tarea = (r.json().get("tasks") or [{}])[0] or {}
        res = (tarea.get("result") or [{}])[0] or {}
        items = res.get("items") or []
    except Exception:
        return {"ok": False, "error": "respuesta_invalida"}
    filas, vistos = [], set()
    for it in items:
        kd = it.get("keyword_data") or {}
        kw = (kd.get("keyword") or "").strip().lower()
        if not kw or kw in vistos:
            continue
        vistos.add(kw)
        ki = kd.get("keyword_info") or {}
        kp = kd.get("keyword_properties") or {}
        serp = (it.get("ranked_serp_element") or {}).get("serp_item") or {}
        pos = serp.get("rank_group") or serp.get("rank_absolute")
        filas.append({"keyword": kw, "volumen": _num(ki.get("search_volume")),
                      "dificultad": _num(kp.get("keyword_difficulty")),
                      "posicion": _num(pos), "competencia": kd.get("competition_level") or ""})
    filas.sort(key=lambda f: (f.get("volumen") or 0), reverse=True)
    return {"ok": True, "dominio": dom, "total": len(filas), "keywords": filas[:limite]}


def ideas(seed, pais="co", limite=60, forzar=False):
    """Devuelve {ok, seed, keywords:[{keyword,volumen,dificultad,cpc,competencia,oportunidad}]}."""
    seed = (seed or "").strip()
    if not seed:
        return {"ok": False, "error": "falta la semilla"}
    lo, pw = _cred()
    if not (lo and pw):
        return {"ok": False, "error": "sin_credenciales", "nota": "Conecta tu cuenta de DataForSEO primero."}
    pais = (pais or "co").lower()
    loc = _LOC.get(pais, "Colombia")
    lang = _LANG.get(pais, "Spanish")
    clave = f"{pais}:{_norm(seed)}"
    cache = _cargar()
    ent = cache.get(clave)
    if ent and not forzar and (time.time() - ent.get("ts", 0) < CACHE_DIAS * 86400):
        return {"ok": True, "seed": seed, "pais": pais, "fuente": "cache",
                "total": len(ent["filas"]), "keywords": ent["filas"], "nota": "Reutilizado (sin gastar)."}
    body = [{"keyword": seed, "location_name": loc, "language_name": lang,
             "limit": limite, "include_seed_keyword": True,
             "order_by": ["keyword_info.search_volume,desc"]}]
    try:
        r = requests.post(BASE + "/dataforseo_labs/google/keyword_suggestions/live",
                          auth=(lo, pw), json=body, timeout=90)
    except Exception as e:
        return {"ok": False, "error": "dfs_conexion", "detalle": str(e)[:150]}
    if r.status_code == 401:
        return {"ok": False, "error": "credenciales_invalidas", "nota": "Usuario o clave de API incorrectos."}
    if r.status_code == 402:
        return {"ok": False, "error": "sin_saldo", "nota": "Tu cuenta de DataForSEO no tiene saldo."}
    if r.status_code >= 400:
        msg = ""
        try:
            jr = r.json()
            msg = jr.get("status_message") or ((jr.get("tasks") or [{}])[0] or {}).get("status_message") or ""
        except Exception:
            msg = r.text[:200]
        if "verify" in msg.lower() or "40104" in msg:
            return {"ok": False, "error": "verificar_cuenta",
                    "nota": "DataForSEO necesita que verifiques tu cuenta antes de usar la API. Hazlo en app.dataforseo.com."}
        return {"ok": False, "error": f"dfs_{r.status_code}", "detalle": msg[:200]}
    try:
        d = r.json()
        tarea = (d.get("tasks") or [{}])[0] or {}
        if tarea.get("status_code") and int(tarea.get("status_code")) >= 40000:
            return {"ok": False, "error": "dfs_tarea", "detalle": (tarea.get("status_message") or "")[:200]}
        res = (tarea.get("result") or [{}])[0] or {}
        items = res.get("items") or []
    except Exception as e:
        return {"ok": False, "error": "respuesta_invalida", "detalle": str(e)[:150]}
    filas, vistos = [], set()
    for it in items:
        kw = (it.get("keyword") or "").strip().lower()
        if not kw or kw in vistos:
            continue
        vistos.add(kw)
        ki = it.get("keyword_info") or {}
        kp = it.get("keyword_properties") or {}
        cpc = ki.get("cpc")
        try:
            cpc = round(float(cpc), 2) if cpc not in (None, "") else None
        except Exception:
            cpc = None
        filas.append({"keyword": kw, "volumen": _num(ki.get("search_volume")),
                      "dificultad": _num(kp.get("keyword_difficulty")),
                      "cpc": cpc, "competencia": ki.get("competition_level") or ""})
    for f in filas:
        f["oportunidad"] = _oportunidad(f)
    filas.sort(key=lambda f: (f.get("volumen") or 0), reverse=True)
    cache[clave] = {"ts": time.time(), "filas": filas[:limite]}
    _guardar(cache)
    return {"ok": True, "seed": seed, "pais": pais, "fuente": "api", "total": len(filas),
            "keywords": filas[:limite]}
