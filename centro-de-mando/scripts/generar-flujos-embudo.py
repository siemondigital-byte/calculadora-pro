#!/usr/bin/env python3
"""Genera los flujos n8n del embudo Atlantis desde las plantillas de diseño
(emails/embudo-atlantis/emails/dist-n8n). Repetible; correr desde la raíz:

    python3 centro-de-mando/scripts/generar-flujos-embudo.py

Produce en centro-de-mando/n8n/:
  - embudo-guia.json          webhook lead-magnet -> lead en CRM + correo 12
  - embudo-agendamiento.json  webhook cal-booking (Cal.com) -> 02/05/10 por
                              evento y tipo de cita, ES/EN por idioma
  - embudo-unsubscribe.json   webhook unsubscribe -> motor POST /nurturing/baja

El logo base64 de cada plantilla se reemplaza por la URL pública del wordmark
(Gmail bloquea data-URIs). El campo lang del payload decide ES o EN.
"""
import json
import re
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
DIST = RAIZ / "emails" / "embudo-atlantis" / "emails" / "dist-n8n"
N8N = RAIZ / "centro-de-mando" / "n8n"

WORDMARK = "https://atlantisglobalrealty.com/emails/assets/wordmark.png"
WEB_BASE = "https://atlantisglobalrealty.com/emails"
FROM = "Atlantis Global Realty <contact@atlantisglobalrealty.com>"

# archivo por plantilla e idioma (los EN tienen su propio nombre)
ARCHIVOS = {
    "02": {"es": "02-confirmacion-llamada", "en": "02-call-confirmed"},
    "05": {"es": "05-confirmacion-videollamada", "en": "05-video-call-confirmed"},
    "10": {"es": "10-cancelacion", "en": "10-cancellation"},
    "12": {"es": "12-descarga-guia", "en": "12-guide-download"},
}
ASUNTOS = {
    "02": {"es": "Tu llamada quedó confirmada", "en": "Your call is confirmed"},
    "05": {"es": "Tu videollamada quedó confirmada", "en": "Your video call is confirmed"},
    "10": {"es": "Tu cita quedó cancelada", "en": "Your appointment was cancelled"},
    "12": {"es": "Tu guía está lista", "en": "Your guide is ready"},
}
GUIA_PDF = {
    "es": "https://atlantisglobalrealty.com/download/guia-inversion.pdf",
    "en": "https://atlantisglobalrealty.com/download/investment-guide.pdf",
}


def plantilla(clave, lang):
    html = (DIST / lang / f"{ARCHIVOS[clave][lang]}.html").read_text(encoding="utf-8")
    html = re.sub(r'src="data:image/png;base64,[^"]+"', f'src="{WORDMARK}"', html)
    return html


def browser_url(clave, lang):
    return f"{WEB_BASE}/{ARCHIVOS[clave][lang].split('-', 1)[1]}.html"


def js_interpolar():
    """Bloque JS común: reemplaza los {{tags}} de la plantilla elegida."""
    return """let html = T[d.tipo + '-' + d.lang];
const tags = {
  nombre: d.nombre, name: d.nombre, fecha: d.fecha || '', hora: d.hora || '',
  zona_horaria: d.zona_horaria || '', telefono: d.telefono || '',
  meeting_url: d.meeting_url || '', calendar_url: d.calendar_url || '',
  reschedule_url: d.reschedule_url || '', book_url: d.reschedule_url || '',
  guide_url: d.guide_url || '', browser_url: WEB[d.tipo + '-' + d.lang] || '',
  privacy_url: 'https://atlantisglobalrealty.com/privacy',
  unsubscribe_url: 'https://atlantisglobalrealty.com/unsubscribe?email='
    + encodeURIComponent(d.email) + '&lang=' + d.lang,
};
for (const k of Object.keys(tags)) {
  html = html.split('{{' + k + '}}').join(tags[k] ?? '');
}
return [{ json: { from: FROM, to: d.email, subject: SUBJ[d.tipo + '-' + d.lang], html } }];
"""


