"""Canal 'youtube': descubre creadores (embajadores) por nicho con la API oficial
de YouTube Data API v3 (skill youtube-embajadores). NO hace scraping: API oficial,
respeta ToS y cuida la cuota (10k/dia).

Flujo: search (videos del nicho) -> channels (subs, promedio de vistas) ->
videos (vistas/likes/comentarios) -> outlier + Ambassador Fit Score.
Devuelve Prospecto(tipo='creador') con subs, outlier, fit, email publico si esta.

Necesita YOUTUBE_API_KEY en el entorno. Sin clave devuelve [] (el pipeline avisa)."""
import os
import re
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from models import Prospecto            # noqa: E402
from collectors.base import Colector     # noqa: E402
from enrich import _handle               # noqa: E402
from config import (YT_BANDA_MIN, YT_BANDA_MAX, YT_BANDA_TECHO,  # noqa: E402
                    YT_NICHO_KEYWORDS, YT_UMBRAL_FIT)


UA_YT = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
         "(KHTML, like Gecko) Chrome/122.0 Safari/537.36")
_SOC = {
    "instagram": re.compile(r"instagram\.com/([A-Za-z0-9_.]{2,30})", re.I),
    "tiktok":    re.compile(r"tiktok\.com/@?([A-Za-z0-9_.]{2,30})", re.I),
    "twitter":   re.compile(r"(?:twitter|x)\.com/([A-Za-z0-9_]{2,30})", re.I),
    "facebook":  re.compile(r"facebook\.com/([A-Za-z0-9_.]{2,40})", re.I),
}
_LINKEDIN = re.compile(r"linkedin\.com/(in|company)/([A-Za-z0-9\-\_%]{2,60})", re.I)
_MAIL = re.compile(r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}")
_BAD_HANDLE = {"p", "reel", "reels", "explore", "share", "channel", "watch", "embed", "tv",
               "stories", "accounts", "about", "privacy", "policies", "intent", "hashtag", "results", "feed"}
_MAIL_SKIP = ("example.", "sentry", "wixpress", "google.com", "youtube.com", "ytimg", "gstatic",
              "schema.org", "w3.org", "doubleclick", "domain.com", "email.com", "googlemail")


def _dias_desde(fecha_iso):
    from datetime import datetime, timezone
    try:
        d = datetime.fromisoformat((fecha_iso or "").replace("Z", "+00:00"))
        return (datetime.now(timezone.utc) - d).days
    except Exception:
        return -1


def _about_links(channel_url):
    """Enlaces del panel 'Acerca de' via la API interna de YouTube (los del HTML
    estatico desaparecieron en 2026). Devuelve lista de URLs externas publicas."""
    import requests
    import urllib.parse
    H = {"User-Agent": UA_YT, "Accept-Language": "es"}
    try:
        html = requests.get(channel_url, headers=H, timeout=15).text
    except Exception:
        return []
    mkey = re.search(r'"INNERTUBE_API_KEY":"([^"]+)"', html)
    if not mkey:
        return []
    toks = re.findall(r'"continuationCommand":\{"token":"([^"]+)"', html)
    for tok in toks[:4]:
        body = {"context": {"client": {"clientName": "WEB", "clientVersion": "2.20240101.00.00",
                                        "hl": "es"}}, "continuation": tok}
        try:
            t = requests.post("https://www.youtube.com/youtubei/v1/browse?key=" + mkey.group(1),
                              json=body, headers=H, timeout=15).text
        except Exception:
            continue
        if "aboutChannelViewModel" not in t:
            continue
        out = []
        for q in re.findall(r'q(?:=|%3D)(https?[^&"\\\\]+)', t):
            u = urllib.parse.unquote(urllib.parse.unquote(q))
            if u not in out:
                out.append(u)
        return out
    return []


