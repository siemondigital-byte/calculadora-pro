import React, { useState, useEffect, useRef } from "react";
import { Sparkles, Copy, Check, Trash2, Wand2, Send, Share2, Image as ImageIcon, Clock, TrendingUp, Youtube, ArrowRight, RefreshCw, Pencil } from "lucide-react";
import { getToken } from "./db";
import Combo, { opcionesDe, guardarOpcion } from "./Combo.jsx";

const TEMAS_PRESET = [
  "cómo automatizar tu atención al cliente con IA",
  "3 procesos que puedes automatizar hoy en tu negocio",
  "IA para captar más clientes sin más horas de trabajo",
  "errores al implementar IA en un negocio de servicios",
  "caso real: automatización que ahorra 10 horas a la semana",
];

const C = {
  obsidian: "#0A0B0D", panel: "#16171C", carbon: "#131418", line: "rgba(255,255,255,0.08)",
  aether: "#B1A3E1", aether2: "#CBC0EC", aether500: "#8474BE", aetherSoft: "rgba(177,163,225,0.14)",
  aetherLine: "rgba(177,163,225,0.30)", cream: "#E9E5DD", mist: "#C9CAD2", ash: "#8B8D98", ok: "#7FB89B",
};
const SANS = "'Montserrat', system-ui, sans-serif";
const MONO = "'JetBrains Mono', ui-monospace, monospace";
const MOTOR = import.meta.env.VITE_MOTOR_URL || "https://prospeccion.siemondigital.com";
const uid = () => (crypto?.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2, 9));
const today = () => new Date().toISOString().slice(0, 10);

const REDES = [
  { id: "instagram", label: "Instagram" }, { id: "youtube", label: "YouTube" },
  { id: "linkedin", label: "LinkedIn" }, { id: "x", label: "X (Twitter)" },
  { id: "tiktok", label: "TikTok" }, { id: "facebook", label: "Facebook" },
  { id: "meta", label: "Meta Ads (IG+FB)" }, { id: "google", label: "Google Ads" },
];
const TIPOS = [
  { id: "post", label: "Post" }, { id: "guion", label: "Guion de video" },
  { id: "carrusel", label: "Carrusel" }, { id: "calendario", label: "Calendario (7 días)" },
  { id: "ideas", label: "10 ideas" },
  { id: "copys_redes", label: "Copys para todas las redes" },
  { id: "anuncio", label: "🔥 Anuncio (3 variaciones)" }, { id: "campana", label: "🔥 Campaña de ads (brief)" },
  { id: "ad_variaciones", label: "🔥 Ads: corto/medio/largo + títulos + triggers" },
];
const inS = { background: "#101116", border: `1px solid ${C.line}`, color: C.cream, borderRadius: 10,
  padding: "10px 12px", width: "100%", fontFamily: SANS, fontSize: 14, outline: "none" };

