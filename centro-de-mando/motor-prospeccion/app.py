"""Motor del Centro de Mando - Atlantis Global Realty.

FastAPI. Principios innegociables (skill centro-de-comando):
- Un solo JSON (/data/crm.json); toda escritura pasa por guardar_seguro()
  (merge fill-missing + lapidas). Nunca crm_store.guardar() directo.
- Auth fail-closed: sin clave configurada -> 503; Bearer con compare_digest;
  CRON_KEY estable para n8n; la clave nunca viaja por query.
- Secretos solo en el vault (allowlist); la API devuelve mascaras, jamas valores.
- _claude_json: thinking deshabilitado, piso 4000 tokens, reintentos, sin em dashes.
"""
import hmac
import json
import os
import re
import secrets as stdlib_secrets
import time
import uuid

from fastapi import Body, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware

import httpx
from fastapi.responses import HTMLResponse, Response

import buzones
import collectors
import crm_store
import nurturing
import publicar as pub
import secretos
import web_pub

DATA_DIR = os.environ.get("DATA_DIR", "/data")
CLAVE_PATH = os.path.join(DATA_DIR, "clave.txt")

WORKSPACES = ("atlantis", "cicloderiqueza")

# Listas con lapida: clave de la lista -> campo identificador del item
_LISTAS_CON_LAPIDA = {"competidores": "url", "enlacesUTM": "id", "leads": "id"}

app = FastAPI(title="Centro de Mando - Atlantis")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------- auth

def clave_actual():
    if os.path.exists(CLAVE_PATH):
        with open(CLAVE_PATH, encoding="utf-8") as f:
            return f.read().strip()
    return os.environ.get("CRM_PASSWORD", "").strip()


def _auth(authorization):
    clave = clave_actual()
    if not clave:
        # fail-closed: sin clave el motor no abre, nunca pasa por accidente
        raise HTTPException(503, "motor sin clave configurada")
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "no autorizado")
    token = authorization[7:].strip()
    cron = os.environ.get("CRON_KEY", "").strip()
    ok = hmac.compare_digest(token, clave) or (
        bool(cron) and hmac.compare_digest(token, cron)
    )
    if not ok:
        raise HTTPException(401, "no autorizado")


# ------------------------------------------------- merge seguro (anti-perdida)

def _merge_ws(entrante, disco):
    """Merge del slice de un workspace. Fill-missing + lapidas."""
    # fill-missing: claves en disco que el payload no trae se preservan
    for k, v in disco.items():
        if k not in entrante:
            entrante[k] = v

    # lapidas: union pegajosa de borrados; solo 'revivir' las levanta
    borr_disco = disco.get("borrados") or {}
    borr_entra = entrante.get("borrados") or {}
    revivir = entrante.pop("revivir", None) or {}
    union = {}
    for cat in set(borr_disco) | set(borr_entra):
        vistos = list(dict.fromkeys(
            (borr_disco.get(cat) or []) + (borr_entra.get(cat) or [])
        ))
        levantar = set(revivir.get(cat) or [])
        union[cat] = [x for x in vistos if x not in levantar][:300]
    entrante["borrados"] = union

    # aplicar lapidas: un item borrado no resucita aunque venga en el payload
    for lista, campo in _LISTAS_CON_LAPIDA.items():
        muertos = set(union.get(lista) or [])
        if muertos and isinstance(entrante.get(lista), list):
            entrante[lista] = [
                item for item in entrante[lista]
                if not (isinstance(item, dict) and item.get(campo) in muertos)
            ]
    return entrante


def _merge_con_servidor(entrante):
    disco = crm_store.leer() or {}
    try:
        for k, v in disco.items():
            if k not in entrante:
                entrante[k] = v
        for ws in WORKSPACES:
            de, dd = entrante.get(ws), disco.get(ws)
            if isinstance(de, dict) and isinstance(dd, dict):
                entrante[ws] = _merge_ws(de, dd)
    except Exception:
        # si el merge falla, guardar igual (comportamiento previo documentado)
        pass
    return entrante


def guardar_seguro(data):
    """Unica puerta de escritura al store. Merge contra disco al momento de guardar."""
    merged = _merge_con_servidor(data)
    crm_store.guardar(merged)
    return merged


# ---------------------------------------------------------------- helpers IA

_EM_DASH = re.compile(r"\s*—\s*")


def _sin_em_dash(texto):
    return _EM_DASH.sub(", ", texto or "")


def _claude_json(prompt, max_tokens=4000, model=None, reintentos=2, system=None):
    """Extrae el primer JSON de la respuesta de Claude.

    thinking deshabilitado + piso de 4000 tokens: con thinking activo el modelo
    puede gastar todo el presupuesto pensando y devolver vacio (autocorreccion).
    """
    import anthropic

    cliente = anthropic.Anthropic()
    model = model or os.environ.get("CLAUDE_MODEL", "claude-sonnet-5")
    max_tokens = max(4000, int(max_tokens))
    ultimo_error = None
    for _ in range(max(1, reintentos + 1)):
        try:
            kwargs = {
                "model": model,
                "max_tokens": max_tokens,
                "thinking": {"type": "disabled"},
                "messages": [{"role": "user", "content": prompt}],
            }
            if system:
                kwargs["system"] = system
            respuesta = cliente.messages.create(**kwargs)
            texto = "".join(
                b.text for b in respuesta.content if getattr(b, "type", "") == "text"
            )
            m = re.search(r"\[.*\]|\{.*\}", texto, re.DOTALL)
            if m:
                return json.loads(m.group(0), strict=False)
            ultimo_error = "sin_json"
        except Exception as e:  # noqa: BLE001
            ultimo_error = str(e)
        time.sleep(1)
    raise HTTPException(502, f"claude sin JSON valido: {ultimo_error}")


# Voz de marca (CLAUDE.md §4): se inyecta como system prompt en TODA generacion
_VOZ_MARCA = (
    "Eres el generador de contenido del Centro de Mando de Atlantis Global "
    "Realty ('arquitectos de patrimonio') y su producto Ciclo de Riqueza "
    "Inmobiliaria (libro-metodo a 44 USD). Reglas innegociables: tuteo neutro "
    "latinoamericano (sin voseo ni espanolismos), frases cortas, tono de banca "
    "privada sobria, anti-guru (nada de 'transforma tu vida', 'premium', "
    "'manifiesta'). Ningun nombre propio de persona; firma institucional. El "
    "precio se escribe siempre '44 USD', nunca '$44' ni '44€'. Nunca prometas "
    "retornos; los rendimientos proyectados son del constructor. Cero "
    "estadisticas inventadas y cero testimonios ficticios. Los riesgos del "
    "metodo (cambiario, due diligence, legal) se nombran, no se esconden. En "
    "piezas con cifras del metodo incluye: 'Contenido educativo. No es "
    "asesoria financiera, legal ni tributaria.' Publico: profesionales de 25 a "
    "52 que ganan bien pero no invierten (conciencia Schwartz 1-2: despierta "
    "el problema, no asumas que ya quieren invertir). No uses em dashes."
)


