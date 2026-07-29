#!/usr/bin/env python3
"""Generador de landings de proyecto · Atlantis Global Realty.

Cada proyecto vive en proyectos-src/<slug>/ con:
  - proyecto.json  (datos del brochure del constructor; ver _ejemplo)
  - imagenes/      (hero + galeria, entregadas por la constructora)

Este script genera en web-atlantis/proyectos/:
  - <slug>/index.html   landing bilingue ES/EN con el sistema de marca
  - <slug>/img/...      imagenes optimizadas del proyecto
  - index.html          indice de proyectos (solo los que tienen publicar=true)

Correr desde la raiz del repo:

    python3 centro-de-mando/scripts/generar-landing-proyecto.py

Reglas duras (CLAUDE.md par.8): cero cifras inventadas (todo sale del JSON,
que se llena desde el brochure), los rendimientos proyectados son del
constructor, disclaimer educativo visible, sin escasez artificial.
El formulario crea el lead en el CRM con type=proyecto-<slug> (atribucion
por proyecto). Los CTA llevan a book-call / book-videocall.
"""
import json
import shutil
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
SRC = RAIZ / "proyectos-src"
OUT = RAIZ / "web-atlantis" / "proyectos"
WEBHOOK_LEAD = "https://hooks.atlantisglobalrealty.com/webhook/formulario-atlantis"

