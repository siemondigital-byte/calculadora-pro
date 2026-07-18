import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import { getToken, instalarInterceptor401, login } from "./db.js";
import "./index.css";

instalarInterceptor401();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}

function Login() {
  const [clave, setClave] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  const entrar = async (e) => {
    e.preventDefault();
    setCargando(true);
    setError("");
    const ok = await login(clave);
    if (ok) window.location.reload();
    else {
      setError("Clave incorrecta o motor sin configurar.");
      setCargando(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <form onSubmit={entrar} className="tarjeta w-full max-w-sm space-y-5">
        <div className="text-center">
          <div className="font-display text-3xl text-oro">Atlantis</div>
          <div className="mt-1 text-sm uppercase tracking-widest text-gris">
            Centro de Mando
          </div>
        </div>
        <input
          type="password"
          className="campo"
          placeholder="Clave de acceso"
          value={clave}
          onChange={(e) => setClave(e.target.value)}
          autoFocus
        />
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button className="boton w-full" disabled={cargando || !clave}>
          {cargando ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </div>
  );
}

createRoot(document.getElementById("root")).render(
  getToken() ? <App /> : <Login />
);
