"""Inteligencia de keywords REAL para el blog SEO de Siemon.

Fuente 1 (demanda de mercado): Apify, actor `radeance/ubersuggest-scraper`.
  IMPORTANTE: es un actor de renta con cupo GRATIS de 10 corridas/mes. Por eso TODO
  se cachea en /data/keywords_cache.json: cada keyword consulta el actor UNA vez y
  luego se reutiliza. Si se agota el cupo, se avisa claro (no se inventan numeros).
Fuente 2 (lo que YA te busca la gente): export CSV de Google Search Console.

Nada se inventa: si Apify no responde, no hay token o se acabo el cupo, se dice.
"""
import os
import time
import math
import json as _json
import requests

APIFY_ACTOR = "radeance~ubersuggest-scraper"
CACHE_PATH = os.environ.get("KEYWORDS_CACHE", "/data/keywords_cache.json")
CACHE_DIAS = 45          # una keyword cacheada se considera fresca 45 dias
POLL_MAX = 40            # ~4 min de espera maxima por corrida

# Datos REALES sacados de Apify el 2026-07-16 (cuenta free). Siembran el cache para que
# el blog tenga anclas reales aunque el cupo del mes este agotado. Marcados como referencia.
_SEMILLA = {
    "co:automatizacion de procesos": [
        {"keyword": "automatizacion de procesos", "volumen": 720, "dificultad": None, "cpc": None},
        {"keyword": "que es la automatizacion de procesos", "volumen": 260, "dificultad": 7, "cpc": None},
        {"keyword": "agentes de ia", "volumen": 880, "dificultad": 40, "cpc": None},
        {"keyword": "que son los agentes de ia", "volumen": 170, "dificultad": 12, "cpc": None},
    ],
    "mx:automatizacion de procesos": [
        {"keyword": "automatizacion de procesos", "volumen": 1900, "dificultad": None, "cpc": None},
        {"keyword": "agentes de ia", "volumen": 880, "dificultad": 40, "cpc": None},
    ],
}


def _token():
    import secretos as _sec
    return (_sec.get("APIFY_TOKEN") or os.environ.get("APIFY_TOKEN") or "").strip()


def hay_apify():
    return bool(_token())


# ---------- cache ----------
def _cargar_cache():
    try:
        with open(CACHE_PATH, "r", encoding="utf-8") as f:
            return _json.load(f)
    except Exception:
        return {}


def _guardar_cache(c):
    try:
        with open(CACHE_PATH, "w", encoding="utf-8") as f:
            _json.dump(c, f, ensure_ascii=False)
    except Exception:
        pass


def _norm(s):
    import unicodedata
    s = unicodedata.normalize("NFKD", (s or "").strip().lower())
    return "".join(c for c in s if not unicodedata.combining(c))


def _clave(keyword, country):
    return f"{(country or 'co').lower()}:{_norm(keyword)}"


# ---------- parseo ----------
def _num(v):
    if v is None:
        return None
    if isinstance(v, (int, float)):
        return int(v)
    s = str(v).strip().lower().replace(",", "").replace(" ", "")
    if not s or s in ("-", "n/a", "na"):
        return None
    mult = 1
    if s.endswith("k"):
        mult, s = 1000, s[:-1]
    elif s.endswith("m"):
        mult, s = 1_000_000, s[:-1]
    try:
        return int(float(s) * mult)
    except Exception:
        return None


def _pick(d, *claves):
    for k in claves:
        if k in d and d[k] not in (None, ""):
            return d[k]
    return None


def _fila(d):
    if not isinstance(d, dict):
        return None
    kw = _pick(d, "keyword", "kw", "term", "query", "text")
    if not kw:
        return None
    vol = _num(_pick(d, "volume", "search_volume", "searchVolume", "vol", "sv", "monthly_searches"))
    dif = _num(_pick(d, "seo_difficulty", "seoDifficulty", "difficulty", "kd", "sd", "seo_diff"))
    cpc = _pick(d, "cpc", "cost_per_click", "costPerClick")
    try:
        cpc = round(float(str(cpc).replace("$", "").replace(",", "")), 2) if cpc not in (None, "") else None
    except Exception:
        cpc = None
    return {"keyword": str(kw).strip().lower(), "volumen": vol, "dificultad": dif, "cpc": cpc}


def _aplanar(items):
    filas = []
    for it in (items or []):
        if not isinstance(it, dict):
            continue
        anidados = False
        for campo in ("search", "suggestions", "keywords", "keyword_ideas", "results", "related", "data"):
            v = it.get(campo)
            if isinstance(v, list):
                anidados = True
                for sub in v:
                    f = _fila(sub)
                    if f:
                        filas.append(f)
        if not anidados:
            f = _fila(it)
            if f:
                filas.append(f)
    porkw = {}
    for f in filas:
        prev = porkw.get(f["keyword"])
        if not prev or (f["volumen"] is not None and prev["volumen"] is None):
            porkw[f["keyword"]] = f
    return list(porkw.values())


