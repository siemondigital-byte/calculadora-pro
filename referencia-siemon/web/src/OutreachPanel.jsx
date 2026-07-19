import React, { useState, useMemo, useEffect } from "react";
import { X, Send, Mail, MessageCircle, Instagram, Youtube, Linkedin, Facebook, Twitter, Music2, Copy, Check, ExternalLink, Sparkles } from "lucide-react";
import { getToken } from "./db";

const MOTOR = import.meta.env.VITE_MOTOR_URL || "https://prospeccion.siemondigital.com";

const C = {
  obsidian: "#0A0B0D", panel: "#16171C", panel2: "#1B1D23", carbon: "#131418", line: "rgba(255,255,255,0.08)",
  aether: "#B1A3E1", aether2: "#CBC0EC", aether500: "#8474BE", aetherSoft: "rgba(177,163,225,0.14)",
  aetherLine: "rgba(177,163,225,0.30)", cream: "#E9E5DD", mist: "#C9CAD2", ash: "#8B8D98",
  ok: "#7FB89B", okSoft: "rgba(127,184,155,0.14)", danger: "#D08A8A",
};
const SANS = "'Montserrat', system-ui, sans-serif";
const MONO = "'JetBrains Mono', ui-monospace, monospace";
const ENVIAR_URL = import.meta.env.VITE_ENVIAR_URL || "https://hooks.siemondigital.com/webhook/enviar-outreach";

const primerNombre = (n) => {
  const t = (n || "").trim().split(/\s+/)[0] || "";
  return /^[a-zA-Z0-9_.@]+$/.test(t) && (t.includes("_") || t.includes(".")) ? "" : t; // evita handles como nombre
};
const nichoDe = (p) => {
  const parts = (p.categoria || "").split("·");
  return (parts.length > 1 ? parts.slice(1).join("·") : (p.categoria || p.servicio || "")).trim().toLowerCase();
};
// ingles si el pais/idioma lo sugiere
const esIngles = (p) => /\b(us|usa|gb|uk|united|states|kingdom|canada|australia|ireland|en)\b/i.test(
  ((p.pais || "") + " " + (p.ciudad || "") + " " + (p.idioma || "")).trim());
const esCreador = (p) => ["youtube", "instagram"].includes(p.canal || p.fuente) || p.tipo === "creador";

// Mensajes en voz de marca ("Amplifica tu potencial"), personalizados por nicho.
// Editables. Cero guiones largos.
function plantilla(canal, p) {
  const n = primerNombre(p.nombre);
  const hola = n ? "Hola " + n : "Hola";
  const hi = n ? "Hi " + n : "Hi";
  const nicho = nichoDe(p);
  const en = esIngles(p);
  const creador = esCreador(p);
  const sobre = nicho ? (en ? `your work on ${nicho}` : `tu trabajo en ${nicho}`) : (en ? "your work" : "tu trabajo");
  const quienes = creador
    ? (en ? "creators like you amplify their impact with tailored AI and automation, without losing your essence"
          : "creadores como tú a amplificar su impacto con IA y automatización a la medida, sin perder tu esencia")
    : (en ? "businesses grow with structure using AI and automation that fit them, not generic formulas"
          : "negocios a crecer con orden con IA y automatización a la medida, sin fórmulas genéricas");

  if (p.mensaje) return { asunto: en ? `An idea for you` : `Una idea para ti`, cuerpo: p.mensaje };

  if (canal === "email") {
    return en ? {
      asunto: `${n || "Hi"}, an idea to amplify what you already do`,
      cuerpo: `${hi},\n\nI'm Andrea, from Siemon Digital. I came across ${sobre} and I really liked your approach.\n\n` +
        `At Siemon we don't replace your formula, we amplify what you already do well: with tailored AI and automation so your time pays off and you grow with structure.\n\n` +
        `I have a concrete idea for you. Can I share it in a short 15 minute call, no strings attached?\n\nWarmly,\nAndrea`,
    } : {
      asunto: `${n || "Hola"}, una idea para amplificar lo que ya haces`,
      cuerpo: `${hola},\n\nSoy Andrea, de Siemon Digital. Me crucé con ${sobre} y me gustó de verdad tu enfoque.\n\n` +
        `En Siemon no venimos a cambiarte la fórmula, venimos a amplificar lo que ya haces bien: con IA y automatización a la medida para que tu tiempo rinda y crezcas con orden.\n\n` +
        `Tengo una idea concreta para ti. ¿Te la comparto en una llamada corta de 15 minutos, sin compromiso?\n\nUn abrazo,\nAndrea`,
    };
  }
  if (canal === "whatsapp") {
    return { cuerpo: en
      ? `${hi} 👋 I'm Andrea, from Siemon Digital. I saw ${sobre} and loved it. I have an idea to amplify what you already do with AI and automation. Can I tell you in a short call this week?`
      : `${hola} 👋 Soy Andrea, de Siemon Digital. Vi ${sobre} y me encantó. Tengo una idea para amplificar lo que ya haces con IA y automatización. ¿Te la cuento en una llamada corta esta semana?` };
  }
  if (["instagram", "youtube", "tiktok", "twitter", "facebook"].includes(canal)) {
    const donde = canal === "youtube" ? (en ? "your channel" : "tu canal") : (en ? "your content" : "tu contenido");
    return { cuerpo: en
      ? `Hi! I'm Andrea, from Siemon Digital. I love ${donde} on ${nicho || "what you do"}. At Siemon we help ${quienes}. Can I share a quick idea here?`
      : `¡Hola! Soy Andrea, de Siemon Digital. Me encanta ${donde} sobre ${nicho || "lo que haces"}. En Siemon ayudamos a ${quienes}. ¿Te comparto una idea rápida por aquí?` };
  }
  // linkedin
  return { cuerpo: en
    ? `${hi}, I'm Andrea, from Siemon Digital. I liked ${sobre} and would love to connect. We help ${quienes}. If it resonates, I'll share a concrete idea for your case.`
    : `${hola}, soy Andrea, de Siemon Digital. Me gustó ${sobre} y me encantaría conectar. Ayudamos a ${quienes}. Si te resuena, te comparto una idea concreta para tu caso.` };
}

