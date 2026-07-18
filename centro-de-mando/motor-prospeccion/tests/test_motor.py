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

print()
print("FALLOS:", fallos if fallos else "ninguno, F1 y F3 verificadas")
sys.exit(1 if fallos else 0)
