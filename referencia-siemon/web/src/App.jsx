import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  LayoutDashboard, KanbanSquare, Users, Package, Receipt, Radio,
  CalendarClock, Plus, Trash2, X, Check, Power, TrendingUp, Target,
  Coins, Search, Instagram, Facebook, Linkedin, Youtube, MessageCircle,
  Send, Globe, ArrowLeftRight, Circle, CheckCircle2, Zap, AlertTriangle,
  BookOpen, GraduationCap, Wallet, Wand2, Bell, Snowflake, CalendarDays, Megaphone, Sprout, FileText, Radar
, Paintbrush, BarChart3, Handshake, KeyRound, Rocket, Menu } from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  LineChart, Line, Cell, AreaChart, Area
} from "recharts";
import { loadData, saveData, getToken } from "./db";
import Prospeccion from "./Prospeccion.jsx";
import EnviarCorreo from "./EnviarCorreo.jsx";
import AsistenteFlotante from "./AsistenteFlotante.jsx";
import EnlacesRapidos from "./EnlacesRapidos.jsx";
import FuentesView from "./FuentesView.jsx";
import SeguimientoView, { contarPendientes } from "./SeguimientoView.jsx";
import CorreoFrioView from "./CorreoFrioView.jsx";
import EstudioYtView from "./EstudioYtView.jsx";
import EstudioUnificado from "./EstudioUnificado.jsx";
import CalendarioView from "./CalendarioView.jsx";
import AdsView from "./AdsView.jsx";
import PrototiposView from "./PrototiposView.jsx";
import FacturacionView, { estadoFactura } from "./FacturacionView.jsx";
import NurturingView from "./NurturingView.jsx";
import BlogSeoView from "./BlogSeoView.jsx";
import MaquetadorView from "./MaquetadorView.jsx";
import AnaliticaView from "./AnaliticaView.jsx";
import ClientesView from "./ClientesView.jsx";
import Combo, { opcionesDe } from "./Combo.jsx";
import AccesosView from "./AccesosView.jsx";
import MercadoView from "./MercadoView.jsx";
import ContactoIconos, { tieneContacto } from "./contacto.jsx";
import PROSPECTOS_SEED from "./prospectosSeed.js";

/* ============================================================
   CENTRO DE MANDO SIEMON · CRM a la medida
   Espacios: Siemon Digital (agencia) + Infoproductos y Comunidad
   Marca: obsidiana + Aether Lavanda · Persistencia: window.storage
   ============================================================ */

const KEY = "siemon_cmd_v3";
const C = {
  obsidian: "#0A0B0D", carbon: "#131418", panel: "#16171C", panel2: "#1B1D23",
  line: "rgba(255,255,255,0.08)", lineSoft: "rgba(255,255,255,0.05)",
  aether: "#B1A3E1", aether2: "#CBC0EC", aether500: "#8474BE",
  aetherSoft: "rgba(177,163,225,0.14)", aetherLine: "rgba(177,163,225,0.30)",
  cream: "#E9E5DD", mist: "#C9CAD2", ash: "#8B8D98",
  ok: "#7FB89B", okSoft: "rgba(127,184,155,0.14)", warn: "#D8B673",
  warnSoft: "rgba(216,182,115,0.14)", danger: "#D08A8A", dangerSoft: "rgba(208,138,138,0.14)",
};
const SANS = "'Montserrat', system-ui, sans-serif";
const MONO = "'JetBrains Mono', ui-monospace, monospace";

const STAGES = ["Nuevo lead", "Llamada agendada", "Descubrimiento", "Videollamada", "Propuesta", "Cliente", "Perdido"];
const OPEN_STAGES = STAGES.slice(0, 5);
const LEAD_SOURCES = ["Formulario contacto", "Guía IA", "LinkedIn", "Instagram", "Facebook", "YouTube", "TikTok", "WhatsApp", "Referido", "Cal.com"];
const TYPES = ["contacto", "guia-ia", "descubrimiento", "prospeccion", "embajador", "youtuber", "instagramer", "tiktoker", "creador"];
const TIPOS_CREADOR = ["youtuber", "instagramer", "tiktoker", "creador", "embajador"];
const CHANNELS = [
  { id: "Instagram", icon: Instagram }, { id: "Facebook", icon: Facebook },
  { id: "LinkedIn", icon: Linkedin }, { id: "YouTube", icon: Youtube },
  { id: "TikTok", icon: Radio }, { id: "WhatsApp", icon: MessageCircle },
];
const TIPO_OFERTA = ["Infoproducto", "Mentoría", "Comunidad"];
const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const money = (n, cur = "USD") => (cur === "USD" ? "$" : "") + Number(n || 0).toLocaleString("en-US") + (cur !== "USD" ? " " + cur : "");
const today = () => new Date().toISOString().slice(0, 10);
const uid = () => (crypto?.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2, 9));

/* Proyección: crece los últimos meses con la tasa media observada */
function proyectar(mapByKey, ahead = 4) {
  const keys = Object.keys(mapByKey).sort();
  if (keys.length === 0) return { data: [], growth: 0 };
  const vals = keys.map((k) => mapByKey[k]);
  const ratios = [];
  for (let i = 1; i < vals.length; i++) if (vals[i - 1] > 0) ratios.push(vals[i] / vals[i - 1]);
  let g = ratios.length ? ratios.reduce((a, b) => a + b, 0) / ratios.length : 1.1;
  if (!isFinite(g) || g < 1) g = 1.08; if (g > 1.6) g = 1.6;
  const data = keys.map((k, i) => ({ mes: MESES[parseInt(k.slice(5, 7), 10) - 1], real: Math.round(vals[i]), proy: null }));
  data[data.length - 1].proy = Math.round(vals[vals.length - 1]);
  let [y, mo] = keys[keys.length - 1].split("-").map(Number);
  let last = vals[vals.length - 1];
  for (let i = 1; i <= ahead; i++) { mo++; if (mo > 12) { mo = 1; y++; } last = last * g; data.push({ mes: MESES[mo - 1], real: null, proy: Math.round(last) }); }
  return { data, growth: Math.round((g - 1) * 100) };
}
function cumBy(mapByKey) {
  let acc = 0;
  return Object.keys(mapByKey).sort().map((k) => { acc += mapByKey[k]; return { mes: MESES[parseInt(k.slice(5, 7), 10) - 1], total: Math.round(acc) }; });
}

/* ------------------------------- SEED ------------------------------- */
function seed() {
  return {
    workspace: "siemon",
    siemon: {
      leads: [
        { id: "l1", name: "Ricardo Leal", email: "ricardo@contadoresleal.com", company: "Contadores Leal", phone: "+57 300 111 2233", language: "es", message: "Queremos ordenar los cierres de mes.", type: "descubrimiento", leadSource: "LinkedIn", fuente: "linkedin_organico", createdAt: "2026-05-18", tags: ["Despacho"], bookingDate: "2026-07-06 10:00", estadoLlamada: "BOOKING_CREATED", zonaHoraria: "America/Bogota", horaCliente: "10:00 a.m.", llamadaRealizada: true, caminoPostLlamada: "Videollamada", notasDescubrimiento: "Sector contable, 8 personas. Reto: cierres manuales. Objetivo: liberar al socio.", comentarioAdicional: "", videollamadaDate: "2026-07-10 15:00", videollamadaZoom: "https://zoom.us/j/98212", videollamadaEstado: "Agendada", videollamadaRealizada: false, presentacionUrl: "", status: "Videollamada", leadOwner: "Andrea", leadOwnerEmail: "andrea@siemondigital.com", outreachNotes: "Decisor directo, muy receptivo.", followUpDate: "2026-07-10", qualified: true, aiSummary: "Despacho listo para diagnóstico.", subscribed: true, unsubscribedDate: "", unsubscribeReason: "", valor: 1900 },
        { id: "l2", name: "Daniela Osorio", email: "daniela@aurora.com", company: "Inmobiliaria Aurora", phone: "+57 310 555 8899", language: "es", message: "Los leads se pierden entre WhatsApp y correo.", type: "contacto", leadSource: "Instagram", fuente: "ig_reels", createdAt: "2026-06-02", tags: ["Inmobiliaria"], bookingDate: "2026-07-05 09:00", estadoLlamada: "BOOKING_CREATED", zonaHoraria: "America/Bogota", horaCliente: "9:00 a.m.", llamadaRealizada: true, caminoPostLlamada: "Videollamada", notasDescubrimiento: "Reto: seguimiento de leads. Objetivo: no perder oportunidades.", comentarioAdicional: "También quieren reportes.", videollamadaDate: "", videollamadaZoom: "", videollamadaEstado: "", videollamadaRealizada: false, presentacionUrl: "", status: "Propuesta", leadOwner: "Andrea", leadOwnerEmail: "andrea@siemondigital.com", outreachNotes: "Enviar propuesta con reportes.", followUpDate: "2026-07-07", qualified: true, aiSummary: "Encaje alto con implementación.", subscribed: true, unsubscribedDate: "", unsubscribeReason: "", valor: 1900 },
        { id: "l3", name: "Pablo Nieto", email: "info@sonrie.com", company: "Clínica Dental Sonríe", phone: "+52 55 4444 1212", language: "es", message: "Descargué la guía y quiero saber por dónde empezar.", type: "guia-ia", leadSource: "Guía IA", fuente: "guia_descarga", createdAt: "2026-06-20", tags: ["Clínica"], bookingDate: "2026-07-08 17:00", estadoLlamada: "BOOKING_CREATED", zonaHoraria: "America/Mexico_City", horaCliente: "5:00 p.m.", llamadaRealizada: false, caminoPostLlamada: "", notasDescubrimiento: "", comentarioAdicional: "", videollamadaDate: "", videollamadaZoom: "", videollamadaEstado: "", videollamadaRealizada: false, presentacionUrl: "", status: "Llamada agendada", leadOwner: "Andrea", leadOwnerEmail: "andrea@siemondigital.com", outreachNotes: "", followUpDate: "2026-07-08", qualified: false, aiSummary: "", subscribed: true, unsubscribedDate: "", unsubscribeReason: "", valor: 500 },
        { id: "l4", name: "Lucía Vera", email: "lucia@estudiovera.com", company: "Estudio Jurídico Vera", phone: "", language: "es", message: "Nos interesa organizar los expedientes.", type: "contacto", leadSource: "Formulario contacto", fuente: "web_directo", createdAt: "2026-07-02", tags: [], bookingDate: "", estadoLlamada: "", zonaHoraria: "", horaCliente: "", llamadaRealizada: false, caminoPostLlamada: "", notasDescubrimiento: "", comentarioAdicional: "", videollamadaDate: "", videollamadaZoom: "", videollamadaEstado: "", videollamadaRealizada: false, presentacionUrl: "", status: "Nuevo lead", leadOwner: "Andrea", leadOwnerEmail: "andrea@siemondigital.com", outreachNotes: "", followUpDate: "", qualified: false, aiSummary: "", subscribed: true, unsubscribedDate: "", unsubscribeReason: "", valor: 500 },
        { id: "l5", name: "Sara Molina", email: "sara@marcaviva.com", company: "Agencia Marca Viva", phone: "+57 300 987 6543", language: "es", message: "Queremos seguir mejorando el ecosistema.", type: "contacto", leadSource: "Referido", fuente: "referido", createdAt: "2026-04-10", tags: ["Cliente"], bookingDate: "", estadoLlamada: "", zonaHoraria: "", horaCliente: "", llamadaRealizada: true, caminoPostLlamada: "Videollamada", notasDescubrimiento: "Cliente en acompañamiento continuo.", comentarioAdicional: "", videollamadaDate: "", videollamadaZoom: "", videollamadaEstado: "", videollamadaRealizada: true, presentacionUrl: "https://siemondigital.com/p/marcaviva", status: "Cliente", leadOwner: "Andrea", leadOwnerEmail: "andrea@siemondigital.com", outreachNotes: "Revisión mensual.", followUpDate: "2026-07-15", qualified: true, aiSummary: "Cliente activo.", subscribed: true, unsubscribedDate: "", unsubscribeReason: "", valor: 300 },
        { id: "l6", name: "James Cole", email: "james@nordictech.io", company: "Nordic Tech", phone: "", language: "en", message: "Interested in the AI diagnostic.", type: "guia-ia", leadSource: "YouTube", fuente: "yt_video", createdAt: "2026-06-30", tags: ["EN"], bookingDate: "", estadoLlamada: "", zonaHoraria: "", horaCliente: "", llamadaRealizada: false, caminoPostLlamada: "", notasDescubrimiento: "", comentarioAdicional: "", videollamadaDate: "", videollamadaZoom: "", videollamadaEstado: "", videollamadaRealizada: false, presentacionUrl: "", status: "Nuevo lead", leadOwner: "Andrea", leadOwnerEmail: "andrea@siemondigital.com", outreachNotes: "", followUpDate: "", qualified: false, aiSummary: "", subscribed: true, unsubscribedDate: "", unsubscribeReason: "", valor: 500 },
        { id: "l7", name: "Gabriela Soto", email: "gabriela@andes.com", company: "Distribuidora Andes", phone: "+57 320 445 1100", language: "es", message: "Pedidos por WhatsApp sin registro.", type: "contacto", leadSource: "Referido", fuente: "referido", createdAt: "2026-06-12", tags: ["Distribución"], bookingDate: "2026-06-20 11:00", estadoLlamada: "BOOKING_CREATED", zonaHoraria: "America/Bogota", horaCliente: "11:00 a.m.", llamadaRealizada: true, caminoPostLlamada: "Videollamada", notasDescubrimiento: "Objetivo: registro y trazabilidad de pedidos.", comentarioAdicional: "", videollamadaDate: "2026-06-27 16:00", videollamadaZoom: "https://zoom.us/j/771", videollamadaEstado: "Agendada", videollamadaRealizada: true, presentacionUrl: "", status: "Cliente", leadOwner: "Andrea", leadOwnerEmail: "andrea@siemondigital.com", outreachNotes: "Cerró implementación.", followUpDate: "", qualified: true, aiSummary: "Cliente nuevo de implementación.", subscribed: true, unsubscribedDate: "", unsubscribeReason: "", valor: 1900 },
      ],
      ofertas: [
        { id: "o1", nombre: "Diagnóstico Siemon", tipo: "Servicio", precio: 500, cur: "USD", recurrente: false, estado: "Activa" },
        { id: "o2", nombre: "Implementación a la medida", tipo: "Servicio", precio: 1900, cur: "USD", recurrente: false, estado: "Activa" },
        { id: "o3", nombre: "Acompañamiento y mantenimiento", tipo: "Servicio", precio: 300, cur: "USD", recurrente: true, estado: "Activa" },
        { id: "o8", nombre: "Canal de YouTube", tipo: "Contenido", precio: 0, cur: "USD", recurrente: false, estado: "Proyectado" },
      ],
      canalesConn: { Instagram: true, Facebook: false, LinkedIn: true, YouTube: true, TikTok: false, WhatsApp: true },
      inbound: [
        { id: "i1", canal: "WhatsApp", autor: "+57 301 224 8890", mensaje: "Hola, vi tu guía de IA. ¿Cómo funciona el diagnóstico?", fecha: "2026-07-03", tipo: "WhatsApp", convertido: false },
        { id: "i2", canal: "Instagram", autor: "@estudio.crea", mensaje: "Nos interesa automatizar la atención a clientes.", fecha: "2026-07-03", tipo: "DM", convertido: false },
        { id: "i3", canal: "LinkedIn", autor: "Marcela Ávila", mensaje: "¿Trabajan con despachos jurídicos?", fecha: "2026-07-02", tipo: "Comentario", convertido: false },
        { id: "i4", canal: "Facebook", autor: "Tienda Origen", mensaje: "¿Precio del acompañamiento mensual?", fecha: "2026-07-01", tipo: "DM", convertido: false },
      ],
      publicaciones: [
        { id: "pub1", canales: ["Instagram", "LinkedIn"], texto: "Tu negocio no vive un caos: vive brechas de oportunidad. Empieza por el mapa.", estado: "Publicada", fecha: "2026-07-02" },
        { id: "pub2", canales: ["LinkedIn"], texto: "Solo 1 de cada 8 empresas capitaliza el valor real de la IA. La diferencia la marca quién entra con estructura.", estado: "Programada", fecha: "2026-07-06" },
      ],
      prospectos: PROSPECTOS_SEED,
    },
    academia: {
      ofertas: [
        { id: "e1", nombre: "Fundamentos de IA para tu negocio", tipo: "Infoproducto", precio: 47, cur: "USD", recurrente: false, activo: true },
        { id: "e2", nombre: "Automatiza tu operación", tipo: "Infoproducto", precio: 67, cur: "USD", recurrente: false, activo: true },
        { id: "e3", nombre: "Mentoría 1:1 Siemon", tipo: "Mentoría", precio: 300, cur: "USD", recurrente: false, activo: true },
        { id: "e4", nombre: "Mentoría grupal (cohorte)", tipo: "Mentoría", precio: 120, cur: "USD", recurrente: false, activo: true },
        { id: "e5", nombre: "Comunidad Siemon", tipo: "Comunidad", precio: 29, cur: "USD", recurrente: true, activo: true },
      ],
      inscripciones: [
        { id: "n1", fecha: "2026-02-14", oferta: "Fundamentos de IA para tu negocio", alumno: "Laura Gómez", monto: 47, cur: "USD", canal: "Instagram" },
        { id: "n2", fecha: "2026-03-05", oferta: "Fundamentos de IA para tu negocio", alumno: "Diego Peña", monto: 47, cur: "USD", canal: "YouTube" },
        { id: "n3", fecha: "2026-03-22", oferta: "Mentoría grupal (cohorte)", alumno: "Sofía Marín", monto: 120, cur: "USD", canal: "LinkedIn" },
        { id: "n4", fecha: "2026-04-09", oferta: "Automatiza tu operación", alumno: "Andrés Rojas", monto: 67, cur: "USD", canal: "Referido" },
        { id: "n5", fecha: "2026-04-27", oferta: "Mentoría 1:1 Siemon", alumno: "Paula Vega", monto: 300, cur: "USD", canal: "Instagram" },
        { id: "n6", fecha: "2026-05-11", oferta: "Fundamentos de IA para tu negocio", alumno: "Julián Cano", monto: 47, cur: "USD", canal: "WhatsApp" },
        { id: "n7", fecha: "2026-05-30", oferta: "Automatiza tu operación", alumno: "Emma Ford", monto: 67, cur: "USD", canal: "YouTube" },
        { id: "n8", fecha: "2026-06-15", oferta: "Mentoría grupal (cohorte)", alumno: "Tomás Silva", monto: 120, cur: "USD", canal: "LinkedIn" },
        { id: "n9", fecha: "2026-06-28", oferta: "Fundamentos de IA para tu negocio", alumno: "Mariana Ruiz", monto: 47, cur: "USD", canal: "Instagram" },
        { id: "n10", fecha: "2026-07-03", oferta: "Mentoría 1:1 Siemon", alumno: "Isabela León", monto: 300, cur: "USD", canal: "Referido" },
      ],
      miembros: [
        { id: "m1", nombre: "Laura Gómez", email: "laura@ejemplo.com", plan: "Mensual", desde: "2026-02-20", activo: true },
        { id: "m2", nombre: "Andrés Rojas", email: "andres@ejemplo.com", plan: "Mensual", desde: "2026-04-12", activo: true },
        { id: "m3", nombre: "Paula Vega", email: "paula@ejemplo.com", plan: "Mensual", desde: "2026-04-28", activo: true },
        { id: "m4", nombre: "Julián Cano", email: "julian@ejemplo.com", plan: "Mensual", desde: "2026-05-14", activo: true },
        { id: "m5", nombre: "Tomás Silva", email: "tomas@ejemplo.com", plan: "Mensual", desde: "2026-06-16", activo: false },
        { id: "m6", nombre: "Mariana Ruiz", email: "mariana@ejemplo.com", plan: "Mensual", desde: "2026-06-30", activo: true },
      ],
    },
  };
}