PAGINA = """<!DOCTYPE html>
<html lang="es" data-theme="dark">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{titulo}</title>
<link rel="icon" type="image/png" href="../../assets/favicon-atlantis.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="../../assets/base.css">
<style>
.hero-p{{display:grid;grid-template-columns:1.05fr .95fr;gap:56px;align-items:center;padding:26px 0 10px}}
.hero-p img{{width:100%;border-radius:6px;border:1px solid var(--line);box-shadow:0 40px 80px -30px rgba(0,0,0,.55)}}
.chips{{display:flex;flex-wrap:wrap;gap:10px;margin:22px 0 6px}}
.fact{{display:inline-flex;align-items:center;gap:8px;border:1px solid var(--line);border-radius:2px;
  padding:9px 14px;font:700 11px/1 'Figtree','Inter',sans-serif;letter-spacing:.08em;text-transform:uppercase;color:var(--gris)}}
.fact::before{{content:"";width:6px;height:6px;border-radius:50%;background:var(--accent)}}
.bloque{{padding:44px 0 8px}}
.bloque h2{{font-size:24px;font-weight:600;margin:0 0 18px}}
.dos-col{{display:grid;grid-template-columns:1fr 1fr;gap:32px}}
.lista-tipo li{{padding:13px 0;border-bottom:1px dashed rgba(201,168,126,.35);font-size:15.5px;color:var(--gris);list-style:none}}
.lista-tipo li b{{color:var(--ink)}}
.lista-tipo{{padding:0;margin:0}}
.galeria{{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;padding:8px 0}}
.galeria img{{width:100%;height:230px;object-fit:cover;border-radius:4px;border:1px solid var(--line)}}
.cta-fin{{display:flex;gap:14px;flex-wrap:wrap;align-items:center;padding:8px 0 30px}}
.nota-legal{{font-size:11.5px;color:var(--muted);line-height:1.7;max-width:70ch;padding-bottom:26px}}
@media(max-width:920px){{.hero-p,.dos-col{{grid-template-columns:1fr}}.galeria{{grid-template-columns:1fr 1fr}}}}
</style>
</head>
<body>
<div class="wrap">
  <header class="topbar">
    <a class="lockup" href="https://atlantisglobalrealty.com/"><img class="wm-img" src="../../assets/wordmark.png" alt="Atlantis Global Realty"></a>
    <div class="controls"><div class="lang-seg"><button data-lang="es">ES</button><button data-lang="en">EN</button></div></div>
  </header>

  <main>
    <section class="hero-p">
      <div>
        <p class="ml" data-i18n="eyebrow">{ciudad} · {pais}</p>
        <h1>{nombre_es}</h1>
        <p class="lead" data-i18n="eslogan">{eslogan_es}</p>
        <div class="chips">
          <span class="fact" data-i18n="chip1">Entrega {entrega}</span>
          <span class="fact" data-i18n="precio">{precio_desde}</span>
          <span class="fact">{constructora}</span>
        </div>
        <p style="color:var(--gris);font-size:15.5px;line-height:1.7;max-width:52ch" data-i18n="descripcion">{descripcion_es}</p>
        <div class="cta-fin">
          <a class="btn" href="../../book-videocall.html" data-i18n="cta1">Agenda tu diagnóstico →</a>
          <a class="btn btn-ghost" href="#dossier" data-i18n="cta2">Recibir el dossier</a>
        </div>
      </div>
      <img src="{hero_src}" alt="{nombre_es}">
    </section>

    <section class="bloque dos-col">
      <div>
        <h2 data-i18n="t_tipos">Tipologías</h2>
        <ul class="lista-tipo" data-i18n-html="tipos">{tipologias_html}</ul>
      </div>
      <div>
        <h2 data-i18n="t_amen">Amenidades</h2>
        <div class="chips" data-i18n-html="amen">{amenidades_html}</div>
        <h2 style="margin-top:26px" data-i18n="t_plan">Plan de pagos</h2>
        <p style="color:var(--gris);font-size:15px;line-height:1.7" data-i18n="plan">{plan_es}</p>
      </div>
    </section>

    <section class="bloque">
      <h2 data-i18n="t_gal">Galería</h2>
      <div class="galeria">{galeria_html}</div>
    </section>

    <section class="bloque" id="dossier">
      <div class="card" style="max-width:520px;padding:30px">
        <h2 data-i18n="t_dossier">Recibe el dossier completo</h2>
        <form id="p-form" novalidate>
          <div class="field"><label for="p-name" data-i18n="lname">Nombre</label><input type="text" id="p-name" name="name" autocomplete="name" data-i18n-ph="phname" placeholder="Tu nombre"><p class="err" data-i18n="ename">Escribe tu nombre.</p></div>
          <div class="field"><label for="p-email" data-i18n="lemail">Correo</label><input type="email" id="p-email" name="email" autocomplete="email" placeholder="tu@correo.com"><p class="err" data-i18n="eemail">Escribe un correo válido.</p></div>
          <input class="hp" type="text" name="website" tabindex="-1" autocomplete="off">
          <button class="btn" type="submit" style="width:100%" data-i18n="fcta">Quiero el dossier →</button>
          <p class="status" aria-live="polite" id="p-status"></p>
          <p class="fine" data-i18n="fine">Sin spam. Solo la información del proyecto, y puedes darte de baja cuando quieras.</p>
        </form>
      </div>
    </section>

    <p class="nota-legal" data-i18n="legal">Contenido educativo. No es asesoría financiera, legal ni tributaria. Los precios, fechas de entrega y rendimientos proyectados son del constructor y pueden cambiar sin previo aviso; verifícalos en el diagnóstico.</p>{credito_html}
  </main>
</div>
<footer class="footer"><div class="wrap">
  <span>© <span id="yy"></span> Atlantis Global Realty</span>
  <span><a href="../index.html" data-i18n="volver">Ver todos los proyectos</a></span>
  <span><a data-href-es="../../legales/privacidad.html" data-href-en="../../legales/privacy.html" href="../../legales/privacidad.html" data-i18n="priv">Privacidad</a> · <a href="https://atlantisglobalrealty.com">atlantisglobalrealty.com</a></span>
</div></footer>
<script>window.I18N={i18n};</script>
<script src="../../assets/app.js"></script>
<script>
var WEBHOOK="{webhook}";
document.getElementById('yy').textContent=new Date().getFullYear();
document.getElementById('p-form').addEventListener('submit',function(ev){{
  ev.preventDefault();
  var f=ev.target, st=document.getElementById('p-status');
  if(f.website.value)return;
  var nombre=f.name.value.trim(), correo=f.email.value.trim();
  var ok=true;
  f.name.parentElement.classList.toggle('bad',!nombre); if(!nombre)ok=false;
  var reg=/^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$/;
  f.email.parentElement.classList.toggle('bad',!reg.test(correo)); if(!reg.test(correo))ok=false;
  if(!ok)return;
  st.textContent=AGR.t('sending');
  fetch(WEBHOOK,{{method:'POST',headers:{{'Content-Type':'application/json'}},
    body:JSON.stringify({{email:correo,nombre:nombre,idioma:AGR.lang,type:'proyecto-{slug}',fuente:'web'}})}})
    .then(function(r){{if(!r.ok)throw 0;st.textContent=AGR.t('gracias');f.reset();}})
    .catch(function(){{st.textContent=AGR.t('fail');}});
}});
</script>
</body>
</html>
"""


