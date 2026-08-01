// BASE DE CONOCIMIENTO (RAG) — espejo del módulo de Siemon, UNIFICADO con las Conversaciones
// del proyecto Claude. Dos pestañas: (1) Conocimiento: preguntar (búsqueda híbrida), enseñar,
// subir documentos y reindexar el CRM; (2) Conversaciones Claude: subir/descargar los chats
// exportados (el RAG aprende de ellos). Endpoints del motor ya existentes: /rag/estado,
// /rag/buscar, /rag/aprender, /rag/reindexar y /conversaciones/*.
import React, { useEffect, useState } from "react";
import { Search, Sparkles, RefreshCw, FileUp } from "lucide-react";
import { C, MONO, SANS } from "./tema.js";
import { MOTOR, getToken } from "./db.js";
import { Conversaciones } from "./ModulosNuevos.jsx";

const inS = { background: C.carbon, border: `1px solid ${C.line}`, color: C.cream, borderRadius: 10, padding: "9px 12px", width: "100%", fontFamily: SANS, fontSize: 13, outline: "none" };
const H = () => ({ "content-type": "application/json", Authorization: "Bearer " + getToken() });

export default function ConocimientoView({ tab: tabInicial }) {
  const [tab, setTab] = useState(tabInicial === "conversaciones" ? "conversaciones" : "conocimiento");
  const [estado, setEstado] = useState(null);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState(null);
  const [busy, setBusy] = useState("");
  const [ensenar, setEnsenar] = useState("");
  const [msg, setMsg] = useState("");
  const [mapa, setMapa] = useState(null);
  const [verMapa, setVerMapa] = useState(false);

  const ETIQ = { oferta: "Oferta y producto", programa: "Programas", posicionamiento: "Posicionamiento",
    ensenanza: "Enseñanzas", documento: "Documentos", conversacion: "Conversaciones", correo: "Correos",
    publicacion: "Publicaciones", diagnostico: "Perfiles de compradores", texto: "Notas", otros: "Otros" };

  async function cargarMapa() {
    setVerMapa(true); setBusy("mapa");
    try {
      const r = await fetch(MOTOR + "/rag/mapa", { headers: H() });
      const d = await r.json();
      if (d.ok) setMapa(d); else aviso("No pude leer el mapa: " + (d.error || ""));
    } catch { aviso("No pude conectar con el motor."); }
    setBusy("");
  }

  async function publicarMapa() {
    if (!window.confirm("¿Publicar el mapa en la web pública (atlantisglobalrealty.com/mapa-conocimiento.html)? Es un snapshot del estado actual.")) return;
    setBusy("pubmapa");
    try {
      const r = await fetch(MOTOR + "/rag/mapa_publicar", { method: "POST", headers: H(), body: JSON.stringify({}) });
      const d = await r.json();
      aviso(d.ok ? `Mapa publicado ✓ ${d.url}` : "No pude publicarlo: " + (d.error || ""));
      if (d.ok) window.open(d.url, "_blank");
    } catch { aviso("No pude conectar con el motor."); }
    setBusy("");
  }

  const cargarEstado = () => {
    fetch(MOTOR + "/rag/estado", { headers: H() }).then((r) => r.json()).then(setEstado).catch(() => {});
  };
  useEffect(cargarEstado, []);
  const aviso = (t) => { setMsg(t); setTimeout(() => setMsg(""), 4500); };

  async function buscar(e) {
    e?.preventDefault();
    if (!q.trim()) return;
    setBusy("buscar");
    try {
      const r = await fetch(MOTOR + "/rag/buscar", { method: "POST", headers: H(), body: JSON.stringify({ q, k: 8 }) });
      const d = await r.json();
      setHits(d.resultados || []);
      if (!d.ok && d.error) aviso("No pude buscar: " + d.error);
    } catch { aviso("No pude conectar con el motor."); }
    setBusy("");
  }

  async function guardarEnsenanza() {
    if (!ensenar.trim()) return;
    setBusy("aprender");
    try {
      const r = await fetch(MOTOR + "/rag/aprender", { method: "POST", headers: H(), body: JSON.stringify({ texto: ensenar, tipo: "ensenanza" }) });
      const d = await r.json();
      if (d.ok !== false) { setEnsenar(""); aviso("Aprendido ✓ desde ya alimenta lo que se genere."); cargarEstado(); }
      else aviso("No pude guardarlo: " + (d.error || ""));
    } catch { aviso("No pude conectar con el motor."); }
    setBusy("");
  }

  function subirDoc(ev) {
    const f = ev.target.files?.[0];
    ev.target.value = "";
    if (!f) return;
    setBusy("doc");
    const lector = new FileReader();
    lector.onload = async () => {
      try {
        const r = await fetch(MOTOR + "/rag/aprender", { method: "POST", headers: H(),
          body: JSON.stringify({ texto: `# ${f.name}\n\n` + String(lector.result || ""), tipo: "documento" }) });
        const d = await r.json();
        aviso(d.ok !== false ? `Documento aprendido ✓ (${f.name})` : "No pude: " + (d.error || ""));
        cargarEstado();
      } catch { aviso("No pude conectar con el motor."); }
      setBusy("");
    };
    lector.readAsText(f);
  }

  async function reindexar() {
    if (!window.confirm("¿Reindexar el CRM completo al conocimiento? Tarda un rato y consume embeddings.")) return;
    setBusy("reindexar"); aviso("Reindexando el CRM al conocimiento…");
    try {
      const r = await fetch(MOTOR + "/rag/reindexar", { method: "POST", headers: H(), body: JSON.stringify({}) });
      const d = await r.json();
      aviso(d.ok !== false ? "Reindexado ✓" : "Falló: " + (d.error || ""));
      cargarEstado();
    } catch { aviso("No pude conectar con el motor."); }
    setBusy("");
  }

  const TabBtn = ({ id, label }) => (
    <button onClick={() => setTab(id)} className="!px-4 !py-2 text-sm"
      style={{ background: tab === id ? (C.oroSoft || "rgba(216,182,115,0.14)") : "transparent",
               border: `1px solid ${tab === id ? (C.oro || C.line) : C.line}`,
               color: tab === id ? (C.oro || C.cream) : C.ash, borderRadius: 10, cursor: "pointer" }}>{label}</button>
  );

  return (
    <div style={{ maxWidth: 880, margin: "0 auto", fontFamily: SANS }}>
      <div className="mb-4">
        <div style={{ color: C.oro || "#D8B673", fontFamily: MONO, letterSpacing: "0.16em" }} className="text-[10px] uppercase mb-1">// Base de conocimiento</div>
        <h1 style={{ color: C.cream, fontWeight: 700, fontSize: 24, margin: 0 }}>Lo que el sistema sabe del negocio</h1>
        <p style={{ color: C.ash, fontSize: 12.5, maxWidth: "62ch" }}>
          Alimenta TODO lo que se genera (contenido, anuncios, propuestas): la oferta del Ciclo de Riqueza, el programa de
          embajadores, el posicionamiento de la agencia, tus documentos y las conversaciones del proyecto. Aprende solo de lo que escribes y envías.
        </p>
        {estado && (
          <div style={{ color: C.ash, fontFamily: MONO }} className="text-[11px] mt-1">
            {estado.puntos != null ? `${estado.puntos} fragmentos en memoria` : ""}{estado.coleccion ? ` · colección ${estado.coleccion}` : ""}
          </div>
        )}
      </div>

      <div className="flex gap-2 mb-5">
        <TabBtn id="conocimiento" label="🧠 Conocimiento" />
        <TabBtn id="conversaciones" label="💬 Conversaciones Claude" />
      </div>

      {msg && <div className="tarjeta mb-4 !p-3" style={{ borderColor: C.oro || C.line, color: C.cream, fontSize: 13 }}>{msg}</div>}

      {tab === "conversaciones" ? (
        <Conversaciones />
      ) : (
        <>
          {/* Pregúntale */}
          <form onSubmit={buscar} className="tarjeta mb-5 flex gap-2 items-center">
            <Search size={15} style={{ color: C.ash, flexShrink: 0 }} />
            <input style={{ ...inS, border: "none", background: "transparent" }} placeholder="Pregúntale algo… (ej. ¿qué le ofrecemos a un creador? ¿qué incluye el producto?)" value={q} onChange={(e) => setQ(e.target.value)} />
            <button className="boton !px-4" disabled={busy === "buscar"}>{busy === "buscar" ? "Buscando…" : "Buscar"}</button>
          </form>

          {hits !== null && (
            <div className="mb-6">
              {hits.length === 0 && <p style={{ color: C.ash, fontSize: 13 }}>No encontré nada sobre eso. Enséñaselo abajo.</p>}
              {hits.map((h, i) => (
                <div key={i} className="tarjeta mb-2 !p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span style={{ color: C.oro || "#D8B673", fontFamily: MONO }} className="text-[10px] uppercase">{h.titulo || h.doc_id}</span>
                    <span style={{ color: C.ash, fontFamily: MONO }} className="text-[10px] ml-auto">relevancia {h.score}</span>
                  </div>
                  <div style={{ color: C.mist, fontSize: 13, lineHeight: 1.55 }}>{h.texto}</div>
                </div>
              ))}
            </div>
          )}

          {/* Mapa vivo (interno) + publicación externa */}
          <div className="tarjeta mb-5">
            <div className="flex items-center gap-3 flex-wrap">
              <span style={{ color: C.cream, fontWeight: 600, fontSize: 14 }}>🗺 Mapa vivo de tu base</span>
              {!verMapa && <button className="boton-secundario !px-3 !py-1.5 text-xs" onClick={cargarMapa}>{busy === "mapa" ? "Leyendo…" : "Ver el mapa"}</button>}
              {verMapa && <button className="boton-secundario !px-3 !py-1.5 text-xs" onClick={cargarMapa}>{busy === "mapa" ? "Leyendo…" : "↻ Actualizar"}</button>}
              <button className="boton-secundario !px-3 !py-1.5 text-xs" onClick={publicarMapa} disabled={busy === "pubmapa"}>{busy === "pubmapa" ? "Publicando…" : "🌐 Publicar versión externa"}</button>
              <a href="https://atlantisglobalrealty.com/mapa-conocimiento.html" target="_blank" rel="noreferrer" style={{ color: C.oro || "#D8B673", fontSize: 12 }} className="ml-auto hover:underline">ver versión grande ↗</a>
            </div>
            {verMapa && mapa && (
              <>
                <div style={{ color: C.ash, fontFamily: MONO }} className="text-[11px] mt-2 mb-3">{mapa.total} documentos · se lee EN VIVO del RAG · clic en uno para preguntarle</div>
                <div className="flex gap-3 overflow-x-auto pb-2" style={{ alignItems: "flex-start" }}>
                  {(mapa.fuentes || []).map((fu) => (
                    <div key={fu.fuente} style={{ minWidth: 230, background: C.carbon, border: `1px solid ${C.line}`, borderRadius: 12, padding: 10 }}>
                      <div style={{ color: C.oro || "#D8B673", fontFamily: MONO }} className="text-[10px] uppercase mb-2 flex items-center gap-1.5">
                        <span style={{ width: 8, height: 8, borderRadius: 3, background: C.oro || "#D8B673", display: "inline-block" }} />
                        {ETIQ[fu.fuente] || fu.fuente} <span style={{ color: C.ash }} className="ml-auto">{fu.n}</span>
                      </div>
                      {(mapa.nodos || []).filter((n) => n.fuente === fu.fuente).sort((a, b) => b.peso - a.peso).map((n) => (
                        <button key={n.id} onClick={() => { setQ(n.titulo); setTab("conocimiento"); buscar(); }}
                          title={`${n.peso} fragmento(s) — clic para preguntarle`}
                          style={{ display: "block", width: "100%", textAlign: "left", background: "rgba(255,255,255,0.03)",
                                   border: `1px solid ${C.line}`, borderRadius: 8, color: C.cream, cursor: "pointer",
                                   padding: `${6 + Math.min(n.peso, 6)}px 10px`, marginBottom: 6, fontSize: 12 }}>
                          {String(n.titulo).slice(0, 60)}
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Enséñale + documentos + reindexar */}
          <div className="tarjeta mb-5">
            <div className="flex items-center gap-2 mb-2"><Sparkles size={14} style={{ color: C.oro || "#D8B673" }} />
              <span style={{ color: C.cream, fontWeight: 600, fontSize: 14 }}>Enséñale algo al sistema</span></div>
            <textarea style={{ ...inS, minHeight: 90, resize: "vertical" }} placeholder="Un dato, una decisión, una corrección de voz, una objeción y su respuesta… Quedará en la memoria y saldrá en lo próximo que se genere." value={ensenar} onChange={(e) => setEnsenar(e.target.value)} />
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <button className="boton" onClick={guardarEnsenanza} disabled={busy === "aprender" || !ensenar.trim()}>{busy === "aprender" ? "Guardando…" : "Guardar en la memoria"}</button>
              <label className="boton-secundario cursor-pointer flex items-center gap-1.5">
                <FileUp size={13} /> {busy === "doc" ? "Aprendiendo…" : "Subir documento (.md/.txt)"}
                <input type="file" accept=".md,.txt,.json,.csv" className="hidden" onChange={subirDoc} />
              </label>
              <button className="boton-secundario flex items-center gap-1.5" onClick={reindexar} disabled={busy === "reindexar"} title="Vuelca el CRM completo (leads, proyectos, compradores, decisiones) al conocimiento">
                <RefreshCw size={13} className={busy === "reindexar" ? "animate-spin" : ""} /> Reindexar el CRM
              </button>
            </div>
            <p style={{ color: C.ash, fontSize: 11 }} className="mt-2">Nada se genera solo con esto: el conocimiento se integra cuando TÚ pides contenido, un anuncio o una propuesta.</p>
          </div>
        </>
      )}
    </div>
  );
}
