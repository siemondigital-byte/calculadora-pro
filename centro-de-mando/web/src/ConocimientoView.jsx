// BASE DE CONOCIMIENTO — calcada del módulo de Siemon (misma experiencia): chat sobre el RAG que
// RESPONDE CITANDO archivos, Agregar documentos, asistente Organizar (índice/contradicciones/vacíos/
// duplicados/resumen/libre) y Mapa vivo inline con versión externa publicable. Además, unificada con
// las Conversaciones del proyecto Claude (pestaña propia). Endpoints: /rag/preguntar, /rag/ingerir,
// /rag/organizar, /rag/mapa, /rag/mapa_publicar, /rag/estado, /conversaciones/*.
import React, { useState, useEffect, useRef } from "react";
import { Brain, Send, Network, Sparkles, FileText, Plus, UploadCloud, X, MessageSquare } from "lucide-react";
import { C, MONO, SANS } from "./tema.js";
import { MOTOR, getToken } from "./db.js";
import { Conversaciones } from "./ModulosNuevos.jsx";

const H = () => ({ "content-type": "application/json", Authorization: "Bearer " + getToken() });
const ORO = C.oro || "#D8B673";
const OROSOFT = "rgba(216,182,115,0.14)";
const OROLINE = "rgba(216,182,115,0.35)";
const MAPA_URL = "https://atlantisglobalrealty.com/mapa-conocimiento.html";
const SUGERENCIAS = [
  "¿Qué incluye el Ciclo de Riqueza y cuánto cuesta?",
  "¿Qué le ofrecemos a un creador para ser embajador?",
  "¿Cómo se posiciona la agencia y qué contenido publica?",
  "¿Qué proyectos tenemos y en qué estado están?",
];
const FUENTES = {
  crm: { label: "Historial (CRM)", color: ORO },
  oferta: { label: "Oferta y producto", color: "#7FB89B" },
  programa: { label: "Programas", color: "#CBA6E1" },
  posicionamiento: { label: "Posicionamiento", color: "#EAE6DC" },
  ensenanza: { label: "Enseñanzas", color: "#9AC0B4" },
  documento: { label: "Documentos", color: "#9AA0C0" },
  manual: { label: "Agregados a mano", color: "#D08A8A" },
  conversacion: { label: "Conversaciones", color: "#8474BE" },
  diagnostico: { label: "Perfiles de compradores", color: "#D8B673" },
  texto: { label: "Notas", color: "#8B8D98" },
  otros: { label: "Otros", color: "#8B8D98" },
};
const fuenteInfo = (f) => FUENTES[f] || { label: f || "otros", color: "#8B8D98" };
const SEGUIMIENTOS = ["Dame un ejemplo concreto", "¿Cómo lo aplico con un comprador?", "Profundiza en esto"];

