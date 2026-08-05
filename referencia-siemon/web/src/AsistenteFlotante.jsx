import React, { useState, useRef, useEffect } from "react";
import { Send, Plus, Check, Sparkles, Settings2, X, MessageCircle, Minus } from "lucide-react";
import { contarPendientes } from "./SeguimientoView.jsx";
import { getToken } from "./db";

// Visualización que el asistente adjunta a su respuesta (número grande, barras o tabla).
function Viz({ v }) {
  const C2 = { carbon: "#131418", line: "rgba(255,255,255,0.08)", aether: "#B1A3E1", aether2: "#CBC0EC", aether500: "#8474BE", cream: "#E9E5DD", mist: "#C9CAD2", ash: "#8B8D98" };
  const M = "'JetBrains Mono', ui-monospace, monospace";
  if (!v || !v.tipo) return null;
  return (
    <div style={{ background: C2.carbon, border: `1px solid ${C2.line}`, maxWidth: "88%" }} className="rounded-xl p-3 mt-1.5">
      {v.titulo && <div style={{ color: C2.aether500, fontFamily: M, letterSpacing: "0.14em" }} className="fs-9 uppercase mb-2">// {v.titulo}</div>}
      {v.tipo === "numero" && (
        <div><span style={{ color: C2.aether2, fontWeight: 700, fontFamily: M }} className="fs-24">{v.valor}</span>
          {v.etiqueta && <span style={{ color: C2.ash }} className="fs-11 ml-2">{v.etiqueta}</span>}</div>
      )}
      {v.tipo === "barras" && Array.isArray(v.datos) && (() => {
        const max = Math.max(...v.datos.map((d) => Number(d.v) || 0), 1);
        return (
          <div className="flex flex-col gap-1.5">{v.datos.slice(0, 8).map((d, i) => (
            <div key={i} className="flex items-center gap-2">
              <span style={{ color: C2.mist, width: 110 }} className="fs-10 truncate shrink-0">{d.k}</span>
              <div className="flex-1" style={{ background: "rgba(255,255,255,0.05)", borderRadius: 4, height: 12 }}>
                <div style={{ width: `${Math.max(4, ((Number(d.v) || 0) / max) * 100)}%`, background: "rgba(177,163,225,0.22)", border: `1px solid ${C2.aether}`, boxSizing: "border-box", height: "100%", borderRadius: 4 }} />
              </div>
              <span style={{ color: C2.aether2, fontFamily: M, minWidth: 52 }} className="fs-10 text-right shrink-0">{d.v}</span>
            </div>
          ))}</div>
        );
      })()}
      {v.tipo === "tabla" && Array.isArray(v.filas) && (
        <div className="overflow-x-auto"><table className="w-full fs-11" style={{ color: C2.cream }}>
          {Array.isArray(v.columnas) && <thead><tr style={{ color: C2.ash, fontFamily: M }} className="fs-9 uppercase">{v.columnas.map((c, i) => <th key={i} style={{ borderBottom: `1px solid ${C2.line}` }} className="text-left font-normal px-2 py-1.5">{c}</th>)}</tr></thead>}
          <tbody>{v.filas.slice(0, 10).map((f, i) => (
            <tr key={i} style={{ borderBottom: `1px solid rgba(255,255,255,0.04)` }}>{(Array.isArray(f) ? f : [f]).map((c, j) => <td key={j} className="px-2 py-1.5" style={{ color: C2.mist }}>{String(c)}</td>)}</tr>
          ))}</tbody>
        </table></div>
      )}
    </div>
  );
}

// Prompt por defecto (editable). Vacio => el motor usa el suyo (rico, con marca + modulos).
const PROMPT_DEFAULT = "";

const C = {
  obsidian: "#0A0B0D", panel: "#16171C", panel2: "#1B1D23", carbon: "#131418", line: "rgba(255,255,255,0.08)",
  aether: "#B1A3E1", aether2: "#CBC0EC", aether500: "#8474BE", aetherSoft: "rgba(177,163,225,0.14)",
  aetherLine: "rgba(177,163,225,0.30)", cream: "#E9E5DD", mist: "#C9CAD2", ash: "#8B8D98",
  ok: "#7FB89B",
};
const SANS = "'Montserrat', system-ui, sans-serif";
const MONO = "'JetBrains Mono', ui-monospace, monospace";
const MOTOR_URL = import.meta.env.VITE_MOTOR_URL || "https://prospeccion.siemondigital.com";
const uid = () => (crypto?.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2, 9));
const today = () => new Date().toISOString().slice(0, 10);
const claveP = (p) => (p.web || p.email || p.nombre || "").toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");

