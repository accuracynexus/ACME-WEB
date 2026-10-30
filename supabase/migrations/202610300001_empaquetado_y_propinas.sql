-- ACME · 30 de octubre
-- 1. El paso "empaquetado" del local.
-- 2. Las propinas que el cliente deja despues de la entrega.

-- ── 1. Empaquetado ─────────────────────────────────────────────────────────
-- No es un estado nuevo del enum a proposito: el pedido sigue en `preparing`
-- hasta que el local lo marca listo, asi que el repartidor, el backend y la
-- app del cliente no tienen que aprender un valor nuevo. Solo se guarda cuando
-- el local lo empaqueto.
alter table public.orders
  add column if not exists packed_at timestamptz;

comment on column public.orders.packed_at is
  'Cuando el local marco el pedido como empaquetado. Paso intermedio dentro de preparing.';

-- ── 2. Propinas posteriores a la entrega ───────────────────────────────────
-- Van aparte y no sobre el pedido: su total ya se cobro y con el se liquida al
-- comercio. Cuando la pasarela confirma la propina, el backend la suma a
-- orders.tip_amount, que es de donde sale la propina del repartidor.
create table if not exists public.order_tips (
  id                      uuid primary key default gen_random_uuid(),
  order_id                uuid not null references public.orders(id) on delete cascade,
  customer_id             uuid not null,
  driver_id               uuid,
  amount                  numeric(10,2) not null check (amount > 0),
  -- card | yape | yape_directo
  payment_method          text not null,
  -- culqi | yape_propio
  provider                text,
  -- Orden Culqi (ord_...) o sesion de Yape propio.
  external_reference      text,
  provider_transaction_id text,
  status                  text not null default 'pendiente'
                            check (status in ('pendiente', 'pagada', 'fallida', 'anulada')),
  nota                    text,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  paid_at                 timestamptz
);

comment on table public.order_tips is
  'Propinas dejadas despues de la entrega. Se acreditan en orders.tip_amount al confirmarse.';

-- Una sola propina viva por pedido: evita dos cobros abiertos por lo mismo.
create unique index if not exists order_tips_una_por_pedido
  on public.order_tips (order_id)
  where status in ('pendiente', 'pagada');

create index if not exists order_tips_referencia
  on public.order_tips (external_reference);

alter table public.order_tips enable row level security;

-- El cliente ve las suyas; las escribe el backend con la service key.
drop policy if exists order_tips_select_customer on public.order_tips;
create policy order_tips_select_customer on public.order_tips
  for select
  using (customer_id = (select auth.uid()) or (select private.is_admin()));
