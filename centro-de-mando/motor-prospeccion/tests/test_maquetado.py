"""Fase de marcado del maquetador (bloque 3 del porte Siemon). Correr:
python tests/test_maquetado.py
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import maquetado  # noqa: E402

fallos = []
def check(nombre, cond, detalle=""):
    print(("OK " if cond else "FALLO ") + nombre + (f" ({detalle})" if detalle and not cond else ""))
    if not cond:
        fallos.append(nombre)

PAGINA = """<html><body>
<!-- comentario de plantilla: NO debe salir impreso -->
<h1>Arquitectura de <i>libertad</i> financiera</h1>
<h2>Titular plano</h2>
<p>Un parrafo editable.</p>
<div><p data-mq-id="mq-7" data-mq-kind="texto">Ya marcado antes.</p></div>
<ul><li>Item uno</li><li>Item <a href="#">con enlace</a></li></ul>
<script>var x = 1; // no editable</script>
</body></html>"""

html, resumen = maquetado.marcar(PAGINA)

# 1. filtro PreformattedString: el comentario sigue siendo comentario
check("el comentario NO se marca ni se imprime",
      "<!-- comentario de plantilla: NO debe salir impreso -->" in html
      and "comentario de plantilla" not in html.replace(
          "<!-- comentario de plantilla: NO debe salir impreso -->", ""))

# 2. segunda pasada: titular con palabra en cursiva queda marcado COMPLETO
import re
m = re.search(r'<h1[^>]*>', html)
check("titular con cursiva marcado como unidad rica",
      m and "data-mq-id" in m.group(0) and 'data-mq-kind="rico"' in m.group(0),
      str(m.group(0) if m else None))
check("la cursiva sobrevive dentro del titular", "<i>libertad</i>" in html)

# 3. primera pasada: texto plano marcado
check("titular plano marcado", re.search(r'<h2[^>]+data-mq-id', html) is not None)
check("parrafo marcado", re.search(r'<p[^>]+data-mq-id[^>]*>Un parrafo', html) is not None)

# 4. incremental: el id existente se respeta y no se renumera
check("id existente respetado", 'data-mq-id="mq-7"' in html)
check("los nuevos numeran DespuEs del mayor existente",
      resumen["existentes"] == 1 and resumen["nuevos"] >= 4
      and 'data-mq-id="mq-8"' in html, str(resumen))

# 5. idempotencia: re-marcar no agrega nada
html2, resumen2 = maquetado.marcar(html)
check("re-marcar es incremental puro (0 nuevos)", resumen2["nuevos"] == 0, str(resumen2))
check("re-marcar no cambia el html", html2 == html)

# 6. li con enlace: el li NO es texto plano directo (no se marca entero),
#    pero el <a> interior si
check("el <a> dentro del li se marca", re.search(r'<a[^>]+data-mq-id', html) is not None)

# 7. script jamas se marca
check("script no marcado", re.search(r'<script[^>]+data-mq-id', html) is None)

print()
if fallos:
    print(f"FALLOS: {fallos}")
    sys.exit(1)
print("TODO OK: marcado incremental, titulares ricos y comentarios filtrados")
