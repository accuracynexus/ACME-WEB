-- ============================================================
-- Cerrar merchant_settings: RLS apagado en un esquema publico
-- Fecha: 2026-09-22
--
-- Supabase reporto rls_disabled_in_public sobre esta tabla. Es la unica
-- del proyecto en ese estado: el resto de lo que aparece en el catalogo
-- sin RLS son esquemas internos de Supabase (auth, realtime, vault), o
-- objetos de PostGIS (spatial_ref_sys, geography_columns,
-- geometry_columns), que PostgREST no expone o son datos publicos de
-- referencia.
--
-- merchant_settings si esta expuesta por la API: sin RLS, cualquiera con
-- la URL del proyecto y la clave anonima —que viaja dentro del bundle de
-- la web publica— podia leerla, insertarle filas y borrarlas. La tabla
-- estaba vacia al momento de este arreglo, asi que no hubo fuga de
-- datos, pero si habia riesgo de escritura.
--
-- Acceso que necesita la app (adminMerchantSettingsService): el panel
-- lee y escribe siempre filtrando por merchant_id del comercio actual.
-- Las policies reproducen eso: el personal del comercio sobre su propio
-- comercio, y el admin de plataforma sobre todos.
-- ============================================================

alter table public.merchant_settings enable row level security;

-- private.is_staff_for_merchant ya lo usan merchant_branches y otras
-- tablas del mismo dominio; private.is_portal_admin cubre las dos
-- fuentes de rol (ver 202608260001).
drop policy if exists merchant_settings_select on public.merchant_settings;
create policy merchant_settings_select on public.merchant_settings
  for select to authenticated
  using (
    (select private.is_staff_for_merchant(merchant_settings.merchant_id))
    or (select private.is_portal_admin())
  );

drop policy if exists merchant_settings_insert on public.merchant_settings;
create policy merchant_settings_insert on public.merchant_settings
  for insert to authenticated
  with check (
    (select private.is_staff_for_merchant(merchant_settings.merchant_id))
    or (select private.is_portal_admin())
  );

drop policy if exists merchant_settings_update on public.merchant_settings;
create policy merchant_settings_update on public.merchant_settings
  for update to authenticated
  using (
    (select private.is_staff_for_merchant(merchant_settings.merchant_id))
    or (select private.is_portal_admin())
  )
  with check (
    (select private.is_staff_for_merchant(merchant_settings.merchant_id))
    or (select private.is_portal_admin())
  );

drop policy if exists merchant_settings_delete on public.merchant_settings;
create policy merchant_settings_delete on public.merchant_settings
  for delete to authenticated
  using (
    (select private.is_staff_for_merchant(merchant_settings.merchant_id))
    or (select private.is_portal_admin())
  );
