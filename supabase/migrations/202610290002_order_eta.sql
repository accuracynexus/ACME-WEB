-- ETA real del pedido para la app del cliente: order_eta(pedido).
--
-- Usa la posicion actual del repartidor (driver_current_state, la actualiza
-- driver_ping_location), su velocidad reciente (driver_locations), el local
-- (merchant_branches: lat, lng, prep_time_avg_min) y el destino
-- (order_delivery_details: lat, lng).
--
--   - Sin repartidor: lo que falta de preparacion + del local a la casa + 5
--     minutos para asignarlo.
--   - Repartidor yendo al local: lo que tarde mas entre llegar al local y que
--     terminen de preparar, + 2 minutos para recoger + del local a la casa.
--   - Recogido / en camino: de donde esta el repartidor a la casa.
--
-- Las distancias son en linea recta por 1.3 (las calles no van rectas). La
-- velocidad sale de los latidos del repartidor de los ultimos 5 minutos
-- (distancia recorrida entre puntos / tiempo), porque speed_kmh casi siempre
-- llega en 0. Solo se usa si cubren al menos 45 segundos y 100 m, y queda entre
-- 10 y 50 km/h; si no, 18 km/h, lo normal de una moto en la ciudad.
--
-- El repartidor llego a la casa cuando orders.arrived_at tiene fecha (la app
-- del repartidor debe marcarla); entonces eta_min = 0 y fase = 'llego'.
-- Si el ultimo latido del repartidor tiene mas de 3 minutos, senal_vieja = true
-- y la app puede decir "aproximado".
--
-- Solo responde al cliente dueno del pedido (o al backend con service role).
-- Para pedidos cerrados (entregado, cancelado, fallido) o sin coordenadas del
-- destino o del local, eta_min es null.

create or replace function public.distancia_km(p_lat1 numeric, p_lng1 numeric, p_lat2 numeric, p_lng2 numeric)
returns numeric
language sql
immutable
as $$
  select case when p_lat1 is null or p_lng1 is null or p_lat2 is null or p_lng2 is null then null
    else 2 * 6371 * asin(sqrt(
      power(sin(radians((p_lat2 - p_lat1)::float8) / 2), 2)
      + cos(radians(p_lat1::float8)) * cos(radians(p_lat2::float8))
        * power(sin(radians((p_lng2 - p_lng1)::float8) / 2), 2)))::numeric
  end;
$$;

