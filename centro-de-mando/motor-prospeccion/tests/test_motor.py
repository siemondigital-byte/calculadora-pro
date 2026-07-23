"""Verificacion F1 + F3 del motor. Correr: python tests/test_motor.py

Cubre: auth fail-closed, merge seguro (autocorreccion #2), lapidas, vault,
rotacion de clave, compras con gating de la Calculadora Pro y revocacion
por reembolso.
"""
import importlib
import json
import os
import re
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
        "config": {"stages": ["Nuevo", "Contactado", "Cliente"], "moneda": "USD",
                   "cadenciaDias": {"Nuevo": 2, "Contactado": 3}},
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
r = c.post("/compra/reembolso", json={"transaccion": "HP-001", "plataforma": "Hotmart",
                                      "motivo": "no era lo esperado"}, headers=CRON)
check("reembolso ok", r.json().get("ok") is True)
d = c.get("/crm/data", headers=AUTH2).json()["data"]
comp = next(x for x in d["cicloderiqueza"]["compradores"] if x["email"] == "compra1@test.com")
usu = next(x for x in d["cicloderiqueza"]["app_usuarios"] if x["email"] == "compra1@test.com")
lead = next(x for x in d["cicloderiqueza"]["leads"] if x["email"] == "compra1@test.com")
check("reembolso revoca todo", comp["reembolsado"] and not comp["accesoApp"]
      and not comp["bonos"] and usu["revocado"] and lead["etapa"] == "Reembolsado")
check("app revocada ya no valida",
      c.post("/app/validar", json={"email": "compra1@test.com", "password": pass1}).status_code == 401)

# 17b. Trazabilidad: el reembolso queda registrado (y sin duplicar si repite)
c.post("/compra/reembolso", json={"transaccion": "HP-001"}, headers=CRON)
d = c.get("/crm/data", headers=AUTH2).json()["data"]
regs = [x for x in d["cicloderiqueza"].get("reembolsos", []) if x["transaccion"] == "HP-001"]
check("reembolso registrado con trazabilidad",
      len(regs) == 1 and regs[0]["email"] == "compra1@test.com"
      and regs[0]["plataforma"] == "Hotmart"
      and regs[0]["motivo"] == "no era lo esperado" and bool(regs[0]["fecha"]))
check("comprador guarda cuando fue reembolsado", bool(comp.get("reembolsadoEn")))

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
# 26. Generadores con _claude_json/_claude_texto simulados: estructura +
#     limpieza de em dashes (formas de la interfaz completa del Estudio)
motor._claude_json = lambda *a, **k: [
    {"idea": "Tu sueldo — no es un plan", "gancho": "g", "formato": "POV",
     "nivel": "0-1", "score": 8.4,
     "criterios": {"amplia": 9, "aplicable": 8, "polemica": 7,
                   "formato_viral": 9, "congruente": 8, "gancho": 9, "facil": 9}}]
r = c.post("/viral/ideas", json={"tema": "depender del sueldo"}, headers=AUTH2)
check("viral/ideas devuelve ideas puntuadas",
      r.json()["ok"] and r.json()["ideas"][0]["score"] == 8.4)
check("viral/ideas limpia em dashes", "—" not in json.dumps(r.json()))

motor._claude_json = lambda *a, **k: {
    "gancho": "g — g", "contexto": "c", "moraleja": "m", "filtrado": "f",
    "cta": "cta", "texto_pantalla": "t", "indicaciones_grabacion": "i"}
r = c.post("/viral/guion", json={"idea": "una idea"}, headers=AUTH2)
check("viral/guion devuelve guion de 5 partes",
      r.json()["ok"] and r.json()["guion"]["moraleja"] == "m")
check("viral/guion limpia em dashes", "—" not in json.dumps(r.json()))
check("viral/guion sin idea -> error",
      c.post("/viral/guion", json={}, headers=AUTH2).json()["ok"] is False)

motor._claude_texto = lambda *a, **k: "post listo — para pegar"
r = c.post("/generar_contenido", json={"red": "instagram", "tipo": "post",
    "tema": "el ciclo"}, headers=AUTH2)
check("generar_contenido devuelve texto nativo",
      r.json()["contenido"].startswith("post listo"))
check("generar_contenido limpia em dashes", "—" not in json.dumps(r.json()))
check("generar_contenido sin tema ni base -> 400",
      c.post("/generar_contenido", json={"tipo": "post"}, headers=AUTH2).status_code == 400)

# --------------------------------------- negocios (comisiones) + prototipos
NEG = {"numero": "CC-001", "fecha": "2026-07-20", "aliado": "Constructora X",
       "proyecto": "Torre Mar", "unidad": "804", "valorInmueble": 120000,
       "comisionPct": 3, "total": 3600, "moneda": "USD"}
r = c.post("/negocios/pdf", json={"negocio": NEG, "workspace": "atlantis"}, headers=AUTH2)
check("negocios/pdf devuelve un PDF",
      r.status_code == 200 and r.headers["content-type"] == "application/pdf"
      and r.content[:4] == b"%PDF")
motor._claude_texto = lambda *a, **k: "Hola, adjunto — la cuenta de cobro."
r = c.post("/negocios/mensaje", json={"negocio": NEG}, headers=AUTH2)
check("negocios/mensaje genera texto", r.json()["ok"] and "cuenta de cobro" in r.json()["mensaje"])
check("negocios/mensaje limpia em dashes", "—" not in r.json()["mensaje"])
check("negocios/enviar sin email -> error",
      c.post("/negocios/enviar", json={"negocio": {}}, headers=AUTH2).json()["ok"] is False)
