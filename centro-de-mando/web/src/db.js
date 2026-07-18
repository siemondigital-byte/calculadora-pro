// Comunicacion con el motor. Patron commit: leer entero, mutar, escribir entero.
// El backend protege con merge seguro, pero el frontend NUNCA manda parches.

export const MOTOR =
  import.meta.env.VITE_MOTOR_URL || "https://motor.atlantisglobalrealty.com";

const TOKEN_KEY = "atlantis_crm_token";

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) => localStorage.setItem(TOKEN_KEY, t);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

const cabeceras = () => ({
  Authorization: `Bearer ${getToken() || ""}`,
  "Content-Type": "application/json",
});

// Interceptor 401: cualquier 401 del motor (salvo /crm/login) vuelve al login.
let interceptado = false;
export function instalarInterceptor401() {
  if (interceptado) return;
  interceptado = true;
  const original = window.fetch;
  window.fetch = async (...args) => {
    const resp = await original(...args);
    const url = typeof args[0] === "string" ? args[0] : args[0]?.url || "";
    if (resp.status === 401 && url.startsWith(MOTOR) && !url.includes("/crm/login")) {
      clearToken();
      window.location.reload();
    }
    return resp;
  };
}

export async function login(clave) {
  const r = await fetch(`${MOTOR}/crm/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clave }),
  });
  if (!r.ok) return false;
  setToken(clave); // la clave misma es el token (patron del sistema)
  return true;
}

export async function loadData() {
  const r = await fetch(`${MOTOR}/crm/data`, { headers: cabeceras() });
  if (!r.ok) throw new Error(`GET /crm/data ${r.status}`);
  const j = await r.json();
  return j.data || seed();
}

export async function saveData(data) {
  const r = await fetch(`${MOTOR}/crm/data`, {
    method: "PUT",
    headers: cabeceras(),
    body: JSON.stringify({ data }), // SIEMPRE el objeto completo
  });
  if (!r.ok) throw new Error(`PUT /crm/data ${r.status}`);
}

export async function guardarSecreto(clave, valor) {
  const r = await fetch(`${MOTOR}/secreto/guardar`, {
    method: "POST",
    headers: cabeceras(),
    body: JSON.stringify({ clave, valor }),
  });
  return r.ok;
}

export async function estadoSecretos() {
  const r = await fetch(`${MOTOR}/secreto/estado`, { headers: cabeceras() });
  return r.ok ? r.json() : {};
}

export async function cambiarClave(nueva) {
  const r = await fetch(`${MOTOR}/admin/cambiar_clave`, {
    method: "POST",
    headers: cabeceras(),
    body: JSON.stringify({ nueva }),
  });
  if (r.ok) setToken(nueva);
  return r.ok;
}

// Semilla: dos workspaces, config parametrizable por negocio (nada hardcodeado
// en los flujos: los modulos leen SIEMPRE de data.<ws>.config).
export function seed() {
  return {
    workspace: "atlantis",
    atlantis: {
      config: {
        nombre: "Atlantis Global Realty",
        moneda: "USD",
        stages: [
          "Nuevo",
          "Contactado",
          "Diagnóstico agendado",
          "Diagnóstico realizado",
          "En proyecto",
          "Cliente",
          "Descartado",
        ],
        probabilidadPorEtapa: {
          Nuevo: 5,
          Contactado: 15,
          "Diagnóstico agendado": 40,
          "Diagnóstico realizado": 60,
          "En proyecto": 80,
          Cliente: 100,
          Descartado: 0,
        },
        cadenciaDias: {
          Nuevo: 2,
          Contactado: 3,
          "Diagnóstico agendado": 1,
          "Diagnóstico realizado": 2,
          "En proyecto": 7,
          Cliente: 30,
        },
        fuentes: ["directo", "instagram", "linkedin", "youtube", "meta-ads", "referido"],
      },
      leads: [],
      prospectos: [],
      consultas: [],
      proyectos: [],
      enlacesUTM: [],
      metas: {},
      borrados: {},
    },
    cicloderiqueza: {
      config: {
        nombre: "Ciclo de Riqueza Inmobiliaria",
        moneda: "USD",
        precio: "44 USD",
        stages: ["Nuevo", "Nutriendo", "Interesado", "Comprador", "Reembolsado", "Baja"],
        probabilidadPorEtapa: {
          Nuevo: 5,
          Nutriendo: 15,
          Interesado: 40,
          Comprador: 100,
          Reembolsado: 0,
          Baja: 0,
        },
        cadenciaDias: { Nuevo: 1, Nutriendo: 3, Interesado: 2 },
        fuentes: ["directo", "upsell", "youtube-afiliado", "meta-ads", "organico"],
        appGratisPrimerosN: 500,
        idiomas: ["es", "en"],
      },
      leads: [],
      compradores: [],
      afiliados: [],
      app_usuarios: [],
      enlacesUTM: [],
      metas: {},
      borrados: {},
    },
  };
}
