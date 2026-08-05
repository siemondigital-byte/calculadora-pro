"""Colectores de prospeccion. Agnosticos a la fuente: cada colector devuelve
candidatos normalizados y el pipeline los deduplica, puntua y guarda.

Guardarrailes (skill prospeccion): solo datos publicos de negocios/creadores,
respetar ToS y rate limits, nada de scraping agresivo.
"""
import re
import urllib.parse

import httpx

YT_API = "https://www.googleapis.com/youtube/v3"

UA_NAV = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
          "(KHTML, like Gecko) Chrome/122.0 Safari/537.36")
_MAIL = re.compile(r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}")
_MAIL_SKIP = ("example.", "sentry", "wixpress", "google.com", "youtube.com", "ytimg",
              "gstatic", "schema.org", "w3.org", "doubleclick", "domain.com",
              "email.com", "googlemail")
# enlaces de anuncios/agregadores: jamas son la web propia del creador
_LINK_SKIP = ("youtube.com", "youtu.be", "spotify", "apple.co", "discord", "t.me",
              "whatsapp", "wa.me", "patreon", "amazon", "amzn", "bit.ly", "linktr",
              "beacons", "googleadservices", "googlesyndication", "doubleclick",
              "/aclk", "/pagead", "adservice", "adclick", "safelinks", "/url?")

# Las 5 verticales del programa de afiliados (CLAUDE.md §1)
VERTICALES = [
    "productividad/hábitos",
    "mentalidad",
    "finanzas e inversión",
    "crecimiento personal",
    "crecimiento profesional",
]


def youtube_buscar_canales(api_key, consulta, max_resultados=12, idioma="es"):
    """Busca canales por consulta y trae sus estadisticas publicas."""
    with httpx.Client(timeout=20) as cliente:
        r = cliente.get(f"{YT_API}/search", params={
            "part": "snippet",
            "type": "channel",
            "q": consulta,
            "maxResults": min(25, max_resultados),
            "relevanceLanguage": idioma,
            "key": api_key,
        })
        r.raise_for_status()
        items = r.json().get("items", [])
        ids = [i["snippet"]["channelId"] for i in items if i.get("snippet")]
        if not ids:
            return []
        r2 = cliente.get(f"{YT_API}/channels", params={
            "part": "snippet,statistics",
            "id": ",".join(ids),
            "key": api_key,
        })
        r2.raise_for_status()
        canales = []
        for c in r2.json().get("items", []):
            est = c.get("statistics", {})
            sn = c.get("snippet", {})
            canales.append({
                "canalId": c["id"],
                "canal": sn.get("customUrl") or sn.get("title", ""),
                "titulo": sn.get("title", ""),
                "descripcion": (sn.get("description") or "")[:400],
                "pais": sn.get("country", ""),
                "subs": int(est.get("subscriberCount") or 0),
                "videos": int(est.get("videoCount") or 0),
                "vistas": int(est.get("viewCount") or 0),
                "url": f"https://www.youtube.com/channel/{c['id']}",
            })
        return canales


def about_links(channel_url):
    """Enlaces del panel 'Acerca de' del canal via la API interna de YouTube
    (los del HTML estatico desaparecieron en 2026; portado del nucleo Siemon #106).
    Devuelve lista de URLs externas publicas."""
    cab = {"User-Agent": UA_NAV, "Accept-Language": "es"}
    try:
        with httpx.Client(timeout=15, follow_redirects=True) as cliente:
            html = cliente.get(channel_url + "/about", headers=cab).text
    except Exception:
        return []

    def _extraer(t):
        out = []
        # enlaces envueltos en el redirect de YouTube (q=https...)
        for q in re.findall(r'q(?:=|%3D)(https?[^&"\\\\]+)', t):
            u = urllib.parse.unquote(urllib.parse.unquote(q))
            if u not in out:
                out.append(u)
        # layout 2026: los links vienen DIRECTOS en channelExternalLinkViewModel,
        # a veces sin esquema ("exphub.in")
        for c in re.findall(r'"channelExternalLinkViewModel":\{.*?"link":\{"content":"([^"]+)"', t):
            u = c if c.startswith("http") else "https://" + c
            if u not in out:
                out.append(u)
        return out

    directo = _extraer(html)   # a veces ya vienen en el HTML inicial
    mkey = re.search(r'"INNERTUBE_API_KEY":"([^"]+)"', html)
    if not mkey:
        return directo
    toks = re.findall(r'"continuationCommand":\{"token":"([^"]+)"', html)
    for tok in toks[:10]:
        body = {"context": {"client": {"clientName": "WEB",
                                       "clientVersion": "2.20240101.00.00",
                                       "hl": "es"}}, "continuation": tok}
        try:
            with httpx.Client(timeout=15) as cliente:
                t = cliente.post(
                    "https://www.youtube.com/youtubei/v1/browse?key=" + mkey.group(1),
                    json=body, headers=cab,
                ).text
        except Exception:
            continue
        if "aboutChannelViewModel" not in t and "channelExternalLinkViewModel" not in t:
            continue
        found = _extraer(t)
        if found:
            return found
    return directo


