"""Nurturing MULTI-CAMPANA del Centro de Mando.

Cada campana es independiente: su disparador (quien entra), su premisa (de que parte),
su secuencia de correos, su CADENCIA EN HORAS (editable por Andrea) y sus inscritos.

data.siemon.nurturing = {
  "campanas": [{
     id, nombre, activa, autoInscribir,
     disparador: {tipo, valor, desc}   -> quien entra a la campana
     premisa: "de que parte esta campana (contexto que la IA NUNCA debe contradecir)"
     config:  {persona, oferta, lead_magnet, pautas, remitente}
     pasos:   [{id, fase, nombre, objetivo}]      -> el guion canonico de la campana
     cadencia:{paso_id: HORAS desde que entra}    -> editable desde el CRM
     secuencia:[{id, fase, nombre, asunto, cuerpo}]  -> lo redactado
     inscritos:{email: {inicio(iso), paso, ultimoEnvio, estado, nombre}}
     metricas: {paso_id: {enviados, aperturas, clics}, "bajas": n}
  }]
}
"""
import os
import hmac
import hashlib
from datetime import datetime, timedelta, date

VOZ = ("Voz de Andrea Siemon (Siemon Digital): cercana, humana, calida y honesta, desde la oportunidad y el "
       "vaso medio lleno. Mistica y practica a la vez: cada idea expansiva anclada en algo concreto y util "
       "(nunca filosofia suelta ni de taller). Cree que cada persona es un universo en expansion con un camino "
       "unico, que los retos nos transforman en nuestra mejor version, y en la libertad con proposito: usar las "
       "herramientas como verdaderos potencializadores para desplegar el potencial y aportar valor real al "
       "mundo, para que la vida deje de ser una lucha constante. Lexico suyo: universo en expansion, camino "
       "unico, lo que no se ve a simple vista, libertad con proposito, amplificar el potencial, expresion desde "
       "el ser. Mensaje central: 'amplifica tu potencial'. Acompanar, no empujar: la persona avanza cuando esta "
       "lista.\n"
       "REGLA: SIEMPRE AFIRMATIVO, desde lo que Andrea es y ofrece; nunca comparaciones, nunca 'lo que no es' ni "
       "contraste con otros. CERO em dashes; rangos con 'a'. Sin urgencia agresiva ni promesas magicas.")

_PERSONA_AGENCIA = {
    "descripcion": "Personas o equipos que dirigen un negocio con algun cuello de botella que frena su "
                   "crecimiento (procesos manuales, informacion dispersa, tareas que no escalan). Van desde "
                   "emprendedores y creadores hasta pymes con equipo y empresas mas estructuradas. NO se "
                   "asume que sea 'una sola persona' ni un rubro fijo: se define por el problema, no por el "
                   "tamano. Valoran entender su proceso antes de comprar tecnologia, y buscan una solucion a "
                   "la medida, no una herramienta enlatada.",
    "dolores": ["hay un proceso que frena el crecimiento y consume tiempo del equipo",
                "la informacion vive dispersa y se pierde entre sistemas y personas",
                "se que la IA y la automatizacion podrian ayudar, pero no se por donde empezar ni que es real"],
    "objecion_principal": "creo que la IA es compleja, generica o cara para un caso como el mio",
    "falsa_solucion": "comprar herramientas sueltas o un chatbot enlatado sin entender antes el proceso ni el cuello de botella real",
}
_OFERTA_DIAG = {"nombre": "Llamada de diagnostico gratuita",
                "promesa": "Una llamada corta y sin costo para entender tu operacion y ver como Siemon puede ayudarte. Sin compromiso.",
                "precio": 0, "gratis": True,
                "que_pasa_despues": "En la llamada Andrea hace preguntas sobre el negocio y sus procesos. Despues de esa "
                                    "llamada, si hay encaje, se agenda una videollamada con una presentacion personalizada, y "
                                    "ES AHI donde se presenta la propuesta del diagnostico profundo (su precio depende del "
                                    "modelo de negocio y de que tan complejo sea, por eso NUNCA se dice por correo).",
                "url_compra": "https://siemondigital.com/book-call/"}

