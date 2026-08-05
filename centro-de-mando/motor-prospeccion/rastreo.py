"""Rastreo de correos y enlaces: exclusiones para que las metricas midan
PERSONAS (portado del nucleo Siemon, donde un solo dia sin la capa de robots
costo 11 aperturas falsas y 4 avisos falsos).

Las CUATRO capas, EN ESTE ORDEN (la primera que aplica gana):
  1. robots     - user-agent de bots, escaneres de enlaces y previews
  2. ?yo=1      - marca explicita del dueno (ademas APRENDE su IP)
  3. referrer   - venir del CRM es visita propia (tambien aprende IP)
  4. ip         - IPs aprendidas del dueno en visitas anteriores

Regla de verificacion en dos direcciones: el robot NO debe contar y una
persona SI. Cualquier cambio aqui se prueba con ambos casos.
"""
import json
import os
import re
import secrets as stdlib_secrets
import threading

DATA_DIR = os.environ.get("DATA_DIR", "/data")
CRM_HOST = "crm.atlantisglobalrealty.com"
IPS_MAX = 100

# bots conocidos: crawlers, escaneres de seguridad de correo (Outlook
# SafeLinks, Proofpoint, Barracuda, Mimecast), previews de mensajeria y
# clientes headless/programaticos. OJO: GoogleImageProxy NO va aqui, es el
# proxy con el que Gmail carga los pixeles de aperturas REALES.
ROBOTS_RE = re.compile(
    r"bot\b|crawler|spider|preview|scan|monitor|validator|fetch\b|expander"
    r"|facebookexternalhit|slackbot|whatsapp|telegram|skypeuripreview|discord"
    r"|linkedinbot|twitterbot|embedly|quora|pinterest|vkshare|redditbot"
    r"|safelinks|proofpoint|barracuda|mimecast|forcepoint|symantec|trendmicro"
    r"|headless|phantomjs|python-requests|python-urllib|libwww|httpx\b|aiohttp"
    r"|curl/|wget/|go-http-client|okhttp|java/|apache-httpclient",
    re.IGNORECASE)

_lock = threading.Lock()


def _ruta_ips():
    return os.path.join(DATA_DIR, "ips_propias.json")


def _leer_ips():
    try:
        with open(_ruta_ips(), encoding="utf-8") as f:
            return list(json.load(f))
    except Exception:  # noqa: BLE001
        return []


def aprender_ip(ip):
    """Cuando una visita se identifica como propia (?yo=1 o referrer del CRM),
    su IP queda aprendida y las visitas futuras desde ella no cuentan."""
    ip = (ip or "").strip()
    if not ip:
        return
    with _lock:
        ips = _leer_ips()
        if ip in ips:
            return
        ips.append(ip)
        os.makedirs(DATA_DIR, exist_ok=True)
        tmp = _ruta_ips() + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(ips[-IPS_MAX:], f)
        os.replace(tmp, _ruta_ips())


def es_robot(user_agent):
    ua = (user_agent or "").strip()
    # sin user-agent no es un navegador real: tambien se excluye
    return (not ua) or bool(ROBOTS_RE.search(ua))


def ip_de(request):
    """IP real detras del proxy (Caddy pone X-Forwarded-For)."""
    try:
        xff = request.headers.get("x-forwarded-for") or ""
        if xff:
            return xff.split(",")[0].strip()
        return request.client.host if request.client else ""
    except Exception:  # noqa: BLE001
        return ""


def es_visita_propia(request, query_extra=""):
    """Aplica las cuatro capas EN ORDEN sobre una peticion entrante.
    Devuelve (excluir: bool, capa: str). query_extra permite pasar el valor
    de ?yo= cuando el framework ya lo parseo."""
    try:
        ua = request.headers.get("user-agent", "")
        if es_robot(ua):
            return True, "robots"
        yo = query_extra == "1" or request.query_params.get("yo") == "1"
        if yo:
            aprender_ip(ip_de(request))
            return True, "yo"
        ref = request.headers.get("referer", "") or ""
        if CRM_HOST in ref:
            aprender_ip(ip_de(request))
            return True, "referrer"
        if ip_de(request) in _leer_ips():
            return True, "ip"
        return False, ""
    except Exception:  # noqa: BLE001
        # ante la duda no se descarta la visita (mejor contar de mas una vez
        # que romper la redireccion de una persona)
        return False, ""


def token_envio():
    """Token unico POR ENVIO para el pixel de apertura: si el mismo paso se
    reenvia, cada envio tiene su token y su apertura propia."""
    return stdlib_secrets.token_hex(10)


PIXEL_RE = re.compile(r'<img[^>]+/nurturing/px/[^>]+>\s*', re.IGNORECASE)


def sin_pixel(html):
    """Copia para Enviados: el mismo correo SIN el pixel (abrir tu propia
    copia no debe contar como apertura)."""
    return PIXEL_RE.sub("", html or "")


def senal_js(objeto, tipo, motor_url):
    """Script para paginas publicadas: al salir, manda la senal con el TIEMPO
    DE LECTURA real. Si el navegador esta marcado como propio (misma marca del
    recortador), el beacon va con ?yo=1: ensena la IP y no cuenta."""
    return (
        "<script>(function(){var t0=Date.now();var fin=false;"
        "function s(){if(fin)return;fin=true;try{"
        "var yo='';try{if(localStorage.getItem('atlantis_yo')==='1'"
        "||/[?&]yo=1/.test(location.search))yo='?yo=1';}catch(e){}"
        "var seg=Math.round((Date.now()-t0)/1000);"
        f"navigator.sendBeacon('{motor_url}/senal/pagina'+yo,"
        "JSON.stringify({objeto:'" + str(objeto) + "',tipo:'" + str(tipo) + "',"
        "segundos:seg}));}catch(e){}}"
        "window.addEventListener('pagehide',s);"
        "document.addEventListener('visibilitychange',function(){"
        "if(document.visibilityState==='hidden')s();});})();</script>")


def es_rebote(de, asunto):
    """DSN clasico: remitente de demonio de correo o asunto de fallo."""
    de = (de or "").lower()
    asunto = (asunto or "").lower()
    return (de.startswith(("mailer-daemon", "postmaster"))
            or "delivery status notification" in asunto
            or "undeliver" in asunto or "returned mail" in asunto
            or "mail delivery failed" in asunto or "no se pudo entregar" in asunto)


EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}")


def destinatario_rebotado(texto, propios=()):
    """Extrae del cuerpo del DSN el correo que reboto (el primero que no sea
    un buzon propio ni el demonio)."""
    for m in EMAIL_RE.findall(texto or ""):
        bajo = m.lower()
        if bajo in propios or bajo.startswith(("mailer-daemon", "postmaster")):
            continue
        return bajo
    return ""
