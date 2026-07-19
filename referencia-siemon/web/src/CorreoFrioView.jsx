import React, { useState, useMemo, useEffect } from "react";
import { Snowflake, Sparkles, Send, Copy, Check, Mail, ChevronDown, ChevronRight, MessageSquare, Plus, Trash2, Server, X } from "lucide-react";
import { getToken } from "./db";
import ProspectoDrawer from "./ProspectoDrawer";
import Combo, { opcionesDe, guardarOpcion } from "./Combo.jsx";

const INSTRUCCIONES = [
  "más corto y directo",
  "menciona algo específico de su contenido",
  "ofrécele el infoproducto gratis + servicios",
  "recuérdale la propuesta y pregúntale si tiene dudas",
  "tono más cálido y cercano",
  "propón una llamada de 15 minutos",
  "pregúntale si lo pudo revisar, sin presionar",
];

const C = {
  obsidian: "#0A0B0D", panel: "#16171C", carbon: "#131418", line: "rgba(255,255,255,0.08)",
  aether: "#B1A3E1", aether2: "#CBC0EC", aether500: "#8474BE", aetherSoft: "rgba(177,163,225,0.14)",
  aetherLine: "rgba(177,163,225,0.30)", cream: "#E9E5DD", mist: "#C9CAD2", ash: "#8B8D98",
  ok: "#7FB89B", okSoft: "rgba(127,184,155,0.14)", warn: "#D8B673", danger: "#D08A8A",
};
const SANS = "'Montserrat', system-ui, sans-serif";
const MONO = "'JetBrains Mono', ui-monospace, monospace";
const MOTOR = import.meta.env.VITE_MOTOR_URL || "https://prospeccion.siemondigital.com";
const ENVIAR_URL = import.meta.env.VITE_ENVIAR_URL || "https://hooks.siemondigital.com/webhook/enviar-outreach";
const today = () => new Date().toISOString().slice(0, 10);
const uid = () => (crypto?.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2, 9));
const claveP = (p) => (p.email || p.web || p.nombre || "").toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");
const nichoDe = (p) => { const parts = (p.categoria || "").split("·"); return (parts.length > 1 ? parts.slice(1).join("·") : (p.categoria || p.servicio || "")).trim(); };

// Mismo vocabulario que Prospección: el estado vive en prospecto.estado (fuente única).
const ESTADOS = ["Nuevo", "Contactado", "Respondió", "En conversación", "Cerrado", "Descartado"];
const TIPOS_MSG = [
  { id: "primer_contacto", label: "Primer contacto" },
  { id: "seguimiento_sin_respuesta", label: "Seguimiento (no respondió)" },
  { id: "recordatorio", label: "Recordatorio" },
  { id: "ofrecer_infoproducto", label: "Ofrecer infoproducto" },
  { id: "responder_interesado", label: "Responder interesado" },
  { id: "reactivar", label: "Reactivar (frío)" },
];
const TONOS = {
  "Nuevo": { bg: "rgba(255,255,255,0.05)", bd: C.line, fg: C.ash },
  "Contactado": { bg: C.aetherSoft, bd: C.aetherLine, fg: C.aether2 },
  "Respondió": { bg: "rgba(216,182,115,0.14)", bd: "rgba(216,182,115,0.4)", fg: C.warn },
  "En conversación": { bg: C.aetherSoft, bd: C.aetherLine, fg: C.aether2 },
  "Cerrado": { bg: "rgba(127,184,155,0.14)", bd: "rgba(127,184,155,0.4)", fg: C.ok },
  "Descartado": { bg: "rgba(208,138,138,0.14)", bd: "rgba(208,138,138,0.4)", fg: C.danger },
};
const tonoEstado = (e) => TONOS[e] || TONOS["Nuevo"];
const inS = { background: C.carbon, border: `1px solid ${C.line}`, color: C.cream, borderRadius: 10, padding: "10px 12px", width: "100%", fontFamily: SANS, fontSize: 14, outline: "none" };

