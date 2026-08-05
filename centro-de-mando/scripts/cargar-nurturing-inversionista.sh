#!/usr/bin/env bash
# Carga y ACTIVA la campana de nurturing "Inversionista" (aprobada el 23 jul
# 2026, docs/secuencias-nurturing-atlantis.md) en el workspace atlantis:
#
#   1. Registra el buzon de envio Brevo en el motor (From contact@, login del
#      relay, solo-envio). Pide la SMTP key en el momento; va al vault del motor.
#   2. Prueba la conexion SMTP del buzon.
#   3. Carga la secuencia de 5 correos + config (auto-inscripcion SOLO de leads
#      de la guia, cadencia 3 dias, tope 30) y la activa.
#   4. Corre un ciclo de procesar para inscribir a los leads existentes.
#
# Correr EN EL VPS desde /root/atlantis/centro-de-mando (motor ya reconstruido):
#
#   bash scripts/cargar-nurturing-inversionista.sh
set -euo pipefail

CONT=$(docker ps --format '{{.Names}}' | grep -m1 '^centro-de-mando-motor' || true)
[ -n "$CONT" ] || { echo "ERROR: no encuentro el contenedor centro-de-mando-motor"; exit 1; }

read -s -p "SMTP key de Brevo (la misma de n8n): " BREVO_KEY; echo

docker exec -i -e BREVO_KEY="$BREVO_KEY" "$CONT" python3 - <<'PY'
import os

import httpx

BASE = "http://127.0.0.1:8000"
H = {"Authorization": "Bearer " + os.environ["CRON_KEY"]}

SEQ = [
  {"fase": "bienvenida", "asunto": "Tu guía y la tesis detrás de cada mercado", "cuerpo":
   "<p>Hola, aquí tienes la guía: "
   "<a href=\"https://atlantisglobalrealty.com/download/guia-inversion.pdf\">Dónde invertir en 2026</a>.</p>"
   "<p>No la leas como un listado de ciudades. Léela como una tesis: por qué cada mercado está donde está, "
   "qué lo impulsa y qué lo puede frenar.</p>"
   "<p>Invertir con estructura empieza por entender el porqué, no por perseguir el dónde.</p>"
   "<p>Si un mercado te llama la atención, responde este correo y te contamos qué estamos viendo ahí.</p>"},
  {"fase": "convencer", "asunto": "Las métricas que importan (y las que distraen)", "cuerpo":
   "<p>Hola, dos números valen más que cualquier folleto:</p>"
   "<p>La rentabilidad sobre tu capital propio, no sobre el precio del inmueble. Y tu capacidad real de "
   "endeudamiento, calculada con tus ingresos y deudas de hoy.</p>"
   "<p>Importante: los rendimientos que ves en proyectos son proyecciones del constructor. Se verifican, "
   "se comparan y se estresan. No se prometen.</p>"
   "<p>¿Quieres que calculemos tus dos números? Es parte del diagnóstico sin costo.</p>"},
  {"fase": "convencer", "asunto": "Cómo filtramos lo que te mostramos", "cuerpo":
   "<p>Hola, cada mes revisamos proyectos y descartamos la mayoría.</p>"
   "<p>Los filtros: constructora con trayectoria verificable, estructura de pagos sana, zona con demanda "
   "real y precio de entrada coherente con el mercado.</p>"
   "<p>Lo que pasa el filtro entra a nuestra selección. Si quieres recibirla cuando salga, responde este "
   "correo con la palabra \"selección\".</p>"},
  {"fase": "convencer", "asunto": "Preventa y estructura: cómo funciona de verdad", "cuerpo":
   "<p>Hola, la compra sobre planos tiene una lógica propia.</p>"
   "<p>Entras con una cuota inicial fraccionada, sin intereses, directamente con la constructora. El "
   "crédito hipotecario, si lo necesitas, llega al final, sobre el saldo. Eso cambia el capital que "
   "necesitas hoy.</p>"
   "<p>También tiene riesgos: cambiario si inviertes en otra moneda, y de constructora si no se verifica "
   "bien. Por eso el filtro previo no es opcional.</p>"},
  {"fase": "ventas", "asunto": "Hablemos de tu portafolio", "cuerpo":
   "<p>Hola, el último paso de esta serie es una invitación.</p>"
   "<p>Una videollamada de 30 minutos para revisar tu punto de partida: capital, capacidad, horizonte y "
   "qué estructura tiene sentido para ti. Es un diagnóstico, no una venta.</p>"
   "<p><a href=\"https://atlantisglobalrealty.com/book-videocall.html\">Agenda aquí tu videollamada</a>.</p>"
   "<p>El equipo de Atlantis Global Realty.</p>"},
]

with httpx.Client(timeout=40) as c:
    # 1. buzon Brevo (From contact@, login del relay, sin IMAP)
    r = c.post(f"{BASE}/buzones", headers=H, json={
        "email": "contact@atlantisglobalrealty.com",
        "usuario": "b2f64b001@smtp-brevo.com",
        "host": "smtp-relay.brevo.com",
        "puerto": 465,
        "password": os.environ["BREVO_KEY"],
        "soloEnvio": True,
    })
    r.raise_for_status()
    print("1. buzon Brevo registrado en el motor")

    # 2. probar SMTP
    r = c.post(f"{BASE}/buzones/probar", headers=H,
               json={"email": "contact@atlantisglobalrealty.com"}).json()
    if not r.get("ok"):
        raise SystemExit(f"FALLO la prueba SMTP del buzon: {r.get('error')}")
    print("2. conexion SMTP del buzon: OK")

    # 3. cargar secuencia + config y activar (read-modify-write completo)
    data = c.get(f"{BASE}/crm/data", headers=H).json()["data"]
    nur = data.setdefault("atlantis", {}).setdefault("nurturing", {
        "config": {}, "secuencia": [], "activo": False,
        "inscritos": [], "bajas": [], "metricas": {"enviados": 0, "aperturas": 0},
    })
    nur["config"] = {**(nur.get("config") or {}),
        "autoInscribir": True,
        "tiposElegibles": ["guia"],
        "cadenciaDias": 3,
        "topeDiario": 30,
        "remitente": "contact@atlantisglobalrealty.com",
        "persona": "inversionista que descargo la guia Donde invertir en 2026",
        "oferta": "diagnostico de portafolio sin costo con Atlantis Global Realty",
        "nCorreos": len(SEQ),
    }
    nur["secuencia"] = SEQ
    nur["activo"] = True
    r = c.put(f"{BASE}/crm/data", headers=H, json={"data": data})
    r.raise_for_status()
    print(f"3. campana Inversionista cargada y ACTIVA ({len(SEQ)} correos, "
          "solo leads type=guia, cadencia 3 dias, tope 30)")

    # 4. primer ciclo: inscribe y envia lo que toque
    r = c.post(f"{BASE}/nurturing/procesar", headers=H,
               json={"workspace": "atlantis"}).json()
    print("4. primer ciclo:", r)
PY

echo
echo "Listo. El cron diario de n8n (9:03am) seguira procesando la campana."
echo "Metricas e inscritos: Centro de Mando > Nurturing (workspace Atlantis)."
