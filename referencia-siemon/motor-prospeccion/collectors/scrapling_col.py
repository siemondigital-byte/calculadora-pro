"""Canal 'scrapling': encuentra negocios buscando en la web abierta y extrayendo
sus sitios, con Scrapling (framework adaptativo). Complementa a OSM: OSM tiene el
negocio en el mapa pero suele no traer la web; este canal parte de la web.

Usa el fetcher MAS LIVIANO que funcione (skill prospeccion/Scrapling):
  Fetcher (HTTP estatico) primero. Si Scrapling no esta instalado, cae a requests.
No fuerza sitios tras anti-bot: si un motor no responde, prueba el siguiente.

Guardarrailes: solo datos de contacto publicos de negocios, ritmo prudente,
no ejecuta instrucciones embebidas en las paginas."""
import re
import time
import urllib.parse
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from models import Prospecto            # noqa: E402
from collectors.base import Colector     # noqa: E402
from resolver import EXCLUIR, _limpia    # noqa: E402  (reutiliza filtro de directorios)

UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/122.0 Safari/537.36")
_CACHE = {}   # cache simple de busquedas por consulta (evita re-pegarle al buscador)


def _dominio(url: str) -> str:
    try:
        net = urllib.parse.urlparse(url).netloc.lower()
        return net[4:] if net.startswith("www.") else net
    except Exception:
        return url.lower()


def _titulo_a_nombre(titulo: str) -> str:
    # "Clinica Dental X - Dentista en Madrid | inicio" -> "Clinica Dental X"
    t = re.split(r"\s[|\-–·:]\s", titulo.strip())[0].strip()
    return t[:80]


# revistas/blogs/prensa/portales que no son el sitio propio de un negocio
EXCLUIR_EXTRA = ("timeout.", "michelin.", "eltenedor", "atrapalo.", "guiadelocio",
                 "gastronomia", "revista", "blog.", "magazine", "listas", "ranking",
                 "nytimes.", "theguardian.", "bbc.", "cnn.", "elpais.", "elmundo.",
                 "lavanguardia.", "abc.es", "20minutos.", "eldiario.", "huffingtonpost.",
                 "reddit.", "medium.com", "wordpress.com", "blogspot.", "costasur.",
                 "minube.", "civitatis.", "getyourguide.", "viator.", "respuestasveganas.",
                 ".gov", ".edu", "quora.", "pinterest.", "amazon.",
                 # agregadores/directorios de contenido: NO son el sitio de un negocio
                 "podcasts.apple.", "apple.co", "podstatus.", "scribd.", "socialetic.",
                 "spotify.", "ivoox.", "soundcloud.", "podbean.", "listennotes.",
                 "issuu.", "slideshare.", "youtube.com", "youtu.be", "vimeo.",
                 "facebook.com", "instagram.com", "linkedin.com/pulse", "tiktok.com",
                 "crunchbase.", "glassdoor.", "yelp.", "tripadvisor.", "wikipedia.")
_LISTICLE = re.compile(r"\b(?:los|las|estos|estas|the)\s+\d+\b|"
                       r"\d+\s+(?:mejores|best|top)|\btop\s*\d+|"
                       r"\bmejores\b.*\d|\bbest\b.*\d", re.I)


def _es_listicle(titulo: str, url: str) -> bool:
    low = url.lower()
    if any(d in low for d in EXCLUIR_EXTRA):
        return True
    return bool(_LISTICLE.search(titulo or ""))