# ---------------------------------------------------------------- campana 1: GUIA
# OJO: los ids se mantienen (bienvenida_1...ventas_3) para NO perder lo ya redactado.
_PASOS_GUIA = [
    {"id": "bienvenida_1", "fase": "Bienvenida", "nombre": "Sacarle jugo a la guia",
     "objetivo": "YA TIENE LA GUIA (se la entrego otra automatizacion al solicitarla). PROHIBIDO reenviarla, "
                 "adjuntarla o decir 'aqui esta tu guia'. Este correo NO entrega nada: da UNA sola accion "
                 "concreta y pequena para aplicar HOY lo que ya leyo (o para abrirla si no lo ha hecho), y "
                 "anticipa en una linea que vendra una serie corta con mas valor. Sin vender."},
    {"id": "bienvenida_2", "fase": "Bienvenida", "nombre": "Quien esta detras",
     "objetivo": "Presentar a Andrea y a Siemon con storytelling real (por que existe Siemon, que vio, que "
                 "valores). NO repitas el tema de la guia ni el dolor operativo: aqui el foco es la PERSONA "
                 "detras de la marca. Cierra invitando a seguirla en LinkedIn (usa el enlace de config si existe; "
                 "si no hay enlace, NO menciones LinkedIn). Sin vender."},
    {"id": "convencer_1", "fase": "Convencer", "nombre": "Activar el dolor",
     "objetivo": "Contenido util que NOMBRE el dolor del persona y lo agite con respeto. Este es el PRIMER correo "
                 "que toca el dolor a fondo (los dos anteriores NO lo hicieron): no digas 'como te conte'. "
                 "Aporta una idea nueva, no repitas la guia. SIN vender y SIN enlace a la guia."},
    {"id": "convencer_2", "fase": "Convencer", "nombre": "Liberar la objecion",
     "objetivo": "Desmontar la objecion principal del persona con un beneficio practico que pueda aplicar hoy "
                 "(un ejercicio concreto). SIN vender."},
    {"id": "convencer_3", "fase": "Convencer", "nombre": "Desmontar la falsa solucion",
     "objetivo": "Mostrar por que lo que ya probo (la falsa solucion) no resuelve la raiz, y posicionar el metodo "
                 "correcto. Prepara la venta SIN venderla y SIN poner el enlace de agendar (eso es del correo siguiente)."},
    {"id": "ventas_1", "fase": "Invitacion", "nombre": "Invitar al diagnostico (llamada)",
     "objetivo": "El correo ANTERIOR ya invito a ver la presentacion de quienes somos y como trabajamos. AQUI invitas a "
                 "agendar la LLAMADA DE DIAGNOSTICO.\n"
                 "LO MAS IMPORTANTE: esta llamada ES UN DIAGNOSTICO de verdad, no una charla. Presentala con TODO su peso "
                 "y su valor: es donde se mira la operacion real y sale claridad. PROHIBIDO empequenecerla con palabras "
                 "como 'solo una llamada', 'una charla corta', 'una conversacion rapida' o 'sin rollos'. Es el punto de "
                 "partida serio del trabajo con Siemon.\n"
                 "EXPLICA CON SUSTANCIA que pasa dentro (como se explicaria un diagnostico bueno): que se revisa de su "
                 "operacion y que se lleva al salir. Usa 1 ejemplo concreto PERO ELIGELO tu segun el tipo de negocio, "
                 "y VARIALO: NO uses siempre el chatbot de WhatsApp ni el reporte de copiar y pegar (ya salieron mil "
                 "veces y suenan a plantilla). PROHIBIDO listar 'te pido tres cosas' o cualquier checklist de "
                 "preguntas: suena basico. El diagnostico ve el cuello de botella como oportunidad para una solucion "
                 "a la medida (automatizacion, IA aplicada, software propio, datos), no para vender un chatbot.\n"
                 "El precio: NO se dice NUNCA. Que es sin costo se menciona UNA sola vez, de pasada y sin celebrarlo: el "
                 "gancho es el VALOR de lo que sale de ahi, no que sea gratis. PROHIBIDO: USD, precio, costo del "
                 "diagnostico profundo, plazos, plazas, cupos. CTA unico: agendar."},
    {"id": "ventas_2", "fase": "Invitacion", "nombre": "Por que vale la pena esa llamada",
     "objetivo": "Dar autoridad y confianza para que tome el diagnostico (la llamada): por que el metodo funciona (probado en el "
                 "propio negocio de Andrea), que se lleva incluso si no trabajan juntos. Si no hay testimonios reales, usa "
                 "autoridad propia; NUNCA inventes testimonios. PROHIBIDO: precio, costo, plazos, plazas. CTA: agendar la llamada."},
    {"id": "ventas_3", "fase": "Invitacion", "nombre": "Cierre de la serie",
     "objetivo": "Ultimo correo: cerrar la serie con elegancia y dejar la puerta abierta a la llamada GRATUITA. Sin drama, "
                 "sin falsa urgencia, sin escasez inventada. PROHIBIDO: precio, costo, plazos, plazas, 'ultimo dia'. "
                 "Si no es su momento, esta bien y se dice. CTA suave: agendar la llamada cuando quiera."},
]
# un correo cada 48 h (2 dias) desde que entra
_CAD_GUIA = {"bienvenida_1": 0, "bienvenida_2": 48, "convencer_1": 96, "convencer_2": 144,
             "convencer_3": 192, "ventas_1": 240, "ventas_2": 288, "ventas_3": 336}

