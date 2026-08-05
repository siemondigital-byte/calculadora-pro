import React, { useState, useEffect } from "react";
import { Paintbrush, UploadCloud, Wand2, History, RefreshCw, Check, AlertTriangle, ArrowRight } from "lucide-react";
import { getToken } from "./db";

const C = {
  obsidian: "#0A0B0D", panel: "#16171C", carbon: "#131418", line: "rgba(255,255,255,0.08)",
  aether: "#B1A3E1", aether2: "#CBC0EC", aether500: "#8474BE", aetherSoft: "rgba(177,163,225,0.14)",
  aetherLine: "rgba(177,163,225,0.30)", cream: "#E9E5DD", mist: "#C9CAD2", ash: "#8B8D98",
  ok: "#7FB89B", warn: "#D8B673", danger: "#D08A8A",
};
const MONO = "'JetBrains Mono', ui-monospace, monospace";
const MOTOR = import.meta.env.VITE_MOTOR_URL || "https://prospeccion.siemondigital.com";
const H = () => ({ "content-type": "application/json", Authorization: "Bearer " + getToken() });

const URLS_VIVO = {
  "index.html": "https://siemondigital.com/",
  "main.js": "https://siemondigital.com/",
  "proposal.html": "https://siemondigital.com/proposal.html",
  "blog/index.html": "https://siemondigital.com/blog/",
  "download-guide/index.html": "https://siemondigital.com/download-guide/",
};

