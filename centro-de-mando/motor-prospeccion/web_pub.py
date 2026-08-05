"""Publicador web del Centro de Mando (fase 1 del maquetador).
El motor guarda la copia canonica de la web en /data/webfiles y publica por FTP a Hostinger.
Principios de la skill maquetador-siemon:
- Guardado QUIRURGICO: solo empalmes puntuales validados por unicidad; si hay 0 o >1
  coincidencias NO se toca nada. Nunca se reescribe el documento completo.
- Antes de publicar un archivo se respalda la version que esta en el hosting
  (para poder restaurar con un clic)."""
import os
import io
import json
import datetime
from ftplib import FTP, error_perm

BASE = os.path.join(os.environ.get("DATA_DIR", "/data"), "webfiles")
VERS = os.path.join(BASE, "versiones")       # respaldo de lo que HABIA antes de cada publicacion (para restaurar)
PUB = os.path.join(BASE, "publicado")        # foto de lo que QUEDO publicado (referencia real de "sin publicar")
REG = os.path.join(BASE, "publicaciones.json")

# archivo local (en BASE) -> ruta remota en el hosting.
# PARAMETRIZABLE: si existe <BASE>/archivos.json, ese mapa REEMPLAZA los defaults
# (formato: {"ruta.html": {"remoto": "ruta.html", "nombre": "Nombre visible"}}).
_ARCHIVOS_DEFAULT = {
    "index.html": {"remoto": "index.html", "nombre": "Web corporativa Atlantis (home)"},
    "styles.css": {"remoto": "styles.css", "nombre": "Estilos de la home"},
    "404.html": {"remoto": "404.html", "nombre": "Página de error 404"},
    ".htaccess": {"remoto": ".htaccess", "nombre": "Configuración del hosting"},
}


def _cargar_archivos():
    p = os.path.join(BASE, "archivos.json")
    if os.path.exists(p):
        try:
            with open(p, encoding="utf-8") as fh:
                mapa = json.load(fh)
            if isinstance(mapa, dict) and mapa:
                return mapa
        except Exception:
            pass
    return dict(_ARCHIVOS_DEFAULT)


class _Archivos:
    """Vista siempre-fresca del mapa (permite editar archivos.json sin reiniciar)."""

    def get(self, k, d=None):
        return _cargar_archivos().get(k, d)

    def items(self):
        return _cargar_archivos().items()

    def __contains__(self, k):
        return k in _cargar_archivos()


ARCHIVOS = _Archivos()


def _ftp():
    host = os.environ.get("FTP_HOST", "")
    if not host:
        raise RuntimeError("FTP sin configurar")
    f = FTP()
    f.connect(host.replace("ftp://", ""), int(os.environ.get("FTP_PORT", "21")), timeout=25)
    f.login(os.environ.get("FTP_USER", ""), os.environ.get("FTP_PASS", ""))
    return f


def _leer_reg():
    try:
        with open(REG, encoding="utf-8") as fh:
            return json.load(fh)
    except Exception:
        return {}


def _guardar_reg(r):
    os.makedirs(BASE, exist_ok=True)
    with open(REG, "w", encoding="utf-8") as fh:
        json.dump(r, fh, ensure_ascii=False)


def _marcar_publicado(ruta):
    """Guarda una foto del canonico que se acaba de publicar (referencia de 'sin publicar')."""
    import shutil
    src = os.path.join(BASE, ruta)
    if not os.path.exists(src):
        return
    dst = os.path.join(PUB, ruta)
    os.makedirs(os.path.dirname(dst) or PUB, exist_ok=True)
    shutil.copyfile(src, dst)


def _ref_publicada(ruta):
    """Ruta a la foto de lo que esta publicado. Preferimos PUB (lo que subimos);
    si aun no existe, caemos al respaldo previo para no romper archivos ya publicados."""
    pub = os.path.join(PUB, ruta)
    if os.path.exists(pub):
        return pub
    ver = (_leer_reg().get(ruta) or {}).get("respaldo")
    if ver:
        vp = os.path.join(VERS, ver, ruta)
        if os.path.exists(vp):
            return vp
    return None