/* ---------------------------- storage: Supabase (ver ./db.js) ---------------------------- */
/* loadData()/saveData() se importan de ./db. loadData devuelve null si la base
   esta vacia (la app siembra con seed()). saveData devuelve el data fresco. */

/* ============================== APP ============================== */
export default function App({ onUnauthorized } = {}) {
  const [data, setData] = useState(null);
  const [view, setView] = useState("panel");
  const [navOpen, setNavOpen] = useState(false);   // drawer del menú en móvil
  const [modal, setModal] = useState(null);
  const [drawer, setDrawer] = useState(null);
  const [toast, setToast] = useState("");
  // puente Calendario → Contenido: carga una publicación en el editor para editar/republicar
  const [pubDraft, setPubDraft] = useState(null);
  const irAPublicar = (d) => { setPubDraft(d); setView("contenido"); setDrawer(null); };

  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap";
    const st = document.createElement("style");
    st.textContent = "" +
      ".fs-8{font-size:8px}.fs-9{font-size:9px}.fs-10{font-size:10px}.fs-11{font-size:11px}" +
      ".fs-12{font-size:12px}.fs-13{font-size:13px}.fs-14{font-size:14px}.fs-15{font-size:15px}" +
      ".fs-16{font-size:16px}.fs-18{font-size:18px}.fs-20{font-size:20px}.fs-24{font-size:24px}" +
      ".cmd-scroll::-webkit-scrollbar{height:8px;width:8px}.cmd-scroll::-webkit-scrollbar-thumb{background:rgba(255,255,255,.1);border-radius:8px}";
    try { document.head.appendChild(link); document.head.appendChild(st); } catch (e) {}
  }, []);
  useEffect(() => { (async () => {
    try {
      const l = await loadData();
      if (l) { setData(l); return; }
      const s = seed(); setData(s);               // base vacia: sembrar
      const fresh = await saveData(s); if (fresh) setData(fresh);
    } catch (e) {
      if (String(e.message) === "401" && onUnauthorized) return onUnauthorized();
      console.error("Error cargando datos:", e);
    }
  })(); }, []);

  // guardas en vuelo + última edición local: para que un reload NO pise lo que aún no se guardó
  const savingRef = useRef(0);
  const lastEditRef = useRef(0);
  // optimista: pinta ya y persiste en el VPS
  const commit = (next) => {
    setData(next);
    lastEditRef.current = Date.now();
    savingRef.current += 1;
    saveData(next).catch((e) => {
      if (String(e.message) === "401" && onUnauthorized) onUnauthorized(); else console.error(e);
    }).finally(() => { savingRef.current = Math.max(0, savingRef.current - 1); });
  };
  const flash = (m) => { setToast(m); setTimeout(() => setToast(""), 2400); };
  const reload = async () => {
    // NUNCA pises ediciones locales sin guardar: si hay un guardado en curso o acabas de
    // editar hace menos de 4s, no recargues (asi no se pierden claves recien escritas).
    if (savingRef.current > 0 || Date.now() - lastEditRef.current < 4000) return;
    try { const l = await loadData(); if (l) setData(l); } catch (e) { console.error(e); }
  };
  // al volver a la pestaña, recarga del servidor: recoge lo que escribió el motor
  // (respuestas clasificadas, leads de formularios) y evita pisarlo con una copia vieja
  useEffect(() => {
    const onFocus = () => { if (document.visibilityState === "visible") reload(); };
    document.addEventListener("visibilitychange", onFocus);
    window.addEventListener("focus", onFocus);
    return () => { document.removeEventListener("visibilitychange", onFocus); window.removeEventListener("focus", onFocus); };
    // eslint-disable-next-line
  }, []);
  const setWorkspace = (ws) => { commit({ ...data, workspace: ws }); setView("panel"); setDrawer(null); };
  // deep link desde correos: crm.siemondigital.com/#v=blogseo&art=<id>
  useEffect(() => {
    const m = (location.hash || "").match(/v=([a-z]+)/);
    if (m) setView(m[1]);
  }, []);

  if (!data) return <div style={{ background: C.obsidian, color: C.ash, fontFamily: MONO, minHeight: "100vh" }} className="flex items-center justify-center fs-13 tracking-widest">// CARGANDO CENTRO DE MANDO…</div>;

  const ws = data.workspace;
  const navSiemon = [
    { id: "panel", label: "Panel", icon: LayoutDashboard },
    { section: "Comercial y clientes" },
    { id: "prospeccion", label: "Prospección", icon: Search },
    { id: "prototipos", label: "Prototipos", icon: Rocket },
    { id: "frio", label: "Correo en frío", icon: Snowflake },
    { id: "nurturing", label: "Nurturing", icon: Sprout },
    { id: "leads", label: "Leads", icon: Users },
    { id: "pipeline", label: "Pipeline", icon: KanbanSquare },
    { id: "seguimiento", label: "Seguimiento", icon: Bell },
    { id: "facturacion", label: "Facturación", icon: Receipt },
    { id: "clientes", label: "Clientes", icon: Handshake },
    { id: "ofertas", label: "Ofertas", icon: Package },
    { id: "fuentes", label: "Fuentes", icon: Globe },
    { id: "canales", label: "Canales", icon: Radio },
    { id: "agenda", label: "Agenda y envíos", icon: CalendarClock },
    { id: "mercado", label: "Estudio de mercado", icon: Radar },
    { section: "Contenido" },
    { id: "contenido", label: "Contenido y estudio", icon: Wand2 },
    { id: "blogseo", label: "Blog y SEO", icon: FileText },
    { id: "maquetador", label: "Maquetador (mi web)", icon: Paintbrush },
    { id: "analitica", label: "Analítica", icon: BarChart3 },
    { id: "calendario", label: "Calendario", icon: CalendarDays },
    { id: "ads", label: "Ads", icon: Megaphone },
    { id: "estudio_yt", label: "Estudio YT", icon: Youtube },
    { section: "Configuración" },
    { id: "accesos", label: "Accesos", icon: KeyRound },
  ];
  const navAcad = [
    { id: "panel", label: "Panel", icon: LayoutDashboard }, { id: "catalogo", label: "Catálogo", icon: Package },
    { id: "inscritos", label: "Inscritos", icon: Receipt }, { id: "comunidad", label: "Comunidad", icon: Users },
  ];
  const nav = ws === "siemon" ? navSiemon : navAcad;
  const pendientes = ws === "siemon" ? contarPendientes(data.siemon.leads) : 0;

  const vistaLabel = (nav.find((n) => n.id === view) || {}).label || "Centro de Mando";
  return (
    <div style={{ background: C.obsidian, color: C.cream, fontFamily: SANS, minHeight: "100vh" }}>
      {/* Barra superior solo móvil: hamburguesa + logo + vista actual */}
      <div className="md:hidden sticky top-0 z-30 flex items-center gap-3 px-4 py-3" style={{ background: C.carbon, borderBottom: `1px solid ${C.line}` }}>
        <button onClick={() => setNavOpen(true)} aria-label="Menú" style={{ color: C.mist }}><Menu size={22} /></button>
        <Mark />
        <span style={{ color: C.cream, fontWeight: 600 }} className="fs-13 truncate">{vistaLabel}</span>
        {pendientes > 0 && <span style={{ background: C.danger, color: C.obsidian, fontWeight: 700, minWidth: 18 }} className="ml-auto text-center px-1.5 rounded-full fs-10">{pendientes}</span>}
      </div>
      <div className="flex min-h-screen">
        {/* backdrop del drawer en móvil */}
        {navOpen && <div className="md:hidden fixed inset-0 z-30" style={{ background: "rgba(5,6,8,0.6)" }} onClick={() => setNavOpen(false)} />}
        <aside style={{ borderColor: C.line, background: C.carbon }} className={"fixed md:sticky inset-y-0 left-0 top-0 z-40 w-72 md:w-60 h-full md:h-screen md:self-start overflow-y-auto cmd-scroll border-r shrink-0 transition-transform duration-200 " + (navOpen ? "translate-x-0" : "-translate-x-full") + " md:translate-x-0"}>
          <div className="px-4 py-4 flex items-start justify-between" style={{ borderBottom: `1px solid ${C.lineSoft}` }}>
            <div className="flex-1">
              <div className="flex items-center gap-2.5 mb-3"><Mark /><span style={{ color: C.ash, fontFamily: MONO, letterSpacing: "0.32em" }} className="fs-8">CENTRO DE MANDO</span></div>
              <WorkspaceSwitch ws={ws} onChange={setWorkspace} />
            </div>
            <button onClick={() => setNavOpen(false)} className="md:hidden ml-2" aria-label="Cerrar" style={{ color: C.ash }}><X size={18} /></button>
          </div>
          <nav className="p-3 flex flex-col gap-1" style={{ paddingBottom: 84 }}>
            {nav.map((n, i) => {
              if (n.section) return <div key={"s" + i} style={{ color: C.ash, fontFamily: MONO, letterSpacing: "0.18em" }} className="fs-8 uppercase px-3 pt-3 pb-1">{n.section}</div>;
              const on = view === n.id; const Icon = n.icon; return (
              <button key={n.id} onClick={() => { setView(n.id); setDrawer(null); setNavOpen(false); }} style={{ background: on ? C.aetherSoft : "transparent", color: on ? C.aether2 : C.mist, border: `1px solid ${on ? C.aetherLine : "transparent"}` }} className="flex items-center gap-3 px-3 py-2.5 rounded-lg fs-13 font-medium whitespace-nowrap"><Icon size={16} strokeWidth={1.8} />{n.label}{n.id === "seguimiento" && pendientes > 0 && <span style={{ background: C.danger, color: C.obsidian, fontWeight: 700, minWidth: 18 }} className="ml-auto text-center px-1.5 rounded-full fs-10">{pendientes}</span>}</button>
            ); })}
          </nav>
        </aside>
        <main className="flex-1 min-w-0">
          {ws === "siemon" && view === "panel" && <PanelSiemon data={data} commit={commit} />}
          {ws === "siemon" && view === "seguimiento" && <SeguimientoView data={data} commit={commit} flash={flash} openDrawer={setDrawer} />}
          {ws === "siemon" && view === "leads" && <Leads data={data} open={setModal} commit={commit} flash={flash} openDrawer={setDrawer} />}
          {ws === "siemon" && view === "prospeccion" && <Prospeccion data={data} commit={commit} flash={flash} />}
          {ws === "siemon" && view === "frio" && <CorreoFrioView data={data} commit={commit} flash={flash} reload={reload} />}
          {ws === "siemon" && view === "contenido" && <EstudioUnificado data={data} commit={commit} flash={flash} draftExterno={pubDraft} clearDraftExterno={() => setPubDraft(null)} />}
          {ws === "siemon" && view === "nurturing" && <NurturingView data={data} commit={commit} flash={flash} />}
          {ws === "siemon" && view === "facturacion" && <FacturacionView data={data} commit={commit} flash={flash} />}
          {ws === "siemon" && view === "mercado" && <MercadoView data={data} commit={commit} flash={flash} />}
          {ws === "siemon" && view === "blogseo" && <BlogSeoView data={data} commit={commit} flash={flash} />}
          {ws === "siemon" && view === "maquetador" && <MaquetadorView data={data} commit={commit} flash={flash} />}
          {ws === "siemon" && view === "analitica" && <AnaliticaView data={data} flash={flash} />}
          {ws === "siemon" && view === "clientes" && <ClientesView data={data} commit={commit} flash={flash} openDrawer={setDrawer} setView={setView} />}
          {ws === "siemon" && view === "accesos" && <AccesosView data={data} commit={commit} flash={flash} />}
          {ws === "siemon" && view === "calendario" && <CalendarioView data={data} commit={commit} flash={flash} irACrear={(p) => irAPublicar({ texto: p.texto, mediaUrl: p.mediaUrl, mediaType: p.mediaType })} />}
          {ws === "siemon" && view === "ads" && <AdsView data={data} commit={commit} flash={flash} />}
          {ws === "siemon" && view === "prototipos" && <PrototiposView data={data} commit={commit} flash={flash} />}
          {ws === "siemon" && view === "estudio_yt" && <EstudioYtView data={data} commit={commit} flash={flash} />}
          {ws === "siemon" && view === "fuentes" && <FuentesView data={data} commit={commit} flash={flash} />}
          {ws === "siemon" && view === "pipeline" && <Pipeline data={data} commit={commit} open={setModal} flash={flash} openDrawer={setDrawer} />}
          {ws === "siemon" && view === "canales" && <Canales data={data} commit={commit} flash={flash} open={setModal} />}
          {ws === "siemon" && view === "ofertas" && <Ofertas data={data} commit={commit} flash={flash} />}
          {ws === "siemon" && view === "agenda" && <Agenda data={data} commit={commit} flash={flash} openDrawer={setDrawer} />}
          {ws === "academia" && view === "panel" && <PanelAcademia data={data} />}
          {ws === "academia" && view === "catalogo" && <Catalogo data={data} commit={commit} flash={flash} open={setModal} />}
          {ws === "academia" && view === "inscritos" && <Inscritos data={data} open={setModal} commit={commit} flash={flash} />}
          {ws === "academia" && view === "comunidad" && <Comunidad data={data} open={setModal} commit={commit} flash={flash} />}
        </main>
      </div>
      {modal && <Modal modal={modal} data={data} commit={commit} close={() => setModal(null)} flash={flash} />}
      {drawer && <LeadDrawer lead={data.siemon.leads.find((l) => l.id === drawer)} data={data} commit={commit} close={() => setDrawer(null)} flash={flash} />}
      {toast && <div style={{ background: C.panel2, border: `1px solid ${C.aetherLine}`, color: C.cream }} className="fixed bottom-5 left-1/2 -translate-x-1/2 px-4 py-2.5 rounded-lg fs-13 shadow-lg z-50">{toast}</div>}
      <EnlacesRapidos data={data} commit={commit} flash={flash} />
      <AsistenteFlotante data={data} commit={commit} flash={flash} ws={ws} vista={view} reload={reload} />
    </div>
  );
}

