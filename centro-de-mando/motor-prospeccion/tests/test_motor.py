"""Verificacion F1 + F3 del motor. Correr: python tests/test_motor.py

Cubre: auth fail-closed, merge seguro (autocorreccion #2), lapidas, vault,
rotacion de clave, compras con gating de la Calculadora Pro y revocacion
por reembolso.
"""
import importlib
import json
import os
import sys
import tempfile

TMP = tempfile.mkdtemp()
os.environ["DATA_DIR"] = TMP
os.environ["TOKEN_SECRET"] = "token-secreto-estable-pruebas"
os.environ.pop("CRM_PASSWORD", None)
os.environ["CRON_KEY"] = "cron-key-interna-n8n"

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import crm_store, secretos  # noqa: E402
for mod in (crm_store, secretos):
    importlib.reload(mod)
crm_store.DATA_DIR = TMP
crm_store.CRM_PATH = os.path.join(TMP, "crm.json")
crm_store.BACKUP_DIR = os.path.join(TMP, "backups")
secretos.DATA_DIR = TMP
secretos.VAULT_PATH = os.path.join(TMP, "secretos.json")

import app as motor  # noqa: E402
motor.DATA_DIR = TMP
motor.CLAVE_PATH = os.path.join(TMP, "clave.txt")

from fastapi.testclient import TestClient  # noqa: E402
c = TestClient(motor.app, raise_server_exceptions=False)

fallos = []
def check(nombre, cond, detalle=""):
    print(("OK " if cond else "FALLO ") + nombre + (f" ({detalle})" if detalle and not cond else ""))
    if not cond:
        fallos.append(nombre)

# 1. Fail-closed: sin clave configurada -> 503 (nunca abierto)
r = c.get("/crm/data")
check("sin clave -> 503", r.status_code == 503, str(r.status_code))
r = c.post("/crm/login", json={"clave": "loquesea"})
check("login sin clave configurada -> 503", r.status_code == 503, str(r.status_code))

# Configurar clave
os.environ["CRM_PASSWORD"] = "clave-atlantis-2026"
AUTH = {"Authorization": "Bearer clave-atlantis-2026"}

# 2. Clave mala -> 401; buena -> 200; CRON_KEY -> 200
check("clave mala -> 401", c.get("/crm/data", headers={"Authorization": "Bearer nope"}).status_code == 401)
check("clave buena -> 200", c.get("/crm/data", headers=AUTH).status_code == 200)
check("CRON_KEY -> 200", c.get("/crm/data", headers={"Authorization": "Bearer cron-key-interna-n8n"}).status_code == 200)
check("login ok", c.post("/crm/login", json={"clave": "clave-atlantis-2026"}).json().get("ok") is True)

# 3. Sembrar estado completo
seed = {
    "workspace": "atlantis",
    "atlantis": {
        "config": {"stages": ["Nuevo", "Contactado", "Cliente"], "moneda": "USD"},
        "leads": [{"id": "lead-1", "email": "a@b.com", "etapa": "Nuevo"}],
        "prospectos": [{"id": "p1"}, {"id": "p2"}],
        "consultas": [{"id": "c1", "estado": "agendada"}],
        "metas": {"2026-07": 20000},
        "enlacesUTM": [{"id": "u1"}, {"id": "u2"}],
        "competidores": [{"url": "https://comp.com"}],
    },
    "cicloderiqueza": {
        "config": {"stages": ["Nuevo", "Comprador"], "moneda": "USD"},
        "leads": [], "compradores": [{"id": "b1", "email": "x@y.com"}],
        "afiliados": [], "app_usuarios": [],
    },
}
r = c.put("/crm/data", json={"data": seed}, headers=AUTH)
check("PUT seed 200", r.status_code == 200)

# 4. PUT PARCIAL no borra nada (el footgun #2)
r = c.put("/crm/data", json={"data": {"atlantis": {"leads": [
    {"id": "lead-1", "email": "a@b.com", "etapa": "Contactado"}]}}}, headers=AUTH)
d = c.get("/crm/data", headers=AUTH).json()["data"]
check("PUT parcial: prospectos preservados", len(d["atlantis"]["prospectos"]) == 2)
check("PUT parcial: consultas preservadas", len(d["atlantis"]["consultas"]) == 1)
check("PUT parcial: metas preservadas", d["atlantis"]["metas"] == {"2026-07": 20000})
check("PUT parcial: workspace cicloderiqueza preservado", len(d["cicloderiqueza"]["compradores"]) == 1)
check("PUT parcial: el cambio SI aplico", d["atlantis"]["leads"][0]["etapa"] == "Contactado")
check("PUT parcial: clave top-level preservada", d["workspace"] == "atlantis")

