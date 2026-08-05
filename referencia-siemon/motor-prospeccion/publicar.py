"""Publicacion en redes: Postiz (hub, todas las redes) + nativo IG/FB (respaldo).
Compartido por app.py (endpoints) y asistente.py (herramienta del chat)."""
import os
import requests
from datetime import datetime, timezone, timedelta


def postiz_base():
    return os.environ.get("POSTIZ_URL", "https://publicar.themoneycommand.com/api").rstrip("/") + "/public/v1"


def postiz_key():
    return os.environ.get("POSTIZ_API_KEY", "")


def integraciones():
    """Redes conectadas en Postiz (normalizadas)."""
    key = postiz_key()
    if not key:
        return {"ok": True, "conectado": False, "integraciones": []}
    try:
        r = requests.get(postiz_base() + "/integrations", headers={"Authorization": key}, timeout=30)
        raw = r.json()
        lst = raw if isinstance(raw, list) else raw.get("integrations", [])
        ints = [{"id": i.get("id"), "nombre": i.get("name"),
                 "red": (i.get("identifier") or i.get("platform") or "").lower(),
                 "picture": i.get("picture") or i.get("profile") or ""} for i in lst]
        return {"ok": True, "conectado": True, "integraciones": ints}
    except Exception as e:
        return {"ok": False, "conectado": False, "error": str(e), "integraciones": []}


def _publicar_postiz(req):
    key = postiz_key()
    base = postiz_base()
    H = {"Authorization": key}
    red = (req.get("red") or "").lower()
    texto = req.get("texto") or ""
    media_url = req.get("mediaUrl") or ""
    integration_id = req.get("integrationId") or ""
    when = (req.get("when") or "now").lower()
    date = req.get("date") or ""
    if not integration_id:
        try:
            raw = requests.get(base + "/integrations", headers=H, timeout=30).json()
            lst = raw if isinstance(raw, list) else raw.get("integrations", [])
            for i in lst:
                ident = (i.get("identifier") or i.get("platform") or "").lower()
                if ident == red or (red and red in ident):
                    integration_id = i.get("id"); break
        except Exception as e:
            return {"ok": False, "error": "No pude leer las cuentas conectadas en Postiz: " + str(e)}
    if not integration_id:
        return {"ok": False, "error": f"No hay una cuenta de {red or 'esa red'} conectada en Postiz."}
    # una o VARIAS imágenes (carrusel): mediaUrls tiene prioridad; si no, la única mediaUrl
    media_urls = req.get("mediaUrls") or ([media_url] if media_url else [])
    image = []
    for mu in media_urls:
        if not mu:
            continue
        try:
            content = requests.get(mu, timeout=60).content
            fn = (mu.split("/")[-1].split("?")[0]) or "media"
            up = requests.post(base + "/upload", headers=H, files={"file": (fn, content)}, timeout=120).json()
            if up.get("id"):
                image.append({"id": up["id"], "path": up.get("path", "")})
        except Exception as e:
            return {"ok": False, "error": "Fallo subiendo el medio a Postiz: " + str(e)}
    # "now" con la fecha exacta falla en la API publica de Postiz (queda en el pasado al procesarse).
    # Publicamos siempre como "schedule": inmediato = dentro de 1 minuto (Postiz lo saca de la cola enseguida).
    if when == "schedule" and date:
        fecha_pub = date
    else:
        fecha_pub = (datetime.now(timezone.utc) + timedelta(minutes=1)).isoformat()
    body = {
        "type": "schedule",
        "date": fecha_pub,
        "shortLink": False, "tags": [],
        "posts": [{"integration": {"id": integration_id},
                   "value": [{"content": texto, "image": image}],
                   "settings": {"__type": red}}],
    }
    try:
        r = requests.post(base + "/posts", headers=H, json=body, timeout=120)
        try:
            d = r.json()
        except Exception:
            d = {"status": r.status_code, "texto": r.text[:300]}
        return {"ok": bool(r.ok), "via": "postiz", "data": d}
    except Exception as e:
        return {"ok": False, "error": str(e)}


def _publicar_nativo(req):
    url = os.environ.get("N8N_PUBLICAR_URL", "https://hooks.siemondigital.com/webhook/siemon-publicar")
    key = os.environ.get("PUBLICAR_KEY", "")
    if not key:
        return {"ok": False, "error": "PUBLICAR_KEY no configurada en el servidor (publicacion nativa deshabilitada)."}
    payload = {
        "key": key, "red": (req.get("red") or "").lower(),
        "texto": req.get("texto") or "", "mediaUrl": req.get("mediaUrl") or "",
        "mediaType": req.get("mediaType") or "image", "titulo": req.get("titulo") or "",
    }
    if payload["red"] not in ("instagram", "facebook"):
        return {"ok": False, "error": "Sin Postiz, la publicacion nativa solo soporta Instagram y Facebook."}
    if not payload["mediaUrl"] and payload["red"] == "instagram":
        return {"ok": False, "error": "Instagram requiere una imagen o video (mediaUrl)."}
    try:
        r = requests.post(url, json=payload, timeout=90)
        try:
            data = r.json()
        except Exception:
            data = {"ok": r.ok, "status": r.status_code, "texto": r.text[:300]}
        return data
    except Exception as e:
        return {"ok": False, "error": str(e)}


def publicar(req):
    """Elige proveedor automaticamente: Postiz si hay key, si no nativo IG/FB."""
    provider = (req.get("provider") or ("postiz" if postiz_key() else "nativo")).lower()
    if provider == "postiz" and postiz_key():
        return _publicar_postiz(req)
    return _publicar_nativo(req)
