-- =============================================================================
-- Supabase · RPC para la automatización de compras (n8n)
-- Corre esto DESPUÉS de supabase-schema.sql, en el SQL Editor.
-- Se llaman desde n8n con la SERVICE_ROLE key (backend), nunca desde el navegador.
-- =============================================================================

-- registrar_compra: marca la compra y decide "primeros N" de forma atómica.
-- El usuario en auth.users ya fue creado por n8n (Admin API); el trigger creó
-- su fila en `usuarios`. Aquí sellamos fecha, plataforma, acceso y vitalicio.
create or replace function public.registrar_compra(
  p_uid uuid,
  p_plataforma text default null,
  p_cupo int default 500        -- tamaño del cupo "gratis de por vida"
) returns public.usuarios
language plpgsql security definer set search_path = public as $$
declare
  comprados int;
  fila public.usuarios;
begin
  -- cuántos ya habían comprado ANTES de este (excluye al actual)
  select count(*) into comprados
  from public.usuarios
  where fecha_compra is not null and id <> p_uid;

  update public.usuarios
     set fecha_compra      = coalesce(fecha_compra, now()),
         plataforma_compra = coalesce(p_plataforma, plataforma_compra),
         acceso_activo     = true,
         acceso_vitalicio  = (comprados < p_cupo)
   where id = p_uid
  returning * into fila;

  return fila;
end; $$;

-- revocar_acceso: reembolso / contracargo → bloquea el acceso a la app.
create or replace function public.revocar_acceso(p_email text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.usuarios
     set acceso_activo = false
   where lower(email) = lower(p_email);
end; $$;

-- (opcional) contador de compradores, por si lo quieres consultar suelto.
create or replace function public.contar_compradores()
returns int language sql security definer set search_path = public as $$
  select count(*)::int from public.usuarios where fecha_compra is not null;
$$;

-- Estas funciones son security definer y se invocan con la service_role key:
--   POST {SUPABASE_URL}/rest/v1/rpc/registrar_compra   body {p_uid, p_plataforma, p_cupo}
--   POST {SUPABASE_URL}/rest/v1/rpc/revocar_acceso      body {p_email}
