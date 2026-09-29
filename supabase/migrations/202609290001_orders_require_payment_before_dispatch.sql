-- El dueño decidio que los pedidos se pagan antes de despacharse.
-- Mientras un pedido siga recien creado (pending_payment / placed / pending) y su
-- pago no figure como 'paid', no puede avanzar a preparacion ni recibir repartidor.
-- Solo se puede cancelar o rechazar. Aplica a cualquier cliente (panel, app del
-- repartidor, scripts), no solo a la web.
--
-- No modifica pedidos existentes: solo valida cambios futuros sobre orders y order_assignments.

create or replace function public.enforce_payment_before_dispatch()
returns trigger
language plpgsql
as $$
declare
  awaiting_statuses constant text[] := array['pending_payment', 'placed', 'pending'];
  is_unpaid boolean := coalesce(new.payment_status::text, '') <> 'paid';
begin
  if not is_unpaid or not (old.status::text = any (awaiting_statuses)) then
    return new;
  end if;

  if new.status is distinct from old.status
     and not (new.status::text = any (awaiting_statuses || array['cancelled', 'rejected'])) then
    raise exception 'El pedido % no tiene el pago confirmado; no se puede despachar.', coalesce(new.order_code::text, new.id::text)
      using errcode = 'check_violation';
  end if;

  if new.current_driver_id is not null
     and new.current_driver_id is distinct from old.current_driver_id then
    raise exception 'El pedido % no tiene el pago confirmado; no se le puede asignar repartidor.', coalesce(new.order_code::text, new.id::text)
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists orders_enforce_payment_before_dispatch on public.orders;

create trigger orders_enforce_payment_before_dispatch
  before update of status, current_driver_id on public.orders
  for each row
  execute function public.enforce_payment_before_dispatch();

-- El despacho de ACME-DRIVER (dispatch_order, admin_assign_order) crea la
-- oferta en order_assignments antes de tocar orders.status, asi que tambien
-- se bloquea ahi: a un pedido sin pagar no se le ofrece a ningun repartidor.
create or replace function public.enforce_payment_before_assignment()
returns trigger
language plpgsql
as $$
declare
  v_status text;
  v_payment_status text;
  v_order_code text;
begin
  select o.status::text, o.payment_status::text, coalesce(o.order_code::text, o.id::text)
    into v_status, v_payment_status, v_order_code
  from public.orders o
  where o.id = new.order_id;

  if v_status = any (array['pending_payment', 'placed', 'pending'])
     and coalesce(v_payment_status, '') <> 'paid' then
    raise exception 'El pedido % no tiene el pago confirmado; no se le puede asignar repartidor.', v_order_code
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists order_assignments_enforce_payment_before_dispatch on public.order_assignments;

create trigger order_assignments_enforce_payment_before_dispatch
  before insert on public.order_assignments
  for each row
  execute function public.enforce_payment_before_assignment();
