"""Colectores de prospeccion. Agnosticos a la fuente: cada colector devuelve
candidatos normalizados y el pipeline los deduplica, puntua y guarda.

Guardarrailes (skill prospeccion): solo datos publicos de negocios/creadores,
respetar ToS y rate limits, nada de scraping agresivo.
"""
import httpx

YT_API = "https://www.googleapis.com/youtube/v3"

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
