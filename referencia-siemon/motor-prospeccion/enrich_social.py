"""Rastreo de email por prospecto: usa Serper para hallar su web/link personal y
saca el correo de ahi (o del snippet). Datos publicos. Sube la contactabilidad."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
try:
    import requests
except Exception:
    requests = None
from collectors.scrapling_col import ColectorScrapling      # noqa: E402
from collectors.youtube_col import _MAIL, _MAIL_SKIP, UA_YT  # noqa: E402 (reutiliza)

_DESECHAR = ("instagram.", "tiktok.", "twitter.", "x.com", "facebook.", "fb.com",
             "youtube.", "youtu.be", "linkedin.", "t.me", "wa.me", "whatsapp.",
             "google.", "paginasamarillas.", "yelp.", "tripadvisor.", "linktr.ee",
             "beacons.ai", "wikipedia.", "spotify.", "apple.", "amazon.", "patreon.")


def _desechable(url):
    low = (url or "").lower()
    return any(h in low for h in _DESECHAR)


def _emails(html):
    out = []
    for e in {m.lower() for m in _MAIL.findall(html or "")}:
        if any(s in e for s in _MAIL_SKIP) or e.endswith((".png", ".jpg", ".gif", ".webp", ".svg")):
            continue
        out.append(e)
    return sorted(out, key=len)   # el mas corto suele ser el real


def _fetch(url):
    if requests is None:
        return ""
    try:
        return requests.get(url, headers={"User-Agent": UA_YT, "Accept-Language": "es"}, timeout=12).text
    except Exception:
        return ""


def hunt_email(p):
    """Devuelve un email para el prospecto p (dict) o '' si no encuentra."""
    if p.get("email"):
        return p["email"]
    col = ColectorScrapling()
    nicho = (p.get("categoria") or "").split("·")[-1].strip()
    nombre = (p.get("nombre") or "").strip()
    # 1) webs candidatas ya conocidas (enlaces del perfil, no sociales)
    sites = [u for u in (p.get("enlaces") or []) if not _desechable(u)]
    # 2) buscar su web con Serper si no hay
    if nombre:
        try:
            for t, u, d in col._buscar_ddg(f"{nombre} {nicho} contacto email")[:8]:
                em = _emails(d)                 # el email a veces esta en el snippet
                if em:
                    return em[0]
                if not _desechable(u) and u not in sites:
                    sites.append(u)
                if len(sites) >= 3:
                    break
        except Exception:
            pass
    # 3) entrar a la web y su pagina de contacto
    for s in sites[:3]:
        base = s.rstrip("/")
        for suf in ("", "/contacto", "/contact", "/about", "/sobre-mi"):
            em = _emails(_fetch(base + suf))
            if em:
                return em[0]
    return ""