# ---------------------------------------------------------- campana 2: INFOPRODUCTO
_PASOS_INFO = [
    {"id": "i_1", "fase": "Bienvenida", "nombre": "Bienvenida + que hay dentro",
     "objetivo": "Dar la bienvenida a quien se intereso en el infoproducto de finanzas personales y libertad "
                 "financiera. Contar en 3 lineas que hay dentro y para quien es. Sin vender todavia."},
    {"id": "i_2", "fase": "Convencer", "nombre": "El problema real con el dinero",
     "objetivo": "Nombrar el problema real: no es cuanto ganas, es que no hay sistema. Contenido util, sin vender."},
    {"id": "i_3", "fase": "Convencer", "nombre": "Liberar la objecion",
     "objetivo": "Desmontar 'no soy de numeros' o 'no tengo tiempo' con un primer paso minimo y aplicable hoy. Sin vender."},
    {"id": "i_4", "fase": "Ventas", "nombre": "Presentar el infoproducto",
     "objetivo": "Presentar el infoproducto: que incluye, la transformacion, el acceso. CTA claro. Sin promesas de ingresos."},
    {"id": "i_5", "fase": "Ventas", "nombre": "Autoridad / prueba",
     "objetivo": "Por que este material y no otro: metodo, experiencia real. NUNCA inventar testimonios. CTA."},
    {"id": "i_6", "fase": "Ventas", "nombre": "Cierre",
     "objetivo": "Cierre honesto: recordar el acceso y para quien es. Sin urgencia agresiva."},
]
_CAD_INFO = {"i_1": 0, "i_2": 48, "i_3": 96, "i_4": 144, "i_5": 192, "i_6": 240}

