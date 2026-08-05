import React, { useState, useMemo } from "react";
import { Handshake, Plus, Trash2, Sparkles, Send, FileText, ChevronDown, ChevronRight, Building2 } from "lucide-react";
import { C, MONO, SANS } from "./tema.js";
import { MOTOR, getToken } from "./db.js";
import Combo, { opcionesDe } from "./Combo.jsx";

const inS = { background: C.carbon, border: `1px solid ${C.line}`, color: C.cream, borderRadius: 10, padding: "9px 12px", width: "100%", fontFamily: SANS, fontSize: 13, outline: "none" };
const H = () => ({ "content-type": "application/json", Authorization: "Bearer " + getToken() });
const uid = () => (crypto?.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2, 9));
const today = () => new Date().toISOString().slice(0, 10);
const money = (v, m = "USD") => (Number(v) || 0).toLocaleString("en-US") + " " + m;

// Ciclo del negocio inmobiliario: de la reserva al pago de la comision.
// Atlantis opera POR COMISION sobre venta y conexion (nunca capta dinero).
const ESTADOS = ["Reservado", "Promesa firmada", "Escriturado", "Comisión facturada", "Comisión pagada", "Caído"];
const COLOR_ESTADO = {
  "Reservado": "var(--marca-acento-claro)", "Promesa firmada": "var(--marca-aviso)",
  "Escriturado": "var(--marca-acento)", "Comisión facturada": "var(--marca-aviso)",
  "Comisión pagada": "var(--marca-ok)", "Caído": "var(--marca-peligro)",
};

