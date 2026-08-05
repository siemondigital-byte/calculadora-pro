"""Canales sociales: Instagram y LinkedIn. NO scrapean la plataforma (va contra sus
ToS y bloquean bots); en su lugar buscan PERFILES PÚBLICOS por nicho en la web abierta
(vía el buscador que ya usa el canal scrapling) y devuelven el perfil linkable para
escribir por DM. Complementan al canal YouTube (creadores) para el ICP de Andrea."""
import re
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from models import Prospecto            # noqa: E402
from collectors.base import Colector     # noqa: E402
from enrich import _handle               # noqa: E402

_EMAIL = re.compile(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}")
_SEG = re.compile(r"([\d.,]+)\s*([KMkm]?)\s*(seguidores|followers|suscriptores|subscribers)", re.I)


def _nombre_de(titulo):
    t = re.split(r"\s[|\-–·:]\s", titulo or "")[0].strip()
    t = re.sub(r"\(@[^)]+\)", "", t).strip()          # quita "(@handle)" del titulo
    t = re.sub(r"\s+", " ", t)
    return t[:70]


def _seguidores(desc):
    m = _SEG.search(desc or "")
    if not m:
        return 0
    try:
        raw, suf = m.group(1), m.group(2).lower()
        if suf in ("k", "m"):                       # "12,5K" -> punto/coma = decimal
            base = float(raw.replace(",", "."))
            return int(base * (1_000 if suf == "k" else 1_000_000))
        return int(re.sub(r"[.,]", "", raw))        # "12.500" -> separador de miles
    except Exception:
        return 0


class _ColectorSocial(Colector):
    dominio = ""
    red = ""
    tipo = "creador"

    def _perfil(self, url):
        """Normaliza a URL de perfil, o '' si no es un perfil."""
        raise NotImplementedError

    def _prospecto(self, perfil, titulo, sector, ciudad, desc):
        raise NotImplementedError

    def buscar(self, sector, ciudad, n):
        from collectors.scrapling_col import ColectorScrapling  # reutiliza el buscador
        col = ColectorScrapling()
        consultas = [
            (f"{sector} {ciudad} site:{self.dominio}").strip(),
            (f"{sector} {ciudad} {self.red}").strip(),
            f"{sector} {self.red}",
        ]
        out, vistos = [], set()
        for c in consultas:
            for titulo, url, desc in col._buscar_ddg(c):
                if self.dominio not in url.lower():
                    continue
                perfil = self._perfil(url)
                if not perfil or perfil in vistos:
                    continue
                vistos.add(perfil)
                out.append(self._prospecto(perfil, titulo, sector, ciudad, desc))
                if len(out) >= n:
                    return out
        return out


class ColectorInstagram(_ColectorSocial):
    nombre = "instagram"
    dominio = "instagram.com"
    red = "instagram"
    tipo = "creador"

    def _perfil(self, url):
        h = _handle(url)                    # @usuario público (excluye /p/, /reel/, etc.)
        return ("https://www.instagram.com/" + h[1:] + "/") if h else ""

    def _prospecto(self, perfil, titulo, sector, ciudad, desc):
        h = "@" + perfil.rstrip("/").split("/")[-1]
        em = _EMAIL.search(desc or "")
        return Prospecto(
            nombre=_nombre_de(titulo) or h, fuente="instagram", canal="instagram", tipo="creador",
            categoria="Instagram · " + sector, ciudad=ciudad, web="", email=em.group(0) if em else "",
            redes={"instagram": perfil, "instagram_handle": h},
            bio=(desc or "")[:400], seguidores=_seguidores(desc),
            score=72, encaja=True,
            problemas=["Perfil de Instagram; escríbele por DM"],
            motivo="Perfil público de Instagram del nicho " + sector)


class ColectorLinkedIn(_ColectorSocial):
    nombre = "linkedin"
    dominio = "linkedin.com"
    red = "linkedin"
    tipo = "negocio"

    def _perfil(self, url):
        m = re.search(r"linkedin\.com/(in|company)/([A-Za-z0-9\-\_%]+)", url, re.I)
        return ("https://www.linkedin.com/%s/%s/" % (m.group(1), m.group(2))) if m else ""

    def _prospecto(self, perfil, titulo, sector, ciudad, desc):
        em = _EMAIL.search(desc or "")
        return Prospecto(
            nombre=_nombre_de(titulo) or "Perfil LinkedIn", fuente="linkedin", canal="linkedin", tipo="negocio",
            categoria="LinkedIn · " + sector, ciudad=ciudad, web="", email=em.group(0) if em else "",
            redes={"linkedin": perfil}, bio=(desc or "")[:400],
            score=70, encaja=True,
            problemas=["Perfil de LinkedIn; conéctate y escríbele"],
            motivo="Perfil público de LinkedIn del nicho " + sector)
