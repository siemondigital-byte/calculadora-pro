import React, { useState } from "react";
import { Search, Wand2, Sparkles, Image as ImageIcon } from "lucide-react";
import { getToken } from "./db";
import EditorImagen from "./EditorImagen.jsx";

// Selector de imagen reutilizable: banco gratis (Pexels/Unsplash/Pixabay) con orientación + fuente,
// generación con IA (FAL, optimizada) y editor de filtros/logo/texto. Devuelve la URL elegida por onElegir.
// Se usa en Contenido, Blog (portada) y Nurturing (imagen del correo).
const C = {
  panel: "#101826", carbon: "#0F1B2D", line: "rgba(255,255,255,0.08)",
  aether: "#E6C788", aether2: "#EFD9A7", aetherSoft: "rgba(230,199,136,0.14)", aetherLine: "rgba(230,199,136,0.30)",
  cream: "#F4EFE6", mist: "#D7D7D9", ash: "#8B8D98", ok: "#7FB89B",
};
const SANS = "'Instrument Sans', system-ui, sans-serif";
const MONO = "'JetBrains Mono', ui-monospace, monospace";
const MOTOR = import.meta.env.VITE_MOTOR_URL || "https://motor.atlantisglobalrealty.com";
const H = () => ({ "content-type": "application/json", Authorization: "Bearer " + getToken() });
const inS = { background: "#0D1420", border: `1px solid ${C.line}`, color: C.cream, borderRadius: 10, padding: "9px 11px", width: "100%", fontFamily: SANS, fontSize: 13, outline: "none" };

export default function SelectorMedia({ contexto = "", onElegir, flash, orientDefault = "landscape", permitirIA = true }) {
  const [q, setQ] = useState("");
  const [orient, setOrient] = useState(orientDefault);
  const [fuente, setFuente] = useState("todos");
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);
  const [iaBusy, setIaBusy] = useState(false);
  const [editar, setEditar] = useState("");

  async function buscar() {
    const query = (q || contexto || "").trim();
    if (!query) return flash && flash("Escribe qué foto buscar.");
    setBusy(true);
    try {
      const r = await fetch(MOTOR + "/blog/fotos", { method: "POST", headers: H(), body: JSON.stringify({ query, orientation: orient, fuente }) });
      const d = await r.json();
      if (d.error === "sin_key") { setRes(null); return flash && flash("Conecta una API key gratis (Pexels/Unsplash/Pixabay) en Accesos."); }
      setRes(d.fotos || []);
      if (!(d.fotos || []).length) flash && flash("Sin resultados. Prueba otras palabras (o en inglés).");
    } catch { flash && flash("No pude buscar en el banco."); }
    finally { setBusy(false); }
  }

  async function generarIA() {
    const tema = (q || contexto || "").trim();
    if (!tema) return flash && flash("Escribe el tema de la imagen.");
    setIaBusy(true); flash && flash("Generando imagen con IA en tu estilo…");
    try {
      const r = await fetch(MOTOR + "/blog/imagen", { method: "POST", headers: H(), body: JSON.stringify({ titulo: tema, keyword: contexto || tema }) });
      const d = await r.json();
      if (d.ok && d.url) { onElegir && onElegir(d.url); flash && flash("Imagen IA lista ✓" + (d.optimizada ? ` (${d.peso_kb} KB)` : "")); }
      else flash && flash("No pude generar: " + (d.nota || d.error || "revisa la FAL_API_KEY"));
    } catch { flash && flash("No pude generar la imagen."); }
    finally { setIaBusy(false); }
  }

  const chip = (id, lb, val, setVal) => { const on = val === id; return (
    <button key={id} onClick={() => setVal(id)} style={{ background: on ? C.aetherSoft : "transparent", border: `1px solid ${on ? C.aetherLine : C.line}`, color: on ? C.aether2 : C.ash }} className="px-2.5 py-1 rounded-lg fs-10">{lb}</button>
  ); };

  return (
    <div style={{ background: C.carbon, border: `1px solid ${C.line}`, borderRadius: 12, padding: 12 }} className="space-y-2">
      {permitirIA && (
        <button onClick={generarIA} disabled={iaBusy} style={{ background: C.aetherSoft, border: `1px solid ${C.aetherLine}`, color: C.aether2, fontWeight: 600, opacity: iaBusy ? 0.6 : 1 }} className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg fs-12"><Sparkles size={13} /> {iaBusy ? "Generando…" : "Generar con IA (tu estilo)"}</button>
      )}
      <div>
        <label style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase inline-flex items-center gap-1"><Search size={11} /> Buscar foto real gratis (banco)</label>
        <div className="flex gap-2 mt-1.5">
          <input style={inS} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && buscar()} placeholder={contexto ? `ej. ${contexto.slice(0, 40)}` : "ej. oficina moderna, equipo, tecnología"} />
          <button onClick={buscar} disabled={busy} style={{ background: C.panel, border: `1px solid ${C.aetherLine}`, color: C.aether2 }} className="px-3 rounded-lg fs-12 shrink-0">{busy ? "…" : "Buscar"}</button>
        </div>
        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
          <span style={{ color: C.ash, fontFamily: MONO }} className="fs-9 uppercase mr-1">Orient.</span>
          {chip("landscape", "Horizontal", orient, setOrient)}{chip("portrait", "Vertical", orient, setOrient)}{chip("square", "Cuadrado", orient, setOrient)}
        </div>
        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
          <span style={{ color: C.ash, fontFamily: MONO }} className="fs-9 uppercase mr-1">Fuente</span>
          {chip("todos", "Todos", fuente, setFuente)}{chip("pexels", "Pexels", fuente, setFuente)}{chip("pixabay", "Pixabay", fuente, setFuente)}{chip("unsplash", "Unsplash", fuente, setFuente)}
        </div>
      </div>
      {res && res.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {res.map((f, i) => (
            <div key={i} className="shrink-0 flex flex-col items-center gap-1">
              <img src={f.thumb} alt={f.autor} title={`${f.banco} · ${f.autor} · clic para usar`} onClick={() => { onElegir && onElegir(f.url); flash && flash(`Imagen del banco lista (${f.banco}).`); }} style={{ height: 66, borderRadius: 8, cursor: "pointer", border: `1px solid ${C.line}` }} />
              <button onClick={() => setEditar(f.url)} style={{ color: C.aether2 }} className="fs-9 inline-flex items-center gap-0.5"><Wand2 size={9} /> editar</button>
            </div>
          ))}
        </div>
      )}
      {res && res.length === 0 && <div style={{ color: C.ash }} className="fs-11 inline-flex items-center gap-1"><ImageIcon size={12} /> Sin resultados — prueba otras palabras.</div>}
      {editar && <EditorImagen src={editar} contexto={contexto} flash={flash} onCerrar={() => setEditar("")} onGuardar={(u) => { setEditar(""); onElegir && onElegir(u); }} />}
    </div>
  );
}