def sembrar_publicado():
    """Siembra PUB con lo que hay AHORA en el hosting (una sola vez, para archivos ya publicados).
    Asi el 'sin publicar' es exacto desde el primer momento, sin esperar a re-publicar."""
    reg = _leer_reg()
    hechos, faltan = [], []
    try:
        f = _ftp()
    except Exception as e:
        return {"ok": False, "error": str(e)[:120]}
    try:
        for ruta, meta in ARCHIVOS.items():
            if os.path.exists(os.path.join(PUB, ruta)):
                continue  # ya tiene foto
            try:
                buf = io.BytesIO()
                f.retrbinary("RETR " + meta["remoto"], buf.write)
                dst = os.path.join(PUB, ruta)
                os.makedirs(os.path.dirname(dst) or PUB, exist_ok=True)
                with open(dst, "wb") as fh:
                    fh.write(buf.getvalue())
                hechos.append(ruta)
            except Exception:
                faltan.append(ruta)  # no existe en el hosting todavia
    finally:
        try:
            f.quit()
        except Exception:
            pass
    return {"ok": True, "sembrados": hechos, "sin_publicar_aun": faltan}


def _texto_legible(html_o_js, ruta):
    """Extrae frases legibles: texto visible del HTML, o valores del diccionario i18n del JS."""
    import re
    if ruta.endswith(".js"):
        # valores de las claves del i18n: "clave": "texto"
        vals = re.findall(r'"[\w.]+"\s*:\s*"((?:[^"\\]|\\.){3,})"', html_o_js)
        vals += re.findall(r"\'[\w.]+\'\s*:\s*\'((?:[^\'\\]|\\.){3,})\'", html_o_js)
        return [re.sub(r"<[^>]+>", "", v).strip() for v in vals if v.strip()]
    if ruta.endswith(".css") or ruta.endswith(".htaccess"):
        return [l.strip() for l in html_o_js.splitlines() if l.strip()]
    s = re.sub(r"<script[\s\S]*?</script>|<style[\s\S]*?</style>|<!--[\s\S]*?-->", " ", html_o_js, flags=re.I)
    s = re.sub(r"<[^>]+>", "\n", s)
    frases = []
    for l in s.split("\n"):
        l = re.sub(r"\s+", " ", l).strip()
        if len(l) >= 4:
            frases.append(l)
    return frases


def diff_legible(ruta):
    """Lista los cambios entre la copia canonica y lo ultimo publicado, en lenguaje humano."""
    import os as _os
    import difflib
    p = _os.path.join(BASE, ruta)
    if not _os.path.exists(p):
        return {"ok": False, "error": "no existe"}
    actual = open(p, encoding="utf-8", errors="replace").read()
    prev_path = _ref_publicada(ruta)
    if not prev_path or not _os.path.exists(prev_path):
        return {"ok": True, "primera_vez": True, "agregados": [], "quitados": [], "cambiados": []}
    prev = open(prev_path, encoding="utf-8", errors="replace").read()
    a = _texto_legible(prev, ruta)
    b = _texto_legible(actual, ruta)
    sm = difflib.SequenceMatcher(None, a, b, autojunk=False)
    agregados, quitados = [], []
    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag in ("insert", "replace"):
            agregados += [x for x in b[j1:j2] if x]
        if tag in ("delete", "replace"):
            quitados += [x for x in a[i1:i2] if x]
    # emparejar cambios (quitado -> agregado) cuando se parecen
    cambiados = []
    ag2, qu2 = [], list(agregados)
    for q in quitados:
        match = difflib.get_close_matches(q, qu2, n=1, cutoff=0.55)
        if match:
            cambiados.append({"antes": q[:160], "ahora": match[0][:160]})
            qu2.remove(match[0])
        else:
            ag2.append(q)
    puros_ag = [x for x in agregados if x not in [c["ahora"] for c in cambiados]]
    return {"ok": True, "primera_vez": False,
            "cambiados": cambiados[:30],
            "agregados": [x[:160] for x in puros_ag][:30],
            "quitados": [x[:160] for x in ag2][:30]}