def i18n_de(p):
    es, en = p["es"], p["en"]
    comun = {"lname": "Nombre", "phname": "Tu nombre", "ename": "Escribe tu nombre.",
             "lemail": "Correo", "eemail": "Escribe un correo válido."}
    tipos_es = "".join(f"<li>{t}</li>" for t in es["tipologias"])
    tipos_en = "".join(f"<li>{t}</li>" for t in en["tipologias"])
    amen_es = "".join(f'<span class="fact">{a}</span>' for a in es["amenidades"])
    amen_en = "".join(f'<span class="fact">{a}</span>' for a in en["amenidades"])
    return {
        "es": {**comun,
            "eyebrow": f'{p["ciudad"]} · {p["pais"]}', "eslogan": es["eslogan"],
            "descripcion": es["descripcion"], "chip1": f'Entrega {p["entrega"]}',
            "precio": p["precioDesde"], "tipos": tipos_es, "amen": amen_es,
            "t_tipos": "Tipologías", "t_amen": "Amenidades", "t_plan": "Plan de pagos",
            "plan": es["planPagos"], "t_gal": "Galería",
            "t_dossier": "Recibe el dossier completo", "fcta": "Quiero el dossier →",
            "cta1": "Agenda tu diagnóstico →", "cta2": "Recibir el dossier",
            "fine": "Sin spam. Solo la información del proyecto, y puedes darte de baja cuando quieras.",
            "legal": "Contenido educativo. No es asesoría financiera, legal ni tributaria. Los precios, fechas de entrega y rendimientos proyectados son del constructor y pueden cambiar sin previo aviso; verifícalos en el diagnóstico.",
            "volver": "Ver todos los proyectos", "priv": "Privacidad",
            "sending": "Enviando…", "gracias": "¡Listo! Te llega el dossier por correo.",
            "fail": "No pudimos enviar el formulario. Escríbenos a contact@atlantisglobalrealty.com"},
        "en": {"lname": "Name", "phname": "Your name", "ename": "Enter your name.",
            "lemail": "Email", "eemail": "Enter a valid email.",
            "eyebrow": f'{p["ciudad"]} · {p["pais"]}', "eslogan": en["eslogan"],
            "descripcion": en["descripcion"], "chip1": f'Delivery {p["entrega"]}',
            "precio": p.get("precioDesdeEn") or p["precioDesde"],
            "tipos": tipos_en, "amen": amen_en,
            "t_tipos": "Unit types", "t_amen": "Amenities", "t_plan": "Payment plan",
            "plan": en["planPagos"], "t_gal": "Gallery",
            "t_dossier": "Get the full dossier", "fcta": "Send me the dossier →",
            "cta1": "Book your diagnostic →", "cta2": "Get the dossier",
            "fine": "No spam. Just the project information, and you can unsubscribe anytime.",
            "legal": "Educational content. Not financial, legal or tax advice. Prices, delivery dates and projected returns belong to the developer and may change without notice; verify them in your diagnostic.",
            "volver": "See all projects", "priv": "Privacy",
            "sending": "Sending…", "gracias": "Done! The dossier is on its way to your inbox.",
            "fail": "We could not send the form. Email us at contact@atlantisglobalrealty.com"},
    }


def generar(p, carpeta):
    es = p["es"]
    imgs = p.get("imagenes") or []
    galeria = imgs[1:] or imgs
    # sin renders del constructor: foto referencial del banco curado del CRM
    if imgs:
        hero_src, credito_html = f"img/{imgs[0]}", ""
    else:
        hero_src = "../../assets/fotos/atlantis-02.jpg"
        credito_html = ('\n    <p class="nota-legal">Fotografía referencial: '
                        '鲨柿笔亚 · <a href="https://www.pexels.com" rel="noopener">Pexels</a>.</p>')
    html = PAGINA.format(
        titulo=f'{es["nombre"]} · {p["ciudad"]} — Atlantis Global Realty',
        ciudad=p["ciudad"], pais=p["pais"], nombre_es=es["nombre"],
        eslogan_es=es["eslogan"], descripcion_es=es["descripcion"],
        entrega=p["entrega"], precio_desde=p["precioDesde"],
        constructora=p["constructora"], hero_src=hero_src, credito_html=credito_html,
        tipologias_html="".join(f"<li>{t}</li>" for t in es["tipologias"]),
        amenidades_html="".join(f'<span class="fact">{a}</span>' for a in es["amenidades"]),
        plan_es=es["planPagos"],
        galeria_html="".join(f'<img src="img/{g}" alt="{es["nombre"]}">' for g in galeria),
        i18n=json.dumps(i18n_de(p), ensure_ascii=False),
        webhook=WEBHOOK_LEAD, slug=p["slug"],
    )
    destino = OUT / p["slug"]
    destino.mkdir(parents=True, exist_ok=True)
    (destino / "index.html").write_text(html, encoding="utf-8")
    img_out = destino / "img"
    img_out.mkdir(exist_ok=True)
    for i in imgs:
        origen = carpeta / "imagenes" / i
        if origen.exists():
            shutil.copy(origen, img_out / i)
        else:
            print(f"   AVISO {p['slug']}: falta la imagen {i}")


