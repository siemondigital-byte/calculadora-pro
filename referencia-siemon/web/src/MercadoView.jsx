import React, { useState } from "react";
import { Radar, Activity, Users2, Sparkles, Plus, Trash2, RefreshCw, ChevronDown, ChevronRight, AlertTriangle, Check, ArrowRight } from "lucide-react";
import { getToken } from "./db";

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
const hoy = () => new Date().toISOString().slice(0, 10);
const nivelColor = (v) => v >= 80 ? "#7FB89B" : v >= 50 ? "#D8B673" : "#D08A8A";
const urlHref = (u) => (/^https?:\/\//i.test(u || "") ? u : "https://" + (u || ""));
const vered = (v) => (v === "seguir" ? C.ok : v === "observar" ? C.warn : C.danger);

// Panel de inteligencia de un competidor/candidato: señales de marketing, redes y perfil completo.
// Reutilizado por candidatos (antes de seguir) y por competidores seguidos.
function PanelInteligencia({ perfil, senales, adsLibrary }) {
  const redesList = Object.entries((senales && senales.redes) || {});
  return (
    <>
      {senales && !senales.error && (
        <div>
          <div style={{ color: C.aether500, fontFamily: MONO }} className="fs-9 uppercase mb-1">// Señales de marketing</div>
          <div className="flex flex-wrap gap-1.5 mb-1.5">
            {[["precios visibles", senales.tiene_precios], ["testimonios", senales.tiene_testimonios], ["formulario", senales.tiene_formulario], ["WhatsApp", senales.tiene_whatsapp], ["email mkt: " + (senales.email_marketing || "no detectado"), !!senales.email_marketing]].map(([k, v]) => (
              <span key={k} style={{ background: "rgba(255,255,255,0.05)", border: `1px solid ${C.line}`, color: v ? C.ok : C.ash, fontFamily: MONO }} className="px-1.5 py-0.5 rounded fs-9">{v ? "✓" : "✗"} {k}</span>
            ))}
          </div>
          {redesList.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-1.5">
              <span style={{ color: C.aether500, fontFamily: MONO }} className="fs-9 uppercase self-center">Redes:</span>
              {redesList.map(([red, href]) => (
                <a key={red} href={urlHref(href)} target="_blank" rel="noreferrer" style={{ background: C.aetherSoft, border: `1px solid ${C.aetherLine}`, color: C.aether2, fontFamily: MONO }} className="px-1.5 py-0.5 rounded fs-9 inline-flex items-center gap-1">{red} <ArrowRight size={9} /></a>
              ))}
            </div>
          )}
          {senales.h1 && senales.h1.length > 0 && <div style={{ color: C.mist }} className="fs-10">Su mensaje (h1): "{senales.h1[0]}"</div>}
          {(senales.ctas || []).length > 0 && <div style={{ color: C.ash }} className="fs-10">Sus CTAs: {senales.ctas.slice(0, 4).join(" · ")}</div>}
          {adsLibrary && <a href={adsLibrary} target="_blank" rel="noreferrer" style={{ color: C.aether2 }} className="fs-10 inline-flex items-center gap-1 mt-1">Ver sus anuncios en Meta Ads Library <ArrowRight size={10} /></a>}
        </div>
      )}
      {perfil && (
        <div style={{ borderTop: senales && !senales.error ? `1px solid ${C.line}` : "none" }} className="mt-2 pt-2">
          <div style={{ color: C.aether500, fontFamily: MONO }} className="fs-9 uppercase mb-1.5">// Perfil de inteligencia · score {perfil.score}/100 ({perfil.veredicto})</div>
          {perfil.razon && <div style={{ color: C.mist }} className="fs-10 mb-2 italic">{perfil.razon}</div>}
          <div className="grid sm:grid-cols-2 gap-x-4 gap-y-1 mb-2">
            {[["Nicho", perfil.nicho], ["Enfoque", perfil.enfoque], ["Oferta de valor", perfil.oferta_valor], ["Diferenciador", perfil.diferenciador], ["Mercado", perfil.tipo_mercado], ["Posicionamiento", perfil.posicionamiento], ["Ubicación", perfil.ubicacion], ["Área de operación", perfil.area_operacion]].filter(([, v]) => v).map(([k, v]) => (
              <div key={k} className="fs-10"><span style={{ color: C.aether500, fontFamily: MONO }} className="uppercase fs-9">{k}: </span><span style={{ color: C.mist }}>{v}</span></div>
            ))}
          </div>
          {perfil.copy && <div className="fs-10 mb-2"><span style={{ color: C.aether500, fontFamily: MONO }} className="uppercase fs-9">Su copy: </span><span style={{ color: C.mist }}>{perfil.copy}</span></div>}
          {(perfil.necesidades || []).length > 0 && (
            <div className="fs-10 mb-2"><span style={{ color: C.aether500, fontFamily: MONO }} className="uppercase fs-9">Problema / necesidades que ataca: </span><span style={{ color: C.mist }}>{perfil.necesidades.join(" · ")}</span></div>
          )}
          <div className="grid sm:grid-cols-2 gap-3">
            {(perfil.hace_bien || []).length > 0 && (
              <div style={{ background: "rgba(127,184,155,0.06)", border: `1px solid rgba(127,184,155,0.25)` }} className="rounded-lg p-2.5">
                <div style={{ color: C.ok, fontFamily: MONO }} className="fs-9 uppercase mb-1">✓ Fortalezas (inspírate)</div>
                {perfil.hace_bien.map((x, i) => <div key={i} style={{ color: C.mist }} className="fs-10 mb-0.5">· {x}</div>)}
              </div>
            )}
            {(perfil.por_mejorar || []).length > 0 && (
              <div style={{ background: "rgba(208,138,138,0.06)", border: `1px solid rgba(208,138,138,0.25)` }} className="rounded-lg p-2.5">
                <div style={{ color: C.danger, fontFamily: MONO }} className="fs-9 uppercase mb-1">✗ Falencias (aprovéchalo)</div>
                {perfil.por_mejorar.map((x, i) => <div key={i} style={{ color: C.mist }} className="fs-10 mb-0.5">· {x}</div>)}
              </div>
            )}
          </div>
          {(perfil.oportunidades || []).length > 0 && (
            <div style={{ background: C.aetherSoft, border: `1px solid ${C.aetherLine}` }} className="rounded-lg p-2.5 mt-2">
              <div style={{ color: C.aether2, fontFamily: MONO }} className="fs-9 uppercase mb-1">→ Movimientos para Siemon</div>
              {perfil.oportunidades.map((x, i) => <div key={i} style={{ color: C.cream }} className="fs-10 mb-0.5">· {x}</div>)}
            </div>
          )}
        </div>
      )}
    </>
  );
}

