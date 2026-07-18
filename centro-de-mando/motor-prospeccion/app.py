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

import crm_store
import secretos

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
    return {"ok": True, "id": lead_id, "creado": creado}


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
