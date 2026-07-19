"""Cliente de la API de AnswerThePublic (Public API, Alpha).

Trae las PREGUNTAS reales que la gente busca alrededor de una semilla. Flujo:
  POST /searches (consume 1 credito) -> poll -> GET /reports/{parent} -> parsear.
Cachea por (keyword,region,provider,language) para NO gastar creditos repetidos
(Andrea tiene ~60 creditos/mes). El token se lee del almacen seguro (secretos.py).
"""
import os
import re
import time
import json as _json
import requests
import secretos as _sec

BASE = "https://api.answerthepublic.com/api/public/v1"
CACHE_PATH = os.environ.get("ATP_CACHE", "/data/atp_cache.json")
POLL_MAX = 20          # ~80s de espera maxima
TEXT_KEYS = {"keyword", "query", "text", "term", "question", "suggestion", "title",
             "label", "value", "phrase", "name", "content"}


def _token():
    return (_sec.get("ATP_TOKEN") or "").strip()


def hay_token():
    return bool(_token())


def _headers():
    return {"Authorization": "Bearer " + _token(), "Content-Type": "application/json",
            "Accept": "application/json"}


# ---------- cache ----------
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


def _norm(s):
    import unicodedata
    s = unicodedata.normalize("NFKD", (s or "").strip().lower())
    return "".join(c for c in s if not unicodedata.combining(c))


# ---------- parseo tolerante ----------
_RE_UUID = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-", re.I)
_RE_FECHA = re.compile(r"\d{4}-\d{2}-\d{2}T")


def _es_consulta(s):
    """True si el string parece una consulta real (no un id, url, fecha, codigo)."""
    s = (s or "").strip()
    if not (3 <= len(s) <= 140):
        return False
    low = s.lower()
    if "http" in low or "://" in low or "@" in s or "/" in s:
        return False
    if _RE_UUID.match(s) or _RE_FECHA.search(s):
        return False
    if re.fullmatch(r"[0-9a-f]{16,}", low):        # hash
        return False
    if not re.search(r"[a-zñáéíóú]", low):          # sin letras
        return False
    return True


def _recolectar(obj, acc, key_ctx=None):
    if isinstance(obj, dict):
        for k, v in obj.items():
            if isinstance(v, str):
                if k.lower() in TEXT_KEYS and _es_consulta(v):
                    acc.add(v.strip())
            else:
                _recolectar(v, acc, k)
    elif isinstance(obj, list):
        for v in obj:
            if isinstance(v, str):
                if _es_consulta(v):
                    acc.add(v.strip())
            else:
                _recolectar(v, acc, key_ctx)


_GRUPOS = ("search_engine", "social_media", "ai", "shopping", "ecommerce", "app_store", "images")


def _preguntas_de(reporte):
    """Extrae las sugerencias reales del reporte de ATP.
    Estructura: data.<grupo>.<provider>.results.data[] con {suggestion, search_volume, source_name}."""
    rd = reporte.get("data") if isinstance(reporte, dict) and "data" in reporte else reporte
    if not isinstance(rd, dict):
        return []
    porkw = {}
    for grupo in _GRUPOS:
        g = rd.get(grupo)
        if not isinstance(g, dict):
            continue
        for prov, pdata in g.items():
            items = (((pdata or {}).get("results") or {}).get("data")) or []
            for it in items:
                if not isinstance(it, dict):
                    continue
                s = (it.get("suggestion") or "").strip()
                if not s or len(s) > 160 or not _es_consulta(s):
                    continue
                vol = it.get("search_volume")
                try:
                    vol = int(vol) if vol not in (None, "") else None
                except Exception:
                    vol = None
                cpc = it.get("cost_per_click")
                src = (it.get("source_name") or "").strip()
                key = s.lower()
                prev = porkw.get(key)
                if not prev or (vol is not None and prev.get("volumen") is None):
                    porkw[key] = {"keyword": key, "volumen": vol, "dificultad": None,
                                  "competencia": "", "cpc": cpc, "tipo": src, "provider": prov}
    filas = [f for f in porkw.values() if _relevante(f["keyword"])]
    # ordena: con volumen primero, luego preguntas reales, luego el resto
    interrog = ("como", "que", "por que", "cuando", "donde", "cuanto", "cual", "para que", "cuales")
    def _es_preg(f):
        low = _norm(f["keyword"])
        return f.get("tipo") == "questions" or any(low.startswith(w + " ") for w in interrog)
    def _rank(f):
        return (0 if f.get("volumen") else (1 if _es_preg(f) else 2), -(f.get("volumen") or 0), len(f["keyword"]))
    filas.sort(key=_rank)
    return filas[:_TOPE_POR_BUSQUEDA]