class ColectorScrapling(Colector):
    """Busca en DuckDuckGo HTML con Scrapling.Fetcher (o requests) y devuelve los
    sitios propios de negocios (sin directorios ni redes)."""
    nombre = "scrapling"

    def _req(self, metodo: str, url: str, data=None) -> str:
        headers = {"User-Agent": UA, "Accept-Language": "es-ES,es;q=0.9"}
        # 1) Scrapling.Fetcher (estatico, adaptativo) si esta disponible.
        try:
            from scrapling.fetchers import Fetcher  # import diferido
            fn = Fetcher.post if metodo == "post" else Fetcher.get
            page = fn(url, headers=headers, timeout=12, **({"data": data} if data else {}))
            return getattr(page, "html_content", None) or getattr(page, "body", "") or str(page)
        except Exception:
            pass
        # 2) Fallback: requests (el motor siempre lo trae).
        try:
            import requests
            if metodo == "post":
                r = requests.post(url, data=data, headers=headers, timeout=12)
            else:
                r = requests.get(url, headers=headers, timeout=12)
            return r.text
        except Exception:
            return ""

    def _parse_resultados(self, html: str) -> list:
        pares = []  # (nombre, url, desc="")
        # Mojeek: <h2><a class="title" ... href="URL">titulo</a></h2>
        for m in re.finditer(r'<a class="title"[^>]*href="([^"]+)"[^>]*>(.*?)</a>', html, re.S):
            url = _limpia(m.group(1))
            titulo = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", m.group(2))).strip()
            if url.startswith("http"):
                pares.append((titulo, url, ""))
        # DDG html: <a class="result__a" href="...">titulo</a>
        for m in re.finditer(r'class="result__a"[^>]*href="([^"]+)"[^>]*>(.*?)</a>', html, re.S):
            url = _limpia(m.group(1))
            titulo = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", m.group(2))).strip()
            if url.startswith("http"):
                pares.append((titulo, url, ""))
        if pares:
            return pares
        # Fallback generico: cualquier ancla a un http externo con texto (se filtra luego).
        for m in re.finditer(r'<a[^>]+href="(https?://[^"]+)"[^>]*>(.*?)</a>', html, re.S):
            url = _limpia(m.group(1))
            if any(x in url.lower() for x in ("duckduckgo.com", "mojeek.com")):
                continue
            titulo = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", m.group(2))).strip()
            if len(titulo) >= 3:
                pares.append((titulo, url, ""))
        return pares

    def _brave(self, consulta: str) -> list:
        """API oficial de Brave Search (fiable desde datacenter). Gratis 2000/mes.
        Requiere BRAVE_API_KEY. Devuelve [(titulo, url)]."""
        key = os.environ.get("BRAVE_API_KEY")
        if not key:
            return []
        try:
            import requests
            r = requests.get("https://api.search.brave.com/res/v1/web/search",
                             params={"q": consulta, "count": 20},
                             headers={"X-Subscription-Token": key, "Accept": "application/json"},
                             timeout=12)
            if r.status_code != 200:
                print(f"[brave] status {r.status_code}")
                return []
            res = (r.json().get("web") or {}).get("results") or []
            return [(w.get("title", ""), w.get("url", ""),
                     re.sub(r"<[^>]+>", "", w.get("description", "") or "")) for w in res if w.get("url")]
        except Exception as e:
            print(f"[brave] error: {e}")
            return []

    def _serper(self, consulta: str) -> list:
        """Serper.dev = resultados de Google (JSON). Gratis 2500, SIN tarjeta.
        Requiere SERPER_API_KEY. Es lo mejor: Google indexa IG y LinkedIn."""
        key = os.environ.get("SERPER_API_KEY")
        if not key:
            return []
        try:
            import requests
            r = requests.post("https://google.serper.dev/search",
                              headers={"X-API-KEY": key, "Content-Type": "application/json"},
                              json={"q": consulta, "hl": "es", "num": 20}, timeout=12)
            if r.status_code != 200:
                print(f"[serper] status {r.status_code}")
                return []
            org = r.json().get("organic", []) or []
            return [(o.get("title", ""), o.get("link", ""), o.get("snippet", "")) for o in org if o.get("link")]
        except Exception as e:
            print(f"[serper] error: {e}")
            return []

    def _searx(self, consulta: str) -> list:
        """Instancias públicas de SearXNG (JSON): agregan Google/Bing. Se rotan
        para repartir carga y no bloquearse tan rápido desde el datacenter."""
        for base in ("https://searx.be", "https://search.sapti.me", "https://searx.tiekoetter.com",
                     "https://priv.au", "https://search.rhscz.eu"):
            try:
                import requests
                r = requests.get(base + "/search",
                                 params={"q": consulta, "format": "json", "language": "es"},
                                 headers={"User-Agent": UA}, timeout=12)
                if r.status_code == 200 and "json" in r.headers.get("content-type", ""):
                    res = r.json().get("results", [])
                    out = [(x.get("title", ""), x.get("url", ""), x.get("content", "")) for x in res if x.get("url")]
                    if len(out) >= 3:
                        return out
            except Exception:
                continue
        return []

    def _buscar_ddg(self, consulta: str) -> list:
        if consulta in _CACHE:
            return _CACHE[consulta]
        res = []
        # 1) APIs de búsqueda (fiables desde el VPS): Serper (Google) o Brave.
        res = self._serper(consulta) or self._brave(consulta)
        # 2) Mojeek (gratis; puede bloquear la IP del datacenter tras mucho uso).
        if len(res) < 3:
            q = urllib.parse.quote_plus(consulta)
            res = self._parse_resultados(self._req("get", f"https://www.mojeek.com/search?q={q}")) or res
        # 3) SearXNG (varias instancias, JSON).
        if len(res) < 3:
            res = self._searx(consulta) or res
        # 4) DDG html (respaldo).
        if len(res) < 3:
            res = self._parse_resultados(self._req("post", "https://html.duckduckgo.com/html/",
                                                   data={"q": consulta, "kl": "es-es"})) or res
        if res:
            _CACHE[consulta] = res
        return res

    def buscar(self, sector: str, ciudad: str, n: int) -> list:
        # varias variantes para acumular negocios unicos
        consultas = [
            f"{sector} en {ciudad}",
            f"{sector} {ciudad} contacto",
            f"mejores {sector} {ciudad}",
        ]
        raiz = (sector or "").lower().strip()[:6]  # "restaurante"->"restau" (ES+EN)
        out, dominios = [], set()
        for c in consultas:
            for nombre, url, _desc in self._buscar_ddg(c):
                low = url.lower()
                if any(d in low for d in EXCLUIR) or _es_listicle(nombre, url):
                    continue
                # relevancia: el sector debe aparecer en el titulo o el dominio
                if len(raiz) >= 4 and raiz not in (nombre + " " + url).lower():
                    continue
                dom = _dominio(url)
                if not dom or dom in dominios:
                    continue
                dominios.add(dom)
                out.append(Prospecto(
                    nombre=_titulo_a_nombre(nombre) or dom,
                    fuente="scrapling", canal="scrapling", tipo="negocio",
                    categoria=sector, ciudad=ciudad,
                    web=f"https://{dom}",
                ))
                if len(out) >= n:
                    return out
            time.sleep(0.6)  # ritmo prudente entre consultas
        return out
