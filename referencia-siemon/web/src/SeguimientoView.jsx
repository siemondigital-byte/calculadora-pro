import React, { useMemo, useState } from "react";
import { Bell, Clock, AlertTriangle, ArrowRight, Timer, CheckCircle2, Sparkles, Copy, X } from "lucide-react";
import { getToken } from "./db";

const C = {
  obsidian: "#0A0B0D", panel: "#16171C", carbon: "#131418", line: "rgba(255,255,255,0.08)",
  aether: "#B1A3E1", aether2: "#CBC0EC", aether500: "#8474BE", aetherSoft: "rgba(177,163,225,0.14)",
  aetherLine: "rgba(177,163,225,0.30)", cream: "#E9E5DD", mist: "#C9CAD2", ash: "#8B8D98",
  ok: "#7FB89B", warn: "#D8B673", warnSoft: "rgba(216,182,115,0.14)", danger: "#D08A8A", dangerSoft: "rgba(208,138,138,0.14)",
};
const SANS = "'Montserrat', system-ui, sans-serif";
const MONO = "'JetBrains Mono', ui-monospace, monospace";
const MOTOR = import.meta.env.VITE_MOTOR_URL || "https://prospeccion.siemondigital.com";
const hoyISO = () => new Date().toISOString().slice(0, 10);
const dias = (d, hoy) => (d ? Math.floor((Date.parse(hoy) - Date.parse(String(d).slice(0, 10))) / 86400000) : null);

// Pista según la fuente/origen, para personalizar el primer contacto.
function pistaFuente(l) {
  const f = (l.fuente || l.leadSource || "").toLowerCase();
  if (/guia|guía/.test(f)) return "descargó tu guía";
  if (/ad|meta|google|paid/.test(f)) return "vino de un anuncio";
  if (/outreach|frio|frío/.test(f)) return "prospecto en frío";
  if (/embajad|afiliad/.test(f)) return "posible embajador/afiliado";
  if (/instagram|ig/.test(f)) return "llegó por Instagram";
  if (/linkedin/.test(f)) return "llegó por LinkedIn";
  if (/youtube/.test(f)) return "llegó por YouTube";
  if (/dm/.test(f)) return "llegó por DM";
  if (/referid/.test(f)) return "es un referido";
  if (/app|mentalidad|finanzas|cartilla|bono|order/.test(f)) return "viene de un infoproducto";
  return "";
}

// Motor de próximos pasos. Devuelve {paso, urgencia, motivo} o null (nada que hacer).
export function pasoDeLead(l, hoy = hoyISO()) {
  const st = l.status || "Nuevo lead";
  if (st === "Perdido") return null;
  const fUp = l.followUpDate;
  const venc = fUp && fUp < hoy;
  const pista = pistaFuente(l);
  const conPista = (t) => (pista ? t + " (" + pista + ")" : t);

  if (st === "Cliente") {
    return { paso: "Cliente activo: pide un referido o propón acompañamiento continuo.", urgencia: "baja", motivo: "cliente" };
  }
  if (st === "Nuevo lead") {
    const d = dias(l.createdAt, hoy);
    if (d != null && d >= 2) return { paso: conPista("Sin contactar hace " + d + " días. Envía el primer mensaje ya."), urgencia: "alta", motivo: "sin contactar" };
    return { paso: conPista("Nuevo lead: envía el primer mensaje o dale la bienvenida."), urgencia: "media", motivo: "nuevo" };
  }
  if (st === "Llamada agendada") {
    const b = l.bookingDate ? String(l.bookingDate).slice(0, 10) : null;
    if (b && b <= hoy) return { paso: "Llamada de hoy o vencida: realízala y registra el resultado.", urgencia: "alta", motivo: "llamada hoy" };
    return { paso: "Llamada agendada" + (b ? " para " + b : "") + ". Prepárala.", urgencia: "baja", motivo: "agendada" };
  }
  if (st === "Descubrimiento") {
    return { paso: venc ? "Descubrimiento hecho y seguimiento vencido. Envía propuesta o agenda videollamada." : "Descubrimiento hecho: envía propuesta o agenda videollamada.", urgencia: venc ? "alta" : "media", motivo: "descubrimiento" };
  }
  if (st === "Videollamada") {
    const v = l.videollamadaDate ? String(l.videollamadaDate).slice(0, 10) : null;
    if (v && v <= hoy) return { paso: "Videollamada de hoy o vencida: realízala y registra.", urgencia: "alta", motivo: "videollamada hoy" };
    return { paso: "Videollamada agendada" + (v ? " para " + v : "") + ". Prepárala.", urgencia: "baja", motivo: "agendada" };
  }
  if (st === "Propuesta") {
    return { paso: venc ? "Propuesta sin seguimiento (vencido " + fUp + "). Haz seguimiento hoy." : "Propuesta enviada: haz seguimiento y resuelve dudas.", urgencia: venc ? "alta" : "media", motivo: "propuesta" };
  }
  // etapas propias u otras
  if (venc) return { paso: "Seguimiento vencido (" + fUp + "). Retoma el contacto.", urgencia: "alta", motivo: "vencido" };
  return { paso: "Da el siguiente paso con este lead.", urgencia: "baja", motivo: "otro" };
}