_TOPE_POR_BUSQUEDA = 25
# ruido a excluir: estudios/carreras, otros idiomas, y basura de autocompletado
_STOP = {"mba", "maestria", "master", "licenciatura", "posgrado", "postgrado", "graduacao",
         "graduacion", "curso", "cursos", "diplomado", "universidad", "carrera", "doctorado",
         "phd", "tesis", "beca", "estudiar", "aprende", "aprender", "melhor", "pos", "pre",
         "gratis", "pdf", "wikipedia", "significado", "definicion", "ingles", "english"}


def _relevante(kw):
    seq = _norm(kw).split()
    if set(seq) & _STOP:
        return False
    # ruido de autocompletado: termina en una letra/fragmento suelto (ej. "... para a")
    if seq and len(seq[-1]) <= 1:
        return False
    palabras = [t for t in seq if len(t) > 1]
    return len(palabras) >= 2


# ---------- API ----------
def buscar(keyword, region="co", language="es", provider="gweb", forzar=False):
    """Devuelve {ok, keyword, preguntas:[{keyword,volumen,dificultad,competencia,tipo}], fuente, ...}."""
    kw = (keyword or "").strip()
    if not kw:
        return {"ok": False, "error": "falta la keyword semilla"}
    if not hay_token():
        return {"ok": False, "error": "sin_token", "nota": "Conecta tu token de AnswerThePublic primero."}
    provider = (provider or "gweb").lower()
    region = "mx" if (region or "").lower() == "latam" else region
    clave = f"{provider}:{(region or 'co').lower()}:{(language or 'es').lower()}:{_norm(kw)}"
    cache = _cargar()
    if clave in cache and not forzar:
        e = cache[clave]
        # aplica el filtro tambien a lo cacheado (limpia entradas viejas sin re-gastar credito)
        filtradas = [f for f in e["preguntas"] if _relevante(f.get("keyword", ""))][:_TOPE_POR_BUSQUEDA]
        return {"ok": True, "keyword": kw, "region": region, "provider": provider, "fuente": "cache",
                "total": len(filtradas), "preguntas": filtradas,
                "nota": "Reutilizado (sin gastar credito)."}
    # 1) crear busqueda (consume 1 credito)
    body = {"search": {"keyword": kw, "language": (language or "es").lower(),
                       "region": (region or "co").lower(), "provider": provider}}
    try:
        r = requests.post(BASE + "/searches", headers=_headers(), json=body, timeout=30)
    except Exception as e:
        return {"ok": False, "error": "atp_conexion", "detalle": str(e)[:150]}
    if r.status_code == 401:
        return {"ok": False, "error": "token_invalido", "nota": "El token no es valido. Genera uno nuevo y guardalo."}
    if r.status_code == 403:
        return {"ok": False, "error": "sin_permiso", "detalle": r.text[:200],
                "nota": "El token necesita permisos searches y reports."}
    if r.status_code == 402 or "credit" in (r.text or "").lower():
        return {"ok": False, "error": "sin_creditos", "nota": "Se agotaron tus creditos de AnswerThePublic este mes."}
    if r.status_code >= 400:
        return {"ok": False, "error": f"atp_{r.status_code}", "detalle": r.text[:200]}
    try:
        data = r.json().get("data") or r.json()
    except Exception:
        return {"ok": False, "error": "respuesta_invalida", "detalle": r.text[:200]}
    pid = data.get("parent_search_id") or data.get("id")
    if not pid:
        return {"ok": False, "error": "sin_id", "_muestra": str(data)[:500]}
    # 2) poll al reporte hasta que traiga contenido
    ultimo = None
    for _ in range(POLL_MAX):
        time.sleep(4)
        try:
            rr = requests.get(BASE + "/reports/" + str(pid), headers=_headers(), timeout=25)
            if rr.status_code >= 400:
                continue
            ultimo = rr.json()
        except Exception:
            continue
        filas = _preguntas_de(ultimo)
        if len(filas) >= 3:
            cache[clave] = {"preguntas": filas, "ts": time.time()}
            _guardar(cache)
            return {"ok": True, "keyword": kw, "region": region, "provider": provider,
                    "fuente": "api", "total": len(filas), "preguntas": filas}
    # no cuajo dentro del tiempo: devuelve muestra para diagnosticar (dato publico, no sensible)
    return {"ok": False, "error": "sin_preguntas",
            "nota": "La busqueda se creo pero el reporte no trajo preguntas legibles a tiempo.",
            "_muestra": str(ultimo)[:900] if ultimo else "(sin respuesta del reporte)", "pid": str(pid)}


def contexto_cuenta():
    """GET /me: para verificar token y ver plan/creditos (no consume credito)."""
    if not hay_token():
        return {"ok": False, "error": "sin_token"}
    try:
        r = requests.get(BASE + "/me", headers=_headers(), timeout=20)
        if r.status_code >= 400:
            return {"ok": False, "error": f"atp_{r.status_code}", "detalle": r.text[:200]}
        return {"ok": True, "data": r.json().get("data") or r.json()}
    except Exception as e:
        return {"ok": False, "error": "atp_conexion", "detalle": str(e)[:150]}