/* ---------------------------- shared UI ---------------------------- */
function Mark() {
  return (<svg viewBox="0 0 201.75 223.5" width="20" height="22" aria-hidden="true"><path fill={C.aether} d="M76.54 0c-1.42 6.1-2.13 10.83-2.13 14.2 0 4.8 1.42 9.76 4.25 14.88 2.83 5.12 7.84 11.71 15.04 19.77 14.49 16.56 24.54 28.4 30.17 35.53 5.6 7.13 10.16 13.86 13.64 20.18 4.15 7.52 7.12 14.52 8.91 21 1.8 6.48 2.7 13.43 2.7 20.83 0 9.26-1.58 18.27-4.74 27.04-3.17 8.77-7.57 16.48-13.25 23.12-15.04 17.65-38.09 26.47-69.16 26.47H.19v-52.8h54.77c11.66 0 20-2.89 25.01-8.67 4.03-4.79 6.06-9.97 6.06-15.53 0-6.43-2.29-13.05-6.87-19.87-4.59-6.8-15.86-20.47-33.85-40.96-8.28-9.59-14.63-17.47-19.05-23.63-4.41-6.15-7.66-11.79-9.72-16.92C13.05 36.03 11.31 28.18 11.31 21.09c0-5.24.77-12.26 2.28-21.09H76.54zM189.98 62.5c-7.36-15.63-17.57-28.68-30.66-39.13-9.8-7.85-21.04-13.69-33.68-17.56C113.99 2.25 100.96.32 86.53.04l-.5 2.17c-1.55 6.66-1.88 10.2-1.88 12.01 0 3.1 1.03 6.52 3.03 10.15 2.46 4.46 7.1 10.52 13.79 18l.06.06c14.53 16.6 24.8 28.69 30.5 35.92 5.9 7.51 10.79 14.74 14.51 21.5 4.5 8.15 7.78 15.92 9.77 23.1 2.02 7.3 3.05 15.18 3.05 23.42 0 10.34-1.79 20.55-5.31 30.34-3.54 9.83-8.6 18.62-15 26.13-5.35 6.27-11.6 11.57-18.7 15.88 3.48-.84 6.83-1.82 10.04-2.92 9.05-3.05 17.84-7.82 26.4-14.3 8.56-6.48 16.1-14.07 22.65-22.79 14.72-19.71 22.08-41.93 22.08-66.66 0-17.42-3.68-33.95-11.04-49.57z" /></svg>);
}
function WorkspaceSwitch({ ws, onChange }) {
  const opt = [{ id: "siemon", label: "Siemon Digital" }, { id: "academia", label: "Infoproductos y comunidad" }];
  return (<div style={{ background: C.obsidian, border: `1px solid ${C.line}` }} className="rounded-lg p-1 flex flex-col gap-1">
    {opt.map((o) => { const on = ws === o.id; return (
      <button key={o.id} onClick={() => onChange(o.id)} style={{ background: on ? C.aether : "transparent", color: on ? C.obsidian : C.mist, fontWeight: on ? 700 : 500 }} className="flex items-center justify-between px-2.5 py-1.5 rounded-md fs-11 text-left">{o.label}{on && <ArrowLeftRight size={12} />}</button>
    ); })}
  </div>);
}
function Header({ label, title, action, sub }) {
  return (<div className="flex items-end justify-between gap-4 mb-6"><div>
    <div style={{ color: C.aether500, fontFamily: MONO, letterSpacing: "0.2em" }} className="fs-10 uppercase mb-2"><span style={{ color: C.aether }}>// </span>{label}</div>
    <h1 style={{ fontWeight: 600, letterSpacing: "-0.01em" }} className="fs-24">{title}</h1>
    {sub && <div style={{ color: C.ash }} className="fs-11 mt-1.5 max-w-xl leading-snug">{sub}</div>}
  </div>{action}</div>);
}
function AddBtn({ onClick, children }) { return <button onClick={onClick} style={{ background: C.aether, color: C.obsidian, fontWeight: 600 }} className="flex items-center gap-2 px-3.5 py-2 rounded-lg fs-13 shrink-0"><Plus size={15} strokeWidth={2.4} />{children}</button>; }
function Badge({ children, tone = "aether" }) {
  const map = { aether: { bg: C.aetherSoft, bd: C.aetherLine, fg: C.aether2 }, ok: { bg: C.okSoft, bd: "rgba(127,184,155,0.4)", fg: C.ok }, ash: { bg: "rgba(255,255,255,0.05)", bd: C.line, fg: C.ash }, danger: { bg: C.dangerSoft, bd: "rgba(208,138,138,0.4)", fg: C.danger }, warn: { bg: C.warnSoft, bd: "rgba(216,182,115,0.4)", fg: C.warn } }[tone];
  return <span style={{ background: map.bg, border: `1px solid ${map.bd}`, color: map.fg, fontFamily: MONO }} className="inline-flex items-center px-2 py-0.5 rounded fs-10 tracking-wide whitespace-nowrap">{children}</span>;
}
function Card({ children, className = "", style = {} }) { return <div style={{ background: C.panel, border: `1px solid ${C.line}`, ...style }} className={"rounded-xl " + className}>{children}</div>; }
function ChartTitle({ children, right }) { return (<div className="flex items-center justify-between mb-4"><div style={{ color: C.aether500, fontFamily: MONO, letterSpacing: "0.16em" }} className="fs-10 uppercase"><span style={{ color: C.aether }}>// </span>{children}</div>{right}</div>); }
function MiniLabel({ children }) { return <div style={{ color: C.aether500, fontFamily: MONO, letterSpacing: "0.16em" }} className="fs-10 uppercase mb-3"><span style={{ color: C.aether }}>// </span>{children}</div>; }
const stageTone = (s) => s === "Cliente" ? "ok" : s === "Perdido" ? "danger" : s === "Videollamada" || s === "Propuesta" ? "aether" : "ash";
function Stat({ label, value, hint, Icon, accent }) {
  return (<Card className="p-4"><div className="flex items-center justify-between mb-3"><span style={{ color: C.ash, fontFamily: MONO, letterSpacing: "0.14em" }} className="fs-9 uppercase">{label}</span><Icon size={15} color={accent || C.aether500} strokeWidth={1.8} /></div><div style={{ fontWeight: 700, letterSpacing: "-0.02em", color: accent || C.cream }} className="fs-24">{value}</div><div style={{ color: C.ash }} className="fs-10 mt-1.5 leading-snug">{hint}</div></Card>);
}
const chartTip = { background: C.panel2, border: `1px solid ${C.aetherLine}`, borderRadius: 10, color: C.cream, fontSize: 12 };

/* reusable charts */
function GrowthArea({ data, gradId, fmt = (v) => v }) {
  return (<div style={{ height: 240 }}><ResponsiveContainer width="100%" height="100%"><AreaChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
    <defs><linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.aether} stopOpacity={0.35} /><stop offset="100%" stopColor={C.aether} stopOpacity={0} /></linearGradient></defs>
    <CartesianGrid stroke={C.lineSoft} vertical={false} /><XAxis dataKey="mes" tick={{ fill: C.ash, fontSize: 11, fontFamily: MONO }} axisLine={{ stroke: C.line }} tickLine={false} /><YAxis tick={{ fill: C.ash, fontSize: 11, fontFamily: MONO }} axisLine={false} tickLine={false} allowDecimals={false} />
    <Tooltip contentStyle={chartTip} formatter={(v) => [fmt(v), "Acumulado"]} /><Area type="monotone" dataKey="total" stroke={C.aether} strokeWidth={2.6} fill={`url(#${gradId})`} dot={{ r: 3, fill: C.aether }} activeDot={{ r: 5 }} />
  </AreaChart></ResponsiveContainer></div>);
}
function ProjectionChart({ data, fmt = (v) => v }) {
  return (<div style={{ height: 240 }}><ResponsiveContainer width="100%" height="100%"><LineChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
    <CartesianGrid stroke={C.lineSoft} vertical={false} /><XAxis dataKey="mes" tick={{ fill: C.ash, fontSize: 11, fontFamily: MONO }} axisLine={{ stroke: C.line }} tickLine={false} /><YAxis tick={{ fill: C.ash, fontSize: 11, fontFamily: MONO }} axisLine={false} tickLine={false} />
    <Tooltip contentStyle={chartTip} formatter={(v, n) => [fmt(v), n === "real" ? "Real" : "Proyección"]} />
    <Line type="monotone" dataKey="real" stroke={C.aether} strokeWidth={2.6} dot={{ r: 3, fill: C.aether }} connectNulls={false} />
    <Line type="monotone" dataKey="proy" stroke={C.aether2} strokeWidth={2} strokeDasharray="5 4" dot={{ r: 3, fill: C.aether2 }} connectNulls={false} />
  </LineChart></ResponsiveContainer></div>);
}
function ProjLegend({ growth }) {
  return (<div className="flex items-center gap-3 fs-9" style={{ fontFamily: MONO, color: C.ash }}>
    <span className="flex items-center gap-1"><span style={{ width: 14, height: 2, background: C.aether, display: "inline-block" }} />Real</span>
    <span className="flex items-center gap-1"><span style={{ width: 14, height: 0, borderTop: `2px dashed ${C.aether2}`, display: "inline-block" }} />Proyección +{growth}%/mes</span>
  </div>);
}
function OppCostChart({ data }) {
  return (<div style={{ height: 200 }}><ResponsiveContainer width="100%" height="100%"><BarChart data={data} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
    <CartesianGrid stroke={C.lineSoft} vertical={false} /><XAxis dataKey="cat" tick={{ fill: C.ash, fontSize: 10 }} axisLine={{ stroke: C.line }} tickLine={false} /><YAxis tick={{ fill: C.ash, fontSize: 10, fontFamily: MONO }} axisLine={false} tickLine={false} />
    <Tooltip cursor={{ fill: C.aetherSoft }} contentStyle={chartTip} formatter={(v) => [money(v), "Valor"]} />
    <Bar dataKey="val" radius={[5, 5, 0, 0]} barSize={40}>{data.map((d, i) => <Cell key={i} fill={d.tone} fillOpacity={0.22} stroke={d.tone} strokeWidth={1.5} />)}</Bar>
  </BarChart></ResponsiveContainer></div>);
}

/* ------------------------- SIEMON · PANEL ------------------------- */
function PanelSiemon({ data, commit }) {
  const { leads } = data.siemon;
  const k = useMemo(() => {
    const abiertos = leads.filter((l) => !["Cliente", "Perdido"].includes(l.status));
    const clientes = leads.filter((l) => l.status === "Cliente");
    return { total: leads.length, pipeline: abiertos.reduce((s, l) => s + (l.valor || 0), 0), conv: leads.length ? Math.round(clientes.length / leads.length * 100) : 0, proximas: leads.filter((l) => l.bookingDate && l.bookingDate >= today()).length + leads.filter((l) => l.videollamadaDate && l.videollamadaDate >= today()).length };
  }, [leads]);
  const porCanal = useMemo(() => { const m = {}; leads.forEach((l) => { m[l.leadSource] = (m[l.leadSource] || 0) + 1; }); return Object.keys(m).map((x) => ({ canal: x, total: m[x] })).sort((a, b) => b.total - a.total); }, [leads]);
  const porEtapa = useMemo(() => STAGES.map((s) => ({ etapa: s.replace("Llamada agendada", "Llamada").replace("Nuevo lead", "Nuevo"), total: leads.filter((l) => l.status === s).length })), [leads]);
  const crecimiento = useMemo(() => { const m = {}; leads.forEach((l) => { if (l.createdAt) { const key = l.createdAt.slice(0, 7); m[key] = (m[key] || 0) + 1; } }); return cumBy(m); }, [leads]);
  const proj = useMemo(() => { const m = {}; leads.forEach((l) => { if (l.createdAt) { const key = l.createdAt.slice(0, 7); m[key] = (m[key] || 0) + 1; } }); return proyectar(m); }, [leads]);
  const opp = useMemo(() => {
    const sum = (arr) => arr.reduce((s, l) => s + (l.valor || 0), 0);
    const ganado = sum(leads.filter((l) => l.status === "Cliente"));
    const perdido = sum(leads.filter((l) => l.status === "Perdido"));
    const abiertos = leads.filter((l) => !["Cliente", "Perdido"].includes(l.status));
    const enRiesgo = sum(abiertos.filter((l) => !l.bookingDate && !l.followUpDate && !l.llamadaRealizada));
    const enProceso = sum(abiertos) - enRiesgo;
    return { data: [{ cat: "Ganado", val: ganado, tone: C.ok }, { cat: "En proceso", val: enProceso, tone: C.aether }, { cat: "En riesgo", val: enRiesgo, tone: C.warn }, { cat: "Perdido", val: perdido, tone: C.danger }], costo: enRiesgo + perdido };
  }, [leads]);

  // cobros (facturas), top clientes y próximos pasos
  const fin = useMemo(() => {
    const facturas = (data.siemon.facturas || []).map((f) => ({ ...f, estadoReal: estadoFactura(f) }));
    const ym = (d) => (d || "").slice(0, 7);
    const hoy = new Date(); const mesAct = hoy.toISOString().slice(0, 7);
    const prev = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1).toISOString().slice(0, 7);
    const cobrado = (m) => facturas.filter((f) => f.estadoReal === "Pagada" && ym(f.pagoFecha) === m).reduce((s, f) => s + (Number(f.total) || 0), 0);
    const mes = cobrado(mesAct); const anterior = cobrado(prev);
    const delta = anterior > 0 ? Math.round(((mes - anterior) / anterior) * 100) : (mes > 0 ? 100 : 0);
    const porCobrar = facturas.filter((f) => f.estadoReal === "Pendiente" || f.estadoReal === "Vencida").reduce((s, f) => s + (Number(f.total) || 0), 0);
    // top 5 clientes: por facturado pagado; si no hay facturas, por valor de leads cliente
    const porCliente = {};
    facturas.filter((f) => f.estadoReal === "Pagada").forEach((f) => { porCliente[f.cliente] = (porCliente[f.cliente] || 0) + (Number(f.total) || 0); });
    let top = Object.entries(porCliente).map(([n, v]) => ({ n, v }));
    if (!top.length) top = leads.filter((l) => l.status === "Cliente" && l.valor).map((l) => ({ n: l.company || l.name, v: l.valor }));
    top = top.sort((a, b) => b.v - a.v).slice(0, 5);
    // próximas 5 actividades: seguimientos y citas desde hoy
    const hoyS = new Date().toISOString().slice(0, 10);
    const acts = [];
    leads.forEach((l) => {
      if (l.followUpDate && l.followUpDate >= hoyS) acts.push({ f: l.followUpDate, t: "Seguimiento", n: l.name, s: l.status });
      if (l.bookingDate && l.bookingDate.slice(0, 10) >= hoyS && !l.llamadaRealizada) acts.push({ f: l.bookingDate.slice(0, 10), t: "Llamada", n: l.name, s: l.status });
      if (l.videollamadaDate && l.videollamadaDate.slice(0, 10) >= hoyS && !l.videollamadaRealizada) acts.push({ f: l.videollamadaDate.slice(0, 10), t: "Videollamada", n: l.name, s: l.status });
    });
    return { mes, delta, porCobrar, top, acts: acts.sort((a, b) => a.f.localeCompare(b.f)).slice(0, 5) };
  }, [data.siemon.facturas, leads]);

  return (
    <div className="p-5 md:p-8">
      <Header label="Agencia · vista general" title="Panel Siemon" />
      {(() => {
        const mesKey = new Date().toISOString().slice(0, 7);
        const metas = data.siemon.metas || {};
        const meta = Number(metas[mesKey]) || 0;                    // la meta la pones tú, no es fija
        const ticket = Number(data.siemon.ticketPromedio) || 0;
        const pct = meta > 0 ? Math.min(100, Math.round((fin.mes / meta) * 100)) : 0;
        const falta = Math.max(0, meta - fin.mes);
        const cierres = falta > 0 && ticket > 0 ? Math.ceil(falta / ticket) : 0;
        const inMini = { background: "#101116", border: `1px solid ${C.line}`, color: C.cream, borderRadius: 8, padding: "5px 10px", fontFamily: MONO, fontSize: 12, outline: "none" };
        return (
          <div style={{ background: C.panel, border: `1px solid ${C.line}` }} className="rounded-xl p-4 mb-3">
            <div className="flex items-center gap-3 flex-wrap">
              <div style={{ color: C.aether500, fontFamily: MONO, letterSpacing: "0.14em" }} className="fs-9 uppercase shrink-0">// Meta del mes</div>
              <input type="number" value={meta || ""} placeholder="ej. 10000"
                onChange={(e) => commit({ ...data, siemon: { ...data.siemon, metas: { ...metas, [mesKey]: Number(e.target.value) || 0 } } })}
                title="La meta de cobros de este mes: ponla como quieras, mes a mes."
                style={{ ...inMini, width: 110 }} />
              <div className="flex-1" style={{ background: "rgba(255,255,255,0.05)", borderRadius: 6, height: 12, minWidth: 140 }}>
                <div style={{ width: `${pct}%`, background: (pct >= 100 ? "rgba(127,184,155,0.25)" : "rgba(177,163,225,0.22)"), border: `1px solid ${pct >= 100 ? C.ok : C.aether}`, boxSizing: "border-box", height: 12, borderRadius: 6, transition: "width .4s" }} />
              </div>
              <span style={{ color: pct >= 100 ? C.ok : C.aether2, fontFamily: MONO }} className="fs-12 shrink-0">{meta > 0 ? `${money(fin.mes)} de ${money(meta)} · ${pct}%` : "define tu meta del mes"}</span>
            </div>
            {meta > 0 && falta > 0 && (
              <div className="flex items-center gap-3 flex-wrap mt-2" style={{ color: C.ash }}>
                <span className="fs-11" style={{ fontFamily: MONO }}>Faltan <b style={{ color: C.aether2 }}>{money(falta)}</b>{ticket > 0 ? <> · ≈ <b style={{ color: C.aether2 }}>{cierres}</b> cierre{cierres === 1 ? "" : "s"} a</> : null}</span>
                <label className="fs-10 inline-flex items-center gap-1" style={{ fontFamily: MONO }}>ticket
                  <input type="number" value={data.siemon.ticketPromedio || ""} placeholder="—" onChange={(e) => commit({ ...data, siemon: { ...data.siemon, ticketPromedio: Number(e.target.value) || 0 } })}
                    title="Tu ticket promedio (opcional): traduce lo que falta a nº de cierres" style={{ ...inMini, width: 80, padding: "3px 8px" }} /></label>
              </div>
            )}
          </div>
        );
      })()}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
        <Stat label="Cobrado este mes" value={money(fin.mes)} hint={(fin.delta >= 0 ? "+" : "") + fin.delta + "% vs mes anterior"} Icon={Coins} accent={fin.delta >= 0 ? C.ok : C.danger} />
        <Stat label="Por cobrar" value={money(fin.porCobrar)} hint="Pendiente + vencido" Icon={Receipt} accent={fin.porCobrar > 0 ? C.warn : undefined} />
        <Stat label="Pipeline abierto" value={money(k.pipeline)} hint={k.total + " leads en el CRM"} Icon={Target} />
        <Stat label="Conversión" value={k.conv + "%"} hint="Lead a cliente" Icon={TrendingUp} />
      </div>
      <div className="grid lg:grid-cols-2 gap-3 mb-6">
        <Card className="p-5"><ChartTitle>Top 5 clientes</ChartTitle>
          {fin.top.length === 0 ? <div style={{ color: C.ash }} className="fs-11">Aún sin cobros registrados. Crea tus facturas en Facturación y aquí verás quién te genera más.</div> : (
            <div className="flex flex-col gap-2">{fin.top.map((t, i) => { const max = fin.top[0].v || 1; return (
              <div key={i} className="flex items-center gap-2">
                <span style={{ color: C.mist, width: 150 }} className="fs-11 truncate shrink-0">{t.n}</span>
                <div className="flex-1" style={{ background: "rgba(255,255,255,0.05)", borderRadius: 5, height: 14 }}><div style={{ width: `${Math.max(5, (t.v / max) * 100)}%`, background: "rgba(177,163,225,0.22)", border: `1px solid ${C.aether}`, boxSizing: "border-box", height: "100%", borderRadius: 5 }} /></div>
                <span style={{ color: C.aether2, fontFamily: MONO, minWidth: 70 }} className="fs-11 text-right shrink-0">{money(t.v)}</span>
              </div>
            ); })}</div>
          )}
        </Card>
        <Card className="p-5"><ChartTitle>Próximas 5 actividades</ChartTitle>
          {fin.acts.length === 0 ? <div style={{ color: C.ash }} className="fs-11">Nada agendado próximamente. Revisa Seguimiento para reactivar leads.</div> : (
            <div className="flex flex-col gap-2">{fin.acts.map((a, i) => (
              <div key={i} className="flex items-center gap-2.5">
                <span style={{ background: C.aetherSoft, border: `1px solid ${C.aetherLine}`, color: C.aether2, fontFamily: MONO, minWidth: 82 }} className="px-1.5 py-0.5 rounded fs-9 text-center shrink-0">{a.f}</span>
                <span style={{ color: C.cream }} className="fs-12 truncate">{a.n}</span>
                <span style={{ color: C.ash, fontFamily: MONO }} className="fs-9 ml-auto shrink-0">{a.t} · {a.s}</span>
              </div>
            ))}</div>
          )}
        </Card>
      </div>
      <div className="grid lg:grid-cols-2 gap-3 mb-3">
        <Card className="p-5"><ChartTitle>Leads por canal de origen</ChartTitle>
          <div style={{ height: 240 }}><ResponsiveContainer width="100%" height="100%"><BarChart data={porCanal} layout="vertical" margin={{ top: 4, right: 12, left: 12, bottom: 0 }}><XAxis type="number" hide /><YAxis type="category" dataKey="canal" width={110} tick={{ fill: C.mist, fontSize: 10 }} axisLine={false} tickLine={false} /><Tooltip cursor={{ fill: C.aetherSoft }} contentStyle={chartTip} formatter={(v) => [v, "Leads"]} /><Bar dataKey="total" fill={C.aether500} fillOpacity={0.22} stroke={C.aether500} strokeWidth={1.5} radius={[0, 5, 5, 0]} barSize={15} /></BarChart></ResponsiveContainer></div>
        </Card>
        <Card className="p-5"><ChartTitle>Distribución del pipeline</ChartTitle>
          <div style={{ height: 240 }}><ResponsiveContainer width="100%" height="100%"><BarChart data={porEtapa} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}><CartesianGrid stroke={C.lineSoft} vertical={false} /><XAxis dataKey="etapa" tick={{ fill: C.ash, fontSize: 9 }} axisLine={{ stroke: C.line }} tickLine={false} interval={0} angle={-18} textAnchor="end" height={50} /><YAxis tick={{ fill: C.ash, fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} /><Tooltip cursor={{ fill: C.aetherSoft }} contentStyle={chartTip} formatter={(v) => [v, "Leads"]} /><Bar dataKey="total" radius={[5, 5, 0, 0]} barSize={26}>{porEtapa.map((e, i) => { const t = e.etapa === "Cliente" ? C.ok : e.etapa === "Perdido" ? C.danger : C.aether; return <Cell key={i} fill={t} fillOpacity={0.22} stroke={t} strokeWidth={1.5} />; })}</Bar></BarChart></ResponsiveContainer></div>
        </Card>
      </div>
      <div className="grid lg:grid-cols-2 gap-3 mb-3">
        <Card className="p-5"><ChartTitle right={<Badge tone="warn">{money(opp.costo)}</Badge>}>Costo de oportunidad</ChartTitle><OppCostChart data={opp.data} /><div style={{ color: C.ash }} className="fs-10 mt-2 leading-snug">Valor detenido (en riesgo) más el perdido: lo que cuesta no dar el siguiente paso a tiempo.</div></Card>
        <Card className="p-5"><ChartTitle right={<ProjLegend growth={proj.growth} />}>Proyección de leads</ChartTitle><ProjectionChart data={proj.data} /></Card>
      </div>
      <Card className="p-5"><ChartTitle>Curva de crecimiento · leads acumulados</ChartTitle><GrowthArea data={crecimiento} gradId="gradSiemon" /></Card>
    </div>
  );
}

/* ---------------------------- SIEMON · LEADS ---------------------------- */
function Leads({ data, open, commit, flash, openDrawer }) {
  const [q, setQ] = useState(""); const [fSource, setFSource] = useState(""); const [fFuente, setFFuente] = useState("");
  const [verNLeads, setVerNLeads] = useState(60);
  const fuentes = Array.from(new Set(data.siemon.leads.map((l) => l.fuente).filter(Boolean))).sort();
  const leads = data.siemon.leads.filter((l) => (l.name + l.email + l.company).toLowerCase().includes(q.toLowerCase()) && (!fSource || l.leadSource === fSource) && (!fFuente || l.fuente === fFuente));
  const remove = (id) => { commit({ ...data, siemon: { ...data.siemon, leads: data.siemon.leads.filter((l) => l.id !== id) } }); flash("Lead eliminado"); };
  return (
    <div className="p-5 md:p-8">
      <Header label="Objeto contacto · 34 campos" title="Leads" sub="Deduplicado por email (upsert). Cada lead guarda identidad, origen, llamada, videollamada, pipeline y suscripción." action={<AddBtn onClick={() => open({ type: "lead" })}>Nuevo lead</AddBtn>} />
      <div className="flex flex-wrap gap-2 mb-4">
        <div style={{ background: C.panel, border: `1px solid ${C.line}` }} className="flex items-center gap-2 px-3 py-2 rounded-lg"><Search size={14} color={C.ash} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar…" style={{ background: "transparent", color: C.cream }} className="fs-13 outline-none w-40" /></div>
        <select value={fSource} onChange={(e) => setFSource(e.target.value)} style={{ background: C.panel, color: C.mist, border: `1px solid ${C.line}` }} className="fs-12 rounded-lg px-3 outline-none"><option value="">Todos los orígenes</option>{LEAD_SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}</select>
        {fuentes.length > 0 && <select value={fFuente} onChange={(e) => setFFuente(e.target.value)} style={{ background: C.panel, color: C.mist, border: `1px solid ${C.line}` }} className="fs-12 rounded-lg px-3 outline-none"><option value="">Todas las fuentes (UTM)</option>{fuentes.map((s) => <option key={s} value={s}>{s}</option>)}</select>}
      </div>
      <Card className="overflow-hidden"><div className="overflow-x-auto cmd-scroll"><table className="w-full fs-12" style={{ minWidth: 1380 }}>
        <thead><tr style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase tracking-wider">{["Fecha", "Lead", "Empresa", "Teléfono", "Mensaje", "Origen", "Preferencia", "Tags", "Idioma", "Prob.", "Etapa", "Valor", ""].map((h) => <th key={h} style={{ borderBottom: `1px solid ${C.line}` }} className="text-left font-normal px-4 py-3">{h}</th>)}</tr></thead>
        <tbody>{leads.slice(0, verNLeads).map((l) => { const pref = l.contactoPreferido; const prob = l.probabilidad ?? probPorEtapa(l.status); return (
          <tr key={l.id} onClick={() => openDrawer(l.id)} style={{ borderBottom: `1px solid ${C.lineSoft}`, cursor: "pointer" }} className="group hover:brightness-125">
            <td className="px-4 py-3" style={{ color: C.ash, fontFamily: MONO, whiteSpace: "nowrap" }}>{l.createdAt || "—"}</td>
            <td className="px-4 py-3"><div style={{ fontWeight: 600 }}>{l.name || "—"}</div><div style={{ color: C.ash }} className="fs-10">{l.email || ""}</div>{l.fuente && <div style={{ color: C.aether500, fontFamily: MONO }} className="fs-9 mt-0.5">↳ {l.fuente}{l.utm_campaign ? " · " + l.utm_campaign : ""}</div>}</td>
            <td className="px-4 py-3" style={{ color: C.mist }}>{l.company || "—"}</td>
            <td className="px-4 py-3" style={{ color: C.mist, fontFamily: MONO, whiteSpace: "nowrap" }}>{l.phone || "—"}</td>
            <td className="px-4 py-3" style={{ color: C.mist, maxWidth: 240 }}><div style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{l.message || l.notasDescubrimiento || "—"}</div></td>
            <td className="px-4 py-3"><Badge tone="ash">{l.leadSource || "—"}</Badge></td>
            <td className="px-4 py-3">{pref ? <Badge tone="aether">{pref === "telefono" ? "📞 Teléfono" : pref === "correo" ? "✉ Correo" : pref}</Badge> : <span style={{ color: C.ash }}>—</span>}</td>
            <td className="px-4 py-3" style={{ maxWidth: 160 }}><div className="flex flex-wrap gap-1">{(l.tags || []).length ? l.tags.map((t) => <Badge key={t} tone="ash">{t}</Badge>) : <span style={{ color: C.ash }}>—</span>}</div></td>
            <td className="px-4 py-3"><Badge tone="ash">{(l.language || "").toUpperCase() || "—"}</Badge></td>
            <td className="px-4 py-3" style={{ fontFamily: MONO, color: prob >= 60 ? C.ok : prob >= 30 ? C.aether2 : C.ash }}>{prob}%</td>
            <td className="px-4 py-3"><Badge tone={stageTone(l.status)}>{l.status}</Badge></td>
            <td className="px-4 py-3" style={{ fontFamily: MONO, color: C.aether2 }}>{money(l.valor)}</td>
            <td className="px-4 py-3 text-right"><button onClick={(e) => { e.stopPropagation(); remove(l.id); }} style={{ color: C.ash }} className="opacity-0 group-hover:opacity-100"><Trash2 size={14} /></button></td>
          </tr>
        ); })}</tbody>
      </table>
      {leads.length > verNLeads && (
        <button onClick={() => setVerNLeads((v) => v + 60)} style={{ color: C.aether2, border: `1px solid ${C.aetherLine}` }} className="m-3 px-4 py-2 rounded-lg fs-12">Ver más ({leads.length - verNLeads} restantes)</button>
      )}
      </div></Card>
    </div>
  );
}

/* --------------------------- SIEMON · PIPELINE --------------------------- */
// al cambiar de etapa, reprograma el seguimiento acorde (días hasta el próximo paso)
const DIAS_SEGUIMIENTO = { "Nuevo lead": 1, "Llamada agendada": 0, "Descubrimiento": 2, "Videollamada": 1, "Propuesta": 3, "Cliente": 30, "Perdido": null };
// Días para agendar el seguimiento tras cambiar de etapa (post-interacción).
// Usa la configuración parametrizable de Andrea (seguimientoConfig.postEtapa) si existe,
// y si no, los valores por defecto. Así el auto-agendado respeta lo que ella configure.
export const followUpPara = (status, postEtapaCfg) => {
  const dias = (postEtapaCfg && postEtapaCfg[status] != null) ? postEtapaCfg[status] : DIAS_SEGUIMIENTO[status];
  if (dias == null) return "";
  const d = new Date(); d.setDate(d.getDate() + (Number(dias) || 0));
  return d.toISOString().slice(0, 10);
};

// probabilidad de cierre por defecto según etapa (editable por lead)
const PROB_ETAPA = { "Nuevo lead": 10, "Llamada agendada": 25, "Descubrimiento": 40, "Videollamada": 55, "Propuesta": 70, "Cliente": 100, "Perdido": 0 };
export const probPorEtapa = (status) => PROB_ETAPA[status] ?? 20;
const PRIO_COLOR = { alta: "#D08A8A", media: "#D8B673", baja: "rgba(255,255,255,0.14)" };

// Insight ejecutivo del lead con IA (se guarda en aiSummary)
function InsightIA({ lead, patch, flash }) {
  const [busy, setBusy] = useState(false);
  const MOTORI = import.meta.env.VITE_MOTOR_URL || "https://prospeccion.siemondigital.com";
  async function generar() {
    setBusy(true);
    try {
      const r = await fetch(MOTORI + "/crm/insight_lead", { method: "POST", headers: { "content-type": "application/json", Authorization: "Bearer " + getToken() }, body: JSON.stringify({ lead }) });
      const d = await r.json();
      if (d.ok && d.insight) { patch({ aiSummary: d.insight }); flash("Insight generado."); }
      else flash("No pude generar el insight.");
    } catch { flash("No pude conectar con el motor."); }
    finally { setBusy(false); }
  }
  return (
    <div className="py-2">
      <div className="flex items-center justify-between mb-1.5">
        <div style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase tracking-wide">Insight IA</div>
        <button onClick={generar} disabled={busy} style={{ color: C.aether2, border: `1px solid ${C.aetherLine}`, opacity: busy ? 0.6 : 1 }} className="inline-flex items-center gap-1 px-2 py-0.5 rounded fs-10"><Zap size={10} />{busy ? "Generando…" : (lead.aiSummary ? "Regenerar" : "Generar insight")}</button>
      </div>
      {lead.aiSummary ? <div style={{ background: C.carbon, border: `1px solid ${C.aetherLine}`, color: C.mist, whiteSpace: "pre-wrap" }} className="rounded-lg p-2.5 fs-11 leading-relaxed">{lead.aiSummary}</div>
        : <div style={{ color: C.ash }} className="fs-10">Genera un resumen ejecutivo: quién es, dónde está, riesgo y siguiente mejor acción.</div>}
    </div>
  );
}

function Pipeline({ data, commit, open, flash, openDrawer }) {
  const [showTerm, setShowTerm] = useState(false);
  const cols = showTerm ? STAGES : OPEN_STAGES;
  const _postEtapa = (data.siemon.seguimientoConfig || {}).postEtapa;
  const move = (id, status) => {
    const nf = followUpPara(status, _postEtapa);
    commit({ ...data, siemon: { ...data.siemon, leads: data.siemon.leads.map((l) => l.id === id ? { ...l, status, followUpDate: nf } : l) } });
    flash("Movido a " + status + (nf ? " · seguimiento " + nf : ""));
  };
  return (
    <div className="p-5 md:p-8">
      <Header label="Embudo comercial" title="Pipeline" action={<AddBtn onClick={() => open({ type: "lead" })}>Nueva oportunidad</AddBtn>} />
      <button onClick={() => setShowTerm((s) => !s)} style={{ color: C.ash, fontFamily: MONO, border: `1px solid ${C.line}` }} className="mb-4 fs-10 uppercase tracking-wider px-3 py-1.5 rounded-md">{showTerm ? "Ocultar cerrados" : "Mostrar cliente / perdido"}</button>
      <div className="flex gap-3 overflow-x-auto pb-4 cmd-scroll">
        {cols.map((etapa) => {
          const items = data.siemon.leads.filter((l) => l.status === etapa);
          const suma = items.reduce((s, l) => s + (l.valor || 0), 0);
          const ponderado = items.reduce((s, l) => s + (l.valor || 0) * ((l.probabilidad ?? probPorEtapa(l.status)) / 100), 0);
          return (<div key={etapa} style={{ background: C.carbon, border: `1px solid ${C.line}` }} className="rounded-xl w-64 shrink-0 flex flex-col">
            <div className="px-3.5 py-3 flex items-center justify-between" style={{ borderBottom: `1px solid ${C.lineSoft}` }}><div className="flex items-center gap-2"><span style={{ background: etapa === "Cliente" ? C.ok : etapa === "Perdido" ? C.danger : C.aether }} className="w-1.5 h-1.5 rounded-full" /><span style={{ fontWeight: 600 }} className="fs-12">{etapa}</span><span style={{ color: C.ash }} className="fs-11">{items.length}</span></div><div className="text-right"><div style={{ color: C.ash, fontFamily: MONO }} className="fs-10">{money(suma)}</div>{!["Cliente", "Perdido"].includes(etapa) && suma > 0 && <div title="Forecast: valor × probabilidad" style={{ color: C.aether500, fontFamily: MONO }} className="fs-9">≈ {money(Math.round(ponderado))}</div>}</div></div>
            <div className="p-2.5 flex flex-col gap-2.5 min-h-[80px]">
              {items.length === 0 && <div style={{ color: C.ash }} className="fs-11 text-center py-4 opacity-60">Vacío</div>}
              {items.map((l) => (<div key={l.id} style={{ background: C.panel, border: `1px solid ${C.line}`, borderLeft: `3px solid ${PRIO_COLOR[l.prioridad || "baja"]}` }} className="rounded-lg p-3 group">
                <div onClick={() => openDrawer(l.id)} style={{ cursor: "pointer" }}><div style={{ fontWeight: 600 }} className="fs-13 leading-tight">{l.company || l.name}</div><div style={{ color: C.ash }} className="fs-10 mt-0.5">{l.name}</div><div className="flex items-center gap-1.5 mt-2 flex-wrap"><Badge tone="aether">{money(l.valor)}{(l.valor || 0) <= 300 ? "/mes" : ""}</Badge><Badge tone="ash">{l.leadSource}</Badge></div></div>
                <select value={l.status} onChange={(e) => move(l.id, e.target.value)} style={{ background: C.panel2, color: C.mist, border: `1px solid ${C.line}` }} className="mt-2.5 w-full fs-11 rounded-md px-2 py-1.5 outline-none">{STAGES.map((s) => <option key={s} value={s}>Mover a: {s}</option>)}</select>
              </div>))}
            </div>
          </div>);
        })}
      </div>
    </div>
  );
}

/* --------------------------- SIEMON · CANALES --------------------------- */
function PubItem({ p, onRemove }) {
  const [abierto, setAbierto] = React.useState(false);
  const largo = (p.texto || "").length > 140;
  return (
    <div style={{ background: C.carbon, border: `1px solid ${C.line}` }} className="rounded-lg p-3">
      <div style={{ color: C.mist, ...(abierto ? {} : { display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }) }} className="fs-12 leading-snug mb-1">{p.texto}</div>
      {largo && <button onClick={() => setAbierto((v) => !v)} style={{ color: C.aether2 }} className="fs-10 mb-1.5">{abierto ? "ver menos" : "ver más"}</button>}
      <div className="flex items-center gap-1.5 flex-wrap">
        {(p.canales || []).map((c) => <Badge key={c} tone="ash">{c}</Badge>)}
        <Badge tone={p.estado === "Publicada" ? "ok" : p.estado === "Programada" ? "aether" : "warn"}>{p.estado}</Badge>
        <span style={{ color: C.ash, fontFamily: MONO }} className="fs-9 ml-auto">{p.fecha}</span>
        <button onClick={() => onRemove(p)} title="Quitar de la lista (ya no está al aire)" style={{ color: C.ash }} className="fs-10 hover:opacity-100" ><Trash2 size={12} /></button>
      </div>
    </div>
  );
}

function Canales({ data, commit, flash, open }) {
  const S = data.siemon;
  const quitarPub = (p) => { commit({ ...data, siemon: { ...S, publicaciones: (S.publicaciones || []).filter((x) => x.id !== p.id) } }); flash("Publicación quitada de la lista."); };
  const toggleConn = (canal) => { commit({ ...data, siemon: { ...S, canalesConn: { ...S.canalesConn, [canal]: !S.canalesConn[canal] } } }); flash(`${canal} ${S.canalesConn[canal] ? "desconectado" : "conectado"}`); };
  const convertir = (item) => {
    const nuevo = { id: uid(), name: item.autor, email: "", company: "", phone: item.tipo === "WhatsApp" ? item.autor : "", language: "es", message: item.mensaje, type: "contacto", leadSource: item.canal, fuente: item.canal.toLowerCase(), createdAt: today(), tags: ["Inbound"], bookingDate: "", estadoLlamada: "", zonaHoraria: "", horaCliente: "", llamadaRealizada: false, caminoPostLlamada: "", notasDescubrimiento: "", comentarioAdicional: "", videollamadaDate: "", videollamadaZoom: "", videollamadaEstado: "", videollamadaRealizada: false, presentacionUrl: "", status: "Nuevo lead", leadOwner: "Andrea", leadOwnerEmail: "andrea@siemondigital.com", outreachNotes: "Origen: " + item.canal + " (" + item.tipo + ")", followUpDate: "", qualified: false, aiSummary: "", subscribed: true, unsubscribedDate: "", unsubscribeReason: "", valor: 500 };
    commit({ ...data, siemon: { ...S, leads: [nuevo, ...S.leads], inbound: S.inbound.map((i) => i.id === item.id ? { ...i, convertido: true } : i) } });
    flash("Convertido en lead, origen: " + item.canal);
  };
  const leadsPorCanal = (canal) => S.leads.filter((l) => l.leadSource === canal).length;
  const chIcon = (id) => (CHANNELS.find((c) => c.id === id) || {}).icon || Globe;
  return (
    <div className="p-5 md:p-8">
      <Header label="Centralización omnicanal" title="Canales" sub="Conecta tus redes y WhatsApp, mide de dónde viene cada lead, recibe mensajes en un solo lugar y publica sin salir del CRM." />
      <MiniLabel>Conexiones y atribución de leads</MiniLabel>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-7">{CHANNELS.map((c) => { const on = S.canalesConn[c.id]; const Icon = c.icon; const n = leadsPorCanal(c.id); return (
        <Card key={c.id} className="p-4" style={{ opacity: on ? 1 : 0.7 }}><div className="flex items-start justify-between"><Icon size={20} color={on ? C.aether : C.ash} /><button onClick={() => toggleConn(c.id)} style={{ color: on ? C.ok : C.ash }}>{on ? <CheckCircle2 size={16} /> : <Circle size={16} />}</button></div><div style={{ fontWeight: 600 }} className="fs-13 mt-2.5">{c.id}</div><div className="flex items-center justify-between mt-1"><span style={{ color: C.ash }} className="fs-10">{on ? "Conectado" : "Sin conectar"}</span><span style={{ color: C.aether2, fontFamily: MONO }} className="fs-11">{n} leads</span></div></Card>
      ); })}</div>
      <div className="grid lg:grid-cols-2 gap-3">
        <Card className="p-5"><ChartTitle right={<Badge tone="aether">{S.inbound.filter((i) => !i.convertido).length} sin atender</Badge>}>Bandeja de entrada</ChartTitle>
          <div className="flex flex-col gap-2.5">{S.inbound.map((i) => { const Icon = chIcon(i.canal); return (
            <div key={i.id} style={{ background: C.carbon, border: `1px solid ${C.line}` }} className="rounded-lg p-3"><div className="flex items-center gap-2 mb-1.5"><Icon size={14} color={C.aether} /><span style={{ fontWeight: 600 }} className="fs-12">{i.autor}</span><Badge tone="ash">{i.tipo}</Badge><span style={{ color: C.ash, fontFamily: MONO }} className="fs-9 ml-auto">{i.fecha}</span></div><div style={{ color: C.mist }} className="fs-12 leading-snug">{i.mensaje}</div>{i.convertido ? <div style={{ color: C.ok }} className="fs-10 mt-2 flex items-center gap-1"><Check size={12} />Convertido en lead</div> : <button onClick={() => convertir(i)} style={{ color: C.aether, border: `1px solid ${C.aetherLine}` }} className="mt-2 fs-10 uppercase tracking-wide px-2.5 py-1 rounded-md">Convertir en lead</button>}</div>
          ); })}</div>
        </Card>
        <Card className="p-5"><ChartTitle right={<button onClick={() => open({ type: "publicacion" })} style={{ background: C.aether, color: C.obsidian, fontWeight: 600 }} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md fs-11"><Send size={12} />Nueva</button>}>Publicaciones</ChartTitle>
          <div className="flex flex-col gap-2.5" style={{ maxHeight: 520, overflowY: "auto" }}>{(S.publicaciones || []).map((p) => (
            <PubItem key={p.id} p={p} onRemove={quitarPub} />
          ))}</div>
        </Card>
      </div>
    </div>
  );
}