def _oportunidad(f):
    vol = f.get("volumen") or 0
    dif = f.get("dificultad")
    vscore = min(80, 20 * math.log10(vol + 1)) if vol else 0
    dscore = (100 - dif) * 0.2 if isinstance(dif, (int, float)) else 8
    return round(vscore + dscore)


def _ordenar(filas):
    for f in filas:
        f["oportunidad"] = _oportunidad(f)
    filas.sort(key=lambda f: f["oportunidad"], reverse=True)
    return filas


# ---------- Apify ----------
def _correr_apify(keyword, country, language, timeout):
    """Corre el actor async, espera, lee dataset. Devuelve (filas, error, reset)."""
    tok = _token()
    body = {"keyword": keyword, "country": (country or "co").lower(),
            "language": (language or "es").lower(), "include_keywords": True}
    try:
        r = requests.post(f"https://api.apify.com/v2/acts/{APIFY_ACTOR}/runs",
                          params={"token": tok}, json=body, timeout=30)
        if r.status_code >= 400:
            return None, f"apify_{r.status_code}", None
        run = r.json()["data"]
        rid, dsid = run["id"], run["defaultDatasetId"]
    except Exception as e:
        return None, f"apify_lanzar:{str(e)[:80]}", None
    # poll
    estado = "RUNNING"
    for _ in range(POLL_MAX):
        time.sleep(6)
        try:
            estado = requests.get(f"https://api.apify.com/v2/actor-runs/{rid}",
                                  params={"token": tok}, timeout=20).json()["data"]["status"]
        except Exception:
            continue
        if estado not in ("RUNNING", "READY"):
            break
    # dataset
    try:
        items = requests.get(f"https://api.apify.com/v2/datasets/{dsid}/items",
                             params={"token": tok, "clean": "true"}, timeout=30).json()
    except Exception as e:
        return None, f"apify_dataset:{str(e)[:80]}", None
    filas = _aplanar(items)
    if filas:
        return filas, None, None
    # dataset vacio: leer el log para distinguir cupo agotado de "sin resultados"
    try:
        log = requests.get(f"https://api.apify.com/v2/actor-runs/{rid}/log",
                           params={"token": tok}, timeout=20).text or ""
    except Exception:
        log = ""
    if "quota" in log.lower() or "exceeded" in log.lower():
        import re
        m = re.search(r"reset on:\s*([0-9\-]+)", log)
        return None, "cupo_agotado", (m.group(1) if m else None)
    return [], None, None    # de verdad no hubo resultados


# ---------- API publica ----------
def investigar(keyword, country="co", language="es", limite=40, timeout=90, forzar=False):
    """Devuelve {ok, seed, pais, keywords, fuente, nota}. Cache-first para cuidar el cupo."""
    kw = (keyword or "").strip()
    if not kw:
        return {"ok": False, "error": "falta la keyword semilla"}
    clave = _clave(kw, country)
    cache = _cargar_cache()
    # siembra inicial de referencia (jul-2026) si el cache no la tiene
    if clave in _SEMILLA and clave not in cache:
        cache[clave] = {"ts": 0, "filas": _SEMILLA[clave], "fuente": "referencia-jul2026"}
        _guardar_cache(cache)
    ent = cache.get(clave)
    fresco = ent and (time.time() - ent.get("ts", 0) < CACHE_DIAS * 86400) and ent.get("fuente") == "apify"
    if ent and not forzar and (fresco or not hay_apify()):
        filas = _ordenar([dict(f) for f in ent["filas"]])
        con_vol = [f for f in filas if f.get("volumen")]
        ref = ent.get("fuente") != "apify"
        return {"ok": True, "seed": kw, "pais": country.lower(), "keywords": filas[:limite],
                "total": len(filas), "con_volumen": len(con_vol), "fuente": "cache",
                "nota": ("Datos de referencia (Apify, jul-2026). El cupo gratuito del mes esta agotado; "
                         "vuelve a consultar tras el reinicio para refrescar." if ref else
                         "Reutilizado de una consulta previa (para no gastar el cupo mensual).")}
    if not hay_apify():
        return {"ok": False, "error": "sin_token", "nota": "No hay APIFY_TOKEN configurado en el motor."}
    filas, err, reset = _correr_apify(kw, country, language, timeout)
    if err == "cupo_agotado":
        # si hay algo cacheado, devuelvelo con aviso; si no, error claro
        if ent:
            filas2 = _ordenar([dict(f) for f in ent["filas"]])
            return {"ok": True, "seed": kw, "pais": country.lower(), "keywords": filas2[:limite],
                    "total": len(filas2), "con_volumen": len([f for f in filas2 if f.get("volumen")]),
                    "fuente": "cache", "nota": f"Cupo mensual de Apify agotado (se reinicia {reset or 'pronto'}). "
                    "Mostrando datos guardados de una consulta previa."}
        return {"ok": False, "error": "cupo_agotado", "reset": reset,
                "nota": f"Se agoto el cupo gratuito de Apify (10 consultas/mes). Se reinicia {reset or 'a mitad del proximo mes'}."}
    if err:
        return {"ok": False, "error": err, "nota": "No pude consultar Apify. Reintenta en un momento."}
    filas = _ordenar(filas)
    # guardar en cache
    cache[clave] = {"ts": time.time(), "filas": [{k: f[k] for k in ("keyword", "volumen", "dificultad", "cpc")}
                                                 for f in filas], "fuente": "apify"}
    _guardar_cache(cache)
    con_vol = [f for f in filas if f.get("volumen")]
    return {"ok": True, "seed": kw, "pais": country.lower(), "keywords": filas[:limite],
            "total": len(filas), "con_volumen": len(con_vol), "fuente": "apify",
            "nota": "" if con_vol else "Nicho de poca busqueda: casi ninguna keyword tiene volumen medible. "
                                       "Igual sirven para articulos long-tail faciles de posicionar."}


