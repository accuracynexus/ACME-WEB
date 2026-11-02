\set ON_ERROR_STOP 1
set client_min_messages = notice;
-- ===== utilidades de prueba =====
create schema if not exists prueba;
create or replace function prueba.ok(p_nombre text, p_cond boolean, p_detalle text default '') returns void language plpgsql as $$
begin
  if p_cond is distinct from true then raise exception 'FALLO: % %', p_nombre, p_detalle; end if;
  raise notice 'OK  %', p_nombre;
end $$;
create or replace function prueba.limpiar() returns void language sql as $$
  truncate orders, order_delivery_details, driver_current_state, driver_locations, drivers;
  update demanda_config set repartidores_manual = null, repartidores_manual_hasta = null,
         repartidores_por_defecto = 2, senal_minutos = 15, ciclo_defecto_min = 30,
         umbral_alta_min = 15, umbral_muy_alta_min = 35;
$$;
-- n motos con latido reciente
create or replace function prueba.motos(n int, p_desde int default 1) returns void language sql as $$
  insert into drivers (user_id, status)
    select ('00000000-0000-0000-0000-' || lpad(to_hex(i), 12, '0'))::uuid, 'available'
      from generate_series(p_desde, p_desde + n - 1) i;
  insert into driver_current_state (driver_id, status, is_online, last_seen_at)
    select ('00000000-0000-0000-0000-' || lpad(to_hex(i), 12, '0'))::uuid, 'available', true, now() - interval '1 minute'
      from generate_series(p_desde, p_desde + n - 1) i;
$$;
create or replace function prueba.moto(i int) returns uuid language sql as $$
  select ('00000000-0000-0000-0000-' || lpad(to_hex(i), 12, '0'))::uuid $$;
create or replace function prueba.cliente(i int) returns uuid language sql as $$
  select ('00000000-0000-0000-0000-c' || lpad(to_hex(i), 11, '0'))::uuid $$;
-- pedido: estado, moto (o null), minutos atras, cliente
create or replace function prueba.pedido(p_status text, p_moto int, p_hace int, p_cliente int,
  p_pago text default 'paid', p_tipo text default 'delivery') returns uuid language plpgsql as $$
declare v uuid;
begin
  insert into orders (customer_id, branch_id, status, current_driver_id, placed_at, created_at, payment_status, fulfillment_type, accepted_at)
  values (prueba.cliente(p_cliente), '00000000-0000-0000-0000-0000000000b1', p_status::order_status,
          case when p_moto is null then null else prueba.moto(p_moto) end,
          now() - make_interval(mins => p_hace), now() - make_interval(mins => p_hace), p_pago, p_tipo,
          now() - make_interval(mins => p_hace))
  returning id into v;
  insert into order_delivery_details values (v, -12.790, -74.980);  -- ~1.5 km del local
  return v;
end $$;
create or replace function prueba.d() returns jsonb language sql as $$ select public.demanda_calcular(null) $$;
create or replace function prueba.eta(p_order uuid, p_cliente int) returns jsonb language plpgsql as $$
declare r jsonb;
begin
  perform set_config('test.uid', prueba.cliente(p_cliente)::text, true);
  r := public.order_eta(p_order);
  perform set_config('test.uid', '', true);
  return r;
end $$;

insert into merchant_branches values ('00000000-0000-0000-0000-0000000000b1', -12.7800, -74.9700, 20)
  on conflict do nothing;

