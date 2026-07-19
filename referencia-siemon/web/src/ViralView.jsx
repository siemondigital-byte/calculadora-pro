import React, { useState } from "react";
import { Flame, Sparkles, Check, X, Copy, RefreshCw, Trophy, ChevronDown, ChevronRight, ArrowRight, AtSign } from "lucide-react";
import { getToken } from "./db";
import { insightsMercado } from "./MercadoView.jsx";

const C = {
  obsidian: "#0A0B0D", panel: "#16171C", carbon: "#131418", line: "rgba(255,255,255,0.08)",
  aether: "#B1A3E1", aether2: "#CBC0EC", aether500: "#8474BE", aetherSoft: "rgba(177,163,225,0.14)",
  aetherLine: "rgba(177,163,225,0.30)", cream: "#E9E5DD", mist: "#C9CAD2", ash: "#8B8D98",
  ok: "#7FB89B", warn: "#D8B673", danger: "#D08A8A",
};
const SANS = "'Montserrat', system-ui, sans-serif";
const MONO = "'JetBrains Mono', ui-monospace, monospace";
const MOTOR = import.meta.env.VITE_MOTOR_URL || "https://prospeccion.siemondigital.com";
const inS = { background: "#101116", border: `1px solid ${C.line}`, color: C.cream, borderRadius: 10, padding: "9px 12px", width: "100%", fontFamily: SANS, fontSize: 13, outline: "none" };
const H = () => ({ "content-type": "application/json", Authorization: "Bearer " + getToken() });
const uid = () => (crypto?.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2, 9));

const NIVEL_COLOR = { "0-1": "#7FB89B", "2-3": "#CBC0EC", "4": "#D8B673" };
const ESTADOS_IDEA = ["backlog", "aprobada", "grabada", "publicada", "ganadora", "descartada"];

