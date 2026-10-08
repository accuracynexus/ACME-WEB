-- Asignar repartidor es tarea del administrador general, no de la tienda.
-- En 202609290002 merchant_assign_order_driver dejaba pasar a cualquiera
-- que pudiera operar el pedido (can_manage_order: personal del negocio
-- incluido). Ahora solo admin / super_admin; private.is_portal_admin()
-- mira tanto profiles.default_role como user_roles.
-- La tienda solo marca listo o cancela; el despacho automatico
-- (auto_dispatch_ready_orders, en ACME-DRIVER) ofrece el pedido solo.

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
  if not coalesce(private.is_portal_admin(), false) then
    raise exception 'Solo el administrador general puede asignar repartidores.' using errcode = 'insufficient_privilege';
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

revoke all on function public.merchant_assign_order_driver(uuid, uuid, text) from public, anon;
grant execute on function public.merchant_assign_order_driver(uuid, uuid, text) to authenticated;

notify pgrst, 'reload schema';
