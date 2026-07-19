import React, { useState } from "react";
import { KeyRound, Plus, Trash2, Eye, EyeOff, Copy, ArrowRight, ShieldCheck } from "lucide-react";
import { getToken, setToken } from "./db";

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
const uid = () => (crypto?.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2, 9));
const H = () => ({ "content-type": "application/json", Authorization: "Bearer " + getToken() });

// accesos precargados la primera vez (los secretos los completas tú; algunos ya vienen)
export const SEMILLA = [
  { servicio: "Centro de Mando (este CRM)", url: "https://crm.siemondigital.com", usuario: "(solo contraseña)", clave: "", notas: "La contraseña se cambia aquí arriba. El editor visual y la API usan la misma." },
  { servicio: "Motor de prospección / API", url: "https://prospeccion.siemondigital.com", usuario: "", clave: "", notas: "El backend del CRM (prospección, nurturing, correos, publicación web). Usa la misma clave del Centro de Mando." },
  { servicio: "Automatizaciones (n8n)", url: "https://hooks.siemondigital.com", usuario: "", clave: "", notas: "Webhooks y crons: guía, propuestas, post-llamada, nurturing horario, mercado semanal." },
  { servicio: "Publicador (Postiz)", url: "https://publicar.siemondigital.com", usuario: "", clave: "", notas: "Conexión de redes sociales para publicar/programar (YouTube y Bluesky activas)." },
  { servicio: "Analítica (Umami)", url: "https://analitica.siemondigital.com", usuario: "admin", clave: "", notas: "Métricas de la web. El módulo Analítica del CRM ya las muestra sin entrar aquí." },
  { servicio: "Hostinger (hosting web)", url: "https://hpanel.hostinger.com", usuario: "", clave: "", notas: "La web siemondigital.com. El FTP ya está configurado en el motor (no hace falta entrar para publicar)." },
  { servicio: "Formulario de diagnóstico", url: "https://siemondigital.com/formulario-descubrimiento/", usuario: "(solo contraseña)", clave: "", notas: "El formulario que llenas en la llamada. Su clave está cifrada (hash): si la olvidas, se pone una nueva, no se recupera." },
  { servicio: "Google Cloud (API de YouTube)", url: "https://console.cloud.google.com", usuario: "", clave: "", notas: "Donde vive la YOUTUBE_API_KEY que usa la prospección de canales. La key está guardada en el motor." },
  { servicio: "Apify (keywords)", url: "https://console.apify.com", usuario: "", clave: "", notas: "Inteligencia de keywords (actor Ubersuggest). El token está en el .env del motor." },
  { servicio: "Google Search Console", url: "https://search.google.com/search-console", usuario: "", clave: "", notas: "Rendimiento SEO de siemondigital.com (dominio verificado)." },
  { servicio: "Píxel de Meta", url: "https://business.facebook.com", usuario: "", clave: "", notas: "Pega aquí el ID del píxel cuando lo crees (15-16 dígitos)." },
];