# ------------------------------------------ campana 3: PROSPECTO EN FRIO SIN RESPUESTA
_PASOS_FRIO = [
    {"id": "f_1", "fase": "Valor", "nombre": "Valor sin pedir nada",
     "objetivo": "Le escribiste en frio y NO respondio. PROHIBIDO reprochar, insistir o decir 'te escribi y no "
                 "respondiste' / 'hago seguimiento'. Aporta UNA idea util para su negocio, sin pedir nada a cambio."},
    {"id": "f_2", "fase": "Valor", "nombre": "Insight de su nicho",
     "objetivo": "Un dato o patron real de su sector que le sirva. Sigue sin pedir nada. Angulo NUEVO."},
    {"id": "f_3", "fase": "Reabrir", "nombre": "Pregunta simple",
     "objetivo": "Una sola pregunta corta y facil de responder sobre su situacion. Nada de pitch."},
    {"id": "f_4", "fase": "Cierre", "nombre": "Cierre educado",
     "objetivo": "Ultimo correo: cerrar el hilo con elegancia, dejar la puerta abierta y no volver a escribir. "
                 "Sin culpa ni drama."},
]
_CAD_FRIO = {"f_1": 0, "f_2": 48, "f_3": 96, "f_4": 144}

# ------------------------------------------------ campana 4: AGENDO Y NO ASISTIO
_PASOS_NOSHOW = [
    {"id": "n_1", "fase": "Reagendar", "nombre": "Sin drama, reagenda",
     "objetivo": "Reservo el diagnostico y no llego. SIN reproche, sin culpa, sin 'te esperamos y no viniste'. "
                 "Asumir que se le cruzo algo (pasa) y facilitar reagendar en un clic. Calido y breve."},
    {"id": "n_2", "fase": "Reagendar", "nombre": "Valor + reagendar",
     "objetivo": "Recordar en 2 lineas que se lleva del diagnostico (el valor concreto) y volver a ofrecer agendar. Sin presion."},
    {"id": "n_3", "fase": "Cierre", "nombre": "Ultima puerta abierta",
     "objetivo": "Cerrar con elegancia: si no es su momento, esta bien; la puerta queda abierta. Un solo CTA suave."},
]
_CAD_NOSHOW = {"n_1": 0, "n_2": 48, "n_3": 96}


