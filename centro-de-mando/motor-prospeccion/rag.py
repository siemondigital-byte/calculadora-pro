"""RAG del Centro de Mando Atlantis (portado del nucleo Siemon): embeddings con
Voyage + base vectorial Qdrant (compartida en el VPS, coleccion propia 'atlantis').
Ingesta: documentos -> trozos -> embeddings -> Qdrant. Consulta: hibrida
(semantica + palabras exactas). Ademas APRENDE en vivo de lo que el dueno
escribe y envia (correos, publicaciones) via aprender().
La clave VOYAGE_API_KEY vive en el vault cifrado (Accesos) o en el entorno."""
import hashlib
import json
import os

import requests

QDRANT = os.environ.get("QDRANT_URL", "http://qdrant:6333")
COLL = "atlantis"
DIM = 1024
MODEL = "voyage-3.5"


def _key():
    try:
        import secretos
        return secretos.get("VOYAGE_API_KEY") or os.environ.get("VOYAGE_API_KEY", "")
    except Exception:
        return os.environ.get("VOYAGE_API_KEY", "")


def _embed(texts, input_type="document"):
    """Embebe respetando el rate limit de Voyage (lotes por presupuesto de tokens
    + reintento en 429). Con la cuenta gratis el limite es 3 RPM / 10K TPM."""
    import time
    key = _key()
    if not key or not texts:
        return []
    out = []
    i = 0
    while i < len(texts):
        batch, toks = [], 0
        while i < len(texts) and len(batch) < 40 and toks < 7000:
            t = texts[i]
            batch.append(t)
            toks += len(t) // 4 + 4
            i += 1
        ok = False
        for _intento in range(5):
            try:
                r = requests.post("https://api.voyageai.com/v1/embeddings",
                                  headers={"Authorization": "Bearer " + key,
                                           "Content-Type": "application/json"},
                                  json={"input": batch, "model": MODEL,
                                        "input_type": input_type}, timeout=90)
                if r.status_code == 429:
                    time.sleep(22)
                    continue
                d = r.json()
                got = [x["embedding"] for x in d.get("data", [])]
                if len(got) == len(batch):
                    out += got
                    ok = True
                    break
                return []
            except Exception:
                time.sleep(5)
        if not ok:
            return []
    return out


def _ensure(coll=COLL):
    try:
        if requests.get(f"{QDRANT}/collections/{coll}", timeout=10).status_code == 200:
            return True
    except Exception:
        pass
    try:
        requests.put(f"{QDRANT}/collections/{coll}",
                     json={"vectors": {"size": DIM, "distance": "Cosine"}}, timeout=15)
    except Exception:
        pass
    return True


def _chunks(texto, size=1600, overlap=200):
    texto = (texto or "").strip()
    if not texto:
        return []
    out = []
    i = 0
    while i < len(texto):
        out.append(texto[i:i + size])
        i += size - overlap
    return out


def ingerir(docs, coll=COLL):
    """docs: [{id, titulo, texto, meta?}] -> trocea, embebe y sube a Qdrant."""
    _ensure(coll)
    texts, metas = [], []
    for d in docs or []:
        for ci, ch in enumerate(_chunks(d.get("texto", ""))):
            texts.append(ch)
            metas.append({"doc_id": d.get("id"), "titulo": d.get("titulo"),
                          "texto": ch, "chunk": ci, **(d.get("meta") or {})})
    if not texts:
        return {"ok": False, "error": "sin_texto"}
    vecs = _embed(texts, "document")
    if len(vecs) != len(texts):
        return {"ok": False, "error": "embed_incompleto"}
    points = []
    for m, v in zip(metas, vecs):
        pid = int(hashlib.md5((str(m["doc_id"]) + "#" + str(m["chunk"])).encode()).hexdigest()[:15], 16)
        points.append({"id": pid, "vector": v, "payload": m})
    r = requests.put(f"{QDRANT}/collections/{coll}/points?wait=true",
                     json={"points": points}, timeout=90)
    return {"ok": r.status_code < 300, "chunks": len(points), "docs": len(docs or [])}