# ------------------------------------------------------- Meta Conversions API

def _capi_config():
    return secretos.get("FB_CAPI_TOKEN"), secretos.get("FB_PIXEL_ID")


def _capi_enviar(evento, email=None, telefono=None, valor=None, moneda="USD",
                 event_id=None, test_code=None):
    """Envia un evento server-side a Meta. BEST-EFFORT: jamas rompe el flujo
    que lo dispara. PII siempre hasheada con SHA-256."""
    import hashlib
    token, pixel = _capi_config()
    if not token or not pixel:
        return {"enviado": False, "motivo": "sin_config"}
    user_data = {}
    if email:
        user_data["em"] = [hashlib.sha256(email.strip().lower().encode()).hexdigest()]
    if telefono:
        tel = re.sub(r"\D", "", telefono)
        user_data["ph"] = [hashlib.sha256(tel.encode()).hexdigest()]
    cuerpo = {
        "data": [{
            "event_name": evento,
            "event_time": int(time.time()),
            "action_source": "website",
            "event_id": event_id or f"{evento.lower()}-{uuid.uuid4().hex[:8]}",
            "user_data": user_data,
            **({"custom_data": {"value": valor, "currency": moneda}} if valor else {}),
        }],
        "access_token": token,
    }
    if test_code:
        cuerpo["test_event_code"] = test_code
    try:
        r = httpx.post(
            f"https://graph.facebook.com/v21.0/{pixel}/events",
            json=cuerpo, timeout=10,
        )
        return {"enviado": r.status_code == 200, "respuesta": r.json()}
    except Exception as e:  # noqa: BLE001
        return {"enviado": False, "motivo": str(e)[:200]}


@app.get("/capi/estado")
def capi_estado(authorization: str = Header(None)):
    _auth(authorization)
    token, pixel = _capi_config()
    return {
        "token": {"valido": bool(token), "mascara": secretos.mascara(token)},
        "pixel": {"valido": bool(pixel), "mascara": secretos.mascara(pixel)},
    }


@app.post("/capi/test")
def capi_test(authorization: str = Header(None)):
    _auth(authorization)
    return _capi_enviar(
        "Lead", email="test@atlantisglobalrealty.com",
        test_code=secretos.get("FB_CAPI_TEST"),
    )


@app.post("/capi/evento")
def capi_evento(body: dict = Body(...), authorization: str = Header(None)):
    _auth(authorization)
    return _capi_enviar(
        str(body.get("event", "Lead")),
        email=body.get("email"),
        telefono=body.get("telefono"),
        valor=body.get("valor"),
        moneda=body.get("moneda", "USD"),
        event_id=body.get("event_id"),
    )


# ---------------------------------------------------------------- endpoints

@app.get("/")
def salud():
    return {"ok": True, "servicio": "centro-de-mando-atlantis"}


@app.post("/crm/login")
def login(body: dict = Body(...)):
    clave = clave_actual()
    if not clave:
        raise HTTPException(503, "motor sin clave configurada")
    if not hmac.compare_digest(str(body.get("clave", "")), clave):
        raise HTTPException(401, "clave incorrecta")
    return {"ok": True}


@app.get("/crm/data")
def crm_data_get(authorization: str = Header(None)):
    _auth(authorization)
    return {"data": crm_store.leer()}


@app.put("/crm/data")
def crm_data_put(body: dict = Body(...), authorization: str = Header(None)):
    _auth(authorization)
    data = body.get("data")
    if not isinstance(data, dict):
        raise HTTPException(400, "falta data")
    guardar_seguro(data)
    return {"ok": True}


@app.post("/crm/lead")
def crm_lead(body: dict = Body(...)):
    """Publico (formularios/n8n). Upsert por email en el workspace indicado.

    Convencion de atribucion (autocorreccion #12): 'type'/'source' = formulario
    (valor fijo, ej. 'diagnostico'); 'fuente' = canal real = utm_source, default
    'directo'. No se mezclan.
    """
    email = str(body.get("email", "")).strip().lower()
    if not email or "@" not in email:
        raise HTTPException(400, "email requerido")
    ws = body.get("workspace") if body.get("workspace") in WORKSPACES else "atlantis"

    data = crm_store.leer() or {"workspace": "atlantis"}
    slice_ws = data.setdefault(ws, {})
    leads = slice_ws.setdefault("leads", [])

    existente = next(
        (l for l in leads if str(l.get("email", "")).lower() == email), None
    )
    campos = {
        "nombre": body.get("nombre") or (existente or {}).get("nombre") or "",
        "telefono": body.get("telefono") or (existente or {}).get("telefono") or "",
        "idioma": body.get("idioma") or (existente or {}).get("idioma") or "es",
        "type": body.get("type") or body.get("source") or (existente or {}).get("type") or "",
        "fuente": body.get("fuente") or body.get("utm_source") or (existente or {}).get("fuente") or "directo",
        "leadSource": body.get("leadSource") or (existente or {}).get("leadSource") or "",
        "nota": body.get("nota") or (existente or {}).get("nota") or "",
    }
    if existente:
        existente.update(campos)
        lead_id, creado = existente["id"], False
    else:
        lead_id = f"lead-{uuid.uuid4().hex[:10]}"
        config = slice_ws.get("config") or {}
        etapas = config.get("stages") or ["Nuevo"]
        leads.append({
            "id": lead_id,
            "email": email,
            "etapa": etapas[0],
            "creado": int(time.time()),
            **campos,
        })
        creado = True
    guardar_seguro(data)
    if creado:
        # evento CAPI solo al CREAR (no en updates, para no duplicar); best-effort
        _capi_enviar("Lead", email=email, telefono=campos.get("telefono"),
                     event_id=f"lead-{lead_id}")
    return {"ok": True, "id": lead_id, "creado": creado}


# ------------------------------------------------------- prospeccion (F4)

@app.post("/prospectar")
def prospectar(body: dict = Body(...), authorization: str = Header(None)):
    """Descubre canales de YouTube de una vertical y los guarda como
    prospectos con Ambassador Fit Score. lead_source='Prospección YouTube'."""
    _auth(authorization)
    consulta = str(body.get("consulta", "")).strip()
    if not consulta:
        raise HTTPException(400, "consulta requerida")
    vertical = body.get("vertical") or ""
    ws = body.get("workspace") if body.get("workspace") in WORKSPACES else "cicloderiqueza"
    api_key = secretos.get("YOUTUBE_API_KEY") or os.environ.get("YOUTUBE_API_KEY", "")
    if not api_key:
        raise HTTPException(400, "configura YOUTUBE_API_KEY en Accesos")
    try:
        canales = collectors.youtube_buscar_canales(
            api_key, consulta,
            max_resultados=int(body.get("max") or 12),
            idioma=body.get("idioma") or "es",
        )
    except Exception as e:  # noqa: BLE001
        raise HTTPException(502, f"YouTube no respondio: {str(e)[:200]}")

    data = crm_store.leer() or {"workspace": "atlantis"}
    slice_ws = data.setdefault(ws, {})
    prospectos = slice_ws.setdefault("prospectos", [])
    descartados = set(slice_ws.get("descartados") or [])
    existentes = {p.get("canalId") for p in prospectos if p.get("canalId")}

    nuevos = 0
    for canal in canales:
        if canal["canalId"] in existentes or canal["canalId"] in descartados:
            continue
        prospectos.append({
            "id": f"pros-{uuid.uuid4().hex[:10]}",
            **canal,
            "vertical": vertical,
            "score": collectors.ambassador_fit_score(canal, vertical),
            "lead_source": "Prospección YouTube",
            "estado": "nuevo",
            "creado": int(time.time()),
        })
        nuevos += 1
    prospectos.sort(key=lambda p: -(p.get("score") or 0))
    guardar_seguro(data)
    return {"ok": True, "nuevos": nuevos, "total": len(prospectos)}


