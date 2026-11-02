-- Alta demanda y tiempo aproximado de atencion.
--
-- Que hace:
--   1. demanda_config: una sola fila con los numeros que se pueden ajustar
--      (repartidores por defecto = 2, umbrales, etc.).
--   2. driver_set_presence(online, lat, lng): la app del repartidor la llama al
--      ponerse "En linea" y cada 2 minutos mientras siga en linea (latido).
--      Escribe driver_current_state (is_online, status, last_seen_at).
--   3. demanda_calcular(pedido): cuenta repartidores en turno y pedidos abiertos
--      y calcula cuanto espera un pedido nuevo (o uno ya hecho) por un repartidor.
--      Es interna: no la llaman las apps.
--   4. demanda_actual(local, lat, lng): lo que ve el cliente antes de pedir.
--      Solo devuelve el nivel, los minutos y el mensaje, no cuantos pedidos hay.
--   5. order_eta(pedido): igual que la version ya aplicada, pero mientras el
--      pedido no tiene repartidor suma la espera por repartidor en vez de los
--      5 minutos fijos, y devuelve alta_demanda / nivel_demanda.
--
-- Repartidor "en turno" = cualquiera de estas dos cosas:
--   - driver_current_state.is_online y dio senal (last_seen_at) en los ultimos
--     15 minutos. Si cierra la app o se le acaba la bateria, a los 15 minutos
--     deja de contar solo.
--   - Lleva un pedido abierto (orders.current_driver_id) creado en las ultimas
--     6 horas: si esta entregando, esta trabajando aunque no haya senal.
-- Si no se detecta ninguno (por ejemplo, mientras los repartidores aun no
-- actualizan la app), se usa repartidores_por_defecto (2) y la respuesta lo
-- marca con repartidores_estimados = true.
-- Para fijar el numero a mano por un rato (por ejemplo, un dia de lluvia con 4):
--   update public.demanda_config set repartidores_manual = 4,
--          repartidores_manual_hasta = now() + interval '5 hours';
--
-- Como se calcula la espera por repartidor (como una fila real):
--   1. Para cada moto se estima cuando se libera: si ya recogio, lo que le
--      falta del viaje (segun la hora de recojo) mas volver; si aun va al
--      local, 80% de una vuelta; si esta libre, ya.
--   2. Los pedidos pagados sin moto, en orden de llegada, toman la moto que se
--      libera primero y la ocupan una vuelta.
--   3. Un pedido nuevo espera a la siguiente moto que quede libre.
--   La preparacion corre en paralelo: el tiempo final es lo mayor entre que el
--   local termine y que llegue la moto, mas el viaje a la casa.
--   ciclo = cuanto tarda un repartidor en una vuelta completa: mediana de
--   (entregado - recogido) de los ultimos 14 dias, por 2 (ida y vuelta), + 5
--   minutos para recoger. Entre 15 y 60 minutos; con menos de 5 entregas, 30.
--
-- Niveles: normal (espera < 15 min), alta (15 a 34), muy_alta (35 o mas, o
-- cero repartidores fijados a mano).
--
-- No cambia datos de pedidos. Se puede correr mas de una vez.

-- ——— 1. Configuracion ———

create table if not exists public.demanda_config (
  id smallint primary key default 1 check (id = 1),
  repartidores_por_defecto integer not null default 2 check (repartidores_por_defecto >= 1),
  repartidores_manual integer check (repartidores_manual >= 0),
  repartidores_manual_hasta timestamptz,
  senal_minutos integer not null default 15 check (senal_minutos between 3 and 120),
  ciclo_defecto_min integer not null default 30 check (ciclo_defecto_min between 10 and 120),
  umbral_alta_min integer not null default 15,
  umbral_muy_alta_min integer not null default 35,
  updated_at timestamptz not null default now()
);

insert into public.demanda_config (id) values (1) on conflict (id) do nothing;

alter table public.demanda_config enable row level security;

drop policy if exists demanda_config_admin_select on public.demanda_config;
create policy demanda_config_admin_select on public.demanda_config
  for select to authenticated using (public.is_admin());

drop policy if exists demanda_config_admin_update on public.demanda_config;
create policy demanda_config_admin_update on public.demanda_config
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- ——— 2. Latido del repartidor ———

