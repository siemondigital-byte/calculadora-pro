"""Nurturing: secuencia de correos por fases con cadencia en dias.

Reglas (skill modulos.md):
- La secuencia la GENERA la IA desde la config; no se envia nada hasta revisar
  y Activar.
- Auto-inscribe leads elegibles; SALE de la serie al responder, comprar,
  volverse Cliente o darse de baja.
- Deliverability: tope diario + baja con token HMAC + pixel de apertura.

La logica pura vive aqui (testeable con un enviar_fn inyectado); app.py cablea
los endpoints y el envio real via buzones.enviar.
"""
import hashlib
import hmac
import os
import re
import time
from urllib.parse import quote

ETAPAS_SALIDA = {"Comprador", "Cliente", "Reembolsado", "Baja", "Descartado"}
DIA = 86400


def _slice(data, ws):
    return data.setdefault(ws, {}).setdefault("nurturing", {
        "config": {},
        "secuencia": [],
        "activo": False,
        "inscritos": [],
        "bajas": [],
        "metricas": {"enviados": 0, "aperturas": 0},
    })


def token_baja(email):
    secreto = os.environ.get("TOKEN_SECRET", "")
    return hmac.new(secreto.encode(), f"baja:{email}".encode(), "sha256").hexdigest()[:24]


def token_pixel(email, paso):
    secreto = os.environ.get("TOKEN_SECRET", "")
    return hmac.new(secreto.encode(), f"px:{email}:{paso}".encode(), "sha256").hexdigest()[:24]


def token_clic(email, paso):
    secreto = os.environ.get("TOKEN_SECRET", "")
    return hmac.new(secreto.encode(), f"clic:{email}:{paso}".encode(), "sha256").hexdigest()[:24]


def _trackear_links(cuerpo, base_url, ws, email, paso):
    """Reescribe cada link del cuerpo para pasar por /nurturing/r (cuenta el
    clic y redirige). El token HMAC evita que el endpoint sea un open redirect:
    solo redirige URLs que salieron en un correo nuestro."""
    tok = token_clic(email, paso)

    def _r(m):
        return f'href="{base_url}/nurturing/r?ws={ws}&t={tok}&u={quote(m.group(1), safe="")}"'

    return re.sub(r'href="(https?://[^"]+)"', _r, cuerpo), tok


def prompt_secuencia(config, n_correos):
    persona = config.get("persona") or "profesional que gana bien pero no invierte"
    oferta = config.get("oferta") or (
        "el libro-metodo Ciclo de Riqueza Inmobiliaria a 44 USD con la "
        "Calculadora de Viabilidad Pro incluida"
    )
    return (
        f"Escribe una secuencia de nurturing de {n_correos} correos en espanol "
        f"neutro para: {persona}. Oferta: {oferta}. Fases: los primeros correos "
        "dan la bienvenida y despiertan el problema (conciencia Schwartz 1-2), "
        "los del medio convencen con el metodo (sin prometer retornos), los "
        "ultimos invitan a la compra con la garantia de 7 dias. Devuelve SOLO "
        "un array JSON, cada item: {\"asunto\": str, \"cuerpo\": str (HTML "
        "simple con <p>), \"fase\": \"bienvenida\"|\"convencer\"|\"ventas\"}."
    )


def inscribir_elegibles(data, ws, ahora=None):
    """Auto-inscribe leads elegibles segun la config. Devuelve cuantos entraron."""
    ahora = ahora or int(time.time())
    nur = _slice(data, ws)
    cfg = nur.get("config") or {}
    if not cfg.get("autoInscribir"):
        return 0
    etapas_eleg = set(cfg.get("etapasElegibles") or [])
    if not etapas_eleg:
        stages = (data.get(ws, {}).get("config") or {}).get("stages") or []
        etapas_eleg = set(stages[:2])  # por defecto: las dos primeras etapas
    tipos_eleg = set(cfg.get("tiposElegibles") or [])  # ej. solo leads de la guia
    inscritos = {i["email"] for i in nur["inscritos"]}
    bajas = set(nur.get("bajas") or [])
    nuevos = 0
    for lead in data.get(ws, {}).get("leads", []):
        email = str(lead.get("email", "")).lower()
        if (not email or email in inscritos or email in bajas
                or lead.get("etapa") not in etapas_eleg or lead.get("respondio")
                or (tipos_eleg and lead.get("type") not in tipos_eleg)):
            continue
        nur["inscritos"].append({
            "email": email, "paso": 0, "ultimoEnvio": 0,
            "inscrito": ahora, "estado": "activo",
        })
        inscritos.add(email)
        nuevos += 1
    return nuevos


