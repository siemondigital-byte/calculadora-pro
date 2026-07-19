import React, { useState, useEffect } from "react";
import { BarChart3, RefreshCw, ArrowRight, Sparkles } from "lucide-react";
import { getToken } from "./db";
import { insightsMercado } from "./MercadoView.jsx";

const C = {
  obsidian: "#0A0B0D", panel: "#16171C", carbon: "#131418", line: "rgba(255,255,255,0.08)",
  aether: "#B1A3E1", aether2: "#CBC0EC", aether500: "#8474BE", aetherSoft: "rgba(177,163,225,0.14)",
  aetherLine: "rgba(177,163,225,0.30)", cream: "#E9E5DD", mist: "#C9CAD2", ash: "#8B8D98",
  ok: "#7FB89B", warn: "#D8B673", danger: "#D08A8A",
};
const MONO = "'JetBrains Mono', ui-monospace, monospace";
const MOTOR = import.meta.env.VITE_MOTOR_URL || "https://prospeccion.siemondigital.com";
const H = () => ({ "content-type": "application/json", Authorization: "Bearer " + getToken() });

export default function AnaliticaView({ data, flash }) {
  const [ana, setAna] = useState(null);
  const [dias, setDias] = useState(7);
  const [busy, setBusy] = useState(false);
  const insights = insightsMercado(data);
  const sols = (data.siemon.saludWeb && data.siemon.saludWeb.soluciones) || null;
  const audit = data.siemon.auditoriaNegocio || null;

  async function cargar(d) {
    setBusy(true);
    try {
      const r = await fetch(`${MOTOR}/analitica/resumen?dias=${d || dias}`, { headers: H() });
      const j = await r.json();
      setAna(j);
      if (!j.ok) flash(j.error === "umami_sin_configurar" ? "Falta configurar Umami en el motor." : "No pude leer la analítica: " + (j.error || ""));
    } catch { flash("No pude conectar con el motor."); }
    finally { setBusy(false); }
  }
  useEffect(() => { cargar(); }, []);

  return (
    <div className="p-5 md:p-8" style={{ maxWidth: 1100 }}>
      <div className="mb-5">
        <div style={{ color: C.aether500, fontFamily: MONO, letterSpacing: "0.2em" }} className="fs-10 uppercase mb-2"><span style={{ color: C.aether }}>// </span>Comportamiento de tus visitantes</div>
        <h1 style={{ fontWeight: 600, color: C.cream }} className="fs-24 flex items-center gap-2"><BarChart3 size={20} color={C.aether} /> Analítica</h1>
        <div style={{ color: C.ash }} className="fs-11 mt-1">Visitas reales de siemondigital.com (home, guía, presentación y blog) medidas con tu propio Umami: sin cookies y con los datos en tu servidor. Cruza estos números con el Estudio de mercado para decidir qué cambiar.</div>
      </div>

      <div className="flex items-center gap-2 flex-wrap mb-4">
        {[7, 30, 90].map((d) => (
          <button key={d} onClick={() => { setDias(d); cargar(d); }}
            style={{ background: dias === d ? C.aetherSoft : "transparent", border: `1px solid ${dias === d ? C.aether : C.line}`, color: dias === d ? C.aether2 : C.mist }}
            className="px-3 py-1.5 rounded-lg fs-11">{d} días</button>
        ))}
        <button onClick={() => cargar()} disabled={busy} style={{ background: C.aether, color: C.obsidian, fontWeight: 600, opacity: busy ? 0.6 : 1 }} className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg fs-12"><RefreshCw size={12} className={busy ? "animate-spin" : ""} /> Actualizar</button>
        <a href="https://analitica.siemondigital.com" target="_blank" rel="noreferrer" style={{ color: C.aether2 }} className="fs-11 inline-flex items-center gap-1">Panel completo de Umami <ArrowRight size={11} /></a>
      </div>

      {ana && !ana.ok && <div style={{ color: C.warn }} className="fs-12 mb-4">Analítica no disponible: {ana.error}</div>}
      {ana && ana.ok && (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[["Visitas", ana.visitas], ["Visitantes", ana.visitantes], ["Rebotes", ana.rebote], ["Min. totales", Math.round((ana.duracion_total_s || 0) / 60)]].map(([k, v]) => (
              <div key={k} style={{ background: C.panel, border: `1px solid ${C.line}` }} className="rounded-xl p-3.5">
                <div style={{ color: C.aether2, fontFamily: MONO, fontWeight: 700 }} className="fs-20">{v}</div>
                <div style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase">{k} · {ana.dias}d</div>
              </div>
            ))}
          </div>
          {ana.visitas === 0 && <div style={{ color: C.ash }} className="fs-11">Aún en ceros: la medición empieza a contar cuando publiques las páginas con el script (Maquetador → Publicar) y lleguen visitantes.</div>}
          {(ana.serie || []).length > 0 && (
            <div style={{ background: C.panel, border: `1px solid ${C.line}` }} className="rounded-xl p-4">
              <div style={{ color: C.aether500, fontFamily: MONO }} className="fs-9 uppercase mb-2">// Visitas por día</div>
              <div className="flex items-end gap-1" style={{ height: 56 }}>
                {(() => { const mx = Math.max(...ana.serie.map((p) => p.y || 0), 1); return ana.serie.map((p, i) => (
                  <div key={i} title={`${(p.x || "").slice(0, 10)}: ${p.y}`} style={{ flex: 1, height: Math.max(4, Math.round((p.y / mx) * 52)), background: "rgba(177,163,225,0.22)", border: `1px solid ${C.aether}`, borderRadius: 3, boxSizing: "border-box" }} />
                )); })()}
              </div>
            </div>
          )}
          <div className="grid md:grid-cols-2 gap-3">
            {[["Páginas más vistas", ana.paginas], ["De dónde llegan (referrers)", ana.referrers]].map(([tit, lista]) => (
              <div key={tit} style={{ background: C.panel, border: `1px solid ${C.line}` }} className="rounded-xl p-4">
                <div style={{ color: C.aether500, fontFamily: MONO }} className="fs-9 uppercase mb-2">// {tit}</div>
                {(lista || []).length === 0 ? <div style={{ color: C.ash }} className="fs-11">Sin datos aún.</div> : (lista || []).map((x, i) => (
                  <div key={i} className="flex items-center gap-2 mb-1">
                    <span style={{ color: C.mist, fontFamily: MONO, wordBreak: "break-all" }} className="fs-10 flex-1">{x.x || "(directo)"}</span>
                    <span style={{ color: C.aether2, fontFamily: MONO }} className="fs-11">{x.y}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
          {(ana.fuentes_utm || []).length > 0 && (
            <div style={{ background: C.panel, border: `1px solid ${C.line}` }} className="rounded-xl p-4">
              <div style={{ color: C.aether500, fontFamily: MONO }} className="fs-9 uppercase mb-2">// Tus campañas UTM en acción</div>
              {ana.fuentes_utm.map((x, i) => (
                <div key={i} className="flex items-center gap-2 mb-1">
                  <span style={{ color: C.mist, fontFamily: MONO }} className="fs-10 flex-1">{x.x}</span>
                  <span style={{ color: C.aether2, fontFamily: MONO }} className="fs-11">{x.y}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Conexión con Estudio de mercado: qué cambiar según lo aprendido */}
      {(insights || sols || audit) && (
        <div style={{ background: C.aetherSoft, border: `1px solid ${C.aetherLine}` }} className="rounded-xl p-4 mt-4">
          <div style={{ color: C.aether2, fontFamily: MONO }} className="fs-9 uppercase mb-2 flex items-center gap-1.5"><Sparkles size={11} /> Qué cambiar según el Estudio de mercado</div>
          {audit && (audit.quick_wins || []).slice(0, 3).map((q, i) => <div key={i} style={{ color: C.cream }} className="fs-11 mb-1">☐ {q}</div>)}
          {sols && <div style={{ color: C.mist }} className="fs-11 mb-1">→ Hay soluciones SEO listas para aplicar y publicar desde el <b>Maquetador</b>.</div>}
          {insights && <div className="fs-10 mt-1.5" style={{ whiteSpace: "pre-line", color: C.ash }}>{insights.split("\n").slice(0, 3).join("\n")}</div>}
          <div style={{ color: C.ash }} className="fs-10 mt-2">Cuando la analítica tenga datos, compara: si una página recibe visitas pero nadie agenda, el cambio va ahí primero.</div>
        </div>
      )}
    </div>
  );
}
