import React, { useRef, useState, useEffect, useCallback } from "react";
import { Sparkles, Check, X, Wand2, Type, Download } from "lucide-react";
import { getToken } from "./db";

const C = {
  obsidian: "#0A0B0D", panel: "#16171C", carbon: "#131418", line: "rgba(255,255,255,0.08)",
  aether: "#B1A3E1", aether2: "#CBC0EC", aether500: "#8474BE", aetherSoft: "rgba(177,163,225,0.14)",
  aetherLine: "rgba(177,163,225,0.30)", cream: "#E9E5DD", mist: "#C9CAD2", ash: "#8B8D98", ok: "#7FB89B",
};
const SANS = "'Montserrat', system-ui, sans-serif";
const MONO = "'JetBrains Mono', ui-monospace, monospace";
const MOTOR = import.meta.env.VITE_MOTOR_URL || "https://prospeccion.siemondigital.com";
const H = () => ({ "content-type": "application/json", Authorization: "Bearer " + getToken() });
const inS = { background: "#101116", border: `1px solid ${C.line}`, color: C.cream, borderRadius: 10, padding: "9px 11px", width: "100%", fontFamily: SANS, fontSize: 13, outline: "none" };

const AETHER = [177, 163, 225];   // violeta de marca #B1A3E1
// logomark "S" de Siemon (viewBox 201.75 x 223.5)
const LOGO_PATH = "M76.54 0c-1.42 6.1-2.13 10.83-2.13 14.2 0 4.8 1.42 9.76 4.25 14.88 2.83 5.12 7.84 11.71 15.04 19.77 14.49 16.56 24.54 28.4 30.17 35.53 5.6 7.13 10.16 13.86 13.64 20.18 4.15 7.52 7.12 14.52 8.91 21 1.8 6.48 2.7 13.43 2.7 20.83 0 9.26-1.58 18.27-4.74 27.04-3.17 8.77-7.57 16.48-13.25 23.12-15.04 17.65-38.09 26.47-69.16 26.47H.19v-52.8h54.77c11.66 0 20-2.89 25.01-8.67 4.03-4.79 6.06-9.97 6.06-15.53 0-6.43-2.29-13.05-6.87-19.87-4.59-6.8-15.86-20.47-33.85-40.96-8.28-9.59-14.63-17.47-19.05-23.63-4.41-6.15-7.66-11.79-9.72-16.92C13.05 36.03 11.31 28.18 11.31 21.09c0-5.24.77-12.26 2.28-21.09H76.54zM189.98 62.5c-7.36-15.63-17.57-28.68-30.66-39.13-9.8-7.85-21.04-13.69-33.68-17.56C113.99 2.25 100.96.32 86.53.04l-.5 2.17c-1.55 6.66-1.88 10.2-1.88 12.01 0 3.1 1.03 6.52 3.03 10.15 2.46 4.46 7.1 10.52 13.79 18l.06.06c14.53 16.6 24.8 28.69 30.5 35.92 5.9 7.51 10.79 14.74 14.51 21.5 4.5 8.15 7.78 15.92 9.77 23.1 2.02 7.3 3.05 15.18 3.05 23.42 0 10.34-1.79 20.55-5.31 30.34-3.54 9.83-8.6 18.62-15 26.13-5.35 6.27-11.6 11.57-18.7 15.88 3.48-.84 6.83-1.82 10.04-2.92 9.05-3.05 17.84-7.82 26.4-14.3 8.56-6.48 16.1-14.07 22.65-22.79 14.72-19.71 22.08-41.93 22.08-66.66 0-17.42-3.68-33.95-11.04-49.57z";
const LOGO_VB = { w: 201.75, h: 223.5 };
const FILTROS = [
  { id: "none", label: "Original" },
  { id: "bn", label: "Blanco y negro" },
  { id: "violeta", label: "Violeta" },
  { id: "splash", label: "Splash violeta" },
  { id: "anaglifo", label: "Anaglifo 3D" },
  { id: "glitch", label: "Glitch (zona)" },
];

