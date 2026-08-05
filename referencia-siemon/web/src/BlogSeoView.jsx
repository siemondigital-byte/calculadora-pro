import React, { useState } from "react";
import { FileText, Search, Sparkles, Copy, Trash2, ChevronDown, ChevronRight, Check, AlertTriangle, ArrowRight } from "lucide-react";
import { getToken } from "./db";
import Combo, { opcionesDe, guardarOpcion } from "./Combo.jsx";
import { insightsMercado } from "./MercadoView.jsx";
import SelectorMedia from "./SelectorMedia.jsx";

const C = {
  obsidian: "#0A0B0D", panel: "#16171C", carbon: "#131418", line: "rgba(255,255,255,0.08)",
  aether: "#B1A3E1", aether2: "#CBC0EC", aether500: "#8474BE", aetherSoft: "rgba(177,163,225,0.14)",
  aetherLine: "rgba(177,163,225,0.30)", cream: "#E9E5DD", mist: "#C9CAD2", ash: "#8B8D98",
  ok: "#7FB89B", warn: "#D8B673", danger: "#D08A8A",
};
const SANS = "'Montserrat', system-ui, sans-serif";
const MONO = "'JetBrains Mono', ui-monospace, monospace";
const MOTOR = import.meta.env.VITE_MOTOR_URL || "https://prospeccion.siemondigital.com";
const inS = { background: "#101116", border: `1px solid ${C.line}`, color: C.cream, borderRadius: 10, padding: "9px 12px", width: "100%", fontFamily: SANS, fontSize: 13, outline: "none" };
const H = () => ({ "content-type": "application/json", Authorization: "Bearer " + getToken() });
const uid = () => (crypto?.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2, 9));
const hoy = () => new Date().toISOString().slice(0, 10);

const URLS_AUDITAR = ["https://siemondigital.com/", "https://siemondigital.com/book-call/", "https://siemondigital.com/download-guide/"];
const ESTADOS_ART = ["idea", "borrador", "listo", "pendiente_revision", "publicado"];
const nivelColor = (v) => v >= 80 ? "#7FB89B" : v >= 50 ? "#D8B673" : "#D08A8A";