-- ===== ESCENARIOS =====
do $$
declare d jsonb; a jsonb; r jsonb; ids uuid[]; v uuid; i int; esperas int[]; t0 timestamptz; ms numeric;
begin
  ---------------------------------------------------------------- 1
  perform prueba.limpiar(); perform prueba.motos(2);
  d := prueba.d(); a := public.demanda_actual('00000000-0000-0000-0000-0000000000b1', -12.79, -74.98);
  perform prueba.ok('1. 2 motos, sin pedidos: 2 detectadas, normal, espera 0',
    (d->>'repartidores')::int = 2 and not (d->>'repartidores_estimados')::bool and d->>'nivel' = 'normal'
    and (d->>'espera_repartidor_min')::int = 0, d::text);
  perform prueba.ok('1b. cliente ve "Tiempo aproximado" sin alta demanda',
    a->>'mensaje' like 'Tiempo aproximado%' and not (a->>'alta_demanda')::bool and (a->>'eta_min')::int between 20 and 35, a::text);

  ---------------------------------------------------------------- 2
  perform prueba.limpiar(); perform prueba.motos(2);
  perform prueba.pedido('picked_up', 1, 10, 1); perform prueba.pedido('assigned', 2, 5, 2);
  d := prueba.d();
  perform prueba.ok('2. 2 motos ocupadas: pedido nuevo espera 15, nivel alta',
    (d->>'espera_repartidor_min')::int = 15 and d->>'nivel' = 'alta', d::text);
  a := public.demanda_actual('00000000-0000-0000-0000-0000000000b1', -12.79, -74.98);
  perform prueba.ok('2b. mensaje de alta demanda con "2 repartidores"',
    a->>'mensaje' like 'Alta demanda%2 repartidores en turno%', a->>'mensaje');

  ---------------------------------------------------------------- 3
  perform prueba.limpiar(); perform prueba.motos(2);
  perform prueba.pedido('picked_up', 1, 12, 1); perform prueba.pedido('on_the_way', 2, 8, 2);
  ids := array[]::uuid[];
  for i in 1..4 loop ids := ids || prueba.pedido('preparing', null, 10 - i, 10 + i); end loop;
  d := prueba.d();
  perform prueba.ok('3. 2 motos, 2 en ruta, 4 en cola: nuevo espera 75, muy_alta',
    (d->>'espera_repartidor_min')::int = 75 and d->>'nivel' = 'muy_alta'
    and (d->>'pedidos_esperando_repartidor')::int = 4, d::text);
  esperas := array[]::int[];
  for i in 1..4 loop
    r := prueba.eta(ids[i], 10 + i);
    esperas := esperas || (r->>'espera_repartidor_min')::int;
  end loop;
  perform prueba.ok('3b. cola en orden de llegada: 15, 30, 45, 60 min', esperas = array[15,30,45,60], esperas::text);
  r := prueba.eta(ids[4], 14);
  perform prueba.ok('3c. eta del 4to = espera+5+viaje y marca alta demanda',
    (r->>'eta_min')::int between 66 and 75 and (r->>'alta_demanda')::bool, r::text);

  ---------------------------------------------------------------- 4
  perform prueba.limpiar(); perform prueba.motos(5);
  perform prueba.pedido('picked_up', 1, 12, 1); perform prueba.pedido('picked_up', 2, 8, 2);
  perform prueba.pedido('preparing', null, 5, 3); perform prueba.pedido('accepted', null, 2, 4);
  d := prueba.d();
  perform prueba.ok('4. 5 motos, 2 en ruta, 2 en cola: queda una libre, espera 0, normal',
    (d->>'repartidores')::int = 5 and (d->>'espera_repartidor_min')::int = 0 and d->>'nivel' = 'normal', d::text);

  ---------------------------------------------------------------- 5
  perform prueba.limpiar(); perform prueba.motos(8);
  for i in 1..8 loop perform prueba.pedido('on_the_way', i, 15, i); end loop;
  for i in 1..12 loop perform prueba.pedido('preparing', null, 12 - i, 100 + i); end loop;
  d := prueba.d();
  -- delante 20, motos 8: (20+1-8)*30/8 = 48.75 -> 49
  perform prueba.ok('5. hora punta: 8 motos, 20 pedidos, espera 49, muy_alta',
    (d->>'espera_repartidor_min')::int = 49 and d->>'nivel' = 'muy_alta', d::text);
  -- llega una moto mas (9): (21-9)*30/9 = 40
  perform prueba.motos(1, 9); d := prueba.d();
  perform prueba.ok('5b. entra la 9na moto: espera baja a 40', (d->>'espera_repartidor_min')::int = 40, d::text);

  ---------------------------------------------------------------- 6 rotacion de motos
  perform prueba.limpiar(); perform prueba.motos(4);
  update driver_current_state set last_seen_at = now() - interval '20 minutes' where driver_id = prueba.moto(3);
  update driver_current_state set is_online = false where driver_id = prueba.moto(4);
  d := prueba.d();
  perform prueba.ok('6. moto sin senal hace 20 min y moto fuera de linea no cuentan: 2',
    (d->>'repartidores_detectados')::int = 2, d::text);
  perform prueba.pedido('picked_up', 3, 10, 1);
  d := prueba.d();
  perform prueba.ok('6b. moto sin senal pero con pedido si cuenta: 3', (d->>'repartidores_detectados')::int = 3, d::text);
  perform prueba.pedido('picked_up', 3, 9, 2);
  d := prueba.d();
  perform prueba.ok('6c. moto con 2 pedidos cuenta una sola vez: 3', (d->>'repartidores_detectados')::int = 3, d::text);

  ---------------------------------------------------------------- 7 sin motos detectadas
  perform prueba.limpiar();
  d := prueba.d();
  perform prueba.ok('7. ninguna moto detectada: usa 2 por defecto y lo marca',
    (d->>'repartidores')::int = 2 and (d->>'repartidores_estimados')::bool, d::text);

  ---------------------------------------------------------------- 8 numero manual
  perform prueba.limpiar(); perform prueba.motos(2);
  update demanda_config set repartidores_manual = 4, repartidores_manual_hasta = now() - interval '1 minute';
  d := prueba.d();
  perform prueba.ok('8. manual vencido se ignora', (d->>'repartidores')::int = 2 and not (d->>'repartidores_manual')::bool, d::text);
  update demanda_config set repartidores_manual_hasta = now() + interval '3 hours';
  d := prueba.d();
  perform prueba.ok('8b. manual vigente manda: 4', (d->>'repartidores')::int = 4 and (d->>'repartidores_manual')::bool, d::text);
  update demanda_config set repartidores_manual = 0;
  v := prueba.pedido('preparing', null, 3, 1);
  a := public.demanda_actual(null, null, null); r := prueba.eta(v, 1);
  perform prueba.ok('8c. manual 0: cliente ve "no hay repartidores" y el pedido no promete hora',
    a->>'mensaje' like 'Ahora no hay repartidores%' and a->'eta_min' = 'null'::jsonb
    and r->'eta_min' = 'null'::jsonb and (r->>'sin_repartidores')::bool, a::text || r::text);

  ---------------------------------------------------------------- 9 lo que NO cuenta
  perform prueba.limpiar(); perform prueba.motos(2);
  perform prueba.pedido('placed', null, 3, 1, 'pending');           -- recien creado sin pagar
  perform prueba.pedido('pending_payment', null, 3, 2, 'pending');  -- esperando pago
  perform prueba.pedido('preparing', null, 3, 3, 'paid', 'pickup'); -- recoge en tienda
  perform prueba.pedido('preparing', null, 400, 4);                 -- de hace 6h40 (abandonado)
  perform prueba.pedido('delivered', 1, 30, 5);
  perform prueba.pedido('cancelled', null, 10, 6);
  perform prueba.pedido('placed', null, 3, 7, 'paid');              -- este SI (pagado)
  d := prueba.d();
  perform prueba.ok('9. solo cuenta el pedido pagado: 1 en cola, 0 con moto',
    (d->>'pedidos_esperando_repartidor')::int = 1 and (d->>'pedidos_con_repartidor')::int = 0, d::text);

  ---------------------------------------------------------------- 10 ciclo segun historial
  perform prueba.limpiar(); perform prueba.motos(2);
  for i in 1..10 loop
    insert into orders (status, current_driver_id, placed_at, created_at, picked_up_at, delivered_at, payment_status)
    values ('delivered', prueba.moto(1), now() - interval '2 days', now() - interval '2 days',
            now() - interval '2 days', now() - interval '2 days' + interval '10 minutes', 'paid');
  end loop;
  d := prueba.d();
  perform prueba.ok('10. 10 entregas de 10 min: vuelta = 10*2+5 = 25', (d->>'ciclo_min')::int = 25, d::text);
  for i in 1..3 loop
    insert into orders (status, placed_at, created_at, picked_up_at, delivered_at, payment_status)
    values ('delivered', now() - interval '1 day', now() - interval '1 day', now() - interval '1 day', now() - interval '1 day' + interval '5 hours', 'paid');
  end loop;
  d := prueba.d();
  perform prueba.ok('10b. entregas absurdas (5 h) no cambian la vuelta', (d->>'ciclo_min')::int = 25, d::text);

  ---------------------------------------------------------------- 11 carga: 300 clientes, 10 motos
  perform prueba.limpiar(); perform prueba.motos(10);
  for i in 1..10 loop perform prueba.pedido('on_the_way', i, 20, i); end loop;
  for i in 1..290 loop perform prueba.pedido('preparing', null, 300 - i, 1000 + i); end loop;
  t0 := clock_timestamp();
  for i in 1..50 loop a := public.demanda_actual('00000000-0000-0000-0000-0000000000b1', -12.79, -74.98); end loop;
  ms := extract(epoch from clock_timestamp() - t0) * 1000 / 50;
  perform prueba.ok('11. 300 pedidos abiertos y 10 motos: demanda_actual responde en < 50 ms (' || round(ms, 1) || ' ms)', ms < 50);
  d := prueba.d();
  -- (300+1-10)*30/10 = 873
  perform prueba.ok('11b. espera 873 min (291 adelante / 10 motos x 30), muy_alta', (d->>'espera_repartidor_min')::int = 873 and d->>'nivel' = 'muy_alta', d::text);