def procesar(data, ws, enviar_fn, base_url="", ahora=None):
    """Corre un ciclo del cron: inscribe, saca a quien ya no aplica y envia lo
    que toca respetando cadencia y tope diario. enviar_fn(email, asunto, html).
    """
    ahora = ahora or int(time.time())
    nur = _slice(data, ws)
    cfg = nur.get("config") or {}
    resumen = {"inscritosNuevos": 0, "enviados": 0, "salidos": 0, "errores": 0}

    resumen["inscritosNuevos"] = inscribir_elegibles(data, ws, ahora)

    leads_por_email = {
        str(l.get("email", "")).lower(): l for l in data.get(ws, {}).get("leads", [])
    }
    bajas = set(nur.get("bajas") or [])

    # salidas: comprar / volverse cliente / responder / baja
    for inscrito in nur["inscritos"]:
        if inscrito.get("estado") != "activo":
            continue
        lead = leads_por_email.get(inscrito["email"])
        if (inscrito["email"] in bajas
                or (lead and lead.get("etapa") in ETAPAS_SALIDA)
                or (lead and lead.get("respondio"))):
            inscrito["estado"] = "salido"
            resumen["salidos"] += 1

    if not nur.get("activo") or not nur.get("secuencia"):
        return resumen

    cadencia = int(cfg.get("cadenciaDias") or 3)
    tope = int(cfg.get("topeDiario") or 30)
    remitente = cfg.get("remitente") or None
    secuencia = nur["secuencia"]

    for inscrito in nur["inscritos"]:
        if resumen["enviados"] >= tope:
            break
        if inscrito.get("estado") != "activo":
            continue
        paso = int(inscrito.get("paso") or 0)
        if paso >= len(secuencia):
            inscrito["estado"] = "completado"
            continue
        # el primer correo sale de inmediato; los demas por cadencia
        if paso > 0 and ahora - int(inscrito.get("ultimoEnvio") or 0) < cadencia * DIA:
            continue
        correo = secuencia[paso]
        email = inscrito["email"]
        cuerpo, tok_clic = _trackear_links(
            correo.get("cuerpo") or "", base_url, ws, email, paso
        )
        # pixel unico POR ENVIO: si el mismo paso se reenvia, cada envio
        # tiene su token y su apertura propia (no un token por paso)
        import rastreo
        tok_px = rastreo.token_envio()
        pie = (
            f'<p style="font-size:12px;color:#888">Contenido educativo. No es '
            f'asesoria financiera, legal ni tributaria.<br>'
            f'<a href="{base_url}/nurturing/baja?ws={ws}&e={email}&t={token_baja(email)}">'
            f'Darse de baja</a></p>'
            f'<img src="{base_url}/nurturing/px/{tok_px}.gif" '
            f'width="1" height="1" alt="">'
        )
        try:
            enviar_fn(email, correo.get("asunto", ""), cuerpo + pie, remitente)
            inscrito["paso"] = paso + 1
            inscrito["ultimoEnvio"] = ahora
            inscrito.setdefault("pixeles", []).append(tok_px)
            inscrito.setdefault("clicTokens", []).append(tok_clic)
            nur["metricas"]["enviados"] = int(nur["metricas"].get("enviados") or 0) + 1
            resumen["enviados"] += 1
        except Exception:  # noqa: BLE001
            resumen["errores"] += 1
    return resumen


def marcar_clic(data, ws, tid):
    """Valida el token de clic y suma la metrica (una vez por token). Devuelve
    True si el token pertenece a un inscrito: solo entonces se puede redirigir."""
    nur = _slice(data, ws)
    for inscrito in nur["inscritos"]:
        if tid in (inscrito.get("clicTokens") or []):
            if tid not in (inscrito.get("clicados") or []):
                inscrito.setdefault("clicados", []).append(tid)
                nur["metricas"]["clics"] = int(nur["metricas"].get("clics") or 0) + 1
            return True
    return False


def marcar_rebote(data, ws, email):
    """Un DSN llego para este correo: el inscrito sale de la secuencia (estado
    'rebote') y la metrica queda registrada. Devuelve True si estaba inscrito."""
    nur = _slice(data, ws)
    email = (email or "").lower()
    for inscrito in nur["inscritos"]:
        if inscrito.get("email", "").lower() == email and inscrito.get("estado") == "activo":
            inscrito["estado"] = "rebote"
            nur["metricas"]["rebotes"] = int(nur["metricas"].get("rebotes") or 0) + 1
            return True
    return False


def marcar_respuesta(data, ws, email):
    """El inscrito respondio de verdad: su secuencia se detiene AL INSTANTE
    (estado 'salido', la misma convencion que usa procesar()) y cuenta en
    metricas. Devuelve True si estaba activo."""
    nur = _slice(data, ws)
    email = (email or "").lower()
    for inscrito in nur["inscritos"]:
        if inscrito.get("email", "").lower() == email and inscrito.get("estado") == "activo":
            inscrito["estado"] = "salido"
            nur["metricas"]["respuestas"] = int(nur["metricas"].get("respuestas") or 0) + 1
            return True
    return False


def marcar_apertura(data, ws, tid):
    nur = _slice(data, ws)
    for inscrito in nur["inscritos"]:
        if tid in (inscrito.get("pixeles") or []) and tid not in (inscrito.get("abiertos") or []):
            inscrito.setdefault("abiertos", []).append(tid)
            nur["metricas"]["aperturas"] = int(nur["metricas"].get("aperturas") or 0) + 1
            return True
    return False


def baja_directa(data, email, accion="unsubscribe"):
    """Baja (o re-alta) sin token HMAC, para canales autenticados (n8n con
    CRON_KEY desde la pagina /unsubscribe). Aplica a TODOS los workspaces."""
    email = str(email).strip().lower()
    if not email or "@" not in email:
        return False
    for ws in ("atlantis", "cicloderiqueza"):
        nur = _slice(data, ws)
        if accion == "resubscribe":
            nur["bajas"] = [b for b in nur["bajas"] if b != email]
            for inscrito in nur["inscritos"]:
                if inscrito["email"] == email and inscrito.get("estado") == "salido":
                    inscrito["estado"] = "activo"
        else:
            if email not in nur["bajas"]:
                nur["bajas"].append(email)
            for inscrito in nur["inscritos"]:
                if inscrito["email"] == email:
                    inscrito["estado"] = "salido"
    return True


def dar_baja(data, ws, email, token):
    if not hmac.compare_digest(token, token_baja(email)):
        return False
    nur = _slice(data, ws)
    email = str(email).lower()
    if email not in nur["bajas"]:
        nur["bajas"].append(email)
    for inscrito in nur["inscritos"]:
        if inscrito["email"] == email:
            inscrito["estado"] = "salido"
    return True
