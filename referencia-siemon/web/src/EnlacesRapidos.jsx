import React, { useState, useMemo } from "react";
import { Link2, X, Copy, Check, ExternalLink, Plus, Trash2, Search, Pencil } from "lucide-react";

const C = {
  obsidian: "#0A0B0D", panel: "#16171C", carbon: "#131418", line: "rgba(255,255,255,0.08)",
  aether: "#B1A3E1", aether2: "#CBC0EC", aether500: "#8474BE", aetherSoft: "rgba(177,163,225,0.14)",
  aetherLine: "rgba(177,163,225,0.30)", cream: "#E9E5DD", mist: "#C9CAD2", ash: "#8B8D98", ok: "#7FB89B",
};
const SANS = "'Montserrat', system-ui, sans-serif";
const MONO = "'JetBrains Mono', ui-monospace, monospace";
const inS = { background: "#101116", border: `1px solid ${C.line}`, color: C.cream, borderRadius: 9, padding: "7px 10px", width: "100%", fontFamily: SANS, fontSize: 12, outline: "none" };
const uid = () => (crypto?.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2, 9));

// Tus enlaces de siempre, precargados la primera vez. Puedes editarlos y agregar los tuyos.
export const SEMILLA_ENLACES = [
  { grupo: "Mi web", nombre: "Página principal", url: "https://siemondigital.com/" },
  { grupo: "Mi web", nombre: "Landing de la guía", url: "https://siemondigital.com/download-guide/" },
  { grupo: "Mi web", nombre: "Agendar llamada (book-call)", url: "https://siemondigital.com/book-call/" },
  { grupo: "Mi web", nombre: "Presentación / propuestas", url: "https://siemondigital.com/proposal.html" },
  { grupo: "Mi web", nombre: "Blog", url: "https://siemondigital.com/blog/" },
  { grupo: "Herramientas", nombre: "Centro de Mando", url: "https://crm.siemondigital.com" },
  { grupo: "Herramientas", nombre: "Automatizaciones (n8n)", url: "https://hooks.siemondigital.com" },
  { grupo: "Herramientas", nombre: "Analítica (Umami)", url: "https://analitica.siemondigital.com" },
  { grupo: "Herramientas", nombre: "Publicador (Postiz)", url: "https://publicar.siemondigital.com" },
  { grupo: "Herramientas", nombre: "Hostinger (hosting)", url: "https://hpanel.hostinger.com" },
  { grupo: "Herramientas", nombre: "Motor de prospección", url: "https://prospeccion.siemondigital.com" },
];