export default function MaquetadorView({ data, commit, flash }) {
  const [estado, setEstado] = useState(null);
  const [sel, setSel] = useState([]);
  const [busy, setBusy] = useState("");
  const [confirmar, setConfirmar] = useState(false);
  const [resPub, setResPub] = useState(null);
  const [resSol, setResSol] = useState(null);
  const [vers, setVers] = useState(null);
  const [diffs, setDiffs] = useState({});   // ruta -> {cargando, data}
  const [chkOpen, setChkOpen] = useState({});   // grupos del checklist abiertos
  async function verDetalle(ruta) {
    if (diffs[ruta]) { setDiffs((d) => ({ ...d, [ruta]: null })); return; }
    setDiffs((d) => ({ ...d, [ruta]: { cargando: true } }));
    try {
      const r = await fetch(MOTOR + "/web/diff?ruta=" + encodeURIComponent(ruta), { headers: H() });
      const j = await r.json();
      setDiffs((d) => ({ ...d, [ruta]: { cargando: false, data: j } }));
    } catch { setDiffs((d) => ({ ...d, [ruta]: { cargando: false, data: { ok: false } } })); }
  }
  const sols = (data.siemon.saludWeb && data.siemon.saludWeb.soluciones) || null;

  async function cargar() {
    try {
      const r = await fetch(MOTOR + "/web/estado", { headers: H() });
      setEstado(await r.json());
    } catch { flash("No pude conectar con el motor."); }
  }
  useEffect(() => { cargar(); }, []);

  // Auto-detecta (sin clic) qué puntos ⚡ ya están aplicados en la copia y los marca solos.
  const [chkSynced, setChkSynced] = useState(false);
  useEffect(() => {
    if (chkSynced) return;
    const s = (data.siemon.saludWeb && data.siemon.saludWeb.soluciones) || {};
    if (!s.title_propuesto && !s.description_propuesta && !(s.alts || []).length) { setChkSynced(true); return; }
    (async () => {
      try {
        const r = await fetch(MOTOR + "/web/aplicar_soluciones", { method: "POST", headers: H(), body: JSON.stringify({ dry_run: true }) });
        const d = await r.json();
        if (d && d.ok) {
          const pend = d.detalle || [];
          const hoy = new Date().toISOString().slice(0, 10);
          const ck = { ...(data.siemon.checklistWeb || {}) };
          let changed = false;
          const mark = (k) => { if (!ck[k]) { ck[k] = hoy; changed = true; } };
          if (s.title_propuesto && !pend.some((x) => x.campo === "Título SEO")) mark("sol-title");
          if (s.description_propuesta && !pend.some((x) => x.campo === "Meta description")) mark("sol-desc");
          (s.alts || []).forEach((a, i) => {
            const fn = (a.imagen || "").split("/").pop();
            const sigue = pend.some((x) => (x.campo || "").includes("Alt de imagen") && (x.campo || "").includes(fn));
            if (!sigue) mark("sol-alt-" + i);
          });
          if (changed) commit({ ...data, siemon: { ...data.siemon, checklistWeb: ck } });
        }
      } catch {}
      finally { setChkSynced(true); }
    })();
    // eslint-disable-next-line
  }, [chkSynced]);

  function toggle(ruta) { setConfirmar(false); setSel(sel.includes(ruta) ? sel.filter((x) => x !== ruta) : [...sel, ruta]); }

  const [preview, setPreview] = useState(null);   // {detalle:[{campo,antes,ahora}], ...}
  async function previsualizar() {
    setBusy("prev");
    try {
      const r = await fetch(MOTOR + "/web/aplicar_soluciones", { method: "POST", headers: H(), body: JSON.stringify({ dry_run: true }) });
      const d = await r.json();
      if (!d.ok) { setPreview(null); return flash("No pude previsualizar: " + (d.error || "")); }
      setPreview(d);
      if (!(d.detalle || []).length) flash("No hay cambios pendientes del sistema (la copia ya está al día).");
    } catch { flash("No pude conectar con el motor."); }
    finally { setBusy(""); }
  }
  async function aplicarSoluciones() {
    setBusy("sol");
    try {
      const r = await fetch(MOTOR + "/web/aplicar_soluciones", { method: "POST", headers: H(), body: JSON.stringify({}) });
      const d = await r.json();
      setResSol(d); setPreview(null);
      if (!d.ok) return flash("No pude aplicar: " + (d.error || ""));
      // AUTO-CHECK: los puntos ⚡ (title, description, alts) quedan marcados solos al aplicarse
      const s = (data.siemon.saludWeb && data.siemon.saludWeb.soluciones) || {};
      const hoy = new Date().toISOString().slice(0, 10);
      const ck = { ...(data.siemon.checklistWeb || {}) };
      if (s.title_propuesto) ck["sol-title"] = hoy;
      if (s.description_propuesta) ck["sol-desc"] = hoy;
      (s.alts || []).forEach((a, i) => { ck["sol-alt-" + i] = hoy; });
      commit({ ...data, siemon: { ...data.siemon, checklistWeb: ck } });
      flash(`Aplicado: ${(d.aplicados || []).length} cambios. Los puntos ⚡ se marcaron solos. Publica la home para que salga en vivo.`);
      cargar();
    } catch { flash("No pude conectar con el motor."); }
    finally { setBusy(""); }
  }

  async function publicar() {
    if (!sel.length) return flash("Marca los archivos que quieres publicar.");
    if (!confirmar) { setConfirmar(true); return; }
    setConfirmar(false); setBusy("pub"); flash("Publicando al hosting (con respaldo previo)…");
    try {
      const r = await fetch(MOTOR + "/web/publicar", { method: "POST", headers: H(), body: JSON.stringify({ rutas: sel }) });
      const d = await r.json();
      setResPub(d);
      if (!d.ok && !(d.resultado || []).some((x) => x.ok)) return flash("No pude publicar: " + (d.error || ""));
      flash(`Publicado: ${(d.resultado || []).filter((x) => x.ok).length} archivo(s). Abre tu web para verlo en vivo.`);
      setSel([]); cargar();
    } catch { flash("No pude conectar con el motor."); }
    finally { setBusy(""); }
  }

  async function cargarVersiones() {
    setBusy("ver");
    try {
      const r = await fetch(MOTOR + "/web/versiones", { headers: H() });
      setVers(await r.json());
    } catch { flash("No pude conectar con el motor."); }
    finally { setBusy(""); }
  }

  async function restaurar(version, ruta) {
    setBusy("res"); flash("Restaurando " + ruta + " a la versión " + version + "…");
    try {
      const r = await fetch(MOTOR + "/web/restaurar", { method: "POST", headers: H(), body: JSON.stringify({ version, ruta }) });
      const d = await r.json();
      if (!d.ok) return flash("No pude restaurar: " + (d.error || ""));
      flash("Restaurado y publicado: " + ruta + " volvió a la versión " + version + ".");
      cargar();
    } catch { flash("No pude conectar con el motor."); }
    finally { setBusy(""); }
  }

  const archivos = (estado && estado.archivos) || [];

  return (
    <div className="p-5 md:p-8" style={{ maxWidth: 1000 }}>
      <div className="mb-5">
        <div style={{ color: C.aether500, fontFamily: MONO, letterSpacing: "0.2em" }} className="fs-10 uppercase mb-2"><span style={{ color: C.aether }}>// </span>Tu web, publicada desde aquí</div>
        <h1 style={{ fontWeight: 600, color: C.cream }} className="fs-24 flex items-center gap-2"><Paintbrush size={20} color={C.aether} /> Maquetador</h1>
        <div style={{ color: C.ash }} className="fs-11 mt-1">El motor guarda la copia oficial de tus páginas. Aplicas las mejoras recomendadas, publicas con un clic (por FTP, con respaldo automático de lo que había) y puedes volver atrás cuando quieras.</div>
      </div>

      {estado && !estado.ftp_ok && (
        <div style={{ background: "rgba(208,138,138,0.08)", border: `1px solid rgba(208,138,138,0.3)`, color: C.danger }} className="rounded-xl p-3 mb-4 fs-12">FTP sin conexión: {estado.ftp_error}</div>
      )}

      {/* Editor visual (fase 2): vista previa fiel + edición clicando sobre la página */}
      <div style={{ background: C.aetherSoft, border: `1px solid ${C.aetherLine}` }} className="rounded-xl p-4 mb-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex-1 min-w-0">
            <div style={{ color: C.aether2, fontWeight: 600 }} className="fs-13">Editor visual: ve tu página y edítala clicando</div>
            <div style={{ color: C.mist }} className="fs-11 mt-0.5">Vista previa idéntica a la publicada. Cambias textos, imágenes y enlaces en el sitio mismo, ves cómo queda, y publicas cuando estés segura (con respaldo y "volver atrás"). Se conecta solo con tu sesión.</div>
          </div>
          <a href="/maquetador-editor.html" target="_blank" rel="noreferrer" style={{ background: C.aether, color: C.obsidian, fontWeight: 600 }} className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg fs-13 shrink-0"><Paintbrush size={14} /> Abrir editor visual</a>
        </div>
      </div>

      {/* Auto-checklist del estudio: agrupado, colapsable, con auto-marcado de los ⚡ */}
      {(() => {
        const sols2 = (data.siemon.saludWeb && data.siemon.saludWeb.soluciones) || {};
        const audit = data.siemon.auditoriaNegocio || {};
        // cada item lleva su grupo: sistema (⚡ auto) · estructura · mensaje
        const items = [];
        if (sols2.title_propuesto) items.push({ k: "sol-title", g: "sistema", txt: `Título SEO: "${sols2.title_propuesto}"` });
        if (sols2.description_propuesta) items.push({ k: "sol-desc", g: "sistema", txt: "Meta description nueva (persuasiva, con CTA)" });
        (sols2.alts || []).forEach((a, i) => items.push({ k: "sol-alt-" + i, g: "sistema", txt: `Alt de imagen: ${(a.imagen || "").split("/").pop()}` }));
        (sols2.jerarquia || []).forEach((x, i) => items.push({ k: "sol-jer-" + i, g: "estructura", txt: "Encabezados: " + x }));
        (sols2.enlaces || []).forEach((x, i) => items.push({ k: "sol-enl-" + i, g: "estructura", txt: `Enlace: ${x.solucion || x.enlace}` }));
        (audit.quick_wins || []).forEach((q, i) => items.push({ k: "qw-" + i, g: "mensaje", txt: q }));
        if (!items.length) return null;
        const ck = data.siemon.checklistWeb || {};
        const marcar = (k) => commit({ ...data, siemon: { ...data.siemon, checklistWeb: { ...ck, [k]: ck[k] ? undefined : new Date().toISOString().slice(0, 10) } } });
        const total = items.length, hechos = items.filter((i) => ck[i.k]).length;
        const GRUPOS = [
          { id: "sistema", icon: "⚡", label: "El sistema lo aplica", nota: "Se marcan solos al pulsar “Aplicar a la copia de la home” (abajo)." },
          { id: "estructura", icon: "📐", label: "Estructura (encabezados y enlaces)", nota: "Se ajustan en el editor visual." },
          { id: "mensaje", icon: "✍️", label: "Mensaje y conversión", nota: "Decisiones de copy y estrategia. Márcalas cuando las apliques." },
        ];
        return (
          <div style={{ background: C.panel, border: `1px solid ${C.line}` }} className="rounded-xl p-4 mb-4">
            <div className="flex items-center justify-between mb-1">
              <div style={{ color: C.aether500, fontFamily: MONO, letterSpacing: "0.14em" }} className="fs-10 uppercase">// Checklist del estudio de mercado</div>
              <span style={{ color: hechos === total ? C.ok : C.aether2, fontFamily: MONO }} className="fs-11">{hechos}/{total} listos</span>
            </div>
            <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: 6, height: 8 }} className="mb-3"><div style={{ width: `${Math.round((hechos / total) * 100)}%`, background: "rgba(127,184,155,0.25)", border: `1px solid ${C.ok}`, boxSizing: "border-box", height: 8, borderRadius: 6, transition: "width .3s" }} /></div>
            <div className="flex flex-col gap-2">
              {GRUPOS.map((g) => {
                const list = items.filter((i) => i.g === g.id);
                if (!list.length) return null;
                const gHechos = list.filter((i) => ck[i.k]).length, gDone = gHechos === list.length;
                const abierto = chkOpen[g.id] ?? (!gDone && g.id !== "sistema" ? false : false);   // colapsados por defecto
                return (
                  <div key={g.id} style={{ background: C.carbon, border: `1px solid ${gDone ? "rgba(127,184,155,0.3)" : C.line}`, borderRadius: 10 }}>
                    <button onClick={() => setChkOpen((o) => ({ ...o, [g.id]: !abierto }))} className="w-full flex items-center gap-2 px-3 py-2.5 text-left">
                      <span style={{ color: C.ash }} className="fs-11">{abierto ? "▾" : "▸"}</span>
                      <span className="fs-12">{g.icon}</span>
                      <span style={{ color: gDone ? C.ok : C.cream, fontWeight: 600 }} className="fs-12">{g.label}</span>
                      <span style={{ color: gDone ? C.ok : C.ash, fontFamily: MONO }} className="fs-10 ml-auto">{gDone ? "✓ " : ""}{gHechos}/{list.length}</span>
                    </button>
                    {abierto && (
                      <div className="px-3 pb-2.5">
                        <div style={{ color: C.ash }} className="fs-9 mb-1.5">{g.nota}</div>
                        {list.map((i) => (
                          <label key={i.k} className="flex items-start gap-2 py-1" style={{ cursor: "pointer" }}>
                            <input type="checkbox" checked={!!ck[i.k]} onChange={() => marcar(i.k)} className="mt-0.5" />
                            <span style={{ color: ck[i.k] ? C.ash : C.mist, textDecoration: ck[i.k] ? "line-through" : "none" }} className="fs-11">{g.id === "sistema" ? "⚡ " : ""}{i.txt}{ck[i.k] ? ` · ${ck[i.k]}` : ""}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Aplicar soluciones SEO */}
      <div style={{ background: C.panel, border: `1px solid ${C.aetherLine}` }} className="rounded-xl p-4 mb-4">
        <div style={{ color: C.aether500, fontFamily: MONO, letterSpacing: "0.14em" }} className="fs-10 uppercase mb-2">// Aplicar las soluciones SEO a la home</div>
        {!sols ? (
          <div style={{ color: C.ash }} className="fs-12">Primero genera las soluciones en Estudio de mercado → Salud → "Generar soluciones con IA". Luego aquí las aplicas al archivo real.</div>
        ) : (
          <div>
            <div style={{ color: C.mist }} className="fs-12 mb-2">Hay soluciones generadas {sols.fecha ? `el ${sols.fecha}` : ""}: title, description y alts propuestos. Se aplican con cambios quirúrgicos (si algo es ambiguo, no se toca y se reporta).</div>
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={previsualizar} disabled={!!busy} style={{ background: "transparent", border: `1px solid ${C.aetherLine}`, color: C.aether2, opacity: busy ? 0.6 : 1 }} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg fs-12"><Wand2 size={13} /> {busy === "prev" ? "Revisando…" : "Ver qué cambiará"}</button>
              <button onClick={aplicarSoluciones} disabled={!!busy} style={{ background: C.aether, color: C.obsidian, fontWeight: 600, opacity: busy ? 0.6 : 1 }} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg fs-12">{busy === "sol" ? "Aplicando…" : "Aplicar a la copia de la home"}</button>
            </div>
            {preview && (
              <div style={{ background: C.obsidian || "#0A0B0D", border: `1px solid ${C.line}`, borderRadius: 10 }} className="p-3 mt-3">
                <div style={{ color: C.aether2, fontFamily: MONO }} className="fs-10 uppercase mb-2">Vista previa · {(preview.detalle || []).length} cambio(s) que hará el sistema</div>
                {(preview.detalle || []).length === 0 ? (
                  <div style={{ color: C.ash }} className="fs-11">Nada por cambiar: la copia ya tiene estas soluciones.</div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {preview.detalle.map((c, i) => (
                      <div key={i} style={{ borderLeft: `2px solid ${C.aetherLine}` }} className="pl-2.5">
                        <div style={{ color: C.mist, fontFamily: MONO }} className="fs-10 uppercase mb-0.5">{c.campo}</div>
                        <div style={{ color: C.danger || "#D08A8A" }} className="fs-11"><span style={{ opacity: 0.6 }}>antes:</span> {c.antes || "(vacío)"}</div>
                        <div style={{ color: C.ok }} className="fs-11"><span style={{ opacity: 0.6 }}>ahora:</span> {c.ahora}</div>
                      </div>
                    ))}
                  </div>
                )}
                {(preview.saltados || []).length > 0 && <div style={{ color: C.warn }} className="fs-10 mt-2">⚠ No se tocan (ambiguo): {preview.saltados.join(" · ")}</div>}
                {(preview.detalle || []).length > 0 && <button onClick={aplicarSoluciones} disabled={!!busy} style={{ background: C.aether, color: C.obsidian, fontWeight: 600 }} className="mt-3 px-3.5 py-2 rounded-lg fs-12">✓ Autorizar y aplicar estos cambios</button>}
              </div>
            )}
            {resSol && resSol.ok && (
              <div className="mt-2 fs-11">
                {(resSol.aplicados || []).length > 0 && <div style={{ color: C.ok }}>✓ Aplicado: {resSol.aplicados.join(" · ")}</div>}
                {(resSol.saltados || []).length > 0 && <div style={{ color: C.warn }}>⚠ Sin tocar (ambiguo o no encontrado): {resSol.saltados.join(" · ")}</div>}
                <div style={{ color: C.ash }} className="mt-0.5">Ahora marca "Página principal" abajo y pulsa Publicar para que salga en vivo.</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Archivos y publicación */}
      <div style={{ background: C.panel, border: `1px solid ${C.line}` }} className="rounded-xl p-4 mb-4">
        <div style={{ color: C.aether500, fontFamily: MONO, letterSpacing: "0.14em" }} className="fs-10 uppercase mb-2">// Páginas ({archivos.length}) · marca y publica</div>
        <div style={{ color: C.ash }} className="fs-10 mb-2">Al publicar, cada archivo marcado sube a tu web EXACTAMENTE como está en la copia del motor: lo que ves al abrir el editor visual es lo que saldrá. "Editado" = último cambio en la copia; "publicado" = última vez que subió a la web.</div>
        {archivos.map((a) => (
          <label key={a.ruta} className="flex items-center gap-3 py-2" style={{ borderBottom: `1px solid ${C.line}`, cursor: "pointer" }}>
            <input type="checkbox" checked={sel.includes(a.ruta)} onChange={() => toggle(a.ruta)} disabled={!a.existe} />
            <div className="flex-1 min-w-0">
              <div style={{ color: C.cream }} className="fs-12">{a.nombre}</div>
              <div style={{ color: C.ash, fontFamily: MONO }} className="fs-9">{a.ruta} · editado {a.modificado ? a.modificado.replace("T", " ") : "—"} · {a.publicado ? `publicado ${a.publicado.replace("T", " ")}` : "nunca publicado desde aquí"}</div>
              {a.cambios && a.cambios !== "sin cambios respecto a lo publicado" && (
                <div className="mt-0.5">
                  <button onClick={() => verDetalle(a.ruta)} style={{ color: a.cambios.includes("primera vez") ? C.aether2 : C.warn }} className="fs-10 inline-flex items-center gap-1">
                    {diffs[a.ruta] && !diffs[a.ruta].cargando ? "▾" : "▸"} Sin publicar: {a.cambios} · <span style={{ textDecoration: "underline" }}>ver qué cambió</span>
                  </button>
                  {diffs[a.ruta] && (
                    <div style={{ background: C.carbon, border: `1px solid ${C.line}` }} className="rounded-lg p-3 mt-1.5">
                      {diffs[a.ruta].cargando ? <div style={{ color: C.ash }} className="fs-10">Analizando cambios…</div> : (() => {
                        const d = diffs[a.ruta].data || {};
                        if (d.primera_vez) return <div style={{ color: C.aether2 }} className="fs-11">Esta página nunca se ha publicado desde aquí: al publicar sube completa por primera vez.</div>;
                        const nada = !(d.cambiados || []).length && !(d.agregados || []).length && !(d.quitados || []).length;
                        if (nada) return <div style={{ color: C.ash }} className="fs-11">Cambios de formato o código (no de texto visible).</div>;
                        return (<div className="flex flex-col gap-1.5">
                          {(d.cambiados || []).map((c, i) => <div key={"c" + i} className="fs-11"><span style={{ color: C.warn, fontFamily: MONO }}>~ cambió</span> <span style={{ color: C.ash, textDecoration: "line-through" }}>{c.antes}</span> <span style={{ color: C.aether500 }}>→</span> <span style={{ color: C.cream }}>{c.ahora}</span></div>)}
                          {(d.agregados || []).map((x, i) => <div key={"a" + i} className="fs-11"><span style={{ color: C.ok, fontFamily: MONO }}>+ nuevo</span> <span style={{ color: C.cream }}>{x}</span></div>)}
                          {(d.quitados || []).map((x, i) => <div key={"q" + i} className="fs-11"><span style={{ color: C.danger, fontFamily: MONO }}>− quitado</span> <span style={{ color: C.ash }}>{x}</span></div>)}
                        </div>);
                      })()}
                    </div>
                  )}
                </div>
              )}
              {a.cambios === "sin cambios respecto a lo publicado" && <div style={{ color: C.ok }} className="fs-10 mt-0.5">✓ ya publicado, sin cambios pendientes</div>}
            </div>
            {URLS_VIVO[a.ruta] && <a href={URLS_VIVO[a.ruta]} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} style={{ color: C.aether2 }} className="fs-10 inline-flex items-center gap-1 shrink-0">ver en vivo <ArrowRight size={10} /></a>}
          </label>
        ))}
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <button onClick={publicar} disabled={!!busy || !sel.length} style={{ background: confirmar ? C.danger : C.aether, color: C.obsidian, fontWeight: 600, opacity: busy || !sel.length ? 0.5 : 1 }} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg fs-12">
            <UploadCloud size={14} /> {busy === "pub" ? "Publicando…" : confirmar ? `¿Confirmas? Esto cambia tu web EN VIVO (${sel.length})` : `Publicar seleccionados (${sel.length})`}
          </button>
          {confirmar && <button onClick={() => setConfirmar(false)} style={{ color: C.ash }} className="fs-12">Cancelar</button>}
          <button onClick={cargar} style={{ color: C.ash }} className="inline-flex items-center gap-1 fs-11"><RefreshCw size={11} /> actualizar</button>
        </div>
        {resPub && (resPub.resultado || []).length > 0 && (
          <div className="mt-2 fs-11">
            {resPub.resultado.map((x, i) => (
              <div key={i} style={{ color: x.ok ? C.ok : C.danger }} className="flex items-center gap-1.5">
                {x.ok ? <Check size={11} /> : <AlertTriangle size={11} />} {x.ruta} {x.ok ? (x.respaldo ? `(respaldo ${x.respaldo})` : "(archivo nuevo en el hosting)") : `— ${x.error}`}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Versiones */}
      <div style={{ background: C.panel, border: `1px solid ${C.line}` }} className="rounded-xl p-4">
        <button onClick={cargarVersiones} style={{ color: C.aether2 }} className="inline-flex items-center gap-1.5 fs-12"><History size={13} /> {busy === "ver" ? "Cargando…" : "Ver versiones anteriores (respaldo de cada publicación)"}</button>
        {vers && (vers.versiones || []).length === 0 && <div style={{ color: C.ash }} className="fs-11 mt-2">Aún no hay respaldos: se crean solos con cada publicación.</div>}
        {vers && (vers.versiones || []).map((v) => (
          <div key={v.version} className="mt-2" style={{ borderTop: `1px solid ${C.line}`, paddingTop: 8 }}>
            <div style={{ color: C.mist, fontFamily: MONO }} className="fs-10">{v.version.replace("_", " ")}</div>
            {v.rutas.map((r) => (
              <div key={r} className="flex items-center gap-2 mt-1">
                <span style={{ color: C.ash, fontFamily: MONO }} className="fs-10 flex-1">{r}</span>
                <button onClick={() => restaurar(v.version, r)} disabled={!!busy} style={{ color: C.warn, border: `1px solid rgba(216,182,115,0.4)` }} className="px-2 py-0.5 rounded fs-10">Restaurar esta versión</button>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
