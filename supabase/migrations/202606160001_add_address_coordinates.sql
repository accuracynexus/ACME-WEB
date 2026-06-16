-- Add geocoding fields for merchant/customer addresses.
-- Apply this migration before exposing coordinates in frontend queries.

alter table public.addresses
  add column if not exists latitude numeric(10, 7),
  add column if not exists longitude numeric(10, 7),
  add column if not exists geocoding_source text,
  add column if not exists geocoding_confidence text,
  add column if not exists geocoded_at timestamptz,
  add column if not exists coordinates_note text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'addresses_latitude_range'
      and conrelid = 'public.addresses'::regclass
  ) then
    alter table public.addresses
      add constraint addresses_latitude_range
      check (latitude is null or (latitude >= -90 and latitude <= 90));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'addresses_longitude_range'
      and conrelid = 'public.addresses'::regclass
  ) then
    alter table public.addresses
      add constraint addresses_longitude_range
      check (longitude is null or (longitude >= -180 and longitude <= 180));
  end if;
end $$;

create index if not exists addresses_coordinates_idx
  on public.addresses (latitude, longitude)
  where latitude is not null and longitude is not null;

comment on column public.addresses.latitude is 'Latitude in decimal degrees for maps/routing.';
comment on column public.addresses.longitude is 'Longitude in decimal degrees for maps/routing.';
comment on column public.addresses.geocoding_source is 'Origin of coordinates, for example manual_markdown or geocoding_provider.';
comment on column public.addresses.geocoding_confidence is 'Match confidence used when coordinates were assigned.';
comment on column public.addresses.geocoded_at is 'Timestamp when coordinates were last assigned.';
comment on column public.addresses.coordinates_note is 'Human-readable note/source row for coordinate audit.';
