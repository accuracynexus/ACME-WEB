-- Crea el bucket product-images para las fotos de productos del catalogo.
-- Mismo esquema que 2026-05-04-merchant-logos-storage.sql: bucket publico
-- para que las URLs funcionen sin autenticacion en el marketplace.
--
-- Limite mas alto que el de logos (5 MB): una foto de plato suele pesar
-- mas que un logotipo.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  5242880,  -- 5 MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do nothing;

-- Subir imagenes (admins y cuentas de comercio)
drop policy if exists product_images_upload on storage.objects;
create policy product_images_upload
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'product-images');

-- Reemplazar una imagen existente
drop policy if exists product_images_update on storage.objects;
create policy product_images_update
  on storage.objects
  for update
  to authenticated
  using (bucket_id = 'product-images');

-- Borrar la imagen anterior cuando se reemplaza
drop policy if exists product_images_delete on storage.objects;
create policy product_images_delete
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'product-images');

-- Lectura publica para que las fotos se vean en el marketplace
drop policy if exists product_images_public_read on storage.objects;
create policy product_images_public_read
  on storage.objects
  for select
  to public
  using (bucket_id = 'product-images');
