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


-- RLS activo SIN politicas: el anon key no puede leer ni escribir tokens.
-- n8n entra con la service_role, que salta el RLS.
ALTER TABLE password_resets ENABLE ROW LEVEL SECURITY;

-- Limpieza opcional (correr de vez en cuando en el SQL editor):
-- DELETE FROM password_resets WHERE expira_en < now() - interval '7 days';