// Pestaña Viral (skill contenido-viral): motor de ideas con filtro de 7 criterios,
// guion de 5 partes, y regla 80/20 (marcar ganadoras y doblar la apuesta).
export default function ViralView({ data, commit, flash, irAEstudio }) {
  const ideas = data.siemon.viralIdeas || [];
  const [tema, setTema] = useState("");
  const [busy, setBusy] = useState(false);
  const [busyGuion, setBusyGuion] = useState("");
  const [busyX, setBusyX] = useState("");
  const [abierta, setAbierta] = useState("");
  const [filtro, setFiltro] = useState("activas");   // activas | ganadoras | descartadas | todas

  function patch(nuevas) { commit({ ...data, siemon: { ...data.siemon, viralIdeas: nuevas } }); }
  function setEstado(id, estado) {
    patch(ideas.map((x) => x.id === id ? { ...x, estado } : x));
    if (estado === "ganadora") flash("Ganadora 🏆 Regla 80/20: dobla la apuesta con variaciones de esta.");
  }

  async function generarLote() {
    setBusy(true);
    flash("Generando ideas… tarda alrededor de 1 minuto (van llegando por tandas).");
    let acumuladas = [...ideas];
    let total = 0;
    try {
      for (let tanda = 1; tanda <= 2; tanda++) {
        const r = await fetch(MOTOR + "/viral/ideas", { method: "POST", headers: H(), body: JSON.stringify({ n: 10, tema, contexto_mercado: insightsMercado(data), curadas: (data.siemon.blogKeywordsCuradas || []) }) });
        const d = await r.json();
        if (!d.ok) { flash("Tanda " + tanda + " falló: " + (d.error || "") + (total ? " (las " + total + " primeras sí quedaron)" : "")); break; }
        const nuevas = (d.ideas || []).map((i) => ({ ...i, id: uid(), estado: "backlog", fecha: new Date().toISOString().slice(0, 10) }));
        acumuladas = [...nuevas, ...acumuladas];
        total += nuevas.length;
        patch(acumuladas);   // van apareciendo en pantalla tanda a tanda
        flash(`${total} ideas listas${tanda === 1 ? "… generando más" : ". Aprueba las mejores (apunta a ~10)."}`);
      }
    } catch { flash("No pude conectar con el motor." + (total ? " (las " + total + " primeras sí quedaron)" : "")); }
    finally { setBusy(false); }
  }

  async function generarX(idea) {
    setBusyX(idea.id);
    try {
      const base = `Idea: ${idea.idea}\nGancho: ${idea.gancho || ""}\nFormato: ${idea.formato || ""}`;
      const r = await fetch(MOTOR + "/generar_contenido", { method: "POST", headers: H(), body: JSON.stringify({ red: "x", tipo: "x", tema: idea.idea, base }) });
      const d = await r.json();
      if (!d.contenido) return flash("No pude generar para X: " + (d.error || ""));
      patch(ideas.map((y) => y.id === idea.id ? { ...y, textoX: d.contenido } : y));
      setAbierta(idea.id);
      flash("Texto para X listo. Cópialo y pégalo.");
    } catch { flash("No pude conectar con el motor."); }
    finally { setBusyX(""); }
  }
  function copiarX(t) { try { navigator.clipboard.writeText(t || ""); flash("Copiado. Pégalo en X."); } catch {} }

  async function generarGuion(idea) {
    setBusyGuion(idea.id);
    try {
      const r = await fetch(MOTOR + "/viral/guion", { method: "POST", headers: H(), body: JSON.stringify({ idea: idea.idea, gancho: idea.gancho, formato: idea.formato, nivel: idea.nivel }) });
      const d = await r.json();
      if (!d.ok) return flash("No pude generar el guion: " + (d.error || ""));
      patch(ideas.map((x) => x.id === idea.id ? { ...x, guion: d.guion } : x));
      setAbierta(idea.id);
      flash("Guion de 5 partes listo.");
    } catch { flash("No pude conectar con el motor."); }
    finally { setBusyGuion(""); }
  }

  function variacion(idea) {
    const nueva = { ...idea, id: uid(), idea: idea.idea + " (variación)", estado: "aprobada", guion: null, fecha: new Date().toISOString().slice(0, 10), varianteDe: idea.id };
    patch([nueva, ...ideas]);
    flash("Variación creada (misma estructura, nuevo texto/sonido). Génerale su guion.");
  }
  function copiarGuion(g) {
    const t = `GANCHO (4-7s): ${g.gancho}\n\nCONTEXTO: ${g.contexto}\n\nMORALEJA: ${g.moraleja}\n\nFILTRADO: ${g.filtrado}\n\nCTA: ${g.cta}\n\nTEXTO EN PANTALLA: ${g.texto_pantalla}\n\nGRABACIÓN: ${g.indicaciones_grabacion}`;
    try { navigator.clipboard.writeText(t); flash("Guion copiado."); } catch {}
  }

  const visibles = ideas.filter((x) => {
    if (filtro === "activas") return !["descartada", "ganadora"].includes(x.estado);
    if (filtro === "ganadoras") return x.estado === "ganadora";
    if (filtro === "descartadas") return x.estado === "descartada";
    return true;
  });
  const aprobadas = ideas.filter((x) => ["aprobada", "grabada", "publicada", "ganadora"].includes(x.estado)).length;

  return (
    <div style={{ maxWidth: 1100 }}>
      <div className="mb-4">
        <h2 style={{ fontWeight: 600, color: C.cream }} className="fs-18 flex items-center gap-2"><Flame size={17} color={C.aether} /> Contenido viral</h2>
        <div style={{ color: C.ash }} className="fs-11 mt-1 leading-snug">Las redes son para entretener: engancha primero (amplio, nivel 0-1), enseña en el medio, vende al final con CTA. Genera ideas, filtra las mejores, saca su guion de 5 partes, y aplica el 80/20: mata lo que no funciona y dobla la apuesta en lo que sí.</div>
      </div>

      {/* generador */}
      <div style={{ background: C.panel, border: `1px solid ${C.line}` }} className="rounded-xl p-4 mb-4">
        <div className="flex items-center gap-2 flex-wrap">
          <input style={{ ...inS, maxWidth: 420 }} value={tema} onChange={(e) => setTema(e.target.value)} placeholder="Enfoque del lote (opcional, ej. dueños de clínicas)" />
          <button onClick={generarLote} disabled={busy} style={{ background: C.aether, color: C.obsidian, fontWeight: 600, opacity: busy ? 0.6 : 1 }} className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg fs-12"><Sparkles size={13} className={busy ? "animate-pulse" : ""} /> {busy ? "Generando y puntuando…" : "Generar 20 ideas puntuadas"}</button>
          <span style={{ color: C.ash }} className="fs-10">{ideas.length} en el backlog · {aprobadas} aprobadas</span>
        </div>
      </div>

      {/* filtros */}
      <div className="flex flex-wrap gap-2 mb-3">
        {[["activas", "Activas"], ["ganadoras", "🏆 Ganadoras"], ["descartadas", "Descartadas"], ["todas", "Todas"]].map(([v, l]) => (
          <button key={v} onClick={() => setFiltro(v)} style={{ background: filtro === v ? C.aetherSoft : C.panel, border: `1px solid ${filtro === v ? C.aetherLine : C.line}`, color: filtro === v ? C.aether2 : C.mist }} className="px-3 py-1.5 rounded-lg fs-11">{l}</button>
        ))}
      </div>

      {visibles.length === 0 ? (
        <div style={{ background: C.panel, border: `1px solid ${C.line}`, color: C.ash }} className="rounded-xl p-6 fs-12 text-center">Genera tu primer lote de ideas. La IA las puntúa con los 7 criterios del filtro viral (amplia, aplicable, polémica, formato, congruencia, gancho, fácil de grabar).</div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {visibles.map((x) => {
            const open = abierta === x.id;
            return (
              <div key={x.id} style={{ background: C.panel, border: `1px solid ${x.estado === "ganadora" ? "rgba(216,182,115,0.45)" : C.line}` }} className="rounded-xl p-3.5">
                <div className="flex items-start gap-3">
                  <button onClick={() => setAbierta(open ? "" : x.id)} style={{ color: C.ash }} className="mt-0.5">{open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}</button>
                  <span title="Score del filtro viral" style={{ background: (x.score || 0) >= 8 ? C.aetherSoft : "rgba(255,255,255,0.05)", border: `1px solid ${(x.score || 0) >= 8 ? C.aetherLine : C.line}`, color: (x.score || 0) >= 8 ? C.aether2 : C.ash, fontFamily: MONO }} className="px-2 py-0.5 rounded fs-10 shrink-0 mt-0.5">{(x.score || 0) >= 9 ? "🔥" : ""}{x.score}</span>
                  <div className="min-w-0 flex-1">
                    <div style={{ color: C.cream }} className="fs-13 leading-snug">{x.idea}</div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span style={{ color: C.aether2 }} className="fs-11 italic">"{x.gancho}"</span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                      <span style={{ background: "rgba(255,255,255,0.05)", border: `1px solid ${C.line}`, color: NIVEL_COLOR[x.nivel] || C.ash, fontFamily: MONO }} className="px-1.5 py-0.5 rounded fs-9">nivel {x.nivel}</span>
                      <span style={{ background: "rgba(255,255,255,0.05)", border: `1px solid ${C.line}`, color: C.ash, fontFamily: MONO }} className="px-1.5 py-0.5 rounded fs-9">{x.formato}</span>
                      <span style={{ color: x.estado === "ganadora" ? C.warn : C.ash, fontFamily: MONO }} className="fs-9">{x.estado}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                    {x.estado === "backlog" && <>
                      <button onClick={() => setEstado(x.id, "aprobada")} title="Aprobar" style={{ color: C.ok, border: `1px solid rgba(127,184,155,0.4)` }} className="p-1.5 rounded-lg"><Check size={13} /></button>
                      <button onClick={() => setEstado(x.id, "descartada")} title="Descartar" style={{ color: C.ash, border: `1px solid ${C.line}` }} className="p-1.5 rounded-lg"><X size={13} /></button>
                    </>}
                    {["aprobada", "grabada", "publicada"].includes(x.estado) && <>
                      <button onClick={() => generarGuion(x)} disabled={!!busyGuion} style={{ background: x.guion ? "transparent" : C.aether, color: x.guion ? C.aether2 : C.obsidian, border: `1px solid ${C.aetherLine}`, fontWeight: 600, opacity: busyGuion ? 0.6 : 1 }} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg fs-11"><Sparkles size={12} /> {busyGuion === x.id ? "Escribiendo…" : x.guion ? "Regenerar guion" : "Guion 5 partes"}</button>
                      <button onClick={() => generarX(x)} disabled={!!busyX} title="Genera el texto para X (Twitter) a partir de esta idea" style={{ background: "transparent", color: C.aether2, border: `1px solid ${C.aetherLine}`, opacity: busyX ? 0.6 : 1 }} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg fs-11"><AtSign size={12} /> {busyX === x.id ? "Escribiendo…" : x.textoX ? "Regenerar X" : "Para X"}</button>
                      {x.estado === "publicada" && <button onClick={() => setEstado(x.id, "ganadora")} title="Funcionó: marcar ganadora (80/20)" style={{ color: C.warn, border: `1px solid rgba(216,182,115,0.4)` }} className="p-1.5 rounded-lg"><Trophy size={13} /></button>}
                      <select value={x.estado} onChange={(e) => setEstado(x.id, e.target.value)} style={{ background: C.carbon, color: C.mist, border: `1px solid ${C.line}`, fontFamily: MONO }} className="fs-10 rounded-lg px-1.5 py-1.5 outline-none">{ESTADOS_IDEA.map((s) => <option key={s} value={s}>{s}</option>)}</select>
                    </>}
                    {x.estado === "ganadora" && <button onClick={() => variacion(x)} style={{ background: C.aether, color: C.obsidian, fontWeight: 600 }} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg fs-11"><RefreshCw size={12} /> Doblar apuesta</button>}
                  </div>
                </div>
                {open && (
                  <div style={{ background: C.carbon, border: `1px solid ${C.line}` }} className="rounded-lg p-3 mt-3 ml-8">
                    {x.criterios && (
                      <div className="flex items-center gap-1.5 flex-wrap mb-2">
                        {Object.entries(x.criterios).map(([k, v]) => (
                          <span key={k} style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${C.line}`, color: v >= 8 ? C.aether2 : C.ash, fontFamily: MONO }} className="px-1.5 py-0.5 rounded fs-9">{k} {v}</span>
                        ))}
                      </div>
                    )}
                    {x.guion ? (
                      <div className="flex flex-col gap-2">
                        {[["GANCHO (4 a 7s)", x.guion.gancho], ["CONTEXTO", x.guion.contexto], ["MORALEJA", x.guion.moraleja], ["FILTRADO", x.guion.filtrado], ["CTA", x.guion.cta]].map(([k, v]) => (
                          <div key={k}><span style={{ color: C.aether500, fontFamily: MONO }} className="fs-9 uppercase">// {k}</span><div style={{ color: C.mist, whiteSpace: "pre-wrap" }} className="fs-12 leading-relaxed">{v}</div></div>
                        ))}
                        <div style={{ borderTop: `1px solid ${C.line}` }} className="pt-2 flex flex-col gap-1">
                          <div style={{ color: C.cream }} className="fs-11">📱 Texto en pantalla: <b>{x.guion.texto_pantalla}</b></div>
                          <div style={{ color: C.ash }} className="fs-10">🎬 {x.guion.indicaciones_grabacion}</div>
                        </div>
                        <div className="flex items-center gap-3 mt-1 flex-wrap">
                          <button onClick={() => copiarGuion(x.guion)} style={{ color: C.aether2 }} className="inline-flex items-center gap-1 fs-11"><Copy size={11} /> Copiar guion</button>
                          {irAEstudio && <button onClick={() => irAEstudio({ titulo: x.guion.texto_pantalla || x.idea, modo: "diseno", prompt: x.idea })} style={{ color: C.aether2 }} className="inline-flex items-center gap-1 fs-11">🎨 Diseño <ArrowRight size={11} /></button>}
                          {irAEstudio && <button onClick={() => irAEstudio({ titulo: x.guion.texto_pantalla || x.idea, modo: "fal", prompt: x.idea + " · " + (x.guion.gancho || "") })} style={{ color: C.aether2 }} className="inline-flex items-center gap-1 fs-11">📸 Imagen/Video FAL <ArrowRight size={11} /></button>}
                          {x.estado === "aprobada" && <button onClick={() => setEstado(x.id, "grabada")} style={{ color: C.ok }} className="fs-11">Marcar grabada ✓</button>}
                          {x.estado === "grabada" && <button onClick={() => setEstado(x.id, "publicada")} style={{ color: C.ok }} className="fs-11">Marcar publicada ✓</button>}
                        </div>
                      </div>
                    ) : (
                      <div style={{ color: C.ash }} className="fs-11">{["aprobada", "grabada", "publicada"].includes(x.estado) ? "Genera el guion de 5 partes para grabarla." : "Aprueba la idea para generar su guion."}</div>
                    )}
                    {x.textoX && (
                      <div style={{ borderTop: `1px solid ${C.line}` }} className="mt-3 pt-3">
                        <div className="flex items-center justify-between mb-1">
                          <span style={{ color: C.aether500, fontFamily: MONO }} className="fs-9 uppercase">// Texto para X (Twitter)</span>
                          <button onClick={() => copiarX(x.textoX)} style={{ color: C.aether2 }} className="inline-flex items-center gap-1 fs-11"><Copy size={11} /> Copiar</button>
                        </div>
                        <div style={{ color: C.mist, whiteSpace: "pre-wrap" }} className="fs-12 leading-relaxed">{x.textoX}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