export default function AccesosView({ data, commit, flash }) {
  const accesos = data.siemon.accesos || [];
  const [ver, setVer] = useState({});
  const [showNuevo, setShowNuevo] = useState(false);
  const [nv, setNv] = useState({ servicio: "", url: "", usuario: "", clave: "", notas: "" });
  const [cl, setCl] = useState({ actual: "", nueva: "", repite: "" });
  const [busy, setBusy] = useState(false);
  const [fp, setFp] = useState({ nueva: "", repite: "" });
  const [busyFp, setBusyFp] = useState(false);
  const fpFecha = data.siemon.formularioClaveFecha || "";
  const diasDesde = fpFecha ? Math.floor((Date.now() - new Date(fpFecha).getTime()) / 86400000) : null;

  async function rotarFormulario() {
    if ((fp.nueva || "").length < 4) return flash("La clave del formulario debe tener al menos 4 caracteres.");
    if (fp.nueva !== fp.repite) return flash("Las dos claves del formulario no coinciden.");
    if (!(window.crypto && crypto.subtle)) return flash("Tu navegador no permite cifrar aquí. Usa Chrome/Safari actualizado.");
    setBusyFp(true);
    try {
      // el hash se calcula AQUÍ (en tu navegador): tu clave en claro nunca sale de tu equipo
      const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(fp.nueva));
      const hash = Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
      const r = await fetch(MOTOR + "/web/clave_formulario", { method: "POST", headers: H(), body: JSON.stringify({ hash }) });
      const d = await r.json();
      if (!d.ok) return flash("No se pudo rotar: " + (d.error || ""));
      commit({ ...data, siemon: { ...data.siemon, formularioClaveFecha: d.fecha } });
      setFp({ nueva: "", repite: "" });
      flash("Clave del formulario cambiada y publicada ✓. Apúntala: no se puede recuperar.");
    } catch { flash("No pude conectar con el motor."); }
    finally { setBusyFp(false); }
  }

  function sembrar() {
    commit({ ...data, siemon: { ...data.siemon, accesos: SEMILLA.map((s) => ({ ...s, id: uid() })) } });
    flash("Accesos precargados. Completa las contraseñas que quieras guardar.");
  }
  function setAcc(id, patch) { commit({ ...data, siemon: { ...data.siemon, accesos: accesos.map((a) => a.id === id ? { ...a, ...patch } : a) } }); }
  function borrar(id) { commit({ ...data, siemon: { ...data.siemon, accesos: accesos.filter((a) => a.id !== id) } }); flash("Acceso eliminado."); }
  function crear() {
    if (!nv.servicio.trim()) return flash("Ponle nombre al servicio.");
    commit({ ...data, siemon: { ...data.siemon, accesos: [{ ...nv, id: uid() }, ...accesos] } });
    setNv({ servicio: "", url: "", usuario: "", clave: "", notas: "" }); setShowNuevo(false);
    flash("Acceso guardado.");
  }
  function copiar(txt, que) { try { navigator.clipboard.writeText(txt); flash(que + " copiado."); } catch {} }

  async function cambiarClave() {
    if (!cl.actual || !cl.nueva) return flash("Escribe la clave actual y la nueva.");
    if (cl.nueva.length < 10) return flash("La clave nueva debe tener al menos 10 caracteres.");
    if (cl.nueva !== cl.repite) return flash("La clave nueva no coincide en los dos campos.");
    setBusy(true);
    try {
      const r = await fetch(MOTOR + "/admin/cambiar_clave", { method: "POST", headers: H(), body: JSON.stringify({ actual: cl.actual, nueva: cl.nueva }) });
      const d = await r.json();
      if (!d.ok) return flash("No se cambió: " + (d.error || ""));
      setToken(cl.nueva);   // esta sesión sigue funcionando con la nueva
      setCl({ actual: "", nueva: "", repite: "" });
      flash("Contraseña cambiada ✓. En tus OTROS dispositivos vuelve a entrar con la nueva.");
    } catch { flash("No pude conectar con el motor."); }
    finally { setBusy(false); }
  }

  return (
    <div className="p-5 md:p-8" style={{ maxWidth: 1000 }}>
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <div style={{ color: C.aether500, fontFamily: MONO, letterSpacing: "0.2em" }} className="fs-10 uppercase mb-2"><span style={{ color: C.aether }}>// </span>Para ti y para quien delegues</div>
          <h1 style={{ fontWeight: 600, color: C.cream }} className="fs-24 flex items-center gap-2"><KeyRound size={20} color={C.aether} /> Accesos</h1>
          <div style={{ color: C.ash }} className="fs-11 mt-1">Los portales del ecosistema con sus credenciales, píxeles y códigos, en un solo lugar. Quien tenga la contraseña del Centro de Mando puede ver esto: guarda aquí solo lo que quieras delegar.</div>
        </div>
        <button onClick={() => setShowNuevo((v) => !v)} style={{ background: C.aether, color: C.obsidian, fontWeight: 600 }} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg fs-12 shrink-0"><Plus size={13} /> Nuevo acceso</button>
      </div>

      {/* Cambiar contraseña del Centro de Mando */}
      <div style={{ background: C.aetherSoft, border: `1px solid ${C.aetherLine}` }} className="rounded-xl p-4 mb-4">
        <div style={{ color: C.aether2, fontFamily: MONO }} className="fs-10 uppercase mb-2 flex items-center gap-1.5"><ShieldCheck size={12} /> Cambiar la contraseña del Centro de Mando</div>
        <div className="grid sm:grid-cols-3 gap-3">
          <input type="password" style={inS} value={cl.actual} onChange={(e) => setCl({ ...cl, actual: e.target.value })} placeholder="Contraseña actual" autoComplete="off" />
          <input type="password" style={inS} value={cl.nueva} onChange={(e) => setCl({ ...cl, nueva: e.target.value })} placeholder="Nueva (mín. 10 caracteres)" autoComplete="new-password" />
          <input type="password" style={inS} value={cl.repite} onChange={(e) => setCl({ ...cl, repite: e.target.value })} placeholder="Repite la nueva" autoComplete="new-password" />
        </div>
        <div className="flex items-center gap-3 mt-3 flex-wrap">
          <button onClick={cambiarClave} disabled={busy} style={{ background: C.aether, color: C.obsidian, fontWeight: 600, opacity: busy ? 0.6 : 1 }} className="px-3.5 py-2 rounded-lg fs-12">{busy ? "Cambiando…" : "Cambiar contraseña"}</button>
          <span style={{ color: C.ash }} className="fs-10">Vale para: entrar al CRM (todos tus dispositivos) y el editor visual. Las automatizaciones y los enlaces de correos NO se rompen (usan llaves propias).</span>
        </div>
      </div>

      {/* Rotar la clave del formulario de diagnóstico */}
      <div style={{ background: C.panel, border: `1px solid ${(diasDesde != null && diasDesde >= 90) ? C.warn : C.line}` }} className="rounded-xl p-4 mb-4">
        <div style={{ color: C.aether2, fontFamily: MONO }} className="fs-10 uppercase mb-2 flex items-center gap-1.5"><ShieldCheck size={12} /> Clave del formulario de diagnóstico</div>
        <div className="grid sm:grid-cols-3 gap-3">
          <input type="password" style={inS} value={fp.nueva} onChange={(e) => setFp({ ...fp, nueva: e.target.value })} placeholder="Clave nueva" autoComplete="new-password" />
          <input type="password" style={inS} value={fp.repite} onChange={(e) => setFp({ ...fp, repite: e.target.value })} placeholder="Repite la clave" autoComplete="new-password" />
          <button onClick={rotarFormulario} disabled={busyFp} style={{ background: C.aether, color: C.obsidian, fontWeight: 600, opacity: busyFp ? 0.6 : 1 }} className="px-3.5 py-2 rounded-lg fs-12">{busyFp ? "Publicando…" : "Cambiar y publicar"}</button>
        </div>
        <div style={{ color: (diasDesde != null && diasDesde >= 90) ? C.warn : C.ash }} className="fs-10 mt-2">
          {fpFecha ? `Última rotación: ${fpFecha}${diasDesde != null ? ` (hace ${diasDesde} días)` : ""}. ` : "Aún no la has rotado desde aquí. "}
          {diasDesde != null && diasDesde >= 90 ? "Te recomiendo cambiarla (más de 90 días). " : "Te sugiero rotarla cada 90 días. "}
          Se aplica al formulario en vivo al instante. Tu clave se cifra en tu navegador: no viaja ni se puede recuperar, así que apúntala.
        </div>
      </div>

      {showNuevo && (
        <div style={{ background: C.panel, border: `1px solid ${C.aetherLine}` }} className="rounded-xl p-4 mb-4">
          <div className="grid sm:grid-cols-5 gap-3">
            <input style={inS} value={nv.servicio} onChange={(e) => setNv({ ...nv, servicio: e.target.value })} placeholder="Servicio (ej. FAL)" />
            <input style={inS} value={nv.url} onChange={(e) => setNv({ ...nv, url: e.target.value })} placeholder="URL" />
            <input style={inS} value={nv.usuario} onChange={(e) => setNv({ ...nv, usuario: e.target.value })} placeholder="Usuario" />
            <input style={inS} value={nv.clave} onChange={(e) => setNv({ ...nv, clave: e.target.value })} placeholder="Clave / código" />
            <input style={inS} value={nv.notas} onChange={(e) => setNv({ ...nv, notas: e.target.value })} placeholder="Notas" />
          </div>
          <div className="flex items-center gap-2 mt-3">
            <button onClick={crear} style={{ background: C.aether, color: C.obsidian, fontWeight: 600 }} className="px-3.5 py-2 rounded-lg fs-12">Guardar</button>
            <button onClick={() => setShowNuevo(false)} style={{ color: C.ash }} className="fs-12">Cancelar</button>
          </div>
        </div>
      )}

      {accesos.length === 0 ? (
        <div style={{ background: C.panel, border: `1px solid ${C.line}` }} className="rounded-xl p-5 text-center">
          <div style={{ color: C.mist }} className="fs-12 mb-3">Aún no hay accesos guardados. Puedo precargar los portales de tu ecosistema (Umami, Postiz, n8n, Hostinger, píxel…).</div>
          <button onClick={sembrar} style={{ background: C.aether, color: C.obsidian, fontWeight: 600 }} className="px-4 py-2 rounded-lg fs-12">Precargar mis portales</button>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {accesos.map((a) => (
            <div key={a.id} style={{ background: C.panel, border: `1px solid ${C.line}` }} className="rounded-xl p-4">
              <div className="flex items-center gap-2 flex-wrap mb-2">
                <span style={{ color: C.cream, fontWeight: 600 }} className="fs-13">{a.servicio}</span>
                {a.url && <a href={a.url} target="_blank" rel="noreferrer" style={{ color: C.aether2 }} className="fs-11 inline-flex items-center gap-1">abrir portal <ArrowRight size={11} /></a>}
                <div className="flex-1" />
                <button onClick={() => borrar(a.id)} style={{ color: C.ash }}><Trash2 size={13} /></button>
              </div>
              <div className="grid sm:grid-cols-3 gap-2">
                <div><label style={{ color: C.ash, fontFamily: MONO }} className="fs-9 uppercase">Usuario</label>
                  <div className="flex gap-1.5">
                    <input style={{ ...inS, padding: "6px 10px", fontSize: 12 }} value={a.usuario || ""} onChange={(e) => setAcc(a.id, { usuario: e.target.value })} />
                    {a.usuario && <button onClick={() => copiar(a.usuario, "Usuario")} style={{ color: C.ash }}><Copy size={13} /></button>}
                  </div></div>
                <div><label style={{ color: C.ash, fontFamily: MONO }} className="fs-9 uppercase">Clave / código</label>
                  <div className="flex gap-1.5 items-center">
                    <input type={ver[a.id] ? "text" : "password"} style={{ ...inS, padding: "6px 10px", fontSize: 12, fontFamily: MONO }} value={a.clave || ""} onChange={(e) => setAcc(a.id, { clave: e.target.value })} autoComplete="off" />
                    <button onClick={() => setVer({ ...ver, [a.id]: !ver[a.id] })} style={{ color: C.ash }}>{ver[a.id] ? <EyeOff size={13} /> : <Eye size={13} />}</button>
                    {a.clave && <button onClick={() => copiar(a.clave, "Clave")} style={{ color: C.ash }}><Copy size={13} /></button>}
                  </div></div>
                <div><label style={{ color: C.ash, fontFamily: MONO }} className="fs-9 uppercase">Notas</label>
                  <input style={{ ...inS, padding: "6px 10px", fontSize: 12 }} value={a.notas || ""} onChange={(e) => setAcc(a.id, { notas: e.target.value })} /></div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
