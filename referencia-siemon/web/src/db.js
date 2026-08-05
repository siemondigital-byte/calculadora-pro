// Capa de datos: guarda TODO en el VPS (motor FastAPI), sin Supabase.
// El documento `data` completo de la app se persiste como un JSON en el servidor.
// Puerta simple: una contraseña (token) que viaja como Bearer.
const MOTOR = import.meta.env.VITE_MOTOR_URL || "https://prospeccion.siemondigital.com";

export const TOKEN_KEY = "siemon_crm_token";
export const getToken = () => localStorage.getItem(TOKEN_KEY) || "";
export const setToken = (t) => localStorage.setItem(TOKEN_KEY, t || "");
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

const auth = () => ({ Authorization: "Bearer " + getToken() });

// Interceptor global: si CUALQUIER llamada al motor devuelve 401 (token vencido/incorrecto),
// se limpia la sesión y se vuelve al login, en vez de dejar "no pude conectar" por toda la app.
if (typeof window !== "undefined" && !window.__siemonFetch401) {
  window.__siemonFetch401 = true;
  const _fetch = window.fetch.bind(window);
  window.fetch = async (...args) => {
    const r = await _fetch(...args);
    try {
      const url = typeof args[0] === "string" ? args[0] : (args[0] && args[0].url) || "";
      if (r.status === 401 && url.startsWith(MOTOR) && !url.includes("/crm/login") && getToken()) {
        clearToken();
        window.location.reload();
      }
    } catch {}
    return r;
  };
}

// Valida la contraseña contra el motor. Devuelve true/false.
export async function login(pw) {
  try {
    const r = await fetch(MOTOR + "/crm/login", { method: "POST", headers: { Authorization: "Bearer " + pw } });
    if (r.ok) { setToken(pw); return true; }
    return false;
  } catch { return false; }
}

// Carga el documento. Devuelve null si el servidor aun no tiene nada (la app siembra).
// Lanza "401" si la contraseña no sirve (para volver al login).
export async function loadData() {
  const r = await fetch(MOTOR + "/crm/data", { headers: auth() });
  if (r.status === 401) throw new Error("401");
  if (!r.ok) throw new Error("HTTP " + r.status);
  const j = await r.json();
  return j.data || null;
}

// Persiste el documento completo. Devuelve el mismo data.
export async function saveData(d) {
  const r = await fetch(MOTOR + "/crm/data", {
    method: "PUT", headers: { "content-type": "application/json", ...auth() },
    body: JSON.stringify({ data: d }),
  });
  if (r.status === 401) throw new Error("401");
  if (!r.ok) throw new Error("HTTP " + r.status);
  return d;
}