def parsear_planner(texto):
    """Parsea el CSV exportado de Google Ads Keyword Planner (ES o EN).
    Salta el preambulo, detecta el separador y mapea columnas por nombre difuso.
    Devuelve [{keyword, volumen, dificultad, competencia, cpc}]."""
    import csv as _csv
    import io as _io
    lineas = [l for l in (texto or "").replace("\r", "").split("\n")]
    # encuentra la fila de encabezado (primera que menciona keyword/palabra clave)
    hi = -1
    for i, l in enumerate(lineas):
        low = l.lower()
        if ("keyword" in low or "palabra clave" in low) and ("search" in low or "busque" in low
                                                              or "monthly" in low or "mensual" in low or "competi" in low):
            hi = i
            break
    if hi < 0:
        # a veces el header solo dice 'keyword'/'palabra clave'
        for i, l in enumerate(lineas):
            if l.lower().strip().startswith(("keyword", "palabra clave")):
                hi = i
                break
    if hi < 0:
        return []
    bloque = "\n".join(lineas[hi:])
    prim = lineas[hi]
    delim = "\t" if prim.count("\t") >= 1 else (";" if prim.count(";") > prim.count(",") else ",")
    filas = list(_csv.reader(_io.StringIO(bloque), delimiter=delim))
    if len(filas) < 2:
        return []
    cab = [c.strip().lower() for c in filas[0]]

    def col(*subs):
        for idx, c in enumerate(cab):
            if any(s in c for s in subs):
                return idx
        return -1

    i_kw = col("keyword", "palabra clave")
    i_vol = col("avg. monthly searches", "monthly searches", "busquedas mensuales", "búsquedas mensuales", "promedio de busq")
    i_idx = col("competition (indexed", "competencia (valor", "indexed value", "valor indexado")
    i_comp = col("competition", "competencia")
    i_cpc = col("top of page bid (low", "puja para la parte superior", "low range", "intervalo bajo")
    if i_kw < 0:
        i_kw = 0

    def vol_de(s):
        s = str(s or "").strip()
        if not s:
            return None
        s2 = s.replace("–", "-").replace("—", "-").replace("mil", "k").replace("millones", "m").replace("K", "k").replace("M", "m")
        if "-" in s2:
            partes = [p for p in s2.split("-") if p.strip()]
            nums = [n for n in (_num(p) for p in partes) if n is not None]
            if len(nums) == 2:
                return int((nums[0] + nums[1]) / 2)
            if nums:
                return nums[0]
        return _num(s2)

    out = []
    for row in filas[1:]:
        if not row or i_kw >= len(row) or not (row[i_kw] or "").strip():
            continue
        kw = row[i_kw].strip().lower()
        vol = vol_de(row[i_vol]) if 0 <= i_vol < len(row) else None
        comp = (row[i_comp].strip() if 0 <= i_comp < len(row) else "") or ""
        dif = _num(row[i_idx]) if 0 <= i_idx < len(row) else None
        if dif is None and comp:                       # sin indice: aproxima desde texto
            c = comp.lower()
            dif = 20 if c.startswith(("low", "baj")) else 50 if c.startswith(("med", "medi")) else 80 if c.startswith(("high", "alt")) else None
        cpc = None
        if 0 <= i_cpc < len(row):
            try:
                cpc = round(float(str(row[i_cpc]).replace("$", "").replace(",", ".").strip()), 2)
            except Exception:
                cpc = None
        out.append({"keyword": kw, "volumen": vol, "dificultad": dif, "competencia": comp, "cpc": cpc})
    return out


