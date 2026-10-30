-- ACME - 30 de octubre
-- La llegada del repartidor en order_eta.
--
-- order_eta comparaba el estado con 'arrived_waiting', que no es un valor del
-- enum order_status: la rama estaba muerta y un pedido con el repartidor ya en
-- la puerta seguia reportando 'en_camino'. La senal real es orders.arrived_at,
-- que escribe driver_mark_arrived.

CREATE OR REPLACE FUNCTION public.order_eta(p_order_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  select b.lat, b.lng, coalesce(b.prep_time_avg_min, 20) as prep
    into v_branch from public.merchant_branches b where b.id = v_order.branch_id;
  select d.lat, d.lng into v_dest from public.order_delivery_details d where d.order_id = p_order_id;

  if v_order.current_driver_id is not null then
    select s.last_lat, s.last_lng, s.last_seen_at
      into v_driver_lat, v_driver_lng, v_driver_visto
      from public.driver_current_state s where s.driver_id = v_order.current_driver_id;
    select avg(l.speed_kmh) into v_velocidad
      from public.driver_locations l
     where l.driver_id = v_order.current_driver_id
       and l.recorded_at >= now() - interval '5 minutes'
       and l.speed_kmh >= 3;
  end if;
  v_velocidad := case when v_velocidad is null then c_velocidad_kmh else greatest(v_velocidad, 10) end;

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

  -- La llegada se lee de orders.arrived_at, que es lo que escribe el boton
  -- "Ya llegue" del repartidor (driver_mark_arrived). Antes se comparaba con
  -- un estado 'arrived_waiting' que no existe en el enum order_status: la
  -- rama nunca corria y un pedido con el repartidor en la puerta seguia
  -- devolviendo fase 'en_camino' con minutos de viaje.
  if v_order.arrived_at is not null then
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
$function$
;
