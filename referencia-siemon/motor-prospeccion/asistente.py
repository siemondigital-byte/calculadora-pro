"""Asistente del Centro de Mando: Claude con herramientas. Corre prospección
cuando se le pide y ayuda en lo demás. Necesita ANTHROPIC_API_KEY en el entorno."""
import os
import json
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pipeline import prospectar  # noqa: E402
import crm_store                 # noqa: E402
import publicar as pub           # noqa: E402

STAGES = ["Nuevo lead", "Llamada agendada", "Descubrimiento", "Videollamada", "Propuesta", "Cliente", "Perdido"]

SYSTEM = (
    "# Quien eres\n"
    "Eres el asistente del Centro de Mando de Siemon Digital, la agencia de IA, automatizacion y "
    "marketing de Andrea Siemon. Ayudas a Andrea a prospectar clientes y a operar su CRM.\n\n"

    "# La marca (siemondigital.com)\n"
    "Siemon Digital ayuda a EMPRENDEDORES DIGITALES, PYMES que quieren escalar y CREADORES de contenido, "
    "a nivel GLOBAL, en espanol e ingles. Servicios: automatizacion de procesos, IA aplicada con criterio, "
    "estructuras de venta y procesos, optimizacion de recursos, arquitectura tecnologica personalizada y "
    "marketing de impacto. Mensaje central: 'Amplifica tu potencial': tecnologia que potencia el talento "
    "existente, sin formulas genericas. Voz: autoridad serena, consultiva, aspiracional, orientada a resultados; "
    "sin urgencia agresiva ni promesas magicas.\n\n"

    "# Prospeccion (tu súper-poder: 3 skills unidas)\n"
    "Cuando te pidan buscar, encontrar o prospectar, USA la herramienta 'prospectar'. 5 canales que se complementan:\n"
    "- 'directorios': negocios locales via mapa (OpenStreetMap) + analisis de su web (da telefono/direccion).\n"
    "- 'scrapling': negocios via busqueda web (Serper/Google); encuentra sitios que el mapa no trae.\n"
    "- 'youtube': creadores por nicho via API oficial; enriquece con IG/TikTok/email del canal. Ideal para embajadores.\n"
    "- 'instagram': perfiles publicos por nicho, linkables para DM.\n"
    "- 'linkedin': perfiles/empresas por nicho (profesionales y pymes).\n"
    "Como funciona el súper-scraper: YouTube DESCUBRE, Scrapling ENRIQUECE (email/IG/TikTok/LinkedIn/telefono), "
    "la busqueda web (Serper) EXPANDE a Instagram/LinkedIn/negocios. Para youtube/instagram/linkedin, en 'ciudad' "
    "pon pais o idioma si aplica (ej. 'México' o 'en') o dejalo generico. Puedes combinar canales. Los YouTubers "
    "inactivos +1 mes se descartan solos. Cada prospecto trae score/fit y se categoriza por canal. Si falta el "
    "sector/nicho o la zona, preguntalo antes.\n\n"

    "# El Centro de Mando (los modulos donde ayudas)\n"
    "Andrea trabaja en dos espacios. En 'Siemon Digital' (agencia): Panel (metricas), Leads, Prospeccion, "
    "Contenido (crea posts, guiones, carruseles, calendarios y ADS, y PUBLICA en Instagram y Facebook con API "
    "nativa, o programa la publicacion), Pipeline (etapas de venta), Canales (redes y mensajes entrantes), "
    "Ofertas y Agenda y envios. En 'Infoproductos y comunidad': Panel, Catalogo, Inscritos y Comunidad. "
    "Conoces estos modulos y guias a Andrea a traves de ellos. Cuando redactes un post o un anuncio, recuerda que "
    "puede publicarlo o programarlo desde el modulo Contenido (Instagram/Facebook ya nativos; LinkedIn, X, YouTube "
    "y TikTok se habilitan al conectar la cuenta).\n\n"

    "# Como responder\n"
    "Eres su asistente para TODO el CRM, no solo prospeccion. Si te dan un '# Contexto actual del CRM', usalo para "
    "responder con datos reales (cuantos leads, pipeline, clientes, proximas citas, prospectos, ofertas, en que "
    "modulo esta). Puedes: analizar sus leads y pipeline, sugerir el siguiente paso, redactar outreach y contenido "
    "en voz de marca, ayudar a organizar y priorizar, y prospectar con la herramienta. Si te piden algo que se hace "
    "en un modulo concreto, dile en cual y como.\n"
    "ACCIONES QUE EJECUTAS (no solo redactas): puedes CREAR o actualizar un lead (crear_lead), MOVER un lead de "
    "etapa en el pipeline (mover_etapa), PUBLICAR o PROGRAMAR contenido en redes (publicar_contenido), ANALIZAR a "
    "fondo un prospecto (analizar_prospecto: perfil, nicho, encaje cliente/embajador/ambos, gancho, falencias) y "
    "REDACTAR un correo o mensaje de contacto personalizado para un prospecto (redactar_mensaje). Usalas cuando "
    "Andrea te lo pida. Reglas: si te piden 'analiza a X', usa analizar_prospecto. Si te piden 'genera/redacta/"
    "escribe un correo (o mensaje) para X', usa redactar_mensaje (y si el prospecto aun no tiene estudio, primero "
    "analizar_prospecto y luego redactar_mensaje). Cuando redactar_mensaje devuelva el asunto y cuerpo, MUESTRASELOS "
    "COMPLETOS a Andrea, tal cual, para que los copie o los ajuste. Recuerda: si el prospecto es embajador o 'ambos', "
    "el correo ya incluye la colaboracion (promocionar su infoproducto de finanzas + crear el suyo); no la quites. "
    "Tras crear/mover/analizar, confirma en una linea que quedo hecho. Antes de PUBLICAR, confirma la red y el texto "
    "con ella, salvo que ya te haya dicho claramente 'publica ahora'. Nunca inventes datos: si falta el nombre, "
    "email o la etapa, preguntalo.\n"
    "MODELO DE NEGOCIO de Andrea (usalo al aconsejar y redactar): 1) SERVICIOS de agencia (IA, automatizacion, web, "
    "marketing) para empresas, pymes y creadores; 2) un INFOPRODUCTO de FINANZAS PERSONALES y LIBERTAD FINANCIERA, "
    "para el que busca EMBAJADORES (creadores con audiencia afin al dinero/emprendimiento/crecimiento personal que lo "
    "promocionan por comision) e INSCRITOS; 3) puede ayudar a un creador a crear y automatizar SU PROPIO infoproducto. "
    "Por eso muchos creadores son 'ambos': clientes de servicios Y embajadores.\n"
    "ADS (medios pagados): tambien ayudas con anuncios en Meta (Instagram/Facebook), Google, YouTube, LinkedIn, "
    "TikTok y X. Puedes proponer el OBJETIVO de campana, el PUBLICO/segmentacion (edad, ubicacion, intereses, "
    "lookalike, retargeting), PRESUPUESTO diario y duracion, UBICACIONES, y varias VARIACIONES de copy (texto "
    "principal, titular, CTA). Si te piden 'una campana' o 'un anuncio', entrega el brief completo por secciones y "
    "sugiere que lo guarden desde el modulo Contenido. Pregunta objetivo, oferta y presupuesto si faltan.\n"
    "Al devolver resultados de prospeccion, resumelos util (cuantos, cuales destacan y por que encajan con el ICP) e "
    "invita a promover los buenos a leads o a contactarlos por su canal. Si hay 'avisos', comunicalos.\n"
    "Estilo: responde en el idioma en que te escriban (es/en), voz de marca, breve y accionable, sin promesas "
    "magicas, y CERO guiones largos (usa comas o 'a' para rangos)."
)

