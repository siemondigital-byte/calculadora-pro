import React, { useState, useEffect } from "react";
import { BarChart3, RefreshCw, ArrowRight, Sparkles } from "lucide-react";
import { C, MONO } from "./tema.js";
import { MOTOR, getToken } from "./db.js";
import { insightsMercado } from "./MercadoView.jsx";

const H = () => ({ "content-type": "application/json", Authorization: "Bearer " + getToken() });

export default function AnaliticaView({ data, ws }) {
  const [aviso, setAviso] = useState("");
  const flash = (m) => { setAviso(m); window.clearTimeout(flash._t); flash._t = window.setTimeout(() => setAviso(""), 6000); };
  const [ana, setAna] = useState(null);
  const [dias, setDias] = useState(7);
  const [busy, setBusy] = useState(false);
  const insights = insightsMercado(data);
  const sols = (data[ws].saludWeb && data[ws].saludWeb.soluciones) || null;
  const audit = data[ws].auditoriaNegocio || null;
  const dominio = ((data[ws]?.config || {}).dominio || "https://atlantisglobalrealty.com/").replace(/\/+$/, "");

  async function cargar(d) {
    setBusy(true);
    try {
      const r = await fetch(`${MOTOR}/analitica/resumen?dias=${d || dias}`, { headers: H() });
      const j = await r.json();
      setAna(j);
      if (!j.ok) flash(j.error === "umami_sin_configurar" ? "Falta configurar Umami: guarda UMAMI_URL, UMAMI_USER, UMAMI_PASS y UMAMI_WEBSITE_ID en Accesos." : "No pude leer la analítica: " + (j.error || ""));
    } catch { flash("No pude conectar con el motor."); }
    finally { setBusy(false); }
  }
  useEffect(() => { cargar(); /* eslint-disable-next-line */ }, []);

  return (
    <div style={{ maxWidth: 1100 }}>
      <div className="mb-5">
        <div style={{ color: C.aether500, fontFamily: MONO, letterSpacing: "0.2em" }} className="fs-10 uppercase mb-2"><span style={{ color: C.aether }}>// </span>Comportamiento de tus visitantes</div>
        <h1 style={{ fontWeight: 600, color: C.cream }} className="fs-24 flex items-center gap-2"><BarChart3 size={20} color={C.aether} /> Analítica</h1>
        <div style={{ color: C.ash }} className="fs-11 mt-1">Visitas reales de {dominio.replace("https://", "")} medidas con tu propio Umami: sin cookies y con los datos en tu servidor. Cruza estos números con el Estudio de mercado para decidir qué cambiar.</div>
      </div>

      <div className="flex items-center gap-2 flex-wrap mb-4">
        {[7, 30, 90].map((d) => (
          <button key={d} onClick={() => { setDias(d); cargar(d); }}
            style={{ background: dias === d ? C.aetherSoft : "transparent", border: `1px solid ${dias === d ? C.aether : C.line}`, color: dias === d ? C.aether2 : C.mist }}
            className="px-3 py-1.5 rounded-lg fs-11">{d} días</button>
        ))}
        <button onClick={() => cargar()} disabled={busy} style={{ background: C.aether, color: C.obsidian, fontWeight: 600, opacity: busy ? 0.6 : 1 }} className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg fs-12"><RefreshCw size={12} className={busy ? "animate-spin" : ""} /> Actualizar</button>
      </div>

      {aviso && <div style={{ background: C.aetherSoft, border: `1px solid ${C.aetherLine}`, color: C.aether2 }} className="rounded-lg px-3 py-2 mb-4 fs-12">{aviso}</div>}

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
          {ana.visitas === 0 && <div style={{ color: C.ash }} className="fs-11">Aún en ceros: la medición empieza a contar cuando las páginas lleven el script de Umami y lleguen visitantes.</div>}
          {(ana.serie || []).length > 0 && (
            <div style={{ background: C.panel, border: `1px solid ${C.line}` }} className="rounded-xl p-4">
              <div style={{ color: C.aether500, fontFamily: MONO }} className="fs-9 uppercase mb-2">// Visitas por día</div>
              <div className="flex items-end gap-1" style={{ height: 56 }}>
                {(() => { const mx = Math.max(...ana.serie.map((p) => p.y || 0), 1); return ana.serie.map((p, i) => (
                  <div key={i} title={`${(p.x || "").slice(0, 10)}: ${p.y}`} style={{ flex: 1, height: Math.max(4, Math.round((p.y / mx) * 52)), background: C.aetherSoft, border: `1px solid ${C.aether}`, borderRadius: 3, boxSizing: "border-box" }} />
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
