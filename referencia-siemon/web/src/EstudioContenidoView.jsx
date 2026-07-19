import React, { useState, useEffect, useRef } from "react";
import { Clapperboard, Sparkles, Image as ImageIcon, Film, Download, Trash2, Copy, Check, Settings2, KeyRound, RefreshCw, Palette, Code2, Scissors, Layers, Wand2, Search } from "lucide-react";
import { getToken } from "./db";
import EditorImagen from "./EditorImagen.jsx";

const C = {
  obsidian: "#0A0B0D", panel: "#16171C", carbon: "#131418", line: "rgba(255,255,255,0.08)",
  aether: "#B1A3E1", aether2: "#CBC0EC", aether500: "#8474BE", aetherSoft: "rgba(177,163,225,0.14)",
  aetherLine: "rgba(177,163,225,0.30)", cream: "#E9E5DD", mist: "#C9CAD2", ash: "#8B8D98", ok: "#7FB89B", warn: "#D8B673", danger: "#D08A8A",
};
const SANS = "'Montserrat', system-ui, sans-serif";
const MONO = "'JetBrains Mono', ui-monospace, monospace";
const MOTOR = import.meta.env.VITE_MOTOR_URL || "https://prospeccion.siemondigital.com";
const uid = () => (crypto?.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2, 9));
const today = () => new Date().toISOString().slice(0, 10);
const H = () => ({ "content-type": "application/json", Authorization: "Bearer " + getToken() });
// Preview same-origin vía proxy del motor: evita que videos de bancos (Coverr) salgan en negro por CORS/hotlink.
const viaProxy = (u) => (u && /^https?:\/\//.test(u) ? MOTOR + "/gc/proxy?k=" + encodeURIComponent(getToken()) + "&url=" + encodeURIComponent(u) : u);
const inS = { background: "#101116", border: `1px solid ${C.line}`, color: C.cream, borderRadius: 10, padding: "10px 12px", width: "100%", fontFamily: SANS, fontSize: 14, outline: "none" };

export default function EstudioContenidoView({ data, commit, flash, onPublicar, estudioDraft, clearEstudioDraft, irAEditor, embedded }) {
  const [prompt, setPrompt] = useState("");
  const [aspecto, setAspecto] = useState("9:16");
  const [duracion, setDuracion] = useState("5");
  const [imgUrl, setImgUrl] = useState("");
  const [busyImg, setBusyImg] = useState(false);
  const [busyVid, setBusyVid] = useState(false);
  const [editarSrc, setEditarSrc] = useState("");         // imagen abierta en el editor de filtros/texto
  const [bancoQ, setBancoQ] = useState("");
  const [bancoRes, setBancoRes] = useState(null);
  const [bancoBusy, setBancoBusy] = useState(false);
  const [vidQ, setVidQ] = useState("");
  const [vidRes, setVidRes] = useState(null);
  const [vidBusy, setVidBusy] = useState(false);
  const [orientBanco, setOrientBanco] = useState("landscape");   // landscape | portrait | square
  const [fuenteBanco, setFuenteBanco] = useState("todos");       // todos | pexels | pixabay | unsplash | coverr
  const [falOn, setFalOn] = useState(false);
  const [showCfg, setShowCfg] = useState(false);
  const [falKey, setFalKey] = useState("");
  const galeria = data.siemon.gc || [];
  // modo diseño (Claude Design editable)
  const [modo, setModo] = useState("fal");
  const [dTitulo, setDTitulo] = useState("");
  const [dSub, setDSub] = useState("");
  const [dCta, setDCta] = useState("");
  const [dFormato, setDFormato] = useState("1:1");
  const [svg, setSvg] = useState("");
  const [svgDim, setSvgDim] = useState({ w: 1080, h: 1080 });
  const [busyDes, setBusyDes] = useState(false);
  // modo carrusel (varias láminas cohesivas)
  const [cMensaje, setCMensaje] = useState("");
  const [cCta, setCCta] = useState("");
  const [cN, setCN] = useState(5);
  const [cFormato, setCFormato] = useState("4:5");
  const [slides, setSlides] = useState([]);
  const [cIdx, setCIdx] = useState(0);
  const [busyCar, setBusyCar] = useState(false);
  const [carId, setCarId] = useState("");
  const [cEditRaw, setCEditRaw] = useState(false);
  // inspiración de titulares: 4 propuestas con ángulos distintos (no copia, punto de partida)
  const [propuestas, setPropuestas] = useState([]);
  const [busyInsp, setBusyInsp] = useState(false);
  async function inspirarTitulares() {
    setBusyInsp(true);
    try {
      const r = await fetch(MOTOR + "/gc/titulares", { method: "POST", headers: H(), body: JSON.stringify({ base: dTitulo || dSub || "" }) });
      const d = await r.json();
      if (d.ok) { setPropuestas(d.propuestas || []); flash("Elige una propuesta (o vuelve a inspirarte)."); }
      else flash("No pude generar propuestas.");
    } catch { flash("No pude conectar con el motor."); }
    finally { setBusyInsp(false); }
  }
  // integración: llega una tendencia/contenido desde el módulo Contenido → precarga campos
  useEffect(() => {
    if (!estudioDraft) return;
    if (estudioDraft.modo) setModo(estudioDraft.modo);
    const idea = estudioDraft.prompt || estudioDraft.titulo || "";
    if (estudioDraft.titulo) { setDTitulo(estudioDraft.titulo); setPrompt(idea); }
    if (estudioDraft.subtitulo) setDSub(estudioDraft.subtitulo);
    if (estudioDraft.cta) setDCta(estudioDraft.cta);
    if (idea) setCMensaje(idea);   // la idea también alimenta el carrusel
    flash("Idea cargada del contenido. Ajusta y genera la pieza.");
    try { clearEstudioDraft && clearEstudioDraft(); } catch {}
    // eslint-disable-next-line
  }, [estudioDraft]);
  const [editRaw, setEditRaw] = useState(false);

  async function generarDiseno() {
    if (!dTitulo.trim()) return flash("Escribe al menos el título.");
    setBusyDes(true);
    try {
      const r = await fetch(MOTOR + "/gc/diseno", { method: "POST", headers: H(), body: JSON.stringify({ formato: dFormato, titulo: dTitulo, subtitulo: dSub, cta: dCta }) });
      const d = await r.json();
      if (d.ok) { setSvg(d.svg); setSvgDim({ w: d.w, h: d.h }); flash("Diseño listo. Edítalo si quieres."); }
      else flash("No pude generar el diseño: " + (d.error || ""));
    } catch { flash("No pude conectar con el motor."); }
    finally { setBusyDes(false); }
  }
  function descargarPng() {
    if (!svg) return;
    try {
      const img = new Image();
      const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      img.onload = () => {
        const cv = document.createElement("canvas"); cv.width = svgDim.w; cv.height = svgDim.h;
        const cx = cv.getContext("2d"); cx.drawImage(img, 0, 0, svgDim.w, svgDim.h);
        URL.revokeObjectURL(url);
        const a = document.createElement("a"); a.download = "siemon-diseno.png"; a.href = cv.toDataURL("image/png"); a.click();
      };
      img.onerror = () => { URL.revokeObjectURL(url); flash("No pude exportar a PNG; descarga el SVG."); };
      img.src = url;
    } catch { flash("No pude exportar."); }
  }
  function descargarSvg() {
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const a = document.createElement("a"); a.download = "siemon-diseno.svg"; a.href = URL.createObjectURL(blob); a.click();
  }
  function guardarDiseno() {
    if (!svg) return;
    commit({ ...data, siemon: { ...data.siemon, gc: [{ id: uid(), tipo: "diseno", estado: "listo", svg, w: svgDim.w, h: svgDim.h, prompt: dTitulo, fecha: today() }, ...galeria] } });
    flash("Diseño guardado en la galería.");
  }
  function svgToPng(svgStr, w, h) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const blob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      img.onload = () => { const cv = document.createElement("canvas"); cv.width = w; cv.height = h; cv.getContext("2d").drawImage(img, 0, 0, w, h); URL.revokeObjectURL(url); resolve(cv.toDataURL("image/png")); };
      img.onerror = () => { URL.revokeObjectURL(url); reject(); };
      img.src = url;
    });
  }
  async function publicarDiseno(svgStr, dim, contexto) {
    if (!svgStr || !onPublicar) return;
    flash("Preparando el diseño…");
    try {
      const dataUrl = await svgToPng(svgStr, dim.w || 1080, dim.h || 1080);
      const r = await fetch(MOTOR + "/gc/subir", { method: "POST", headers: H(), body: JSON.stringify({ data: dataUrl, ext: "png" }) });
      const d = await r.json();
      if (d.ok && d.url) onPublicar({ mediaUrl: d.url, mediaType: "image", tema: contexto || "" });
      else flash("No pude subir el diseño: " + (d.error || ""));
    } catch { flash("No pude preparar el diseño para publicar."); }
  }

  // ---- carrusel ----
  async function generarCarrusel() {
    if (!cMensaje.trim()) return flash("Escribe el mensaje del carrusel.");
    setBusyCar(true); setSlides([]);
    try {
      const r = await fetch(MOTOR + "/gc/carrusel", { method: "POST", headers: H(), body: JSON.stringify({ mensaje: cMensaje, cta: cCta, n: Number(cN), formato: cFormato }) });
      const d = await r.json();
      if (d.ok && (d.slides || []).length) {
        setSlides(d.slides); setCIdx(0);
        // auto-guardar en la galería para que NO se pierda al refrescar
        const nid = uid();
        const item = { id: nid, tipo: "carrusel", estado: "listo", slides: d.slides, w: d.w, h: d.h, prompt: cMensaje, fecha: today() };
        setCarId(nid);
        commit({ ...data, siemon: { ...data.siemon, gc: [item, ...galeria] } });
        flash(`Carrusel de ${d.slides.length} láminas listo y guardado.`);
      } else flash("No pude generar el carrusel: " + (d.error || ""));
    } catch { flash("No pude conectar con el motor."); }
    finally { setBusyCar(false); }
  }
  function descargarSlide(s) {
    svgToPng(s.svg, s.w, s.h).then((u) => { const a = document.createElement("a"); a.download = `siemon-carrusel-${String(s.n).padStart(2, "0")}.png`; a.href = u; a.click(); }).catch(() => flash("No pude exportar la lámina."));
  }
  async function descargarCarrusel(sl) {
    const arr = sl || slides;
    for (const s of arr) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise((res) => { svgToPng(s.svg, s.w, s.h).then((u) => { const a = document.createElement("a"); a.download = `siemon-carrusel-${String(s.n).padStart(2, "0")}.png`; a.href = u; a.click(); setTimeout(res, 400); }).catch(res); });
    }
    flash("Láminas descargadas. Súbelas a Postiz como carrusel (en orden).");
  }
  async function publicarCarruselCompleto(sl) {
    const arr = sl || slides;
    if (!arr.length) return;
    flash("Preparando el carrusel completo…");
    try {
      const urls = [];
      for (const s of arr) {
        // eslint-disable-next-line no-await-in-loop
        const dataUrl = await svgToPng(s.svg, s.w, s.h);
        // eslint-disable-next-line no-await-in-loop
        const r = await fetch(MOTOR + "/gc/subir", { method: "POST", headers: H(), body: JSON.stringify({ data: dataUrl, ext: "png" }) });
        // eslint-disable-next-line no-await-in-loop
        const d = await r.json();
        if (d.ok && d.url) urls.push(d.url);
      }
      if (!urls.length) return flash("No pude preparar las láminas.");
      onPublicar && onPublicar({ mediaUrls: urls, mediaUrl: urls[0], mediaType: "image", tema: (arr === slides ? cMensaje : "") });
    } catch { flash("No pude preparar el carrusel."); }
  }
  function abrirCarrusel(item) {
    setModo("carrusel"); setSlides(item.slides || []); setCIdx(0); setCMensaje(item.prompt || ""); setCarId(item.id); setCEditRaw(false);
    flash("Carrusel cargado de la galería.");
  }
  function setSlideSvg(i, val) {
    setSlides((arr) => arr.map((s, j) => (j === i ? { ...s, svg: val } : s)));
  }
  function guardarCambiosCarrusel() {
    if (!slides.length) return;
    const g = data.siemon.gc || [];
    const existe = carId && g.some((x) => x.id === carId);
    let nuevos;
    if (existe) nuevos = g.map((x) => (x.id === carId ? { ...x, slides } : x));
    else { const nid = uid(); setCarId(nid); nuevos = [{ id: nid, tipo: "carrusel", estado: "listo", slides, w: slides[0].w, h: slides[0].h, prompt: cMensaje, fecha: today() }, ...g]; }
    commit({ ...data, siemon: { ...data.siemon, gc: nuevos } });
    flash("Cambios del carrusel guardados.");
  }

  useEffect(() => { (async () => {
    try { const r = await fetch(MOTOR + "/config/secretos", { headers: H() }); const d = await r.json(); setFalOn(!!d.FAL_API_KEY); } catch {}
  })(); }, []);

  async function guardarFal() {
    if (!falKey.trim()) return;
    try {
      await fetch(MOTOR + "/config/secreto", { method: "POST", headers: H(), body: JSON.stringify({ clave: "FAL_API_KEY", valor: falKey.trim() }) });
      setFalKey(""); setFalOn(true); setShowCfg(false); flash("FAL key guardada en el servidor.");
    } catch { flash("No pude guardar la key."); }
  }

  async function generarImagen() {
    if (!prompt.trim()) return flash("Describe la imagen.");
    setBusyImg(true);
    try {
      const r = await fetch(MOTOR + "/gc/imagen", { method: "POST", headers: H(), body: JSON.stringify({ prompt, aspecto }) });
      const d = await r.json();
      if (d.ok) { setImgUrl(d.url); flash("Imagen lista."); }
      else flash(d.error === "sin_fal_key" ? "Falta tu FAL key (Configurar)." : "No pude generar: " + (d.error || ""));
    } catch { flash("No pude conectar con el motor."); }
    finally { setBusyImg(false); }
  }

  async function crearVideo(desdeUrl) {
    const url = desdeUrl || imgUrl;
    if (!url) return flash("Genera o pega la URL de una imagen primero.");
    setBusyVid(true);
    try {
      const r = await fetch(MOTOR + "/gc/video", { method: "POST", headers: H(), body: JSON.stringify({ image_url: url, prompt, aspecto, duracion }) });
      const d = await r.json();
      if (!d.ok) { flash(d.error === "sin_fal_key" ? "Falta tu FAL key." : "No pude iniciar el video: " + (d.error || "")); return; }
      const item = { id: uid(), tipo: "video", estado: "procesando", request_id: d.request_id, imagen: url, prompt, fecha: today() };
      commit({ ...data, siemon: { ...data.siemon, gc: [item, ...galeria] } });
      flash("Video en proceso… se actualiza solo.");
    } catch { flash("No pude conectar con el motor."); }
    finally { setBusyVid(false); }
  }

  async function buscarBanco() {
    if (!bancoQ.trim()) return flash("Escribe qué foto buscas.");
    if (fuenteBanco === "coverr") return flash("Coverr solo tiene VIDEO. Usa el buscador de video (más abajo), o cambia la Fuente a Todos/Pexels/Pixabay/Unsplash para fotos.");
    setBancoBusy(true); setBancoRes(null);
    try {
      const fte = fuenteBanco;   // pexels|pixabay|unsplash|todos
      const r = await fetch(MOTOR + "/blog/fotos", { method: "POST", headers: H(), body: JSON.stringify({ query: bancoQ, orientation: orientBanco, fuente: fte }) });
      const d = await r.json();
      if (d.sinKey || d.error === "sin_key") { flash("Conecta un banco de fotos (Pexels) en el módulo Blog primero."); setBancoRes({ fotos: [] }); }
      else { setBancoRes({ fotos: d.fotos || [] }); if (!(d.fotos || []).length) flash("Sin fotos para esa búsqueda. Prueba otras palabras (o en inglés)."); }
    } catch { flash("No pude conectar con el motor."); }
    finally { setBancoBusy(false); }
  }
  async function buscarBancoVideo() {
    if (!vidQ.trim()) return flash("Escribe qué video buscas.");
    const fte = fuenteBanco === "unsplash" ? "todos" : fuenteBanco;   // Unsplash no tiene video → cae a todos
    if (fuenteBanco === "unsplash") flash("Unsplash solo tiene fotos; busco video en todos los bancos.");
    setVidBusy(true); setVidRes(null);
    try {
      const r = await fetch(MOTOR + "/gc/videos_banco", { method: "POST", headers: H(), body: JSON.stringify({ query: vidQ, orientation: orientBanco, fuente: fte }) });
      const d = await r.json();
      if (d.ok) { setVidRes({ videos: d.videos || [] }); if (!(d.videos || []).length) flash("Sin videos para esa búsqueda. Prueba otras palabras (o en inglés como 'office', 'city')."); }
      else flash(d.nota || d.error || "No pude buscar videos.");
    } catch { flash("No pude conectar con el motor."); }
    finally { setVidBusy(false); }
  }
  function guardarVideoGaleria(v) {
    const item = { id: uid(), tipo: "video", estado: "listo", video: v.url, imagen: v.thumb || "", prompt: "Banco · " + (v.autor || "Pexels"), fecha: today() };
    commit({ ...data, siemon: { ...data.siemon, gc: [item, ...galeria] } });
    flash("Video del banco guardado en la galería.");
  }
  function guardarImagenGaleria() {
    if (!imgUrl) return;
    const item = { id: uid(), tipo: "imagen", estado: "listo", imagen: imgUrl, prompt, fecha: today() };
    commit({ ...data, siemon: { ...data.siemon, gc: [item, ...galeria] } });
    flash("Imagen guardada en la galería.");
  }
  function borrar(id) { commit({ ...data, siemon: { ...data.siemon, gc: galeria.filter((x) => x.id !== id) } }); }
  const [regId, setRegId] = useState("");
  // Repostar regenerando: mismo TEMA/punto, nuevo estilo. Crea una pieza NUEVA (no pisa la original).
  async function regenerar(x) {
    const tema = (x.prompt || "").replace(/^Banco · /, "").trim();
    if (!tema) return flash("Esta pieza no guardó su tema; recréala desde el editor.");
    setRegId(x.id);
    const nuevo = (obj) => commit({ ...data, siemon: { ...data.siemon, gc: [{ id: uid(), fecha: today(), prompt: tema, estado: "listo", ...obj }, ...galeria] } });
    try {
      if (x.tipo === "imagen") {
        flash("Regenerando imagen con el mismo tema (nuevo estilo)…");
        const d = await (await fetch(MOTOR + "/gc/imagen", { method: "POST", headers: H(), body: JSON.stringify({ prompt: tema, aspecto }) })).json();
        if (d.ok && d.url) { nuevo({ tipo: "imagen", imagen: d.url }); flash("Nueva versión lista ✓"); } else flash("No pude regenerar: " + (d.error || ""));
      } else if (x.tipo === "diseno") {
        flash("Regenerando diseño (nuevo estilo)…");
        const d = await (await fetch(MOTOR + "/gc/diseno", { method: "POST", headers: H(), body: JSON.stringify({ formato: dFormato, titulo: tema, subtitulo: "", cta: "" }) })).json();
        if (d.ok && d.svg) { nuevo({ tipo: "diseno", svg: d.svg, w: d.w, h: d.h }); flash("Nueva versión lista ✓"); } else flash("No pude regenerar el diseño.");
      } else if (x.tipo === "carrusel") {
        flash("Regenerando carrusel (nuevo estilo)…");
        const d = await (await fetch(MOTOR + "/gc/carrusel", { method: "POST", headers: H(), body: JSON.stringify({ mensaje: tema, cta: cCta, n: (x.slides || []).length || Number(cN), formato: cFormato }) })).json();
        if (d.ok && d.slides) { nuevo({ tipo: "carrusel", slides: d.slides, w: d.w, h: d.h }); flash("Nueva versión lista ✓"); } else flash("No pude regenerar el carrusel.");
      } else if (x.tipo === "video" && x.imagen) {
        flash("Regenerando video…");
        const d = await (await fetch(MOTOR + "/gc/video", { method: "POST", headers: H(), body: JSON.stringify({ image_url: x.imagen, prompt: tema, aspecto, duracion }) })).json();
        if (d.ok) { nuevo({ tipo: "video", estado: "procesando", request_id: d.request_id, imagen: x.imagen }); flash("Video en proceso… se actualiza solo."); } else flash("No pude regenerar el video.");
      } else flash("Este tipo no se regenera automático; ábrelo en el editor.");
    } catch { flash("No pude conectar con el motor."); }
    finally { setRegId(""); }
  }

  // polling de videos en proceso
  const pollRef = useRef(null);
  useEffect(() => {
    const pendientes = galeria.filter((x) => x.tipo === "video" && x.estado === "procesando" && x.request_id);
    if (!pendientes.length) { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } return; }
    if (pollRef.current) return;
    pollRef.current = setInterval(async () => {
      let cambio = false; const actual = data.siemon.gc || [];
      const upd = await Promise.all(actual.map(async (x) => {
        if (x.tipo !== "video" || x.estado !== "procesando" || !x.request_id) return x;
        try {
          const r = await fetch(MOTOR + "/gc/estado?request_id=" + encodeURIComponent(x.request_id), { headers: H() });
          const d = await r.json();
          if (d.estado === "COMPLETED" && d.video_url) { cambio = true; return { ...x, estado: "listo", video: d.video_url }; }
          if (d.estado === "FAILED" || d.error) { cambio = true; return { ...x, estado: "fallido" }; }
        } catch {}
        return x;
      }));
      if (cambio) commit({ ...data, siemon: { ...data.siemon, gc: upd } });
    }, 8000);
    return () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };
  }, [galeria.map((x) => x.id + x.estado).join(",")]);

  const copiar = (u) => { try { navigator.clipboard.writeText(u); flash("URL copiada. Pégala en Contenido → Publicar (o como ad)."); } catch {} };

  return (
    <div style={{ maxWidth: 1100 }}>
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <div style={{ color: C.aether500, fontFamily: MONO, letterSpacing: "0.2em" }} className="fs-10 uppercase mb-2"><span style={{ color: C.aether }}>// </span>Estudio de contenido</div>
          <h1 style={{ fontWeight: 600, color: C.cream }} className="fs-24 flex items-center gap-2"><Clapperboard size={20} color={C.aether} /> Imagen y video</h1>
          <div style={{ color: C.ash }} className="fs-11 mt-1">Genera una imagen con IA y conviértela en video corto. Úsalos para tus posts o ads.</div>
        </div>
        <button onClick={() => setShowCfg((v) => !v)} style={{ background: C.panel, border: `1px solid ${falOn ? "rgba(127,184,155,0.4)" : C.aetherLine}`, color: falOn ? C.ok : C.aether2 }} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg fs-12 shrink-0"><KeyRound size={13} />{falOn ? "FAL conectada" : "Conectar FAL"}</button>
      </div>

      {(showCfg || !falOn) && (
        <div style={{ background: C.panel, border: `1px solid ${C.aetherLine}` }} className="rounded-xl p-4 mb-5">
          <div style={{ color: C.mist }} className="fs-12 mb-2 flex items-center gap-1.5"><Settings2 size={13} /> Tu FAL API key (se guarda solo en el servidor, nunca en el navegador)</div>
          <div className="flex items-center gap-2">
            <input style={inS} type="password" value={falKey} onChange={(e) => setFalKey(e.target.value)} placeholder={falOn ? "•••• (ya configurada; pega una nueva para cambiarla)" : "fal-..."} />
            <button onClick={guardarFal} style={{ background: C.aether, color: C.obsidian, fontWeight: 600 }} className="px-4 py-2.5 rounded-lg fs-13 shrink-0">Guardar</button>
          </div>
          <div style={{ color: C.ash }} className="fs-10 mt-2">La consigues en fal.ai → Dashboard → API Keys. La generación de video es de pago (FAL cobra por uso).</div>
        </div>
      )}

      {/* modo */}
      <div className="flex gap-2 mb-4">
        <button onClick={() => setModo("fal")} style={{ background: modo === "fal" ? C.aetherSoft : C.panel, border: `1px solid ${modo === "fal" ? C.aetherLine : C.line}`, color: modo === "fal" ? C.aether2 : C.mist }} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg fs-12"><Film size={14} /> Foto y video (FAL)</button>
        <button onClick={() => setModo("diseno")} style={{ background: modo === "diseno" ? C.aetherSoft : C.panel, border: `1px solid ${modo === "diseno" ? C.aetherLine : C.line}`, color: modo === "diseno" ? C.aether2 : C.mist }} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg fs-12"><Palette size={14} /> Diseño editable (Claude)</button>
        <button onClick={() => setModo("carrusel")} style={{ background: modo === "carrusel" ? C.aetherSoft : C.panel, border: `1px solid ${modo === "carrusel" ? C.aetherLine : C.line}`, color: modo === "carrusel" ? C.aether2 : C.mist }} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg fs-12"><Layers size={14} /> Carrusel</button>
      </div>

      {modo === "carrusel" && (
        <div style={{ background: C.panel, border: `1px solid ${C.line}` }} className="rounded-xl p-4 md:p-5 mb-5">
          <div style={{ color: C.mist }} className="fs-12 mb-3">Escribe tu mensaje y el sistema arma un carrusel completo en tu voz: gancho, desarrollo y cierre, todas las láminas con el mismo estilo. Se guarda solo en la galería.</div>
          <label style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase">Mensaje / idea del carrusel</label>
          <textarea style={{ ...inS, minHeight: 70, resize: "vertical" }} value={cMensaje} onChange={(e) => setCMensaje(e.target.value)} placeholder="ej. Solo 1 de cada 8 empresas capitaliza el valor real de la IA. La diferencia la marca quién entra con estructura." />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
            <div className="col-span-2"><label style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase">CTA final (opcional)</label>
              <input style={inS} value={cCta} onChange={(e) => setCCta(e.target.value)} placeholder="ej. Agenda tu diagnóstico" /></div>
            <div><label style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase">Láminas</label>
              <select style={inS} value={cN} onChange={(e) => setCN(e.target.value)}>{[3, 4, 5, 6, 7, 8].map((n) => <option key={n} value={n}>{n}</option>)}</select></div>
            <div><label style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase">Formato</label>
              <select style={inS} value={cFormato} onChange={(e) => setCFormato(e.target.value)}><option value="4:5">4:5 (feed)</option><option value="1:1">1:1 (post)</option><option value="9:16">9:16 (story)</option></select></div>
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-4">
            <button onClick={generarCarrusel} disabled={busyCar} style={{ background: C.aether, color: C.obsidian, fontWeight: 600, opacity: busyCar ? 0.6 : 1 }} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg fs-13"><Layers size={15} />{busyCar ? "Diseñando láminas…" : slides.length ? "Rehacer carrusel" : "Generar carrusel"}</button>
            {slides.length > 0 && <>
              <button onClick={() => publicarCarruselCompleto()} style={{ background: C.aether, color: C.obsidian, fontWeight: 600 }} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg fs-12"><Layers size={13} /> Publicar carrusel completo →</button>
              <button onClick={() => descargarCarrusel()} style={{ border: `1px solid ${C.aetherLine}`, color: C.aether2 }} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg fs-12"><Download size={13} /> Descargar todas (PNG)</button>
            </>}
          </div>
          {busyCar && <div style={{ color: C.ash }} className="fs-10 mt-2">Dibujando cada lámina, dame unos segundos…</div>}
          {slides.length > 0 && (() => {
            const s = slides[Math.min(cIdx, slides.length - 1)] || slides[0];
            return (
              <div className="mt-4">
                <div className="flex items-start gap-4 flex-col md:flex-row">
                  <div style={{ maxWidth: 320, width: "100%" }} dangerouslySetInnerHTML={{ __html: s.svg.replace("<svg", '<svg style="max-width:100%;height:auto;border-radius:10px;border:1px solid rgba(255,255,255,0.08)"') }} />
                  <div className="flex-1">
                    <div style={{ color: C.mist }} className="fs-12 mb-1">Lámina {s.n} de {slides.length} · <span style={{ color: C.aether2, fontFamily: MONO }} className="fs-10">{s.rol}</span></div>
                    <div style={{ color: C.cream, fontWeight: 600 }} className="fs-13">{s.titulo}</div>
                    {s.subtitulo && <div style={{ color: C.ash }} className="fs-11 mt-0.5">{s.subtitulo}</div>}
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      <button onClick={() => descargarSlide(s)} style={{ border: `1px solid ${C.aetherLine}`, color: C.aether2 }} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg fs-11"><Download size={12} /> Esta lámina</button>
                      <button onClick={() => publicarDiseno(s.svg, { w: s.w, h: s.h }, cMensaje)} style={{ background: C.aether, color: C.obsidian, fontWeight: 600 }} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg fs-11">Publicar esta →</button>
                      <button onClick={() => setCEditRaw((v) => !v)} style={{ border: `1px solid ${C.line}`, color: C.ash }} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg fs-11"><Code2 size={12} /> {cEditRaw ? "Ocultar código" : "Editar texto/código"}</button>
                      <button onClick={guardarCambiosCarrusel} style={{ border: `1px solid rgba(127,184,155,0.4)`, color: C.ok }} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg fs-11"><Check size={12} /> Guardar cambios</button>
                    </div>
                    {cEditRaw && <div className="mt-2">
                      <div style={{ color: C.ash }} className="fs-10 mb-1">Edita el texto directamente aquí (busca la palabra a cambiar). Cierra con "Ocultar código" y pulsa "Guardar cambios".</div>
                      <textarea value={s.svg} onChange={(e) => setSlideSvg(Math.min(cIdx, slides.length - 1), e.target.value)} style={{ ...inS, minHeight: 200, fontFamily: MONO, fontSize: 11 }} />
                    </div>}
                  </div>
                </div>
                <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
                  {slides.map((sl, i) => (
                    <button key={i} onClick={() => setCIdx(i)} style={{ border: `2px solid ${i === cIdx ? C.aether : C.line}`, borderRadius: 8, flexShrink: 0, width: 64, height: Math.round(64 * (sl.h / sl.w)), overflow: "hidden", position: "relative" }}>
                      <div style={{ width: "100%", height: "100%" }} dangerouslySetInnerHTML={{ __html: sl.svg.replace("<svg", '<svg style="width:100%;height:100%"') }} />
                      <span style={{ position: "absolute", bottom: 2, right: 3, color: C.cream, fontFamily: MONO, fontSize: 8, background: "rgba(0,0,0,0.5)", borderRadius: 3, padding: "0 3px" }}>{sl.n}</span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {modo === "diseno" && (
        <div style={{ background: C.panel, border: `1px solid ${C.line}` }} className="rounded-xl p-4 md:p-5 mb-5">
          <div className="grid md:grid-cols-2 gap-3">
            <div className="md:col-span-2">
              <div className="flex items-center justify-between">
                <label style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase">Título</label>
                <button onClick={inspirarTitulares} disabled={busyInsp} style={{ color: C.aether2, opacity: busyInsp ? 0.6 : 1 }} className="inline-flex items-center gap-1 fs-10"><Sparkles size={11} /> {busyInsp ? "Pensando…" : "Inspírame (título + subtítulo)"}</button>
              </div>
              <input style={inS} value={dTitulo} onChange={(e) => setDTitulo(e.target.value)} placeholder="ej. Amplifica tu potencial" /></div>
            {propuestas.length > 0 && (
              <div className="md:col-span-2 flex flex-col gap-1.5">
                {propuestas.map((p, i) => (
                  <button key={i} onClick={() => { setDTitulo(p.titulo); setDSub(p.subtitulo); if (p.cta && !dCta) setDCta(p.cta); setPropuestas([]); }}
                    style={{ background: C.carbon, border: `1px solid ${C.aetherLine}`, textAlign: "left" }} className="rounded-lg px-3 py-2 hover:brightness-125">
                    <div style={{ color: C.cream, fontWeight: 600 }} className="fs-12">{p.titulo}</div>
                    <div style={{ color: C.ash }} className="fs-10">{p.subtitulo}{p.cta ? " · CTA: " + p.cta : ""}</div>
                  </button>
                ))}
                <button onClick={() => setPropuestas([])} style={{ color: C.ash }} className="fs-10 self-start">cerrar propuestas</button>
              </div>
            )}
            <div className="md:col-span-2"><label style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase">Subtítulo</label>
              <input style={inS} value={dSub} onChange={(e) => setDSub(e.target.value)} placeholder="ej. IA y automatización a la medida de tu negocio" /></div>
            <div><label style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase">CTA (opcional)</label>
              <input style={inS} value={dCta} onChange={(e) => setDCta(e.target.value)} placeholder="ej. Agenda tu diagnóstico" /></div>
            <div><label style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase">Formato</label>
              <select style={inS} value={dFormato} onChange={(e) => setDFormato(e.target.value)}><option value="1:1">1:1 (post)</option><option value="4:5">4:5 (feed)</option><option value="9:16">9:16 (story/reel)</option><option value="16:9">16:9</option></select></div>
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-4">
            <button onClick={generarDiseno} disabled={busyDes} style={{ background: C.aether, color: C.obsidian, fontWeight: 600, opacity: busyDes ? 0.6 : 1 }} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg fs-13"><Sparkles size={15} />{busyDes ? "Diseñando…" : svg ? "Actualizar diseño" : "Generar diseño"}</button>
            {svg && <><button onClick={descargarPng} style={{ border: `1px solid ${C.aetherLine}`, color: C.aether2 }} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg fs-12"><Download size={13} /> PNG</button>
            <button onClick={descargarSvg} style={{ border: `1px solid ${C.line}`, color: C.mist }} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg fs-12"><Download size={13} /> SVG</button>
            <button onClick={guardarDiseno} style={{ border: `1px solid rgba(127,184,155,0.4)`, color: C.ok }} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg fs-12"><Check size={13} /> Guardar</button>
            <button onClick={() => publicarDiseno(svg, svgDim, dTitulo || dSub)} style={{ background: C.aether, color: C.obsidian, fontWeight: 600 }} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg fs-12">Publicar →</button>
            <button onClick={() => setEditRaw((v) => !v)} style={{ border: `1px solid ${C.line}`, color: C.ash }} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg fs-12"><Code2 size={13} /> Editar código</button></>}
          </div>
          {svg && (
            <div className="mt-4 flex flex-col md:flex-row gap-4">
              <div style={{ maxWidth: 320, width: "100%" }} dangerouslySetInnerHTML={{ __html: svg.replace("<svg", '<svg style="max-width:100%;height:auto;border-radius:10px;border:1px solid rgba(255,255,255,0.08)"') }} />
              {editRaw && <textarea value={svg} onChange={(e) => setSvg(e.target.value)} style={{ ...inS, minHeight: 240, fontFamily: MONO, fontSize: 11, flex: 1 }} />}
            </div>
          )}
          <div style={{ color: C.ash }} className="fs-10 mt-2">Cambia los campos y "Actualizar", o edita el código directamente. Descarga PNG para publicarla como post o ad.</div>

          <div style={{ borderTop: `1px solid ${C.line}` }} className="mt-4 pt-4">
            <label style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase inline-flex items-center gap-1"><Search size={11} /> O crea la pieza sobre una FOTO real (banco) y agrégale tu texto</label>
            <div className="flex gap-2 mt-1.5">
              <input style={{ ...inS, fontSize: 13 }} value={bancoQ} onChange={(e) => setBancoQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && buscarBanco()} placeholder="ej. equipo trabajando, oficina moderna, tecnología" />
              <button onClick={buscarBanco} disabled={bancoBusy} style={{ background: C.carbon, border: `1px solid ${C.aetherLine}`, color: C.aether2 }} className="px-3 rounded-lg fs-12 shrink-0">{bancoBusy ? "…" : "Buscar"}</button>
            </div>
            {bancoRes && (bancoRes.fotos || []).length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-1 mt-2">
                {bancoRes.fotos.map((f, i) => (
                  <img key={i} src={f.thumb} alt={f.autor} title={`${f.banco} · clic para editar con texto`} onClick={() => setEditarSrc(f.url)} style={{ height: 70, borderRadius: 8, cursor: "pointer", border: `1px solid ${C.line}` }} />
                ))}
              </div>
            )}
            <div style={{ color: C.ash }} className="fs-10 mt-2">Clic en una foto para abrir el editor (filtros B&N/anaglifo/glitch + 3 textos). ¿Prefieres una imagen con IA? Genérala en <b style={{ color: C.mist }}>“Foto y video (FAL)”</b> y edítala igual.</div>
          </div>
        </div>
      )}

      {modo === "fal" && (<>
      {/* generador */}
      <div style={{ background: C.panel, border: `1px solid ${C.line}` }} className="rounded-xl p-4 md:p-5 mb-5">
        <label style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase">Describe la imagen (en español)</label>
        <textarea style={{ ...inS, minHeight: 70, resize: "vertical" }} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="ej. una emprendedora trabajando con IA, ambiente elegante, tonos obsidiana y lavanda" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
          <div><label style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase">Formato</label>
            <select style={inS} value={aspecto} onChange={(e) => setAspecto(e.target.value)}><option value="9:16">9:16 (reel)</option><option value="1:1">1:1 (post)</option><option value="16:9">16:9 (video)</option><option value="4:3">4:3</option></select></div>
          <div><label style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase">Duración video</label>
            <select style={inS} value={duracion} onChange={(e) => setDuracion(e.target.value)}><option value="5">5 s</option><option value="10">10 s</option></select></div>
          <div className="col-span-2"><label style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase">O usa una imagen por URL</label>
            <input style={inS} value={imgUrl} onChange={(e) => setImgUrl(e.target.value)} placeholder="https://…/imagen.jpg" /></div>
        </div>
        <div className="flex flex-wrap items-center gap-2 mt-4">
          <button onClick={generarImagen} disabled={busyImg} style={{ background: C.aether, color: C.obsidian, fontWeight: 600, opacity: busyImg ? 0.6 : 1 }} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg fs-13"><ImageIcon size={15} />{busyImg ? "Generando…" : "Generar imagen"}</button>
          <button onClick={() => crearVideo()} disabled={busyVid || !imgUrl} style={{ background: imgUrl ? C.aetherSoft : "transparent", border: `1px solid ${C.aetherLine}`, color: C.aether2, opacity: (busyVid || !imgUrl) ? 0.5 : 1 }} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg fs-13"><Film size={15} />{busyVid ? "Iniciando…" : "Convertir a video"}</button>
        </div>
        <div style={{ color: C.ash }} className="fs-10 mt-2">El prompt de arriba es editable: míralo, ajústalo y vuelve a "Generar imagen" hasta que quede como quieres.</div>

        {/* banco de imágenes gratis (Pexels/Unsplash) */}
        <div style={{ borderTop: `1px solid ${C.line}` }} className="mt-4 pt-4">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase">Orientación:</span>
            <div className="inline-flex rounded-md overflow-hidden" style={{ border: `1px solid ${C.line}` }}>
              {[["landscape", "Horizontal"], ["portrait", "Vertical"], ["square", "Cuadrado"]].map(([id, lb]) => { const on = orientBanco === id; return (
                <button key={id} onClick={() => setOrientBanco(id)} style={{ background: on ? C.aetherSoft : "transparent", color: on ? C.aether2 : C.ash }} className="fs-10 px-2 py-1">{lb}</button>
              ); })}
            </div>
          </div>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase">Fuente:</span>
            <div className="inline-flex rounded-md overflow-hidden" style={{ border: `1px solid ${C.line}` }}>
              {[["todos", "Todos"], ["pexels", "Pexels"], ["pixabay", "Pixabay"], ["unsplash", "Unsplash · solo fotos"], ["coverr", "Coverr · solo video"]].map(([id, lb]) => { const on = fuenteBanco === id; return (
                <button key={id} onClick={() => setFuenteBanco(id)} style={{ background: on ? C.aetherSoft : "transparent", color: on ? C.aether2 : C.ash }} className="fs-10 px-2 py-1">{lb}</button>
              ); })}
            </div>
          </div>
          <label style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase inline-flex items-center gap-1"><Search size={11} /> O busca una foto real gratis (banco)</label>
          <div className="flex gap-2 mt-1.5">
            <input style={{ ...inS, fontSize: 13 }} value={bancoQ} onChange={(e) => setBancoQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && buscarBanco()} placeholder="ej. oficina moderna, tecnología, emprendedora" />
            <button onClick={buscarBanco} disabled={bancoBusy} style={{ background: C.carbon, border: `1px solid ${C.aetherLine}`, color: C.aether2 }} className="px-3 rounded-lg fs-12 shrink-0">{bancoBusy ? "…" : "Buscar"}</button>
          </div>
          {bancoRes && (bancoRes.fotos || []).length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1 mt-2">
              {bancoRes.fotos.map((f, i) => (
                <div key={i} className="shrink-0 flex flex-col items-center gap-1">
                  <img src={f.thumb} alt={f.autor} title={`${f.banco} · ${f.autor}`} onClick={() => { setImgUrl(f.url); flash(`Foto del banco lista (${f.banco}). Pulsa "Editar" para filtros y texto.`); }} style={{ height: 70, borderRadius: 8, cursor: "pointer", border: `1px solid ${C.line}` }} />
                  <button onClick={() => setEditarSrc(f.url)} style={{ color: C.aether2 }} className="fs-9 inline-flex items-center gap-0.5"><Wand2 size={9} /> editar</button>
                </div>
              ))}
            </div>
          )}
          {bancoRes && !(bancoRes.fotos || []).length && <div style={{ color: C.ash }} className="fs-10 mt-2">Sin fotos para esa búsqueda. Prueba otras palabras.</div>}
          {/* banco de videos gratis (Coverr/Pexels/Pixabay) */}
          <label style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase inline-flex items-center gap-1 mt-4"><Film size={11} /> O busca un video gratis (banco){fuenteBanco === "coverr" ? " · Coverr activo ✓" : ""}</label>
          <div className="flex gap-2 mt-1.5">
            <input style={{ ...inS, fontSize: 13 }} value={vidQ} onChange={(e) => setVidQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && buscarBancoVideo()} placeholder="ej. ciudad de noche, escribiendo en laptop, abstracto" />
            <button onClick={buscarBancoVideo} disabled={vidBusy} style={{ background: C.carbon, border: `1px solid ${C.aetherLine}`, color: C.aether2 }} className="px-3 rounded-lg fs-12 shrink-0">{vidBusy ? "…" : "Buscar"}</button>
          </div>
          {vidRes && (vidRes.videos || []).length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1 mt-2">
              {vidRes.videos.map((v, i) => (
                <div key={i} className="shrink-0 flex flex-col items-center gap-1" style={{ width: 120 }}>
                  <video src={v.url} poster={v.thumb} title="clic para usar · o pulsa editar para efectos y texto" muted loop playsInline preload="none" onClick={() => onPublicar && onPublicar({ mediaUrl: v.url, mediaType: "video", tema: (prompt || dTitulo || "").trim() })} onMouseOver={(e) => { try { if (!e.currentTarget.src) e.currentTarget.src = v.url; e.currentTarget.play(); } catch {} }} onMouseOut={(e) => { try { e.currentTarget.pause(); } catch {} }} style={{ width: 120, height: 68, objectFit: "cover", borderRadius: 8, border: `1px solid ${C.line}`, background: "#000", cursor: "pointer" }} />
                  <div className="flex items-center gap-2 flex-wrap justify-center">
                    <button onClick={() => onPublicar && onPublicar({ mediaUrl: v.url, mediaType: "video", tema: (prompt || dTitulo || "").trim() })} style={{ color: C.aether2 }} className="fs-9">usar →</button>
                    {irAEditor && <button onClick={() => irAEditor(v.url)} style={{ color: C.aether2 }} className="fs-9 inline-flex items-center gap-0.5"><Scissors size={9} /> editar</button>}
                    <button onClick={() => guardarVideoGaleria(v)} style={{ color: C.ok }} className="fs-9">guardar</button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {vidRes && !(vidRes.videos || []).length && <div style={{ color: C.ash }} className="fs-10 mt-2">Sin videos para esa búsqueda. Prueba en inglés (ej. "office", "city", "typing").</div>}
          <div style={{ color: C.ash }} className="fs-10 mt-2">De <b style={{ color: C.mist }}>Envato Elements</b> (tu cuenta premium) no hay API: descarga el video/foto de su web y súbelo con el botón "Subir" de arriba.</div>
        </div>

        {imgUrl && (
          <div className="mt-4 flex items-start gap-3">
            <img src={imgUrl} alt="" style={{ maxWidth: 200, borderRadius: 10, border: `1px solid ${C.line}` }} />
            <div className="flex flex-col gap-2">
              <button onClick={() => setEditarSrc(imgUrl)} style={{ background: C.aetherSoft, border: `1px solid ${C.aetherLine}`, color: C.aether2, fontWeight: 600 }} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg fs-12"><Wand2 size={13} /> Editar (filtros + texto)</button>
              <button onClick={guardarImagenGaleria} style={{ color: C.ok, border: `1px solid rgba(127,184,155,0.4)` }} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg fs-12"><Check size={13} /> Guardar imagen</button>
              <button onClick={() => onPublicar && onPublicar({ mediaUrl: imgUrl, mediaType: "image", tema: dTitulo || prompt })} style={{ background: C.aether, color: C.obsidian, fontWeight: 600 }} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg fs-12">Publicar →</button>
              <button onClick={() => copiar(imgUrl)} style={{ color: C.aether2, border: `1px solid ${C.aetherLine}` }} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg fs-12"><Copy size={13} /> Copiar URL</button>
            </div>
          </div>
        )}
      </div>
      </>)}

      {editarSrc && <EditorImagen src={editarSrc} contexto={dTitulo || prompt || ""} flash={flash} onCerrar={() => setEditarSrc("")} onGuardar={(u) => { setImgUrl(u); setEditarSrc(""); setModo("fal"); }} />}

      {/* galería */}
      {galeria.length > 0 && (
        <div>
          <div style={{ color: C.aether500, fontFamily: MONO, letterSpacing: "0.2em" }} className="fs-10 uppercase mb-2"><span style={{ color: C.aether }}>// </span>Galería</div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {galeria.map((x) => (
              <div key={x.id} style={{ background: C.panel, border: `1px solid ${C.line}` }} className="rounded-xl overflow-hidden">
                <div style={{ background: "#000", aspectRatio: "9/16", maxHeight: 300 }} className="flex items-center justify-center relative">
                  {x.estado === "listo" && x.tipo === "video" && x.video ? <video src={x.video} controls style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                    : x.tipo === "imagen" ? <img src={x.imagen} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                    : x.tipo === "diseno" && x.svg ? <div style={{ width: "100%", height: "100%" }} dangerouslySetInnerHTML={{ __html: x.svg.replace("<svg", '<svg style="width:100%;height:100%;object-fit:contain"') }} />
                    : x.tipo === "carrusel" && (x.slides || []).length ? <><div style={{ width: "100%", height: "100%" }} dangerouslySetInnerHTML={{ __html: x.slides[0].svg.replace("<svg", '<svg style="width:100%;height:100%;object-fit:contain"') }} /><span style={{ position: "absolute", top: 6, right: 6, background: "rgba(10,11,13,0.8)", border: `1px solid ${C.aetherLine}`, color: C.aether2, fontFamily: MONO }} className="fs-9 px-1.5 py-0.5 rounded">⧉ {x.slides.length} láminas</span></>
                    : x.estado === "procesando" ? <div style={{ color: C.aether2 }} className="fs-12 flex flex-col items-center gap-2"><RefreshCw size={20} className="animate-spin" /> Generando video…</div>
                    : <div style={{ color: C.danger }} className="fs-12">Falló la generación</div>}
                </div>
                <div className="p-2.5">
                  <div style={{ color: C.mist }} className="fs-11 leading-snug truncate">{x.prompt || x.tipo}</div>
                  <div className="flex items-center gap-2 mt-2">
                    {(x.video || x.imagen) && <button onClick={() => onPublicar && onPublicar({ mediaUrl: x.video || x.imagen, mediaType: x.video ? "video" : "image", tema: x.prompt || "" })} style={{ color: C.aether2, fontWeight: 600 }} className="inline-flex items-center gap-1 fs-11">Publicar →</button>}
                    {x.tipo === "video" && x.video && irAEditor && <button onClick={() => irAEditor(x.video)} style={{ color: C.aether2, fontWeight: 600 }} className="inline-flex items-center gap-1 fs-11"><Scissors size={11} /> Editar</button>}
                    {x.tipo === "diseno" && x.svg && <button onClick={() => publicarDiseno(x.svg, { w: x.w, h: x.h }, x.prompt)} style={{ color: C.aether2, fontWeight: 600 }} className="inline-flex items-center gap-1 fs-11">Publicar →</button>}
                    {x.tipo === "carrusel" && (x.slides || []).length > 0 && <button onClick={() => publicarCarruselCompleto(x.slides)} style={{ color: C.aether2, fontWeight: 600 }} className="inline-flex items-center gap-1 fs-11">Publicar →</button>}
                    {x.tipo === "carrusel" && (x.slides || []).length > 0 && <button onClick={() => abrirCarrusel(x)} style={{ color: C.aether2, fontWeight: 600 }} className="inline-flex items-center gap-1 fs-11">Abrir</button>}
                    {x.tipo === "carrusel" && (x.slides || []).length > 0 && <button onClick={() => descargarCarrusel(x.slides)} style={{ color: C.mist }} className="inline-flex items-center gap-1 fs-11"><Download size={11} /> Descargar</button>}
                    {(x.video || x.imagen) && <a href={x.video || x.imagen} target="_blank" rel="noreferrer" download style={{ color: C.mist }} className="inline-flex items-center gap-1 fs-11"><Download size={11} /> Descargar</a>}
                    {["imagen", "diseno", "carrusel", "video"].includes(x.tipo) && x.estado === "listo" && <button onClick={() => regenerar(x)} disabled={regId === x.id} title="Repostar con el mismo tema pero otro estilo (crea una versión nueva)" style={{ color: C.aether2 }} className="inline-flex items-center gap-1 fs-11"><RefreshCw size={11} className={regId === x.id ? "animate-spin" : ""} /> {regId === x.id ? "…" : "Regenerar"}</button>}
                    <button onClick={() => borrar(x.id)} title="Eliminar de la galería" style={{ color: C.danger }} className="inline-flex items-center gap-1 fs-11 ml-auto"><Trash2 size={11} /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