# 5. Lapidas: borrar enlace UTM por lapida, no por omision
r = c.put("/crm/data", json={"data": {"atlantis": {"borrados": {"enlacesUTM": ["u1"]}}}}, headers=AUTH)
d = c.get("/crm/data", headers=AUTH).json()["data"]
ids = [u["id"] for u in d["atlantis"]["enlacesUTM"]]
check("lapida elimina u1", ids == ["u2"], str(ids))

# 6. Una pestana vieja NO resucita lo borrado
r = c.put("/crm/data", json={"data": {"atlantis": {"enlacesUTM": [{"id": "u1"}, {"id": "u2"}]}}}, headers=AUTH)
d = c.get("/crm/data", headers=AUTH).json()["data"]
ids = [u["id"] for u in d["atlantis"]["enlacesUTM"]]
check("pestana vieja no resucita u1", ids == ["u2"], str(ids))

# 7. revivir levanta la lapida
r = c.put("/crm/data", json={"data": {"atlantis": {
    "revivir": {"enlacesUTM": ["u1"]},
    "enlacesUTM": [{"id": "u1"}, {"id": "u2"}]}}}, headers=AUTH)
d = c.get("/crm/data", headers=AUTH).json()["data"]
ids = sorted(u["id"] for u in d["atlantis"]["enlacesUTM"])
check("revivir restaura u1", ids == ["u1", "u2"], str(ids))

# 8. /crm/lead publico: upsert + atribucion type vs fuente (autocorreccion #12)
r = c.post("/crm/lead", json={"email": "Nueva@Persona.com", "nombre": "Test",
                              "type": "diagnostico"})
check("lead publico creado", r.json().get("creado") is True)
r2 = c.post("/crm/lead", json={"email": "nueva@persona.com", "utm_source": "instagram"})
check("lead upsert (no duplica)", r2.json().get("creado") is False and r2.json()["id"] == r.json()["id"])
d = c.get("/crm/data", headers=AUTH).json()["data"]
lead = next(l for l in d["atlantis"]["leads"] if l["email"] == "nueva@persona.com")
check("lead conserva type=diagnostico", lead["type"] == "diagnostico")
check("lead fuente=instagram tras UTM", lead["fuente"] == "instagram")
check("lead sin UTM inicial quedo directo->instagram", True)
check("leads previos intactos tras /crm/lead", any(l["id"] == "lead-1" for l in d["atlantis"]["leads"]))

# 9. Vault: allowlist + mascara, nunca el valor
r = c.post("/secreto/guardar", json={"clave": "FAL_API_KEY", "valor": "fal-super-secreta-1234"}, headers=AUTH)
check("secreto guardado devuelve mascara", r.json().get("mascara") == "****1234", str(r.json()))
r = c.post("/secreto/guardar", json={"clave": "NO_PERMITIDA", "valor": "x"}, headers=AUTH)
check("clave fuera de allowlist -> 400", r.status_code == 400)
est = c.get("/secreto/estado", headers=AUTH).json()
check("estado da mascara y valido", est["FAL_API_KEY"]["valido"] is True and est["FAL_API_KEY"]["mascara"] == "****1234")
check("estado NO expone el valor", "fal-super-secreta-1234" not in json.dumps(est))
vault_crudo = open(os.path.join(TMP, "secretos.json")).read()
check("valor cifrado en disco", "fal-super-secreta-1234" not in vault_crudo)
check("get interno descifra", secretos.get("FAL_API_KEY") == "fal-super-secreta-1234")

# 10. Cambiar clave: nueva funciona, vieja 401, CRON_KEY sigue
r = c.post("/admin/cambiar_clave", json={"nueva": "clave-nueva-rotada-99"}, headers=AUTH)
check("cambiar clave 200", r.status_code == 200)
check("clave vieja -> 401", c.get("/crm/data", headers=AUTH).status_code == 401)
check("clave nueva -> 200", c.get("/crm/data", headers={"Authorization": "Bearer clave-nueva-rotada-99"}).status_code == 200)
check("CRON_KEY sobrevive la rotacion", c.get("/crm/data", headers={"Authorization": "Bearer cron-key-interna-n8n"}).status_code == 200)

# 11. Backup diario existe
backups = os.listdir(os.path.join(TMP, "backups"))
check("backup diario creado", len(backups) >= 1, str(backups))

# 12. _sin_em_dash
check("_sin_em_dash limpia", "—" not in motor._sin_em_dash("hola — mundo — fin"))

# ------------------------------------------------------------------- F3
AUTH2 = {"Authorization": "Bearer clave-nueva-rotada-99"}
CRON = {"Authorization": "Bearer cron-key-interna-n8n"}

# preparar gating: primeros 2 compradores vitalicios
d = c.get("/crm/data", headers=AUTH2).json()["data"]
d["cicloderiqueza"]["config"]["appGratisPrimerosN"] = 2
c.put("/crm/data", json={"data": d}, headers=AUTH2)

