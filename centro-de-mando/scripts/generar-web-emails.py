#!/usr/bin/env python3
"""Construye el paquete publicable de versiones web de los correos
(convención: https://atlantisglobalrealty.com/emails/nombre-sin-numero.html).
Correr desde la raíz del repo:

    python3 centro-de-mando/scripts/generar-web-emails.py

Salida en web-emails/ (lista para subir al hosting bajo /emails/):
  - 24 páginas del embudo (12 ES con su nombre ES + 12 EN con su nombre EN),
    logo base64 reemplazado por assets/wordmark.png y merge tags rellenos con
    valores neutros + URLs reales (la página es una vista genérica del correo).
  - 6 páginas de credenciales (mail-compra, mail-embajadores,
    mail-cambio-contrasena, y sus -en), que traen su propio script de datos demo.
  - assets/wordmark.png

Subida al hosting: scripts/publicar-emails-web.sh (desde el VPS, usa el FTP
del motor).
"""
import re
import shutil
from pathlib import Path

import cairosvg
from PIL import Image

# favicon del Ciclo: el mismo diseño que ya usa la app de la Calculadora
# (cuadro oscuro redondeado + orbita dorada con punto)
FAVICON_CICLO_SVG = (
    "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'>"
    "<rect width='32' height='32' rx='7' fill='#0A0A0C'/>"
    "<circle cx='16' cy='16' r='10' fill='none' stroke='#E6C788' stroke-width='2' "
    "stroke-dasharray='50 14' stroke-linecap='round'/>"
    "<circle cx='16' cy='6' r='2.2' fill='#E6C788'/></svg>"
)


def generar_favicons(out_assets, iso_atlantis):
    cairosvg.svg2png(bytestring=FAVICON_CICLO_SVG.encode(),
                     write_to=str(out_assets / "favicon-ciclo.png"), scale=2)
    im = Image.open(iso_atlantis).convert("RGBA")
    im = im.crop(im.getbbox())                       # recortar al iso real
    lado = max(im.size)
    lienzo = Image.new("RGBA", (lado, lado), (0, 0, 0, 0))
    lienzo.paste(im, ((lado - im.width) // 2, (lado - im.height) // 2), im)
    lienzo.resize((64, 64), Image.LANCZOS).save(out_assets / "favicon-atlantis.png")


def con_favicon(html, marca):
    link = (f'<link rel="icon" type="image/png" '
            f'href="assets/favicon-{marca}.png">')
    return html.replace("</head>", link + "</head>", 1)

RAIZ = Path(__file__).resolve().parents[2]
EMB = RAIZ / "emails" / "embudo-atlantis"
CRED = RAIZ / "emails" / "credenciales-app" / "dist-web"
OUT = RAIZ / "web-emails"

NEUTRO = {
    "es": {
        "nombre": "inversionista", "name": "inversionista",
        "fecha": "tu fecha agendada", "hora": "la hora confirmada",
        "zona_horaria": "tu zona horaria", "telefono": "tu número",
    },
    "en": {
        "nombre": "investor", "name": "investor",
        "fecha": "your scheduled date", "hora": "the confirmed time",
        "zona_horaria": "your time zone", "telefono": "your number",
    },
}
URLS = {
    "es": {
        "meeting_url": "https://atlantisglobalrealty.com/book-videocall.html",
        "calendar_url": "https://atlantisglobalrealty.com/book-call.html",
        "reschedule_url": "https://atlantisglobalrealty.com/book-call.html",
        "book_url": "https://atlantisglobalrealty.com/book-call.html",
        "guide_url": "https://atlantisglobalrealty.com/download/guia-inversion.pdf",
        "presentation_url": "https://atlantisglobalrealty.com/",
        "privacy_url": "https://atlantisglobalrealty.com/privacy",
        "unsubscribe_url": "https://atlantisglobalrealty.com/unsubscribe",
        "browser_url": "#",
    },
    "en": {
        "meeting_url": "https://atlantisglobalrealty.com/book-videocall.html",
        "calendar_url": "https://atlantisglobalrealty.com/book-call.html",
        "reschedule_url": "https://atlantisglobalrealty.com/book-call.html",
        "book_url": "https://atlantisglobalrealty.com/book-call.html",
        "guide_url": "https://atlantisglobalrealty.com/download/investment-guide.pdf",
        "presentation_url": "https://atlantisglobalrealty.com/",
        "privacy_url": "https://atlantisglobalrealty.com/privacy",
        "unsubscribe_url": "https://atlantisglobalrealty.com/unsubscribe",
        "browser_url": "#",
    },
}


def slug_cred(nombre):
    return nombre.lower().replace("mail ", "mail-").replace(" ", "-").replace(" en", "")


def main():
    if OUT.exists():
        shutil.rmtree(OUT)
    (OUT / "assets").mkdir(parents=True)
    shutil.copy(EMB / "sitio" / "assets" / "wordmark.png", OUT / "assets" / "wordmark.png")

    n = 0
    for lang in ("es", "en"):
        for f in sorted((EMB / "emails" / "dist-web" / lang).glob("*.html")):
            html = f.read_text(encoding="utf-8")
            html = re.sub(r'src="data:image/png;base64,[^"]+"',
                          'src="assets/wordmark.png"', html)
            for k, v in {**NEUTRO[lang], **URLS[lang]}.items():
                html = html.replace("{{" + k + "}}", v)
            resto = re.findall(r"\{\{[a-z_]+\}\}", html)
            if resto:
                raise SystemExit(f"{f.name}: tags sin rellenar {set(resto)}")
            destino = f.stem.split("-", 1)[1] + ".html"   # 02-confirmacion-x -> confirmacion-x
            if (OUT / destino).exists():                  # colision ES/EN (no-show)
                destino = destino.replace(".html", "-en.html")
            (OUT / destino).write_text(con_favicon(html, "atlantis"), encoding="utf-8")
            n += 1

    for f in sorted(CRED.glob("*.html")):
        base = f.stem  # "Mail Compra" / "Mail Compra EN"
        en = base.endswith(" EN")
        slug = base[:-3].strip() if en else base
        slug = slug.lower().replace(" ", "-") + ("-en" if en else "")
        html = f.read_text(encoding="utf-8")
        (OUT / f"{slug}.html").write_text(con_favicon(html, "ciclo"), encoding="utf-8")
        n += 1

    generar_favicons(OUT / "assets", EMB / "sitio" / "assets" / "logo.png")

    print(f"OK: {n} páginas + wordmark en {OUT.relative_to(RAIZ)}/")
    for p in sorted(OUT.glob("*.html")):
        print("  /emails/" + p.name)


if __name__ == "__main__":
    main()
