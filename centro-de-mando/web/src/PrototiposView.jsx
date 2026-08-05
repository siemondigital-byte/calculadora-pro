import React, { useState } from "react";
import { Rocket, Sparkles, UploadCloud, Copy, Trash2, ExternalLink, Send } from "lucide-react";
import { C, MONO, SANS } from "./tema.js";
import { MOTOR, getToken } from "./db.js";

const H = () => ({ "content-type": "application/json", Authorization: "Bearer " + getToken() });
const uid = () => (crypto?.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2, 9));
const today = () => new Date().toISOString().slice(0, 10);
const inS = { background: C.carbon, border: `1px solid ${C.line}`, color: C.cream, borderRadius: 10, padding: "9px 12px", width: "100%", fontFamily: SANS, fontSize: 13, outline: "none" };

// Prototipos: genera una página "plan patrimonial" personalizada para un
// prospecto, la publica en atlantisglobalrealty.com/plan/<slug>.html y se la
// envías como gesto. Muestra (no cuenta) cómo se vería su camino con el método.
export default function PrototiposView({ data, commit, ws }) {
  const [aviso, setAviso] = useState("");
  const flash = (m) => { setAviso(m); window.clearTimeout(flash._t); flash._t = window.setTimeout(() => setAviso(""), 7000); };
  const protos = data[ws].prototipos || [];
  const leads = data[ws].leads || [];
  const [f, setF] = useState({ nombre: "", perfil: "", notas: "", idioma: "es" });
  const [html, setHtml] = useState("");
  const [slug, setSlug] = useState("");
  const [busy, setBusy] = useState("");
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));

  function desdeLead(id) {
    const l = leads.find((x) => x.id === id); if (!l) return;
    setF({ nombre: l.nombre || l.name || "", perfil: [l.conciencia ? "conciencia " + l.conciencia : "", l.fuente || ""].filter(Boolean).join(" · "), notas: l.notas || l.mensaje || "", idioma: l.idioma || "es" });
  }
  async function generar() {
    if (!f.nombre.trim() && !f.perfil.trim()) return flash("Pon al menos el nombre o el perfil.");
    setBusy("gen"); setHtml(""); flash("Diseñando el plan a la medida… ~30-60s.");
    try {
      const r = await fetch(MOTOR + "/proto/generar", { method: "POST", headers: H(), body: JSON.stringify(f) });
      const d = await r.json();
      if (!d.ok) return flash("No pude generar: " + (d.error || ""));
      setHtml(d.html); setSlug(d.slug); flash("Plan listo. Míralo y publícalo cuando te guste.");
    } catch { flash("No pude conectar con el motor."); }
    finally { setBusy(""); }
  }
  async function publicar() {
    if (!html || !slug) return;
    setBusy("pub"); flash("Publicando la página…");
    try {
      const r = await fetch(MOTOR + "/proto/publicar", { method: "POST", headers: H(), body: JSON.stringify({ slug, html }) });
      const d = await r.json();
      if (!d.ok) return flash("No pude publicar: " + (d.error || ""));
      const item = { id: uid(), fecha: today(), nombre: f.nombre, perfil: f.perfil, slug, url: d.url };
      commit({ ...data, [ws]: { ...data[ws], prototipos: [item, ...protos.filter((p) => p.slug !== slug)] } });
      flash("Publicado ✓ Copia el enlace y envíalo.");
    } catch { flash("No pude conectar con el motor."); }
    finally { setBusy(""); }
  }
  function borrar(id) { commit({ ...data, [ws]: { ...data[ws], prototipos: protos.filter((p) => p.id !== id) } }); }
  const copiar = (t) => { try { navigator.clipboard.writeText(t); flash("Enlace copiado."); } catch {} };
  const waLink = (p) => `https://wa.me/?text=${encodeURIComponent(`Hola ${p.nombre || ""}, preparamos algo pensado para ti: ${p.url}`)}`;

  return (
    <div style={{ maxWidth: 1100 }}>
      <div className="mb-5">
        <div style={{ color: C.aether500, fontFamily: MONO, letterSpacing: "0.2em" }} className="fs-10 uppercase mb-2"><span style={{ color: C.aether }}>// </span>Prospección con gesto</div>
        <h1 style={{ fontWeight: 600, color: C.cream }} className="fs-24 flex items-center gap-2"><Rocket size={20} color={C.aether} /> Prototipos · "tu plan patrimonial"</h1>
        <div style={{ color: C.ash }} className="fs-11 mt-1">Genera una página personalizada para un prospecto, publícala en tu propia URL y envíasela como gesto: muestra —no cuenta— cómo se vería su camino patrimonial con estructura. Educativa, sin promesas de retornos.</div>
      </div>

      {aviso && <div style={{ background: C.aetherSoft, border: `1px solid ${C.aetherLine}`, color: C.aether2 }} className="rounded-lg px-3 py-2 mb-4 fs-12">{aviso}</div>}

      <div style={{ background: C.panel, border: `1px solid ${C.line}` }} className="rounded-xl p-4 mb-4">
        {leads.length > 0 && (
          <div className="mb-3">
            <label style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase">Traer datos de un lead (opcional)</label>
            <select onChange={(e) => e.target.value && desdeLead(e.target.value)} defaultValue="" style={{ ...inS, marginTop: 4 }}>
              <option value="">— elige un lead —</option>
              {leads.map((l) => <option key={l.id} value={l.id}>{l.nombre || l.name || l.email}</option>)}
            </select>
          </div>
        )}
        <div className="grid sm:grid-cols-2 gap-3">
          <div><label style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase">Nombre del prospecto</label>
            <input style={{ ...inS, marginTop: 4 }} value={f.nombre} onChange={(e) => set("nombre", e.target.value)} placeholder="ej. Laura" /></div>
          <div><label style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase">Idioma</label>
            <select style={{ ...inS, marginTop: 4 }} value={f.idioma} onChange={(e) => set("idioma", e.target.value)}><option value="es">Español</option><option value="en">Inglés</option></select></div>
        </div>
        <div className="mt-3"><label style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase">Perfil / situación</label>
          <input style={{ ...inS, marginTop: 4 }} value={f.perfil} onChange={(e) => set("perfil", e.target.value)} placeholder="ej. profesional de 38, buen ingreso, ahorra sin plan, nunca ha invertido" /></div>
        <div className="mt-3"><label style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase">Notas / contexto real (lo que sabes de su situación)</label>
          <textarea style={{ ...inS, marginTop: 4, minHeight: 70, resize: "vertical" }} value={f.notas} onChange={(e) => set("notas", e.target.value)} placeholder="ej. le preocupa depender de su sueldo, tiene ahorros parados en el banco, le interesa Panamá" /></div>
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <button onClick={generar} disabled={!!busy} style={{ background: C.aether, color: C.obsidian, fontWeight: 600, opacity: busy ? 0.6 : 1 }} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg fs-12"><Sparkles size={14} /> {busy === "gen" ? "Diseñando…" : "Generar plan"}</button>
          {html && <button onClick={publicar} disabled={!!busy} style={{ background: "transparent", border: `1px solid ${C.aetherLine}`, color: C.aether2, fontWeight: 600 }} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg fs-12"><UploadCloud size={14} /> {busy === "pub" ? "Publicando…" : `Publicar → /plan/${slug}.html`}</button>}
        </div>
      </div>

      {html && (
        <div style={{ background: C.panel, border: `1px solid ${C.line}` }} className="rounded-xl p-3 mb-4">
          <div style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase mb-2">// Vista previa</div>
          <iframe title="prototipo" srcDoc={html} style={{ width: "100%", height: 560, border: `1px solid ${C.line}`, borderRadius: 10, background: "#000" }} />
        </div>
      )}

      {protos.length > 0 && (
        <div>
          <div style={{ color: C.aether500, fontFamily: MONO, letterSpacing: "0.2em" }} className="fs-10 uppercase mb-2"><span style={{ color: C.aether }}>// </span>Publicados</div>
          <div className="flex flex-col gap-2">
            {protos.map((p) => (
              <div key={p.id} style={{ background: C.panel, border: `1px solid ${C.line}` }} className="rounded-xl p-3 flex items-center gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div style={{ color: C.cream, fontWeight: 600 }} className="fs-13">{p.nombre || p.slug}</div>
                  <a href={p.url} target="_blank" rel="noreferrer" style={{ color: C.aether2, fontFamily: MONO }} className="fs-10 break-all">{p.url}</a>
                  <div style={{ color: C.ash }} className="fs-9">{p.perfil} · {p.fecha}</div>
                </div>
                <a href={p.url} target="_blank" rel="noreferrer" style={{ color: C.aether2 }} className="inline-flex items-center gap-1 fs-11"><ExternalLink size={12} /> abrir</a>
                <button onClick={() => copiar(p.url)} style={{ color: C.mist }} className="inline-flex items-center gap-1 fs-11"><Copy size={12} /> copiar</button>
                <a href={waLink(p)} target="_blank" rel="noreferrer" style={{ color: C.ok }} className="inline-flex items-center gap-1 fs-11"><Send size={12} /> WhatsApp</a>
                <button onClick={() => borrar(p.id)} style={{ color: C.danger }} className="inline-flex items-center gap-1 fs-11"><Trash2 size={12} /></button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