export default function NegociosView({ data, commit, ws }) {
  const [aviso, setAviso] = useState("");
  const flash = (m) => { setAviso(m); window.clearTimeout(flash._t); flash._t = window.setTimeout(() => setAviso(""), 7000); };
  const patch = (cambios) => commit({ ...data, [ws]: { ...data[ws], ...cambios } });
  const config = data[ws]?.config || {};
  const moneda = config.moneda || "USD";
  const negocios = data[ws].negocios || [];
  const leads = data[ws].leads || [];
  const clientes = useMemo(() => leads.filter((l) => (l.etapa || l.estado || l.status) === "Cliente"), [leads]);
  const [tab, setTab] = useState("negocios");
  const [abierto, setAbierto] = useState("");
  const [busy, setBusy] = useState("");

  // ---- nuevo negocio ----
  const [showNN, setShowNN] = useState(false);
  const vacio = { cliente: "", proyecto: "", unidad: "", mercado: "", aliado: "", emailAliado: "", valorInmueble: "", comisionPct: "3", notas: "" };
  const [nn, setNn] = useState(vacio);
  const comisionDe = (n) => Math.round(((Number(n.valorInmueble) || 0) * (Number(n.comisionPct) || 0)) / 100 * 100) / 100;
  function crearNegocio() {
    if (!nn.proyecto.trim()) return flash("Pon al menos el proyecto.");
    const item = {
      id: uid(), numero: "CC-" + String(negocios.length + 1).padStart(3, "0"),
      fecha: today(), estado: "Reservado", moneda,
      ...nn, valorInmueble: Number(nn.valorInmueble) || 0,
      comisionPct: Number(nn.comisionPct) || 0, total: comisionDe(nn),
      historial: [{ fecha: today(), estado: "Reservado" }],
    };
    patch({ negocios: [item, ...negocios] });
    setNn(vacio); setShowNN(false);
    flash("Negocio registrado. Actualiza su estado a medida que avance.");
  }
  function setEstado(id, estado) {
    patch({ negocios: negocios.map((n) => n.id === id ? { ...n, estado, historial: [...(n.historial || []), { fecha: today(), estado }] } : n) });
  }
  function setCampo(id, campo, valor) {
    patch({ negocios: negocios.map((n) => {
      if (n.id !== id) return n;
      const upd = { ...n, [campo]: valor };
      if (campo === "valorInmueble" || campo === "comisionPct") upd.total = comisionDe(upd);
      return upd;
    }) });
  }
  function borrarNegocio(id) { patch({ negocios: negocios.filter((n) => n.id !== id) }); flash("Negocio eliminado."); }

  // ---- cuenta de cobro ----
  const [msgCC, setMsgCC] = useState({});   // mensaje por negocio
  async function verPdf(n) {
    setBusy("pdf:" + n.id);
    try {
      const r = await fetch(MOTOR + "/negocios/pdf", { method: "POST", headers: H(), body: JSON.stringify({ negocio: n, workspace: ws }) });
      if (!r.ok) return flash("No pude generar el PDF.");
      const blob = await r.blob();
      window.open(URL.createObjectURL(blob), "_blank");
    } catch { flash("No pude conectar con el motor."); }
    finally { setBusy(""); }
  }
  async function generarMensaje(n) {
    setBusy("msg:" + n.id);
    try {
      const r = await fetch(MOTOR + "/negocios/mensaje", { method: "POST", headers: H(), body: JSON.stringify({ negocio: n }) });
      const d = await r.json();
      if (d.ok) { setMsgCC((m) => ({ ...m, [n.id]: d.mensaje })); flash("Mensaje listo; edítalo si quieres y envía."); }
      else flash("No pude generar el mensaje: " + (d.error || ""));
    } catch { flash("No pude conectar con el motor."); }
    finally { setBusy(""); }
  }
  async function enviarCC(n) {
    if (!(n.emailAliado || "").trim()) return flash("Pon el email del aliado/constructora en el negocio.");
    setBusy("env:" + n.id);
    try {
      const r = await fetch(MOTOR + "/negocios/enviar", { method: "POST", headers: H(), body: JSON.stringify({ negocio: n, mensaje: msgCC[n.id] || "", workspace: ws }) });
      const d = await r.json();
      if (d.ok) { setEstado(n.id, "Comisión facturada"); flash("Cuenta de cobro enviada a " + d.enviada_a + " ✓"); }
      else flash("No se envió: " + (d.error || ""));
    } catch { flash("No pude conectar con el motor."); }
    finally { setBusy(""); }
  }

  // ---- resumen ----
  const activos = negocios.filter((n) => !["Comisión pagada", "Caído"].includes(n.estado));
  const esperado = activos.reduce((a, n) => a + (Number(n.total) || 0), 0);
  const cobrado = negocios.filter((n) => n.estado === "Comisión pagada").reduce((a, n) => a + (Number(n.total) || 0), 0);

  return (
    <div style={{ maxWidth: 1100 }}>
      <div className="mb-4">
        <div style={{ color: C.aether500, fontFamily: MONO, letterSpacing: "0.2em" }} className="fs-10 uppercase mb-2"><span style={{ color: C.aether }}>// </span>Comisiones y relación</div>
        <h1 style={{ fontWeight: 600, color: C.cream }} className="fs-24 flex items-center gap-2"><Building2 size={20} color={C.aether} /> Negocios</h1>
        <div style={{ color: C.ash }} className="fs-11 mt-1">Cada venta o conexión que Atlantis gestiona: del reservado a la comisión pagada, con su cuenta de cobro en PDF lista para enviar al aliado. Atlantis opera por comisión; aquí se ve el negocio completo.</div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {[["negocios", `Negocios (${negocios.length})`], ["clientes", `Clientes (${clientes.length})`]].map(([id, lb]) => (
          <button key={id} onClick={() => setTab(id)} style={{ background: tab === id ? C.aetherSoft : C.panel, border: `1px solid ${tab === id ? C.aetherLine : C.line}`, color: tab === id ? C.aether2 : C.mist }} className="px-3.5 py-2 rounded-lg fs-12 font-medium">{lb}</button>
        ))}
      </div>

      {aviso && <div style={{ background: C.aetherSoft, border: `1px solid ${C.aetherLine}`, color: C.aether2 }} className="rounded-lg px-3 py-2 mb-4 fs-12">{aviso}</div>}

      {tab === "negocios" && (<>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {[["Negocios activos", activos.length], ["Comisión esperada", money(esperado, moneda)], ["Comisión cobrada", money(cobrado, moneda)], ["Negocios totales", negocios.length]].map(([k, v]) => (
          <div key={k} style={{ background: C.panel, border: `1px solid ${C.line}` }} className="rounded-xl p-3.5">
            <div style={{ color: C.aether2, fontFamily: MONO, fontWeight: 700 }} className="fs-16">{v}</div>
            <div style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase">{k}</div>
          </div>
        ))}
      </div>

      <div className="mb-4">
        <button onClick={() => setShowNN((v) => !v)} style={{ background: C.aether, color: C.obsidian, fontWeight: 600 }} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg fs-12"><Plus size={13} /> Nuevo negocio</button>
      </div>

      {showNN && (
        <div style={{ background: C.panel, border: `1px solid ${C.aetherLine}` }} className="rounded-xl p-4 mb-4">
          <div style={{ color: C.aether500, fontFamily: MONO, letterSpacing: "0.16em" }} className="fs-10 uppercase mb-3">// Nuevo negocio</div>
          <div className="grid sm:grid-cols-3 gap-3">
            <div><label style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase">Cliente (comprador)</label>
              <Combo listaId="dl-cliente-neg" style={inS} value={nn.cliente} onChange={(v) => setNn({ ...nn, cliente: v })} opciones={leads.map((l) => l.nombre || l.name || l.email).filter(Boolean).slice(0, 40)} placeholder="ej. Laura Gómez" /></div>
            <div><label style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase">Proyecto</label>
              <input style={inS} value={nn.proyecto} onChange={(e) => setNn({ ...nn, proyecto: e.target.value })} placeholder="ej. Torre Mar" /></div>
            <div><label style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase">Unidad</label>
              <input style={inS} value={nn.unidad} onChange={(e) => setNn({ ...nn, unidad: e.target.value })} placeholder="ej. 804" /></div>
            <div><label style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase">Mercado / país</label>
              <Combo listaId="dl-mercado-neg" style={inS} value={nn.mercado} onChange={(v) => setNn({ ...nn, mercado: v })} opciones={opcionesDe(data, "mercadoNegocio", ["Colombia", "México", "Rep. Dominicana", "Panamá", "Dubái", "Costa Rica"])} placeholder="ej. Panamá" /></div>
            <div><label style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase">Aliado (constructora)</label>
              <Combo listaId="dl-aliado-neg" style={inS} value={nn.aliado} onChange={(v) => setNn({ ...nn, aliado: v })} opciones={opcionesDe(data, "aliadoNegocio", [])} placeholder="ej. Constructora X" /></div>
            <div><label style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase">Email del aliado (para la cuenta de cobro)</label>
              <input style={inS} value={nn.emailAliado} onChange={(e) => setNn({ ...nn, emailAliado: e.target.value })} placeholder="pagos@constructora.com" /></div>
            <div><label style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase">Valor del inmueble ({moneda})</label>
              <input style={inS} type="number" value={nn.valorInmueble} onChange={(e) => setNn({ ...nn, valorInmueble: e.target.value })} placeholder="120000" /></div>
            <div><label style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase">Comisión (%)</label>
              <input style={inS} type="number" step="0.1" value={nn.comisionPct} onChange={(e) => setNn({ ...nn, comisionPct: e.target.value })} placeholder="3" /></div>
            <div><label style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase">Comisión esperada</label>
              <div style={{ ...inS, background: "transparent", color: C.ok, fontFamily: MONO }}>{money(comisionDe(nn), moneda)}</div></div>
          </div>
          <div className="mt-3"><label style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase">Notas</label>
            <textarea style={{ ...inS, minHeight: 54, resize: "vertical" }} value={nn.notas} onChange={(e) => setNn({ ...nn, notas: e.target.value })} placeholder="ej. entrega estimada 2027, cesión de derechos posible" /></div>
          <div className="flex items-center gap-2 mt-3">
            <button onClick={crearNegocio} style={{ background: C.aether, color: C.obsidian, fontWeight: 600 }} className="px-3.5 py-2 rounded-lg fs-12">Registrar negocio</button>
            <button onClick={() => setShowNN(false)} style={{ color: C.ash }} className="fs-12">Cancelar</button>
          </div>
        </div>
      )}

      {negocios.length === 0 ? (
        <div style={{ background: C.panel, border: `1px solid ${C.line}`, color: C.ash }} className="rounded-xl p-6 fs-12 text-center">Registra tu primer negocio: cliente, proyecto, valor y % de comisión. El sistema calcula la comisión, sigue el estado y genera la cuenta de cobro.</div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {negocios.map((n) => {
            const open = abierto === n.id;
            return (
              <div key={n.id} style={{ background: C.panel, border: `1px solid ${C.line}` }} className="rounded-xl p-3.5">
                <div className="flex items-center gap-3 flex-wrap">
                  <button onClick={() => setAbierto(open ? "" : n.id)} style={{ color: C.ash }}>{open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}</button>
                  <div className="min-w-0 flex-1">
                    <div style={{ color: C.cream, fontWeight: 600 }} className="fs-13">{n.proyecto}{n.unidad ? ` · ${n.unidad}` : ""}{n.mercado ? ` · ${n.mercado}` : ""}</div>
                    <div style={{ color: C.ash }} className="fs-10">{n.cliente || "sin cliente"} · {n.aliado || "sin aliado"} · {n.numero} · {n.fecha}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div style={{ color: C.ok, fontFamily: MONO }} className="fs-13">{money(n.total, n.moneda || moneda)}</div>
                    <div style={{ color: C.ash, fontFamily: MONO }} className="fs-9">{money(n.valorInmueble, n.moneda || moneda)} × {n.comisionPct}%</div>
                  </div>
                  <select value={n.estado} onChange={(e) => setEstado(n.id, e.target.value)} style={{ background: C.carbon, color: COLOR_ESTADO[n.estado] || C.mist, border: `1px solid ${C.line}`, fontFamily: MONO }} className="fs-10 rounded-lg px-2 py-1.5 outline-none shrink-0">
                    {ESTADOS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <button onClick={() => borrarNegocio(n.id)} style={{ color: C.ash }} className="shrink-0"><Trash2 size={13} /></button>
                </div>
                {open && (
                  <div style={{ background: C.carbon, border: `1px solid ${C.line}` }} className="rounded-lg p-3 mt-3 ml-8">
                    <div className="grid sm:grid-cols-3 gap-2 mb-3">
                      <div><label style={{ color: C.ash, fontFamily: MONO }} className="fs-9 uppercase">Valor inmueble</label>
                        <input style={{ ...inS, fontSize: 12, padding: "6px 10px" }} type="number" value={n.valorInmueble} onChange={(e) => setCampo(n.id, "valorInmueble", Number(e.target.value) || 0)} /></div>
                      <div><label style={{ color: C.ash, fontFamily: MONO }} className="fs-9 uppercase">Comisión %</label>
                        <input style={{ ...inS, fontSize: 12, padding: "6px 10px" }} type="number" step="0.1" value={n.comisionPct} onChange={(e) => setCampo(n.id, "comisionPct", Number(e.target.value) || 0)} /></div>
                      <div><label style={{ color: C.ash, fontFamily: MONO }} className="fs-9 uppercase">Email del aliado</label>
                        <input style={{ ...inS, fontSize: 12, padding: "6px 10px" }} value={n.emailAliado || ""} onChange={(e) => setCampo(n.id, "emailAliado", e.target.value)} placeholder="pagos@constructora.com" /></div>
                    </div>
                    {(n.historial || []).length > 0 && (
                      <div style={{ color: C.ash, fontFamily: MONO }} className="fs-9 mb-3">Historial: {(n.historial || []).map((h) => `${h.fecha.slice(5)}: ${h.estado}`).join(" → ")}</div>
                    )}
                    <div style={{ color: C.aether500, fontFamily: MONO }} className="fs-9 uppercase mb-2">// Cuenta de cobro de la comisión</div>
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <button onClick={() => verPdf(n)} disabled={!!busy} style={{ color: C.aether2, border: `1px solid ${C.aetherLine}`, opacity: busy ? 0.6 : 1 }} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg fs-11"><FileText size={12} /> {busy === "pdf:" + n.id ? "Generando…" : "Ver PDF"}</button>
                      <button onClick={() => generarMensaje(n)} disabled={!!busy} style={{ color: C.aether2, border: `1px solid ${C.aetherLine}`, opacity: busy ? 0.6 : 1 }} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg fs-11"><Sparkles size={12} /> {busy === "msg:" + n.id ? "Escribiendo…" : "Mensaje con IA"}</button>
                      <button onClick={() => enviarCC(n)} disabled={!!busy} style={{ background: C.aether, color: C.obsidian, fontWeight: 600, opacity: busy ? 0.6 : 1 }} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg fs-11"><Send size={12} /> {busy === "env:" + n.id ? "Enviando…" : "Enviar al aliado"}</button>
                    </div>
                    {msgCC[n.id] != null && (
                      <textarea value={msgCC[n.id]} onChange={(e) => setMsgCC((m) => ({ ...m, [n.id]: e.target.value }))} style={{ ...inS, minHeight: 80, whiteSpace: "pre-wrap", fontSize: 12 }} />
                    )}
                    <div style={{ color: C.ash }} className="fs-9 mt-1.5">Al enviarla, el negocio pasa solo a "Comisión facturada". Cuando el aliado pague, márcalo "Comisión pagada".</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      </>)}

      {tab === "clientes" && (
        <div>
          {clientes.length === 0 ? (
            <div style={{ background: C.panel, border: `1px solid ${C.line}`, color: C.ash }} className="rounded-xl p-6 fs-12 text-center">Aún no hay clientes. Llegan solos cuando mueves un lead a la etapa "Cliente" en el Pipeline.</div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {clientes.map((l) => {
                const negs = negocios.filter((n) => n.cliente && (n.cliente === (l.nombre || l.name) || n.cliente === l.email));
                const pagado = negs.filter((n) => n.estado === "Comisión pagada").reduce((a, n) => a + (Number(n.total) || 0), 0);
                return (
                  <div key={l.id} style={{ background: C.panel, border: `1px solid ${C.line}` }} className="rounded-xl p-4">
                    <div className="flex items-center gap-3 flex-wrap">
                      <Handshake size={15} color={C.aether} className="shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div style={{ color: C.cream, fontWeight: 600 }} className="fs-13">{l.nombre || l.name || l.email}</div>
                        <div style={{ color: C.ash }} className="fs-10">{l.email || "sin email"}{l.telefono ? " · " + l.telefono : ""}</div>
                      </div>
                      <span title="De dónde llegó" style={{ background: C.aetherSoft, border: `1px solid ${C.aetherLine}`, color: C.aether2, fontFamily: MONO }} className="px-2 py-0.5 rounded fs-9">origen: {l.fuente || l.leadSource || "?"}</span>
                      <div className="text-right shrink-0">
                        <div style={{ color: negs.length ? C.ok : C.ash, fontFamily: MONO }} className="fs-11">{negs.length} negocio{negs.length === 1 ? "" : "s"}</div>
                        {pagado > 0 && <div style={{ color: C.ok, fontFamily: MONO }} className="fs-10">{money(pagado, moneda)} en comisiones</div>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
