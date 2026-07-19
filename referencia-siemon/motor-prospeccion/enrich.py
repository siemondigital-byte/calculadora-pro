"""Enriquecimiento: entra a la web del negocio y analiza su presencia digital.
Llena tiene_web, https, responsive, seo, redes, email, senales y nivel_digital.

Usa requests + BeautifulSoup (corren en Python 3.9). Es la web PROPIA del negocio,
riesgo de bloqueo bajo; por eso no hace falta stealth aqui."""
import re
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from models import Prospecto      # noqa: E402
from config import SENALES, REDES  # noqa: E402

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
EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}")
# emails de plantillas/servicios que NO son del negocio
_EMAIL_BASURA = ("sentry", "wixpress", "example.", "yourname", "your@", "email@",
                 "@sentry", "@2x", ".png", ".jpg", ".gif", ".webp", "@domain",
                 "user@", "info@example", "test@", "noreply@localhost")
# rutas que NO son un perfil (para no confundirlas con un @handle)
_NO_HANDLE = {"p", "reel", "reels", "explore", "tags", "tag", "channel", "embed",
              "accounts", "stories", "share", "discover", "music", "video", "t"}


def _emails_de(html: str) -> list:
    """Emails plausibles del negocio: primero los de mailto:, luego el resto, sin basura."""
    mailtos = re.findall(r'mailto:([^"?\'>\s]+)', html or "", re.I)
    otros = EMAIL_RE.findall(html or "")
    vistos, out = set(), []
    for e in mailtos + otros:
        e = e.strip().strip(".").lower()
        if not e or e in vistos or any(b in e for b in _EMAIL_BASURA):
            continue
        vistos.add(e)
        out.append(e)
    return out


def _handle(url):
    """Extrae el @usuario publico de una URL de Instagram o TikTok. '' si no aplica."""
    m = re.search(r"(?:instagram\.com|tiktok\.com)/@?([A-Za-z0-9._]{2,30})", url or "", re.I)
    if not m:
        return ""
    h = m.group(1)
    return "" if h.lower() in _NO_HANDLE else "@" + h


def _norm_url(u: str) -> str:
    u = (u or "").strip()
    if u and not u.startswith("http"):
        u = "https://" + u
    return u


def enriquecer(p: Prospecto, timeout: int = 12) -> Prospecto:
    p.web = _norm_url(p.web)
    if not p.web:
        p.tiene_web = False
        p.nivel_digital = "bajo"
        return p
    if requests is None:
        return p  # sin requests no podemos analizar; el score usara lo que haya

    try:
        r = requests.get(p.web, headers={"User-Agent": UA}, timeout=timeout, allow_redirects=True)
        html = r.text or ""
        final_url = r.url
    except Exception as e:
        # la web no responde: para muchos servicios eso ES la oportunidad
        p.tiene_web = True
        p.https = False
        p.nivel_digital = "bajo"
        p.problemas.append("La web no carga o esta caida")
        return p

    p.tiene_web = True
    p.https = final_url.lower().startswith("https")
    low = html.lower()

    # --- SEO / responsive ---
    if BeautifulSoup is not None:
        soup = BeautifulSoup(html, "html.parser")
        title = (soup.title.string.strip() if soup.title and soup.title.string else "")
        md = soup.find("meta", attrs={"name": "description"})
        meta_desc = (md.get("content", "").strip() if md else "")
        h1 = soup.find("h1")
        h1t = (h1.get_text(strip=True) if h1 else "")
        vp = soup.find("meta", attrs={"name": "viewport"})
        p.responsive = vp is not None
        # email visible: primero el del dominio propio, luego mailto; el resto suele
        # ser del diseñador de la web ("creado por...") y NO es del negocio
        if not p.email:
            dom = re.sub(r"^www\.", "", (final_url.split("/")[2] if "//" in final_url else ""))
            cand = _emails_de(html)
            propio = [e for e in cand if dom and dom.split(".")[0] in e]
            mailtos = [e.strip().lower() for e in re.findall(r'mailto:([^"?\'>\s]+)', html, re.I)
                       if not any(b in e.lower() for b in _EMAIL_BASURA)]
            if propio:
                p.email = propio[0]
            elif mailtos:
                p.email = mailtos[0]
        # telefono visible (tel: y WhatsApp son señal inequivoca del negocio)
        if not p.telefono:
            tels = re.findall(r'href=["\']tel:([+0-9()\s.\-]{7,20})', html, re.I)
            was = re.findall(r'wa\.me/(\d{8,15})', html)
            if tels:
                p.telefono = tels[0].strip()
            elif was:
                p.telefono = "+" + was[0]
        # redes (guarda la URL y, para IG/TikTok, el @handle publico para DM)
        for red, dominios in REDES.items():
            for dom in dominios:
                a = soup.find("a", href=re.compile(dom))
                if a:
                    href = a.get("href")
                    p.redes[red] = href
                    if red in ("instagram", "tiktok"):
                        h = _handle(href)
                        if h:
                            p.redes[red + "_handle"] = h
                    break
    else:
        title = (re.search(r"<title[^>]*>(.*?)</title>", html, re.I | re.S) or [None, ""])[1].strip()
        meta_desc = ""
        h1t = ""
        p.responsive = 'name="viewport"' in low
        if not p.email:
            cand = _emails_de(html)
            if cand:
                p.email = cand[0]
        for red, dominios in REDES.items():
            for dom in dominios:
                if dom in low:
                    p.redes[red] = dom
                    break

    p.seo = {"title": title, "meta_description": meta_desc, "h1": h1t}
    # descripcion del negocio (para evaluar viabilidad: que hace / que servicios)
    if not p.bio:
        desc = (meta_desc or h1t or title or "").strip()
        if desc:
            p.bio = desc[:400]

    # --- fallback: buscar email y telefono en la pagina de contacto ---
    if not p.email or not p.telefono:
        base = final_url.rstrip("/")
        for ruta in ("/contacto", "/contact", "/es/contacto", "/contacto.html", "/aviso-legal"):
            try:
                rc = requests.get(base + ruta, headers={"User-Agent": UA}, timeout=8)
                if rc.status_code != 200:
                    continue
                if not p.email:
                    cand = _emails_de(rc.text)
                    if cand:
                        p.email = cand[0]
                if not p.telefono:
                    tels = re.findall(r'href=["\']tel:([+0-9()\s.\-]{7,20})', rc.text, re.I)
                    if tels:
                        p.telefono = tels[0].strip()
                if p.email and p.telefono:
                    break
            except Exception:
                continue

    # --- senales (chatbot, reservas, ecommerce, blog) ---
    for senal, marcas in SENALES.items():
        p.señales[senal] = any(m in low for m in marcas)
    # moderno: heuristica simple (frameworks/tags recientes)
    p.señales["moderno"] = any(x in low for x in
                               ["tailwind", "next.js", "__next", "react", "wp-content/themes",
                                "elementor", "webflow", "framer", "gsap"])

    # --- nivel digital global ---
    puntos = sum([
        p.https, p.responsive, bool(title), bool(meta_desc), bool(h1t),
        bool(p.redes), p.señales.get("chatbot", False), p.señales.get("reservas", False),
        p.señales.get("moderno", False),
    ])
    p.nivel_digital = "alto" if puntos >= 7 else "medio" if puntos >= 4 else "bajo"
    return p
