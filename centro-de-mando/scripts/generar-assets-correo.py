#!/usr/bin/env python3
"""Hace las plantillas de correo fieles al diseño TAMBIÉN en Gmail.

Gmail elimina <svg> y position:absolute, así que el candado, los iconos del
embudo y la órbita del lockup quedaban como círculos vacíos. Este script:

1. Rasteriza cada elemento a PNG (3x, fondo transparente) con la MISMA
   geometría y color del diseño -> web-emails/assets/ (se publican en
   https://atlantisglobalrealty.com/emails/assets/).
2. Reemplaza en las plantillas (dist-email de credenciales y dist-n8n del
   embudo) el <svg>/la órbita por <img> a esas URLs.

Las versiones dist-web NO se tocan: el navegador sí renderiza SVG.
Correr desde la raíz y luego regenerar flujos:

    python3 centro-de-mando/scripts/generar-assets-correo.py
    python3 centro-de-mando/scripts/integrar-correos-diseno.py
    python3 centro-de-mando/scripts/generar-flujos-embudo.py
"""
import re
from pathlib import Path

import cairosvg

RAIZ = Path(__file__).resolve().parents[2]
ASSETS = RAIZ / "web-emails" / "assets"
BASE_URL = "https://atlantisglobalrealty.com/emails/assets"
BRONCE = "#C6A87F"   # legible sobre la tarjeta clara y la oscura

# nombre de archivo -> firma que lo identifica dentro del svg
FIRMAS = {
    "candado": "M7 11V7a5",
    "icono-calendario": "M16 3v4",
    "icono-check": "M6 13l4.5",
    "icono-campana": "M18 9a6 6",
    "icono-monitor": "M9 20.5h6",
}

# la órbita del lockup (ring + gap + dot en absolute) reconstruida como arco SVG
ORBITA_SVG = (
    '<svg xmlns="http://www.w3.org/2000/svg" width="34" height="34" viewBox="0 0 34 34">'
    f'<path d="M 28.92 18.0 A 13.5 13.5 0 1 1 20.01 3.77" fill="none" '
    f'stroke="{BRONCE}" stroke-width="1.6"/>'
    f'<circle cx="15" cy="4" r="3" fill="{BRONCE}"/></svg>'
)
# temporizador sobrio (reemplaza a &#9202;, que iOS pinta como emoji de color)
RELOJITO_SVG = (
    '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24">'
    f'<circle cx="12" cy="13.5" r="8" fill="none" stroke="{BRONCE}" stroke-width="2.2"/>'
    f'<path d="M12 13.5V8.5M9 2h6M12 2v3.5" fill="none" stroke="{BRONCE}" '
    'stroke-width="2.2" stroke-linecap="round"/></svg>'
)
ORBITA_RE = re.compile(
    r'<div style="width:34px;height:34px;position:relative;[^"]*">'
    r'(?:<div class="ring[^"]*"[^>]*></div>){3}</div>'
)


def rasterizar(nombre, svg, escala=3):
    cairosvg.svg2png(bytestring=svg.encode(), write_to=str(ASSETS / f"{nombre}.png"),
                     scale=escala)
    print(f"   asset: {nombre}.png")


def img_tag(nombre, w, h):
    return (f'<img src="{BASE_URL}/{nombre}.png" width="{w}" height="{h}" alt="" '
            f'style="vertical-align:middle;border:0;">')


def patch(archivo):
    html = archivo.read_text(encoding="utf-8")
    original = html
    for m in re.findall(r"<svg.*?</svg>", html, re.S):
        nombre = next((n for n, f in FIRMAS.items() if f in m), None)
        if not nombre:
            raise SystemExit(f"{archivo.name}: SVG sin firma conocida: {m[:120]}")
        w = re.search(r'width="(\d+)"', m).group(1)
        h = re.search(r'height="(\d+)"', m).group(1)
        html = html.replace(m, img_tag(nombre, w, h))
    html = ORBITA_RE.sub(
        f'<img src="{BASE_URL}/orbita.png" width="34" height="34" alt="" '
        'style="display:block;border:0;">', html)
    if html != original:
        archivo.write_text(html, encoding="utf-8")
        return True
    return False


def main():
    ASSETS.mkdir(parents=True, exist_ok=True)

    # 1. assets: la orbita + cada svg unico encontrado en las plantillas
    rasterizar("orbita", ORBITA_SVG)
    rasterizar("relojito", RELOJITO_SVG)
    unicos = {}
    fuentes = (list((RAIZ / "emails" / "credenciales-app" / "dist-email").glob("*.html"))
               + list((RAIZ / "emails" / "embudo-atlantis" / "emails" / "dist-n8n").rglob("*.html")))
    for f in fuentes:
        for m in re.findall(r"<svg.*?</svg>", f.read_text(encoding="utf-8"), re.S):
            nombre = next((n for n, s in FIRMAS.items() if s in m), None)
            if nombre and nombre not in unicos:
                svg = m.replace("currentColor", BRONCE)
                if 'xmlns' not in svg:
                    svg = svg.replace("<svg ", '<svg xmlns="http://www.w3.org/2000/svg" ', 1)
                unicos[nombre] = svg
    for nombre, svg in unicos.items():
        rasterizar(nombre, svg)

    # 2. parchear plantillas
    tocados = sum(patch(f) for f in fuentes)
    print(f"OK: {len(unicos) + 1} assets, {tocados} plantillas parcheadas")


if __name__ == "__main__":
    main()