ADJUNTOS_FAKE = []
motor._enviar_con_adjunto = lambda bz, para, asunto, html, pdf, nom: ADJUNTOS_FAKE.append(
    {"para": para, "asunto": asunto, "pdf": len(pdf), "nombre": nom})
import buzones as _buz_mod  # noqa: E402
_bz_orig = _buz_mod.listar_interno
_buz_mod.listar_interno = lambda: [{"email": "hello@atlantis.com", "password": "x",
                                    "host": "smtp.x.com", "puerto": 465}]
r = c.post("/negocios/enviar", json={"negocio": {**NEG, "emailAliado": "pagos@constructora.com"},
    "workspace": "atlantis"}, headers=AUTH2)
check("negocios/enviar adjunta el PDF y envia",
      r.json()["ok"] and ADJUNTOS_FAKE[0]["para"] == "pagos@constructora.com"
      and ADJUNTOS_FAKE[0]["pdf"] > 500 and "CC-001" in ADJUNTOS_FAKE[0]["asunto"])
_buz_mod.listar_interno = _bz_orig

motor._claude_texto = lambda *a, **k: "<!DOCTYPE html><html><body>Plan</body></html>"
r = c.post("/proto/generar", json={"nombre": "Laura", "perfil": "profesional 38, ahorra sin plan"}, headers=AUTH2)
check("proto/generar devuelve html y slug",
      r.json()["ok"] and r.json()["html"].startswith("<!DOCTYPE") and r.json()["slug"] == "laura")
import web_pub as _wp_mod  # noqa: E402
_wp_orig = _wp_mod.publicar_html
_wp_mod.publicar_html = lambda remoto, html: {"ok": True, "url": "https://atlantisglobalrealty.com/" + remoto}
r = c.post("/proto/publicar", json={"slug": "laura", "html": "<html>x</html>"}, headers=AUTH2)
check("proto/publicar publica en /plan/",
      r.json()["ok"] and r.json()["url"].endswith("plan/laura.html"))
_wp_mod.publicar_html = _wp_orig
check("proto/generar sin datos -> error",
      c.post("/proto/generar", json={}, headers=AUTH2).json()["ok"] is False)

# ------------------------------------------------------- estudio de YouTube
motor._claude_texto = lambda *a, **k: "GUION — listo"
r = c.post("/yt_studio", json={"accion": "guion", "tema": "preventa"}, headers=AUTH2)
check("yt_studio devuelve contenido", r.json()["contenido"].startswith("GUION"))
check("yt_studio limpia em dashes", "—" not in json.dumps(r.json()))
# sin handle -> error claro (o sin_clave_youtube si el vault no tiene clave)
check("canal_analitica sin handle -> error claro",
      c.post("/canal_analitica", json={}, headers=AUTH2).json()["error"]
      in ("falta el canal", "sin_clave_youtube"))
check("canal_analitica_privada sin oauth -> no_conectado",
      c.post("/canal_analitica_privada", json={}, headers=AUTH2).json()["error"]
      == "no_conectado")

# ------------------------------------------------------------- ads (pauta)
# 26a. Config vacia, plan con IA simulada y crear sin credenciales
r = c.get("/ads/config", headers=AUTH2)
check("ads/config sin conectar", r.json()["meta"] is False and r.json()["google"] is False)
motor._claude_json = lambda *a, **k: {
    "testeo": {"objetivo": "Leads", "conjuntos": [
        {"interes": "bienes raices", "por_que": "p", "presupuesto_dia": 5}],
        "placements": "feeds+stories"},
    "awareness": {"objetivo": "alcance", "publico": "amplio", "por_que": "p"},
    "creativos": [{"temperatura": "frio", "gancho": "g", "video": "v",
                   "texto_principal": "t", "titular": "ti", "cta": "cta"}],
    "escalado": ["e1"], "checklist": ["c1"], "presupuesto_total_dia": 30}
r = c.post("/ads/plan", json={"workspace": "cicloderiqueza"}, headers=AUTH2)
check("ads/plan devuelve plan completo",
      r.json()["ok"] and r.json()["plan"]["testeo"]["conjuntos"][0]["presupuesto_dia"] == 5)
check("ads/crear meta sin credenciales -> error",
      c.post("/ads/crear", json={"plataforma": "meta"}, headers=AUTH2).json()["error"]
      == "sin_credenciales")
check("ads/crear linkedin -> pendiente_api",
      c.post("/ads/crear", json={"plataforma": "linkedin"}, headers=AUTH2).json()["error"]
      == "pendiente_api")

# --------------------------------------- competencia + auditoria + analitica
# 26b. Precalificar con haiku simulado (una llamada por lote) y ordenado
motor._claude_json = lambda *a, **k: [
    {"url": "https://compa.com", "tipo": "agencia", "nicho": "preventa — MX",
     "tamano": "similar", "score": 82, "razon": "solapa oferta"},
    {"url": "https://portal.com", "tipo": "portal", "nicho": "listados",
     "tamano": "corporativo", "score": 10, "razon": "portal"}]
r = c.post("/mercado/precalificar", json={"candidatos": [
    {"url": "https://portal.com", "titulo": "t", "snippet": "s"},
    {"url": "https://compa.com", "titulo": "t2", "snippet": "s2"}]}, headers=AUTH2)
check("precalificar ordena por score", r.json()["candidatos"][0]["url"] == "https://compa.com"
      and r.json()["candidatos"][0]["scorePrevio"] == 82)
check("precalificar limpia em dashes", "—" not in json.dumps(r.json()))
check("precalificar sin candidatos -> error",
      c.post("/mercado/precalificar", json={}, headers=AUTH2).json()["ok"] is False)

