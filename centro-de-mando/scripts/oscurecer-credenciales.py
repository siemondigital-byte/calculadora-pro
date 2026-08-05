#!/usr/bin/env python3
"""Hace de la paleta OSCURA la versión única de los correos de credenciales.

Por qué: la app de Gmail no soporta prefers-color-scheme, así que nunca
aplicaba el bloque dark de la plantilla; tomaba la versión clara y la
recoloreaba con su propio algoritmo (marrón, botón lavanda). El diseño de
marca es el oscuro (navy #0F1B2D, crema, oro champagne) — igual que los
correos del embudo, que son "tema oscuro único" por decisión de marca.

Qué hace, por plantilla de emails/credenciales-app/dist-email/:
1. Lee su propio bloque `@media (prefers-color-scheme: dark)` (la fuente de
   verdad del diseño oscuro) y aplica esos valores como estilo INLINE por
   defecto en cada elemento con esa clase (incl. atributo bgcolor y el color
   dentro de shorthands `border:`).
2. Selectores descendientes `.btn-* a`: aplica el color al <a> interior.
3. Reemplaza el temporizador &#9202; (que iOS pinta como emoji de color) por
   el icono PNG relojito.png, sobrio y dorado como el resto.

Idempotente. Correr desde la raíz, después de generar-assets-correo.py y
antes de integrar-correos-diseno.py.
"""
import re
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
DIST = RAIZ / "emails" / "credenciales-app" / "dist-email"
RELOJ = ('<img src="https://atlantisglobalrealty.com/emails/assets/relojito.png" '
         'width="13" height="13" alt="" style="vertical-align:-2px;border:0;">')


def parsear_dark(html):
    m = re.search(r"@media \(prefers-color-scheme: dark\)\s*\{(.*?)\n\s*\}", html, re.S)
    if not m:
        raise SystemExit("bloque dark no encontrado")
    reglas = {}
    for sel, cuerpo in re.findall(r"([.\w\- ]+?)\s*\{([^}]*)\}", m.group(1)):
        props = {}
        for p, v in re.findall(r"([\w-]+)\s*:\s*([^;]+?)\s*(?:!important)?\s*;", cuerpo):
            props[p.strip()] = v.strip()
        reglas[sel.strip()] = props
    return reglas


def aplicar_props(style, props):
    for p, v in props.items():
        if p == "border-color" and f"{p}:" not in style and "border:" in style:
            # cambia el color dentro del shorthand border:1px solid X
            style = re.sub(r"(border\s*:\s*[\d.]+px\s+\w+\s+)[^;]+", r"\g<1>" + v, style)
        elif re.search(rf"{p}\s*:", style):
            style = re.sub(rf"{p}\s*:[^;]+", f"{p}:{v}", style)
        else:
            style = style.rstrip().rstrip(";") + f"; {p}:{v};"
    return style


def patch_clase(html, clase, props):
    patron = re.compile(
        rf'(<[a-z][a-z0-9]* [^>]*class="[^"]*\b{re.escape(clase)}\b[^"]*"[^>]*>)')

    def arreglar(m):
        tag = m.group(1)
        sm = re.search(r'style="([^"]*)"', tag)
        if sm:
            tag = tag.replace(sm.group(0), f'style="{aplicar_props(sm.group(1), props)}"')
        if "background" in props:
            tag = re.sub(r'bgcolor="[^"]*"', f'bgcolor="{props["background"]}"', tag)
        return tag

    return patron.sub(arreglar, html)


def patch_descendiente(html, clase, props):
    # aplica props al primer <a> dentro del elemento con la clase
    patron = re.compile(
        rf'(class="[^"]*\b{re.escape(clase)}\b[^"]*"[^>]*>\s*<a [^>]*style=")([^"]*)"')
    return patron.sub(lambda m: m.group(1) + aplicar_props(m.group(2), props) + '"', html)


def main():
    for f in sorted(DIST.glob("*.html")):
        html = f.read_text(encoding="utf-8")
        for sel, props in parsear_dark(html).items():
            if sel.lstrip(".") == "email-bg":
                # decision de la usuaria (24 jul 2026): SIN fondo exterior
                # (blanco #FFFFFF) y pie en gris oscuro; solo la tarjeta va oscura
                continue
            partes = sel.split()
            if len(partes) == 2 and partes[1] == "a":
                html = patch_descendiente(html, partes[0].lstrip("."), props)
            elif len(partes) == 1:
                html = patch_clase(html, partes[0].lstrip("."), props)
        html = re.sub(r"&#9202;(&#847;)?", RELOJ, html)
        f.write_text(html, encoding="utf-8")
        print("   oscuro por defecto:", f.name)
    print("OK")


if __name__ == "__main__":
    main()
