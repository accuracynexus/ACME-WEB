-- Las fotos de producto solo las maneja el local dueño de la carpeta.
--
-- Problema: las politicas de storage.objects para el bucket product-images solo
-- pedian estar autenticado. Cualquier cuenta con sesion (un cliente, el personal
-- de otro local) podia subir, reemplazar o BORRAR las fotos de cualquier
-- comercio. El panel ya sube a "<merchant_id>/producto-<timestamp>.<ext>"
-- (adminService.uploadProductImage), asi que basta exigir esa carpeta.
--
-- Seguro de aplicar: el bucket esta vacio (0 objetos) y el unico codigo que sube
-- ahi usa esa ruta. La lectura publica no cambia.
--
-- Rollback: volver a crear las tres politicas con solo (bucket_id = 'product-images').

create or replace function private.can_manage_product_image(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.is_portal_admin(), false)
      or (
        -- La primera carpeta tiene que ser un uuid antes de convertirla: un
        -- nombre raro no debe tumbar la consulta con un error de cast.
        split_part(p_name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        and coalesce(private.is_staff_for_merchant(split_part(p_name, '/', 1)::uuid), false)
      );
$$;

grant execute on function private.can_manage_product_image(text) to authenticated;

drop policy if exists product_images_upload on storage.objects;
create policy product_images_upload on storage.objects
  for insert to authenticated
  with check (bucket_id = 'product-images' and private.can_manage_product_image(name));

drop policy if exists product_images_update on storage.objects;
create policy product_images_update on storage.objects
  for update to authenticated
  using (bucket_id = 'product-images' and private.can_manage_product_image(name))
  with check (bucket_id = 'product-images' and private.can_manage_product_image(name));

drop policy if exists product_images_delete on storage.objects;
create policy product_images_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'product-images' and private.can_manage_product_image(name));