def buscar(query, k=6, coll=COLL):
    """pregunta -> embedding -> vecinos mas cercanos (busqueda por significado)."""
    _ensure(coll)
    qv = _embed([query], "query")
    if not qv:
        return {"ok": False, "error": "sin_embed"}
    r = requests.post(f"{QDRANT}/collections/{coll}/points/search",
                      json={"vector": qv[0], "limit": k, "with_payload": True}, timeout=30)
    hits = r.json().get("result", [])
    return {"ok": True, "resultados": [
        {"score": round(h.get("score", 0), 3), "titulo": h["payload"].get("titulo"),
         "doc_id": h["payload"].get("doc_id"), "texto": (h["payload"].get("texto") or "")[:600]}
        for h in hits]}


def buscar_hibrido(query, k=6, coll=COLL):
    """Busqueda HIBRIDA: semantica (entiende el significado) + refuerzo por
    PALABRAS EXACTAS (atrapa nombres, codigos y terminos que los embeddings
    diluyen). Puntaje final = 0.65*semantico + 0.35*texto."""
    import re as _re
    palabras = [w for w in _re.split(r"\W+", (query or "").lower()) if len(w) > 2]
    sem = buscar(query, k=max(k * 3, 12), coll=coll)
    cand = {}
    if sem.get("ok"):
        for r in sem["resultados"]:
            key = (r.get("doc_id"), (r.get("texto") or "")[:80])
            cand[key] = {"titulo": r.get("titulo"), "doc_id": r.get("doc_id"),
                         "texto": r.get("texto") or "", "v": float(r.get("score") or 0), "t": 0.0}
    if palabras:
        offset = None
        for _ in range(30):
            body = {"limit": 256, "with_payload": True, "with_vector": False}
            if offset:
                body["offset"] = offset
            try:
                j = requests.post(f"{QDRANT}/collections/{coll}/points/scroll",
                                  json=body, timeout=30).json().get("result", {})
            except Exception:
                break
            for p in (j.get("points") or []):
                pl = p.get("payload") or {}
                blob = ((pl.get("titulo") or "") + " " + (pl.get("texto") or "")).lower()
                hits = sum(1 for w in palabras if w in blob)
                if (query or "").lower().strip() in blob:
                    hits += len(palabras)
                if not hits:
                    continue
                t = min(1.0, hits / max(1, len(palabras)))
                key = (pl.get("doc_id"), (pl.get("texto") or "")[:80])
                if key in cand:
                    cand[key]["t"] = max(cand[key]["t"], t)
                else:
                    cand[key] = {"titulo": pl.get("titulo"), "doc_id": pl.get("doc_id"),
                                 "texto": (pl.get("texto") or "")[:600], "v": 0.0, "t": t}
            offset = j.get("next_page_offset")
            if not offset:
                break
    if not cand:
        return sem if sem.get("ok") else {"ok": True, "resultados": []}
    lista = sorted(cand.values(), key=lambda x: -(0.65 * x["v"] + 0.35 * x["t"]))[:k]
    return {"ok": True, "modo": "hibrido", "resultados": [
        {"score": round(0.65 * x["v"] + 0.35 * x["t"], 3), "titulo": x["titulo"],
         "doc_id": x["doc_id"], "texto": x["texto"][:600]} for x in lista]}


def _rec_texto(rec):
    parts = []
    for k, v in (rec or {}).items():
        if v in (None, "", [], {}) or k in ("id", "avatar", "logo"):
            continue
        if isinstance(v, (list, dict)):
            v = json.dumps(v, ensure_ascii=False)[:400]
        parts.append(f"{k}: {v}")
    return "\n".join(parts)[:4000]