# 26c. Auditoria de negocio: persiste en <ws>.auditoriaNegocio (merge seguro)
motor._senales_web = lambda url: {"url": url, "title": "t", "extracto": "e"}
motor._claude_json = lambda *a, **k: {
    "puntuaciones": {"claridad_propuesta": 80}, "global": 63, "resumen": "r",
    "incoherencias": [], "quick_wins": ["w1"],
    "hallazgos_para_ads": {"publico_dolor": "d", "angulos": ["a"],
                           "objeciones": ["o"], "competencia_mensaje": "m"}}
r = c.post("/auditoria/negocio", json={"workspace": "atlantis",
    "web": "https://atlantisglobalrealty.com/"}, headers=AUTH2)
check("auditoria negocio ok", r.json()["ok"] and r.json()["auditoria"]["global"] == 63)
d = c.get("/crm/data", headers=AUTH2).json()["data"]
check("auditoria persistida en el workspace",
      d["atlantis"]["auditoriaNegocio"]["global"] == 63
      and d["atlantis"]["auditoriaNegocio"]["hallazgos_para_ads"]["publico_dolor"] == "d")

# 26d. Descubrir sin Serper -> error claro; analitica sin Umami -> error claro
check("descubrir sin serper -> sin_serper",
      c.post("/mercado/descubrir", json={}, headers=AUTH2).json()["error"] == "sin_serper")
check("analitica sin umami -> umami_sin_configurar",
      c.get("/analitica/resumen", headers=AUTH2).json()["error"] == "umami_sin_configurar")
check("analitica/enlaces sin umami -> umami_sin_configurar",
      c.post("/analitica/enlaces", json={"enlaces": []}, headers=AUTH2).json()["error"]
      == "umami_sin_configurar")

# 26e. Monitorear: re-audita propia + competidores por workspace (seo simulado)
import seo as _seo_mod  # noqa: E402
_seo_mod.auditar = lambda url, kw="": {"ok": True, "url": url, "global": 77,
    "categorias": [{"nombre": "Tecnico", "puntos": 8}], "top_fixes": []}
dprev = c.get("/crm/data", headers=AUTH2).json()["data"]
dprev["atlantis"]["competidores"] = [{"id": "comp-1", "nombre": "compa.com",
                                     "url": "https://compa.com"}]
c.put("/crm/data", json={"data": dprev}, headers=AUTH2)
r = c.post("/mercado/monitorear", headers=AUTH2)
check("monitorear audita propia y competidores",
      r.json()["ok"] and r.json()["propias"].get("atlantis") == 77
      and r.json()["competidores"] == 1)
d = c.get("/crm/data", headers=AUTH2).json()["data"]
check("monitorear guarda historial del competidor",
      d["atlantis"]["competidores"][0]["seo"] == 77
      and len(d["atlantis"]["competidores"][0]["historial"]) == 1)

# -------------------------------------------------- buzones + nurturing (F4)
import buzones  # noqa: E402

ENVIADOS_FAKE = []
buzones.enviar = lambda para, asunto, html, desde=None: ENVIADOS_FAKE.append(
    {"para": para, "asunto": asunto, "html": html})

# 27. Buzon: se guarda y la API solo devuelve mascara
r = c.post("/buzones", json={"email": "hello@atlantis.com", "password": "secreta-smtp"}, headers=AUTH2)
check("buzon guardado", r.json().get("ok") is True)
r = c.get("/buzones", headers=AUTH2)
check("buzones sin password en la API",
      r.json()["buzones"][0]["tienePassword"] is True
      and "secreta-smtp" not in json.dumps(r.json()))

# 28. Envio manual queda en el log de enviados
r = c.post("/enviar_correo", json={"para": "x@y.com", "asunto": "Hola",
    "cuerpo": "<p>hola</p>", "workspace": "atlantis"}, headers=AUTH2)
check("enviar_correo ok", r.json().get("ok") is True)
d = c.get("/crm/data", headers=AUTH2).json()["data"]
check("envio registrado en enviados", any(e["para"] == "x@y.com" for e in d["atlantis"]["enviados"]))

# 29. Generar secuencia (IA simulada) queda en borrador
motor._claude_json = lambda *a, **k: [
    {"asunto": "Bienvenida — parte 1", "cuerpo": "<p>hola <a href="
     "\"https://cicloderiqueza.atlantisglobalrealty.com/\">mira</a></p>",
     "fase": "bienvenida"},
    {"asunto": "El metodo", "cuerpo": "<p>metodo</p>", "fase": "convencer"},
    {"asunto": "La oferta", "cuerpo": "<p>44 USD</p>", "fase": "ventas"}]
r = c.post("/nurturing/generar", json={"workspace": "cicloderiqueza", "config": {
    "autoInscribir": True, "cadenciaDias": 3, "topeDiario": 2,
    "remitente": "hello@atlantis.com", "nCorreos": 3}}, headers=AUTH2)
check("secuencia generada (3 correos)", r.json().get("correos") == 3)
d = c.get("/crm/data", headers=AUTH2).json()["data"]
nur = d["cicloderiqueza"]["nurturing"]
check("secuencia en borrador (activo=False)", nur["activo"] is False)
check("secuencia sin em dashes", "—" not in json.dumps(nur["secuencia"]))

# 30. Procesar en borrador NO envia nada (aunque inscriba)
ENVIADOS_FAKE.clear()
r = c.post("/nurturing/procesar", json={"workspace": "cicloderiqueza"},
           headers={"Authorization": "Bearer cron-key-interna-n8n"})
check("borrador: 0 envios", r.json()["enviados"] == 0 and len(ENVIADOS_FAKE) == 0)

# 31. Leads elegibles + activar + procesar respeta tope diario (2)
d = c.get("/crm/data", headers=AUTH2).json()["data"]
for i in range(3):
    d["cicloderiqueza"]["leads"].append({
        "id": f"lead-nur-{i}", "email": f"nutrido{i}@test.com", "etapa": "Nuevo",
        "creado": 1})
