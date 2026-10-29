-- Pedidos sin pagar: vencen solos y el cliente puede cancelarlos.
--
-- Un pedido nace en pending_payment y solo sale a operaciones cuando el pago se
-- confirma (202609290001). Si el cliente nunca paga, quedaba asi para siempre:
-- solo un admin o el negocio podia cancelarlo.
--
-- 1. expire_unpaid_orders(): cancela los pedidos sin pagar cuyo plazo ya paso.
--    El plazo se cuenta desde el ultimo intento de pago (o desde que se creo el
--    pedido si nunca intento pagar) y depende de la pasarela, para no cancelar
--    un pedido cuyo pago todavia puede llegar:
--      - sin intento de pago, Izipay o tarjeta: 30 minutos;
--      - Yape directo: 45 minutos. La ventana del cobro dura 6 minutos y, si el
--        celular receptor se cae, el cobro espera su yapeo hasta 30 minutos mas
--        (yape_cobro_cerrado en acme-yape);
--      - orden Culqi (PagoEfectivo, agentes, banca movil): 24 horas y 15
--        minutos, lo que dura el codigo CIP que se le dio al cliente.
--    Corre cada 5 minutos con pg_cron, y el backend de pagos la llama para el
--    pedido que consulta.
-- 2. cancel_my_unpaid_order(): el cliente cancela su propio pedido mientras siga
--    sin pagar, y recibe sus productos para volver a armar el carrito.
-- 3. revive_expired_unpaid_order(): si el pago de un pedido vencido llega
--    igual (un yapeo atrasado que acme-yape reconoce despues), el backend de
--    pagos lo devuelve a pending_payment para liberarlo como cualquier pedido
--    pagado. Solo los que vencio el sistema hace menos de 2 horas; los que
--    cancelo una persona, o mas antiguos, quedan cancelados y pagados para que
--    el admin devuelva el dinero.
--
-- Los pedidos de varios locales (order_groups) vencen, se cancelan y vuelven
-- juntos: el pago es uno solo, desde el ancla.

create index if not exists orders_pending_payment_created_idx
  on public.orders (created_at)
  where status = 'pending_payment';

-- Hasta cuando se espera el pago de un pedido (o de su grupo).
create or replace function public.unpaid_order_deadline(p_order_id uuid)
returns timestamptz
language sql
stable
security definer
set search_path = public
as $$
  with pedidos as (
    select o2.id, o2.created_at
      from public.orders o
      join public.orders o2
        on o2.id = o.id
        or (o.order_group_id is not null and o2.order_group_id = o.order_group_id)
     where o.id = p_order_id
  )
  select greatest(
    (select max(created_at) + interval '30 minutes' from pedidos),
    (select max(
              coalesce(p.requested_at, p.created_at)
              + case
                  when p.provider = 'yape_propio' then interval '45 minutes'
                  when p.provider = 'culqi' and p.external_reference like 'ord\_%' then interval '24 hours 15 minutes'
                  else interval '30 minutes'
                end)
       from public.payments p
      where p.order_id in (select id from pedidos))
  );
$$;

-- Cancela un pedido sin pagar con todo su grupo. Uso interno: quien llama ya
-- decidio que se cancela. Devuelve los pedidos cancelados.
create or replace function public.cancel_unpaid_order_group(
  p_order_id uuid,
  p_actor_type text,
  p_actor_user_id uuid,
  p_reason_code text,
  p_reason_text text
)
returns uuid[]
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group_id uuid;
  v_ids uuid[];
  v_id uuid;
