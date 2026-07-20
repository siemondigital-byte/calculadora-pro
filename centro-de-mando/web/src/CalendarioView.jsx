import React, { useState } from "react";
import { ChevronLeft, ChevronRight, Trash2, CalendarDays } from "lucide-react";
import { C, MONO } from "./tema.js";

const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const DIAS = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sá", "Do"];
const ymd = (y, m, d) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

// Calendario de publicación: publicaciones (programadas y publicadas) y
// artículos de blog con fecha, por workspace.
export default function CalendarioView({ data, commit, ws }) {
  const [aviso, setAviso] = useState("");
  const flash = (m) => { setAviso(m); window.clearTimeout(flash._t); flash._t = window.setTimeout(() => setAviso(""), 5000); };
  const hoy = new Date();
  const [ym, setYm] = useState({ y: hoy.getFullYear(), m: hoy.getMonth() });
  const [sel, setSel] = useState("");
  const pubs = data[ws].publicaciones || [];
  const blogs = (data[ws].blogArticulos || []).filter((a) => a.fechaPublicacion);

  const primero = new Date(ym.y, ym.m, 1);
  const offset = (primero.getDay() + 6) % 7; // lunes = 0
  const dias = new Date(ym.y, ym.m + 1, 0).getDate();
  const celdas = [];
  for (let i = 0; i < offset; i++) celdas.push(null);
  for (let d = 1; d <= dias; d++) celdas.push(d);

  const porDia = (d) => pubs.filter((p) => (p.fecha || "") === ymd(ym.y, ym.m, d));
  const blogsDia = (d) => blogs.filter((a) => a.fechaPublicacion === ymd(ym.y, ym.m, d));
  const mover = (delta) => { let m = ym.m + delta, y = ym.y; if (m < 0) { m = 11; y--; } if (m > 11) { m = 0; y++; } setYm({ y, m }); setSel(""); };
  const borrar = (id) => { commit({ ...data, [ws]: { ...data[ws], publicaciones: pubs.filter((x) => x.id !== id) } }); flash("Eliminada."); };
  const cambiarFecha = (id, fecha) => { commit({ ...data, [ws]: { ...data[ws], publicaciones: pubs.map((x) => x.id === id ? { ...x, fecha, estado: x.estado === "Publicada" ? x.estado : "Programada" } : x) } }); flash("Fecha actualizada."); };

  const programadas = pubs.filter((p) => p.estado === "Programada").sort((a, b) => (a.fecha || "").localeCompare(b.fecha || ""));

  return (
    <div style={{ maxWidth: 1100 }}>
      <div className="mb-4 flex items-center justify-between flex-wrap gap-2">
        <h2 style={{ fontWeight: 600, color: C.cream }} className="fs-18 flex items-center gap-2"><CalendarDays size={17} color={C.aether} /> Calendario de publicación</h2>
        <div className="flex items-center gap-2">
          <button onClick={() => mover(-1)} style={{ color: C.mist, border: `1px solid ${C.line}` }} className="p-1.5 rounded-lg"><ChevronLeft size={15} /></button>
          <span style={{ color: C.cream, minWidth: 140 }} className="fs-13 text-center font-medium">{MESES[ym.m]} {ym.y}</span>
          <button onClick={() => mover(1)} style={{ color: C.mist, border: `1px solid ${C.line}` }} className="p-1.5 rounded-lg"><ChevronRight size={15} /></button>
        </div>
      </div>

      {aviso && <div style={{ background: C.aetherSoft, border: `1px solid ${C.aetherLine}`, color: C.aether2 }} className="rounded-lg px-3 py-2 mb-3 fs-12">{aviso}</div>}

      <div style={{ background: C.panel, border: `1px solid ${C.line}` }} className="rounded-xl p-3 mb-4">
        <div className="grid grid-cols-7 gap-1 mb-1">{DIAS.map((d) => <div key={d} style={{ color: C.ash, fontFamily: MONO }} className="fs-9 uppercase text-center py-1">{d}</div>)}</div>
        <div className="grid grid-cols-7 gap-1">
          {celdas.map((d, i) => {
            if (!d) return <div key={i} />;
            const items = porDia(d);
            const esHoy = ym.y === hoy.getFullYear() && ym.m === hoy.getMonth() && d === hoy.getDate();
            return (
              <div key={i} style={{ background: C.carbon, border: `1px solid ${esHoy ? C.aetherLine : C.line}`, minHeight: 74 }} className="rounded-lg p-1.5">
                <div style={{ color: esHoy ? C.aether2 : C.ash }} className="fs-10 mb-1">{d}</div>
                <div className="flex flex-col gap-1">
                  {items.slice(0, 3).map((p) => (
                    <button key={p.id} onClick={() => setSel(sel === p.id ? "" : p.id)} title={p.texto} style={{ background: p.estado === "Publicada" ? "rgba(127,184,155,0.16)" : C.aetherSoft, border: `1px solid ${p.estado === "Publicada" ? "rgba(127,184,155,0.4)" : C.aetherLine}`, color: p.estado === "Publicada" ? C.ok : C.aether2 }} className="px-1 py-0.5 rounded fs-8 truncate text-left">{(p.canales || [])[0] || p.red} · {(p.texto || "").slice(0, 14)}</button>
                  ))}
                  {blogsDia(d).slice(0, 2).map((a) => (
                    <div key={a.id} title={a.titulo} style={{ background: "rgba(216,182,115,0.14)", border: `1px solid rgba(216,182,115,0.4)`, color: "#D8B673" }} className="px-1 py-0.5 rounded fs-8 truncate">📝 {(a.titulo || "").slice(0, 14)}</div>
                  ))}
                  {items.length > 3 && <span style={{ color: C.ash }} className="fs-8">+{items.length - 3}</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* detalle del seleccionado */}
      {sel && (() => { const p = pubs.find((x) => x.id === sel); if (!p) return null; return (
        <div style={{ background: C.panel, border: `1px solid ${C.aetherLine}` }} className="rounded-xl p-4 mb-4">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            {(p.canales || []).map((c) => <span key={c} style={{ background: "rgba(255,255,255,0.05)", border: `1px solid ${C.line}`, color: C.ash, fontFamily: MONO }} className="px-1.5 py-0.5 rounded fs-9">{c}</span>)}
            <span style={{ color: p.estado === "Publicada" ? C.ok : C.aether2, fontFamily: MONO }} className="fs-9">{p.estado}</span>
          </div>
          <div style={{ color: C.mist, whiteSpace: "pre-wrap" }} className="fs-12 leading-snug mb-3">{p.texto}</div>
          <div className="flex items-center gap-3 flex-wrap">
            <label style={{ color: C.ash }} className="fs-10">Fecha: <input type="date" value={p.fecha || ""} onChange={(e) => cambiarFecha(p.id, e.target.value)} style={{ background: C.carbon, color: C.cream, border: `1px solid ${C.line}`, borderRadius: 8, padding: "5px 8px", fontSize: 12 }} /></label>
            <button onClick={() => { borrar(p.id); setSel(""); }} style={{ color: C.ash }} className="fs-11 inline-flex items-center gap-1"><Trash2 size={12} /> Borrar</button>
          </div>
        </div>
      ); })()}

      {/* próximas programadas */}
      <div>
        <div style={{ color: C.aether500, fontFamily: MONO, letterSpacing: "0.2em" }} className="fs-10 uppercase mb-2"><span style={{ color: C.aether }}>// </span>Próximas programadas</div>
        {programadas.length === 0 ? <div style={{ color: C.ash }} className="fs-11">Nada programado aún. En Contenido → Publicar genera un post y usa "Programar".</div> : (
          <div className="flex flex-col gap-2">
            {programadas.slice(0, 12).map((p) => (
              <div key={p.id} style={{ background: C.panel, border: `1px solid ${C.line}` }} className="rounded-lg p-2.5 flex items-center justify-between gap-3">
                <div className="min-w-0"><div style={{ color: C.mist }} className="fs-11 truncate">{(p.texto || "").slice(0, 70)}</div><div style={{ color: C.ash, fontFamily: MONO }} className="fs-9">{(p.canales || [])[0] || p.red}</div></div>
                <div style={{ color: C.aether2, fontFamily: MONO }} className="fs-10 shrink-0">{p.fecha}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