// Firma HTML (email-safe). Dos columnas divididas por línea de marca.
// Izquierda: identidad (nombre + cargo + foto) y lockup de logo (Siemon / Digital).
// Derecha: redes y contacto (LinkedIn, correo, web).
// variant: "personal" (andrea/tmc) = foto + nombre + LinkedIn personal · "marca" (hello@) = solo logo + LinkedIn empresa.
// tema: "light" | "dark" (colores fijos, para previsualizar) | "auto" (claro + @media dark, para enviar).
const FIRMA_TEMAS = {
  light: { text: "#16171B", gray: "#6E7079", line: "#64537b", cargo: "#64537b", badgeText: "#fff", brand: "#3C3C43" },
  dark: { text: "#F0EEF6", gray: "#AFAFB8", line: "#8878B0", cargo: "#B9AEE0", badgeText: "#0A0B0D", brand: "#EDECF2" },
};
function firmaHTML(f, variant, tema) {
  if (!f) return "";
  const marca = variant === "marca";
  const auto = tema === "auto";
  const T = FIRMA_TEMAS[tema === "dark" ? "dark" : "light"]; // base (auto usa light + override css)
  const MFONT = "'Montserrat',Arial,Helvetica,sans-serif";
  const web = (f.web || "").replace(/^https?:\/\//, "");
  const linkedin = marca ? (f.linkedinEmpresa || "") : (f.linkedinPersonal || "");
  const email = marca ? (f.emailMarca || f.email || "") : (f.email || "");
  if (!marca && !f.nombre && !email) return "";
  if (marca && !f.logo && !f.empresa) return "";

  // lockup de marca: swoosh a la IZQUIERDA (a la misma altura del texto) + "SIEMON" / "DIGITAL", pegados al logo
  const mkBrand = (logoH, sPx, dPx, dLs) => `<table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse"><tr>`
    + (f.logo ? `<td style="vertical-align:middle;padding-right:7px"><img src="${f.logo}" height="${logoH}" style="height:${logoH}px;width:auto;display:block" alt=""/></td>` : "")
    + `<td style="vertical-align:middle;font-family:${MFONT}">`
    +   `<div class="sig-brand" style="font-size:${sPx}px;font-weight:700;letter-spacing:${(sPx * 0.07).toFixed(1)}px;text-transform:uppercase;color:${T.brand};line-height:1">SIEMON</div>`
    +   `<div class="sig-brand" style="font-size:${dPx}px;font-weight:500;letter-spacing:${dLs}px;text-transform:uppercase;color:${T.brand};line-height:1;margin-top:3px">DIGITAL</div>`
    + `</td></tr></table>`;
  const brandSmall = mkBrand(26, 14, 8, 4);    // personal (parte inferior): logo a la altura de SIEMON+DIGITAL
  const brandBig = mkBrand(32, 18, 10, 5.5);   // hello (elemento principal)

  // identidad (personal): foto a la izquierda (como la referencia de Julieth), nombre + cargo a la derecha
  const idBlock = `<table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse"><tr>`
    + (f.foto ? `<td style="vertical-align:middle;padding-right:16px"><div class="sig-photo" style="box-sizing:border-box;width:84px;height:84px;border-radius:50%;overflow:hidden;border:2px solid ${T.line};line-height:0;font-size:0"><img src="${f.foto}" style="width:100%;height:100%;object-fit:cover;display:block;border-radius:50%" alt=""/></div></td>` : "")
    + `<td style="vertical-align:middle">`
    +   `<div class="sig-name" style="font-family:${MFONT};font-size:16px;font-weight:700;color:${T.text}">${f.nombre || ""}</div>`
    +   (f.cargo ? `<div class="sig-cargo" style="font-family:${MFONT};font-size:12px;color:${T.cargo};margin-top:3px">${f.cargo}</div>` : "")
    + `</td>`
    + `</tr></table>`;

  // contacto en tabla: ícono + texto, AMBOS como enlace clicable. Columna de íconos fija y centrada para que queden alineados.
  const cRow = (href, icon, txt) => `<tr>`
    + `<td width="24" align="center" style="vertical-align:middle;padding:2px 6px 2px 0;white-space:nowrap;text-align:center"><a href="${href}" style="text-decoration:none">${icon}</a></td>`
    + `<td style="vertical-align:middle;font-size:13px;line-height:1.4"><a class="sig-gray" href="${href}" style="color:${T.gray};text-decoration:none">${txt}</a></td>`
    + `</tr>`;
  // LinkedIn con su cajita (estilo original); sobre y globo como glifos violeta sueltos, a la altura del badge
  let rows = "";
  if (linkedin) {
    rows += cRow(linkedin,
      `<span class="sig-badge" style="display:inline-block;width:18px;background:${T.line};color:${T.badgeText};font-family:Arial,sans-serif;font-size:10px;font-weight:700;border-radius:3px;padding:2px 0;text-align:center;line-height:1.2">in</span>`,
      "LinkedIn");
  }
  if (email) {
    // "@" en vez de ✉: el glifo del sobre trae mucho aire en su caja tipográfica y siempre
    // imprime más chico según la fuente del cliente de correo; el @ llena su caja y es estable.
    rows += cRow("mailto:" + email,
      `<span class="sig-icon" style="color:${T.line};font-size:15px;font-weight:700;font-family:Arial,Helvetica,sans-serif;line-height:1">@</span>`,
      email);
  }
  if (web) {
    rows += cRow("https://" + web,
      `<span class="sig-icon" style="color:${T.line};font-size:15px;line-height:1">&#127760;&#65038;</span>`,
      web);
  }
  const right = rows ? `<table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse">${rows}</table>` : "";

  const hookHtml = f.hook ? `<div class="sig-cargo" style="font-family:${MFONT};font-size:12px;font-style:italic;color:${T.cargo};line-height:1.45">${f.hook}</div>` : "";

  const D = FIRMA_TEMAS.dark;
  const styleDark = auto ? `<style>@media (prefers-color-scheme:dark){`
    + `.sig-name{color:${D.text}!important}`
    + `.sig-brand{color:${D.brand}!important}`
    + `.sig-cargo{color:${D.cargo}!important}`
    + `.sig-gray{color:${D.gray}!important}`
    + `.sig-icon{color:${D.line}!important}`
    + `.sig-photo{border-color:${D.line}!important}`
    + `.sig-badge{background:${D.line}!important;color:${D.badgeText}!important}`
    + `.sig-line{border-color:${D.line}!important}`
    + `}</style>` : "";

  const vline = `2px solid ${T.line}`;
  let cuerpo = "";
  if (!marca) {
    // arriba: identidad | contacto (línea vertical) · línea horizontal · abajo: logo | hook (línea vertical)
    const topRow = `<table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse"><tr>`
      + `<td class="sig-line" style="vertical-align:top;padding-right:20px;border-right:${vline}">${idBlock}</td>`
      + `<td style="vertical-align:top;padding-left:20px">${right}</td>`
      + `</tr></table>`;
    const bottomRow = f.hook
      ? `<table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse"><tr>`
        + `<td class="sig-line" style="vertical-align:middle;padding-right:16px;border-right:${vline}">${brandSmall}</td>`
        + `<td style="vertical-align:middle;padding-left:16px">${hookHtml}</td>`
        + `</tr></table>`
      : brandSmall;
    cuerpo = `<table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;font-family:Arial,Helvetica,sans-serif">`
      + `<tr><td style="padding-bottom:13px">${topRow}</td></tr>`
      + `<tr><td class="sig-line" style="border-top:1px solid ${T.line};padding-top:13px">${bottomRow}</td></tr>`
      + `</table>`;
  } else {
    // hello: logo + SIEMON DIGITAL (izq) | línea vertical | datos (der) · línea horizontal · hook debajo
    const topRow = `<table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse"><tr>`
      + `<td class="sig-line" style="vertical-align:middle;padding-right:20px;border-right:${vline}">${brandBig}</td>`
      + `<td style="vertical-align:middle;padding-left:20px">${right}</td>`
      + `</tr></table>`;
    cuerpo = `<table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;font-family:Arial,Helvetica,sans-serif">`
      + `<tr><td style="padding-bottom:12px">${topRow}</td></tr>`
      + (f.hook ? `<tr><td class="sig-line" style="border-top:1px solid ${T.line};padding-top:12px">${hookHtml}</td></tr>` : "")
      + `</table>`;
  }
  return styleDark + cuerpo;
}
const FIRMA_DEFAULT = { nombre: "Andrea Siemon", cargo: "Fundadora y estratega tecnológica", hook: "Amplifica tu potencial", empresa: "Siemon Digital", email: "andrea@siemondigital.com", emailMarca: "hello@siemondigital.com", web: "siemondigital.com", foto: "", logo: "", linkedinPersonal: "", linkedinEmpresa: "" };

export default function CorreoFrioView({ data, commit, flash, reload }) {
  const prospectos = (data.siemon.prospectos || []).filter((p) => p.email);
  const outreach = data.siemon.outreach || {};
  const [fEstado, setFEstado] = useState("");
  const [abierto, setAbierto] = useState("");        // clave del prospecto expandido
  const [asunto, setAsunto] = useState("");
  const [cuerpo, setCuerpo] = useState("");
  const [busy, setBusy] = useState(false);
  const [respuesta, setRespuesta] = useState("");
  const [instruccion, setInstruccion] = useState("");
  const [tipoMsg, setTipoMsg] = useState("primer_contacto");
  const [showCampana, setShowCampana] = useState(false);
  const [campanaTxt, setCampanaTxt] = useState(data.siemon.campana || "");
  function guardarCampana() { commit({ ...data, siemon: { ...data.siemon, campana: campanaTxt } }); setShowCampana(false); flash("Campaña guardada. La IA la usará al redactar."); }
  const [showFirma, setShowFirma] = useState(false);
  const [firmaF, setFirmaF] = useState(data.siemon.firmaFields || FIRMA_DEFAULT);
  function guardarFirma() { commit({ ...data, siemon: { ...data.siemon, firmaFields: firmaF, firma: firmaHTML(firmaF, "personal", "auto"), firmaMarca: firmaHTML(firmaF, "marca", "auto") } }); setShowFirma(false); flash("Firma guardada. Se añade a tus correos y se adapta a modo claro/oscuro."); }
  // autoguardado: persiste los campos de la firma sin tener que pulsar Guardar (evita perder cambios al refrescar)
  useEffect(() => {
    if (!showFirma) return;
    const t = setTimeout(() => {
      commit({ ...data, siemon: { ...data.siemon, firmaFields: firmaF, firma: firmaHTML(firmaF, "personal", "auto"), firmaMarca: firmaHTML(firmaF, "marca", "auto") } });
    }, 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line
  }, [firmaF, showFirma]);
  // Buzones (correos Hostinger para enviar/recibir)
  const [buzones, setBuzones] = useState([]);
  const [buzonSel, setBuzonSel] = useState("");
  const [showBuz, setShowBuz] = useState(false);
  const [nb, setNb] = useState({ nombre: "", email: "", password: "" });

  async function cargarBuzones() {
    try {
      const r = await fetch(MOTOR + "/buzones", { headers: { Authorization: "Bearer " + getToken() } });
      const d = await r.json();
      const bs = d.buzones || [];
      setBuzones(bs);
      if (!buzonSel && bs[0]) setBuzonSel(bs[0].id);
    } catch {}
  }
  useEffect(() => { cargarBuzones(); }, []);
  async function guardarBuzon() {
    if (!nb.email.trim() || !nb.password.trim()) return flash("Escribe el correo y la contraseña.");
    try {
      await fetch(MOTOR + "/buzones", { method: "POST", headers: { "content-type": "application/json", Authorization: "Bearer " + getToken() },
        body: JSON.stringify({ nombre: nb.nombre || nb.email, email: nb.email, password: nb.password }) });
      setNb({ nombre: "", email: "", password: "" }); flash("Buzón guardado."); cargarBuzones();
    } catch { flash("No pude guardar el buzón."); }
  }
  async function eliminarBuzon(id) {
    try {
      const r = await fetch(MOTOR + "/buzones/eliminar", { method: "POST", headers: { "content-type": "application/json", Authorization: "Bearer " + getToken() }, body: JSON.stringify({ id }) });
      const d = await r.json();
      if (d.ok) { flash("Buzón eliminado."); } else { flash("No pude eliminar el buzón."); }
      cargarBuzones();
    } catch { flash("No pude eliminar el buzón (sin conexión)."); }
  }
  const [revisando, setRevisando] = useState(false);
  const [showEnv, setShowEnv] = useState(false);
  const [enviados, setEnviados] = useState(null);
  const [cargandoEnv, setCargandoEnv] = useState(false);
  async function abrirEnviados() {
    setShowEnv(true); setCargandoEnv(true);
    try {
      const r = await fetch(MOTOR + "/enviados", { method: "POST", headers: { "content-type": "application/json", Authorization: "Bearer " + getToken() }, body: "{}" });
      const d = await r.json();
      setEnviados(d.ok ? d : { enviados: [], total: 0, abiertos: 0, rebotados: 0 });
    } catch { setEnviados({ enviados: [], total: 0, abiertos: 0, rebotados: 0 }); }
    setCargandoEnv(false);
  }
  async function revisarRespuestas() {
    if (!buzones.length) return flash("Agrega un buzón primero.");
    setRevisando(true);
    try {
      const r = await fetch(MOTOR + "/leer_correos", { method: "POST", headers: { Authorization: "Bearer " + getToken() } });
      const d = await r.json();
      if (d.ok) { flash(d.actualizados ? d.actualizados + " respuesta(s) nueva(s) clasificada(s)." : "Sin respuestas nuevas."); if (reload) await reload(); }
      else flash("No pude revisar la bandeja.");
    } catch { flash("No pude conectar con el motor."); }
    finally { setRevisando(false); }
  }

  const [drawerKey, setDrawerKey] = useState("");
  const leadEmails = new Set((data.siemon.leads || []).map((l) => (l.email || "").toLowerCase()));
  const estadoDe = (p) => (p.estado && String(p.estado).trim()) ? p.estado : "Nuevo";
  const [verNCorreo, setVerNCorreo] = useState(40);
  const lista = useMemo(() => prospectos.filter((p) => !fEstado || estadoDe(p) === fEstado), [prospectos, fEstado]);
  const conteo = useMemo(() => { const m = {}; ESTADOS.forEach((e) => (m[e] = 0)); prospectos.forEach((p) => (m[estadoDe(p)] = (m[estadoDe(p)] || 0) + 1)); return m; }, [prospectos]);

  // ---- prospecto manual (canal que sea: instagram, evento, referido...) ----
  const [showNP, setShowNP] = useState(false);
  const NP0 = { nombre: "", email: "", empresa: "", canal: "", idioma: "es", web: "", perfil: "", nicho: "", ubicacion: "", seguidores: "", score: "", notas: "", telefono: "", instagram: "", tiktok: "", linkedin: "", facebook: "", twitter: "" };
  const [np, setNp] = useState(NP0);
  const [rastreando, setRastreando] = useState(false);
  const norm = (u) => { u = (u || "").trim(); return u && !/^https?:\/\//i.test(u) ? "https://" + u : u; };
  async function rastrearProspecto() {
    const web = norm(np.web), perfil = norm(np.perfil);
    if (!web && !perfil) return flash("Pon la web o el perfil (URL) para rastrear.");
    setRastreando(true); flash("Rastreando su web/perfil y calculando el encaje… puede tardar hasta 1 minuto.");
    try {
      const r = await fetch(MOTOR + "/prospectos/enriquecer", { method: "POST", headers: { "content-type": "application/json", Authorization: "Bearer " + getToken() }, body: JSON.stringify({ web, perfil, nombre: np.nombre }) });
      const d = await r.json();
      if (!d.ok) return flash("No pude rastrear: " + (d.error || ""));
      const rd = d.redes || {};
      setNp((s) => ({ ...s, nicho: d.nicho || s.nicho, ubicacion: d.ubicacion || s.ubicacion,
        youtube: d.youtube || s.youtube, outlier: d.outlier || s.outlier, fit: d.fit || s.fit,
        avgViews: d.avg_views || s.avgViews, ultimaPub: d.ultima_pub || s.ultimaPub,
        seguidores: d.seguidores ? String(d.seguidores) : s.seguidores, score: String(d.score),
        web: s.web || d.web || "", email: s.email || d.email || "", telefono: s.telefono || d.telefono || "",
        instagram: s.instagram || rd.instagram || "", tiktok: s.tiktok || rd.tiktok || "",
        linkedin: s.linkedin || rd.linkedin || "", facebook: s.facebook || rd.facebook || "",
        twitter: s.twitter || rd.twitter || "",
        notas: (s.notas ? s.notas + " · " : "") + "Gancho: " + (d.gancho || "") + (d.tipo_encaje ? " · Encaje: " + d.tipo_encaje : "") + (d.web ? " · Web real: " + d.web : "") }));
      flash(`Encaje ${d.score}/100 (${d.tipo_encaje}).${d.web ? " Web: " + d.web + "." : ""}${d.email ? " Email: " + d.email + "." : ""} El gancho quedó en notas.`);
    } catch { flash("No pude conectar con el motor."); }
    finally { setRastreando(false); }
  }
  function crearProspectoManual() {
    const redes = {};
    for (const r of ["instagram", "tiktok", "linkedin", "facebook", "twitter"]) if (np[r] && np[r].trim()) redes[r] = norm(np[r].trim());
    if (np.perfil && /youtube\.com|youtu\.be/i.test(np.perfil)) redes.youtube = norm(np.perfil.trim());
    // guardar si hay CUALQUIER dato útil: nombre, email, web, perfil o alguna red
    const hayDato = np.email.trim() || np.nombre.trim() || np.web.trim() || np.perfil.trim() || Object.keys(redes).length;
    if (!hayDato) return flash("Pon al menos un nombre, email, web o una red.");
    const nombreFinal = np.nombre.trim() || np.email.trim() || (np.web || np.perfil || Object.values(redes)[0] || "").replace(/^https?:\/\/(www\.)?/, "").replace(/\/.*$/, "");
    const k = (np.email || np.web || np.perfil || nombreFinal).toLowerCase().replace(/\/$/, "");
    if ((data.siemon.prospectos || []).some((x) => claveP(x) === k)) return flash("Ese prospecto ya existe.");
    const canal = np.canal || "Manual";
    const item = { nombre: nombreFinal, email: np.email.trim().toLowerCase(),
      empresa: np.empresa.trim(), canal, origen: "manual-" + canal.toLowerCase(),
      idioma: np.idioma, estado: "Nuevo", estadoFecha: today(), creado: today(),
      web: norm(np.web.trim()), perfil: norm(np.perfil.trim()), redes, telefono: np.telefono.trim(),
      nicho: np.nicho.trim(), ubicacion: np.ubicacion.trim(),
      seguidores: np.seguidores ? Number(np.seguidores) : "", score: np.score ? Number(np.score) : null,
      notas: np.notas || "Agregado a mano desde el CRM",
      ...(np.youtube ? { youtube: np.youtube } : {}),
      ...(np.outlier ? { outlier: Number(np.outlier) } : {}),
      ...(np.fit ? { fit: Number(np.fit) } : {}),
      ...(np.avgViews ? { avg_views: Number(np.avgViews) } : {}),
      ...(np.ultimaPub ? { ultima_pub: np.ultimaPub } : {}) };
    // canal nuevo se aprende en el MISMO commit (dos commits seguidos se pisarian)
    const ops = { ...(data.siemon.opciones || {}) };
    const preset = ["Instagram", "LinkedIn", "WhatsApp", "Referido", "Evento", "TikTok", "YouTube", "Facebook"];
    if (np.canal && !preset.includes(np.canal) && !(ops.canalProspecto || []).includes(np.canal)) {
      ops.canalProspecto = [...(ops.canalProspecto || []), np.canal];
    }
    commit({ ...data, siemon: { ...data.siemon, prospectos: [item, ...(data.siemon.prospectos || [])], opciones: ops } });
    setNp({ ...NP0, canal: np.canal }); setShowNP(false);
    flash("Prospecto agregado. Ya puedes contactarlo desde aquí (queda registrado su origen: " + item.canal + ").");
  }

  // el estado es compartido con Prospección (prospecto.estado); la conversación vive en outreach
  function actualizarProspecto(p, patch) {
    const k = claveP(p);
    commit({ ...data, siemon: { ...data.siemon, prospectos: (data.siemon.prospectos || []).map((x) => claveP(x) === k ? { ...x, ...patch } : x) } });
  }
  function setEstadoProspecto(p, estado) {
    const k = claveP(p);
    commit({ ...data, siemon: { ...data.siemon, prospectos: (data.siemon.prospectos || []).map((x) => claveP(x) === k ? { ...x, estado, estadoFecha: today() } : x) } });
  }
  function setOutreach(p, patch) {
    const k = claveP(p);
    const prev = outreach[k] || { conversacion: [] };
    commit({ ...data, siemon: { ...data.siemon, outreach: { ...outreach, [k]: { ...prev, ...patch } } } });
  }
  function quitar(p) {
    const k = claveP(p);
    const claves = [k, (p.email || "").toLowerCase(), (p.nombre || "").toLowerCase()].filter(Boolean);
    const descartados = Array.from(new Set([...(data.siemon.descartados || []), ...claves]));
    commit({ ...data, siemon: { ...data.siemon, descartados, prospectos: (data.siemon.prospectos || []).filter((x) => claveP(x) !== k) } });
    setDrawerKey(""); flash("Descartado. No volverá a aparecer al prospectar.");
  }
  function promover(p) {
    if (!p.email) return flash("Sin email público.");
    if (leadEmails.has(p.email.toLowerCase())) return flash("Ya está en tus leads.");
    const lead = { id: uid(), name: p.nombre || "", email: p.email, company: p.nombre || "", phone: p.telefono || "",
      language: "es", type: "embajador", leadSource: "Correo en frío", fuente: "outreach-embajadores",
      createdAt: today(), tags: ["Embajador", p.categoria].filter(Boolean), status: "Nuevo lead",
      leadOwner: "Andrea", leadOwnerEmail: "andrea@siemondigital.com", web: p.web || "", redes: p.redes || {},
      followUpDate: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10), subscribed: true, valor: 0 };
    commit({ ...data, siemon: { ...data.siemon, leads: [lead, ...data.siemon.leads] } });
    flash("Promovido a leads: " + (p.nombre || p.email));
  }
  function logConv(p, dir, texto) {
    const k = claveP(p);
    const prev = outreach[k] || { estado: "Sin contactar", conversacion: [] };
    const conv = [...(prev.conversacion || []), { fecha: today(), dir, texto }];
    return { ...prev, conversacion: conv };
  }

  async function generar(p) {
    setBusy(true); setAsunto(""); setCuerpo("");
    try {
      const k = claveP(p);
      const conv = (outreach[k] && outreach[k].conversacion) || [];
      const est = estadoDe(p);
      const r = await fetch(MOTOR + "/generar_mensaje", {
        method: "POST", headers: { "content-type": "application/json", Authorization: "Bearer " + getToken() },
        body: JSON.stringify({ prospecto: p, canal: "email", estado: est, historial: conv,
          instruccion: instruccion, tipo_mensaje: tipoMsg, campana: data.siemon.campana || "",
          modo: (data.siemon.campana ? "" : "embajador") }),
      });
      const d = await r.json();
      setAsunto(d.asunto || (est === "Nuevo" ? "Colaboremos" : "")); setCuerpo(d.cuerpo || "");
      if (d.error) flash("No pude redactar (revisa la clave de Claude).");
      else if (instruccion.trim()) guardarOpcion(data, commit, "instruccionCorreo", instruccion, INSTRUCCIONES);   // aprende tu instrucción
    } catch { flash("No pude conectar con el motor."); }
    finally { setBusy(false); }
  }
  function abrir(p) {
    const k = claveP(p);
    if (abierto === k) { setAbierto(""); return; }
    setAbierto(k); setAsunto(""); setCuerpo(""); setRespuesta(""); setInstruccion("");
    setTipoMsg(estadoDe(p) === "Nuevo" ? "primer_contacto" : "seguimiento_sin_respuesta");
  }
  async function enviar(p) {
    if (!asunto.trim() || !cuerpo.trim()) return flash("Escribe el asunto y el correo.");
    if (!buzonSel) return flash("Agrega y elige un buzón de correo primero.");
    setBusy(true);
    try {
      const bz = buzones.find((b) => b.id === buzonSel);
      const esHello = (bz?.email || "").toLowerCase().startsWith("hello");
      const firmaEnvio = esHello ? (data.siemon.firmaMarca || data.siemon.firma || "") : (data.siemon.firma || "");
      const res = await fetch(MOTOR + "/enviar_correo", { method: "POST", headers: { "content-type": "application/json", Authorization: "Bearer " + getToken() },
        body: JSON.stringify({ buzon_id: buzonSel, to: p.email, subject: asunto, cuerpo, firma_html: firmaEnvio }) });
      const d = await res.json();
      if (!d.ok) throw new Error(d.error || "");
      const k2 = claveP(p);
      const upd = logConv(p, "out", "Email: " + asunto);
      const seguimiento = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
      // entra al pipeline como lead embajador (dedupe por email) + estado outreach
      const leads = [...data.siemon.leads];
      const em = (p.email || "").toLowerCase();
      const idx = leads.findIndex((l) => (l.email || "").toLowerCase() === em);
      const nota = today() + " · email embajador: " + asunto;
      if (idx >= 0) {
        leads[idx] = { ...leads[idx], followUpDate: leads[idx].followUpDate || seguimiento,
          outreachNotes: [(leads[idx].outreachNotes || ""), nota].filter(Boolean).join("\n") };
      } else {
        leads.unshift({ id: uid(), name: p.nombre || "", email: p.email, company: p.nombre || "",
          phone: p.telefono || "", language: "es", message: "", type: "embajador",
          leadSource: "Correo en frío", fuente: "outreach-embajadores", createdAt: today(),
          tags: ["Embajador", p.categoria].filter(Boolean), status: "Nuevo lead",
          leadOwner: "Andrea", leadOwnerEmail: "andrea@siemondigital.com", web: p.web || "",
          redes: p.redes || {}, outreachNotes: nota, followUpDate: seguimiento,
          qualified: false, aiSummary: "", subscribed: true, valor: 0 });
      }
      // estado compartido en el prospecto -> se ve en Prospección y aquí; conversación en outreach
      const prospectosUpd = (data.siemon.prospectos || []).map((x) => claveP(x) === k2 ? { ...x, estado: "Contactado", estadoFecha: today() } : x);
      commit({ ...data, siemon: { ...data.siemon, leads, prospectos: prospectosUpd,
        outreach: { ...outreach, [k2]: { ...upd, canal: "email", fecha: today() } } } });
      flash("Enviado a " + p.email + " y en tu pipeline (seguimiento " + seguimiento + ")."); setAbierto("");
    } catch (e) { flash("No se pudo enviar: " + (e.message || "revisa el buzón/contraseña")); }
    finally { setBusy(false); }
  }
  function copiar(p) { try { navigator.clipboard.writeText(cuerpo); flash("Correo copiado."); } catch {} }
  function registrarRespuesta(p, estado) {
    const k = claveP(p);
    let convPrev = outreach[k] || { conversacion: [] };
    if (respuesta.trim()) convPrev = logConv(p, "in", respuesta.trim());
    commit({ ...data, siemon: { ...data.siemon,
      prospectos: (data.siemon.prospectos || []).map((x) => claveP(x) === k ? { ...x, estado, estadoFecha: today() } : x),
      outreach: { ...outreach, [k]: convPrev } } });
    setRespuesta(""); flash("Respuesta registrada: " + estado);
  }

  return (
    <div className="p-5 md:p-8" style={{ maxWidth: 1100 }}>
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <div style={{ color: C.aether500, fontFamily: MONO, letterSpacing: "0.2em" }} className="fs-10 uppercase mb-2"><span style={{ color: C.aether }}>// </span>Prospección en frío</div>
          <h1 style={{ fontWeight: 600, color: C.cream }} className="fs-24 flex items-center gap-2"><Snowflake size={20} color={C.aether} /> Correo en frío</h1>
          <div style={{ color: C.ash }} className="fs-11 mt-1">Redacta con IA (según la conversación y tu campaña), envía desde tus buzones y sigue quién respondió.</div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => setShowNP((v) => !v)} style={{ background: C.aether, color: C.obsidian, fontWeight: 600 }} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg fs-12">➕ Prospecto manual</button>
          <button onClick={() => { setFirmaF(data.siemon.firmaFields || FIRMA_DEFAULT); setShowFirma((v) => !v); }} style={{ background: C.panel, border: `1px solid ${data.siemon.firma ? "rgba(127,184,155,0.4)" : C.aetherLine}`, color: data.siemon.firma ? C.ok : C.aether2 }} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg fs-12">{data.siemon.firma ? "Firma ✓" : "Firma"}</button>
          <button onClick={() => { setCampanaTxt(data.siemon.campana || ""); setShowCampana((v) => !v); }} style={{ background: C.panel, border: `1px solid ${data.siemon.campana ? "rgba(127,184,155,0.4)" : C.aetherLine}`, color: data.siemon.campana ? C.ok : C.aether2 }} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg fs-12">{data.siemon.campana ? "Campaña ✓" : "Definir campaña"}</button>
        </div>
      </div>
      {showNP && (
        <div style={{ background: C.panel, border: `1px solid ${C.aetherLine}` }} className="rounded-xl p-4 mb-5">
          <div style={{ color: C.aether500, fontFamily: MONO, letterSpacing: "0.16em" }} className="fs-10 uppercase mb-3">// Nuevo prospecto (a mano, desde cualquier canal)</div>
          <div className="grid sm:grid-cols-5 gap-3">
            <div><label style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase">Nombre</label>
              <input style={inS} value={np.nombre} onChange={(e) => setNp({ ...np, nombre: e.target.value })} placeholder="ej. Laura Gómez" /></div>
            <div><label style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase">Email</label>
              <input style={inS} value={np.email} onChange={(e) => setNp({ ...np, email: e.target.value })} placeholder="laura@negocio.com" /></div>
            <div><label style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase">Empresa</label>
              <input style={inS} value={np.empresa} onChange={(e) => setNp({ ...np, empresa: e.target.value })} placeholder="opcional" /></div>
            <div><label style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase">Canal de origen</label>
              <Combo listaId="dl-canal-np" style={inS} value={np.canal} onChange={(v) => setNp({ ...np, canal: v })} opciones={opcionesDe(data, "canalProspecto", ["Página web", "Instagram", "LinkedIn", "YouTube", "TikTok", "Facebook", "X (Twitter)", "WhatsApp", "Directorio", "Referido", "Evento"])} placeholder="Página web, Instagram, YouTube…" /></div>
            <div><label style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase">Idioma</label>
              <select style={inS} value={np.idioma} onChange={(e) => setNp({ ...np, idioma: e.target.value })}><option value="es">Español</option><option value="en">English</option></select></div>
          </div>
          <div className="grid sm:grid-cols-4 gap-3 mt-3">
            <div><label style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase">Página web</label>
              <input style={inS} value={np.web} onChange={(e) => setNp({ ...np, web: e.target.value })} placeholder="https://sunegocio.com" /></div>
            <div><label style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase">Red / canal (URL)</label>
              <input style={inS} value={np.perfil} onChange={(e) => setNp({ ...np, perfil: e.target.value })} placeholder="youtube.com/@… · instagram.com/…" /></div>
            <div><label style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase">Nicho</label>
              <input style={inS} value={np.nicho} onChange={(e) => setNp({ ...np, nicho: e.target.value })} placeholder="se llena solo al rastrear" /></div>
            <div><label style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase">Ubicación</label>
              <input style={inS} value={np.ubicacion} onChange={(e) => setNp({ ...np, ubicacion: e.target.value })} placeholder="se llena solo al rastrear" /></div>
          </div>
          <div className="grid sm:grid-cols-4 gap-3 mt-3">
            <div><label style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase">Seguidores / subs</label>
              <input type="number" style={inS} value={np.seguidores} onChange={(e) => setNp({ ...np, seguidores: e.target.value })} placeholder="25000" /></div>
            <div><label style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase">Score (0-100)</label>
              <input type="number" style={inS} value={np.score} onChange={(e) => setNp({ ...np, score: e.target.value })} placeholder="lo calcula el rastreo" /></div>
            <div className="sm:col-span-2"><label style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase">Notas / gancho</label>
              <input style={inS} value={np.notas} onChange={(e) => setNp({ ...np, notas: e.target.value })} placeholder="el rastreo deja aquí el gancho para el correo" /></div>
          </div>
          <div style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase mt-3 mb-1">Redes y contacto (se llenan solas al rastrear · o pégalas a mano)</div>
          <div className="grid sm:grid-cols-3 gap-3">
            <div><label style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase">Instagram</label>
              <input style={inS} value={np.instagram} onChange={(e) => setNp({ ...np, instagram: e.target.value })} placeholder="instagram.com/…" /></div>
            <div><label style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase">TikTok</label>
              <input style={inS} value={np.tiktok} onChange={(e) => setNp({ ...np, tiktok: e.target.value })} placeholder="tiktok.com/@…" /></div>
            <div><label style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase">LinkedIn</label>
              <input style={inS} value={np.linkedin} onChange={(e) => setNp({ ...np, linkedin: e.target.value })} placeholder="linkedin.com/in/… o /company/…" /></div>
            <div><label style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase">Facebook</label>
              <input style={inS} value={np.facebook} onChange={(e) => setNp({ ...np, facebook: e.target.value })} placeholder="facebook.com/…" /></div>
            <div><label style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase">X (Twitter)</label>
              <input style={inS} value={np.twitter} onChange={(e) => setNp({ ...np, twitter: e.target.value })} placeholder="x.com/…" /></div>
            <div><label style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase">Teléfono</label>
              <input style={inS} value={np.telefono} onChange={(e) => setNp({ ...np, telefono: e.target.value })} placeholder="+57…" /></div>
          </div>
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <button onClick={rastrearProspecto} disabled={rastreando} style={{ background: "transparent", border: `1px solid ${C.aetherLine}`, color: C.aether2, opacity: rastreando ? 0.6 : 1 }} className="px-3.5 py-2 rounded-lg fs-12">{rastreando ? "Rastreando…" : "🔍 Rastrear y puntuar con IA"}</button>
            <button onClick={crearProspectoManual} style={{ background: C.aether, color: C.obsidian, fontWeight: 600 }} className="px-3.5 py-2 rounded-lg fs-12">Agregar prospecto</button>
            <button onClick={() => setShowNP(false)} style={{ color: C.ash }} className="fs-12">Cancelar</button>
            <span style={{ color: C.ash }} className="fs-10">Queda en esta lista con su canal registrado; al promoverlo a lead conserva el origen.</span>
          </div>
        </div>
      )}
      {showFirma && (
        <div style={{ background: C.panel, border: `1px solid ${C.aetherLine}` }} className="rounded-xl p-4 mb-5">
          <div style={{ color: C.mist }} className="fs-12 mb-2">Firma de dos columnas (se añade al final de cada correo). Foto y logo: pega URLs públicas. El correo <b style={{ color: C.aether2 }}>hello@</b> usa la versión de marca (solo logo + LinkedIn de empresa).</div>
          <div className="grid sm:grid-cols-3 gap-2">
            {[["nombre", "Nombre"], ["cargo", "Cargo (bajo el nombre)"], ["hook", "Hook / eslogan (junto al logo)"], ["empresa", "Empresa"], ["email", "Correo personal (andrea)"], ["emailMarca", "Correo de marca (hello)"], ["web", "Web"]].map(([k, l]) => (
              <input key={k} style={{ ...inS, fontSize: 13 }} value={firmaF[k] || ""} onChange={(e) => setFirmaF({ ...firmaF, [k]: e.target.value })} placeholder={l} />
            ))}
            <input style={{ ...inS, fontSize: 13 }} className="sm:col-span-3" value={firmaF.linkedinPersonal || ""} onChange={(e) => setFirmaF({ ...firmaF, linkedinPersonal: e.target.value })} placeholder="LinkedIn personal de Andrea (https://linkedin.com/in/…) — firma personal" />
            <input style={{ ...inS, fontSize: 13 }} className="sm:col-span-3" value={firmaF.linkedinEmpresa || ""} onChange={(e) => setFirmaF({ ...firmaF, linkedinEmpresa: e.target.value })} placeholder="LinkedIn de empresa (https://linkedin.com/company/…) — firma de hello@" />
            <input style={{ ...inS, fontSize: 13 }} className="sm:col-span-3" value={firmaF.foto || ""} onChange={(e) => setFirmaF({ ...firmaF, foto: e.target.value })} placeholder="URL de tu foto (círculo, firma personal)" />
            <input style={{ ...inS, fontSize: 13 }} className="sm:col-span-3" value={firmaF.logo || ""} onChange={(e) => setFirmaF({ ...firmaF, logo: e.target.value })} placeholder="URL del logo de Siemon (aparece en ambas firmas)" />
          </div>
          <div style={{ color: C.ash, fontFamily: MONO }} className="fs-9 uppercase mt-4 mb-1">Personal (andrea@, themoneycommand@) · claro / oscuro</div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div style={{ background: "#fff", borderRadius: 8, padding: 12 }} dangerouslySetInnerHTML={{ __html: firmaHTML(firmaF, "personal", "light") }} />
            <div style={{ background: "#0F1013", borderRadius: 8, padding: 12 }} dangerouslySetInnerHTML={{ __html: firmaHTML(firmaF, "personal", "dark") }} />
          </div>
          <div style={{ color: C.ash, fontFamily: MONO }} className="fs-9 uppercase mt-3 mb-1">Marca (hello@) · claro / oscuro</div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div style={{ background: "#fff", borderRadius: 8, padding: 12 }} dangerouslySetInnerHTML={{ __html: firmaHTML(firmaF, "marca", "light") }} />
            <div style={{ background: "#0F1013", borderRadius: 8, padding: 12 }} dangerouslySetInnerHTML={{ __html: firmaHTML(firmaF, "marca", "dark") }} />
          </div>
          <button onClick={guardarFirma} style={{ background: C.aether, color: C.obsidian, fontWeight: 600 }} className="px-4 py-2 rounded-lg fs-12 self-start mt-3">Guardar firma</button>
        </div>
      )}
      {showCampana && (
        <div style={{ background: C.panel, border: `1px solid ${C.aetherLine}` }} className="rounded-xl p-4 mb-5">
          <div style={{ color: C.mist }} className="fs-12 mb-1">Tu campaña / oferta (la IA la usa al redactar). Describe qué ofreces, tu infoproducto y los enlaces.</div>
          <textarea style={{ ...inS, minHeight: 120, resize: "vertical", fontSize: 13 }} value={campanaTxt} onChange={(e) => setCampanaTxt(e.target.value)} placeholder={"ej. Lanzamiento de mi infoproducto en Hotmart: acceso gratuito al material descargable y a la plataforma. El libro está en lecciones; cada lección trae un podcast, actividades y ejercicios para hacer con las apps. También ofrezco mis servicios de IA/automatización. Enlace: https://…"} />
          <div className="flex items-center gap-2 mt-2">
            <button onClick={guardarCampana} style={{ background: C.aether, color: C.obsidian, fontWeight: 600 }} className="px-4 py-2 rounded-lg fs-12">Guardar campaña</button>
            <span style={{ color: C.ash }} className="fs-10">Puedes ir cambiándola para probar qué mensaje funciona mejor.</span>
          </div>
        </div>
      )}

      {/* buzones de correo */}
      <div style={{ background: C.panel, border: `1px solid ${C.line}` }} className="rounded-xl p-3.5 mb-5">
        <div className="flex items-center justify-between">
          <div style={{ color: C.mist }} className="fs-12 flex items-center gap-2"><Server size={14} color={C.aether} /> {buzones.length ? buzones.length + " buzón(es) de correo" : "Sin buzones configurados"}
            {buzones.length > 0 && <span style={{ color: C.ash }} className="fs-10">· enviando desde:</span>}
            {buzones.length > 0 && <select value={buzonSel} onChange={(e) => setBuzonSel(e.target.value)} style={{ background: C.carbon, color: C.aether2, border: `1px solid ${C.line}`, fontFamily: MONO }} className="fs-11 rounded px-2 py-1 outline-none">{buzones.map((b) => <option key={b.id} value={b.id}>{b.email}</option>)}</select>}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={abrirEnviados} title="Todos los correos que has enviado: si se abrieron o rebotaron" style={{ color: C.aether2, border: `1px solid ${C.aetherLine}` }} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg fs-11"><Send size={12} /> Correos enviados</button>
            <button onClick={revisarRespuestas} disabled={revisando} title="Lee tu bandeja: clasifica respuestas y detecta rebotes" style={{ background: C.aetherSoft, color: C.aether2, border: `1px solid ${C.aetherLine}`, opacity: revisando ? 0.6 : 1 }} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg fs-11"><MessageSquare size={12} />{revisando ? "Revisando…" : "Revisar bandeja"}</button>
            <button onClick={() => setShowBuz((v) => !v)} style={{ color: C.aether2, border: `1px solid ${C.aetherLine}` }} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg fs-11">{showBuz ? <X size={12} /> : <Plus size={12} />} Gestionar</button>
          </div>
        </div>
        {showBuz && (
          <div style={{ borderTop: `1px solid ${C.line}` }} className="mt-3 pt-3">
            {buzones.map((b) => (
              <div key={b.id} className="flex items-center gap-2 mb-2 flex-wrap">
                <Mail size={13} color={b.tiene_password ? C.ok : C.warn} />
                <span style={{ color: C.cream }} className="fs-12">{b.nombre}</span>
                <span style={{ color: C.ash, fontFamily: MONO }} className="fs-10">{b.email}</span>
                {!b.tiene_password && <span style={{ color: C.warn }} className="fs-9">sin contraseña</span>}
                <button onClick={async () => {
                  flash("Probando " + b.email + "…");
                  try {
                    const r = await fetch(MOTOR + "/buzones/probar", { method: "POST", headers: { "content-type": "application/json", Authorization: "Bearer " + getToken() }, body: JSON.stringify({ id: b.id }) });
                    const d = await r.json();
                    if (d.ok) { flash("✓ " + b.email + " conecta bien (servidor: " + (d.servidor || "ok") + ")."); cargarBuzones(); }
                    else { flash("✗ " + b.email + (d.pista ? " · " + d.pista : " · envío: " + d.smtp + " · lectura: " + d.imap)); }
                  } catch { flash("No pude probar el buzón."); }
                }} style={{ color: C.aether2, border: `1px solid ${C.aetherLine}` }} className="px-2 py-0.5 rounded fs-10">Probar conexión</button>
                <button onClick={() => eliminarBuzon(b.id)} style={{ color: C.ash }} className="ml-auto"><Trash2 size={13} /></button>
              </div>
            ))}
            <div className="grid sm:grid-cols-3 gap-2 mt-3">
              <input style={inS} value={nb.nombre} onChange={(e) => setNb({ ...nb, nombre: e.target.value })} placeholder="Nombre (ej. Andrea Siemon)" />
              <input style={inS} value={nb.email} onChange={(e) => setNb({ ...nb, email: e.target.value })} placeholder="andrea@siemondigital.com" />
              <input style={inS} type="password" value={nb.password} onChange={(e) => setNb({ ...nb, password: e.target.value })} placeholder="Contraseña del correo" />
            </div>
            <div className="flex items-center gap-2 mt-2">
              <button onClick={guardarBuzon} style={{ background: C.aether, color: C.obsidian, fontWeight: 600 }} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg fs-12"><Plus size={13} /> Agregar buzón</button>
              <span style={{ color: C.ash }} className="fs-10">Hostinger: SMTP smtp.hostinger.com:465 · IMAP imap.hostinger.com:993 (se ponen solos). La contraseña se guarda solo en el servidor.</span>
            </div>
          </div>
        )}
      </div>

      {/* modal: correos enviados (enviado / abierto / rebotado) */}
      {showEnv && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)" }} onClick={() => setShowEnv(false)}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: C.panel, border: `1px solid ${C.line}`, width: 720, maxWidth: "96vw", maxHeight: "86vh" }} className="rounded-2xl flex flex-col">
            <div style={{ borderBottom: `1px solid ${C.line}` }} className="px-5 py-4 flex items-center justify-between">
              <div>
                <div style={{ color: C.cream, fontWeight: 700 }} className="fs-16">Correos enviados</div>
                {enviados && <div style={{ color: C.ash }} className="fs-11 mt-0.5">{enviados.total} enviados · {enviados.abiertos} abiertos · {enviados.rebotados} rebotados</div>}
              </div>
              <button onClick={() => setShowEnv(false)} style={{ color: C.ash }}><X size={18} /></button>
            </div>
            <div className="overflow-y-auto cmd-scroll p-3" style={{ flex: 1 }}>
              {cargandoEnv ? <div style={{ color: C.ash }} className="fs-12 p-4 text-center">Cargando…</div>
                : !enviados || !enviados.enviados.length ? <div style={{ color: C.ash }} className="fs-12 p-4 text-center">Aún no hay correos enviados registrados. Los que envíes desde ahora aparecerán aquí.</div>
                : enviados.enviados.map((e, i) => {
                  const est = e.estado === "rebotado" ? { t: "Rebotó", c: "#D08A8A", bg: "rgba(208,138,138,0.14)" }
                    : e.abierto ? { t: "Abierto ✓", c: C.ok, bg: C.okSoft } : { t: "Enviado", c: C.aether2, bg: C.aetherSoft };
                  return (
                    <div key={e.tid || i} style={{ borderBottom: `1px solid ${C.line}` }} className="flex items-center gap-3 py-2.5 px-2">
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ color: C.cream }} className="fs-13 truncate">{e.nombre || e.to}</div>
                        <div style={{ color: C.ash, fontFamily: MONO }} className="fs-10 truncate">{e.to} · {e.asunto || "(sin asunto)"}</div>
                      </div>
                      <div style={{ color: C.ash }} className="fs-10 whitespace-nowrap">{e.fecha}</div>
                      <span style={{ background: est.bg, color: est.c, fontFamily: MONO }} className="px-2 py-1 rounded fs-10 whitespace-nowrap">{est.t}{e.aperturas > 1 ? ` (${e.aperturas})` : ""}</span>
                    </div>
                  );
                })}
            </div>
            <div style={{ borderTop: `1px solid ${C.line}` }} className="px-5 py-3">
              <span style={{ color: C.ash }} className="fs-10">"Abierto" = el destinatario cargó el correo (algunos clientes bloquean el pixel, así que no siempre se detecta). "Rebotó" = la dirección devolvió el correo; revisa la bandeja para actualizar rebotes.</span>
            </div>
          </div>
        </div>
      )}

      {/* filtros por estado */}
      <div className="flex flex-wrap gap-2 mb-5">
        <button onClick={() => setFEstado("")} style={{ background: !fEstado ? C.aetherSoft : C.panel, border: `1px solid ${!fEstado ? C.aetherLine : C.line}`, color: !fEstado ? C.aether2 : C.mist }} className="px-3 py-1.5 rounded-lg fs-12">Todos ({prospectos.length})</button>
        {ESTADOS.map((e) => (
          <button key={e} onClick={() => setFEstado(e === fEstado ? "" : e)} style={{ background: e === fEstado ? C.aetherSoft : C.panel, border: `1px solid ${e === fEstado ? C.aetherLine : C.line}`, color: tonoEstado(e).fg }} className="px-3 py-1.5 rounded-lg fs-12">{e} ({conteo[e] || 0})</button>
        ))}
      </div>

      {lista.length === 0 ? (
        <div style={{ background: C.panel, border: `1px solid ${C.line}`, color: C.ash }} className="rounded-xl p-6 fs-13">No hay prospectos con email en este estado. Trae prospectos desde Prospección (con email) para escribirles en frío.</div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {lista.slice(0, verNCorreo).map((p) => {
            const k = claveP(p); const est = estadoDe(p); const exp = abierto === k;
            const conv = (outreach[k] && outreach[k].conversacion) || [];
            return (
              <div key={k} style={{ background: C.panel, border: `1px solid ${exp ? C.aetherLine : C.line}` }} className="rounded-xl">
                <div className="p-3.5 flex items-center gap-3">
                  <button onClick={() => abrir(p)} style={{ color: C.ash }} className="shrink-0">{exp ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</button>
                  <button onClick={() => setDrawerKey(k)} className="min-w-0 flex-1 text-left">
                    <div style={{ color: C.cream, fontWeight: 600 }} className="fs-13 truncate hover:underline">{p.nombre}</div>
                    <div style={{ color: C.ash, fontFamily: MONO }} className="fs-10 truncate">{p.email}{nichoDe(p) ? " · " + nichoDe(p) : ""}</div>
                  </button>
                  <select value={est} onChange={(e) => setEstadoProspecto(p, e.target.value)} style={{ background: C.carbon, color: tonoEstado(est).fg, border: `1px solid ${C.line}`, fontFamily: MONO }} className="fs-11 rounded-lg px-2 py-1.5 outline-none shrink-0">
                    {ESTADOS.map((e) => <option key={e} value={e} style={{ color: C.cream }}>{e}</option>)}
                  </select>
                  <button onClick={() => abrir(p)} style={{ background: C.aetherSoft, border: `1px solid ${C.aetherLine}`, color: C.aether2 }} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg fs-12 shrink-0"><Mail size={13} /> Escribir</button>
                </div>

                {exp && (
                  <div style={{ borderTop: `1px solid ${C.line}` }} className="p-3.5">
                    <div style={{ background: C.carbon, border: `1px solid ${C.line}` }} className="rounded-lg p-2.5 mb-3">
                      <label style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase">Tipo de mensaje</label>
                      <div className="flex flex-wrap gap-1.5 mt-1 mb-2">
                        {TIPOS_MSG.map((t) => (
                          <button key={t.id} onClick={() => setTipoMsg(t.id)} style={{ background: tipoMsg === t.id ? C.aetherSoft : "transparent", border: `1px solid ${tipoMsg === t.id ? C.aetherLine : C.line}`, color: tipoMsg === t.id ? C.aether2 : C.ash }} className="px-2 py-1 rounded fs-10">{t.label}</button>
                        ))}
                      </div>
                      <label style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase">Instrucción extra (opcional)</label>
                      <div className="flex items-center gap-2 mt-1">
                        <Combo listaId="dl-instruccion" style={{ ...inS, fontSize: 13 }} value={instruccion} onChange={setInstruccion} opciones={opcionesDe(data, "instruccionCorreo", INSTRUCCIONES)} placeholder={est !== "Nuevo" ? "ej. recuérdale el infoproducto y pregúntale si lo pudo ver" : "ej. ofrécele el infoproducto gratis + servicios"} />
                        <button onClick={() => generar(p)} disabled={busy} style={{ background: C.aether, color: C.obsidian, fontWeight: 600, opacity: busy ? 0.6 : 1 }} className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg fs-13 shrink-0"><Sparkles size={14} />{busy ? "Redactando…" : (cuerpo ? "Redactar de nuevo" : "Redactar con IA")}</button>
                      </div>
                    </div>
                    <label style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase">Correo (edítalo)</label>
                    <input style={{ ...inS, marginBottom: 8, marginTop: 4 }} value={asunto} onChange={(e) => setAsunto(e.target.value)} placeholder="Asunto" />
                    <textarea style={{ ...inS, minHeight: 150, resize: "vertical", lineHeight: 1.55, opacity: busy ? 0.6 : 1 }} value={cuerpo} onChange={(e) => setCuerpo(e.target.value)} placeholder={busy ? "IA redactando…" : ""} />
                    <div className="flex items-center gap-2 mt-3">
                      <button onClick={() => enviar(p)} disabled={busy} style={{ background: C.aether, color: C.obsidian, fontWeight: 600 }} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg fs-13"><Send size={14} /> Enviar</button>
                      <button onClick={() => copiar(p)} style={{ border: `1px solid ${C.line}`, color: C.mist }} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg fs-13"><Copy size={13} /> Copiar</button>
                    </div>

                    {/* conversación / registrar respuesta */}
                    <div style={{ borderTop: `1px solid ${C.line}` }} className="mt-4 pt-3">
                      <div style={{ color: C.aether500, fontFamily: MONO }} className="fs-10 uppercase mb-2 flex items-center gap-1.5"><MessageSquare size={11} /> Conversación</div>
                      {conv.length > 0 && (
                        <div className="flex flex-col gap-1.5 mb-2">
                          {conv.map((c, i) => (
                            <div key={i} style={{ color: c.dir === "in" ? C.ok : C.mist }} className="fs-11 leading-snug"><span style={{ color: C.ash, fontFamily: MONO }}>{c.fecha} {c.dir === "in" ? "←" : "→"}</span> {c.texto}</div>
                          ))}
                        </div>
                      )}
                      <textarea style={{ ...inS, minHeight: 54, resize: "vertical" }} value={respuesta} onChange={(e) => setRespuesta(e.target.value)} placeholder="Pega aquí lo que respondió (o una nota)…" />
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <button onClick={() => registrarRespuesta(p, "Respondió")} style={{ border: `1px solid ${C.line}`, color: C.warn }} className="px-3 py-1.5 rounded-lg fs-11">Marcar: Respondió</button>
                        <button onClick={() => registrarRespuesta(p, "En conversación")} style={{ border: `1px solid rgba(127,184,155,0.4)`, color: C.ok }} className="px-3 py-1.5 rounded-lg fs-11">Interesado ✓</button>
                        <button onClick={() => registrarRespuesta(p, "Descartado")} style={{ border: `1px solid ${C.line}`, color: C.danger }} className="px-3 py-1.5 rounded-lg fs-11">No interesado</button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {lista.length > verNCorreo && (
            <button onClick={() => setVerNCorreo((v) => v + 40)} style={{ color: C.aether2, border: `1px solid ${C.aetherLine}` }} className="mt-1 px-4 py-2 rounded-lg fs-12 self-start">Ver más ({lista.length - verNCorreo} restantes)</button>
          )}
        </div>
      )}

      {drawerKey && (() => {
        const dp = prospectos.find((x) => claveP(x) === drawerKey) || (data.siemon.prospectos || []).find((x) => claveP(x) === drawerKey);
        if (!dp) return null;
        return (
          <ProspectoDrawer p={dp} ESTADOS={ESTADOS} tonoEstado={tonoEstado}
            onClose={() => setDrawerKey("")}
            onEstado={(e) => setEstadoProspecto(dp, e)}
            onContactar={() => { setDrawerKey(""); setAbierto(claveP(dp)); setAsunto(""); setCuerpo(""); setRespuesta(""); }}
            onPromover={() => promover(dp)}
            onQuitar={() => quitar(dp)}
            onPatch={(patch) => actualizarProspecto(dp, patch)}
            yaEnLeads={dp.email && leadEmails.has(dp.email.toLowerCase())} />
        );
      })()}
    </div>
  );
}