TOOLS = [{
    "name": "prospectar",
    "description": "Busca prospectos reales por uno o varios canales (directorios, scrapling, "
                   "youtube), los analiza y puntua como oportunidad. Devuelve lista con score/fit, "
                   "web, email, telefono, redes, subs (youtube) y problemas detectados.",
    "input_schema": {
        "type": "object",
        "properties": {
            "sector": {"type": "string", "description": "Tipo de negocio o nicho: dentista, gimnasio, "
                       "'finanzas personales', 'IA para negocios'..."},
            "ciudad": {"type": "string", "description": "Ciudad con pais (ej. 'Barcelona, España'). "
                       "Para el canal youtube, pon el pais o idioma (ej. 'España' o 'en')."},
            "servicio": {"type": "string", "enum": ["automatizacion", "web", "seo", "marketing"],
                         "description": "El servicio que se ofrece (afecta el scoring de negocios)"},
            "canales": {"type": "array", "items": {"type": "string",
                        "enum": ["directorios", "scrapling", "youtube", "instagram", "linkedin"]},
                        "description": "Canales a usar. Por defecto ['directorios']."},
            "n": {"type": "integer", "description": "Cuantos traer (1 a 60)"},
        },
        "required": ["sector", "ciudad"],
    },
}, {
    "name": "crear_lead",
    "description": "Crea (o actualiza si el email ya existe) un lead en el CRM de Siemon. Usalo cuando "
                   "Andrea te pida guardar o registrar un contacto/lead.",
    "input_schema": {
        "type": "object",
        "properties": {
            "nombre": {"type": "string", "description": "Nombre de la persona o empresa"},
            "email": {"type": "string", "description": "Email (si lo hay; sirve para no duplicar)"},
            "empresa": {"type": "string"},
            "telefono": {"type": "string"},
            "mensaje": {"type": "string", "description": "Nota, interes o de que se trata"},
            "origen": {"type": "string", "description": "De donde viene (Instagram, Referido, WhatsApp...)"},
            "etapa": {"type": "string", "enum": STAGES, "description": "Etapa del pipeline. Por defecto 'Nuevo lead'."},
        },
        "required": ["nombre"],
    },
}, {
    "name": "mover_etapa",
    "description": "Mueve un lead existente a otra etapa del pipeline de Siemon.",
    "input_schema": {
        "type": "object",
        "properties": {
            "identificador": {"type": "string", "description": "Email (preferido) o nombre del lead a mover"},
            "etapa": {"type": "string", "enum": STAGES, "description": "Etapa destino"},
        },
        "required": ["identificador", "etapa"],
    },
}, {
    "name": "publicar_contenido",
    "description": "Publica o programa un post en una red social (via Postiz si esta conectado, si no "
                   "Instagram/Facebook nativo). IMPORTANTE: confirma con Andrea la red y el texto antes de "
                   "llamar a esta herramienta, salvo que ya te haya dicho claramente que publiques.",
    "input_schema": {
        "type": "object",
        "properties": {
            "red": {"type": "string", "description": "instagram, facebook, linkedin, x, youtube, tiktok..."},
            "texto": {"type": "string", "description": "El texto/caption del post"},
            "mediaUrl": {"type": "string", "description": "URL de imagen o video (obligatorio para Instagram)"},
            "cuando": {"type": "string", "enum": ["ahora", "programar"], "description": "Publicar ya o programar"},
            "fecha": {"type": "string", "description": "Fecha ISO si se programa (ej. 2026-07-10T09:00:00Z)"},
        },
        "required": ["red", "texto"],
    },
}, {
    "name": "redactar_mensaje",
    "description": "Redacta un correo o mensaje de contacto en frio PERSONALIZADO para un prospecto que ya esta "
                   "en el CRM. Usa su estudio (perfil, gancho, falencias, como ayudarle) y, si el prospecto es "
                   "embajador o 'ambos', incluye AUTOMATICAMENTE la colaboracion (promocionar el infoproducto de "
                   "finanzas + ayudarle a crear el suyo). USALA cuando Andrea pida 'genera/redacta/escribe un "
                   "correo o mensaje para [nombre]'. Devuelve asunto y cuerpo listos.",
    "input_schema": {
        "type": "object",
        "properties": {
            "prospecto_nombre": {"type": "string", "description": "Nombre del prospecto en el CRM (para buscarlo y usar su estudio)"},
            "canal": {"type": "string", "enum": ["email", "whatsapp", "instagram", "tiktok", "linkedin", "youtube"],
                      "description": "Canal del mensaje. Por defecto 'email'."},
            "instruccion": {"type": "string", "description": "Enfoque o instruccion especial que dio Andrea (ej. 'ofrece automatizacion y proponle ser embajador del infoproducto de finanzas')"},
        },
        "required": ["prospecto_nombre"],
    },
}, {
    "name": "analizar_prospecto",
    "description": "Analiza a fondo un prospecto del CRM (o una URL): perfil de negocio, nicho, encaje, si es "
                   "cliente/embajador/ambos, fortalezas, falencias, como ayudarle y gancho. Guarda el estudio en el "
                   "prospecto. USALA cuando pidan 'analiza a [nombre]' o antes de redactar si el prospecto no tiene estudio.",
    "input_schema": {
        "type": "object",
        "properties": {
            "prospecto_nombre": {"type": "string", "description": "Nombre del prospecto en el CRM"},
            "url": {"type": "string", "description": "O una URL directa (web o canal) si no esta en el CRM"},
        },
    },
}]


