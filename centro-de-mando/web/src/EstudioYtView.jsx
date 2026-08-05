import React, { useState, useEffect } from "react";
import { SquarePlay as Youtube, Sparkles, Copy, Check, FileText, Type, Image as ImageIcon, Repeat, CalendarDays, TrendingUp, RefreshCw, ArrowRight, AtSign } from "lucide-react";
import { C, MONO, SANS } from "./tema.js";
import { MOTOR, getToken, estadoSecretos, guardarSecreto } from "./db.js";
import Combo, { opcionesDe, guardarOpcion } from "./Combo.jsx";

const uid = () => (crypto?.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2, 9));
const today = () => new Date().toISOString().slice(0, 10);

const ACCIONES = [
  { id: "guion", label: "Guion (retención)", icon: FileText },
  { id: "titulos", label: "Títulos", icon: Type },
  { id: "miniatura", label: "Miniatura", icon: ImageIcon },
  { id: "repurpose", label: "Repurpose", icon: Repeat },
  { id: "x", label: "Post para X", icon: AtSign },
  { id: "calendario", label: "Calendario", icon: CalendarDays },
];
// Pilares editoriales del canal institucional (método Ciclo de Riqueza)
const PILARES = [
  "Invertir en bienes raíces sobre planos (preventa)",
  "Finanzas personales y patrimonio (NSE, capacidad de endeudamiento)",
  "Libertad financiera con estructura (anti-gurú)",
];
const PILARES_TEND_DEFAULT = [
  { es: "invertir en bienes raíces sobre planos", en: "pre-construction real estate investing" },
  { es: "finanzas personales y construir patrimonio", en: "personal finance building wealth" },
  { es: "ingresos pasivos y libertad financiera", en: "passive income financial freedom" },
];
const inS = { background: C.carbon, border: `1px solid ${C.line}`, color: C.cream, borderRadius: 10, padding: "10px 12px", width: "100%", fontFamily: SANS, fontSize: 14, outline: "none" };
const H = () => ({ "content-type": "application/json", Authorization: "Bearer " + getToken() });

