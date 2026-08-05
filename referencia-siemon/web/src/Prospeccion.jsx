import React, { useState } from "react";
import { Search, Plus, Globe, Check, Send, X } from "lucide-react";
import ContactoIconos, { mapsLink, tieneContacto } from "./contacto";
import OutreachPanel from "./OutreachPanel";
import ProspectoDrawer from "./ProspectoDrawer";
import { getToken } from "./db";
import Combo, { opcionesDe, conNueva } from "./Combo.jsx";

// presets de búsqueda (los tuyos nuevos se agregan solos al usarlos)
const SECTORES = ["coach de negocios", "agencia de marketing", "clínica dental", "clínica estética", "contadores", "despacho jurídico", "inmobiliaria", "ecommerce", "restaurante", "consultora", "finanzas personales", "emprendimiento digital", "productividad e IA"];
const CIUDADES = ["Medellín, Colombia", "Bogotá, Colombia", "Ciudad de México, México", "Miami, USA", "Madrid, España", "Buenos Aires, Argentina", "Lima, Perú", "Santiago, Chile", "en (inglés global)"];

// Marca (autocontenida para no acoplar con App.jsx)
const C = {
  obsidian: "#0A0B0D", panel: "#16171C", panel2: "#1B1D23", line: "rgba(255,255,255,0.08)",
  aether: "#B1A3E1", aether2: "#CBC0EC", aether500: "#8474BE", aetherSoft: "rgba(177,163,225,0.14)",
  aetherLine: "rgba(177,163,225,0.30)", cream: "#E9E5DD", mist: "#C9CAD2", ash: "#8B8D98",
  ok: "#7FB89B", okSoft: "rgba(127,184,155,0.14)", warn: "#D8B673", warnSoft: "rgba(216,182,115,0.14)",
  danger: "#D08A8A",
};
const SANS = "'Montserrat', system-ui, sans-serif";
const MONO = "'JetBrains Mono', ui-monospace, monospace";
const MOTOR_URL = import.meta.env.VITE_MOTOR_URL || "https://prospeccion.siemondigital.com";
const uid = () => (crypto?.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2, 9));
const today = () => new Date().toISOString().slice(0, 10);

const SERVICIOS = [
  { id: "automatizacion", label: "Automatización / IA" },
  { id: "web", label: "Web / diseño" },
  { id: "seo", label: "SEO" },
  { id: "marketing", label: "Marketing / redes" },
];
const CANALES = [
  { id: "directorios", label: "Directorios / Mapas", hint: "Negocios locales (OpenStreetMap) + análisis de web" },
  { id: "scrapling", label: "Scrapling (web)", hint: "Negocios buscando en la web abierta" },
  { id: "youtube", label: "YouTube", hint: "Creadores de YouTube por nicho, con su canal linkable" },
  { id: "instagram", label: "Instagram", hint: "Perfiles públicos de Instagram por nicho (para DM)" },
  { id: "linkedin", label: "LinkedIn", hint: "Perfiles y empresas de LinkedIn por nicho" },
];
const CANALES_SOCIALES = new Set(["youtube", "instagram", "linkedin"]);
const inS = { background: "#101116", border: `1px solid ${C.line}`, color: C.cream, borderRadius: 10,
  padding: "10px 12px", width: "100%", fontFamily: SANS, fontSize: 14, outline: "none" };

function tono(score) {
  if (score >= 80) return { bg: C.okSoft, fg: C.ok, bd: "rgba(127,184,155,0.4)" };
  if (score >= 55) return { bg: C.aetherSoft, fg: C.aether2, bd: C.aetherLine };
  return { bg: "rgba(255,255,255,0.05)", fg: C.ash, bd: C.line };
}

// Pipeline del prospecto: cómo va la comunicación.
const ESTADOS = ["Nuevo", "Contactado", "Respondió", "En conversación", "Cerrado", "Descartado"];
function tonoEstado(e) {
  if (e === "Respondió" || e === "En conversación") return { bg: C.aetherSoft, fg: C.aether2, bd: C.aetherLine };
  if (e === "Cerrado") return { bg: C.okSoft, fg: C.ok, bd: "rgba(127,184,155,0.4)" };
  if (e === "Contactado") return { bg: C.warnSoft, fg: C.warn, bd: "rgba(216,182,115,0.35)" };
  if (e === "Descartado") return { bg: "rgba(255,255,255,0.05)", fg: C.ash, bd: C.line };
  return { bg: "rgba(255,255,255,0.05)", fg: C.mist, bd: C.line };
}

// identidad unificada (email-first): la MISMA convención que CorreoFrioView/OutreachPanel y el motor
const claveP = (p) => (p.email || p.web || p.nombre || "").toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");

// Nicho limpio a partir de la categoría ("Instagram · coach de finanzas" -> "coach de finanzas").
const nichoDe = (p) => {
  const c = p.categoria || "";
  const parts = c.split("·");
  return (parts.length > 1 ? parts.slice(1).join("·") : c).trim();
};