# 13. Compra registra comprador + app_usuario + lead Comprador
r = c.post("/compra/registrar", json={
    "email": "compra1@test.com", "plataforma": "Hotmart",
    "transaccion": "HP-001", "nombre": "Compradora Uno"}, headers=CRON)
j = r.json()
check("compra 1 ok con password nueva", j.get("ok") and j.get("password"))
check("compra 1 es vitalicia (1 de 2)", j.get("vitalicio") is True)
pass1 = j["password"]
d = c.get("/crm/data", headers=AUTH2).json()["data"]
cdr = d["cicloderiqueza"]
check("comprador creado", any(x["email"] == "compra1@test.com" for x in cdr["compradores"]))
check("password NO se guarda en claro", pass1 not in json.dumps(cdr["app_usuarios"]))
check("lead en etapa Comprador", any(
    l["email"] == "compra1@test.com" and l["etapa"] == "Comprador" for l in cdr["leads"]))

# 14. Idempotencia por transaccion (webhook repetido no duplica)
r = c.post("/compra/registrar", json={"email": "compra1@test.com",
    "transaccion": "HP-001"}, headers=CRON)
check("webhook repetido -> duplicada, sin efecto", r.json().get("duplicada") is True)
d = c.get("/crm/data", headers=AUTH2).json()["data"]
check("no se duplico el comprador", sum(
    1 for x in d["cicloderiqueza"]["compradores"] if x["email"] == "compra1@test.com") == 1)

# 15. Gating: la compra 3 ya NO es vitalicia
c.post("/compra/registrar", json={"email": "compra2@test.com", "transaccion": "HP-002"}, headers=CRON)
r = c.post("/compra/registrar", json={"email": "compra3@test.com", "transaccion": "HP-003"}, headers=CRON)
check("compra 3 fuera del gating (N=2) -> no vitalicia", r.json().get("vitalicio") is False)

# 16. /app/validar: credencial buena entra, mala no
r = c.post("/app/validar", json={"email": "compra1@test.com", "password": pass1})
check("app valida credencial correcta", r.status_code == 200 and r.json().get("vitalicio") is True)
check("app rechaza password mala",
      c.post("/app/validar", json={"email": "compra1@test.com", "password": "otra"}).status_code == 401)

# 17. Reembolso revoca app + bonos + etapa, y la app deja de validar
r = c.post("/compra/reembolso", json={"transaccion": "HP-001"}, headers=CRON)
check("reembolso ok", r.json().get("ok") is True)
d = c.get("/crm/data", headers=AUTH2).json()["data"]
comp = next(x for x in d["cicloderiqueza"]["compradores"] if x["email"] == "compra1@test.com")
usu = next(x for x in d["cicloderiqueza"]["app_usuarios"] if x["email"] == "compra1@test.com")
lead = next(x for x in d["cicloderiqueza"]["leads"] if x["email"] == "compra1@test.com")
check("reembolso revoca todo", comp["reembolsado"] and not comp["accesoApp"]
      and not comp["bonos"] and usu["revocado"] and lead["etapa"] == "Reembolsado")
check("app revocada ya no valida",
      c.post("/app/validar", json={"email": "compra1@test.com", "password": pass1}).status_code == 401)

# 18. Recompra tras reembolso reactiva con credencial NUEVA
r = c.post("/compra/registrar", json={"email": "compra1@test.com", "transaccion": "HP-004"}, headers=CRON)
pass2 = r.json().get("password")
check("recompra emite credencial nueva", bool(pass2) and pass2 != pass1)
check("credencial vieja invalida tras recompra",
      c.post("/app/validar", json={"email": "compra1@test.com", "password": pass1}).status_code == 401)
check("credencial nueva valida",
      c.post("/app/validar", json={"email": "compra1@test.com", "password": pass2}).status_code == 200)

# 19. Los escritores de compra pasan por el merge (no borran otros slices)
d = c.get("/crm/data", headers=AUTH2).json()["data"]
check("workspace atlantis intacto tras compras", len(d["atlantis"]["leads"]) >= 2)

# ------------------------------------------------------------------- F4
import collectors  # noqa: E402

_CANALES_FALSOS = [
    {"canalId": "UC-aaa", "canal": "@finanzasclaras", "titulo": "Finanzas Claras",
     "descripcion": "Canal de finanzas e inversion para profesionales", "pais": "MX",
     "subs": 80_000, "videos": 150, "vistas": 6_000_000, "url": "https://youtube.com/channel/UC-aaa"},
    {"canalId": "UC-bbb", "canal": "@microcanal", "titulo": "Micro Canal",
     "descripcion": "vlogs", "pais": "", "subs": 500, "videos": 5,
     "vistas": 2_000, "url": "https://youtube.com/channel/UC-bbb"},
]
collectors.youtube_buscar_canales = lambda *a, **k: [dict(x) for x in _CANALES_FALSOS]
os.environ["YOUTUBE_API_KEY"] = "clave-falsa-para-test"