def enriquecer_contacto(canal):
    """Completa el prospecto con los enlaces PUBLICOS del 'Acerca de' (redes + web
    propia) y, si hay web propia, busca el email publico en ella (YouTube esconde
    el correo tras captcha). Muta y devuelve el dict del canal."""
    url = canal.get("url")
    if not url:
        return canal
    redes = canal.setdefault("redes", {})
    web_externa = ""
    for u in about_links(url):
        low = u.lower()
        if "instagram.com" in low:
            redes.setdefault("instagram", u)
        elif "tiktok.com" in low:
            redes.setdefault("tiktok", u)
        elif "twitter.com" in low or "//x.com" in low:
            redes.setdefault("twitter", u)
        elif "facebook.com" in low:
            redes.setdefault("facebook", u)
        elif "linkedin.com" in low:
            redes.setdefault("linkedin", u)
        elif not any(s in low for s in _LINK_SKIP):
            if not web_externa:
                web_externa = u
    if web_externa:
        canal["web"] = web_externa
    if not canal.get("email") and web_externa:
        base = web_externa.rstrip("/")
        for ruta in ("", "/contacto", "/contact", "/about"):
            try:
                with httpx.Client(timeout=8, follow_redirects=True) as cliente:
                    ht = cliente.get(base + ruta, headers={"User-Agent": UA_NAV}).text
            except Exception:
                continue
            cands = sorted(
                {m.lower() for m in _MAIL.findall(ht)
                 if not any(s in m.lower() for s in _MAIL_SKIP)
                 and not m.lower().endswith((".png", ".jpg", ".gif", ".webp", ".svg"))},
                key=len,
            )
            if cands:
                canal["email"] = cands[0]
                break
    return canal


def ambassador_fit_score(canal, vertical=""):
    """Heuristica 0-100 del fit como embajador del programa WealthCycle.

    Criterios: tamano util (ni micro ni gigante inalcanzable), actividad
    (videos publicados), engagement estimado (vistas por suscriptor) y
    mencion de la vertical en la descripcion. La IA puede refinar despues;
    esta base no depende de servicios externos.
    """
    puntos = 0
    subs = canal.get("subs", 0)
    if 10_000 <= subs <= 500_000:
        puntos += 40  # sweet spot: audiencia real y alcanzable para partnership
    elif 3_000 <= subs < 10_000 or 500_000 < subs <= 2_000_000:
        puntos += 25
    elif subs > 0:
        puntos += 10

    videos = canal.get("videos", 0)
    if videos >= 100:
        puntos += 20
    elif videos >= 30:
        puntos += 15
    elif videos >= 10:
        puntos += 8

    if subs > 0 and canal.get("vistas", 0) / max(subs, 1) >= 50:
        puntos += 20  # el canal retiene y sus videos circulan
    elif subs > 0 and canal.get("vistas", 0) / max(subs, 1) >= 15:
        puntos += 12

    descripcion = (canal.get("descripcion") or "").lower()
    palabras = [p for p in vertical.lower().replace("/", " ").split() if len(p) > 3]
    if any(p in descripcion for p in palabras):
        puntos += 20
    return min(100, puntos)