function digits(tel) { return (tel || "").replace(/[^\d]/g, ""); }

export default function OutreachPanel({ p, onClose, flash, onContactado, onDraft, firmaPersonal, firmaMarca }) {
  const r = p.redes || {};
  const canales = useMemo(() => {
    const cs = [];
    if (p.email) cs.push({ id: "email", label: "Email", icon: Mail, via: "tu buzón · tu firma" });
    if (p.telefono) cs.push({ id: "whatsapp", label: "WhatsApp", icon: MessageCircle, via: "abre WhatsApp con el mensaje" });
    if (r.instagram) cs.push({ id: "instagram", label: "Instagram", icon: Instagram, via: "copia y abre el perfil" });
    if (r.tiktok) cs.push({ id: "tiktok", label: "TikTok", icon: Music2, via: "copia y abre el perfil" });
    if (r.twitter) cs.push({ id: "twitter", label: "X", icon: Twitter, via: "copia y abre el perfil" });
    if (r.linkedin) cs.push({ id: "linkedin", label: "LinkedIn", icon: Linkedin, via: "copia y abre el perfil" });
    if (r.facebook) cs.push({ id: "facebook", label: "Facebook", icon: Facebook, via: "copia y abre el perfil" });
    // YouTube al final: NO tiene mensajes privados, solo sirve para ver su 'Acerca de' / comentar
    if (r.youtube || (p.canal || p.fuente) === "youtube") cs.push({ id: "youtube", label: "YouTube", icon: Youtube, via: "YouTube no tiene DM · úsalo para ver su canal o buscar su email" });
    return cs;
  }, [p]);

  const [canal, setCanal] = useState(canales[0] ? canales[0].id : "email");
  const inicial = plantilla(canal, p);
  const [asunto, setAsunto] = useState(p.asuntoFrio || inicial.asunto || "");
  const [cuerpo, setCuerpo] = useState(p.mensaje || inicial.cuerpo || "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [copiado, setCopiado] = useState(false);

  const [generando, setGenerando] = useState(false);
  const [buzones, setBuzones] = useState([]);
  const [buzonSel, setBuzonSel] = useState("");
  useEffect(() => {
    fetch(MOTOR + "/buzones", { headers: { Authorization: "Bearer " + getToken() } })
      .then((r) => r.json()).then((d) => {
        const lista = d.buzones || [];
        setBuzones(lista);
        const hello = lista.find((b) => (b.email || "").toLowerCase().startsWith("hello@"));
        setBuzonSel((hello || lista[0] || {}).id || "");
      }).catch(() => {});
  }, []);

  // Redacta el mensaje con IA (voz de marca, personalizado). La plantilla es respaldo instantáneo.
  async function generarIA(cnl, force) {
    if (!force && p.mensaje) return;          // auto: respeta uno ya redactado; el botón fuerza
    setGenerando(true);
    try {
      const r = await fetch(MOTOR + "/generar_mensaje", {
        method: "POST", headers: { "content-type": "application/json", Authorization: "Bearer " + getToken() },
        body: JSON.stringify({ prospecto: p, canal: cnl }),
      });
      const d = await r.json();
      if (d && d.cuerpo) {
        setCuerpo(d.cuerpo);
        const asu = (cnl === "email" && d.asunto) ? d.asunto : asunto;
        if (cnl === "email" && d.asunto) setAsunto(d.asunto);
        if (typeof onDraft === "function") onDraft({ mensaje: d.cuerpo, asuntoFrio: asu });   // persistir: no se pierde al cerrar
      }
    } catch (e) { /* se queda la plantilla */ }
    finally { setGenerando(false); }
  }

  // NO redacta solo: queda la plantilla base y tú decides cuándo usar la IA ("Redactar con IA").

  function cambiarCanal(id) {
    setCanal(id); setErr(""); setCopiado(false);
    const t = plantilla(id, p);
    setAsunto(t.asunto || ""); setCuerpo(t.cuerpo || "");
  }

  async function enviarEmail() {
    if (!asunto.trim() || !cuerpo.trim()) { setErr("Escribe el asunto y el mensaje."); return; }
    if (!buzonSel) { setErr("No hay buzón configurado. Configúralo en Correo en frío → Gestionar."); return; }
    setBusy(true); setErr("");
    try {
      const bz = buzones.find((b) => b.id === buzonSel) || {};
      const esHello = (bz.email || "").toLowerCase().startsWith("hello@");
      const firma_html = esHello ? (firmaMarca || firmaPersonal || "") : (firmaPersonal || "");
      const res = await fetch(MOTOR + "/enviar_correo", {
        method: "POST", headers: { "content-type": "application/json", Authorization: "Bearer " + getToken() },
        body: JSON.stringify({ buzon_id: buzonSel, to: p.email, subject: asunto, cuerpo, firma_html, nombre: p.nombre || "" }),
      });
      const d = await res.json();
      if (!d.ok) throw new Error(d.error || "HTTP " + res.status);
      flash("Correo enviado a " + p.email + (d.desde ? " desde " + d.desde : "") + " (con tu firma)");
      onContactado("email", "Email: " + asunto);
      onClose();
    } catch (e) { setErr("No se pudo enviar: " + (e.message || "revisa el buzón")); }
    finally { setBusy(false); }
  }

  function enviarWhatsApp() {
    const url = "https://wa.me/" + digits(p.telefono) + "?text=" + encodeURIComponent(cuerpo);
    window.open(url, "_blank");
    onContactado("whatsapp", "WhatsApp preparado");
    flash("Abrí WhatsApp con tu mensaje listo para enviar.");
    onClose();
  }

  async function copiarYAbrir(tipo) {
    try { await navigator.clipboard.writeText(cuerpo); setCopiado(true); } catch {}
    const url = { instagram: r.instagram, linkedin: r.linkedin, tiktok: r.tiktok, twitter: r.twitter, facebook: r.facebook, youtube: (r.youtube || p.web) }[tipo] || p.web;
    if (url) window.open(url, "_blank");
    const nom = { instagram: "Instagram", linkedin: "LinkedIn", youtube: "YouTube", tiktok: "TikTok", twitter: "X", facebook: "Facebook" }[tipo] || tipo;
    onContactado(tipo, nom + ": mensaje copiado");
    const donde = { instagram: "el DM de Instagram", linkedin: "el mensaje de LinkedIn", tiktok: "el DM de TikTok", twitter: "el DM de X", facebook: "Messenger de Facebook", youtube: "el canal (YouTube no tiene DM: busca su email o comenta)" }[tipo] || "su perfil";
    flash("Mensaje copiado. Pégalo en " + donde + ".");
  }

  function accionar() {
    if (canal === "email") return enviarEmail();
    if (canal === "whatsapp") return enviarWhatsApp();
    return copiarYAbrir(canal);
  }

  const inS = { background: C.carbon, border: `1px solid ${C.line}`, color: C.cream, borderRadius: 10,
    padding: "10px 12px", width: "100%", fontFamily: SANS, fontSize: 14, outline: "none" };
  const cfg = canales.find((c) => c.id === canal) || {};
  const btnLabel = canal === "email" ? "Enviar correo" : canal === "whatsapp" ? "Abrir WhatsApp" : "Copiar y abrir";

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: C.panel, border: `1px solid ${C.line}`, width: 580, maxWidth: "96vw" }} className="rounded-2xl">
        <div style={{ borderBottom: `1px solid ${C.line}` }} className="px-5 py-4 flex items-center justify-between">
          <div>
            <div style={{ color: C.aether500, fontFamily: MONO, letterSpacing: "0.16em" }} className="fs-10 uppercase"><span style={{ color: C.aether }}>// </span>Contactar</div>
            <div style={{ color: C.cream, fontWeight: 600 }} className="fs-15 mt-0.5">{p.nombre}</div>
          </div>
          <button onClick={onClose} style={{ color: C.ash }}><X size={18} /></button>
        </div>

        {canales.length === 0 ? (
          <div className="p-6 fs-13" style={{ color: C.ash }}>Este prospecto no tiene canales de contacto públicos (email, teléfono ni redes). Busca su web o redes para poder escribirle.</div>
        ) : (
          <div className="p-5">
            {/* selector de canal */}
            <div className="flex flex-wrap gap-2 mb-3">
              {canales.map((c) => {
                const on = c.id === canal; const Ico = c.icon;
                return (
                  <button key={c.id} onClick={() => cambiarCanal(c.id)}
                    style={{ background: on ? C.aetherSoft : C.carbon, border: `1px solid ${on ? C.aetherLine : C.line}`, color: on ? C.aether2 : C.mist }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg fs-12"><Ico size={14} /> {c.label}</button>);
              })}
            </div>
            {canal === "email" ? (
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <span style={{ color: C.ash }} className="fs-11">// enviando desde</span>
                <select value={buzonSel} onChange={(e) => setBuzonSel(e.target.value)} style={{ background: C.carbon, color: C.mist, border: `1px solid ${C.line}`, borderRadius: 8, padding: "5px 8px", fontFamily: MONO, fontSize: 11, outline: "none" }}>
                  {buzones.length === 0 && <option value="">(sin buzón configurado)</option>}
                  {buzones.map((b) => <option key={b.id} value={b.id}>{b.email}</option>)}
                </select>
                <span style={{ color: C.ash }} className="fs-11">· con tu firma del CRM</span>
              </div>
            ) : (
              <div style={{ color: C.ash }} className="fs-11 mb-3">// {cfg.via}</div>
            )}

            {canal === "email" && (
              <div className="mb-3">
                <label style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase">Asunto</label>
                <input style={inS} value={asunto} onChange={(e) => setAsunto(e.target.value)} />
              </div>
            )}
            <div className="flex items-center justify-between mb-1">
              <label style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase">Mensaje (edítalo a tu gusto)</label>
              <button type="button" onClick={() => generarIA(canal, true)} disabled={generando} title="Redactar de nuevo con IA usando el estudio del prospecto"
                style={{ color: generando ? C.ash : C.aether2 }} className="inline-flex items-center gap-1 fs-11">
                <Sparkles size={12} />{generando ? "Redactando…" : "Redactar con IA"}</button>
            </div>
            <div style={{ position: "relative" }}>
              <textarea style={{ ...inS, minHeight: 175, resize: "vertical", lineHeight: 1.6, opacity: generando ? 0.6 : 1 }} value={cuerpo} onChange={(e) => setCuerpo(e.target.value)} onBlur={() => { if (typeof onDraft === "function") onDraft({ mensaje: cuerpo, asuntoFrio: asunto }); }} />
              {generando && <div style={{ position: "absolute", top: 8, right: 10, color: C.aether500, fontFamily: MONO }} className="fs-10 animate-pulse">✨ IA redactando…</div>}
            </div>

            <div style={{ color: C.ash }} className="fs-11 flex items-center gap-1.5 mt-3">
              {canal === "email" ? <><Mail size={13} /> Se envía desde tu buzón con la <b style={{ color: C.mist }}>firma configurada en el CRM</b>.</>
                : canal === "whatsapp" ? <><MessageCircle size={13} /> Se abre WhatsApp con el mensaje listo.</>
                : <><ExternalLink size={13} /> Copio el mensaje y abro el perfil para que lo pegues.</>}
            </div>
            {err && <div style={{ color: C.danger }} className="fs-12 mt-2">{err}</div>}

            <div className="flex items-center justify-end gap-2 pt-4">
              <button onClick={onClose} style={{ color: C.mist, border: `1px solid ${C.line}` }} className="px-3.5 py-2 rounded-lg fs-13">Cancelar</button>
              <button onClick={accionar} disabled={busy} style={{ background: C.aether, color: C.obsidian, fontWeight: 600, opacity: busy ? 0.6 : 1 }} className="flex items-center gap-2 px-4 py-2 rounded-lg fs-13">
                {canal === "email" ? <Send size={15} strokeWidth={2.4} /> : copiado ? <Check size={15} /> : canal === "whatsapp" ? <MessageCircle size={15} /> : <Copy size={15} />}
                {busy ? "Enviando..." : btnLabel}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