def _plantillas():
    """Las 4 campanas de fabrica (copias nuevas cada vez)."""
    import copy
    return copy.deepcopy([
        {"id": "guia", "nombre": "Descargo la guia", "activa": False, "autoInscribir": True,
         "disparador": {"tipo": "fuente_contiene", "valor": "guia",
                        "desc": "Leads cuyo origen/fuente contiene 'guia' (pidieron la guia)"},
         "premisa": "Ya solicito la guia y YA LA RECIBIO por otra automatizacion: NUNCA se la reenvies ni digas "
                    "'aqui esta tu guia'. MODELO DE VENTA (respetalo siempre): esta serie NO vende el diagnostico ni "
                    "dice precios. Lo unico que se ofrece es una LLAMADA GRATUITA de diagnostico, sin costo ni "
                    "compromiso, donde Andrea hace preguntas para entender el negocio. Solo DESPUES de esa llamada se "
                    "agenda una videollamada con presentacion personalizada, y ahi se propone el diagnostico profundo, "
                    "cuyo precio depende del modelo de negocio y su complejidad. Por eso PROHIBIDO mencionar precio, "
                    "USD, plazos o plazas en cualquier correo de esta serie.",
         "config": {"persona": _PERSONA_AGENCIA, "oferta": _OFERTA_DIAG,
                    "lead_magnet": {"nombre": "Guia para implementar IA en tu negocio",
                                    "url": "https://siemondigital.com/download-guide/"},
                    "linkedin": "", "pautas": "", "remitente": "hello@siemondigital.com"},
         "pasos": _PASOS_GUIA, "cadencia": _CAD_GUIA, "secuencia": [], "inscritos": {}, "metricas": {}},

        {"id": "infoproducto", "nombre": "Infoproducto de finanzas", "activa": False, "autoInscribir": False,
         "disparador": {"tipo": "fuente_contiene", "valor": "infoproducto",
                        "desc": "Leads interesados en el infoproducto de finanzas (origen contiene 'infoproducto')"},
         "premisa": "Se intereso en el INFOPRODUCTO de finanzas personales y libertad financiera. NO es cliente de "
                    "agencia: no le ofrezcas servicios de automatizacion ni el Diagnostico.",
         "config": {"persona": {"descripcion": "Persona que quiere ordenar sus finanzas personales y construir libertad financiera. No es experta en numeros y le abruma empezar.",
                                "dolores": ["gano pero no se en que se me va", "no tengo un sistema, solo intentos sueltos",
                                            "siento que empezar a invertir es para otros"],
                                "objecion_principal": "no soy de numeros y no tengo tiempo",
                                "falsa_solucion": "apps sueltas y consejos de redes sin un sistema detras"},
                    "oferta": {"nombre": "Infoproducto de finanzas personales", "promesa": "Un sistema simple para ordenar tu dinero y avanzar hacia tu libertad financiera.",
                               "precio": 0, "plazo_dias": 0, "max_plazas": 0, "url_compra": ""},
                    "lead_magnet": {"nombre": "", "url": ""}, "linkedin": "", "pautas": "",
                    "remitente": "hello@siemondigital.com"},
         "pasos": _PASOS_INFO, "cadencia": _CAD_INFO, "secuencia": [], "inscritos": {}, "metricas": {}},

        {"id": "frio_sin_respuesta", "nombre": "Prospecto en frio sin respuesta", "activa": False, "autoInscribir": False,
         "disparador": {"tipo": "manual", "valor": "",
                        "desc": "Los inscribes tu desde Prospeccion (los que contactaste y no respondieron)"},
         "premisa": "Le escribiste un correo en frio y NO respondio. Nutrir con valor, NUNCA insistir ni reprochar.",
         "config": {"persona": _PERSONA_AGENCIA, "oferta": _OFERTA_DIAG,
                    "lead_magnet": {"nombre": "", "url": ""}, "linkedin": "", "pautas": "",
                    "remitente": "hello@siemondigital.com"},
         "pasos": _PASOS_FRIO, "cadencia": _CAD_FRIO, "secuencia": [], "inscritos": {}, "metricas": {}},

        {"id": "no_asistio", "nombre": "Agendo y no asistio", "activa": False, "autoInscribir": False,
         "disparador": {"tipo": "manual", "valor": "",
                        "desc": "Los inscribes tu desde Leads (los que reservaron y no llegaron)"},
         "premisa": "Reservo el diagnostico y no asistio. Sin reproche: facilitar reagendar.",
         "config": {"persona": _PERSONA_AGENCIA, "oferta": _OFERTA_DIAG,
                    "lead_magnet": {"nombre": "", "url": ""}, "linkedin": "", "pautas": "",
                    "remitente": "hello@siemondigital.com"},
         "pasos": _PASOS_NOSHOW, "cadencia": _CAD_NOSHOW, "secuencia": [], "inscritos": {}, "metricas": {}},
    ])


def token_baja(email, secret):
    return hmac.new((secret or "x").encode(), (email or "").lower().encode(), hashlib.sha256).hexdigest()[:16]


def con_utm(url, campana_id, paso_id):
    """Agrega UTMs al enlace del boton (convencion de Siemon: utm_source=email).
    Respeta los UTMs que Andrea ya haya puesto a mano."""
    import urllib.parse as _up
    u = (url or "").strip()
    if not u.startswith(("http://", "https://")):
        return u
    try:
        pr = _up.urlparse(u)
        q = dict(_up.parse_qsl(pr.query, keep_blank_values=True))
        q.setdefault("utm_source", "email")
        q.setdefault("utm_medium", "nurturing")
        q.setdefault("utm_campaign", campana_id or "nurturing")
        q.setdefault("utm_content", paso_id or "")
        return _up.urlunparse(pr._replace(query=_up.urlencode(q)))
    except Exception:
        return u