/* --------------------------- SIEMON · OFERTAS --------------------------- */
function Ofertas({ data, commit, flash }) {
  const S = data.siemon;
  const cycle = (id) => { const order = ["Activa", "Inactiva", "Proyectado"]; const o0 = S.ofertas.find((o) => o.id === id); const nuevo = order[(order.indexOf(o0?.estado) + 1) % 3]; commit({ ...data, siemon: { ...S, ofertas: S.ofertas.map((o) => o.id === id ? { ...o, estado: nuevo } : o) } }); flash("Oferta: " + nuevo); };
  const tone = (e) => e === "Activa" ? "ok" : e === "Inactiva" ? "danger" : "warn";
  const Grid = ({ items }) => (<div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">{items.map((o) => (
    <Card key={o.id} className="p-4" style={{ opacity: o.estado === "Inactiva" ? 0.6 : 1 }}><div className="flex items-start justify-between gap-2 mb-2"><div style={{ fontWeight: 600 }} className="fs-13 leading-tight">{o.nombre}</div><button onClick={() => cycle(o.id)} title="Cambiar estado" style={{ color: o.estado === "Activa" ? C.ok : o.estado === "Inactiva" ? C.ash : C.warn }}><Power size={16} /></button></div><div style={{ fontFamily: MONO, color: o.precio ? C.aether2 : C.ash }} className="fs-16 mb-3">{o.precio ? money(o.precio, o.cur) : "Por definir"}{o.recurrente && o.precio ? <span style={{ color: C.ash }} className="fs-11">/mes</span> : ""}</div><div className="flex items-center gap-1.5 flex-wrap"><Badge tone="ash">{o.tipo}</Badge><Badge tone={tone(o.estado)}>{o.estado}</Badge></div></Card>
  ))}</div>);
  return (<div className="p-5 md:p-8"><Header label="Catálogo y estado de oferta" title="Ofertas Siemon" sub="Toca el interruptor para alternar Activa, Inactiva o Proyectado. Este estado controla tu offer-state." /><MiniLabel>En operación</MiniLabel><div className="mb-7"><Grid items={S.ofertas.filter((o) => o.estado !== "Proyectado")} /></div><MiniLabel>Proyectado (roadmap)</MiniLabel><Grid items={S.ofertas.filter((o) => o.estado === "Proyectado")} /></div>);
}

