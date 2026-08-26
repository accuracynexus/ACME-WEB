-- ============================================================
-- Fix: el panel de admin no lista repartidores
-- Fecha: 2026-08-26
--
-- Causa: las tablas del dominio de reparto solo tienen policies
-- "own row" (user_id / driver_id = auth.uid()). El admin de
-- plataforma no tiene NINGUNA policy en public.drivers, asi que
--
--   supabase.from('drivers').select('*')
--   (src/core/services/adminDriversService.ts)
--
-- le devuelve 0 filas SIN error. fetchDrivers corta ahi mismo
-- cuando driverIds queda vacio y la lista aparece vacia en
-- silencio: la pagina solo pinta banner si hay error, y RLS no
-- produce error, produce cero filas.
--
-- driver_documents ya tenia ddoc_admin_read, pero es solo
-- SELECT: aprobar un documento hace UPDATE y RLS lo rechaza.
-- Lo mismo con el check "Verificado", que hace UPDATE sobre
-- public.drivers.
--
-- Las dos is_admin() del proyecto son STABLE SECURITY DEFINER,
-- asi que no disparan RLS y no pueden recular como paso con
-- orders (ver 202607150001_fix_orders_rls_infinite_recursion).
--
-- Se evaluan LAS DOS porque miran fuentes de rol distintas y la
-- app tambien considera ambas (hasPlatformRole en
-- src/core/auth/portalAccess.ts):
--
--   public.is_admin()  -> profiles.default_role in (admin, super_admin)
--   private.is_admin() -> private.has_role(), tabla de asignaciones
--
-- Si solo usaramos public.is_admin(), un admin cuyo rol vive en
-- las asignaciones y no en profiles.default_role seguiria sin
-- ver nada.
--
-- Alcance: SELECT / INSERT / UPDATE. Sin DELETE a proposito: el
-- panel no borra ninguna de estas filas.
-- ============================================================

-- ——— Helper: un solo predicado para las dos fuentes de rol ———

create or replace function private.is_portal_admin()
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select coalesce(public.is_admin(), false)
      or coalesce(private.is_admin(), false);
$$;

grant execute on function private.is_portal_admin() to authenticated;

-- ——— drivers: la causa raiz de la lista vacia ———

drop policy if exists drivers_admin_select on public.drivers;
create policy drivers_admin_select on public.drivers
  for select to authenticated
  using (private.is_portal_admin());

drop policy if exists drivers_admin_insert on public.drivers;
create policy drivers_admin_insert on public.drivers
  for insert to authenticated
  with check (private.is_portal_admin());

drop policy if exists drivers_admin_update on public.drivers;
create policy drivers_admin_update on public.drivers
  for update to authenticated
  using (private.is_portal_admin())
  with check (private.is_portal_admin());

-- ——— driver_documents: faltaba la escritura para aprobar ———
-- ddoc_admin_read ya cubre el SELECT con public.is_admin(); esta
-- lo amplia a la otra fuente de rol. Quedan las dos, se combinan
-- con OR y no estorban.

drop policy if exists driver_documents_admin_select on public.driver_documents;
create policy driver_documents_admin_select on public.driver_documents
  for select to authenticated
  using (private.is_portal_admin());

drop policy if exists driver_documents_admin_insert on public.driver_documents;
create policy driver_documents_admin_insert on public.driver_documents
  for insert to authenticated
  with check (private.is_portal_admin());

drop policy if exists driver_documents_admin_update on public.driver_documents;
create policy driver_documents_admin_update on public.driver_documents
  for update to authenticated
  using (private.is_portal_admin())
  with check (private.is_portal_admin());

-- ——— vehicles ———

drop policy if exists vehicles_admin_select on public.vehicles;
create policy vehicles_admin_select on public.vehicles
  for select to authenticated
  using (private.is_portal_admin());

drop policy if exists vehicles_admin_insert on public.vehicles;
create policy vehicles_admin_insert on public.vehicles
  for insert to authenticated
  with check (private.is_portal_admin());

drop policy if exists vehicles_admin_update on public.vehicles;
create policy vehicles_admin_update on public.vehicles
  for update to authenticated
  using (private.is_portal_admin())
  with check (private.is_portal_admin());

-- ——— driver_current_state (el panel hace upsert) ———

drop policy if exists driver_current_state_admin_select on public.driver_current_state;
create policy driver_current_state_admin_select on public.driver_current_state
  for select to authenticated
  using (private.is_portal_admin());

drop policy if exists driver_current_state_admin_insert on public.driver_current_state;
create policy driver_current_state_admin_insert on public.driver_current_state
  for insert to authenticated
  with check (private.is_portal_admin());

drop policy if exists driver_current_state_admin_update on public.driver_current_state;
create policy driver_current_state_admin_update on public.driver_current_state
  for update to authenticated
  using (private.is_portal_admin())
  with check (private.is_portal_admin());

-- ——— driver_shifts ———

drop policy if exists driver_shifts_admin_select on public.driver_shifts;
create policy driver_shifts_admin_select on public.driver_shifts
  for select to authenticated
  using (private.is_portal_admin());

drop policy if exists driver_shifts_admin_insert on public.driver_shifts;
create policy driver_shifts_admin_insert on public.driver_shifts
  for insert to authenticated
  with check (private.is_portal_admin());

drop policy if exists driver_shifts_admin_update on public.driver_shifts;
create policy driver_shifts_admin_update on public.driver_shifts
  for update to authenticated
  using (private.is_portal_admin())
  with check (private.is_portal_admin());

-- ——— driver_locations: el panel solo lee el tracking ———

drop policy if exists driver_locations_admin_select on public.driver_locations;
create policy driver_locations_admin_select on public.driver_locations
  for select to authenticated
  using (private.is_portal_admin());