@app.post("/prospectos/capturar")
def prospectos_capturar(body: dict = Body(...), authorization: str = Header(None)):
    """Alta manual de un prospecto (cualquier fuente)."""
    _auth(authorization)
    ws = body.get("workspace") if body.get("workspace") in WORKSPACES else "atlantis"
    nombre = str(body.get("nombre", "")).strip()
    if not nombre and not body.get("email"):
        raise HTTPException(400, "nombre o email requerido")
    data = crm_store.leer() or {"workspace": "atlantis"}
    prospectos = data.setdefault(ws, {}).setdefault("prospectos", [])
    prospectos.append({
        "id": f"pros-{uuid.uuid4().hex[:10]}",
        "nombre": nombre,
        "email": str(body.get("email", "")).strip().lower(),
        "canal": body.get("canal") or "",
        "url": body.get("url") or "",
        "vertical": body.get("vertical") or "",
        "score": body.get("score"),
        "lead_source": body.get("lead_source") or "Prospección",
        "estado": "nuevo",
        "creado": int(time.time()),
    })
    guardar_seguro(data)
    return {"ok": True, "id": prospectos[-1]["id"]}


@app.post("/prospectos/promover")
def prospectos_promover(body: dict = Body(...), authorization: str = Header(None)):
    """Prospecto -> lead (conserva lead_source). El estado del prospecto
    queda 'promovido' para no re-promover."""
    _auth(authorization)
    ws = body.get("workspace") if body.get("workspace") in WORKSPACES else "atlantis"
    pid = str(body.get("id", ""))
    data = crm_store.leer() or {}
    slice_ws = data.get(ws) or {}
    prospecto = next((p for p in slice_ws.get("prospectos", []) if p.get("id") == pid), None)
    if not prospecto:
        raise HTTPException(404, "prospecto no encontrado")
    if prospecto.get("estado") == "promovido":
        return {"ok": True, "duplicado": True}
    leads = slice_ws.setdefault("leads", [])
    config = slice_ws.get("config") or {}
    lead_id = f"lead-{uuid.uuid4().hex[:10]}"
    leads.append({
        "id": lead_id,
        "nombre": prospecto.get("nombre") or prospecto.get("titulo") or prospecto.get("canal") or "",
        "email": prospecto.get("email") or "",
        "web": prospecto.get("url") or "",
        "etapa": (config.get("stages") or ["Nuevo"])[0],
        "fuente": "directo",
        "leadSource": prospecto.get("lead_source") or "Prospección",
        "creado": int(time.time()),
    })
    prospecto["estado"] = "promovido"
    guardar_seguro(data)
    return {"ok": True, "leadId": lead_id}


@app.post("/prospectos/descartar")
def prospectos_descartar(body: dict = Body(...), authorization: str = Header(None)):
    """Descarta y agrega a la blocklist (no vuelve a entrar por /prospectar)."""
    _auth(authorization)
    ws = body.get("workspace") if body.get("workspace") in WORKSPACES else "atlantis"
    pid = str(body.get("id", ""))
    data = crm_store.leer() or {}
    slice_ws = data.get(ws) or {}
    prospectos = slice_ws.get("prospectos", [])
    prospecto = next((p for p in prospectos if p.get("id") == pid), None)
    if not prospecto:
        raise HTTPException(404, "prospecto no encontrado")
    bloqueo = prospecto.get("canalId") or prospecto.get("email") or prospecto.get("url")
    if bloqueo:
        descartados = slice_ws.setdefault("descartados", [])
        if bloqueo not in descartados:
            descartados.append(bloqueo)
    slice_ws["prospectos"] = [p for p in prospectos if p.get("id") != pid]
    guardar_seguro(data)
    return {"ok": True}


# ------------------------------------------------------- contenido IA (F5)

@app.post("/viral/ideas")
def viral_ideas(body: dict = Body(...), authorization: str = Header(None)):
    """Lote de ideas de video corto sobre los dolores del avatar
    (Schwartz 1-2: despertar el problema). Requiere ANTHROPIC_API_KEY."""
    _auth(authorization)
    tema = body.get("tema") or "construir patrimonio sin depender del sueldo"
    idioma = body.get("idioma") or "es"
    n = min(20, int(body.get("n") or 10))
    prompt = (
        f"Genera {n} ideas de video corto (Reels/TikTok/Shorts) en "
        f"{'espanol neutro' if idioma == 'es' else 'ingles'} sobre: {tema}. "
        "El publico NO es consciente del problema (Schwartz 1-2): cada idea "
        "debe DESPERTAR el problema, no vender inversion directamente. Dolores "
        "del avatar: 'todo depende de que yo siga produciendo', 'junto dinero "
        "sin saber que hacer con el', 'creo que invertir en inmuebles es solo "
        "para quien ya tiene mucho capital'. Devuelve SOLO un array JSON, cada "
        "item: {\"gancho\": str (primeras 3 seg), \"desarrollo\": str, "
        "\"cta\": str, \"nivel_conciencia\": 1|2, \"formato\": str, "
        "\"puntaje\": 1-10}."
    )
    ideas = _claude_json(prompt, max_tokens=6000, system=_VOZ_MARCA)
    if isinstance(ideas, list):
        for idea in ideas:
            for campo in ("gancho", "desarrollo", "cta"):
                if isinstance(idea.get(campo), str):
                    idea[campo] = _sin_em_dash(idea[campo])
    return {"ok": True, "ideas": ideas}


@app.post("/generar_contenido")
def generar_contenido(body: dict = Body(...), authorization: str = Header(None)):
    """Post/correo/anuncio en la voz de marca. Requiere ANTHROPIC_API_KEY."""
    _auth(authorization)
    tipo = body.get("tipo") or "post"
    tema = body.get("tema") or ""
    idioma = body.get("idioma") or "es"
    if not tema:
        raise HTTPException(400, "tema requerido")
    prompt = (
        f"Escribe un {tipo} en {'espanol neutro latinoamericano' if idioma == 'es' else 'ingles'} "
        f"sobre: {tema}. Devuelve SOLO JSON: {{\"titulo\": str, \"texto\": str, "
        "\"cta\": str}}. Si mencionas el precio del producto es '44 USD'. "
        "Si usas cifras del metodo, cierra con el disclaimer educativo."
    )
    pieza = _claude_json(prompt, max_tokens=4000, system=_VOZ_MARCA)
    if isinstance(pieza, dict):
        for campo in ("titulo", "texto", "cta"):
            if isinstance(pieza.get(campo), str):
                pieza[campo] = _sin_em_dash(pieza[campo])
    return {"ok": True, "pieza": pieza}