/* --------------------------- SIEMON · AGENDA --------------------------- */
function Agenda({ data, commit, flash, openDrawer }) {
  const S = data.siemon;
  const setLead = (id, patch) => commit({ ...data, siemon: { ...S, leads: S.leads.map((l) => l.id === id ? { ...l, ...patch } : l) } });
  const llamadas = S.leads.filter((l) => l.bookingDate).sort((a, b) => a.bookingDate.localeCompare(b.bookingDate));
  const videos = S.leads.filter((l) => l.videollamadaDate).sort((a, b) => a.videollamadaDate.localeCompare(b.videollamadaDate));
  const bajas = S.leads.filter((l) => !l.subscribed);
  const Trigger = ({ on, onClick, children }) => (<button onClick={onClick} style={{ color: on ? C.ok : C.ash, border: `1px solid ${on ? "rgba(127,184,155,0.4)" : C.line}`, background: on ? C.okSoft : "transparent" }} className="flex items-center gap-1.5 fs-10 uppercase tracking-wide px-2 py-1 rounded-md">{on ? <CheckCircle2 size={12} /> : <Circle size={12} />}{children}</button>);
  return (
    <div className="p-5 md:p-8">
      <Header label="Citas y disparadores de automatización" title="Agenda y envíos" sub="Marcar una llamada o videollamada como realizada es lo que dispara los correos en n8n. Aquí viven esos botones." />
      <div style={{ background: C.aetherSoft, border: `1px solid ${C.aetherLine}`, color: C.mist }} className="rounded-lg px-4 py-2.5 mb-5 fs-11 flex items-center gap-2"><Zap size={14} color={C.aether} /><span><span style={{ color: C.aether, fontFamily: MONO }}>// </span>Estos campos son disparadores: al activarlos, el CRM avisa a n8n para enviar el post-llamada o el post-videollamada.</span></div>
      <div className="grid lg:grid-cols-2 gap-3 mb-3">
        <Card className="p-5"><MiniLabel>Llamadas 15 min (Cal.com)</MiniLabel><div className="flex flex-col gap-2.5">{llamadas.map((l) => (
          <div key={l.id} style={{ background: C.carbon, border: `1px solid ${C.line}` }} className="rounded-lg p-3"><div className="flex items-center justify-between"><button onClick={() => openDrawer(l.id)} style={{ fontWeight: 600, color: C.cream }} className="fs-13">{l.company || l.name}</button><span style={{ color: C.ash, fontFamily: MONO }} className="fs-10">{l.bookingDate}</span></div><div style={{ color: C.ash }} className="fs-10 mt-0.5 mb-2">{l.horaCliente} · {l.zonaHoraria}</div><Trigger on={l.llamadaRealizada} onClick={() => setLead(l.id, { llamadaRealizada: !l.llamadaRealizada, status: !l.llamadaRealizada && l.status === "Llamada agendada" ? "Descubrimiento" : l.status })}>Llamada realizada</Trigger></div>
        ))}{llamadas.length === 0 && <Empty>Sin llamadas agendadas</Empty>}</div></Card>
        <Card className="p-5"><MiniLabel>Videollamadas 30 min (Cal.com)</MiniLabel><div className="flex flex-col gap-2.5">{videos.map((l) => (
          <div key={l.id} style={{ background: C.carbon, border: `1px solid ${C.line}` }} className="rounded-lg p-3"><div className="flex items-center justify-between"><button onClick={() => openDrawer(l.id)} style={{ fontWeight: 600, color: C.cream }} className="fs-13">{l.company || l.name}</button><span style={{ color: C.ash, fontFamily: MONO }} className="fs-10">{l.videollamadaDate}</span></div><div className="flex items-center gap-1.5 my-2 flex-wrap"><Badge tone={l.videollamadaEstado === "Agendada" ? "aether" : "ash"}>{l.videollamadaEstado || "Sin estado"}</Badge>{l.videollamadaZoom && <Badge tone="ash">Zoom listo</Badge>}</div><Trigger on={l.videollamadaRealizada} onClick={() => setLead(l.id, { videollamadaRealizada: !l.videollamadaRealizada })}>Videollamada realizada</Trigger></div>
        ))}{videos.length === 0 && <Empty>Sin videollamadas agendadas</Empty>}</div></Card>
      </div>
      <Card className="p-5"><MiniLabel>Suscripción y bajas</MiniLabel>{bajas.length === 0 ? <Empty>Nadie se ha dado de baja. Todos reciben tus envíos.</Empty> : <div className="flex flex-col gap-2">{bajas.map((l) => (<div key={l.id} className="flex items-center justify-between fs-12"><span>{l.name} · {l.email}</span><Badge tone="danger">Baja</Badge></div>))}</div>}</Card>
    </div>
  );
}
function Empty({ children }) { return <div style={{ color: C.ash }} className="fs-11 text-center py-6 opacity-70">{children}</div>; }