export default function EnlacesRapidos({ data, commit, flash }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [copiado, setCopiado] = useState("");
  const [nuevo, setNuevo] = useState(null);   // {id?, nombre, url, grupo}

  const guardados = data?.siemon?.enlacesRapidos;
  const enlaces = useMemo(
    () => (guardados && guardados.length ? guardados : SEMILLA_ENLACES.map((e) => ({ ...e, id: uid() }))),
    [guardados]
  );
  const patch = (lista) => commit({ ...data, siemon: { ...data.siemon, enlacesRapidos: lista } });

  const filtrados = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return enlaces;
    return enlaces.filter((e) => (e.nombre + " " + e.url + " " + (e.grupo || "")).toLowerCase().includes(t));
  }, [enlaces, q]);
  const grupos = useMemo(() => {
    const g = {};
    filtrados.forEach((e) => { const k = e.grupo || "Otros"; (g[k] = g[k] || []).push(e); });
    return g;
  }, [filtrados]);

  async function copiar(e) {
    try { await navigator.clipboard.writeText(e.url); setCopiado(e.id); setTimeout(() => setCopiado(""), 1400); }
    catch { flash?.("No pude copiar."); }
  }
  function guardar() {
    const n = { ...nuevo, nombre: (nuevo.nombre || "").trim(), url: (nuevo.url || "").trim(), grupo: (nuevo.grupo || "Otros").trim() };
    if (!n.url) return flash?.("Pon el enlace.");
    if (!/^https?:\/\//i.test(n.url)) n.url = "https://" + n.url;
    if (!n.nombre) n.nombre = n.url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
    patch(n.id ? enlaces.map((x) => (x.id === n.id ? n : x)) : [...enlaces, { ...n, id: uid() }]);
    setNuevo(null); flash?.("Enlace guardado.");
  }

  if (!open) return (
    <button onClick={() => setOpen(true)} title="Mis enlaces (abrir o copiar)"
      style={{ position: "fixed", right: 20, bottom: 76, zIndex: 59, background: C.panel, color: C.aether2,
        border: `1px solid ${C.aetherLine}`, borderRadius: 999, padding: "9px 14px", boxShadow: "0 6px 24px rgba(0,0,0,.45)" }}
      className="inline-flex items-center gap-2">
      <Link2 size={16} />
      <span style={{ fontFamily: SANS, fontSize: 13 }} className="hidden sm:inline">Enlaces</span>
    </button>
  );

  return (
    <div style={{ position: "fixed", right: 20, bottom: 76, zIndex: 61, width: 380, maxWidth: "94vw",
      background: C.panel, border: `1px solid ${C.aetherLine}`, borderRadius: 16, boxShadow: "0 18px 50px rgba(0,0,0,.6)",
      display: "flex", flexDirection: "column", maxHeight: "72vh" }}>
      <div style={{ borderBottom: `1px solid ${C.line}` }} className="px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link2 size={15} color={C.aether} />
          <div style={{ color: C.cream, fontWeight: 600 }} className="fs-13">Mis enlaces</div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setNuevo({ nombre: "", url: "", grupo: "Otros" })} title="Agregar enlace" style={{ color: C.aether2 }}><Plus size={16} /></button>
          <button onClick={() => setOpen(false)} style={{ color: C.ash }}><X size={16} /></button>
        </div>
      </div>

      <div className="px-3 pt-3">
        <div style={{ position: "relative" }}>
          <Search size={13} color={C.ash} style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)" }} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar enlace…" autoFocus
            style={{ ...inS, paddingLeft: 28 }} />
        </div>
      </div>

      {nuevo && (
        <div style={{ background: C.carbon, border: `1px solid ${C.aetherLine}` }} className="mx-3 mt-3 p-2.5 rounded-lg">
          <input style={{ ...inS, marginBottom: 6 }} value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} placeholder="Nombre (ej. Mi canal de YouTube)" />
          <input style={{ ...inS, marginBottom: 6 }} value={nuevo.url} onChange={(e) => setNuevo({ ...nuevo, url: e.target.value })} placeholder="https://…" />
          <input style={{ ...inS, marginBottom: 6 }} value={nuevo.grupo} onChange={(e) => setNuevo({ ...nuevo, grupo: e.target.value })} placeholder="Grupo (Mi web, Herramientas, Redes…)" list="dl-grupos-enl" />
          <datalist id="dl-grupos-enl">{[...new Set(enlaces.map((e) => e.grupo || "Otros"))].map((g) => <option key={g} value={g} />)}</datalist>
          <div className="flex items-center gap-2">
            <button onClick={guardar} style={{ background: C.aether, color: C.obsidian, fontWeight: 600 }} className="px-3 py-1.5 rounded-lg fs-11">Guardar</button>
            <button onClick={() => setNuevo(null)} style={{ color: C.ash }} className="fs-11">Cancelar</button>
          </div>
        </div>
      )}

      <div className="overflow-y-auto cmd-scroll px-3 pb-3 pt-2" style={{ flex: 1 }}>
        {Object.keys(grupos).length === 0 && <div style={{ color: C.ash }} className="fs-11 text-center py-6">Sin resultados.</div>}
        {Object.entries(grupos).map(([g, items]) => (
          <div key={g} className="mb-3">
            <div style={{ color: C.ash, fontFamily: MONO, letterSpacing: "0.12em" }} className="fs-9 uppercase mb-1.5">{g}</div>
            {items.map((e) => (
              <div key={e.id} className="flex items-center gap-1.5 py-1.5 px-2 rounded-lg" style={{ background: C.carbon, marginBottom: 4 }}>
                <a href={e.url} target="_blank" rel="noreferrer" style={{ minWidth: 0, flex: 1, color: C.cream }} className="fs-12 truncate" title={e.url}>
                  {e.nombre}
                  <div style={{ color: C.ash, fontFamily: MONO }} className="fs-9 truncate">{e.url.replace(/^https?:\/\/(www\.)?/, "")}</div>
                </a>
                <button onClick={() => copiar(e)} title="Copiar enlace" style={{ color: copiado === e.id ? C.ok : C.ash }} className="p-1.5 shrink-0">
                  {copiado === e.id ? <Check size={13} /> : <Copy size={13} />}</button>
                <a href={e.url} target="_blank" rel="noreferrer" title="Abrir" style={{ color: C.aether2 }} className="p-1.5 shrink-0"><ExternalLink size={13} /></a>
                <button onClick={() => setNuevo(e)} title="Editar" style={{ color: C.ash }} className="p-1.5 shrink-0"><Pencil size={12} /></button>
                <button onClick={() => { if (confirm("¿Quitar " + e.nombre + "?")) patch(enlaces.filter((x) => x.id !== e.id)); }} title="Quitar" style={{ color: C.ash }} className="p-1.5 shrink-0"><Trash2 size={12} /></button>
              </div>
            ))}
          </div>
        ))}
      </div>
      <div style={{ borderTop: `1px solid ${C.line}`, color: C.ash }} className="px-4 py-2 fs-9">
        Clic en el nombre para abrir · el icono de copiar te lo deja listo para pegar.
      </div>
    </div>
  );
}
