import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import { login, getToken, clearToken } from "./db";
import "./index.css";

const C = { obsidian: "#0A0B0D", panel: "#16171C", line: "rgba(255,255,255,0.08)",
  aether: "#B1A3E1", cream: "#E9E5DD", ash: "#8B8D98", danger: "#D08A8A" };
const SANS = "'Montserrat', system-ui, sans-serif";
const MONO = "'JetBrains Mono', ui-monospace, monospace";

function Login({ onIn }) {
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function entrar(e) {
    e.preventDefault();
    setBusy(true); setErr("");
    const ok = await login(pass.trim());
    setBusy(false);
    if (ok) onIn();
    else setErr("Contraseña incorrecta.");
  }

  const inS = { background: "#101116", border: `1px solid ${C.line}`, color: C.cream,
    borderRadius: 10, padding: "11px 13px", width: "100%", fontFamily: SANS, fontSize: 14, outline: "none" };

  return (
    <div style={{ background: C.obsidian, minHeight: "100vh", fontFamily: SANS,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <form onSubmit={entrar} style={{ width: 360, maxWidth: "100%", background: C.panel,
        border: `1px solid ${C.line}`, borderRadius: 18, padding: "36px 30px 30px" }}>
        <img src="/siemon-logo-hor.png" alt="Siemon Digital"
          style={{ display: "block", width: "100%", maxWidth: 210, height: "auto",
            margin: "4px auto 28px" }} />
        <input style={inS} type="password" placeholder="Contraseña" value={pass}
          onChange={(e) => setPass(e.target.value)} autoFocus />
        {err && <div style={{ color: C.danger, fontSize: 13, marginTop: 12 }}>{err}</div>}
        <button type="submit" disabled={busy} style={{ marginTop: 18, width: "100%",
          background: C.aether, color: C.obsidian, fontWeight: 600, border: "none",
          borderRadius: 999, padding: "12px", fontFamily: SANS, fontSize: 15,
          cursor: "pointer", opacity: busy ? 0.6 : 1 }}>
          {busy ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </div>
  );
}

function CampanaPush() {
  const MOTOR = import.meta.env.VITE_MOTOR_URL || "https://prospeccion.siemondigital.com";
  const [estado, setEstado] = React.useState("");
  function b64aU8(b64) {
    const pad = "=".repeat((4 - (b64.length % 4)) % 4);
    const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
    return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
  }
  async function activar() {
    try {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) return setEstado("no soportado");
      const perm = await Notification.requestPermission();
      if (perm !== "granted") return setEstado("permiso denegado");
      const H = { "content-type": "application/json", Authorization: "Bearer " + getToken() };
      const reg = await navigator.serviceWorker.ready;
      const { clave } = await (await fetch(MOTOR + "/push/clave", { headers: H })).json();
      if (!clave) return setEstado("motor sin clave");
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64aU8(clave) });
      await fetch(MOTOR + "/push/suscribir", { method: "POST", headers: H, body: JSON.stringify({ sub: sub.toJSON() }) });
      await fetch(MOTOR + "/push/probar", { method: "POST", headers: H });
      setEstado("activas ✓");
    } catch (e) { setEstado("error"); }
  }
  return (
    <button onClick={activar} title="Recibir notificaciones (artículo por aprobar, seguimientos del día) en este dispositivo"
      style={{ position: "fixed", left: 96, bottom: 14, zIndex: 90, background: C.panel,
        border: `1px solid ${C.line}`, color: estado === "activas ✓" ? "#7FB89B" : C.ash, borderRadius: 999,
        padding: "7px 13px", fontFamily: MONO, fontSize: 11, cursor: "pointer" }}>
      🔔 {estado || "notificaciones"}
    </button>
  );
}

function SignOut({ onOut }) {
  return (
    <button onClick={() => { clearToken(); onOut(); }}
      title="Cerrar sesión"
      style={{ position: "fixed", left: 14, bottom: 14, zIndex: 90, background: C.panel,
        border: `1px solid ${C.line}`, color: C.ash, borderRadius: 999, padding: "7px 13px",
        fontFamily: MONO, fontSize: 11, cursor: "pointer" }}>
      // salir
    </button>
  );
}

function Root() {
  const [dentro, setDentro] = useState(!!getToken());

  if (!dentro) return <Login onIn={() => setDentro(true)} />;
  return (<><App onUnauthorized={() => { clearToken(); setDentro(false); }} /><SignOut onOut={() => setDentro(false)} /><CampanaPush /></>);
}

createRoot(document.getElementById("root")).render(<Root />);

// PWA: registra el service worker (instalable en el celular)
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
}
