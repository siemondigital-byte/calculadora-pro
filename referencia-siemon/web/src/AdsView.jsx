import React, { useState, useEffect } from "react";
import { Megaphone, Check, AlertTriangle, Sparkles, Send, KeyRound, BarChart3, Rocket, Copy } from "lucide-react";
import { getToken } from "./db";
import Combo, { opcionesDe, guardarOpcion } from "./Combo.jsx";

const OFERTAS_ADS = [
  "descarga gratis la guía de automatización con IA",
  "diagnóstico Siemon: encuentra tus brechas de oportunidad",
  "agenda una llamada de descubrimiento gratuita",
  "automatiza tu atención al cliente con IA",
  "infoproducto de finanzas: acceso a la plataforma",
];

const C = {
  obsidian: "#0A0B0D", panel: "#16171C", carbon: "#131418", line: "rgba(255,255,255,0.08)",
  aether: "#B1A3E1", aether2: "#CBC0EC", aether500: "#8474BE", aetherSoft: "rgba(177,163,225,0.14)",
  aetherLine: "rgba(177,163,225,0.30)", cream: "#E9E5DD", mist: "#C9CAD2", ash: "#8B8D98", ok: "#7FB89B", warn: "#E0A85F",
};
const SANS = "'Montserrat', system-ui, sans-serif";
const MONO = "'JetBrains Mono', ui-monospace, monospace";
const MOTOR = import.meta.env.VITE_MOTOR_URL || "https://prospeccion.siemondigital.com";
const inS = { background: "#101116", border: `1px solid ${C.line}`, color: C.cream, borderRadius: 10, padding: "9px 12px", width: "100%", fontFamily: SANS, fontSize: 13, outline: "none" };
const H = () => ({ "content-type": "application/json", Authorization: "Bearer " + getToken() });

const PLATAFORMAS = [
  { id: "meta", label: "Meta Ads (Instagram + Facebook)", campos: [["META_ADS_TOKEN", "Access token (System User)"], ["META_ADS_ACCOUNT", "Ad Account ID (act_...)"]],
    guia: "developers.facebook.com → app con permiso ads_management → System User token + tu Ad Account ID.", real: true },
  { id: "linkedin", label: "LinkedIn Ads", campos: [["LINKEDIN_ADS_TOKEN", "Access token"], ["LINKEDIN_ADS_ACCOUNT", "Account ID"]],
    guia: "Requiere acceso al LinkedIn Marketing Developer Platform (solicitud + aprobación de LinkedIn).", real: false },
  { id: "google", label: "Google Ads", campos: [["GOOGLE_ADS_DEV_TOKEN", "Developer token"], ["GOOGLE_ADS_TOKEN", "OAuth access token"], ["GOOGLE_ADS_CUSTOMER", "Customer ID"]],
    guia: "Requiere developer token aprobado por Google + OAuth + Customer ID.", real: false },
];
const OBJETIVOS = [
  { id: "OUTCOME_TRAFFIC", label: "Tráfico (visitas a tu web)" },
  { id: "OUTCOME_LEADS", label: "Leads (formularios / mensajes)" },
  { id: "OUTCOME_ENGAGEMENT", label: "Interacción" },
  { id: "OUTCOME_AWARENESS", label: "Reconocimiento" },
  { id: "OUTCOME_SALES", label: "Ventas / conversiones" },
];

// Benchmarks de costo por lead (USD) editables: punto de partida, no promesa.
const CPL_DEFAULT = { meta: 8, linkedin: 45, google: 20 };

function Barras({ items, unidad, color }) {
  const max = Math.max(...items.map((i) => i.v), 1);
  return (
    <div className="flex flex-col gap-1.5">
      {items.map((i) => (
        <div key={i.k} className="flex items-center gap-2">
          <span style={{ color: C.ash, width: 64 }} className="fs-10 shrink-0">{i.k}</span>
          <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: 5, height: 18 }} className="flex-1">
            <div style={{ width: `${Math.max(4, (i.v / max) * 100)}%`, background: color + "38", border: `1px solid ${color}`, boxSizing: "border-box", height: "100%", borderRadius: 5 }} />
          </div>
          <span style={{ color: C.cream, fontFamily: MONO, minWidth: 74 }} className="fs-10 text-right shrink-0">{i.txt || i.v}{unidad || ""}</span>
        </div>
      ))}
    </div>
  );
}

