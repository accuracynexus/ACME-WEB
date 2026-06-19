-- Add geocoding fields and backfill merchant branch coordinates in one SQL.
--
-- IMPORTANTE:
-- Supabase SQL no puede leer un archivo local .md directamente. Para que todo
-- vaya en el mismo SQL, pega las filas del markdown dentro del bloque
-- insert into _address_coordinate_source (...) values (...).
--
-- Formato:
--   ('Nombre del negocio o sucursal', -12.7861234, -74.9761234, 'nota/fila fuente')

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

create temp table if not exists _address_coordinate_source (
  source_name text not null,
  latitude numeric(10, 7) not null,
  longitude numeric(10, 7) not null,
  source_note text
) on commit drop;

truncate table _address_coordinate_source;

-- PEGA AQUI TODAS LAS COORDENADAS DEL MARKDOWN.
-- Ejemplo:
-- insert into _address_coordinate_source (source_name, latitude, longitude, source_note) values
--   ('Restobar Oasis', -12.7861234, -74.9761234, 'coordenadas_establecimientos_huancavelica.md linea 10'),
--   ('Cafe Zorrilla', -12.7854321, -74.9754321, 'coordenadas_establecimientos_huancavelica.md linea 11');

-- Cuando pegues las filas reales, descomenta el insert anterior o reemplazalo
-- por un insert equivalente terminado en punto y coma.

with source_rows as (
  select
    row_number() over () as source_row_id,
    source_name,
    latitude,
    longitude,
    source_note,
    lower(
      regexp_replace(
        translate(
          source_name,
          'áéíóúÁÉÍÓÚñÑ',
          'aeiouAEIOUnN'
        ),
        '[^a-zA-Z0-9]+',
        ' ',
        'g'
      )
    ) as normalized_source_name
  from _address_coordinate_source
  where latitude between -13.2 and -12.2
    and longitude between -75.5 and -74.2
),
branch_candidates as (
  select
    a.id as address_id,
    mb.id as branch_id,
    m.id as merchant_id,
    m.trade_name,
    mb.name as branch_name,
    concat_ws(', ', a.line1, a.district, a.city) as address_label,
    lower(
      regexp_replace(
        translate(
          concat_ws(' ', m.trade_name, mb.name, a.line1, a.district, a.city),
          'áéíóúÁÉÍÓÚñÑ',
          'aeiouAEIOUnN'
        ),
        '[^a-zA-Z0-9]+',
        ' ',
        'g'
      )
    ) as normalized_candidate
  from public.merchant_branches mb
  join public.merchants m on m.id = mb.merchant_id
  join public.addresses a on a.id = mb.address_id
),
ranked_matches as (
  select
    sr.*,
    bc.address_id,
    bc.branch_id,
    bc.merchant_id,
    bc.trade_name,
    bc.branch_name,
    bc.address_label,
    case
      when bc.normalized_candidate = sr.normalized_source_name then 1.0
      when bc.normalized_candidate like '%' || sr.normalized_source_name || '%' then 0.92
      when sr.normalized_source_name like '%' || lower(regexp_replace(translate(bc.trade_name, 'áéíóúÁÉÍÓÚñÑ', 'aeiouAEIOUnN'), '[^a-zA-Z0-9]+', ' ', 'g')) || '%' then 0.88
      when sr.normalized_source_name like '%' || lower(regexp_replace(translate(bc.branch_name, 'áéíóúÁÉÍÓÚñÑ', 'aeiouAEIOUnN'), '[^a-zA-Z0-9]+', ' ', 'g')) || '%' then 0.84
      else 0
    end as match_score,
    row_number() over (
      partition by sr.source_row_id
      order by
        case
          when bc.normalized_candidate = sr.normalized_source_name then 1.0
          when bc.normalized_candidate like '%' || sr.normalized_source_name || '%' then 0.92
          when sr.normalized_source_name like '%' || lower(regexp_replace(translate(bc.trade_name, 'áéíóúÁÉÍÓÚñÑ', 'aeiouAEIOUnN'), '[^a-zA-Z0-9]+', ' ', 'g')) || '%' then 0.88
          when sr.normalized_source_name like '%' || lower(regexp_replace(translate(bc.branch_name, 'áéíóúÁÉÍÓÚñÑ', 'aeiouAEIOUnN'), '[^a-zA-Z0-9]+', ' ', 'g')) || '%' then 0.84
          else 0
        end desc,
        bc.trade_name asc,
        bc.branch_name asc
    ) as match_rank
  from source_rows sr
  cross join branch_candidates bc
),
accepted_matches as (
  select *
  from ranked_matches
  where match_rank = 1
    and match_score >= 0.84
),
updated_addresses as (
  update public.addresses a
  set
    latitude = am.latitude,
    longitude = am.longitude,
    geocoding_source = 'manual_sql_huancavelica',
    geocoding_confidence = case
      when am.match_score >= 0.92 then 'high'
      when am.match_score >= 0.84 then 'medium'
      else 'review'
    end,
    geocoded_at = now(),
    coordinates_note = concat_ws(
      ' | ',
      am.source_note,
      'source=' || am.source_name,
      'matched=' || am.trade_name || ' / ' || am.branch_name,
      'score=' || am.match_score::text
    )
  from accepted_matches am
  where a.id = am.address_id
  returning a.id, am.source_name, am.trade_name, am.branch_name, am.match_score
)
select
  (select count(*) from _address_coordinate_source) as source_rows,
  (select count(*) from source_rows) as source_rows_in_huancavelica_bounds,
  (select count(*) from accepted_matches) as accepted_matches,
  (select count(*) from updated_addresses) as updated_addresses;
