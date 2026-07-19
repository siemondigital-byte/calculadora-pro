import React, { useState, useRef, useEffect } from "react";
import { Scissors, Upload, Download, Type, Music, Play, Send, Sparkles } from "lucide-react";
import { getToken } from "./db";

const C = {
  obsidian: "#0A0B0D", panel: "#16171C", carbon: "#131418", line: "rgba(255,255,255,0.08)",
  aether: "#B1A3E1", aether2: "#CBC0EC", aether500: "#8474BE", aetherSoft: "rgba(177,163,225,0.14)",
  aetherLine: "rgba(177,163,225,0.30)", cream: "#E9E5DD", mist: "#C9CAD2", ash: "#8B8D98", ok: "#7FB89B",
};
const SANS = "'Montserrat', system-ui, sans-serif";
const MONO = "'JetBrains Mono', ui-monospace, monospace";
const MOTOR = import.meta.env.VITE_MOTOR_URL || "https://prospeccion.siemondigital.com";
const inS = { background: "#101116", border: `1px solid ${C.line}`, color: C.cream, borderRadius: 10, padding: "9px 12px", width: "100%", fontFamily: SANS, fontSize: 13, outline: "none" };
const H = () => ({ "content-type": "application/json", Authorization: "Bearer " + getToken() });
const fmt = (s) => { s = Math.max(0, s || 0); const m = Math.floor(s / 60); const r = Math.floor(s % 60); return `${m}:${String(r).padStart(2, "0")}`; };
const AETHER = "rgb(177,163,225)";   // violeta de marca
const LOGO_PATH = "M76.54 0c-1.42 6.1-2.13 10.83-2.13 14.2 0 4.8 1.42 9.76 4.25 14.88 2.83 5.12 7.84 11.71 15.04 19.77 14.49 16.56 24.54 28.4 30.17 35.53 5.6 7.13 10.16 13.86 13.64 20.18 4.15 7.52 7.12 14.52 8.91 21 1.8 6.48 2.7 13.43 2.7 20.83 0 9.26-1.58 18.27-4.74 27.04-3.17 8.77-7.57 16.48-13.25 23.12-15.04 17.65-38.09 26.47-69.16 26.47H.19v-52.8h54.77c11.66 0 20-2.89 25.01-8.67 4.03-4.79 6.06-9.97 6.06-15.53 0-6.43-2.29-13.05-6.87-19.87-4.59-6.8-15.86-20.47-33.85-40.96-8.28-9.59-14.63-17.47-19.05-23.63-4.41-6.15-7.66-11.79-9.72-16.92C13.05 36.03 11.31 28.18 11.31 21.09c0-5.24.77-12.26 2.28-21.09H76.54zM189.98 62.5c-7.36-15.63-17.57-28.68-30.66-39.13-9.8-7.85-21.04-13.69-33.68-17.56C113.99 2.25 100.96.32 86.53.04l-.5 2.17c-1.55 6.66-1.88 10.2-1.88 12.01 0 3.1 1.03 6.52 3.03 10.15 2.46 4.46 7.1 10.52 13.79 18l.06.06c14.53 16.6 24.8 28.69 30.5 35.92 5.9 7.51 10.79 14.74 14.51 21.5 4.5 8.15 7.78 15.92 9.77 23.1 2.02 7.3 3.05 15.18 3.05 23.42 0 10.34-1.79 20.55-5.31 30.34-3.54 9.83-8.6 18.62-15 26.13-5.35 6.27-11.6 11.57-18.7 15.88 3.48-.84 6.83-1.82 10.04-2.92 9.05-3.05 17.84-7.82 26.4-14.3 8.56-6.48 16.1-14.07 22.65-22.79 14.72-19.71 22.08-41.93 22.08-66.66 0-17.42-3.68-33.95-11.04-49.57z";
const LOGO_VB = { w: 201.75, h: 223.5 };
// carga videos remotos vía proxy same-origin (para poder exportar sin "canvas tainted")
const viaProxy = (url) => (/^https?:\/\//.test(url) ? `${MOTOR}/gc/proxy?k=${encodeURIComponent(getToken())}&url=${encodeURIComponent(url)}` : url);
// dibuja el video "cover" (recorta para llenar) en un contexto de w×h, con zoom opcional
function drawCoverTo(ctx, v, w, h, zoom) {
  const vw = v.videoWidth || w, vh = v.videoHeight || h;
  const scale = Math.max(w / vw, h / vh) * (zoom || 1);
  const dw = vw * scale, dh = vh * scale;
  ctx.drawImage(v, (w - dw) / 2, (h - dh) / 2, dw, dh);
}

export default function VideoEditor({ data, commit, flash, editorSrc, onPublicar, activo }) {
  const [src, setSrc] = useState("");           // url que carga el <video> (proxy o blob)
  const [nombre, setNombre] = useState("");
  const [dur, setDur] = useState(0);
  const [ini, setIni] = useState(0);
  const [fin, setFin] = useState(0);
  const [texto, setTexto] = useState("");
  const [textoModo, setTextoModo] = useState("junto");    // junto | secuencia (cada línea aparece en su turno)
  const [pos, setPos] = useState("abajo");
  const [musica, setMusica] = useState(null);   // {url}
  const [velocidad, setVelocidad] = useState(1);   // 0.5x lento … 2x rápido
  const [efectoClip, setEfectoClip] = useState("none");   // none|fade|zoom|bn|violeta|splash|anaglifo|glitch
  const [animTexto, setAnimTexto] = useState("none");     // none|fade|pop|deslizar|escribir
  const [orient, setOrient] = useState("original");       // original|9:16|1:1|16:9
  const [logoOn, setLogoOn] = useState(false);            // logo marca de agua
  const [logoPos, setLogoPos] = useState("br");           // tl|tr|centro|bl|br
  const [fondoTexto, setFondoTexto] = useState("none");   // none | suave (caja redondeada baja opacidad)
  const [colorTexto, setColorTexto] = useState("cream");  // cream | violeta
  const [fuenteTexto, setFuenteTexto] = useState("display"); // display (bold) | mono (Courier, footer)
  const [idiomaTxt, setIdiomaTxt] = useState("es");       // idioma para el texto con IA
  const [busyIdeas, setBusyIdeas] = useState(false);
  const offRef = useRef(null);                            // canvas offscreen (anaglifo)
  const previewRef = useRef(null);
  const [previewOn, setPreviewOn] = useState(false);
  const [exportando, setExportando] = useState(false);
  const [progreso, setProgreso] = useState(0);
  const [salidaUrl, setSalidaUrl] = useState("");
  const videoRef = useRef(null);
  const musicRef = useRef(null);

  const galeriaVids = (data.siemon.gc || []).filter((x) => x.video || x.tipo === "video").map((x) => ({ url: x.video || x.imagen, nombre: (x.prompt || "video").slice(0, 40) })).filter((x) => x.url);

  useEffect(() => { if (editorSrc) cargar(editorSrc, "clip del estudio"); /* eslint-disable-next-line */ }, [editorSrc]);

  function cargar(url, nom) {
    setSrc(viaProxy(url)); setNombre(nom || ""); setSalidaUrl(""); setTexto(""); setMusica(null);
  }
  function subir(e) {
    const f = e.target.files && e.target.files[0]; if (!f) return;
    setSrc(URL.createObjectURL(f)); setNombre(f.name); setSalidaUrl("");
  }
  function subirMusica(e) {
    const f = e.target.files && e.target.files[0]; if (!f) return;
    setMusica({ url: URL.createObjectURL(f), nombre: f.name });
  }
  function onMeta() {
    const v = videoRef.current; if (!v) return;
    const d = v.duration || 0; setDur(d); setIni(0); setFin(d);
  }
  // tamaño del lienzo de salida según la orientación elegida (lado mayor <= MAX)
  function targetDims(vw, vh, MAX) {
    MAX = MAX || 720;
    if (orient === "9:16") return { w: Math.round(MAX * 9 / 16), h: MAX };
    if (orient === "1:1") return { w: MAX, h: MAX };
    if (orient === "16:9") return { w: MAX, h: Math.round(MAX * 9 / 16) };
    const scale = Math.min(1, MAX / Math.max(vw || MAX, vh || MAX));
    return { w: Math.round((vw || MAX) * scale), h: Math.round((vh || MAX) * scale) };
  }
  async function ideasTexto() {
    setBusyIdeas(true);
    try {
      const base = (texto || nombre || "").replace(/de la galería|clip del estudio/gi, "").trim();
      const r = await fetch(MOTOR + "/gc/titulares", { method: "POST", headers: H(), body: JSON.stringify({ base, idioma: idiomaTxt }) });
      const d = await r.json();
      const p = (d.propuestas || [])[0];
      if (p) setTexto([p.titulo, p.subtitulo, p.cta].filter(Boolean).join("\n"));
      else flash && flash("No pude generar el texto.");
    } catch { flash && flash("No pude conectar con el motor."); }
    finally { setBusyIdeas(false); }
  }
  // ¿hay algo que solo se ve en el canvas? (logo, texto, filtro, orientación)
  const efectosActivos = logoOn || !!(texto || "").trim() || efectoClip !== "none" || orient !== "original";
  const mostrarCanvas = previewOn || efectosActivos;
  // dibuja UN cuadro fijo con todos los efectos aplicados (preview en vivo, sin reproducir)
  function renderStill() {
    const v = videoRef.current, cv = previewRef.current;
    if (!v || !cv || previewOn || !v.videoWidth) return;
    const t = targetDims(v.videoWidth, v.videoHeight, 480);
    if (cv.width !== t.w || cv.height !== t.h) { cv.width = t.w; cv.height = t.h; }
    try { drawFrame(cv.getContext("2d"), v, t.w, t.h, 0.6); } catch (e) {}
  }
  useEffect(() => { renderStill(); /* eslint-disable-next-line */ }, [logoOn, logoPos, texto, textoModo, animTexto, pos, efectoClip, orient, fondoTexto, colorTexto, fuenteTexto, ini, fin, src, previewOn]);

  function preview() {
    const v = videoRef.current, cv = previewRef.current; if (!v) return;
    const t = targetDims(v.videoWidth, v.videoHeight, 480); const w = t.w, h = t.h;
    if (cv) { cv.width = w; cv.height = h; }
    setPreviewOn(true);
    v.currentTime = ini; v.playbackRate = velocidad; v.muted = true; v.play();
    const ctx = cv && cv.getContext("2d");
    let raf;
    const loop = () => {
      const pr = Math.min(1, Math.max(0, (v.currentTime - ini) / (fin - ini)));
      if (ctx) drawFrame(ctx, v, w, h, pr);
      if (v.currentTime >= fin || v.ended) { v.pause(); setPreviewOn(false); cancelAnimationFrame(raf); return; }
      raf = requestAnimationFrame(loop);
    };
    loop();
  }

  const yPos = (h) => (pos === "arriba" ? h * 0.14 : pos === "medio" ? h * 0.5 : h * 0.88);

  // prog = avance dentro del recorte (0..1)
  function drawFrame(ctx, v, w, h, prog) {
    ctx.save();
    ctx.clearRect(0, 0, w, h);
    ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = 1; ctx.filter = "none";
    const ef = efectoClip;
    const zoom = ef === "zoom" ? (1 + 0.12 * prog) : 1;

    if (ef === "anaglifo") {
      // 3D rojo/cian: dos copias con desfase, aisladas por canal, sumadas
      const off = offRef.current || (offRef.current = document.createElement("canvas"));
      off.width = w; off.height = h; const octx = off.getContext("2d");
      const sh = Math.round(w * 0.012) + 3;
      octx.globalCompositeOperation = "source-over"; octx.clearRect(0, 0, w, h); drawCoverTo(octx, v, w, h, zoom);
      octx.globalCompositeOperation = "multiply"; octx.fillStyle = "#ff0000"; octx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = "source-over"; ctx.drawImage(off, -sh, 0);
      octx.globalCompositeOperation = "source-over"; octx.clearRect(0, 0, w, h); drawCoverTo(octx, v, w, h, zoom);
      octx.globalCompositeOperation = "multiply"; octx.fillStyle = "#00ffff"; octx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = "lighten"; ctx.drawImage(off, sh, 0);
      ctx.globalCompositeOperation = "source-over";
    } else if (ef === "glitch") {
      drawCoverTo(ctx, v, w, h, zoom);
      // bandas horizontales desplazadas (tomadas del propio lienzo)
      const bandas = 6;
      for (let i = 0; i < bandas; i++) {
        const by = Math.floor(((i + (prog * 4) % 1) / bandas) * h) % h;
        const bh = Math.max(2, Math.round(h * 0.025));
        const dx = (i % 2 ? 1 : -1) * Math.round(w * 0.04 * (0.4 + 0.6 * Math.abs(Math.sin(prog * 22 + i))));
        try { ctx.drawImage(ctx.canvas, 0, by, w, bh, dx, by, w, bh); } catch {}
      }
      // tinte violeta sutil en una banda
      ctx.globalCompositeOperation = "screen"; ctx.fillStyle = AETHER; ctx.globalAlpha = 0.14;
      const gy = ((prog * 3) % 1) * h; ctx.fillRect(0, gy, w, h * 0.06); ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
    } else {
      if (ef === "bn" || ef === "violeta" || ef === "splash") ctx.filter = "grayscale(1) contrast(1.05)";
      drawCoverTo(ctx, v, w, h, zoom);
      ctx.filter = "none";
      if (ef === "violeta") {
        ctx.globalCompositeOperation = "multiply"; ctx.fillStyle = AETHER; ctx.fillRect(0, 0, w, h);
        ctx.globalCompositeOperation = "lighten"; ctx.fillStyle = "rgba(20,15,35,0.25)"; ctx.fillRect(0, 0, w, h);
        ctx.globalCompositeOperation = "source-over";
      }
      if (ef === "splash") {
        // círculo central a color (con leve violeta de marca) sobre el B&N
        ctx.save();
        const cx = w / 2, cy = h / 2, r = Math.min(w, h) * 0.34;
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip();
        drawCoverTo(ctx, v, w, h, zoom);
        ctx.globalCompositeOperation = "soft-light"; ctx.fillStyle = AETHER; ctx.globalAlpha = 0.22; ctx.fillRect(0, 0, w, h);
        ctx.restore(); ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
      }
    }
    // fundido de entrada/salida (negro) — se aplica sobre cualquier filtro
    if (ef === "fade") {
      let a = 0;
      if (prog < 0.1) a = 1 - prog / 0.1; else if (prog > 0.9) a = (prog - 0.9) / 0.1;
      if (a > 0) { ctx.fillStyle = `rgba(0,0,0,${a})`; ctx.fillRect(0, 0, w, h); }
    }
    if (texto.trim()) dibujarTexto(ctx, w, h, prog);
    drawLogo(ctx, w, h);
    ctx.restore();
  }

  function dibujarTexto(ctx, w, h, prog) {
    const clipDur = Math.max(0.1, fin - ini);
    let lines, dur, t;
    if (textoModo === "secuencia") {
      // cada línea es una PARTE que aparece en su propia franja del video
      const segs = texto.split("\n").filter((l) => l.trim() !== "");
      if (!segs.length) return;
      const n = segs.length;
      const idx = Math.min(n - 1, Math.floor(prog * n));
      lines = [segs[idx]];
      dur = clipDur / n;                 // duración de cada parte
      t = ((prog * n) - idx) * dur;      // tiempo local dentro de la parte activa
    } else {
      lines = texto.split("\n");
      dur = clipDur; t = prog * dur;
    }
    let alpha = 1, dy = 0, scale = 1, recorte = null;
    if (animTexto === "fade") { if (t < 0.5) alpha = t / 0.5; else if (t > dur - 0.5) alpha = Math.max(0, (dur - t) / 0.5); }
    else if (animTexto === "deslizar") { if (t < 0.5) { dy = (1 - t / 0.5) * h * 0.07; alpha = t / 0.5; } }
    else if (animTexto === "pop") { if (t < 0.4) { scale = 0.72 + 0.28 * (t / 0.4); alpha = t / 0.4; } }
    else if (animTexto === "escribir") { const twDur = Math.min(1.8, dur * 0.85); const total = lines.join("").length; recorte = Math.max(1, Math.round((Math.min(t, twDur) / twDur) * total)); }
    const maxW = w * 0.84;
    // tipografía de marca (fuentes reales del CRM): display (Montserrat bold, tracking apretado),
    // elegante (Montserrat light, aireada) o mono (JetBrains Mono en MAYÚSCULAS, estilo footer).
    const esMono = fuenteTexto === "mono", esEleg = fuenteTexto === "elegante";
    const fam = esMono ? "'JetBrains Mono', ui-monospace, monospace" : "Montserrat, system-ui, sans-serif";
    const weight = esMono ? 500 : (esEleg ? 300 : 700);
    const col = colorTexto === "violeta" ? "#B1A3E1" : "#F6F4FB";
    if (esMono) lines = lines.map((l) => (l || "").toUpperCase());
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    try { ctx.letterSpacing = Math.round(esMono ? h * 0.004 : (esEleg ? h * 0.004 : -h * 0.0015)) + "px"; } catch (e) {}
    let fs = Math.round(h * (esMono ? 0.034 : (esEleg ? 0.04 : 0.045)));
    const setFont = () => { ctx.font = `${weight} ${fs}px ${fam}`; };
    setFont();
    // 1) envolver líneas largas por palabras para que quepan en el ancho
    const wrap = () => {
      const out = [];
      lines.forEach((ln) => {
        const words = (ln || "").split(/\s+/).filter(Boolean);
        if (!words.length) { out.push(""); return; }
        let cur = "";
        words.forEach((wd) => {
          const test = cur ? cur + " " + wd : wd;
          if (cur && ctx.measureText(test).width > maxW) { out.push(cur); cur = wd; } else cur = test;
        });
        out.push(cur);
      });
      return out;
    };
    let wrapped = wrap();
    // 2) si una palabra sigue más ancha que el máximo, encoge la fuente
    let widest = 0; wrapped.forEach((l) => { const tw = ctx.measureText(l).width; if (tw > widest) widest = tw; });
    if (widest > maxW) { fs = Math.max(Math.round(h * 0.022), Math.floor(fs * (maxW / widest))); setFont(); wrapped = wrap(); }
    // 3) máquina de escribir: recorta caracteres sobre el texto ya envuelto
    let drawLines = wrapped;
    if (recorte != null) { let acc = 0; drawLines = wrapped.map((ln) => { const take = Math.max(0, Math.min(ln.length, recorte - acc)); acc += ln.length + 1; return ln.slice(0, take); }); }
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    const lh = fs * 1.2;
    const cyBase = yPos(h) + dy;
    const y0 = cyBase - ((drawLines.length - 1) * fs * 0.62);
    ctx.save();
    ctx.translate(w / 2, cyBase); ctx.scale(scale, scale); ctx.translate(-w / 2, -cyBase);
    const pinta = () => drawLines.forEach((ln, i) => { if (ln) ctx.fillText(ln, w / 2, y0 + i * lh); });
    // caja: fondo redondeado de baja opacidad
    if (fondoTexto === "caja") {
      let bw = 0; drawLines.forEach((ln) => { const tw = ctx.measureText(ln).width; if (tw > bw) bw = tw; });
      const padX = fs * 0.75, padY = fs * 0.5, n = drawLines.length;
      const boxW = bw + padX * 2, boxH = (n - 1) * lh + fs * 1.2 + padY * 2;
      const bx = w / 2 - boxW / 2, by = y0 - fs * 0.6 - padY, r = Math.round(fs * 0.5);
      ctx.fillStyle = "rgba(10,11,13,0.42)";
      if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(bx, by, boxW, boxH, r); ctx.fill(); }
      else ctx.fillRect(bx, by, boxW, boxH);
    }
    ctx.fillStyle = col;
    if (fondoTexto === "resplandor") {
      // resplandor violeta de marca (varias pasadas) + sombra oscura sutil + texto nítido encima
      ctx.shadowColor = "rgba(177,163,225,0.95)"; ctx.shadowBlur = Math.round(fs * 0.9); ctx.shadowOffsetY = 0;
      pinta(); pinta();
      ctx.shadowColor = "rgba(6,6,10,0.55)"; ctx.shadowBlur = Math.round(fs * 0.22); ctx.shadowOffsetY = Math.max(1, Math.round(fs * 0.03));
      pinta();
    } else {
      // sombra suave (o encima de la caja): legibilidad
      if (fondoTexto !== "caja") { ctx.shadowColor = "rgba(6,6,10,0.72)"; ctx.shadowBlur = Math.round(fs * 0.42); ctx.shadowOffsetY = Math.max(1, Math.round(fs * 0.04)); }
      pinta();
    }
    ctx.shadowColor = "transparent"; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    ctx.restore();
    ctx.globalAlpha = 1;
    try { ctx.letterSpacing = "0px"; } catch (e) {}
  }

  function drawLogo(ctx, w, h) {
    if (!logoOn) return;
    const centro = logoPos === "centro";
    const size = centro ? w * 0.34 : w * 0.135;
    const scale = size / LOGO_VB.w, lw = LOGO_VB.w * scale, lh = LOGO_VB.h * scale, m = w * 0.045;
    let x, y;
    if (centro) { x = (w - lw) / 2; y = (h - lh) / 2; }
    else if (logoPos === "tl") { x = m; y = m; }
    else if (logoPos === "tr") { x = w - lw - m; y = m; }
    else if (logoPos === "bl") { x = m; y = h - lh - m; }
    else { x = w - lw - m; y = h - lh - m; }
    ctx.save();
    ctx.globalAlpha = centro ? 0.20 : 0.9;
    ctx.translate(x, y); ctx.scale(scale, scale);
    ctx.shadowColor = "rgba(8,8,12,0.4)"; ctx.shadowBlur = Math.round(size * 0.1);
    ctx.fillStyle = "#E9E5DD"; ctx.fill(new Path2D(LOGO_PATH));
    ctx.restore();
  }

  async function exportar() {
    const v = videoRef.current; if (!v || !src) return flash("Carga un video primero.");
    if (fin - ini < 0.3) return flash("El recorte es muy corto.");
    if (typeof MediaRecorder === "undefined" || !v.captureStream && !v.mozCaptureStream) return flash("Tu navegador no permite exportar. Usa Chrome.");
    setExportando(true); setProgreso(0); setSalidaUrl("");
    try {
      const t = targetDims(v.videoWidth, v.videoHeight, 720); const w = t.w, h = t.h;
      const canvas = document.createElement("canvas"); canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext("2d");
      const vstream = canvas.captureStream(30);

      // audio: original del video + música opcional, mezclados sin sonar por parlantes
      let audioTracks = [];
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        const actx = new AC();
        const dest = actx.createMediaStreamDestination();
        try { const s1 = actx.createMediaElementSource(v); s1.connect(dest); } catch {}
        if (musica && musicRef.current) {
          try { const s2 = actx.createMediaElementSource(musicRef.current); s2.connect(dest); musicRef.current.currentTime = 0; musicRef.current.play(); } catch {}
        }
        audioTracks = dest.stream.getAudioTracks();
      } catch {}
      const stream = new MediaStream([...vstream.getVideoTracks(), ...audioTracks]);
      const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus") ? "video/webm;codecs=vp9,opus" : "video/webm";
      const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6_000_000 });
      const chunks = [];
      rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      const done = new Promise((res) => { rec.onstop = res; });
      rec.start(100);

      v.currentTime = ini; v.muted = false; v.playbackRate = velocidad;
      await v.play();
      let raf;
      const tick = () => {
        const pr = Math.min(1, Math.max(0, (v.currentTime - ini) / (fin - ini)));
        drawFrame(ctx, v, w, h, pr);
        setProgreso(Math.min(100, Math.round(pr * 100)));
        if (v.currentTime >= fin || v.ended) { cancelAnimationFrame(raf); return; }
        raf = requestAnimationFrame(tick);
      };
      tick();
      await new Promise((res) => {
        const chk = () => { if (v.currentTime >= fin || v.ended) { res(); } else requestAnimationFrame(chk); };
        chk();
      });
      cancelAnimationFrame(raf);
      v.pause(); if (musicRef.current) musicRef.current.pause();
      rec.stop();
      await done;
      const blob = new Blob(chunks, { type: "video/webm" });
      setSalidaUrl(URL.createObjectURL(blob));
      setProgreso(100);
      flash("Video exportado. Descárgalo o publícalo.");
    } catch (e) {
      flash("No pude exportar: " + (e.message || e));
    } finally { setExportando(false); }
  }

  function descargar() { if (!salidaUrl) return; const a = document.createElement("a"); a.href = salidaUrl; a.download = "siemon-video.webm"; a.click(); }
  async function publicar() {
    if (!salidaUrl || !onPublicar) return;
    try {
      const blob = await (await fetch(salidaUrl)).blob();
      if (blob.size > 12 * 1024 * 1024) return flash("El video exportado pesa más de 12 MB. Recórtalo un poco o baja la duración.");
      const dataUrl = await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsDataURL(blob); });
      const r = await fetch(MOTOR + "/gc/subir", { method: "POST", headers: { "content-type": "application/json", Authorization: "Bearer " + getToken() }, body: JSON.stringify({ data: dataUrl, ext: "webm" }) });
      const d = await r.json();
      if (d.ok && d.url) { onPublicar({ mediaUrl: d.url, mediaType: "video" }); flash("Video enviado a Publicar."); }
      else flash("No pude subir el video.");
    } catch { flash("No pude subir el video."); }
  }

  return (
    <div style={{ maxWidth: 1100 }}>
      <div className="mb-4">
        <h2 style={{ fontWeight: 600, color: C.cream }} className="fs-18 flex items-center gap-2"><Scissors size={17} color={C.aether} /> Editor de video</h2>
        <div style={{ color: C.ash }} className="fs-11 mt-1">Recorta, añade subtítulo y música, y exporta para tus reels o ads. Funciona mejor en Chrome.</div>
      </div>

      {/* elegir fuente */}
      <div style={{ background: C.panel, border: `1px solid ${C.line}` }} className="rounded-xl p-4 mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <label style={{ background: C.aether, color: C.obsidian, fontWeight: 600 }} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg fs-12 cursor-pointer"><Upload size={14} /> Subir video<input type="file" accept="video/*" onChange={subir} style={{ display: "none" }} /></label>
          {galeriaVids.length > 0 && (
            <select onChange={(e) => e.target.value && cargar(e.target.value, "de la galería")} style={{ ...inS, width: "auto" }} defaultValue="">
              <option value="">…o elige uno generado</option>
              {galeriaVids.map((x, i) => <option key={i} value={x.url}>{x.nombre}</option>)}
            </select>
          )}
          {nombre && <span style={{ color: C.mist }} className="fs-11 truncate">{nombre}</span>}
        </div>
      </div>

      {src && (
        <div style={{ background: C.panel, border: `1px solid ${C.line}` }} className="rounded-xl p-4 mb-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              {(() => { const aspectCss = orient === "9:16" ? "9 / 16" : orient === "1:1" ? "1 / 1" : orient === "16:9" ? "16 / 9" : null; const wrap = aspectCss ? { position: "relative", aspectRatio: aspectCss, height: 380, width: "auto", margin: "0 auto", overflow: "hidden", borderRadius: 10, background: "#000" } : { position: "relative" }; const vid = aspectCss ? { width: "100%", height: "100%", objectFit: "cover", background: "#000", display: mostrarCanvas ? "none" : "block" } : { width: "100%", borderRadius: 10, background: "#000", maxHeight: 380, display: mostrarCanvas ? "none" : "block" }; const can = aspectCss ? { width: "100%", height: "100%", objectFit: "cover", background: "#000", display: mostrarCanvas ? "block" : "none" } : { width: "100%", borderRadius: 10, background: "#000", maxHeight: 380, display: mostrarCanvas ? "block" : "none" }; return (
              <div style={wrap}>
                <video ref={videoRef} src={src} crossOrigin="anonymous" onLoadedMetadata={onMeta} onLoadedData={() => { try { const v = videoRef.current; v.currentTime = Math.min(0.1, v.duration || 0.1); } catch (e) {} }} onSeeked={renderStill} controls style={vid} />
                <canvas ref={previewRef} style={can} />
              </div>
              ); })()}
              <div className="flex items-center gap-3 mt-2">
                <button onClick={preview} style={{ color: C.aether2 }} className="inline-flex items-center gap-1 fs-11"><Play size={12} /> Previsualizar con efectos</button>
                {efectosActivos && !previewOn && <span style={{ color: C.ash }} className="fs-9">· vista con efectos aplicados (fijo)</span>}
              </div>
            </div>
            <div className="flex flex-col gap-3">
              {/* recorte */}
              <div>
                <div style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase mb-1">Recorte · {fmt(ini)} a {fmt(fin)} ({fmt(fin - ini)})</div>
                <div className="flex items-center gap-2">
                  <span style={{ color: C.ash }} className="fs-10">Inicio</span>
                  <input type="range" min={0} max={dur || 0} step={0.1} value={ini} onChange={(e) => setIni(Math.min(Number(e.target.value), fin - 0.3))} style={{ flex: 1 }} />
                </div>
                <div className="flex items-center gap-2">
                  <span style={{ color: C.ash }} className="fs-10">Fin</span>
                  <input type="range" min={0} max={dur || 0} step={0.1} value={fin} onChange={(e) => setFin(Math.max(Number(e.target.value), ini + 0.3))} style={{ flex: 1 }} />
                </div>
              </div>
              {/* velocidad */}
              <div>
                <div style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase mb-1">Velocidad</div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {[[0.5, "0.5x lento"], [1, "1x normal"], [1.5, "1.5x"], [2, "2x rápido"]].map(([vv, l]) => (
                    <button key={vv} onClick={() => setVelocidad(vv)} style={{ background: velocidad === vv ? C.aetherSoft : "transparent", border: `1px solid ${velocidad === vv ? C.aetherLine : C.line}`, color: velocidad === vv ? C.aether2 : C.ash }} className="px-2.5 py-1 rounded fs-10">{l}</button>
                  ))}
                </div>
              </div>
              {/* efecto de clip */}
              <div>
                <div style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase mb-1">Efecto / filtro del clip</div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {[["none", "Ninguno"], ["fade", "Fundido"], ["zoom", "Zoom lento"], ["bn", "B&N"], ["violeta", "Violeta"], ["splash", "Splash violeta"], ["anaglifo", "Anaglifo 3D"], ["glitch", "Glitch"]].map(([id, l]) => (
                    <button key={id} onClick={() => setEfectoClip(id)} style={{ background: efectoClip === id ? C.aetherSoft : "transparent", border: `1px solid ${efectoClip === id ? C.aetherLine : C.line}`, color: efectoClip === id ? C.aether2 : C.ash }} className="px-2.5 py-1 rounded fs-10">{l}</button>
                  ))}
                </div>
              </div>
              {/* orientación de salida */}
              <div>
                <div style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase mb-1">Orientación de salida</div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {[["original", "Original"], ["9:16", "Vertical 9:16"], ["1:1", "Cuadrado 1:1"], ["16:9", "Horizontal 16:9"]].map(([id, l]) => (
                    <button key={id} onClick={() => setOrient(id)} style={{ background: orient === id ? C.aetherSoft : "transparent", border: `1px solid ${orient === id ? C.aetherLine : C.line}`, color: orient === id ? C.aether2 : C.ash }} className="px-2.5 py-1 rounded fs-10">{l}</button>
                  ))}
                </div>
                {orient !== "original" && <div style={{ color: C.ash }} className="fs-9 mt-1">Recorta el video para llenar el formato (ideal para reels/ads).</div>}
              </div>
              {/* animación del texto */}
              <div>
                <div style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase mb-1">Animación del texto</div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {[["none", "Sin animar"], ["fade", "Aparecer/desvanecer"], ["pop", "Pop"], ["deslizar", "Deslizar"], ["escribir", "Máquina de escribir"]].map(([id, l]) => (
                    <button key={id} onClick={() => setAnimTexto(id)} style={{ background: animTexto === id ? C.aetherSoft : "transparent", border: `1px solid ${animTexto === id ? C.aetherLine : C.line}`, color: animTexto === id ? C.aether2 : C.ash }} className="px-2.5 py-1 rounded fs-10">{l}</button>
                  ))}
                </div>
              </div>
              {/* subtítulo */}
              <div>
                <div className="flex items-center justify-between">
                  <label style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase flex items-center gap-1"><Type size={11} /> Subtítulo / texto</label>
                  <div className="flex items-center gap-1.5">
                    <div className="flex items-center gap-0.5">
                      {[["es", "ES"], ["en", "EN"]].map(([id, l]) => (
                        <button key={id} onClick={() => setIdiomaTxt(id)} style={{ background: idiomaTxt === id ? C.aetherSoft : "transparent", border: `1px solid ${idiomaTxt === id ? C.aetherLine : C.line}`, color: idiomaTxt === id ? C.aether2 : C.ash }} className="px-1.5 py-0.5 rounded fs-9">{l}</button>
                      ))}
                    </div>
                    <button onClick={ideasTexto} disabled={busyIdeas} style={{ background: C.aetherSoft, border: `1px solid ${C.aetherLine}`, color: C.aether2 }} className="inline-flex items-center gap-1 px-2 py-1 rounded fs-9"><Sparkles size={10} /> {busyIdeas ? "…" : "Generar con IA"}</button>
                  </div>
                </div>
                <textarea value={texto} onChange={(e) => setTexto(e.target.value)} placeholder={textoModo === "secuencia" ? "Una línea = una parte que aparece en su momento" : "Texto sobre el video (una línea por renglón)"} style={{ ...inS, minHeight: 52, resize: "vertical", marginTop: 4 }} />
                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                  <span style={{ color: C.ash, fontFamily: MONO }} className="fs-9 uppercase mr-0.5">Aparición</span>
                  {[["junto", "Todo junto"], ["secuencia", "Por partes"]].map(([id, l]) => (
                    <button key={id} onClick={() => setTextoModo(id)} title={id === "secuencia" ? "Cada renglón aparece en su turno a lo largo del video" : "Todo el texto se muestra durante todo el clip"} style={{ background: textoModo === id ? C.aetherSoft : "transparent", border: `1px solid ${textoModo === id ? C.aetherLine : C.line}`, color: textoModo === id ? C.aether2 : C.ash }} className="px-2 py-1 rounded fs-10">{l}</button>
                  ))}
                </div>
                {textoModo === "secuencia" && <div style={{ color: C.ash }} className="fs-9 mt-1">El video se reparte entre las partes: cada renglón se muestra en su tramo. Combínalo con "Máquina de escribir" o "Pop".</div>}
                <div className="flex items-center gap-1.5 mt-1.5">
                  <span style={{ color: C.ash, fontFamily: MONO }} className="fs-9 uppercase mr-0.5">Posición</span>
                  {[["arriba", "Arriba"], ["medio", "Medio"], ["abajo", "Abajo"]].map(([v, l]) => (
                    <button key={v} onClick={() => setPos(v)} style={{ background: pos === v ? C.aetherSoft : "transparent", border: `1px solid ${pos === v ? C.aetherLine : C.line}`, color: pos === v ? C.aether2 : C.ash }} className="px-2 py-1 rounded fs-10">{l}</button>
                  ))}
                </div>
                {/* tipografía de marca */}
                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                  <span style={{ color: C.ash, fontFamily: MONO }} className="fs-9 uppercase mr-0.5">Tipografía</span>
                  {[["display", "Título"], ["elegante", "Elegante"], ["mono", "Código"]].map(([id, l]) => (
                    <button key={id} onClick={() => setFuenteTexto(id)} title={id === "mono" ? "JetBrains Mono en mayúsculas (footer de marca)" : id === "elegante" ? "Montserrat light, aireada y fina" : "Montserrat bold, titular"} style={{ background: fuenteTexto === id ? C.aetherSoft : "transparent", border: `1px solid ${fuenteTexto === id ? C.aetherLine : C.line}`, color: fuenteTexto === id ? C.aether2 : C.ash, fontFamily: id === "mono" ? "'JetBrains Mono', monospace" : "'Montserrat', sans-serif", fontWeight: id === "elegante" ? 300 : (id === "display" ? 700 : 500) }} className="px-2 py-1 rounded fs-10">{l}</button>
                  ))}
                </div>
                {/* color y estilo del texto */}
                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                  <span style={{ color: C.ash, fontFamily: MONO }} className="fs-9 uppercase mr-0.5">Color</span>
                  {[["cream", "Claro"], ["violeta", "Violeta"]].map(([id, l]) => (
                    <button key={id} onClick={() => setColorTexto(id)} style={{ background: colorTexto === id ? C.aetherSoft : "transparent", border: `1px solid ${colorTexto === id ? C.aetherLine : C.line}`, color: id === "violeta" ? "#B1A3E1" : (colorTexto === id ? C.aether2 : C.ash) }} className="px-2 py-1 rounded fs-10">{l}</button>
                  ))}
                </div>
                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                  <span style={{ color: C.ash, fontFamily: MONO }} className="fs-9 uppercase mr-0.5">Estilo</span>
                  {[["none", "Sombra"], ["resplandor", "Resplandor"], ["caja", "Caja"]].map(([id, l]) => (
                    <button key={id} onClick={() => setFondoTexto(id)} title={id === "resplandor" ? "Sombra + resplandor violeta de marca" : id === "caja" ? "Caja redondeada de baja opacidad" : "Solo sombra suave"} style={{ background: fondoTexto === id ? C.aetherSoft : "transparent", border: `1px solid ${fondoTexto === id ? C.aetherLine : C.line}`, color: fondoTexto === id ? C.aether2 : C.ash }} className="px-2 py-1 rounded fs-10">{l}</button>
                  ))}
                </div>
              </div>
              {/* logo marca de agua */}
              <div>
                <div className="flex items-center justify-between">
                  <span style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase">Logo (marca de agua)</span>
                  <button onClick={() => setLogoOn((v) => !v)} style={{ background: logoOn ? C.aetherSoft : "transparent", border: `1px solid ${logoOn ? C.aetherLine : C.line}`, color: logoOn ? C.aether2 : C.mist }} className="px-2.5 py-1 rounded-lg fs-10 font-medium">{logoOn ? "✓ Mostrar" : "Mostrar logo"}</button>
                </div>
                {logoOn && (
                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    {[["tl", "Sup. izq."], ["tr", "Sup. der."], ["centro", "Centro"], ["bl", "Inf. izq."], ["br", "Inf. der."]].map(([id, lb]) => { const on = logoPos === id; return (
                      <button key={id} onClick={() => setLogoPos(id)} style={{ background: on ? C.aetherSoft : "transparent", border: `1px solid ${on ? C.aetherLine : C.line}`, color: on ? C.aether2 : C.ash }} className="px-2 py-1 rounded fs-10">{lb}</button>
                    ); })}
                  </div>
                )}
              </div>
              {/* música */}
              <div>
                <label style={{ background: C.carbon, border: `1px solid ${C.line}`, color: C.mist }} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg fs-11 cursor-pointer"><Music size={12} /> {musica ? "Cambiar música" : "Añadir música"}<input type="file" accept="audio/*" onChange={subirMusica} style={{ display: "none" }} /></label>
                {musica && <><span style={{ color: C.ash }} className="fs-10 ml-2">{musica.nombre}</span><audio ref={musicRef} src={musica.url} style={{ display: "none" }} /></>}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 mt-4">
            <button onClick={exportar} disabled={exportando} style={{ background: C.aether, color: C.obsidian, fontWeight: 600, opacity: exportando ? 0.6 : 1 }} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg fs-13"><Scissors size={15} />{exportando ? `Exportando… ${progreso}%` : "Exportar video"}</button>
            {salidaUrl && <>
              <button onClick={descargar} style={{ background: "transparent", border: `1px solid ${C.aetherLine}`, color: C.aether2, fontWeight: 600 }} className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-lg fs-13"><Download size={14} /> Descargar</button>
              {onPublicar && <button onClick={publicar} style={{ background: "transparent", border: `1px solid ${C.aetherLine}`, color: C.aether2, fontWeight: 600 }} className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-lg fs-13"><Send size={14} /> Publicar →</button>}
            </>}
          </div>
          {salidaUrl && <video src={salidaUrl} controls style={{ width: "100%", maxWidth: 320, borderRadius: 10, marginTop: 12, background: "#000" }} />}
        </div>
      )}

      {!src && <div style={{ color: C.ash }} className="fs-12">Sube un video o genera uno en la pestaña de Imagen/Video y pulsa "Editar".</div>}
    </div>
  );
}