/* ----------------------------- LEAD DRAWER ----------------------------- */
function Row({ k, v }) { return (<div className="flex gap-3 py-1.5" style={{ borderBottom: `1px solid ${C.lineSoft}` }}><div style={{ color: C.ash, fontFamily: MONO, minWidth: 132 }} className="fs-10 uppercase tracking-wide shrink-0 pt-0.5">{k}</div><div style={{ color: v ? C.cream : C.ash }} className="fs-12 leading-snug">{v || "—"}</div></div>); }
function Group({ title, children }) { return (<div className="mb-5"><div style={{ color: C.aether500, fontFamily: MONO, letterSpacing: "0.16em" }} className="fs-9 uppercase mb-2"><span style={{ color: C.aether }}>// </span>{title}</div><div>{children}</div></div>); }
function Check2({ label, on, onClick }) { return (<button onClick={onClick} style={{ background: on ? C.okSoft : C.carbon, border: `1px solid ${on ? "rgba(127,184,155,0.4)" : C.line}`, color: on ? C.ok : C.mist }} className="flex items-center gap-2.5 px-3 py-2 rounded-lg fs-12 text-left">{on ? <CheckCircle2 size={15} /> : <Circle size={15} />}{label}</button>); }
function LeadDrawer({ lead, data, commit, close, flash }) {
  const [compose, setCompose] = useState(false);
  if (!lead) return null;
  const S = data.siemon;
  const patch = (p) => commit({ ...data, siemon: { ...S, leads: S.leads.map((l) => l.id === lead.id ? { ...l, ...p } : l) } });
  // Contacto rico: si este lead vino de un prospecto, reusa su ficha (web, redes, ubicación, maps).
  const prosp = (S.prospectos || []).find((x) => lead.email && x.email && x.email.toLowerCase() === lead.email.toLowerCase());
  const pContacto = prosp || { email: lead.email, telefono: lead.phone, web: /Prospecci/i.test(lead.leadSource || "") ? lead.presentacionUrl : "" };
  return (
    <div className="fixed inset-0 z-50 flex justify-end" style={{ background: "rgba(0,0,0,0.6)" }} onClick={close}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: C.panel, borderLeft: `1px solid ${C.line}`, width: 460, maxWidth: "94vw" }} className="h-full overflow-y-auto cmd-scroll">
        <div style={{ background: C.carbon, borderBottom: `1px solid ${C.line}` }} className="px-5 py-4 flex items-start justify-between sticky top-0"><div><div style={{ color: C.aether500, fontFamily: MONO, letterSpacing: "0.16em" }} className="fs-9 uppercase"><span style={{ color: C.aether }}>// </span>Ficha de lead</div><div style={{ fontWeight: 700 }} className="fs-18 mt-1">{lead.name}</div><div style={{ color: C.ash }} className="fs-11">{lead.company}</div></div><button onClick={close} style={{ color: C.ash }}><X size={18} /></button></div>
        <div className="p-5">
          <div className="flex items-center gap-2 mb-4 flex-wrap"><Badge tone={stageTone(lead.status)}>{lead.status}</Badge><Badge tone="ash">{lead.leadSource}</Badge>{lead.qualified && <Badge tone="ok">Calificado</Badge>}</div>
          <button onClick={() => setCompose(true)} disabled={!lead.email} title={!lead.email ? "Sin email" : "Escribir correo"} style={{ background: C.aetherSoft, border: `1px solid ${C.aetherLine}`, color: C.aether2, opacity: lead.email ? 1 : 0.4 }} className="w-full flex items-center justify-center gap-2 mb-5 py-2.5 rounded-lg fs-13"><Send size={15} strokeWidth={2.2} /> Escribir correo</button>
          {compose && <EnviarCorreo lead={lead} onClose={() => setCompose(false)} flash={flash} onSent={(note) => patch({ outreachNotes: (lead.outreachNotes ? lead.outreachNotes + " | " : "") + note })} />}
          {tieneContacto(pContacto) && <Group title="Contacto"><div className="py-1.5"><ContactoIconos p={pContacto} /></div></Group>}
          <Group title="Identidad"><Row k="Email" v={lead.email} /><Row k="Empresa" v={lead.company} /><Row k="Teléfono" v={lead.phone} /><Row k="Idioma" v={lead.language === "es" ? "Español" : "Inglés"} /><Row k="Mensaje" v={lead.message} /></Group>
          <Group title="Origen"><Row k="Type" v={lead.type} /><Row k="Lead Source" v={lead.leadSource} /><Row k="Fuente (utm)" v={lead.fuente} /><Row k="Creado" v={lead.createdAt} /><Row k="Preferencia contacto" v={lead.contactoPreferido === "telefono" ? "Teléfono / llamada" : lead.contactoPreferido === "correo" ? "Correo" : lead.contactoPreferido} /><Row k="Tags" v={(lead.tags || []).join(", ")} /></Group>
          <Group title="Llamada"><Row k="Fecha reserva" v={lead.bookingDate} /><Row k="Estado" v={lead.estadoLlamada} /><Row k="Zona horaria" v={lead.zonaHoraria} /><Row k="Hora cliente" v={lead.horaCliente} /><Row k="Camino" v={lead.caminoPostLlamada} /><Row k="Notas descubrimiento" v={lead.notasDescubrimiento} /><Row k="Comentario extra" v={lead.comentarioAdicional} /></Group>
          <Group title="Videollamada"><Row k="Fecha" v={lead.videollamadaDate} /><Row k="Estado" v={lead.videollamadaEstado} /><Row k="Zoom" v={lead.videollamadaZoom} /></Group>
          <Group title="Propuesta personalizada">
            <div className="flex flex-col gap-2 py-1">
              <div><div style={{ color: C.ash, fontFamily: MONO }} className="fs-9 uppercase mb-0.5">Link de la propuesta</div>
                <div className="flex items-center gap-1.5">
                  <input style={{ background: "#101116", border: `1px solid ${C.line}`, color: C.cream, borderRadius: 8, padding: "6px 10px", width: "100%", fontSize: 12, fontFamily: MONO, outline: "none" }} value={lead.presentacionUrl || ""} onChange={(e) => commit({ ...data, siemon: { ...data.siemon, leads: data.siemon.leads.map((x) => x.id === lead.id ? { ...x, presentacionUrl: e.target.value } : x) } })} placeholder="https://siemondigital.com/proposal.html#…" />
                  {lead.presentacionUrl && <a href={lead.presentacionUrl} target="_blank" rel="noreferrer" style={{ color: C.aether2 }} className="fs-11 shrink-0">abrir</a>}
                  {lead.presentacionUrl && <button onClick={() => { try { navigator.clipboard.writeText(lead.presentacionUrl + (lead.propuestaClave ? "\nContraseña: " + lead.propuestaClave : "")); flash("Link" + (lead.propuestaClave ? " + contraseña" : "") + " copiado."); } catch {} }} style={{ color: C.ash }} className="fs-11 shrink-0">copiar</button>}
                </div></div>
              <div className="grid grid-cols-2 gap-2">
                <div><div style={{ color: C.ash, fontFamily: MONO }} className="fs-9 uppercase mb-0.5">Contraseña</div>
                  <input style={{ background: "#101116", border: `1px solid ${C.line}`, color: C.cream, borderRadius: 8, padding: "6px 10px", width: "100%", fontSize: 12, fontFamily: MONO, outline: "none" }} value={lead.propuestaClave || ""} onChange={(e) => commit({ ...data, siemon: { ...data.siemon, leads: data.siemon.leads.map((x) => x.id === lead.id ? { ...x, propuestaClave: e.target.value } : x) } })} placeholder="si la propuesta la pide" /></div>
                <div><div style={{ color: C.ash, fontFamily: MONO }} className="fs-9 uppercase mb-0.5">Fecha de envío</div>
                  <input type="date" style={{ background: "#101116", border: `1px solid ${C.line}`, color: C.cream, borderRadius: 8, padding: "6px 10px", width: "100%", fontSize: 12, outline: "none" }} value={lead.propuestaEnviada || ""} onChange={(e) => commit({ ...data, siemon: { ...data.siemon, leads: data.siemon.leads.map((x) => x.id === lead.id ? { ...x, propuestaEnviada: e.target.value } : x) } })} /></div>
              </div>
              {lead.propuestaEnviada && <div style={{ color: C.ok, fontFamily: MONO }} className="fs-10">✓ Enviada el {lead.propuestaEnviada}</div>}
            </div>
          </Group>
          <Group title="Pipeline">
            <div className="py-1.5"><div style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase tracking-wide mb-1.5">Etapa</div><select value={lead.status} onChange={(e) => patch({ status: e.target.value, followUpDate: followUpPara(e.target.value, (data.siemon.seguimientoConfig || {}).postEtapa) })} style={{ background: C.carbon, color: C.cream, border: `1px solid ${C.line}` }} className="w-full fs-12 rounded-lg px-3 py-2 outline-none">{STAGES.map((s) => <option key={s}>{s}</option>)}</select></div>
            <div className="grid grid-cols-2 gap-2 py-1.5">
              <div><div style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase tracking-wide mb-1.5">Prioridad</div>
                <select value={lead.prioridad || "media"} onChange={(e) => patch({ prioridad: e.target.value })} style={{ background: C.carbon, color: C.cream, border: `1px solid ${C.line}` }} className="w-full fs-12 rounded-lg px-3 py-2 outline-none"><option value="baja">Baja</option><option value="media">Media</option><option value="alta">Alta</option></select></div>
              <div><div style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase tracking-wide mb-1.5">Probabilidad %</div>
                <input type="number" min={0} max={100} value={lead.probabilidad ?? probPorEtapa(lead.status)} onChange={(e) => patch({ probabilidad: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })} style={{ background: C.carbon, color: C.cream, border: `1px solid ${C.line}` }} className="w-full fs-12 rounded-lg px-3 py-2 outline-none" /></div>
            </div>
            <Row k="Responsable" v={lead.leadOwner} /><Row k="Follow-up" v={lead.followUpDate} />
            <InsightIA lead={lead} patch={patch} flash={flash} />
            <div className="py-2"><div style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase tracking-wide mb-1.5">Notas de seguimiento</div><textarea value={lead.outreachNotes} onChange={(e) => patch({ outreachNotes: e.target.value })} rows={2} style={{ background: C.carbon, color: C.cream, border: `1px solid ${C.line}` }} className="w-full fs-12 rounded-lg px-3 py-2 outline-none resize-none" /></div>
          </Group>
          <Group title="Disparadores"><div className="flex flex-col gap-2 pt-1">
            <Check2 label="Llamada realizada → post-llamada" on={lead.llamadaRealizada} onClick={() => patch({ llamadaRealizada: !lead.llamadaRealizada })} />
            <Check2 label="Videollamada realizada → post-videollamada" on={lead.videollamadaRealizada} onClick={() => patch({ videollamadaRealizada: !lead.videollamadaRealizada })} />
            <Check2 label="Suscrito (puede recibir envíos)" on={lead.subscribed} onClick={() => patch({ subscribed: !lead.subscribed, unsubscribedDate: lead.subscribed ? today() : "" })} />
          </div></Group>
        </div>
      </div>
    </div>
  );
}

