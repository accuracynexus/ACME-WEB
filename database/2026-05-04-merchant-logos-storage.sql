-- Creates the merchant-logos storage bucket for merchant logo uploads.
-- The bucket is public so logo URLs can be accessed without authentication.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'merchant-logos',
  'merchant-logos',
  true,
  2097152,  -- 2 MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do nothing;

-- Allow authenticated users (admins and merchant accounts) to upload logos
drop policy if exists merchant_logos_upload on storage.objects;
create policy merchant_logos_upload
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'merchant-logos');

-- Allow authenticated users to update (overwrite) existing logos
drop policy if exists merchant_logos_update on storage.objects;
create policy merchant_logos_update
  on storage.objects
  for update
  to authenticated
  using (bucket_id = 'merchant-logos');

-- Allow authenticated users to delete old logos
drop policy if exists merchant_logos_delete on storage.objects;
create policy merchant_logos_delete
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'merchant-logos');

-- Allow public read access so logo URLs work without authentication
drop policy if exists merchant_logos_public_read on storage.objects;
create policy merchant_logos_public_read
  on storage.objects
  for select
  to public
  using (bucket_id = 'merchant-logos');
