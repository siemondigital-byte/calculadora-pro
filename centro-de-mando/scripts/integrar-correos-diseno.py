#!/usr/bin/env python3
"""Integra las plantillas de diseño (emails/credenciales-app/dist-email) en los
flujos n8n del repo. Repetible: si el diseño cambia, se corre de nuevo y los
flujos quedan al día. Correr desde la raíz del repo:

    python3 centro-de-mando/scripts/integrar-correos-diseno.py

Toca:
  - acceso-app-alta.json            -> Mail Compra (ES/EN)
  - acceso-app-reset-solicitar.json -> Mail Cambio Contrasena (ES/EN)
  - compra-confirmada.json          -> Mail Compra (ES/EN, nodo Armar correo nuevo)
  - acceso-app-embajador.json       -> Mail Embajadores (ES/EN, flujo generado
                                       a partir de acceso-app-alta)

El asunto de cada correo sale del <title> de la plantilla (el diseño es la
fuente de verdad). Los {{ $json.* }} de las plantillas se interpolan en el nodo
Code con .split().join() — nunca llegan crudos al cliente de correo.
"""
import copy
import json
import re
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
DIST = RAIZ / "emails" / "credenciales-app" / "dist-email"
N8N = RAIZ / "centro-de-mando" / "n8n"

# URLs canónicas por idioma (mismas del ecosistema; CLAUDE.md §7)
URLS = {
    "es": {
        "membersUrl": "https://cicloderiqueza.atlantisglobalrealty.com/miembros",
        "downloadsUrl": "https://cicloderiqueza.atlantisglobalrealty.com/descargas",
        "appUrl": "https://wealthcycle-app.atlantisglobalrealty.com/",
    },
    "en": {
        "membersUrl": "https://wealthcycle.atlantisglobalrealty.com/members",
        "downloadsUrl": "https://wealthcycle.atlantisglobalrealty.com/downloads",
        "appUrl": "https://wealthcycle-app.atlantisglobalrealty.com/?lang=en",
    },
}
WEB_BASE = "https://atlantisglobalrealty.com/emails"
FROM = {
    "es": "Ciclo de Riqueza Inmobiliaria <cicloderiqueza@atlantisglobalrealty.com>",
    "en": "The Real Estate Wealth Cycle <wealthcycle@atlantisglobalrealty.com>",
}


def slug_web(nombre_es, lang):
    """'Mail Compra' -> mail-compra.html / mail-compra-en.html (convención
    /emails/nombre-sin-numero.html)."""
    s = nombre_es.lower().replace(" ", "-")
    return f"{s}-en.html" if lang == "en" else f"{s}.html"


def cargar(nombre):
    """Devuelve {es: {html, titulo}, en: {...}} para una plantilla."""
    out = {}
    for lang, archivo in (("es", f"{nombre}.html"), ("en", f"{nombre} EN.html")):
        html = (DIST / archivo).read_text(encoding="utf-8")
        m = re.search(r"<title>(.*?)</title>", html, re.S)
        if not m:
            raise SystemExit(f"{archivo}: sin <title> para el asunto")
        out[lang] = {"html": html, "titulo": m.group(1).strip()}
    return out


def js_armar(plantilla, nombre_es, fuente_datos, extra_js=""):
    """Genera el jsCode del nodo 'Armar correo' para una plantilla."""
    t_json = json.dumps({"es": plantilla["es"]["html"], "en": plantilla["en"]["html"]},
                        ensure_ascii=False)
    subj = json.dumps({"es": plantilla["es"]["titulo"], "en": plantilla["en"]["titulo"]},
                      ensure_ascii=False)
    urls = json.dumps(URLS, ensure_ascii=False)
    webs = json.dumps({l: f"{WEB_BASE}/{slug_web(nombre_es, l)}" for l in ("es", "en")},
                      ensure_ascii=False)
    froms = json.dumps(FROM, ensure_ascii=False)
    return f"""const T = {t_json};
const SUBJ = {subj};
const URLS = {urls};
const WEB = {webs};
const FROM = {froms};
const d = {fuente_datos};
{extra_js}const lang = (d.lang === 'en') ? 'en' : 'es';
const vars = {{
  nombre: d.nombre || (lang === 'en' ? 'investor' : 'inversionista'),
  email: d.email || '',
  password: d.password || '',
  resetUrl: d.reset_link || '',
  webUrl: WEB[lang],
  ...URLS[lang],
}};
let html = T[lang];
for (const k of Object.keys(vars)) {{
  html = html.split('{{{{ $json.' + k + ' }}}}').join(vars[k] ?? '');
}}
return [{{ json: {{ from: FROM[lang], to: d.email, subject: SUBJ[lang], html }} }}];
"""


