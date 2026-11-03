-- ============================================================
-- Historial de cobros para cuadrar cada pedido
-- Fecha: 2026-11-01
--
-- Cada vez que el admin guarda Cobros se crea una version en
-- pricing_config_history (quien, cuando, motivo y que cambio).
-- pricing_config.version_id dice cual version se esta cobrando.
--
-- Cada cotizacion y cada pedido guardan con que version se cobraron
-- (pricing_version) y el desglose de ese momento (pricing_breakdown:
-- cuanto va al local, a ACME, a SUNAT, a la pasarela y la propina),
-- asi un cambio de tarifa no cambia como se lee un pedido viejo.
-- Los pedidos de antes de esta migracion quedan sin version.
-- ============================================================

alter table public.pricing_config
  add column if not exists version_id bigint;

alter table public.pricing_config_history
  add column if not exists note text,
  add column if not exists changes jsonb not null default '[]'::jsonb,
  add column if not exists previous_version_id bigint;

alter table public.order_quotes
  add column if not exists pricing_version bigint,
  add column if not exists pricing_breakdown jsonb;

alter table public.orders
  add column if not exists pricing_version bigint,
  add column if not exists pricing_breakdown jsonb;

create index if not exists orders_pricing_version_idx
  on public.orders (pricing_version)
  where pricing_version is not null;

comment on column public.orders.pricing_version is
  'Version de Admin > Cobros (pricing_config_history.id) con que se cobro el pedido. Null = antes del historial.';
comment on column public.orders.pricing_breakdown is
  'Desglose del cobro al momento del pedido: conceptos y a quien va cada monto.';