/* ==================== ACADEMIA · INFOPRODUCTOS Y COMUNIDAD ==================== */
function PanelAcademia({ data }) {
  const { inscripciones, miembros, ofertas } = data.academia;
  const comPrice = (ofertas.find((o) => o.tipo === "Comunidad") || {}).precio || 0;
  const k = useMemo(() => {
    const ingresos = inscripciones.reduce((s, i) => s + i.monto, 0);
    const activos = miembros.filter((m) => m.activo).length;
    return { ingresos, inscritos: inscripciones.length, activos, mrr: activos * comPrice };
  }, [inscripciones, miembros, comPrice]);
  const porMes = useMemo(() => { const m = {}; inscripciones.forEach((i) => { const key = i.fecha.slice(0, 7); m[key] = (m[key] || 0) + i.monto; }); return Object.keys(m).sort().map((key) => ({ mes: MESES[parseInt(key.slice(5, 7), 10) - 1], total: m[key] })); }, [inscripciones]);
  const porOferta = useMemo(() => { const m = {}; inscripciones.forEach((i) => { m[i.oferta] = (m[i.oferta] || 0) + i.monto; }); return Object.keys(m).map((x) => ({ nombre: x.length > 18 ? x.slice(0, 17) + "…" : x, total: m[x] })).sort((a, b) => b.total - a.total); }, [inscripciones]);
  const crecimiento = useMemo(() => { const m = {}; inscripciones.forEach((i) => { const key = i.fecha.slice(0, 7); m[key] = (m[key] || 0) + i.monto; }); return cumBy(m); }, [inscripciones]);
  const proj = useMemo(() => { const m = {}; inscripciones.forEach((i) => { const key = i.fecha.slice(0, 7); m[key] = (m[key] || 0) + i.monto; }); return proyectar(m); }, [inscripciones]);
  const opp = useMemo(() => {
    const inact = ofertas.filter((o) => !o.activo).length;
    const bajas = miembros.filter((m) => !m.activo).length;
    const mrrPerdido = bajas * comPrice;
    return { mrrPerdido, data: [{ cat: "MRR activo", val: miembros.filter((m) => m.activo).length * comPrice, tone: C.ok }, { cat: "MRR en baja", val: mrrPerdido, tone: C.danger }, { cat: "Ofertas inactivas", val: inact * 47, tone: C.warn }] };
  }, [ofertas, miembros, comPrice]);

  return (
    <div className="p-5 md:p-8">
      <Header label="Infoproductos, mentorías y comunidad" title="Panel Academia" sub="Todo integrado en un solo espacio. The Money Command se gestiona en su propio centro de mando independiente." />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Stat label="Ingresos" value={money(k.ingresos)} hint="Infoproductos y mentorías" Icon={TrendingUp} />
        <Stat label="Inscritos" value={k.inscritos} hint="Compras y matrículas" Icon={Receipt} />
        <Stat label="Comunidad" value={k.activos} hint="Miembros activos" Icon={Users} />
        <Stat label="MRR comunidad" value={money(k.mrr)} hint="Recurrente mensual" Icon={Wallet} />
      </div>
      <div className="grid lg:grid-cols-2 gap-3 mb-3">
        <Card className="p-5"><ChartTitle>Ingresos por oferta</ChartTitle><div style={{ height: 240 }}><ResponsiveContainer width="100%" height="100%"><BarChart data={porOferta} layout="vertical" margin={{ top: 4, right: 12, left: 12, bottom: 0 }}><XAxis type="number" hide /><YAxis type="category" dataKey="nombre" width={120} tick={{ fill: C.mist, fontSize: 9 }} axisLine={false} tickLine={false} /><Tooltip cursor={{ fill: C.aetherSoft }} contentStyle={chartTip} formatter={(v) => [money(v), "Ingresos"]} /><Bar dataKey="total" fill={C.aether500} fillOpacity={0.22} stroke={C.aether500} strokeWidth={1.5} radius={[0, 5, 5, 0]} barSize={16} /></BarChart></ResponsiveContainer></div></Card>
        <Card className="p-5"><ChartTitle right={<Badge tone="danger">{money(opp.mrrPerdido)}</Badge>}>Costo de oportunidad</ChartTitle><OppCostChart data={opp.data} /><div style={{ color: C.ash }} className="fs-10 mt-2 leading-snug">MRR que se va con las bajas más los ingresos que dejan las ofertas inactivas.</div></Card>
      </div>
      <div className="grid lg:grid-cols-2 gap-3 mb-3">
        <Card className="p-5"><ChartTitle right={<ProjLegend growth={proj.growth} />}>Proyección de ingresos</ChartTitle><ProjectionChart data={proj.data} fmt={(v) => money(v)} /></Card>
        <Card className="p-5"><ChartTitle>Curva de crecimiento · ingresos acumulados</ChartTitle><GrowthArea data={crecimiento} gradId="gradAcad" fmt={(v) => money(v)} /></Card>
      </div>
    </div>
  );
}
function Catalogo({ data, commit, flash, open }) {
  const A = data.academia;
  const toggle = (id) => { const o = A.ofertas.find((x) => x.id === id); commit({ ...data, academia: { ...A, ofertas: A.ofertas.map((x) => x.id === id ? { ...x, activo: !x.activo } : x) } }); flash(`${o.nombre}: ${o.activo ? "inactiva" : "activa"}`); };
  const remove = (id) => { commit({ ...data, academia: { ...A, ofertas: A.ofertas.filter((x) => x.id !== id) } }); flash("Oferta eliminada"); };
  const iconFor = (t) => t === "Infoproducto" ? BookOpen : t === "Mentoría" ? GraduationCap : Users;
  const Grid = ({ items }) => (<div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">{items.map((o) => { const Icon = iconFor(o.tipo); return (
    <Card key={o.id} className="p-4 group" style={{ opacity: o.activo ? 1 : 0.6 }}><div className="flex items-start justify-between gap-2 mb-2"><div className="flex items-center gap-2"><Icon size={16} color={C.aether} /><div style={{ fontWeight: 600 }} className="fs-13 leading-tight">{o.nombre}</div></div><button onClick={() => toggle(o.id)} style={{ color: o.activo ? C.ok : C.ash }}><Power size={16} /></button></div><div style={{ fontFamily: MONO, color: C.aether2 }} className="fs-16 mb-3">{money(o.precio, o.cur)}{o.recurrente ? <span style={{ color: C.ash }} className="fs-11">/mes</span> : ""}</div><div className="flex items-center justify-between"><div className="flex items-center gap-1.5 flex-wrap"><Badge tone="ash">{o.tipo}</Badge>{o.activo ? <Badge tone="ok">Activa</Badge> : <Badge tone="danger">Inactiva</Badge>}</div><button onClick={() => remove(o.id)} style={{ color: C.ash }} className="opacity-0 group-hover:opacity-100"><Trash2 size={13} /></button></div></Card>
  ); })}</div>);
  return (
    <div className="p-5 md:p-8">
      <Header label="Oferta integrada" title="Catálogo" sub="Infoproductos, mentorías y comunidad en un mismo lugar." action={<AddBtn onClick={() => open({ type: "oferta" })}>Nueva oferta</AddBtn>} />
      {TIPO_OFERTA.map((t) => { const items = A.ofertas.filter((o) => o.tipo === t); if (!items.length) return null; return (<div key={t} className="mb-7"><MiniLabel>{t === "Comunidad" ? "Comunidad" : t + "s"}</MiniLabel><Grid items={items} /></div>); })}
    </div>
  );
}
function Inscritos({ data, open, commit, flash }) {
  const A = data.academia;
  const remove = (id) => { commit({ ...data, academia: { ...A, inscripciones: A.inscripciones.filter((i) => i.id !== id) } }); flash("Inscripción eliminada"); };
  const rows = [...A.inscripciones].sort((a, b) => b.fecha.localeCompare(a.fecha));
  return (
    <div className="p-5 md:p-8">
      <Header label="Compras y matrículas" title="Inscritos" action={<AddBtn onClick={() => open({ type: "inscripcion" })}>Registrar inscripción</AddBtn>} />
      <Card className="overflow-hidden"><div className="overflow-x-auto cmd-scroll"><table className="w-full fs-12" style={{ minWidth: 620 }}>
        <thead><tr style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase tracking-wider">{["Fecha", "Alumno", "Oferta", "Origen", "Monto", ""].map((h) => <th key={h} style={{ borderBottom: `1px solid ${C.line}` }} className="text-left font-normal px-4 py-3">{h}</th>)}</tr></thead>
        <tbody>{rows.map((i) => (<tr key={i.id} style={{ borderBottom: `1px solid ${C.lineSoft}` }} className="group">
          <td className="px-4 py-3" style={{ fontFamily: MONO, color: C.ash }}>{i.fecha}</td><td className="px-4 py-3" style={{ fontWeight: 600 }}>{i.alumno}</td><td className="px-4 py-3" style={{ color: C.mist }}>{i.oferta}</td><td className="px-4 py-3"><Badge tone="ash">{i.canal}</Badge></td><td className="px-4 py-3" style={{ fontFamily: MONO, color: C.aether2 }}>{money(i.monto, i.cur)}</td><td className="px-4 py-3 text-right"><button onClick={() => remove(i.id)} style={{ color: C.ash }} className="opacity-0 group-hover:opacity-100"><Trash2 size={14} /></button></td>
        </tr>))}</tbody>
      </table></div></Card>
    </div>
  );
}
function Comunidad({ data, open, commit, flash }) {
  const A = data.academia;
  const comPrice = (A.ofertas.find((o) => o.tipo === "Comunidad") || {}).precio || 0;
  const toggle = (id) => commit({ ...data, academia: { ...A, miembros: A.miembros.map((m) => m.id === id ? { ...m, activo: !m.activo } : m) } });
  const remove = (id) => { commit({ ...data, academia: { ...A, miembros: A.miembros.filter((m) => m.id !== id) } }); flash("Miembro eliminado"); };
  const activos = A.miembros.filter((m) => m.activo).length;
  return (
    <div className="p-5 md:p-8">
      <Header label="Membresía recurrente" title="Comunidad" sub={`${activos} miembros activos · MRR ${money(activos * comPrice)}`} action={<AddBtn onClick={() => open({ type: "miembro" })}>Nuevo miembro</AddBtn>} />
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">{A.miembros.map((m) => (
        <Card key={m.id} className="p-4 group" style={{ opacity: m.activo ? 1 : 0.6 }}><div className="flex items-start justify-between"><div><div style={{ fontWeight: 600 }} className="fs-14">{m.nombre}</div><div style={{ color: C.ash }} className="fs-11 mt-0.5">{m.email}</div></div><button onClick={() => remove(m.id)} style={{ color: C.ash }} className="opacity-0 group-hover:opacity-100"><Trash2 size={14} /></button></div><div className="flex items-center justify-between mt-3"><div className="flex items-center gap-1.5"><Badge tone="ash">{m.plan}</Badge>{m.activo ? <Badge tone="ok">Activo</Badge> : <Badge tone="danger">Baja</Badge>}</div><button onClick={() => toggle(m.id)} style={{ color: m.activo ? C.ok : C.ash }}><Power size={15} /></button></div><div style={{ color: C.ash, fontFamily: MONO }} className="fs-9 mt-2">Desde {m.desde}</div></Card>
      ))}</div>
    </div>
  );
}