# ------------------------------------------- maquetador / web publica (F5)

@app.get("/web/estado")
def web_estado(authorization: str = Header(None)):
    """Maquetador: inventario de archivos canonicos + estado del FTP."""
    _auth(authorization)
    return web_pub.estado()


@app.get("/web/leer")
def web_leer(ruta: str = "", authorization: str = Header(None)):
    _auth(authorization)
    return web_pub.leer(ruta)


@app.post("/web/escribir")
def web_escribir(body: dict = Body(...), authorization: str = Header(None)):
    """Escribe archivos canonicos (con respaldo previo) y opcionalmente publica."""
    _auth(authorization)
    archivos = body.get("archivos") or []
    if not archivos:
        return {"ok": False, "error": "sin archivos"}
    try:
        return web_pub.escribir(archivos, publicar_ftp=bool(body.get("publicar", True)))
    except Exception as e:  # noqa: BLE001
        return {"ok": False, "error": str(e)[:150]}


@app.post("/web/publicar")
def web_publicar(body: dict = Body(...), authorization: str = Header(None)):
    """Publica al hosting por FTP con respaldo previo (doble confirmacion en la UI)."""
    _auth(authorization)
    rutas = [r for r in (body.get("rutas") or []) if isinstance(r, str)]
    if not rutas:
        return {"ok": False, "error": "elige al menos un archivo"}
    try:
        return web_pub.publicar(rutas)
    except Exception as e:  # noqa: BLE001
        return {"ok": False, "error": str(e)[:120]}


@app.get("/web/diff")
def web_diff(ruta: str = "", authorization: str = Header(None)):
    """Que cambio vs lo publicado, en lenguaje humano."""
    _auth(authorization)
    return web_pub.diff_legible(ruta)


@app.get("/web/versiones")
def web_versiones(authorization: str = Header(None)):
    _auth(authorization)
    return web_pub.versiones()


@app.post("/web/restaurar")
def web_restaurar(body: dict = Body(...), authorization: str = Header(None)):
    _auth(authorization)
    try:
        return web_pub.restaurar(
            str(body.get("version") or "").strip(), str(body.get("ruta") or "").strip()
        )
    except Exception as e:  # noqa: BLE001
        return {"ok": False, "error": str(e)[:120]}


@app.post("/web/sembrar_publicado")
def web_sembrar(authorization: str = Header(None)):
    """Una vez: baja del hosting lo ya publicado como referencia de diff."""
    _auth(authorization)
    return web_pub.sembrar_publicado()


@app.post("/web/aplicar_soluciones")
def web_aplicar_soluciones(body: dict = Body(None), authorization: str = Header(None)):
    """Aplica soluciones SEO a la copia canonica con empalmes quirurgicos.
    dry_run=True devuelve el preview sin tocar nada."""
    _auth(authorization)
    body = body or {}
    soluciones = body.get("soluciones")
    if not soluciones:
        return {"ok": False, "error": "sin soluciones que aplicar"}
    return web_pub.aplicar_soluciones(soluciones, dry_run=bool(body.get("dry_run")))


@app.post("/web/mejorar_texto")
def web_mejorar_texto(body: dict = Body(...), authorization: str = Header(None)):
    """Asistente del maquetador: 2 versiones del texto en la voz de marca."""
    _auth(authorization)
    texto = str(body.get("texto", "")).strip()
    if not texto:
        return {"ok": False, "error": "sin_texto"}
    contexto = str(body.get("contexto", "")).strip()
    intencion = str(body.get("intencion", "") or "mejorar claridad y fuerza").strip()
    n_palabras = len(texto.split())
    d = _claude_json(
        "Eres el asistente de redaccion de la web de Atlantis Global Realty. "
        f"Reescribe el TEXTO de abajo para {intencion}. Es un elemento de la "
        f"pagina{f' ({contexto})' if contexto else ''}.\nREGLAS:\n"
        "- Manten el MISMO idioma del texto original.\n"
        f"- Largo similar (~{n_palabras} palabras); si es titular o boton, corto y directo.\n"
        "- NO inventes datos, cifras, nombres ni promesas.\n"
        f"\nTEXTO ORIGINAL:\n{texto}\n\n"
        'Devuelve SOLO JSON: {"opciones": ["version 1", "version 2"]}',
        max_tokens=4000, system=_VOZ_MARCA,
    )
    opciones = [
        _sin_em_dash(o) for o in (d.get("opciones") or [])
        if isinstance(o, str) and o.strip()
    ][:3]
    if not opciones:
        return {"ok": False, "error": "sin_opciones"}
    return {"ok": True, "opciones": opciones}


# ------------------------------------------------- publicacion en redes (F5)

@app.get("/redes/integraciones")
def redes_integraciones(authorization: str = Header(None)):
    _auth(authorization)
    return pub.integraciones()


@app.post("/publicar")
def publicar_red(body: dict = Body(...), authorization: str = Header(None)):
    """Postiz si hay clave (SIEMPRE type schedule +1min); nativo IG/FB si no."""
    _auth(authorization)
    return pub.publicar(body)


# ------------------------------------------------------- asistente (ejecuta)

def _mover_etapa_lead(slice_ws, lead, etapa):
    config = slice_ws.get("config") or {}
    if etapa not in (config.get("stages") or []):
        return False
    lead["etapa"] = etapa
    dias = (config.get("cadenciaDias") or {}).get(etapa)
    if dias:
        lead["followUpDate"] = time.strftime(
            "%Y-%m-%d", time.localtime(time.time() + int(dias) * 86400)
        )
    return True


def _buscar_lead(slice_ws, referencia):
    ref = str(referencia or "").strip().lower()
    if not ref:
        return None
    return next(
        (l for l in slice_ws.get("leads", [])
         if str(l.get("email", "")).lower() == ref
         or str(l.get("nombre", "")).lower() == ref),
        None,
    )