// Editor de imagen reutilizable: filtros (B&N, anaglifo, glitch por banda) + 3 textos (arriba/medio/abajo)
// con ideas por IA. Devuelve una URL nueva (subida al motor) por onGuardar. Usa el proxy para no "tintar" el canvas.
export default function EditorImagen({ src, onGuardar, onCerrar, flash, contexto }) {
  const canvasRef = useRef(null);
  const srcDataRef = useRef(null);
  const [dim, setDim] = useState({ w: 1080, h: 1080 });
  const [filtro, setFiltro] = useState("none");
  const [txt, setTxt] = useState({ arriba: "", medio: "", abajo: "" });
  const [glitchY, setGlitchY] = useState(45);      // centro de la banda (%)
  const [glitchH, setGlitchH] = useState(20);      // alto de la banda (%)
  const [intensidad, setIntensidad] = useState(12);
  const [logoOn, setLogoOn] = useState(true);       // marca de agua del logo
  const [logoPos, setLogoPos] = useState("br");     // tl|tr|bl|br|centro
  const [splashX, setSplashX] = useState(50);      // splash: centro X (%)
  const [splashY, setSplashY] = useState(50);      // splash: centro Y (%)
  const [splashR, setSplashR] = useState(32);      // splash: radio (%)
  const [cargando, setCargando] = useState(true);
  const [busyIdeas, setBusyIdeas] = useState(false);
  const [idiomaTxt, setIdiomaTxt] = useState("es");
  const [guardando, setGuardando] = useState(false);

  // cargar la imagen (por el proxy si es externa, para poder exportarla)
  useEffect(() => {
    if (!src) return;
    setCargando(true); srcDataRef.current = null;
    const img = new Image();
    img.crossOrigin = "anonymous";
    const externa = /^https?:/i.test(src) && src.indexOf(window.location.host) === -1;
    const url = externa ? MOTOR + "/gc/proxy?k=" + encodeURIComponent(getToken()) + "&url=" + encodeURIComponent(src) : src;
    img.onload = () => {
      let w = img.naturalWidth || 1080, h = img.naturalHeight || 1080;
      const max = 1280;
      if (w > max) { h = Math.round(h * max / w); w = max; }
      const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
      const cx = cv.getContext("2d"); cx.drawImage(img, 0, 0, w, h);
      try { srcDataRef.current = cx.getImageData(0, 0, w, h); } catch (e) { srcDataRef.current = null; }
      setDim({ w, h }); setCargando(false);
    };
    img.onerror = () => { setCargando(false); flash && flash("No pude cargar la imagen para editar."); };
    img.src = url;
  }, [src]);

  const aplicarFiltro = useCallback((srcData) => {
    const w = srcData.width, h = srcData.height, s = srcData.data;
    const out = new Uint8ClampedArray(s);
    const idx = (x, y) => ((y * w + x) << 2);
    if (filtro === "bn") {
      for (let i = 0; i < s.length; i += 4) { const g = 0.299 * s[i] + 0.587 * s[i + 1] + 0.114 * s[i + 2]; out[i] = out[i + 1] = out[i + 2] = g; }
    } else if (filtro === "anaglifo") {
      const off = Math.max(1, Math.round(intensidad * w / 320));
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const o = idx(x, y);
        const rx = Math.min(w - 1, x + off), bx = Math.max(0, x - off);
        out[o] = s[idx(rx, y)];
        out[o + 1] = s[idx(bx, y) + 1];
        out[o + 2] = s[idx(bx, y) + 2];
      }
    } else if (filtro === "violeta") {
      // duotono violeta de marca: gris tenido hacia el aether
      for (let i = 0; i < s.length; i += 4) {
        const g = 0.299 * s[i] + 0.587 * s[i + 1] + 0.114 * s[i + 2], t = g / 255;
        out[i] = Math.round(14 + t * (AETHER[0] - 14));
        out[i + 1] = Math.round(15 + t * (AETHER[1] - 15));
        out[i + 2] = Math.round(20 + t * (AETHER[2] - 20));
      }
    } else if (filtro === "splash") {
      // B&N en toda la imagen, y una zona (elipse posicionable) en violeta de marca
      const cx0 = splashX / 100 * w, cy0 = splashY / 100 * h, rr = splashR / 100 * Math.min(w, h);
      const feather = rr * 0.35;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const o = idx(x, y);
        const g = 0.299 * s[o] + 0.587 * s[o + 1] + 0.114 * s[o + 2], t = g / 255;
        const d = Math.hypot(x - cx0, y - cy0);
        let m = 0;   // 0 = B&N, 1 = violeta pleno
        if (d < rr - feather) m = 1;
        else if (d < rr) m = (rr - d) / feather;
        const vr = 14 + t * (AETHER[0] - 14), vg = 15 + t * (AETHER[1] - 15), vb = 20 + t * (AETHER[2] - 20);
        out[o] = Math.round(g * (1 - m) + vr * m);
        out[o + 1] = Math.round(g * (1 - m) + vg * m);
        out[o + 2] = Math.round(g * (1 - m) + vb * m);
      }
    } else if (filtro === "glitch") {
      const cy = Math.round(glitchY / 100 * h), hh = Math.round(glitchH / 100 * h);
      const y0 = Math.max(0, cy - (hh >> 1)), y1 = Math.min(h, cy + (hh >> 1));
      const sh = Math.max(2, Math.round(intensidad * w / 160));
      for (let y = y0; y < y1; y++) {
        // desplazamiento por fila, determinista (no parpadea al re-renderizar)
        const slice = (((y * 2654435761) >>> 0) % (sh * 2 + 1)) - sh;
        for (let x = 0; x < w; x++) {
          const o = idx(x, y);
          const rx = Math.min(w - 1, Math.max(0, x + slice + sh));
          const bx = Math.min(w - 1, Math.max(0, x + slice - sh));
          out[o] = s[idx(rx, y)];
          out[o + 1] = s[o + 1];
          out[o + 2] = s[idx(bx, y) + 2];
        }
      }
    }
    return new ImageData(out, w, h);
  }, [filtro, intensidad, glitchY, glitchH, splashX, splashY, splashR]);

  function wrapText(cx, text, cxX, cyY, maxW, lineH, fs) {
    const words = (text || "").split(/\s+/);
    const lines = []; let line = "";
    for (const wd of words) {
      const test = line ? line + " " + wd : wd;
      if (cx.measureText(test).width > maxW && line) { lines.push(line); line = wd; } else line = test;
    }
    if (line) lines.push(line);
    const totalH = lines.length * lineH;
    let y = cyY - totalH / 2 + lineH / 2;
    for (const ln of lines) { cx.fillText(ln, cxX, y); y += lineH; }
  }

  const render = useCallback(() => {
    const cv = canvasRef.current; if (!cv || !srcDataRef.current) return;
    cv.width = dim.w; cv.height = dim.h;
    const cx = cv.getContext("2d");
    const out = filtro === "none" ? srcDataRef.current : aplicarFiltro(srcDataRef.current);
    cx.putImageData(out, 0, 0);
    const maxW = dim.w * 0.86;
    // cuántas líneas ocupa un texto a un tamaño dado
    const nLineas = (t, fs, weight) => {
      cx.font = `${weight} ${fs}px ${SANS}`;
      const words = (t || "").split(/\s+/); let line = "", n = 0;
      for (const w of words) { const tt = line ? line + " " + w : w; if (cx.measureText(tt).width > maxW && line) { n++; line = w; } else line = tt; }
      return (line ? n + 1 : n) || 1;
    };
    // baja el tamaño hasta que el texto quepa en maxH (marca Siemon: legible y aireado)
    const ajustar = (t, startF, minF, maxHF, weight) => {
      let fs = Math.round(dim.w * startF); const minFs = Math.round(dim.w * minF); const maxH = dim.h * maxHF;
      while (fs > minFs && nLineas(t, fs, weight) * fs * 1.16 > maxH) fs -= 2;
      return fs;
    };
    const draw = (t, ry, startF, minF, maxHF, weight, upper) => {
      if (!t) return;
      const txt2 = upper ? t.toUpperCase() : t;
      const fs = ajustar(txt2, startF, minF, maxHF, weight);
      cx.font = `${weight} ${fs}px ${SANS}`; cx.textAlign = "center"; cx.textBaseline = "middle";
      // sin borde: sombra suave para legibilidad (limpio, estilo marca)
      cx.shadowColor = "rgba(8,8,12,0.45)"; cx.shadowBlur = Math.round(fs * 0.3); cx.shadowOffsetY = Math.round(fs * 0.03);
      cx.fillStyle = C.cream;
      wrapText(cx, txt2, dim.w / 2, dim.h * ry, maxW, fs * 1.16, fs);
      cx.shadowColor = "transparent"; cx.shadowBlur = 0; cx.shadowOffsetY = 0;
    };
    // Encabezado: etiqueta chica en mayúsculas · Principal: titular grande (sentence case) · Pie: CTA chico
    draw(txt.arriba, 0.13, 0.032, 0.024, 0.14, "600", true);
    draw(txt.medio, 0.5, 0.058, 0.03, 0.4, "800", false);
    draw(txt.abajo, 0.9, 0.03, 0.022, 0.1, "600", true);
    // marca de agua: logo Siemon
    if (logoOn) {
      const size = dim.w * (logoPos === "centro" ? 0.34 : 0.1);
      const scale = size / LOGO_VB.w, lw = LOGO_VB.w * scale, lh = LOGO_VB.h * scale, m = dim.w * 0.045;
      let lx, ly;
      if (logoPos === "tl") { lx = m; ly = m; }
      else if (logoPos === "tr") { lx = dim.w - lw - m; ly = m; }
      else if (logoPos === "bl") { lx = m; ly = dim.h - lh - m; }
      else if (logoPos === "centro") { lx = (dim.w - lw) / 2; ly = (dim.h - lh) / 2; }
      else { lx = dim.w - lw - m; ly = dim.h - lh - m; }
      cx.save();
      cx.globalAlpha = logoPos === "centro" ? 0.22 : 0.88;
      cx.shadowColor = "rgba(8,8,12,0.4)"; cx.shadowBlur = Math.round(size * 0.1);
      cx.translate(lx, ly); cx.scale(scale, scale);
      cx.fillStyle = C.cream; cx.fill(new Path2D(LOGO_PATH));
      cx.restore();
    }
  }, [dim, filtro, txt, aplicarFiltro, logoOn, logoPos]);

  useEffect(() => { render(); }, [render, cargando]);

  async function ideasTexto() {
    setBusyIdeas(true);
    try {
      const r = await fetch(MOTOR + "/gc/titulares", { method: "POST", headers: H(), body: JSON.stringify({ base: contexto || txt.medio || txt.arriba || "", idioma: idiomaTxt }) });
      const d = await r.json();
      const p = (d.propuestas || [])[0];
      if (p) setTxt({ arriba: p.titulo || "", medio: p.subtitulo || "", abajo: p.cta || "" });
      else flash && flash("No pude generar ideas de texto.");
    } catch { flash && flash("No pude conectar con el motor."); }
    finally { setBusyIdeas(false); }
  }

  async function guardar(descargar) {
    const cv = canvasRef.current; if (!cv) return;
    let dataUrl;
    try { dataUrl = cv.toDataURL("image/png"); }
    catch { flash && flash("Esta imagen no permite edición (protección del origen). Súbela o usa una del banco/FAL."); return; }
    if (descargar) { const a = document.createElement("a"); a.download = "siemon-pieza.png"; a.href = dataUrl; a.click(); return; }
    setGuardando(true);
    try {
      const r = await fetch(MOTOR + "/gc/subir", { method: "POST", headers: H(), body: JSON.stringify({ data: dataUrl, ext: "png" }) });
      const d = await r.json();
      if (d.ok && d.url) { onGuardar && onGuardar(d.url); flash && flash("Imagen editada lista."); }
      else flash && flash("No pude guardar: " + (d.error || ""));
    } catch { flash && flash("No pude guardar la imagen."); }
    finally { setGuardando(false); }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(6,7,9,0.72)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onCerrar}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: C.panel, border: `1px solid ${C.aetherLine}`, borderRadius: 16, width: "100%", maxWidth: 880, maxHeight: "92vh", overflow: "auto" }} className="p-4 md:p-5">
        <div className="flex items-center justify-between mb-3">
          <div style={{ color: C.cream, fontWeight: 700 }} className="fs-15 inline-flex items-center gap-2"><Wand2 size={17} color={C.aether} /> Editar pieza</div>
          <button onClick={onCerrar} style={{ color: C.ash }}><X size={18} /></button>
        </div>

        <div className="flex flex-col md:flex-row gap-4">
          {/* lienzo */}
          <div style={{ flex: "0 0 auto", width: "min(100%, 360px)" }}>
            <div style={{ background: "#000", borderRadius: 12, border: `1px solid ${C.line}`, overflow: "hidden", display: "grid", placeItems: "center", minHeight: 200 }}>
              {cargando ? <div style={{ color: C.ash }} className="fs-12 py-10">Cargando imagen…</div>
                : <canvas ref={canvasRef} style={{ maxWidth: "100%", height: "auto", display: "block" }} />}
            </div>
          </div>

          {/* controles */}
          <div className="flex-1 flex flex-col gap-4">
            <div>
              <label style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase">Filtro</label>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {FILTROS.map((f) => (
                  <button key={f.id} onClick={() => setFiltro(f.id)} style={{ background: filtro === f.id ? C.aetherSoft : C.carbon, border: `1px solid ${filtro === f.id ? C.aetherLine : C.line}`, color: filtro === f.id ? C.aether2 : C.mist }} className="px-3 py-1.5 rounded-lg fs-12">{f.label}</button>
                ))}
              </div>
            </div>

            {(filtro === "anaglifo" || filtro === "glitch") && (
              <div className="flex flex-col gap-2">
                <label style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase">Intensidad</label>
                <input type="range" min="4" max="40" value={intensidad} onChange={(e) => setIntensidad(Number(e.target.value))} style={{ accentColor: C.aether }} />
                {filtro === "glitch" && <>
                  <label style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase mt-1">Posición de la zona</label>
                  <input type="range" min="8" max="92" value={glitchY} onChange={(e) => setGlitchY(Number(e.target.value))} style={{ accentColor: C.aether }} />
                  <label style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase mt-1">Alto de la zona</label>
                  <input type="range" min="6" max="60" value={glitchH} onChange={(e) => setGlitchH(Number(e.target.value))} style={{ accentColor: C.aether }} />
                </>}
              </div>
            )}

            {filtro === "splash" && (
              <div className="flex flex-col gap-2">
                <label style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase">Posición horizontal de la zona violeta</label>
                <input type="range" min="0" max="100" value={splashX} onChange={(e) => setSplashX(Number(e.target.value))} style={{ accentColor: C.aether }} />
                <label style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase mt-1">Posición vertical</label>
                <input type="range" min="0" max="100" value={splashY} onChange={(e) => setSplashY(Number(e.target.value))} style={{ accentColor: C.aether }} />
                <label style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase mt-1">Tamaño de la zona</label>
                <input type="range" min="10" max="80" value={splashR} onChange={(e) => setSplashR(Number(e.target.value))} style={{ accentColor: C.aether }} />
              </div>
            )}

            <div>
              <div className="flex items-center justify-between">
                <label style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase inline-flex items-center gap-1"><Type size={11} /> Texto sobre la imagen</label>
                <div className="inline-flex items-center gap-2">
                  <div className="inline-flex rounded-md overflow-hidden" style={{ border: `1px solid ${C.line}` }}>
                    {["es", "en"].map((lg) => { const on = idiomaTxt === lg; return (
                      <button key={lg} onClick={() => setIdiomaTxt(lg)} style={{ background: on ? C.aetherSoft : "transparent", color: on ? C.aether2 : C.ash, fontFamily: MONO }} className="fs-9 px-1.5 py-0.5 uppercase">{lg}</button>
                    ); })}
                  </div>
                  <button onClick={ideasTexto} disabled={busyIdeas} style={{ color: C.aether2, opacity: busyIdeas ? 0.6 : 1 }} className="fs-10 inline-flex items-center gap-1"><Sparkles size={11} /> {busyIdeas ? "pensando…" : "dame ideas"}</button>
                </div>
              </div>
              <div className="flex flex-col gap-1.5 mt-1.5">
                <input style={inS} value={txt.arriba} onChange={(e) => setTxt((t) => ({ ...t, arriba: e.target.value }))} placeholder="Encabezado (arriba) · opcional" />
                <input style={{ ...inS, fontWeight: 600 }} value={txt.medio} onChange={(e) => setTxt((t) => ({ ...t, medio: e.target.value }))} placeholder="Texto principal (centro) · opcional" />
                <input style={inS} value={txt.abajo} onChange={(e) => setTxt((t) => ({ ...t, abajo: e.target.value }))} placeholder="Pie (abajo) · opcional" />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase">Logo (marca de agua)</label>
                <button onClick={() => setLogoOn((v) => !v)} style={{ color: logoOn ? C.aether2 : C.ash }} className="fs-10">{logoOn ? "● mostrar" : "○ oculto"}</button>
              </div>
              {logoOn && (
                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                  {[["tl", "Sup. izq."], ["tr", "Sup. der."], ["centro", "Centro"], ["bl", "Inf. izq."], ["br", "Inf. der."]].map(([id, lb]) => { const on = logoPos === id; return (
                    <button key={id} onClick={() => setLogoPos(id)} style={{ background: on ? C.aetherSoft : "transparent", border: `1px solid ${on ? C.aetherLine : C.line}`, color: on ? C.aether2 : C.ash }} className="px-2 py-1 rounded fs-10">{lb}</button>
                  ); })}
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 mt-1">
              <button onClick={() => guardar(false)} disabled={guardando || cargando} style={{ background: C.aether, color: C.obsidian, fontWeight: 600, opacity: (guardando || cargando) ? 0.6 : 1 }} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg fs-13"><Check size={15} />{guardando ? "Guardando…" : "Usar esta imagen"}</button>
              <button onClick={() => guardar(true)} disabled={cargando} style={{ border: `1px solid ${C.aetherLine}`, color: C.aether2 }} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg fs-12"><Download size={13} /> Descargar</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