def js_armar(claves):
    T = {f"{c}-{l}": plantilla(c, l) for c in claves for l in ("es", "en")}
    WEB = {f"{c}-{l}": browser_url(c, l) for c in claves for l in ("es", "en")}
    SUBJ = {f"{c}-{l}": ASUNTOS[c][l] for c in claves for l in ("es", "en")}
    return (
        f"const T = {json.dumps(T, ensure_ascii=False)};\n"
        f"const WEB = {json.dumps(WEB, ensure_ascii=False)};\n"
        f"const SUBJ = {json.dumps(SUBJ, ensure_ascii=False)};\n"
        f"const FROM = {json.dumps(FROM)};\n"
        "const d = $input.first().json;\n" + js_interpolar()
    )


def nodo_webhook(nombre, path, pos):
    return {"parameters": {"httpMethod": "POST", "path": path,
                           "responseMode": "onReceived", "options": {}},
            "name": nombre, "type": "n8n-nodes-base.webhook", "typeVersion": 1,
            "position": pos, "webhookId": path}


def nodo_code(nombre, js, pos, on_error=None):
    n = {"parameters": {"jsCode": js}, "name": nombre,
         "type": "n8n-nodes-base.code", "typeVersion": 2, "position": pos}
    if on_error:
        n["onError"] = on_error
    return n


def nodo_email(nombre, pos):
    return {"parameters": {"fromEmail": "={{ $json.from }}",
                           "toEmail": "={{ $json.to }}",
                           "subject": "={{ $json.subject }}",
                           "html": "={{ $json.html }}",
                           "options": {"appendAttribution": False,
                                       "replyTo": "contact@atlantisglobalrealty.com"}},
            "name": nombre, "type": "n8n-nodes-base.emailSend", "typeVersion": 2,
            "position": pos}


def cadena(*nombres):
    return {a: {"main": [[{"node": b, "type": "main", "index": 0}]]}
            for a, b in zip(nombres, nombres[1:])}


def flujo_guia():
    normalizar = """// Payload de la landing guia: {name,email,lang,source}
const b = $input.first().json.body || $input.first().json;
const email = (b.email || '').trim().toLowerCase();
if (!email || email.indexOf('@') < 1) return [];
const lang = (b.lang === 'en') ? 'en' : 'es';
const GUIDE = %s;
return [{ json: {
  tipo: '12', email, lang,
  nombre: b.name || b.nombre || (lang === 'en' ? 'investor' : 'inversionista'),
  guide_url: GUIDE[lang],
  workspace: 'atlantis', idioma: lang,
  type: b.source || 'guia', fuente: b.utm_source || 'web',
} }];""" % json.dumps(GUIA_PDF)
    nodos = [
        nodo_webhook("Webhook guia", "lead-magnet", [240, 300]),
        nodo_code("Normalizar", normalizar, [460, 300]),
        {"parameters": {"method": "POST",
                        "url": "https://motor.atlantisglobalrealty.com/crm/lead",
                        "sendBody": True, "specifyBody": "json",
                        "jsonBody": "={{ JSON.stringify({workspace: $json.workspace, email: $json.email, nombre: $json.nombre, idioma: $json.idioma, type: $json.type, fuente: $json.fuente}) }}",
                        "options": {}},
         "name": "Motor: crear lead", "type": "n8n-nodes-base.httpRequest",
         "typeVersion": 4, "position": [680, 300],
         "onError": "continueRegularOutput"},
        nodo_code("Armar correo", "const previo = $('Normalizar').first().json;\n"
                  + js_armar(["12"]).replace("const d = $input.first().json;",
                                             "const d = previo;"),
                  [900, 300]),
        nodo_email("Enviar guia", [1120, 300]),
    ]
    return {"name": "Embudo · guia (lead magnet)", "nodes": nodos,
            "connections": cadena("Webhook guia", "Normalizar",
                                  "Motor: crear lead", "Armar correo", "Enviar guia"),
            "settings": {"executionOrder": "v1"}}


