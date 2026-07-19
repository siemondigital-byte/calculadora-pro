"""Auditoria SEO (skill auditoria-seo): checks REALES sobre el HTML de una URL.
8 categorias con pesos: meta 20, headings 15, imagenes 10, enlaces 10, og/social 10,
schema 10, tecnico 15, contenido 10. Solo reporta lo que encuentra: nada inventado."""
import re
import time
import json as _json
import requests

UA = {"User-Agent": "Mozilla/5.0 (compatible; AtlantisSEO/1.0)"}
MAX_BYTES = 1_500_000   # tope de descarga (anti-DoS)


def host_privado(url):
    """True si el host de la URL resuelve a IP interna/reservada (bloqueo SSRF)."""
    import socket
    import ipaddress
    import urllib.parse
    host = urllib.parse.urlparse(url).hostname or ""
    if not host:
        return True
    try:
        infos = socket.getaddrinfo(host, None)
    except Exception:
        return True
    for info in infos:
        try:
            ip = ipaddress.ip_address(info[4][0])
        except Exception:
            return True
        if (ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved
                or ip.is_multicast or ip.is_unspecified):
            return True
    return False


def _get(url, timeout=25):
    if host_privado(url):
        raise ValueError("destino no permitido (host interno)")
    t0 = time.time()
    r = requests.get(url, headers=UA, timeout=timeout, allow_redirects=True, stream=True)
    # lee con tope de bytes (una web hostil no puede inundar la memoria)
    chunks, total = [], 0
    for ch in r.iter_content(chunk_size=32768):
        total += len(ch)
        if total > MAX_BYTES:
            break
        chunks.append(ch)
    r._content = b"".join(chunks)
    # sin charset en los headers, requests asume ISO-8859-1 y rompe los acentos
    if not r.encoding or r.encoding.lower() == "iso-8859-1":
        r.encoding = "utf-8"
    return r, time.time() - t0


def _txt_visible(html):
    t = re.sub(r"<script[\s\S]*?</script>|<style[\s\S]*?</style>|<!--[\s\S]*?-->", " ", html, flags=re.I)
    t = re.sub(r"<[^>]+>", " ", t)
    return re.sub(r"\s+", " ", t).strip()


