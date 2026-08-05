-- =============================================================================
-- Supabase · Calculadora de Viabilidad Inmobiliaria Pro
-- Esquema inicial: usuarios (perfil + situación) y proyectos (deals del usuario).
--
-- Cómo usarlo: Supabase → SQL Editor → pega TODO esto → Run.
-- Requiere que Auth esté habilitado (Email o el proveedor que uses).
-- Los nombres de columna van en snake_case; la app usa camelCase (mapeo al final).
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) USUARIOS · extiende auth.users con perfil, acceso y situación personal
--    (la situación es del usuario y se comparte entre todos sus proyectos)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.usuarios (
  id                uuid primary key references auth.users(id) on delete cascade,
  email             text,
  nombre            text,
  idioma            text    default 'es' check (idioma in ('es','en')),

  -- Acceso / gating del producto
  acceso_activo     boolean default true,   -- false = reembolso → revoca la app y los bonos
  acceso_vitalicio  boolean default false,  -- true = compró dentro de los "primeros N" (gratis de por vida)
  plataforma_compra text,                   -- 'hotmart' | 'clickbank' | 'thrivecart' | 'embajador' | null
  fecha_compra      timestamptz,

  -- Situación personal (Cap. 30 / motor de la app)
  ingreso           numeric default 6000,
  gasto             numeric default 2800,
  deudas            numeric default 400,
  capital           numeric default 35000,
  horizonte         int     default 10 check (horizonte in (5,10,15)),

  -- Sync total: estado que no cabe en columnas (supuestos, shopping, portafolio,
  -- checklist, pestañas). Lo escribe/lee la app con la anon key; RLS lo protege.
  snapshot          jsonb,

  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

-- Migración idempotente: si tu tabla `usuarios` ya existía SIN la columna
-- `snapshot`, esta línea la agrega sin tocar los datos. (En instalaciones nuevas
-- ya viene incluida arriba; ejecutarla igual no hace daño.)
alter table public.usuarios add column if not exists snapshot jsonb;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) PROYECTOS · un deal por fila (todo el modelo de negocio de la app)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.proyectos (
  id              uuid primary key default gen_random_uuid(),
  usuario_id      uuid not null references public.usuarios(id) on delete cascade,

  -- Identidad del proyecto
  nombre          text,
  ubicacion       text,
  moneda          text    default 'USD',

  -- La oportunidad
  valor           numeric default 120000,
  inicial_pct     numeric default 30,     -- % cuota inicial
  plan_meses      int     default 36,     -- plan de pagos sin intereses
  valorizacion    numeric default 8,      -- % valorización anual esperada

  -- Modelo de negocio (entrada / salida)
  entry_model     text    default 'cero'  check (entry_model  in ('cero','marcha')),   -- Lista Cero / En Marcha
  entrada_premium numeric default 12,     -- sobreprecio de entrada (solo En Marcha)
  exit_strategy   text    default 'flip'  check (exit_strategy in ('cesion','flip','renta')),

  -- Renta (Fase C, si conservas)
  renta_bruta     numeric default 8,      -- % renta bruta anual
  ocupacion       numeric default 70,     -- % ocupación

  -- Realismo / costos
  costo_cierre    numeric default 3,      -- % costos de cierre
  margen_error    numeric default 15,     -- % margen de error institucional

  -- Impuestos / diferimiento
  vehiculo        text    default 'otro', -- 'dubai'|'colombia'|'usa'|'rd'|'panama'|'mexico'|'costarica'|'otro'
  tax_rate        numeric default 30,     -- % impuesto a la ganancia
  diferimiento    boolean default true,   -- AFC / 1031
  devaluacion     numeric default 0,      -- % devaluación anual esperada (solo moneda local)

  -- Financiación al entregar (hipoteca)
  fin_type        text    default 'banco' check (fin_type in ('banco','constructora')),
  fin_tasa        numeric default 10,     -- % tasa anual
  fin_plazo       int     default 20,     -- años

  -- Las 5 P (0=Falla, 1=Parcial, 2=Cumple)
  p5              jsonb   default '{"punto":2,"precio":2,"producto":2,"proceso":2,"personas":2,"proposito":2}'::jsonb,

  orden           int     default 0,      -- orden en la barra de proyectos
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create index if not exists proyectos_usuario_idx on public.proyectos(usuario_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3) ROW LEVEL SECURITY · cada usuario solo ve y edita lo suyo
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.usuarios  enable row level security;
alter table public.proyectos enable row level security;

drop policy if exists usuarios_select_own on public.usuarios;
drop policy if exists usuarios_update_own on public.usuarios;
drop policy if exists usuarios_insert_own on public.usuarios;
create policy usuarios_select_own on public.usuarios for select using (auth.uid() = id);
create policy usuarios_update_own on public.usuarios for update using (auth.uid() = id);
create policy usuarios_insert_own on public.usuarios for insert with check (auth.uid() = id);

drop policy if exists proyectos_all_own on public.proyectos;
create policy proyectos_all_own on public.proyectos
  for all using (auth.uid() = usuario_id) with check (auth.uid() = usuario_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4) TRIGGERS · crear perfil al registrarse + mantener updated_at
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.usuarios (id, email, nombre)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'nombre', ''))
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists touch_usuarios  on public.usuarios;
drop trigger if exists touch_proyectos on public.proyectos;
create trigger touch_usuarios  before update on public.usuarios  for each row execute function public.touch_updated_at();
create trigger touch_proyectos before update on public.proyectos for each row execute function public.touch_updated_at();

-- =============================================================================
-- NOTAS DE IMPLEMENTACIÓN
--
-- • Gating "primeros N": el flag `acceso_vitalicio` lo pone el webhook de compra
--   (n8n) al crear/actualizar el usuario, comparando contra un contador de compras.
--   Un `select count(*) from usuarios where fecha_compra is not null` da el N actual.
-- • Reembolso: el webhook pone `acceso_activo = false`; la app bloquea el acceso.
-- • Mapeo app (camelCase) → DB (snake_case):
--     inicialPct→inicial_pct, planMeses→plan_meses, entryModel→entry_model,
--     entradaPremium→entrada_premium, exitStrategy→exit_strategy,
--     rentaBruta→renta_bruta, costoCierre→costo_cierre, margenError→margen_error,
--     taxRate→tax_rate, finType→fin_type, finTasa→fin_tasa, finPlazo→fin_plazo.
--   `p5`, `diferimiento`, `vehiculo`, `moneda`, `valor`, `valorizacion`,
--   `ocupacion`, `devaluacion`, `nombre`, `ubicacion` van igual (o directo).
-- • En la app: al iniciar sesión, cargar `usuarios` (situación) + `proyectos`;
--   en cada cambio, upsert. Reemplaza el localStorage actual por estas tablas.
-- • Este esquema puede vivir en el MISMO proyecto Supabase que el CRM (Centro de
--   Mando) o en uno aparte. Si es el mismo, prefija estas tablas (p. ej. `app_`)
--   para no chocar con las del CRM (leads, afiliados, etc.).
-- =============================================================================
