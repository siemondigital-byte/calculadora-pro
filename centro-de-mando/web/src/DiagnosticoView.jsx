// DIAGNÓSTICO DEL COMPRADOR — el formulario que Andrea llena EN LA LLAMADA con un posible
// comprador. Al llenarlo, cruza el perfil contra los PROYECTOS reales del workspace y sugiere
// los adecuados con razones VISIBLES (nada inventado: cada razón sale de datos del proyecto).
// Al guardar, upsert del lead con su diagnóstico y los proyectos sugeridos (una sola verdad).
import React, { useState } from "react";
import { Save, Copy } from "lucide-react";
import { C, MONO, SANS } from "./tema.js";
import { MOTOR, getToken } from "./db.js";

const inS = { background: C.carbon, border: `1px solid ${C.line}`, color: C.cream, borderRadius: 10, padding: "9px 12px", width: "100%", fontFamily: SANS, fontSize: 13, outline: "none" };
const lbl = { color: C.ash, fontFamily: MONO, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 4 };
const uid = () => (crypto?.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2, 10));
const hoyISO = () => new Date().toISOString().slice(0, 10);

const OBJETIVOS = ["Renta pasiva", "Plusvalía / apreciación", "Uso propio o segunda vivienda", "Diversificar en USD", "Migración / visa"];
const PAGOS = ["De contado", "Financiado con el constructor", "Crédito / hipoteca", "Por definir"];
const HORIZONTES = ["Entrega pronta (ya construido o < 1 año)", "Puedo esperar pre-construcción"];

// precioDesde llega como texto del constructor ("USD 250,000", "$185.000", "desde 320000 USD"…)
const precioNum = (s) => {
  const m = String(s || "").replace(/[.,](?=\d{3}\b)/g, "").match(/\d{4,9}/);
  return m ? parseInt(m[0], 10) : null;
};

// Matching determinista con RAZONES visibles. Sin IA: lo que se recomienda sale de los datos.
function evaluar(p, f) {
  if ((p.estado || "") === "cerrado") return null;
  const razones = [];
  const contras = [];
  let score = 0;
  const precio = precioNum(p.precioDesde);
  const presu = parseInt(String(f.presupuesto).replace(/\D/g, ""), 10) || null;
  if (precio && presu) {
    if (precio <= presu) { score += 3; razones.push(`Desde ${p.precioDesde}: dentro de su presupuesto`); }
    else if (precio <= presu * 1.15) { score += 1; razones.push(`Desde ${p.precioDesde}: algo por encima (≤15%)`); }
    else { contras.push(`Desde ${p.precioDesde}: fuera de su presupuesto`); }
  } else if (precio) { razones.push(`Desde ${p.precioDesde}`); }
  const ub = (f.ubicacion || "").trim().toLowerCase();
  if (ub) {
    const lugar = `${p.ciudad || ""} ${p.pais || ""}`.toLowerCase();
    if (lugar.includes(ub) || ub.split(/[\s,]+/).some((w) => w.length > 3 && lugar.includes(w))) {
      score += 2; razones.push(`Ubicación: ${p.ciudad || ""}${p.pais ? ", " + p.pais : ""} coincide con su preferencia`);
    }
  }
  const anio = parseInt(String(p.entrega || "").match(/20\d{2}/)?.[0] || "", 10);
  const anioActual = new Date().getFullYear();
  if (f.horizonte === HORIZONTES[0] && anio && anio <= anioActual + 1) { score += 1; razones.push(`Entrega ${p.entrega}: pronta, como necesita`); }
  if (f.horizonte === HORIZONTES[1] && anio && anio > anioActual + 1) { score += 1; razones.push(`Entrega ${p.entrega}: pre-construcción, puede esperar y entrar a mejor precio`); }
  if ((p.estado || "") === "en venta" || (p.estado || "") === "publicado") { score += 1; razones.push("Disponible ahora"); }
  return { p, score, razones, contras };
}