end $$;

-- ===== latido del repartidor y permisos =====
select prueba.limpiar();
insert into drivers values (prueba.moto(1), 'available'), (prueba.moto(2), 'available');
do $$
declare r jsonb; v uuid;
begin
  perform set_config('test.uid', prueba.moto(1)::text, true);
  r := public.driver_set_presence(true, -12.78, -74.97);
  perform prueba.ok('12. latido de moto libre: available y en linea',
    r->>'status' = 'available' and (select is_online and last_lat = -12.78 from driver_current_state where driver_id = prueba.moto(1)), r::text);
  perform set_config('test.uid', '', true);
  v := prueba.pedido('picked_up', 1, 5, 1);
  perform set_config('test.uid', prueba.moto(1)::text, true);
  r := public.driver_set_presence(true, null, null);
  perform prueba.ok('12b. con pedido queda busy y conserva la ultima posicion',
    r->>'status' = 'busy' and (select last_lat = -12.78 from driver_current_state where driver_id = prueba.moto(1)), r::text);
  r := public.driver_set_presence(false);
  perform prueba.ok('12c. fuera de linea: offline e is_online false',
    (select status::text = 'offline' and not is_online from driver_current_state where driver_id = prueba.moto(1)), r::text);
  perform set_config('test.uid', prueba.cliente(1)::text, true);
  begin
    perform public.driver_set_presence(true);
    perform prueba.ok('12d. un cliente no puede marcarse repartidor', false);
  exception when insufficient_privilege then perform prueba.ok('12d. un cliente no puede marcarse repartidor', true);
  end;
  perform set_config('test.uid', prueba.cliente(2)::text, true);
  begin
    perform public.order_eta(v);
    perform prueba.ok('12e. otro cliente no ve el pedido ajeno', false);
  exception when no_data_found then perform prueba.ok('12e. otro cliente no ve el pedido ajeno', true);
  end;
  perform set_config('test.uid', '', true);