def _tool_crear_lead(a):
    import uuid
    from datetime import date
    data = crm_store.leer() or {"workspace": "siemon", "siemon": {"leads": []}, "academia": {}}
    data.setdefault("siemon", {}).setdefault("leads", [])
    leads = data["siemon"]["leads"]
    campos = {"name": a.get("nombre", ""), "email": a.get("email", ""), "company": a.get("empresa", ""),
              "phone": a.get("telefono", ""), "message": a.get("mensaje", ""),
              "leadSource": a.get("origen", "Asistente")}
    etapa = a.get("etapa") or "Nuevo lead"
    if etapa not in STAGES:
        etapa = "Nuevo lead"
    email = (a.get("email") or "").strip().lower()
    if email:
        for l in leads:
            if (l.get("email") or "").strip().lower() == email:
                for k, v in campos.items():
                    if v:
                        l[k] = v
                l["status"] = etapa
                crm_store.guardar(data)
                return {"ok": True, "accion": "actualizado", "nombre": l.get("name")}
    nuevo = {"id": str(uuid.uuid4()), "createdAt": str(date.today()), "leadOwner": "Andrea",
             "leadOwnerEmail": "andrea@siemondigital.com", "language": "es", "subscribed": True,
             "valor": 0, "qualified": False, "tags": [], "status": etapa}
    nuevo.update({k: v for k, v in campos.items() if v})
    leads.insert(0, nuevo)
    crm_store.guardar(data)
    return {"ok": True, "accion": "creado", "nombre": nuevo.get("name")}