begin
  select order_group_id into v_group_id from public.orders where id = p_order_id;

  select array_agg(o.id order by o.group_position nulls first) into v_ids
    from public.orders o
   where (o.id = p_order_id or (v_group_id is not null and o.order_group_id = v_group_id))
     and o.status::text = 'pending_payment'
     and coalesce(o.payment_status::text, '') <> 'paid';

  if v_ids is null then
    return '{}';
  end if;

  update public.orders
     set status = 'cancelled', cancelled_at = now(), updated_at = now()
   where id = any (v_ids);

  foreach v_id in array v_ids loop
    insert into public.order_cancellations (order_id, cancelled_by_user_id, actor_type, reason_code, reason_text, created_at)
    values (v_id, p_actor_user_id, p_actor_type::public.cancellation_actor_type, p_reason_code, p_reason_text, now());

    -- actor_type va como literal: la columna puede ser un enum y no acepta text.
    execute format(
      'insert into public.order_status_history (order_id, from_status, to_status, actor_user_id, actor_type, note, created_at)
       values ($1, %L, %L, $2, %L, $3, now())', 'pending_payment', 'cancelled', p_actor_type)
      using v_id, p_actor_user_id, p_reason_text;
  end loop;

  if v_group_id is not null then
    -- order_groups tiene su propio CHECK de estados; si no admite 'cancelled',
    -- el grupo queda como estaba y sus pedidos igual quedan cancelados.
    begin
      update public.order_groups set status = 'cancelled', updated_at = now() where id = v_group_id;
    exception when others then
      null;
    end;
  end if;

  return v_ids;
end;
$$;

-- 1. Vencimiento automatico. Con p_order_id revisa solo ese pedido.
create or replace function public.expire_unpaid_orders(p_order_id uuid default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order record;
  v_total integer := 0;
begin
  for v_order in
    select o.id
      from public.orders o
     where o.status::text = 'pending_payment'
       and coalesce(o.payment_status::text, '') <> 'paid'
       and (p_order_id is null or o.id = p_order_id)
       -- Uno por grupo: el ancla (o el pedido suelto).
       and (o.order_group_id is null or coalesce(o.group_position, 1) = 1)
       and o.created_at < now() - interval '30 minutes'
     order by o.created_at
     limit 500
     for update skip locked
  loop
    if public.unpaid_order_deadline(v_order.id) <= now() then
      v_total := v_total + coalesce(array_length(public.cancel_unpaid_order_group(
        v_order.id, 'system', null, 'pago_vencido',
        'Pedido cancelado automaticamente: no se pago a tiempo.'), 1), 0);
    end if;
  end loop;

  if p_order_id is not null and v_total = 0 then
    -- Se pidio un pedido de otro local del grupo: se revisa desde su ancla.
    select o.id into v_order
      from public.orders o
      join public.orders a on a.order_group_id = o.order_group_id and coalesce(a.group_position, 1) = 1
     where o.id = p_order_id and coalesce(o.group_position, 1) <> 1
       and a.status::text = 'pending_payment' and coalesce(a.payment_status::text, '') <> 'paid'
       and public.unpaid_order_deadline(a.id) <= now();
    if found then
      v_total := coalesce(array_length(public.cancel_unpaid_order_group(
        p_order_id, 'system', null, 'pago_vencido',
        'Pedido cancelado automaticamente: no se pago a tiempo.'), 1), 0);
    end if;
  end if;

  return v_total;
end;
$$;

-- 2. El cliente cancela su pedido sin pagar. Devuelve sus productos para que
-- la app o la web vuelvan a armar el carrito. Si el pedido ya se pago, ya
-- salio a operaciones o no es suyo, no cambia nada y lo dice.
create or replace function public.cancel_my_unpaid_order(p_order_id uuid, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_es_backend boolean := coalesce(auth.jwt() ->> 'role', '') = 'service_role';
  v_order public.orders%rowtype;
  v_ids uuid[];
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found or not (v_es_backend or (v_uid is not null and v_order.customer_id = v_uid)) then
    raise exception 'Pedido no encontrado.' using errcode = 'no_data_found';
  end if;

  if coalesce(v_order.payment_status::text, '') = 'paid' then
    raise exception 'Este pedido ya esta pagado; ya no se puede cancelar desde aqui.' using errcode = 'check_violation';
  end if;

  if v_order.status::text <> 'cancelled' then
    if v_order.status::text <> 'pending_payment' then
      raise exception 'Este pedido ya esta en proceso; ya no se puede cancelar desde aqui.' using errcode = 'check_violation';
    end if;
    v_ids := public.cancel_unpaid_order_group(
      p_order_id, 'customer', coalesce(v_uid, v_order.customer_id), 'cliente_no_pago',
      coalesce(nullif(trim(p_reason), ''), 'El cliente cancelo el pedido antes de pagar.'));
  end if;

  return jsonb_build_object(
    'order_id', p_order_id,
    'status', 'cancelled',
    'cancelled_order_ids', to_jsonb(coalesce(v_ids, '{}')),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
               'product_id', oi.product_id,
               'product_name', oi.product_name_snapshot,
               'quantity', oi.quantity,
               'unit_price', oi.unit_price,
               'notes', oi.notes,
               'branch_id', o.branch_id,
               'merchant_id', o.merchant_id)
             order by o.group_position nulls first, oi.created_at)
        from public.orders o
        join public.order_items oi on oi.order_id = o.id
       where o.id = p_order_id
          or (v_order.order_group_id is not null and o.order_group_id = v_order.order_group_id)
    ), '[]'::jsonb)
  );