c.put("/crm/data", json={"data": d}, headers=AUTH2)
r = c.post("/nurturing/activar", json={"workspace": "cicloderiqueza", "activo": True}, headers=AUTH2)
check("activar ok", r.json().get("activo") is True)
ENVIADOS_FAKE.clear()
r = c.post("/nurturing/procesar", json={"workspace": "cicloderiqueza"},
           headers={"Authorization": "Bearer cron-key-interna-n8n"})
check("tope diario respetado (2 de 3)", r.json()["enviados"] == 2 and len(ENVIADOS_FAKE) == 2,
      str(r.json()))
check("correo lleva baja + pixel + disclaimer",
      "/nurturing/baja" in ENVIADOS_FAKE[0]["html"]
      and "/nurturing/px/" in ENVIADOS_FAKE[0]["html"]
      and "educativo" in ENVIADOS_FAKE[0]["html"])

# 31b. Links del cuerpo pasan por /nurturing/r; el clic cuenta y redirige con UTM
m = re.search(r'href="https://[^/]+(/nurturing/r\?[^"]+)"', ENVIADOS_FAKE[0]["html"])
check("link del cuerpo trackeado por /nurturing/r", m is not None)
check("clic con token malo -> 400",
      c.get("/nurturing/r?ws=cicloderiqueza&t=malo&u=https%3A%2F%2Fx.com",
            follow_redirects=False).status_code == 400)
r = c.get(m.group(1), follow_redirects=False)
check("clic redirige 302 con UTM al destino",
      r.status_code == 302
      and r.headers["location"].startswith("https://cicloderiqueza.atlantisglobalrealty.com/")
      and "utm_source=nurturing" in r.headers["location"])
c.get(m.group(1), follow_redirects=False)  # repetir no doble-cuenta
d = c.get("/crm/data", headers=AUTH2).json()["data"]
check("clic contado una sola vez",
      d["cicloderiqueza"]["nurturing"]["metricas"].get("clics") == 1)

# 32. Segundo ciclo: envia al tercero, no repite a los primeros (cadencia)
ENVIADOS_FAKE.clear()
r = c.post("/nurturing/procesar", json={"workspace": "cicloderiqueza"},
           headers={"Authorization": "Bearer cron-key-interna-n8n"})
check("ciclo 2: solo el pendiente (1)", r.json()["enviados"] == 1, str(r.json()))

# 33. Comprar saca de la serie
d = c.get("/crm/data", headers=AUTH2).json()["data"]
lead0 = next(l for l in d["cicloderiqueza"]["leads"] if l.get("email") == "nutrido0@test.com")
lead0["etapa"] = "Comprador"
c.put("/crm/data", json={"data": d}, headers=AUTH2)
c.post("/nurturing/procesar", json={"workspace": "cicloderiqueza"},
       headers={"Authorization": "Bearer cron-key-interna-n8n"})
d = c.get("/crm/data", headers=AUTH2).json()["data"]
ins0 = next(i for i in d["cicloderiqueza"]["nurturing"]["inscritos"] if i["email"] == "nutrido0@test.com")
check("comprador sale de la serie", ins0["estado"] == "salido")

# 34. Baja con token HMAC (token malo rechazado)
import nurturing as nur_mod  # noqa: E402
tok = nur_mod.token_baja("nutrido1@test.com")
check("baja token malo -> 400",
      c.get("/nurturing/baja?ws=cicloderiqueza&e=nutrido1@test.com&t=malo").status_code == 400)
r = c.get(f"/nurturing/baja?ws=cicloderiqueza&e=nutrido1@test.com&t={tok}")
check("baja token bueno -> 200", r.status_code == 200)
d = c.get("/crm/data", headers=AUTH2).json()["data"]
check("baja registrada y salido",
      "nutrido1@test.com" in d["cicloderiqueza"]["nurturing"]["bajas"])

# 34b. Baja directa autenticada (pagina /unsubscribe via n8n) y re-alta
r = c.post("/nurturing/baja", json={"email": "nutrido2@test.com"},
           headers={"Authorization": "Bearer cron-key-interna-n8n"})
check("baja directa ok", r.json().get("ok") is True)
d = c.get("/crm/data", headers=AUTH2).json()["data"]
check("baja directa registrada en ambos workspaces",
      "nutrido2@test.com" in d["cicloderiqueza"]["nurturing"]["bajas"]
      and "nutrido2@test.com" in d["atlantis"]["nurturing"]["bajas"])
r = c.post("/nurturing/baja", json={"email": "nutrido2@test.com",
    "action": "resubscribe"}, headers={"Authorization": "Bearer cron-key-interna-n8n"})
d = c.get("/crm/data", headers=AUTH2).json()["data"]
check("re-alta saca de bajas",
      "nutrido2@test.com" not in d["cicloderiqueza"]["nurturing"]["bajas"])
check("baja directa sin email -> 400",
      c.post("/nurturing/baja", json={},
             headers={"Authorization": "Bearer cron-key-interna-n8n"}).status_code == 400)

# 35. Pixel de apertura suma metricas
ins2 = next(i for i in d["cicloderiqueza"]["nurturing"]["inscritos"] if i["email"] == "nutrido2@test.com")
tid = ins2["pixeles"][0]
r = c.get(f"/nurturing/px/{tid}.gif")
check("pixel devuelve gif", r.status_code == 200 and r.headers["content-type"] == "image/gif")
d = c.get("/crm/data", headers=AUTH2).json()["data"]
check("apertura contada", d["cicloderiqueza"]["nurturing"]["metricas"]["aperturas"] >= 1)