// score SEO determinista del artículo (espejo de seo_score_articulo del motor)
export function seoScoreArticulo(a) {
  const kw = (a.keyword || "").toLowerCase().trim();
  const titulo = (a.h1 || a.titulo || "").toLowerCase();
  const meta = a.meta_description || "";
  const cuerpo = a.cuerpo_md || "";
  const palabras = cuerpo.split(/\s+/).filter(Boolean).length;
  const h2s = (cuerpo.match(/^##\s/gm) || []).length;
  let pts = 0;
  if (kw && titulo.includes(kw)) pts += 20;
  if (kw && meta.toLowerCase().includes(kw)) pts += 10;
  if (kw) pts += Math.min(15, (cuerpo.toLowerCase().split(kw).length - 1) * 3);
  if (meta.length >= 120 && meta.length <= 170) pts += 15; else if (meta) pts += 7;
  if (palabras >= 800 && palabras <= 1600) pts += 20; else if (palabras >= 500) pts += 10;
  pts += Math.min(15, h2s * 3);
  if (/\[[^\]]+\]\(https?:\/\//.test(cuerpo)) pts += 5;
  return Math.min(100, pts);
}

export default function BlogSeoView({ data, commit, flash }) {
  const [tab, setTab] = useState("blog");
  const articulos = data.siemon.blogArticulos || [];

  // ---- SEO ----
  const [url, setUrl] = useState("https://siemondigital.com/");
  const [comp, setComp] = useState("");
  const [kw, setKw] = useState("");
  const [busySeo, setBusySeo] = useState(false);
  const [catAbierta, setCatAbierta] = useState("");
  const audit = data.siemon.seoAudit || null;

  async function auditar() {
    setBusySeo(true); flash("Auditando… tarda 20 a 40 segundos (verifica la página real).");
    try {
      const r = await fetch(MOTOR + "/seo/auditar", { method: "POST", headers: H(), body: JSON.stringify({ url, competidor: comp, keyword: kw }) });
      const d = await r.json();
      if (!d.ok) return flash("No pude auditar: " + (d.error || ""));
      commit({ ...data, siemon: { ...data.siemon, seoAudit: { ...d, fecha: hoy(), keyword: kw } } });
      flash(`Auditoría lista: ${d.global}/100.`);
    } catch { flash("No pude conectar con el motor."); }
    finally { setBusySeo(false); }
  }

  // ---- KEYWORDS REALES (Apify) + Search Console ----
  const kwData = data.siemon.blogKeywords || null;         // {seed, pais, keywords, fuente, nota, fecha}
  const gscData = data.siemon.gscConsultas || null;        // {consultas, fecha}
  const [seedKw, setSeedKw] = useState(kwData?.seed || "");
  const [paisKw, setPaisKw] = useState((kwData?.pais && kwData.pais !== "us") ? kwData.pais : "co");
  const [busyKw, setBusyKw] = useState(false);
  const [gscTexto, setGscTexto] = useState("");
  const [gscAbierto, setGscAbierto] = useState(false);

  async function investigarKeywords(seedOverride) {
    const seed = ((typeof seedOverride === "string" ? seedOverride : "") || seedKw || temaBlog || "").trim();
    if (seed && typeof seedOverride === "string") setSeedKw(seed);
    if (!seed) return flash("Escribe un tema o keyword semilla para investigar.");
    setBusyKw(true); flash("Consultando volumen y dificultad reales… puede tardar unos segundos.");
    try {
      const r = await fetch(MOTOR + "/blog/keywords", { method: "POST", headers: H(), body: JSON.stringify({ seed, pais: paisKw }) });
      const d = await r.json();
      if (!d.ok) {
        if (d.error === "cupo_agotado") return flash("Se agotó el cupo gratuito de Apify (10/mes). Se reinicia " + (d.reset || "pronto") + ".");
        if (d.error === "sin_token") return flash("Falta configurar el token de Apify en el motor.");
        return flash("No pude consultar keywords: " + (d.error || ""));
      }
      commit({ ...data, siemon: { ...data.siemon, blogKeywords: { ...d, fecha: hoy() } } });
      guardarOpcion("temaBlog", seed);
      flash(`${d.con_volumen || 0} keywords con volumen medible (${d.fuente === "apify" ? "consulta nueva" : "guardadas"}).`);
    } catch { flash("No pude conectar con el motor."); }
    finally { setBusyKw(false); }
  }

  // ---- lista curada de keywords (editable, alimenta las ideas con prioridad) ----
  const curadas = data.siemon.blogKeywordsCuradas || [];
  const [nuevaKw, setNuevaKw] = useState("");
  const [planAbierto, setPlanAbierto] = useState(false);
  const [planTexto, setPlanTexto] = useState("");
  const [atpAbierto, setAtpAbierto] = useState(false);
  const [atpTexto, setAtpTexto] = useState("");
  function setCuradas(nuevas) { commit({ ...data, siemon: { ...data.siemon, blogKeywordsCuradas: nuevas } }); }
  function normKw(s) { return (s || "").trim().toLowerCase(); }
  function fusionarCuradas(filas, fuente, zona) {
    const idx = {}; const out = curadas.map((c) => { idx[normKw(c.keyword)] = c; return c; });
    let añadidas = 0;
    (filas || []).forEach((f) => {
      const k = normKw(f.keyword); if (!k) return;
      const z = f.pais || f.zona || zona || "";
      if (idx[k]) {  // enriquece la existente sin perder objetivo
        const c = idx[k];
        if (f.volumen != null) c.volumen = f.volumen;
        if (f.dificultad != null) c.dificultad = f.dificultad;
        if (f.competencia) c.competencia = f.competencia;
        if (f.cpc != null) c.cpc = f.cpc;
        if (z && (f.volumen != null || !c.zona)) c.zona = z;
        c.fuente = fuente || c.fuente;
      } else {
        const c = { id: uid(), keyword: f.keyword, volumen: f.volumen ?? null, dificultad: f.dificultad ?? null, competencia: f.competencia || "", cpc: f.cpc ?? null, zona: z, fuente: fuente || "manual", objetivo: false };
        out.unshift(c); idx[k] = c; añadidas++;
      }
    });
    setCuradas(out);
    return añadidas;
  }
  function addUnaCurada() {
    const k = nuevaKw.trim(); if (!k) return;
    if (curadas.some((c) => normKw(c.keyword) === normKw(k))) { setNuevaKw(""); return flash("Esa keyword ya está en tu lista."); }
    setCuradas([{ id: uid(), keyword: k, volumen: null, dificultad: null, competencia: "", cpc: null, fuente: "manual", objetivo: true }, ...curadas]);
    setNuevaKw("");
  }
  function patchCurada(id, patch) { setCuradas(curadas.map((c) => c.id === id ? { ...c, ...patch } : c)); }
  function delCurada(id) { setCuradas(curadas.filter((c) => c.id !== id)); }
  function limpiarSinDatos() {
    const antes = curadas.length;
    const quedan = curadas.filter((c) => c.objetivo || c.volumen != null || c.fuente === "manual");
    setCuradas(quedan);
    flash(`Quité ${antes - quedan.length} keywords sin volumen (dejé las ★ objetivo, las tuyas y las que tienen datos).`);
  }
  const [curando, setCurando] = useState(false);
  async function limpiar() {
    const antes = curadas.length;
    if (antes < 5) return flash("Tu lista ya está corta.");
    // Paso 1 (seguro, al instante): fuera las SIN datos. Deja objetivo, tuyas y con volumen.
    let base = curadas.filter((c) => c.objetivo || c.volumen != null || c.fuente === "manual");
    setCuradas(base);
    // Paso 2 (IA): quita lo irrelevante de las que quedan.
    setCurando(true); flash("Limpiando: quito las sin datos y luego lo irrelevante…");
    try {
      const r = await fetch(MOTOR + "/blog/curar_lista", { method: "POST", headers: H(), body: JSON.stringify({ curadas: base }) });
      const d = await r.json();
      if (d.ok) { const keep = new Set(d.keep_ids || []); base = base.filter((c) => keep.has(c.id)); setCuradas(base); }
    } catch { /* si la IA falla, al menos quedó sin las sin-datos */ }
    finally { setCurando(false); flash(`Lista depurada: de ${antes} a ${base.length} keywords relevantes y con datos.`); }
  }
  // el asistente recomienda keywords para investigar
  const [sugerencias, setSugerencias] = useState([]);
  const [busySug, setBusySug] = useState(false);
  const sugeridasRef = React.useRef([]);
  async function sugerirKeywords() {
    setBusySug(true); flash("El asistente está pensando qué keywords te conviene investigar…");
    try {
      const r = await fetch(MOTOR + "/blog/sugerir_keywords", { method: "POST", headers: H(), body: JSON.stringify({ curadas: (data.siemon.blogKeywordsCuradas || []), contexto_mercado: insightsMercado(data), evitar: sugeridasRef.current }) });
      const d = await r.json();
      if (!d.ok) return flash("No pude sugerir: " + (d.error || ""));
      const nuevas = d.sugerencias || [];
      sugeridasRef.current = [...sugeridasRef.current, ...nuevas.map((s) => s.keyword)].slice(-70);
      setSugerencias(nuevas);
      flash(`${nuevas.length} keywords recomendadas (nuevas cada vez). Añade las que te gusten y búscalas.`);
    } catch { flash("No pude conectar con el motor."); }
    finally { setBusySug(false); }
  }

  async function traerCacheUbersuggest() {
    try {
      const r = await fetch(MOTOR + "/blog/keywords_cache", { headers: H() });
      const d = await r.json();
      if (!d.ok || !(d.keywords || []).length) return flash("No hay keywords guardadas de Ubersuggest todavía.");
      const n = fusionarCuradas(d.keywords, "ubersuggest");
      flash(`${d.total} keywords ya consultadas en Ubersuggest · ${n} nuevas añadidas a tu lista.`);
    } catch { flash("No pude conectar con el motor."); }
  }

  async function importarPlanner() {
    if (!planTexto.trim()) return flash("Pega el CSV que exportaste del Keyword Planner.");
    flash("Leyendo el CSV del Keyword Planner…");
    try {
      const r = await fetch(MOTOR + "/blog/kwplanner_importar", { method: "POST", headers: H(), body: JSON.stringify({ csv: planTexto }) });
      const d = await r.json();
      if (!d.ok) return flash("No pude leer el CSV: " + (d.error || ""));
      const n = fusionarCuradas(d.keywords, "google-ads");
      setPlanTexto(""); setPlanAbierto(false);
      flash(`${d.total} keywords del Planner leídas · ${n} nuevas añadidas a tu lista.`);
    } catch { flash("No pude conectar con el motor."); }
  }

  // ---- conexión segura a la API de AnswerThePublic ----
  const [atpTokenInput, setAtpTokenInput] = useState("");
  const [secretos, setSecretos] = useState({});
  React.useEffect(() => {
    fetch(MOTOR + "/secreto/estado", { headers: H() }).then((r) => r.json()).then((d) => { if (d.ok) setSecretos(d.secretos || {}); }).catch(() => {});
  }, []);
  const [atpSeed, setAtpSeed] = useState("");
  const [atpBusy, setAtpBusy] = useState(false);
  // búsqueda ATP en lote (todas las semillas de un tirón)
  const SEMILLAS_BASE = "ventas con inteligencia artificial\nmarketing con ia\nproductividad con inteligencia artificial\nautomatización de procesos\ninteligencia artificial para empresas\nagentes de ia\nsoftware a la medida\ncómo usar la inteligencia artificial en mi empresa";
  const [loteTexto, setLoteTexto] = useState(SEMILLAS_BASE);
  const [loteAbierto, setLoteAbierto] = useState(false);
  const [loteBusy, setLoteBusy] = useState("");
  async function buscarAtpLote() {
    const seeds = loteTexto.split("\n").map((s) => s.trim()).filter(Boolean).slice(0, 20);
    if (!seeds.length) return flash("Pon al menos una semilla (una por línea).");
    let totalNuevas = 0, hechas = 0;
    for (const seed of seeds) {
      setLoteBusy(`${hechas + 1}/${seeds.length}: ${seed}`);
      try {
        const r = await fetch(MOTOR + "/blog/atp_buscar", { method: "POST", headers: H(), body: JSON.stringify({ seed, region: paisKw, provider: "gweb" }) });
        const d = await r.json();
        if (d.ok) totalNuevas += fusionarCuradas(d.preguntas, "answerthepublic", paisKw);
        else if (d.error === "sin_creditos") { flash("Se agotaron los créditos de ATP a mitad del lote."); break; }
      } catch { /* sigue con la siguiente */ }
      hechas++;
    }
    setLoteBusy("");
    flash(`Lote listo: ${hechas} semillas · ${totalNuevas} preguntas nuevas en tu lista.`);
  }
  // Search Console automático (API oficial)
  const [gscConectado, setGscConectado] = useState(false);
  const [gscBusy, setGscBusy] = useState(false);
  const [gscSitios, setGscSitios] = useState([]);   // [{sitio, permiso}]
  const [gscSitio, setGscSitio] = useState("");
  React.useEffect(() => {
    fetch(MOTOR + "/blog/gsc_estado", { headers: H() }).then((r) => r.json()).then((d) => {
      if (d.ok && d.conectado) {
        setGscConectado(true);
        fetch(MOTOR + "/blog/gsc_sitios", { headers: H() }).then((r) => r.json()).then((s) => {
          if (s.ok) {
            setGscSitios(s.sitios || []);
            const pref = (s.usables || []).find((x) => /siemondigital\.com/.test(x.sitio)) || (s.usables || [])[0] || (s.sitios || [])[0];
            if (pref) setGscSitio(pref.sitio);
          }
        }).catch(() => {});
      }
    }).catch(() => {});
  }, []);
  async function actualizarGsc() {
    setGscBusy(true); flash("Trayendo tus consultas reales de Search Console…");
    try {
      const r = await fetch(MOTOR + "/blog/gsc_actualizar", { method: "POST", headers: H(), body: JSON.stringify({ dominio: "siemondigital.com", sitio: gscSitio }) });
      const d = await r.json();
      if (!d.ok) {
        if (d.error === "no_conectado") { setGscConectado(false); return flash("Conecta Search Console primero."); }
        return flash("No pude traer las consultas: " + (d.nota || d.error || ""));
      }
      commit({ ...data, siemon: { ...data.siemon, gscConsultas: { consultas: d.consultas, fecha: d.fecha } } });
      flash(`${d.total} consultas reales traídas de Search Console (${d.sitio}).`);
    } catch { flash("No pude conectar con el motor."); }
    finally { setGscBusy(false); }
  }
  async function buscarAtpApi(seedOverride) {
    const seed = ((typeof seedOverride === "string" ? seedOverride : "") || atpSeed || seedKw || "").trim();
    if (!seed) return flash("Escribe una semilla para buscar sus preguntas.");
    setAtpBusy(true); flash("Buscando preguntas reales en AnswerThePublic… (consume 1 crédito, tarda unos segundos)");
    try {
      const r = await fetch(MOTOR + "/blog/atp_buscar", { method: "POST", headers: H(), body: JSON.stringify({ seed, region: paisKw, provider: "gweb" }) });
      const d = await r.json();
      if (!d.ok) {
        if (d.error === "sin_creditos") return flash("Se agotaron tus créditos de AnswerThePublic este mes.");
        if (d.error === "token_invalido") { setSecretos({ ...secretos, ATP_TOKEN: false }); return flash("El token no es válido. Genera y guarda uno nuevo."); }
        if (d.error === "sin_preguntas") return flash("La búsqueda se creó pero no trajo preguntas legibles. Lo reviso yo.");
        return flash("No pude buscar: " + (d.error || ""));
      }
      const n = fusionarCuradas(d.preguntas, "answerthepublic", paisKw);
      flash(`${d.total} preguntas de "${d.keyword}" ${d.fuente === "cache" ? "(guardadas, sin gastar crédito)" : "(nuevas)"} · ${n} añadidas a tu lista.`);
    } catch { flash("No pude conectar con el motor."); }
    finally { setAtpBusy(false); }
  }
  async function guardarAtpToken() {
    const v = atpTokenInput.trim();
    if (v.length < 12) return flash("Pega el token completo (empieza por atp_pk_live_…).");
    try {
      const r = await fetch(MOTOR + "/secreto/guardar", { method: "POST", headers: H(), body: JSON.stringify({ clave: "ATP_TOKEN", valor: v }) });
      const d = await r.json();
      if (!d.ok) return flash("No se guardó: " + (d.error || ""));
      setSecretos({ ...secretos, ATP_TOKEN: true }); setAtpTokenInput("");
      flash("Token de AnswerThePublic guardado y cifrado ✓. No vuelve a salir del servidor.");
    } catch { flash("No pude conectar con el motor."); }
  }

  // DataForSEO: el expansor (semilla → variantes con volumen + dificultad)
  const [dfsLoginInput, setDfsLoginInput] = useState("");
  const [dfsPassInput, setDfsPassInput] = useState("");
  const [dfsSeed, setDfsSeed] = useState("");
  const [dfsBusy, setDfsBusy] = useState(false);
  const [dfsSaldo, setDfsSaldo] = useState(null);
  const dfsConectado = !!(secretos.DATAFORSEO_LOGIN && secretos.DATAFORSEO_PASSWORD);
  React.useEffect(() => {
    if (secretos.DATAFORSEO_LOGIN && secretos.DATAFORSEO_PASSWORD) {
      fetch(MOTOR + "/blog/dfs_estado", { headers: H() }).then((r) => r.json()).then((d) => { if (d.ok) setDfsSaldo(d.saldo); }).catch(() => {});
    }
  }, [secretos.DATAFORSEO_LOGIN, secretos.DATAFORSEO_PASSWORD]);
  async function guardarDfs() {
    const lo = dfsLoginInput.trim(), pw = dfsPassInput.trim();
    if (lo.length < 5 || pw.length < 5) return flash("Pon tu usuario y clave de API de DataForSEO.");
    flash("Guardando y verificando credenciales de DataForSEO…");
    try {
      await fetch(MOTOR + "/secreto/guardar", { method: "POST", headers: H(), body: JSON.stringify({ clave: "DATAFORSEO_LOGIN", valor: lo }) });
      await fetch(MOTOR + "/secreto/guardar", { method: "POST", headers: H(), body: JSON.stringify({ clave: "DATAFORSEO_PASSWORD", valor: pw }) });
      const v = await (await fetch(MOTOR + "/blog/dfs_estado", { headers: H() })).json();
      if (!v.ok) return flash("Guardado, pero no validó: " + (v.error === "credenciales_invalidas" ? "usuario o clave incorrectos." : (v.error || "")));
      setSecretos({ ...secretos, DATAFORSEO_LOGIN: true, DATAFORSEO_PASSWORD: true });
      setDfsSaldo(v.saldo); setDfsLoginInput(""); setDfsPassInput("");
      flash(`DataForSEO conectado ✓ · saldo ${v.moneda || "$"} ${v.saldo ?? "?"}`);
    } catch { flash("No pude conectar con el motor."); }
  }
  async function buscarDfs(seedOverride) {
    const seed = ((typeof seedOverride === "string" ? seedOverride : "") || dfsSeed || "").trim();
    if (!seed) return flash("Escribe una semilla para expandir.");
    setDfsBusy(true); flash("DataForSEO: expandiendo tu semilla con volumen y dificultad…");
    try {
      const r = await fetch(MOTOR + "/blog/dfs_keywords", { method: "POST", headers: H(), body: JSON.stringify({ seed, pais: paisKw, filtrar: false }) });
      const d = await r.json();
      if (!d.ok) {
        if (d.error === "sin_saldo") return flash("Tu cuenta de DataForSEO no tiene saldo. Recárgalo en dataforseo.com.");
        if (d.error === "verificar_cuenta") return flash("DataForSEO necesita que verifiques tu cuenta primero (en app.dataforseo.com). Luego funciona.");
        if (d.error === "credenciales_invalidas") { setSecretos({ ...secretos, DATAFORSEO_LOGIN: false }); return flash("Usuario o clave incorrectos."); }
        return flash("No pude traer variantes: " + (d.error || ""));
      }
      const n = fusionarCuradas(d.keywords, "dataforseo", paisKw);
      flash(`${d.total} variantes de "${d.seed}" con volumen y dificultad · ${n} nuevas en tu lista.`);
    } catch { flash("No pude conectar con el motor."); }
    finally { setDfsBusy(false); }
  }

  // analizar por qué keywords posiciona un competidor
  const [compDom, setCompDom] = useState("");
  const [compBusy, setCompBusy] = useState(false);
  const [compRes, setCompRes] = useState(null);
  async function buscarCompetencia() {
    const dom = compDom.trim();
    if (!dom) return flash("Escribe el dominio del competidor (ej. automaxia.com).");
    setCompBusy(true); flash(`Analizando por qué keywords posiciona ${dom}…`);
    try {
      const r = await fetch(MOTOR + "/blog/dfs_competencia", { method: "POST", headers: H(), body: JSON.stringify({ dominio: dom, pais: paisKw }) });
      const d = await r.json();
      if (!d.ok) {
        if (d.error === "verificar_cuenta") return flash("Verifica tu cuenta de DataForSEO primero.");
        if (d.error === "sin_saldo") return flash("Tu cuenta de DataForSEO no tiene saldo.");
        if (d.error === "dominio_invalido") return flash(d.nota || "Dominio inválido.");
        return flash("No pude analizar: " + (d.error || ""));
      }
      setCompRes(d);
      flash(`${d.total} keywords por las que posiciona ${d.dominio}. Trae las que te sirvan a tu lista.`);
    } catch { flash("No pude conectar con el motor."); }
    finally { setCompBusy(false); }
  }

  async function importarAtp() {
    if (!atpTexto.trim()) return flash("Pega el export de AnswerThePublic.");
    flash("Leyendo las preguntas de AnswerThePublic…");
    try {
      const r = await fetch(MOTOR + "/blog/atp_importar", { method: "POST", headers: H(), body: JSON.stringify({ csv: atpTexto }) });
      const d = await r.json();
      if (!d.ok) return flash("No pude leer el archivo: " + (d.error || ""));
      const n = fusionarCuradas(d.keywords, "answerthepublic");
      setAtpTexto(""); setAtpAbierto(false);
      flash(`${d.total} preguntas leídas · ${n} nuevas añadidas a tu lista.`);
    } catch { flash("No pude conectar con el motor."); }
  }

  async function importarGsc() {
    if (!gscTexto.trim()) return flash("Pega el contenido del CSV de Search Console (pestaña Consultas).");
    flash("Leyendo el CSV de Search Console…");
    try {
      const r = await fetch(MOTOR + "/blog/gsc_importar", { method: "POST", headers: H(), body: JSON.stringify({ csv: gscTexto }) });
      const d = await r.json();
      if (!d.ok) return flash("No pude leer el CSV: " + (d.error || ""));
      commit({ ...data, siemon: { ...data.siemon, gscConsultas: { consultas: d.consultas, fecha: d.fecha } } });
      setGscTexto(""); setGscAbierto(false);
      flash(`${d.total} consultas reales importadas de Search Console.`);
    } catch { flash("No pude conectar con el motor."); }
  }

  // ---- BLOG ----
  const [temaBlog, setTemaBlog] = useState("");
  const [busyIdeas, setBusyIdeas] = useState(false);
  const [busyArt, setBusyArt] = useState("");
  const [abierto, setAbierto] = useState(() => {
    const m = (location.hash || "").match(/art=([\w-]+)/);
    return m ? m[1] : "";
  });

  function patchArts(nuevos) { commit({ ...data, siemon: { ...data.siemon, blogArticulos: nuevos } }); }
  async function generarIdeas(seedOverride) {
    const seedUse = ((typeof seedOverride === "string" ? seedOverride : "") || seedKw || temaBlog || "").trim();
    setBusyIdeas(true); flash("Generando ideas de artículos…");
    try {
      const r = await fetch(MOTOR + "/blog/ideas", { method: "POST", headers: H(), body: JSON.stringify({
        tema: temaBlog || seedUse, seed: seedUse, pais: paisKw,
        contexto_mercado: insightsMercado(data), gsc: (gscData?.consultas || []),
        curadas: (data.siemon.blogKeywordsCuradas || []) }) });
      const d = await r.json();
      if (!d.ok) return flash("No pude generar ideas: " + (d.error || ""));
      const nuevas = (d.ideas || []).map((i) => ({ ...i, id: uid(), estado: "idea", fechaPublicacion: "", creado: hoy() }));
      patchArts([...nuevas, ...articulos]);
      // guarda las keywords que trajo (si vinieron) para verlas en el panel
      if ((d.keywords || []).length) commit({ ...data, siemon: { ...data.siemon, blogArticulos: [...nuevas, ...articulos], blogKeywords: { seed: (seedKw || temaBlog), pais: paisKw, keywords: d.keywords, fuente: d.fuente_keywords, nota: d.nota_keywords, fecha: hoy() } } });
      const conKw = d.fuente_keywords === "apify" ? " (ancladas a keywords reales)" : "";
      flash(`${nuevas.length} ideas de artículo listas${conKw}. Genera el borrador de las que te gusten.`);
    } catch { flash("No pude conectar con el motor."); }
    finally { setBusyIdeas(false); }
  }
  async function generarArticulo(a) {
    setBusyArt(a.id); flash("Escribiendo el artículo… tarda ~1 minuto.");
    try {
      const r = await fetch(MOTOR + "/blog/articulo", { method: "POST", headers: H(), body: JSON.stringify({ titulo: a.titulo, keyword: a.keyword }) });
      const d = await r.json();
      if (!d.ok) return flash("No pude escribir el artículo: " + (d.error || ""));
      patchArts(articulos.map((x) => x.id === a.id ? { ...x, ...d.articulo, estado: "borrador" } : x));
      setAbierto(a.id);
      flash("Borrador listo. Revísalo, ponle fecha y quedará en el calendario.");
    } catch { flash("No pude conectar con el motor."); }
    finally { setBusyArt(""); }
  }

  // ---- acciones al clickear una keyword (desde la pestaña Palabras clave) ----
  async function accionIdeas(kw) {
    setSeedKw(kw); setTemaBlog(kw); setTab("blog");
    await generarIdeas(kw);
  }
  async function accionContenido(kw) {
    const idea = { id: uid(), titulo: kw, keyword: kw, intencion: "", angulo: "", estado: "idea", creado: hoy(), fechaPublicacion: "" };
    const base = [idea, ...articulos];
    patchArts(base); setTab("blog"); setAbierto(idea.id);
    setBusyArt(idea.id); flash("Escribiendo el artículo desde tu keyword… tarda ~1 minuto.");
    try {
      const r = await fetch(MOTOR + "/blog/articulo", { method: "POST", headers: H(), body: JSON.stringify({ titulo: kw, keyword: kw }) });
      const d = await r.json();
      if (!d.ok) return flash("No pude escribir el artículo: " + (d.error || ""));
      patchArts(base.map((x) => x.id === idea.id ? { ...x, ...d.articulo, estado: "borrador" } : x));
      flash("Borrador listo en Blog (artículos). Revísalo y ponle fecha.");
    } catch { flash("No pude conectar con el motor."); }
    finally { setBusyArt(""); }
  }
  function accionCompetencia(kw) {
    window.open("https://www.google.com/search?q=" + encodeURIComponent(kw), "_blank");
    flash("Abrí Google con esa búsqueda: ahí ves quién posiciona (tu competencia real).");
  }
  function abrirTrends(kw) {
    const geo = (paisKw || "co").toUpperCase();
    window.open("https://trends.google.com/trends/explore?geo=" + geo + "&hl=es&q=" + encodeURIComponent(kw), "_blank");
  }
  async function accionTendencia(kw) {
    if (secretos.DATAFORSEO_LOGIN && secretos.DATAFORSEO_PASSWORD) {
      flash(`Consultando la tendencia de "${kw}"…`);
      try {
        const r = await fetch(MOTOR + "/blog/dfs_trends", { method: "POST", headers: H(), body: JSON.stringify({ keyword: kw, pais: paisKw }) });
        const d = await r.json();
        if (d.ok) {
          const flecha = d.direccion === "subiendo" ? "📈 subiendo" : d.direccion === "bajando" ? "📉 bajando" : "➡️ estable";
          const aum = (d.en_aumento || []).length ? " · en aumento: " + d.en_aumento.slice(0, 3).join(", ") : "";
          return flash(`"${kw}": ${flecha}${aum}`);
        }
        if (d.error === "verificar_cuenta") { flash("Verifica tu cuenta de DataForSEO para ver tendencias con datos. Abro Google Trends…"); return abrirTrends(kw); }
      } catch { /* cae al navegador */ }
    }
    abrirTrends(kw);
    flash("Abrí Google Trends: ahí ves si el tema sube o baja.");
  }

  const [subiendo, setSubiendo] = React.useState("");
  async function subirArchivo(file) {
    const dataUrl = await new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(file); });
    const ext = (file.name.split(".").pop() || "png").toLowerCase();
    const r = await fetch(MOTOR + "/gc/subir", { method: "POST", headers: H(), body: JSON.stringify({ data: dataUrl, ext }) });
    const d = await r.json();
    if (!d.ok) throw new Error(d.error || "subida falló");
    return d.url;
  }
  function pedirArchivo(accept) {
    return new Promise((res) => {
      const inp = document.createElement("input"); inp.type = "file"; inp.accept = accept;
      inp.onchange = () => res(inp.files && inp.files[0] ? inp.files[0] : null); inp.click();
    });
  }
  const blogCfg = data.siemon.blogConfig || {};
  function setBlogCfg(patch) { commit({ ...data, siemon: { ...data.siemon, blogConfig: { ...blogCfg, ...patch } } }); }
  async function subirVideoCabecera() {
    const f = await pedirArchivo("video/*"); if (!f) return;
    setSubiendo("cab-video"); flash("Subiendo video de cabecera…");
    try { const url = await subirArchivo(f); setBlogCfg({ video: url }); flash("Video de cabecera del blog actualizado."); }
    catch (e) { flash("No pude subir: " + e.message); } finally { setSubiendo(""); }
  }
  async function subirDestacada(id) {
    const f = await pedirArchivo("image/*"); if (!f) return;
    setSubiendo(id + "-dest"); flash("Subiendo imagen destacada…");
    try { const url = await subirArchivo(f); setArt(id, { imagen: url }); flash("Imagen destacada lista."); }
    catch (e) { flash("No pude subir: " + e.message); } finally { setSubiendo(""); }
  }
  async function generarImagenIA(a, comoInsertar) {
    setSubiendo(a.id + "-ia"); flash("Generando imagen con IA… tarda ~20 segundos.");
    try {
      const r = await fetch(MOTOR + "/blog/imagen", { method: "POST", headers: H(), body: JSON.stringify({ titulo: a.h1 || a.titulo, keyword: a.keyword }) });
      const d = await r.json();
      if (!d.ok) return flash("No pude generar la imagen: " + (d.error === "sin_fal_key" ? "falta la FAL_API_KEY" : (d.error || "")));
      if (comoInsertar === "cuerpo") {
        const ta = taRefs.current[a.id]; const cur = a.cuerpo_md || "";
        const linea = `\n\n![${a.keyword || "imagen del artículo"}](${d.url})\n\n`;
        const p = ta && typeof ta.selectionStart === "number" ? ta.selectionStart : cur.length;
        setArt(a.id, { cuerpo_md: cur.slice(0, p) + linea + cur.slice(p) });
        flash("Imagen IA insertada en el artículo ✓" + (d.optimizada ? ` (optimizada, ${d.peso_kb} KB)` : ""));
      } else {
        setArt(a.id, { imagen: d.url });
        flash("Imagen de portada generada ✓" + (d.optimizada ? ` (WebP, ${d.peso_kb} KB)` : ""));
      }
    } catch { flash("No pude conectar con el motor."); }
    finally { setSubiendo(""); }
  }
  // bancos de fotos gratis (Pexels/Unsplash)
  const [fotoRes, setFotoRes] = useState(null);   // {id, fotos, sinKey}
  const [fotoBusy, setFotoBusy] = useState("");
  const [pexelsKey, setPexelsKey] = useState("");
  const [selMediaArt, setSelMediaArt] = useState(null);  // artículo con el SelectorMedia abierto
  async function buscarFotos(a) {
    if (!secretos.PEXELS_KEY && !secretos.UNSPLASH_KEY) { setFotoRes({ id: a.id, sinKey: true }); return; }
    setFotoBusy(a.id); flash("Buscando fotos reales…");
    try {
      const r = await fetch(MOTOR + "/blog/fotos", { method: "POST", headers: H(), body: JSON.stringify({ query: a.keyword || a.h1 || a.titulo }) });
      const d = await r.json();
      if (!d.ok) { if (d.error === "sin_key") return setFotoRes({ id: a.id, sinKey: true }); return flash("No pude buscar fotos: " + (d.error || "")); }
      setFotoRes({ id: a.id, fotos: d.fotos || [] });
      if (!(d.fotos || []).length) flash("No encontré fotos para ese término, prueba otra keyword.");
    } catch { flash("No pude conectar con el motor."); }
    finally { setFotoBusy(""); }
  }
  async function guardarPexels() {
    const k = pexelsKey.trim(); if (k.length < 10) return flash("Pega tu API key de Pexels.");
    try {
      const r = await fetch(MOTOR + "/secreto/guardar", { method: "POST", headers: H(), body: JSON.stringify({ clave: "PEXELS_KEY", valor: k }) });
      const d = await r.json();
      if (!d.ok) return flash("No se guardó: " + (d.error || ""));
      setSecretos({ ...secretos, PEXELS_KEY: true }); setPexelsKey(""); setFotoRes(null);
      flash("Pexels conectado ✓. Vuelve a darle a 🔎 Banco.");
    } catch { flash("No pude conectar con el motor."); }
  }

  const taRefs = React.useRef({});
  async function insertarMedia(a, tipo) {
    const f = await pedirArchivo(tipo === "video" ? "video/*" : "image/*"); if (!f) return;
    setSubiendo(a.id + "-" + tipo); flash("Subiendo " + tipo + "… espera a que confirme.");
    try {
      const url = await subirArchivo(f);
      const linea = tipo === "video" ? `\n\n@video(${url})\n\n` : `\n\n![descripción de la imagen](${url})\n\n`;
      const ta = taRefs.current[a.id];
      const cur = a.cuerpo_md || "";
      let nuevo;
      if (ta && typeof ta.selectionStart === "number") {
        const p = ta.selectionStart; nuevo = cur.slice(0, p) + linea + cur.slice(p);
      } else { nuevo = cur + linea; }
      setArt(a.id, { cuerpo_md: nuevo });
      flash(tipo === "video" ? "✓ Video insertado y guardado. Ya está en el artículo." : "✓ Imagen insertada y guardada. Ya está en el artículo.");
    } catch (e) { flash("No pude subir: " + e.message); } finally { setSubiendo(""); }
  }
  function abrirArticulo(a) {
    const slug = (a.h1 || a.titulo || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    window.open("https://siemondigital.com/blog/?p=" + slug, "_blank");
  }

  function setArt(id, patch) { patchArts(articulos.map((x) => x.id === id ? { ...x, ...patch } : x)); }
  function borrarArt(id) { patchArts(articulos.filter((x) => x.id !== id)); flash("Artículo eliminado."); }
  function copiarArt(a) {
    const t = `# ${a.h1 || a.titulo}\n\nMeta description: ${a.meta_description || ""}\nKeyword: ${a.keyword || ""}\n\n${a.cuerpo_md || ""}`;
    try { navigator.clipboard.writeText(t); flash("Artículo copiado (markdown listo para tu blog)."); } catch {}
  }

  return (
    <div className="p-5 md:p-8" style={{ maxWidth: 1100 }}>
      <div className="mb-4">
        <div style={{ color: C.aether500, fontFamily: MONO, letterSpacing: "0.2em" }} className="fs-10 uppercase mb-2"><span style={{ color: C.aether }}>// </span>Posicionamiento y contenido largo</div>
        <h1 style={{ fontWeight: 600, color: C.cream }} className="fs-24 flex items-center gap-2"><FileText size={20} color={C.aether} /> Blog y SEO</h1>
        <div style={{ color: C.ash }} className="fs-11 mt-1">Audita el SEO de tu web (y de la competencia) con verificaciones reales, y produce artículos de blog por keyword. Los artículos con fecha aparecen en el Calendario, y los "publicado" salen en siemondigital.com/blog. Cada lunes el sistema propone el artículo "listo" con mejor SEO y te llega un correo para aprobarlo: al dar OK se publica, sale la newsletter y se comenta en tus redes.</div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {[["blog", "Blog (artículos)", FileText], ["keywords", "Palabras clave", Search], ["seo", "Auditoría SEO", Search]].map(([id, label, Ico]) => (
          <button key={id} onClick={() => setTab(id)} style={{ background: tab === id ? C.aetherSoft : C.panel, border: `1px solid ${tab === id ? C.aetherLine : C.line}`, color: tab === id ? C.aether2 : C.mist }} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg fs-12"><Ico size={13} /> {label}</button>
        ))}
      </div>

      {/* BLOG */}
      {tab === "blog" && (
        <div>
          {(() => { const objs = [...(data.siemon.blogKeywordsCuradas || [])].filter((c) => c.objetivo).sort((a, b) => (b.volumen || 0) - (a.volumen || 0)); return (
          <div style={{ background: C.panel, border: `1px solid ${C.line}` }} className="rounded-xl p-4 mb-4">
            <div style={{ color: C.aether500, fontFamily: MONO, letterSpacing: "0.14em" }} className="fs-10 uppercase mb-2">// Tus artículos nacen de tus palabras clave objetivo</div>
            {objs.length > 0 ? (
              <div style={{ background: C.aetherSoft, border: `1px solid ${C.aetherLine}` }} className="rounded-lg p-2.5 mb-3">
                <div style={{ color: C.aether2 }} className="fs-11 mb-1">Generando desde tus <b>{objs.length}</b> palabras clave ★ objetivo (las más buscadas arriba):</div>
                <div className="flex flex-wrap gap-1.5">{objs.slice(0, 6).map((c, i) => <span key={i} style={{ background: "rgba(255,255,255,0.05)", border: `1px solid ${C.line}`, color: C.mist, fontFamily: MONO }} className="px-2 py-0.5 rounded fs-9">{c.keyword}{c.volumen ? ` · ${c.volumen}` : ""}</span>)}</div>
              </div>
            ) : (
              <div style={{ color: C.warn }} className="fs-10 mb-3">Aún no marcaste palabras clave ★ objetivo. Ve a la pestaña <b style={{ color: C.mist }}>Palabras clave</b>, busca preguntas reales y marca las mejores con ★ — de ahí saldrán tus artículos. (Mientras, puedes generar por tema abajo.)</div>
            )}
            <div className="flex items-center gap-2 flex-wrap">
              <Combo listaId="dl-tema-blog" style={{ ...inS, maxWidth: 380 }} value={temaBlog} onChange={setTemaBlog} opciones={opcionesDe(data, "temaBlog", ["IA y automatización para negocios de servicios", "automatizar la atención al cliente", "cuánto cuesta automatizar un negocio"])} placeholder="Tema (opcional; deja vacío para usar tus objetivo)" />
              <button onClick={generarIdeas} disabled={busyIdeas} style={{ background: C.aether, color: C.obsidian, fontWeight: 600, opacity: busyIdeas ? 0.6 : 1 }} className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg fs-12"><Sparkles size={13} /> {busyIdeas ? "Generando…" : "Generar 8 ideas"}</button>
              <span style={{ color: C.ash }} className="fs-10">{articulos.length} artículos en el plan</span>
            </div>
            <div style={{ color: C.ash }} className="fs-10 mt-2">El sistema prioriza tus ★ objetivo (más búsqueda, menos competencia) y el artículo incluye la keyword en el título, los subtítulos y el texto. Viralidad y correos también beben de estas preguntas.</div>
          </div>
          ); })()}
          {/* fin bloque generar ideas (blog) */}
        </div>
      )}

      {/* PALABRAS CLAVE */}
      {tab === "keywords" && (
        <div>
          <div style={{ background: C.panel, border: `1px solid ${C.line}` }} className="rounded-xl p-4 mb-4">
            <div style={{ color: C.aether500, fontFamily: MONO, letterSpacing: "0.14em" }} className="fs-10 uppercase mb-3">// Cómo funciona · 3 pasos</div>
            <div className="grid sm:grid-cols-3 gap-3">
              {[["1", "Investiga", "Busca preguntas reales (AnswerThePublic) o deja que el asistente te sugiera qué keywords consultar."],
                ["2", "Marca ★ objetivo", "En tu lista, marca con estrella las que más te sirvan (más búsqueda + tu voz)."],
                ["3", "Genera", "Blog, Viralidad y Correos nacen automáticamente de tus keywords ★ objetivo."]].map(([n, t, d]) => (
                <div key={n} style={{ background: C.carbon, border: `1px solid ${C.line}` }} className="rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1"><span style={{ background: C.aether, color: C.obsidian, fontWeight: 700, width: 20, height: 20, borderRadius: 20, display: "inline-flex", alignItems: "center", justifyContent: "center" }} className="fs-11">{n}</span><span style={{ color: C.cream, fontWeight: 600 }} className="fs-12">{t}</span></div>
                  <div style={{ color: C.ash }} className="fs-10">{d}</div>
                </div>
              ))}
            </div>
          </div>

          {/* PASO 1 · INVESTIGA */}
          <div style={{ background: C.panel, border: `1px solid ${C.line}` }} className="rounded-xl p-4 mb-4">
            <div style={{ color: C.aether500, fontFamily: MONO, letterSpacing: "0.14em" }} className="fs-10 uppercase mb-3">// Paso 1 · Investiga</div>
            {/* DataForSEO · el expansor con datos */}
            <div style={{ background: C.carbon, border: `1px solid ${C.line}` }} className="rounded-lg p-3 mb-3">
              <div style={{ color: C.aether2, fontFamily: MONO }} className="fs-10 uppercase mb-1">// DataForSEO · una semilla → variantes con volumen y dificultad</div>
              {dfsConectado ? (
                <div>
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span style={{ color: C.ok }} className="fs-11 inline-flex items-center gap-1"><Check size={13} /> Conectado</span>
                    {dfsSaldo != null && <span style={{ color: C.ash }} className="fs-10">saldo: ${dfsSaldo}</span>}
                    <button onClick={() => setSecretos({ ...secretos, DATAFORSEO_LOGIN: false })} style={{ color: C.ash }} className="fs-10">cambiar</button>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <input style={{ ...inS, maxWidth: 300 }} value={dfsSeed} onChange={(e) => setDfsSeed(e.target.value)} onKeyDown={(e) => e.key === "Enter" && buscarDfs()} placeholder="Una semilla (ej. automatización)" />
                    <select style={{ ...inS, width: "auto", cursor: "pointer" }} value={paisKw} onChange={(e) => setPaisKw(e.target.value)} title="País">
                      {[["co", "Colombia"], ["mx", "México"], ["es", "España"], ["ar", "Argentina"], ["us", "EE.UU."], ["pe", "Perú"], ["cl", "Chile"], ["latam", "LatAm (Méx.)"]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                    <button onClick={buscarDfs} disabled={dfsBusy} title="Toma una palabra y trae todas sus variantes con su volumen y dificultad" style={{ background: C.aether, color: C.obsidian, fontWeight: 600, opacity: dfsBusy ? 0.6 : 1 }} className="px-3 py-2 rounded-lg fs-12 inline-flex items-center gap-1.5"><Search size={13} /> {dfsBusy ? "Buscando…" : "Buscar variantes"}</button>
                    <button onClick={sugerirKeywords} disabled={busySug} style={{ color: C.aether2 }} className="fs-11 inline-flex items-center gap-1"><Sparkles size={12} /> {busySug ? "pensando…" : "recomiéndame una semilla"}</button>
                  </div>
                  <div style={{ color: C.ash }} className="fs-10 mt-1"><b style={{ color: C.mist }}>Buscar variantes</b> = metes UNA palabra (ej. "inteligencia artificial") y trae hasta 60 relacionadas con búsquedas y dificultad reales, ordenadas por volumen. Así ves qué busca la gente sobre ese tema.</div>
                  {/* Analizar competidor */}
                  <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${C.line}` }}>
                    <div style={{ color: C.aether2, fontFamily: MONO }} className="fs-10 uppercase mb-1">// Qué keywords usa la competencia para posicionarse</div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <input style={{ ...inS, maxWidth: 300 }} value={compDom} onChange={(e) => setCompDom(e.target.value)} onKeyDown={(e) => e.key === "Enter" && buscarCompetencia()} placeholder="Dominio del competidor (ej. automaxia.com)" />
                      <button onClick={buscarCompetencia} disabled={compBusy} style={{ background: C.aetherSoft, border: `1px solid ${C.aetherLine}`, color: C.aether2, fontWeight: 600, opacity: compBusy ? 0.6 : 1 }} className="px-3 py-2 rounded-lg fs-12 inline-flex items-center gap-1.5"><Search size={13} /> {compBusy ? "Analizando…" : "Analizar competidor"}</button>
                    </div>
                    {compRes && (
                      <div style={{ background: C.carbon, border: `1px solid ${C.line}` }} className="rounded-lg p-3 mt-2 overflow-x-auto">
                        <div className="flex items-center justify-between mb-2">
                          <div style={{ color: C.aether2 }} className="fs-11">Posiciona por <b>{compRes.total}</b> keywords · {compRes.dominio}</div>
                          <div className="flex items-center gap-2">
                            <button onClick={() => { const n = fusionarCuradas(compRes.keywords, "competidor", paisKw); flash(`${n} keywords del competidor añadidas a tu lista.`); }} style={{ color: C.ok }} className="fs-10">+ todas a mi lista</button>
                            <button onClick={() => setCompRes(null)} style={{ color: C.ash }} className="fs-10">cerrar</button>
                          </div>
                        </div>
                        <table className="w-full" style={{ borderCollapse: "collapse" }}>
                          <thead><tr style={{ color: C.ash, fontFamily: MONO }} className="fs-9 uppercase text-left"><th className="py-1 pr-2">Keyword</th><th className="py-1 px-2 text-right">Vol/mes</th><th className="py-1 px-2 text-right">Dif</th><th className="py-1 px-2 text-right">Su pos.</th><th className="py-1 pl-2"></th></tr></thead>
                          <tbody>
                            {compRes.keywords.slice(0, 20).map((f, i) => {
                              const dc = f.dificultad == null ? C.ash : f.dificultad <= 15 ? C.ok : f.dificultad <= 35 ? C.warn : C.danger;
                              return (
                                <tr key={i} style={{ borderTop: `1px solid ${C.line}` }}>
                                  <td className="py-1.5 pr-2 fs-12" style={{ color: C.cream }}>{f.keyword}</td>
                                  <td className="py-1.5 px-2 fs-12 text-right" style={{ color: f.volumen ? C.mist : C.ash, fontFamily: MONO }}>{f.volumen ? f.volumen.toLocaleString("es") : "—"}</td>
                                  <td className="py-1.5 px-2 fs-12 text-right" style={{ color: dc, fontFamily: MONO }}>{f.dificultad ?? "—"}</td>
                                  <td className="py-1.5 px-2 fs-12 text-right" style={{ color: C.aether2, fontFamily: MONO }}>{f.posicion ? "#" + f.posicion : "—"}</td>
                                  <td className="py-1.5 pl-2 text-right"><button onClick={() => { const n = fusionarCuradas([f], "competidor", paisKw); flash(n ? "Añadida." : "Ya estaba."); }} style={{ color: C.ok }} className="fs-10">+ lista</button></td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ color: C.ash }} className="fs-10 mb-2">Conecta tu cuenta: en DataForSEO → <b style={{ color: C.mist }}>Dashboard → API Access</b>, copia tu <b style={{ color: C.mist }}>usuario (email)</b> y tu <b style={{ color: C.mist }}>API password</b>. Se guardan cifrados y no vuelven a salir.</div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <input autoComplete="off" style={{ ...inS, maxWidth: 240 }} value={dfsLoginInput} onChange={(e) => setDfsLoginInput(e.target.value)} placeholder="usuario (email de DataForSEO)" />
                    <input type="password" autoComplete="off" style={{ ...inS, maxWidth: 240, fontFamily: MONO, fontSize: 12 }} value={dfsPassInput} onChange={(e) => setDfsPassInput(e.target.value)} placeholder="API password" />
                    <button onClick={guardarDfs} style={{ background: C.aether, color: C.obsidian, fontWeight: 600 }} className="px-3 py-2 rounded-lg fs-12">Conectar</button>
                  </div>
                </div>
              )}
            </div>
            {/* AnswerThePublic · las preguntas */}
            {secretos.ATP_TOKEN ? (
              <div>
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <span style={{ color: C.ok }} className="fs-11 inline-flex items-center gap-1"><Check size={13} /> AnswerThePublic conectado</span>
                  <button onClick={() => setSecretos({ ...secretos, ATP_TOKEN: false })} style={{ color: C.ash }} className="fs-10">cambiar token</button>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <input style={{ ...inS, maxWidth: 300 }} value={atpSeed} onChange={(e) => setAtpSeed(e.target.value)} onKeyDown={(e) => e.key === "Enter" && buscarAtpApi()} placeholder="Semilla (ej. ventas con inteligencia artificial)" />
                  <select style={{ ...inS, width: "auto", cursor: "pointer" }} value={paisKw} onChange={(e) => setPaisKw(e.target.value)} title="País de la búsqueda">
                    {[["co", "Colombia"], ["mx", "México"], ["es", "España"], ["ar", "Argentina"], ["us", "EE.UU."], ["pe", "Perú"], ["cl", "Chile"], ["latam", "LatAm (Méx.)"]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                  <button onClick={buscarAtpApi} disabled={atpBusy} style={{ background: C.aether, color: C.obsidian, fontWeight: 600, opacity: atpBusy ? 0.6 : 1 }} className="px-3 py-2 rounded-lg fs-12 inline-flex items-center gap-1.5"><Search size={13} /> {atpBusy ? "Buscando…" : "Buscar preguntas"}</button>
                  <button onClick={sugerirKeywords} disabled={busySug} style={{ background: C.aetherSoft, border: `1px solid ${C.aetherLine}`, color: C.aether2, fontWeight: 600, opacity: busySug ? 0.6 : 1 }} className="px-3 py-2 rounded-lg fs-12 inline-flex items-center gap-1.5"><Sparkles size={13} /> {busySug ? "Pensando…" : "Sugiéreme keywords"}</button>
                  <button onClick={() => setLoteAbierto((v) => !v)} style={{ color: C.aether2 }} className="fs-11">{loteAbierto ? "▾" : "▸"} buscar todas</button>
                </div>
                <div style={{ color: C.ash }} className="fs-10 mt-1">1 crédito por semilla nueva (se cachea). <b style={{ color: C.mist }}>Sugiéreme keywords</b> = el asistente te propone qué investigar según tu negocio.</div>
                {sugerencias.length > 0 && (
                  <div style={{ background: C.aetherSoft, border: `1px solid ${C.aetherLine}` }} className="rounded-lg p-3 mt-2">
                    <div className="flex items-center justify-between mb-2">
                      <div style={{ color: C.aether2, fontFamily: MONO }} className="fs-10 uppercase">// El asistente te recomienda investigar</div>
                      <button onClick={() => setSugerencias([])} style={{ color: C.ash }} className="fs-10">cerrar</button>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {sugerencias.map((s, i) => (
                        <div key={i} className="flex items-center gap-2 flex-wrap" style={{ borderTop: i ? `1px solid ${C.line}` : "none", paddingTop: i ? 6 : 0 }}>
                          <div className="min-w-0 flex-1"><span style={{ color: C.cream, fontWeight: 600 }} className="fs-12">{s.keyword}</span>{s.motivo && <span style={{ color: C.ash }} className="fs-10"> · {s.motivo}</span>}</div>
                          <button onClick={() => { const n = fusionarCuradas([{ keyword: s.keyword }], "sugerida"); flash(n ? "Añadida a tu lista." : "Ya estaba en tu lista."); }} style={{ color: C.ok }} className="fs-10 shrink-0">+ lista</button>
                          {dfsConectado && <button title="Traer variantes con volumen y dificultad (DataForSEO)" onClick={() => { setDfsSeed(s.keyword); buscarDfs(s.keyword); }} style={{ color: C.aether2 }} className="fs-10 shrink-0">variantes</button>}
                          <button title="Traer las preguntas (AnswerThePublic)" onClick={() => { setAtpSeed(s.keyword); buscarAtpApi(s.keyword); }} style={{ color: C.aether2 }} className="fs-10 shrink-0 inline-flex items-center gap-1">preguntas <ArrowRight size={10} /></button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {loteAbierto && (
                  <div className="mt-2">
                    <div style={{ color: C.ash }} className="fs-10 mb-1">Una semilla por línea. Corre todas de un tirón (cada semilla nueva = 1 crédito; las repetidas no gastan).</div>
                    <textarea style={{ ...inS, minHeight: 110, fontFamily: MONO, fontSize: 12 }} value={loteTexto} onChange={(e) => setLoteTexto(e.target.value)} />
                    <div className="flex items-center gap-2 mt-2">
                      <button onClick={buscarAtpLote} disabled={!!loteBusy} style={{ background: C.aether, color: C.obsidian, fontWeight: 600, opacity: loteBusy ? 0.6 : 1 }} className="px-3 py-2 rounded-lg fs-12">{loteBusy ? "Buscando…" : "Buscar todas"}</button>
                      {loteBusy && <span style={{ color: C.ash }} className="fs-10">{loteBusy}</span>}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div>
                <div style={{ color: C.ash }} className="fs-10 mb-2">Conecta AnswerThePublic por API (gratis con tu plan): en ATP → foto de perfil → <b style={{ color: C.mist }}>Cuenta</b> → <b style={{ color: C.mist }}>Acceso a la API</b> → <b style={{ color: C.mist }}>Crear token</b> (permisos searches y reports). Pégalo aquí: se guarda cifrado y no vuelve a salir.</div>
                <div className="flex items-center gap-2 flex-wrap">
                  <input type="password" autoComplete="off" style={{ ...inS, maxWidth: 340, fontFamily: MONO, fontSize: 12 }} value={atpTokenInput} onChange={(e) => setAtpTokenInput(e.target.value)} placeholder="atp_pk_live_…" />
                  <button onClick={guardarAtpToken} style={{ background: C.aether, color: C.obsidian, fontWeight: 600 }} className="px-3 py-2 rounded-lg fs-12">Guardar token</button>
                </div>
              </div>
            )}
            {/* más fuentes (colapsable) */}
            <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${C.line}` }}>
              <button onClick={() => setAtpAbierto((v) => !v)} style={{ color: C.aether2 }} className="fs-11 inline-flex items-center gap-1">{atpAbierto ? <ChevronDown size={13} /> : <ChevronRight size={13} />} Más fuentes · Search Console y Keyword Planner (opcional)</button>
              {atpAbierto && (
                <div className="mt-3 flex flex-col gap-3">
                  <div style={{ background: C.carbon, border: `1px solid ${C.line}` }} className="rounded-lg p-3">
                    <div style={{ color: C.aether2, fontFamily: MONO }} className="fs-10 uppercase mb-1">// Search Console · lo que ya te busca la gente</div>
                    {gscConectado ? (
                      <div className="flex items-center gap-2 flex-wrap">
                        <span style={{ color: C.ok }} className="fs-11 inline-flex items-center gap-1"><Check size={13} /> Conectado</span>
                        {gscSitios.length > 0 && (
                          <select style={{ ...inS, width: "auto", cursor: "pointer", fontSize: 12 }} value={gscSitio} onChange={(e) => setGscSitio(e.target.value)} title="Propiedad de Search Console">
                            {gscSitios.map((s) => <option key={s.sitio} value={s.sitio}>{s.sitio.replace("sc-domain:", "").replace("https://", "").replace(/\/$/, "")} {s.permiso === "siteUnverifiedUser" ? "(sin verificar)" : ""}</option>)}
                          </select>
                        )}
                        <button onClick={actualizarGsc} disabled={gscBusy || !gscSitio} style={{ background: C.aether, color: C.obsidian, fontWeight: 600, opacity: (gscBusy || !gscSitio) ? 0.6 : 1 }} className="px-3 py-1.5 rounded-lg fs-11">{gscBusy ? "Trayendo…" : "Actualizar consultas"}</button>
                        <a href={MOTOR + "/oauth/gsc/start?k=" + encodeURIComponent(getToken())} target="_blank" rel="noreferrer" style={{ color: C.ash }} className="fs-10">cambiar cuenta</a>
                      </div>
                    ) : (
                      <a href={MOTOR + "/oauth/gsc/start?k=" + encodeURIComponent(getToken())} target="_blank" rel="noreferrer" style={{ background: C.aether, color: C.obsidian, fontWeight: 600 }} className="inline-block px-3 py-1.5 rounded-lg fs-11 no-underline">Conectar Search Console</a>
                    )}
                  </div>
                  <div style={{ background: C.carbon, border: `1px solid ${C.line}` }} className="rounded-lg p-3">
                    <div style={{ color: C.aether2, fontFamily: MONO }} className="fs-10 uppercase mb-1">// Keyword Planner (Google Ads) · volúmenes</div>
                    <div style={{ color: C.ash }} className="fs-10 mb-2">En Google Ads → Planificador de palabras clave → descarga el CSV y pégalo aquí.</div>
                    <textarea style={{ ...inS, minHeight: 70, fontFamily: MONO, fontSize: 11 }} value={planTexto} onChange={(e) => setPlanTexto(e.target.value)} placeholder={"Palabra clave,Moneda,Búsquedas mensuales promedio,Competencia,...\n..."} />
                    <button onClick={importarPlanner} style={{ background: C.aetherSoft, border: `1px solid ${C.aetherLine}`, color: C.aether2, fontWeight: 600 }} className="px-3 py-1.5 rounded-lg fs-11 mt-2">Importar del Planner</button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* MI LISTA CURADA DE KEYWORDS */}
          <div style={{ background: C.panel, border: `1px solid ${C.line}` }} className="rounded-xl p-4 mb-4">
            <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
              <div style={{ color: C.aether500, fontFamily: MONO, letterSpacing: "0.14em" }} className="fs-10 uppercase">// Paso 2 · Tu lista {curadas.length ? `· ${curadas.filter((c) => c.objetivo).length} objetivo de ${curadas.length}` : ""}</div>
              {curadas.length >= 5 && (
                <button onClick={limpiar} disabled={curando} title="Quita las que no tienen datos y lo irrelevante; deja tus ★ objetivo, las tuyas y las relevantes con volumen" style={{ background: C.aetherSoft, border: `1px solid ${C.aetherLine}`, color: C.aether2, fontWeight: 600 }} className="px-3 py-1.5 rounded-lg fs-11 inline-flex items-center gap-1"><Sparkles size={12} /> {curando ? "limpiando…" : "limpiar lista"}</button>
              )}
            </div>
            <div style={{ color: C.ash }} className="fs-10 mb-2">Ordenada por volumen (las más buscadas arriba). Marca con ★ <b style={{ color: C.mist }}>objetivo</b> las que quieras: esas alimentan el blog, las ideas de viralidad y los correos. O agrega las tuyas a mano.</div>
            {planAbierto && (
              <div style={{ background: C.carbon, border: `1px solid ${C.line}` }} className="rounded-lg p-3 mb-3">
                <div style={{ color: C.ash }} className="fs-10 mb-2">En Google Ads → Herramientas → <b style={{ color: C.mist }}>Planificador de palabras clave</b> → "Descubrir nuevas palabras clave" → tras la búsqueda, botón <b style={{ color: C.mist }}>Descargar</b> → CSV. Abre el archivo, copia todo y pégalo aquí (funciona en español o inglés).</div>
                <textarea style={{ ...inS, minHeight: 90, fontFamily: MONO, fontSize: 11 }} value={planTexto} onChange={(e) => setPlanTexto(e.target.value)} placeholder={"Palabra clave,Moneda,Búsquedas mensuales promedio,Competencia,...\nautomatización de procesos,COP,720,Media,...\n..."} />
                <button onClick={importarPlanner} style={{ background: C.aetherSoft, border: `1px solid ${C.aetherLine}`, color: C.aether2, fontWeight: 600 }} className="px-3 py-1.5 rounded-lg fs-11 mt-2">Importar del Planner</button>
              </div>
            )}
            {false && (
              <div style={{ background: C.carbon, border: `1px solid ${C.line}` }} className="rounded-lg p-3 mb-3">
                {/* Conexión por API (automática) - MOVIDO al Paso 1 */}
                <div className="mb-3 pb-3" style={{ borderBottom: `1px solid ${C.line}` }}>
                  {secretos.ATP_TOKEN ? (
                    <div>
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <span style={{ color: C.ok }} className="fs-11 inline-flex items-center gap-1"><Check size={13} /> API conectada</span>
                        <button onClick={() => setSecretos({ ...secretos, ATP_TOKEN: false })} style={{ color: C.ash }} className="fs-10">cambiar token</button>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <input style={{ ...inS, maxWidth: 280 }} value={atpSeed} onChange={(e) => setAtpSeed(e.target.value)} onKeyDown={(e) => e.key === "Enter" && buscarAtpApi()} placeholder="Semilla (ej. ventas con inteligencia artificial)" />
                        <select style={{ ...inS, width: "auto", cursor: "pointer" }} value={paisKw} onChange={(e) => setPaisKw(e.target.value)} title="País de la búsqueda">
                          {[["co", "Colombia"], ["mx", "México"], ["es", "España"], ["ar", "Argentina"], ["us", "EE.UU."], ["pe", "Perú"], ["cl", "Chile"], ["latam", "LatAm (Méx.)"]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                        </select>
                        <button onClick={buscarAtpApi} disabled={atpBusy} style={{ background: C.aether, color: C.obsidian, fontWeight: 600, opacity: atpBusy ? 0.6 : 1 }} className="px-3 py-2 rounded-lg fs-12 inline-flex items-center gap-1.5"><Search size={13} /> {atpBusy ? "Buscando…" : "Buscar preguntas"}</button>
                        <button onClick={() => setLoteAbierto((v) => !v)} style={{ color: C.aether2 }} className="fs-11">{loteAbierto ? "▾" : "▸"} buscar todas mis semillas</button>
                        <button onClick={sugerirKeywords} disabled={busySug} style={{ color: C.aether2 }} className="fs-11 inline-flex items-center gap-1"><Sparkles size={12} /> {busySug ? "pensando…" : "sugiéreme keywords"}</button>
                      </div>
                      {sugerencias.length > 0 && (
                        <div style={{ background: C.aetherSoft, border: `1px solid ${C.aetherLine}` }} className="rounded-lg p-3 mt-2">
                          <div className="flex items-center justify-between mb-2">
                            <div style={{ color: C.aether2, fontFamily: MONO }} className="fs-10 uppercase">// El asistente te recomienda investigar</div>
                            <button onClick={() => setSugerencias([])} style={{ color: C.ash }} className="fs-10">cerrar</button>
                          </div>
                          <div className="flex flex-col gap-1.5">
                            {sugerencias.map((s, i) => (
                              <div key={i} className="flex items-center gap-2 flex-wrap" style={{ borderTop: i ? `1px solid ${C.line}` : "none", paddingTop: i ? 6 : 0 }}>
                                <div className="min-w-0 flex-1">
                                  <span style={{ color: C.cream, fontWeight: 600 }} className="fs-12">{s.keyword}</span>
                                  {s.motivo && <span style={{ color: C.ash }} className="fs-10"> · {s.motivo}</span>}
                                </div>
                                <button onClick={() => { const n = fusionarCuradas([{ keyword: s.keyword }], "sugerida"); flash(n ? "Añadida a tu lista." : "Ya estaba en tu lista."); }} style={{ color: C.ok }} className="fs-10 shrink-0">+ lista</button>
                                <button onClick={() => { setAtpSeed(s.keyword); buscarAtpApi(s.keyword); }} style={{ color: C.aether2 }} className="fs-10 shrink-0 inline-flex items-center gap-1">buscar <ArrowRight size={10} /></button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {loteAbierto && (
                        <div className="mt-2">
                          <div style={{ color: C.ash }} className="fs-10 mb-1">Una semilla por línea. Corre todas de un tirón (cada semilla nueva = 1 crédito; las repetidas no gastan).</div>
                          <textarea style={{ ...inS, minHeight: 110, fontFamily: MONO, fontSize: 12 }} value={loteTexto} onChange={(e) => setLoteTexto(e.target.value)} />
                          <div className="flex items-center gap-2 mt-2">
                            <button onClick={buscarAtpLote} disabled={!!loteBusy} style={{ background: C.aether, color: C.obsidian, fontWeight: 600, opacity: loteBusy ? 0.6 : 1 }} className="px-3 py-2 rounded-lg fs-12">{loteBusy ? "Buscando…" : "Buscar todas"}</button>
                            {loteBusy && <span style={{ color: C.ash }} className="fs-10">{loteBusy}</span>}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div>
                      <div style={{ color: C.aether2, fontFamily: MONO }} className="fs-10 uppercase mb-1">// Conectar por API (automático, sin CSV)</div>
                      <div style={{ color: C.ash }} className="fs-10 mb-2">En ATP → foto de perfil → <b style={{ color: C.mist }}>Cuenta</b> → <b style={{ color: C.mist }}>Acceso a la API</b> → <b style={{ color: C.mist }}>Crear token</b> (permisos searches y reports). Pégalo aquí: se guarda cifrado en el servidor y no vuelve a salir.</div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <input type="password" autoComplete="off" style={{ ...inS, maxWidth: 340, fontFamily: MONO, fontSize: 12 }} value={atpTokenInput} onChange={(e) => setAtpTokenInput(e.target.value)} placeholder="atp_pk_live_…" />
                        <button onClick={guardarAtpToken} style={{ background: C.aether, color: C.obsidian, fontWeight: 600 }} className="px-3 py-2 rounded-lg fs-12">Guardar token</button>
                      </div>
                    </div>
                  )}
                </div>
                <div style={{ color: C.ash }} className="fs-10 mb-2">O importa manual: en AnswerThePublic haz tu búsqueda → botón <b style={{ color: C.mist }}>Download</b> → <b style={{ color: C.mist }}>CSV</b>. Abre el archivo, copia todo y pégalo aquí. Trae las <b style={{ color: C.mist }}>preguntas reales</b> que la gente escribe (ideales para títulos long-tail); puede que no traigan volumen y no pasa nada.</div>
                <textarea style={{ ...inS, minHeight: 90, fontFamily: MONO, fontSize: 11 }} value={atpTexto} onChange={(e) => setAtpTexto(e.target.value)} placeholder={"keyword,volume,cpc,competition\ncómo automatizar la facturación,...\nqué es un agente de ia,...\n..."} />
                <button onClick={importarAtp} style={{ background: C.aetherSoft, border: `1px solid ${C.aetherLine}`, color: C.aether2, fontWeight: 600 }} className="px-3 py-1.5 rounded-lg fs-11 mt-2">Importar preguntas</button>
              </div>
            )}
            <div className="flex items-center gap-2 mb-2">
              <input style={{ ...inS, maxWidth: 360 }} value={nuevaKw} onChange={(e) => setNuevaKw(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addUnaCurada()} placeholder="Escribe una keyword tuya y Enter…" />
              <button onClick={addUnaCurada} style={{ background: C.aether, color: C.obsidian, fontWeight: 600 }} className="px-3 py-2 rounded-lg fs-12">+ Añadir</button>
            </div>
            {curadas.length === 0 ? (
              <div style={{ color: C.ash }} className="fs-11">Aún no has curado keywords. Trae algunas del panel de arriba o impórtalas del Planner.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full" style={{ borderCollapse: "collapse" }}>
                  <thead><tr style={{ color: C.ash, fontFamily: MONO }} className="fs-9 uppercase text-left">
                    <th className="py-1 pr-2">★</th><th className="py-1 pr-2">Keyword</th><th className="py-1 px-2 text-right">Vol/mes</th><th className="py-1 px-2 text-right">Dif</th><th className="py-1 px-2">Zona</th><th className="py-1 px-2">Fuente</th><th className="py-1 pl-2"></th>
                  </tr></thead>
                  <tbody>
                    {[...curadas].sort((a, b) => (b.objetivo ? 1 : 0) - (a.objetivo ? 1 : 0) || (b.volumen || 0) - (a.volumen || 0)).map((c) => {
                      const dc = c.dificultad == null ? C.ash : c.dificultad <= 15 ? C.ok : c.dificultad <= 35 ? C.warn : C.danger;
                      return (
                        <tr key={c.id} style={{ borderTop: `1px solid ${C.line}` }}>
                          <td className="py-1 pr-2"><button title={c.objetivo ? "Es objetivo (clic para quitar)" : "Marcar como objetivo"} onClick={() => patchCurada(c.id, { objetivo: !c.objetivo })} style={{ color: c.objetivo ? C.warn : C.ash, fontSize: 15, lineHeight: 1 }}>{c.objetivo ? "★" : "☆"}</button></td>
                          <td className="py-1 pr-2"><input value={c.keyword} onChange={(e) => patchCurada(c.id, { keyword: e.target.value })} style={{ ...inS, padding: "5px 8px", fontSize: 12 }} /></td>
                          <td className="py-1 px-2"><input value={c.volumen ?? ""} onChange={(e) => patchCurada(c.id, { volumen: e.target.value === "" ? null : Number(e.target.value) || 0 })} placeholder="—" style={{ ...inS, padding: "5px 8px", fontSize: 12, textAlign: "right", fontFamily: MONO, width: 80 }} /></td>
                          <td className="py-1 px-2"><input value={c.dificultad ?? ""} onChange={(e) => patchCurada(c.id, { dificultad: e.target.value === "" ? null : Number(e.target.value) || 0 })} placeholder="—" style={{ ...inS, padding: "5px 8px", fontSize: 12, textAlign: "right", fontFamily: MONO, width: 56, color: dc } } /></td>
                          <td className="py-1 px-2 fs-9" style={{ color: C.aether500, fontFamily: MONO }}>{({ co: "CO", mx: "MX", es: "ES", ar: "AR", us: "US", pe: "PE", cl: "CL", latam: "LatAm" }[c.zona] || (c.zona ? c.zona.toUpperCase() : "—"))}</td>
                          <td className="py-1 px-2 fs-9" style={{ color: C.ash, fontFamily: MONO }}>{c.fuente || "—"}</td>
                          <td className="py-1 pl-2 text-right whitespace-nowrap">
                            <button title="Crear 8 ideas de artículo ancladas a esta keyword" onClick={() => accionIdeas(c.keyword)} style={{ color: C.aether2 }} className="fs-10 inline-flex items-center gap-1 mr-2"><Sparkles size={11} />ideas</button>
                            <button title="Escribir un artículo desde esta keyword" onClick={() => accionContenido(c.keyword)} style={{ color: C.aether2 }} className="fs-10 inline-flex items-center gap-1 mr-2"><FileText size={11} />contenido</button>
                            <button title="Ver quién posiciona en Google con esta keyword" onClick={() => accionCompetencia(c.keyword)} style={{ color: C.aether2 }} className="fs-10 inline-flex items-center gap-1 mr-2"><Search size={11} />competencia</button>
                            <button title="Ver en Google Trends si el tema sube o baja" onClick={() => accionTendencia(c.keyword)} style={{ color: C.aether2 }} className="fs-10 inline-flex items-center gap-1 mr-2">📈 tendencia</button>
                            <button title="Quitar de la lista" onClick={() => delCurada(c.id)} style={{ color: C.ash }}><Trash2 size={12} /></button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          {/* fin pestaña Palabras clave */}
        </div>
      )}

      {/* BLOG · cabecera + artículos */}
      {tab === "blog" && (
        <div>
          <div style={{ background: C.panel, border: `1px solid ${C.line}` }} className="rounded-xl p-4 mb-4">
            <div style={{ color: C.aether500, fontFamily: MONO, letterSpacing: "0.14em" }} className="fs-10 uppercase mb-2">// Cabecera del blog (video + frase)</div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div><label style={{ color: C.ash, fontFamily: MONO }} className="fs-9 uppercase">Video de cabecera (URL)</label>
                <div className="flex gap-1.5">
                  <input style={{ ...inS, padding: "7px 10px", fontSize: 12 }} value={blogCfg.video || ""} onChange={(e) => setBlogCfg({ video: e.target.value })} placeholder="/assets/video/hero.mp4 (o sube uno →)" />
                  <button onClick={subirVideoCabecera} disabled={subiendo === "cab-video"} style={{ background: C.aether, color: C.obsidian, fontWeight: 600 }} className="px-2.5 rounded-lg fs-11 shrink-0">{subiendo === "cab-video" ? "…" : "📤"}</button>
                </div></div>
              <div><label style={{ color: C.ash, fontFamily: MONO }} className="fs-9 uppercase">Frase sobre el video</label>
                <input style={{ ...inS, padding: "7px 10px", fontSize: 12 }} value={blogCfg.frase || ""} onChange={(e) => setBlogCfg({ frase: e.target.value })} placeholder="ej. Ideas para amplificar tu potencial" /></div>
            </div>
            <div style={{ color: C.ash }} className="fs-10 mt-2">Si dejas el video vacío, el blog usa el mismo de la página principal. Para uno distinto: pega una URL o súbelo con 📤. Se actualiza al instante (no hay que republicar). Cada artículo tiene además su propia imagen destacada, abajo.</div>
          </div>

          {articulos.length === 0 ? (
            <div style={{ background: C.panel, border: `1px solid ${C.line}`, color: C.ash }} className="rounded-xl p-6 fs-12 text-center">Genera ideas de artículo por keyword. Cada idea trae su intención de búsqueda; el borrador se escribe con IA y tú lo apruebas.</div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {articulos.map((a) => {
                const open = abierto === a.id;
                const tone = a.estado === "publicado" ? C.ok : a.estado === "pendiente_revision" ? "#E0A85F" : a.estado === "listo" ? C.aether2 : a.estado === "borrador" ? C.warn : C.ash;
                const score = a.cuerpo_md ? seoScoreArticulo(a) : null;
                return (
                  <div key={a.id} style={{ background: C.panel, border: `1px solid ${C.line}` }} className="rounded-xl p-3.5">
                    <div className="flex items-start gap-3 flex-wrap">
                      <button onClick={() => setAbierto(open ? "" : a.id)} style={{ color: C.ash }} className="mt-0.5">{open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}</button>
                      <div className="min-w-0 flex-1">
                        <div style={{ color: C.cream, fontWeight: 600 }} className="fs-13 leading-snug">{a.titulo}</div>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          <span style={{ background: "rgba(255,255,255,0.05)", border: `1px solid ${C.line}`, color: C.aether2, fontFamily: MONO }} className="px-1.5 py-0.5 rounded fs-9">{a.keyword}</span>
                          {a.volumen != null && <span title="Búsquedas mensuales reales (Ubersuggest)" style={{ color: C.mist, fontFamily: MONO }} className="fs-9">🔍 {a.volumen.toLocaleString("es")}/mes</span>}
                          {a.dificultad != null && <span title="Dificultad SEO real (0 fácil, 100 difícil)" style={{ color: a.dificultad <= 15 ? C.ok : a.dificultad <= 35 ? C.warn : C.danger, fontFamily: MONO }} className="fs-9">dif {a.dificultad}</span>}
                          <span style={{ color: C.ash, fontFamily: MONO }} className="fs-9">{a.intencion}</span>
                          <span style={{ color: tone, fontFamily: MONO }} className="fs-9">· {a.estado === "pendiente_revision" ? "⏳ esperando tu OK (correo)" : a.estado}</span>
                          {score != null && <span title="Score SEO (keyword, meta, longitud, estructura). El lunes se propone el mejor." style={{ background: "rgba(255,255,255,0.05)", border: `1px solid ${C.line}`, color: nivelColor(score), fontFamily: MONO }} className="px-1.5 py-0.5 rounded fs-9">SEO {score}</span>}
                          {a.fechaPublicacion && <span style={{ background: C.aetherSoft, border: `1px solid ${C.aetherLine}`, color: C.aether2, fontFamily: MONO }} className="px-1.5 py-0.5 rounded fs-9">📅 {a.fechaPublicacion}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                        {a.estado === "idea" && <button onClick={() => generarArticulo(a)} disabled={!!busyArt} style={{ background: C.aether, color: C.obsidian, fontWeight: 600, opacity: busyArt ? 0.6 : 1 }} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg fs-11"><Sparkles size={12} /> {busyArt === a.id ? "Escribiendo…" : "Escribir borrador"}</button>}
                        {a.cuerpo_md && <button onClick={() => copiarArt(a)} title="Copiar markdown" style={{ color: C.aether2, border: `1px solid ${C.aetherLine}` }} className="p-1.5 rounded-lg"><Copy size={13} /></button>}
                        {a.cuerpo_md && a.estado !== "publicado" && <button onClick={() => setArt(a.id, { estado: "publicado", fechaPublicacion: a.fechaPublicacion || hoy() })} title="Publica el artículo en siemondigital.com/blog ahora mismo" style={{ background: C.ok, color: C.obsidian, fontWeight: 600 }} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg fs-11">✓ Publicar</button>}
                        {a.estado === "publicado" && <button onClick={() => setArt(a.id, { estado: "listo" })} title="Quitar del blog (vuelve a 'listo', deja de salir en la web)" style={{ color: C.ash, border: `1px solid ${C.line}` }} className="px-2.5 py-1.5 rounded-lg fs-11">Quitar del blog</button>}
                        <input type="date" title="Fecha de publicación (aparece en el Calendario)" value={a.fechaPublicacion || ""} onChange={(e) => setArt(a.id, { fechaPublicacion: e.target.value, estado: a.estado === "idea" ? a.estado : "listo" })} style={{ background: C.carbon, color: C.mist, border: `1px solid ${C.line}`, borderRadius: 8, padding: "4px 6px", fontSize: 11 }} />
                        <select value={a.estado} onChange={(e) => setArt(a.id, { estado: e.target.value })} style={{ background: C.carbon, color: C.mist, border: `1px solid ${C.line}`, fontFamily: MONO }} className="fs-10 rounded-lg px-1.5 py-1.5 outline-none">{ESTADOS_ART.map((s) => <option key={s} value={s}>{s}</option>)}</select>
                        <button onClick={() => borrarArt(a.id)} style={{ color: C.ash }}><Trash2 size={13} /></button>
                      </div>
                    </div>
                    {open && (
                      <div style={{ background: C.carbon, border: `1px solid ${C.line}` }} className="rounded-lg p-3 mt-3 ml-8">
                        {a.angulo && <div style={{ color: C.mist }} className="fs-11 mb-2">Ángulo: {a.angulo}</div>}
                        {a.cuerpo_md && (() => {
                          const norm = (s) => (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                          const cuerpo = a.cuerpo_md.toLowerCase();
                          const cuerpoN = norm(a.cuerpo_md);
                          const STOP = new Set(["de", "la", "el", "en", "y", "o", "que", "con", "para", "los", "las", "un", "una", "como", "por", "tu", "su", "del", "al", "es", "se", "lo", "mi"]);
                          const principal = (a.keyword || "").toLowerCase();
                          const cubre = (k) => {
                            const kl = k.toLowerCase();
                            if (cuerpo.includes(kl)) return true;
                            const sig = norm(kl).split(/\s+/).filter((w) => w.length > 3 && !STOP.has(w));
                            return sig.length > 0 && sig.every((w) => cuerpoN.includes(w));
                          };
                          const vistas = new Set();
                          const usadas = [a.keyword, ...curadas.map((c) => c.keyword)].filter((k) => {
                            if (!k) return false;
                            const kl = k.toLowerCase();
                            if (vistas.has(kl)) return false;
                            vistas.add(kl);
                            return kl === principal || cubre(k);
                          });
                          return (
                            <div className="mb-2.5">
                              <span style={{ color: C.ash, fontFamily: MONO }} className="fs-9 uppercase">Palabras clave usadas en el texto</span>
                              <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                {usadas.map((k, i) => { const esPrin = k.toLowerCase() === (a.keyword || "").toLowerCase(); return (
                                  <span key={i} style={{ background: esPrin ? C.aetherSoft : "rgba(255,255,255,0.05)", border: `1px solid ${esPrin ? C.aetherLine : C.line}`, color: esPrin ? C.aether2 : C.mist, fontFamily: MONO }} className="px-1.5 py-0.5 rounded fs-9">{esPrin ? "★ " : ""}{k}</span>
                                ); })}
                                {usadas.length <= 1 && <span style={{ color: C.warn }} className="fs-9">Solo aparece la keyword principal. Suma keywords de tu lista curada al texto para reforzar el SEO.</span>}
                              </div>
                            </div>
                          );
                        })()}
                        <div className="grid sm:grid-cols-2 gap-2 mb-2">
                          <div><label style={{ color: C.ash, fontFamily: MONO }} className="fs-9 uppercase">Meta description (editable)</label>
                            <input style={{ ...inS, padding: "7px 10px", fontSize: 12 }} value={a.meta_description || ""} onChange={(e) => setArt(a.id, { meta_description: e.target.value })} /></div>
                          <div><label style={{ color: C.ash, fontFamily: MONO }} className="fs-9 uppercase">Imagen destacada (portada)</label>
                            <div className="flex gap-1.5">
                              <input style={{ ...inS, padding: "7px 10px", fontSize: 12 }} value={a.imagen || ""} onChange={(e) => setArt(a.id, { imagen: e.target.value })} placeholder="pega una URL, sube o genera con IA →" />
                              <button onClick={() => generarImagenIA(a, "portada")} disabled={subiendo === a.id + "-ia"} title="Genera la portada con IA en tu estilo (optimizada)" style={{ background: C.aetherSoft, border: `1px solid ${C.aetherLine}`, color: C.aether2, fontWeight: 600 }} className="px-2.5 rounded-lg fs-11 shrink-0">{subiendo === a.id + "-ia" ? "…" : "✨ IA"}</button>
                              <button onClick={() => setSelMediaArt(selMediaArt === a.id ? null : a.id)} title="Banco de fotos + editor (filtros, logo, texto)" style={{ background: selMediaArt === a.id ? C.aetherSoft : "transparent", border: `1px solid ${C.aetherLine}`, color: C.aether2 }} className="px-2.5 rounded-lg fs-11 shrink-0">🎨 Banco + editor</button>
                              <button onClick={() => subirDestacada(a.id)} disabled={subiendo === a.id + "-dest"} style={{ background: C.aether, color: C.obsidian, fontWeight: 600 }} className="px-2.5 rounded-lg fs-11 shrink-0">{subiendo === a.id + "-dest" ? "…" : "📤"}</button>
                            </div>
                            {selMediaArt === a.id && (
                              <div className="mt-2">
                                <SelectorMedia contexto={a.keyword || a.h1 || a.titulo || ""} orientDefault="landscape" flash={flash} permitirIA={false} onElegir={(u) => { setArt(a.id, { imagen: u }); setSelMediaArt(null); flash("Portada puesta ✓"); }} />
                              </div>
                            )}
                            {fotoRes && fotoRes.id === a.id && (
                              <div style={{ background: C.carbon, border: `1px solid ${C.line}` }} className="rounded-lg p-2 mt-2">
                                {fotoRes.sinKey ? (
                                  <div>
                                    <div style={{ color: C.ash }} className="fs-10 mb-1">Conecta un banco de fotos gratis: crea una cuenta en <b style={{ color: C.mist }}>pexels.com/api</b>, copia tu API key y pégala aquí (se guarda cifrada).</div>
                                    <div className="flex gap-1.5">
                                      <input style={{ ...inS, padding: "6px 9px", fontSize: 12 }} value={pexelsKey} onChange={(e) => setPexelsKey(e.target.value)} placeholder="API key de Pexels" />
                                      <button onClick={guardarPexels} style={{ background: C.aether, color: C.obsidian, fontWeight: 600 }} className="px-3 rounded-lg fs-11 shrink-0">Conectar</button>
                                    </div>
                                  </div>
                                ) : (
                                  <div>
                                    <div className="flex items-center justify-between mb-1"><span style={{ color: C.ash }} className="fs-10">Clic en una foto para ponerla de portada</span><button onClick={() => setFotoRes(null)} style={{ color: C.ash }} className="fs-10">cerrar</button></div>
                                    <div className="flex gap-1.5 overflow-x-auto pb-1">
                                      {(fotoRes.fotos || []).map((f, i) => (
                                        <img key={i} src={f.thumb} alt={f.autor} title={`${f.banco} · ${f.autor}`} onClick={() => { setArt(a.id, { imagen: f.url }); setFotoRes(null); flash(`Portada del banco puesta (${f.banco}).`); }}
                                          style={{ height: 56, borderRadius: 6, cursor: "pointer", border: `1px solid ${C.line}`, flexShrink: 0 }} />
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                            </div>
                        </div>
                        {a.imagen && <img src={a.imagen} alt="" style={{ maxHeight: 120, borderRadius: 8, marginBottom: 8 }} />}
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                          <span style={{ color: C.ash, fontFamily: MONO }} className="fs-9 uppercase">Insertar donde tengas el cursor:</span>
                          <button onClick={() => generarImagenIA(a, "cuerpo")} disabled={subiendo === a.id + "-ia"} title="Genera una imagen con IA y la inserta donde tengas el cursor" style={{ background: C.aetherSoft, border: `1px solid ${C.aetherLine}`, color: C.aether2 }} className="px-2.5 py-1 rounded-lg fs-11">{subiendo === a.id + "-ia" ? "generando…" : "✨ Imagen IA"}</button>
                          <button onClick={() => insertarMedia(a, "imagen")} disabled={subiendo === a.id + "-imagen"} style={{ background: "transparent", border: `1px solid ${C.aetherLine}`, color: C.aether2 }} className="px-2.5 py-1 rounded-lg fs-11">{subiendo === a.id + "-imagen" ? "subiendo…" : "🖼 Subir"}</button>
                          <button onClick={() => insertarMedia(a, "video")} disabled={subiendo === a.id + "-video"} style={{ background: "transparent", border: `1px solid ${C.aetherLine}`, color: C.aether2 }} className="px-2.5 py-1 rounded-lg fs-11">{subiendo === a.id + "-video" ? "subiendo…" : "🎬 Video"}</button>
                          <div className="flex-1" />
                          {a.estado === "publicado" && <button onClick={() => abrirArticulo(a)} style={{ color: C.aether2, border: `1px solid ${C.aetherLine}` }} className="px-2.5 py-1 rounded-lg fs-11 inline-flex items-center gap-1">Ver en el blog <ArrowRight size={11} /></button>}
                        </div>
                        <div style={{ color: C.ash }} className="fs-10 mb-1.5">Pon el cursor en el texto donde quieras la foto y pulsa "Imagen". Todo se guarda solo (no hay botón de guardar): cuando ves el texto actualizado, ya está guardado.</div>
                        {a.cuerpo_md
                          ? <textarea ref={(el) => { taRefs.current[a.id] = el; }} value={a.cuerpo_md} onChange={(e) => setArt(a.id, { cuerpo_md: e.target.value })} style={{ ...inS, minHeight: 320, whiteSpace: "pre-wrap", lineHeight: 1.6, fontSize: 12 }} />
                          : <div style={{ color: C.ash }} className="fs-11">Aún sin borrador. Pulsa "Escribir borrador".</div>}
                        {a.cuerpo_md && (() => {
                          const imgs = [...(a.cuerpo_md.match(/!\[[^\]]*\]\((https?:[^)\s]+)\)/g) || []), ...(a.cuerpo_md.match(/@video\((https?:[^)\s]+)\)/g) || [])];
                          if (!imgs.length) return null;
                          return <div className="flex gap-2 mt-2 flex-wrap">{imgs.map((m, i) => { const url = m.match(/\((https?:[^)\s]+)\)/)[1]; const esVid = m.startsWith("@video"); return (
                            <div key={i} style={{ position: "relative", border: `1px solid ${C.line}`, borderRadius: 8, overflow: "hidden" }}>
                              {esVid ? <div style={{ width: 64, height: 48, background: "#000", color: C.aether2, display: "flex", alignItems: "center", justifyContent: "center" }} className="fs-10">🎬</div> : <img src={url} alt="" style={{ width: 64, height: 48, objectFit: "cover", display: "block" }} />}
                              <button onClick={() => setArt(a.id, { cuerpo_md: a.cuerpo_md.replace(m, "").replace(/\n{3,}/g, "\n\n") })} title="Quitar del artículo" style={{ position: "absolute", top: 1, right: 1, background: "rgba(0,0,0,0.6)", color: "#fff", borderRadius: 4, lineHeight: 1, padding: "1px 4px" }} className="fs-10">×</button>
                            </div>); })}</div>;
                        })()}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* SEO */}
      {tab === "seo" && (
        <div>
          <div style={{ background: C.panel, border: `1px solid ${C.line}` }} className="rounded-xl p-4 mb-4">
            <div className="grid sm:grid-cols-3 gap-3">
              <div><label style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase">URL a auditar</label>
                <Combo listaId="dl-url-seo" style={inS} value={url} onChange={setUrl} opciones={opcionesDe(data, "urlSeo", URLS_AUDITAR)} placeholder="https://…" /></div>
              <div><label style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase">Competidor (opcional)</label>
                <input style={inS} value={comp} onChange={(e) => setComp(e.target.value)} placeholder="https://competidor.com" /></div>
              <div><label style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase">Keyword objetivo (opcional)</label>
                <input style={inS} value={kw} onChange={(e) => setKw(e.target.value)} placeholder="ej. automatización con IA para pymes" /></div>
            </div>
            <button onClick={auditar} disabled={busySeo} style={{ background: C.aether, color: C.obsidian, fontWeight: 600, opacity: busySeo ? 0.6 : 1 }} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg fs-13 mt-3"><Search size={14} /> {busySeo ? "Auditando…" : "Auditar SEO"}</button>
          </div>

          {audit && audit.ok && (
            <div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                <div style={{ background: C.panel, border: `1px solid ${C.line}` }} className="rounded-xl p-4">
                  <div style={{ color: nivelColor(audit.global), fontWeight: 700, fontFamily: MONO }} className="fs-28">{audit.global}<span className="fs-13">/100</span></div>
                  <div style={{ color: C.ash }} className="fs-10 mt-1 truncate">{audit.url} · {audit.fecha}</div>
                </div>
                {[["Errores", audit.resumen?.errores, C.danger], ["Advertencias", audit.resumen?.advertencias, C.warn], ["Aprobados", audit.resumen?.aprobados, C.ok]].map(([k, v, col]) => (
                  <div key={k} style={{ background: C.panel, border: `1px solid ${C.line}` }} className="rounded-xl p-4"><div style={{ color: col, fontWeight: 700, fontFamily: MONO }} className="fs-24">{v}</div><div style={{ color: C.ash }} className="fs-10 mt-1">{k}</div></div>
                ))}
              </div>

              {audit.competidor && (
                <div style={{ background: C.panel, border: `1px solid ${C.aetherLine}` }} className="rounded-xl p-4 mb-4">
                  <div style={{ color: C.aether500, fontFamily: MONO }} className="fs-10 uppercase mb-2">// vs competidor</div>
                  <div className="flex items-center gap-4 flex-wrap">
                    <div><span style={{ color: C.cream }} className="fs-12">Tú: </span><b style={{ color: nivelColor(audit.global), fontFamily: MONO }} className="fs-16">{audit.global}</b></div>
                    <div><span style={{ color: C.cream }} className="fs-12">{(audit.competidor.url || "").replace(/https?:\/\//, "").slice(0, 30)}: </span><b style={{ color: nivelColor(audit.competidor.global), fontFamily: MONO }} className="fs-16">{audit.competidor.global}</b></div>
                    <span style={{ color: C.ash }} className="fs-11">{audit.global >= audit.competidor.global ? "Vas ganando. Mantén y amplía la ventaja." : "Vas por detrás: prioriza las correcciones de abajo."}</span>
                  </div>
                </div>
              )}

              {(audit.top_fixes || []).length > 0 && (
                <div style={{ background: "rgba(216,182,115,0.08)", border: `1px solid rgba(216,182,115,0.3)` }} className="rounded-xl p-4 mb-4">
                  <div style={{ color: C.warn, fontFamily: MONO }} className="fs-10 uppercase mb-2">// Top correcciones (por impacto)</div>
                  <div className="flex flex-col gap-2">
                    {audit.top_fixes.map((f, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <AlertTriangle size={13} color={f.nivel === "error" ? C.danger : C.warn} className="mt-0.5 shrink-0" />
                        <div className="min-w-0"><span style={{ color: C.cream }} className="fs-12">{f.txt}</span><div style={{ color: C.ash }} className="fs-11">→ {f.fix}</div>
                          {(f.evidencia || []).map((ev, j) => <div key={j} style={{ color: C.mist, fontFamily: MONO, wordBreak: "break-all" }} className="fs-9 mt-0.5 pl-2">· {ev}</div>)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-2">
                {(audit.categorias || []).map((c) => {
                  const open = catAbierta === c.nombre;
                  return (
                    <div key={c.nombre} style={{ background: C.panel, border: `1px solid ${C.line}` }} className="rounded-xl p-3.5">
                      <button onClick={() => setCatAbierta(open ? "" : c.nombre)} className="w-full flex items-center gap-3">
                        {open ? <ChevronDown size={14} color={C.ash} /> : <ChevronRight size={14} color={C.ash} />}
                        <span style={{ color: C.cream, fontWeight: 600 }} className="fs-12 flex-1 text-left">{c.nombre} <span style={{ color: C.ash, fontFamily: MONO }} className="fs-9">({c.peso}%)</span></span>
                        <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: 4, height: 8, width: 140 }}><div style={{ width: `${c.puntos}%`, background: nivelColor(c.puntos) + "38", border: `1px solid ${nivelColor(c.puntos)}`, boxSizing: "border-box", height: "100%", borderRadius: 4 }} /></div>
                        <span style={{ color: nivelColor(c.puntos), fontFamily: MONO, width: 40 }} className="fs-12 text-right">{c.puntos}</span>
                      </button>
                      {open && (
                        <div className="flex flex-col gap-1.5 mt-3 ml-7">
                          {c.hallazgos.map((hh, i) => (
                            <div key={i} className="flex items-start gap-2">
                              {hh.estado === "ok" ? <Check size={12} color={C.ok} className="mt-0.5 shrink-0" /> : <AlertTriangle size={12} color={hh.estado === "error" ? C.danger : C.warn} className="mt-0.5 shrink-0" />}
                              <div className="min-w-0"><span style={{ color: C.mist }} className="fs-11">{hh.txt}</span>{hh.fix && <div style={{ color: C.ash }} className="fs-10">→ {hh.fix}</div>}
                                {(hh.evidencia || []).map((ev, j) => <div key={j} style={{ color: C.mist, fontFamily: MONO, wordBreak: "break-all" }} className="fs-9 mt-0.5 pl-2">· {ev}</div>)}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