// Bloque de notas con TODA la info del prospecto (para que viaje al lead y al pipeline).
function fichaTexto(p) {
  const r = p.redes || {};
  const redes = [r.instagram_handle && "IG " + r.instagram_handle, r.tiktok_handle && "TikTok " + r.tiktok_handle,
    r.facebook && "Facebook " + r.facebook, r.linkedin && "LinkedIn " + r.linkedin, r.youtube && "YouTube " + r.youtube]
    .filter(Boolean).join(" · ");
  const yt = (p.canal || p.fuente) === "youtube";
  const seg = p.seguidores || (yt ? p.subs : 0);
  return [
    p.web && "Web: " + p.web,
    p.email && "Email: " + p.email,
    p.telefono && "Tel: " + p.telefono,
    (p.direccion || p.ciudad || p.pais) && "Ubicación: " + [p.direccion, p.ciudad, p.pais].filter(Boolean).join(", "),
    mapsLink(p) && "Maps: " + mapsLink(p),
    redes && "Redes: " + redes,
    seg ? "Seguidores: " + Number(seg).toLocaleString() : "",
    yt && p.outlier && "Outlier: " + p.outlier,
    p.bio && "Bio: " + p.bio,
    (p.enlaces && p.enlaces.length) && "Enlaces: " + p.enlaces.join(" · "),
    p.nivel_digital && "Nivel digital: " + p.nivel_digital,
    (p.problemas && p.problemas.length) && "Detectado: " + p.problemas.join("; "),
  ].filter(Boolean).join("\n");
}

const BENEFICIO = {
  automatizacion: "automatizar la atención al cliente y las reservas para que no se les escape ningún cliente",
  web: "tener una web moderna que transmita confianza y convierta visitas en clientes",
  seo: "aparecer en los primeros resultados de Google cuando les buscan",
  marketing: "atraer más clientes con una presencia sólida en redes",
};

// Correo de contacto en frío, en voz de marca (cero guiones largos). Usa el mensaje
// personalizado de Claude si existe; si no, arma uno con los datos reales del negocio.
function correoDe(p, servicio) {
  const nombre = (p.nombre || "").trim();
  const esYt = (p.canal || p.fuente) === "youtube";
  const problema = (p.problemas || []).find((x) => x && !/subs|outlier|email/i.test(x)) || "";
  if (esYt) {
    const asunto = "Colaboración con Siemon Digital";
    const cuerpo = p.mensaje || (
      `Hola ${nombre},\n\nSoy Andrea, de Siemon Digital. Sigo tu canal y me encanta el enfoque que le das a tu contenido. ` +
      `Estamos buscando creadores para una colaboración con nuestros programas de IA y negocios, y creo que encajas muy bien.\n\n` +
      `Si te interesa, te cuento los detalles en un mensaje corto. ¿Te parece?\n`);
    return { asunto, cuerpo };
  }
  const asunto = `Una idea para ${nombre}`;
  const cuerpo = p.mensaje || (
    `Hola,\n\nSoy Andrea, de Siemon Digital. Me encontré con ${nombre}` +
    (problema ? ` y vi algo que se puede mejorar rápido: ${problema.toLowerCase()}.` : ".") +
    `\n\nAyudamos a negocios como el tuyo a ${BENEFICIO[servicio] || "crecer con IA y automatización"}. ` +
    `Si te interesa, lo vemos en una llamada corta de 15 minutos, sin compromiso.\n\n¿Te viene bien esta semana?\n`);
  return { asunto, cuerpo };
}