def _tool_mover_etapa(a):
    data = crm_store.leer()
    if not data:
        return {"ok": False, "error": "aun no hay datos en el CRM"}
    etapa = a.get("etapa", "")
    if etapa not in STAGES:
        for s in STAGES:
            if etapa.lower() in s.lower():
                etapa = s
                break
    if etapa not in STAGES:
        return {"ok": False, "error": "etapa invalida; usa una de: " + ", ".join(STAGES)}
    ident = (a.get("identificador") or "").strip().lower()
    leads = data.get("siemon", {}).get("leads", [])
    match = [l for l in leads if (l.get("email") or "").lower() == ident]
    if not match:
        match = [l for l in leads if ident and ident in (l.get("name") or "").lower()]
    if not match:
        return {"ok": False, "error": "no encontre ese lead"}
    if len(match) > 1:
        return {"ok": False, "error": f"hay {len(match)} leads que coinciden; usa el email para ser exacto"}
    match[0]["status"] = etapa
    crm_store.guardar(data)
    return {"ok": True, "nombre": match[0].get("name"), "etapa": etapa}


def _tool_publicar(a):
    red = (a.get("red") or "").lower()
    when = "schedule" if (a.get("cuando", "") == "programar") else "now"
    res = pub.publicar({"red": red, "texto": a.get("texto", ""), "mediaUrl": a.get("mediaUrl", ""),
                        "when": when, "date": a.get("fecha", "")})
    if res.get("ok"):
        try:
            import uuid
            from datetime import date
            data = crm_store.leer() or {}
            data.setdefault("siemon", {}).setdefault("publicaciones", [])
            data["siemon"]["publicaciones"].insert(0, {
                "id": str(uuid.uuid4()), "canales": [red.capitalize()], "texto": a.get("texto", ""),
                "estado": "Programada" if when == "schedule" else "Publicada", "fecha": str(date.today())})
            crm_store.guardar(data)
        except Exception:
            pass
    return res


def _buscar_prospecto(nombre):
    """Encuentra un prospecto del CRM por nombre (exacto y luego por coincidencia). Devuelve el dict o None."""
    data = crm_store.leer() or {}
    ps = (data.get("siemon") or {}).get("prospectos") or []
    nl = (nombre or "").strip().lower()
    if not nl:
        return None
    for p in ps:
        if (p.get("nombre") or "").strip().lower() == nl:
            return p
    cand = [p for p in ps if nl in (p.get("nombre") or "").lower()]
    return cand[0] if cand else None


