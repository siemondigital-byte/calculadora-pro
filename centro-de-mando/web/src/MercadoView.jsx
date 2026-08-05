import React, { useState } from "react";
import { Radar, Activity, Users2, Sparkles, Plus, Trash2, RefreshCw, ChevronDown, ChevronRight, Check, ArrowRight } from "lucide-react";
import { C, MONO, SANS } from "./tema.js";
import { MOTOR, getToken, motorPost } from "./db.js";

const inS = { background: C.carbon, border: `1px solid ${C.line}`, color: C.cream, borderRadius: 10, padding: "9px 12px", width: "100%", fontFamily: SANS, fontSize: 13, outline: "none" };
const H = () => ({ "content-type": "application/json", Authorization: "Bearer " + getToken() });
const uid = () => (crypto?.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2, 9));
const hoy = () => new Date().toISOString().slice(0, 10);
const nivelColor = (v) => (v >= 80 ? "#7FB89B" : v >= 50 ? "#D8B673" : "#D08A8A");
const urlHref = (u) => (/^https?:\/\//i.test(u || "") ? u : "https://" + (u || ""));
const vered = (v) => (v === "seguir" ? C.ok : v === "observar" ? C.warn : C.danger);

// Contexto de mercado para los generadores (viral/blog/ads). Devuelve "" si aun
// no hay estudio.
export function insightsMercado(data) {
  const ws = data?.workspace === "cicloderiqueza" ? "cicloderiqueza" : "atlantis";
  const s = data?.[ws] || {};
  const partes = [];
  const a = s.auditoriaNegocio;
  if (a && a.hallazgos_para_ads) {
    const h = a.hallazgos_para_ads;
    if (h.publico_dolor) partes.push("Publico y dolor dominante: " + h.publico_dolor);
    if ((h.angulos || []).length) partes.push("Angulos con respaldo: " + h.angulos.join("; "));
    if ((h.objeciones || []).length) partes.push("Objeciones a responder: " + h.objeciones.join("; "));
    if (h.competencia_mensaje) partes.push("Mensaje de la competencia: " + h.competencia_mensaje);
    (a.comparativa || []).forEach((c) => {
      if (c.hueco) partes.push("Hueco vs " + (c.competidor || "competidor") + ": " + c.hueco);
    });
  }
  (s.competidores || [])
    .filter((c) => c.perfil && (c.perfil.veredicto === "seguir" || c.perfil.veredicto === "observar"))
    .slice(0, 4)
    .forEach((c) => {
      const p = c.perfil;
      const debil = (p.por_mejorar || []).slice(0, 2).join("; ");
      if (debil) partes.push(`A ${c.nombre} (${p.posicionamiento || p.nicho || "competidor"}) le falta: ${debil}`);
      const mov = (p.oportunidades || []).slice(0, 2).join("; ");
      if (mov) partes.push(`Movimiento vs ${c.nombre}: ${mov}`);
    });
  return partes.join("\n");
}

// Panel de inteligencia de un competidor/candidato: señales de marketing,
// redes y perfil completo. Reutilizado por candidatos y por seguidos.
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
              <div style={{ color: C.aether2, fontFamily: MONO }} className="fs-9 uppercase mb-1">→ Movimientos para Atlantis</div>
              {perfil.oportunidades.map((x, i) => <div key={i} style={{ color: C.cream }} className="fs-10 mb-0.5">· {x}</div>)}
            </div>
          )}
        </div>
      )}
    </>
  );
}

