-- Ensure customer delivery addresses can store the operational map point.
-- No new table is needed: customer_addresses links customers to addresses,
-- and addresses stores the reusable delivery location.

alter table public.addresses
  add column if not exists lat numeric(10, 7),
  add column if not exists lng numeric(10, 7);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'addresses_lat_range'
      and conrelid = 'public.addresses'::regclass
  ) then
    alter table public.addresses
      add constraint addresses_lat_range
      check (lat is null or (lat >= -90 and lat <= 90));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'addresses_lng_range'
      and conrelid = 'public.addresses'::regclass
  ) then
    alter table public.addresses
      add constraint addresses_lng_range
      check (lng is null or (lng >= -180 and lng <= 180));
  end if;
end $$;

create index if not exists addresses_lat_lng_idx
  on public.addresses (lat, lng)
  where lat is not null and lng is not null;

comment on column public.addresses.lat is 'Latitude in decimal degrees for courier routing and customer delivery points.';
comment on column public.addresses.lng is 'Longitude in decimal degrees for courier routing and customer delivery points.';

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'addresses'
      and column_name = 'latitude'
  ) and exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'addresses'
      and column_name = 'longitude'
  ) then
    update public.addresses
    set
      lat = coalesce(lat, latitude),
      lng = coalesce(lng, longitude)
    where (lat is null or lng is null)
      and latitude is not null
      and longitude is not null;
  end if;
end $$;
