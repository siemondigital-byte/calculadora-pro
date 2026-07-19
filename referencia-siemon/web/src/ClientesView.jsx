import React, { useState, useMemo } from "react";
import { Handshake, Plus, ArrowRight } from "lucide-react";
import Combo, { opcionesDe } from "./Combo.jsx";

const C = {
  obsidian: "#0A0B0D", panel: "#16171C", carbon: "#131418", line: "rgba(255,255,255,0.08)",
  aether: "#B1A3E1", aether2: "#CBC0EC", aether500: "#8474BE", aetherSoft: "rgba(177,163,225,0.14)",
  aetherLine: "rgba(177,163,225,0.30)", cream: "#E9E5DD", mist: "#C9CAD2", ash: "#8B8D98",
  ok: "#7FB89B", warn: "#D8B673", danger: "#D08A8A",
};
const SANS = "'Montserrat', system-ui, sans-serif";
const MONO = "'JetBrains Mono', ui-monospace, monospace";
const inS = { background: "#101116", border: `1px solid ${C.line}`, color: C.cream, borderRadius: 10, padding: "10px 12px", width: "100%", fontFamily: SANS, fontSize: 14, outline: "none" };
const uid = () => (crypto?.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2, 9));
const today = () => new Date().toISOString().slice(0, 10);
const money = (v) => "$" + (Number(v) || 0).toLocaleString("en-US");

const CANALES = ["Referido", "Instagram", "LinkedIn", "Guía IA", "Formulario contacto", "Prospección", "Evento", "WhatsApp"];