def indice(proyectos):
    tarjetas = ""
    con_referencial = False
    for p in proyectos:
        es = p["es"]
        hero = (p.get("imagenes") or [""])[0]
        if hero:
            src = f"{p['slug']}/img/{hero}"
        else:
            src, con_referencial = "../assets/fotos/atlantis-03.jpg", True
        tarjetas += f"""
    <a class="card proy" href="{p['slug']}/index.html">
      <img src="{src}" alt="{es['nombre']}">
      <div class="pad"><p class="ml">{p['ciudad']} · {p['pais']}</p>
      <h2>{es['nombre']}</h2>
      <p class="datos">{p['precioDesde']} · <span data-i18n="entrega-{p['slug']}">Entrega {p['entrega']}</span></p></div>
    </a>"""
    i18n = {"es": {"eyebrow": "Proyectos", "titulo": "Proyectos seleccionados",
                   "lead": "Cada proyecto pasa nuestro filtro: constructora verificable, estructura de pagos sana y zona con demanda real.",
                   "priv": "Privacidad", "disc": "Contenido educativo. No es asesoría financiera, legal ni tributaria."},
            "en": {"eyebrow": "Projects", "titulo": "Selected projects",
                   "lead": "Every project passes our filter: verifiable developer, sound payment structure and real-demand location.",
                   "priv": "Privacy", "disc": "Educational content. Not financial, legal or tax advice."}}
    for p in proyectos:
        i18n["es"][f"entrega-{p['slug']}"] = f"Entrega {p['entrega']}"
        i18n["en"][f"entrega-{p['slug']}"] = f"Delivery {p['entrega']}"
    credito = ""
    if con_referencial:
        credito = ('\n  <span>Fotografía referencial: Germán Latasa · '
                   '<a href="https://www.pexels.com" rel="noopener">Pexels</a></span>')
    return f"""<!DOCTYPE html>
<html lang="es" data-theme="dark">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Proyectos — Atlantis Global Realty</title>
<link rel="icon" type="image/png" href="../assets/favicon-atlantis.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="../assets/base.css">
<style>
.grid-p{{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:22px;padding:26px 0 40px}}
.proy{{display:block;text-decoration:none;overflow:hidden;padding:0}}
.proy img{{width:100%;height:200px;object-fit:cover;display:block}}
.proy .pad{{padding:20px 22px 24px}}
.proy h2{{font-size:21px;font-weight:600;margin:6px 0 8px;color:var(--ink)}}
.proy .datos{{font-size:13px;color:var(--gris)}}
.proy:hover{{border-color:rgba(201,168,126,.5)}}
</style>
</head>
<body>
<div class="wrap">
  <header class="topbar">
    <a class="lockup" href="https://atlantisglobalrealty.com/"><img class="wm-img" src="../assets/wordmark.png" alt="Atlantis Global Realty"></a>
    <div class="controls"><div class="lang-seg"><button data-lang="es">ES</button><button data-lang="en">EN</button></div></div>
  </header>
  <main>
    <p class="ml" style="margin-top:22px" data-i18n="eyebrow">Proyectos</p>
    <h1 data-i18n="titulo">Proyectos seleccionados</h1>
    <p class="lead" style="max-width:60ch" data-i18n="lead">Cada proyecto pasa nuestro filtro: constructora verificable, estructura de pagos sana y zona con demanda real.</p>
    <div class="grid-p">{tarjetas}
    </div>
  </main>
</div>
<footer class="footer"><div class="wrap">
  <span>© <span id="yy"></span> Atlantis Global Realty</span>
  <span data-i18n="disc">Contenido educativo. No es asesoría financiera, legal ni tributaria.</span>
  <span><a data-href-es="../legales/privacidad.html" data-href-en="../legales/privacy.html" href="../legales/privacidad.html" data-i18n="priv">Privacidad</a></span>{credito}
</div></footer>
<script>window.I18N={json.dumps(i18n, ensure_ascii=False)};</script>
<script src="../assets/app.js"></script>
<script>document.getElementById('yy').textContent=new Date().getFullYear();</script>
</body>
</html>
"""


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    publicables = []
    for carpeta in sorted(SRC.iterdir()):
        pj = carpeta / "proyecto.json"
        if not pj.exists():
            continue
        p = json.loads(pj.read_text(encoding="utf-8"))
        generar(p, carpeta)
        estado = "PUBLICABLE" if p.get("publicar") else "borrador (publicar=false)"
        print(f"   {p['slug']}: landing generada · {estado}")
        if p.get("publicar"):
            publicables.append(p)
    (OUT / "index.html").write_text(indice(publicables), encoding="utf-8")
    print(f"OK: indice con {len(publicables)} proyecto(s) publicable(s)")


if __name__ == "__main__":
    main()
