"""Pipeline por canal. Cada canal es una skill de prospeccion:
  directorios -> OSM + analisis de web (negocios)
  scrapling   -> busqueda web con Scrapling (negocios)
  youtube     -> YouTube Data API v3 (creadores/embajadores)

Los canales de negocio comparten enriquecimiento (web) y scoring por servicio.
El canal youtube trae los creadores ya puntuados por Fit y no analiza web."""
import os
import sys
from concurrent.futures import ThreadPoolExecutor
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from models import Prospecto            # noqa: E402
from enrich import enriquecer            # noqa: E402
from resolver import resolver_web         # noqa: E402
from scoring import puntuar, redactar_mensaje  # noqa: E402
from collectors.osm import ColectorOSM   # noqa: E402

# canales de negocio (con analisis de web) vs sociales (perfil ya linkable, sin web)
NEGOCIO = {"directorios", "osm", "scrapling", "google_maps"}
SOCIAL = {"youtube", "instagram", "linkedin"}


def _colector(canal: str):
    if canal in ("directorios", "osm"):
        return ColectorOSM()
    if canal == "scrapling":
        from collectors.scrapling_col import ColectorScrapling
        return ColectorScrapling()
    if canal == "google_maps":
        from collectors.google_maps import ColectorGoogleMaps
        return ColectorGoogleMaps()
    if canal == "youtube":
        from collectors.youtube_col import ColectorYouTube
        return ColectorYouTube()
    if canal == "instagram":
        from collectors.social import ColectorInstagram
        return ColectorInstagram()
    if canal == "linkedin":
        from collectors.social import ColectorLinkedIn
        return ColectorLinkedIn()
    raise ValueError(f"canal desconocido: {canal}")


def _norm_clave(s):
    return (s or "").lower().strip().replace("https://", "").replace("http://", "").rstrip("/")


def prospectar(sector: str, ciudad: str, servicio: str,
               n: int = 25, canales=None, idioma: str = "es", excluir=None) -> dict:
    # compat: antes se llamaba 'fuentes' con ['osm']; ahora 'canales'
    canales = canales or ["directorios"]
    canales = [("directorios" if c == "osm" else c) for c in canales]
    bloq = set(_norm_clave(x) for x in (excluir or []) if x)   # descartados: no volver a traerlos

    negocios, sociales, avisos = [], [], []
    for c in canales:
        try:
            items = _colector(c).buscar(sector, ciudad, n)
            if c in SOCIAL:
                sociales.extend(items)
                if c == "youtube" and not items and not os.environ.get("YOUTUBE_API_KEY"):
                    avisos.append("El canal YouTube necesita YOUTUBE_API_KEY en el servidor "
                                  "(API oficial de YouTube). Avisa a quien administra el VPS.")
            else:
                negocios.extend(items)
        except Exception as e:
            print(f"[pipeline] canal {c} fallo: {e}")
            avisos.append(f"El canal {c} fallo: {e}")

    def _descartado(p):
        return bool(bloq) and (p.clave() in bloq or _norm_clave(p.nombre) in bloq or _norm_clave(p.email) in bloq)

    # --- negocios: dedup -> web -> enrich -> score -> mensaje ---
    unicos, vistos = [], set()
    for p in negocios:
        if _descartado(p):
            continue
        k = p.clave()
        if k and k not in vistos:
            vistos.add(k)
            unicos.append(p)

    if unicos:
        with ThreadPoolExecutor(max_workers=8) as ex:
            unicos = list(ex.map(lambda p: resolver_web(p), unicos))
        with ThreadPoolExecutor(max_workers=8) as ex:
            unicos = list(ex.map(lambda p: enriquecer(p), unicos))
        for p in unicos:
            puntuar(p, servicio)
        encajan_neg = [p for p in unicos if p.encaja]
        with ThreadPoolExecutor(max_workers=4) as ex:
            list(ex.map(lambda p: redactar_mensaje(p, servicio, idioma), encajan_neg))

    # --- sociales (youtube/instagram/linkedin): ya vienen linkables y puntuados ---
    usoc, vc = [], set()
    for p in sociales:
        if _descartado(p):
            continue
        k = (p.web or (p.redes or {}).get("instagram") or (p.redes or {}).get("linkedin") or p.nombre or "").lower()
        if k and k not in vc:
            vc.add(k)
            usoc.append(p)

    todos = unicos + usoc
    todos.sort(key=lambda p: p.score, reverse=True)
    encajan = [p for p in todos if p.encaja]
    return {
        "sector": sector, "ciudad": ciudad, "servicio": servicio,
        "canales": canales, "total": len(todos), "encajan": len(encajan),
        "avisos": avisos,
        "prospectos": [p.json() for p in todos],
    }


def reenriquecer(prospectos):
    """Re-scrapea contacto e info de negocios ya guardados (los viejos sin contacto).
    Busca la web (Serper), entra y saca email/tel/redes/descripcion. No pierde datos existentes."""
    from models import Prospecto
    pares = []
    for pd in (prospectos or []):
        p = Prospecto(nombre=pd.get("nombre", ""), fuente=pd.get("fuente", ""), categoria=pd.get("categoria", ""),
                      ciudad=pd.get("ciudad", ""), web=pd.get("web", ""), telefono=pd.get("telefono", ""),
                      email=pd.get("email", ""), direccion=pd.get("direccion", ""), redes=dict(pd.get("redes") or {}),
                      canal=pd.get("canal", "directorios"), tipo=pd.get("tipo", "negocio"))
        pares.append((pd, p))
    with ThreadPoolExecutor(max_workers=8) as ex:
        list(ex.map(lambda pr: resolver_web(pr[1]), pares))
    with ThreadPoolExecutor(max_workers=8) as ex:
        list(ex.map(lambda pr: enriquecer(pr[1]), pares))
    out = []
    for pd, p in pares:
        m = dict(pd)
        for k in ("web", "telefono", "email", "direccion", "bio"):
            v = getattr(p, k, "")
            if v and not m.get(k):
                m[k] = v
        if p.redes:
            m["redes"] = {**(m.get("redes") or {}), **p.redes}
        if p.seo:
            m["seo"] = p.seo
        if p.señales:
            m["señales"] = p.señales
        if p.nivel_digital:
            m["nivel_digital"] = p.nivel_digital
        out.append(m)
    return out
