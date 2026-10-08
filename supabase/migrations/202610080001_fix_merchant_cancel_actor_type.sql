-- order_cancellations.actor_type es el enum cancellation_actor_type
-- (customer, driver, merchant, admin, system). La version de
-- 202609290002 insertaba 'merchant_staff', que no existe en ese enum, y
-- cancelar un pedido desde el panel fallaba con
--   invalid input value for enum cancellation_actor_type: "merchant_staff"
-- order_status_history sigue usando 'merchant_staff', que ahi si es valido.

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
  values (p_order_id, auth.uid(), 'merchant', nullif(trim(p_reason_code), ''), nullif(trim(p_reason_text), ''), p_refund_amount, now());

  insert into public.order_status_history (order_id, from_status, to_status, actor_user_id, actor_type, note, created_at)
  values (p_order_id, v_order.status, 'cancelled', auth.uid(), 'merchant_staff', nullif(trim(p_reason_text), ''), now());
end;
$$;

revoke all on function public.merchant_cancel_order(uuid, text, text, numeric) from public, anon;
grant execute on function public.merchant_cancel_order(uuid, text, text, numeric) to authenticated;

notify pgrst, 'reload schema';