export default function ContenidoView({ data, commit, flash, pubDraft, clearPubDraft, irAEstudio, subtab: subtabProp, setSubtab: setSubtabProp, ocultarBarra }) {
  const [red, setRed] = useState("instagram");
  const [tipo, setTipo] = useState("post");
  const [tema, setTema] = useState("");
  const [idioma, setIdioma] = useState("es");
  const [salida, setSalida] = useState("");
  const [busy, setBusy] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const guardados = (data.siemon.contenidos) || [];
  // Publicación en redes (Postiz como hub; IG/FB nativo de respaldo)
  const [selRedes, setSelRedes] = useState([]);   // índices de redes elegidas (multi) · arranca vacío
  const selInit = useRef(false);
  const toggleRed = (i) => setSelRedes((s) => s.includes(i) ? s.filter((x) => x !== i) : [...s, i]);
  const [copysRed, setCopysRed] = useState({});    // copy propio por red: { instagram: "...", linkedin: "..." }
  const [genRedBusy, setGenRedBusy] = useState("");
  const [langRed, setLangRed] = useState({});      // idioma por red: { bluesky: "en", ... }
  const langDe = (netId) => langRed[netId] || ((netId || "").toLowerCase().includes("bluesky") ? "en" : "es");
  const [subtabInterno, setSubtabInterno] = useState("crear");   // crear | publicar | publicaciones | guardados
  const subtab = subtabProp !== undefined ? subtabProp : subtabInterno;   // controlado desde EstudioUnificado si viene por prop
  const setSubtab = setSubtabProp || setSubtabInterno;
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaUrls, setMediaUrls] = useState([]);   // varias imágenes = carrusel
  const [mediaType, setMediaType] = useState("image");
  const [fechaProg, setFechaProg] = useState("");
  const [pubBusy, setPubBusy] = useState(false);
  const [postizInts, setPostizInts] = useState([]);
  const [postizOn, setPostizOn] = useState(false);
  // Tendencias del nicho (YouTube outliers) · persistidas y COMPARTIDAS con Estudio YT
  const ideas = data.siemon.ideasTendencia || [];
  const setIdeas = (arr) => commit({ ...data, siemon: { ...data.siemon, ideasTendencia: arr } });
  const [ideasBusy, setIdeasBusy] = useState(false);
  const publicaciones = (data.siemon.publicaciones) || [];
  const [temaTend, setTemaTend] = useState("");   // término personalizado para buscar tendencias
  const [tendRO, setTendRO] = useState(true);     // readonly hasta enfocar: bloquea el autofill de Chrome
  const [mediaRO, setMediaRO] = useState(true);
  const [subiendo, setSubiendo] = useState(false);
  // sube imagen/video local al servidor y rellena la URL (máx 12 MB, límite del motor)
  async function subirMedio(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    const esVideo = file.type.startsWith("video");
    if (!esVideo && file.size > 12 * 1024 * 1024) return flash("Máximo 12 MB para imágenes.");
    if (esVideo && file.size > 200 * 1024 * 1024) return flash("Máximo 200 MB. Recorta el video primero (Editor de video).");
    setSubiendo(true);
    if (esVideo) flash("Subiendo y comprimiendo el video… puede tardar un momento.");
    try {
      const dataUrl = await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsDataURL(file); });
      const ext = (file.name.split(".").pop() || (esVideo ? "mp4" : "png")).toLowerCase();
      const r = await fetch(MOTOR + "/gc/subir", { method: "POST", headers: { "content-type": "application/json", Authorization: "Bearer " + getToken() }, body: JSON.stringify({ data: dataUrl, ext }) });
      const d = await r.json();
      if (d.ok && d.url) { setMediaUrl(d.url); setMediaType(esVideo ? "video" : "image"); setMediaRO(false); flash(esVideo ? (d.comprimido ? "Video subido y comprimido ✓" : "Video subido ✓") : "Archivo subido ✓"); }
      else flash("No pude subir el archivo.");
    } catch { flash("No pude subir el archivo."); }
    finally { setSubiendo(false); }
  }
  // pilares de tendencia (compartidos con Estudio YT vía data.siemon.pilaresTendencia)
  const PILARES_DEF = [
    { es: "IA y automatización para negocios", en: "AI automation for small business" },
    { es: "emprender y escalar negocios de servicios", en: "scaling a service business" },
    { es: "productividad e IA aplicada", en: "AI productivity tools workflow" },
  ];
  const pilaresTend = (data.siemon.pilaresTendencia && data.siemon.pilaresTendencia.length) ? data.siemon.pilaresTendencia : PILARES_DEF;
  const [showPil, setShowPil] = useState(false);
  const [pilEdit, setPilEdit] = useState(pilaresTend.map((p) => ({ ...p })));
  const [tradPilar, setTradPilar] = useState(-1);
  async function traducirPilar(i, es) {
    const t = (es || "").trim();
    if (!t) return;
    setTradPilar(i);
    try {
      const r = await fetch(MOTOR + "/traducir", { method: "POST", headers: { "content-type": "application/json", Authorization: "Bearer " + getToken() }, body: JSON.stringify({ texto: t, destino: "en" }) });
      const d = await r.json();
      if (d.ok && d.texto) setPilEdit((arr) => arr.map((x, j) => j === i ? { ...x, en: d.texto } : x));
    } catch {}
    finally { setTradPilar(-1); }
  }
  function guardarPilares() {
    const limpios = pilEdit.filter((p) => (p.es || "").trim() || (p.en || "").trim()).map((p) => ({ es: (p.es || "").trim(), en: (p.en || "").trim() || (p.es || "").trim() }));
    commit({ ...data, siemon: { ...data.siemon, pilaresTendencia: limpios } });
    setShowPil(false); flash("Pilares guardados. Vuelve a buscar tendencias.");
  }
  // ver / editar guardados y publicaciones
  const [verId, setVerId] = useState("");
  const [editId, setEditId] = useState("");
  const [editTxt, setEditTxt] = useState("");

  function copiarTexto(t) { try { navigator.clipboard.writeText(t || ""); flash("Copiado."); } catch {} }
  function reutilizar(texto, mUrl, mType) {
    setSalida(texto || ""); if (mUrl) { setMediaUrl(mUrl); setMediaType(mType || "image"); }
    flash("Cargado arriba. Edita, programa o publica.");
    try { window.scrollTo({ top: 0, behavior: "smooth" }); } catch {}
  }
  function guardarEdicion(id, lista, clave) {
    const nueva = (data.siemon[clave] || []).map((x) => x.id === id ? { ...x, texto: editTxt } : x);
    commit({ ...data, siemon: { ...data.siemon, [clave]: nueva } });
    setEditId(""); flash("Cambios guardados.");
  }
  function borrarPub(id) { commit({ ...data, siemon: { ...data.siemon, publicaciones: publicaciones.filter((x) => x.id !== id) } }); flash("Publicación eliminada."); }

  async function buscarIdeas() {
    setIdeasBusy(true);
    try {
      // pilares: tu término personalizado si lo escribiste, o tus pilares guardados, o generales
      const pilares = temaTend.trim()
        ? [{ es: temaTend.trim(), en: temaTend.trim() }]
        : ((data.siemon.pilaresTendencia && data.siemon.pilaresTendencia.length) ? data.siemon.pilaresTendencia : undefined);
      const r = await fetch(MOTOR + "/ideas", {
        method: "POST", headers: { "content-type": "application/json", Authorization: "Bearer " + getToken() },
        body: JSON.stringify({ idiomas: ["es", "en"], pilares, n: 14 }),
      });
      const d = await r.json();
      if (d.ok && Array.isArray(d.ideas)) setIdeas(d.ideas);
      else flash(d.error === "sin_clave_youtube" ? "Falta la clave de YouTube en el servidor." : "No pude traer tendencias.");
    } catch { flash("No pude conectar con el motor de tendencias."); }
    finally { setIdeasBusy(false); }
  }
  function usarIdea(it) {
    setTipo("guion"); setTema(it.titulo);
    flash("Idea cargada. Modela el ángulo (no copiar) y genera.");
    try { window.scrollTo({ top: 0, behavior: "smooth" }); } catch {}
  }

  // medio que llega del estudio (Publicar →): precarga la URL y el texto, y abre el publicador
  useEffect(() => {
    if (!pubDraft) return;
    if (pubDraft.mediaUrl) setMediaUrl(pubDraft.mediaUrl);
    setMediaUrls(pubDraft.mediaUrls && pubDraft.mediaUrls.length ? pubDraft.mediaUrls : []);
    if (pubDraft.mediaType) setMediaType(pubDraft.mediaType);
    if (pubDraft.texto) setSalida(pubDraft.texto);
    if (pubDraft.tema) setTema(pubDraft.tema);   // la pieza lleva su tema → el copy por red ya entiende de qué va
    setSubtab("publicar");
    flash("Pieza cargada del estudio. Elige redes, ajusta el copy y publica.");
    try { clearPubDraft && clearPubDraft(); } catch {}
    // eslint-disable-next-line
  }, [pubDraft]);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(MOTOR + "/redes/integraciones", { headers: { Authorization: "Bearer " + getToken() } });
        const d = await r.json();
        if (d.conectado && Array.isArray(d.integraciones) && d.integraciones.length) {
          setPostizInts(d.integraciones); setPostizOn(true);
        }
      } catch {}
    })();
  }, []);

  // catálogo fijo: TODAS las redes visibles siempre; las conectadas en Postiz quedan activas
  const CATALOGO = [
    { id: "instagram", label: "Instagram" }, { id: "facebook", label: "Facebook" },
    { id: "linkedin", label: "LinkedIn" }, { id: "x", label: "X (Twitter)" },
    { id: "threads", label: "Threads" }, { id: "tiktok", label: "TikTok" },
    { id: "youtube", label: "YouTube" }, { id: "bluesky", label: "Bluesky" },
    { id: "pinterest", label: "Pinterest" },
  ];
  const redesPub = (() => {
    const usados = new Set();
    const lista = CATALOGO.map((c) => {
      const m = postizInts.find((i) => { const r = (i.red || "").toLowerCase(); return r === c.id || r.includes(c.id) || c.id.includes(r); });
      if (m) usados.add(m.id);
      return { ...c, integrationId: m ? m.id : "", conectada: !!m, label: c.label };
    });
    // cuentas de Postiz que no están en el catálogo (ej. mastodon) se agregan al final
    postizInts.filter((i) => !usados.has(i.id)).forEach((i) => lista.push({ id: (i.red || "").toLowerCase(), label: i.nombre || i.red, integrationId: i.id, conectada: true }));
    return lista;
  })();

  // por defecto, selecciona la PRIMERA red conectada (no Instagram sin conectar). Solo una vez.
  useEffect(() => {
    if (selInit.current) return;
    const idx = redesPub.findIndex((n) => n.conectada);
    if (idx >= 0) { setSelRedes([idx]); selInit.current = true; }
    // eslint-disable-next-line
  }, [redesPub.map((n) => n.id + (n.conectada ? "1" : "0")).join(",")]);

  async function generar(opts = {}) {
    const t = opts.tipo || tipo;
    const base = opts.base || "";
    setBusy(true); if (!opts.base) setSalida(""); setCopiado(false);
    try {
      const r = await fetch(MOTOR + "/generar_contenido", {
        method: "POST", headers: { "content-type": "application/json", Authorization: "Bearer " + getToken() },
        body: JSON.stringify({ red, tipo: t, tema, idioma, base, redes: t === "copys_redes" ? ["Instagram", "LinkedIn", "Facebook", "X", "TikTok", "YouTube"] : undefined }),
      });
      const d = await r.json();
      setSalida(d.contenido || (d.error === "sin_clave" ? "Falta la clave de Claude en el servidor." : "No pude generar. Intenta de nuevo."));
      if (d.contenido && tema.trim()) guardarOpcion(data, commit, "temaContenido", tema, TEMAS_PRESET);   // aprende tu tema
    } catch { setSalida("No pude conectar con el motor."); }
    finally { setBusy(false); }
  }
  function copiar() { try { navigator.clipboard.writeText(salida); setCopiado(true); flash("Contenido copiado."); } catch {} }
  function guardar() {
    if (!salida.trim()) return;
    const item = { id: uid(), red, tipo, tema, idioma, texto: salida, fecha: today() };
    commit({ ...data, siemon: { ...data.siemon, contenidos: [item, ...guardados] } });
    flash("Contenido guardado.");
  }
  function borrar(id) { commit({ ...data, siemon: { ...data.siemon, contenidos: guardados.filter((x) => x.id !== id) } }); }

  const capd = (s) => (s || "").charAt(0).toUpperCase() + (s || "").slice(1);
  const leads = data.siemon.leads || [];
  const leadsDe = (p) => leads.filter((l) => {
    const uc = (l.utm_campaign || l.utmCampaign || "");
    const f = (l.fuente || "").toLowerCase();
    return (p.utmCampaign && uc === p.utmCampaign) || (p.red && f === p.red.toLowerCase() && (l.createdAt || "") >= (p.fecha || ""));
  });
  // redes seleccionadas (multi): solo las conectadas publican. Por defecto, la primera conectada.
  const netsSel = () => {
    const arr = selRedes.map((i) => redesPub[i]).filter(Boolean).filter((n) => n.conectada);
    if (arr.length) return arr;
    const first = redesPub.find((n) => n.conectada);
    return first ? [first] : [];
  };
  const netsSeleccionadas = () => selRedes.map((i) => redesPub[i]).filter(Boolean);
  const textoDe = (net) => (copysRed[net.id] && copysRed[net.id].trim()) ? copysRed[net.id] : salida;
  async function generarRed(netId, label) {
    if (!tema.trim()) return flash("Escribe el tema arriba primero.");
    setGenRedBusy(netId);
    const idiomaRed = langDe(netId);   // idioma elegido por red (Bluesky arranca en inglés)
    try {
      const r = await fetch(MOTOR + "/generar_contenido", {
        method: "POST", headers: { "content-type": "application/json", Authorization: "Bearer " + getToken() },
        body: JSON.stringify({ red: netId, tipo: "post", tema, idioma: idiomaRed }),
      });
      const d = await r.json();
      if (d.contenido) setCopysRed((m) => ({ ...m, [netId]: d.contenido }));
      else flash(d.error === "sin_clave" ? "Falta la clave de Claude en el servidor." : "No pude generar para " + label + ".");
    } catch { flash("No pude conectar con el motor."); }
    finally { setGenRedBusy(""); }
  }
  async function generarTodasRed() {
    const nets = netsSeleccionadas();
    if (!nets.length) return flash("Elige al menos una red.");
    if (!tema.trim()) return flash("Escribe el tema arriba primero.");
    for (const net of nets) { /* eslint-disable-next-line no-await-in-loop */ await generarRed(net.id, net.label || net.id); }
  }
  function mkItem(net, estado, extra = {}) {
    const id = uid();
    const utmCampaign = "pub_" + id.slice(0, 8);
    const link = `https://siemondigital.com/?utm_source=${net.id}&utm_medium=social&utm_campaign=${utmCampaign}`;
    return { id, canales: [net.label || capd(net.id)], red: net.id, texto: extra.texto || salida, estado, fecha: extra.fecha || today(), mediaUrl, mediaType, utmCampaign, link, ...extra };
  }
  async function publicarAhora() {
    const hayTexto = salida.trim() || Object.values(copysRed).some((t) => (t || "").trim());
    if (!hayTexto) return flash("Escribe o genera el texto primero.");
    const nets = netsSel();
    if (!nets.length) return flash("No hay redes conectadas todavía. Conéctalas en Postiz (las grises) y aparecerán activas.");
    setPubBusy(true);
    const nuevos = []; let ok = 0; const errs = [];
    for (const net of nets) {
      const txt = textoDe(net);
      if (!txt.trim()) { errs.push((net.label || net.id) + ": sin texto"); continue; }
      if ((net.id || "").includes("instagram") && !mediaUrl.trim() && !mediaUrls.length) { errs.push((net.label || net.id) + ": necesita imagen"); continue; }
      try {
        const r = await fetch(MOTOR + "/publicar", { method: "POST", headers: { "content-type": "application/json", Authorization: "Bearer " + getToken() },
          body: JSON.stringify({ red: net.id, integrationId: net.integrationId || "", texto: txt, mediaUrl, mediaUrls: mediaUrls.length ? mediaUrls : undefined, mediaType, titulo: tema, when: "now", date: "" }) });
        const d = await r.json();
        if (d.ok) { ok++; nuevos.push(mkItem(net, "Publicada", { refId: d.id || "", texto: txt })); }
        else errs.push((net.label || net.id) + ": " + (d.error || "error"));
      } catch { errs.push((net.label || net.id) + ": sin conexión"); }
    }
    if (nuevos.length) commit({ ...data, siemon: { ...data.siemon, publicaciones: [...nuevos, ...publicaciones] } });
    setPubBusy(false);
    if (ok) { setSubtab("publicaciones"); setMediaUrl(""); setMediaUrls([]); setCopysRed({}); }
    flash(ok ? `Publicado en ${ok} red(es). Aparece en Publicaciones (tarda 1-2 min en salir en la red).${errs.length ? " Fallaron: " + errs.join(" · ") : ""}` : "No se publicó. " + errs.join(" · "));
  }
  async function programar() {
    const hayTexto = salida.trim() || Object.values(copysRed).some((t) => (t || "").trim());
    if (!hayTexto) return flash("Escribe o genera el texto primero.");
    if (!fechaProg) return flash("Elige la fecha para programar.");
    const nets = netsSel();
    if (!nets.length) return flash("Elige al menos una red.");
    const iso = new Date(fechaProg + "T09:00:00").toISOString();
    setPubBusy(true);
    const nuevos = []; let ok = 0; const errs = [];
    for (const net of nets) {
      const txt = textoDe(net);
      if (!txt.trim()) { errs.push((net.label || net.id) + ": sin texto"); continue; }
      if (!postizOn) { nuevos.push(mkItem(net, "Programada", { fecha: fechaProg, texto: txt })); ok++; continue; }
      try {
        const r = await fetch(MOTOR + "/publicar", { method: "POST", headers: { "content-type": "application/json", Authorization: "Bearer " + getToken() },
          body: JSON.stringify({ red: net.id, integrationId: net.integrationId || "", texto: txt, mediaUrl, mediaUrls: mediaUrls.length ? mediaUrls : undefined, mediaType, titulo: tema, when: "schedule", date: iso }) });
        const d = await r.json();
        if (d.ok) { ok++; nuevos.push(mkItem(net, "Programada", { fecha: fechaProg, texto: txt })); }
        else errs.push((net.label || net.id) + ": " + (d.error || "error"));
      } catch { errs.push((net.label || net.id) + ": sin conexión"); }
    }
    if (nuevos.length) commit({ ...data, siemon: { ...data.siemon, publicaciones: [...nuevos, ...publicaciones] } });
    setPubBusy(false);
    if (ok) { setSubtab("publicaciones"); setMediaUrl(""); setMediaUrls([]); setCopysRed({}); }
    flash(ok ? `Programado en ${ok} red(es) para ${fechaProg}.${!postizOn ? " (se enviarán al conectar Postiz)" : ""}${errs.length ? " Fallaron: " + errs.join(" · ") : ""}` : "No se programó. " + errs.join(" · "));
  }

  return (
    <div style={{ maxWidth: 1100 }}>
      {!ocultarBarra && (
      <div className="mb-5">
        <div style={{ color: C.aether500, fontFamily: MONO, letterSpacing: "0.2em" }} className="fs-10 uppercase mb-2"><span style={{ color: C.aether }}>// </span>Contenido y Ads</div>
        <h1 style={{ fontWeight: 600, color: C.cream }} className="fs-24 flex items-center gap-2"><Wand2 size={20} color={C.aether} /> Crea contenido y anuncios en tu voz</h1>
        <div style={{ color: C.ash }} className="fs-11 mt-1">Genera posts, guiones, carruseles, calendarios y campañas de ads (Meta, Google, YouTube, LinkedIn, TikTok, X) con la marca Siemon. Edítalo, guárdalo y publícalo.</div>
      </div>
      )}

      {!ocultarBarra && (
      <div className="flex flex-wrap gap-2 mb-5">
        {[["crear", "1 · Investigar"], ["publicar", "2 · Publicar en redes"], ["publicaciones", "Publicaciones"], ["guardados", "Guardados"]].map(([id, lb]) => (
          <button key={id} onClick={() => setSubtab(id)} style={{ background: subtab === id ? C.aetherSoft : C.panel, border: `1px solid ${subtab === id ? C.aetherLine : C.line}`, color: subtab === id ? C.aether2 : C.mist }} className="px-3.5 py-2 rounded-lg fs-12 font-medium">{lb}{id === "publicaciones" && publicaciones.length > 0 ? ` · ${publicaciones.length}` : ""}{id === "guardados" && guardados.length > 0 ? ` · ${guardados.length}` : ""}</button>
        ))}
      </div>
      )}

      {subtab === "crear" && (<>
      <div style={{ color: C.ash }} className="fs-12 mb-5 leading-snug">Explora las <b style={{ color: C.mist }}>tendencias reales</b> de tu nicho (videos que rinden por encima de su base de seguidores = demanda real). Elige una idea con <b style={{ color: C.aether2 }}>“Usar esta idea”</b> o pásala a <b style={{ color: C.aether2 }}>Diseño / Imagen</b>. Luego ve a <b style={{ color: C.aether2 }}>“2 · Publicar en redes”</b> para escribir el copy por red y publicar.</div>

      <div style={{ background: C.panel, border: `1px solid ${C.line}` }} className="rounded-xl p-4 md:p-5 mb-5">
        <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
          <div style={{ color: C.aether500, fontFamily: MONO, letterSpacing: "0.16em" }} className="fs-10 uppercase flex items-center gap-1.5"><TrendingUp size={12} color={C.aether} /> Tendencias · YouTube</div>
          <div className="flex items-center gap-2 flex-1 justify-end" style={{ minWidth: 260 }}>
            <input name="tend-libre-xy" autoComplete="off" spellCheck={false} readOnly={tendRO} onFocus={() => setTendRO(false)} value={temaTend} onChange={(e) => setTemaTend(e.target.value)} onKeyDown={(e) => e.key === "Enter" && buscarIdeas()} placeholder="Tema a buscar (vacío = tus pilares)" style={{ ...inS, maxWidth: 320, fontSize: 12, padding: "8px 10px" }} />
            <button onClick={() => { setPilEdit(pilaresTend.map((p) => ({ ...p }))); setShowPil((v) => !v); }} style={{ color: showPil ? C.aether2 : C.mist, border: `1px solid ${C.aetherLine}` }} className="px-2.5 py-1.5 rounded-lg fs-11 shrink-0">{showPil ? "Cerrar" : "Pilares"}</button>
            <button onClick={buscarIdeas} disabled={ideasBusy} style={{ background: ideas.length ? "transparent" : C.aether, color: ideas.length ? C.aether2 : C.obsidian, border: `1px solid ${C.aetherLine}`, fontWeight: 600, opacity: ideasBusy ? 0.6 : 1 }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg fs-12 shrink-0">{ideasBusy ? <RefreshCw size={13} className="animate-spin" /> : <TrendingUp size={13} />}{ideasBusy ? "Buscando…" : ideas.length ? "Actualizar" : "Buscar"}</button>
          </div>
        </div>
        {showPil && (
          <div style={{ background: C.carbon, border: `1px solid ${C.line}` }} className="rounded-lg p-3 mb-3">
            <div style={{ color: C.ash }} className="fs-10 mb-2">Tus pilares de búsqueda (español e inglés). Son los mismos del Estudio YT.</div>
            {pilEdit.map((p, i) => (
              <div key={i} className="flex items-center gap-2 mb-1.5">
                <input value={p.es} onChange={(e) => setPilEdit(pilEdit.map((x, j) => j === i ? { ...x, es: e.target.value } : x))} onBlur={() => traducirPilar(i, p.es)} placeholder="término en español" style={{ ...inS, fontSize: 12, padding: "7px 10px" }} />
                <input value={p.en} onChange={(e) => setPilEdit(pilEdit.map((x, j) => j === i ? { ...x, en: e.target.value } : x))} placeholder={tradPilar === i ? "traduciendo…" : "term in english (se traduce solo)"} style={{ ...inS, fontSize: 12, padding: "7px 10px" }} />
                <button onClick={() => setPilEdit(pilEdit.filter((_, j) => j !== i))} style={{ color: C.ash }} className="fs-11 shrink-0">✕</button>
              </div>
            ))}
            <div className="flex items-center gap-2 mt-2">
              <button onClick={() => setPilEdit([...pilEdit, { es: "", en: "" }])} style={{ color: C.aether2, border: `1px solid ${C.aetherLine}` }} className="px-2.5 py-1 rounded fs-11">+ pilar</button>
              <button onClick={guardarPilares} style={{ background: C.aether, color: C.obsidian, fontWeight: 600 }} className="px-3 py-1 rounded fs-11">Guardar pilares</button>
            </div>
          </div>
        )}
        {ideas.length === 0 && !ideasBusy && <div style={{ color: C.ash }} className="fs-11">Lo más demandado en tu nicho ahora mismo (videos que rinden por encima de su base de seguidores = demanda real). Modela el ángulo, no copies.</div>}
        {ideas.length > 0 && (
          <div className="grid sm:grid-cols-2 gap-2.5">
            {ideas.map((it, i) => (
              <div key={i} style={{ background: C.carbon, border: `1px solid ${C.line}` }} className="rounded-lg p-3 flex flex-col gap-2">
                <div className="flex items-start gap-2">
                  <span title="Índice de demanda (vistas vs seguidores)" style={{ background: (it.score || it.outlier) >= 200 ? C.aetherSoft : "rgba(255,255,255,0.05)", border: `1px solid ${(it.score || it.outlier) >= 200 ? C.aetherLine : C.line}`, color: (it.score || it.outlier) >= 200 ? C.aether2 : C.ash, fontFamily: MONO }} className="px-1.5 py-0.5 rounded fs-10 shrink-0">{(it.score || it.outlier) >= 500 ? "🔥" : ""}{it.score || it.outlier}</span>
                  <span style={{ background: "rgba(255,255,255,0.05)", border: `1px solid ${C.line}`, color: C.ash, fontFamily: MONO }} className="px-1 py-0.5 rounded fs-9 shrink-0 uppercase">{it.idioma || "es"}</span>
                  <div style={{ color: C.cream }} className="fs-12 leading-snug">{it.titulo}</div>
                </div>
                <div style={{ color: C.ash, fontFamily: MONO }} className="fs-9 flex items-center gap-2 flex-wrap"><Youtube size={11} color={C.ash} />{it.canal} · {Number(it.vistas).toLocaleString()} vistas · {Number(it.subs).toLocaleString()} subs</div>
                <div className="flex items-center gap-3">
                  <button onClick={() => usarIdea(it)} style={{ color: C.aether2 }} className="inline-flex items-center gap-1 fs-11 font-medium">Usar esta idea <ArrowRight size={12} /></button>
                  {irAEstudio && <button onClick={() => irAEstudio({ titulo: it.titulo, modo: "diseno", prompt: it.titulo })} style={{ color: C.aether2 }} className="inline-flex items-center gap-1 fs-11 font-medium">🎨 Diseño <ArrowRight size={12} /></button>}
                  {irAEstudio && <button onClick={() => irAEstudio({ titulo: it.titulo, modo: "fal", prompt: it.titulo })} style={{ color: C.aether2 }} className="inline-flex items-center gap-1 fs-11 font-medium">📸 Imagen/Video <ArrowRight size={12} /></button>}
                  <a href={it.url} target="_blank" rel="noreferrer" style={{ color: C.ash }} className="fs-10">ver</a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      </>)}

      {subtab === "publicar" && (
        <div style={{ background: C.panel, border: `1px solid ${C.aetherLine}` }} className="rounded-xl p-4 mb-6">
          <div style={{ color: C.aether500, fontFamily: MONO, letterSpacing: "0.16em" }} className="fs-10 uppercase mb-3 flex items-center gap-1.5"><Share2 size={12} color={C.aether} /> Publicar en redes {postizOn ? <span style={{ color: C.ok }} className="normal-case">· Postiz conectado</span> : <span style={{ color: C.ash }} className="normal-case">· IG/FB nativo</span>}</div>
          <div className="mb-3">
            <label style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase">Tema de la pieza · el copy por red se genera sobre esto</label>
            <input style={inS} value={tema} onChange={(e) => setTema(e.target.value)} placeholder="ej. Solo 1 de cada 8 empresas capitaliza la IA…" />
          </div>
          <div>
            <label style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase">Redes (elige una o varias · las grises aún no están conectadas)</label>
            <div className="flex flex-wrap gap-2 mt-1.5">
              {redesPub.map((x, i) => {
                const on = selRedes.includes(i);
                if (!x.conectada) return (
                  <button key={i} onClick={() => { flash(x.label + " aún no está conectada. Conéctala en Postiz (publicar.siemondigital.com → Add Channel) y aparecerá activa aquí."); window.open("https://publicar.siemondigital.com/launches", "_blank"); }}
                    title="Sin conectar · clic para conectar en Postiz"
                    style={{ background: "transparent", border: `1px dashed ${C.line}`, color: C.ash, opacity: 0.7 }} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg fs-12">{x.label} <span className="fs-9">· conectar</span></button>
                );
                return (
                  <button key={i} onClick={() => toggleRed(i)} style={{ background: on ? C.aetherSoft : C.carbon, border: `1px solid ${on ? C.aetherLine : C.line}`, color: on ? C.aether2 : C.mist }} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg fs-12">{on && <Check size={12} />}{x.label}</button>
                );
              })}
            </div>
          </div>
          {selRedes.length > 0 && (
            <div className="mt-4 flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <label style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase">Copy por red · genera, edita o déjalo así</label>
                <button onClick={generarTodasRed} disabled={!!genRedBusy} style={{ color: C.aether2, opacity: genRedBusy ? 0.6 : 1 }} className="fs-10 inline-flex items-center gap-1"><Sparkles size={11} /> {genRedBusy ? "generando…" : "Generar todas"}</button>
              </div>
              {netsSeleccionadas().map((net) => (
                <div key={net.id} style={{ background: C.carbon, border: `1px solid ${C.line}` }} className="rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1.5 gap-2">
                    <span style={{ color: C.aether2, fontWeight: 600 }} className="fs-12 inline-flex items-center gap-1.5">{net.label || net.id}{!net.conectada && <span style={{ color: C.ash, fontFamily: MONO }} className="fs-9 normal-case">· sin conectar (para copiar)</span>}</span>
                    <div className="flex items-center gap-2.5 shrink-0">
                      {copysRed[net.id] && <button onClick={() => copiarTexto(copysRed[net.id])} title="Copiar" style={{ color: C.aether2 }} className="fs-10 inline-flex items-center gap-1"><Copy size={11} /> copiar</button>}
                      <div className="inline-flex rounded-md overflow-hidden" style={{ border: `1px solid ${C.line}` }}>
                        {["es", "en"].map((lg) => { const on = langDe(net.id) === lg; return (
                          <button key={lg} onClick={() => setLangRed((m) => ({ ...m, [net.id]: lg }))} style={{ background: on ? C.aetherSoft : "transparent", color: on ? C.aether2 : C.ash, fontFamily: MONO }} className="fs-9 px-1.5 py-0.5 uppercase">{lg}</button>
                        ); })}
                      </div>
                      <button onClick={() => generarRed(net.id, net.label || net.id)} disabled={genRedBusy === net.id} style={{ color: C.aether2, opacity: genRedBusy === net.id ? 0.6 : 1 }} className="fs-10 inline-flex items-center gap-1"><Sparkles size={11} /> {genRedBusy === net.id ? "generando…" : (copysRed[net.id] ? "regenerar" : "generar")}</button>
                    </div>
                  </div>
                  <textarea value={copysRed[net.id] || ""} onChange={(e) => setCopysRed((m) => ({ ...m, [net.id]: e.target.value }))} placeholder={`Copy para ${net.label || net.id}. Pulsa "generar" o escríbelo tú.`} style={{ ...inS, minHeight: 88, whiteSpace: "pre-wrap", lineHeight: 1.5 }} />
                </div>
              ))}
              <div style={{ color: C.ash }} className="fs-10 leading-snug">Cada red publica su propio copy. Si dejas un recuadro vacío, esa red usa el texto general de arriba.</div>
            </div>
          )}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-3">
            <div><label style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase">Tipo de medio</label>
              <select style={inS} value={mediaType} onChange={(e) => setMediaType(e.target.value)}><option value="image">Imagen</option><option value="video">Video / Reel</option></select></div>
            <div className="col-span-2"><label style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase flex items-center gap-1"><ImageIcon size={11} /> Imagen o video{selRedes.some((i) => (redesPub[i]?.id || "").includes("instagram")) ? " (obligatorio para Instagram)" : " (opcional)"}</label>
              {mediaUrls.length > 1 && (
                <div style={{ background: C.aetherSoft, border: `1px solid ${C.aetherLine}` }} className="rounded-lg p-2 mb-1.5 flex items-center gap-2 flex-wrap">
                  <span style={{ color: C.aether2, fontWeight: 600 }} className="fs-11">🎠 Carrusel · {mediaUrls.length} láminas</span>
                  <div className="flex gap-1 overflow-x-auto">
                    {mediaUrls.slice(0, 8).map((u, i) => <img key={i} src={u} alt="" style={{ height: 34, borderRadius: 4, border: `1px solid ${C.line}` }} />)}
                  </div>
                  <button onClick={() => setMediaUrls([])} style={{ color: C.ash }} className="fs-10 ml-auto">quitar</button>
                </div>
              )}
              <div className="flex items-stretch gap-2">
                <input style={inS} name="media-src-xy" autoComplete="off" spellCheck={false} readOnly={mediaRO} onFocus={() => setMediaRO(false)} value={mediaUrl} onChange={(e) => setMediaUrl(e.target.value)} placeholder="Llega solo del Estudio con Publicar →, o pega una URL, o sube un archivo" />
                <label title="Subir imagen o video desde tu computador" style={{ background: C.carbon, border: `1px solid ${C.aetherLine}`, color: C.aether2, cursor: "pointer" }} className="flex items-center gap-1.5 px-3 rounded-lg fs-12 shrink-0">
                  {subiendo ? "Subiendo…" : "Subir"}
                  <input type="file" accept="image/*,video/*" style={{ display: "none" }} disabled={subiendo} onChange={subirMedio} />
                </label>
              </div></div>
          </div>
          <div className="flex flex-wrap items-center gap-3 mt-4">
            <button onClick={publicarAhora} disabled={pubBusy} style={{ background: C.aether, color: C.obsidian, fontWeight: 600, opacity: pubBusy ? 0.6 : 1 }} className="flex items-center gap-2 px-4 py-2.5 rounded-lg fs-13"><Send size={15} strokeWidth={2.3} />{pubBusy ? "Publicando…" : "Publicar ahora"}</button>
            <div className="flex items-center gap-2">
              <input type="date" value={fechaProg} onChange={(e) => setFechaProg(e.target.value)} style={{ ...inS, width: "auto", padding: "8px 10px" }} />
              <button onClick={programar} style={{ background: "transparent", border: `1px solid ${C.aetherLine}`, color: C.aether2, fontWeight: 600 }} className="flex items-center gap-2 px-3.5 py-2.5 rounded-lg fs-13"><Clock size={14} /> Programar</button>
            </div>
          </div>
          <div style={{ color: C.ash }} className="fs-10 mt-2 leading-snug">{postizOn ? "Publicas y agendas en todas tus redes conectadas en Postiz." : "Instagram y Facebook publican con tu API nativa. Al conectar Postiz aparecerán aquí LinkedIn, X, YouTube, TikTok y más."}</div>
        </div>
      )}

      {subtab === "publicaciones" && publicaciones.length === 0 && <div style={{ color: C.ash, background: C.panel, border: `1px solid ${C.line}` }} className="rounded-xl p-6 fs-12 text-center mb-6">Aún no has publicado nada. Ve a "2 · Publicar en redes".</div>}
      {subtab === "publicaciones" && publicaciones.length > 0 && (
        <div className="mb-6">
          <div style={{ color: C.aether500, fontFamily: MONO, letterSpacing: "0.2em" }} className="fs-10 uppercase mb-2"><span style={{ color: C.aether }}>// </span>Publicaciones</div>
          <div className="flex flex-col gap-2">
            {publicaciones.slice(0, 20).map((p) => {
              const nl = leadsDe(p).length;
              const editando = editId === p.id; const abierto = verId === p.id;
              return (
              <div key={p.id} style={{ background: C.panel, border: `1px solid ${C.line}` }} className="rounded-xl p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    {editando ? (
                      <>
                        <textarea value={editTxt} onChange={(e) => setEditTxt(e.target.value)} style={{ ...inS, minHeight: 90, whiteSpace: "pre-wrap" }} />
                        <div className="flex items-center gap-3 mt-1.5"><button onClick={() => guardarEdicion(p.id, publicaciones, "publicaciones")} style={{ color: C.ok }} className="fs-11">Guardar</button><button onClick={() => setEditId("")} style={{ color: C.ash }} className="fs-11">Cancelar</button></div>
                      </>
                    ) : (
                      <div style={{ color: C.mist, whiteSpace: "pre-wrap" }} className="fs-12 leading-snug">{abierto ? p.texto : (p.texto || "").slice(0, 140) + ((p.texto || "").length > 140 ? "…" : "")}</div>
                    )}
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">{(p.canales || []).map((c) => <span key={c} style={{ background: "rgba(255,255,255,0.05)", border: `1px solid ${C.line}`, color: C.ash, fontFamily: MONO }} className="px-1.5 py-0.5 rounded fs-9">{c}</span>)}
                      <span style={{ color: p.estado === "Publicada" ? C.ok : C.aether2, fontFamily: MONO }} className="fs-9">{p.estado}</span>
                      <span style={{ color: C.ash, fontFamily: MONO }} className="fs-9">{p.fecha}</span></div>
                    {p.link && <button onClick={() => { try { navigator.clipboard.writeText(p.link); flash("Enlace UTM copiado."); } catch {} }} title={p.link} style={{ color: C.aether500, fontFamily: MONO }} className="fs-9 mt-1 inline-flex items-center gap-1 hover:brightness-125"><Copy size={9} /> enlace rastreable</button>}
                    {!editando && (
                      <div className="flex items-center gap-3 mt-2 flex-wrap">
                        {(p.texto || "").length > 140 && <button onClick={() => setVerId(abierto ? "" : p.id)} style={{ color: C.aether2 }} className="fs-10">{abierto ? "ver menos" : "ver completo"}</button>}
                        <button onClick={() => copiarTexto(p.texto)} style={{ color: C.aether2 }} className="fs-10 inline-flex items-center gap-1"><Copy size={10} /> Copiar</button>
                        <button onClick={() => { setEditId(p.id); setEditTxt(p.texto || ""); }} style={{ color: C.aether2 }} className="fs-10 inline-flex items-center gap-1"><Pencil size={10} /> Editar</button>
                        <button onClick={() => reutilizar(p.texto, p.mediaUrl, p.mediaType)} style={{ color: C.aether2 }} className="fs-10 inline-flex items-center gap-1"><RefreshCw size={10} /> Republicar / programar</button>
                        <button onClick={() => borrarPub(p.id)} style={{ color: C.ash }} className="fs-10 inline-flex items-center gap-1"><Trash2 size={10} /> Borrar</button>
                      </div>
                    )}
                  </div>
                  <div style={{ color: nl ? C.ok : C.ash, fontFamily: MONO }} className="fs-10 shrink-0 text-right whitespace-nowrap">{nl} lead{nl === 1 ? "" : "s"}<div style={{ color: C.ash }} className="fs-8">atribuidos</div></div>
                </div>
              </div>
            ); })}
          </div>
        </div>
      )}

      {subtab === "guardados" && guardados.length === 0 && <div style={{ color: C.ash, background: C.panel, border: `1px solid ${C.line}` }} className="rounded-xl p-6 fs-12 text-center">No tienes borradores guardados todavía. Genera contenido y pulsa "Guardar".</div>}
      {subtab === "guardados" && guardados.length > 0 && (
        <div>
          <div style={{ color: C.aether500, fontFamily: MONO, letterSpacing: "0.2em" }} className="fs-10 uppercase mb-2"><span style={{ color: C.aether }}>// </span>Guardados</div>
          <div className="flex flex-col gap-2.5">
            {guardados.map((x) => {
              const editando = editId === x.id; const abierto = verId === x.id;
              return (
              <div key={x.id} style={{ background: C.panel, border: `1px solid ${C.line}` }} className="rounded-xl p-3.5">
                <div className="flex items-center justify-between mb-1 gap-2">
                  <div style={{ color: C.mist }} className="fs-11 min-w-0 truncate"><b style={{ color: C.aether2 }}>{x.red}</b> · {x.tipo}{x.tema ? " · " + x.tema : ""} <span style={{ color: C.ash }}>{x.fecha}</span></div>
                  <div className="flex items-center gap-2.5 shrink-0">
                    <button onClick={() => copiarTexto(x.texto)} title="Copiar" style={{ color: C.aether2 }}><Copy size={13} /></button>
                    <button onClick={() => { setEditId(x.id); setEditTxt(x.texto); }} title="Editar" style={{ color: C.aether2 }}><Pencil size={13} /></button>
                    <button onClick={() => reutilizar(x.texto)} title="Usar arriba (publicar o programar)" style={{ color: C.aether2 }}><RefreshCw size={13} /></button>
                    <button onClick={() => borrar(x.id)} title="Borrar" style={{ color: C.ash }}><Trash2 size={13} /></button>
                  </div>
                </div>
                {editando ? (
                  <>
                    <textarea value={editTxt} onChange={(e) => setEditTxt(e.target.value)} style={{ ...inS, minHeight: 160, whiteSpace: "pre-wrap", lineHeight: 1.6 }} />
                    <div className="flex items-center gap-3 mt-1.5"><button onClick={() => guardarEdicion(x.id, guardados, "contenidos")} style={{ color: C.ok }} className="fs-11">Guardar cambios</button><button onClick={() => setEditId("")} style={{ color: C.ash }} className="fs-11">Cancelar</button></div>
                  </>
                ) : (
                  <>
                    <div style={{ color: C.mist, whiteSpace: "pre-wrap" }} className="fs-12 leading-snug">{abierto ? x.texto : x.texto.slice(0, 300) + (x.texto.length > 300 ? "…" : "")}</div>
                    {x.texto.length > 300 && <button onClick={() => setVerId(abierto ? "" : x.id)} style={{ color: C.aether2 }} className="fs-10 mt-1.5">{abierto ? "ver menos" : "ver completo"}</button>}
                  </>
                )}
              </div>
            ); })}
          </div>
        </div>
      )}
    </div>
  );
}