def flujo_agendamiento():
    normalizar = """// Webhook de Cal.com (BOOKING_CREATED / BOOKING_RESCHEDULED / BOOKING_CANCELLED).
// AJUSTAR si cambian las paginas de agendamiento del sitio.
const RESCHEDULE = {
  llamada: 'https://atlantisglobalrealty.com/book-call.html',
  video: 'https://atlantisglobalrealty.com/book-videocall.html',
};
const e = $input.first().json.body || $input.first().json;
const ev = e.triggerEvent || e.event || '';
const p = e.payload || {};
const at = (p.attendees || [])[0] || {};
const email = (at.email || '').trim().toLowerCase();
if (!email) return [];
const lang = ((at.language && at.language.locale) || p.language || '').startsWith('en') ? 'en' : 'es';
// llamada de 15 min o videollamada de 30: por duracion o por titulo
const dur = p.length || p.duration || 0;
const titulo = (p.title || p.eventTitle || '').toLowerCase();
const medio = (dur && dur <= 20) || titulo.includes('llamada de 15') || titulo.includes('phone') ? 'llamada' : 'video';
let tipo = '';
if (ev === 'BOOKING_CREATED' || ev === 'BOOKING_RESCHEDULED') tipo = medio === 'llamada' ? '02' : '05';
if (ev === 'BOOKING_CANCELLED') tipo = '10';
if (!tipo) return []; // evento que no manejamos: no enviar nada
const tz = at.timeZone || 'America/Bogota';
const dt = p.startTime ? new Date(p.startTime) : null;
const loc = lang === 'en' ? 'en-US' : 'es-CO';
const fecha = dt ? new Intl.DateTimeFormat(loc, { dateStyle: 'full', timeZone: tz }).format(dt) : '';
const hora = dt ? new Intl.DateTimeFormat(loc, { hour: '2-digit', minute: '2-digit', timeZone: tz }).format(dt) : '';
const meet = (p.metadata && p.metadata.videoCallUrl) || p.videoCallUrl || '';
const resched = p.rescheduleUri || (p.uid ? 'https://cal.com/reschedule/' + p.uid : RESCHEDULE[medio]);
return [{ json: {
  tipo, email, lang,
  nombre: at.name || (lang === 'en' ? 'investor' : 'inversionista'),
  fecha, hora, zona_horaria: tz, telefono: at.phoneNumber || '',
  meeting_url: meet, calendar_url: resched, reschedule_url: resched,
} }];"""
    nodos = [
        nodo_webhook("Webhook Cal.com", "cal-booking", [240, 300]),
        nodo_code("Normalizar", normalizar, [460, 300]),
        nodo_code("Armar correo", js_armar(["02", "05", "10"]), [680, 300]),
        nodo_email("Enviar confirmacion", [900, 300]),
    ]
    return {"name": "Embudo · agendamiento (Cal.com)", "nodes": nodos,
            "connections": cadena("Webhook Cal.com", "Normalizar",
                                  "Armar correo", "Enviar confirmacion"),
            "settings": {"executionOrder": "v1"}}


def flujo_unsubscribe():
    normalizar = """// Payload de la pagina /unsubscribe: {email, token, action, lang}
const b = $input.first().json.body || $input.first().json;
const email = (b.email || '').trim().toLowerCase();
if (!email || email.indexOf('@') < 1) return [];
const action = b.action === 'resubscribe' ? 'resubscribe' : 'unsubscribe';
return [{ json: { email, action } }];"""
    nodos = [
        nodo_webhook("Webhook baja", "unsubscribe", [240, 300]),
        nodo_code("Normalizar", normalizar, [460, 300]),
        {"parameters": {"method": "POST",
                        "url": "https://motor.atlantisglobalrealty.com/nurturing/baja",
                        "sendHeaders": True,
                        "headerParameters": {"parameters": [
                            {"name": "Authorization",
                             "value": "Bearer REEMPLAZAR_CRON_KEY"}]},
                        "sendBody": True, "specifyBody": "json",
                        "jsonBody": "={{ JSON.stringify($json) }}",
                        "options": {}},
         "name": "Motor: baja", "type": "n8n-nodes-base.httpRequest",
         "typeVersion": 4, "position": [680, 300]},
    ]
    return {"name": "Embudo · baja de correos", "nodes": nodos,
            "connections": cadena("Webhook baja", "Normalizar", "Motor: baja"),
            "settings": {"executionOrder": "v1"}}


def main():
    for nombre, flujo in (("embudo-guia", flujo_guia()),
                          ("embudo-agendamiento", flujo_agendamiento()),
                          ("embudo-unsubscribe", flujo_unsubscribe())):
        (N8N / f"{nombre}.json").write_text(
            json.dumps(flujo, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print("OK", nombre + ".json")


if __name__ == "__main__":
    main()
