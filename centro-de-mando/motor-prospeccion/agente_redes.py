"""Agente de redes 24/7 de Atlantis (portado del nucleo Siemon): vigila los
comentarios y DMs de Instagram/Facebook y redacta la respuesta en la voz de la
marca (valor primero, cero venta agresiva). Modo 'borrador' (el dueno aprueba)
o 'auto' (responde solo). Los entrantes viven en atlantis.inbound.

Conexion: crear la app en Meta, suscribir la pagina y pegar en Accesos:
META_PAGE_TOKEN, META_VERIFY_TOKEN, META_PAGE_ID, META_IG_ID.
Webhook: <MOTOR_URL>/social/webhook (verificacion GET + eventos POST).
"""
import os
import uuid

import requests

import crm_store
import secretos as _sec
from fastapi import APIRouter, Header, Request
from fastapi.responses import PlainTextResponse

router = APIRouter()

_META_VER = os.environ.get("META_API_VER", "v21.0")

_SOCIAL_REGLAS = (
    "\n\nESTAS RESPONDIENDO EN REDES SOCIALES (comentario o DM) como Atlantis Global Realty.\n"
    "TONO: humano, calido, con autoridad serena; VALOR primero, jamas venta agresiva, jamas "
    "promesas de retorno ni escasez artificial. Reconoce lo que la persona dijo, aporta algo "
    "util, y cierra con UN paso siguiente suave y opcional (una pregunta, o invitar a escribir "
    "por DM / agendar el diagnostico). Que sienta que te importa mas su resultado que cerrar.\n"
    "FORMATO: MUY breve (1 a 3 frases), natural, en el MISMO idioma en que te escriben (es/en). "
    "Sin em dashes, sin hashtags, sin sonar a robot ni a plantilla. Si es solo un emoji o un "
    "elogio, agradece con calidez. Si hay interes real (precio, 'como funciona'), ofrece "
    "continuar por DM o agendar el diagnostico, sin presionar."
)


def uuid4hex():
    return uuid.uuid4().hex[:16]


def _cfg():
    """Config del agente (defaults seguros). modo 'borrador' = el dueno aprueba antes de enviar."""
    data = crm_store.leer() or {}
    c = ((data.get("atlantis") or {}).get("agenteRedes")) or {}
    return {
        "activo": bool(c.get("activo", False)),
        "modo": c.get("modo") or "borrador",
        "instruccion": c.get("instruccion") or "",
        "responder_comentarios": bool(c.get("responder_comentarios", True)),
        "responder_dms": bool(c.get("responder_dms", True)),
    }


def _avisar(titulo, cuerpo):
    try:
        from app import _push_a_todos
        data = crm_store.leer() or {}
        _push_a_todos(data, "atlantis", {"title": titulo, "body": (cuerpo or "")[:140],
                                         "url": "https://crm.atlantisglobalrealty.com/"})
    except Exception:
        pass


def _guardar_entrante(canal, tipo, autor, texto, ext_id, ref=None, psid=None):
    """Guarda un comentario/DM entrante en atlantis.inbound (dedup por ext_id) y avisa al movil."""
    from datetime import date as _date
    from app import guardar_seguro
    data = crm_store.leer() or {}
    sw = data.setdefault("atlantis", {})
    inb = sw.get("inbound") or []
    if ext_id and any(m.get("extId") == ext_id for m in inb):
        return None
    item = {"id": "soc-" + (str(ext_id)[-16:] if ext_id else uuid4hex()), "extId": ext_id,
            "canal": canal, "tipo": tipo, "autor": autor or "usuario", "mensaje": texto,
            "fecha": str(_date.today()), "dir": "in", "atendido": False,
            "socialTipo": tipo, "ref": ref, "psid": psid, "borrador": ""}
    sw["inbound"] = [item] + inb
    guardar_seguro(data)
    _avisar(f"{canal}: {autor or 'nuevo mensaje'}", texto)
    return item