def _resumen_cambios(ruta):
    """Compara la copia canonica con la ultima version publicada y resume que cambio,
    en lenguaje humano (title, textos, imagenes, cantidad de lineas)."""
    import re
    p = os.path.join(BASE, ruta)
    if not os.path.exists(p):
        return ""
    actual = open(p, encoding="utf-8", errors="replace").read()
    prev_path = _ref_publicada(ruta)
    if not prev_path:
        if (_leer_reg().get(ruta) or {}).get("fecha"):
            return "sin cambios respecto a lo publicado"
        return "nunca publicado: saldra por primera vez"
    prev = open(prev_path, encoding="utf-8", errors="replace").read()
    if prev == actual:
        return "sin cambios respecto a lo publicado"
    partes = []
    def _title(s):
        m = re.search(r"<title[^>]*>(.*?)</title>", s, re.S)
        return (m.group(1).strip() if m else "")
    if _title(prev) != _title(actual):
        partes.append("cambio el titulo de la pagina")
    # numero de imagenes / videos
    for tag, nombre in (("<img", "imagenes"), ("<video", "videos")):
        if prev.count(tag) != actual.count(tag):
            d = actual.count(tag) - prev.count(tag)
            partes.append(f"{'+' if d>0 else ''}{d} {nombre}")
    # numero de lineas de texto cambiadas (aprox)
    pl, al = prev.splitlines(), actual.splitlines()
    dif = abs(len(al) - len(pl))
    cambiadas = sum(1 for a, b in zip(pl, al) if a != b)
    if cambiadas or dif:
        partes.append(f"~{cambiadas + dif} lineas de contenido")
    return " · ".join(partes) or "cambios menores"


def estado():
    """Inventario: archivos canonicos, ultima publicacion y si el FTP responde."""
    reg = _leer_reg()
    archivos = []
    for ruta, meta in ARCHIVOS.items():
        p = os.path.join(BASE, ruta)
        archivos.append({
            "ruta": ruta, "nombre": meta["nombre"], "remoto": meta["remoto"],
            "existe": os.path.exists(p),
            "modificado": datetime.datetime.fromtimestamp(os.path.getmtime(p)).isoformat()[:16] if os.path.exists(p) else None,
            "publicado": (reg.get(ruta) or {}).get("fecha"),
            "cambios": _resumen_cambios(ruta) if os.path.exists(p) else "",
        })
    ftp_ok, ftp_err = True, ""
    try:
        f = _ftp(); f.quit()
    except Exception as e:
        ftp_ok, ftp_err = False, str(e)[:80]
    return {"ok": True, "archivos": archivos, "ftp_ok": ftp_ok, "ftp_error": ftp_err}


def _mkdirs_remoto(f, ruta_remota):
    partes = ruta_remota.split("/")[:-1]
    acum = ""
    for p in partes:
        acum = (acum + "/" + p) if acum else p
        try:
            f.mkd(acum)
        except error_perm:
            pass  # ya existe


def publicar(rutas):
    """Publica archivos canonicos por FTP. Respalda ANTES la version del hosting."""
    ts = datetime.datetime.now().strftime("%Y-%m-%d_%H%M")
    reg = _leer_reg()
    resultado = []
    f = _ftp()
    try:
        for ruta in rutas:
            meta = ARCHIVOS.get(ruta)
            if not meta and ruta.startswith("assets/") and ".." not in ruta:
                meta = {"remoto": ruta, "nombre": ruta}   # imagenes subidas desde el maquetador
            local = os.path.join(BASE, ruta)
            if not meta or not os.path.exists(local):
                resultado.append({"ruta": ruta, "ok": False, "error": "archivo no disponible"})
                continue
            remoto = meta["remoto"]
            # 1) respaldo de lo que hay publicado (si existe)
            try:
                buf = io.BytesIO()
                f.retrbinary("RETR " + remoto, buf.write)
                bdir = os.path.join(VERS, ts)
                os.makedirs(os.path.join(bdir, os.path.dirname(ruta)) if "/" in ruta else bdir, exist_ok=True)
                with open(os.path.join(bdir, ruta), "wb") as fh:
                    fh.write(buf.getvalue())
                respaldo = ts
            except error_perm:
                respaldo = None   # no existia en el hosting (archivo nuevo)
            # 2) subir
            _mkdirs_remoto(f, remoto)
            with open(local, "rb") as fh:
                f.storbinary("STOR " + remoto, fh)
            # foto de lo que quedo publicado -> referencia exacta para "sin publicar"
            _marcar_publicado(ruta)
            reg[ruta] = {"fecha": datetime.datetime.now().isoformat()[:16], "respaldo": respaldo}
            resultado.append({"ruta": ruta, "ok": True, "respaldo": respaldo})
    finally:
        try:
            f.quit()
        except Exception:
            pass
    _guardar_reg(reg)
    return {"ok": all(x.get("ok") for x in resultado) if resultado else False, "resultado": resultado}