def ingerir_crm():
    """Lee el historial del CRM (los DOS workspaces: leads, prospectos, consultas,
    proyectos, compradores, afiliados, publicaciones, conversaciones, nurturing)
    y lo ingiere en la base vectorial."""
    import crm_store
    data = crm_store.leer() or {}
    docs = []
    cols = {"leads": "Lead", "prospectos": "Prospecto", "consultas": "Consulta",
            "proyectos": "Proyecto", "compradores": "Comprador",
            "afiliados": "Afiliado", "publicaciones": "Publicacion",
            "presupuestos": "Presupuesto"}
    for ws in ("atlantis", "cicloderiqueza"):
        sw = data.get(ws) or {}
        if not isinstance(sw, dict):
            continue
        cfg = sw.get("config") or {}
        if cfg:
            docs.append({"id": f"crm-{ws}-config", "titulo": f"Identidad: {cfg.get('nombre', ws)}",
                         "texto": _rec_texto(cfg), "meta": {"fuente": "config", "ws": ws}})
        for key, label in cols.items():
            for rec in (sw.get(key) or []):
                if not isinstance(rec, dict):
                    continue
                rid = rec.get("id") or rec.get("slug") or rec.get("email") or str(len(docs))
                nombre = (rec.get("nombre") or rec.get("titulo")
                          or (rec.get("es") or {}).get("nombre") if isinstance(rec.get("es"), dict) else None) \
                    or rec.get("nombre") or rec.get("titulo") or rec.get("email") or str(rid)
                docs.append({"id": f"crm-{ws}-{key}-{rid}", "titulo": f"{label}: {nombre}",
                             "texto": f"{label}: {nombre}\n" + _rec_texto(rec),
                             "meta": {"fuente": "crm", "tipo": key, "ws": ws}})
        # conversaciones de correo (outreach es una LISTA de hilos)
        for o in (sw.get("outreach") or []):
            conv = (o or {}).get("conversacion") or []
            if not conv:
                continue
            em = o.get("email") or "?"
            hilo = "\n".join([("Yo: " if m.get("de") == "mi" else "Ellos: ") + (m.get("texto") or "")
                              for m in conv])
            docs.append({"id": f"crm-{ws}-conv-{em}", "titulo": f"Conversacion: {em}",
                         "texto": f"Conversacion de correo con {em}.\n{hilo}",
                         "meta": {"fuente": "conversacion", "ws": ws}})
        # secuencia de nurturing aprobada (la voz real de los correos)
        nur = sw.get("nurturing") or {}
        for i, c in enumerate(nur.get("secuencia") or []):
            if isinstance(c, dict) and (c.get("cuerpo") or c.get("asunto")):
                docs.append({"id": f"crm-{ws}-nur-{i}",
                             "titulo": f"Nurturing {ws} correo {i + 1}: {c.get('asunto', '')}",
                             "texto": (c.get("asunto") or "") + "\n" + (c.get("cuerpo") or ""),
                             "meta": {"fuente": "nurturing", "ws": ws}})
    if not docs:
        return {"ok": False, "error": "sin_registros"}
    r = ingerir(docs)
    r["registros"] = len(docs)
    return r


def aprender(texto, tipo="texto", extra="", doc_id=""):
    """APRENDIZAJE EN VIVO: cada correo o publicacion que el dueno envia entra a
    la base (dedup por hash del contenido). Asi el sistema suena cada vez mas a el.
    Con doc_id determinista ('fuente:tema', ej. 'decision:precio-checkout') la
    re-ingesta ACTUALIZA ese tema en vez de acumular versiones: es el contrato
    del ritual de cierre de sesion (destilar decisiones/voz/trampas/estado)."""
    texto = (texto or "").strip()
    if len(texto) < 40:
        return {"ok": False, "error": "muy_corto"}
    doc_id = (doc_id or "").strip()
    h = hashlib.md5(texto.encode()).hexdigest()[:10]
    if doc_id:
        titulo = f"Conocimiento ({tipo}): {doc_id}" + ((" · " + extra) if extra else "")
    else:
        doc_id = f"voz-{tipo}-{h}"
        titulo = f"Voz propia ({tipo}){(': ' + extra) if extra else ''}"
    return ingerir([{
        "id": doc_id,
        "titulo": titulo,
        "texto": texto[:6000],
        "meta": {"fuente": "aprendizaje", "tipo": tipo},
    }])


def contexto(consulta, k=3, minimo=0.30):
    """Memoria de marca para los generadores: los fragmentos mas relevantes del
    historial, listos para inyectar en un prompt. Devuelve '' si no hay nada util."""
    try:
        r = buscar_hibrido(consulta, k=k)
        buenos = [x for x in (r.get("resultados") or []) if (x.get("score") or 0) >= minimo]
        if not buenos:
            return ""
        return "\n".join(f"- [{x.get('titulo', '')}] {x.get('texto', '')[:400]}" for x in buenos)
    except Exception:
        return ""


def estado(coll=COLL):
    try:
        r = requests.get(f"{QDRANT}/collections/{coll}", timeout=10).json()
        res = r.get("result", {})
        pts = res.get("points_count", 0)
        return {"ok": True, "puntos": pts, "voyage": bool(_key()), "hibrido": True}
    except Exception as e:
        return {"ok": False, "error": str(e)[:120], "voyage": bool(_key())}
