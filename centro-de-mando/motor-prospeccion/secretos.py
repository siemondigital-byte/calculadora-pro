"""Vault de secretos server-side (/data/secretos.json).

- Solo claves de la allowlist (_SECRETOS_PERMITIDOS).
- Los valores se cifran con Fernet derivado de TOKEN_SECRET (estable, distinto de
  la clave de login para que rotarla no invalide el vault).
- Nunca se devuelve un valor en claro por API: solo mascaras via estado().
"""
import base64
import hashlib
import json
import os
import threading

DATA_DIR = os.environ.get("DATA_DIR", "/data")
VAULT_PATH = os.path.join(DATA_DIR, "secretos.json")

_SECRETOS_PERMITIDOS = {
    "FAL_API_KEY",
    "GEMINI_API_KEY",   # respaldo gratis de IA cuando Anthropic queda sin saldo
    "VOYAGE_API_KEY",   # embeddings del RAG (memoria viva)
    # Agente de redes 24/7 (Meta: comentarios y DMs de IG/FB)
    "META_PAGE_TOKEN",
    "META_VERIFY_TOKEN",
    "META_IG_ID",
    "META_PAGE_ID",
    "POSTIZ_API_KEY",
    "FB_CAPI_TOKEN",
    "FB_PIXEL_ID",
    "FB_CAPI_TEST",
    "ATP_TOKEN",
    "DATAFORSEO_LOGIN",
    "DATAFORSEO_PASSWORD",
    "SERPER_API_KEY",
    # Ads: crear campanas (Meta real, siempre en pausa) y estado de conexion
    "META_ADS_TOKEN",
    "META_ADS_ACCOUNT",
    "LINKEDIN_ADS_TOKEN",
    "LINKEDIN_ADS_ACCOUNT",
    "GOOGLE_ADS_TOKEN",
    "YOUTUBE_API_KEY",
    "YT_OAUTH_CLIENT_ID",
    "YT_OAUTH_CLIENT_SECRET",
    "YT_ANALYTICS_REFRESH",
    "UMAMI_WEBSITE_ID",
    "UMAMI_URL",
    "UMAMI_USER",
    "UMAMI_PASS",
    "APIFY_TOKEN",
    "PEXELS_KEY",
    "UNSPLASH_KEY",
    "PIXABAY_KEY",
    "COVERR_KEY",
    # SEO / Google Ads Keyword Planner por API (skill jul-19: la fuente mas
    # confiable; el OAuth reutiliza el cliente de YouTube)
    "GOOGLE_ADS_DEV_TOKEN",
    "GOOGLE_ADS_CUSTOMER",
    "GOOGLE_ADS_LOGIN_CUSTOMER",
    "GADS_CLIENT_ID",
    "GADS_CLIENT_SECRET",
    "GADS_REFRESH",
    "GSC_REFRESH",
}

_lock = threading.Lock()


def _fernet():
    secreto = os.environ.get("TOKEN_SECRET", "")
    if not secreto:
        return None
    try:
        from cryptography.fernet import Fernet
    except ImportError:
        return None
    clave = base64.urlsafe_b64encode(hashlib.sha256(secreto.encode()).digest())
    return Fernet(clave)


def _leer_archivo():
    if not os.path.exists(VAULT_PATH):
        return {}
    with open(VAULT_PATH, encoding="utf-8") as f:
        return json.load(f)


def _escribir_archivo(vault):
    os.makedirs(DATA_DIR, exist_ok=True)
    tmp = VAULT_PATH + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(vault, f)
    os.replace(tmp, VAULT_PATH)
    os.chmod(VAULT_PATH, 0o600)


def permitido(clave):
    return clave in _SECRETOS_PERMITIDOS


def set_(clave, valor):
    if not permitido(clave):
        raise ValueError(f"clave fuera de la allowlist: {clave}")
    f = _fernet()
    guardado = f.encrypt(valor.encode()).decode() if f else valor
    with _lock:
        vault = _leer_archivo()
        vault[clave] = {"v": guardado, "cifrado": bool(f)}
        _escribir_archivo(vault)


def get(clave):
    """Uso interno del motor. Nunca exponer el retorno por API."""
    with _lock:
        entrada = _leer_archivo().get(clave)
    if not entrada:
        return None
    if entrada.get("cifrado"):
        f = _fernet()
        if not f:
            return None
        try:
            return f.decrypt(entrada["v"].encode()).decode()
        except Exception:
            return None
    return entrada["v"]


def mascara(valor):
    if not valor:
        return ""
    if len(valor) <= 4:
        return "****"
    return "****" + valor[-4:]


def estado():
    """{clave: {mascara, valido}} para la UI. Jamas el valor."""
    resultado = {}
    for clave in sorted(_SECRETOS_PERMITIDOS):
        valor = get(clave)
        resultado[clave] = {"mascara": mascara(valor), "valido": bool(valor)}
    return resultado