def set_jscode(flujo, nodo, jscode):
    for n in flujo["nodes"]:
        if n["name"] == nodo:
            n["parameters"]["jsCode"] = jscode
            return
    raise SystemExit(f"nodo '{nodo}' no encontrado")


def main():
    compra = cargar("Mail Compra")
    reset = cargar("Mail Cambio Contrasena")
    embajador = cargar("Mail Embajadores")

    # 1. acceso-app-alta -> Mail Compra
    f = json.loads((N8N / "acceso-app-alta.json").read_text(encoding="utf-8"))
    set_jscode(f, "Armar correo",
               js_armar(compra, "Mail Compra", "$('Generar password').first().json"))
    (N8N / "acceso-app-alta.json").write_text(
        json.dumps(f, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    # 2. acceso-app-reset-solicitar -> Mail Cambio Contrasena
    f = json.loads((N8N / "acceso-app-reset-solicitar.json").read_text(encoding="utf-8"))
    extra = ("d.reset_link = 'https://wealthcycle-app.atlantisglobalrealty.com/"
             "reset.html?token=' + encodeURIComponent(d.token) + '&lang=' + d.lang;\n")
    set_jscode(f, "Armar correo",
               js_armar(reset, "Mail Cambio Contrasena",
                        "$('Crear token').first().json", extra))
    (N8N / "acceso-app-reset-solicitar.json").write_text(
        json.dumps(f, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    # 3. compra-confirmada: nodo Armar correo nuevo + emailSend con html
    f = json.loads((N8N / "compra-confirmada.json").read_text(encoding="utf-8"))
    fuente = ("{ ...$('Normalizar').first().json, "
              "password: $('Motor: registrar compra').first().json.password, "
              "lang: $('Normalizar').first().json.idioma }")
    nodo_armar = {
        "parameters": {"jsCode": js_armar(compra, "Mail Compra", fuente)},
        "id": "armar-correo-compra",
        "name": "Armar correo",
        "type": "n8n-nodes-base.code",
        "typeVersion": 2,
        "position": [780, 300],
    }
    if not any(n["name"] == "Armar correo" for n in f["nodes"]):
        f["nodes"].append(nodo_armar)
        f["connections"]["¿Credencial nueva?"]["main"][0] = [
            {"node": "Armar correo", "type": "main", "index": 0}]
        f["connections"]["Armar correo"] = {"main": [[
            {"node": "Correo de bienvenida", "type": "main", "index": 0}]]}
    else:
        set_jscode(f, "Armar correo", js_armar(compra, "Mail Compra", fuente))
    for n in f["nodes"]:
        if n["name"] == "Correo de bienvenida":
            n["parameters"] = {
                "fromEmail": "={{ $json.from }}",
                "toEmail": "={{ $json.to }}",
                "subject": "={{ $json.subject }}",
                "html": "={{ $json.html }}",
                "options": {"appendAttribution": False},
            }
    (N8N / "compra-confirmada.json").write_text(
        json.dumps(f, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    # 4. acceso-app-embajador: generado desde acceso-app-alta
    base = json.loads((N8N / "acceso-app-alta.json").read_text(encoding="utf-8"))
    f = copy.deepcopy(base)
    f["name"] = "Acceso app · alta embajador"
    for n in f["nodes"]:
        if n["name"] == "Webhook alta":
            n["parameters"]["path"] = "alta-embajador"
        if n["name"] == "¿Clave valida?":
            # el registro publico de embajadores valida el token de invitacion
            n["parameters"]["conditions"]["conditions"] = [{
                "leftValue": "={{ $json.body.token || '' }}",
                "rightValue": "={{ $env.EMBAJADOR_INVITE_TOKEN }}",
                "operator": {"type": "string", "operation": "equals"},
            }]
        if n["name"] == "Enviar credenciales":
            n["parameters"]["options"] = {"appendAttribution": False}
    set_jscode(f, "Armar correo",
               js_armar(embajador, "Mail Embajadores",
                        "$('Generar password').first().json"))
    if "webhookId" in json.dumps(f):  # ids propios para no chocar con el flujo base
        for n in f["nodes"]:
            n.pop("webhookId", None)
    (N8N / "acceso-app-embajador.json").write_text(
        json.dumps(f, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print("OK: 3 flujos actualizados + acceso-app-embajador.json generado")


if __name__ == "__main__":
    main()
