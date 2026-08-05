import React, { useState, useMemo } from "react";
import { Link2, Copy, Check, Radio, Plus, Trash2, Eye, RefreshCw } from "lucide-react";
import Combo, { opcionesDe } from "./Combo.jsx";
import { getToken } from "./db";

const MOTOR = import.meta.env.VITE_MOTOR_URL || "https://prospeccion.siemondigital.com";
const H = () => ({ "content-type": "application/json", Authorization: "Bearer " + getToken() });

// destinos precargados de Siemon (los nuevos que uses se guardan solos)
const DESTINOS = [
  "https://siemondigital.com/",
  "https://siemondigital.com/book-call/",
  "https://siemondigital.com/download-guide/",
  "https://siemondigital.com/proposal.html",
];

const C = {
  obsidian: "#0A0B0D", panel: "#16171C", carbon: "#131418", line: "rgba(255,255,255,0.08)",
  aether: "#B1A3E1", aether2: "#CBC0EC", aether500: "#8474BE", aetherSoft: "rgba(177,163,225,0.14)",
  aetherLine: "rgba(177,163,225,0.30)", cream: "#E9E5DD", mist: "#C9CAD2", ash: "#8B8D98", ok: "#7FB89B",
};
const SANS = "'Montserrat', system-ui, sans-serif";
const MONO = "'JetBrains Mono', ui-monospace, monospace";

// Taxonomía de fuentes de Siemon. Cada superficie = un enlace UTM propio que el CRM lee y etiqueta.
const SUPERFICIES = [
  { grupo: "Orgánico (redes)", items: [
    { id: "ig-post", label: "Post Instagram", source: "instagram", medium: "social", campaign: "post" },
    { id: "li-post", label: "Post LinkedIn", source: "linkedin", medium: "social", campaign: "post" },
    { id: "yt-video", label: "Video / Short YouTube", source: "youtube", medium: "social", campaign: "video" },
    { id: "tt-post", label: "TikTok", source: "tiktok", medium: "social", campaign: "post" },
    { id: "x-post", label: "X (Twitter)", source: "x", medium: "social", campaign: "post" },
  ] },
  { grupo: "Ads (pago)", items: [
    { id: "meta-ad", label: "Anuncio Meta (IG/FB)", source: "meta", medium: "paid", campaign: "ad" },
    { id: "google-ad", label: "Anuncio Google", source: "google", medium: "paid", campaign: "ad" },
    { id: "yt-ad", label: "Anuncio YouTube", source: "youtube", medium: "paid", campaign: "ad" },
  ] },
  { grupo: "Lead magnet", items: [
    { id: "guia", label: "Guía PDF (enlace interno)", source: "guia", medium: "pdf", campaign: "guia-ia" },
  ] },
  { grupo: "Infoproductos (apps y footers)", items: [
    { id: "app-mentalidad", label: "App Mentalidad", source: "app-mentalidad", medium: "app", campaign: "powered-by" },
    { id: "app-finanzas", label: "App Finanzas", source: "app-finanzas", medium: "app", campaign: "powered-by" },
    { id: "cartilla-mentalidad", label: "Cartilla Mentalidad (footer)", source: "cartilla-mentalidad", medium: "referral", campaign: "creado-por" },
    { id: "cartilla-metas", label: "Cartilla Metas (footer)", source: "cartilla-metas", medium: "referral", campaign: "creado-por" },
    { id: "bono-negocios", label: "Bono Negocios Secundarios", source: "bono-negocios", medium: "referral", campaign: "colaboracion" },
    { id: "order-bump-aipro", label: "Order Bump AI Pro (footer)", source: "order-bump-aipro", medium: "referral", campaign: "colaboracion" },
    { id: "infoproducto-nuevo", label: "Otro infoproducto (en desarrollo)", source: "infoproducto-2", medium: "referral", campaign: "colaboracion" },
  ] },
  { grupo: "Prospección", items: [
    { id: "propuesta", label: "Presentación / propuesta", source: "propuesta", medium: "presentacion", campaign: "propuesta" },
    { id: "frio-email", label: "Contacto en frío (email)", source: "outreach", medium: "email", campaign: "frio" },
    { id: "embajadores", label: "Embajadores / Afiliados", source: "outreach", medium: "email", campaign: "embajadores" },
    { id: "dm", label: "DM directo", source: "dm", medium: "social", campaign: "outreach" },
  ] },
];
const TODAS = SUPERFICIES.flatMap((g) => g.items);

