"""Scoring de oportunidad 0-100 segun el servicio que vendes (rubrica de tu skill).
Determinista y gratis. Ademas, si hay ANTHROPIC_API_KEY, Claude escribe el mensaje
de outreach personalizado y el motivo (solo para los que encajan, para ahorrar costo)."""
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from models import Prospecto                         # noqa: E402
from config import SERVICIOS, SERVICIO_DEFAULT, UMBRAL_ENCAJE  # noqa: E402


def _score_web(p: Prospecto):
    prob = []
    if not p.tiene_web:
        prob.append("No tiene web")
        return 98, prob
    s = 40
    if not p.https:
        s += 20; prob.append("Sin HTTPS (inseguro)")
    if not p.responsive:
        s += 22; prob.append("No es responsive (se ve mal en movil)")
    if not p.señales.get("moderno"):
        s += 15; prob.append("Diseno anticuado")
    if not p.seo.get("title"):
        s += 8; prob.append("Sin titulo")
    return min(s, 94), prob


def _score_seo(p: Prospecto):
    prob = []
    if not p.tiene_web:
        prob.append("No tiene web (no hay nada que posicionar)")
        return 60, prob
    seo = p.seo
    faltan = [k for k in ("title", "meta_description", "h1") if not seo.get(k)]
    if len(faltan) == 3:
        prob.append("Sin title, meta description ni H1"); return 95, prob
    if faltan:
        prob.append("SEO incompleto: falta " + ", ".join(faltan)); return 75, prob
    return 35, ["SEO basico cubierto, hay margen de mejora"]


def _score_marketing(p: Prospecto):
    prob = []
    if not p.redes:
        prob.append("Sin redes sociales visibles"); return 92, prob
    if len(p.redes) == 1:
        prob.append("Presencia en redes minima (" + list(p.redes)[0] + ")"); return 70, prob
    return 40, ["Tiene redes, pero se puede profesionalizar la estrategia"]


def _score_automatizacion(p: Prospecto):
    prob = []
    chatbot = p.señales.get("chatbot", False)
    reservas = p.señales.get("reservas", False)
    s = 30
    if not chatbot:
        s += 35; prob.append("Sin chatbot ni atencion automatica")
    if not reservas:
        s += 30; prob.append("Sin sistema de reservas/agenda online")
    if not p.tiene_web:
        s += 10; prob.append("Ni web tiene: todo el proceso es manual")
    return min(s, 98), prob


_FOCOS = {
    "web": _score_web, "seo": _score_seo,
    "marketing": _score_marketing, "automatizacion": _score_automatizacion,
}


def puntuar(p: Prospecto, servicio: str) -> Prospecto:
    foco = SERVICIOS.get((servicio or "").lower(), SERVICIO_DEFAULT)
    score, prob = _FOCOS[foco](p)
    p.score = int(score)
    p.problemas = prob + [x for x in p.problemas if x not in prob]
    p.encaja = p.score >= UMBRAL_ENCAJE
    p.motivo = (f"Oportunidad {p.score}/100 para {servicio}: "
                + (prob[0] if prob else "encaja con el perfil"))
    return p


# --------- Mensaje de outreach con Claude (opcional) ---------
def redactar_mensaje(p: Prospecto, servicio: str, idioma: str = "es") -> Prospecto:
    key = os.environ.get("ANTHROPIC_API_KEY")
    if not key or not p.encaja:
        return p
    try:
        import anthropic
    except Exception:
        return p
    try:
        client = anthropic.Anthropic(api_key=key)
        prob = "; ".join(p.problemas[:3]) or "sin problemas evidentes"
        prompt = (
            f"Eres Andrea, de Siemon Digital (agencia de IA, automatizacion y marketing). "
            f"Escribe un primer mensaje de contacto en {idioma}, calido y breve (2-3 frases, sin sonar a plantilla), "
            f"para el negocio '{p.nombre}' ({p.categoria}). Le ofreces: {servicio}. "
            f"Detectamos: {prob}. No inventes datos. No uses el guion largo. "
            f"Manten un tono cercano y profesional, termina invitando a una llamada corta."
        )
        r = client.messages.create(
            model="claude-sonnet-5", max_tokens=300,
            messages=[{"role": "user", "content": prompt}],
        )
        p.mensaje = "".join(b.text for b in r.content if getattr(b, "type", "") == "text").strip()
    except Exception as e:
        print(f"[scoring] Claude no genero mensaje: {e}")
    return p