const SUG_SIEMON = [
  "¿Qué leads debería priorizar hoy?",
  "Resúmeme el estado de mi pipeline",
  "Arma una campaña de Meta Ads para mi Diagnóstico, presupuesto $10/día",
  "Escríbeme un post para Instagram sobre automatizar la atención al cliente",
];
const SUG_ACAD = [
  "¿Cómo van mis inscripciones este mes?",
  "Dame 5 ideas de contenido para vender la mentoría",
  "¿Qué oferta me conviene impulsar?",
];

// Snapshot vivo del CRM para que el asistente responda sobre datos reales.
function crmContexto(data, ws, vista) {
  const hoy = today();
  const s = data.siemon || {};
  const a = data.academia || {};
  if (ws === "academia") {
    const insc = a.inscripciones || [];
    const mesActual = hoy.slice(0, 7);
    const delMes = insc.filter((i) => (i.fecha || "").slice(0, 7) === mesActual);
    const ingresos = insc.reduce((x, i) => x + (i.monto || 0), 0);
    const miembros = a.miembros || [];
    const ofertas = (a.ofertas || []).map((o) => `${o.nombre} (${o.precio} ${o.cur}${o.recurrente ? "/mes" : ""})`);
    return [
      `Espacio activo: Infoproductos y comunidad. Modulo actual: ${vista}.`,
      `Inscripciones totales: ${insc.length}. Este mes: ${delMes.length}. Ingresos acumulados: $${ingresos}.`,
      `Miembros de comunidad: ${miembros.length} (activos: ${miembros.filter((m) => m.activo).length}).`,
      `Ofertas: ${ofertas.join("; ")}.`,
      `Ultimas inscripciones: ${insc.slice(-6).map((i) => `${i.alumno} - ${i.oferta} ($${i.monto}, ${i.canal})`).join("; ")}.`,
    ].join("\n");
  }
  const leads = s.leads || [];
  const clientes = leads.filter((l) => l.status === "Cliente");
  const abiertos = leads.filter((l) => !["Cliente", "Perdido"].includes(l.status));
  const pipeline = abiertos.reduce((x, l) => x + (l.valor || 0), 0);
  const porEtapa = {};
  leads.forEach((l) => { porEtapa[l.status] = (porEtapa[l.status] || 0) + 1; });
  const proximas = leads.filter((l) => (l.bookingDate && l.bookingDate >= hoy) || (l.videollamadaDate && l.videollamadaDate >= hoy));
  const prospectos = s.prospectos || [];
  const ofertas = (s.ofertas || []).map((o) => `${o.nombre} (${o.precio} ${o.cur}${o.recurrente ? "/mes" : ""})`);
  const inbound = (s.inbound || []).filter((i) => !i.convertido);
  return [
    `Espacio activo: Siemon Digital (agencia). Modulo actual: ${vista}.`,
    `Leads totales: ${leads.length}. Clientes: ${clientes.length}. Pipeline abierto: $${pipeline}.`,
    `Leads por etapa: ${Object.entries(porEtapa).map(([k, v]) => `${k}: ${v}`).join(", ")}.`,
    `Acciones urgentes pendientes (modulo Seguimiento): ${contarPendientes(leads)}.`,
    `Proximas citas: ${proximas.length ? proximas.map((l) => `${l.name} (${l.videollamadaDate || l.bookingDate})`).join("; ") : "ninguna agendada"}.`,
    `Mensajes entrantes sin convertir: ${inbound.length}${inbound.length ? " (" + inbound.map((i) => `${i.canal}: ${i.autor}`).join("; ") + ")" : ""}.`,
    `Prospectos guardados en Prospeccion: ${prospectos.length}.`,
    `Ofertas: ${ofertas.join("; ")}.`,
    `Ultimos leads: ${leads.slice(0, 8).map((l) => `${l.name} [${l.status}, ${l.leadSource}${l.valor ? ", $" + l.valor : ""}]`).join("; ")}.`,
  ].join("\n");
}