create or replace function public.driver_set_presence(
  p_online boolean,
  p_lat numeric default null,
  p_lng numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_tiene_pedido boolean;
  v_estado text;
  v_tipo text;
begin
  if v_uid is null or not exists (select 1 from public.drivers d where d.user_id = v_uid) then
    raise exception 'Solo un repartidor puede marcar su turno.' using errcode = '42501';
  end if;

  select exists (
    select 1 from public.orders o
     where o.current_driver_id = v_uid
       and o.status::text not in ('delivered', 'cancelled', 'failed')
       and coalesce(o.placed_at, o.created_at) >= now() - interval '6 hours'
  ) into v_tiene_pedido;

  v_estado := case when not p_online then 'offline' when v_tiene_pedido then 'busy' else 'available' end;

  -- status es un enum (driver_state); se castea al tipo real de la columna.
  select format_type(a.atttypid, a.atttypmod) into v_tipo
    from pg_attribute a
   where a.attrelid = 'public.driver_current_state'::regclass and a.attname = 'status';

  execute format(
    'insert into public.driver_current_state as s (driver_id, status, is_online, last_seen_at, updated_at, last_lat, last_lng)
     values ($1, %1$L::%2$s, $2, now(), now(), $3, $4)
     on conflict (driver_id) do update
       set status = excluded.status,
           is_online = excluded.is_online,
           last_seen_at = excluded.last_seen_at,
           updated_at = excluded.updated_at,
           last_lat = coalesce(excluded.last_lat, s.last_lat),
           last_lng = coalesce(excluded.last_lng, s.last_lng)',
    v_estado, v_tipo)
  using v_uid, p_online, p_lat, p_lng;

  return jsonb_build_object('online', p_online, 'status', v_estado, 'visto_en', now());
end;
$$;

revoke all on function public.driver_set_presence(boolean, numeric, numeric) from public, anon;
grant execute on function public.driver_set_presence(boolean, numeric, numeric) to authenticated;

-- ——— 3. Calculo (interno) ———

-- Pedidos de delivery abiertos y despachables de las ultimas 6 horas (lo mas
-- viejo se considera abandonado).
drop function if exists public.demanda_pedidos_abiertos();
create function public.demanda_pedidos_abiertos()
returns table (id uuid, current_driver_id uuid, desde timestamptz, status text, picked_up_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select o.id, o.current_driver_id, coalesce(o.placed_at, o.created_at), o.status::text, o.picked_up_at
    from public.orders o
   where o.status::text not in ('delivered', 'cancelled', 'failed', 'rejected', 'pending_payment')
     -- Recien creado y sin pagar: no se puede despachar (enforce_payment_before_dispatch).
     and not (o.status::text in ('placed', 'pending') and coalesce(o.payment_status::text, '') <> 'paid')
     and coalesce(o.placed_at, o.created_at) >= now() - interval '6 hours'
     and coalesce(o.fulfillment_type::text, 'delivery') not in ('pickup', 'recojo', 'takeaway', 'store_pickup');
$$;

revoke all on function public.demanda_pedidos_abiertos() from public, anon, authenticated;

-- Para que contar pedidos abiertos y la vuelta del historial no recorra toda la tabla.
create index if not exists orders_demanda_desde_idx on public.orders ((coalesce(placed_at, created_at)));
create index if not exists orders_demanda_entregado_idx on public.orders (delivered_at) where delivered_at is not null;

create or replace function public.demanda_calcular(p_order_id uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_cfg public.demanda_config%rowtype;
  v_detectados integer;
  v_repartidores integer;
  v_estimados boolean := false;
  v_manual boolean := false;
  v_con_repartidor integer;
  v_sin_repartidor integer;
  v_ciclo numeric;
  v_viaje numeric;
  v_libres numeric[];
  v_fila record;
  v_i integer;
  v_j integer;
  v_muestras integer;
  v_espera numeric;
  v_nivel text;
  v_corte timestamptz;
  v_order_driver uuid;
begin
  select * into v_cfg from public.demanda_config where id = 1;
  if not found then
    v_cfg.repartidores_por_defecto := 2;
    v_cfg.senal_minutos := 15;
    v_cfg.ciclo_defecto_min := 30;
    v_cfg.umbral_alta_min := 15;
    v_cfg.umbral_muy_alta_min := 35;
  end if;

  -- Repartidores en turno: con senal reciente o con un pedido abierto.
  select count(*) into v_detectados
    from (
      select s.driver_id from public.driver_current_state s
       where s.is_online and s.last_seen_at >= now() - make_interval(mins => v_cfg.senal_minutos)
      union
      select a.current_driver_id from public.demanda_pedidos_abiertos() a
       where a.current_driver_id is not null
    ) t;

  if v_cfg.repartidores_manual is not null
     and (v_cfg.repartidores_manual_hasta is null or v_cfg.repartidores_manual_hasta > now()) then
    v_repartidores := v_cfg.repartidores_manual;
    v_manual := true;
  elsif v_detectados > 0 then
    v_repartidores := v_detectados;
  else
    v_repartidores := v_cfg.repartidores_por_defecto;
    v_estimados := true;
  end if;

  -- Duracion de una vuelta.
  select percentile_cont(0.5) within group (order by extract(epoch from o.delivered_at - o.picked_up_at) / 60),
         count(*)
    into v_ciclo, v_muestras
    from public.orders o
   where o.delivered_at >= now() - interval '14 days'
     and o.picked_up_at is not null
     and o.delivered_at > o.picked_up_at
     and o.delivered_at - o.picked_up_at < interval '2 hours';
  v_ciclo := case when v_muestras >= 5 then least(greatest(v_ciclo * 2 + 5, 15), 60)
                  else v_cfg.ciclo_defecto_min end;

  -- Cuando se libera cada moto. En vez de suponer que todas recien salen, se
  -- mira cuanto le falta a cada una:
  --   - ya recogio: lo que le falta del viaje (segun cuando recogio) + volver.
  --   - asignada pero aun no recoge: 80% de una vuelta.
  --   - libre: 0.
  -- Si lleva mas de un pedido, cada pedido extra suma un viaje.
  v_viaje := (v_ciclo - 5) / 2;
  select coalesce(array_agg(t.libre order by t.libre), '{}')
    into v_libres
    from (
      select greatest(r.libre_max, 0) + v_viaje * (r.pedidos - 1) as libre
        from (
          select a.current_driver_id, count(*) as pedidos,
                 max(case
                       when a.status in ('picked_up', 'on_the_way') and a.picked_up_at is not null
                         then greatest(1, v_viaje - extract(epoch from now() - a.picked_up_at) / 60) + v_viaje
                       when a.status in ('picked_up', 'on_the_way') then v_viaje * 1.5
                       else v_ciclo * 0.8
                     end) as libre_max
            from public.demanda_pedidos_abiertos() a
           where a.current_driver_id is not null
           group by a.current_driver_id
        ) r
    ) t;
  v_con_repartidor := coalesce(array_length(v_libres, 1), 0);

  -- Las motos libres (en turno sin pedido) y las que faltan para llegar al
  -- numero de repartidores estan disponibles ya. Si hay mas motos ocupadas que
  -- el numero fijado a mano, cuentan las que se liberan primero.
  while coalesce(array_length(v_libres, 1), 0) < v_repartidores loop
    v_libres := array_prepend(0::numeric, v_libres);
  end loop;
  if v_repartidores > 0 then
    v_libres := v_libres[1:v_repartidores];
  end if;

  -- Para un pedido ya hecho, solo va delante lo que entro antes que el; un
  -- pedido que ya tiene repartidor no espera.
  if p_order_id is not null then
    select o.current_driver_id, coalesce(o.placed_at, o.created_at)
      into v_order_driver, v_corte from public.orders o where o.id = p_order_id;
  end if;

  -- Fila: cada pedido sin moto, en orden de llegada, toma la moto que se libera
  -- primero y la ocupa una vuelta completa.
  v_sin_repartidor := 0;
  if v_repartidores > 0 then
    for v_fila in
      select a.id from public.demanda_pedidos_abiertos() a
       where a.current_driver_id is null
         and (v_corte is null or a.desde < v_corte)
         and (p_order_id is null or a.id <> p_order_id)
       order by a.desde
    loop
      v_sin_repartidor := v_sin_repartidor + 1;
      v_i := 1;
      for v_j in 2 .. v_repartidores loop
        if v_libres[v_j] < v_libres[v_i] then v_i := v_j; end if;
      end loop;
      v_libres[v_i] := v_libres[v_i] + v_ciclo;
    end loop;
  else
    select count(*) into v_sin_repartidor from public.demanda_pedidos_abiertos() a
     where a.current_driver_id is null and (v_corte is null or a.desde < v_corte)
       and (p_order_id is null or a.id <> p_order_id);
  end if;

  if v_order_driver is not null then
    v_espera := 0;
  elsif v_repartidores = 0 then
    v_espera := null;
  else
    select ceil(min(x)) into v_espera from unnest(v_libres) x;
  end if;

  v_nivel := case
    when v_repartidores = 0 then 'muy_alta'
    when v_espera >= v_cfg.umbral_muy_alta_min then 'muy_alta'
    when v_espera >= v_cfg.umbral_alta_min then 'alta'
    else 'normal' end;

  return jsonb_build_object(
    'repartidores', v_repartidores,
    'repartidores_detectados', v_detectados,
    'repartidores_estimados', v_estimados,
    'repartidores_manual', v_manual,
    'pedidos_con_repartidor', v_con_repartidor,
    'pedidos_esperando_repartidor', v_sin_repartidor,
    'ciclo_min', round(v_ciclo),
    'espera_repartidor_min', v_espera,
    'nivel', v_nivel,
    'alta_demanda', v_nivel <> 'normal'
  );
end;
$$;

revoke all on function public.demanda_calcular(uuid) from public, anon, authenticated;

-- ——— 4. Lo que ve el cliente antes de pedir ———

create or replace function public.demanda_actual(
  p_branch_id uuid default null,
  p_lat numeric default null,
  p_lng numeric default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  c_factor_calles constant numeric := 1.3;
  c_velocidad_kmh constant numeric := 18;
  v_d jsonb := public.demanda_calcular(null);
  v_espera numeric := (v_d ->> 'espera_repartidor_min')::numeric;
  v_nivel text := v_d ->> 'nivel';
  v_rep integer := (v_d ->> 'repartidores')::integer;
  v_prep numeric := 20;
  v_viaje numeric;
  v_km numeric;
  v_desde integer;
  v_hasta integer;
  v_mensaje text;
  v_branch record;
begin
  if p_branch_id is not null then
    select b.lat, b.lng, coalesce(nullif(b.prep_time_avg_min, 0), 20) as prep
      into v_branch from public.merchant_branches b where b.id = p_branch_id;
    if found then
      v_prep := v_branch.prep;
      v_km := public.distancia_km(v_branch.lat, v_branch.lng, p_lat, p_lng);
    end if;
  end if;
  -- Sin destino: unos 15 minutos del local a la casa.
  v_viaje := coalesce(v_km * c_factor_calles / c_velocidad_kmh * 60, 15);

  if v_espera is not null then
    -- El aviso de muchos pedidos sale solo si la espera por moto atrasa la
    -- entrega: si la moto llega mientras el local aun prepara, el cliente no
    -- nota nada y se muestra el tiempo normal.
    select case
             when v_espera + 5 - v_prep >= coalesce(c.umbral_muy_alta_min, 35) then 'muy_alta'
             when v_espera + 5 - v_prep >= coalesce(c.umbral_alta_min, 15) then 'alta'
             else 'normal' end
      into v_nivel
      from (select 1) x left join public.demanda_config c on c.id = 1;
    -- El repartidor llega al local cuando se libera (+5) o cuando esta listo, lo que pase despues.
    -- Numeros redondos de 5 en 5: "40 a 50 min" se lee mejor que "42 a 57 min".
    v_desde := (greatest(10, floor((greatest(v_prep, v_espera + 5) + v_viaje) / 5) * 5))::integer;
    v_hasta := (ceil(greatest(v_prep, v_espera + 5) + v_viaje) * case when v_nivel = 'normal' then 1.15 else 1.25 end / 5)::integer * 5;
    if v_hasta <= v_desde then v_hasta := v_desde + 5; end if;
    -- Mas de 2 horas no se promete un rango: solo "mas de 2 horas".
    if v_desde > 120 then
      v_desde := 120;
      v_hasta := null;
    end if;
  end if;

  -- Tono: realista pero tranquilo. No se dice cuantos repartidores hay ni se
  -- usan palabras de alarma; se da el rango y se agradece la paciencia.
  v_mensaje := case
    when v_espera is null then
      'Por ahora no tenemos repartidores libres. Puedes pedir igual: tu pedido sale apenas se libere uno.'
    when v_hasta is null then
      'Estamos con muchos pedidos en este momento, así que el tuyo tomará más tiempo de lo habitual. ¡Gracias por tu paciencia!'
    when v_nivel = 'normal' then
      format('Tu pedido llegaría en unos %s a %s min.', v_desde, v_hasta)
    else
      format('Estamos con muchos pedidos en este momento. Tu pedido llegaría en unos %s a %s min. ¡Gracias por tu paciencia!',
             v_desde, v_hasta)
  end;

  return jsonb_build_object(
    'nivel', v_nivel,
    'alta_demanda', v_nivel <> 'normal',
    'repartidores', v_rep,
    'espera_repartidor_min', v_espera,
    'eta_min', v_desde,
    'eta_max', v_hasta,
    'mensaje', v_mensaje,
    'calculado_en', now()
  );
end;
$$;

revoke all on function public.demanda_actual(uuid, numeric, numeric) from public;
grant execute on function public.demanda_actual(uuid, numeric, numeric) to anon, authenticated;

-- ——— 5. order_eta con la espera por repartidor ———
-- Igual a la version ya aplicada (pedidos-sin-pagar/eta-solo-cambios.sql),
-- con los cambios marcados "-- DEMANDA".

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
  v_demanda jsonb;          -- DEMANDA
  v_espera numeric;         -- DEMANDA
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

  if v_status not in ('ready_for_pickup', 'picked_up', 'on_the_way') and v_order.ready_at is null then
    v_prep_restante := greatest(0, v_branch.prep
      - coalesce(extract(epoch from now() - coalesce(v_order.preparing_at, v_order.accepted_at,
                                                     v_order.merchant_confirmed_at)) / 60, 0));
  end if;

  v_local_casa := public.distancia_km(v_branch.lat, v_branch.lng, v_dest.lat, v_dest.lng) * c_factor_calles;
  v_repartidor_local := public.distancia_km(v_driver_lat, v_driver_lng, v_branch.lat, v_branch.lng) * c_factor_calles;
  v_repartidor_casa := public.distancia_km(v_driver_lat, v_driver_lng, v_dest.lat, v_dest.lng) * c_factor_calles;

  -- DEMANDA: cuanto espera este pedido por un repartidor libre.
  v_demanda := public.demanda_calcular(p_order_id);
  -- null = no hay repartidores (fijado a mano en 0): no se promete un tiempo.
  v_espera := (v_demanda ->> 'espera_repartidor_min')::numeric;

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
    -- DEMANDA: antes era v_prep_restante + 5. Ahora el repartidor llega cuando
    -- se libera (+5 para llegar al local) o cuando esta listo, lo que pase despues.
    v_minutos := case when v_espera is not null
                      then greatest(v_prep_restante, v_espera + 5) + v_local_casa / v_velocidad * 60 end;
  end if;

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
    'velocidad_kmh', round(v_velocidad, 1),
    -- DEMANDA
    'espera_repartidor_min', case when v_fase in ('preparando', 'esperando_pago') then v_espera else 0 end,
    'sin_repartidores', v_fase in ('preparando', 'esperando_pago') and v_espera is null,
    -- Igual que en el carrito: solo hay "muchos pedidos" si la moto atrasa la entrega.
    'nivel_demanda', case
      when v_fase not in ('preparando', 'esperando_pago') then 'normal'
      when v_espera is null then 'muy_alta'
      when v_espera + 5 - v_prep_restante >= 35 then 'muy_alta'
      when v_espera + 5 - v_prep_restante >= 15 then 'alta'
      else 'normal' end,
    'alta_demanda', v_fase in ('preparando', 'esperando_pago')
                    and (v_espera is null or v_espera + 5 - v_prep_restante >= 15)
  );
end;
$$;

notify pgrst, 'reload schema';