export default function DiagnosticoView({ data, commit, ws }) {
  const [f, setF] = useState({ nombre: "", email: "", telefono: "", residencia: "", idioma: "es",
    objetivo: OBJETIVOS[0], presupuesto: "", pago: PAGOS[0], horizonte: HORIZONTES[0],
    ubicacion: "", experiencia: "Primera inversión inmobiliaria", notas: "" });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const [msg, setMsg] = useState("");

  if (ws !== "atlantis") return <p className="text-gris">El diagnóstico del comprador vive en el workspace de Atlantis.</p>;
  const proyectos = data.atlantis?.proyectos || [];

  const evaluados = proyectos.map((p) => evaluar(p, f)).filter(Boolean).sort((a, b) => b.score - a.score);
  const adecuados = evaluados.filter((x) => x.score >= 3 && x.contras.length === 0);
  const alternos = evaluados.filter((x) => !adecuados.includes(x) && x.score > 0).slice(0, 3);

  const resumen = () => {
    const top = adecuados.slice(0, 3).map((x) => `· ${x.p.es?.nombre || x.p.slug} (${x.razones.join("; ")})${x.p.landingUrl ? " → " + x.p.landingUrl : ""}`);
    return `Diagnóstico ${f.nombre || "(comprador)"} · ${hoyISO()}\nObjetivo: ${f.objetivo} · Presupuesto: ${f.presupuesto || "?"} USD · Pago: ${f.pago}\nHorizonte: ${f.horizonte} · Ubicación: ${f.ubicacion || "indiferente"}\n\nProyectos sugeridos:\n${top.join("\n") || "· (ninguno calza aún)"}`;
  };

  // correo de seguimiento LISTO (determinístico, en su idioma): la automatización lo deja en
  // borrador dentro del lead — nada se envía solo (el sistema propone, Andrea dispara)
  const borradorCorreo = () => {
    const lista = adecuados.slice(0, 3).map((x) =>
      `- ${x.p.es?.nombre || x.p.slug} (${x.p.ciudad}${x.p.pais ? ", " + x.p.pais : ""})${x.p.landingUrl ? ": " + x.p.landingUrl : ""}`).join("\n");
    if (f.idioma === "en") {
      return `Subject: The projects we discussed, ${f.nombre.split(" ")[0] || ""}\n\nHi ${f.nombre.split(" ")[0] || ""},\n\nThank you for the conversation today. Based on what you shared (goal: ${f.objetivo}, budget around ${f.presupuesto || "?"} USD), these are the projects I would look at first:\n\n${lista || "- (to be defined)"}\n\nEach link has the full details. When you have looked at them, tell me which one caught your attention and we will go deeper on numbers and next steps.\n\nEducational content. This is not financial, legal or tax advice.\n\nAtlantis Global Realty`;
    }
    return `Asunto: Los proyectos que hablamos, ${f.nombre.split(" ")[0] || ""}\n\nHola ${f.nombre.split(" ")[0] || ""}:\n\nGracias por la conversación de hoy. Con lo que me contaste (objetivo: ${f.objetivo}, presupuesto alrededor de ${f.presupuesto || "?"} USD), estos son los proyectos que miraría primero:\n\n${lista || "- (por definir)"}\n\nCada enlace tiene el detalle completo. Cuando los veas, dime cuál te llamó la atención y profundizamos en números y siguientes pasos.\n\nContenido educativo. No es asesoría financiera, legal ni tributaria.\n\nAtlantis Global Realty`;
  };

  const guardar = () => {
    if (!f.nombre.trim() && !f.email.trim()) { setMsg("Pon al menos el nombre o el email."); return; }
    const siguiente = structuredClone(data);
    const leads = siguiente.atlantis.leads = siguiente.atlantis.leads || [];
    const email = f.email.trim().toLowerCase();
    let lead = email ? leads.find((l) => (l.email || "").toLowerCase() === email) : null;
    if (!lead) {
      lead = { id: uid(), creado: Date.now(), fuente: "diagnostico" };
      leads.push(lead);
    }
    lead.nombre = f.nombre.trim() || lead.nombre || "";
    if (email) lead.email = email;
    if (f.telefono.trim()) lead.telefono = f.telefono.trim();
    lead.etapa = lead.etapa && lead.etapa !== "Nuevo" ? lead.etapa : "Diagnóstico";
    lead.diagnostico = { ...f, fecha: hoyISO(),
      proyectosSugeridos: adecuados.slice(0, 5).map((x) => ({ slug: x.p.slug, nombre: x.p.es?.nombre || x.p.slug, razones: x.razones })) };
    // AUTOMATIZACIÓN al guardar (sin enviar nada solo):
    // 1) entra a Seguimiento en 2 días (la lista se limpia/llena sola)
    const en2 = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
    if (!lead.followUpDate || lead.followUpDate < hoyISO()) lead.followUpDate = en2;
    // 2) correo de seguimiento en BORRADOR con los proyectos y sus landings, en su idioma
    lead.borradorSeguimiento = borradorCorreo();
    // 3) nota con fecha en el historial del lead
    lead.notas = ((lead.notas || "") + `\n${hoyISO()} · Diagnóstico en llamada: ${f.objetivo}, ${f.presupuesto || "?"} USD, ${f.horizonte}. Sugeridos: ${adecuados.slice(0, 3).map((x) => x.p.es?.nombre || x.p.slug).join(", ") || "ninguno"}.`).trim();
    commit(siguiente);
    // 4) el RAG aprende el PATRÓN del comprador (sin datos personales: ni nombre ni contacto)
    try {
      fetch(MOTOR + "/rag/aprender", { method: "POST",
        headers: { "content-type": "application/json", Authorization: "Bearer " + getToken() },
        body: JSON.stringify({ tipo: "diagnostico",
          texto: `Perfil de comprador diagnosticado (${hoyISO()}): objetivo ${f.objetivo}; presupuesto ${f.presupuesto || "?"} USD; pago ${f.pago}; horizonte ${f.horizonte}; ubicación preferida ${f.ubicacion || "indiferente"}; experiencia ${f.experiencia}. Proyectos que calzaron: ${adecuados.slice(0, 3).map((x) => x.p.es?.nombre || x.p.slug).join(", ") || "ninguno"}.` }) }).catch(() => {});
    } catch { /* best-effort */ }
    setMsg(`Guardado ✓ ${lead.nombre || email} quedó en Leads con su diagnóstico, seguimiento para ${lead.followUpDate} y el correo de seguimiento en borrador (botón copiar abajo).`);
    setTimeout(() => setMsg(""), 6000);
  };

  return (
    <div style={{ fontFamily: SANS }}>
      <div className="mb-5">
        <div style={{ color: C.oro || "#D8B673", fontFamily: MONO, letterSpacing: "0.16em" }} className="text-[10px] uppercase mb-1">// Diagnóstico del comprador</div>
        <h1 style={{ color: C.cream, fontWeight: 700, fontSize: 24, margin: 0 }}>El formulario de la llamada</h1>
        <p style={{ color: C.ash, fontSize: 12.5, maxWidth: "64ch" }}>Llénalo mientras hablas: a medida que defines el perfil, abajo aparecen los proyectos adecuados con la razón de cada sugerencia. Al guardar, el comprador queda en Leads con su diagnóstico completo.</p>
      </div>

      {msg && <div className="tarjeta mb-4 !p-3" style={{ borderColor: C.oro || C.line, color: C.cream, fontSize: 13 }}>{msg}</div>}

      <div className="tarjeta mb-4 grid gap-3 sm:grid-cols-3">
        <div><label style={lbl}>Nombre</label><input style={inS} value={f.nombre} onChange={set("nombre")} placeholder="Nombre del comprador" /></div>
        <div><label style={lbl}>Email</label><input style={inS} type="email" value={f.email} onChange={set("email")} placeholder="correo@…" /></div>
        <div><label style={lbl}>Teléfono / WhatsApp</label><input style={inS} value={f.telefono} onChange={set("telefono")} placeholder="+…" /></div>
        <div><label style={lbl}>País de residencia</label><input style={inS} value={f.residencia} onChange={set("residencia")} placeholder="ej. Colombia, EE.UU." /></div>
        <div><label style={lbl}>Idioma</label><select style={inS} value={f.idioma} onChange={set("idioma")}><option value="es">Español</option><option value="en">English</option></select></div>
        <div><label style={lbl}>Experiencia</label><select style={inS} value={f.experiencia} onChange={set("experiencia")}>
          <option>Primera inversión inmobiliaria</option><option>Ya tiene propiedades</option><option>Inversionista activo</option></select></div>
      </div>

      <div className="tarjeta mb-4 grid gap-3 sm:grid-cols-3">
        <div><label style={lbl}>Objetivo principal</label><select style={inS} value={f.objetivo} onChange={set("objetivo")}>{OBJETIVOS.map((o) => <option key={o}>{o}</option>)}</select></div>
        <div><label style={lbl}>Presupuesto (USD)</label><input style={inS} value={f.presupuesto} onChange={set("presupuesto")} placeholder="ej. 250000" inputMode="numeric" /></div>
        <div><label style={lbl}>Forma de pago</label><select style={inS} value={f.pago} onChange={set("pago")}>{PAGOS.map((o) => <option key={o}>{o}</option>)}</select></div>
        <div><label style={lbl}>Horizonte de entrega</label><select style={inS} value={f.horizonte} onChange={set("horizonte")}>{HORIZONTES.map((o) => <option key={o}>{o}</option>)}</select></div>
        <div><label style={lbl}>Ubicación preferida</label><input style={inS} value={f.ubicacion} onChange={set("ubicacion")} placeholder="ej. Miami, Orlando, Medellín… (vacío = indiferente)" /></div>
        <div className="sm:col-span-3"><label style={lbl}>Notas de la llamada</label>
          <textarea style={{ ...inS, minHeight: 64, resize: "vertical" }} value={f.notas} onChange={set("notas")} placeholder="Lo que cuenta: su situación, dudas, objeciones, contexto familiar/fiscal…" /></div>
      </div>

      {/* Proyectos sugeridos EN VIVO */}
      <div className="mb-4">
        <div style={{ color: C.oro || "#D8B673", fontFamily: MONO }} className="text-[10px] uppercase mb-2">// Proyectos adecuados para este perfil ({adecuados.length})</div>
        {proyectos.length === 0 && <p style={{ color: C.ash, fontSize: 13 }}>No hay proyectos cargados aún (súbelos en el módulo Proyectos).</p>}
        {proyectos.length > 0 && adecuados.length === 0 && <p style={{ color: C.ash, fontSize: 13 }}>Con lo definido hasta ahora ninguno calza de lleno — ajusta presupuesto/ubicación o mira los alternos.</p>}
        {adecuados.map((x) => (
          <div key={x.p.slug} className="tarjeta mb-2 !p-3" style={{ borderColor: "rgba(216,182,115,0.45)" }}>
            <div className="flex items-center gap-2 flex-wrap">
              <span style={{ color: C.cream, fontWeight: 600, fontSize: 14 }}>{x.p.es?.nombre || x.p.slug}</span>
              <span style={{ color: C.ash, fontSize: 12 }}>{x.p.ciudad} · {x.p.pais} · {x.p.constructora}</span>
              {x.p.landingUrl && <a href={x.p.landingUrl} target="_blank" rel="noreferrer" className="text-xs text-oro hover:underline ml-auto">ver landing ↗</a>}
            </div>
            <ul style={{ color: C.mist, fontSize: 12.5, marginTop: 6, paddingLeft: 18 }}>
              {x.razones.map((r, i) => <li key={i}>{r}</li>)}
            </ul>
          </div>
        ))}
        {alternos.length > 0 && (
          <details className="mt-2">
            <summary style={{ color: C.ash, fontSize: 12, cursor: "pointer" }}>Alternos con reservas ({alternos.length})</summary>
            {alternos.map((x) => (
              <div key={x.p.slug} className="tarjeta mb-2 mt-2 !p-3">
                <span style={{ color: C.cream, fontSize: 13 }}>{x.p.es?.nombre || x.p.slug}</span>
                <div style={{ color: C.ash, fontSize: 12 }}>{[...x.razones, ...x.contras.map((c) => "⚠ " + c)].join(" · ")}</div>
              </div>
            ))}
          </details>
        )}
      </div>

      <div className="flex gap-3 flex-wrap">
        <button className="boton flex items-center gap-2" onClick={guardar}><Save size={14} /> Guardar diagnóstico en Leads</button>
        <button className="boton-secundario flex items-center gap-2" onClick={() => { navigator.clipboard?.writeText(resumen()); setMsg("Resumen copiado ✓ pégalo en el correo o WhatsApp de seguimiento."); setTimeout(() => setMsg(""), 4000); }}>
          <Copy size={14} /> Copiar resumen</button>
        <button className="boton-secundario flex items-center gap-2" onClick={() => { navigator.clipboard?.writeText(borradorCorreo()); setMsg("Correo de seguimiento copiado ✓ (asunto + cuerpo, en su idioma) — pégalo en Correo y envía cuando quieras."); setTimeout(() => setMsg(""), 5000); }}>
          <Copy size={14} /> Copiar correo de seguimiento</button>
      </div>
    </div>
  );
}