export default function EstudioYtView({ data, commit, ws }) {
  const [aviso, setAviso] = useState("");
  const flash = (m) => { setAviso(m); window.clearTimeout(flash._t); flash._t = window.setTimeout(() => setAviso(""), 7000); };
  const [accion, setAccion] = useState("guion");
  const [tema, setTema] = useState("");
  const [pilar, setPilar] = useState("");
  const [idioma, setIdioma] = useState("es");
  const [salida, setSalida] = useState("");
  const [busy, setBusy] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const ideas = data[ws].ideasTendencia || [];   // compartidas con el Estudio de contenido
  const setIdeas = (arr) => commit({ ...data, [ws]: { ...data[ws], ideasTendencia: arr } });
  const [ideasBusy, setIdeasBusy] = useState(false);
  const [idiomaTend, setIdiomaTend] = useState("ambos");   // ambos | es | en
  const pilaresTend = (data[ws].pilaresTendencia && data[ws].pilaresTendencia.length) ? data[ws].pilaresTendencia : PILARES_TEND_DEFAULT;
  const [showPil, setShowPil] = useState(false);
  const [pilEdit, setPilEdit] = useState(pilaresTend.map((p) => ({ ...p })));
  function guardarPilares() {
    const limpios = pilEdit.filter((p) => (p.es || "").trim() || (p.en || "").trim()).map((p) => ({ es: (p.es || "").trim(), en: (p.en || "").trim() || (p.es || "").trim() }));
    commit({ ...data, [ws]: { ...data[ws], pilaresTendencia: limpios } });
    setShowPil(false); flash("Pilares guardados. Vuelve a buscar tendencias.");
  }
  // analítica del canal
  const canalCfg = (data[ws]?.config || {}).canalYoutube || "";
  const [canalHandle, setCanalHandle] = useState(canalCfg || "@");
  const [analitica, setAnalitica] = useState(null);
  const [anBusy, setAnBusy] = useState(false);
  // OAuth analítica privada (credenciales en el vault del motor)
  const [sec, setSec] = useState({});
  const [cid, setCid] = useState("");
  const [cs, setCs] = useState("");
  const [showCred, setShowCred] = useState(false);
  const [priv, setPriv] = useState(null);
  const [privBusy, setPrivBusy] = useState(false);
  const clienteOk = !!(sec.YT_OAUTH_CLIENT_ID?.valido && sec.YT_OAUTH_CLIENT_SECRET?.valido);
  const oauthOk = !!sec.YT_ANALYTICS_REFRESH?.valido;
  const guardados = (data[ws].contenidos || []).filter((x) => x.red === "youtube");

  async function cargarSec() {
    try { setSec(await estadoSecretos()); } catch {}
  }
  useEffect(() => { cargarSec(); }, []);
  async function guardarCliente() {
    if (!cid.trim() || !cs.trim()) return flash("Pega el Client ID y el Client Secret.");
    if (!cid.includes("apps.googleusercontent.com")) return flash("El Client ID debe terminar en .apps.googleusercontent.com. Eso que pegaste no es el Client ID (parece tu correo).");
    if (!cs.trim().startsWith("GOCSPX")) return flash("El Client Secret debe empezar con GOCSPX-. Revisa que copiaste el secret correcto.");
    const ok1 = await guardarSecreto("YT_OAUTH_CLIENT_ID", cid.trim());
    const ok2 = await guardarSecreto("YT_OAUTH_CLIENT_SECRET", cs.trim());
    if (ok1 && ok2) { setCid(""); setCs(""); setShowCred(false); flash("Credenciales guardadas. Ahora conecta tu YouTube."); cargarSec(); }
    else flash("No pude guardar.");
  }
  function conectarYt() { window.open(MOTOR + "/oauth/youtube/start?k=" + encodeURIComponent(getToken()), "_blank"); flash("Autoriza en la ventana de Google, luego vuelve y pulsa 'ya autoricé'."); }
  async function verPrivada() {
    setPrivBusy(true);
    try {
      const r = await fetch(MOTOR + "/canal_analitica_privada", { method: "POST", headers: H(), body: JSON.stringify({}) });
      const d = await r.json();
      if (d.ok) setPriv(d); else flash(d.error === "no_conectado" ? "Conecta tu YouTube primero." : "No pude leer las métricas.");
    } catch { flash("No pude conectar."); } finally { setPrivBusy(false); cargarSec(); }
  }

  async function buscarIdeas() {
    setIdeasBusy(true);
    try {
      const idiomas = idiomaTend === "ambos" ? ["es", "en"] : [idiomaTend];
      const r = await fetch(MOTOR + "/ideas", { method: "POST", headers: H(),
        body: JSON.stringify({ idiomas, pilares: pilaresTend, n: 14 }) });
      const d = await r.json();
      if (d.ok && Array.isArray(d.ideas)) setIdeas(d.ideas);
      else flash(d.error === "sin_clave_youtube" ? "Falta la clave de YouTube en Accesos." : "No pude traer tendencias.");
    } catch { flash("No pude conectar con el motor."); }
    finally { setIdeasBusy(false); }
  }
  function usarIdea(it) { setTema(it.titulo); if (it.idioma) setIdioma(it.idioma); flash("Idea cargada. Modela el ángulo (no copies) y genera."); try { window.scrollTo({ top: 0, behavior: "smooth" }); } catch {} }

  async function analizarCanal() {
    setAnBusy(true);
    try {
      const r = await fetch(MOTOR + "/canal_analitica", { method: "POST", headers: H(),
        body: JSON.stringify({ handle: canalHandle }) });
      const d = await r.json();
      if (d.ok) {
        setAnalitica(d);
        // recuerda el handle en la config del workspace
        if (canalHandle.trim() && canalHandle.trim() !== canalCfg) {
          commit({ ...data, [ws]: { ...data[ws], config: { ...(data[ws].config || {}), canalYoutube: canalHandle.trim() } } });
        }
      } else flash("Analítica: " + (d.error === "sin_clave_youtube" ? "falta YOUTUBE_API_KEY en Accesos." : d.error || "no pude"));
    } catch { flash("No pude conectar con el motor."); }
    finally { setAnBusy(false); }
  }

  async function generar(accionForzada) {
    const acc = typeof accionForzada === "string" ? accionForzada : accion;
    if (!tema.trim() && acc !== "calendario") { flash("Escribe primero el tema del video (arriba)."); return; }
    setBusy(true); setSalida(""); setCopiado(false);
    try {
      const r = await fetch(MOTOR + "/yt_studio", {
        method: "POST", headers: H(),
        body: JSON.stringify({ accion: acc, tema, pilar, idioma }),
      });
      const d = await r.json();
      setSalida(d.contenido || (d.error === "sin_clave" ? "Falta la clave de Claude en el servidor." : "No pude generar."));
      if (d.contenido && tema.trim()) guardarOpcion(data, commit, "temaYt", tema, [...PILARES]);   // aprende tu tema
    } catch { setSalida("No pude conectar con el motor."); }
    finally { setBusy(false); }
  }
  function copiar() { try { navigator.clipboard.writeText(salida); setCopiado(true); flash("Copiado."); } catch {} }
  function guardar() {
    if (!salida.trim()) return;
    const item = { id: uid(), red: "youtube", tipo: accion, tema, idioma, texto: salida, fecha: today() };
    commit({ ...data, [ws]: { ...data[ws], contenidos: [item, ...(data[ws].contenidos || [])] } });
    flash("Guardado (aparece también en Contenido → Guardados).");
  }

  return (
    <div style={{ maxWidth: 1100 }}>
      <div className="mb-5">
        <div style={{ color: C.aether500, fontFamily: MONO, letterSpacing: "0.2em" }} className="fs-10 uppercase mb-2"><span style={{ color: C.aether }}>// </span>YouTube Studio</div>
        <h1 style={{ fontWeight: 600, color: C.cream }} className="fs-24 flex items-center gap-2"><Youtube size={20} color={C.aether} /> Estudio del canal</h1>
        <div style={{ color: C.ash }} className="fs-11 mt-1">Guiones con retención, títulos, briefs de miniatura, repurpose multicanal y calendario, en la voz de la marca y sus pilares (firma institucional, sin nombres de persona).</div>
      </div>

      {aviso && <div style={{ background: C.aetherSoft, border: `1px solid ${C.aetherLine}`, color: C.aether2 }} className="rounded-lg px-3 py-2 mb-4 fs-12">{aviso}</div>}

      {/* investigación de tendencias (inspiración) */}
      <div style={{ background: C.panel, border: `1px solid ${C.line}` }} className="rounded-xl p-4 mb-4">
        <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
          <div style={{ color: C.aether500, fontFamily: MONO, letterSpacing: "0.16em" }} className="fs-10 uppercase flex items-center gap-1.5"><TrendingUp size={12} color={C.aether} /> Investigación de tendencias · tu nicho</div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              {[["ambos", "ES+EN"], ["es", "ES"], ["en", "EN"]].map(([v, l]) => (
                <button key={v} onClick={() => setIdiomaTend(v)} style={{ background: idiomaTend === v ? C.aetherSoft : "transparent", border: `1px solid ${idiomaTend === v ? C.aetherLine : C.line}`, color: idiomaTend === v ? C.aether2 : C.ash, fontFamily: MONO }} className="px-2 py-1 rounded fs-10">{l}</button>
              ))}
            </div>
            <button onClick={() => { setPilEdit(pilaresTend.map((p) => ({ ...p }))); setShowPil((v) => !v); }} style={{ color: showPil ? C.aether2 : C.mist, border: `1px solid ${C.aetherLine}` }} className="px-2.5 py-1 rounded fs-11">{showPil ? "Cerrar" : "Editar pilares"}</button>
            <button onClick={buscarIdeas} disabled={ideasBusy} style={{ background: ideas.length ? "transparent" : C.aether, color: ideas.length ? C.aether2 : C.obsidian, border: `1px solid ${C.aetherLine}`, fontWeight: 600, opacity: ideasBusy ? 0.6 : 1 }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg fs-12">{ideasBusy ? <RefreshCw size={13} className="animate-spin" /> : <TrendingUp size={13} />}{ideasBusy ? "Buscando…" : ideas.length ? "Actualizar" : "Buscar tendencias"}</button>
          </div>
        </div>
        {showPil && (
          <div style={{ background: C.carbon, border: `1px solid ${C.line}` }} className="rounded-lg p-3 mb-2">
            <div style={{ color: C.ash }} className="fs-10 mb-2">Edita los términos de búsqueda (español e inglés). Uno por pilar. Son los mismos del Estudio de contenido.</div>
            {pilEdit.map((p, i) => (
              <div key={i} className="flex items-center gap-2 mb-1.5">
                <input value={p.es} onChange={(e) => setPilEdit(pilEdit.map((x, j) => j === i ? { ...x, es: e.target.value } : x))} placeholder="término en español" style={{ ...inS, fontSize: 12, padding: "7px 10px" }} />
                <input value={p.en} onChange={(e) => setPilEdit(pilEdit.map((x, j) => j === i ? { ...x, en: e.target.value } : x))} placeholder="term in english" style={{ ...inS, fontSize: 12, padding: "7px 10px" }} />
                <button onClick={() => setPilEdit(pilEdit.filter((_, j) => j !== i))} style={{ color: C.ash }} className="fs-11 shrink-0">✕</button>
              </div>
            ))}
            <div className="flex items-center gap-2 mt-2">
              <button onClick={() => setPilEdit([...pilEdit, { es: "", en: "" }])} style={{ color: C.aether2, border: `1px solid ${C.aetherLine}` }} className="px-2.5 py-1 rounded fs-11">+ pilar</button>
              <button onClick={guardarPilares} style={{ background: C.aether, color: C.obsidian, fontWeight: 600 }} className="px-3 py-1 rounded fs-11">Guardar pilares</button>
            </div>
          </div>
        )}
        {ideas.length === 0 && !ideasBusy && !showPil && <div style={{ color: C.ash }} className="fs-11">Pulsa "Buscar tendencias" para ver lo que más rinde en tu nicho ahora mismo.</div>}
        {ideas.length > 0 && (
          <div className="grid sm:grid-cols-2 gap-2">
            {ideas.map((it, i) => (
              <div key={i} style={{ background: C.carbon, border: `1px solid ${C.line}` }} className="rounded-lg p-2.5 flex flex-col gap-1.5">
                <div className="flex items-start gap-2">
                  <span style={{ background: (it.score || it.outlier) >= 200 ? C.aetherSoft : "rgba(255,255,255,0.05)", border: `1px solid ${(it.score || it.outlier) >= 200 ? C.aetherLine : C.line}`, color: (it.score || it.outlier) >= 200 ? C.aether2 : C.ash, fontFamily: MONO }} className="px-1.5 py-0.5 rounded fs-10 shrink-0">{(it.score || it.outlier) >= 500 ? "🔥" : ""}{it.score || it.outlier}</span>
                  <span style={{ background: "rgba(255,255,255,0.05)", border: `1px solid ${C.line}`, color: C.ash, fontFamily: MONO }} className="px-1 py-0.5 rounded fs-9 shrink-0 uppercase">{it.idioma || "es"}</span>
                  <div style={{ color: C.cream }} className="fs-12 leading-snug">{it.titulo}</div>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={() => usarIdea(it)} style={{ color: C.aether2 }} className="inline-flex items-center gap-1 fs-11 font-medium">Usar <ArrowRight size={11} /></button>
                  <a href={it.url} target="_blank" rel="noreferrer" style={{ color: C.ash }} className="fs-10">ver</a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* analítica del canal (datos públicos) */}
      <div style={{ background: C.panel, border: `1px solid ${C.line}` }} className="rounded-xl p-4 mb-4">
        <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
          <div style={{ color: C.aether500, fontFamily: MONO, letterSpacing: "0.16em" }} className="fs-10 uppercase flex items-center gap-1.5"><Youtube size={12} color={C.aether} /> Analítica de tu canal</div>
          <div className="flex items-center gap-2">
            <input value={canalHandle} onChange={(e) => setCanalHandle(e.target.value)} style={{ ...inS, width: 200, padding: "6px 10px", fontSize: 12 }} placeholder="@tucanal" />
            <button onClick={analizarCanal} disabled={anBusy} style={{ background: C.aether, color: C.obsidian, fontWeight: 600, opacity: anBusy ? 0.6 : 1 }} className="px-3 py-1.5 rounded-lg fs-12">{anBusy ? "Analizando…" : "Analizar"}</button>
          </div>
        </div>
        {!analitica && <div style={{ color: C.ash }} className="fs-11">Mira qué videos rinden mejor en tu canal (datos públicos: vistas, likes). Retención, CTR y fuentes de tráfico necesitan conectar tu canal por OAuth (abajo).</div>}
        {analitica && (
          <div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
              {[["Suscriptores", analitica.canal.subs], ["Videos", analitica.canal.videos], ["Vistas totales", analitica.canal.vistas_totales], ["Prom. vistas", analitica.canal.promedio_vistas]].map(([k, v]) => (
                <div key={k} style={{ background: C.carbon, border: `1px solid ${C.line}` }} className="rounded-lg p-2.5"><div style={{ color: C.aether2, fontWeight: 700 }} className="fs-16">{Number(v).toLocaleString()}</div><div style={{ color: C.ash }} className="fs-9">{k}</div></div>
              ))}
            </div>
            {analitica.videos.length === 0 ? (
              <div style={{ color: C.ash }} className="fs-11">El canal aún no tiene videos públicos. Cuando publiques, aquí verás cuáles funcionan mejor.</div>
            ) : (
              <div className="flex flex-col gap-1.5">
                <div style={{ color: C.ash, fontFamily: MONO }} className="fs-9 uppercase">Tus videos · % vs tu promedio (modela los que superan 100%)</div>
                {analitica.videos.slice(0, 8).map((v) => (
                  <div key={v.id} className="flex items-center gap-2">
                    <span style={{ background: v.vs_promedio >= 100 ? C.aetherSoft : "rgba(255,255,255,0.05)", border: `1px solid ${v.vs_promedio >= 100 ? C.aetherLine : C.line}`, color: v.vs_promedio >= 100 ? C.aether2 : C.ash, fontFamily: MONO, width: 52, textAlign: "center" }} className="px-1 py-0.5 rounded fs-10 shrink-0">{v.vs_promedio}%</span>
                    <a href={v.url} target="_blank" rel="noreferrer" style={{ color: C.mist }} className="fs-11 truncate flex-1 hover:underline">{v.titulo}</a>
                    <span style={{ color: C.ash, fontFamily: MONO }} className="fs-10 shrink-0">{Number(v.vistas).toLocaleString()} v</span>
                    <button onClick={() => usarIdea({ titulo: v.titulo })} style={{ color: C.aether2 }} className="fs-10 shrink-0">usar</button>
                  </div>
                ))}
              </div>
            )}
            <div style={{ color: C.ash }} className="fs-9 mt-2">{analitica.nota_privado}</div>
          </div>
        )}

        {/* métricas privadas (OAuth) */}
        <div style={{ borderTop: `1px solid ${C.line}` }} className="mt-3 pt-3">
          <div style={{ color: C.aether500, fontFamily: MONO }} className="fs-10 uppercase mb-2">// Métricas privadas (retención · tráfico)</div>
          <div className="mb-2">
            <div className="flex items-center justify-between">
              <span style={{ color: C.ash }} className="fs-11">{clienteOk ? "Credenciales de Google guardadas" : "Pega tus credenciales de Google Cloud (OAuth Client tipo Web)"}</span>
              <button onClick={() => setShowCred((v) => !v)} style={{ color: C.aether2 }} className="fs-10 underline">{showCred ? "cerrar" : (clienteOk ? "cambiar" : "configurar")}</button>
            </div>
            {(showCred || !clienteOk) && (
              <div className="mt-2">
                <div className="grid sm:grid-cols-2 gap-2">
                  <input style={{ ...inS, fontSize: 12 }} value={cid} onChange={(e) => setCid(e.target.value)} placeholder="Client ID (…apps.googleusercontent.com)" />
                  <input style={{ ...inS, fontSize: 12 }} type="password" value={cs} onChange={(e) => setCs(e.target.value)} placeholder="Client Secret (GOCSPX-…)" />
                </div>
                <button onClick={guardarCliente} style={{ background: C.aether, color: C.obsidian, fontWeight: 600 }} className="mt-2 px-3 py-1.5 rounded-lg fs-12">Guardar credenciales</button>
                <div style={{ color: C.warn }} className="fs-9 mt-1">Importante: el Client ID NO es tu correo. Es un texto largo que termina en <b>.apps.googleusercontent.com</b> y el Secret empieza con <b>GOCSPX-</b>. Es el MISMO cliente OAuth de Search Console / Google Ads.</div>
              </div>
            )}
          </div>
          {clienteOk && !oauthOk && (
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={conectarYt} style={{ background: C.aether, color: C.obsidian, fontWeight: 600 }} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg fs-12"><Youtube size={14} /> Conectar mi YouTube</button>
              <span style={{ color: C.ash }} className="fs-10">Autoriza con la cuenta del canal; se abre Google en otra ventana.</span>
              <button onClick={cargarSec} style={{ color: C.ash }} className="fs-10 underline">ya autoricé</button>
            </div>
          )}
          {oauthOk && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span style={{ color: C.ok }} className="fs-11 inline-flex items-center gap-1"><Check size={13} /> YouTube conectado</span>
                <button onClick={verPrivada} disabled={privBusy} style={{ background: C.aetherSoft, border: `1px solid ${C.aetherLine}`, color: C.aether2 }} className="px-3 py-1.5 rounded-lg fs-11">{privBusy ? "Cargando…" : "Ver métricas (90 días)"}</button>
              </div>
              {priv && (
                <div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
                    {[["Vistas", priv.resumen?.views], ["Retención %", priv.resumen?.averageViewPercentage != null ? Math.round(priv.resumen.averageViewPercentage) + "%" : "-"], ["Min. vistos", priv.resumen?.estimatedMinutesWatched], ["Subs ganados", priv.resumen?.subscribersGained]].map(([k, v]) => (
                      <div key={k} style={{ background: C.carbon, border: `1px solid ${C.line}` }} className="rounded-lg p-2"><div style={{ color: C.aether2, fontWeight: 700 }} className="fs-15">{v != null ? (typeof v === "number" ? Number(v).toLocaleString() : v) : "-"}</div><div style={{ color: C.ash }} className="fs-9">{k}</div></div>
                    ))}
                  </div>
                  {(priv.trafico || []).length > 0 && (
                    <div>
                      <div style={{ color: C.ash, fontFamily: MONO }} className="fs-9 uppercase mb-1">Fuentes de tráfico</div>
                      {priv.trafico.map((t, i) => (<div key={i} style={{ color: C.mist }} className="fs-11 flex justify-between"><span>{t.fuente}</span><span style={{ fontFamily: MONO, color: C.aether2 }}>{Number(t.vistas).toLocaleString()}</span></div>))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {ACCIONES.map((a) => { const on = a.id === accion; const Ico = a.icon; return (
          <button key={a.id} onClick={() => { setAccion(a.id); setSalida(""); generar(a.id); }} style={{ background: on ? C.aetherSoft : C.panel, border: `1px solid ${on ? C.aetherLine : C.line}`, color: on ? C.aether2 : C.mist }} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg fs-12"><Ico size={14} /> {a.label}</button>
        ); })}
      </div>

      <div style={{ background: C.panel, border: `1px solid ${C.line}` }} className="rounded-xl p-4 md:p-5 mb-5">
        <div className="grid md:grid-cols-2 gap-3">
          <div className="md:col-span-2"><label style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase">Tema del video {accion === "calendario" ? "(opcional)" : "(elige uno o escribe el tuyo)"}</label>
            <Combo listaId="dl-tema-yt" style={inS} value={tema} onChange={setTema} opciones={opcionesDe(data, "temaYt", [...PILARES, ...pilaresTend.map((p) => p.es)])} placeholder="ej. qué es comprar sobre planos y por qué cambia el juego" /></div>
          <div><label style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase">Pilar</label>
            <select style={inS} value={pilar} onChange={(e) => setPilar(e.target.value)}><option value="">Cualquiera</option>{PILARES.map((p) => <option key={p} value={p}>{p}</option>)}</select></div>
          <div><label style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase">Idioma</label>
            <select style={inS} value={idioma} onChange={(e) => setIdioma(e.target.value)}><option value="es">Español</option><option value="en">English</option></select></div>
        </div>
        <button onClick={generar} disabled={busy} style={{ background: C.aether, color: C.obsidian, fontWeight: 600, opacity: busy ? 0.6 : 1 }} className="mt-4 flex items-center gap-2 px-4 py-2.5 rounded-lg fs-13"><Sparkles size={15} strokeWidth={2.3} />{busy ? "Creando…" : "Generar con IA"}</button>
      </div>

      {(salida || busy) && (
        <div style={{ background: C.panel, border: `1px solid ${C.line}` }} className="rounded-xl p-4 mb-6">
          <div className="flex items-center justify-between mb-2">
            <div style={{ color: C.aether500, fontFamily: MONO }} className="fs-10 uppercase">// Resultado · {ACCIONES.find((a) => a.id === accion).label}</div>
            <div className="flex items-center gap-3">
              <button onClick={copiar} style={{ color: C.aether2 }} className="inline-flex items-center gap-1 fs-11">{copiado ? <Check size={12} /> : <Copy size={12} />} Copiar</button>
              <button onClick={guardar} style={{ color: C.ok }} className="inline-flex items-center gap-1 fs-11"><Check size={12} /> Guardar</button>
            </div>
          </div>
          <textarea value={salida} onChange={(e) => setSalida(e.target.value)} placeholder={busy ? "La IA está redactando…" : ""} style={{ ...inS, minHeight: 300, resize: "vertical", lineHeight: 1.6, whiteSpace: "pre-wrap" }} />
        </div>
      )}

      {guardados.length > 0 && (
        <div>
          <div style={{ color: C.aether500, fontFamily: MONO, letterSpacing: "0.2em" }} className="fs-10 uppercase mb-2"><span style={{ color: C.aether }}>// </span>Guardados del canal</div>
          <div className="flex flex-col gap-2">
            {guardados.slice(0, 6).map((x) => (
              <div key={x.id} style={{ background: C.panel, border: `1px solid ${C.line}` }} className="rounded-xl p-3">
                <div style={{ color: C.mist }} className="fs-11"><b style={{ color: C.aether2 }}>{x.tipo}</b>{x.tema ? " · " + x.tema : ""} <span style={{ color: C.ash }}>{x.fecha}</span></div>
                <div style={{ color: C.mist, whiteSpace: "pre-wrap" }} className="fs-12 leading-snug mt-1">{(x.texto || "").slice(0, 200)}{(x.texto || "").length > 200 ? "…" : ""}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
