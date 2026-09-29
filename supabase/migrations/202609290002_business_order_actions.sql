-- El negocio (restaurante) solo hace tres cosas con un pedido:
--   1. marcarlo listo (preparado)       -> merchant_mark_order_ready
--   2. asignarle un repartidor          -> merchant_assign_order_driver
--   3. cancelarlo                       -> merchant_cancel_order
-- Todos los demas estados (aceptado por el repartidor, recogido, en camino,
-- entregado) los pone el repartidor desde su app.
--
-- Las tres acciones corren como funciones security definer: validan que quien
-- llama sea personal activo del comercio del pedido (o admin de plataforma) y
-- luego escriben orders, order_assignments y order_status_history sin chocar
-- con las politicas RLS de esas tablas (el panel recibia "new row violates
-- row-level security policy for table order_assignments").
--
-- "Listo" en la base es 'ready_for_pickup' (el enum order_status no tiene 'ready').

alter type public.order_status add value if not exists 'ready_for_pickup';

-- ---------------------------------------------------------------------------
-- Quien puede operar un pedido
-- ---------------------------------------------------------------------------
create or replace function public.can_manage_order(p_order_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_merchant_id uuid;
begin
  if v_uid is null then
    return false;
  end if;

  select o.merchant_id into v_merchant_id from public.orders o where o.id = p_order_id;
  if not found then
    return false;
  end if;

  if exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = v_uid and r.code::text in ('admin', 'super_admin')
  ) or exists (
    select 1 from public.profiles p
    where p.user_id = v_uid and p.default_role::text in ('admin', 'super_admin')
  ) then
    return true;
  end if;

  return exists (
    select 1 from public.merchant_staff ms
    where ms.user_id = v_uid
      and ms.merchant_id = v_merchant_id
      and coalesce(ms.is_active, true)
  ) or exists (
    select 1 from public.merchant_access_accounts maa
    where maa.user_id = v_uid
      and maa.merchant_id = v_merchant_id
      and maa.is_active
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 1. Marcar listo
-- ---------------------------------------------------------------------------
create or replace function public.merchant_mark_order_ready(p_order_id uuid, p_note text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
begin
  if not public.can_manage_order(p_order_id) then
    raise exception 'No tienes permiso para operar este pedido.' using errcode = 'insufficient_privilege';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;

  if v_order.status::text = 'ready_for_pickup' then
    return;
  end if;

  if not (v_order.status::text = any (array['pending_payment', 'placed', 'pending', 'confirmed', 'accepted', 'preparing'])) then
    raise exception 'El pedido ya esta en manos del repartidor o cerrado; no se puede marcar listo.'
      using errcode = 'check_violation';
  end if;

  -- El trigger orders_enforce_payment_before_dispatch rechaza este cambio si el pedido no esta pagado.
  update public.orders
  set status = 'ready_for_pickup', updated_at = now()
  where id = p_order_id;

  insert into public.order_status_history (order_id, from_status, to_status, actor_user_id, actor_type, note, created_at)
  values (p_order_id, v_order.status, 'ready_for_pickup', auth.uid(), 'merchant_staff', nullif(trim(p_note), ''), now());
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Asignar repartidor
-- ---------------------------------------------------------------------------
create or replace function public.merchant_assign_order_driver(p_order_id uuid, p_driver_id uuid, p_note text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_assignment_id uuid;
begin
  if not public.can_manage_order(p_order_id) then
    raise exception 'No tienes permiso para operar este pedido.' using errcode = 'insufficient_privilege';
  end if;

  if p_driver_id is null then
    raise exception 'Elige un repartidor.' using errcode = 'check_violation';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;

  if not (v_order.status::text = any (array['pending_payment', 'placed', 'pending', 'confirmed', 'accepted', 'preparing', 'ready_for_pickup', 'assigned'])) then
    raise exception 'El pedido ya esta en manos del repartidor o cerrado; no se puede reasignar.'
      using errcode = 'check_violation';
  end if;

  -- Ofertas anteriores a otro repartidor que nadie acepto quedan descartadas.
  -- Es un paso de limpieza: si el enum de order_assignments no admite 'rejected', se omite.
  begin
    update public.order_assignments
    set status = 'rejected', rejected_at = now()
    where order_id = p_order_id
      and driver_id <> p_driver_id
      and status::text = 'assigned';
  exception when others then
    null;
  end;

  select id into v_assignment_id
  from public.order_assignments
  where order_id = p_order_id and driver_id = p_driver_id and status::text = 'assigned'
  order by assigned_at desc nulls last
  limit 1;

  if v_assignment_id is null then
    -- El trigger order_assignments_enforce_payment_before_dispatch rechaza pedidos sin pagar.
    insert into public.order_assignments (order_id, driver_id, status, reason, assigned_at)
    values (p_order_id, p_driver_id, 'assigned', nullif(trim(p_note), ''), now())
    returning id into v_assignment_id;
  elsif nullif(trim(p_note), '') is not null then
    update public.order_assignments set reason = trim(p_note) where id = v_assignment_id;
  end if;

  update public.orders
  set current_driver_id = p_driver_id, updated_at = now()
  where id = p_order_id;

  return v_assignment_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Cancelar
-- ---------------------------------------------------------------------------
create or replace function public.merchant_cancel_order(
  p_order_id uuid,
  p_reason_code text default null,
  p_reason_text text default null,
  p_refund_amount numeric default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
begin
  if not public.can_manage_order(p_order_id) then
    raise exception 'No tienes permiso para operar este pedido.' using errcode = 'insufficient_privilege';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;

  if v_order.status::text = 'cancelled' then
    return;
  end if;

  if v_order.status::text = any (array['picked_up', 'on_the_way', 'delivered', 'failed']) then
    raise exception 'El repartidor ya recogio el pedido; ya no se puede cancelar desde el negocio.'
      using errcode = 'check_violation';
  end if;

  update public.orders
  set status = 'cancelled', cancelled_at = now(), updated_at = now()
  where id = p_order_id;

  insert into public.order_cancellations (order_id, cancelled_by_user_id, actor_type, reason_code, reason_text, refund_amount, created_at)
  values (p_order_id, auth.uid(), 'merchant_staff', nullif(trim(p_reason_code), ''), nullif(trim(p_reason_text), ''), p_refund_amount, now());

  insert into public.order_status_history (order_id, from_status, to_status, actor_user_id, actor_type, note, created_at)
  values (p_order_id, v_order.status, 'cancelled', auth.uid(), 'merchant_staff', nullif(trim(p_reason_text), ''), now());
end;
$$;

revoke all on function public.can_manage_order(uuid) from public, anon;
revoke all on function public.merchant_mark_order_ready(uuid, text) from public, anon;
revoke all on function public.merchant_assign_order_driver(uuid, uuid, text) from public, anon;
revoke all on function public.merchant_cancel_order(uuid, text, text, numeric) from public, anon;

grant execute on function public.can_manage_order(uuid) to authenticated;
grant execute on function public.merchant_mark_order_ready(uuid, text) to authenticated;
grant execute on function public.merchant_assign_order_driver(uuid, uuid, text) to authenticated;
grant execute on function public.merchant_cancel_order(uuid, text, text, numeric) to authenticated;

-- Que PostgREST vea las funciones nuevas sin esperar.
notify pgrst, 'reload schema';
