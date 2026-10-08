-- El despacho (dispatch_order, en ACME-DRIVER) mide la distancia desde
-- merchant_branches.geom, que el trigger trg_sync_merchant_branch_geom
-- deriva de merchant_branches.lat/lng. Hay sucursales que tienen el punto
-- solo en su direccion (addresses.lat/lng): el portal lo muestra en el mapa,
-- pero la sucursal queda sin geom y sus pedidos listos nunca se ofrecen a
-- ningun repartidor. Paso el punto de la direccion a la sucursal.

update public.merchant_branches b
set lat = a.lat,
    lng = a.lng
from public.addresses a
where a.id = b.address_id
  and (b.lat is null or b.lng is null)
  and a.lat is not null
  and a.lng is not null;