const ORD = { alta: 0, media: 1, baja: 2 };
export function contarPendientes(leads, hoy = hoyISO()) {
  return (leads || []).reduce((n, l) => { const p = pasoDeLead(l, hoy); return n + (p && p.urgencia === "alta" ? 1 : 0); }, 0);
}

const TONO = {
  alta: { bg: C.dangerSoft, bd: "rgba(208,138,138,0.4)", fg: C.danger, label: "Urgente" },
  media: { bg: C.warnSoft, bd: "rgba(216,182,115,0.4)", fg: C.warn, label: "Pronto" },
  baja: { bg: "rgba(255,255,255,0.05)", bd: C.line, fg: C.ash, label: "En cola" },
};

// acción de IA sugerida según la etapa del lead
function accionIA(l) {
  const st = l.status || "";
  if (st === "Llamada agendada") return { label: "Guion de llamada", inst: "Escribe un guion breve (5 a 7 puntos) para la llamada de descubrimiento: apertura calida, 3 preguntas de diagnostico, y cierre proponiendo el siguiente paso." };
  if (st === "Videollamada") return { label: "Preparar agenda", inst: "Escribe la agenda de la videollamada: objetivo, 4 puntos a cubrir, y el cierre con propuesta de siguiente paso. Breve y accionable." };
  if (st === "Propuesta") return { label: "WhatsApp de seguimiento", inst: "Escribe un WhatsApp corto y natural de seguimiento a la propuesta enviada: sin presionar, resolviendo dudas y facilitando el si." };
  if (st === "Cliente") return { label: "Pedir referido", inst: "Escribe un mensaje calido para pedirle un referido a un cliente activo y contento, mencionando que su recomendacion vale mucho." };
  if (st === "Descubrimiento") return { label: "Email de propuesta", inst: "Escribe el email para enviar la propuesta despues del descubrimiento: resume lo que entendiste de su reto, presenta la solucion y el CTA." };
  return { label: "Generar email", inst: "Escribe el primer email de contacto: calido, personalizado a su origen, con una pregunta que invite a responder." };
}

