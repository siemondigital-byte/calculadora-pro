/**
 * Cliente de recuperación de contraseña para la Calculadora (GitHub Pages, estático).
 * Habla directo con los webhooks de n8n (que devuelven las cabeceras CORS).
 * Kit adaptado del handoff probado en producción.
 *
 * ⚠️ Aquí SOLO viven datos públicos. Nada de service_role, claves SMTP ni el
 * secreto del webhook de alta.
 */

// ---------------------------------------------------------------------------
// Configuración — pon la URL de TU n8n (reemplaza TU-N8N). El resto queda igual.
// ---------------------------------------------------------------------------
export const CONFIG = {
  RESET_REQUEST_URL: "https://hooks.atlantisglobalrealty.com/webhook/password-reset-request",
  RESET_CONFIRM_URL: "https://hooks.atlantisglobalrealty.com/webhook/password-reset-confirm",
  APP: "calculadora",
};

/** Idioma del navegador, limitado a los que tenemos traducidos. */
export function idioma() {
  const q = new URLSearchParams(location.search).get("lang");
  if (q === "en" || q === "es") return q;
  return (navigator.language || "es").toLowerCase().startsWith("en") ? "en" : "es";
}

const MSG = {
  es: {
    enviado: "Si ese correo tiene cuenta, te enviamos un enlace para restablecerla.",
    errEnvio: "No se pudo enviar. Intenta de nuevo en un momento.",
    errEmail: "Escribe un correo válido.",
    errToken: "El enlace expiró o ya fue usado. Pide uno nuevo.",
    errCorta: "La contraseña debe tener al menos 8 caracteres.",
    errDistintas: "Las contraseñas no coinciden.",
    guardada: "Contraseña actualizada. Ya puedes iniciar sesión.",
  },
  en: {
    enviado: "If that email has an account, we've sent you a reset link.",
    errEnvio: "Could not send. Try again in a moment.",
    errEmail: "Enter a valid email.",
    errToken: "The link expired or was already used. Request a new one.",
    errCorta: "Password must be at least 8 characters.",
    errDistintas: "Passwords don't match.",
    guardada: "Password updated. You can sign in now.",
  },
};
export const t = (k) => MSG[idioma()][k];

/**
 * Paso 1 — pedir el enlace de recuperación.
 * Devuelve SIEMPRE el mismo mensaje exista o no la cuenta (anti-enumeración).
 */
export async function pedirReset(email) {
  const correo = String(email || "").trim().toLowerCase();
  if (!correo || correo.indexOf("@") < 1) {
    return { ok: false, mensaje: t("errEmail") };
  }
  try {
    const res = await fetch(CONFIG.RESET_REQUEST_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: correo, app: CONFIG.APP, lang: idioma() }),
    });
    if (!res.ok) throw new Error("n8n_" + res.status);
    return { ok: true, mensaje: t("enviado") };
  } catch {
    return { ok: false, mensaje: t("errEnvio") };
  }
}

/** Lee el token del enlace del correo: /reset.html?token=XXX */
export function tokenDeLaUrl() {
  return new URLSearchParams(location.search).get("token") || "";
}

/**
 * Paso 2 — guardar la contraseña nueva.
 * n8n valida el token (60 min, un solo uso) y actualiza Supabase. No hace falta
 * sesión previa, así que funciona en cualquier navegador o dispositivo.
 */
export async function confirmarReset(token, password, confirmacion) {
  if (!token) return { ok: false, mensaje: t("errToken") };
  if (String(password).length < 8) return { ok: false, mensaje: t("errCorta") };
  if (confirmacion !== undefined && password !== confirmacion) {
    return { ok: false, mensaje: t("errDistintas") };
  }
  try {
    const res = await fetch(CONFIG.RESET_CONFIRM_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) return { ok: false, mensaje: t("errToken") };
    return { ok: true, mensaje: t("guardada") };
  } catch {
    return { ok: false, mensaje: t("errEnvio") };
  }
}

/** Requisitos de contraseña, para pintar los indicadores en pantalla. */
export function requisitos(pw) {
  const s = String(pw || "");
  return {
    largo: s.length >= 8,
    mayus: /[a-z]/.test(s) && /[A-Z]/.test(s),
    numero: /\d/.test(s),
    simbolo: /[^A-Za-z0-9]/.test(s),
  };
}