// Resumen de insights que alimenta a Viral, Blog/SEO y Ads.
export function insightsMercado(data) {
  const a = data.siemon.auditoriaNegocio;
  const partes = [];
  if (a && a.hallazgos_para_ads) {
    const h = a.hallazgos_para_ads;
    if (h.publico_dolor) partes.push("Publico y dolor dominante: " + h.publico_dolor);
    if ((h.angulos || []).length) partes.push("Angulos con respaldo: " + h.angulos.join("; "));
    if ((h.objeciones || []).length) partes.push("Objeciones a responder: " + h.objeciones.join("; "));
    if (h.competencia_mensaje) partes.push("Mensaje de la competencia: " + h.competencia_mensaje);
    (a.comparativa || []).forEach((c) => { if (c.hueco) partes.push("Hueco vs " + (c.competidor || "competidor") + ": " + c.hueco); });
  }
  // perfiles de competidores rastreados: lo que les falta y los movimientos sugeridos
  (data.siemon.competidores || []).filter((c) => c.perfil && (c.perfil.veredicto === "seguir" || c.perfil.veredicto === "observar")).slice(0, 4).forEach((c) => {
    const p = c.perfil;
    const debil = (p.por_mejorar || []).slice(0, 2).join("; ");
    if (debil) partes.push(`A ${c.nombre} (${p.posicionamiento || p.nicho || "competidor"}) le falta: ${debil}`);
    const mov = (p.oportunidades || []).slice(0, 2).join("; ");
    if (mov) partes.push(`Movimiento vs ${c.nombre}: ${mov}`);
  });
  return partes.join("\n");
}