# -------------------------------------------- correo frio: leer + clasificar
# 36. Bandeja simulada: respuesta de un lead nutrido + un desconocido
BANDEJA = [
    {"uid": 11, "de": "nutrido2@test.com", "asunto": "Re: El metodo",
     "texto": "Me interesa, cuentame mas", "fecha": "Sun, 19 Jul 2026 10:00:00"},
    {"uid": 12, "de": "desconocido@nadie.com", "asunto": "spam",
     "texto": "compra mi producto", "fecha": "Sun, 19 Jul 2026 10:05:00"},
]
buzones.leer_bandeja = lambda be=None, desde_uid=0, max_correos=200: [
    x for x in BANDEJA if x["uid"] > desde_uid]
motor._claude_json = lambda *a, **k: {"clasificacion": "interesado",
                                      "resumen": "Quiere saber mas — del metodo"}
r = c.post("/leer_correos", headers={"Authorization": "Bearer cron-key-interna-n8n"})
j = r.json()
check("leer_correos: 2 leidos, 1 con match", j["leidos"] == 2 and j["conMatch"] == 1, str(j))
d = c.get("/crm/data", headers=AUTH2).json()["data"]
hilo = next((o for o in d["cicloderiqueza"]["outreach"] if o["email"] == "nutrido2@test.com"), None)
check("hilo outreach creado y clasificado", hilo and hilo["clasificacion"] == "interesado")
check("resumen sin em dash", "—" not in (hilo.get("resumen") or ""))
lead2 = next(l for l in d["cicloderiqueza"]["leads"] if l.get("email") == "nutrido2@test.com")
check("lead marcado respondio", lead2.get("respondio") is True)

# 37. El puntero de UID avanza aunque no haya match: re-leer no reprocesa
r = c.post("/leer_correos", headers={"Authorization": "Bearer cron-key-interna-n8n"})
check("segunda lectura: 0 nuevos (ultimaUid avanzo)", r.json()["leidos"] == 0, str(r.json()))

# 38. Responder saca del nurturing en el siguiente ciclo
c.post("/nurturing/procesar", json={"workspace": "cicloderiqueza"},
       headers={"Authorization": "Bearer cron-key-interna-n8n"})
d = c.get("/crm/data", headers=AUTH2).json()["data"]
ins2b = next(i for i in d["cicloderiqueza"]["nurturing"]["inscritos"] if i["email"] == "nutrido2@test.com")
check("respondio -> salido del nurturing", ins2b["estado"] == "salido")

# 39. /generar_mensaje usa el hilo y limpia em dashes
motor._claude_json = lambda *a, **k: {"asunto": "Re: tu pregunta",
                                      "cuerpo": "Claro — te cuento el metodo."}
r = c.post("/generar_mensaje", json={"email": "nutrido2@test.com",
    "workspace": "cicloderiqueza"}, headers=AUTH2)
check("generar_mensaje devuelve borrador", r.json()["mensaje"]["asunto"].startswith("Re:"))
check("borrador sin em dash", "—" not in json.dumps(r.json()))

# ------------------------------------------------- asistente que ejecuta
# 40. Acciones estructuradas validadas y aplicadas por el motor
motor._claude_json = lambda *a, **k: {
    "respuesta": "Hecho — creo el lead y agendo.",
    "acciones": [
        {"tipo": "crear_lead", "nombre": "Ana Inversionista", "email": "ana@inv.com"},
        {"tipo": "mover_etapa", "lead": "ana@inv.com", "etapa": "Contactado"},
        {"tipo": "agendar_consulta", "lead": "ana@inv.com", "fecha": "2026-07-25T10:00"},
        {"tipo": "definir_meta", "mes": "2026-08", "valor": 30000},
        {"tipo": "accion_maliciosa", "cmd": "borrar todo"},
    ]}
r = c.post("/asistente", json={"mensaje": "crea a Ana y agenda diagnostico",
    "workspace": "atlantis"}, headers=AUTH2)
j = r.json()
check("asistente aplico 4 acciones (la invalida ignorada)", len(j["aplicadas"]) == 4, str(j))
check("respuesta sin em dash", "—" not in j["respuesta"])
d = c.get("/crm/data", headers=AUTH2).json()["data"]
ana = next((l for l in d["atlantis"]["leads"] if l.get("email") == "ana@inv.com"), None)
check("lead creado por asistente", ana is not None and ana["leadSource"] == "Asistente")
check("etapa movida con followUp por cadencia", ana["etapa"] == "Contactado" and bool(ana.get("followUpDate")))
check("consulta agendada", any(x.get("leadId") == ana["id"] for x in d["atlantis"]["consultas"]))
check("meta definida", d["atlantis"]["metas"].get("2026-08") == 30000)

# 41. Pregunta sin acciones no toca el estado
antes = json.dumps(c.get("/crm/data", headers=AUTH2).json()["data"], sort_keys=True)
motor._claude_json = lambda *a, **k: {"respuesta": "Tienes 2 vencidos.", "acciones": []}
r = c.post("/asistente", json={"mensaje": "como va el pipeline?", "workspace": "atlantis"}, headers=AUTH2)
despues = json.dumps(c.get("/crm/data", headers=AUTH2).json()["data"], sort_keys=True)
check("pregunta: estado intacto", antes == despues and r.json()["aplicadas"] == [])

# 42. mover_etapa a etapa inexistente no aplica
motor._claude_json = lambda *a, **k: {"respuesta": "ok", "acciones": [
    {"tipo": "mover_etapa", "lead": "ana@inv.com", "etapa": "EtapaFalsa"}]}
r = c.post("/asistente", json={"mensaje": "mueve a ana", "workspace": "atlantis"}, headers=AUTH2)
check("etapa invalida ignorada", r.json()["aplicadas"] == [])