def versiones():
    """Respaldos disponibles (lo que estaba publicado antes de cada publicacion)."""
    out = []
    if os.path.isdir(VERS):
        for ts in sorted(os.listdir(VERS), reverse=True)[:20]:
            d = os.path.join(VERS, ts)
            rutas = []
            for raiz, _, fs in os.walk(d):
                for x in fs:
                    rutas.append(os.path.relpath(os.path.join(raiz, x), d))
            out.append({"version": ts, "rutas": sorted(rutas)})
    return {"ok": True, "versiones": out}


def restaurar(version, ruta):
    """Vuelve a publicar la version respaldada de un archivo."""
    p = os.path.join(VERS, version, ruta)
    meta = ARCHIVOS.get(ruta)
    if not meta or not os.path.exists(p):
        return {"ok": False, "error": "ese respaldo no existe"}
    f = _ftp()
    try:
        with open(p, "rb") as fh:
            f.storbinary("STOR " + meta["remoto"], fh)
    finally:
        try:
            f.quit()
        except Exception:
            pass
    # el canonico tambien vuelve a esa version (para que CRM y hosting queden iguales)
    with open(p, "rb") as fh:
        contenido = fh.read()
    with open(os.path.join(BASE, ruta), "wb") as fh:
        fh.write(contenido)
    # foto de lo que quedo publicado tras restaurar
    _marcar_publicado(ruta)
    return {"ok": True, "restaurado": ruta, "version": version}


def _empalme(texto, viejo, nuevo, etiqueta, aplicados, saltados):
    """Reemplazo quirurgico: exige EXACTAMENTE una coincidencia; si no, no toca nada."""
    n = texto.count(viejo)
    if n == 1:
        aplicados.append(etiqueta)
        return texto.replace(viejo, nuevo, 1)
    saltados.append(f"{etiqueta} ({'no encontrado' if n == 0 else f'{n} coincidencias, ambiguo'})")
    return texto


def aplicar_soluciones(soluciones, dry_run=False):
    """Aplica sobre la copia canonica de la home las soluciones SEO generadas:
    title, meta description, alts de imagenes y el arreglo del mailto. Solo empalmes
    quirurgicos validados; lo ambiguo se reporta en vez de arriesgarse.
    Con dry_run=True NO escribe: devuelve el preview (antes -> despues) para autorizar."""
    import re
    p = os.path.join(BASE, "index.html")
    if not os.path.exists(p):
        return {"ok": False, "error": "no tengo la copia canonica de index.html"}
    t = open(p, encoding="utf-8").read()
    original = t
    aplicados, saltados, detalle = [], [], []

    tit = (soluciones.get("title_propuesto") or "").strip()
    if tit:
        m = re.search(r"<title[^>]*>(.*?)</title>", t, re.S)
        if m:
            antes = (m.group(1) or "").strip()
            if antes != tit:
                detalle.append({"campo": "Título SEO", "antes": antes, "ahora": tit})
            t = _empalme(t, m.group(0), f"<title>{tit}</title>", "title", aplicados, saltados)
    desc = (soluciones.get("description_propuesta") or "").strip()
    if desc:
        m = re.search(r'(<meta name="description" content=")([^"]*)(")', t)
        if m:
            antes = (m.group(2) or "").strip()
            if antes != desc:
                detalle.append({"campo": "Meta description", "antes": antes, "ahora": desc})
            t = _empalme(t, m.group(0), m.group(1) + desc.replace('"', "'") + m.group(3), "meta description", aplicados, saltados)
    # alts: img con ese src y SIN alt -> insertar alt (una por una, en orden de aparicion)
    for a in (soluciones.get("alts") or []):
        src = (a.get("imagen") or "").strip()
        alt = (a.get("alt") or "").replace('"', "'").strip()
        if not src or not alt:
            continue
        hecho = False
        for m in re.finditer(r"<img\b[^>]*>", t):
            tag = m.group(0)
            if src in tag and not re.search(r'alt="[^"]+"', tag):
                nuevo_tag = tag[:-1].rstrip("/").rstrip() + f' alt="{alt}">'
                t = t[:m.start()] + nuevo_tag + t[m.end():]
                aplicados.append(f"alt {src.split('/')[-1]}")
                detalle.append({"campo": "Alt de imagen (" + src.split('/')[-1] + ")", "antes": "(sin texto alternativo)", "ahora": alt})
                hecho = True
                break
        if not hecho:
            saltados.append(f"alt {src.split('/')[-1]} (sin <img> pendiente para ese src)")
    # verificacion: scripts y styles intactos (principio de la skill)
    if t != original:
        for tag in ("<script", "<style"):
            if original.count(tag) != t.count(tag):
                return {"ok": False, "error": f"verificacion fallida: cambio el numero de {tag}; no guardo nada"}
    if dry_run:
        return {"ok": True, "preview": True, "detalle": detalle, "aplicados": aplicados, "saltados": saltados,
                "hay_cambios": bool(t != original),
                "nota": "Vista previa: nada se ha tocado todavía. Pulsa 'Aplicar' para escribir en la copia."}
    if t != original:
        with open(p, "w", encoding="utf-8") as fh:
            fh.write(t)
    return {"ok": True, "aplicados": aplicados, "saltados": saltados, "detalle": detalle,
            "nota": "cambios en la copia del motor; usa Publicar para subirlos al hosting"}

