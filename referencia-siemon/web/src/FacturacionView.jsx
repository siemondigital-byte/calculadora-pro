import React, { useState, useMemo } from "react";
import { Receipt, Plus, Check, X, Trash2, AlertTriangle, TrendingUp, TrendingDown } from "lucide-react";
import Combo, { opcionesDe, opcionesConNueva } from "./Combo.jsx";

const GASTOS_PRESET = ["Hostinger (VPS + dominios)", "Adobe", "Google Workspace", "Telefonía / internet", "Publicidad (Meta/Google)", "Herramientas IA", "Contabilidad", "Suscripciones software"];

// conceptos predefinidos de Siemon (los nuevos que uses se agregan solos a la lista)
const CONCEPTOS = [
  "Diagnóstico Siemon",
  "Implementación a la medida · fase 1",
  "Implementación a la medida · fase 2",
  "Acompañamiento mensual",
  "Automatización de procesos",
  "Agente / chatbot con IA",
  "Sitio web / landing",
  "Contenido y marketing mensual",
  "Consultoría por horas",
];

const C = {
  obsidian: "#0A0B0D", panel: "#16171C", carbon: "#131418", line: "rgba(255,255,255,0.08)",
  aether: "#B1A3E1", aether2: "#CBC0EC", aether500: "#8474BE", aetherSoft: "rgba(177,163,225,0.14)",
  aetherLine: "rgba(177,163,225,0.30)", cream: "#E9E5DD", mist: "#C9CAD2", ash: "#8B8D98",
  ok: "#7FB89B", warn: "#D8B673", danger: "#D08A8A",
};
const SANS = "'Montserrat', system-ui, sans-serif";
const MONO = "'JetBrains Mono', ui-monospace, monospace";
const inS = { background: "#101116", border: `1px solid ${C.line}`, color: C.cream, borderRadius: 10, padding: "9px 12px", width: "100%", fontFamily: SANS, fontSize: 13, outline: "none" };
const uid = () => (crypto?.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2, 9));
const today = () => new Date().toISOString().slice(0, 10);
const money = (v, cur = "USD") => (v || v === 0) ? new Intl.NumberFormat("en-US", { style: "currency", currency: cur, maximumFractionDigits: 0 }).format(v) : "";

// estado real: una Pendiente con vencimiento pasado ES Vencida (calculado, sin tocar el dato)
export const estadoFactura = (f) => {
  if (f.estado === "Pagada" || f.estado === "Cancelada") return f.estado;
  if (f.vencimiento && f.vencimiento < today()) return "Vencida";
  return "Pendiente";
};
const TONO = {
  Pagada: { bg: "rgba(127,184,155,0.14)", bd: "rgba(127,184,155,0.4)", fg: "#7FB89B" },
  Pendiente: { bg: "rgba(216,182,115,0.14)", bd: "rgba(216,182,115,0.4)", fg: "#D8B673" },
  Vencida: { bg: "rgba(208,138,138,0.14)", bd: "rgba(208,138,138,0.4)", fg: "#D08A8A" },
  Cancelada: { bg: "rgba(255,255,255,0.05)", bd: "rgba(255,255,255,0.08)", fg: "#8B8D98" },
};

// numero consecutivo SD-<año>-NNN
const siguienteNumero = (facturas) => {
  const y = new Date().getFullYear();
  const pref = `SD-${y}-`;
  const nums = facturas.map((f) => (f.numero || "").startsWith(pref) ? parseInt((f.numero || "").slice(pref.length)) || 0 : 0);
  return pref + String(Math.max(0, ...nums) + 1).padStart(3, "0");
};