export default function MercadoView({ data, commit, ws, recargar }) {
  const config = data[ws]?.config || {};
  const dominio = config.dominio || (ws === "cicloderiqueza"
    ? "https://cicloderiqueza.atlantisglobalrealty.com/"
    : "https://atlantisglobalrealty.com/");
  const [aviso, setAviso] = useState("");
  const flash = (m) => { setAviso(m); window.clearTimeout(flash._t); flash._t = window.setTimeout(() => setAviso(""), 7000); };
  const [tab, setTab] = useState("salud");
  const [busy, setBusy] = useState("");

  const patch = (cambios) => commit({ ...data, [ws]: { ...data[ws], ...cambios } });
  const competidores = data[ws]?.competidores || [];
  const candidatos = data[ws]?.candidatosMercado || [];
  const setCandidatosP = (lista) => patch({ candidatosMercado: lista });
  const audit = data[ws]?.auditoriaNegocio || null;
  const historial = data[ws]?.saludHistorial || [];
  const saludWeb = data[ws]?.saludWeb;

  // ---- salud (auditoria SEO + soluciones, ya operativa) ----
  const [url, setUrl] = useState(dominio);
  const [keyword, setKeyword] = useState("");
  const [auditoria, setAuditoria] = useState(null);
  const auditar = async () => {
    setBusy("aud");
    try {
      const r = await motorPost("/seo/auditar", { url, keyword, workspace: ws });
      if (!r.ok) throw new Error(r.error);
      setAuditoria(r);
      await recargar();
    } catch (e) { flash(String(e.message || e)); }
    finally { setBusy(""); }
  };
  const generarSoluciones = async () => {
    setBusy("sol");
    try {
      const r = await motorPost("/seo/soluciones", { url, keyword, workspace: ws });
      if (!r.ok) throw new Error(r.error);
      flash("Soluciones generadas y guardadas. Ve al Maquetador para aplicarlas a la home con un clic.");
      await recargar();
    } catch (e) { flash(String(e.message || e)); }
    finally { setBusy(""); }
  };

  // ---- competencia ----
  const [nvComp, setNvComp] = useState("");
  const [sectorDesc, setSectorDesc] = useState(ws === "cicloderiqueza"
    ? "metodo de inversion inmobiliaria en preventa (infoproducto)"
    : "asesoria de inversion inmobiliaria sobre planos internacional");
  const [abierto, setAbierto] = useState("");
  // lápidas: marca los borrados a propósito para que el merge del servidor no
  // los resucite; al re-agregar una URL le quita la lápida
  function sinLapida(u) {
    const b = data[ws].borrados || {};
    return {
      borrados: { ...b, competidores: (b.competidores || []).filter((x) => x !== u) },
      revivir: { competidores: [u] },
    };
  }
  function agregarComp() {
    const u = nvComp.trim();
    if (!u.startsWith("http")) return flash("Pega la URL completa (https://…).");
    if (competidores.some((c) => c.url === u)) return flash("Ese competidor ya está.");
    const item = { id: uid(), url: u, nombre: u.replace(/https?:\/\/(www\.)?/, "").split("/")[0], seo: null, fecha: "", senales: null, historial: [] };
    patch({ competidores: [...competidores, item], ...sinLapida(u) });
    setNvComp(""); flash('Competidor agregado. Dale "Rastrear" para analizarlo.');
  }
  async function descubrir() {
    setBusy("desc"); flash("Buscando competidores y precalificándolos (1 llamada de IA barata)…");
    try {
      const r = await fetch(MOTOR + "/mercado/descubrir", { method: "POST", headers: H(), body: JSON.stringify({ sector: sectorDesc }) });
      const d = await r.json();
      if (!d.ok) return flash(d.error === "sin_serper" ? "Falta la SERPER_API_KEY en Accesos para descubrir competidores." : "No pude descubrir: " + (d.error || ""));
      const ya = new Set(competidores.map((c) => c.url));
      let nuevos = (d.candidatos || []).filter((c) => !ya.has(c.url));
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
    const item = { id: uid(), url: c.url, nombre: c.nombre, seo: c.seoGlobal != null ? c.seoGlobal : null,
      fecha: c.analizado ? hoy() : "", senales: c.senales || null, perfil: c.perfil || null,
      categorias: c.categorias || null, topFixes: c.topFixes || null, adsLibrary: c.adsLibrary || "",
      historial: c.seoGlobal != null ? [{ fecha: hoy(), seo: c.seoGlobal }] : [],
      precalificacion: { tipo: c.tipo, nicho: c.nicho, tamano: c.tamano, scorePrevio: c.scorePrevio, razon: c.razon } };
    patch({ competidores: [...competidores, item], candidatosMercado: candidatos.filter((x) => x.url !== c.url), ...sinLapida(c.url) });
    flash(c.nombre + " agregado a tu competencia." + (c.perfil ? "" : ' Dale "Rastrear" para el perfil completo.'));
  }
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
    } catch { flash("Error al analizar el candidato."); }
    finally { setBusy(""); }
  }
  function descartarCandidato(c) { setCandidatosP(candidatos.filter((x) => x.url !== c.url)); }
  function quitarComp(id) {
    const comp = competidores.find((c) => c.id === id);
    const b = data[ws].borrados || {};
    patch({
      competidores: competidores.filter((c) => c.id !== id),
      borrados: { ...b, competidores: [...(b.competidores || []), comp && comp.url].filter(Boolean).slice(-300) },
    });
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
      patch({ competidores: competidores.map((x) => x.id === c.id ? nuevo : x) });
      flash(`${c.nombre}: SEO ${seo.global}/100` + (perfil ? ` · score competidor ${perfil.score}/100 (${perfil.veredicto})` : " · señales capturadas."));
    } catch { flash("No pude conectar con el motor."); }
    finally { setBusy(""); }
  }
  async function monitorear() {
    setBusy("mon"); flash("Re-auditando tu web y toda tu competencia… puede tardar unos minutos.");
    try {
      const r = await fetch(MOTOR + "/mercado/monitorear", { method: "POST", headers: H() });
      const d = await r.json();
      if (!d.ok) return flash("No pude monitorear.");
      await recargar();
      flash(`Monitoreo listo: ${d.competidores} competidor(es) re-auditados.`);
    } catch { flash("No pude conectar con el motor."); }
    finally { setBusy(""); }
  }

  // ---- auditoría de negocio ----
  const [comp1, setComp1] = useState("");
  const [selComps, setSelComps] = useState([]);
  const [verInc, setVerInc] = useState(false);
  async function auditarNegocio() {
    const elegidos = [...selComps, ...(comp1.trim() ? [comp1.trim()] : [])].slice(0, 3);
    setBusy("negocio"); flash("Auditoría profunda de tu web" + (elegidos.length ? ` vs ${elegidos.length} competidor(es)` : "") + "… ~1 minuto.");
    try {
      const r = await fetch(MOTOR + "/auditoria/negocio", { method: "POST", headers: H(), body: JSON.stringify({ web: dominio, competidores: elegidos, workspace: ws }) });
      const d = await r.json();
      if (!d.ok) return flash("No pude auditar: " + (d.error || ""));
      const punto = { fecha: hoy(), global: d.auditoria.global, puntuaciones: d.auditoria.puntuaciones || {} };
      const hist = [...(data[ws].auditoriasHistorial || []).filter((x) => x.fecha !== hoy()), punto].slice(-24);
      patch({ auditoriaNegocio: { ...d.auditoria, fecha: hoy(), competidores: elegidos }, auditoriasHistorial: hist });
      flash(`Auditoría lista: ${d.auditoria.global}/100. Sus hallazgos ya alimentan al contenido Viral, al Blog y a la pauta.`);
    } catch { flash("No pude conectar con el motor."); }
    finally { setBusy(""); }
  }

  const seoPropio = saludWeb && saludWeb.global != null ? saludWeb.global : null;
  const insights = insightsMercado(data);

  const TABS = [
    { id: "salud", label: "Salud de tu web", icon: Activity },
    { id: "competencia", label: `Competencia (${competidores.length})`, icon: Users2 },
    { id: "insights", label: "Análisis e insights", icon: Sparkles },
  ];

  return (
    <div style={{ maxWidth: 1100 }}>
      <div className="mb-4">
        <div style={{ color: C.aether500, fontFamily: MONO, letterSpacing: "0.2em" }} className="fs-10 uppercase mb-2"><span style={{ color: C.aether }}>// </span>Inteligencia de mercado</div>
        <h1 style={{ fontWeight: 600, color: C.cream }} className="fs-24 flex items-center gap-2"><Radar size={20} color={C.aether} /> Estudio de mercado</h1>
        <div style={{ color: C.ash }} className="fs-11 mt-1">La salud de tu web, el rastreo de tu competencia y el análisis profundo del mercado. Lo que se descubre aquí alimenta automáticamente al contenido Viral, al Blog/SEO y a la pauta.</div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {TABS.map((t) => { const on = tab === t.id; const Ico = t.icon; return (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ background: on ? C.aetherSoft : C.panel, border: `1px solid ${on ? C.aetherLine : C.line}`, color: on ? C.aether2 : C.mist }} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg fs-12"><Ico size={13} /> {t.label}</button>
        ); })}
      </div>

      {aviso && <div style={{ background: C.aetherSoft, border: `1px solid ${C.aetherLine}`, color: C.aether2 }} className="rounded-lg px-3 py-2 mb-4 fs-12">{aviso}</div>}

      {/* SALUD */}
      {tab === "salud" && (
        <div>
          <div style={{ background: C.panel, border: `1px solid ${C.line}` }} className="rounded-xl p-4 mb-4">
            <div className="grid gap-3 sm:grid-cols-4">
              <input style={inS} className="sm:col-span-2" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." />
              <input style={inS} value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="Keyword objetivo (opcional)" />
              <button onClick={auditar} disabled={!!busy} style={{ background: C.aether, color: C.obsidian, fontWeight: 600, opacity: busy ? 0.6 : 1 }} className="rounded-lg fs-13 px-4 py-2">{busy === "aud" ? "Auditando…" : "Auditar"}</button>
            </div>
          </div>

          {auditoria && (
            <div style={{ background: C.panel, border: `1px solid ${C.line}` }} className="rounded-xl p-4 mb-4">
              <div className="flex items-baseline justify-between">
                <div style={{ color: nivelColor(auditoria.global), fontWeight: 700, fontFamily: MONO }} className="fs-28">{auditoria.global}<span className="fs-13">/100</span></div>
                {auditoria.competidor && <div style={{ color: C.ash }} className="fs-11">Competidor: {auditoria.competidor.global}/100</div>}
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {(auditoria.categorias || []).map((c) => (
                  <div key={c.nombre} className="flex items-center gap-2">
                    <span style={{ color: C.mist, width: 130 }} className="fs-10 shrink-0">{c.nombre}</span>
                    <div className="flex-1" style={{ background: "rgba(255,255,255,0.05)", borderRadius: 4, height: 8 }}><div style={{ width: `${Math.round((c.puntos / (c.max || 20)) * 100)}%`, background: C.aetherSoft, border: `1px solid ${C.aetherLine}`, boxSizing: "border-box", height: "100%", borderRadius: 4 }} /></div>
                    <span style={{ color: C.cream, fontFamily: MONO, width: 44 }} className="fs-10 text-right">{c.puntos}/{c.max || ""}</span>
                  </div>
                ))}
              </div>
              {(auditoria.top_fixes || []).length > 0 && (
                <div className="mt-4">
                  <div style={{ color: C.aether500, fontFamily: MONO }} className="fs-9 uppercase mb-1">// Hallazgos principales</div>
                  {(auditoria.top_fixes || []).slice(0, 8).map((f, i) => (
                    <div key={i} style={{ borderBottom: `1px solid ${C.line}` }} className="py-1.5 fs-11">
                      <span style={{ color: C.cream }}>{f.txt}</span>
                      <span style={{ color: C.ash }} className="fs-10 ml-2">→ {f.fix}</span>
                    </div>
                  ))}
                  <button onClick={generarSoluciones} disabled={!!busy} style={{ background: C.aether, color: C.obsidian, fontWeight: 600, opacity: busy ? 0.6 : 1 }} className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg fs-12"><Sparkles size={13} /> {busy === "sol" ? "Generando…" : "Generar soluciones con IA"}</button>
                </div>
              )}
            </div>
          )}

          {saludWeb?.soluciones && (
            <div style={{ background: C.panel, border: `1px solid ${C.aetherLine}` }} className="rounded-xl p-4 mb-4">
              <div style={{ color: C.aether500, fontFamily: MONO }} className="fs-9 uppercase mb-2">// Soluciones vigentes {saludWeb.soluciones.fecha ? `· ${saludWeb.soluciones.fecha}` : ""}</div>
              {saludWeb.soluciones.title_propuesto && <div className="fs-11 mb-1"><span style={{ color: C.ash }}>Title: </span><span style={{ color: C.aether2 }}>{saludWeb.soluciones.title_propuesto}</span></div>}
              {saludWeb.soluciones.description_propuesta && <div className="fs-11 mb-1"><span style={{ color: C.ash }}>Description: </span><span style={{ color: C.cream }}>{saludWeb.soluciones.description_propuesta}</span></div>}
              {(saludWeb.soluciones.alts || []).length > 0 && <div style={{ color: C.ash }} className="fs-10">+ {(saludWeb.soluciones.alts || []).length} alt(s) de imagen propuestos</div>}
              <div style={{ color: C.aether2 }} className="fs-10 mt-2">Aplícalas desde el Maquetador (vista previa antes de escribir).</div>
            </div>
          )}

          {historial.length > 0 && (
            <div style={{ background: C.panel, border: `1px solid ${C.line}` }} className="rounded-xl p-4">
              <div style={{ color: C.aether500, fontFamily: MONO }} className="fs-9 uppercase mb-2">// Histórico de salud</div>
              <div className="flex items-end gap-1" style={{ height: 60 }}>
                {historial.slice(-24).map((h, i) => (
                  <div key={i} title={`${h.fecha}: ${h.global}/100`} className="flex-1 rounded-t" style={{ height: `${h.global}%`, minWidth: 6, background: nivelColor(h.global) + "60", border: `1px solid ${nivelColor(h.global)}` }} />
                ))}
              </div>
              <div style={{ color: C.ash, fontFamily: MONO }} className="fs-10 mt-1">{historial[historial.length - 1].fecha} · último: {historial[historial.length - 1].global}/100</div>
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
              <input style={{ ...inS, maxWidth: 380 }} value={sectorDesc} onChange={(e) => setSectorDesc(e.target.value)} placeholder="Tu sector, ej. inversión inmobiliaria sobre planos" />
              <button onClick={descubrir} disabled={!!busy} style={{ background: C.aether, color: C.obsidian, fontWeight: 600, opacity: busy ? 0.6 : 1 }} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg fs-12"><Radar size={13} /> {busy === "desc" ? "Buscando…" : "Descubrir competidores"}</button>
            </div>
            {candidatos.length > 0 && (
              <div className="flex flex-col gap-1.5 mt-3">
                <div style={{ color: C.ash }} className="fs-10">Candidatos guardados (no se pierden al refrescar). Dale <b style={{ color: C.aether2 }}>"Analizar"</b> para ver su perfil completo (nicho, oferta, fortalezas, falencias, redes…) y decidir a cuáles seguir. El puntaje pequeño es la precalificación; el grande sale al analizar.</div>
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
              {competidores.length > 0 && <button onClick={monitorear} disabled={!!busy} style={{ color: C.aether2, border: `1px solid ${C.aetherLine}`, opacity: busy ? 0.6 : 1 }} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg fs-11"><RefreshCw size={11} className={busy === "mon" ? "animate-spin" : ""} /> {busy === "mon" ? "Monitoreando…" : "Monitorear todo ahora"}</button>}
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
                          <span style={{ color: vered(c.perfil.veredicto), fontWeight: 700, fontFamily: MONO }} className="fs-18">{c.perfil.score}</span>
                          <span style={{ color: C.ash, fontFamily: MONO }} className="fs-10">/100</span>
                          <div style={{ color: vered(c.perfil.veredicto), fontFamily: MONO }} className="fs-9 uppercase">{c.perfil.veredicto}</div>
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
                        {c.perfil && <span style={{ color: vered(c.perfil.veredicto), fontFamily: MONO }} className="fs-9">{c.perfil.score}</span>}
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

          {(data[ws].auditoriasHistorial || []).length > 1 && (
            <div style={{ background: C.panel, border: `1px solid ${C.line}` }} className="rounded-xl p-4 mb-3">
              <div style={{ color: C.aether500, fontFamily: MONO, letterSpacing: "0.14em" }} className="fs-9 uppercase mb-2">// Tu progreso ({data[ws].auditoriasHistorial.length} análisis)</div>
              <div className="flex items-end gap-1.5" style={{ height: 64 }}>
                {data[ws].auditoriasHistorial.map((p, i) => (
                  <div key={i} title={`${p.fecha}: ${p.global}/100`} className="flex flex-col items-center gap-1" style={{ flex: 1, maxWidth: 44 }}>
                    <span style={{ color: nivelColor(p.global), fontFamily: MONO }} className="fs-9">{p.global}</span>
                    <div style={{ width: "100%", height: Math.max(6, Math.round(p.global * 0.44)), background: nivelColor(p.global) + "38", border: `1px solid ${nivelColor(p.global)}`, borderRadius: 4, boxSizing: "border-box" }} />
                    <span style={{ color: C.ash, fontFamily: MONO }} className="fs-9">{p.fecha.slice(5)}</span>
                  </div>
                ))}
              </div>
              {(() => { const h = data[ws].auditoriasHistorial; const delta = h[h.length - 1].global - h[0].global; return (
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