def _aplicar_accion(data, ws, accion):
    """Ejecuta UNA accion del asistente. Devuelve un resumen o None si no
    aplico. Solo tipos de la allowlist; todo pasa por el mismo estado."""
    slice_ws = data.setdefault(ws, {})
    tipo = accion.get("tipo")

    if tipo == "crear_lead":
        email = str(accion.get("email", "")).strip().lower()
        nombre = str(accion.get("nombre", "")).strip()
        if not email and not nombre:
            return None
        if email and any(
            str(l.get("email", "")).lower() == email for l in slice_ws.get("leads", [])
        ):
            return f"el lead {email} ya existia"
        config = slice_ws.get("config") or {}
        slice_ws.setdefault("leads", []).append({
            "id": f"lead-{uuid.uuid4().hex[:10]}",
            "nombre": nombre, "email": email,
            "etapa": (config.get("stages") or ["Nuevo"])[0],
            "fuente": "directo", "leadSource": "Asistente",
            "creado": int(time.time()),
        })
        return f"lead creado: {nombre or email}"

    if tipo == "mover_etapa":
        lead = _buscar_lead(slice_ws, accion.get("lead"))
        if lead and _mover_etapa_lead(slice_ws, lead, str(accion.get("etapa", ""))):
            return f"{lead.get('nombre') or lead.get('email')} -> {accion['etapa']}"
        return None

    if tipo == "agendar_consulta":
        lead = _buscar_lead(slice_ws, accion.get("lead"))
        fecha = str(accion.get("fecha", "")).strip()
        if not lead or not fecha:
            return None
        slice_ws.setdefault("consultas", []).append({
            "id": f"con-{uuid.uuid4().hex[:10]}",
            "leadId": lead["id"], "fecha": fecha, "estado": "agendada",
        })
        return f"consulta agendada con {lead.get('nombre') or lead.get('email')}"

    if tipo == "definir_meta":
        mes = str(accion.get("mes", "")).strip() or time.strftime("%Y-%m")
        try:
            valor = float(accion.get("valor"))
        except (TypeError, ValueError):
            return None
        slice_ws.setdefault("metas", {})[mes] = valor
        return f"meta de {mes}: {valor:g}"

    if tipo == "capturar_prospecto":
        nombre = str(accion.get("nombre", "")).strip()
        email = str(accion.get("email", "")).strip().lower()
        if not nombre and not email:
            return None
        slice_ws.setdefault("prospectos", []).append({
            "id": f"pros-{uuid.uuid4().hex[:10]}",
            "nombre": nombre, "email": email,
            "lead_source": "Asistente", "estado": "nuevo",
            "creado": int(time.time()),
        })
        return f"prospecto capturado: {nombre or email}"

    return None


@app.post("/asistente")
def asistente(body: dict = Body(...), authorization: str = Header(None)):
    """Chat que EJECUTA sobre el CRM. La IA propone acciones estructuradas y
    el motor las valida y aplica (allowlist, mismo guardar_seguro)."""
    _auth(authorization)
    mensaje = str(body.get("mensaje", "")).strip()
    if not mensaje:
        raise HTTPException(400, "mensaje requerido")
    ws = body.get("workspace") if body.get("workspace") in WORKSPACES else "atlantis"
    data = crm_store.leer() or {"workspace": "atlantis"}
    slice_ws = data.get(ws) or {}
    config = slice_ws.get("config") or {}
    hoy = time.strftime("%Y-%m-%d")
    vencidos = [
        l for l in slice_ws.get("leads", [])
        if l.get("followUpDate") and l["followUpDate"] < hoy
        and l.get("etapa") not in ("Descartado", "Baja")
    ]
    contexto = (
        f"Hoy es {hoy}. Workspace: {ws} ({config.get('nombre', '')}). "
        f"Leads: {len(slice_ws.get('leads', []))} "
        f"(etapas validas: {', '.join(config.get('stages') or [])}). "
        f"Prospectos: {len(slice_ws.get('prospectos', []))}. "
        f"Seguimientos vencidos: {len(vencidos)} "
        f"({', '.join(str(l.get('nombre') or l.get('email')) for l in vencidos[:5])}). "
        f"Leads recientes: "
        + "; ".join(
            f"{l.get('nombre') or ''} <{l.get('email') or ''}> etapa {l.get('etapa')}"
            for l in slice_ws.get("leads", [])[-10:]
        )
    )
    r = _claude_json(
        "Eres el asistente operativo del Centro de Mando. Contexto del CRM:\n"
        f"{contexto}\n\nPeticion de la usuaria: {mensaje}\n\n"
        "Devuelve SOLO JSON: {\"respuesta\": str (breve, en espanol neutro), "
        "\"acciones\": [ ... ]}. Acciones permitidas (usa solo las necesarias, "
        "maximo 5):\n"
        "- {\"tipo\": \"crear_lead\", \"nombre\": str, \"email\": str}\n"
        "- {\"tipo\": \"mover_etapa\", \"lead\": str (email o nombre), \"etapa\": str}\n"
        "- {\"tipo\": \"agendar_consulta\", \"lead\": str, \"fecha\": \"YYYY-MM-DDTHH:MM\"}\n"
        "- {\"tipo\": \"definir_meta\", \"mes\": \"YYYY-MM\", \"valor\": number}\n"
        "- {\"tipo\": \"capturar_prospecto\", \"nombre\": str, \"email\": str}\n"
        "Si la peticion es solo una pregunta, devuelve acciones: [].",
        max_tokens=4000,
    )
    respuesta = _sin_em_dash(str((r or {}).get("respuesta", "")))
    aplicadas = []
    for accion in ((r or {}).get("acciones") or [])[:5]:
        try:
            resultado = _aplicar_accion(data, ws, accion)
            if resultado:
                aplicadas.append(resultado)
        except Exception:  # noqa: BLE001
            continue
    if aplicadas:
        guardar_seguro(data)
    return {"ok": True, "respuesta": respuesta, "aplicadas": aplicadas}


# ------------------------------------------------------- buzones y correo

@app.get("/buzones")
def buzones_listar(authorization: str = Header(None)):
    _auth(authorization)
    return {"buzones": buzones.listar_mascarado()}


@app.post("/buzones")
def buzones_guardar(body: dict = Body(...), authorization: str = Header(None)):
    _auth(authorization)
    try:
        buzones.guardar(body)
    except ValueError as e:
        raise HTTPException(400, str(e))
    return {"ok": True}


@app.post("/buzones/probar")
def buzones_probar(body: dict = Body(None), authorization: str = Header(None)):
    _auth(authorization)
    try:
        buzones.probar((body or {}).get("email"))
        return {"ok": True}
    except Exception as e:  # noqa: BLE001
        return {"ok": False, "error": str(e)[:300]}


@app.post("/buzones/eliminar")
def buzones_eliminar(body: dict = Body(...), authorization: str = Header(None)):
    _auth(authorization)
    buzones.eliminar(body.get("email", ""))
    return {"ok": True}


@app.post("/enviar_correo")
def enviar_correo(body: dict = Body(...), authorization: str = Header(None)):
    """Envio manual. Registra el envio en <ws>.enviados."""
    _auth(authorization)
    para = str(body.get("para", "")).strip()
    asunto = str(body.get("asunto", "")).strip()
    if not para or not asunto:
        raise HTTPException(400, "para y asunto requeridos")
    ws = body.get("workspace") if body.get("workspace") in WORKSPACES else "atlantis"
    try:
        buzones.enviar(para, asunto, body.get("cuerpo") or "", body.get("desde"))
    except Exception as e:  # noqa: BLE001
        raise HTTPException(502, f"no se pudo enviar: {str(e)[:200]}")
    data = crm_store.leer() or {"workspace": "atlantis"}
    data.setdefault(ws, {}).setdefault("enviados", []).append({
        "para": para, "asunto": asunto, "fecha": int(time.time()),
    })
    guardar_seguro(data)
    return {"ok": True}