export default function FacturacionView({ data, commit, flash }) {
  const facturas = data.siemon.facturas || [];
  const leads = data.siemon.leads || [];
  const [tab, setTab] = useState("Todas");
  const [showNueva, setShowNueva] = useState(false);
  const F0 = { leadId: "", concepto: "", total: "", ivaPct: "", retPct: "", emision: today(), vencimiento: "", moneda: "USD", notas: "" };
  const [f, setF] = useState(F0);
  const [editId, setEditId] = useState("");

  const gastos = data.siemon.gastos || [];
  const [showGasto, setShowGasto] = useState(false);
  const [g, setG] = useState({ concepto: "", total: "", fecha: today() });

  const conEstado = useMemo(() => facturas.map((x) => ({ ...x, estadoReal: estadoFactura(x) })), [facturas]);
  const lista = conEstado.filter((x) => tab === "Todas" || x.estadoReal === tab);
  const mes = today().slice(0, 7);
  const kpi = useMemo(() => {
    const cobradoMes = conEstado.filter((x) => x.estadoReal === "Pagada" && (x.pagoFecha || "").startsWith(mes)).reduce((s, x) => s + (Number(x.total) || 0), 0);
    const gastosMes = gastos.filter((x) => (x.fecha || "").startsWith(mes)).reduce((s, x) => s + (Number(x.total) || 0), 0);
    return {
      mes: cobradoMes, gastosMes, balance: cobradoMes - gastosMes,
      pendiente: conEstado.filter((x) => x.estadoReal === "Pendiente").reduce((s, x) => s + (Number(x.total) || 0), 0),
      vencido: conEstado.filter((x) => x.estadoReal === "Vencida").reduce((s, x) => s + (Number(x.total) || 0), 0),
    };
  }, [conEstado, gastos, mes]);

  // evolución 6 meses + alertas (kit dashboard-facturas)
  const analisis = useMemo(() => {
    const meses = [];
    const d0 = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(d0.getFullYear(), d0.getMonth() - i, 1);
      meses.push(d.toISOString().slice(0, 7));
    }
    const serie = meses.map((m) => ({
      m,
      ing: conEstado.filter((x) => x.estadoReal === "Pagada" && (x.pagoFecha || "").startsWith(m)).reduce((s, x) => s + (Number(x.total) || 0), 0),
      gas: gastos.filter((x) => (x.fecha || "").startsWith(m)).reduce((s, x) => s + (Number(x.total) || 0), 0),
    }));
    // alertas
    const alertas = [];
    const pagadas = conEstado.filter((x) => x.estadoReal === "Pagada");
    const totalCobrado = pagadas.reduce((s, x) => s + (Number(x.total) || 0), 0);
    if (totalCobrado > 0) {
      const porCliente = {};
      pagadas.forEach((x) => { porCliente[x.cliente] = (porCliente[x.cliente] || 0) + (Number(x.total) || 0); });
      const top = Object.entries(porCliente).sort((a, b) => b[1] - a[1])[0];
      if (top && top[1] / totalCobrado > 0.4) alertas.push({ tipo: "warn", txt: `Dependencia: ${top[0]} representa el ${Math.round((top[1] / totalCobrado) * 100)}% de lo cobrado. Diversifica.` });
    }
    const sinFact = serie.filter((s) => s.ing === 0).length;
    if (sinFact >= 2 && totalCobrado > 0) alertas.push({ tipo: "warn", txt: `${sinFact} de los últimos 6 meses sin cobros registrados.` });
    const prom3 = (arr) => arr.reduce((s, x) => s + x.ing, 0) / Math.max(arr.length, 1);
    const reciente = prom3(serie.slice(3)), anterior = prom3(serie.slice(0, 3));
    if (anterior > 0) {
      const delta = Math.round(((reciente - anterior) / anterior) * 100);
      alertas.push({ tipo: delta >= 0 ? "ok" : "warn", txt: `Tendencia: los últimos 3 meses van ${delta >= 0 ? "+" : ""}${delta}% vs los 3 anteriores.` });
    }
    const ticket = pagadas.length ? totalCobrado / pagadas.length : 0;
    return { serie, alertas, ticket };
  }, [conEstado, gastos]);

  function crearGasto() {
    if (!g.concepto.trim() || !Number(g.total)) return flash("Escribe el concepto y el total del gasto.");
    const item = { id: uid(), concepto: g.concepto.trim(), total: Number(g.total), fecha: g.fecha || today() };
    commit({ ...data, siemon: { ...data.siemon, gastos: [item, ...gastos], opciones: opcionesConNueva(data, "conceptoGasto", item.concepto, GASTOS_PRESET) } });
    setG({ concepto: "", total: "", fecha: today() }); flash("Gasto registrado.");
  }
  function borrarGasto(id) { commit({ ...data, siemon: { ...data.siemon, gastos: gastos.filter((x) => x.id !== id) } }); flash("Gasto eliminado."); }

  function guardar(next) { commit({ ...data, siemon: { ...data.siemon, facturas: next } }); }
  function crear() {
    if (!f.leadId && !f.concepto.trim()) return flash("Elige el cliente o escribe el concepto.");
    if (!Number(f.total)) return flash("Escribe el subtotal.");
    const lead = leads.find((l) => l.id === f.leadId);
    const subtotal = Number(f.total);
    const ivaPct = Number(f.ivaPct) || 0, retPct = Number(f.retPct) || 0;
    const totalFinal = Math.round((subtotal + subtotal * ivaPct / 100 - subtotal * retPct / 100) * 100) / 100;
    const base = {
      leadId: f.leadId || "", cliente: lead ? (lead.company || lead.name) : (f.concepto || "Cliente"),
      email: lead ? lead.email : "", concepto: f.concepto || (lead ? "Servicios Siemon Digital" : ""),
      subtotal, ivaPct, retPct, total: totalFinal, moneda: f.moneda, notas: f.notas || "",
      emision: f.emision || today(), vencimiento: f.vencimiento || "",
    };
    let nuevas, num;
    if (editId) {
      nuevas = facturas.map((x) => x.id === editId ? { ...x, ...base } : x);
      num = (facturas.find((x) => x.id === editId) || {}).numero;
    } else {
      num = siguienteNumero(facturas);
      nuevas = [{ id: uid(), numero: num, pagoFecha: "", estado: "Pendiente", ...base }, ...facturas];
    }
    commit({ ...data, siemon: { ...data.siemon, facturas: nuevas, opciones: opcionesConNueva(data, "conceptoFactura", base.concepto, CONCEPTOS) } });
    setShowNueva(false); setF(F0); setEditId("");
    flash("Factura " + num + (editId ? " actualizada." : " creada."));
  }
  function editar(x) {
    setF({ leadId: x.leadId || "", concepto: x.concepto || "", total: String(x.subtotal ?? x.total ?? ""), ivaPct: x.ivaPct ? String(x.ivaPct) : "", retPct: x.retPct ? String(x.retPct) : "", emision: x.emision || today(), vencimiento: x.vencimiento || "", moneda: x.moneda || "USD", notas: x.notas || "" });
    setEditId(x.id); setShowNueva(true);
    flash("Editando la factura " + x.numero + ": cambia lo que necesites y guarda.");
  }
  async function verPdf(x) {
    try {
      const MOTOR = import.meta.env.VITE_MOTOR_URL || "https://prospeccion.siemondigital.com";
      const { getToken } = await import("./db");
      const r = await fetch(MOTOR + "/facturas/pdf", { method: "POST", headers: { "content-type": "application/json", Authorization: "Bearer " + getToken() }, body: JSON.stringify({ factura: x }) });
      if (!r.ok) return flash("No pude generar el PDF.");
      const url = URL.createObjectURL(await r.blob());
      window.open(url, "_blank");
    } catch { flash("No pude conectar con el motor."); }
  }
  const [enviando, setEnviando] = React.useState("");
  const MOTOR = import.meta.env.VITE_MOTOR_URL || "https://prospeccion.siemondigital.com";
  const H = () => ({ "content-type": "application/json", Authorization: "Bearer " + getTk() });
  const [tk] = React.useState(() => localStorage.getItem("siemon_crm_token") || "");
  const getTk = () => localStorage.getItem("siemon_crm_token") || tk;
  const [envio, setEnvio] = React.useState(null);   // { fac, mensaje }
  const [genMsg, setGenMsg] = React.useState(false);
  function abrirEnvio(x) {
    if (!x.email) return flash("Esta factura no tiene email del cliente (edítala o crea el lead con email).");
    setEnvio({ fac: x, mensaje: "" });
  }
  async function generarMensaje() {
    if (!envio) return;
    setGenMsg(true);
    try {
      const r = await fetch(MOTOR + "/facturas/mensaje", { method: "POST", headers: H(), body: JSON.stringify({ factura: envio.fac }) });
      const d = await r.json();
      if (!d.ok) return flash("No pude generar: " + (d.error || ""));
      setEnvio((e) => ({ ...e, mensaje: d.mensaje }));
    } catch { flash("No pude conectar con el motor."); }
    finally { setGenMsg(false); }
  }
  async function confirmarEnvio() {
    if (!envio) return;
    const x = envio.fac;
    setEnviando(x.id); flash("Enviando la factura a " + x.email + "…");
    try {
      const r = await fetch(MOTOR + "/facturas/enviar", { method: "POST", headers: H(), body: JSON.stringify({ factura: x, mensaje: envio.mensaje || "" }) });
      const d = await r.json();
      if (!d.ok) return flash("No pude enviar: " + (d.error || ""));
      guardar(facturas.map((f) => f.id === x.id ? { ...f, enviadaFecha: today() } : f));
      flash("Factura enviada en PDF a " + d.enviada_a + " ✓"); setEnvio(null);
    } catch { flash("No pude conectar con el motor."); }
    finally { setEnviando(""); }
  }
  function marcarPagada(id) {
    const fac = facturas.find((x) => x.id === id);
    guardar(facturas.map((x) => x.id === id ? { ...x, estado: "Pagada", pagoFecha: today() } : x));
    flash("Marcada como pagada ✓");
    // CAPI: evento Purchase server-side (mejora la optimización de tus Ads). Best-effort.
    try {
      const lead = leads.find((l) => l.id === (fac && fac.leadId));
      const email = (lead && lead.email) || (fac && fac.email) || "";
      const valor = Number(fac && fac.total) || 0;
      if (valor > 0) fetch(MOTOR + "/capi/evento", { method: "POST", headers: H(), body: JSON.stringify({ event: "Purchase", email, nombre: lead && lead.name, valor, moneda: (fac && fac.moneda) || "USD", event_id: "purchase-" + id }) }).catch(() => {});
    } catch {}
  }
  function cancelar(id) { guardar(facturas.map((x) => x.id === id ? { ...x, estado: "Cancelada" } : x)); flash("Factura cancelada."); }
  function borrar(id) { guardar(facturas.filter((x) => x.id !== id)); flash("Factura eliminada."); }

  const tabs = ["Todas", "Pendiente", "Pagada", "Vencida", "Cancelada"];
  const cuenta = (t) => t === "Todas" ? conEstado.length : conEstado.filter((x) => x.estadoReal === t).length;
  // clientes facturables: leads en etapas avanzadas primero
  const orden = { "Cliente": 0, "Propuesta": 1, "Videollamada": 2, "Descubrimiento": 3 };
  const leadsOrd = [...leads].sort((a, b) => (orden[a.status] ?? 9) - (orden[b.status] ?? 9));


  const logoFac = data.siemon.facturaLogo || "";
  async function subirLogoFactura() {
    const inp = document.createElement("input"); inp.type = "file"; inp.accept = "image/*";
    inp.onchange = async () => {
      const f = inp.files && inp.files[0]; if (!f) return;
      const dataUrl = await new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(f); });
      try {
        const r = await fetch(MOTOR + "/gc/subir", { method: "POST", headers: H(), body: JSON.stringify({ data: dataUrl, ext: (f.name.split(".").pop() || "png").toLowerCase() }) });
        const d = await r.json();
        if (!d.ok) return flash("No pude subir el logo: " + (d.error || ""));
        commit({ ...data, siemon: { ...data.siemon, facturaLogo: d.url } });
        flash("Logo guardado. Saldrá en el PDF de tus facturas.");
      } catch { flash("No pude conectar con el motor."); }
    };
    inp.click();
  }

  return (
    <div className="p-5 md:p-8" style={{ maxWidth: 1100 }}>
      <div className="mb-5 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div style={{ color: C.aether500, fontFamily: MONO, letterSpacing: "0.2em" }} className="fs-10 uppercase mb-2"><span style={{ color: C.aether }}>// </span>Cobros y servicios</div>
          <h1 style={{ fontWeight: 600, color: C.cream }} className="fs-24 flex items-center gap-2"><Receipt size={20} color={C.aether} /> Facturación</h1>
          <div style={{ color: C.ash }} className="fs-11 mt-1">Factura tus servicios, sigue quién debe y cobra a tiempo. Las pendientes con fecha vencida pasan solas a "Vencida".</div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={subirLogoFactura} title="Logo que sale en el PDF de tus facturas" style={{ background: C.panel, border: `1px solid ${logoFac ? "rgba(127,184,155,0.4)" : C.aetherLine}`, color: logoFac ? C.ok : C.aether2 }} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg fs-12">{logoFac ? "Logo ✓" : "Subir logo"}</button>
          <button onClick={() => setShowNueva((v) => !v)} style={{ background: C.aether, color: C.obsidian, fontWeight: 600 }} className="flex items-center gap-2 px-3.5 py-2 rounded-lg fs-13"><Plus size={15} strokeWidth={2.4} /> Nueva factura</button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
        {[["Cobrado este mes", kpi.mes, C.ok], ["Gastos del mes", kpi.gastosMes, C.danger], ["Balance del mes", kpi.balance, kpi.balance >= 0 ? C.aether2 : C.danger], ["Pendiente de cobro", kpi.pendiente, C.warn], ["Vencido (¡cobra ya!)", kpi.vencido, C.danger]].map(([k, v, col]) => (
          <div key={k} style={{ background: C.panel, border: `1px solid ${C.line}` }} className="rounded-xl p-4">
            <div style={{ color: col, fontWeight: 700, fontFamily: MONO }} className="fs-18">{money(v)}</div>
            <div style={{ color: C.ash }} className="fs-10 mt-1">{k}</div>
          </div>
        ))}
      </div>

      {/* evolución 6 meses + alertas (kit dashboard-facturas) */}
      <div className="grid lg:grid-cols-2 gap-3 mb-5">
        <div style={{ background: C.panel, border: `1px solid ${C.line}` }} className="rounded-xl p-4">
          <div style={{ color: C.aether500, fontFamily: MONO, letterSpacing: "0.16em" }} className="fs-10 uppercase mb-3">// Evolución · 6 meses (cobrado vs gastos)</div>
          <div className="flex items-end gap-2" style={{ height: 120 }}>
            {analisis.serie.map((s) => {
              const max = Math.max(...analisis.serie.map((x) => Math.max(x.ing, x.gas)), 1);
              return (
                <div key={s.m} className="flex-1 flex flex-col items-center gap-1">
                  <div className="flex items-end gap-0.5 w-full" style={{ height: 96 }}>
                    <div title={"Cobrado " + money(s.ing)} style={{ height: `${Math.max(3, (s.ing / max) * 100)}%`, background: "rgba(127,184,155,0.22)", border: `1px solid ${C.ok}`, boxSizing: "border-box", borderRadius: 3 }} className="flex-1" />
                    <div title={"Gastos " + money(s.gas)} style={{ height: `${Math.max(3, (s.gas / max) * 100)}%`, background: "rgba(208,138,138,0.22)", border: `1px solid ${C.danger}`, boxSizing: "border-box", borderRadius: 3 }} className="flex-1" />
                  </div>
                  <span style={{ color: C.ash, fontFamily: MONO }} className="fs-8">{s.m.slice(5)}</span>
                </div>
              );
            })}
          </div>
          <div style={{ color: C.ash }} className="fs-9 mt-2">Ticket promedio por factura cobrada: <b style={{ color: C.aether2 }}>{money(analisis.ticket)}</b></div>
        </div>
        <div style={{ background: C.panel, border: `1px solid ${C.line}` }} className="rounded-xl p-4">
          <div style={{ color: C.aether500, fontFamily: MONO, letterSpacing: "0.16em" }} className="fs-10 uppercase mb-3">// Alertas y observaciones</div>
          {analisis.alertas.length === 0 ? <div style={{ color: C.ash }} className="fs-11">Sin alertas. A medida que registres cobros y gastos, aquí verás dependencia de clientes, meses flojos y tendencia.</div> : (
            <div className="flex flex-col gap-2">
              {analisis.alertas.map((a, i) => (
                <div key={i} className="flex items-start gap-2">
                  {a.tipo === "ok" ? <TrendingUp size={14} color={C.ok} className="mt-0.5 shrink-0" /> : <AlertTriangle size={14} color={C.warn} className="mt-0.5 shrink-0" />}
                  <span style={{ color: C.mist }} className="fs-12 leading-snug">{a.txt}</span>
                </div>
              ))}
            </div>
          )}
          <div style={{ borderTop: `1px solid ${C.line}` }} className="mt-3 pt-3">
            <div className="flex items-center justify-between">
              <span style={{ color: C.ash }} className="fs-11">Gastos registrados: {gastos.length}</span>
              <button onClick={() => setShowGasto((v) => !v)} style={{ color: C.danger, border: `1px solid rgba(208,138,138,0.4)` }} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg fs-11"><Plus size={11} /> Registrar gasto</button>
            </div>
            {showGasto && (
              <div className="grid grid-cols-3 gap-2 mt-2">
                <Combo listaId="dl-gasto" style={{ ...inS, fontSize: 12 }} value={g.concepto} onChange={(v) => setG({ ...g, concepto: v })} opciones={opcionesDe(data, "conceptoGasto", GASTOS_PRESET)} placeholder="Concepto" />
                <input type="number" style={{ ...inS, fontSize: 12 }} value={g.total} onChange={(e) => setG({ ...g, total: e.target.value })} placeholder="Total USD" />
                <div className="flex gap-1.5"><input type="date" style={{ ...inS, fontSize: 12 }} value={g.fecha} onChange={(e) => setG({ ...g, fecha: e.target.value })} /><button onClick={crearGasto} style={{ background: C.aether, color: C.obsidian, fontWeight: 600 }} className="px-3 rounded-lg fs-12 shrink-0">✓</button></div>
              </div>
            )}
            {showGasto && gastos.length > 0 && (
              <div className="flex flex-col gap-1 mt-2" style={{ maxHeight: 120, overflowY: "auto" }}>
                {gastos.slice(0, 20).map((x) => (
                  <div key={x.id} className="flex items-center justify-between gap-2">
                    <span style={{ color: C.mist }} className="fs-11 truncate">{x.concepto}</span>
                    <span className="flex items-center gap-2 shrink-0"><span style={{ color: C.danger, fontFamily: MONO }} className="fs-11">{money(x.total)}</span><span style={{ color: C.ash, fontFamily: MONO }} className="fs-9">{x.fecha}</span><button onClick={() => borrarGasto(x.id)} style={{ color: C.ash }}><Trash2 size={11} /></button></span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* nueva factura */}
      {showNueva && (
        <div style={{ background: C.panel, border: `1px solid ${C.aetherLine}` }} className="rounded-xl p-4 mb-5">
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2"><label style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase">Cliente (de tus leads)</label>
              <select style={inS} value={f.leadId} onChange={(e) => { const l = leads.find((x) => x.id === e.target.value); setF({ ...f, leadId: e.target.value, total: f.total || (l && l.valor) || "" }); }}>
                <option value="">Elegir…</option>
                {leadsOrd.map((l) => <option key={l.id} value={l.id}>{(l.company || l.name)} · {l.status}</option>)}
              </select></div>
            <div><label style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase">Subtotal (USD)</label>
              <input type="number" style={inS} value={f.total} onChange={(e) => setF({ ...f, total: e.target.value })} placeholder="1900" /></div>
            <div><label style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase">IVA % (opcional)</label>
              <input type="number" style={inS} value={f.ivaPct} onChange={(e) => setF({ ...f, ivaPct: e.target.value })} placeholder="ej. 19" /></div>
            <div><label style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase">Retención % (opcional)</label>
              <input type="number" style={inS} value={f.retPct} onChange={(e) => setF({ ...f, retPct: e.target.value })} placeholder="ej. 11" /></div>
            <div className="sm:col-span-3"><label style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase">Concepto (elige uno o escribe el tuyo)</label>
              <Combo listaId="dl-conceptos" style={inS} value={f.concepto} onChange={(v) => setF({ ...f, concepto: v })} opciones={opcionesDe(data, "conceptoFactura", CONCEPTOS)} placeholder="ej. Diagnóstico Siemon + implementación fase 1" /></div>
            <div className="sm:col-span-3"><label style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase">Notas (opcional, salen en el PDF)</label>
              <input style={inS} value={f.notas} onChange={(e) => setF({ ...f, notas: e.target.value })} placeholder="ej. Pago por transferencia · 50% al inicio, 50% a la entrega" /></div>
            <div><label style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase">Emisión</label>
              <input type="date" style={inS} value={f.emision} onChange={(e) => setF({ ...f, emision: e.target.value })} /></div>
            <div><label style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase">Vencimiento</label>
              <input type="date" style={inS} value={f.vencimiento} onChange={(e) => setF({ ...f, vencimiento: e.target.value })} /></div>
            <div className="flex items-end"><button onClick={crear} style={{ background: C.aether, color: C.obsidian, fontWeight: 600 }} className="px-4 py-2 rounded-lg fs-13 w-full">Crear factura</button></div>
          </div>
        </div>
      )}

      {/* pestañas */}
      <div className="flex flex-wrap gap-2 mb-3">
        {tabs.map((t) => { const on = tab === t; const tono = TONO[t]; return (
          <button key={t} onClick={() => setTab(t)} style={{ background: on ? C.aetherSoft : C.panel, border: `1px solid ${on ? C.aetherLine : C.line}`, color: t !== "Todas" && tono ? tono.fg : (on ? C.aether2 : C.mist) }} className="px-3 py-1.5 rounded-lg fs-12">{t} ({cuenta(t)})</button>
        ); })}
      </div>

      {/* tabla */}
      {lista.length === 0 ? (
        <div style={{ background: C.panel, border: `1px solid ${C.line}`, color: C.ash }} className="rounded-xl p-6 fs-12 text-center">
          {facturas.length === 0 ? "Aún no has creado facturas. Crea la primera con \"Nueva factura\": elige el cliente, el total y el vencimiento." : "Nada en este filtro."}
        </div>
      ) : (
        <div style={{ background: C.panel, border: `1px solid ${C.line}` }} className="rounded-xl overflow-x-auto">
          <table className="w-full fs-12" style={{ color: C.cream, minWidth: 720 }}>
            <thead><tr style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase tracking-wider">
              {["Nº", "Cliente", "Concepto", "Emisión", "Vence", "Total", "Estado", ""].map((h) => <th key={h} style={{ borderBottom: `1px solid ${C.line}` }} className="text-left font-normal px-4 py-3">{h}</th>)}
            </tr></thead>
            <tbody>{lista.map((x) => { const tono = TONO[x.estadoReal]; return (
              <tr key={x.id} style={{ borderBottom: `1px solid rgba(255,255,255,0.04)` }} className="group">
                <td className="px-4 py-3" style={{ fontFamily: MONO, color: C.aether2 }}>{x.numero}</td>
                <td className="px-4 py-3"><div style={{ fontWeight: 600 }}>{x.cliente}</div>{x.email && <div style={{ color: C.ash }} className="fs-10">{x.email}</div>}</td>
                <td className="px-4 py-3" style={{ color: C.mist, maxWidth: 220 }}><div className="truncate">{x.concepto}</div></td>
                <td className="px-4 py-3" style={{ fontFamily: MONO, color: C.ash }}>{x.emision}</td>
                <td className="px-4 py-3" style={{ fontFamily: MONO, color: x.estadoReal === "Vencida" ? C.danger : C.ash }}>{x.vencimiento || "—"}</td>
                <td className="px-4 py-3" style={{ fontFamily: MONO, color: C.aether2 }}>{money(x.total, x.moneda)}</td>
                <td className="px-4 py-3"><span style={{ background: tono.bg, border: `1px solid ${tono.bd}`, color: tono.fg, fontFamily: MONO }} className="px-2 py-0.5 rounded fs-10 inline-flex items-center gap-1">{x.estadoReal === "Vencida" && <AlertTriangle size={10} />}{x.estadoReal}{x.estadoReal === "Pagada" && x.pagoFecha ? " · " + x.pagoFecha : ""}</span></td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  <button onClick={() => verPdf(x)} title="Ver la factura en PDF (lo mismo que recibe el cliente)" style={{ color: C.aether2 }} className="mr-2 fs-11">👁</button>
                  <button onClick={() => editar(x)} title="Editar factura (subtotal, IVA, retención, fechas)" style={{ color: C.ash }} className="mr-2 fs-11">✏️</button>
                  <button onClick={() => abrirEnvio(x)} disabled={!!enviando} title={x.enviadaFecha ? ("Enviada el " + x.enviadaFecha + " · reenviar PDF") : "Enviar factura en PDF al cliente (desde hello@)"} style={{ color: x.enviadaFecha ? C.ok : C.aether2 }} className="mr-2 fs-11">{enviando === x.id ? "…" : "📨"}</button>
                  {(x.estadoReal === "Pendiente" || x.estadoReal === "Vencida") && <button onClick={() => marcarPagada(x.id)} title="Marcar pagada" style={{ color: C.ok }} className="mr-2"><Check size={14} /></button>}
                  {x.estadoReal !== "Cancelada" && x.estadoReal !== "Pagada" && <button onClick={() => cancelar(x.id)} title="Cancelar" style={{ color: C.ash }} className="mr-2"><X size={14} /></button>}
                  <button onClick={() => borrar(x.id)} title="Eliminar" style={{ color: C.ash }} className="opacity-0 group-hover:opacity-100"><Trash2 size={13} /></button>
                </td>
              </tr>
            ); })}</tbody>
          </table>
        </div>
      )}
      {envio && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)" }} onClick={() => setEnvio(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: C.panel, border: `1px solid ${C.line}` }} className="rounded-xl w-full max-w-lg p-5">
            <div className="flex items-center justify-between mb-3">
              <div><div style={{ color: C.aether500, fontFamily: MONO }} className="fs-9 uppercase">// Enviar factura {envio.fac.numero}</div>
                <div style={{ color: C.cream, fontWeight: 600 }} className="fs-14">Para {envio.fac.cliente} · {envio.fac.email}</div></div>
              <button onClick={() => setEnvio(null)} style={{ color: C.ash }}><X size={18} /></button>
            </div>
            <div style={{ color: C.ash }} className="fs-11 mb-2">Este es el cuerpo COMPLETO del correo (incluido el saludo). Escríbelo a tu gusto o pulsa "Generar con IA" para uno personalizado. Si lo dejas vacío, se usa el saludo estándar ("Hola [nombre], te compartimos la factura…"). El PDF con logo, notas, impuestos y total va adjunto igual.</div>
            <textarea value={envio.mensaje} onChange={(e) => setEnvio({ ...envio, mensaje: e.target.value })} placeholder="Hola [nombre], te compartimos…" style={{ background: "#101116", border: `1px solid ${C.line}`, color: C.cream, borderRadius: 10, padding: "10px 12px", width: "100%", minHeight: 140, fontFamily: SANS, fontSize: 13, outline: "none", resize: "vertical" }} />
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <button onClick={confirmarEnvio} disabled={!!enviando} style={{ background: C.aether, color: C.obsidian, fontWeight: 600, opacity: enviando ? 0.6 : 1 }} className="px-4 py-2 rounded-lg fs-13">{enviando ? "Enviando…" : "Enviar con PDF adjunto"}</button>
              <button onClick={generarMensaje} disabled={genMsg} style={{ background: "transparent", border: `1px solid ${C.aetherLine}`, color: C.aether2 }} className="px-3.5 py-2 rounded-lg fs-12">{genMsg ? "Generando…" : "✨ Generar con IA"}</button>
              <button onClick={() => setEnvio(null)} style={{ color: C.ash }} className="fs-12">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
