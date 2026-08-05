-- ============================================================================
-- Tokens de recuperación de contraseña.
-- Sustituye al flujo PKCE de Supabase: el token viaja en el enlace del correo y
-- se valida en el servidor (n8n), así que funciona en cualquier navegador o
-- dispositivo, sin depender de una sesión previa del usuario.
-- ============================================================================

CREATE TABLE IF NOT EXISTS password_resets (
  token      text PRIMARY KEY,
  email      text        NOT NULL,
  app        text,                          -- opcional: si un día hay varias apps
  lang       text        DEFAULT 'es',      -- idioma del correo (es | en)
  expira_en  timestamptz NOT NULL,
  usado      boolean     DEFAULT false,
  creado_en  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_password_resets_email  ON password_resets (lower(email));
CREATE INDEX IF NOT EXISTS idx_password_resets_expira ON password_resets (expira_en);

-- ============================================================================
-- CREAR TOKEN  (workflow 02 · nodo "Crear token")
-- Parámetros: $1 = email · $2 = app · $3 = lang
-- Vence en 60 minutos. Devuelve también el nombre si existe una tabla de
-- contactos (quita ese COALESCE si tu app no la tiene).
-- ============================================================================
-- WITH r AS (
--   INSERT INTO password_resets (token, email, app, lang, expira_en)
--   VALUES (replace(gen_random_uuid()::text, '-', ''), $1, $2, $3,
--           now() + interval '60 minutes')
--   RETURNING token, email, app, lang
-- )
-- SELECT r.token, r.email, r.app, r.lang,
--        COALESCE((SELECT nombre FROM contactos
--                   WHERE lower(email) = lower(r.email) LIMIT 1), '') AS nombre
--   FROM r;

-- ============================================================================
-- VALIDAR Y CONSUMIR TOKEN  (workflow 03 · nodo "Validar token")
-- Parámetro: $1 = token
-- Un solo uso: lo marca `usado` en la misma sentencia (evita condiciones de
-- carrera si el usuario hace doble clic).
-- IMPORTANTE: devolver también `app` y `lang`, no solo el email. En el sistema
-- original el SELECT solo devolvía el email y el enrutado por app fallaba en
-- silencio: la contraseña nunca se actualizaba y nadie se enteraba.
-- ============================================================================
-- WITH t AS (
--   SELECT email, app, lang FROM password_resets
--    WHERE token = $1 AND usado = false AND expira_en > now() LIMIT 1
-- ), u AS (
--   UPDATE password_resets SET usado = true
--    WHERE token = $1 AND usado = false AND expira_en > now()
--    RETURNING email
-- )
-- SELECT (SELECT email FROM t) AS email,
--        (SELECT app   FROM t) AS app,
--        (SELECT lang  FROM t) AS lang;

-- Si `email` viene NULL → token inválido, vencido o ya usado → responder 400.

-- ============================================================================
-- Limpieza (opcional): correr a diario para no acumular tokens vencidos.
-- ============================================================================
-- DELETE FROM password_resets
--  WHERE expira_en < now() - interval '7 days';