def _reply(texto, canal="Instagram", tipo="comentario", instruccion=""):
    """Redacta la respuesta en la voz de la marca. '' si falla (el respaldo Gemini
    del cliente de Anthropic aplica solo)."""
    if not (texto or "").strip():
        return ""
    try:
        import anthropic
        from app import _VOZ_MARCA, _sin_em_dash
        t = (texto or "").lower()
        marks_en = sum(1 for w in (" the ", " you ", " your ", " how ", " what ", " price ",
                                   " is ", " and ", " with ", " can ", " i ") if w in (" " + t + " "))
        marks_es = sum(1 for w in ("¿", "ñ", " que ", " como ", " cuanto", " precio", " hola",
                                   " gracias", " los ", " para ", " tu ", " con ") if w in (" " + t + " "))
        regla_idi = ("Responde 100% en INGLES natural (la persona escribio en ingles)."
                     if marks_en > marks_es else
                     "Responde en ESPANOL neutro latinoamericano natural.")
        sys = _VOZ_MARCA + _SOCIAL_REGLAS + "\n" + regla_idi + \
            (("\nMatiz extra del dueno: " + instruccion) if instruccion else "")
        u = (f"Canal: {canal}. Tipo: {'comentario publico' if tipo == 'comentario' else 'mensaje directo'}.\n"
             f"La persona escribio: \"{(texto or '').strip()[:600]}\"\n{regla_idi}\n"
             "Redacta SOLO la respuesta (sin comillas, sin firmar, sin explicaciones).")
        r = anthropic.Anthropic().messages.create(
            model=os.environ.get("CLAUDE_MODEL", "claude-sonnet-5"), max_tokens=400,
            system=sys, messages=[{"role": "user", "content": u}])
        out = "".join(b.text for b in r.content if getattr(b, "type", "") == "text").strip()
        return _sin_em_dash(out.strip().strip('"').strip())[:900]
    except Exception:
        return ""


def _enviar_graph(item, texto):
    """Responde el COMENTARIO (…/{id}/replies) o el DM (…/me/messages) por Graph API."""
    tok = _sec.get("META_PAGE_TOKEN")
    if not tok:
        return False, "sin_conexion"
    tipo = item.get("socialTipo") or item.get("tipo") or "comentario"
    try:
        if tipo == "dm":
            psid = item.get("psid") or ""
            if not psid:
                return False, "sin destinatario (psid)"
            r = requests.post(f"https://graph.facebook.com/{_META_VER}/me/messages",
                              params={"access_token": tok},
                              json={"recipient": {"id": psid}, "message": {"text": texto[:1800]},
                                    "messaging_type": "RESPONSE"}, timeout=30)
        else:
            ref = item.get("ref") or item.get("extId") or ""
            if not ref:
                return False, "sin id de comentario"
            r = requests.post(f"https://graph.facebook.com/{_META_VER}/{ref}/replies",
                              params={"access_token": tok}, json={"message": texto[:1800]}, timeout=30)
        d = r.json() if r.content else {}
        if not r.ok or (isinstance(d, dict) and d.get("error")):
            return False, ((d.get("error") or {}).get("message")) if isinstance(d, dict) else str(d)[:180]
        return True, ""
    except Exception as e:  # noqa: BLE001
        return False, str(e)[:160]


def _procesar_item(item, cfg):
    """Redacta el borrador y, en modo 'auto' con el agente activo, responde solo."""
    from app import guardar_seguro
    tipo = item.get("socialTipo") or "comentario"
    if tipo == "comentario" and not cfg["responder_comentarios"]:
        return None
    if tipo == "dm" and not cfg["responder_dms"]:
        return None
    borrador = _reply(item.get("mensaje") or "", item.get("canal") or "Instagram",
                      tipo, cfg["instruccion"])
    if not borrador:
        return None
    enviado, nota = False, ""
    if cfg["activo"] and cfg["modo"] == "auto":
        enviado, nota = _enviar_graph(item, borrador)
    data = crm_store.leer() or {}
    inb = (data.get("atlantis") or {}).get("inbound") or []
    for m in inb:
        if m.get("id") == item.get("id"):
            m["borrador"] = borrador
            if enviado:
                m["atendido"] = True
                m["respondidoAuto"] = True
            break
    data.setdefault("atlantis", {})["inbound"] = inb
    guardar_seguro(data)
    return {"borrador": borrador, "enviado": enviado, "nota": nota}