def _clasificar_respuesta(asunto, texto):
    """Clasifica una respuesta entrante. Best-effort: si la IA falla, queda
    'sin_clasificar' y el correo NO se pierde."""
    try:
        r = _claude_json(
            "Clasifica esta respuesta a un correo comercial. Devuelve SOLO "
            "JSON: {\"clasificacion\": \"interesado\"|\"pregunta\"|"
            "\"no_interesado\"|\"baja\"|\"otro\", \"resumen\": str (1 frase)}."
            f"\n\nAsunto: {asunto}\n\nTexto:\n{texto[:1500]}",
            max_tokens=4000,
        )
        if isinstance(r, dict) and r.get("clasificacion"):
            return r
    except Exception:  # noqa: BLE001
        pass
    return {"clasificacion": "sin_clasificar", "resumen": ""}


@app.post("/leer_correos")
def leer_correos(body: dict = Body(None), authorization: str = Header(None)):
    """Cron (15 min): lee cada buzon por UID ascendente, empata el remitente
    con leads/prospectos de ambos workspaces, clasifica con IA y guarda el
    hilo en outreach. El puntero ultimaUid avanza SIEMPRE, haya match o no."""
    _auth(authorization)
    resumen = {"leidos": 0, "conMatch": 0, "errores": 0}
    data = crm_store.leer() or {"workspace": "atlantis"}

    for b in buzones.listar_interno():
        try:
            correos = buzones.leer_bandeja(
                b["email"], desde_uid=int(b.get("ultimaUid") or 0)
            )
        except Exception:  # noqa: BLE001
            resumen["errores"] += 1
            continue
        for correo in correos:  # ya vienen en orden ascendente de UID
            buzones.set_ultima_uid(b["email"], correo["uid"])
            resumen["leidos"] += 1
            de = str(correo.get("de", "")).lower()
            if not de or de == b["email"]:
                continue
            for ws in WORKSPACES:
                slice_ws = data.setdefault(ws, {})
                lead = next(
                    (l for l in slice_ws.get("leads", [])
                     if str(l.get("email", "")).lower() == de), None
                )
                prospecto = next(
                    (p for p in slice_ws.get("prospectos", [])
                     if str(p.get("email", "")).lower() == de), None
                )
                if not lead and not prospecto:
                    continue
                resumen["conMatch"] += 1
                veredicto = _clasificar_respuesta(correo["asunto"], correo["texto"])
                outreach = slice_ws.setdefault("outreach", [])
                hilo = next((o for o in outreach if o.get("email") == de), None)
                if not hilo:
                    hilo = {"email": de, "conversacion": []}
                    outreach.append(hilo)
                hilo["conversacion"].append({
                    "de": de,
                    "asunto": correo["asunto"],
                    "texto": correo["texto"][:2000],
                    "fecha": correo.get("fecha") or "",
                    "recibido": int(time.time()),
                })
                hilo["clasificacion"] = veredicto["clasificacion"]
                hilo["resumen"] = _sin_em_dash(veredicto.get("resumen") or "")
                if lead:
                    lead["respondio"] = True  # lo saca del nurturing
                    if veredicto["clasificacion"] == "baja":
                        nur = slice_ws.get("nurturing") or {}
                        if de not in (nur.get("bajas") or []):
                            nur.setdefault("bajas", []).append(de)
                if prospecto:
                    prospecto["estado"] = "respondio"
    guardar_seguro(data)
    return {"ok": True, **resumen}


@app.post("/generar_mensaje")
def generar_mensaje(body: dict = Body(...), authorization: str = Header(None)):
    """Redacta una respuesta consciente de la conversacion, en voz de marca."""
    _auth(authorization)
    de = str(body.get("email", "")).strip().lower()
    if not de:
        raise HTTPException(400, "email requerido")
    ws = body.get("workspace") if body.get("workspace") in WORKSPACES else "atlantis"
    data = crm_store.leer() or {}
    hilo = next(
        (o for o in (data.get(ws) or {}).get("outreach", []) if o.get("email") == de),
        None,
    )
    historial = ""
    for m in (hilo or {}).get("conversacion", [])[-4:]:
        historial += f"\nDe {m.get('de')}: {m.get('texto', '')[:600]}\n"
    objetivo = body.get("objetivo") or "responder con valor y avanzar la conversacion"
    pieza = _claude_json(
        f"Redacta la respuesta a este hilo de correo. Objetivo: {objetivo}. "
        "Devuelve SOLO JSON: {\"asunto\": str, \"cuerpo\": str (texto plano, "
        "parrafos cortos)}. No inventes datos ni promesas."
        f"\n\nHistorial:{historial or ' (sin historial: primer contacto)'}",
        max_tokens=4000, system=_VOZ_MARCA,
    )
    if isinstance(pieza, dict):
        for campo in ("asunto", "cuerpo"):
            if isinstance(pieza.get(campo), str):
                pieza[campo] = _sin_em_dash(pieza[campo])
    return {"ok": True, "mensaje": pieza}


# ------------------------------------------------------- nurturing (F4)

@app.post("/nurturing/generar")
def nurturing_generar(body: dict = Body(...), authorization: str = Header(None)):
    """Genera la secuencia con IA desde la config. Queda en BORRADOR: nada se
    envia hasta revisar y activar."""
    _auth(authorization)
    ws = body.get("workspace") if body.get("workspace") in WORKSPACES else "cicloderiqueza"
    data = crm_store.leer() or {"workspace": "atlantis"}
    nur = nurturing._slice(data, ws)
    cfg = {**(nur.get("config") or {}), **(body.get("config") or {})}
    nur["config"] = cfg
    n = min(9, int(cfg.get("nCorreos") or 5))
    secuencia = _claude_json(
        nurturing.prompt_secuencia(cfg, n), max_tokens=7000, system=_VOZ_MARCA
    )
    if not isinstance(secuencia, list) or not secuencia:
        raise HTTPException(502, "la IA no devolvio una secuencia valida")
    for correo in secuencia:
        for campo in ("asunto", "cuerpo"):
            if isinstance(correo.get(campo), str):
                correo[campo] = _sin_em_dash(correo[campo])
    nur["secuencia"] = secuencia
    nur["activo"] = False
    guardar_seguro(data)
    return {"ok": True, "correos": len(secuencia)}


@app.post("/nurturing/activar")
def nurturing_activar(body: dict = Body(...), authorization: str = Header(None)):
    _auth(authorization)
    ws = body.get("workspace") if body.get("workspace") in WORKSPACES else "cicloderiqueza"
    data = crm_store.leer() or {}
    nur = nurturing._slice(data, ws)
    activo = bool(body.get("activo"))
    if activo and not nur.get("secuencia"):
        raise HTTPException(400, "genera y revisa la secuencia antes de activar")
    if activo and not (nur.get("config") or {}).get("remitente"):
        raise HTTPException(400, "define el remitente en la config del nurturing")
    nur["activo"] = activo
    guardar_seguro(data)
    return {"ok": True, "activo": activo}