// agrupación temporal: Vencidas / Hoy / Esta semana / Más adelante
function grupoDe(l, p, hoy) {
  const fechas = [l.followUpDate, l.bookingDate && String(l.bookingDate).slice(0, 10), l.videollamadaDate && String(l.videollamadaDate).slice(0, 10)].filter(Boolean).sort();
  const f = fechas[0] || "";
  if ((f && f < hoy) || p.urgencia === "alta") return "Vencidas";
  if (f === hoy) return "Hoy";
  const en7 = new Date(Date.parse(hoy) + 7 * 86400000).toISOString().slice(0, 10);
  if (f && f <= en7) return "Esta semana";
  return "Más adelante";
}
const GRUPOS = ["Vencidas", "Hoy", "Esta semana", "Más adelante"];
const G_TONO = { "Vencidas": "#D08A8A", "Hoy": "#D8B673", "Esta semana": "#CBC0EC", "Más adelante": "#8B8D98" };

// configuración de seguimiento (parametrizable por Andrea)
const CFG_DEF = {
  postEtapa: { "Nuevo lead": 2, "Llamada agendada": 0, "Descubrimiento": 2, "Videollamada": 1, "Propuesta": 3 },
  frioToques: [0, 3, 7],   // días del toque 1, 2 y 3 en frío
};
const ETAPAS_CFG = ["Nuevo lead", "Llamada agendada", "Descubrimiento", "Videollamada", "Propuesta"];
function esFrio(l) {
  const f = ((l.fuente || "") + " " + (l.leadSource || "") + " " + (l.type || "")).toLowerCase();
  return /fri[oó]|outreach|prospec/.test(f);
}