const inS = { background: "#101116", border: `1px solid ${C.line}`, color: C.cream, borderRadius: 10,
  padding: "10px 12px", width: "100%", fontFamily: SANS, fontSize: 14, outline: "none" };

const slug = (s) => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// construye la URL final a partir de los parámetros (misma lógica para el generador y el historial)
function construirLink({ destino, idioma, source, medium, campaign, content }) {
  let base = (destino || "https://siemondigital.com/").trim();
  let hash = "";
  const hi = base.indexOf("#");
  if (hi >= 0) { hash = base.slice(hi); base = base.slice(0, hi); }
  const sep = base.includes("?") ? "&" : "?";
  const p = new URLSearchParams();
  if (idioma && idioma !== "auto") p.set("lang", idioma);
  p.set("utm_source", source || "");
  p.set("utm_medium", medium || "");
  p.set("utm_campaign", (campaign || "").trim());
  if ((content || "").trim()) p.set("utm_content", content.trim());
  return base + sep + p.toString() + hash;
}

export default function FuentesView({ data, commit, flash }) {
  const [selId, setSelId] = useState("ig-post");
  const [destino, setDestino] = useState("https://siemondigital.com/");
  const [idiomaDest, setIdiomaDest] = useState("auto");   // auto = idioma del navegador del visitante
  const [campaign, setCampaign] = useState("");
  const [content, setContent] = useState("");
  const [copiado, setCopiado] = useState(false);
  // superficies personalizadas (persisten en el CRM)
  const custom = data.siemon.superficiesCustom || [];
  const TODAS_X = [...TODAS, ...custom];
  const [showNueva, setShowNueva] = useState(false);
  const [nv, setNv] = useState({ label: "", source: "", medium: "referral", campaign: "" });
  const sel = TODAS_X.find((x) => x.id === selId) || TODAS_X[0];

  function crearSuperficie() {
    if (!nv.label.trim()) return flash("Ponle un nombre a la superficie.");
    const source = slug(nv.source || nv.label);
    if (!source) return flash("El source no puede quedar vacío.");
    const item = { id: "custom-" + slug(nv.label), label: nv.label.trim(), source, medium: slug(nv.medium) || "referral", campaign: slug(nv.campaign) || "general" };
    if (TODAS_X.some((x) => x.id === item.id)) return flash("Ya existe una superficie con ese nombre.");
    commit({ ...data, siemon: { ...data.siemon, superficiesCustom: [...custom, item] } });
    setSelId(item.id); setShowNueva(false); setNv({ label: "", source: "", medium: "referral", campaign: "" });
    flash("Superficie \"" + item.label + "\" creada. Ya puedes generar su enlace.");
  }
  function borrarSuperficie(id) {
    commit({ ...data, siemon: { ...data.siemon, superficiesCustom: custom.filter((x) => x.id !== id) } });
    if (selId === id) setSelId("ig-post");
    flash("Superficie eliminada.");
  }

  // enlaces guardados (historial parametrizable, persiste en el CRM)
  const enlaces = data.siemon.enlacesUTM || [];
  // visitas por enlace (Umami) — se llena solo cuando haya tráfico con UTM
  const [visitas, setVisitas] = useState(null);
  const [visBusy, setVisBusy] = useState(false);
  async function cargarVisitas() {
    if (!enlaces.length) return flash("Aún no hay enlaces guardados.");
    setVisBusy(true);
    try {
      const payload = enlaces.map((e) => ({ id: e.id, utm_source: e.source, utm_medium: e.medium, utm_campaign: e.campaign, utm_content: e.content }));
      const r = await fetch(MOTOR + "/analitica/enlaces", { method: "POST", headers: H(), body: JSON.stringify({ enlaces: payload, dias: 90 }) });
      const d = await r.json();
      if (!d.ok) return flash(d.error === "umami_sin_configurar" ? "Conecta Umami (Analítica) primero." : "No pude leer las visitas: " + (d.error || ""));
      setVisitas(d.porEnlace || {});
      flash(d.total ? `${d.total} visitas repartidas entre tus enlaces (últimos 90 días).` : "Aún sin visitas registradas. Se irán llenando cuando muevas tus enlaces.");
    } catch { flash("No pude conectar con el motor."); }
    finally { setVisBusy(false); }
  }
  function patchEnlaces(nuevos, extra) { commit({ ...data, siemon: { ...data.siemon, enlacesUTM: nuevos, ...(extra || {}) } }); }

  const link = useMemo(() => construirLink({
    destino, idioma: idiomaDest, source: sel.source, medium: sel.medium,
    campaign: campaign || sel.campaign, content,
  }), [sel, destino, campaign, content, idiomaDest]);

  function copiar() {
    try { navigator.clipboard.writeText(link); setCopiado(true); setTimeout(() => setCopiado(false), 1800); } catch {}
    // registra el enlace en el historial (aunque el portapapeles falle) y aprende el destino nuevo
    const entrada = {
      id: "utm-" + Date.now(), fecha: new Date().toISOString().slice(0, 10),
      superficie: sel.label, source: sel.source, medium: sel.medium,
      campaign: (campaign || sel.campaign).trim(), content: content.trim(),
      destino: (destino || "").trim(), idioma: idiomaDest, url: link,
    };
    if (enlaces.some((e) => e.url === link)) { flash("Enlace copiado (ya estaba en el historial)."); return; }
    const opciones = { ...(data.siemon.opciones || {}) };
    const d = (destino || "").trim();
    if (d && !DESTINOS.includes(d) && !(opciones.destinoUTM || []).includes(d)) {
      opciones.destinoUTM = [...(opciones.destinoUTM || []), d];
    }
    patchEnlaces([entrada, ...enlaces], { opciones });
    flash("Enlace copiado y guardado en el historial.");
  }

  function setEnlace(id, patch) {
    patchEnlaces(enlaces.map((e) => {
      if (e.id !== id) return e;
      const n = { ...e, ...patch };
      n.url = construirLink(n);
      return n;
    }));
  }
  function copiarGuardado(e) {
    try { navigator.clipboard.writeText(e.url); flash("Enlace copiado."); } catch {}
  }
  function borrarEnlace(id) {
    // lápida: marca el borrado a propósito para que el merge del servidor no lo resucite
    const b = data.siemon.borrados || {};
    patchEnlaces(enlaces.filter((e) => e.id !== id), { borrados: { ...b, enlacesUTM: [...(b.enlacesUTM || []), id].slice(-300) } });
    flash("Enlace eliminado del historial.");
  }

  // Atribución: leads agrupados por fuente
  const leads = (data.siemon && data.siemon.leads) || [];
  const porFuente = useMemo(() => {
    const m = {};
    leads.forEach((l) => { const f = (l.fuente || "sin fuente").toLowerCase(); m[f] = (m[f] || 0) + 1; });
    return Object.entries(m).map(([f, n]) => ({ f, n })).sort((a, b) => b.n - a.n);
  }, [leads]);
  const maxN = porFuente.reduce((a, b) => Math.max(a, b.n), 1);

  return (
    <div className="p-5 md:p-8" style={{ maxWidth: 1100 }}>
      <div className="mb-5">
        <div style={{ color: C.aether500, fontFamily: MONO, letterSpacing: "0.2em" }} className="fs-10 uppercase mb-2"><span style={{ color: C.aether }}>// </span>Fuentes y atribución</div>
        <h1 style={{ fontWeight: 600, color: C.cream }} className="fs-24 flex items-center gap-2"><Link2 size={20} color={C.aether} /> Enlaces UTM por fuente</h1>
        <div style={{ color: C.ash }} className="fs-11 mt-1">Genera el enlace rastreable de cada superficie (guía, apps, footers, bonos, ads, contacto en frío…). Quien entre por él queda etiquetado en el CRM con su fuente y campaña.</div>
      </div>

      {/* Nueva superficie personalizada */}
      {showNueva && (
        <div style={{ background: C.panel, border: `1px solid ${C.aetherLine}` }} className="rounded-xl p-4 mb-4">
          <div style={{ color: C.aether500, fontFamily: MONO, letterSpacing: "0.16em" }} className="fs-10 uppercase mb-3">// Nueva superficie</div>
          <div className="grid sm:grid-cols-4 gap-3">
            <div><label style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase">Nombre</label>
              <input style={inS} value={nv.label} onChange={(e) => setNv({ ...nv, label: e.target.value })} placeholder="ej. Newsletter mensual" /></div>
            <div><label style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase">Source (etiqueta)</label>
              <input style={inS} value={nv.source} onChange={(e) => setNv({ ...nv, source: e.target.value })} placeholder="ej. newsletter (auto si lo dejas vacío)" /></div>
            <div><label style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase">Medium</label>
              <select style={inS} value={nv.medium} onChange={(e) => setNv({ ...nv, medium: e.target.value })}>
                {["social", "paid", "email", "referral", "app", "pdf", "web"].map((m) => <option key={m} value={m}>{m}</option>)}
              </select></div>
            <div><label style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase">Campaña por defecto</label>
              <input style={inS} value={nv.campaign} onChange={(e) => setNv({ ...nv, campaign: e.target.value })} placeholder="ej. edicion-julio" /></div>
          </div>
          <div className="flex items-center gap-2 mt-3">
            <button onClick={crearSuperficie} style={{ background: C.aether, color: C.obsidian, fontWeight: 600 }} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg fs-12"><Plus size={13} /> Crear superficie</button>
            <button onClick={() => setShowNueva(false)} style={{ color: C.ash }} className="fs-12">Cancelar</button>
          </div>
        </div>
      )}

      {/* Generador */}
      <div style={{ background: C.panel, border: `1px solid ${C.line}` }} className="rounded-xl p-4 md:p-5 mb-6">
        <div className="grid md:grid-cols-2 gap-3">
          <div><label style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase">Superficie / fuente</label>
            <select style={inS} value={selId} onChange={(e) => { const v = e.target.value; if (v === "__nueva__") { setShowNueva(true); return; } setSelId(v); setCampaign(""); }}>
              {SUPERFICIES.map((g) => (<optgroup key={g.grupo} label={g.grupo}>{g.items.map((it) => <option key={it.id} value={it.id}>{it.label}</option>)}</optgroup>))}
              {custom.length > 0 && <optgroup label="Personalizadas">{custom.map((it) => <option key={it.id} value={it.id}>{it.label}</option>)}</optgroup>}
              <optgroup label="—"><option value="__nueva__">➕ Otra superficie (crear nueva)…</option></optgroup>
            </select></div>
          <div><label style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase">Destino (elige uno o escribe el tuyo)</label>
            <div className="flex items-stretch gap-2">
              <Combo listaId="dl-destino-utm" style={inS} value={destino} onChange={setDestino} opciones={opcionesDe(data, "destinoUTM", DESTINOS)} placeholder="https://siemondigital.com/" />
              <select title="Idioma de la página al abrir el enlace" style={{ ...inS, width: 92 }} value={idiomaDest} onChange={(e) => setIdiomaDest(e.target.value)}>
                <option value="auto">Auto</option><option value="es">ES</option><option value="en">EN</option>
              </select>
            </div></div>
          <div><label style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase">Campaña (opcional)</label>
            <input style={inS} value={campaign} onChange={(e) => setCampaign(e.target.value)} placeholder={sel.campaign} /></div>
          <div><label style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase">Detalle / contenido (opcional)</label>
            <input style={inS} value={content} onChange={(e) => setContent(e.target.value)} placeholder="ej. footer, boton-cta, v2" /></div>
        </div>
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <span style={{ background: C.aetherSoft, border: `1px solid ${C.aetherLine}`, color: C.aether2, fontFamily: MONO }} className="px-2 py-0.5 rounded fs-10">source: {sel.source}</span>
          <span style={{ background: "rgba(255,255,255,0.05)", border: `1px solid ${C.line}`, color: C.ash, fontFamily: MONO }} className="px-2 py-0.5 rounded fs-10">medium: {sel.medium}</span>
          <span style={{ background: "rgba(255,255,255,0.05)", border: `1px solid ${C.line}`, color: C.ash, fontFamily: MONO }} className="px-2 py-0.5 rounded fs-10">campaign: {campaign || sel.campaign}</span>
          {String(sel.id).startsWith("custom-") && <button onClick={() => borrarSuperficie(sel.id)} title="Eliminar esta superficie personalizada" style={{ color: C.ash }} className="inline-flex items-center gap-1 fs-10 ml-1 hover:brightness-125"><Trash2 size={11} /> eliminar</button>}
        </div>
        <div className="mt-3 flex items-stretch gap-2">
          <div style={{ background: C.carbon, border: `1px solid ${C.line}`, color: C.aether2, fontFamily: MONO, wordBreak: "break-all" }} className="fs-12 rounded-lg px-3 py-2.5 flex-1">{link}</div>
          <button onClick={copiar} style={{ background: C.aether, color: C.obsidian, fontWeight: 600 }} className="flex items-center gap-1.5 px-4 rounded-lg fs-13 shrink-0">{copiado ? <Check size={15} /> : <Copy size={15} />}{copiado ? "Copiado" : "Copiar"}</button>
        </div>
        <div style={{ color: C.ash }} className="fs-10 mt-2 leading-snug">Pega este enlace en la superficie correspondiente (PDF, footer, app, bio, ad, correo). El CRM etiqueta el lead con <b style={{ color: C.mist }}>fuente = {sel.source}</b>.</div>
      </div>

      {/* Atribución por fuente */}
      <div style={{ color: C.aether500, fontFamily: MONO, letterSpacing: "0.2em" }} className="fs-10 uppercase mb-2"><span style={{ color: C.aether }}>// </span>Leads por fuente</div>
      {porFuente.length === 0 ? (
        <div style={{ color: C.ash }} className="fs-12">Aún no hay leads con fuente. En cuanto entren por tus enlaces UTM, aparecerán aquí.</div>
      ) : (
        <div style={{ background: C.panel, border: `1px solid ${C.line}` }} className="rounded-xl p-4 flex flex-col gap-2.5">
          {porFuente.map(({ f, n }) => (
            <div key={f} className="flex items-center gap-3">
              <div style={{ color: C.mist, fontFamily: MONO, width: 160 }} className="fs-11 shrink-0 truncate flex items-center gap-1.5"><Radio size={11} color={C.aether500} />{f}</div>
              <div className="flex-1" style={{ background: "rgba(255,255,255,0.05)", borderRadius: 6, height: 10 }}><div style={{ width: `${Math.round((n / maxN) * 100)}%`, background: "rgba(177,163,225,0.22)", border: `1px solid ${C.aether}`, boxSizing: "border-box", height: 10, borderRadius: 6 }} /></div>
              <div style={{ color: C.aether2, fontFamily: MONO }} className="fs-11 shrink-0 w-8 text-right">{n}</div>
            </div>
          ))}
        </div>
      )}

      {/* Historial de enlaces (parametrizable) */}
      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
        <div style={{ color: C.aether500, fontFamily: MONO, letterSpacing: "0.2em" }} className="fs-10 uppercase"><span style={{ color: C.aether }}>// </span>Historial de enlaces ({enlaces.length})</div>
        {enlaces.length > 0 && <button onClick={cargarVisitas} disabled={visBusy} style={{ background: "transparent", border: `1px solid ${C.aetherLine}`, color: C.aether2 }} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg fs-11">{visBusy ? <RefreshCw size={12} className="animate-spin" /> : <Eye size={12} />} {visBusy ? "Consultando…" : "Ver visitas por enlace"}</button>}
      </div>
      {enlaces.length === 0 ? (
        <div style={{ color: C.ash }} className="fs-12 mb-6">Cada enlace que copies arriba queda guardado aquí, listo para reutilizar o ajustar.</div>
      ) : (
        <div className="flex flex-col gap-3 mb-6">
          {enlaces.map((e) => (
            <div key={e.id} style={{ background: C.panel, border: `1px solid ${C.line}` }} className="rounded-xl p-3.5">
              <div className="flex items-center gap-2 flex-wrap mb-2.5">
                <span style={{ color: C.cream, fontWeight: 600 }} className="fs-12">{e.superficie}</span>
                <span style={{ color: C.ash, fontFamily: MONO }} className="fs-10">{e.fecha}</span>
                <span style={{ background: C.aetherSoft, border: `1px solid ${C.aetherLine}`, color: C.aether2, fontFamily: MONO }} className="px-2 py-0.5 rounded fs-10">source: {e.source}</span>
                <span style={{ background: "rgba(255,255,255,0.05)", border: `1px solid ${C.line}`, color: C.ash, fontFamily: MONO }} className="px-2 py-0.5 rounded fs-10">medium: {e.medium}</span>
                {visitas && visitas[e.id] && <span title="Visitas registradas por Umami (90 días)" style={{ background: visitas[e.id].visitas > 0 ? "rgba(127,184,155,0.14)" : "transparent", border: `1px solid ${visitas[e.id].visitas > 0 ? "rgba(127,184,155,0.4)" : C.line}`, color: visitas[e.id].visitas > 0 ? C.ok : C.ash, fontFamily: MONO }} className="px-2 py-0.5 rounded fs-10 inline-flex items-center gap-1"><Eye size={10} /> {visitas[e.id].visitas} {visitas[e.id].visitas === 1 ? "visita" : "visitas"}{visitas[e.id].visitantes ? ` · ${visitas[e.id].visitantes} pers.` : ""}</span>}
                <div className="flex-1" />
                <button onClick={() => copiarGuardado(e)} style={{ background: C.aether, color: C.obsidian, fontWeight: 600 }} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg fs-11"><Copy size={12} /> Copiar</button>
                <button onClick={() => borrarEnlace(e.id)} title="Eliminar del historial" style={{ color: C.ash }} className="inline-flex items-center hover:brightness-125"><Trash2 size={13} /></button>
              </div>
              <div className="grid sm:grid-cols-4 gap-2 mb-2">
                <div className="sm:col-span-2"><label style={{ color: C.ash, fontFamily: MONO }} className="fs-9 uppercase">Destino</label>
                  <input style={{ ...inS, padding: "7px 10px", fontSize: 12 }} value={e.destino} onChange={(ev) => setEnlace(e.id, { destino: ev.target.value })} /></div>
                <div><label style={{ color: C.ash, fontFamily: MONO }} className="fs-9 uppercase">Campaña</label>
                  <input style={{ ...inS, padding: "7px 10px", fontSize: 12 }} value={e.campaign} onChange={(ev) => setEnlace(e.id, { campaign: ev.target.value })} /></div>
                <div className="flex gap-2">
                  <div className="flex-1"><label style={{ color: C.ash, fontFamily: MONO }} className="fs-9 uppercase">Detalle</label>
                    <input style={{ ...inS, padding: "7px 10px", fontSize: 12 }} value={e.content || ""} onChange={(ev) => setEnlace(e.id, { content: ev.target.value })} placeholder="footer, v2…" /></div>
                  <div><label style={{ color: C.ash, fontFamily: MONO }} className="fs-9 uppercase">Idioma</label>
                    <select style={{ ...inS, padding: "7px 6px", fontSize: 12, width: 74 }} value={e.idioma || "auto"} onChange={(ev) => setEnlace(e.id, { idioma: ev.target.value })}>
                      <option value="auto">Auto</option><option value="es">ES</option><option value="en">EN</option>
                    </select></div>
                </div>
              </div>
              <div style={{ background: C.carbon, border: `1px solid ${C.line}`, color: C.aether2, fontFamily: MONO, wordBreak: "break-all" }} className="fs-11 rounded-lg px-3 py-2">{e.url}</div>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}