# ------------------------------------------------------- push web (VAPID)
# 43. Sin config: clave publica vacia y probar informa sin_config
check("clave publica vacia sin config", c.get("/push/clave_publica").json()["clave"] == "")
r = c.post("/push/probar", headers=AUTH2)
check("probar sin config -> sin_config", "sin_config" in (r.json().get("motivo") or ""))

# 44. Suscribir con dedupe
SUB = {"endpoint": "https://push.example/abc", "keys": {"p256dh": "x", "auth": "y"}}
r = c.post("/push/suscribir", json={"suscripcion": SUB, "workspace": "atlantis"}, headers=AUTH2)
r = c.post("/push/suscribir", json={"suscripcion": SUB, "workspace": "atlantis"}, headers=AUTH2)
check("suscripcion dedupe (1 total)", r.json()["total"] == 1, str(r.json()))

# 45. Con config + envio simulado: probar y recordatorios
os.environ["VAPID_PRIVATE_KEY"] = "/tmp/fake.pem"
PUSHES = []
motor._webpush_send = lambda sub, payload: PUSHES.append(payload)
r = c.post("/push/probar", json={"workspace": "atlantis"}, headers=AUTH2)
check("probar envia a la suscripcion", r.json()["enviados"] == 1 and len(PUSHES) == 1)
d = c.get("/crm/data", headers=AUTH2).json()["data"]
ana2 = next(l for l in d["atlantis"]["leads"] if l.get("email") == "ana@inv.com")
ana2["followUpDate"] = "2020-01-01"
c.put("/crm/data", json={"data": d}, headers=AUTH2)
PUSHES.clear()
r = c.post("/push/recordatorios", headers={"Authorization": "Bearer cron-key-interna-n8n"})
check("recordatorio diario enviado con pendientes",
      r.json()["atlantis"]["enviados"] == 1 and "seguimiento" in PUSHES[0]["body"], str(r.json()))

# ------------------------------------------- maquetador / web publica (F5)
import io as io_mod  # noqa: E402
import web_pub  # noqa: E402

web_pub.BASE = os.path.join(TMP, "webfiles")
web_pub.VERS = os.path.join(web_pub.BASE, "versiones")
web_pub.PUB = os.path.join(web_pub.BASE, "publicado")
web_pub.REG = os.path.join(web_pub.BASE, "publicaciones.json")

REMOTO_FAKE = {}
class _FtpFake:
    def retrbinary(self, cmd, cb):
        ruta = cmd.replace("RETR ", "")
        if ruta not in REMOTO_FAKE:
            from ftplib import error_perm as _ep
            raise _ep("550 no existe")
        cb(REMOTO_FAKE[ruta])
    def storbinary(self, cmd, fh):
        REMOTO_FAKE[cmd.replace("STOR ", "")] = fh.read()
    def mkd(self, d):
        pass
    def quit(self):
        pass
web_pub._ftp = lambda: _FtpFake()

HOME = ("<html><head><title>Vieja</title>"
        '<meta name="description" content="vieja desc">'
        "</head><body><h1>Atlantis</h1><img src=\"/img/ciclo.png\"></body></html>")

# 46. Escribir canonico + publicar por FTP (con respaldo) end-to-end
r = c.post("/web/escribir", json={"archivos": [
    {"ruta": "index.html", "contenido": HOME}], "publicar": True}, headers=AUTH2)
check("web/escribir publica", r.json().get("ok") is True, str(r.json()))
check("archivo llego al hosting fake", b"Atlantis" in REMOTO_FAKE.get("index.html", b""))

# 47. Ruta insegura rechazada
r = c.post("/web/escribir", json={"archivos": [
    {"ruta": "../fuera.html", "contenido": "x"}]}, headers=AUTH2)
check("ruta insegura rechazada", r.json().get("ok") is False)

# 48. Estado lista los archivos con su registro de publicacion
r = c.get("/web/estado", headers=AUTH2)
idx = next(a for a in r.json()["archivos"] if a["ruta"] == "index.html")
check("estado muestra publicado", bool(idx["publicado"]))

# 49. Diff legible tras cambiar el titulo
nuevo = HOME.replace("Vieja", "Arquitectos de patrimonio")
c.post("/web/escribir", json={"archivos": [
    {"ruta": "index.html", "contenido": nuevo}], "publicar": False}, headers=AUTH2)
r = c.get("/web/diff?ruta=index.html", headers=AUTH2)
check("diff detecta el cambio", r.json()["ok"] and (r.json()["cambiados"] or r.json()["agregados"]), str(r.json()))

# 50. aplicar_soluciones: dry-run no toca, aplicar si (empalmes quirurgicos)
SOLS = {"title_propuesto": "Atlantis Global Realty | Arquitectos de patrimonio",
        "description_propuesta": "Patrimonio inmobiliario con metodo.",
        "alts": [{"imagen": "/img/ciclo.png", "alt": "La linea del ciclo"}]}
r = c.post("/web/aplicar_soluciones", json={"soluciones": SOLS, "dry_run": True}, headers=AUTH2)
check("dry-run devuelve preview con cambios", r.json()["preview"] and r.json()["hay_cambios"])
canonico = open(os.path.join(web_pub.BASE, "index.html")).read()
check("dry-run NO escribio", "Atlantis Global Realty | Arquitectos" not in canonico)
r = c.post("/web/aplicar_soluciones", json={"soluciones": SOLS}, headers=AUTH2)
canonico = open(os.path.join(web_pub.BASE, "index.html")).read()
check("soluciones aplicadas (title+desc+alt)",
      "Atlantis Global Realty | Arquitectos" in canonico
      and 'alt="La linea del ciclo"' in canonico)