end $$;

set role anon;
select prueba_anon from (select (public.demanda_actual(null, null, null) ->> 'nivel') is not null as prueba_anon) t;
do $$ begin
  begin perform public.demanda_calcular(null); raise exception 'FALLO: anon pudo llamar demanda_calcular';
  exception when insufficient_privilege then raise notice 'OK  13. anon usa demanda_actual pero no ve conteos internos ni latido'; end;
  begin perform public.driver_set_presence(true); raise exception 'FALLO: anon pudo marcar latido';
  exception when insufficient_privilege then null; end;
  begin perform 1 from public.demanda_config; raise exception 'FALLO: anon lee demanda_config';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
\echo TODAS LAS PRUEBAS PASARON
do $$
declare a jsonb; t0 timestamptz; ms numeric;
begin
  -- 14. con 300 pedidos en cola el cliente no ve "900 a 1215 min"
  perform prueba.limpiar(); perform prueba.motos(10);
  for i in 1..10 loop perform prueba.pedido('on_the_way', i, 20, i); end loop;
  for i in 1..290 loop perform prueba.pedido('preparing', null, 300 - i, 1000 + i); end loop;
  a := public.demanda_actual('00000000-0000-0000-0000-0000000000b1', -12.79, -74.98);
  perform prueba.ok('14. espera enorme: dice "mas de 2 horas" sin rango',
    a->>'mensaje' like '%mas de 2 horas%' and a->'eta_max' = 'null'::jsonb, a::text);
  -- 15. historial grande: 60.000 pedidos viejos
  insert into orders (status, placed_at, created_at, picked_up_at, delivered_at, payment_status)
  select 'delivered', now() - (g || ' minutes')::interval, now() - (g || ' minutes')::interval,
         now() - (g || ' minutes')::interval, now() - (g || ' minutes')::interval + interval '12 minutes', 'paid'
    from generate_series(400, 60400) g;
  analyze orders;
  t0 := clock_timestamp();
  for i in 1..20 loop a := public.demanda_actual('00000000-0000-0000-0000-0000000000b1', -12.79, -74.98); end loop;
  ms := extract(epoch from clock_timestamp() - t0) * 1000 / 20;
  perform prueba.ok('15. con 60.000 pedidos en el historial responde en < 100 ms (' || round(ms, 1) || ' ms)', ms < 100);
end $$;
\echo TODAS LAS PRUEBAS PASARON (incluye 14 y 15)
