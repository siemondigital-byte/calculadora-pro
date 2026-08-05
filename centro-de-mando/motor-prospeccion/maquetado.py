"""Marcado de textos editables para el maquetador (fase de marcado, portada
del nucleo Siemon). Toma un HTML cualquiera y le inserta data-mq-id en los
elementos de texto para que el editor los reconozca.

Las tres reglas duras (aprendidas en Siemon):
1. MARCADO INCREMENTAL: si la pagina ya tiene elementos marcados, sus ids se
   RESPETAN y solo se numeran los nodos nuevos (renumerar rompe las ediciones
   guardadas contra ids viejos).
2. SEGUNDA PASADA PARA TITULARES: un h1-h6 con una palabra en cursiva o
   negrita (<i>/<em>/<b>/<strong>) no es "texto plano directo" y la primera
   pasada lo salta; la segunda pasada lo marca COMPLETO como unidad rica.
3. FILTRO DE PreformattedString: los comentarios del HTML (Comment, CData,
   Doctype... todos subclases de PreformattedString en bs4) NO son texto
   editable; si se marcan, el editor los imprime encima del diseno.
"""
import re

from bs4 import BeautifulSoup, NavigableString
from bs4.element import PreformattedString

# elementos cuyo texto directo se marca en la primera pasada
DE_TEXTO = ("p", "h1", "h2", "h3", "h4", "h5", "h6", "li", "a", "button",
            "figcaption", "blockquote", "span", "td", "th", "label", "summary")
TITULARES = ("h1", "h2", "h3", "h4", "h5", "h6")
INLINE_RICO = ("i", "em", "b", "strong", "u", "mark", "sup", "sub")
ATTR = "data-mq-id"


def _texto_directo(el):
    """Strings hijas DIRECTAS con contenido real, filtrando PreformattedString
    (comentarios y familia): esos nodos jamas se tratan como texto editable."""
    return [c for c in el.children
            if isinstance(c, NavigableString)
            and not isinstance(c, PreformattedString)
            and c.strip()]


def _solo_texto(el):
    """True si el elemento contiene UNICAMENTE texto directo (sin hijos tag)."""
    tiene_texto = bool(_texto_directo(el))
    tiene_tags = any(getattr(c, "name", None) for c in el.children)
    return tiene_texto and not tiene_tags


def _titular_rico(el):
    """Titular con solo texto + inline de formato (la palabra en cursiva):
    se marca completo como unidad rica en la segunda pasada."""
    if el.name not in TITULARES:
        return False
    tags = [c for c in el.children if getattr(c, "name", None)]
    if not tags or any(t.name not in INLINE_RICO for t in tags):
        return False
    return bool(el.get_text(strip=True))


def marcar(html):
    """Devuelve (html_marcado, resumen). Idempotente e incremental."""
    soup = BeautifulSoup(html or "", "html.parser")
    usados = set()
    for el in soup.find_all(attrs={ATTR: True}):
        usados.add(str(el.get(ATTR)))
    siguiente = 1
    existentes = [int(m.group(1)) for u in usados
                  for m in [re.match(r"^mq-(\d+)$", u)] if m]
    if existentes:
        siguiente = max(existentes) + 1
    nuevos = 0

    def asignar(el, kind):
        nonlocal siguiente, nuevos
        if el.get(ATTR):          # incremental: lo ya marcado no se toca
            return
        el[ATTR] = f"mq-{siguiente}"
        el["data-mq-kind"] = kind
        siguiente += 1
        nuevos += 1

    # pasada 1: elementos de texto plano directo
    for el in soup.find_all(DE_TEXTO):
        if el.find_parent(attrs={ATTR: True}):
            continue              # dentro de una unidad ya marcada
        if _solo_texto(el):
            asignar(el, "texto")
    # pasada 2: titulares con una palabra en cursiva/negrita (unidad rica)
    for el in soup.find_all(TITULARES):
        if el.get(ATTR) or el.find_parent(attrs={ATTR: True}):
            continue
        if _titular_rico(el):
            asignar(el, "rico")

    return str(soup), {"nuevos": nuevos, "existentes": len(usados),
                       "total": len(usados) + nuevos}