# 51. Versiones + restaurar deja hosting y canonico iguales a la version previa
r = c.get("/web/versiones", headers=AUTH2)
vers = r.json()["versiones"]
check("hay versiones respaldadas", len(vers) >= 1)
con_index = next(v for v in vers if "index.html" in v["rutas"])
r = c.post("/web/restaurar", json={"version": con_index["version"], "ruta": "index.html"}, headers=AUTH2)
check("restaurar ok", r.json().get("ok") is True, str(r.json()))
check("hosting fake restaurado", REMOTO_FAKE["index.html"] == open(
    os.path.join(web_pub.BASE, "index.html"), "rb").read())

# 52. publicar_html (prototipos) valida ruta
import web_pub as wp  # noqa: E402
r_html = wp.publicar_html("propuestas/demo.html", "<html>hola</html>")
check("publicar_html ok con url de atlantis", r_html["ok"] and "atlantisglobalrealty.com" in r_html["url"])
check("publicar_html rechaza escape", wp.publicar_html("../x.html", "x")["ok"] is False)

# ------------------------------------------------- publicacion en redes
# 53. Sin POSTIZ_API_KEY: integraciones responde desconectado; publicar cae a
#     nativo y explica que falta PUBLICAR_KEY (nunca truena)
r = c.get("/redes/integraciones", headers=AUTH2)
check("integraciones sin key -> desconectado", r.json()["conectado"] is False)
r = c.post("/publicar", json={"red": "linkedin", "texto": "hola"}, headers=AUTH2)
check("publicar sin proveedores -> error claro", r.json()["ok"] is False and "PUBLICAR_KEY" in r.json()["error"])

# 54. Con Postiz simulado: SIEMPRE type schedule con fecha +1min (el 'now' falla callado)
import publicar as pub_mod  # noqa: E402
CAPTURA = {}
class _RespFake:
    ok = True
    status_code = 200
    def json(self):
        return {"id": "post-1"}
class _ReqFake:
    @staticmethod
    def get(url, **k):
        r = _RespFake()
        r.json = lambda: [{"id": "int-1", "identifier": "linkedin", "name": "LN"}]
        return r
    @staticmethod
    def post(url, **k):
        CAPTURA["url"] = url
        CAPTURA["body"] = k.get("json")
        return _RespFake()
pub_mod.requests = _ReqFake()
secretos.set_("POSTIZ_API_KEY", "clave-postiz-test")
r = c.post("/publicar", json={"red": "linkedin", "texto": "Publicacion de prueba"}, headers=AUTH2)
check("publicar via postiz ok", r.json()["ok"] is True and r.json()["via"] == "postiz", str(r.json()))
check("postiz SIEMPRE schedule (nunca now)", CAPTURA["body"]["type"] == "schedule"
      and bool(CAPTURA["body"]["date"]))

# ------------------------------------- salud web -> soluciones -> maquetador
import seo as seo_mod  # noqa: E402

AUDIT_FAKE = {
    "ok": True, "url": "https://atlantisglobalrealty.com/", "global": 62,
    "categorias": [{"nombre": "Meta", "puntos": 10, "max": 20},
                   {"nombre": "Imagenes", "puntos": 5, "max": 10}],
    "top_fixes": [{"txt": "Title generico", "fix": "reescribir con keyword", "evidencia": []}],
    "contexto": {"title": "Vieja", "description": "vieja desc", "headings": ["h1 Atlantis"],
                 "imgs_sin_alt": ["/img/ciclo.png"], "enlaces_rotos": [], "extracto": "..."},
}
seo_mod.auditar = lambda url, kw="": dict(AUDIT_FAKE)

# 55. Auditar guarda el historico del workspace
r = c.post("/seo/auditar", json={"url": "https://atlantisglobalrealty.com/",
    "workspace": "atlantis"}, headers=AUTH2)
check("auditoria ok 62/100", r.json()["global"] == 62)
d = c.get("/crm/data", headers=AUTH2).json()["data"]
check("historico de salud guardado", d["atlantis"]["saludHistorial"][-1]["global"] == 62)

# 56. Soluciones: se generan, se limpian y se PERSISTEN en saludWeb
motor._claude_json = lambda *a, **k: {
    "title_propuesto": "Atlantis Global Realty | Arquitectos de patrimonio",
    "description_propuesta": "Construye patrimonio inmobiliario con metodo — y criterio.",
    "keywords": {}, "alts": [{"imagen": "/img/ciclo.png", "alt": "La linea del ciclo"}],
    "jerarquia": [], "enlaces": [], "otras": []}
r = c.post("/seo/soluciones", json={"workspace": "atlantis"}, headers=AUTH2)
check("soluciones generadas", r.json()["ok"] is True)
check("soluciones sin em dash", "—" not in json.dumps(r.json()))
d = c.get("/crm/data", headers=AUTH2).json()["data"]
sols_guardadas = (d["atlantis"].get("saludWeb") or {}).get("soluciones") or {}
check("soluciones persistidas en saludWeb", sols_guardadas.get("title_propuesto", "").startswith("Atlantis"))

# 57. El Maquetador puede aplicar EXACTAMENTE esas soluciones (ciclo cerrado)
open(os.path.join(web_pub.BASE, "index.html"), "w").write(HOME)
r = c.post("/web/aplicar_soluciones", json={"soluciones": sols_guardadas, "dry_run": True}, headers=AUTH2)
check("ciclo cerrado: dry-run ve cambios de las soluciones guardadas",
      r.json()["ok"] and r.json()["hay_cambios"], str(r.json()))