export default function Prospeccion({ data, commit, flash }) {
  const [sector, setSector] = useState("");
  const [ciudad, setCiudad] = useState("");
  const [servicio, setServicio] = useState("automatizacion");
  const [n, setN] = useState(20);
  const [canales, setCanales] = useState(["directorios"]);
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [contactarP, setContactarP] = useState(null);   // prospecto al que se contacta
  const [drawerKey, setDrawerKey] = useState(null);     // clave del prospecto con ficha abierta
  const [seleccion, setSeleccion] = useState(new Set()); // selección múltiple para acciones masivas

  const [fEstado, setFEstado] = useState("");
  const [fCanal, setFCanal] = useState("");
  const [fScore, setFScore] = useState(0);
  const [busca, setBusca] = useState("");
  const [fSoloEmail, setFSoloEmail] = useState(false);

  const emails = new Set(data.siemon.leads.map((l) => (l.email || "").toLowerCase()));
  const guardados = data.siemon.prospectos || [];
  const soloSocial = canales.length > 0 && canales.every((c) => CANALES_SOCIALES.has(c));

  // Panel de prospección (estilo dashboard): métricas + filtros.
  const stats = {
    total: guardados.length,
    conEmail: guardados.filter((p) => p.email).length,
    contactados: guardados.filter((p) => p.estado && !["Nuevo", "Descartado"].includes(p.estado)).length,
    enLeads: guardados.filter((p) => p.promovido || (p.email && emails.has(p.email.toLowerCase()))).length,
  };
  const canalesPresentes = [...new Set(guardados.map((p) => p.canal || p.fuente).filter(Boolean))];
  const [verN, setVerN] = React.useState(60);
  const qNorm = (s) => (s || "").toString().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const guardadosFiltrados = guardados.filter((p) => {
    if (busca.trim()) {
      const q = qNorm(busca.trim());
      const blob = qNorm([p.nombre, p.email, p.nicho, p.web, p.perfil, p.canal, p.fuente, p.ubicacion,
        p.pais, (p.perfilProspecto || {}).nicho, Object.values(p.redes || {}).join(" ")].filter(Boolean).join(" "));
      if (!q.split(/\s+/).every((t) => blob.includes(t))) return false;
    }
    return (!fEstado || (p.estado || "Nuevo") === fEstado) &&
      (!fCanal || (p.canal || p.fuente) === fCanal) &&
      ((p.score || 0) >= fScore) &&
      (!fSoloEmail || !!p.email);
  }).sort((a, b) => (b.score || 0) - (a.score || 0));

  function toggleCanal(id) {
    setCanales((cs) => (cs.includes(id) ? cs.filter((c) => c !== id) : [...cs, id]));
  }

  // Guarda (upsert por clave) los prospectos que encajan, para que persistan y
  // aparezcan en "Prospectados" con su correo listo.
  const descSet = () => new Set((data.siemon.descartados || []).map((x) => (x || "").toLowerCase()));
  function persistir(nuevos, serv) {
    const desc = descSet();
    const prev = data.siemon.prospectos || [];
    const byKey = new Map(prev.map((p) => [claveP(p), p]));
    nuevos.forEach((p) => {
      const k = claveP(p); if (!k) return;
      if (desc.has(k) || desc.has((p.email || "").toLowerCase()) || desc.has((p.nombre || "").toLowerCase())) return; // descartado
      const old = byKey.get(k) || {};
      // Fusión que NO destruye lo valioso: si el registro existente es más rico (canal creador,
      // suscriptores, estudio IA, historial), esos campos ganan; el nuevo solo rellena huecos.
      const esDom = (n) => !n || /\.(com|info|net|org|io|co|app|es|tv)(\/|$)/i.test(n) || n.includes("/") || n.includes("@");
      const num = (x) => Number(x) || 0;
      const creador = (c) => ["youtube", "instagram", "tiktok"].includes((c || "").toLowerCase());
      byKey.set(k, { ...p, servicio: serv, createdAt: old.createdAt || today(),
        sent: old.sent || false, sentAt: old.sentAt || "", promovido: old.promovido || false,
        nombre: (!esDom(old.nombre) ? old.nombre : (p.nombre || old.nombre)),
        canal: creador(old.canal) ? old.canal : (p.canal || old.canal),
        fuente: (old.fuente && old.fuente !== "scrapling" && old.fuente !== "directorios") ? old.fuente : (p.fuente || old.fuente),
        seguidores: Math.max(num(old.seguidores), num(p.seguidores)) || old.seguidores || p.seguidores || "",
        redes: { ...(p.redes || {}), ...(old.redes || {}) },
        email: old.email || p.email || "",
        telefono: old.telefono || p.telefono || "",
        youtube: old.youtube || p.youtube,
        outlier: num(old.outlier) || num(p.outlier) || old.outlier,
        fit: num(old.fit) || num(p.fit) || old.fit,
        bio: old.bio || p.bio || "",
        nicho: ((old.nicho || "").length >= (p.nicho || "").length ? old.nicho : p.nicho) || p.nicho || old.nicho,
        perfilProspecto: old.perfilProspecto || p.perfilProspecto,
        estado: old.estado || p.estado, estadoFecha: old.estadoFecha || p.estadoFecha,
        interacciones: old.interacciones || p.interacciones });
    });
    return Array.from(byKey.values());
  }

  const [reBusy, setReBusy] = useState(false);
  async function reenriquecer() {
    const faltan = (data.siemon.prospectos || []).filter((p) => !p.email && !p.telefono && (["directorios", "scrapling"].includes(p.canal) || !p.canal)).slice(0, 40);
    if (!faltan.length) { flash("No hay negocios sin contacto por enriquecer."); return; }
    setReBusy(true);
    try {
      const r = await fetch(MOTOR_URL + "/reenriquecer", { method: "POST", headers: { "content-type": "application/json", Authorization: "Bearer " + getToken() }, body: JSON.stringify({ prospectos: faltan }) });
      const d = await r.json();
      const upd = new Map((d.prospectos || []).map((x) => [claveP(x), x]));
      const merged = (data.siemon.prospectos || []).map((p) => { const u = upd.get(claveP(p)); return u ? { ...p, ...u } : p; });
      commit({ ...data, siemon: { ...data.siemon, prospectos: merged } });
      const con = (d.prospectos || []).filter((x) => x.email || x.telefono).length;
      flash(`Re-enriquecí ${faltan.length}: ${con} con contacto nuevo.`);
    } catch { flash("No pude re-enriquecer. Revisa el motor."); }
    finally { setReBusy(false); }
  }

  async function buscar(e) {
    e && e.preventDefault();
    if (!sector.trim() || !ciudad.trim()) { setErr("Pon el nicho y la zona (una ciudad/país, o para YouTube un país/idioma)."); return; }
    if (!canales.length) { setErr("Elige al menos un canal."); return; }
    setBusy(true); setErr(""); setRes(null);
    try {
      const r = await fetch(MOTOR_URL + "/prospectar", {
        method: "POST", headers: { "content-type": "application/json", Authorization: "Bearer " + getToken() },
        body: JSON.stringify({ sector, ciudad, servicio, n: Number(n) || 20, canales, excluir: data.siemon.descartados || [] }),
      });
      if (!r.ok) throw new Error("HTTP " + r.status);
      const d = await r.json();
      setRes(d);
      const buenos = (d.prospectos || []).filter((p) => p.encaja);
      if (buenos.length) {
        // guarda prospectos Y aprende sector/ciudad nuevos en el mismo commit
        const ops = conNueva(conNueva(data.siemon.opciones, "sectorProspeccion", sector, SECTORES), "ciudadProspeccion", ciudad, CIUDADES);
        commit({ ...data, siemon: { ...data.siemon, prospectos: persistir(buenos, servicio), opciones: ops } });
        flash(`Guardé ${buenos.length} prospectos en Prospectados.`);
      }
    } catch (e2) {
      setErr("No pude conectar con el motor. Revisa que prospeccion.siemondigital.com esté activo.");
    } finally { setBusy(false); }
  }

  // Al contactar por cualquier canal: marca Contactado, registra la interacción y
  // ENTRA AL PIPELINE como lead (con seguimiento a 3 días) para no perderlo.
  function alContactar(p, canal, resumen) {
    const k = claveP(p);
    const prospectos = (data.siemon.prospectos || []).map((x) => {
      if (claveP(x) !== k) return x;
      const estado = (!x.estado || x.estado === "Nuevo") ? "Contactado" : x.estado;
      return { ...x, estado, estadoFecha: today(), sent: true, sentAt: today(), promovido: true,
        interacciones: [...(x.interacciones || []), { fecha: today(), canal, texto: resumen }] };
    });
    // upsert del lead (dedupe por email; sin email, por nombre)
    const leads = [...data.siemon.leads];
    const em = (p.email || "").toLowerCase();
    const idx = leads.findIndex((l) => (em && (l.email || "").toLowerCase() === em) ||
      (!em && p.nombre && (l.name || "") === p.nombre));
    const seguimiento = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
    const nota = `${today()} · ${canal}: ${resumen}`;
    if (idx >= 0) {
      leads[idx] = { ...leads[idx], followUpDate: leads[idx].followUpDate || seguimiento,
        outreachNotes: [(leads[idx].outreachNotes || ""), nota].filter(Boolean).join("\n") };
    } else {
      const esYt = (p.canal || p.fuente) === "youtube";
      leads.unshift({
        id: uid(), name: p.nombre || "", email: p.email || "", company: p.nombre || "", phone: p.telefono || "",
        language: "es", message: "", type: esYt ? "embajador" : "prospeccion",
        leadSource: esYt ? "Prospección YouTube" : "Prospección",
        fuente: p.canal || p.fuente || "prospeccion", createdAt: today(),
        tags: [p.categoria, p.ciudad, p.canal].filter(Boolean),
        status: "Nuevo lead", leadOwner: "Andrea", leadOwnerEmail: "andrea@siemondigital.com",
        web: p.web || "", redes: p.redes || {}, outreachNotes: nota,
        followUpDate: seguimiento, qualified: false, aiSummary: p.mensaje || "", subscribed: true, valor: 0,
      });
      if (em) emails.add(em);
    }
    commit({ ...data, siemon: { ...data.siemon, prospectos, leads } });
    flash("Contactado y en tu pipeline (seguimiento el " + seguimiento + ").");
  }

  function cambiarEstado(p, estado) {
    const k = claveP(p);
    commit({ ...data, siemon: { ...data.siemon, prospectos: (data.siemon.prospectos || []).map((x) =>
      claveP(x) === k ? { ...x, estado, estadoFecha: today() } : x) } });
  }
  function actualizarProspecto(p, patch) {
    const k = claveP(p);
    commit({ ...data, siemon: { ...data.siemon, prospectos: (data.siemon.prospectos || []).map((x) =>
      claveP(x) === k ? { ...x, ...patch } : x) } });
  }

  function promover(p) {
    const esYt = (p.canal || p.fuente) === "youtube";
    if (!p.email) { flash(esYt ? "Sin email público; escríbele por su canal de YouTube." : "Ese negocio no tiene email público."); return; }
    if (emails.has(p.email.toLowerCase())) { flash("Ya esta en tus leads."); return; }
    const ficha = fichaTexto(p);
    const lead = {
      id: uid(), name: p.nombre || "", email: p.email, company: p.nombre || "", phone: p.telefono || "",
      language: "es", message: "", type: esYt ? "embajador" : "prospeccion",
      leadSource: esYt ? "Prospección YouTube" : "Prospección",
      fuente: p.fuente || "prospeccion", createdAt: today(),
      tags: [p.categoria, p.ciudad, p.canal].filter(Boolean),
      bookingDate: "", estadoLlamada: "", zonaHoraria: "", horaCliente: "", llamadaRealizada: false,
      caminoPostLlamada: "", notasDescubrimiento: ficha, comentarioAdicional: "",
      videollamadaDate: "", videollamadaZoom: "", videollamadaEstado: "", videollamadaRealizada: false,
      presentacionUrl: p.web || "", status: "Nuevo lead", leadOwner: "Andrea", leadOwnerEmail: "andrea@siemondigital.com",
      web: p.web || "", direccion: p.direccion || "", mapsUrl: mapsLink(p), redes: p.redes || {},
      outreachNotes: ficha + (p.mensaje ? "\n\nCorreo sugerido:\n" + p.mensaje : ""),
      followUpDate: "", qualified: false, aiSummary: p.mensaje || p.motivo || "", subscribed: true,
      unsubscribedDate: "", unsubscribeReason: "", valor: 0,
    };
    const k = claveP(p);
    commit({ ...data, siemon: { ...data.siemon, leads: [lead, ...data.siemon.leads],
      prospectos: (data.siemon.prospectos || []).map((x) => claveP(x) === k ? { ...x, promovido: true } : x) } });
    emails.add(p.email.toLowerCase());
    flash("Promovido a leads: " + (p.nombre || p.email));
  }

  function quitarProspecto(p) {
    const k = claveP(p);
    const claves = [k, (p.email || "").toLowerCase(), (p.nombre || "").toLowerCase()].filter(Boolean);
    const descartados = Array.from(new Set([...(data.siemon.descartados || []), ...claves]));
    commit({ ...data, siemon: { ...data.siemon, descartados, prospectos: (data.siemon.prospectos || []).filter((x) => claveP(x) !== k) } });
    flash("Descartado. No volverá a aparecer al prospectar.");
  }
  const toggleSel = (k) => setSeleccion((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });
  const toggleTodos = () => { const ks = guardadosFiltrados.map(claveP); const all = ks.length && ks.every((k) => seleccion.has(k)); setSeleccion(all ? new Set() : new Set(ks)); };
  function descartarMasivo() {
    const claves = seleccion; if (!claves.size) return;
    const prospectos = data.siemon.prospectos || [];
    const desc = new Set(data.siemon.descartados || []);
    prospectos.forEach((p) => { const k = claveP(p); if (claves.has(k)) { desc.add(k); if (p.email) desc.add(p.email.toLowerCase()); if (p.nombre) desc.add(p.nombre.toLowerCase()); } });
    const restantes = prospectos.filter((p) => !claves.has(claveP(p)));
    commit({ ...data, siemon: { ...data.siemon, descartados: Array.from(desc), prospectos: restantes } });
    const n = claves.size; setSeleccion(new Set());
    flash(`${n} descartados. No volverán a aparecer al prospectar.`);
  }

  const ps = (res && res.prospectos) || [];

  return (
    <div className="p-5 md:p-8" style={{ maxWidth: 1100 }}>
      {/* header */}
      <div className="mb-6">
        <div style={{ color: C.aether500, fontFamily: MONO, letterSpacing: "0.2em" }} className="fs-10 uppercase mb-2">
          <span style={{ color: C.aether }}>// </span>Prospección</div>
        <h1 style={{ fontWeight: 600, letterSpacing: "-0.01em", color: C.cream }} className="fs-24">Encuentra clientes</h1>
        <div style={{ color: C.ash }} className="fs-11 mt-1.5 max-w-xl leading-snug">
          Busca negocios de un sector y ciudad, analiza su web y puntua la oportunidad. Promueve los que encajan a tu pipeline.
        </div>
      </div>

      {/* formulario */}
      <form onSubmit={buscar} style={{ background: C.panel, border: `1px solid ${C.line}` }} className="rounded-xl p-4 md:p-5 mb-6">
        {/* canales */}
        <div className="mb-4">
          <label style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase">Canales a buscar (para prospectar)</label>
          <div className="flex flex-wrap gap-2 mt-1.5">
            {CANALES.map((c) => {
              const on = canales.includes(c.id);
              return (
                <button key={c.id} type="button" onClick={() => toggleCanal(c.id)} title={c.hint}
                  style={{ background: on ? C.aetherSoft : "#101116", border: `1px solid ${on ? C.aetherLine : C.line}`,
                    color: on ? C.aether2 : C.ash }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg fs-12">
                  {on && <Check size={12} />}{c.label}</button>);
            })}
          </div>
          <div style={{ color: C.ash }} className="fs-10 mt-1.5">Elige dónde buscar y dale <b style={{ color: C.mist }}>Prospectar</b>. (Para filtrar los que ya tienes, usa los chips de abajo.)</div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div><label style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase">{soloSocial ? "Nicho" : "Sector / nicho"}</label>
            <Combo listaId="dl-sector" style={inS} value={sector} onChange={setSector} opciones={opcionesDe(data, "sectorProspeccion", SECTORES)} placeholder={soloSocial ? "finanzas, IA para negocios, productividad..." : "coach, agencia, ecommerce, dentista..."} /></div>
          <div><label style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase">{soloSocial ? "País / idioma" : "Ciudad / país"}</label>
            <Combo listaId="dl-ciudad" style={inS} value={ciudad} onChange={setCiudad} opciones={opcionesDe(data, "ciudadProspeccion", CIUDADES)} placeholder={soloSocial ? "México, USA  ·  o 'en' para inglés" : "Miami, USA  ·  Ciudad de México..."} /></div>
          <div><label style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase">Servicio a ofrecer</label>
            <select style={inS} value={servicio} onChange={(e) => setServicio(e.target.value)} disabled={soloSocial}>
              {SERVICIOS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select></div>
          <div><label style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase">Cantidad</label>
            <input style={inS} type="number" min="1" max="60" value={n} onChange={(e) => setN(e.target.value)} /></div>
        </div>
        <div className="flex items-center gap-3 mt-4">
          <button type="submit" disabled={busy} style={{ background: C.aether, color: C.obsidian, fontWeight: 600, opacity: busy ? 0.6 : 1 }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg fs-13">
            <Search size={15} strokeWidth={2.4} />{busy ? "Buscando..." : "Prospectar"}</button>
          {res && <span style={{ color: C.ash }} className="fs-11">{res.total} encontrados · {res.encajan} encajan</span>}
        </div>
        {err && <div style={{ color: C.warn, background: C.warnSoft, border: `1px solid rgba(216,182,115,0.35)` }} className="mt-4 p-3 rounded-lg fs-12 leading-snug">{err}</div>}
        {res && (res.avisos || []).map((a, i) => (
          <div key={i} style={{ color: C.warn, background: C.warnSoft, border: `1px solid rgba(216,182,115,0.35)` }} className="mt-3 p-3 rounded-lg fs-12 leading-snug">{a}</div>
        ))}
      </form>

      {/* resultados */}
      {ps.length > 0 && (
        <div style={{ background: C.panel, border: `1px solid ${C.line}` }} className="rounded-xl overflow-hidden">
          <div className="overflow-x-auto cmd-scroll">
            <table className="w-full" style={{ borderCollapse: "collapse", minWidth: 760 }}>
              <thead><tr style={{ borderBottom: `1px solid ${C.line}` }}>
                {["Score", "Negocio", "Web", "Teléfono", "Detectado", ""].map((h) => (
                  <th key={h} style={{ color: C.ash, fontFamily: MONO, textAlign: "left", padding: "12px 14px", letterSpacing: "0.1em" }} className="fs-10 uppercase">{h}</th>))}
              </tr></thead>
              <tbody>
                {ps.map((p, i) => {
                  const t = tono(p.score);
                  const ya = p.email && emails.has(p.email.toLowerCase());
                  return (
                    <tr key={i} style={{ borderBottom: `1px solid ${C.line}` }}>
                      <td style={{ padding: "11px 14px" }}>
                        <span style={{ background: t.bg, border: `1px solid ${t.bd}`, color: t.fg, fontFamily: MONO }} className="inline-flex px-2 py-0.5 rounded fs-11">{p.score}</span></td>
                      <td style={{ padding: "11px 14px", color: C.cream }} className="fs-13">{p.nombre}
                        <div style={{ color: C.ash }} className="fs-10">{(p.categoria || "") + (p.ciudad ? " · " + p.ciudad : "")}</div>
                        {(p.canal || p.fuente) === "youtube" && (
                          <div className="fs-10 mt-0.5" style={{ color: C.aether500 }}>{(p.subs || 0).toLocaleString()} subs{p.outlier ? " · outlier " + p.outlier : ""}</div>
                        )}
                        {(p.redes && (p.redes.instagram_handle || p.redes.tiktok_handle)) && (
                          <div className="fs-10 mt-0.5" style={{ color: C.aether500 }}>
                            {p.redes.instagram_handle && <a href={p.redes.instagram} target="_blank" rel="noreferrer" style={{ color: C.aether2 }}>IG {p.redes.instagram_handle}</a>}
                            {p.redes.instagram_handle && p.redes.tiktok_handle && <span style={{ color: C.ash }}> · </span>}
                            {p.redes.tiktok_handle && <a href={p.redes.tiktok} target="_blank" rel="noreferrer" style={{ color: C.aether2 }}>TikTok {p.redes.tiktok_handle}</a>}
                          </div>
                        )}</td>
                      <td style={{ padding: "11px 14px" }} className="fs-12">
                        {p.web ? <a href={p.web} target="_blank" rel="noreferrer" style={{ color: C.aether2 }} className="inline-flex items-center gap-1"><Globe size={12} />web</a>
                               : <span style={{ color: C.ash }}>sin web</span>}</td>
                      <td style={{ padding: "11px 14px", color: p.telefono ? C.mist : C.ash }} className="fs-12">{p.telefono || "-"}</td>
                      <td style={{ padding: "11px 14px", color: C.ash, maxWidth: 260 }} className="fs-11 leading-snug">{(p.problemas || [])[0] || ""}</td>
                      <td style={{ padding: "11px 14px", textAlign: "right" }}>
                        <button onClick={() => promover(p)} disabled={ya || !p.email}
                          title={!p.email ? "Sin email publico" : ya ? "Ya en tus leads" : "Promover a leads"}
                          style={{ background: ya ? "transparent" : C.aetherSoft, border: `1px solid ${ya ? C.line : C.aetherLine}`,
                            color: ya ? C.ash : C.aether2, opacity: !p.email ? 0.4 : 1 }}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg fs-11 whitespace-nowrap">
                          {ya ? <><Check size={13} /> En leads</> : <><Plus size={13} /> Promover</>}</button></td>
                    </tr>);
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {res && ps.length === 0 && <div style={{ color: C.ash }} className="fs-13 p-6 text-center">No se encontraron negocios. Prueba otro sector o agrega el pais a la ciudad.</div>}

      {/* ===== Prospectados (panel) ===== */}
      <div className="mt-8">
        <div className="flex items-baseline justify-between mb-3">
          <div>
            <div style={{ color: C.aether500, fontFamily: MONO, letterSpacing: "0.2em" }} className="fs-10 uppercase">
              <span style={{ color: C.aether }}>// </span>Prospectados</div>
            <div style={{ color: C.ash }} className="fs-11 mt-1">Tu bandeja de prospección: contáctalos por su canal y muévelos por el pipeline.</div>
          </div>
          <div className="flex items-center gap-3">
            {guardados.some((p) => !p.email && !p.telefono) && (
              <button onClick={reenriquecer} disabled={reBusy} title="Entra a la web de los negocios sin contacto y saca email/teléfono/descripción"
                style={{ background: C.aetherSoft, border: `1px solid ${C.aetherLine}`, color: C.aether2, opacity: reBusy ? 0.6 : 1 }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg fs-11">{reBusy ? "Buscando…" : "Buscar contacto faltante"}</button>
            )}
            {guardados.length > 0 && <span style={{ color: C.ash }} className="fs-11">{guardadosFiltrados.length} de {guardados.length}</span>}
          </div>
        </div>

        {guardados.length === 0 ? (
          <div style={{ background: C.panel, border: `1px dashed ${C.line}`, color: C.ash }} className="rounded-xl p-6 text-center fs-12">
            Aún no tienes prospectados guardados. Haz una búsqueda arriba y los que encajen aparecerán aquí.
          </div>
        ) : (
          <>
            {/* métricas */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              {[["Prospectos", stats.total, C.cream], ["Con email", stats.conEmail, C.aether2], ["Contactados", stats.contactados, C.warn], ["En leads", stats.enLeads, C.ok]].map(([lab, val, col], i) => (
                <div key={i} style={{ background: C.panel, border: `1px solid ${C.line}` }} className="rounded-xl p-3.5">
                  <div style={{ color: C.ash, fontFamily: MONO, letterSpacing: "0.14em" }} className="fs-10 uppercase">{lab}</div>
                  <div style={{ color: col, fontWeight: 700 }} className="fs-24 mt-1">{val}</div>
                </div>
              ))}
            </div>
            {/* FILTRO por canal (chips): toca un canal para ver solo esos */}
            <div className="mb-3">
              <div style={{ color: C.aether500, fontFamily: MONO, letterSpacing: "0.14em" }} className="fs-10 uppercase mb-1.5"><span style={{ color: C.aether }}>// </span>Filtrar por canal</div>
              <div className="flex flex-wrap gap-1.5">
                {[["", "Todos", guardados.length], ...canalesPresentes.map((c) => [c, c, guardados.filter((p) => (p.canal || p.fuente) === c).length])].map(([val, lab, cnt]) => {
                  const on = fCanal === val;
                  return (
                    <button key={val || "todos"} type="button" onClick={() => setFCanal(val)}
                      style={{ background: on ? C.aetherSoft : "#101116", border: `1px solid ${on ? C.aetherLine : C.line}`, color: on ? C.aether2 : C.mist }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg fs-12">
                      {on && <Check size={12} />}{lab} <span style={{ color: C.ash }}>{cnt}</span></button>);
                })}
              </div>
            </div>
            {/* otros filtros */}
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <div style={{ position: "relative", flex: "1 1 260px", minWidth: 220 }}>
                <Search size={14} color={C.ash} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)" }} />
                <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nombre, email, nicho, web o red…"
                  style={{ background: "#101116", border: `1px solid ${busca ? C.aetherLine : C.line}`, color: C.cream, borderRadius: 10,
                    padding: "9px 32px 9px 32px", width: "100%", fontFamily: SANS, fontSize: 13, outline: "none" }} />
                {busca && <button onClick={() => setBusca("")} title="Limpiar" style={{ position: "absolute", right: 9, top: "50%", transform: "translateY(-50%)", color: C.ash }}><X size={13} /></button>}
              </div>
              <select value={fEstado} onChange={(e) => setFEstado(e.target.value)} style={{ background: "#101116", border: `1px solid ${C.line}`, color: C.mist, borderRadius: 10, padding: "9px 12px", fontFamily: SANS, fontSize: 13, outline: "none" }}>
                <option value="">Todos los estados</option>
                {ESTADOS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <select value={fScore} onChange={(e) => setFScore(Number(e.target.value))} style={{ background: "#101116", border: `1px solid ${C.line}`, color: C.mist, borderRadius: 10, padding: "9px 12px", fontFamily: SANS, fontSize: 13, outline: "none" }}>
                <option value={0}>Cualquier score</option>
                <option value={80}>Score 80+</option>
                <option value={60}>Score 60+</option>
                <option value={40}>Score 40+</option>
              </select>
              <button onClick={() => setFSoloEmail((v) => !v)} style={{ background: fSoloEmail ? C.aetherSoft : "#101116", border: `1px solid ${fSoloEmail ? C.aetherLine : C.line}`, color: fSoloEmail ? C.aether2 : C.ash }} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg fs-12">{fSoloEmail && <Check size={12} />} Solo con email</button>
            </div>
            {seleccion.size > 0 && (
              <div style={{ background: C.panel2, border: `1px solid ${C.aetherLine}` }} className="rounded-lg px-3 py-2 mb-2 flex items-center gap-3">
                <span style={{ color: C.aether2 }} className="fs-12">{seleccion.size} seleccionados</span>
                <button onClick={descartarMasivo} style={{ background: "rgba(208,138,138,0.14)", border: "1px solid rgba(208,138,138,0.4)", color: "#D08A8A" }} className="px-3 py-1.5 rounded-lg fs-12">Descartar seleccionados</button>
                <button onClick={() => setSeleccion(new Set())} style={{ color: C.ash }} className="fs-11">Limpiar</button>
              </div>
            )}
            <div style={{ background: C.panel, border: `1px solid ${C.line}` }} className="rounded-xl overflow-hidden">
              <div className="overflow-x-auto cmd-scroll">
                <table className="w-full" style={{ borderCollapse: "collapse", minWidth: 540 }}>
                  <thead><tr style={{ borderBottom: `1px solid ${C.line}` }}>
                    <th style={{ padding: "11px 14px", width: 34 }}><input type="checkbox" checked={guardadosFiltrados.length > 0 && guardadosFiltrados.every((p) => seleccion.has(claveP(p)))} onChange={toggleTodos} style={{ accentColor: C.aether }} /></th>
                    {["Score", "Nombre", "Canal", "Nicho", "Estado"].map((h) => (
                      <th key={h} style={{ color: C.ash, fontFamily: MONO, textAlign: "left", padding: "11px 14px", letterSpacing: "0.1em" }} className="fs-10 uppercase">{h}</th>))}
                  </tr></thead>
                  <tbody>
                    {guardadosFiltrados.slice(0, verN).map((p, i) => {
                      const t = tono(p.score); const te = tonoEstado(p.estado || "Nuevo");
                      return (
                        <tr key={i} onClick={() => setDrawerKey(claveP(p))} style={{ borderBottom: `1px solid ${C.line}`, cursor: "pointer", background: seleccion.has(claveP(p)) ? C.aetherSoft : "transparent" }} className="hover:opacity-80">
                          <td style={{ padding: "10px 14px" }} onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={seleccion.has(claveP(p))} onChange={() => toggleSel(claveP(p))} style={{ accentColor: C.aether }} /></td>
                          <td style={{ padding: "10px 14px" }}><span style={{ background: t.bg, border: `1px solid ${t.bd}`, color: t.fg, fontFamily: MONO }} className="inline-flex px-2 py-0.5 rounded fs-11">{p.score || 0}</span></td>
                          <td style={{ padding: "10px 14px" }}>
                            <div style={{ color: C.aether2, fontWeight: 600 }} className="fs-13">{p.nombre}</div>
                            {p.email && <div style={{ color: C.ash }} className="fs-10">{p.email}</div>}
                          </td>
                          <td style={{ padding: "10px 14px" }}><span style={{ color: C.mist, fontFamily: MONO }} className="fs-11">{p.canal || p.fuente}</span></td>
                          <td style={{ padding: "10px 14px", color: C.ash, maxWidth: 180 }} className="fs-11">{nichoDe(p)}</td>
                          <td style={{ padding: "10px 14px" }}><span style={{ background: te.bg, border: `1px solid ${te.bd}`, color: te.fg }} className="inline-flex px-2 py-0.5 rounded fs-10">{p.estado || "Nuevo"}</span></td>
                        </tr>);
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            {guardadosFiltrados.length > verN && (
              <button onClick={() => setVerN((v) => v + 60)} style={{ color: C.aether2, border: `1px solid ${C.aetherLine}` }} className="mt-3 px-4 py-2 rounded-lg fs-12">Ver más ({guardadosFiltrados.length - verN} restantes)</button>
            )}
            <div style={{ color: C.ash }} className="fs-10 mt-2">Toca un nombre para ver su ficha completa y contactarlo. →</div>
          </>
        )}
      </div>

      {drawerKey && (() => {
        const dp = guardados.find((x) => claveP(x) === drawerKey);
        if (!dp) return null;
        const ya = dp.email && emails.has(dp.email.toLowerCase());
        return (
          <ProspectoDrawer
            p={dp} ESTADOS={ESTADOS} tonoEstado={tonoEstado}
            onClose={() => setDrawerKey(null)}
            onEstado={(e) => cambiarEstado(dp, e)}
            onContactar={() => setContactarP(dp)}
            onPromover={() => promover(dp)}
            onQuitar={() => { quitarProspecto(dp); setDrawerKey(null); }}
            onPatch={(patch) => actualizarProspecto(dp, patch)}
            yaEnLeads={ya} />
        );
      })()}

      {contactarP && (
        <OutreachPanel
          p={contactarP}
          flash={flash}
          onClose={() => setContactarP(null)}
          onDraft={(patch) => actualizarProspecto(contactarP, patch)}
          firmaPersonal={data.siemon.firma || ""}
          firmaMarca={data.siemon.firmaMarca || ""}
          onContactado={(canal, resumen) => alContactar(contactarP, canal, resumen)} />
      )}
    </div>
  );
}
