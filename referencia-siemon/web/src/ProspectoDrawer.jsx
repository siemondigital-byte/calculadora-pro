import React from "react";
import { X, Send, Plus, Check, Trash2, Sparkles, RefreshCw, ArrowRight, Pencil, Save } from "lucide-react";
import ContactoIconos, { tieneContacto } from "./contacto";
import { getToken } from "./db";

const MOTOR = import.meta.env.VITE_MOTOR_URL || "https://prospeccion.siemondigital.com";
const H = () => ({ "content-type": "application/json", Authorization: "Bearer " + getToken() });

const C = {
  obsidian: "#0A0B0D", panel: "#16171C", carbon: "#131418", line: "rgba(255,255,255,0.08)",
  aether: "#B1A3E1", aether2: "#CBC0EC", aether500: "#8474BE", aetherSoft: "rgba(177,163,225,0.14)",
  aetherLine: "rgba(177,163,225,0.30)", cream: "#E9E5DD", mist: "#C9CAD2", ash: "#8B8D98",
  ok: "#7FB89B", okSoft: "rgba(127,184,155,0.14)", warn: "#D8B673",
};
const SANS = "'Montserrat', system-ui, sans-serif";
const MONO = "'JetBrains Mono', ui-monospace, monospace";

const nichoDe = (p) => {
  const parts = (p.categoria || "").split("·");
  return (parts.length > 1 ? parts.slice(1).join("·") : (p.categoria || "")).trim();
};

function Group({ title, children }) {
  return (
    <div style={{ borderTop: `1px solid ${C.line}` }} className="py-3">
      <div style={{ color: C.ash, fontFamily: MONO, letterSpacing: "0.14em" }} className="fs-10 uppercase mb-2">{title}</div>
      {children}
    </div>
  );
}
function Row({ k, v }) {
  if (!v) return null;
  return (
    <div className="flex justify-between gap-3 py-1">
      <span style={{ color: C.ash }} className="fs-11">{k}</span>
      <span style={{ color: C.mist, textAlign: "right", wordBreak: "break-word" }} className="fs-12">{v}</span>
    </div>
  );
}