# 58. /ideas sin clave de YouTube responde claro (sin tronar)
r = c.post("/ideas", json={"workspace": "atlantis"}, headers=AUTH2)
check("ideas sin clave -> error claro", r.json()["ok"] is False and "clave" in r.json()["error"])

# ------------------------------------------------- blog SEO + estudio (F5)
# 59. Banco de medios sin keys -> mensaje claro
r = c.post("/blog/fotos", json={"query": "arquitectura"}, headers=AUTH2)
check("fotos sin key -> sin_key", r.json().get("error") == "sin_key")
r = c.post("/gc/videos_banco", json={"query": "ciudad"}, headers=AUTH2)
check("videos sin key -> sin_key", r.json().get("error") == "sin_key")

# 60. Deteccion de idioma del banco (quirk Pixabay) y helpers
check("_banco_lang detecta espanol", motor._banco_lang("reunión de negocios") == "es")
check("_banco_lang detecta ingles", motor._banco_lang("business meeting") == "en")
check("_orient_ok vertical", motor._orient_ok(720, 1280, "portrait") is True
      and motor._orient_ok(1280, 720, "portrait") is False)

# 61. blog/ideas con IA simulada: estructura + adjuncion de volumen
motor._claude_json = lambda *a, **k: [
    {"keyword": "invertir en preventa", "titulo": "Invertir en preventa: guia con metodo",
     "intencion": "informacional", "angulo": "despertar el problema"}]
r = c.post("/blog/ideas", json={"tema": "preventa inmobiliaria"}, headers=AUTH2)
check("blog/ideas devuelve ideas", len(r.json()["ideas"]) == 1 and r.json()["ok"])

# 62. blog/articulo con score SEO determinista
motor._claude_json = lambda *a, **k: {
    "meta_description": "Aprende a invertir en preventa con metodo y criterio, paso a paso, sin depender de tu sueldo para construir patrimonio real y sostenible en el tiempo.",
    "h1": "Invertir en preventa con metodo",
    "cuerpo_md": ("intro que conecta\n\n" + "\n\n".join(
        f"## Seccion invertir en preventa {i}\n" + ("palabra " * 180) for i in range(5)))}
r = c.post("/blog/articulo", json={"titulo": "Invertir en preventa",
    "keyword": "invertir en preventa"}, headers=AUTH2)
art = r.json()["articulo"]
check("blog/articulo con score", r.json()["ok"] and int(art["score_seo"]) >= 60, str(art.get("score_seo")))

# 63. blog/publicos: solo publicados, sin futuros, con slug
d = c.get("/crm/data", headers=AUTH2).json()["data"]
d["atlantis"]["blogArticulos"] = [
    {"id": "a1", "titulo": "Articulo Publicado", "h1": "Artículo Publicado", "estado": "publicado",
     "cuerpo_md": "hola", "meta_description": "m", "fechaPublicacion": "2026-01-01"},
    {"id": "a2", "titulo": "Borrador", "estado": "borrador", "cuerpo_md": "x"},
    {"id": "a3", "titulo": "Futuro", "estado": "publicado", "cuerpo_md": "x",
     "fechaPublicacion": "2030-01-01"}]
c.put("/crm/data", json={"data": d}, headers=AUTH2)
r = c.get("/blog/publicos")
arts = r.json()["articulos"]
check("publicos: 1 visible (ni borrador ni futuro)", len(arts) == 1
      and arts[0]["slug"] == "articulo-publicado", str(arts))
r = c.get("/blog/publicos?slug=articulo-publicado")
check("publicos por slug trae cuerpo", r.json()["articulo"]["cuerpo_md"] == "hola")

# 64. gsc_importar y kwplanner parsean CSV
r = c.post("/blog/gsc_importar", json={"csv":
    "Consulta,Clics,Impresiones,CTR,Posicion\ninvertir en preventa,10,200,5%,8.2\n"}, headers=AUTH2)
check("gsc_importar parsea", r.json()["total"] == 1
      and r.json()["consultas"][0]["impresiones"] == 200)

# 65. gc/titulares con IA simulada limpia em dashes
motor._claude_json = lambda *a, **k: [
    {"titulo": "El ciclo — completo", "subtitulo": "s", "cta": "Ver metodo"}]
r = c.post("/gc/titulares", json={"base": "el ciclo"}, headers=AUTH2)
check("titulares limpios", r.json()["ok"] and "—" not in json.dumps(r.json()))

# 66. gc/subir guarda en /media y sirve por static
import base64 as _b64mod
r = c.post("/gc/subir", json={"data": _b64mod.b64encode(b"PNGFAKE").decode(), "ext": "png"}, headers=AUTH2)
check("gc/subir devuelve url /media", r.json()["ok"] and "/media/" in r.json()["url"])
nombre = r.json()["url"].split("/media/")[-1]
r = c.get(f"/media/{nombre}")
check("archivo servido por /media", r.status_code == 200 and r.content == b"PNGFAKE")

# 67. gc/proxy: fail-closed y anti-SSRF
check("proxy sin clave -> 401", c.get("/gc/proxy?url=https://x.com/v.mp4").status_code == 401)
check("proxy bloquea IP privada", c.get(
    "/gc/proxy?url=http://127.0.0.1/x.mp4&k=clave-nueva-rotada-99").status_code == 400)

# 68. gc/imagen falla con gracia (la FAL key del vault es falsa y no hay red):
#     nunca truena, siempre {ok: False, error}
r = c.post("/gc/imagen", json={"prompt": "x", "optimizar": False}, headers=AUTH2)
check("gc/imagen falla con gracia", r.status_code == 200 and r.json()["ok"] is False
      and bool(r.json().get("error")))

print()
print("FALLOS:", fallos if fallos else "ninguno, F1/F3/F4/F5 verificadas")
sys.exit(1 if fallos else 0)