export default function AdsView({ data, commit, flash }) {
  const [cfg, setCfg] = useState({});
  const [editar, setEditar] = useState("");     // plataforma cuyas credenciales se editan
  const [vals, setVals] = useState({});
  // campaña
  const [plat, setPlat] = useState("meta");
  const [nombre, setNombre] = useState("");
  const [objetivo, setObjetivo] = useState("OUTCOME_TRAFFIC");
  const [tema, setTema] = useState("");
  const [copy, setCopy] = useState("");
  const [busyCopy, setBusyCopy] = useState(false);
  const [busyCrear, setBusyCrear] = useState(false);
  const [busyPlan, setBusyPlan] = useState(false);
  const lanz = data.siemon.adsLanzamiento || null;   // plan de lanzamiento persistido
  // estudio de mercado: se corre en el módulo Estudio de mercado; aquí solo se lee
  const audit = data.siemon.auditoriaNegocio || null;

  // --- Conversions API (medición server-side de Meta) ---
  const [capi, setCapi] = useState(null);       // {token, pixel, test_code}
  const [capiEd, setCapiEd] = useState(false);
  const [capiVals, setCapiVals] = useState({ FB_CAPI_TOKEN: "", FB_PIXEL_ID: "", FB_CAPI_TEST: "" });
  const [capiBusy, setCapiBusy] = useState(false);
  async function cargarCapi() { try { const r = await fetch(MOTOR + "/capi/estado", { headers: H() }); setCapi(await r.json()); } catch {} }
  useEffect(() => { cargarCapi(); /* eslint-disable-next-line */ }, []);
  async function guardarCapi() {
    const t = capiVals.FB_CAPI_TOKEN.trim(), px = capiVals.FB_PIXEL_ID.trim(), tc = capiVals.FB_CAPI_TEST.trim();
    if (!t || !px) return flash("Pega el token de CAPI y el ID del Pixel (los dos).");
    setCapiBusy(true);
    try {
      await fetch(MOTOR + "/secreto/guardar", { method: "POST", headers: H(), body: JSON.stringify({ clave: "FB_CAPI_TOKEN", valor: t }) });
      await fetch(MOTOR + "/secreto/guardar", { method: "POST", headers: H(), body: JSON.stringify({ clave: "FB_PIXEL_ID", valor: px }) });
      if (tc) await fetch(MOTOR + "/secreto/guardar", { method: "POST", headers: H(), body: JSON.stringify({ clave: "FB_CAPI_TEST", valor: tc }) });
      setCapiEd(false); setCapiVals({ FB_CAPI_TOKEN: "", FB_PIXEL_ID: "", FB_CAPI_TEST: "" });
      await cargarCapi(); flash("Conversions API conectada ✓ Pulsa 'Enviar prueba' para verificar.");
    } catch { flash("No pude guardar. Reintenta."); }
    finally { setCapiBusy(false); }
  }
  async function probarCapi() {
    setCapiBusy(true);
    try {
      const r = await fetch(MOTOR + "/capi/test", { method: "POST", headers: H(), body: "{}" });
      const d = await r.json();
      if (d.ok) flash(`Meta recibió ${d.recibidos || 1} evento de prueba ✓ (revísalo en Events Manager → Probar eventos).`);
      else flash("Meta rechazó la prueba: " + (d.error || d.nota || "revisa token/pixel."));
    } catch { flash("No pude enviar la prueba."); }
    finally { setCapiBusy(false); }
  }

  async function generarPlan() {
    if (!tema.trim()) return flash("Escribe primero el tema/oferta de la campaña (arriba).");
    setBusyPlan(true);
    try {
      const r = await fetch(MOTOR + "/ads/plan", { method: "POST", headers: H(), body: JSON.stringify({ oferta: tema, presupuesto_test: 5, plataforma: plat === "meta" ? "Meta" : plat, estudio: audit ? audit.hallazgos_para_ads : undefined }) });
      const d = await r.json();
      if (!d.ok) return flash("No pude generar el plan: " + (d.error || ""));
      commit({ ...data, siemon: { ...data.siemon, adsLanzamiento: { ...d.plan, oferta: tema, fecha: new Date().toISOString().slice(0, 10) } } });
      flash("Plan de lanzamiento listo: testeo + awareness + creativos por temperatura.");
    } catch { flash("No pude conectar con el motor."); }
    finally { setBusyPlan(false); }
  }
  function copiarPlan() {
    if (!lanz) return;
    const t = [
      `PLAN DE LANZAMIENTO · ${lanz.oferta} · ${lanz.fecha}`,
      `\n== CAMPAÑA DE TESTEO (${lanz.testeo?.objetivo}) ==`,
      ...(lanz.testeo?.conjuntos || []).map((c, i) => `Conjunto ${i + 1}: interés "${c.interes}" · $${c.presupuesto_dia}/día · ${c.por_que}`),
      `Placements: ${lanz.testeo?.placements}`,
      `\n== CAMPAÑA AWARENESS (${lanz.awareness?.objetivo}) ==`,
      `Público: ${lanz.awareness?.publico}`, `Por qué: ${lanz.awareness?.por_que}`,
      `\n== CREATIVOS ==`,
      ...(lanz.creativos || []).map((c) => `[${(c.temperatura || "").toUpperCase()}] Gancho: ${c.gancho}\nVideo: ${c.video}\nTexto: ${c.texto_principal}\nTitular: ${c.titular} · CTA: ${c.cta}\n`),
      `== ESCALADO ==`, ...(lanz.escalado || []).map((e) => `- ${e}`),
      `\n== CHECKLIST ANTES DE LANZAR ==`, ...(lanz.checklist || []).map((e) => `☐ ${e}`),
      `\nPresupuesto total estimado: $${lanz.presupuesto_total_dia}/día`,
    ].join("\n");
    try { navigator.clipboard.writeText(t); flash("Plan copiado (pégalo donde lo montes)."); } catch {}
  }

  async function cargar() { try { const r = await fetch(MOTOR + "/ads/config", { headers: H() }); setCfg(await r.json()); } catch {} }
  useEffect(() => { cargar(); }, []);

  // plan de viabilidad (persistido en data.siemon.adsPlan)
  const plan = { presupuesto: 300, ticket: 500, cierre: 15, cpl: { ...CPL_DEFAULT }, ...(data.siemon.adsPlan || {}) };
  const setPlan = (patch) => commit({ ...data, siemon: { ...data.siemon, adsPlan: { ...plan, ...patch } } });
  const calc = Object.entries(plan.cpl).map(([k, cpl]) => {
    const leads = cpl > 0 ? plan.presupuesto / cpl : 0;
    const clientes = leads * (plan.cierre / 100);
    const ingreso = clientes * plan.ticket;
    const roi = plan.presupuesto > 0 ? ingreso / plan.presupuesto : 0;
    return { k, cpl, leads, clientes, ingreso, roi };
  });

  async function guardar(pid, campos) {
    const cuerpo = {}; campos.forEach(([k]) => { if (vals[k] != null) cuerpo[k] = vals[k]; });
    try { await fetch(MOTOR + "/ads/config", { method: "POST", headers: H(), body: JSON.stringify({ valores: cuerpo }) });
      setEditar(""); setVals({}); flash("Credenciales guardadas."); cargar();
    } catch { flash("No pude guardar."); }
  }
  async function generarCopy(tipoGen) {
    if (!tema.trim()) return flash("Escribe el tema/oferta de la campaña.");
    const t = typeof tipoGen === "string" ? tipoGen : "anuncio";
    setBusyCopy(true);
    try {
      const r = await fetch(MOTOR + "/generar_contenido", { method: "POST", headers: H(), body: JSON.stringify({ red: plat === "meta" ? "meta" : plat, tipo: t, tema, idioma: "es" }) });
      const d = await r.json(); setCopy(d.contenido || "No pude generar el copy.");
      if (d.contenido && tema.trim()) guardarOpcion(data, commit, "ofertaAds", tema, OFERTAS_ADS);   // aprende tu oferta
    } catch { flash("No pude generar el copy."); } finally { setBusyCopy(false); }
  }
  async function crear() {
    if (!cfg[plat]) return flash("Conecta " + plat + " primero (arriba).");
    if (!nombre.trim()) return flash("Ponle nombre a la campaña.");
    setBusyCrear(true);
    try {
      const r = await fetch(MOTOR + "/ads/crear", { method: "POST", headers: H(), body: JSON.stringify({ plataforma: plat, nombre, objetivo }) });
      const d = await r.json();
      if (d.ok) {
        const item = { id: (crypto?.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)), plataforma: plat, nombre, objetivo, refId: d.id, estado: d.estado || "PAUSED", copy, fecha: new Date().toISOString().slice(0, 10) };
        commit({ ...data, siemon: { ...data.siemon, campanasAds: [item, ...(data.siemon.campanasAds || [])] } });
        flash("✓ " + (d.nota || "Campaña creada en pausa."));
      } else flash("No se creó: " + (d.nota || d.error || "revisa la conexión"));
    } catch { flash("No pude conectar con el motor."); } finally { setBusyCrear(false); }
  }

  const campanas = data.siemon.campanasAds || [];

  return (
    <div className="p-5 md:p-8" style={{ maxWidth: 1100 }}>
      <div className="mb-4">
        <h2 style={{ fontWeight: 600, color: C.cream }} className="fs-18 flex items-center gap-2"><Megaphone size={17} color={C.aether} /> Ads · campañas pagadas</h2>
        <div style={{ color: C.ash }} className="fs-11 mt-1">Conecta tus cuentas de anuncios y crea campañas. Meta se crea de verdad (siempre <b style={{ color: C.warn }}>en pausa</b>: la revisas y activas tú, así no gasta sin tu visto bueno).</div>
      </div>

      {/* conexiones */}
      <div className="grid sm:grid-cols-3 gap-3 mb-5">
        {PLATAFORMAS.map((p) => {
          const on = !!cfg[p.id];
          return (
            <div key={p.id} style={{ background: C.panel, border: `1px solid ${on ? "rgba(127,184,155,0.4)" : C.line}` }} className="rounded-xl p-3.5">
              <div className="flex items-center justify-between mb-1">
                <span style={{ color: C.cream }} className="fs-12 font-medium">{p.label}</span>
                {on ? <span style={{ color: C.ok }} className="fs-9 inline-flex items-center gap-1"><Check size={11} /> conectada</span>
                    : <span style={{ color: p.real ? C.ash : C.warn }} className="fs-9 inline-flex items-center gap-1">{p.real ? "sin conectar" : <><AlertTriangle size={11} /> requiere API</>}</span>}
              </div>
              <div style={{ color: C.ash }} className="fs-9 leading-snug mb-2">{p.guia}</div>
              {editar === p.id ? (
                <div className="flex flex-col gap-1.5">
                  {p.campos.map(([k, l]) => <input key={k} style={{ ...inS, fontSize: 12 }} placeholder={l} value={vals[k] || ""} onChange={(e) => setVals({ ...vals, [k]: e.target.value })} />)}
                  <div className="flex gap-2 mt-1"><button onClick={() => guardar(p.id, p.campos)} style={{ background: C.aether, color: C.obsidian, fontWeight: 600 }} className="px-2.5 py-1 rounded fs-11">Guardar</button><button onClick={() => { setEditar(""); setVals({}); }} style={{ color: C.ash }} className="fs-11">Cancelar</button></div>
                </div>
              ) : (
                <button onClick={() => { setEditar(p.id); setVals({}); }} style={{ color: C.aether2, border: `1px solid ${C.aetherLine}` }} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded fs-11"><KeyRound size={11} /> {on ? "Cambiar" : "Conectar"}</button>
              )}
            </div>
          );
        })}
      </div>

      {/* Conversions API — medición server-side */}
      <div style={{ background: C.panel, border: `1px solid ${(capi && capi.token && capi.pixel) ? "rgba(127,184,155,0.4)" : C.line}` }} className="rounded-xl p-4 mb-5">
        <div className="flex items-center justify-between mb-1">
          <div style={{ color: C.aether500, fontFamily: MONO, letterSpacing: "0.16em" }} className="fs-10 uppercase flex items-center gap-1.5"><BarChart3 size={12} color={C.aether} /> Conversions API · medición de tus Ads</div>
          {capi && capi.token && capi.pixel ? <span style={{ color: C.ok }} className="fs-9 inline-flex items-center gap-1"><Check size={11} /> conectada</span> : <span style={{ color: C.ash }} className="fs-9">sin conectar</span>}
        </div>
        <div style={{ color: C.ash }} className="fs-10 mb-3 leading-snug">Envía los eventos (visitas, leads, ventas) a Meta <b style={{ color: C.mist }}>desde el servidor</b>, sin depender de cookies. Meta optimiza mejor tus campañas y mide aunque el navegador bloquee el píxel.</div>
        {capiEd || !(capi && capi.token && capi.pixel) ? (
          <div className="flex flex-col gap-2" style={{ maxWidth: 520 }}>
            <input style={{ ...inS, fontSize: 12, fontFamily: MONO }} type="password" placeholder="Token de Conversions API (Events Manager → Conversions API)" value={capiVals.FB_CAPI_TOKEN} onChange={(e) => setCapiVals({ ...capiVals, FB_CAPI_TOKEN: e.target.value })} autoComplete="off" />
            <input style={{ ...inS, fontSize: 12, fontFamily: MONO }} placeholder="ID del Pixel / Conjunto de datos (15-16 dígitos)" value={capiVals.FB_PIXEL_ID} onChange={(e) => setCapiVals({ ...capiVals, FB_PIXEL_ID: e.target.value })} autoComplete="off" />
            <input style={{ ...inS, fontSize: 12, fontFamily: MONO }} placeholder="Código de prueba (opcional · TESTxxxxx, para verificar)" value={capiVals.FB_CAPI_TEST} onChange={(e) => setCapiVals({ ...capiVals, FB_CAPI_TEST: e.target.value })} autoComplete="off" />
            <div className="flex gap-2 mt-0.5">
              <button onClick={guardarCapi} disabled={capiBusy} style={{ background: C.aether, color: C.obsidian, fontWeight: 600 }} className="px-3 py-1.5 rounded-lg fs-11">{capiBusy ? "…" : "Guardar y conectar"}</button>
              {capi && capi.token && <button onClick={() => setCapiEd(false)} style={{ color: C.ash }} className="fs-11">Cancelar</button>}
            </div>
            <div style={{ color: C.ash }} className="fs-9">Se guarda cifrado en el motor; el token nunca vuelve a mostrarse.</div>
          </div>
        ) : (
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={probarCapi} disabled={capiBusy} style={{ background: C.aetherSoft, border: `1px solid ${C.aetherLine}`, color: C.aether2, fontWeight: 600 }} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg fs-11"><Send size={12} /> {capiBusy ? "Enviando…" : "Enviar prueba"}</button>
            <button onClick={() => { setCapiEd(true); setCapiVals({ FB_CAPI_TOKEN: "", FB_PIXEL_ID: "", FB_CAPI_TEST: "" }); }} style={{ color: C.aether2, border: `1px solid ${C.aetherLine}` }} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg fs-11"><KeyRound size={11} /> Cambiar</button>
            {capi.test_code && <span style={{ color: C.ash }} className="fs-9">· código de prueba puesto</span>}
          </div>
        )}
      </div>

      {/* viabilidad */}
      <div style={{ background: C.panel, border: `1px solid ${C.line}` }} className="rounded-xl p-4 mb-5">
        <div style={{ color: C.aether500, fontFamily: MONO, letterSpacing: "0.16em" }} className="fs-10 uppercase mb-1 flex items-center gap-1.5"><BarChart3 size={12} color={C.aether} /> Viabilidad · ¿dónde rinde tu presupuesto?</div>
        <div style={{ color: C.ash }} className="fs-10 mb-3">Estimación con benchmarks editables (no promesa). Ajusta el costo por lead de cada plataforma a tu experiencia real y compara.</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
          <div><label style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase">Presupuesto/mes (USD)</label>
            <input type="number" style={inS} value={plan.presupuesto} onChange={(e) => setPlan({ presupuesto: Number(e.target.value) || 0 })} /></div>
          <div><label style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase">Ticket promedio (USD)</label>
            <input type="number" style={inS} value={plan.ticket} onChange={(e) => setPlan({ ticket: Number(e.target.value) || 0 })} /></div>
          <div><label style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase">Tasa de cierre (%)</label>
            <input type="number" style={inS} value={plan.cierre} onChange={(e) => setPlan({ cierre: Number(e.target.value) || 0 })} /></div>
        </div>
        <div className="grid grid-cols-3 gap-3 mb-4">
          {Object.entries(plan.cpl).map(([k, v]) => (
            <div key={k}><label style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase">CPL {k} (USD)</label>
              <input type="number" style={inS} value={v} onChange={(e) => setPlan({ cpl: { ...plan.cpl, [k]: Number(e.target.value) || 0 } })} /></div>
          ))}
        </div>
        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <div style={{ color: C.ash, fontFamily: MONO }} className="fs-9 uppercase mb-1.5">Leads estimados / mes</div>
            <Barras color={C.aether} items={calc.map((c) => ({ k: c.k, v: c.leads, txt: c.leads.toFixed(0) }))} />
          </div>
          <div>
            <div style={{ color: C.ash, fontFamily: MONO }} className="fs-9 uppercase mb-1.5">Clientes estimados / mes</div>
            <Barras color={C.aether2} items={calc.map((c) => ({ k: c.k, v: c.clientes, txt: c.clientes.toFixed(1) }))} />
          </div>
          <div>
            <div style={{ color: C.ash, fontFamily: MONO }} className="fs-9 uppercase mb-1.5">Retorno estimado (x el gasto)</div>
            <Barras color={C.ok} items={calc.map((c) => ({ k: c.k, v: c.roi, txt: c.roi.toFixed(1) + "x" }))} />
          </div>
        </div>
        <div style={{ color: C.ash }} className="fs-9 mt-3">Lectura: con estos supuestos, {(() => { const best = [...calc].sort((a, b) => b.roi - a.roi)[0]; return best ? `${best.k} es la mejor apuesta (${best.roi.toFixed(1)}x). Un retorno < 1x pierde dinero.` : ""; })()}</div>
      </div>

      {/* crear campaña */}
      <div style={{ background: C.panel, border: `1px solid ${C.aetherLine}` }} className="rounded-xl p-4 mb-5">
        <div style={{ color: C.aether500, fontFamily: MONO, letterSpacing: "0.16em" }} className="fs-10 uppercase mb-3">// Crear campaña</div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div><label style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase">Plataforma</label>
            <select style={inS} value={plat} onChange={(e) => setPlat(e.target.value)}>{PLATAFORMAS.map((p) => <option key={p.id} value={p.id}>{p.label}{cfg[p.id] ? " ✓" : ""}</option>)}</select></div>
          <div><label style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase">Objetivo</label>
            <select style={inS} value={objetivo} onChange={(e) => setObjetivo(e.target.value)}>{OBJETIVOS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</select></div>
          <div className="sm:col-span-2"><label style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase">Nombre de la campaña</label>
            <input style={inS} value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="ej. Guía IA · tráfico · julio" /></div>
          <div className="sm:col-span-2"><label style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase">Tema / oferta (elige una o escribe la tuya)</label>
            <Combo listaId="dl-oferta-ads" style={inS} value={tema} onChange={setTema} opciones={opcionesDe(data, "ofertaAds", OFERTAS_ADS)} placeholder="ej. descarga gratis la guía de automatización con IA" /></div>
        </div>
        <div className="flex flex-wrap items-center gap-3 mt-3">
          <button onClick={() => generarCopy("anuncio")} disabled={busyCopy} style={{ background: "transparent", border: `1px solid ${C.aetherLine}`, color: C.aether2, fontWeight: 600, opacity: busyCopy ? 0.6 : 1 }} className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg fs-12"><Sparkles size={14} />{busyCopy ? "Generando…" : "Copy (3 variaciones A/B/C)"}</button>
          <button onClick={() => generarCopy("ad_variaciones")} disabled={busyCopy} style={{ background: "transparent", border: `1px solid ${C.aetherLine}`, color: C.aether2, fontWeight: 600, opacity: busyCopy ? 0.6 : 1 }} className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg fs-12"><Sparkles size={14} />{busyCopy ? "Generando…" : "Corto/medio/largo + títulos + triggers"}</button>
          <button onClick={crear} disabled={busyCrear} style={{ background: C.aether, color: C.obsidian, fontWeight: 600, opacity: busyCrear ? 0.6 : 1 }} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg fs-13"><Send size={14} />{busyCrear ? "Creando…" : "Crear campaña (en pausa)"}</button>
        </div>
        {copy && <textarea value={copy} onChange={(e) => setCopy(e.target.value)} style={{ ...inS, minHeight: 140, marginTop: 12, whiteSpace: "pre-wrap", lineHeight: 1.6 }} />}
      </div>

      {/* estudio de mercado: vive en su módulo; aquí solo el estado */}
      <div style={{ background: C.panel, border: `1px solid ${audit ? "rgba(127,184,155,0.4)" : C.line}` }} className="rounded-xl p-3.5 mb-5 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <span style={{ color: C.aether500, fontFamily: MONO, letterSpacing: "0.14em" }} className="fs-10 uppercase">// Estudio de mercado</span>
          {audit
            ? <span style={{ color: C.ok }} className="fs-11">✓ Análisis del {audit.fecha} ({audit.global}/100) · sus hallazgos fundamentan el plan de abajo</span>
            : <span style={{ color: C.ash }} className="fs-11">Sin análisis aún: el plan saldrá genérico. Córrelo en el módulo Estudio de mercado.</span>}
        </div>
      </div>

      {/* plan de lanzamiento (skill ads: testeo controlado + awareness amplio) */}
      <div style={{ background: C.panel, border: `1px solid ${C.line}` }} className="rounded-xl p-4 mb-5">
        <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
          <div style={{ color: C.aether500, fontFamily: MONO, letterSpacing: "0.16em" }} className="fs-10 uppercase flex items-center gap-1.5"><Rocket size={12} color={C.aether} /> Plan de lanzamiento</div>
          <div className="flex items-center gap-2">
            {lanz && <button onClick={copiarPlan} style={{ color: C.aether2 }} className="inline-flex items-center gap-1 fs-11"><Copy size={12} /> Copiar plan</button>}
            <button onClick={generarPlan} disabled={busyPlan} style={{ background: lanz ? "transparent" : C.aether, color: lanz ? C.aether2 : C.obsidian, border: `1px solid ${C.aetherLine}`, fontWeight: 600, opacity: busyPlan ? 0.6 : 1 }} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg fs-12"><Sparkles size={13} /> {busyPlan ? "Diseñando…" : lanz ? "Regenerar" : "Generar plan"}</button>
          </div>
        </div>
        {!lanz ? (
          <div style={{ color: C.ash }} className="fs-11 leading-snug">Escribe tu oferta arriba y genera el plan completo: campaña de <b style={{ color: C.mist }}>testeo</b> (un interés por conjunto, $5/día, para saber qué funciona) + campaña de <b style={{ color: C.mist }}>awareness</b> en paralelo (público amplio con creativo que nombra el problema, para llegar a quien no sabe describir lo que le pasa) + creativos por temperatura + checklist antes de lanzar.</div>
        ) : (
          <div className="flex flex-col gap-4">
            <div style={{ color: C.ash, fontFamily: MONO }} className="fs-10">{lanz.oferta} · {lanz.fecha} · presupuesto total ≈ ${lanz.presupuesto_total_dia}/día</div>
            <div className="grid lg:grid-cols-2 gap-3">
              <div style={{ background: C.carbon, border: `1px solid ${C.line}` }} className="rounded-lg p-3">
                <div style={{ color: C.aether2, fontWeight: 600 }} className="fs-12 mb-2">🧪 Testeo · {lanz.testeo?.objetivo}</div>
                <div className="flex flex-col gap-1.5">
                  {(lanz.testeo?.conjuntos || []).map((c, i) => (
                    <div key={i} style={{ borderLeft: `2px solid ${C.aetherLine}` }} className="pl-2">
                      <div style={{ color: C.cream }} className="fs-11">Conjunto {i + 1}: <b>{c.interes}</b> · ${c.presupuesto_dia}/día</div>
                      <div style={{ color: C.ash }} className="fs-10">{c.por_que}</div>
                    </div>
                  ))}
                </div>
                <div style={{ color: C.ash }} className="fs-10 mt-2">Placements: {lanz.testeo?.placements}</div>
              </div>
              <div style={{ background: C.carbon, border: `1px solid ${C.line}` }} className="rounded-lg p-3">
                <div style={{ color: C.aether2, fontWeight: 600 }} className="fs-12 mb-2">📡 Awareness · {lanz.awareness?.objetivo}</div>
                <div style={{ color: C.cream }} className="fs-11 mb-1">Público: {lanz.awareness?.publico}</div>
                <div style={{ color: C.ash }} className="fs-10 leading-snug">{lanz.awareness?.por_que}</div>
                <div style={{ color: C.aether500, fontFamily: MONO }} className="fs-9 uppercase mt-3 mb-1">// Escalado (80/20)</div>
                {(lanz.escalado || []).map((e, i) => <div key={i} style={{ color: C.mist }} className="fs-10">• {e}</div>)}
              </div>
            </div>
            <div>
              <div style={{ color: C.aether500, fontFamily: MONO }} className="fs-9 uppercase mb-2">// Creativos por temperatura (estructura viral, estilo nativo)</div>
              <div className="grid lg:grid-cols-3 gap-3">
                {(lanz.creativos || []).map((c, i) => {
                  const col = c.temperatura === "frio" ? "#8FB8D8" : c.temperatura === "templado" ? C.warn : C.danger;
                  return (
                    <div key={i} style={{ background: C.carbon, border: `1px solid ${C.line}` }} className="rounded-lg p-3">
                      <span style={{ background: "rgba(255,255,255,0.05)", border: `1px solid ${C.line}`, color: col, fontFamily: MONO }} className="px-1.5 py-0.5 rounded fs-9 uppercase">{c.temperatura}</span>
                      <div style={{ color: C.aether2 }} className="fs-11 italic mt-2">"{c.gancho}"</div>
                      <div style={{ color: C.mist }} className="fs-10 mt-1.5 leading-snug">{c.video}</div>
                      <div style={{ borderTop: `1px solid ${C.line}` }} className="mt-2 pt-2">
                        <div style={{ color: C.mist }} className="fs-10">{c.texto_principal}</div>
                        <div style={{ color: C.cream, fontWeight: 600 }} className="fs-10 mt-1">{c.titular} → {c.cta}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div style={{ background: "rgba(216,182,115,0.08)", border: `1px solid rgba(216,182,115,0.3)` }} className="rounded-lg p-3">
              <div style={{ color: C.warn, fontFamily: MONO }} className="fs-9 uppercase mb-1.5">// Checklist antes de lanzar</div>
              {(lanz.checklist || []).map((e, i) => <div key={i} style={{ color: C.mist }} className="fs-11">☐ {e}</div>)}
            </div>
          </div>
        )}
      </div>

      {/* campañas creadas */}
      {campanas.length > 0 && (
        <div>
          <div style={{ color: C.aether500, fontFamily: MONO, letterSpacing: "0.2em" }} className="fs-10 uppercase mb-2"><span style={{ color: C.aether }}>// </span>Campañas creadas</div>
          <div className="flex flex-col gap-2">
            {campanas.slice(0, 15).map((c) => (
              <div key={c.id} style={{ background: C.panel, border: `1px solid ${C.line}` }} className="rounded-lg p-3 flex items-center justify-between gap-3">
                <div className="min-w-0"><div style={{ color: C.mist }} className="fs-12 truncate">{c.nombre}</div><div style={{ color: C.ash, fontFamily: MONO }} className="fs-9">{c.plataforma} · {c.objetivo} · {c.fecha}</div></div>
                <span style={{ color: c.estado === "PAUSED" ? C.warn : C.ok, fontFamily: MONO }} className="fs-9 shrink-0">{c.estado}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