export default function AsistenteFlotante({ data, commit, flash, ws, vista, reload }) {
  const [abierto, setAbierto] = useState(false);
  // historial persistido: sobrevive recargas (localStorage, últimos 40 mensajes)
  const HKEY = "siemon_asistente_historial";
  const [msgs, setMsgs] = useState(() => { try { return JSON.parse(localStorage.getItem(HKEY) || "[]"); } catch { return []; } });
  useEffect(() => { try { localStorage.setItem(HKEY, JSON.stringify(msgs.slice(-40))); } catch {} }, [msgs]);
  const [sugerencias, setSugerencias] = useState([]);
  const [prospectos, setProspectos] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [ajustes, setAjustes] = useState(false);
  const promptGuardado = (data.config && data.config.asistentePrompt) || "";
  const [promptDraft, setPromptDraft] = useState(promptGuardado || PROMPT_DEFAULT);
  const scroller = useRef(null);
  const emails = new Set((data.siemon?.leads || []).map((l) => (l.email || "").toLowerCase()));
  const SUG = ws === "academia" ? SUG_ACAD : SUG_SIEMON;

  useEffect(() => { if (scroller.current) scroller.current.scrollTop = scroller.current.scrollHeight; }, [msgs, busy, abierto]);

  function guardarPrompt() {
    commit({ ...data, config: { ...(data.config || {}), asistentePrompt: promptDraft.trim() } });
    setAjustes(false); flash("Instrucciones del asistente guardadas.");
  }

  async function enviar(texto) {
    const m = (texto || input).trim();
    if (!m || busy) return;
    setInput("");
    const nuevos = [...msgs, { role: "user", content: m }];
    setMsgs(nuevos); setBusy(true);
    try {
      const r = await fetch(MOTOR_URL + "/asistente", {
        method: "POST", headers: { "content-type": "application/json", Authorization: "Bearer " + getToken() },
        body: JSON.stringify({ mensaje: m, historial: msgs.map(({ role, content }) => ({ role, content })), sistema: promptGuardado, contexto: crmContexto(data, ws, vista) }),
      });
      if (!r.ok) throw new Error("HTTP " + r.status);
      const d = await r.json();
      setMsgs([...nuevos, { role: "assistant", content: d.respuesta || "(sin respuesta)", viz: d.viz || null }]);
      setSugerencias(Array.isArray(d.sugerencias) ? d.sugerencias.slice(0, 3) : []);
      if (d.mutado && reload) { try { await reload(); } catch {} }   // el asistente cambió el CRM: refresca
      if (Array.isArray(d.prospectos) && d.prospectos.length) {
        setProspectos(d.prospectos);
        const buenos = d.prospectos.filter((p) => p.encaja);
        if (buenos.length) {
          const prev = data.siemon.prospectos || [];
          const byKey = new Map(prev.map((p) => [claveP(p), p]));
          buenos.forEach((p) => {
            const k = claveP(p); if (!k) return;
            const old = byKey.get(k) || {};
            byKey.set(k, { ...p, servicio: old.servicio || "automatizacion", createdAt: old.createdAt || today(),
              sent: old.sent || false, sentAt: old.sentAt || "", promovido: old.promovido || false });
          });
          commit({ ...data, siemon: { ...data.siemon, prospectos: Array.from(byKey.values()) } });
        }
      }
    } catch (e) {
      setMsgs([...nuevos, { role: "assistant", content: "No pude responder. Revisa que el motor esté activo y con la clave de Claude configurada." }]);
    } finally { setBusy(false); }
  }

  function promover(p) {
    const esYt = (p.canal || p.fuente) === "youtube";
    if (!p.email) { flash(esYt ? "Sin email público; escríbele por su canal de YouTube." : "Sin email público; escríbele por DM (IG/TikTok)."); return; }
    if (emails.has(p.email.toLowerCase())) { flash("Ya está en tus leads."); return; }
    const r = p.redes || {};
    const social = [r.instagram_handle && "IG " + r.instagram_handle, r.tiktok_handle && "TikTok " + r.tiktok_handle,
      esYt && p.subs != null && (p.subs.toLocaleString() + " subs")].filter(Boolean).join(" · ");
    const lead = {
      id: uid(), name: p.nombre || "", email: p.email, company: p.nombre || "", phone: p.telefono || "",
      language: "es", message: "", type: esYt ? "embajador" : "prospeccion",
      leadSource: esYt ? "Prospección YouTube" : "Prospección",
      fuente: p.fuente || "asistente", createdAt: today(), tags: [p.categoria, p.ciudad].filter(Boolean),
      bookingDate: "", estadoLlamada: "", zonaHoraria: "", horaCliente: "", llamadaRealizada: false,
      caminoPostLlamada: "", notasDescubrimiento: "", comentarioAdicional: "",
      videollamadaDate: "", videollamadaZoom: "", videollamadaEstado: "", videollamadaRealizada: false,
      presentacionUrl: "", status: "Nuevo lead", leadOwner: "Andrea", leadOwnerEmail: "andrea@siemondigital.com",
      outreachNotes: [p.web, social, (p.problemas || []).join("; ")].filter(Boolean).join(" | "),
      followUpDate: "", qualified: false, aiSummary: p.mensaje || "", subscribed: true,
      unsubscribedDate: "", unsubscribeReason: "", valor: 0,
    };
    commit({ ...data, siemon: { ...data.siemon, leads: [lead, ...data.siemon.leads] } });
    emails.add(p.email.toLowerCase());
    flash("Promovido a leads: " + (p.nombre || p.email));
  }

  const inS = { background: C.carbon, border: `1px solid ${C.line}`, color: C.cream, borderRadius: 12,
    padding: "11px 13px", width: "100%", fontFamily: SANS, fontSize: 14, outline: "none" };

  // ---- Botón flotante (cerrado) ----
  if (!abierto) {
    return (
      <button onClick={() => setAbierto(true)} aria-label="Abrir asistente"
        style={{ position: "fixed", right: 20, bottom: 20, zIndex: 60, background: C.aether, color: C.obsidian,
          boxShadow: "0 10px 30px rgba(0,0,0,0.45), 0 0 0 1px rgba(177,163,225,0.4)", borderRadius: 999 }}
        className="flex items-center gap-2 pl-4 pr-5 py-3.5 font-semibold">
        <Sparkles size={18} strokeWidth={2.3} />
        <span style={{ fontFamily: SANS, fontSize: 14 }} className="hidden sm:inline">Asistente</span>
      </button>
    );
  }

  // ---- Panel de chat (abierto) ----
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 60, pointerEvents: "none" }}>
      {/* velo solo en móvil */}
      <div onClick={() => setAbierto(false)} className="sm:hidden" style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)", pointerEvents: "auto" }} />
      <div style={{ position: "absolute", right: 0, bottom: 0, pointerEvents: "auto",
        width: "min(420px, 100vw)", height: "min(640px, 100vh)",
        background: C.panel, borderTopLeftRadius: 18, borderTopRightRadius: 18,
        border: `1px solid ${C.aetherLine}`, boxShadow: "0 -8px 40px rgba(0,0,0,0.5)",
        display: "flex", flexDirection: "column", fontFamily: SANS }}
        className="sm:m-4 sm:rounded-2xl">
        {/* header */}
        <div style={{ borderBottom: `1px solid ${C.line}` }} className="flex items-center justify-between px-4 py-3 shrink-0">
          <div className="flex items-center gap-2">
            <div style={{ background: C.aetherSoft, border: `1px solid ${C.aetherLine}` }} className="rounded-lg p-1.5"><Sparkles size={15} color={C.aether} /></div>
            <div>
              <div style={{ color: C.cream, fontWeight: 600 }} className="fs-13">Asistente Siemon</div>
              <div style={{ color: C.ash, fontFamily: MONO }} className="fs-9 uppercase tracking-wider">{ws === "academia" ? "Academia" : "Agencia"} · {vista}</div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => { setPromptDraft(promptGuardado || PROMPT_DEFAULT); setAjustes((v) => !v); }} title="Instrucciones del asistente"
              style={{ color: ajustes ? C.aether2 : C.ash }} className="p-1.5 rounded-lg hover:brightness-125"><Settings2 size={16} /></button>
            <button onClick={() => setAbierto(false)} title="Minimizar" style={{ color: C.ash }} className="p-1.5 rounded-lg hover:brightness-125"><Minus size={16} /></button>
          </div>
        </div>

        {ajustes && (
          <div style={{ background: C.panel2, borderBottom: `1px solid ${C.line}` }} className="px-4 py-3 shrink-0">
            <div style={{ color: C.ash }} className="fs-11 mb-2 leading-snug">Instrucciones extra para el asistente. Se suman a su base. Déjalo vacío para el comportamiento de fábrica.</div>
            <textarea value={promptDraft} onChange={(e) => setPromptDraft(e.target.value)} rows={4}
              placeholder="Ej: prioriza siempre los leads en etapa Propuesta; escribe más corto…"
              style={{ background: C.carbon, border: `1px solid ${C.line}`, color: C.cream, borderRadius: 10, padding: "9px 11px", width: "100%", fontFamily: SANS, fontSize: 12.5, lineHeight: 1.5, outline: "none", resize: "vertical" }} />
            <div className="flex items-center gap-2 mt-2">
              <button onClick={guardarPrompt} style={{ background: C.aether, color: C.obsidian, fontWeight: 600 }} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg fs-12"><Check size={13} /> Guardar</button>
              <button onClick={() => { setPromptDraft(""); }} style={{ background: "transparent", border: `1px solid ${C.line}`, color: C.mist }} className="px-3 py-1.5 rounded-lg fs-12">Vaciar</button>
            </div>
          </div>
        )}

        {/* mensajes */}
        <div ref={scroller} className="flex-1 overflow-y-auto cmd-scroll flex flex-col gap-2.5 px-4 py-3" style={{ minHeight: 0 }}>
          {msgs.length === 0 && (
            <div className="flex flex-col gap-2 mt-1">
              <div style={{ color: C.mist }} className="fs-13 mb-1">Hola Andrea. Puedo ayudarte con tus leads, tu pipeline, prospección, contenido y más. Prueba con:</div>
              {SUG.map((s, i) => (
                <button key={i} onClick={() => enviar(s)} style={{ background: C.carbon, border: `1px solid ${C.line}`, color: C.mist }} className="text-left px-3.5 py-2.5 rounded-xl fs-12.5 hover:brightness-125">{s}</button>
              ))}
            </div>
          )}
          {msgs.map((m, i) => (
            <div key={i}>
              <div className="flex" style={{ justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
                <div style={{ background: m.role === "user" ? C.aether : C.carbon, color: m.role === "user" ? C.obsidian : C.cream,
                  border: m.role === "user" ? "none" : `1px solid ${C.line}`, maxWidth: "88%", whiteSpace: "pre-wrap", lineHeight: 1.55 }}
                  className="px-3.5 py-2 rounded-2xl fs-13">{m.content}</div>
              </div>
              {m.viz && <Viz v={m.viz} />}
            </div>
          ))}
          {busy && <div style={{ color: C.ash }} className="fs-12 flex items-center gap-2"><span className="animate-pulse">Pensando…</span></div>}
          {!busy && sugerencias.length > 0 && msgs.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {sugerencias.map((s, i) => (
                <button key={i} onClick={() => enviar(s)} style={{ background: "transparent", border: `1px solid ${C.aetherLine}`, color: C.aether2 }} className="px-2.5 py-1 rounded-full fs-11 hover:brightness-125">{s}</button>
              ))}
            </div>
          )}

          {prospectos.length > 0 && (
            <div style={{ background: C.carbon, border: `1px solid ${C.line}` }} className="rounded-xl mt-1 overflow-hidden">
              <div style={{ color: C.aether500, fontFamily: MONO, borderBottom: `1px solid ${C.line}` }} className="fs-10 uppercase px-3.5 py-2"><span style={{ color: C.aether }}>// </span>{prospectos.length} prospectos</div>
              <div className="overflow-x-auto cmd-scroll"><table className="w-full">
                <tbody>
                  {prospectos.slice(0, 30).map((p, i) => {
                    const ya = p.email && emails.has(p.email.toLowerCase());
                    const r = p.redes || {};
                    return (
                      <tr key={i} style={{ borderBottom: `1px solid ${C.line}` }}>
                        <td style={{ padding: "8px 12px" }}><span style={{ background: C.aetherSoft, border: `1px solid ${C.aetherLine}`, color: C.aether2, fontFamily: MONO }} className="px-1.5 py-0.5 rounded fs-10">{p.score}</span></td>
                        <td style={{ padding: "8px 12px", color: C.cream }} className="fs-12">{p.nombre}
                          {(p.canal || p.fuente) === "youtube" && <div className="fs-10" style={{ color: C.aether500 }}>{(p.subs || 0).toLocaleString()} subs</div>}
                          {p.web && <div className="fs-10"><a href={p.web} target="_blank" rel="noreferrer" style={{ color: C.ash }}>{p.web.slice(0, 34)}</a></div>}</td>
                        <td style={{ padding: "8px 12px", textAlign: "right" }}>
                          <button onClick={() => promover(p)} disabled={ya || !p.email} style={{ background: ya ? "transparent" : C.aetherSoft, border: `1px solid ${ya ? C.line : C.aetherLine}`, color: ya ? C.ash : C.aether2, opacity: !p.email ? 0.4 : 1 }} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg fs-11">{ya ? <><Check size={11} /> En leads</> : <><Plus size={11} /> Promover</>}</button></td>
                      </tr>);
                  })}
                </tbody>
              </table></div>
            </div>
          )}
        </div>

        {/* input */}
        <div style={{ borderTop: `1px solid ${C.line}` }} className="flex items-end gap-2 px-3 py-3 shrink-0">
          <textarea value={input} onChange={(e) => setInput(e.target.value)} rows={1}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(); } }}
            placeholder="Escribe lo que necesites…" style={{ ...inS, resize: "none", maxHeight: 110 }} />
          <button onClick={() => enviar()} disabled={busy} style={{ background: C.aether, color: C.obsidian, fontWeight: 600, opacity: busy ? 0.6 : 1 }} className="flex items-center justify-center px-3.5 py-3 rounded-xl shrink-0"><Send size={16} strokeWidth={2.4} /></button>
        </div>
      </div>
    </div>
  );
}
