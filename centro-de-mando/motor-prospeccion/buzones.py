"""Buzones SMTP (correo saliente). Server-only: /data/buzones.json NUNCA viaja
al navegador con contrasenas; la API devuelve solo mascaras.

Defaults Hostinger (smtp.hostinger.com:465). La usuaria agrega el buzon con la
contrasena del webmail y 'Probar conexion' antes de usarlo.
"""
import json
import os
import smtplib
import threading
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

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
        smtp.login(b["email"], b["password"])
    return True


def enviar(para, asunto, cuerpo_html, desde=None):
    """Envia un correo HTML. Los tests inyectan un reemplazo de esta funcion."""
    b = _buzon(desde)
    mensaje = MIMEMultipart("alternative")
    mensaje["From"] = b["email"]
    mensaje["To"] = para
    mensaje["Subject"] = asunto
    mensaje.attach(MIMEText(cuerpo_html, "html", "utf-8"))
    with smtplib.SMTP_SSL(b["host"], b["puerto"], timeout=20) as smtp:
        smtp.login(b["email"], b["password"])
        smtp.sendmail(b["email"], [para], mensaje.as_string())
    return True
