"""Resuelve la web de un negocio cuando la fuente no la trae (caso comun en OSM).
Busca en DuckDuckGo (HTML, sin API key) "[nombre] [ciudad]" y toma el primer
resultado que no sea un directorio/red social. Best-effort: si no encuentra, deja
la web vacia (y para muchos servicios, no tener web ya es la oportunidad)."""
import re
import urllib.parse
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from models import Prospecto  # noqa: E402

try:
    import requests
except Exception:
    requests = None
try:
    from bs4 import BeautifulSoup
except Exception:
    BeautifulSoup = None

UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/122.0 Safari/537.36")

# dominios que NO son la web propia del negocio
EXCLUIR = ("duckduckgo.com", "google.", "facebook.com", "instagram.com", "linkedin.com",
           "twitter.com", "x.com", "youtube.com", "tiktok.com", "yelp.", "tripadvisor.",
           "paginasamarillas.", "qdq.com", "doctoralia.", "booking.com", "wikipedia.org",
           "maps.", "waze.com", "foursquare.com", "el-tenedor", "thefork.",
           "mapcarta.com", "openstreetmap.org", "mapy.cz", "cylex", "infobel",
           "yellowpages", "einforma", "expansion.com", "axesor", "guiaempresas")


def _limpia(uddg_url: str) -> str:
    # DDG envuelve el link real en /l/?uddg=<encoded>
    m = re.search(r"uddg=([^&]+)", uddg_url)
    if m:
        return urllib.parse.unquote(m.group(1))
    return uddg_url


def _serper_links(consulta: str, timeout: int = 12) -> list:
    """Busca en Google via Serper (la IP del VPS bloquea DDG/motores libres)."""
    key = os.environ.get("SERPER_API_KEY")
    if not key or requests is None:
        return []
    try:
        r = requests.post("https://google.serper.dev/search",
                          headers={"X-API-KEY": key, "Content-Type": "application/json"},
                          json={"q": consulta, "num": 8}, timeout=timeout)
        data = r.json()
        return [o.get("link", "") for o in (data.get("organic") or []) if o.get("link")]
    except Exception:
        return []


def _ddg_links(consulta: str, timeout: int = 10) -> list:
    if requests is None:
        return []
    q = urllib.parse.quote_plus(consulta)
    try:
        html = requests.get(f"https://html.duckduckgo.com/html/?q={q}",
                            headers={"User-Agent": UA}, timeout=timeout).text
    except Exception:
        return []
    if BeautifulSoup is not None:
        soup = BeautifulSoup(html, "html.parser")
        return [_limpia(a.get("href", "")) for a in soup.select("a.result__a")]
    return [_limpia(u) for u in re.findall(r'class="result__a" href="([^"]+)"', html)]


def resolver_web(p: Prospecto, timeout: int = 10) -> Prospecto:
    if p.web or requests is None:
        return p
    consulta = f"{p.nombre} {p.ciudad}".strip()
    enlaces = _serper_links(consulta) or _ddg_links(consulta, timeout)   # Serper primero (DDG bloqueado en el VPS)
    for url in enlaces:
        low = (url or "").lower()
        if url.startswith("http") and not any(d in low for d in EXCLUIR):
            p.web = url
            return p
    return p