def _ruta_segura(ruta):
    """Permite solo archivos conocidos o assets, sin escapes de directorio."""
    if ".." in ruta or ruta.startswith("/"):
        return False
    return ruta in ARCHIVOS or ruta.startswith("assets/")


def leer(ruta):
    import hashlib
    if not _ruta_segura(ruta):
        return {"ok": False, "error": "ruta no permitida"}
    p = os.path.join(BASE, ruta)
    if not os.path.exists(p):
        return {"ok": False, "error": "no existe"}
    with open(p, encoding="utf-8") as fh:
        texto = fh.read()
    return {"ok": True, "texto": texto, "hash": hashlib.sha256(texto.encode()).hexdigest()[:16]}


def escribir(archivos, publicar_ftp=True):
    """Escribe archivos canonicos (texto o base64) con respaldo previo del canonico,
    y opcionalmente publica por FTP (que a su vez respalda lo del hosting)."""
    import base64
    import shutil
    ts = datetime.datetime.now().strftime("%Y-%m-%d_%H%M") + "-edit"
    rutas_ok = []
    for a in archivos:
        ruta = (a.get("ruta") or "").strip()
        if not _ruta_segura(ruta):
            return {"ok": False, "error": f"ruta no permitida: {ruta}"}
    for a in archivos:
        ruta = a["ruta"].strip()
        p = os.path.join(BASE, ruta)
        os.makedirs(os.path.dirname(p) or BASE, exist_ok=True)
        if os.path.exists(p):
            bdir = os.path.join(VERS, ts, os.path.dirname(ruta))
            os.makedirs(bdir if os.path.dirname(ruta) else os.path.join(VERS, ts), exist_ok=True)
            shutil.copyfile(p, os.path.join(VERS, ts, ruta))
        if a.get("base64") is not None:
            with open(p, "wb") as fh:
                fh.write(base64.b64decode(a["base64"]))
        else:
            with open(p, "w", encoding="utf-8") as fh:
                fh.write(a.get("contenido") or "")
        rutas_ok.append(ruta)
    if publicar_ftp and rutas_ok:
        res = publicar(rutas_ok)
        if not res.get("ok"):
            return {"ok": False, "error": "escrito en el motor pero fallo la publicacion FTP", "detalle": res, "version": ts}
    return {"ok": True, "version": ts, "rutas": rutas_ok}



def publicar_html(remoto, html):
    """Publica un HTML arbitrario (ej. loquepuedohacerporti/pepito.html) por FTP a Hostinger.
    Devuelve {ok, url}. Valida la ruta para evitar salir de la raíz web."""
    import io as _io
    remoto = (remoto or "").lstrip("/")
    if not remoto or ".." in remoto or not remoto.endswith(".html"):
        return {"ok": False, "error": "ruta invalida"}
    try:
        f = _ftp()
    except Exception as e:
        return {"ok": False, "error": "FTP sin configurar: " + str(e)[:120]}
    try:
        _mkdirs_remoto(f, remoto)
        f.storbinary("STOR " + remoto, _io.BytesIO(html.encode("utf-8")))
    except Exception as e:
        return {"ok": False, "error": str(e)[:150]}
    finally:
        try:
            f.quit()
        except Exception:
            pass
    return {"ok": True, "url": os.environ.get("WEB_URL", "https://atlantisglobalrealty.com").rstrip("/") + "/" + remoto}
