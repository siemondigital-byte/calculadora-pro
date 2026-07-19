"""Trend Scout: lo mas demandado en el nicho, via YouTube Data API v3. BILINGUE (ES+EN).
Detecta outliers (videos que rinden por encima de su base de subs = demanda real) para
MODELAR angulos/ganchos, nunca copiar. Necesita YOUTUBE_API_KEY."""
import os
import requests
from datetime import datetime, timezone, timedelta

API = "https://www.googleapis.com/youtube/v3"

# Pilares del canal Andrea Siemon, en los dos idiomas (ICP global ES/EN).
PILARES_BILINGUE = [
    {"es": "IA y automatizacion para negocios", "en": "AI automation for small business"},
    {"es": "emprender y escalar negocios de servicios", "en": "scaling a service business"},
    {"es": "productividad e IA aplicada", "en": "AI productivity tools workflow"},
]
_REGION = {"es": "CO", "en": "US"}
_CACHE = {}


def _get(path, params):
    params["key"] = os.environ.get("YOUTUBE_API_KEY")
    r = requests.get(f"{API}/{path}", params=params, timeout=25)
    r.raise_for_status()
    return r.json()


def ideas(pilares=None, idiomas=None, n=14):
    key = os.environ.get("YOUTUBE_API_KEY")
    if not key:
        return {"ok": False, "error": "sin_clave_youtube", "ideas": []}
    idiomas = [i for i in (idiomas or ["es", "en"]) if i in ("es", "en")] or ["es", "en"]
    base_pilares = pilares or PILARES_BILINGUE
    ckey = "|".join(sorted(idiomas)) + "|" + "|".join([p.get("es", "") if isinstance(p, dict) else str(p) for p in base_pilares])
    if ckey in _CACHE:
        return _CACHE[ckey]
    desde = (datetime.now(timezone.utc) - timedelta(days=120)).isoformat().replace("+00:00", "Z")
    vistos, videos, canales_ids = set(), [], set()
    try:
        for lang in idiomas:
            for pil in base_pilares:
                q = pil.get(lang) or pil.get("es") if isinstance(pil, dict) else str(pil)
                data = _get("search", {"part": "snippet", "q": q, "type": "video",
                                        "order": "viewCount", "maxResults": 7, "publishedAfter": desde,
                                        "relevanceLanguage": lang, "regionCode": _REGION[lang]})
                for it in data.get("items", []):
                    vid = (it.get("id") or {}).get("videoId")
                    sn = it.get("snippet", {})
                    if not vid or vid in vistos:
                        continue
                    vistos.add(vid)
                    videos.append({"id": vid, "titulo": sn.get("title", ""), "canal": sn.get("channelTitle", ""),
                                   "canal_id": sn.get("channelId", ""), "publicado": (sn.get("publishedAt", "") or "")[:10],
                                   "pilar": (pil.get("es") if isinstance(pil, dict) else pil), "idioma": lang})
                    if sn.get("channelId"):
                        canales_ids.add(sn["channelId"])
    except Exception as e:
        return {"ok": False, "error": str(e), "ideas": []}

    stats = {}
    ids = [v["id"] for v in videos]
    for i in range(0, len(ids), 50):
        try:
            d = _get("videos", {"part": "statistics", "id": ",".join(ids[i:i + 50])})
            for it in d.get("items", []):
                stats[it["id"]] = int(it.get("statistics", {}).get("viewCount", 0) or 0)
        except Exception:
            pass
    subs = {}
    cids = list(canales_ids)
    for i in range(0, len(cids), 50):
        try:
            d = _get("channels", {"part": "statistics", "id": ",".join(cids[i:i + 50])})
            for it in d.get("items", []):
                subs[it["id"]] = int(it.get("statistics", {}).get("subscriberCount", 0) or 0)
        except Exception:
            pass

    now = datetime.now(timezone.utc)
    for v in videos:
        vistas = stats.get(v["id"], 0)
        s = subs.get(v["canal_id"], 0)
        v["vistas"] = vistas
        v["subs"] = s
        v["outlier"] = round((vistas / s) * 100) if s > 0 else (300 if vistas > 20000 else 100)
        # bonus de frescura: lo reciente pesa un poco mas (demanda vigente)
        try:
            dias = (now - datetime.fromisoformat(v["publicado"] + "T00:00:00+00:00")).days
        except Exception:
            dias = 60
        recencia = 1.15 if dias <= 21 else (1.05 if dias <= 45 else 1.0)
        # canales pequenos con outlier alto = demanda real (no audiencia inflada)
        peq = 1.15 if (0 < s <= 20000) else 1.0
        v["score"] = round(v["outlier"] * recencia * peq)
        v["url"] = f"https://youtube.com/watch?v={v['id']}"
    videos.sort(key=lambda x: (x["score"], x["vistas"]), reverse=True)
    top = videos[:n]
    res = {"ok": True, "idiomas": idiomas, "ideas": top,
           "resumen": {"total": len(videos), "es": len([v for v in top if v["idioma"] == "es"]),
                       "en": len([v for v in top if v["idioma"] == "en"])}}
    _CACHE[ckey] = res
    return res
