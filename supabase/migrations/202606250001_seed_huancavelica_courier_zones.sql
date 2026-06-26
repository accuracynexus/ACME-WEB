-- ============================================================
-- ACME Courier - Zonas tarifarias urbanas Huancavelica
-- Fecha: 2026-06-25
-- ============================================================

insert into public.delivery_zones (
  name,
  polygon_geojson,
  base_fee,
  min_order_amount,
  estimated_minutes,
  is_active,
  created_at,
  updated_at
)
select
  zone_name,
  '{"type":"Polygon","coordinates":[]}'::jsonb,
  base_fee,
  0,
  estimated_minutes,
  true,
  now(),
  now()
from (
  values
    ('Huancavelica Zona A - Casco urbano centrico', 5.50::numeric, 25),
    ('Huancavelica Zona B - Zona urbana conectada', 8.00::numeric, 35),
    ('Huancavelica Zona C - Periferia urbana o zonas altas', 12.00::numeric, 45),
    ('Huancavelica Zona D - Fuera de ciudad', 10.00::numeric, 60)
) as seed(zone_name, base_fee, estimated_minutes)
where not exists (
  select 1
  from public.delivery_zones dz
  where dz.name = seed.zone_name
);