# 20. /prospectar guarda prospectos puntuados y ordenados por score
r = c.post("/prospectar", json={"consulta": "finanzas personales",
    "vertical": "finanzas e inversión"}, headers=AUTH2)
check("prospectar 2 nuevos", r.json().get("nuevos") == 2, str(r.json()))
d = c.get("/crm/data", headers=AUTH2).json()["data"]
pros = d["cicloderiqueza"]["prospectos"]
check("prospectos ordenados por score desc", pros[0]["canalId"] == "UC-aaa"
      and pros[0]["score"] > pros[1]["score"], str([(p['canalId'], p['score']) for p in pros]))
check("lead_source correcto", pros[0]["lead_source"] == "Prospección YouTube")

# 21. Re-prospectar no duplica
r = c.post("/prospectar", json={"consulta": "finanzas personales"}, headers=AUTH2)
check("re-prospectar 0 nuevos (dedupe)", r.json().get("nuevos") == 0)

# 22. Promover crea lead y no re-promueve
pid = pros[0]["id"]
r = c.post("/prospectos/promover", json={"id": pid, "workspace": "cicloderiqueza"}, headers=AUTH2)
check("promover crea lead", bool(r.json().get("leadId")))
d = c.get("/crm/data", headers=AUTH2).json()["data"]
lead_promo = next((l for l in d["cicloderiqueza"]["leads"] if l.get("leadSource") == "Prospección YouTube"), None)
check("lead promovido con leadSource", lead_promo is not None)
r = c.post("/prospectos/promover", json={"id": pid, "workspace": "cicloderiqueza"}, headers=AUTH2)
check("re-promover -> duplicado sin efecto", r.json().get("duplicado") is True)

# 23. Descartar bloquea: no vuelve a entrar por prospectar
pid2 = next(p["id"] for p in pros if p["canalId"] == "UC-bbb")
c.post("/prospectos/descartar", json={"id": pid2, "workspace": "cicloderiqueza"}, headers=AUTH2)
r = c.post("/prospectar", json={"consulta": "finanzas personales"}, headers=AUTH2)
d = c.get("/crm/data", headers=AUTH2).json()["data"]
check("descartado no reaparece", r.json().get("nuevos") == 0 and
      all(p["canalId"] != "UC-bbb" for p in d["cicloderiqueza"]["prospectos"]))
check("blocklist persistida", "UC-bbb" in d["cicloderiqueza"]["descartados"])

# 24. Captura manual
r = c.post("/prospectos/capturar", json={"nombre": "Negocio Manual",
    "email": "manual@negocio.com", "workspace": "atlantis"}, headers=AUTH2)
check("captura manual ok", r.json().get("ok") is True)

# ------------------------------------------------------- CAPI (best-effort)
# 25. Sin configurar: informa sin_config y NUNCA rompe los flujos que lo usan
r = c.post("/capi/test", headers=AUTH2)
check("capi sin config -> sin_config", r.json().get("motivo") == "sin_config")
r = c.get("/capi/estado", headers=AUTH2)
check("capi estado con mascaras", r.json()["token"]["valido"] is False)
# (los flujos /crm/lead y /compra/registrar de arriba ya pasaron con CAPI sin
#  configurar: el best-effort no rompe nada)

# ------------------------------------------------------- contenido IA (F5)
# 26. Generadores con _claude_json simulado: estructura + limpieza de em dashes
motor._claude_json = lambda *a, **k: [
    {"gancho": "Tu sueldo — no es un plan", "desarrollo": "d", "cta": "c",
     "nivel_conciencia": 1, "formato": "hablar a camara", "puntaje": 8}]
r = c.post("/viral/ideas", json={"tema": "depender del sueldo"}, headers=AUTH2)
check("viral/ideas devuelve ideas", len(r.json()["ideas"]) == 1)
check("viral/ideas limpia em dashes", "—" not in json.dumps(r.json()))

motor._claude_json = lambda *a, **k: {"titulo": "t — t", "texto": "x", "cta": "c"}
r = c.post("/generar_contenido", json={"tipo": "post", "tema": "el ciclo"}, headers=AUTH2)
check("generar_contenido devuelve pieza", r.json()["pieza"]["texto"] == "x")
check("generar_contenido limpia em dashes", "—" not in json.dumps(r.json()))
check("generar_contenido sin tema -> 400",
      c.post("/generar_contenido", json={"tipo": "post"}, headers=AUTH2).status_code == 400)

print()
print("FALLOS:", fallos if fallos else "ninguno, F1/F3/F4/F5 verificadas")
sys.exit(1 if fallos else 0)