def _enriquecer_contacto(p):
    """Enriquece con los enlaces PUBLICOS del 'Acerca de' del canal (redes + web
    personal) y, si hay web propia, busca el email publico en ella."""
    url = (p.redes or {}).get("youtube") or p.web
    if not url:
        return p
    web_externa = ""
    for u in _about_links(url):
        low = u.lower()
        if "instagram.com" in low:
            if "instagram" not in p.redes:
                p.redes["instagram"] = u
                h = re.search(r"instagram\.com/@?([A-Za-z0-9._]{2,30})", u)
                if h and h.group(1).lower() not in _BAD_HANDLE:
                    p.redes["instagram_handle"] = "@" + h.group(1)
        elif "tiktok.com" in low:
            if "tiktok" not in p.redes:
                p.redes["tiktok"] = u
                h = re.search(r"tiktok\.com/@([A-Za-z0-9._]{2,30})", u)
                if h:
                    p.redes["tiktok_handle"] = "@" + h.group(1)
        elif "twitter.com" in low or "//x.com" in low or low.startswith("https://x.com"):
            p.redes.setdefault("twitter", u)
        elif "facebook.com" in low:
            p.redes.setdefault("facebook", u)
        elif "linkedin.com" in low:
            p.redes.setdefault("linkedin", u)
        elif not any(s in low for s in ("youtube.com", "youtu.be", "spotify", "apple.co",
                                         "discord", "t.me", "whatsapp", "wa.me", "patreon",
                                         "amazon", "amzn", "bit.ly", "linktr", "beacons")):
            if not web_externa:
                web_externa = u
    # la web personal/negocio es mejor destino que el propio canal
    if web_externa and (not p.web or "youtube.com" in (p.web or "")):
        p.web = web_externa
    # email: YouTube lo esconde tras captcha; buscarlo en su web publica
    if not p.email and web_externa:
        import requests
        base = web_externa.rstrip("/")
        for ruta in ("", "/contacto", "/contact", "/about", "/sobre-mi"):
            try:
                ht = requests.get(base + ruta, headers={"User-Agent": UA_YT}, timeout=8).text
            except Exception:
                continue
            cands = sorted({m.lower() for m in _MAIL.findall(ht)
                            if not any(s in m.lower() for s in _MAIL_SKIP)
                            and not m.lower().endswith((".png", ".jpg", ".gif", ".webp", ".svg"))}, key=len)
            if cands:
                p.email = cands[0]
                break
    return p


def _redes_de(desc, url):
    """Extrae IG/TikTok/Twitter/Facebook del 'Acerca de' del canal (como hace TMC)."""
    redes = {"youtube": url}
    for link in re.findall(r"https?://[^\s)]+", desc or ""):
        low = link.lower()
        if "instagram.com" in low and "instagram" not in redes:
            redes["instagram"] = link
            h = _handle(link)
            if h:
                redes["instagram_handle"] = h
        elif "tiktok.com" in low and "tiktok" not in redes:
            redes["tiktok"] = link
            h = _handle(link)
            if h:
                redes["tiktok_handle"] = h
        elif ("twitter.com" in low or "//x.com" in low) and "twitter" not in redes:
            redes["twitter"] = link
        elif "facebook.com" in low and "facebook" not in redes:
            redes["facebook"] = link
    return redes

API = "https://www.googleapis.com/youtube/v3"
EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}")


def _clamp(x, lo=0, hi=100):
    return max(lo, min(hi, x))