def media_html(media, campana_id, paso_id):
    """HTML de la imagen/GIF del correo (si Andrea la activo). Ojo: el video NO se reproduce en
    correo; por eso lo que se incrusta siempre es imagen o GIF. Si hay 'enlace', la imagen es clicable."""
    m = media or {}
    if not m.get("mostrar") or not (m.get("url") or "").strip():
        return ""
    import html as _h
    alt = _h.escape((m.get("alt") or "").strip()[:120])
    src = _h.escape(m["url"].strip(), quote=True)
    img = (f'<img src="{src}" alt="{alt}" width="600" '
           'style="display:block;width:100%;max-width:600px;height:auto;border:0;border-radius:12px" />')
    if (m.get("enlace") or "").strip():
        href = _h.escape(con_utm(m["enlace"], campana_id, paso_id), quote=True)
        img = f'<a href="{href}" style="text-decoration:none">{img}</a>'
    pie = ""
    if (m.get("pie") or "").strip():
        pie = ('<div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#8b8d98;'
               f'margin-top:6px;text-align:center">{_h.escape(m["pie"].strip()[:140])}</div>')
    return f'<div style="margin:22px 0">{img}{pie}</div>'


def boton_html(boton, campana_id, paso_id):
    """HTML del boton del correo (si Andrea lo activo y tiene enlace). Cero dependencias."""
    b = boton or {}
    if not b.get("mostrar") or not (b.get("url") or "").strip():
        return ""
    texto = (b.get("texto") or "Ver mas").strip()[:60]
    href = con_utm(b["url"], campana_id, paso_id)
    import html as _h
    return ('<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:26px 0">'
            '<tr><td align="center" bgcolor="#B1A3E1" style="border-radius:10px">'
            f'<a href="{_h.escape(href, quote=True)}" style="display:inline-block;padding:13px 28px;'
            'font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;color:#0A0B0D;'
            f'text-decoration:none;border-radius:10px">{_h.escape(texto)}</a>'
            '</td></tr></table>')


def get_nurturing(data):
    """Devuelve la estructura multi-campana, migrando la campana unica anterior si hace falta."""
    n = data.setdefault("siemon", {}).setdefault("nurturing", {})
    if not n.get("campanas"):
        n["campanas"] = _plantillas()
        # --- migracion: lo que ya existia (config/secuencia/inscritos) era la campana de la guia ---
        vieja_cfg = n.get("config") or {}
        g = next((c for c in n["campanas"] if c["id"] == "guia"), None)
        if g and (n.get("secuencia") or n.get("inscritos") or vieja_cfg):
            for k in ("persona", "oferta", "lead_magnet", "remitente", "pautas"):
                if vieja_cfg.get(k):
                    g["config"][k] = vieja_cfg[k]
            g["activa"] = bool(vieja_cfg.get("activo"))
            g["autoInscribir"] = bool(vieja_cfg.get("autoInscribir", True))
            if n.get("secuencia"):
                g["secuencia"] = n["secuencia"]          # conserva los 8 correos ya escritos
            if n.get("inscritos"):
                g["inscritos"] = n["inscritos"]
            if n.get("metricas"):
                g["metricas"] = n["metricas"]
    # saneo + refresco de los 'pasos' canonicos (los objetivos los define el codigo, no los datos)
    plantillas = {c["id"]: c for c in _plantillas()}
    for c in n["campanas"]:
        base = plantillas.get(c.get("id"))
        if base:
            c["pasos"] = base["pasos"]
            c.setdefault("premisa", base["premisa"])
            c.setdefault("disparador", base["disparador"])
            if not c.get("cadencia"):
                c["cadencia"] = base["cadencia"]
        c.setdefault("secuencia", [])
        c.setdefault("inscritos", {})
        c.setdefault("metricas", {})
        c.setdefault("config", {})
    return n


def campana(n, cid):
    return next((c for c in (n.get("campanas") or []) if c.get("id") == cid), None)


