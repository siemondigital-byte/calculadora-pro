"""Colector Google Maps con Scrapling (DynamicFetcher = navegador real, stealth).
Fuente MAS RICA que OSM, pero:
  - Va contra los ToS de Google (usar a ritmo prudente).
  - El HTML de Maps es dinamico y cambia: los selectores de abajo son un punto
    de partida y hay que AFINARLOS una vez corriendo en vivo (ver README).

Scrapling se importa DENTRO del metodo para que el resto del motor corra en
Python 3.9 sin Scrapling; este colector si requiere Python 3.10+ + `scrapling install`."""
import time
import urllib.parse
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from models import Prospecto            # noqa: E402
from collectors.base import Colector     # noqa: E402


class ColectorGoogleMaps(Colector):
    nombre = "google_maps"

    def buscar(self, sector: str, ciudad: str, n: int) -> list:
        try:
            from scrapling.fetchers import DynamicFetcher  # import diferido
        except Exception as e:
            print(f"[google_maps] Scrapling no disponible ({e}). Instala Python 3.10+ "
                  f"y `pip install scrapling[fetchers]` + `scrapling install`.")
            return []

        consulta = urllib.parse.quote_plus(f"{sector} en {ciudad}")
        url = f"https://www.google.com/maps/search/{consulta}?hl=es"

        # network_idle + scroll para cargar mas resultados del panel lateral.
        def scroll(page):
            try:
                for _ in range(max(3, n // 5)):
                    page.evaluate(
                        "document.querySelector('div[role=feed]')?.scrollBy(0, 2000)")
                    time.sleep(1.2)
            except Exception:
                pass

        try:
            page = DynamicFetcher.fetch(
                url, headless=True, network_idle=True, page_action=scroll,
                wait_selector="div[role=feed]", timeout=60000,
            )
        except Exception as e:
            print(f"[google_maps] error al cargar Maps: {e}")
            return []

        out, vistos = [], set()
        # Cada resultado del panel es un <a href=".../maps/place/..."> con aria-label = nombre.
        tarjetas = page.css("a[href*='/maps/place/']")
        for a in tarjetas:
            nombre = (a.attrib.get("aria-label") or "").strip()
            href = a.attrib.get("href", "")
            if not nombre or nombre.lower() in vistos:
                continue
            vistos.add(nombre.lower())
            # el contenedor de la tarjeta suele tener web/telefono cerca (AFINAR selectores):
            cont = a.parent.parent if hasattr(a, "parent") else None
            web = tel = ""
            try:
                if cont is not None:
                    w = cont.css_first("a[href^='http']:not([href*='google'])")
                    web = w.attrib.get("href", "") if w else ""
                    # telefono suele venir en un span con formato; heuristica simple:
                    for sp in cont.css("span::text").getall():
                        s = sp.strip()
                        if sum(c.isdigit() for c in s) >= 7 and any(c in s for c in "+ ()-0123456789"):
                            tel = s
                            break
            except Exception:
                pass
            out.append(Prospecto(
                nombre=nombre, fuente="google_maps", categoria=sector, ciudad=ciudad,
                web=web, telefono=tel, maps_url=("https://www.google.com" + href if href.startswith("/") else href),
            ))
            if len(out) >= n:
                break
        return out