class ColectorYouTube(Colector):
    nombre = "youtube"

    def buscar(self, sector: str, ciudad: str, n: int) -> list:
        key = os.environ.get("YOUTUBE_API_KEY")
        if not key:
            print("[youtube] falta YOUTUBE_API_KEY; canal youtube omitido.")
            return []
        try:
            import requests
        except Exception:
            return []

        nicho = sector or ""
        # 'ciudad' aqui se usa como pais/idioma opcional (ej. "España" o "es").
        region = None
        idioma = "es"
        if ciudad:
            c = ciudad.split(",")[-1].strip().lower()
            mapa = {"españa": "ES", "espana": "ES", "mexico": "MX", "méxico": "MX",
                    "colombia": "CO", "argentina": "AR", "chile": "CL", "peru": "PE",
                    "estados unidos": "US", "usa": "US", "uk": "GB"}
            region = mapa.get(c)
            if c in ("en", "ingles", "english", "us", "usa", "uk"):
                idioma = "en"

        def get(path, params):
            params["key"] = key
            r = requests.get(f"{API}/{path}", params=params, timeout=20)
            r.raise_for_status()
            return r.json()

        # 1) buscar videos del nicho (los mas vistos y los mas relevantes)
        video_ids, canal_de_video = [], {}
        try:
            for orden in ("relevance", "viewCount"):
                params = {"part": "snippet", "q": nicho, "type": "video",
                          "order": orden, "maxResults": min(25, max(n, 10)),
                          "relevanceLanguage": idioma}
                if region:
                    params["regionCode"] = region
                data = get("search", params)
                for it in data.get("items", []):
                    vid = it.get("id", {}).get("videoId")
                    ch = it.get("snippet", {}).get("channelId")
                    if vid and ch:
                        video_ids.append(vid)
                        canal_de_video.setdefault(vid, ch)
        except Exception as e:
            print(f"[youtube] error en search: {e}")
            return []

        if not video_ids:
            return []

        # 2) stats de esos videos (para outlier + engagement)
        vstats = {}
        try:
            for i in range(0, len(video_ids), 50):
                lote = video_ids[i:i + 50]
                data = get("videos", {"part": "statistics", "id": ",".join(lote)})
                for it in data.get("items", []):
                    st = it.get("statistics", {})
                    vstats[it["id"]] = {
                        "views": int(st.get("viewCount", 0) or 0),
                        "likes": int(st.get("likeCount", 0) or 0),
                        "comments": int(st.get("commentCount", 0) or 0),
                    }
        except Exception as e:
            print(f"[youtube] error en videos: {e}")

        # 3) stats + snippet de los canales (subs, promedio de vistas, email)
        canal_ids = list({c for c in canal_de_video.values()})
        canales = {}
        try:
            for i in range(0, len(canal_ids), 50):
                lote = canal_ids[i:i + 50]
                data = get("channels", {"part": "snippet,statistics", "id": ",".join(lote)})
                for it in data.get("items", []):
                    st = it.get("statistics", {})
                    sn = it.get("snippet", {})
                    vc = int(st.get("viewCount", 0) or 0)
                    n_vids = int(st.get("videoCount", 0) or 0)
                    canales[it["id"]] = {
                        "nombre": sn.get("title", ""),
                        "desc": sn.get("description", ""),
                        "pais": sn.get("country", ""),
                        "subs": int(st.get("subscriberCount", 0) or 0),
                        "avg_views": (vc // n_vids) if n_vids else 0,
                    }
        except Exception as e:
            print(f"[youtube] error en channels: {e}")

        # 4) armar un prospecto por canal, quedandonos con su mejor video (outlier)
        mejor = {}  # channelId -> (outlier, videoId)
        for vid, ch in canal_de_video.items():
            v = vstats.get(vid)
            c = canales.get(ch)
            if not v or not c:
                continue
            avg = c["avg_views"] or 1
            outlier = int(v["views"] / avg * 100)
            if ch not in mejor or outlier > mejor[ch][0]:
                mejor[ch] = (outlier, vid)

        out = []
        for ch, (outlier, vid) in mejor.items():
            c = canales[ch]
            # actividad: ultima publicacion. Canal inactivo >1 mes NO se toma en cuenta.
            ultima = ""
            try:
                up = get("playlistItems", {"part": "snippet", "playlistId": "UU" + ch[2:], "maxResults": 1})
                its = up.get("items", [])
                if its:
                    ultima = (its[0].get("snippet", {}).get("publishedAt", "") or "")[:10]
            except Exception:
                pass
            if ultima and _dias_desde(ultima) > 35:
                continue
            v = vstats.get(vid, {})
            fit = self._fit(nicho, outlier, c, v)
            email = ""
            m = EMAIL_RE.search(c.get("desc", ""))
            if m:
                email = m.group(0)
            url = f"https://www.youtube.com/channel/{ch}"
            desc = c.get("desc", "") or ""
            enlaces = re.findall(r"https?://[^\s)]+", desc)[:8]   # links publicos del "Acerca de"
            p = Prospecto(
                nombre=c["nombre"], fuente="youtube", canal="youtube", tipo="creador",
                categoria=f"YouTuber · {nicho}", ciudad=c.get("pais") or ciudad,
                web=url, email=email, maps_url="",
                redes=_redes_de(desc, url),
                subs=c["subs"], outlier=outlier, fit=fit, score=fit,
                bio=desc[:400], seguidores=c["subs"], pais=c.get("pais", ""), enlaces=enlaces,
                ultima_pub=ultima,
                encaja=fit >= YT_UMBRAL_FIT,
                problemas=[f"{c['subs']:,} subs", f"outlier {outlier}",
                           "email publico" if email else "sin email publico (escribir por el canal)"],
                motivo=f"Fit {fit}/100 como embajador (nicho + traccion + tamano).",
            )
            out.append(p)

        out.sort(key=lambda p: p.fit, reverse=True)
        out = out[:n]
        # enriquecer contacto (email + IG/TikTok del 'Acerca de'), en paralelo
        from concurrent.futures import ThreadPoolExecutor
        try:
            with ThreadPoolExecutor(max_workers=6) as ex:
                out = list(ex.map(_enriquecer_contacto, out))
        except Exception as e:
            print(f"[youtube] enriquecimiento fallo: {e}")
        return out

    # --- Ambassador Fit Score (ponderado, skill youtube-embajadores) ---
    def _fit(self, nicho, outlier, c, v):
        texto = (nicho + " " + c.get("nombre", "") + " " + c.get("desc", "")).lower()
        hits = sum(1 for k in YT_NICHO_KEYWORDS if k in texto)
        s_nicho = _clamp(40 + hits * 20)
        s_traccion = _clamp(outlier // 5)              # outlier 500 -> 100
        subs = c["subs"]
        if YT_BANDA_MIN <= subs <= YT_BANDA_MAX:
            s_banda = 100
        elif subs < YT_BANDA_MIN or subs <= YT_BANDA_TECHO:
            s_banda = 50
        else:
            s_banda = 20
        views = v.get("views", 0) or 1
        eng = (v.get("likes", 0) + v.get("comments", 0)) / views
        s_eng = _clamp(int(eng * 2000))                # 5% -> 100
        s_contact = 100 if EMAIL_RE.search(c.get("desc", "")) else 40
        s_safety = 80
        fit = (0.30 * s_nicho + 0.20 * s_traccion + 0.20 * s_banda +
               0.15 * s_eng + 0.10 * s_contact + 0.05 * s_safety)
        return int(round(fit))