export default function ConocimientoView({ tab: tabInicial }) {
  const [estado, setEstado] = useState(null);
  const [msgs, setMsgs] = useState([]);   // {rol:'tu'|'ia', texto, fuentes?}
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [dTit, setDTit] = useState("");
  const [dTxt, setDTxt] = useState("");
  const [addMsg, setAddMsg] = useState("");
  const [orgTxt, setOrgTxt] = useState("");
  const [orgAbierto, setOrgAbierto] = useState(false);
  const [orgBusy, setOrgBusy] = useState("");
  const [orgTarea, setOrgTarea] = useState("");
  const [orgFoco, setOrgFoco] = useState("");
  const [mapaOpen, setMapaOpen] = useState(false);
  const [mapa, setMapa] = useState(null);
  const [mapaBusy, setMapaBusy] = useState(false);
  const [pubBusy, setPubBusy] = useState(false);
  const [convOpen, setConvOpen] = useState(tabInicial === "conversaciones");
  const scroller = useRef(null);

  const TAREAS_ORG = [
    ["indice", "Organizar todo", "Índice por áreas + duplicados + vacíos"],
    ["contradicciones", "Contradicciones", "Info que se pisa o quedó vieja"],
    ["vacios", "Qué me falta", "Áreas del negocio poco documentadas"],
    ["duplicados", "Duplicados", "Documentos a fusionar o archivar"],
    ["resumen", "Foto ejecutiva", "Qué sabe hoy tu base de tu negocio"],
  ];

  function refrescarEstado() {
    fetch(MOTOR + "/rag/estado", { headers: H() }).then((r) => r.json()).then(setEstado).catch(() => {});
  }
  useEffect(() => { refrescarEstado(); }, []);
  useEffect(() => { if (scroller.current) scroller.current.scrollTop = scroller.current.scrollHeight; }, [msgs, busy]);

  async function abrirMapa() {
    const v = !mapaOpen; setMapaOpen(v);
    if (v && !mapa) {
      setMapaBusy(true);
      try { const r = await fetch(MOTOR + "/rag/mapa", { headers: H() }); setMapa(await r.json()); }
      catch { setMapa({ ok: false }); } finally { setMapaBusy(false); }
    }
  }

  async function publicarMapa() {
    if (!window.confirm("¿Publicar el mapa en la web pública (atlantisglobalrealty.com/mapa-conocimiento.html)? Es un snapshot del estado actual.")) return;
    setPubBusy(true);
    try {
      const r = await fetch(MOTOR + "/rag/mapa_publicar", { method: "POST", headers: H(), body: JSON.stringify({}) });
      const d = await r.json();
      if (d.ok) window.open(d.url, "_blank");
      else window.alert("No pude publicarlo: " + (d.error || ""));
    } catch { window.alert("No pude conectar con el motor."); }
    setPubBusy(false);
  }

  async function organizar(tarea = "indice", foco = "") {
    setOrgBusy(tarea || "libre"); setOrgTxt(""); setOrgTarea(tarea);
    try {
      const r = await fetch(MOTOR + "/rag/organizar", { method: "POST", headers: H(), body: JSON.stringify({ tarea, foco }) });
      const d = await r.json();
      setOrgTxt(d.ok ? (d.texto || "") : ("No pude organizar: " + (d.error || "")));
    } catch { setOrgTxt("No pude conectar con el motor."); } finally { setOrgBusy(""); }
  }

  function leerArchivo(e) {
    const f = e.target.files && e.target.files[0]; if (!f) return;
    if (!dTit) setDTit(f.name.replace(/\.[^.]+$/, ""));
    const reader = new FileReader();
    reader.onload = () => setDTxt(String(reader.result || "").slice(0, 60000));
    reader.readAsText(f);
  }

  async function agregarDoc() {
    const titulo = (dTit || "").trim(), texto = (dTxt || "").trim();
    if (!texto) { setAddMsg("Pega o sube algo de contenido primero."); return; }
    setAddMsg("Ingiriendo…");
    const id = "doc-" + (titulo || "sin-titulo").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40) + "-" + Date.now().toString(36);
    try {
      const r = await fetch(MOTOR + "/rag/ingerir", { method: "POST", headers: H(), body: JSON.stringify({ docs: [{ id, titulo: titulo || "Documento", texto, meta: { fuente: "manual" } }] }) });
      const d = await r.json();
      if (d.ok) { setAddMsg(`✓ Agregado (${d.chunks} trozos). Ya puedes preguntarle.`); setDTit(""); setDTxt(""); refrescarEstado(); setTimeout(() => { setAddOpen(false); setAddMsg(""); }, 2200); }
      else setAddMsg("No pude ingerir: " + (d.error || ""));
    } catch { setAddMsg("No pude conectar con el motor."); }
  }

  async function preguntar(texto) {
    const pregunta = (texto ?? q).trim();
    if (!pregunta || busy) return;
    const previos = msgs.slice(-4).map((m) => (m.rol === "tu" ? "Yo: " : "Tú: ") + m.texto).join("\n");
    const query = previos ? ("Charla previa:\n" + previos + "\n\nPregunta actual: " + pregunta) : pregunta;
    setMsgs((m) => [...m, { rol: "tu", texto: pregunta }]);
    setQ(""); setBusy(true);
    try {
      const r = await fetch(MOTOR + "/rag/preguntar", { method: "POST", headers: H(), body: JSON.stringify({ query }) });
      const d = await r.json();
      setMsgs((m) => [...m, { rol: "ia", texto: d.respuesta || ("No pude responder." + (d.error ? " (" + d.error + ")" : "")), fuentes: d.fuentes || [] }]);
    } catch {
      setMsgs((m) => [...m, { rol: "ia", texto: "No pude conectar con el motor.", fuentes: [] }]);
    } finally { setBusy(false); }
  }

  const btnTog = (activo) => ({ background: activo ? ORO : OROSOFT, border: `1px solid ${OROLINE}`, color: activo ? "#0E0F12" : ORO, fontWeight: 600 });

  return (
    <div style={{ fontFamily: SANS }} className="max-w-4xl mx-auto">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 style={{ fontWeight: 700, color: C.cream, fontSize: 24, margin: 0 }} className="flex items-center gap-2"><Brain size={20} color={ORO} /> Base de conocimiento</h1>
          <div style={{ color: C.mist, fontSize: 12 }} className="mt-1">Pregúntale a tu negocio. El asistente busca por <b style={{ color: C.cream }}>significado</b> en toda tu base y responde citando tus archivos. Es tu RAG — la misma base que ve el mapa.</div>
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <button onClick={() => { setAddOpen((v) => !v); setAddMsg(""); }} style={btnTog(addOpen)} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs">{addOpen ? <X size={14} /> : <Plus size={14} />} Agregar documentos</button>
          <button onClick={() => setOrgAbierto((v) => !v)} style={btnTog(orgAbierto)} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs"><FileText size={14} /> Organizar</button>
          <button onClick={abrirMapa} style={btnTog(mapaOpen)} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs"><Network size={14} /> Mapa vivo</button>
          <button onClick={() => setConvOpen((v) => !v)} style={btnTog(convOpen)} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs"><MessageSquare size={14} /> Conversaciones Claude</button>
        </div>
      </div>

      {addOpen && (
        <div style={{ background: C.carbon, border: `1px solid ${OROLINE}`, borderRadius: 14 }} className="mt-3 p-4">
          <div style={{ color: ORO, fontWeight: 600, fontSize: 13 }} className="flex items-center gap-2"><Plus size={14} /> Agregar conocimiento a tu base</div>
          <div style={{ color: C.ash, fontSize: 11 }} className="mt-0.5 mb-3">Pega texto (una nota, un proceso, condiciones de un proyecto) o sube un archivo .txt/.md. Se ingiere al RAG y queda buscable al instante.</div>
          <input value={dTit} onChange={(e) => setDTit(e.target.value)} placeholder="Título (ej. 'Condiciones del proyecto Brickell Sur')" style={{ background: "#101116", border: `1px solid ${C.line}`, color: C.cream, borderRadius: 10, padding: "9px 12px", width: "100%", fontFamily: SANS, fontSize: 13, outline: "none" }} />
          <textarea value={dTxt} onChange={(e) => setDTxt(e.target.value)} placeholder="Pega aquí el contenido…" style={{ background: "#101116", border: `1px solid ${C.line}`, color: C.cream, borderRadius: 10, padding: "10px 12px", width: "100%", minHeight: 120, marginTop: 8, fontFamily: SANS, fontSize: 13, outline: "none", resize: "vertical" }} />
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <label style={{ background: C.panel, border: `1px solid ${C.line}`, color: C.mist, cursor: "pointer" }} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs"><UploadCloud size={14} /> Subir .txt/.md<input type="file" accept=".txt,.md,.markdown,text/plain" onChange={leerArchivo} style={{ display: "none" }} /></label>
            <button onClick={agregarDoc} style={{ background: ORO, color: "#0E0F12", fontWeight: 700 }} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs">Ingerir al RAG</button>
            {addMsg && <span style={{ color: addMsg.startsWith("✓") ? "#7FB89B" : C.mist, fontSize: 11 }}>{addMsg}</span>}
          </div>
        </div>
      )}

      {orgAbierto && (
        <div style={{ background: C.carbon, border: `1px solid ${OROLINE}`, borderRadius: 14 }} className="mt-3 p-4">
          <div className="flex items-center justify-between mb-1">
            <div style={{ color: ORO, fontWeight: 600, fontSize: 13 }} className="flex items-center gap-2"><FileText size={14} /> Asistente · organiza tu información</div>
            <button onClick={() => setOrgAbierto(false)} style={{ color: C.ash, fontSize: 11 }}>cerrar</button>
          </div>
          <div style={{ color: C.ash, fontSize: 11 }} className="mb-3">Elige una tarea puntual y el asistente la resuelve leyendo toda tu base. O escríbele lo que necesites abajo.</div>
          <div className="flex flex-wrap gap-2 mb-3">
            {TAREAS_ORG.map(([t, label, desc]) => (
              <button key={t} onClick={() => organizar(t)} disabled={!!orgBusy} title={desc}
                style={{ background: orgBusy === t ? ORO : C.panel, border: `1px solid ${orgTarea === t && orgTxt ? OROLINE : C.line}`, color: orgBusy === t ? "#0E0F12" : C.mist, fontWeight: 600, opacity: orgBusy && orgBusy !== t ? 0.5 : 1 }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px]">
                {orgBusy === t ? "Pensando…" : label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <input value={orgFoco} onChange={(e) => setOrgFoco(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && orgFoco.trim() && !orgBusy) organizar("libre", orgFoco.trim()); }}
              placeholder="Pídele algo puntual (ej. 'ordena todo lo de proyectos' o 'qué me falta del programa de embajadores')"
              style={{ background: "#101116", border: `1px solid ${C.line}`, color: C.cream, borderRadius: 10, padding: "9px 12px", flex: 1, minWidth: 220, fontFamily: SANS, fontSize: 12, outline: "none" }} />
            <button onClick={() => orgFoco.trim() && organizar("libre", orgFoco.trim())} disabled={!!orgBusy || !orgFoco.trim()} style={{ background: ORO, color: "#0E0F12", fontWeight: 700, opacity: (!!orgBusy || !orgFoco.trim()) ? 0.6 : 1 }} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs"><Send size={13} /> Pedir</button>
          </div>
          {(orgTxt || orgBusy) && (
            <div style={{ background: "#101116", border: `1px solid ${C.line}`, borderRadius: 12 }} className="mt-3 p-3">
              {orgBusy && !orgTxt ? (
                <div style={{ color: C.ash, fontSize: 12 }}>Leyendo tu base y preparando la respuesta…</div>
              ) : (
                <div style={{ color: C.cream, whiteSpace: "pre-wrap", fontSize: 12 }} className="leading-relaxed">{orgTxt}</div>
              )}
            </div>
          )}
        </div>
      )}

      {mapaOpen && (
        <div style={{ background: C.carbon, border: `1px solid ${OROLINE}`, borderRadius: 14 }} className="mt-3 p-4">
          <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
            <div style={{ color: ORO, fontWeight: 600, fontSize: 13 }} className="flex items-center gap-2"><Network size={14} /> Mapa vivo de tu base {mapa?.total ? <span style={{ color: C.ash, fontWeight: 400 }}>· {mapa.total} documentos</span> : null}</div>
            <div className="flex items-center gap-3">
              <button onClick={publicarMapa} disabled={pubBusy} style={{ color: ORO, fontSize: 11, background: "none", border: `1px solid ${OROLINE}`, borderRadius: 8, padding: "3px 10px", cursor: "pointer" }}>{pubBusy ? "Publicando…" : "🌐 Publicar versión externa"}</button>
              <a href={MAPA_URL} target="_blank" rel="noreferrer" style={{ color: C.ash, fontSize: 10 }}>ver versión grande ↗</a>
            </div>
          </div>
          <div style={{ color: C.ash, fontSize: 11 }} className="mb-3">Cada columna es una fuente; cada bloque, un documento (más grande = más contenido). Se lee EN VIVO del RAG y crece cuando agregas cosas. Haz clic en uno para preguntarle.</div>
          {mapaBusy && <div style={{ color: C.ash, fontSize: 12 }}>Cargando el mapa…</div>}
          {mapa && mapa.ok && (
            <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: "thin" }}>
              {mapa.fuentes.map((f) => {
                const info = fuenteInfo(f.fuente);
                const nodos = mapa.nodos.filter((n) => n.fuente === f.fuente).sort((a, b) => b.peso - a.peso);
                return (
                  <div key={f.fuente} style={{ minWidth: 168, flex: "0 0 auto" }}>
                    <div className="flex items-center gap-1.5 mb-2">
                      <span style={{ width: 9, height: 9, borderRadius: 3, background: info.color, display: "inline-block" }} />
                      <span style={{ color: C.cream, fontWeight: 600, fontSize: 11 }}>{info.label}</span>
                      <span style={{ color: C.ash, fontFamily: MONO, fontSize: 9 }}>{f.n}</span>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {nodos.slice(0, 40).map((n) => {
                        const h = Math.min(46, 20 + Math.round(Math.sqrt(n.peso) * 6));
                        return (
                          <button key={n.id} onClick={() => { setMapaOpen(false); preguntar("Cuéntame lo que sabes sobre: " + (n.titulo || n.id)); }}
                            title={(n.titulo || n.id) + " · " + n.peso + " trozos"}
                            style={{ background: info.color + "22", border: `1px solid ${info.color}55`, color: C.cream, height: h, borderRadius: 8, padding: "0 8px", textAlign: "left", overflow: "hidden", fontSize: 10 }}
                            className="leading-tight hover:brightness-125 w-full">
                            <span style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{(n.titulo || n.id).replace(/^(Lead|Prospecto|Cliente|Conversación|Conversacion del proyecto):\s*/, "")}</span>
                          </button>
                        );
                      })}
                      {nodos.length > 40 && <span style={{ color: C.ash, fontSize: 9 }}>+{nodos.length - 40} más</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {mapa && !mapa.ok && <div style={{ color: C.ash, fontSize: 12 }}>No pude leer el mapa (revisa la conexión al RAG).</div>}
        </div>
      )}

      {convOpen && (
        <div style={{ background: C.carbon, border: `1px solid ${OROLINE}`, borderRadius: 14 }} className="mt-3 p-4">
          <Conversaciones />
        </div>
      )}

      <div className="flex items-center gap-3 mt-3 flex-wrap">
        <span style={{ background: C.carbon, border: `1px solid ${C.line}`, color: estado?.puntos ? "#7FB89B" : C.ash, fontFamily: MONO, fontSize: 10 }} className="px-2.5 py-1 rounded-full inline-flex items-center gap-1.5">
          <span style={{ width: 7, height: 7, borderRadius: 99, background: estado?.puntos ? "#7FB89B" : C.ash, display: "inline-block" }} />
          {estado?.puntos ? `${estado.puntos} trozos indexados` : "sin conexión a la base"}
        </span>
        {estado && !estado.voyage && <span style={{ color: C.ash, fontSize: 10 }}>⚠ Falta la clave de Voyage en Accesos.</span>}
      </div>

      <div ref={scroller} style={{ background: C.carbon, border: `1px solid ${C.line}`, borderRadius: 14, minHeight: 340, maxHeight: 460 }} className="mt-4 p-4 overflow-y-auto">
        {msgs.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center py-8">
            <Sparkles size={22} color={ORO} />
            <div style={{ color: C.mist, fontSize: 13 }} className="mt-2 mb-3">Hazle una pregunta a tu base de conocimiento.</div>
            <div className="flex flex-col gap-2 w-full max-w-md">
              {SUGERENCIAS.map((sug) => (
                <button key={sug} onClick={() => preguntar(sug)} style={{ background: C.panel, border: `1px solid ${C.line}`, color: C.mist, fontSize: 12 }} className="text-left px-3 py-2 rounded-lg hover:brightness-125">{sug}</button>
              ))}
            </div>
          </div>
        ) : msgs.map((m, i) => (
          <div key={i} className="mb-3">
            {m.rol === "tu" ? (
              <div className="flex justify-end"><div style={{ background: OROSOFT, border: `1px solid ${OROLINE}`, color: C.cream, fontSize: 13 }} className="px-3 py-2 rounded-xl max-w-[85%]">{m.texto}</div></div>
            ) : (
              <div className="flex flex-col gap-1.5">
                <div style={{ background: C.panel, border: `1px solid ${C.line}`, color: C.cream, whiteSpace: "pre-wrap", fontSize: 13 }} className="px-3.5 py-2.5 rounded-xl max-w-[92%] leading-relaxed">{m.texto}</div>
                {m.fuentes?.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap pl-1">
                    <FileText size={11} color={C.ash} />
                    {m.fuentes.map((f) => <span key={f} style={{ color: ORO, fontFamily: MONO, background: C.carbon, border: `1px solid ${C.line}`, fontSize: 9 }} className="px-2 py-0.5 rounded">{f}</span>)}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
        {busy && <div style={{ color: C.ash, fontSize: 12 }} className="flex items-center gap-2"><span className="animate-pulse">●</span> Buscando en tu base y redactando…</div>}
        {!busy && msgs.length > 0 && msgs[msgs.length - 1].rol === "ia" && (
          <div className="flex items-center gap-1.5 flex-wrap mt-1">
            {SEGUIMIENTOS.map((s) => (
              <button key={s} onClick={() => preguntar(s)} style={{ background: C.carbon, border: `1px solid ${C.line}`, color: ORO, fontSize: 10 }} className="px-2.5 py-1 rounded-full hover:brightness-125">{s}</button>
            ))}
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") preguntar(); }}
          placeholder="Escribe tu pregunta…" style={{ background: "#101116", border: `1px solid ${C.line}`, color: C.cream, borderRadius: 12, padding: "11px 14px", width: "100%", fontFamily: SANS, fontSize: 14, outline: "none" }} />
        <button onClick={() => preguntar()} disabled={busy || !q.trim()} style={{ background: busy || !q.trim() ? C.line : ORO, color: "#0E0F12", fontWeight: 700, borderRadius: 12, padding: "11px 16px", opacity: busy || !q.trim() ? 0.6 : 1 }} className="inline-flex items-center gap-1.5 shrink-0"><Send size={15} /></button>
      </div>
      <div style={{ color: C.ash, fontSize: 9 }} className="mt-2">Motor: Voyage (embeddings) + Qdrant (base vectorial) + Claude (redacción). Se alimenta con /rag/ingerir, las conversaciones y lo que el sistema aprende solo.</div>
    </div>
  );
}
