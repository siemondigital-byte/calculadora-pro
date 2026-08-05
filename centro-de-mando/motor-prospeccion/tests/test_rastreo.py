"""Rastreo de correos (bloque 1 del porte Siemon). Correr:
python tests/test_rastreo.py

Verifica EN LAS DOS DIRECCIONES y por el camino real (los endpoints que usan
de verdad los correos): el robot NO cuenta y una persona SI.
"""
import importlib
import os
import sys
import tempfile

TMP = tempfile.mkdtemp()
os.environ["DATA_DIR"] = TMP
os.environ["TOKEN_SECRET"] = "token-secreto-estable-pruebas"
os.environ["CRM_PASSWORD"] = "clave-pruebas"
os.environ["CRON_KEY"] = "cron-key-pruebas"

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import crm_store, rastreo, nurturing  # noqa: E402
for mod in (crm_store, rastreo, nurturing):
    importlib.reload(mod)
crm_store.DATA_DIR = TMP
crm_store.CRM_PATH = os.path.join(TMP, "crm.json")
crm_store.BACKUP_DIR = os.path.join(TMP, "backups")
rastreo.DATA_DIR = TMP

import app as motor  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
c = TestClient(motor.app, raise_server_exceptions=False)
AUTH = {"Authorization": "Bearer cron-key-pruebas"}

fallos = []
def check(nombre, cond, detalle=""):
    print(("OK " if cond else "FALLO ") + nombre + (f" ({detalle})" if detalle and not cond else ""))
    if not cond:
        fallos.append(nombre)

PERSONA = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                         "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15"}
ROBOT = {"User-Agent": "Mozilla/5.0 (compatible; Outlook-SafeLinks/1.0; +https://aka.ms)"}

# --- capas puras -----------------------------------------------------------
check("robot detectado", rastreo.es_robot(ROBOT["User-Agent"]))
check("persona NO es robot", not rastreo.es_robot(PERSONA["User-Agent"]))
check("sin user-agent se excluye", rastreo.es_robot(""))
check("GoogleImageProxy NO se excluye (aperturas reales de Gmail)",
      not rastreo.es_robot("Mozilla/5.0 (Windows NT 10.0; Win64; x64) via ggpht.com GoogleImageProxy"))

# --- estado sembrado: un inscrito con pixel y clic emitidos ----------------
tok_px = rastreo.token_envio()
tok_px2 = rastreo.token_envio()
check("pixel unico por envio", tok_px != tok_px2)
tok_clic = nurturing.token_clic("ana@ejemplo.com", 0)
seed = {"workspace": "atlantis", "cicloderiqueza": {"nurturing": {
    "activo": True, "secuencia": [], "config": {},
    "metricas": {"enviados": 2, "aperturas": 0, "clics": 0},
    "inscritos": [{"email": "ana@ejemplo.com", "estado": "activo", "paso": 1,
                   "pixeles": [tok_px], "clicTokens": [tok_clic]}]}}}
crm_store.guardar(seed)

# --- pixel de apertura (camino real: GET /nurturing/px/<tid>.gif) ----------
r = c.get(f"/nurturing/px/{tok_px}.gif", headers=ROBOT)
apert = (crm_store.leer()["cicloderiqueza"]["nurturing"]["metricas"]).get("aperturas")
check("pixel: robot NO cuenta", r.status_code == 200 and apert == 0, str(apert))
r = c.get(f"/nurturing/px/{tok_px}.gif", headers=PERSONA)
apert = (crm_store.leer()["cicloderiqueza"]["nurturing"]["metricas"]).get("aperturas")
check("pixel: persona SI cuenta", r.status_code == 200 and apert == 1, str(apert))

# --- clic (camino real: GET /nurturing/r) ----------------------------------
URL = f"/nurturing/r?ws=cicloderiqueza&t={tok_clic}&u=https://atlantisglobalrealty.com/"
r = c.get(URL, headers=ROBOT, follow_redirects=False)
clics = (crm_store.leer()["cicloderiqueza"]["nurturing"]["metricas"]).get("clics")
check("clic: robot redirige pero NO cuenta", r.status_code == 302 and clics == 0,
      f"{r.status_code}/{clics}")