create or replace function public.order_eta(p_order_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  c_factor_calles constant numeric := 1.3;
  c_velocidad_kmh constant numeric := 18;
  v_uid uuid := auth.uid();
  v_es_backend boolean := coalesce(auth.jwt() ->> 'role', '') = 'service_role';
  v_order public.orders%rowtype;
  v_status text;
  v_branch record;
  v_dest record;
  v_driver_lat numeric;
  v_driver_lng numeric;
  v_driver_visto timestamptz;
  v_velocidad numeric;
  v_prep_restante numeric := 0;
  v_local_casa numeric;
  v_repartidor_local numeric;
  v_repartidor_casa numeric;
  v_minutos numeric;
  v_fase text;
begin
  select * into v_order from public.orders where id = p_order_id;
  if not found or not (v_es_backend or (v_uid is not null and v_order.customer_id = v_uid)) then
    raise exception 'Pedido no encontrado.' using errcode = 'no_data_found';
  end if;
  v_status := v_order.status::text;

  if v_status in ('delivered', 'cancelled', 'failed') then
    return jsonb_build_object('order_id', p_order_id, 'fase', 'cerrado', 'status', v_status, 'eta_min', null);
  end if;

  select b.lat, b.lng, coalesce(nullif(b.prep_time_avg_min, 0), 20) as prep
    into v_branch from public.merchant_branches b where b.id = v_order.branch_id;
  select d.lat, d.lng into v_dest from public.order_delivery_details d where d.order_id = p_order_id;

  if v_order.current_driver_id is not null then
    select s.last_lat, s.last_lng, s.last_seen_at
      into v_driver_lat, v_driver_lng, v_driver_visto
      from public.driver_current_state s where s.driver_id = v_order.current_driver_id;
    select case when sum(t.horas) >= 45.0 / 3600 and sum(t.km) >= 0.1 then sum(t.km) / sum(t.horas) end
      into v_velocidad
      from (select public.distancia_km(lag(l.lat) over w, lag(l.lng) over w, l.lat, l.lng) as km,
                   extract(epoch from l.recorded_at - lag(l.recorded_at) over w) / 3600 as horas
              from public.driver_locations l
             where l.driver_id = v_order.current_driver_id
               and l.recorded_at >= now() - interval '5 minutes'
            window w as (order by l.recorded_at)) t
     where t.km is not null and t.horas > 0;
  end if;
  v_velocidad := case when v_velocidad is null then c_velocidad_kmh else least(greatest(v_velocidad, 10), 50) end;

  -- Lo que falta de preparacion: desde que el local lo acepto o empezo. Si aun
  -- no lo acepta (o falta el pago), la preparacion completa sigue pendiente.
  if v_status not in ('ready_for_pickup', 'picked_up', 'on_the_way') and v_order.ready_at is null then
    v_prep_restante := greatest(0, v_branch.prep
      - coalesce(extract(epoch from now() - coalesce(v_order.preparing_at, v_order.accepted_at,
                                                     v_order.merchant_confirmed_at)) / 60, 0));
  end if;

  v_local_casa := public.distancia_km(v_branch.lat, v_branch.lng, v_dest.lat, v_dest.lng) * c_factor_calles;
  v_repartidor_local := public.distancia_km(v_driver_lat, v_driver_lng, v_branch.lat, v_branch.lng) * c_factor_calles;
  v_repartidor_casa := public.distancia_km(v_driver_lat, v_driver_lng, v_dest.lat, v_dest.lng) * c_factor_calles;

  if v_status in ('picked_up', 'on_the_way') and v_order.arrived_at is not null then
    v_fase := 'llego';
    v_minutos := 0;
  elsif v_status in ('picked_up', 'on_the_way') then
    v_fase := 'en_camino';
    v_minutos := coalesce(v_repartidor_casa, v_local_casa) / v_velocidad * 60;
  elsif v_order.current_driver_id is not null and v_repartidor_local is not null then
    v_fase := 'yendo_al_local';
    v_minutos := greatest(v_repartidor_local / v_velocidad * 60, v_prep_restante) + 2
                 + v_local_casa / v_velocidad * 60;
  else
    v_fase := case when v_status = 'pending_payment' then 'esperando_pago' else 'preparando' end;
    v_minutos := v_prep_restante + 5 + v_local_casa / v_velocidad * 60;
  end if;

  -- Sin coordenadas del destino (o del local) no hay ruta: eta_min null, no un numero inventado.
  v_minutos := case when v_fase = 'llego' then 0 when v_minutos is not null then greatest(1, ceil(v_minutos)) end;

  return jsonb_build_object(
    'order_id', p_order_id,
    'status', v_status,
    'fase', v_fase,
    'eta_min', v_minutos,
    'eta_at', case when v_minutos is not null then now() + make_interval(mins => v_minutos::int) end,
    'distancia_km', round(coalesce(case when v_fase = 'en_camino' then v_repartidor_casa end,
                                   case when v_fase = 'yendo_al_local' then v_repartidor_local + v_local_casa end,
                                   v_local_casa), 2),
    'repartidor', case when v_driver_lat is null then null else jsonb_build_object(
                    'lat', v_driver_lat, 'lng', v_driver_lng, 'visto_en', v_driver_visto) end,
    'senal_vieja', v_driver_visto is not null and v_driver_visto < now() - interval '3 minutes',
    'velocidad_kmh', round(v_velocidad, 1)
  );
end;
$$;

revoke all on function public.distancia_km(numeric, numeric, numeric, numeric) from public, anon;
revoke all on function public.order_eta(uuid) from public, anon;
grant execute on function public.order_eta(uuid) to authenticated;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.order_eta(uuid) to service_role;
  end if;
end;
$$;

notify pgrst, 'reload schema';