@router.get("/social/estado")
def social_estado(authorization: str = Header(None)):
    from app import _auth
    _auth(authorization)
    base = os.environ.get("MOTOR_URL", "https://motor.atlantisglobalrealty.com").rstrip("/")
    return {"ok": True, "conectado": bool(_sec.get("META_PAGE_TOKEN")),
            "webhook": base + "/social/webhook", "verify_set": bool(_sec.get("META_VERIFY_TOKEN")),
            "page_id": bool(_sec.get("META_PAGE_ID")), "ig_id": bool(_sec.get("META_IG_ID")),
            "config": _cfg()}


@router.post("/social/config")
def social_config_set(req: dict, authorization: str = Header(None)):
    from app import _auth, guardar_seguro
    _auth(authorization)
    data = crm_store.leer() or {}
    cur = _cfg()
    for k in ("activo", "responder_comentarios", "responder_dms"):
        if k in req:
            cur[k] = bool(req[k])
    if req.get("modo") in ("borrador", "auto"):
        cur["modo"] = req["modo"]
    if "instruccion" in req:
        cur["instruccion"] = (req.get("instruccion") or "")[:800]
    data.setdefault("atlantis", {})["agenteRedes"] = cur
    guardar_seguro(data)
    return {"ok": True, "config": cur}


@router.get("/social/webhook")
def social_webhook_verificar(request: Request):
    """Verificacion del webhook de Meta (handshake hub.challenge)."""
    q = request.query_params
    modo = q.get("hub.mode")
    tok = q.get("hub.verify_token")
    ch = q.get("hub.challenge")
    esperado = _sec.get("META_VERIFY_TOKEN") or ""
    if modo == "subscribe" and esperado and tok == esperado:
        return PlainTextResponse(ch or "")
    return PlainTextResponse("verificacion fallida", status_code=403)


@router.post("/social/webhook")
async def social_webhook_recibir(request: Request):
    """Recibe eventos de Meta (comentarios + DMs). Publico a proposito (Meta llama
    sin Bearer). Guarda en inbound y, si el agente esta activo, redacta o responde."""
    try:
        body = await request.json()
    except Exception:
        return {"ok": True}
    cfg = _cfg()
    guardados = 0
    try:
        obj = body.get("object") or ""
        canal = "Instagram" if "instagram" in obj else "Facebook"
        for entry in (body.get("entry") or []):
            for ev in (entry.get("messaging") or []):
                msg = ev.get("message") or {}
                if msg.get("is_echo"):
                    continue
                texto = msg.get("text") or ""
                psid = ((ev.get("sender") or {}).get("id")) or ""
                if not texto or not psid:
                    continue
                it = _guardar_entrante(canal if canal != "Facebook" else "Messenger", "dm",
                                       psid, texto, msg.get("mid"), ref=None, psid=psid)
                if it:
                    guardados += 1
                    if cfg["activo"]:
                        _procesar_item(it, cfg)
            for ch in (entry.get("changes") or []):
                val = ch.get("value") or {}
                if (ch.get("field") in ("comments", "feed")) and (val.get("message") or val.get("text")):
                    if val.get("verb") and val.get("verb") not in ("add",):
                        continue
                    autor = (((val.get("from") or {}).get("name"))
                             or ((val.get("from") or {}).get("username")) or "usuario")
                    texto = val.get("message") or val.get("text") or ""
                    cid = val.get("comment_id") or val.get("id") or ""
                    it = _guardar_entrante(canal, "comentario", autor, texto, cid, ref=cid)
                    if it:
                        guardados += 1
                        if cfg["activo"]:
                            _procesar_item(it, cfg)
    except Exception:
        pass
    return {"ok": True, "guardados": guardados}