def _tool_redactar_mensaje(a):
    from app import _gen_mensaje_core   # late import: evita el ciclo app<->asistente
    nombre = (a.get("prospecto_nombre") or "").strip()
    p = _buscar_prospecto(nombre)
    if not p:
        return {"ok": False, "error": f"no encontre a '{nombre}' en tus prospectos; revisa el nombre o analizalo primero"}
    req = {"prospecto": p, "canal": (a.get("canal") or "email"), "instruccion": (a.get("instruccion") or "")}
    d = _gen_mensaje_core(req)
    if d.get("error"):
        return {"ok": False, "error": d["error"]}
    return {"ok": True, "prospecto": p.get("nombre"), "canal": req["canal"],
            "asunto": d.get("asunto") or "", "cuerpo": d.get("cuerpo") or d.get("mensaje") or "",
            "tipo_encaje": (p.get("perfilProspecto") or {}).get("tipo_encaje", "")}


def _tool_analizar_prospecto(a):
    from app import _analizar_core
    nombre = (a.get("prospecto_nombre") or "").strip()
    url = (a.get("url") or "").strip()
    p = _buscar_prospecto(nombre) if nombre else None
    if p and not url:
        url = p.get("web") or p.get("perfil") or (list((p.get("redes") or {}).values()) or [""])[0] or ""
    if not url:
        return {"ok": False, "error": "necesito el prospecto (con web/perfil) o una URL para analizar"}
    req = {"web": url, "perfil": (p.get("perfil") if p else "") or url}
    d = _analizar_core(req)
    if not d.get("ok"):
        return {"ok": False, "error": d.get("error") or "no pude analizar"}
    perfil = d.get("perfil") or {}
    if p:  # persistir el estudio en el prospecto
        data = crm_store.leer() or {}
        for x in (data.get("siemon") or {}).get("prospectos") or []:
            if (x.get("nombre") or "").strip().lower() == (p.get("nombre") or "").strip().lower():
                if perfil and not perfil.get("error"):
                    x["perfilProspecto"] = perfil
                if d.get("youtube"):
                    x["youtube"] = d["youtube"]
                c = d.get("contacto") or {}
                if c.get("email") and not x.get("email"):
                    x["email"] = c["email"]
                if c.get("redes"):
                    x["redes"] = {**(x.get("redes") or {}), **c["redes"]}
                break
        crm_store.guardar(data)
    return {"ok": True, "prospecto": (p.get("nombre") if p else url), "nicho": perfil.get("nicho"),
            "encaje": perfil.get("encaje"), "tipo_encaje": perfil.get("tipo_encaje"), "gancho": perfil.get("gancho"),
            "falencias": (perfil.get("falencias") or [])[:4], "como_ayudar": (perfil.get("como_ayudar") or [])[:4]}


_EXTRAS_NOTA = (
    "\n\n# Formato de salida (obligatorio)\n"
    "Al FINAL de tu respuesta agrega SIEMPRE una linea que empiece exactamente con '|||sugerencias:' "
    "seguida de un array JSON con 3 preguntas de seguimiento cortas en primera persona del usuario "
    '(ej. ["Muestrame los leads sin contactar","Cuanto vale mi pipeline","Ver tareas pendientes"]). '
    "Si la respuesta incluye cifras comparables o un ranking, agrega ANTES otra linea '|||viz:' con un JSON: "
    '{"tipo":"numero","titulo":"...","valor":"...","etiqueta":"..."} o '
    '{"tipo":"barras","titulo":"...","datos":[{"k":"...","v":123}]} o '
    '{"tipo":"tabla","titulo":"...","columnas":["..."],"filas":[["..."]]}. '
    "Estas lineas son para la interfaz: no las menciones en el texto."
)


def _extraer_extras(texto):
    """Separa del texto las lineas |||sugerencias y |||viz. Devuelve (texto, sugerencias, viz)."""
    sugerencias, viz = [], None
    lineas = []
    for ln in (texto or "").splitlines():
        s = ln.strip()
        if s.startswith("|||sugerencias:"):
            try:
                sugerencias = [str(x) for x in json.loads(s.split(":", 1)[1].strip())][:3]
            except Exception:
                pass
        elif s.startswith("|||viz:"):
            try:
                viz = json.loads(s.split(":", 1)[1].strip())
            except Exception:
                pass
        else:
            lineas.append(ln)
    return "\n".join(lineas).strip(), sugerencias, viz


