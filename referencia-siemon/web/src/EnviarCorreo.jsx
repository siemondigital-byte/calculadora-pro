import React, { useState } from "react";
import { X, Send, Mail } from "lucide-react";

const C = {
  obsidian: "#0A0B0D", panel: "#16171C", carbon: "#131418", line: "rgba(255,255,255,0.08)",
  aether: "#B1A3E1", aether2: "#CBC0EC", aether500: "#8474BE", cream: "#E9E5DD",
  mist: "#C9CAD2", ash: "#8B8D98", ok: "#7FB89B", danger: "#D08A8A",
};
const SANS = "'Montserrat', system-ui, sans-serif";
const MONO = "'JetBrains Mono', ui-monospace, monospace";
const ENVIAR_URL = import.meta.env.VITE_ENVIAR_URL || "https://hooks.siemondigital.com/webhook/enviar-outreach";

const inS = { background: C.carbon, border: `1px solid ${C.line}`, color: C.cream, borderRadius: 10,
  padding: "10px 12px", width: "100%", fontFamily: SANS, fontSize: 14, outline: "none" };

// Editor de correo: escribes/editas y al enviar sale por n8n desde andrea@ con tu firma.
export default function EnviarCorreo({ lead, onClose, flash, onSent, initialSubject, initialBody }) {
  const nombre = (lead.name || "").split(" ")[0];
  const [subject, setSubject] = useState(initialSubject || "");
  const [cuerpo, setCuerpo] = useState(initialBody || (nombre ? "Hola " + nombre + ",\n\n" : "Hola,\n\n"));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function enviar() {
    if (!lead.email) { setErr("Este lead no tiene email."); return; }
    if (!subject.trim() || !cuerpo.trim()) { setErr("Escribe el asunto y el mensaje."); return; }
    setBusy(true); setErr("");
    try {
      const r = await fetch(ENVIAR_URL, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ to: lead.email, subject, cuerpo, lang: lead.language || "es" }),
      });
      if (!r.ok) throw new Error("HTTP " + r.status);
      flash("Correo enviado a " + lead.email);
      if (onSent) onSent("Correo enviado (" + subject + ")");
      onClose();
    } catch (e) {
      setErr("No se pudo enviar. Revisa que el workflow de n8n este activo.");
    } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: C.panel, border: `1px solid ${C.line}`, width: 560, maxWidth: "96vw" }} className="rounded-2xl">
        <div style={{ borderBottom: `1px solid ${C.line}` }} className="px-5 py-4 flex items-center justify-between">
          <div>
            <div style={{ color: C.aether500, fontFamily: MONO, letterSpacing: "0.16em" }} className="fs-10 uppercase"><span style={{ color: C.aether }}>// </span>Escribir correo</div>
            <div style={{ color: C.cream, fontWeight: 600 }} className="fs-15 mt-0.5">Para: {lead.name || lead.email} <span style={{ color: C.ash }} className="fs-12">{lead.email}</span></div>
          </div>
          <button onClick={onClose} style={{ color: C.ash }}><X size={18} /></button>
        </div>
        <div className="p-5 flex flex-col gap-3">
          <div>
            <label style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase">Asunto</label>
            <input style={inS} value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Asunto del correo" autoFocus />
          </div>
          <div>
            <label style={{ color: C.ash, fontFamily: MONO }} className="fs-10 uppercase">Mensaje</label>
            <textarea style={{ ...inS, minHeight: 200, resize: "vertical", lineHeight: 1.6 }} value={cuerpo} onChange={(e) => setCuerpo(e.target.value)} />
          </div>
          <div style={{ color: C.ash }} className="fs-11 flex items-center gap-1.5">
            <Mail size={13} /> Se envia desde <b style={{ color: C.mist }}>andrea@siemondigital.com</b> con tu firma personal (se agrega sola).
          </div>
          {err && <div style={{ color: C.danger }} className="fs-12">{err}</div>}
          <div className="flex items-center justify-end gap-2 pt-1">
            <button onClick={onClose} style={{ color: C.mist, border: `1px solid ${C.line}` }} className="px-3.5 py-2 rounded-lg fs-13">Cancelar</button>
            <button onClick={enviar} disabled={busy} style={{ background: C.aether, color: C.obsidian, fontWeight: 600, opacity: busy ? 0.6 : 1 }} className="flex items-center gap-2 px-4 py-2 rounded-lg fs-13">
              <Send size={15} strokeWidth={2.4} />{busy ? "Enviando..." : "Enviar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