r = c.get(URL, headers=PERSONA, follow_redirects=False)
clics = (crm_store.leer()["cicloderiqueza"]["nurturing"]["metricas"]).get("clics")
check("clic: persona redirige Y cuenta", r.status_code == 302 and clics == 1,
      f"{r.status_code}/{clics}")
check("clic: token invalido no redirige",
      c.get("/nurturing/r?ws=cicloderiqueza&t=falso&u=https://x.com/",
            headers=PERSONA, follow_redirects=False).status_code == 400)

# --- enlace corto (camino real: beacon /r/click/<codigo>) ------------------
data = crm_store.leer()
data["atlantis"] = {"enlacesCortos": [{"codigo": "abc123", "url": "https://x.com", "clics": 0}]}
crm_store.guardar(data)
c.post("/r/click/abc123", headers=ROBOT)
n = crm_store.leer()["atlantis"]["enlacesCortos"][0]["clics"]
check("corto: robot NO cuenta", n == 0, str(n))
c.post("/r/click/abc123?yo=1", headers=PERSONA)
n = crm_store.leer()["atlantis"]["enlacesCortos"][0]["clics"]
check("corto: ?yo=1 NO cuenta y aprende la IP", n == 0 and rastreo._leer_ips(), str(n))
ip_aprendida = rastreo._leer_ips()
rastreo_ips = list(ip_aprendida)
c.post("/r/click/abc123", headers=PERSONA)   # misma IP del cliente de test
n = crm_store.leer()["atlantis"]["enlacesCortos"][0]["clics"]
check("corto: la IP aprendida ya no cuenta (capa 4)", n == 0, str(n))
# persona nueva (otra IP): el TestClient no permite cambiar la IP; se prueba
# la capa directamente en las dos direcciones
os.remove(rastreo._ruta_ips())
c.post("/r/click/abc123", headers=PERSONA)
n = crm_store.leer()["atlantis"]["enlacesCortos"][0]["clics"]
check("corto: persona SI cuenta (sin IP aprendida)", n == 1, str(n))

# --- rebotes y respuestas --------------------------------------------------
check("DSN por remitente", rastreo.es_rebote("mailer-daemon@x.com", "cualquiera"))
check("DSN por asunto", rastreo.es_rebote("bot@x.com", "Mail delivery failed"))
check("humano no es DSN", not rastreo.es_rebote("ana@ejemplo.com", "Re: propuesta"))
check("destinatario del DSN",
      rastreo.destinatario_rebotado(
          "The following address failed: ana@ejemplo.com (mailbox full)",
          propios={"contact@atlantisglobalrealty.com"}) == "ana@ejemplo.com")
data = crm_store.leer()
check("rebote saca de la secuencia", nurturing.marcar_rebote(data, "cicloderiqueza", "ana@ejemplo.com"))
i = data["cicloderiqueza"]["nurturing"]["inscritos"][0]
m = data["cicloderiqueza"]["nurturing"]["metricas"]
check("estado rebote + metrica", i["estado"] == "rebote" and m.get("rebotes") == 1)
check("respuesta sobre no-activo no duplica",
      not nurturing.marcar_respuesta(data, "cicloderiqueza", "ana@ejemplo.com"))

# --- copia sin pixel -------------------------------------------------------
html = ('<p>Hola</p><img src="https://motor.atlantisglobalrealty.com/nurturing/'
        'px/abcd1234.gif" width="1" height="1" alt="">')
limpio = rastreo.sin_pixel(html)
check("la copia pierde el pixel", "nurturing/px" not in limpio and "<p>Hola</p>" in limpio)

print()
if fallos:
    print(f"FALLOS: {fallos}")
    sys.exit(1)
print("TODO OK: el robot no cuenta y la persona si, por los caminos reales")