end;
$$;

-- 3. Llego el pago de un pedido que vencio el sistema: vuelve a esperar pago
-- para que el backend lo libere. Solo service role.
create or replace function public.revive_expired_unpaid_order(
  p_order_id uuid,
  p_max_age interval default interval '2 hours'
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group_id uuid;
  v_ids uuid[];
  v_id uuid;
begin
  select order_group_id into v_group_id from public.orders where id = p_order_id;

  select array_agg(o.id) into v_ids
    from public.orders o
   where o.id = p_order_id or (v_group_id is not null and o.order_group_id = v_group_id);

  if v_ids is null then
    return false;
  end if;

  -- Todo el grupo tiene que seguir cancelado por vencimiento, y hace poco.
  if exists (
    select 1
      from public.orders o
      left join lateral (
        select c.actor_type::text as actor_type, c.reason_code
          from public.order_cancellations c
         where c.order_id = o.id
         order by c.created_at desc
         limit 1
      ) c on true
     where o.id = any (v_ids)
       and not (o.status::text = 'cancelled'
                and c.actor_type = 'system'
                and c.reason_code = 'pago_vencido'
                and o.cancelled_at >= now() - p_max_age)
  ) then
    return false;
  end if;

  update public.orders
     set status = 'pending_payment', cancelled_at = null, updated_at = now()
   where id = any (v_ids);

  foreach v_id in array v_ids loop
    insert into public.order_status_history (order_id, from_status, to_status, actor_user_id, actor_type, note, created_at)
    values (v_id, 'cancelled', 'pending_payment', null, 'system',
            'El pago llego despues del vencimiento: el pedido vuelve a operaciones.', now());
  end loop;

  return true;
end;
$$;

revoke all on function public.unpaid_order_deadline(uuid) from public, anon, authenticated;
revoke all on function public.cancel_unpaid_order_group(uuid, text, uuid, text, text) from public, anon, authenticated;
revoke all on function public.expire_unpaid_orders(uuid) from public, anon, authenticated;
revoke all on function public.revive_expired_unpaid_order(uuid, interval) from public, anon, authenticated;
revoke all on function public.cancel_my_unpaid_order(uuid, text) from public, anon;
grant execute on function public.cancel_my_unpaid_order(uuid, text) to authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.expire_unpaid_orders(uuid) to service_role;
    grant execute on function public.revive_expired_unpaid_order(uuid, interval) to service_role;
    grant execute on function public.cancel_my_unpaid_order(uuid, text) to service_role;
  end if;
end;
$$;

-- Cada 5 minutos. Si el proyecto no tiene pg_cron, el backend de pagos igual
-- vence el pedido que el cliente consulta.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('vencer-pedidos-sin-pagar', '*/5 * * * *', 'select public.expire_unpaid_orders()');
  else
    raise notice 'pg_cron no esta disponible: los pedidos vencen cuando el backend los consulta.';
  end if;
end;
$$;

notify pgrst, 'reload schema';