export default function MercadoView({ data, commit, flash }) {
  const [tab, setTab] = useState("salud");
  const salud = data.siemon.saludWeb || null;              // último chequeo
  const histSalud = data.siemon.saludHistorial || [];      // [{fecha, global, tiempo}]
  const competidores = data.siemon.competidores || [];     // [{id, nombre, url, seo, fecha, senales}]
  const audit = data.siemon.auditoriaNegocio || null;
  const [busy, setBusy] = useState("");
  const [nvComp, setNvComp] = useState("");
  const [sectorDesc, setSectorDesc] = useState("agencia de automatización e IA para negocios");
  const candidatos = data.siemon.candidatosMercado || [];   // persisten en el CRM
  function setCandidatosP(lista) { commit({ ...data, siemon: { ...data.siemon, candidatosMercado: lista } }); }
  const [abierto, setAbierto] = useState("");
  const [comp1, setComp1] = useState("");
  const [selComps, setSelComps] = useState([]);   // urls de competidores rastreados elegidos para la auditoría
  const [verInc, setVerInc] = useState(false);
  const [ana, setAna] = useState(null);           // resumen de Umami
  const [anaDias, setAnaDias] = useState(7);
  async function cargarAnalitica(dias) {
    setBusy("ana");
    try {
      const r = await fetch(`${MOTOR}/analitica/resumen?dias=${dias || anaDias}`, { headers: H() });
      const d = await r.json();
      setAna(d);
      if (!d.ok) flash(d.error === "umami_sin_configurar" ? "Analítica aún no configurada en el motor." : "No pude leer la analítica: " + (d.error || ""));
    } catch { flash("No pude conectar con el motor."); }
    finally { setBusy(""); }
  }

  // ---- salud de la web ----
  async function chequearSalud() {
    setBusy("salud"); flash("Chequeando tu web… 20 a 40 segundos.");
    try {
      const r = await fetch(MOTOR + "/seo/auditar", { method: "POST", headers: H(), body: JSON.stringify({ url: "https://siemondigital.com/" }) });
      const d = await r.json();
      if (!d.ok) return flash("No pude chequear: " + (d.error || ""));
      const tecnico = (d.categorias || []).find((c) => c.nombre === "Tecnico");
      const snap = { fecha: hoy(), global: d.global, tecnico: tecnico ? tecnico.puntos : null };
      commit({ ...data, siemon: { ...data.siemon, saludWeb: { ...d, fecha: hoy() }, saludHistorial: [...histSalud.filter((x) => x.fecha !== hoy()), snap].slice(-30) } });
      flash(`Salud de la web: ${d.global}/100.`);
    } catch { flash("No pude conectar con el motor."); }
    finally { setBusy(""); }
  }

  // soluciones IA de la auditoría (persisten junto a la salud)
  const sols = (data.siemon.saludWeb && data.siemon.saludWeb.soluciones) || null;
  const [seoKw, setSeoKw] = useState("");
  async function generarSoluciones() {
    setBusy("sol"); flash("Generando las soluciones de cada hallazgo con tus keywords… ~40 segundos.");
    try {
      const kws = (data.siemon.blogKeywordsCuradas || []).map((c) => c.keyword).filter(Boolean).slice(0, 8);
      const r = await fetch(MOTOR + "/seo/soluciones", { method: "POST", headers: H(), body: JSON.stringify({ url: "https://siemondigital.com/", keyword: seoKw.trim(), keywords: kws }) });
      const d = await r.json();
      if (!d.ok) return flash("No pude generar soluciones: " + (d.error || ""));
      commit({ ...data, siemon: { ...data.siemon, saludWeb: { ...(data.siemon.saludWeb || {}), soluciones: { ...d.soluciones, fecha: d.fecha } } } });
      flash("Soluciones listas: title, description, alts y jerarquía propuestos.");
    } catch { flash("No pude conectar con el motor."); }
    finally { setBusy(""); }
  }

  // ---- competidores ----
  // lápidas: marca los borrados a propósito para que el merge del servidor no los resucite,
  // y al re-agregar una URL le quita la lápida
  function sinLapida(url) {
    const b = data.siemon.borrados || {};
    return {
      borrados: { ...b, competidores: (b.competidores || []).filter((x) => x !== url) },
      revivir: { competidores: [url] },   // señal explícita: el servidor levanta la lápida solo con esto
    };
  }
  function agregarComp() {
    const u = nvComp.trim();
    if (!u.startsWith("http")) return flash("Pega la URL completa (https://…).");
    if (competidores.some((c) => c.url === u)) return flash("Ese competidor ya está.");
    const item = { id: uid(), url: u, nombre: u.replace(/https?:\/\/(www\.)?/, "").split("/")[0], seo: null, fecha: "", senales: null, historial: [] };
    commit({ ...data, siemon: { ...data.siemon, competidores: [...competidores, item], ...sinLapida(u) } });
    setNvComp(""); flash("Competidor agregado. Dale \"Rastrear\" para analizarlo.");
  }
  async function descubrir() {
    setBusy("desc"); flash("Buscando competidores y precalificándolos (1 llamada de IA barata)…");
    try {
      const r = await fetch(MOTOR + "/mercado/descubrir", { method: "POST", headers: H(), body: JSON.stringify({ sector: sectorDesc }) });
      const d = await r.json();
      if (!d.ok) return flash("No pude descubrir: " + (d.error || ""));
      const ya = new Set(competidores.map((c) => c.url));
      let nuevos = (d.candidatos || []).filter((c) => !ya.has(c.url));
      // precalificacion en lote: nicho aparente, tipo, tamano y score para decidir a quien seguir
      try {
        const r2 = await fetch(MOTOR + "/mercado/precalificar", { method: "POST", headers: H(), body: JSON.stringify({ candidatos: nuevos }) });
        const d2 = await r2.json();
        if (d2.ok) nuevos = d2.candidatos;
      } catch {}
      setCandidatosP(nuevos);
      flash(`${nuevos.length} candidatos precalificados y guardados. Sigue solo los relevantes.`);
    } catch { flash("No pude conectar con el motor."); }
    finally { setBusy(""); }
  }
  function agregarCandidato(c) {
    // si ya lo analizaste, arrastramos el perfil/SEO para no volver a gastar en Rastrear
    const item = { id: uid(), url: c.url, nombre: c.nombre, seo: c.seoGlobal != null ? c.seoGlobal : null,
      fecha: c.analizado ? hoy() : "", senales: c.senales || null, perfil: c.perfil || null,
      categorias: c.categorias || null, topFixes: c.topFixes || null, adsLibrary: c.adsLibrary || "",
      historial: c.seoGlobal != null ? [{ fecha: hoy(), seo: c.seoGlobal }] : [],
      precalificacion: { tipo: c.tipo, nicho: c.nicho, tamano: c.tamano, scorePrevio: c.scorePrevio, razon: c.razon } };
    commit({ ...data, siemon: { ...data.siemon, competidores: [...competidores, item], candidatosMercado: candidatos.filter((x) => x.url !== c.url), ...sinLapida(c.url) } });
    flash(c.nombre + " agregado a tu competencia." + (c.perfil ? "" : " Dale \"Rastrear\" para el perfil completo."));
  }
  // Analiza a fondo un CANDIDATO antes de seguirlo (mismo motor que Rastrear): perfil + señales + redes.
  async function analizarCandidato(c) {
    setBusy("cand:" + c.url);
    try {
      const r = await fetch(MOTOR + "/mercado/rastrear", { method: "POST", headers: H(), body: JSON.stringify({ url: urlHref(c.url) }) });
      const d = await r.json();
      if (!d.ok) return flash("No pude analizar: " + (d.error || ""));
      const perfil = d.perfil && !d.perfil.error ? d.perfil : null;
      const seo = d.seo || {};
      const upd = candidatos.map((x) => x.url === c.url ? { ...x, perfil, senales: d.senales || null,
        seoGlobal: seo.global != null ? seo.global : null,
        categorias: (seo.categorias || []).map((y) => ({ nombre: y.nombre, puntos: y.puntos })),
        topFixes: seo.top_fixes || [], adsLibrary: d.ads_library || "", analizado: true } : x);
      setCandidatosP(upd);
      setAbierto(c.url);
      flash(perfil ? `${c.nombre}: score competidor ${perfil.score}/100 (${perfil.veredicto})` : `${c.nombre}: señales capturadas.`);
    } catch (e) {
      flash("Error al analizar el candidato.");
    } finally {
      setBusy("");
    }
  }
  function descartarCandidato(c) { setCandidatosP(candidatos.filter((x) => x.url !== c.url)); }
  function quitarComp(id) {
    const comp = competidores.find((c) => c.id === id);
    const b = data.siemon.borrados || {};
    commit({ ...data, siemon: { ...data.siemon,
      competidores: competidores.filter((c) => c.id !== id),
      borrados: { ...b, competidores: [...(b.competidores || []), comp && comp.url].filter(Boolean).slice(-300) },
    } });
    flash("Competidor eliminado.");
  }
  async function rastrear(c) {
    setBusy(c.id); flash("Rastreando " + c.nombre + "… ~30 segundos.");
    try {
      const r = await fetch(MOTOR + "/mercado/rastrear", { method: "POST", headers: H(), body: JSON.stringify({ url: c.url }) });
      const d = await r.json();
      if (!d.ok) return flash("No pude rastrear: " + (d.error || ""));
      const seo = d.seo || {};
      const snap = { fecha: hoy(), seo: seo.global };
      const perfil = d.perfil && !d.perfil.error ? d.perfil : null;
      const nuevo = { ...c, seo: seo.global, fecha: hoy(), categorias: (seo.categorias || []).map((x) => ({ nombre: x.nombre, puntos: x.puntos })), topFixes: seo.top_fixes || [], senales: d.senales || null, perfil, adsLibrary: d.ads_library || "", historial: [...(c.historial || []).filter((x) => x.fecha !== hoy()), snap].slice(-30) };
      commit({ ...data, siemon: { ...data.siemon, competidores: competidores.map((x) => x.id === c.id ? nuevo : x) } });
      flash(`${c.nombre}: SEO ${seo.global}/100` + (perfil ? ` · score competidor ${perfil.score}/100 (${perfil.veredicto})` : " · señales capturadas."));
    } catch { flash("No pude conectar con el motor."); }
    finally { setBusy(""); }
  }

  // ---- auditoría de negocio (análisis profundo con IA) ----
  async function auditarNegocio() {
    const elegidos = [...selComps, ...(comp1.trim() ? [comp1.trim()] : [])].slice(0, 3);
    setBusy("negocio"); flash("Auditoría profunda de tu web" + (elegidos.length ? ` vs ${elegidos.length} competidor(es)` : "") + "… ~1 minuto.");
    try {
      const r = await fetch(MOTOR + "/auditoria/negocio", { method: "POST", headers: H(), body: JSON.stringify({ web: "https://siemondigital.com/", competidores: elegidos }) });
      const d = await r.json();
      if (!d.ok) return flash("No pude auditar: " + (d.error || ""));
      // guarda la auditoría Y el punto de progreso (para medir la mejora en el tiempo)
      const punto = { fecha: hoy(), global: d.auditoria.global, puntuaciones: d.auditoria.puntuaciones || {} };
      const hist = [...(data.siemon.auditoriasHistorial || []).filter((x) => x.fecha !== hoy()), punto].slice(-24);
      commit({ ...data, siemon: { ...data.siemon, auditoriaNegocio: { ...d.auditoria, fecha: hoy(), competidores: elegidos }, auditoriasHistorial: hist } });
      flash(`Auditoría lista: ${d.auditoria.global}/100. Sus hallazgos ya alimentan Viral, Blog y Ads.`);
    } catch { flash("No pude conectar con el motor."); }
    finally { setBusy(""); }
  }

  const seoPropio = salud ? salud.global : null;
  const insights = insightsMercado(data);

  const TABS = [
    { id: "salud", label: "Salud de tu web", icon: Activity },
    { id: "competencia", label: `Competencia (${competidores.length})`, icon: Users2 },
    { id: "insights", label: "Análisis e insights", icon: Sparkles },
  ];

  return (
    <div className="p-5 md:p-8" style={{ maxWidth: 1100 }}>
      <div className="mb-4">
        <div style={{ color: C.aether500, fontFamily: MONO, letterSpacing: "0.2em" }} className="fs-10 uppercase mb-2"><span style={{ color: C.aether }}>// </span>Inteligencia de mercado</div>
        <h1 style={{ fontWeight: 600, color: C.cream }} className="fs-24 flex items-center gap-2"><Radar size={20} color={C.aether} /> Estudio de mercado</h1>
        <div style={{ color: C.ash }} className="fs-11 mt-1">La salud de tu web, el rastreo de tu competencia y el análisis profundo del mercado. Lo que se descubre aquí alimenta automáticamente al contenido Viral, al Blog/SEO y al plan de Ads.</div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {TABS.map((t) => { const on = tab === t.id; const Ico = t.icon; return (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ background: on ? C.aetherSoft : C.panel, border: `1px solid ${on ? C.aetherLine : C.line}`, color: on ? C.aether2 : C.mist }} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg fs-12"><Ico size={13} /> {t.label}</button>
        ); })}
      </div>

      {/* SALUD */}
      {tab === "salud" && (
        <div>
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <button onClick={chequearSalud} disabled={!!busy} style={{ background: C.aether, color: C.obsidian, fontWeight: 600, opacity: busy ? 0.6 : 1 }} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg fs-13"><Activity size={14} /> {busy === "salud" ? "Chequeando…" : "Chequear salud ahora"}</button>
            {salud && <span style={{ color: C.ash }} className="fs-11">Último chequeo: {salud.fecha}</span>}
          </div>
          {!salud ? (
            <div style={{ background: C.panel, border: `1px solid ${C.line}`, color: C.ash }} className="rounded-xl p-6 fs-12 text-center">Chequea la salud de siemondigital.com: puntuación SEO, técnico (velocidad, HTTPS, sitemap), contenido y correcciones priorizadas. Cada chequeo se guarda para ver la evolución.</div>
          ) : (
            <div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                <div style={{ background: C.panel, border: `1px solid ${C.line}` }} className="rounded-xl p-4">
                  <div style={{ color: nivelColor(salud.global), fontWeight: 700, fontFamily: MONO }} className="fs-28">{salud.global}<span className="fs-13">/100</span></div>
                  <div style={{ color: C.ash }} className="fs-10 mt-1">Salud global (SEO + técnico)</div>
                </div>
                {[["Errores", salud.resumen?.errores, C.danger], ["Advertencias", salud.resumen?.advertencias, C.warn], ["Aprobados", salud.resumen?.aprobados, C.ok]].map(([k, v, col]) => (
                  <div key={k} style={{ background: C.panel, border: `1px solid ${C.line}` }} className="rounded-xl p-4"><div style={{ color: col, fontWeight: 700, fontFamily: MONO }} className="fs-24">{v}</div><div style={{ color: C.ash }} className="fs-10 mt-1">{k}</div></div>
                ))}
              </div>
              {histSalud.length > 1 && (
                <div style={{ background: C.panel, border: `1px solid ${C.line}` }} className="rounded-xl p-4 mb-4">
                  <div style={{ color: C.aether500, fontFamily: MONO }} className="fs-10 uppercase mb-2">// Evolución</div>
                  <div className="flex items-end gap-1.5" style={{ height: 70 }}>
                    {histSalud.slice(-14).map((s) => (
                      <div key={s.fecha} title={s.fecha + ": " + s.global} className="flex-1 flex flex-col items-center gap-1">
                        <div style={{ height: `${Math.max(4, s.global * 0.6)}px`, width: "100%", background: nivelColor(s.global) + "38", border: `1px solid ${nivelColor(s.global)}`, boxSizing: "border-box", borderRadius: 3 }} />
                        <span style={{ color: C.ash, fontFamily: MONO }} className="fs-8">{s.fecha.slice(5)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex flex-col gap-2">
                {(salud.categorias || []).map((c) => (
                  <div key={c.nombre} className="flex items-center gap-3">
                    <span style={{ color: C.mist, width: 200 }} className="fs-11 shrink-0">{c.nombre}</span>
                    <div className="flex-1" style={{ background: "rgba(255,255,255,0.05)", borderRadius: 4, height: 10 }}><div style={{ width: `${c.puntos}%`, background: nivelColor(c.puntos) + "38", border: `1px solid ${nivelColor(c.puntos)}`, boxSizing: "border-box", height: "100%", borderRadius: 4 }} /></div>
                    <span style={{ color: nivelColor(c.puntos), fontFamily: MONO, width: 36 }} className="fs-11 text-right">{c.puntos}</span>
                  </div>
                ))}
              </div>
              {(salud.top_fixes || []).length > 0 && (
                <div style={{ background: "rgba(216,182,115,0.08)", border: `1px solid rgba(216,182,115,0.3)` }} className="rounded-xl p-4 mt-4">
                  <div style={{ color: C.warn, fontFamily: MONO }} className="fs-9 uppercase mb-2">// Correcciones prioritarias</div>
                  {(salud.top_fixes || []).map((f, i) => (
                    <div key={i} className="flex items-start gap-2 mb-2"><AlertTriangle size={12} color={f.nivel === "error" ? C.danger : C.warn} className="mt-0.5 shrink-0" /><div className="min-w-0">
                      <span style={{ color: C.cream }} className="fs-11">{f.txt}</span>
                      <div style={{ color: C.ash }} className="fs-10">→ {f.fix}</div>
                      {(f.evidencia || []).map((ev, j) => (
                        <div key={j} style={{ color: C.mist, fontFamily: MONO, wordBreak: "break-all" }} className="fs-9 mt-0.5 pl-2" >· {ev}</div>
                      ))}
                    </div></div>
                  ))}
                  <div className="mt-2">
                    <label style={{ color: C.ash, fontFamily: MONO }} className="fs-9 uppercase">Keyword objetivo de la home (opcional)</label>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <input value={seoKw} onChange={(e) => setSeoKw(e.target.value)} placeholder="ej. automatización con IA para pymes" style={{ background: C.carbon, border: `1px solid ${C.line}`, color: C.cream, borderRadius: 8, padding: "6px 10px", fontSize: 12, outline: "none", minWidth: 260 }} />
                      <button onClick={generarSoluciones} disabled={!!busy} style={{ background: C.aether, color: C.obsidian, fontWeight: 600, opacity: busy ? 0.6 : 1 }} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg fs-11"><Sparkles size={12} /> {busy === "sol" ? "Generando…" : "Generar soluciones con IA"}</button>
                    </div>
                    {(data.siemon.blogKeywordsCuradas || []).length > 0 && (
                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        <span style={{ color: C.ash }} className="fs-9">tus keywords:</span>
                        {(data.siemon.blogKeywordsCuradas || []).slice(0, 6).map((c) => (
                          <button key={c.keyword} onClick={() => setSeoKw(c.keyword)} style={{ background: seoKw === c.keyword ? C.aetherSoft : "transparent", border: `1px solid ${seoKw === c.keyword ? C.aetherLine : C.line}`, color: seoKw === c.keyword ? C.aether2 : C.ash }} className="px-2 py-0.5 rounded fs-9">{c.keyword}</button>
                        ))}
                      </div>
                    )}
                    <div style={{ color: C.ash }} className="fs-10 mt-1.5">Toma tus keywords curadas (Blog y SEO) y las teje en title, description, H1 y la intro de la home. El detalle por categoría está en Blog y SEO → Auditoría SEO.</div>
                  </div>
                </div>
              )}
              {sols && (
                <div style={{ background: C.panel, border: `1px solid ${C.aetherLine}` }} className="rounded-xl p-4 mt-3">
                  <div style={{ color: C.aether500, fontFamily: MONO }} className="fs-9 uppercase mb-2">// Soluciones listas para aplicar {sols.fecha ? `· ${sols.fecha}` : ""}</div>
                  {sols.title_propuesto && (
                    <div className="mb-2"><div style={{ color: C.aether2, fontFamily: MONO }} className="fs-9 uppercase">Title propuesto ({sols.title_propuesto.length} chars)</div>
                      <div style={{ color: C.cream, background: C.carbon, border: `1px solid ${C.line}` }} className="fs-11 rounded-lg px-2.5 py-1.5 mt-0.5">{sols.title_propuesto}</div></div>
                  )}
                  {sols.description_propuesta && (
                    <div className="mb-2"><div style={{ color: C.aether2, fontFamily: MONO }} className="fs-9 uppercase">Description propuesta ({sols.description_propuesta.length} chars)</div>
                      <div style={{ color: C.cream, background: C.carbon, border: `1px solid ${C.line}` }} className="fs-11 rounded-lg px-2.5 py-1.5 mt-0.5">{sols.description_propuesta}</div></div>
                  )}
                  {sols.keywords && (sols.keywords.h1_sugerido || sols.keywords.objetivo) && (
                    <div className="mb-2" style={{ background: "rgba(177,163,225,0.06)", border: `1px solid ${C.aetherLine}`, borderRadius: 10, padding: 10 }}>
                      <div style={{ color: C.aether2, fontFamily: MONO }} className="fs-9 uppercase mb-1">🔑 Keywords en la home{sols.keywords.objetivo ? ` · "${sols.keywords.objetivo}"` : ""}</div>
                      {sols.keywords.h1_sugerido && <div className="fs-11 mb-1"><span style={{ color: C.ash }}>H1: </span><span style={{ color: C.cream }}>{sols.keywords.h1_sugerido}</span></div>}
                      {sols.keywords.intro_sugerida && <div className="fs-11 mb-1"><span style={{ color: C.ash }}>Intro: </span><span style={{ color: C.cream }}>{sols.keywords.intro_sugerida}</span></div>}
                      {(sols.keywords.donde_reforzar || []).length > 0 && <div className="fs-10" style={{ color: C.mist }}><span style={{ color: C.ash }}>Reforzar en: </span>{sols.keywords.donde_reforzar.join(" · ")}</div>}
                    </div>
                  )}
                  {(sols.alts || []).length > 0 && (
                    <div className="mb-2"><div style={{ color: C.aether2, fontFamily: MONO }} className="fs-9 uppercase mb-1">Alt sugerido por imagen</div>
                      {sols.alts.map((a, i) => (
                        <div key={i} className="fs-10 mb-1"><span style={{ color: C.mist, fontFamily: MONO, wordBreak: "break-all" }}>{a.imagen}</span><div style={{ color: C.cream }} className="pl-2">alt="{a.alt}"</div></div>
                      ))}</div>
                  )}
                  {(sols.jerarquia || []).length > 0 && (
                    <div className="mb-2"><div style={{ color: C.aether2, fontFamily: MONO }} className="fs-9 uppercase mb-1">Arreglo de jerarquía de encabezados</div>
                      {sols.jerarquia.map((x, i) => <div key={i} style={{ color: C.cream }} className="fs-10 mb-0.5">· {x}</div>)}</div>
                  )}
                  {(sols.enlaces || []).length > 0 && (
                    <div className="mb-2"><div style={{ color: C.aether2, fontFamily: MONO }} className="fs-9 uppercase mb-1">Enlaces rotos</div>
                      {sols.enlaces.map((x, i) => (
                        <div key={i} className="fs-10 mb-1"><span style={{ color: C.mist, fontFamily: MONO, wordBreak: "break-all" }}>{x.enlace}</span><div style={{ color: C.cream }} className="pl-2">{x.solucion}</div></div>
                      ))}</div>
                  )}
                  {(sols.otras || []).length > 0 && (
                    <div><div style={{ color: C.aether2, fontFamily: MONO }} className="fs-9 uppercase mb-1">Otras mejoras</div>
                      {sols.otras.map((x, i) => <div key={i} style={{ color: C.cream }} className="fs-10 mb-0.5">· {x}</div>)}</div>
                  )}
                  <div style={{ color: C.ash }} className="fs-10 mt-2">Estos cambios se aplican en el código de la web (pídeselos a tu desarrollador o a Claude en el próximo deploy).</div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* COMPETENCIA */}
      {tab === "competencia" && (
        <div>
          <div style={{ background: C.panel, border: `1px solid ${C.aetherLine}` }} className="rounded-xl p-4 mb-3">
            <div style={{ color: C.aether500, fontFamily: MONO, letterSpacing: "0.14em" }} className="fs-10 uppercase mb-2">// Descubrir competencia (con la maquinaria de prospección)</div>
            <div className="flex items-center gap-2 flex-wrap">
              <input style={{ ...inS, maxWidth: 380 }} value={sectorDesc} onChange={(e) => setSectorDesc(e.target.value)} placeholder="Tu sector, ej. agencia de automatización e IA" />
              <button onClick={descubrir} disabled={!!busy} style={{ background: C.aether, color: C.obsidian, fontWeight: 600, opacity: busy ? 0.6 : 1 }} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg fs-12"><Radar size={13} /> {busy === "desc" ? "Buscando…" : "Descubrir competidores"}</button>
            </div>
            {candidatos.length > 0 && (
              <div className="flex flex-col gap-1.5 mt-3">
                <div style={{ color: C.ash }} className="fs-10">Candidatos guardados (no se pierden al refrescar). Dale <b style={{ color: C.aether2 }}>"Analizar"</b> para ver su perfil completo (nicho, oferta, fortalezas, falencias, redes…) y así decidir a cuáles 3 seguir. El puntaje pequeño es solo una precalificación; el grande sale al analizar.</div>
                {candidatos.map((c) => (
                  <div key={c.url} style={{ background: C.carbon, border: `1px solid ${C.line}` }} className="rounded-lg px-3 py-2.5">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          {c.perfil && <button onClick={() => setAbierto(abierto === c.url ? "" : c.url)} style={{ color: C.ash }}>{abierto === c.url ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</button>}
                          <a href={urlHref(c.url)} target="_blank" rel="noreferrer" style={{ color: C.cream }} className="fs-12 hover:underline">{c.nombre}</a>
                          {c.tipo && <span style={{ background: c.tipo === "agencia" || c.tipo === "consultora" ? C.aetherSoft : "rgba(255,255,255,0.05)", border: `1px solid ${c.tipo === "agencia" || c.tipo === "consultora" ? C.aetherLine : C.line}`, color: c.tipo === "agencia" || c.tipo === "consultora" ? C.aether2 : C.ash, fontFamily: MONO }} className="px-1.5 py-0.5 rounded fs-9">{c.tipo}{c.tamano ? ` · ${c.tamano}` : ""}</span>}
                        </div>
                        {c.nicho && <div style={{ color: C.mist }} className="fs-10 mt-0.5">{c.nicho}</div>}
                        {c.razon && <div style={{ color: C.ash }} className="fs-10 italic">{c.razon}</div>}
                        {!c.nicho && <div style={{ color: C.ash }} className="fs-10 truncate">{c.titulo} · {c.snippet}</div>}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {c.perfil ? (
                          <span title={"Score como competidor directo · " + c.perfil.veredicto} style={{ color: vered(c.perfil.veredicto), fontFamily: MONO, fontWeight: 700 }} className="fs-16">{c.perfil.score}</span>
                        ) : (c.scorePrevio != null && <span title="Precalificación (aún sin analizar)" style={{ color: nivelColor(c.scorePrevio), fontFamily: MONO, fontWeight: 700, opacity: 0.7 }} className="fs-13">{c.scorePrevio}</span>)}
                        <button onClick={() => analizarCandidato(c)} disabled={!!busy} title="Analiza su web a fondo antes de decidir (usa un poco de crédito de IA)" style={{ color: C.aether2, border: `1px solid ${C.aetherLine}`, opacity: busy ? 0.6 : 1 }} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg fs-11"><Sparkles size={11} className={busy === "cand:" + c.url ? "animate-spin" : ""} /> {busy === "cand:" + c.url ? "Analizando…" : (c.perfil ? "Re-analizar" : "Analizar")}</button>
                        <button onClick={() => agregarCandidato(c)} title="Añádelo a tu competencia a seguir" style={{ color: C.aether2, border: `1px solid ${C.aetherLine}` }} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg fs-11"><Plus size={11} /> Seguir</button>
                        <button onClick={() => descartarCandidato(c)} title="Descartar" style={{ color: C.ash }}><Trash2 size={12} /></button>
                      </div>
                    </div>
                    {c.perfil && abierto === c.url && (
                      <div style={{ background: C.obsidian, border: `1px solid ${C.line}` }} className="rounded-lg p-3 mt-2.5">
                        <PanelInteligencia perfil={c.perfil} senales={c.senales} adsLibrary={c.adsLibrary} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div style={{ background: C.panel, border: `1px solid ${C.line}` }} className="rounded-xl p-4 mb-4">
            <div className="flex items-center gap-2 flex-wrap">
              <input style={{ ...inS, maxWidth: 380 }} value={nvComp} onChange={(e) => setNvComp(e.target.value)} placeholder="…o agrega uno a mano: https://competidor.com" />
              <button onClick={agregarComp} style={{ background: C.aether, color: C.obsidian, fontWeight: 600 }} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg fs-12"><Plus size={13} /> Agregar competidor</button>
              {seoPropio != null && <span style={{ color: C.ash }} className="fs-10">Tu web: <b style={{ color: nivelColor(seoPropio), fontFamily: MONO }}>{seoPropio}</b>/100 (referencia)</span>}
              <span style={{ color: C.ash }} className="fs-10">· El monitoreo corre solo cada lunes 8am (y puedes forzarlo re-rastreando).</span>
            </div>
          </div>
          {competidores.length === 0 ? (
            <div style={{ background: C.panel, border: `1px solid ${C.line}`, color: C.ash }} className="rounded-xl p-6 fs-12 text-center">Agrega las webs de tu competencia. Cada "Rastrear" guarda un snapshot (SEO, técnico, correcciones) para comparar contigo y ver su evolución en el tiempo.</div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {competidores.map((c) => {
                const open = abierto === c.id;
                return (
                  <div key={c.id} style={{ background: C.panel, border: `1px solid ${C.line}` }} className="rounded-xl p-3.5">
                    <div className="flex items-center gap-3 flex-wrap">
                      <button onClick={() => setAbierto(open ? "" : c.id)} style={{ color: C.ash }}>{open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}</button>
                      <div className="min-w-0 flex-1">
                        <div style={{ color: C.cream, fontWeight: 600 }} className="fs-13">{c.nombre}</div>
                        <a href={c.url} target="_blank" rel="noreferrer" style={{ color: C.ash, fontFamily: MONO }} className="fs-10 hover:underline">{c.url}</a>
                      </div>
                      {c.perfil && (
                        <div className="text-right shrink-0" title={c.perfil.razon || ""}>
                          <span style={{ color: c.perfil.veredicto === "seguir" ? C.ok : c.perfil.veredicto === "observar" ? C.warn : C.danger, fontWeight: 700, fontFamily: MONO }} className="fs-18">{c.perfil.score}</span>
                          <span style={{ color: C.ash, fontFamily: MONO }} className="fs-10">/100</span>
                          <div style={{ color: c.perfil.veredicto === "seguir" ? C.ok : c.perfil.veredicto === "observar" ? C.warn : C.danger, fontFamily: MONO }} className="fs-9 uppercase">{c.perfil.veredicto}</div>
                        </div>
                      )}
                      {c.seo != null && (
                        <div className="text-right shrink-0">
                          <span style={{ color: nivelColor(c.seo), fontWeight: 700, fontFamily: MONO }} className="fs-18">{c.seo}</span>
                          <span style={{ color: C.ash, fontFamily: MONO }} className="fs-10">/100 · {c.fecha}</span>
                          {seoPropio != null && <div style={{ color: c.seo > seoPropio ? C.danger : C.ok, fontFamily: MONO }} className="fs-9">{c.seo > seoPropio ? `te gana por ${c.seo - seoPropio}` : c.seo < seoPropio ? `le ganas por ${seoPropio - c.seo}` : "empate"}</div>}
                        </div>
                      )}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button onClick={() => rastrear(c)} disabled={!!busy} style={{ background: c.seo == null ? C.aether : "transparent", color: c.seo == null ? C.obsidian : C.aether2, border: `1px solid ${C.aetherLine}`, fontWeight: 600, opacity: busy ? 0.6 : 1 }} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg fs-11"><RefreshCw size={12} className={busy === c.id ? "animate-spin" : ""} /> {busy === c.id ? "Rastreando…" : "Rastrear"}</button>
                        <button onClick={() => quitarComp(c.id)} style={{ color: C.ash }}><Trash2 size={13} /></button>
                      </div>
                    </div>
                    {open && c.categorias && (
                      <div style={{ background: C.carbon, border: `1px solid ${C.line}` }} className="rounded-lg p-3 mt-3 ml-8">
                        <div className="flex flex-col gap-1.5 mb-2">
                          {c.categorias.map((x) => (
                            <div key={x.nombre} className="flex items-center gap-2">
                              <span style={{ color: C.mist, width: 180 }} className="fs-10 shrink-0">{x.nombre}</span>
                              <div className="flex-1" style={{ background: "rgba(255,255,255,0.05)", borderRadius: 3, height: 7 }}><div style={{ width: `${x.puntos}%`, background: nivelColor(x.puntos) + "38", border: `1px solid ${nivelColor(x.puntos)}`, boxSizing: "border-box", height: "100%", borderRadius: 3 }} /></div>
                              <span style={{ color: nivelColor(x.puntos), fontFamily: MONO, width: 30 }} className="fs-10 text-right">{x.puntos}</span>
                            </div>
                          ))}
                        </div>
                        {(c.historial || []).length > 1 && <div style={{ color: C.ash, fontFamily: MONO }} className="fs-9">Evolución: {c.historial.map((s) => `${s.fecha.slice(5)}:${s.seo}`).join(" → ")}</div>}
                        {(c.topFixes || []).length > 0 && <div style={{ color: C.ash }} className="fs-10 mt-1.5">Sus debilidades: {c.topFixes.slice(0, 3).map((f) => f.txt).join(" · ")}</div>}
                        {(c.senales || c.perfil) && (
                          <div style={{ borderTop: `1px solid ${C.line}` }} className="mt-2 pt-2">
                            <PanelInteligencia perfil={c.perfil} senales={c.senales} adsLibrary={c.adsLibrary} />
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
      )}

      {/* INSIGHTS */}
      {tab === "insights" && (
        <div>
          <div style={{ background: C.panel, border: `1px solid ${C.line}` }} className="rounded-xl p-4 mb-4">
            {competidores.length > 0 && (
              <div className="mb-3">
                <div style={{ color: C.aether500, fontFamily: MONO, letterSpacing: "0.14em" }} className="fs-9 uppercase mb-1.5">// Compararme con (elige de tu competencia, máx 3)</div>
                <div className="flex flex-wrap gap-1.5">
                  {competidores.map((c) => {
                    const on = selComps.includes(c.url);
                    return (
                      <button key={c.url} onClick={() => setSelComps(on ? selComps.filter((u) => u !== c.url) : [...selComps, c.url].slice(-3))}
                        style={{ background: on ? C.aetherSoft : "rgba(255,255,255,0.04)", border: `1px solid ${on ? C.aether : C.line}`, color: on ? C.aether2 : C.mist }}
                        className="px-2.5 py-1 rounded-lg fs-11 inline-flex items-center gap-1.5">
                        {on ? "✓ " : ""}{c.nombre}
                        {c.perfil && <span style={{ color: c.perfil.veredicto === "seguir" ? C.ok : c.perfil.veredicto === "observar" ? C.warn : C.danger, fontFamily: MONO }} className="fs-9">{c.perfil.score}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <div className="flex items-center gap-2 flex-wrap">
              <input style={{ ...inS, maxWidth: 340 }} value={comp1} onChange={(e) => setComp1(e.target.value)} placeholder="Competidor extra por URL (opcional)" />
              <button onClick={auditarNegocio} disabled={!!busy} style={{ background: audit ? "transparent" : C.aether, color: audit ? C.aether2 : C.obsidian, border: `1px solid ${C.aetherLine}`, fontWeight: 600, opacity: busy ? 0.6 : 1 }} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg fs-12"><Sparkles size={13} /> {busy === "negocio" ? "Analizando…" : audit ? "Re-analizar mercado" : "Analizar mi negocio y el mercado"}</button>
              {audit && <span style={{ color: C.ok, fontFamily: MONO }} className="fs-10">✓ {audit.global}/100 · {audit.fecha}</span>}
            </div>
            <div style={{ color: C.ash }} className="fs-10 mt-2">Análisis profundo con IA sobre señales reales: propuesta de valor, copy, oferta, captación, prueba social, incoherencias y comparativa. Los resultados quedan guardados y cada análisis suma un punto a tu historial de progreso.</div>
          </div>

          {(data.siemon.auditoriasHistorial || []).length > 1 && (
            <div style={{ background: C.panel, border: `1px solid ${C.line}` }} className="rounded-xl p-4 mb-3">
              <div style={{ color: C.aether500, fontFamily: MONO, letterSpacing: "0.14em" }} className="fs-9 uppercase mb-2">// Tu progreso ({data.siemon.auditoriasHistorial.length} análisis)</div>
              <div className="flex items-end gap-1.5" style={{ height: 64 }}>
                {data.siemon.auditoriasHistorial.map((p, i) => (
                  <div key={i} title={`${p.fecha}: ${p.global}/100`} className="flex flex-col items-center gap-1" style={{ flex: 1, maxWidth: 44 }}>
                    <span style={{ color: nivelColor(p.global), fontFamily: MONO }} className="fs-9">{p.global}</span>
                    <div style={{ width: "100%", height: Math.max(6, Math.round(p.global * 0.44)), background: nivelColor(p.global) + "38", border: `1px solid ${nivelColor(p.global)}`, borderRadius: 4, boxSizing: "border-box" }} />
                    <span style={{ color: C.ash, fontFamily: MONO }} className="fs-9">{p.fecha.slice(5)}</span>
                  </div>
                ))}
              </div>
              {(() => { const h = data.siemon.auditoriasHistorial; const delta = h[h.length - 1].global - h[0].global; return (
                <div style={{ color: delta >= 0 ? C.ok : C.danger, fontFamily: MONO }} className="fs-10 mt-1.5">{delta >= 0 ? `▲ +${delta} puntos desde el primer análisis` : `▼ ${delta} puntos desde el primer análisis`}</div>
              ); })()}
            </div>
          )}

          {audit && (
            <div className="flex flex-col gap-3">
              <div style={{ background: C.panel, border: `1px solid ${C.line}` }} className="rounded-xl p-4">
                <div style={{ color: C.mist }} className="fs-12 leading-snug mb-3">{audit.resumen}</div>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(audit.puntuaciones || {}).map(([k, v]) => (
                    <span key={k} style={{ background: "rgba(255,255,255,0.05)", border: `1px solid ${C.line}`, color: nivelColor(v), fontFamily: MONO }} className="px-2 py-1 rounded fs-10">{k.replace(/_/g, " ")} {v}</span>
                  ))}
                </div>
              </div>

              {(audit.quick_wins || []).length > 0 && (
                <div style={{ background: "rgba(127,184,155,0.08)", border: `1px solid rgba(127,184,155,0.3)` }} className="rounded-xl p-4">
                  <div style={{ color: C.ok, fontFamily: MONO }} className="fs-9 uppercase mb-1.5">// Quick wins (esta semana)</div>
                  {(audit.quick_wins || []).map((q, i) => <div key={i} style={{ color: C.mist }} className="fs-12">☐ {q}</div>)}
                </div>
              )}

              {(audit.incoherencias || []).length > 0 && (
                <div style={{ background: C.panel, border: `1px solid ${C.line}` }} className="rounded-xl p-4">
                  <button onClick={() => setVerInc((v) => !v)} style={{ color: C.warn, fontFamily: MONO }} className="fs-9 uppercase mb-1.5 flex items-center gap-1">{verInc ? <ChevronDown size={12} /> : <ChevronRight size={12} />} Incoherencias y errores ({audit.incoherencias.length})</button>
                  {verInc && (audit.incoherencias || []).map((x, i) => (
                    <div key={i} className="fs-11 mb-2"><span style={{ color: C.cream }}>{x.que}</span> <span style={{ color: C.ash }}>· {x.por_que}</span><div style={{ color: C.aether2 }} className="fs-10">→ {x.fix} <span style={{ color: C.ash, fontFamily: MONO }}>({x.prioridad})</span></div></div>
                  ))}
                </div>
              )}

              {(audit.comparativa || []).map((c, i) => (
                <div key={i} style={{ background: C.panel, border: `1px solid ${C.line}` }} className="rounded-xl p-4">
                  <div style={{ color: C.aether2, fontFamily: MONO }} className="fs-9 uppercase mb-1.5">// vs {(c.competidor || "").replace(/https?:\/\//, "").slice(0, 40)}</div>
                  <div style={{ color: C.mist }} className="fs-11">Te gana en: {c.te_gana_en}</div>
                  <div style={{ color: C.mist }} className="fs-11">Le ganas en: {c.le_ganas_en}</div>
                  <div style={{ color: C.aether2 }} className="fs-11">Hueco a ocupar: {c.hueco}</div>
                </div>
              ))}

              {insights && (
                <div style={{ background: C.aetherSoft, border: `1px solid ${C.aetherLine}` }} className="rounded-xl p-4">
                  <div style={{ color: C.aether2, fontFamily: MONO }} className="fs-9 uppercase mb-2">// Estos insights ya alimentan a los otros módulos</div>
                  <div style={{ color: C.mist, whiteSpace: "pre-wrap" }} className="fs-11 leading-relaxed mb-3">{insights}</div>
                  <div className="flex flex-wrap gap-2">
                    {[["Viral: ideas con estos ángulos", "🔥"], ["Blog/SEO: keywords con hueco", "📝"], ["Ads: segmentación y creativos", "📣"]].map(([t, e]) => (
                      <span key={t} style={{ background: C.carbon, border: `1px solid ${C.line}`, color: C.mist }} className="px-2 py-1 rounded-lg fs-10 inline-flex items-center gap-1">{e} {t} <Check size={11} color={C.ok} /></span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          {!audit && <div style={{ background: C.panel, border: `1px solid ${C.line}`, color: C.ash }} className="rounded-xl p-6 fs-12 text-center">Corre el análisis: detecta qué comunica (o no) tu web, tus incoherencias, y el hueco frente a tu competencia. El resultado fundamenta el contenido viral, el blog y la pauta.</div>}
        </div>
      )}
    </div>
  );
}