def pausar_por_engagement(data, email, estado="convertido"):
    """Cuando un contacto RESPONDE / AGENDA (llega por formulario o booking) deja de recibir la
    serie de nurturing: marca su inscrito como 'convertido' en TODAS las campanas. Devuelve cuantas
    campanas se afectaron. No borra el historial: solo pausa el envio (pendientes_de ya lo salta)."""
    email = (email or "").strip().lower()
    if not email:
        return 0
    n = data.get("siemon", {}).get("nurturing", {})
    afectadas = 0
    for c in (n.get("campanas") or []):
        ins = (c.get("inscritos") or {}).get(email)
        if ins and ins.get("estado") in (None, "", "activo"):
            ins["estado"] = estado
            m = c.setdefault("metricas", {})
            m["convertidos"] = int(m.get("convertidos", 0) or 0) + 1
            afectadas += 1
    return afectadas


def elegible_auto(campana_dict, lead):
    """Auto-inscripcion segun el disparador de LA campana."""
    if not campana_dict.get("autoInscribir"):
        return False
    if not lead.get("email") or not lead.get("subscribed", True):
        return False
    d = campana_dict.get("disparador") or {}
    tipo, val = d.get("tipo"), (d.get("valor") or "").lower()
    if tipo == "fuente_contiene":
        blob = ((lead.get("fuente") or "") + " " + (lead.get("leadSource") or "") + " " +
                (lead.get("type") or "") + " " + " ".join(lead.get("tags") or [])).lower()
        return bool(val) and (val in blob or val.replace("guia", "guía") in blob)
    if tipo == "estado_lead":
        return (lead.get("status") or "").lower() == val
    return False   # 'manual': se inscriben a mano


def _dt(v):
    """Parsea 'YYYY-MM-DDTHH:MM:SS' o 'YYYY-MM-DD'. None si no puede."""
    if not v:
        return None
    s = str(v).strip()
    for f in ("%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d"):
        try:
            return datetime.strptime(s[:19] if "T" in s or " " in s else s, f)
        except Exception:
            continue
    return None


def pendientes_de(n, leads, ahora=None):
    """Que correo toca enviar AHORA en cada campana (cadencia en HORAS).
    Devuelve [(cid, email, paso, cuerpo, ins, lead)]."""
    ahora = ahora or datetime.utcnow()
    if isinstance(ahora, str):
        ahora = _dt(ahora) or datetime.utcnow()
    por_email = {(l.get("email") or "").lower(): l for l in leads if l.get("email")}
    out = []
    for c in (n.get("campanas") or []):
        if not c.get("activa"):
            continue
        pasos = c.get("pasos") or []
        sec = {p["id"]: p for p in (c.get("secuencia") or [])}
        cad = c.get("cadencia") or {}
        for email, ins in (c.get("inscritos") or {}).items():
            if ins.get("estado") not in (None, "", "activo"):
                continue
            lead = por_email.get(email)
            if lead is not None and not lead.get("subscribed", True):
                ins["estado"] = "baja"; continue
            if lead is not None and lead.get("status") == "Cliente":
                ins["estado"] = "convertido"; continue
            idx = int(ins.get("paso") or 0)
            if idx >= len(pasos):
                ins["estado"] = "completado"; continue
            paso = pasos[idx]
            cuerpo = sec.get(paso["id"])
            if not cuerpo or not (cuerpo.get("cuerpo") or "").strip():
                continue   # ese correo aun no esta redactado
            ini = _dt(ins.get("inicio"))
            if ini is None:
                ini = ahora
                ins["inicio"] = ahora.strftime("%Y-%m-%dT%H:%M:%S")
            try:
                horas = float(cad.get(paso["id"], 0) or 0)
            except Exception:
                horas = 0.0
            if ahora >= (ini + timedelta(hours=horas)) and ins.get("ultimoEnvio") != paso["id"]:
                out.append((c.get("id"), email, paso, cuerpo, ins, lead))
    return out