/* ------------------------------- MODAL ------------------------------- */
function Field({ label, children }) { return <label className="block mb-3"><span style={{ color: C.ash, fontFamily: MONO, letterSpacing: "0.1em" }} className="fs-9 uppercase block mb-1.5">{label}</span>{children}</label>; }
const inS = { background: C.carbon, color: C.cream, border: `1px solid ${C.line}` };
const inC = "w-full fs-13 rounded-lg px-3 py-2 outline-none";
function Modal({ modal, data, commit, close, flash }) {
  const { type } = modal;
  const [f, setF] = useState(() => {
    if (type === "lead") return { name: "", email: "", company: "", phone: "", language: "es", message: "", type: "contacto", leadSource: "", fuente: "", status: "Nuevo lead", valor: 500, tags: "", perfilUrl: "", seguidores: "", web: "", nicho: "", ubicacion: "", relacion: "", notas: "" };
    if (type === "publicacion") return { texto: "", canales: [], estado: "Borrador", fecha: today() };
    if (type === "oferta") return { nombre: "", tipo: "Infoproducto", precio: 47, cur: "USD", recurrente: false, activo: true };
    if (type === "inscripcion") return { fecha: today(), oferta: data.academia.ofertas[0]?.nombre || "", alumno: "", monto: 47, cur: "USD", canal: "Instagram" };
    if (type === "miembro") return { nombre: "", email: "", plan: "Mensual", desde: today(), activo: true };
    return {};
  });
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const toggleCanal = (c) => setF((s) => ({ ...s, canales: s.canales.includes(c) ? s.canales.filter((x) => x !== c) : [...s.canales, c] }));
  const save = () => {
    if (type === "lead") {
      const esCreador = TIPOS_CREADOR.includes(f.type);
      if (!f.email.trim() && !(esCreador && f.perfilUrl.trim())) return flash(esCreador ? "Pon el email o la URL del perfil/canal" : "El email es la clave única del lead");
      const S = data.siemon;
      const exist = f.email.trim() ? S.leads.find((l) => (l.email || "").toLowerCase() === f.email.trim().toLowerCase())
        : S.leads.find((l) => l.perfilUrl && l.perfilUrl === f.perfilUrl.trim());
      const base = { ...f, leadSource: f.leadSource || "Manual", tags: f.tags ? f.tags.split(",").map((t) => t.trim()) : [], valor: Number(f.valor), seguidores: f.seguidores ? Number(f.seguidores) : "" };
      // canal de origen nuevo se aprende en el MISMO commit
      const ops = { ...(S.opciones || {}) };
      if (f.leadSource && !LEAD_SOURCES.includes(f.leadSource) && !(ops.canalProspecto || []).includes(f.leadSource)) {
        ops.canalProspecto = [...(ops.canalProspecto || []), f.leadSource];
      }
      if (exist) { commit({ ...data, siemon: { ...S, opciones: ops, leads: S.leads.map((l) => l.id === exist.id ? { ...l, ...base } : l) } }); flash("Lead actualizado (upsert)"); }
      else { const nuevo = { id: uid(), createdAt: today(), estadoLlamada: "", zonaHoraria: "", horaCliente: "", bookingDate: "", llamadaRealizada: false, caminoPostLlamada: "", notasDescubrimiento: "", comentarioAdicional: "", videollamadaDate: "", videollamadaZoom: "", videollamadaEstado: "", videollamadaRealizada: false, presentacionUrl: "", leadOwner: "Andrea", leadOwnerEmail: "andrea@siemondigital.com", outreachNotes: "", followUpDate: "", qualified: false, aiSummary: "", subscribed: true, unsubscribedDate: "", unsubscribeReason: "", ...base }; commit({ ...data, siemon: { ...S, opciones: ops, leads: [nuevo, ...S.leads] } }); flash(esCreador ? "Creador agregado a leads" : "Lead creado"); }
    }
    if (type === "publicacion") { if (!f.texto.trim() || f.canales.length === 0) return flash("Escribe el texto y elige un canal"); commit({ ...data, siemon: { ...data.siemon, publicaciones: [{ ...f, id: uid() }, ...data.siemon.publicaciones] } }); flash("Publicación guardada"); }
    if (type === "oferta") { if (!f.nombre.trim()) return flash("Falta el nombre"); commit({ ...data, academia: { ...data.academia, ofertas: [...data.academia.ofertas, { ...f, id: uid(), precio: Number(f.precio), recurrente: f.tipo === "Comunidad" }] } }); flash("Oferta creada"); }
    if (type === "inscripcion") { if (!f.alumno.trim()) return flash("Falta el alumno"); commit({ ...data, academia: { ...data.academia, inscripciones: [...data.academia.inscripciones, { ...f, id: uid(), monto: Number(f.monto) }] } }); flash("Inscripción registrada"); }
    if (type === "miembro") { if (!f.nombre.trim()) return flash("Falta el nombre"); commit({ ...data, academia: { ...data.academia, miembros: [...data.academia.miembros, { ...f, id: uid() }] } }); flash("Miembro agregado"); }
    close();
  };
  const titles = { lead: "Nuevo lead", publicacion: "Nueva publicación", oferta: "Nueva oferta", inscripcion: "Registrar inscripción", miembro: "Nuevo miembro" };
  const ofSel = data.academia.ofertas;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)" }} onClick={close}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: C.panel, border: `1px solid ${C.line}` }} className="rounded-xl w-full max-w-md max-h-[88vh] overflow-y-auto cmd-scroll">
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${C.lineSoft}` }}><div><div style={{ color: C.aether500, fontFamily: MONO, letterSpacing: "0.16em" }} className="fs-9 uppercase"><span style={{ color: C.aether }}>// </span>Nuevo registro</div><div style={{ fontWeight: 600 }} className="fs-16 mt-0.5">{titles[type]}</div></div><button onClick={close} style={{ color: C.ash }}><X size={18} /></button></div>
        <div className="p-5">
          {type === "lead" && (<>
            <div className="grid grid-cols-2 gap-3"><Field label="Nombre"><input value={f.name} onChange={(e) => set("name", e.target.value)} style={inS} className={inC} /></Field><Field label={TIPOS_CREADOR.includes(f.type) ? "Email (opcional si hay perfil)" : "Email (clave)"}><input value={f.email} onChange={(e) => set("email", e.target.value)} style={inS} className={inC} /></Field></div>
            <div className="grid grid-cols-2 gap-3"><Field label="Empresa"><input value={f.company} onChange={(e) => set("company", e.target.value)} style={inS} className={inC} /></Field><Field label="Teléfono"><input value={f.phone} onChange={(e) => set("phone", e.target.value)} style={inS} className={inC} /></Field></div>
            <div className="grid grid-cols-3 gap-3"><Field label="Idioma"><select value={f.language} onChange={(e) => set("language", e.target.value)} style={inS} className={inC}><option value="es">ES</option><option value="en">EN</option></select></Field><Field label="Type"><select value={f.type} onChange={(e) => set("type", e.target.value)} style={inS} className={inC}>{TYPES.map((t) => <option key={t}>{t}</option>)}</select></Field><Field label="Valor"><input type="number" value={f.valor} onChange={(e) => set("valor", e.target.value)} style={inS} className={inC} /></Field></div>
            <div className="grid grid-cols-2 gap-3"><Field label="Origen (elige o escribe el tuyo)"><Combo listaId="dl-leadsource" style={inS} className={inC} value={f.leadSource} onChange={(v) => set("leadSource", v)} opciones={opcionesDe(data, "canalProspecto", LEAD_SOURCES)} placeholder="elige de la lista o escribe el tuyo" /></Field><Field label="Fuente (utm_source)"><input value={f.fuente} onChange={(e) => set("fuente", e.target.value)} style={inS} className={inC} placeholder="ig_reels…" /></Field></div>
            <div className="grid grid-cols-2 gap-3"><Field label="Página web"><input value={f.web} onChange={(e) => set("web", e.target.value)} style={inS} className={inC} placeholder="https://sunegocio.com" /></Field><Field label="Perfil / red / canal (URL)"><input value={f.perfilUrl} onChange={(e) => set("perfilUrl", e.target.value)} style={inS} className={inC} placeholder="https://youtube.com/@… o instagram.com/…" /></Field></div>
            <div className="grid grid-cols-3 gap-3"><Field label="Nicho"><input value={f.nicho} onChange={(e) => set("nicho", e.target.value)} style={inS} className={inC} placeholder="ej. finanzas personales" /></Field><Field label="Seguidores / subs"><input type="number" value={f.seguidores} onChange={(e) => set("seguidores", e.target.value)} style={inS} className={inC} placeholder="25000" /></Field><Field label="Ubicación"><input value={f.ubicacion} onChange={(e) => set("ubicacion", e.target.value)} style={inS} className={inC} placeholder="ej. Bogotá" /></Field></div>
            <div className="grid grid-cols-2 gap-3"><Field label="Relación con infoproductos"><select value={f.relacion} onChange={(e) => set("relacion", e.target.value)} style={inS} className={inC}><option value="">Ninguna (servicio)</option><option value="cliente">Cliente de infoproducto</option><option value="embajador">Embajador</option><option value="cliente+embajador">Cliente y embajador</option></select></Field><Field label="Notas"><input value={f.notas} onChange={(e) => set("notas", e.target.value)} style={inS} className={inC} placeholder="lo que quieras recordar" /></Field></div>
            <div className="grid grid-cols-2 gap-3"><Field label="Etapa"><select value={f.status} onChange={(e) => set("status", e.target.value)} style={inS} className={inC}>{STAGES.map((s) => <option key={s}>{s}</option>)}</select></Field><Field label="Tags (coma)"><input value={f.tags} onChange={(e) => set("tags", e.target.value)} style={inS} className={inC} /></Field></div>
            <Field label="Mensaje / objetivo"><textarea value={f.message} onChange={(e) => set("message", e.target.value)} rows={2} style={inS} className={inC + " resize-none"} /></Field>
          </>)}
          {type === "publicacion" && (<>
            <Field label="Contenido"><textarea value={f.texto} onChange={(e) => set("texto", e.target.value)} rows={3} style={inS} className={inC + " resize-none"} placeholder="Escribe tu publicación…" /></Field>
            <Field label="Canales"><div className="flex flex-wrap gap-2">{CHANNELS.map((c) => { const on = f.canales.includes(c.id); const Icon = c.icon; return <button key={c.id} onClick={() => toggleCanal(c.id)} style={{ background: on ? C.aetherSoft : C.carbon, border: `1px solid ${on ? C.aetherLine : C.line}`, color: on ? C.aether2 : C.mist }} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md fs-11"><Icon size={13} />{c.id}</button>; })}</div></Field>
            <Field label="Estado"><select value={f.estado} onChange={(e) => set("estado", e.target.value)} style={inS} className={inC}><option>Borrador</option><option>Programada</option><option>Publicada</option></select></Field>
            {f.estado !== "Borrador" && <Field label="Fecha"><input type="date" value={f.fecha} onChange={(e) => set("fecha", e.target.value)} style={inS} className={inC} /></Field>}
          </>)}
          {type === "oferta" && (<>
            <Field label="Nombre"><input value={f.nombre} onChange={(e) => set("nombre", e.target.value)} style={inS} className={inC} /></Field>
            <div className="grid grid-cols-2 gap-3"><Field label="Tipo"><select value={f.tipo} onChange={(e) => set("tipo", e.target.value)} style={inS} className={inC}>{TIPO_OFERTA.map((t) => <option key={t}>{t}</option>)}</select></Field><Field label="Precio (USD)"><input type="number" value={f.precio} onChange={(e) => set("precio", e.target.value)} style={inS} className={inC} /></Field></div>
            <div style={{ color: C.ash }} className="fs-10">La Comunidad se cobra de forma recurrente (/mes) automáticamente.</div>
          </>)}
          {type === "inscripcion" && (<>
            <Field label="Oferta"><select value={f.oferta} onChange={(e) => { const o = ofSel.find((x) => x.nombre === e.target.value); set("oferta", e.target.value); if (o) set("monto", o.precio); }} style={inS} className={inC}>{ofSel.map((o) => <option key={o.id}>{o.nombre}</option>)}</select></Field>
            <div className="grid grid-cols-2 gap-3"><Field label="Alumno"><input value={f.alumno} onChange={(e) => set("alumno", e.target.value)} style={inS} className={inC} /></Field><Field label="Fecha"><input type="date" value={f.fecha} onChange={(e) => set("fecha", e.target.value)} style={inS} className={inC} /></Field></div>
            <div className="grid grid-cols-2 gap-3"><Field label="Monto (USD)"><input type="number" value={f.monto} onChange={(e) => set("monto", e.target.value)} style={inS} className={inC} /></Field><Field label="Origen"><select value={f.canal} onChange={(e) => set("canal", e.target.value)} style={inS} className={inC}>{["Instagram", "YouTube", "LinkedIn", "Facebook", "TikTok", "WhatsApp", "Referido", "Web"].map((o) => <option key={o}>{o}</option>)}</select></Field></div>
          </>)}
          {type === "miembro" && (<>
            <Field label="Nombre"><input value={f.nombre} onChange={(e) => set("nombre", e.target.value)} style={inS} className={inC} /></Field>
            <Field label="Email"><input value={f.email} onChange={(e) => set("email", e.target.value)} style={inS} className={inC} /></Field>
            <div className="grid grid-cols-2 gap-3"><Field label="Plan"><select value={f.plan} onChange={(e) => set("plan", e.target.value)} style={inS} className={inC}><option>Mensual</option><option>Anual</option></select></Field><Field label="Desde"><input type="date" value={f.desde} onChange={(e) => set("desde", e.target.value)} style={inS} className={inC} /></Field></div>
          </>)}
          <button onClick={save} style={{ background: C.aether, color: C.obsidian, fontWeight: 600 }} className="w-full mt-2 py-2.5 rounded-lg fs-13 flex items-center justify-center gap-2"><Check size={16} strokeWidth={2.4} /> Guardar</button>
        </div>
      </div>
    </div>
  );
}
