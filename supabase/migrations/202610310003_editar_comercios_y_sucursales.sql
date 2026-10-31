-- Permite editar comercios y sucursales desde el panel, y subir logos.
--
-- Hoy `merchants` y `merchant_branches` tienen RLS activa con politicas de
-- lectura e insercion, pero NINGUNA de UPDATE: la base filtra el UPDATE y lo
-- deja en cero filas sin dar error. Cambiar nombre, telefono, estado o logo de
-- un comercio, o los datos de una sucursal, no se guardaba (comprobado con una
-- transaccion descartada como usuario admin: 0 filas).
--
-- Mismo criterio que `products_staff_manage`: el personal del propio comercio o
-- un admin. El WITH CHECK impide mover una fila a otro comercio.
--
-- Tambien: el bucket `merchant-assets` (donde ya estan los logos) no tenia
-- politicas de escritura, asi que subir un logo fallaba. Se permite escribir
-- solo en `logos/<id del comercio>/...` al personal de ese comercio o a un admin.
--
-- Rollback:
--   drop policy merchants_staff_update on public.merchants;
--   drop policy merchant_branches_staff_update on public.merchant_branches;
--   drop policy merchant_assets_logos_insert on storage.objects;
--   drop policy merchant_assets_logos_update on storage.objects;
--   drop policy merchant_assets_logos_delete on storage.objects;

drop policy if exists merchants_staff_update on public.merchants;
create policy merchants_staff_update on public.merchants
  for update to authenticated
  using (
    (select private.is_staff_for_merchant(merchants.id))
    or (select private.is_admin())
  )
  with check (
    (select private.is_staff_for_merchant(merchants.id))
    or (select private.is_admin())
  );

drop policy if exists merchant_branches_staff_update on public.merchant_branches;
create policy merchant_branches_staff_update on public.merchant_branches
  for update to authenticated
  using (
    (select private.is_staff_for_merchant(merchant_branches.merchant_id))
    or (select private.is_admin())
  )
  with check (
    (select private.is_staff_for_merchant(merchant_branches.merchant_id))
    or (select private.is_admin())
  );

-- Logos: logos/<merchant_id>/archivo. Lectura ya es publica (bucket publico).
drop policy if exists merchant_assets_logos_insert on storage.objects;
create policy merchant_assets_logos_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'merchant-assets'
    and (storage.foldername(name))[1] = 'logos'
    and (
      (select private.is_admin())
      or (storage.foldername(name))[2] in (
        select m::text from unnest(coalesce((select private.user_merchant_ids()), array[]::uuid[])) as m
      )
    )
  );

drop policy if exists merchant_assets_logos_update on storage.objects;
create policy merchant_assets_logos_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'merchant-assets'
    and (storage.foldername(name))[1] = 'logos'
    and (
      (select private.is_admin())
      or (storage.foldername(name))[2] in (
        select m::text from unnest(coalesce((select private.user_merchant_ids()), array[]::uuid[])) as m
      )
    )
  );

drop policy if exists merchant_assets_logos_delete on storage.objects;
create policy merchant_assets_logos_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'merchant-assets'
    and (storage.foldername(name))[1] = 'logos'
    and (
      (select private.is_admin())
      or (storage.foldername(name))[2] in (
        select m::text from unnest(coalesce((select private.user_merchant_ids()), array[]::uuid[])) as m
      )
    )
  );

notify pgrst, 'reload schema';