// Ficha lateral (derecha) del prospecto, con TODA su info, tipo CRM.
export default function ProspectoDrawer({ p, ESTADOS, tonoEstado, onClose, onEstado, onContactar, onPromover, onQuitar, yaEnLeads, onPatch }) {
  if (!p) return null;
  const seg = p.seguidores || p.subs || 0;
  const te = tonoEstado(p.estado || "Nuevo");
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState("");
  const [yt, setYt] = React.useState(p.youtube || null);
  const [webAnalizada, setWebAnalizada] = React.useState(p.webAnalizada || "");
  const [editando, setEditando] = React.useState(false);
  const [ed, setEd] = React.useState({});
  const inp = { width: "100%", background: C.carbon, border: `1px solid ${C.line}`, borderRadius: 8, color: C.cream, padding: "7px 9px", fontSize: 12, outline: "none", marginTop: 2 };
  const lbl = { color: C.ash, fontFamily: MONO, fontSize: 9, textTransform: "uppercase" };
  const perfil = p.perfilProspecto || null;
  function abrirEdicion() {
    const r = p.redes || {};
    setEd({ nombre: p.nombre || "", canal: p.canal || p.fuente || "", nicho: p.nicho || nichoDe(p) || "",
      score: (p.score != null ? String(p.score) : ""), seguidores: (p.seguidores || p.subs || "") ? String(p.seguidores || p.subs) : "",
      email: p.email || "", telefono: p.telefono || "",
      ubicacion: p.ubicacion || [p.direccion, p.ciudad, p.pais].filter(Boolean).join(", ") || "", web: p.web || "",
      instagram: r.instagram || "", tiktok: r.tiktok || "", linkedin: r.linkedin || "", facebook: r.facebook || "",
      twitter: r.twitter || "", bio: p.bio || "", notas: p.notas || p.motivo || "" });
    setEditando(true);
  }
  function guardarEdicion() {
    const redes = { ...(p.redes || {}) };
    for (const rr of ["instagram", "tiktok", "linkedin", "facebook", "twitter"]) {
      const v = (ed[rr] || "").trim();
      if (v) redes[rr] = /^https?:\/\//.test(v) ? v : "https://" + v; else delete redes[rr];
    }
    const patch = { nombre: (ed.nombre || "").trim() || p.nombre, canal: (ed.canal || "").trim(),
      nicho: (ed.nicho || "").trim(), email: (ed.email || "").trim().toLowerCase(), telefono: (ed.telefono || "").trim(),
      ubicacion: (ed.ubicacion || "").trim(), web: (ed.web || "").trim(), bio: (ed.bio || "").trim(),
      notas: (ed.notas || "").trim(), redes };
    const sc = parseInt(ed.score, 10); if (!isNaN(sc)) patch.score = Math.max(0, Math.min(100, sc));
    const sg = parseInt(String(ed.seguidores).replace(/[^\d]/g, ""), 10); if (!isNaN(sg)) patch.seguidores = sg;
    if (typeof onPatch === "function") onPatch(patch);
    else Object.assign(p, patch);
    setEditando(false);
  }
  const esBasura = (u) => /googleadservices|googlesyndication|doubleclick|\/aclk|\/pagead|adservice|adclick|\/url\?/i.test(u || "");
  const urlAnalizar = () => {
    const web = esBasura(p.web) ? "" : p.web;
    const u = web || p.perfil || (p.enlaces && p.enlaces[0]) || (p.redes && Object.values(p.redes)[0]) || "";
    return /^https?:\/\//.test(u) ? u : (u ? "https://" + u : "");
  };
  async function analizar() {
    const url = urlAnalizar();
    if (!url) { setErr("Este prospecto no tiene web/perfil para analizar."); return; }
    setBusy(true); setErr("");
    try {
      const perfilYt = p.perfil || (p.redes && (p.redes.youtube || Object.values(p.redes)[0])) || "";
      const webReal = p.web && !esBasura(p.web) ? p.web : "";
      const r = await fetch(MOTOR + "/prospectos/analizar", { method: "POST", headers: H(), body: JSON.stringify({ web: webReal, perfil: perfilYt, url }) });
      const d = await r.json();
      if (!d.ok) { setErr(d.error || "No pude analizar."); setBusy(false); return; }
      const patch = { perfilProspecto: d.perfil && !d.perfil.error ? d.perfil : null };
      const c = d.contacto || {};
      if (c.email && !p.email) patch.email = c.email;
      if (c.telefono && !p.telefono) patch.telefono = c.telefono;
      if (c.redes && Object.keys(c.redes).length) patch.redes = { ...(p.redes || {}), ...c.redes };
      if (d.youtube) {
        setYt(d.youtube); patch.youtube = d.youtube;
        if (d.youtube.web && (!p.web || /youtube\.com|youtu\.be/i.test(p.web) || esBasura(p.web))) patch.web = d.youtube.web;
        if (esBasura(p.web) && !d.youtube.web) patch.web = ""; // limpia el enlace de anuncio
        if (d.youtube.suscriptores && !p.seguidores) patch.seguidores = d.youtube.suscriptores;
        if (d.youtube.pais) { patch.pais = d.youtube.pais; if (!p.ubicacion) patch.ubicacion = d.youtube.pais; }
        if (d.youtube.email && !p.email) patch.email = d.youtube.email;
      }
      if (d.web_analizada) { setWebAnalizada(d.web_analizada); patch.webAnalizada = d.web_analizada; }
      if (typeof onPatch === "function") onPatch(patch);
      else p.perfilProspecto = patch.perfilProspecto; // fallback: al menos se ve en esta sesión
    } catch (e) { setErr("No pude conectar con el motor."); }
    setBusy(false);
  }
  return (
    <div className="fixed inset-0 z-50 flex justify-end" style={{ background: "rgba(0,0,0,0.6)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: C.panel, borderLeft: `1px solid ${C.line}`, width: 460, maxWidth: "94vw" }} className="h-full overflow-y-auto cmd-scroll">
        <div style={{ background: C.carbon, borderBottom: `1px solid ${C.line}` }} className="px-5 py-4 flex items-start justify-between sticky top-0 z-10">
          <div style={{ minWidth: 0 }}>
            <div style={{ color: C.aether500, fontFamily: MONO, letterSpacing: "0.16em" }} className="fs-9 uppercase"><span style={{ color: C.aether }}>// </span>Prospecto</div>
            <div style={{ fontWeight: 700, color: C.cream }} className="fs-18 mt-1">{p.nombre}</div>
            <div style={{ color: C.ash }} className="fs-11">{[p.canal || p.fuente, seg ? Number(seg).toLocaleString() + " seguidores" : ""].filter(Boolean).join(" · ")}</div>
          </div>
          <button onClick={onClose} style={{ color: C.ash }}><X size={18} /></button>
        </div>

        <div className="p-5">
          {/* score + estado + acciones */}
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <span style={{ background: C.aetherSoft, border: `1px solid ${C.aetherLine}`, color: C.aether2, fontFamily: MONO }} className="px-2 py-1 rounded fs-12">score {p.score || 0}</span>
            <select value={p.estado || "Nuevo"} onChange={(e) => onEstado(e.target.value)}
              style={{ background: te.bg, border: `1px solid ${te.bd}`, color: te.fg, borderRadius: 8, padding: "6px 10px", fontFamily: MONO, fontSize: 12, outline: "none" }}>
              {ESTADOS.map((s) => <option key={s} value={s} style={{ background: C.panel, color: C.cream }}>{s}</option>)}
            </select>
            <button onClick={() => (editando ? setEditando(false) : abrirEdicion())} title="Editar cualquier campo de esta ficha"
              style={{ background: editando ? C.aetherSoft : "transparent", border: `1px solid ${C.aetherLine}`, color: C.aether2 }}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg fs-11 ml-auto">
              <Pencil size={12} /> {editando ? "Cerrar edición" : "Editar ficha"}</button>
          </div>

          <div className="flex items-center gap-2 mb-4">
            <button onClick={onContactar} style={{ background: C.aether, color: C.obsidian, fontWeight: 600 }} className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 rounded-lg fs-13"><Send size={15} strokeWidth={2.3} /> Contactar</button>
            <button onClick={onPromover} disabled={yaEnLeads || !p.email} title={yaEnLeads ? "Ya en leads" : !p.email ? "Sin email" : "Promover a leads"}
              style={{ background: "transparent", border: `1px solid ${yaEnLeads ? C.line : C.aetherLine}`, color: yaEnLeads ? C.ash : C.aether2, opacity: p.email ? 1 : 0.5 }} className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-lg fs-12">
              {yaEnLeads ? <><Check size={14} /> En leads</> : <><Plus size={14} /> Lead</>}</button>
          </div>

          {/* analizar a fondo: perfil de negocio con IA + contacto */}
          <button onClick={analizar} disabled={busy} title="Entra a su web y saca su perfil de negocio, fortalezas, falencias y datos de contacto"
            style={{ width: "100%", background: perfil ? "transparent" : C.aetherSoft, border: `1px solid ${C.aetherLine}`, color: C.aether2, opacity: busy ? 0.6 : 1 }}
            className="inline-flex items-center justify-center gap-2 py-2.5 rounded-lg fs-13 mb-1">
            {perfil ? <RefreshCw size={14} className={busy ? "animate-spin" : ""} /> : <Sparkles size={14} className={busy ? "animate-spin" : ""} />}
            {busy ? "Analizando su web…" : (perfil ? "Re-analizar a fondo" : "Analizar a fondo (perfil + contacto)")}
          </button>
          {err && <div style={{ color: "#D08A8A" }} className="fs-11 mb-2">{err}</div>}

          {yt && (
            <div style={{ background: C.carbon, border: `1px solid ${C.line}`, borderRadius: 12 }} className="p-3 mt-2 mb-1">
              <div style={{ color: "#E0655B", fontFamily: MONO }} className="fs-9 uppercase mb-1.5">▶ Canal de YouTube (info base)</div>
              <Row k="Canal" v={yt.nombre} />
              {yt.suscriptores ? <Row k="Suscriptores" v={Number(yt.suscriptores).toLocaleString()} /> : null}
              {yt.pais ? <Row k="País" v={yt.pais} /> : null}
              {yt.web ? <Row k="Web del negocio" v={yt.web} /> : null}
              {yt.email ? <Row k="Email" v={yt.email} /> : null}
              {(yt.redes && Object.keys(yt.redes).filter((k) => k !== "youtube").length > 0) ?
                <Row k="Otras redes" v={Object.keys(yt.redes).filter((k) => k !== "youtube").join(", ")} /> : null}
              {yt.descripcion && <div style={{ color: C.mist, whiteSpace: "pre-wrap" }} className="fs-11 leading-snug mt-2">{yt.descripcion}</div>}
              {webAnalizada && <div style={{ color: C.ash }} className="fs-10 mt-2">Analicé el negocio en: {webAnalizada}</div>}
            </div>
          )}

          {perfil && (
            <div style={{ background: C.carbon, border: `1px solid ${C.aetherLine}`, borderRadius: 12 }} className="p-3 mt-2 mb-1">
              <div style={{ color: C.aether500, fontFamily: MONO }} className="fs-9 uppercase mb-1.5">// Perfil de negocio (IA)
                {perfil.encaje != null ? " · encaje " + perfil.encaje + "/100" : ""}{perfil.tipo_encaje ? " · " + perfil.tipo_encaje : ""}</div>
              {perfil.gancho && <div style={{ background: C.aetherSoft, border: `1px solid ${C.aetherLine}`, borderRadius: 10 }} className="p-2.5 mb-2"><span style={{ color: C.aether500, fontFamily: MONO }} className="fs-9 uppercase">Gancho: </span><span style={{ color: C.cream }} className="fs-12">{perfil.gancho}</span></div>}
              {perfil.razon && <div style={{ color: C.mist }} className="fs-11 italic mb-2">{perfil.razon}</div>}
              <Row k="Nicho" v={perfil.nicho} />
              <Row k="Oferta de valor" v={perfil.oferta_valor} />
              <Row k="Diferenciador" v={perfil.diferenciador} />
              <Row k="Mercado" v={perfil.tipo_mercado} />
              <Row k="Posicionamiento" v={perfil.posicionamiento} />
              <Row k="Ubicación" v={perfil.ubicacion} />
              <Row k="Área de operación" v={perfil.area_operacion} />
              {(perfil.fortalezas || []).length > 0 && (
                <div className="mt-2"><div style={{ color: C.ok, fontFamily: MONO }} className="fs-9 uppercase mb-1">✓ Fortalezas</div>
                  {perfil.fortalezas.map((x, i) => <div key={i} style={{ color: C.mist }} className="fs-11 mb-0.5">· {x}</div>)}</div>
              )}
              {(perfil.falencias || []).length > 0 && (
                <div className="mt-2"><div style={{ color: C.warn, fontFamily: MONO }} className="fs-9 uppercase mb-1">✗ Falencias (dónde entra Siemon)</div>
                  {perfil.falencias.map((x, i) => <div key={i} style={{ color: C.mist }} className="fs-11 mb-0.5">· {x}</div>)}</div>
              )}
              {(perfil.como_ayudar || []).length > 0 && (
                <div style={{ background: C.aetherSoft, border: `1px solid ${C.aetherLine}`, borderRadius: 10 }} className="p-2.5 mt-2">
                  <div style={{ color: C.aether2, fontFamily: MONO }} className="fs-9 uppercase mb-1">→ Cómo ayudarle (venta)</div>
                  {perfil.como_ayudar.map((x, i) => <div key={i} style={{ color: C.cream }} className="fs-11 mb-0.5">· {x}</div>)}</div>
              )}
            </div>
          )}

          {/* contacto: redes, web, email, tel, maps, enlaces — editable a mano */}
          <div style={{ borderTop: `1px solid ${C.line}` }} className="py-3">
            <div className="flex items-center justify-between mb-2">
              <div style={{ color: C.ash, fontFamily: MONO, letterSpacing: "0.14em" }} className="fs-10 uppercase">{editando ? "Editar ficha" : "Contacto y redes"}</div>
              <button onClick={() => (editando ? setEditando(false) : abrirEdicion())} style={{ color: C.aether2 }} className="fs-10 inline-flex items-center gap-1">
                <Pencil size={11} /> {editando ? "Cerrar" : "Editar / agregar"}</button>
            </div>
            {editando ? (
              <div className="grid grid-cols-2 gap-2">
                <div className="col-span-2"><label style={lbl}>Nombre</label>
                  <input style={inp} value={ed.nombre} onChange={(e) => setEd({ ...ed, nombre: e.target.value })} placeholder="nombre del prospecto" /></div>
                <div><label style={lbl}>Canal de origen</label>
                  <input style={inp} value={ed.canal} onChange={(e) => setEd({ ...ed, canal: e.target.value })} placeholder="instagram, youtube…" /></div>
                <div><label style={lbl}>Nicho</label>
                  <input style={inp} value={ed.nicho} onChange={(e) => setEd({ ...ed, nicho: e.target.value })} placeholder="a qué se dedica" /></div>
                <div><label style={lbl}>Score (0-100)</label>
                  <input type="number" style={inp} value={ed.score} onChange={(e) => setEd({ ...ed, score: e.target.value })} placeholder="0-100" /></div>
                <div><label style={lbl}>Seguidores / subs</label>
                  <input type="number" style={inp} value={ed.seguidores} onChange={(e) => setEd({ ...ed, seguidores: e.target.value })} placeholder="25000" /></div>
                <div className="col-span-2"><label style={lbl}>Email (p. ej. el que ves tras el captcha en YouTube)</label>
                  <input style={inp} value={ed.email} onChange={(e) => setEd({ ...ed, email: e.target.value })} placeholder="contacto@negocio.com" /></div>
                <div><label style={lbl}>Teléfono / WhatsApp</label>
                  <input style={inp} value={ed.telefono} onChange={(e) => setEd({ ...ed, telefono: e.target.value })} placeholder="+57…" /></div>
                <div><label style={lbl}>Ubicación</label>
                  <input style={inp} value={ed.ubicacion} onChange={(e) => setEd({ ...ed, ubicacion: e.target.value })} placeholder="Ciudad, País" /></div>
                <div className="col-span-2"><label style={lbl}>Web</label>
                  <input style={inp} value={ed.web} onChange={(e) => setEd({ ...ed, web: e.target.value })} placeholder="https://…" /></div>
                <div><label style={lbl}>Instagram</label>
                  <input style={inp} value={ed.instagram} onChange={(e) => setEd({ ...ed, instagram: e.target.value })} placeholder="instagram.com/…" /></div>
                <div><label style={lbl}>TikTok</label>
                  <input style={inp} value={ed.tiktok} onChange={(e) => setEd({ ...ed, tiktok: e.target.value })} placeholder="tiktok.com/@…" /></div>
                <div><label style={lbl}>LinkedIn</label>
                  <input style={inp} value={ed.linkedin} onChange={(e) => setEd({ ...ed, linkedin: e.target.value })} placeholder="linkedin.com/…" /></div>
                <div><label style={lbl}>Facebook</label>
                  <input style={inp} value={ed.facebook} onChange={(e) => setEd({ ...ed, facebook: e.target.value })} placeholder="facebook.com/…" /></div>
                <div><label style={lbl}>X (Twitter)</label>
                  <input style={inp} value={ed.twitter} onChange={(e) => setEd({ ...ed, twitter: e.target.value })} placeholder="x.com/…" /></div>
                <div className="col-span-2"><label style={lbl}>Bio / descripción</label>
                  <textarea style={{ ...inp, minHeight: 48, resize: "vertical" }} value={ed.bio} onChange={(e) => setEd({ ...ed, bio: e.target.value })} placeholder="descripción del prospecto" /></div>
                <div className="col-span-2"><label style={lbl}>Notas / cualquier info importante</label>
                  <textarea style={{ ...inp, minHeight: 56, resize: "vertical" }} value={ed.notas} onChange={(e) => setEd({ ...ed, notas: e.target.value })} placeholder="lo que quieras recordar de este prospecto" /></div>
                <button onClick={guardarEdicion} style={{ background: C.aether, color: C.obsidian, fontWeight: 600 }} className="col-span-2 inline-flex items-center justify-center gap-2 py-2 rounded-lg fs-12 mt-1">
                  <Save size={13} /> Guardar cambios</button>
              </div>
            ) : (
              tieneContacto(p) ? <ContactoIconos p={p} /> : <span style={{ color: C.ash }} className="fs-11">Sin datos de contacto públicos. Escríbele por su perfil (DM), o pulsa <b>Editar / agregar</b> para poner su email (el que veas tras el captcha) y demás datos.</span>
            )}
          </div>

          <Group title="Datos">
            <Row k="Canal" v={p.canal || p.fuente} />
            <Row k="Nicho" v={nichoDe(p)} />
            <Row k="Score" v={String(p.score || 0)} />
            {p.fit ? <Row k="Fit embajador" v={String(p.fit) + "/100"} /> : null}
            {seg ? <Row k="Seguidores/Subs" v={Number(seg).toLocaleString()} /> : null}
            {p.outlier ? <Row k="Outlier (mejor video)" v={String(p.outlier) + "%"} /> : null}
            {p.avg_views ? <Row k="Vistas promedio" v={Number(p.avg_views).toLocaleString()} /> : null}
            {p.ultima_pub ? <Row k="Última publicación" v={p.ultima_pub} /> : null}
            <Row k="Email" v={p.email} />
            <Row k="Teléfono" v={p.telefono} />
            <Row k="Ubicación" v={[p.direccion, p.ciudad, p.pais].filter(Boolean).join(", ")} />
            <Row k="Origen" v={p.fuente} />
          </Group>

          {p.bio && <Group title="Bio"><div style={{ color: C.mist, whiteSpace: "pre-wrap" }} className="fs-12 leading-snug">{p.bio}</div></Group>}

          {(p.problemas && p.problemas.length > 0) && (
            <Group title="Detectado / señales"><div style={{ color: C.ash }} className="fs-12 leading-snug">{p.problemas.join(" · ")}</div></Group>
          )}

          {(p.interacciones && p.interacciones.length > 0) && (
            <Group title="Historial de contacto">
              {p.interacciones.map((it, i) => (
                <div key={i} style={{ color: C.mist }} className="fs-11 py-0.5">{it.fecha} · {it.canal} · {it.texto}</div>
              ))}
            </Group>
          )}

          <div style={{ borderTop: `1px solid ${C.line}` }} className="pt-3 mt-1">
            <button onClick={onQuitar} style={{ color: C.ash }} className="inline-flex items-center gap-1.5 fs-11"><Trash2 size={13} /> Quitar de la lista</button>
          </div>
        </div>
      </div>
    </div>
  );
}