export default function SeguimientoView({ data, commit, flash, openDrawer }) {
  const hoy = hoyISO();
  const leads = data.siemon.leads || [];
  const items = useMemo(() => leads.map((l) => ({ l, p: pasoDeLead(l, hoy) })).filter((x) => x.p)
    .sort((a, b) => (ORD[a.p.urgencia] - ORD[b.p.urgencia]) || String(a.l.followUpDate || "9").localeCompare(String(b.l.followUpDate || "9"))), [leads, hoy]);
  const altas = items.filter((x) => x.p.urgencia === "alta").length;
  const medias = items.filter((x) => x.p.urgencia === "media").length;
  const grupos = useMemo(() => {
    const g = { "Vencidas": [], "Hoy": [], "Esta semana": [], "Más adelante": [] };
    items.forEach((x) => g[grupoDe(x.l, x.p, hoy)].push(x));
    return g;
  }, [items, hoy]);

  // borrador de IA por tarea
  const [draft, setDraft] = useState(null);   // {id, label, asunto, cuerpo, busy}
  async function redactar(l, p) {
    const acc = accionIA(l);
    setDraft({ id: l.id, label: acc.label, asunto: "", cuerpo: "", busy: true });
    try {
      const r = await fetch(MOTOR + "/generar_mensaje", {
        method: "POST", headers: { "content-type": "application/json", Authorization: "Bearer " + getToken() },
        body: JSON.stringify({
          nombre: l.name || l.company || "", canal: "email", nicho: (l.tags || []).join(", ") || l.company || "",
          plataforma: l.leadSource || l.fuente || "", bio: (l.notasDescubrimiento || l.message || "").slice(0, 300),
          idioma: l.language || "es", estado: l.status,
          instruccion: acc.inst + " Contexto del CRM: " + p.paso,
        }),
      });
      const d = await r.json();
      if (d.error) { flash("No pude redactar."); setDraft(null); return; }
      setDraft({ id: l.id, label: acc.label, asunto: d.asunto || "", cuerpo: d.cuerpo || "", busy: false });
    } catch { flash("No pude conectar con el motor."); setDraft(null); }
  }
  function copiarDraft() { try { navigator.clipboard.writeText((draft.asunto ? draft.asunto + "\n\n" : "") + draft.cuerpo); flash("Borrador copiado."); } catch {} }

  function posponer(id, d) {
    const nf = new Date(Date.now() + d * 86400000).toISOString().slice(0, 10);
    commit({ ...data, siemon: { ...data.siemon, leads: leads.map((l) => l.id === id ? { ...l, followUpDate: nf } : l) } });
    flash("Pospuesto a " + nf);
  }

  // configuración parametrizable
  const cfg = { frioToques: (data.siemon.seguimientoConfig || {}).frioToques || CFG_DEF.frioToques,
                postEtapa: { ...CFG_DEF.postEtapa, ...((data.siemon.seguimientoConfig || {}).postEtapa || {}) } };
  const [cfgOpen, setCfgOpen] = useState(false);
  function setCfg(patch) { commit({ ...data, siemon: { ...data.siemon, seguimientoConfig: { ...cfg, ...patch } } }); }
  function fechaEn(d) { return new Date(Date.now() + (Number(d) || 0) * 86400000).toISOString().slice(0, 10); }

  // programa un followUp para cada lead según su etapa (los que no tengan uno futuro)
  function programarSeguimientos() {
    let n = 0;
    const nuevos = leads.map((l) => {
      if (["Cliente", "Perdido"].includes(l.status)) return l;
      if (l.followUpDate && l.followUpDate >= hoy) return l;
      const d = cfg.postEtapa[l.status];
      if (d == null) return l;
      n++; return { ...l, followUpDate: fechaEn(d) };
    });
    commit({ ...data, siemon: { ...data.siemon, leads: nuevos } });
    flash(n ? `${n} seguimientos programados según tu configuración.` : "Todos ya tienen seguimiento al día.");
  }

  // 3 toques en frío: marca un toque enviado y agenda el siguiente
  function toqueInfo(l) {
    if (!esFrio(l)) return null;
    const n = l.toquesFrio || 0;
    return { n, total: cfg.frioToques.length, agotado: n >= cfg.frioToques.length };
  }
  function marcarToque(l) {
    const total = cfg.frioToques.length;
    const n = (l.toquesFrio || 0) + 1;
    const patch = { toquesFrio: n, ultimoToqueFecha: hoy };
    if (n < total) { const gap = (cfg.frioToques[n] - cfg.frioToques[n - 1]) || 3; patch.followUpDate = fechaEn(gap); }
    else { patch.followUpDate = ""; }
    commit({ ...data, siemon: { ...data.siemon, leads: leads.map((x) => x.id === l.id ? { ...x, ...patch } : x) } });
    flash(n < total ? `Toque ${n} de ${total} enviado. El siguiente se agendó en ${(cfg.frioToques[n] - cfg.frioToques[n - 1]) || 3} días.`
                    : `Toque ${n} de ${total}: completaste la secuencia en frío. Si no respondió, decide si lo enfrías o lo marcas Perdido.`);
  }

  return (
    <div className="p-5 md:p-8" style={{ maxWidth: 1100 }}>
      <div className="mb-5">
        <div style={{ color: C.aether500, fontFamily: MONO, letterSpacing: "0.2em" }} className="fs-10 uppercase mb-2"><span style={{ color: C.aether }}>// </span>Seguimiento</div>
        <h1 style={{ fontWeight: 600, color: C.cream }} className="fs-24 flex items-center gap-2"><Bell size={20} color={C.aether} /> Próximos pasos</h1>
        <div style={{ color: C.ash }} className="fs-11 mt-1">Qué hacer con cada prospecto según su etapa, su fuente y el tiempo. Ordenado por urgencia.</div>
      </div>

      <div className="flex items-center gap-3 flex-wrap mb-4">
        <button onClick={programarSeguimientos} title="Agenda un seguimiento a cada lead según su etapa y tu configuración" style={{ background: C.aetherSoft, border: `1px solid ${C.aetherLine}`, color: C.aether2, fontWeight: 600 }} className="px-3 py-1.5 rounded-lg fs-12 inline-flex items-center gap-1.5"><Clock size={13} /> Programar seguimientos</button>
        <button onClick={() => setCfgOpen((v) => !v)} style={{ color: C.ash }} className="fs-11">{cfgOpen ? "▾" : "▸"} configurar tiempos</button>
      </div>
      {cfgOpen && (
        <div style={{ background: C.panel, border: `1px solid ${C.line}` }} className="rounded-xl p-4 mb-5">
          <div style={{ color: C.aether500, fontFamily: MONO, letterSpacing: "0.14em" }} className="fs-10 uppercase mb-2">// Tiempos de seguimiento</div>
          <div style={{ color: C.ash }} className="fs-10 mb-2">Días para agendar el seguimiento después de cada etapa:</div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-4">
            {ETAPAS_CFG.map((et) => (
              <div key={et}>
                <label style={{ color: C.ash, fontFamily: MONO }} className="fs-9">{et}</label>
                <input type="number" value={cfg.postEtapa[et] ?? ""} onChange={(e) => setCfg({ postEtapa: { ...cfg.postEtapa, [et]: Number(e.target.value) || 0 } })}
                  style={{ background: "#101116", border: `1px solid ${C.line}`, color: C.cream, borderRadius: 8, padding: "5px 8px", width: "100%", fontFamily: MONO, fontSize: 12, outline: "none" }} />
              </div>
            ))}
          </div>
          <div style={{ color: C.ash }} className="fs-10 mb-2">Cadencia de los <b style={{ color: C.mist }}>3 toques en frío</b> (día de cada toque desde el primero):</div>
          <div className="flex items-center gap-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-1">
                <span style={{ color: C.ash, fontFamily: MONO }} className="fs-9">Toque {i + 1} · día</span>
                <input type="number" value={cfg.frioToques[i] ?? ""} onChange={(e) => { const f = [...cfg.frioToques]; f[i] = Number(e.target.value) || 0; setCfg({ frioToques: f }); }}
                  style={{ background: "#101116", border: `1px solid ${C.line}`, color: C.cream, borderRadius: 8, padding: "5px 8px", width: 60, fontFamily: MONO, fontSize: 12, outline: "none" }} />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-3 mb-6">
        <div style={{ background: C.panel, border: `1px solid ${C.line}` }} className="rounded-xl p-4"><div style={{ color: C.danger, fontWeight: 700 }} className="fs-24">{altas}</div><div style={{ color: C.ash }} className="fs-10">Urgentes</div></div>
        <div style={{ background: C.panel, border: `1px solid ${C.line}` }} className="rounded-xl p-4"><div style={{ color: C.warn, fontWeight: 700 }} className="fs-24">{medias}</div><div style={{ color: C.ash }} className="fs-10">Pronto</div></div>
        <div style={{ background: C.panel, border: `1px solid ${C.line}` }} className="rounded-xl p-4"><div style={{ color: C.aether2, fontWeight: 700 }} className="fs-24">{items.length}</div><div style={{ color: C.ash }} className="fs-10">Acciones totales</div></div>
      </div>

      {items.length === 0 ? (
        <div style={{ background: C.panel, border: `1px solid ${C.line}`, color: C.ash }} className="rounded-xl p-6 flex items-center gap-2 fs-13"><CheckCircle2 size={16} color={C.ok} /> Todo al día. No hay acciones pendientes.</div>
      ) : (
        <div className="flex flex-col gap-5">
          {GRUPOS.filter((g) => grupos[g].length > 0).map((g) => (
            <div key={g}>
              <div className="flex items-center gap-2 mb-2">
                <span style={{ color: G_TONO[g], fontFamily: MONO, letterSpacing: "0.16em" }} className="fs-10 uppercase">{g}</span>
                <span style={{ color: C.ash, fontFamily: MONO }} className="fs-9">({grupos[g].length})</span>
                <div style={{ borderTop: `1px solid ${C.line}` }} className="flex-1" />
              </div>
              <div className="flex flex-col gap-2.5">
                {grupos[g].map(({ l, p }) => {
                  const t = TONO[p.urgencia];
                  const acc = accionIA(l);
                  const tq = toqueInfo(l);
                  const abierto = draft && draft.id === l.id;
                  return (
                    <div key={l.id} style={{ background: C.panel, border: `1px solid ${p.urgencia === "alta" ? "rgba(208,138,138,0.3)" : C.line}` }} className="rounded-xl p-3.5">
                      <div className="flex items-start gap-3">
                        <div style={{ background: t.bg, border: `1px solid ${t.bd}`, color: t.fg, fontFamily: MONO }} className="px-2 py-0.5 rounded fs-9 shrink-0 mt-0.5 flex items-center gap-1">{p.urgencia === "alta" ? <AlertTriangle size={10} /> : <Clock size={10} />}{t.label}</div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <button onClick={() => openDrawer(l.id)} style={{ color: C.cream, fontWeight: 600 }} className="fs-13 hover:underline text-left">{l.name || l.email}</button>
                            <span style={{ background: "rgba(255,255,255,0.05)", border: `1px solid ${C.line}`, color: C.ash, fontFamily: MONO }} className="px-1.5 py-0.5 rounded fs-9">{l.status}</span>
                            {l.fuente && <span style={{ color: C.aether500, fontFamily: MONO }} className="fs-9">· {l.fuente}</span>}
                          </div>
                          <div style={{ color: C.mist }} className="fs-12 mt-1 leading-snug">{p.paso}</div>
                          {tq && (
                            <div style={{ color: tq.agotado ? C.ash : C.aether2, fontFamily: MONO }} className="fs-10 mt-1">
                              {tq.agotado ? "🔁 Secuencia en frío completada (3/3). Si no respondió, enfríalo o márcalo Perdido." : `🔁 Toque ${tq.n} de ${tq.total} en frío`}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                          {tq && !tq.agotado && (
                            <button onClick={() => marcarToque(l)} title="Marca este toque en frío como enviado y agenda el siguiente" style={{ background: C.aether, color: C.obsidian, fontWeight: 600 }} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg fs-11">Toque {tq.n + 1} ✓</button>
                          )}
                          <button onClick={() => (abierto ? setDraft(null) : redactar(l, p))} style={{ background: "transparent", border: `1px solid ${C.aetherLine}`, color: C.aether2 }} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg fs-11"><Sparkles size={11} /> {acc.label}</button>
                          <button onClick={() => openDrawer(l.id)} style={{ background: C.aetherSoft, border: `1px solid ${C.aetherLine}`, color: C.aether2 }} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg fs-11">Abrir <ArrowRight size={11} /></button>
                          <button onClick={() => posponer(l.id, 3)} title="Posponer 3 días" style={{ background: "transparent", border: `1px solid ${C.line}`, color: C.ash }} className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg fs-11"><Timer size={11} /> 3d</button>
                        </div>
                      </div>
                      {abierto && (
                        <div style={{ background: C.carbon, border: `1px solid ${C.aetherLine}` }} className="rounded-lg p-3 mt-3">
                          <div className="flex items-center justify-between mb-2">
                            <span style={{ color: C.aether500, fontFamily: MONO }} className="fs-10 uppercase">// {draft.label}</span>
                            <div className="flex items-center gap-2">
                              {!draft.busy && <button onClick={copiarDraft} style={{ color: C.aether2 }} className="inline-flex items-center gap-1 fs-11"><Copy size={11} /> Copiar</button>}
                              <button onClick={() => setDraft(null)} style={{ color: C.ash }}><X size={13} /></button>
                            </div>
                          </div>
                          {draft.busy ? <div style={{ color: C.ash }} className="fs-12">La IA está redactando…</div> : (
                            <>
                              {draft.asunto && <div style={{ color: C.cream, fontWeight: 600 }} className="fs-12 mb-1.5">{draft.asunto}</div>}
                              <div style={{ color: C.mist, whiteSpace: "pre-wrap" }} className="fs-12 leading-relaxed">{draft.cuerpo}</div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
