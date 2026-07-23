"""Buzones SMTP (correo saliente). Server-only: /data/buzones.json NUNCA viaja
al navegador con contrasenas; la API devuelve solo mascaras.

Defaults Hostinger (smtp.hostinger.com:465). La usuaria agrega el buzon con la
contrasena del webmail y 'Probar conexion' antes de usarlo.
"""
import email as email_mod
import imaplib
import json
import os
import smtplib
import threading
from email.header import decode_header
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import parseaddr

DATA_DIR = os.environ.get("DATA_DIR", "/data")
RUTA = os.path.join(DATA_DIR, "buzones.json")

_lock = threading.Lock()


def _leer():
    if not os.path.exists(RUTA):
        return []
    with open(RUTA, encoding="utf-8") as f:
        return json.load(f)


def _escribir(buzones):
    os.makedirs(DATA_DIR, exist_ok=True)
    tmp = RUTA + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(buzones, f, ensure_ascii=False)
    os.replace(tmp, RUTA)
    os.chmod(RUTA, 0o600)


def listar_mascarado():
    with _lock:
        buzones = _leer()
    return [{
        "email": b.get("email"),
        "host": b.get("host"),
        "puerto": b.get("puerto"),
        "tienePassword": bool(b.get("password")),
    } for b in buzones]


def guardar(buzon):
    email = str(buzon.get("email", "")).strip().lower()
    if not email or "@" not in email:
        raise ValueError("email del buzon requerido")
    entrada = {
        "email": email,
        "host": buzon.get("host") or "smtp.hostinger.com",
        "puerto": int(buzon.get("puerto") or 465),
        "password": buzon.get("password") or "",
        # relays tipo Brevo: el login SMTP no es la direccion remitente
        "usuario": str(buzon.get("usuario") or "").strip(),
        # buzones sin IMAP (solo envio): el cron de lectura los salta
        "soloEnvio": bool(buzon.get("soloEnvio")),
    }
    with _lock:
        buzones = [b for b in _leer() if b.get("email") != email]
        # conservar la password previa si la edicion no trae una nueva
        if not entrada["password"]:
            previo = next((b for b in _leer() if b.get("email") == email), None)
            if previo:
                entrada["password"] = previo.get("password", "")
        buzones.append(entrada)
        _escribir(buzones)


def eliminar(email):
    email = str(email).strip().lower()
    with _lock:
        _escribir([b for b in _leer() if b.get("email") != email])


def _buzon(email=None):
    with _lock:
        buzones = _leer()
    if not buzones:
        raise RuntimeError("sin buzones configurados")
    if email:
        b = next((x for x in buzones if x.get("email") == email), None)
        if not b:
            raise RuntimeError(f"buzon {email} no existe")
        return b
    return buzones[0]


def probar(email=None):
    b = _buzon(email)
    with smtplib.SMTP_SSL(b["host"], b["puerto"], timeout=15) as smtp:
        smtp.login(b.get("usuario") or b["email"], b["password"])
    return True


def listar_interno():
    """Entradas completas, SOLO para uso del motor (nunca por API)."""
    with _lock:
        return _leer()


def set_ultima_uid(buzon_email, uid):
    with _lock:
        buzones = _leer()
        for b in buzones:
            if b.get("email") == buzon_email:
                b["ultimaUid"] = max(int(b.get("ultimaUid") or 0), int(uid))
        _escribir(buzones)


def _decodificar(valor):
    if not valor:
        return ""
    partes = []
    for texto, cod in decode_header(valor):
        if isinstance(texto, bytes):
            partes.append(texto.decode(cod or "utf-8", errors="replace"))
        else:
            partes.append(texto)
    return "".join(partes)


def _extraer_texto(mensaje):
    if mensaje.is_multipart():
        for parte in mensaje.walk():
            if parte.get_content_type() == "text/plain":
                carga = parte.get_payload(decode=True)
                if carga:
                    return carga.decode(parte.get_content_charset() or "utf-8",
                                        errors="replace")
        for parte in mensaje.walk():
            if parte.get_content_type() == "text/html":
                carga = parte.get_payload(decode=True)
                if carga:
                    return carga.decode(parte.get_content_charset() or "utf-8",
                                        errors="replace")
        return ""
    carga = mensaje.get_payload(decode=True)
    return (carga or b"").decode(mensaje.get_content_charset() or "utf-8",
                                 errors="replace")


def leer_bandeja(buzon_email=None, desde_uid=0, max_correos=200):
    """Lee INBOX por UID ASCENDENTE desde desde_uid+1, sin truncar mientras se
    avanza el puntero (autocorreccion IMAP: truncar con [-50:] pierde correos).
    Los tests inyectan un reemplazo de esta funcion.
    """
    b = _buzon(buzon_email)
    host = b.get("imapHost") or "imap.hostinger.com"
    puerto = int(b.get("imapPuerto") or 993)
    resultado = []
    imap = imaplib.IMAP4_SSL(host, puerto)
    try:
        imap.login(b["email"], b["password"])
        imap.select("INBOX")
        _, datos = imap.uid("search", None, f"UID {int(desde_uid) + 1}:*")
        uids = sorted(
            int(u) for u in (datos[0].split() if datos and datos[0] else [])
            if int(u) > int(desde_uid)
        )[:max_correos]
        for uid in uids:
            _, msg_datos = imap.uid("fetch", str(uid), "(RFC822)")
            crudo = next((p[1] for p in msg_datos if isinstance(p, tuple)), None)
            if not crudo:
                continue
            mensaje = email_mod.message_from_bytes(crudo)
            resultado.append({
                "uid": uid,
                "de": parseaddr(mensaje.get("From", ""))[1].lower(),
                "asunto": _decodificar(mensaje.get("Subject", "")),
                "texto": _extraer_texto(mensaje)[:4000],
                "fecha": mensaje.get("Date", ""),
            })
    finally:
        try:
            imap.logout()
        except Exception:  # noqa: BLE001
            pass
    return resultado


def enviar(para, asunto, cuerpo_html, desde=None):
    """Envia un correo HTML. Los tests inyectan un reemplazo de esta funcion."""
    b = _buzon(desde)
    mensaje = MIMEMultipart("alternative")
    mensaje["From"] = b["email"]
    mensaje["To"] = para
    mensaje["Subject"] = asunto
    mensaje.attach(MIMEText(cuerpo_html, "html", "utf-8"))
    with smtplib.SMTP_SSL(b["host"], b["puerto"], timeout=20) as smtp:
        smtp.login(b.get("usuario") or b["email"], b["password"])
        smtp.sendmail(b["email"], [para], mensaje.as_string())
    return True