@app.post("/nurturing/procesar")
def nurturing_procesar(body: dict = Body(None), authorization: str = Header(None)):
    """Cron diario (n8n con CRON_KEY): inscribe, saca y envia lo que toca."""
    _auth(authorization)
    ws = (body or {}).get("workspace")
    ws = ws if ws in WORKSPACES else "cicloderiqueza"
    base_url = os.environ.get("MOTOR_URL", "https://motor.atlantisglobalrealty.com")
    data = crm_store.leer() or {"workspace": "atlantis"}
    resumen = nurturing.procesar(
        data, ws,
        lambda para, asunto, html, desde=None: buzones.enviar(para, asunto, html, desde),
        base_url=base_url,
    )
    guardar_seguro(data)
    return {"ok": True, **resumen}


@app.get("/nurturing/px/{tid}.gif")
def nurturing_pixel(tid: str):
    """Pixel de apertura (publico)."""
    data = crm_store.leer()
    if data:
        cambio = False
        for ws in WORKSPACES:
            if nurturing.marcar_apertura(data, ws, tid):
                cambio = True
        if cambio:
            guardar_seguro(data)
    gif = (b"GIF89a\x01\x00\x01\x00\x80\x00\x00\x00\x00\x00\xff\xff\xff!"
           b"\xf9\x04\x01\x00\x00\x00\x00,\x00\x00\x00\x00\x01\x00\x01\x00"
           b"\x00\x02\x02D\x01\x00;")
    return Response(content=gif, media_type="image/gif")


@app.get("/nurturing/baja")
def nurturing_baja(ws: str = "", e: str = "", t: str = ""):
    """Baja con token HMAC (publico, un clic desde el correo)."""
    ws = ws if ws in WORKSPACES else "cicloderiqueza"
    data = crm_store.leer()
    if not data or not nurturing.dar_baja(data, ws, e, t):
        raise HTTPException(400, "enlace de baja invalido")
    guardar_seguro(data)
    return HTMLResponse(
        "<html><body style='font-family:sans-serif;background:#0A0A0C;"
        "color:#F4EFE6;display:flex;align-items:center;justify-content:center;"
        "height:100vh'><div style='text-align:center'><h2 style='color:#E6C788'>"
        "Listo</h2><p>No recibiras mas correos de esta serie.</p></div>"
        "</body></html>"
    )


# ------------------------------------------------------- push web (VAPID)

def _webpush_send(suscripcion, payload):
    """Envio real de una notificacion. Best-effort; los tests lo reemplazan."""
    from pywebpush import webpush
    webpush(
        subscription_info=suscripcion,
        data=json.dumps(payload),
        vapid_private_key=os.environ.get("VAPID_PRIVATE_KEY", ""),
        vapid_claims={"sub": "mailto:hello@atlantisglobalrealty.com"},
    )


def _push_a_todos(data, ws, payload):
    subs = (data.get(ws) or {}).get("pushSubs") or []
    enviados, errores = 0, 0
    for sub in subs:
        try:
            _webpush_send(sub, payload)
            enviados += 1
        except Exception:  # noqa: BLE001
            errores += 1
    return enviados, errores


@app.get("/push/clave_publica")
def push_clave_publica():
    return {"clave": os.environ.get("VAPID_PUBLIC_KEY", "")}


@app.post("/push/suscribir")
def push_suscribir(body: dict = Body(...), authorization: str = Header(None)):
    _auth(authorization)
    sub = body.get("suscripcion")
    if not isinstance(sub, dict) or not sub.get("endpoint"):
        raise HTTPException(400, "suscripcion invalida")
    ws = body.get("workspace") if body.get("workspace") in WORKSPACES else "atlantis"
    data = crm_store.leer() or {"workspace": "atlantis"}
    subs = data.setdefault(ws, {}).setdefault("pushSubs", [])
    if not any(s.get("endpoint") == sub["endpoint"] for s in subs):
        subs.append(sub)
    guardar_seguro(data)
    return {"ok": True, "total": len(subs)}


@app.post("/push/probar")
def push_probar(body: dict = Body(None), authorization: str = Header(None)):
    _auth(authorization)
    if not os.environ.get("VAPID_PRIVATE_KEY"):
        return {"ok": False, "motivo": "sin_config: define VAPID_PUBLIC_KEY/PRIVATE_KEY"}
    ws = (body or {}).get("workspace")
    ws = ws if ws in WORKSPACES else "atlantis"
    data = crm_store.leer() or {}
    enviados, errores = _push_a_todos(data, ws, {
        "title": "Centro de Mando", "body": "Notificaciones activas.", "url": "/",
    })
    return {"ok": True, "enviados": enviados, "errores": errores}


@app.post("/push/recordatorios")
def push_recordatorios(body: dict = Body(None), authorization: str = Header(None)):
    """Cron diario: seguimientos vencidos/de hoy + consultas de hoy."""
    _auth(authorization)
    data = crm_store.leer() or {}
    hoy = time.strftime("%Y-%m-%d")
    resumen = {}
    for ws in WORKSPACES:
        slice_ws = data.get(ws) or {}
        pendientes = [
            l for l in slice_ws.get("leads", [])
            if l.get("followUpDate") and l["followUpDate"] <= hoy
            and l.get("etapa") not in ("Descartado", "Baja", "Cliente", "Comprador")
        ]
        consultas_hoy = [
            c for c in slice_ws.get("consultas", [])
            if str(c.get("fecha", "")).startswith(hoy) and c.get("estado") == "agendada"
        ]
        if not pendientes and not consultas_hoy:
            resumen[ws] = {"enviados": 0, "pendientes": 0}
            continue
        partes = []
        if pendientes:
            partes.append(f"{len(pendientes)} seguimiento(s) pendiente(s)")
        if consultas_hoy:
            partes.append(f"{len(consultas_hoy)} consulta(s) hoy")
        enviados, errores = _push_a_todos(data, ws, {
            "title": "Centro de Mando · hoy",
            "body": " y ".join(partes) + ".",
            "url": "/#v=seguimiento",
        })
        resumen[ws] = {"enviados": enviados, "errores": errores,
                       "pendientes": len(pendientes), "consultas": len(consultas_hoy)}
    return {"ok": True, **resumen}


# ------------------------------------------- compras / app usuarios (F3)

def _hash_credencial(email, password):
    secreto = os.environ.get("TOKEN_SECRET", "")
    return hmac.new(
        secreto.encode(), f"{email}:{password}".encode(), "sha256"
    ).hexdigest()