export default function ClientesView({ data, commit, flash, openDrawer, setView }) {
  const leads = data.siemon.leads || [];
  const facturas = data.siemon.facturas || [];
  const clientes = useMemo(() => leads.filter((l) => l.status === "Cliente"), [leads]);
  const [showNC, setShowNC] = useState(false);
  const [nc, setNc] = useState({ name: "", company: "", email: "", phone: "", canal: "Referido", valor: "" });

  function factDe(l) {
    return facturas.filter((f) => f.leadId === l.id || (f.email && f.email === l.email));
  }
  function crearCliente() {
    if (!nc.name.trim() && !nc.company.trim()) return flash("Pon el nombre o la empresa.");
    if (nc.email && leads.some((l) => (l.email || "").toLowerCase() === nc.email.trim().toLowerCase())) return flash("Ya existe un lead con ese email (búscalo en Leads y muévelo a Cliente).");
    const nuevo = {
      id: uid(), name: nc.name.trim() || nc.company.trim(), email: nc.email.trim().toLowerCase(), company: nc.company.trim(),
      phone: nc.phone.trim(), language: "es", message: "", type: "contacto",
      leadSource: nc.canal, fuente: "cliente-manual-" + nc.canal.toLowerCase().replace(/\s+/g, "-"),
      createdAt: today(), tags: ["Cliente"], status: "Cliente", qualified: true,
      leadOwner: "Andrea", leadOwnerEmail: "andrea@siemondigital.com",
      subscribed: true, valor: Number(nc.valor) || 0,
      bookingDate: "", estadoLlamada: "", zonaHoraria: "", horaCliente: "", llamadaRealizada: false,
      caminoPostLlamada: "", notasDescubrimiento: "Cliente creado a mano (canal: " + nc.canal + ")", comentarioAdicional: "",
      videollamadaDate: "", videollamadaZoom: "", videollamadaEstado: "", videollamadaRealizada: false,
      presentacionUrl: "", outreachNotes: "", followUpDate: "", aiSummary: "", unsubscribedDate: "", unsubscribeReason: "",
    };
    commit({ ...data, siemon: { ...data.siemon, leads: [nuevo, ...leads] } });
    setNc({ name: "", company: "", email: "", phone: "", canal: nc.canal, valor: "" }); setShowNC(false);
    flash("Cliente creado con su origen registrado. Ya aparece en Facturación para facturarle.");
  }

  const totalCobrado = clientes.reduce((a, l) => a + factDe(l).filter((f) => f.estado === "Pagada").reduce((x, f) => x + (Number(f.total) || 0), 0), 0);

  return (
    <div className="p-5 md:p-8" style={{ maxWidth: 1100 }}>
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <div style={{ color: C.aether500, fontFamily: MONO, letterSpacing: "0.2em" }} className="fs-10 uppercase mb-2"><span style={{ color: C.aether }}>// </span>Relación y facturación</div>
          <h1 style={{ fontWeight: 600, color: C.cream }} className="fs-24 flex items-center gap-2"><Handshake size={20} color={C.aether} /> Clientes ({clientes.length})</h1>
          <div style={{ color: C.ash }} className="fs-11 mt-1">Llegan solos cuando mueves un lead a la etapa "Cliente" en el Pipeline (customer journey) o los creas aquí a mano. Siempre con su origen registrado.</div>
        </div>
        <button onClick={() => setShowNC((v) => !v)} style={{ background: C.aether, color: C.obsidian, fontWeight: 600 }} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg fs-12 shrink-0"><Plus size={13} /> Nuevo cliente</button>
      </div>

      {showNC && (
        <div style={{ background: C.panel, border: `1px solid ${C.aetherLine}` }} className="rounded-xl p-4 mb-4">
          <div style={{ color: C.aether500, fontFamily: MONO, letterSpacing: "0.16em" }} className="fs-10 uppercase mb-3">// Nuevo cliente (a mano)</div>
          <div className="grid sm:grid-cols-3 gap-3">
            <div><label style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase">Nombre</label>
              <input style={inS} value={nc.name} onChange={(e) => setNc({ ...nc, name: e.target.value })} placeholder="ej. Laura Gómez" /></div>
            <div><label style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase">Empresa</label>
              <input style={inS} value={nc.company} onChange={(e) => setNc({ ...nc, company: e.target.value })} placeholder="ej. Estudio Gómez" /></div>
            <div><label style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase">Email</label>
              <input style={inS} value={nc.email} onChange={(e) => setNc({ ...nc, email: e.target.value })} placeholder="laura@estudio.com" /></div>
            <div><label style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase">Teléfono / WhatsApp</label>
              <input style={inS} value={nc.phone} onChange={(e) => setNc({ ...nc, phone: e.target.value })} placeholder="+57 …" /></div>
            <div><label style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase">De dónde llegó (canal)</label>
              <Combo listaId="dl-canal-cliente" style={inS} value={nc.canal} onChange={(v) => setNc({ ...nc, canal: v })} opciones={opcionesDe(data, "canalProspecto", CANALES)} placeholder="Referido" /></div>
            <div><label style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase">Valor (USD)</label>
              <input style={inS} type="number" value={nc.valor} onChange={(e) => setNc({ ...nc, valor: e.target.value })} placeholder="ej. 1900" /></div>
          </div>
          <div className="flex items-center gap-2 mt-3">
            <button onClick={crearCliente} style={{ background: C.aether, color: C.obsidian, fontWeight: 600 }} className="px-3.5 py-2 rounded-lg fs-12">Crear cliente</button>
            <button onClick={() => setShowNC(false)} style={{ color: C.ash }} className="fs-12">Cancelar</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
        {[["Clientes activos", clientes.length], ["Cobrado (histórico)", money(totalCobrado)], ["Con facturas", clientes.filter((l) => factDe(l).length > 0).length]].map(([k, v]) => (
          <div key={k} style={{ background: C.panel, border: `1px solid ${C.line}` }} className="rounded-xl p-3.5">
            <div style={{ color: C.aether2, fontFamily: MONO, fontWeight: 700 }} className="fs-18">{v}</div>
            <div style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase">{k}</div>
          </div>
        ))}
      </div>

      {clientes.length === 0 ? (
        <div style={{ color: C.ash }} className="fs-12">Aún no hay clientes. Mueve un lead a "Cliente" en el Pipeline o crea uno aquí.</div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {clientes.map((l) => {
            const fs = factDe(l);
            const pagado = fs.filter((f) => f.estado === "Pagada").reduce((a, f) => a + (Number(f.total) || 0), 0);
            const pendiente = fs.filter((f) => f.estado !== "Pagada").reduce((a, f) => a + (Number(f.total) || 0), 0);
            return (
              <div key={l.id} style={{ background: C.panel, border: `1px solid ${C.line}` }} className="rounded-xl p-4">
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="min-w-0 flex-1" onClick={() => openDrawer && openDrawer(l.id)} style={{ cursor: "pointer" }}>
                    <div style={{ color: C.cream, fontWeight: 600 }} className="fs-13">{l.company || l.name}</div>
                    <div style={{ color: C.ash }} className="fs-10">{l.name} · {l.email || "sin email"}</div>
                  </div>
                  <span title="De dónde llegó" style={{ background: C.aetherSoft, border: `1px solid ${C.aetherLine}`, color: C.aether2, fontFamily: MONO }} className="px-2 py-0.5 rounded fs-9">origen: {l.leadSource || l.fuente || "?"}</span>
                  {l.type === "prospeccion" && <span style={{ background: "rgba(255,255,255,0.05)", border: `1px solid ${C.line}`, color: C.ash, fontFamily: MONO }} className="px-2 py-0.5 rounded fs-9">vino de frío</span>}
                  <div className="text-right shrink-0">
                    <div style={{ color: C.ok, fontFamily: MONO }} className="fs-12">{money(pagado)} cobrado</div>
                    {pendiente > 0 && <div style={{ color: C.warn, fontFamily: MONO }} className="fs-10">{money(pendiente)} pendiente</div>}
                    {fs.length === 0 && <div style={{ color: C.ash, fontFamily: MONO }} className="fs-10">sin facturas</div>}
                  </div>
                  <button onClick={() => setView && setView("facturacion")} style={{ color: C.aether2, border: `1px solid ${C.aetherLine}` }} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg fs-11 shrink-0">Facturar <ArrowRight size={11} /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