def _fallback(contexto, motivo=""):
    """Si la IA falla, nunca dejar al usuario sin nada: responde con el snapshot real del CRM."""
    base = "La IA no está disponible en este momento" + (f" ({motivo[:80]})" if motivo else "") + "."
    ctx = (contexto or "").strip()
    if ctx:
        base += " Esto es lo que veo ahora mismo en tu CRM:\n\n" + ctx[:900]
    return {"respuesta": base, "prospectos": [], "mutado": False,
            "sugerencias": ["Ver tareas pendientes", "Cuánto vale mi pipeline", "Mis leads sin contactar"], "viz": None}


def correr_asistente(mensaje, historial=None, sistema=None, contexto=""):
    key = os.environ.get("ANTHROPIC_API_KEY")
    if not key:
        return _fallback(contexto, "sin clave de Claude en el servidor")
    try:
        import anthropic
    except Exception:
        return _fallback(contexto, "falta la libreria anthropic")

    system = ((sistema or "").strip() or SYSTEM) + _EXTRAS_NOTA   # prompt editable desde el front
    if (contexto or "").strip():                 # snapshot vivo del CRM (solo lectura)
        system = system + "\n\n# Contexto actual del CRM (solo lectura)\n" + contexto.strip()
    client = anthropic.Anthropic(api_key=key)
    msgs = list(historial or []) + [{"role": "user", "content": mensaje}]
    prospectos = []
    mutado = False   # True si alguna herramienta cambio el CRM (el front debe recargar)

    for _ in range(5):  # loop de herramientas
        try:
            r = client.messages.create(model="claude-sonnet-5", max_tokens=2200,
                                       system=system, tools=TOOLS, messages=msgs)
        except Exception as e:
            fb = _fallback(contexto, str(e))
            fb["prospectos"] = prospectos
            fb["mutado"] = mutado
            return fb

        if r.stop_reason == "tool_use":
            msgs.append({"role": "assistant", "content": [b.model_dump() for b in r.content]})
            results = []
            for b in r.content:
                if getattr(b, "type", "") != "tool_use":
                    continue
                a = b.input or {}
                try:
                    if b.name == "prospectar":
                        canales = a.get("canales") or ["directorios"]
                        res = prospectar(a.get("sector", ""), a.get("ciudad", ""),
                                         a.get("servicio", "automatizacion"),
                                         min(int(a.get("n", 20) or 20), 60), canales)
                        prospectos = res.get("prospectos", [])
                        content = json.dumps({"total": res["total"], "encajan": res["encajan"],
                                              "canales": res.get("canales"), "avisos": res.get("avisos", []),
                                              "top": [{"nombre": p["nombre"], "score": p["score"],
                                                       "canal": p.get("canal"), "subs": p.get("subs"),
                                                       "web": p["web"], "email": p["email"],
                                                       "problema": (p["problemas"] or [""])[0]}
                                                      for p in prospectos[:8]]}, ensure_ascii=False)
                    elif b.name == "crear_lead":
                        res = _tool_crear_lead(a)
                        mutado = mutado or res.get("ok", False)
                        content = json.dumps(res, ensure_ascii=False)
                    elif b.name == "mover_etapa":
                        res = _tool_mover_etapa(a)
                        mutado = mutado or res.get("ok", False)
                        content = json.dumps(res, ensure_ascii=False)
                    elif b.name == "publicar_contenido":
                        res = _tool_publicar(a)
                        mutado = mutado or res.get("ok", False)
                        content = json.dumps(res, ensure_ascii=False)
                    elif b.name == "redactar_mensaje":
                        res = _tool_redactar_mensaje(a)
                        content = json.dumps(res, ensure_ascii=False)
                    elif b.name == "analizar_prospecto":
                        res = _tool_analizar_prospecto(a)
                        mutado = mutado or res.get("ok", False)
                        content = json.dumps(res, ensure_ascii=False)
                    else:
                        content = json.dumps({"error": "herramienta desconocida"})
                except Exception as e:
                    content = json.dumps({"error": str(e)})
                results.append({"type": "tool_result", "tool_use_id": b.id, "content": content})
            msgs.append({"role": "user", "content": results})
            continue

        texto = "".join(getattr(b, "text", "") for b in r.content if getattr(b, "type", "") == "text")
        limpio, sugerencias, viz = _extraer_extras(texto)
        return {"respuesta": limpio or "(sin respuesta)", "prospectos": prospectos, "mutado": mutado,
                "sugerencias": sugerencias, "viz": viz}

    return {"respuesta": "Hice varias acciones. Revisa el resultado.", "prospectos": prospectos, "mutado": mutado,
            "sugerencias": [], "viz": None}