def parsear_atp(texto):
    """Parsea el CSV/Excel exportado de AnswerThePublic. Su valor son las PREGUNTAS
    reales (no siempre trae volumen). Tolera columna 'type'/grupo y encabezados ES/EN.
    Devuelve [{keyword, volumen, dificultad, competencia, tipo}]."""
    import csv as _csv
    import io as _io
    lineas = (texto or "").replace("\r", "").split("\n")
    hi = -1
    for i, l in enumerate(lineas):
        low = l.lower()
        if any(s in low for s in ("keyword", "question", "consulta", "palabra clave", "frase", "query")):
            hi = i
            break
    if hi < 0:
        # ATP a veces exporta una sola columna de frases sin encabezado
        filas0 = [l.strip() for l in lineas if l.strip()]
        return [{"keyword": f.strip().lower(), "volumen": None, "dificultad": None,
                 "competencia": "", "tipo": ""} for f in filas0][:400]
    delim = "\t" if lineas[hi].count("\t") >= 1 else (";" if lineas[hi].count(";") > lineas[hi].count(",") else ",")
    filas = list(_csv.reader(_io.StringIO("\n".join(lineas[hi:])), delimiter=delim))
    if len(filas) < 2:
        return []
    cab = [c.strip().lower() for c in filas[0]]

    def col(*subs):
        for idx, c in enumerate(cab):
            if any(s in c for s in subs):
                return idx
        return -1

    i_kw = col("keyword", "question", "consulta", "palabra clave", "frase", "query")
    i_vol = col("search volume", "volume", "volumen", "busquedas", "búsquedas")
    i_comp = col("competition", "competencia")
    i_tipo = col("type", "tipo", "group", "grupo", "categoria", "modifier")
    if i_kw < 0:
        i_kw = 1 if (i_tipo == 0 and len(cab) > 1) else 0
    out, vistos = [], set()
    for row in filas[1:]:
        if not row or i_kw >= len(row):
            continue
        kw = (row[i_kw] or "").strip().lower()
        if not kw or kw in vistos:
            continue
        vistos.add(kw)
        vol = _num(row[i_vol]) if 0 <= i_vol < len(row) else None
        comp = (row[i_comp].strip() if 0 <= i_comp < len(row) else "") or ""
        dif = None
        if comp:
            c = comp.lower()
            dif = 20 if c.startswith(("low", "baj")) else 50 if c.startswith(("med", "medi")) else 80 if c.startswith(("high", "alt")) else _num(comp)
        tipo = (row[i_tipo].strip().lower() if 0 <= i_tipo < len(row) else "")
        out.append({"keyword": kw, "volumen": vol, "dificultad": dif, "competencia": comp, "tipo": tipo})
    return out


def todo_cacheado():
    """Devuelve TODAS las keywords ya consultadas/guardadas (para registrarlas y no repetir)."""
    cache = _cargar_cache()
    # sembrar referencia si falta
    for clave, filas in _SEMILLA.items():
        if clave not in cache:
            cache[clave] = {"ts": 0, "filas": filas, "fuente": "referencia-jul2026"}
    _guardar_cache(cache)
    out, vistos = [], set()
    for clave, ent in cache.items():
        pais = clave.split(":", 1)[0]
        for f in ent.get("filas", []):
            k = f.get("keyword")
            if not k or k in vistos:
                continue
            vistos.add(k)
            out.append({"keyword": k, "volumen": f.get("volumen"), "dificultad": f.get("dificultad"),
                        "competencia": "", "cpc": f.get("cpc"), "pais": pais})
    out.sort(key=lambda f: (f.get("volumen") or 0), reverse=True)
    return out


def resumen_para_prompt(res, top=18):
    if not res or not res.get("ok") or not res.get("keywords"):
        return ""
    lineas = []
    for f in res["keywords"][:top]:
        vol = f.get("volumen")
        dif = f.get("dificultad")
        v = f"{vol}/mes" if vol else "sin vol."
        d = f"dif {dif}" if isinstance(dif, (int, float)) else "dif ?"
        lineas.append(f"- {f['keyword']} ({v}, {d})")
    return ("KEYWORDS REALES (Apify/Ubersuggest, pais {p}) ordenadas por oportunidad "
            "(volumen alto + dificultad baja). USA ESTAS, no inventes volumenes:\n{l}").format(
        p=res.get("pais", "co"), l="\n".join(lineas))
