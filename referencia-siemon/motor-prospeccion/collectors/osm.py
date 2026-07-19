"""Colector OpenStreetMap (Overpass API). Fuente GRATIS y LEGITIMA (API oficial,
no rompe ToS). Trae negocios reales por categoria + ciudad, con nombre, web,
telefono, direccion y coordenadas cuando OSM los tiene.

Es la fuente base fiable del motor: funciona sin Scrapling y sin navegador."""
import json
import urllib.request
import urllib.parse
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from models import Prospecto            # noqa: E402
from config import SECTOR_A_OSM          # noqa: E402
from collectors.base import Colector     # noqa: E402

OVERPASS = "https://overpass-api.de/api/interpreter"
NOMINATIM = "https://nominatim.openstreetmap.org/search"
UA = "siemon-prospeccion/0.1 (contacto: andrea@siemondigital.com)"


def _area_id(ciudad: str):
    """Geocodifica la ciudad con Nominatim y devuelve el area id de Overpass
    (evita el problema de ciudades homonimas). None si no la ubica."""
    params = urllib.parse.urlencode({"q": ciudad, "format": "json", "limit": 1})
    req = urllib.request.Request(f"{NOMINATIM}?{params}", headers={"User-Agent": UA})
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            data = json.load(r)
    except Exception as e:
        print(f"[osm] Nominatim fallo: {e}")
        return None
    if not data:
        return None
    it = data[0]
    if it.get("osm_type") == "relation":
        return 3600000000 + int(it["osm_id"])
    if it.get("osm_type") == "way":
        return 2400000000 + int(it["osm_id"])
    return None


def _filtros(sector: str) -> list:
    s = sector.strip().lower()
    if s in SECTOR_A_OSM:
        return SECTOR_A_OSM[s]
    # coincidencia parcial (ej. "clinica dental estetica" -> "clinica dental")
    for k, v in SECTOR_A_OSM.items():
        if k in s or s in k:
            return v
    return []  # sin mapeo -> se busca por nombre


def _query(sector: str, ciudad: str, n: int, area_id) -> str:
    filtros = _filtros(sector)
    limite = max(n * 3, 30)  # pedimos de mas: muchos no tienen web/tel
    cuerpo = []
    if filtros:
        for f in filtros:
            k, _, val = f.partition("=")
            if val == "*":
                cuerpo.append(f'nwr["{k}"](area.a);')
            else:
                cuerpo.append(f'nwr["{k}"="{val}"](area.a);')
    else:
        term = sector.replace('"', '\\"')
        cuerpo.append(f'nwr["name"~"{term}",i](area.a);')
    # area por id (Nominatim) si la tenemos; si no, por nombre (menos preciso)
    if area_id:
        area = f'area({area_id})->.a;'
    else:
        ciudad_esc = ciudad.replace('"', '\\"')
        area = f'area["name"="{ciudad_esc}"]["boundary"="administrative"]->.a;'
    return (
        f'[out:json][timeout:25];'
        f'{area}'
        f'({"".join(cuerpo)});'
        f'out center tags {limite};'
    )


def _tag(tags: dict, *claves) -> str:
    for c in claves:
        if tags.get(c):
            return tags[c]
    return ""


class ColectorOSM(Colector):
    nombre = "osm"

    def buscar(self, sector: str, ciudad: str, n: int) -> list:
        area_id = _area_id(ciudad)
        q = _query(sector, ciudad, n, area_id)
        data = urllib.parse.urlencode({"data": q}).encode()
        req = urllib.request.Request(
            OVERPASS, data=data,
            headers={"User-Agent": "siemon-prospeccion/0.1 (contacto: andrea@siemondigital.com)"},
        )
        try:
            with urllib.request.urlopen(req, timeout=40) as r:
                d = json.load(r)
        except Exception as e:
            print(f"[osm] error Overpass: {e}")
            return []

        out = []
        vistos = set()
        for el in d.get("elements", []):
            t = el.get("tags", {})
            nombre = t.get("name") or t.get("brand")
            if not nombre or nombre.lower() in vistos:
                continue
            vistos.add(nombre.lower())
            web = _tag(t, "website", "contact:website", "url")
            tel = _tag(t, "phone", "contact:phone", "contact:mobile")
            calle = _tag(t, "addr:street")
            num = _tag(t, "addr:housenumber")
            direccion = " ".join(x for x in [calle, num] if x) or _tag(t, "addr:full")
            center = el.get("center") or {}
            out.append(Prospecto(
                nombre=nombre, fuente="osm", categoria=sector, ciudad=ciudad,
                web=web, telefono=tel,
                email=_tag(t, "email", "contact:email"),
                direccion=direccion,
                lat=el.get("lat") or center.get("lat"),
                lng=el.get("lon") or center.get("lon"),
            ))
            if len(out) >= n:
                break
        return out
