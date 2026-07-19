import React, { useState } from "react";
import { Sprout, Sparkles, Check, Play, RefreshCw, Users, BarChart3, Settings2, Clock, Plus, ImagePlus, Palette } from "lucide-react";
import { getToken } from "./db";
import SelectorMedia from "./SelectorMedia.jsx";

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
const FASE_COLOR = { Bienvenida: "#7FB89B", Convencer: "#CBC0EC", Ventas: "#D8B673", Valor: "#7FB89B", Reabrir: "#CBC0EC", Reagendar: "#7FB89B", Cierre: "#D8B673" };

// horas -> "6 h" / "2 d 2 h"
const fmtH = (h) => { const n = Number(h) || 0; if (n < 24) return n + " h"; const d = Math.floor(n / 24), r = n % 24; return d + " d" + (r ? " " + r + " h" : ""); };
// UTMs del botón (mismo criterio que el motor: utm_source=email)
const conUtm = (url, campId, pasoId) => {
  const u = (url || "").trim();
  if (!/^https?:\/\//i.test(u)) return u;
  try {
    const o = new URL(u);
    if (!o.searchParams.get("utm_source")) o.searchParams.set("utm_source", "email");
    if (!o.searchParams.get("utm_medium")) o.searchParams.set("utm_medium", "nurturing");
    if (!o.searchParams.get("utm_campaign")) o.searchParams.set("utm_campaign", campId || "nurturing");
    if (!o.searchParams.get("utm_content")) o.searchParams.set("utm_content", pasoId || "");
    return o.toString();
  } catch { return u; }
};

export default function NurturingView({ data, commit, flash }) {
  const n = data.siemon.nurturing || {};
  const campanas = n.campanas || [];
  const leads = data.siemon.leads || [];

  const [campId, setCampId] = useState(campanas[0]?.id || "guia");
  const [tab, setTab] = useState("secuencia");
  const [abierto, setAbierto] = useState("");
  const [busyGen, setBusyGen] = useState("");
  const [busyProc, setBusyProc] = useState(false);
  const [edit, setEdit] = useState(null);
  const [instr, setInstr] = useState({});
  const [subiendo, setSubiendo] = useState("");
  const [selMediaPaso, setSelMediaPaso] = useState(null);  // paso con el banco+editor abierto

  const camp = campanas.find((c) => c.id === campId) || campanas[0];
  if (!camp) return (
    <div className="p-8">
      <div style={{ color: C.cream }} className="fs-16 mb-2">Nurturing</div>
      <div style={{ color: C.ash }} className="fs-12">Aún no hay campañas. Cierra y reabre el Centro de Mando: el motor las crea solo la primera vez.</div>
    </div>
  );

  const pasos = camp.pasos || [];
  const secuencia = camp.secuencia || [];
  const cadencia = camp.cadencia || {};
  const cfg = camp.config || {};
  const inscritos = camp.inscritos || {};
  const metricas = camp.metricas || {};
  const secDe = (id) => secuencia.find((s) => s.id === id);
  const listos = pasos.filter((p) => (secDe(p.id)?.cuerpo || "").trim()).length;
  const activos = Object.values(inscritos).filter((i) => (i.estado || "activo") === "activo").length;

  function patchCamp(patch) {
    const nuevas = campanas.map((c) => (c.id === camp.id ? { ...c, ...patch } : c));
    commit({ ...data, siemon: { ...data.siemon, nurturing: { ...n, campanas: nuevas } } });
  }
  const patchCfg = (patch) => patchCamp({ config: { ...cfg, ...patch } });
  const patchCad = (pid, horas) => patchCamp({ cadencia: { ...cadencia, [pid]: Math.max(0, Number(horas) || 0) } });
  const patchBoton = (pid, patch) => patchCamp({
    secuencia: secuencia.map((s) => (s.id === pid ? { ...s, boton: { texto: "Ver la guía", url: cfg.lead_magnet?.url || "", ...(s.boton || {}), ...patch } } : s)),
  });
  const patchMedia = (pid, patch) => patchCamp({
    secuencia: secuencia.map((s) => (s.id === pid ? { ...s, media: { ...(s.media || {}), ...patch } } : s)),
  });
  async function subirMedia(pid, file) {
    if (file.size > 90_000_000) return flash("El archivo pesa más de 90 MB. Graba un clip más corto.");
    setSubiendo(pid);
    flash(file.type.startsWith("video") ? "Convirtiendo tu grabación a GIF… (puede tardar)" : "Optimizando la imagen…");
    try {
      const b64 = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });
      const ext = (file.name.split(".").pop() || "png").toLowerCase();
      const r = await fetch(MOTOR + "/gc/media", { method: "POST", headers: H(), body: JSON.stringify({ data: b64, ext, segundos: 8, fps: 10, ancho: 600 }) });
      const d = await r.json();
      if (!d.ok) return flash("No pude procesarlo: " + (d.error || ""));
      patchMedia(pid, { url: d.url, peso_kb: d.peso_kb, mostrar: true });
      flash(d.aviso || `Listo: ${d.tipo} de ${d.peso_kb} KB ✓`);
    } catch { flash("No pude subir el archivo."); }
    finally { setSubiendo(""); }
  }

  async function generar(pasoId, instruccion) {
    setBusyGen(pasoId);
    try {
      const r = await fetch(MOTOR + "/nurturing/generar", { method: "POST", headers: H(),
        body: JSON.stringify({ campana: camp.id, paso: pasoId, config: cfg, instruccion: instruccion || "",
          boton: secDe(pasoId)?.boton || null, curadas: (data.siemon.blogKeywordsCuradas || []),
          cuerpo_actual: instruccion ? (secDe(pasoId)?.cuerpo || "") : "" }) });
      const d = await r.json();
      if (!d.ok) { flash("No pude redactar: " + (d.error || "")); return null; }
      return d;
    } catch { flash("No pude conectar con el motor."); return null; }
    finally { setBusyGen(""); }
  }
  async function generarUno(pasoId, instruccion) {
    const d = await generar(pasoId, instruccion);
    if (!d) return;
    const meta = pasos.find((p) => p.id === pasoId);
    const prev = secDe(pasoId);
    patchCamp({ secuencia: [...secuencia.filter((s) => s.id !== pasoId),
      { id: pasoId, fase: meta.fase, nombre: meta.nombre, asunto: d.asunto, cuerpo: d.cuerpo,
        ...(prev?.boton ? { boton: prev.boton } : {}),
        ...(prev?.media ? { media: prev.media } : {}) }] });   // botón e imagen no se pierden al regenerar
    setAbierto(pasoId); setInstr((s) => ({ ...s, [pasoId]: "" }));
    flash(instruccion ? "Regenerado con tu pauta. Revísalo." : "Correo redactado. Revísalo y ajústalo.");
  }
  async function generarTodos() {
    setBusyGen("*");
    let nueva = [...secuencia];
    for (const p of pasos) {
      if ((nueva.find((s) => s.id === p.id)?.cuerpo || "").trim()) continue;
      try {
        const r = await fetch(MOTOR + "/nurturing/generar", { method: "POST", headers: H(), body: JSON.stringify({ campana: camp.id, paso: p.id, config: cfg, curadas: (data.siemon.blogKeywordsCuradas || []) }) });
        const d = await r.json();
        if (d.ok) nueva = [...nueva.filter((s) => s.id !== p.id), { id: p.id, fase: p.fase, nombre: p.nombre, asunto: d.asunto, cuerpo: d.cuerpo }];
        flash(`Redactando… ${nueva.filter((s) => (s.cuerpo || "").trim()).length}/${pasos.length}`);
      } catch {}
    }
    patchCamp({ secuencia: nueva }); setBusyGen("");
    flash("Campaña redactada. Revisa cada correo antes de activar.");
  }
  function guardarEdicion() {
    patchCamp({ secuencia: secuencia.map((s) => (s.id === edit.id ? { ...s, asunto: edit.asunto, cuerpo: edit.cuerpo } : s)) });
    setEdit(null); flash("Correo guardado.");
  }
  async function procesar() {
    setBusyProc(true);
    try {
      const r = await fetch(MOTOR + "/nurturing/procesar", { method: "POST", headers: H() });
      const d = await r.json();
      flash(d.ok ? `Listo: ${d.enviados || 0} enviados · ${d.inscritos_nuevos || 0} inscritos nuevos${d.respondieron ? ` · ${d.respondieron} salieron por responder` : ""}${d.pendientes_manana ? ` · ${d.pendientes_manana} quedan para mañana (tope ${d.tope_diario}/día)` : ""}.` : "No pude procesar: " + (d.error || ""));
    } catch { flash("No pude conectar con el motor."); }
    finally { setBusyProc(false); }
  }
  const [busySync, setBusySync] = useState(false);
  async function sincronizar() {
    setBusySync(true);
    try {
      const r = await fetch(MOTOR + "/nurturing/sincronizar", { method: "POST", headers: H() });
      const d = await r.json();
      flash(d.ok ? (d.pausados_por_respuesta ? `${d.pausados_por_respuesta} salieron de la lista por haber respondido ✓` : "Revisado: nadie nuevo respondió (o ya estaban fuera).") : "No pude revisar: " + (d.error || ""));
    } catch { flash("No pude conectar con el motor."); }
    finally { setBusySync(false); }
  }

  const TABS = [
    { id: "secuencia", label: `Correos (${listos}/${pasos.length})`, icon: Sparkles },
    { id: "tiempos", label: "Tiempos", icon: Clock },
    { id: "inscritos", label: `Inscritos (${activos})`, icon: Users },
    { id: "metricas", label: "Métricas", icon: BarChart3 },
    { id: "config", label: "Configuración", icon: Settings2 },
  ];
  const total = Number(Object.values(cadencia).reduce((a, b) => Math.max(a, Number(b) || 0), 0));

  return (
    <div className="p-5 md:p-8" style={{ maxWidth: 1100 }}>
      <div className="mb-4">
        <div style={{ color: C.aether500, fontFamily: MONO, letterSpacing: "0.2em" }} className="fs-10 uppercase mb-2"><span style={{ color: C.aether }}>// </span>Embudos de email</div>
        <h1 style={{ fontWeight: 600, color: C.cream }} className="fs-24 flex items-center gap-2"><Sprout size={20} color={C.aether} /> Nurturing</h1>
        <div style={{ color: C.ash }} className="fs-11 mt-1">Varias campañas a la vez, cada una con su público, sus correos y sus tiempos. Tú defines cuándo sale cada uno.</div>
      </div>

      {/* SELECTOR DE CAMPAÑA */}
      <div className="flex flex-wrap gap-2 mb-4">
        {campanas.map((c) => {
          const on = c.id === camp.id;
          const red = (c.secuencia || []).filter((s) => (s.cuerpo || "").trim()).length;
          return (
            <button key={c.id} onClick={() => { setCampId(c.id); setTab("secuencia"); setAbierto(""); setEdit(null); }}
              style={{ background: on ? C.aetherSoft : C.panel, border: `1px solid ${on ? C.aetherLine : C.line}`, color: on ? C.aether2 : C.mist }}
              className="text-left px-3 py-2 rounded-lg fs-12">
              <div className="flex items-center gap-2">
                {c.activa ? <span style={{ width: 7, height: 7, borderRadius: 9, background: C.ok, display: "inline-block" }} /> : <span style={{ width: 7, height: 7, borderRadius: 9, background: C.ash, opacity: 0.5, display: "inline-block" }} />}
                <span style={{ fontWeight: on ? 600 : 400 }}>{c.nombre}</span>
              </div>
              <div style={{ color: C.ash, fontFamily: MONO }} className="fs-9 mt-0.5">{red}/{(c.pasos || []).length} correos · {c.activa ? "activa" : "pausada"}</div>
            </button>
          );
        })}
      </div>

      {/* CABECERA DE LA CAMPAÑA */}
      <div style={{ background: C.panel, border: `1px solid ${C.line}` }} className="rounded-xl p-3.5 mb-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ color: C.cream, fontWeight: 600 }} className="fs-14">{camp.nombre}</div>
            <div style={{ color: C.ash }} className="fs-11 mt-1">{(camp.disparador || {}).desc}</div>
            <div style={{ color: C.mist }} className="fs-11 mt-1.5 italic">Parte de: {camp.premisa}</div>
          </div>
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <button onClick={() => { if (!camp.activa && listos < pasos.length) return flash(`Redacta los ${pasos.length} correos antes de activar.`); patchCamp({ activa: !camp.activa }); flash(camp.activa ? "Campaña PAUSADA." : "Campaña ACTIVA."); }}
              style={{ background: camp.activa ? "rgba(127,184,155,0.14)" : C.carbon, border: `1px solid ${camp.activa ? "rgba(127,184,155,0.5)" : C.aetherLine}`, color: camp.activa ? C.ok : C.aether2, fontWeight: 600 }} className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg fs-12">
              <Play size={13} /> {camp.activa ? "Activa ✓ (pausar)" : "Activar campaña"}</button>
            <button onClick={procesar} disabled={busyProc} style={{ background: C.aether, color: C.obsidian, fontWeight: 600, opacity: busyProc ? 0.6 : 1 }} className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg fs-12"><RefreshCw size={13} className={busyProc ? "animate-spin" : ""} /> {busyProc ? "Procesando…" : "Procesar ahora"}</button>
            <button onClick={sincronizar} disabled={busySync} title="Revisa tu bandeja: quien respondió sale de la lista" style={{ background: "transparent", border: `1px solid ${C.aetherLine}`, color: C.aether2, opacity: busySync ? 0.6 : 1 }} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg fs-12"><Check size={13} /> {busySync ? "Revisando…" : "Revisar respuestas"}</button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {TABS.map((t) => { const on = tab === t.id; const Ico = t.icon; return (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ background: on ? C.aetherSoft : C.panel, border: `1px solid ${on ? C.aetherLine : C.line}`, color: on ? C.aether2 : C.mist }} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg fs-12"><Ico size={13} /> {t.label}</button>
        ); })}
      </div>

      {/* CORREOS */}
      {tab === "secuencia" && (
        <>
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <span style={{ color: C.ash }} className="fs-11">{listos} de {pasos.length} redactados · toda la campaña dura {fmtH(total)}</span>
            <button onClick={generarTodos} disabled={!!busyGen} style={{ background: "transparent", border: `1px solid ${C.aetherLine}`, color: C.aether2, fontWeight: 600, opacity: busyGen ? 0.6 : 1 }} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg fs-12"><Sparkles size={13} /> {busyGen === "*" ? "Redactando…" : "Redactar los que falten"}</button>
          </div>
          {pasos.map((p) => {
            const s = secDe(p.id); const tiene = !!(s?.cuerpo || "").trim();
            const open = abierto === p.id; const editando = edit?.id === p.id;
            return (
              <div key={p.id} style={{ background: C.panel, border: `1px solid ${open ? C.aetherLine : C.line}` }} className="rounded-xl p-3.5 mb-2.5">
                <div className="flex items-center gap-3 cursor-pointer" onClick={() => setAbierto(open ? "" : p.id)}>
                  <span style={{ background: (FASE_COLOR[p.fase] || C.aether) + "22", color: FASE_COLOR[p.fase] || C.aether, fontFamily: MONO }} className="px-2 py-0.5 rounded fs-9 uppercase shrink-0">{p.fase}</span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ color: C.cream }} className="fs-13">{p.nombre}</div>
                    <div style={{ color: C.ash, fontFamily: MONO }} className="fs-9">sale a las {fmtH(cadencia[p.id] || 0)} de entrar</div>
                  </div>
                  {tiene ? <Check size={15} color={C.ok} className="shrink-0" />
                    : <button onClick={(e) => { e.stopPropagation(); generarUno(p.id); }} disabled={!!busyGen} style={{ background: C.aether, color: C.obsidian, fontWeight: 600, opacity: busyGen ? 0.6 : 1 }} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg fs-11 shrink-0"><Sparkles size={12} /> {busyGen === p.id ? "Redactando…" : "Redactar con IA"}</button>}
                </div>
                {open && tiene && !editando && (
                  <div style={{ background: C.carbon, border: `1px solid ${C.line}` }} className="rounded-lg p-3 mt-3">
                    <div style={{ color: C.cream, fontWeight: 600 }} className="fs-12 mb-2">✉ {s.asunto}</div>
                    <div style={{ color: C.mist, whiteSpace: "pre-wrap" }} className="fs-12 leading-relaxed">{s.cuerpo}</div>
                    <div className="flex items-center gap-3 mt-3">
                      <button onClick={() => setEdit({ id: p.id, asunto: s.asunto, cuerpo: s.cuerpo })} style={{ color: C.aether2 }} className="fs-11">Editar</button>
                      <button onClick={() => generarUno(p.id)} disabled={!!busyGen} style={{ color: C.ash }} className="fs-11" title="Lo escribe de cero, sin pauta">Regenerar de cero</button>
                    </div>
                    {/* MEDIA del correo: imagen o GIF (tus grabaciones del Centro de Mando) */}
                    <div style={{ borderTop: `1px solid ${C.line}` }} className="mt-3 pt-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <div style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase">Imagen o GIF de este correo</div>
                        <button onClick={() => patchMedia(p.id, { mostrar: !(s.media?.mostrar) })}
                          style={{ background: s.media?.mostrar ? "rgba(127,184,155,0.14)" : "transparent", border: `1px solid ${s.media?.mostrar ? "rgba(127,184,155,0.5)" : C.line}`, color: s.media?.mostrar ? C.ok : C.ash }}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg fs-10">
                          {s.media?.mostrar ? <><Check size={11} /> Se muestra</> : "No se muestra"}</button>
                      </div>
                      {s.media?.mostrar && (
                        <>
                          <div className="flex items-center gap-2 mb-2">
                            <label style={{ border: `1px dashed ${C.aetherLine}`, color: C.aether2, cursor: subiendo === p.id ? "wait" : "pointer" }}
                              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg fs-11">
                              <ImagePlus size={13} /> {subiendo === p.id ? "Procesando…" : "Subir imagen o grabación"}
                              <input type="file" accept="image/*,video/*" style={{ display: "none" }}
                                onChange={(e) => e.target.files?.[0] && subirMedia(p.id, e.target.files[0])} />
                            </label>
                            <button onClick={() => setSelMediaPaso(selMediaPaso === p.id ? null : p.id)}
                              style={{ background: selMediaPaso === p.id ? "rgba(177,163,225,0.14)" : "transparent", border: `1px solid ${C.aetherLine}`, color: C.aether2, cursor: "pointer" }}
                              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg fs-11"><Palette size={13} /> Banco + IA + editor</button>
                            <span style={{ color: C.ash }} className="fs-10">Si subes un video, lo convierto a GIF (el video no se reproduce en correo).</span>
                          </div>
                          {selMediaPaso === p.id && (
                            <div className="mb-2">
                              <SelectorMedia contexto={s.asunto || s.nombre || ""} orientDefault="landscape" flash={flash} permitirIA onElegir={(u) => { patchMedia(p.id, { url: u }); setSelMediaPaso(null); }} />
                            </div>
                          )}
                          <input value={s.media?.url || ""} onChange={(e) => patchMedia(p.id, { url: e.target.value })}
                            placeholder="…o pega la URL de una imagen/GIF" style={{ ...inS, fontSize: 12, padding: "8px 10px" }} />
                          <div className="grid grid-cols-2 gap-2 mt-2">
                            <input value={s.media?.alt || ""} onChange={(e) => patchMedia(p.id, { alt: e.target.value })}
                              placeholder="Descripción (alt, si no carga)" style={{ ...inS, fontSize: 12, padding: "8px 10px" }} />
                            <input value={s.media?.pie || ""} onChange={(e) => patchMedia(p.id, { pie: e.target.value })}
                              placeholder="Pie de imagen (opcional)" style={{ ...inS, fontSize: 12, padding: "8px 10px" }} />
                          </div>
                          {(s.media?.url || "").trim() && (
                            <div className="mt-2">
                              <img src={s.media.url} alt="" style={{ width: "100%", maxWidth: 420, borderRadius: 10, display: "block", margin: "0 auto" }} />
                              {s.media?.peso_kb ? <div style={{ color: s.media.peso_kb > 2000 ? C.warn : C.ash, textAlign: "center" }} className="fs-10 mt-1">{s.media.peso_kb} KB {s.media.peso_kb > 2000 ? "· pesa mucho para correo" : "✓"}</div> : null}
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    {/* BOTON del correo (opcional, personalizable, con UTM automático) */}
                    <div style={{ borderTop: `1px solid ${C.line}` }} className="mt-3 pt-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <div style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase">Botón de este correo</div>
                        <button onClick={() => patchBoton(p.id, { mostrar: !(s.boton?.mostrar) })}
                          style={{ background: s.boton?.mostrar ? "rgba(127,184,155,0.14)" : "transparent", border: `1px solid ${s.boton?.mostrar ? "rgba(127,184,155,0.5)" : C.line}`, color: s.boton?.mostrar ? C.ok : C.ash }}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg fs-10">
                          {s.boton?.mostrar ? <><Check size={11} /> Se muestra</> : "No se muestra"}</button>
                      </div>
                      {s.boton?.mostrar && (
                        <>
                          <div className="grid grid-cols-3 gap-2">
                            <input value={s.boton?.texto || ""} onChange={(e) => patchBoton(p.id, { texto: e.target.value })}
                              placeholder="Texto del botón (ej. Ver la guía)" style={{ ...inS, fontSize: 12, padding: "8px 10px" }} />
                            <input value={s.boton?.url || ""} onChange={(e) => patchBoton(p.id, { url: e.target.value })}
                              placeholder="https://siemondigital.com/download-guide/" style={{ ...inS, fontSize: 12, padding: "8px 10px", gridColumn: "span 2" }} />
                          </div>
                          {(s.boton?.url || "").trim() && (
                            <div style={{ color: C.ash, fontFamily: MONO, wordBreak: "break-all" }} className="fs-9 mt-1.5">
                              Se envía con UTM: {conUtm(s.boton.url, camp.id, p.id)}
                            </div>
                          )}
                          <div className="mt-2" style={{ textAlign: "center" }}>
                            <span style={{ background: C.aether, color: C.obsidian, fontWeight: 700, padding: "10px 22px", borderRadius: 10, display: "inline-block" }} className="fs-12">{s.boton?.texto || "Ver más"}</span>
                          </div>
                        </>
                      )}
                    </div>
                    <div style={{ borderTop: `1px solid ${C.line}` }} className="mt-3 pt-3">
                      <div style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase mb-1.5">Regenerar con tu pauta</div>
                      <div className="flex items-center gap-2">
                        <input value={instr[p.id] || ""} onChange={(e) => setInstr({ ...instr, [p.id]: e.target.value })}
                          onKeyDown={(e) => { if (e.key === "Enter" && (instr[p.id] || "").trim() && !busyGen) generarUno(p.id, instr[p.id]); }}
                          placeholder="ej. más corto · quita la escasez · menciona que trabajo con clínicas"
                          style={{ ...inS, flex: 1, fontSize: 12, padding: "8px 10px" }} />
                        <button onClick={() => generarUno(p.id, instr[p.id])} disabled={!!busyGen || !(instr[p.id] || "").trim()}
                          style={{ background: C.aether, color: C.obsidian, fontWeight: 600, opacity: (!!busyGen || !(instr[p.id] || "").trim()) ? 0.5 : 1 }}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg fs-11 shrink-0"><Sparkles size={12} /> {busyGen === p.id ? "Reescribiendo…" : "Aplicar"}</button>
                      </div>
                    </div>
                  </div>
                )}
                {open && editando && (
                  <div style={{ background: C.carbon, border: `1px solid ${C.aetherLine}` }} className="rounded-lg p-3 mt-3">
                    <input style={{ ...inS, marginBottom: 8 }} value={edit.asunto} onChange={(e) => setEdit({ ...edit, asunto: e.target.value })} placeholder="Asunto" />
                    <textarea style={{ ...inS, minHeight: 220, whiteSpace: "pre-wrap", lineHeight: 1.6 }} value={edit.cuerpo} onChange={(e) => setEdit({ ...edit, cuerpo: e.target.value })} />
                    <div style={{ color: C.ash }} className="fs-10 mt-1.5">Usa {"{nombre}"} donde quieras el nombre. El enlace de baja y el rastreo se agregan solos al enviar.</div>
                    <div className="flex items-center gap-3 mt-2">
                      <button onClick={guardarEdicion} style={{ background: C.aether, color: C.obsidian, fontWeight: 600 }} className="px-3.5 py-1.5 rounded-lg fs-12">Guardar</button>
                      <button onClick={() => setEdit(null)} style={{ color: C.ash }} className="fs-12">Cancelar</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </>
      )}

      {/* TIEMPOS (horas, editable por Andrea) */}
      {tab === "tiempos" && (
        <div style={{ background: C.panel, border: `1px solid ${C.line}` }} className="rounded-xl p-4">
          <div style={{ color: C.cream, fontWeight: 600 }} className="fs-13 mb-1">¿Cuándo sale cada correo?</div>
          <div style={{ color: C.ash }} className="fs-11 mb-4">Horas desde que la persona entra a la campaña. 0 = al instante · 24 = un día después. Toda la campaña dura ahora <b style={{ color: C.aether2 }}>{fmtH(total)}</b>.</div>
          {pasos.map((p, i) => (
            <div key={p.id} className="flex items-center gap-3 py-2" style={{ borderBottom: `1px solid ${C.line}` }}>
              <span style={{ background: (FASE_COLOR[p.fase] || C.aether) + "22", color: FASE_COLOR[p.fase] || C.aether, fontFamily: MONO }} className="px-2 py-0.5 rounded fs-9 uppercase shrink-0">{i + 1}</span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ color: C.cream }} className="fs-12">{p.nombre}</div>
                <div style={{ color: C.ash }} className="fs-10">{p.fase}</div>
              </div>
              <input type="number" min={0} step={1} value={cadencia[p.id] ?? 0} onChange={(e) => patchCad(p.id, e.target.value)}
                style={{ ...inS, width: 90, textAlign: "right", padding: "7px 9px", fontSize: 13 }} />
              <span style={{ color: C.ash, fontFamily: MONO, width: 64 }} className="fs-10">horas</span>
              <span style={{ color: C.aether2, fontFamily: MONO, width: 74, textAlign: "right" }} className="fs-10">{fmtH(cadencia[p.id] || 0)}</span>
            </div>
          ))}
          <div className="flex flex-wrap gap-2 mt-4">
            <span style={{ color: C.ash }} className="fs-11 mr-1 self-center">Atajos:</span>
            <button onClick={() => { const c = {}; pasos.forEach((p, i) => { c[p.id] = Math.round((48 / Math.max(1, pasos.length - 1)) * i); }); patchCamp({ cadencia: c }); flash("Repartido en 48 horas."); }}
              style={{ border: `1px solid ${C.aetherLine}`, color: C.aether2 }} className="px-3 py-1.5 rounded-lg fs-11">Repartir en 48 h</button>
            <button onClick={() => { const c = {}; pasos.forEach((p, i) => { c[p.id] = i * 24; }); patchCamp({ cadencia: c }); flash("Un correo por día."); }}
              style={{ border: `1px solid ${C.aetherLine}`, color: C.aether2 }} className="px-3 py-1.5 rounded-lg fs-11">1 por día</button>
            <button onClick={() => { const c = {}; pasos.forEach((p, i) => { c[p.id] = i * 48; }); patchCamp({ cadencia: c }); flash("Un correo cada 2 días."); }}
              style={{ border: `1px solid ${C.aetherLine}`, color: C.aether2 }} className="px-3 py-1.5 rounded-lg fs-11">1 cada 2 días</button>
          </div>
          <div style={{ color: C.ash }} className="fs-10 mt-3">El motor revisa los envíos cada hora, así que los tiempos se respetan con precisión de una hora.</div>
        </div>
      )}

      {/* INSCRITOS */}
      {tab === "inscritos" && (
        <div style={{ background: C.panel, border: `1px solid ${C.line}` }} className="rounded-xl p-4">
          {Object.keys(inscritos).length === 0 ? (
            <div style={{ color: C.ash }} className="fs-12 text-center py-4">Aún no hay inscritos en esta campaña. {(camp.disparador || {}).tipo === "manual" ? "Los inscribes tú desde Leads o Prospección." : "Entran solos: " + (camp.disparador || {}).desc}</div>
          ) : Object.entries(inscritos).map(([em, i]) => (
            <div key={em} className="flex items-center gap-3 py-2" style={{ borderBottom: `1px solid ${C.line}` }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ color: C.cream }} className="fs-12">{i.nombre || em}</div>
                <div style={{ color: C.ash, fontFamily: MONO }} className="fs-10">{em}</div>
              </div>
              <span style={{ color: C.mist, fontFamily: MONO }} className="fs-10">correo {Math.min((i.paso || 0) + 1, pasos.length)}/{pasos.length}</span>
              <span style={{ background: (i.estado || "activo") === "activo" ? "rgba(127,184,155,0.14)" : C.carbon, color: (i.estado || "activo") === "activo" ? C.ok : C.ash, fontFamily: MONO }} className="px-2 py-1 rounded fs-10">{i.estado || "activo"}</span>
            </div>
          ))}
        </div>
      )}

      {/* MÉTRICAS */}
      {tab === "metricas" && (
        <div style={{ background: C.panel, border: `1px solid ${C.line}` }} className="rounded-xl p-4">
          {pasos.map((p) => {
            const m = metricas[p.id] || {};
            const env = m.enviados || 0, ab = m.aperturas || 0, cl = m.clics || 0;
            return (
              <div key={p.id} className="flex items-center gap-3 py-2" style={{ borderBottom: `1px solid ${C.line}` }}>
                <div style={{ minWidth: 0, flex: 1 }}><div style={{ color: C.cream }} className="fs-12">{p.nombre}</div></div>
                <span style={{ color: C.mist, fontFamily: MONO }} className="fs-11">{env} env</span>
                <span style={{ color: C.ok, fontFamily: MONO }} className="fs-11">{ab} abiertos {env ? `(${Math.round((ab / env) * 100)}%)` : ""}</span>
                <span style={{ color: C.aether2, fontFamily: MONO }} className="fs-11">{cl} clics</span>
              </div>
            );
          })}
          <div style={{ color: C.ash }} className="fs-11 mt-3">Bajas: {metricas.bajas || 0}</div>
        </div>
      )}

      {/* CONFIG */}
      {tab === "config" && (
        <div style={{ background: C.panel, border: `1px solid ${C.line}` }} className="rounded-xl p-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2" style={{ background: "rgba(127,184,155,0.06)", border: `1px solid rgba(127,184,155,0.3)`, borderRadius: 10, padding: 12 }}>
              <label style={{ color: C.ok, fontFamily: MONO }} className="fs-10 uppercase">📬 Envíos por día (tope global · anti-spam)</label>
              <div className="flex items-center gap-2 mt-1.5">
                <input type="number" min={1} step={1} style={{ ...inS, width: 110 }} value={(n.config?.topeDiario ?? 40)}
                  onChange={(e) => { const v = Math.max(1, Number(e.target.value) || 40); commit({ ...data, siemon: { ...data.siemon, nurturing: { ...n, config: { ...(n.config || {}), topeDiario: v } } } }); }} />
                <span style={{ color: C.ash }} className="fs-11">correos/día en total (todas las campañas). Lo que pase del tope queda para el día siguiente. Sube de a poco (empieza en 15-20).</span>
              </div>
            </div>
            <div className="sm:col-span-2" style={{ background: C.carbon, border: `1px solid ${C.aetherLine}`, borderRadius: 10, padding: 12 }}>
              <label style={{ color: C.aether2, fontFamily: MONO }} className="fs-10 uppercase">★ Tus pautas de escritura (mandan en TODOS los correos de esta campaña)</label>
              <textarea style={{ ...inS, minHeight: 84, marginTop: 4 }} value={cfg.pautas || ""} onChange={(e) => patchCfg({ pautas: e.target.value })}
                placeholder={"Ej.:\n· Nunca uses escasez ni urgencia agresiva\n· Máximo 150 palabras por correo\n· Habla de tú, en neutro (hombre o mujer)\n· Cierra siempre con una pregunta"} />
              <div style={{ color: C.ash }} className="fs-10 mt-1">Se aplican al redactar y al regenerar. Una pauta por línea.</div>
            </div>
            <div><label style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase">Auto-inscribir</label>
              <button onClick={() => patchCamp({ autoInscribir: !camp.autoInscribir })} style={{ ...inS, textAlign: "left", color: camp.autoInscribir ? C.ok : C.ash }}>{camp.autoInscribir ? "Sí, entran solos ✓" : "No, los inscribo yo"}</button></div>
            <div><label style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase">Remitente</label>
              <input style={inS} value={cfg.remitente || ""} onChange={(e) => patchCfg({ remitente: e.target.value })} /></div>
            <div className="sm:col-span-2"><label style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase">Tu LinkedIn (para el correo de presentación)</label>
              <input style={inS} value={cfg.linkedin || ""} onChange={(e) => patchCfg({ linkedin: e.target.value })} placeholder="https://linkedin.com/in/…  (si lo dejas vacío, la IA no lo menciona)" /></div>
            <div className="sm:col-span-2"><label style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase">Buyer persona</label>
              <textarea style={{ ...inS, minHeight: 70 }} value={cfg.persona?.descripcion || ""} onChange={(e) => patchCfg({ persona: { ...(cfg.persona || {}), descripcion: e.target.value } })} /></div>
            <div><label style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase">Objeción principal</label>
              <input style={inS} value={cfg.persona?.objecion_principal || ""} onChange={(e) => patchCfg({ persona: { ...(cfg.persona || {}), objecion_principal: e.target.value } })} /></div>
            <div><label style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase">Falsa solución que ya probó</label>
              <input style={inS} value={cfg.persona?.falsa_solucion || ""} onChange={(e) => patchCfg({ persona: { ...(cfg.persona || {}), falsa_solucion: e.target.value } })} /></div>
            <div><label style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase">Oferta</label>
              <input style={inS} value={cfg.oferta?.nombre || ""} onChange={(e) => patchCfg({ oferta: { ...(cfg.oferta || {}), nombre: e.target.value } })} /></div>
            <div><label style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase">Enlace de la oferta (agendar/comprar)</label>
              <input style={inS} value={cfg.oferta?.url_compra || ""} onChange={(e) => patchCfg({ oferta: { ...(cfg.oferta || {}), url_compra: e.target.value } })} /></div>
            <div><label style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase">Precio actual (USD)</label>
              <input type="number" style={inS} value={cfg.oferta?.precio ?? ""} onChange={(e) => patchCfg({ oferta: { ...(cfg.oferta || {}), precio: Number(e.target.value) || 0 } })} /></div>
            <div><label style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase">Precio normal (USD, para el "antes")</label>
              <input type="number" style={inS} value={cfg.oferta?.precio_normal ?? ""} onChange={(e) => patchCfg({ oferta: { ...(cfg.oferta || {}), precio_normal: Number(e.target.value) || 0 } })} placeholder="500 (vacío = sin precio especial)" /></div>
            <div className="sm:col-span-2"><label style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase">Motivo REAL del precio especial (lo van a leer tus prospectos)</label>
              <textarea style={{ ...inS, minHeight: 56 }} value={cfg.oferta?.motivo_precio || ""} onChange={(e) => patchCfg({ oferta: { ...(cfg.oferta || {}), motivo_precio: e.target.value } })} placeholder="Debe ser cierto: la IA lo va a contar tal cual a tus prospectos." /></div>
            <div><label style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase">Plazas reales al mes</label>
              <input type="number" style={inS} value={cfg.oferta?.max_plazas ?? ""} onChange={(e) => patchCfg({ oferta: { ...(cfg.oferta || {}), max_plazas: Number(e.target.value) || 0 } })} /></div>
            <div className="sm:col-span-2"><label style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase">Lead magnet (enlace real)</label>
              <input style={inS} value={cfg.lead_magnet?.url || ""} onChange={(e) => patchCfg({ lead_magnet: { ...(cfg.lead_magnet || {}), url: e.target.value } })} /></div>
          </div>
        </div>
      )}
    </div>
  );
}