@router.post("/social/responder")
def social_responder(req: dict, authorization: str = Header(None)):
    """Redacta (o re-redacta) el borrador para un item de inbound o un texto suelto."""
    from app import _auth, guardar_seguro
    _auth(authorization)
    cfg = _cfg()
    texto = (req.get("texto") or "").strip()
    canal = req.get("canal") or "Instagram"
    tipo = req.get("tipo") or "comentario"
    item_id = req.get("id") or ""
    if item_id and not texto:
        data = crm_store.leer() or {}
        for m in ((data.get("atlantis") or {}).get("inbound") or []):
            if m.get("id") == item_id:
                texto = m.get("mensaje") or ""
                canal = m.get("canal") or canal
                tipo = m.get("socialTipo") or tipo
                break
    borrador = _reply(texto, canal, tipo, cfg["instruccion"])
    if not borrador:
        return {"ok": False, "error": "no pude redactar"}
    if item_id:
        data = crm_store.leer() or {}
        inb = (data.get("atlantis") or {}).get("inbound") or []
        for m in inb:
            if m.get("id") == item_id:
                m["borrador"] = borrador
                break
        data.setdefault("atlantis", {})["inbound"] = inb
        guardar_seguro(data)
    return {"ok": True, "borrador": borrador}


@router.post("/social/enviar")
def social_enviar(req: dict, authorization: str = Header(None)):
    """Envia la respuesta aprobada (comentario o DM) por Graph y marca atendido."""
    from app import _auth, guardar_seguro, _sin_em_dash
    _auth(authorization)
    item_id = req.get("id") or ""
    texto = (req.get("texto") or "").strip()
    if not (item_id and texto):
        return {"ok": False, "error": "faltan datos"}
    data = crm_store.leer() or {}
    inb = (data.get("atlantis") or {}).get("inbound") or []
    item = next((m for m in inb if m.get("id") == item_id), None)
    if not item:
        return {"ok": False, "error": "no encontre el mensaje"}
    ok, nota = _enviar_graph(item, _sin_em_dash(texto))
    if not ok:
        return {"ok": False, "error": "meta", "nota": nota or "revisa la conexion de Meta"}
    item["atendido"] = True
    item["borrador"] = texto
    data.setdefault("atlantis", {})["inbound"] = inb
    guardar_seguro(data)
    return {"ok": True}


@router.post("/social/procesar")
def social_procesar(req: dict = None, authorization: str = Header(None)):
    """CRON (n8n): redacta respuesta para los entrantes sin atender y sin borrador
    (y responde solo en modo auto). Idempotente. Avisa al movil con el resumen."""
    from app import _auth
    _auth(authorization)
    cfg = _cfg()
    if not cfg["activo"]:
        return {"ok": True, "nota": "agente inactivo", "procesados": 0}
    data = crm_store.leer() or {}
    inb = ((data.get("atlantis") or {}).get("inbound")) or []
    pend = [m for m in inb if m.get("dir") == "in" and m.get("socialTipo") in ("comentario", "dm")
            and not m.get("atendido") and not m.get("borrador")]
    proc, auto = 0, 0
    for it in pend[:40]:
        r = _procesar_item(it, cfg)
        if r:
            proc += 1
            if r.get("enviado"):
                auto += 1
    if proc:
        _avisar("Agente de redes 24/7",
                f"{proc} mensaje(s) con respuesta lista" + (f" ({auto} respondido solo)" if auto else " para tu OK"))
    return {"ok": True, "procesados": proc, "auto": auto}