@app.post("/compra/registrar")
def compra_registrar(body: dict = Body(...), authorization: str = Header(None)):
    """Alta de compra (la llama n8n con CRON_KEY al recibir el webhook de
    Hotmart/ClickBank/ThriveCart). Idempotente por transaccion.

    Efectos: upsert comprador, credencial de la Calculadora Pro (gating
    'gratis de por vida para los primeros N', N de config), lead a etapa
    Comprador. Devuelve la password SOLO si el app_usuario es nuevo, para que
    n8n arme el correo de bienvenida; el motor guarda unicamente el hash.
    """
    _auth(authorization)
    email = str(body.get("email", "")).strip().lower()
    if not email or "@" not in email:
        raise HTTPException(400, "email requerido")
    transaccion = str(body.get("transaccion", "")).strip()
    ws = "cicloderiqueza"

    data = crm_store.leer() or {"workspace": "atlantis"}
    slice_ws = data.setdefault(ws, {})
    compradores = slice_ws.setdefault("compradores", [])
    usuarios = slice_ws.setdefault("app_usuarios", [])
    config = slice_ws.get("config") or {}

    if transaccion and any(c.get("transaccion") == transaccion for c in compradores):
        return {"ok": True, "duplicada": True}

    comprador = next(
        (c for c in compradores if str(c.get("email", "")).lower() == email), None
    )
    if not comprador:
        comprador = {"id": f"compra-{uuid.uuid4().hex[:10]}", "email": email}
        compradores.append(comprador)
    comprador.update({
        "plataforma": body.get("plataforma") or comprador.get("plataforma") or "",
        "idioma": body.get("idioma") or comprador.get("idioma") or "es",
        "transaccion": transaccion or comprador.get("transaccion") or "",
        "nombre": body.get("nombre") or comprador.get("nombre") or "",
        "fecha": comprador.get("fecha") or time.strftime("%Y-%m-%d"),
        "accesoApp": True,
        "bonos": True,
        "reembolsado": False,
    })

    password = None
    usuario = next(
        (u for u in usuarios if str(u.get("email", "")).lower() == email), None
    )
    if not usuario:
        limite = int(config.get("appGratisPrimerosN") or 0)
        otorgados = sum(1 for u in usuarios if u.get("vitalicio") and not u.get("revocado"))
        password = stdlib_secrets.token_urlsafe(9)
        usuarios.append({
            "email": email,
            "hash": _hash_credencial(email, password),
            "vitalicio": otorgados < limite if limite else True,
            "revocado": False,
            "creado": time.strftime("%Y-%m-%d"),
        })
    elif usuario.get("revocado"):
        # recompra tras reembolso: reactivar con credencial nueva
        password = stdlib_secrets.token_urlsafe(9)
        usuario.update({
            "hash": _hash_credencial(email, password),
            "revocado": False,
        })
    usuario = next(u for u in usuarios if str(u.get("email", "")).lower() == email)

    # lead a etapa Comprador (upsert)
    leads = slice_ws.setdefault("leads", [])
    lead = next((l for l in leads if str(l.get("email", "")).lower() == email), None)
    if not lead:
        lead = {"id": f"lead-{uuid.uuid4().hex[:10]}", "email": email,
                "creado": int(time.time()), "fuente": body.get("fuente") or "directo"}
        leads.append(lead)
    lead["etapa"] = "Comprador"
    lead["nombre"] = lead.get("nombre") or body.get("nombre") or ""

    guardar_seguro(data)
    _capi_enviar("Purchase", email=email,
                 valor=float(body.get("valor") or 44), moneda="USD",
                 event_id=f"purchase-{transaccion or comprador['id']}")
    respuesta = {"ok": True, "vitalicio": bool(usuario.get("vitalicio"))}
    if password:
        respuesta["password"] = password
    return respuesta


@app.post("/compra/reembolso")
def compra_reembolso(body: dict = Body(...), authorization: str = Header(None)):
    """Reembolso dentro de la garantia de 7 dias: revoca app y bonos (regla
    dura del producto). La llama n8n con CRON_KEY."""
    _auth(authorization)
    email = str(body.get("email", "")).strip().lower()
    transaccion = str(body.get("transaccion", "")).strip()
    if not email and not transaccion:
        raise HTTPException(400, "email o transaccion requeridos")

    data = crm_store.leer() or {}
    slice_ws = data.get("cicloderiqueza") or {}
    comprador = next(
        (c for c in slice_ws.get("compradores", [])
         if (email and str(c.get("email", "")).lower() == email)
         or (transaccion and c.get("transaccion") == transaccion)),
        None,
    )
    if not comprador:
        raise HTTPException(404, "compra no encontrada")
    comprador.update({"reembolsado": True, "accesoApp": False, "bonos": False})
    usuario = next(
        (u for u in slice_ws.get("app_usuarios", [])
         if str(u.get("email", "")).lower() == str(comprador["email"]).lower()),
        None,
    )
    if usuario:
        usuario["revocado"] = True
    lead = next(
        (l for l in slice_ws.get("leads", [])
         if str(l.get("email", "")).lower() == str(comprador["email"]).lower()),
        None,
    )
    if lead:
        lead["etapa"] = "Reembolsado"
    guardar_seguro(data)
    return {"ok": True}


@app.post("/app/validar")
def app_validar(body: dict = Body(...)):
    """Login de la Calculadora Pro (publico). La app valida contra el motor
    para que la revocacion por reembolso sea inmediata."""
    email = str(body.get("email", "")).strip().lower()
    password = str(body.get("password", ""))
    if not email or not password:
        raise HTTPException(401, "credenciales invalidas")
    data = crm_store.leer() or {}
    usuario = next(
        (u for u in (data.get("cicloderiqueza") or {}).get("app_usuarios", [])
         if str(u.get("email", "")).lower() == email),
        None,
    )
    valido = (
        usuario is not None
        and not usuario.get("revocado")
        and hmac.compare_digest(
            usuario.get("hash", ""), _hash_credencial(email, password)
        )
    )
    if not valido:
        raise HTTPException(401, "credenciales invalidas")
    return {"ok": True, "vitalicio": bool(usuario.get("vitalicio"))}


@app.post("/admin/cambiar_clave")
def cambiar_clave(body: dict = Body(...), authorization: str = Header(None)):
    _auth(authorization)
    nueva = str(body.get("nueva", "")).strip()
    if len(nueva) < 8:
        raise HTTPException(400, "la clave debe tener al menos 8 caracteres")
    os.makedirs(DATA_DIR, exist_ok=True)
    tmp = CLAVE_PATH + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        f.write(nueva)
    os.replace(tmp, CLAVE_PATH)
    os.chmod(CLAVE_PATH, 0o600)
    return {"ok": True}


@app.post("/secreto/guardar")
def secreto_guardar(body: dict = Body(...), authorization: str = Header(None)):
    _auth(authorization)
    clave, valor = str(body.get("clave", "")), str(body.get("valor", ""))
    if not secretos.permitido(clave):
        raise HTTPException(400, "clave fuera de la allowlist")
    if not valor:
        raise HTTPException(400, "valor vacio")
    secretos.set_(clave, valor)
    return {"ok": True, "mascara": secretos.mascara(valor)}


@app.get("/secreto/estado")
def secreto_estado(authorization: str = Header(None)):
    _auth(authorization)
    return secretos.estado()