def auditar(url, keyword=""):
    """Devuelve {ok, global, categorias, top_fixes, url} con hallazgos reales."""
    kw = (keyword or "").lower().strip()
    try:
        r, t_resp = _get(url)
        html = r.text or ""
    except Exception as e:
        return {"ok": False, "error": f"No pude cargar la URL: {e}"}
    low = html.lower()
    cats = []

    def cat(nombre, peso, hallazgos):
        okes = [h for h in hallazgos if h[0] == "ok"]
        errs = [h for h in hallazgos if h[0] == "error"]
        warns = [h for h in hallazgos if h[0] == "warn"]
        total = len(hallazgos) or 1
        puntos = round(100 * (len(okes) + 0.5 * len(warns)) / total)
        cats.append({"nombre": nombre, "peso": peso, "puntos": puntos,
                     "hallazgos": [{"estado": h[0], "txt": h[1], "fix": h[2],
                                    **({"evidencia": h[3]} if len(h) > 3 and h[3] else {})}
                                   for h in hallazgos]})

    # 1. META (20)
    h = []
    m = re.search(r"<title[^>]*>(.*?)</title>", html, re.I | re.S)
    title = (m.group(1).strip() if m else "")
    if not title:
        h.append(("error", "No hay <title>", "Agrega un <title> de 50 a 60 caracteres con tu keyword principal."))
    else:
        h.append(("ok", f"Title presente ({len(title)} chars): \"{title[:70]}\"", ""))
        if not (35 <= len(title) <= 65):
            h.append(("warn", f"Title de {len(title)} chars (ideal 50 a 60)", "Ajusta la longitud del title.",
                      [f'Title actual: "{title[:160]}"']))
        if kw and kw not in title.lower():
            h.append(("warn", f"La keyword \"{kw}\" no esta en el title", "Incluye la keyword de forma natural."))
    m = re.search(r'<meta[^>]+name=["\']description["\'][^>]+content=["\']([^"\']*)', html, re.I) or \
        re.search(r'<meta[^>]+content=["\']([^"\']*)["\'][^>]+name=["\']description["\']', html, re.I)
    desc = (m.group(1).strip() if m else "")
    if not desc:
        h.append(("error", "No hay meta description", "Agrega una meta description de 150 a 160 chars persuasiva."))
    else:
        h.append(("ok", f"Meta description presente ({len(desc)} chars)", ""))
        if not (110 <= len(desc) <= 170):
            h.append(("warn", f"Description de {len(desc)} chars (ideal 150 a 160)", "Ajusta la longitud.",
                      [f'Description actual: "{desc[:260]}"']))
    h.append(("ok", "Viewport definido", "") if "viewport" in low else ("error", "Falta <meta viewport>", 'Agrega <meta name="viewport" content="width=device-width, initial-scale=1">.'))
    if re.search(r'<meta[^>]+robots[^>]+noindex', low):
        h.append(("error", "meta robots con NOINDEX: la pagina NO se indexa", "Quita noindex si quieres aparecer en Google."))
    else:
        h.append(("ok", "Sin bloqueo noindex", ""))
    h.append(("ok", "Canonical presente", "") if 'rel="canonical"' in low or "rel='canonical'" in low else ("warn", "Sin <link rel=canonical>", "Agrega el canonical a la URL principal."))
    h.append(("ok", "Idioma declarado en <html lang>", "") if re.search(r"<html[^>]+lang=", html, re.I) else ("warn", "Falta lang en <html>", 'Agrega <html lang="es">.'))
    cat("Meta tags", 20, h)

    # 2. HEADINGS (15)
    h = []
    h1s = re.findall(r"<h1[^>]*>([\s\S]*?)</h1>", html, re.I)
    if len(h1s) == 0:
        h.append(("error", "No hay <h1>", "Agrega UN h1 claro con tu propuesta de valor/keyword."))
    elif len(h1s) == 1:
        h1txt = re.sub(r"<[^>]+>", "", h1s[0]).strip()
        h.append(("ok", f"Un solo h1: \"{h1txt[:70]}\"", ""))
        if kw and kw not in h1txt.lower():
            h.append(("warn", f"La keyword \"{kw}\" no esta en el h1", "Incluyela si es natural."))
    else:
        h.append(("error", f"{len(h1s)} h1 en la pagina (debe haber 1)", "Deja un solo h1; convierte el resto en h2.",
                  ['h1: "' + re.sub(r"<[^>]+>", "", x).strip()[:90] + '"' for x in h1s[:5]]))
    heads = [(int(n), re.sub(r"<[^>]+>", "", x).strip()[:70]) for n, x in
             re.findall(r"<h([1-6])[^>]*>([\s\S]*?)</h\1>", html, re.I)]
    hs = [n for n, _ in heads]
    saltos_ev = []
    for i in range(len(heads) - 1):
        if heads[i + 1][0] - heads[i][0] > 1:
            saltos_ev.append(f'h{heads[i][0]} "{heads[i][1]}" salta a h{heads[i+1][0]} "{heads[i+1][1]}" (falta h{heads[i][0]+1})')
    h.append(("warn", f"{len(saltos_ev)} saltos de jerarquia (ej. h1 a h3)", "Manten el orden h1>h2>h3; cambia el nivel de los encabezados senalados.", saltos_ev[:6]) if saltos_ev else ("ok", "Jerarquia de headings correcta", ""))
    h2n = len(re.findall(r"<h2", html, re.I))
    h.append(("ok", f"{h2n} h2 estructuran el contenido", "") if h2n else ("warn", "No hay h2", "Estructura el contenido con h2 descriptivos."))
    cat("Headings", 15, h)

    # 3. IMAGENES (10)
    h = []
    srcs_sin_alt = []
    imgs = re.findall(r"<img[^>]*>", html, re.I)
    sin_alt = [i for i in imgs if not re.search(r'alt=["\'][^"\']+["\']', i, re.I)]
    if imgs:
        h.append(("ok", f"{len(imgs)} imagenes en la pagina", ""))
        for i in sin_alt[:8]:
            ms = re.search(r'src=["\']([^"\']+)', i, re.I)
            srcs_sin_alt.append((ms.group(1) if ms else i[:80]).split("?")[0][-90:])
        h.append(("error", f"{len(sin_alt)} imagenes SIN alt descriptivo", "Agrega alt que describa cada imagen (accesibilidad + SEO).", srcs_sin_alt) if sin_alt else ("ok", "Todas las imagenes tienen alt", ""))
        lazy = len([i for i in imgs if "lazy" in i.lower()])
        h.append(("ok", f"{lazy} con loading=lazy", "") if lazy else ("warn", "Ninguna imagen usa loading=lazy", "Agrega loading=\"lazy\" a las imagenes bajo el fold."))
        modernas = len([i for i in imgs if re.search(r"\.(webp|avif)", i, re.I)])
        h.append(("ok", f"{modernas} en formato moderno (webp/avif)", "") if modernas else ("warn", "Sin formatos modernos (WebP/AVIF)", "Convierte las imagenes pesadas a WebP."))
    else:
        h.append(("warn", "No se detectaron <img> (puede ser CSS/JS)", ""))
    cat("Imagenes", 10, h)

    # 4. ENLACES (10)
    h = []
    links = re.findall(r'<a[^>]+href=["\']([^"\'#]+)["\']', html, re.I)
    links = [l for l in links if not l.lower().startswith(("mailto:", "tel:", "javascript:", "whatsapp:", "sms:"))]
    internos = [l for l in links if l.startswith("/") or (url.split("/")[2] in l)]
    externos = [l for l in links if l.startswith("http") and url.split("/")[2] not in l]
    h.append(("ok", f"{len(internos)} enlaces internos · {len(externos)} externos", ""))
    genericos = len(re.findall(r"<a[^>]*>\s*(click aqui|ver mas|aqui|more|leer mas)\s*<", low))
    h.append(("warn", f"{genericos} anclas genericas (\"click aqui\"...)", "Usa textos ancla descriptivos.") if genericos else ("ok", "Textos ancla descriptivos", ""))
    rotos_ev = []
    for l in list(dict.fromkeys(internos))[:10]:
        full = l if l.startswith("http") else url.rstrip("/") + "/" + l.lstrip("/")
        try:
            rr = requests.head(full, headers=UA, timeout=10, allow_redirects=True)
            if rr.status_code >= 400:
                rotos_ev.append(f"{full} devuelve {rr.status_code}")
        except Exception as ex:
            rotos_ev.append(f"{full} no responde ({str(ex)[:40]})")
    h.append(("error", f"{len(rotos_ev)} enlaces internos rotos (de 10 probados)", "Corrige o elimina los enlaces 404.", rotos_ev) if rotos_ev else ("ok", "Sin enlaces rotos (muestra de 10)", ""))
    cat("Enlaces", 10, h)

    # 5. OPEN GRAPH / SOCIAL (10)
    h = []
    for tag in ("og:title", "og:description", "og:image", "og:url"):
        h.append(("ok", f"{tag} presente", "") if tag in low else ("warn", f"Falta {tag}", f"Agrega <meta property=\"{tag}\">."))
    h.append(("ok", "Twitter card presente", "") if "twitter:card" in low else ("warn", "Falta twitter:card", "Agrega las twitter cards."))
    # og:image alcanzable de verdad (una imagen rota arruina el compartido en WhatsApp/redes)
    mimg = re.search(r'property=["\']og:image["\'][^>]+content=["\']([^"\']+)', html, re.I) or \
           re.search(r'content=["\']([^"\']+)["\'][^>]+property=["\']og:image["\']', html, re.I)
    if mimg:
        try:
            ri = requests.head(mimg.group(1), headers=UA, timeout=10, allow_redirects=True)
            h.append(("ok", "og:image responde correctamente", "") if ri.ok else ("error", f"og:image devuelve {ri.status_code}", "Corrige la URL de la imagen para compartir."))
        except Exception:
            h.append(("warn", "No pude verificar la og:image", ""))
    # hreflang para sitios multiidioma
    if 'hreflang' in low:
        h.append(("ok", "hreflang declarado (multiidioma)", ""))
    elif re.search(r'data-lang|lang=.en', low):
        h.append(("warn", "Sitio bilingue SIN hreflang", 'Agrega <link rel="alternate" hreflang="es|en"> para que Google sirva el idioma correcto.'))
    cat("Open Graph y social", 10, h)

    # 6. SCHEMA (10)
    h = []
    lds = re.findall(r'<script[^>]+application/ld\+json[^>]*>([\s\S]*?)</script>', html, re.I)
    if not lds:
        h.append(("warn", "Sin datos estructurados (JSON-LD)", "Agrega schema Organization/LocalBusiness (y Article en el blog)."))
    else:
        tipos = []
        for ld in lds:
            try:
                d = _json.loads(ld.strip())
                tt = d.get("@type") if isinstance(d, dict) else None
                if tt:
                    tipos.append(str(tt))
            except Exception:
                h.append(("error", "Un bloque JSON-LD esta malformado", "Valida el JSON en validator.schema.org."))
        h.append(("ok", f"Schema presente: {', '.join(tipos) or 'tipos no legibles'}", ""))
    cat("Schema / datos estructurados", 10, h)

    # 7. TECNICO (15)
    h = []
    h.append(("ok", f"Respuesta en {t_resp:.2f}s", "") if t_resp < 1.5 else ("warn", f"Respuesta lenta: {t_resp:.2f}s", "Optimiza servidor/cache."))
    h.append(("ok", "HTTPS activo", "") if r.url.startswith("https") else ("error", "Sin HTTPS", "Activa SSL."))
    dominio = "/".join(url.split("/")[:3])
    try:
        rb = requests.get(dominio + "/robots.txt", headers=UA, timeout=10)
        h.append(("ok", "robots.txt presente", "") if rb.ok else ("warn", "Sin robots.txt", "Crea un robots.txt."))
    except Exception:
        h.append(("warn", "No pude verificar robots.txt", ""))
    try:
        sm = requests.get(dominio + "/sitemap.xml", headers=UA, timeout=10)
        h.append(("ok", "sitemap.xml presente", "") if sm.ok and "<" in sm.text[:200] else ("warn", "Sin sitemap.xml", "Genera un sitemap y decláralo en robots.txt."))
    except Exception:
        h.append(("warn", "No pude verificar sitemap.xml", ""))
    h.append(("ok", "Favicon declarado", "") if "favicon" in low or 'rel="icon"' in low else ("warn", "Sin favicon declarado", "Agrega el favicon."))
    kb = len(html) // 1024
    h.append(("ok", f"HTML de {kb} KB", "") if kb < 300 else ("warn", f"HTML pesado: {kb} KB", "Reduce el peso de la pagina."))
    cat("Tecnico", 15, h)

    # 8. CONTENIDO (10)
    h = []
    texto = _txt_visible(html)
    palabras = len(texto.split())
    h.append(("ok", f"{palabras} palabras visibles", "") if palabras >= 300 else ("warn", f"Solo {palabras} palabras visibles", "Suma contenido util (>300 palabras)."))
    ratio = round(100 * len(texto) / max(len(html), 1))
    h.append(("ok", f"Ratio texto/HTML {ratio}%", "") if ratio >= 15 else ("warn", f"Ratio texto/HTML bajo ({ratio}%)", "Mas contenido real vs codigo."))
    if kw:
        veces = texto.lower().count(kw)
        h.append(("ok", f"Keyword \"{kw}\" aparece {veces} veces en el contenido", "") if veces else ("warn", f"La keyword \"{kw}\" no aparece en el contenido", "Usala de forma natural en el texto."))
    cat("Contenido", 10, h)

    # global ponderado + top fixes
    total_peso = sum(c["peso"] for c in cats) or 1
    global_ = round(sum(c["puntos"] * c["peso"] for c in cats) / total_peso)
    fixes = []
    for c in cats:
        for hh in c["hallazgos"]:
            if hh["estado"] == "error" and hh["fix"]:
                fixes.append({"cat": c["nombre"], "txt": hh["txt"], "fix": hh["fix"], "nivel": "error", "evidencia": hh.get("evidencia") or []})
    for c in cats:
        for hh in c["hallazgos"]:
            if hh["estado"] == "warn" and hh["fix"] and len(fixes) < 8:
                fixes.append({"cat": c["nombre"], "txt": hh["txt"], "fix": hh["fix"], "nivel": "warn", "evidencia": hh.get("evidencia") or []})
    contexto = {
        "title": title, "description": desc,
        "headings": [f"h{n}: {tx}" for n, tx in heads[:25]],
        "imgs_sin_alt": srcs_sin_alt if imgs else [],
        "enlaces_rotos": rotos_ev,
        "extracto": texto[:1200],
    }
    return {"ok": True, "url": r.url, "global": global_, "categorias": cats, "top_fixes": fixes[:5], "contexto": contexto,
            "resumen": {"errores": sum(1 for c in cats for x in c["hallazgos"] if x["estado"] == "error"),
                        "advertencias": sum(1 for c in cats for x in c["hallazgos"] if x["estado"] == "warn"),
                        "aprobados": sum(1 for c in cats for x in c["hallazgos"] if x["estado"] == "ok")}}
