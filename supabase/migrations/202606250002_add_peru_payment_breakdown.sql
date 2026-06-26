-- Desglose peruano de pago para cotizaciones y pedidos courier.
-- Las columnas permiten auditar IGV incluido y comision de pasarela.

alter table public.order_quotes
  add column if not exists taxable_base numeric(12, 2) default 0 not null,
  add column if not exists igv_rate numeric(6, 4) default 0.18 not null,
  add column if not exists igv_amount numeric(12, 2) default 0 not null,
  add column if not exists payment_processing_fee numeric(12, 2) default 0 not null,
  add column if not exists payment_processing_rate numeric(6, 4) default 0 not null,
  add column if not exists payment_processing_fixed numeric(12, 2) default 0 not null,
  add column if not exists payment_processing_provider text default 'culqi' not null,
  add column if not exists payment_processing_note text,
  add column if not exists payment_processing_tax_amount numeric(12, 2) default 0 not null;

alter table public.orders
  add column if not exists taxable_base numeric(12, 2) default 0 not null,
  add column if not exists igv_rate numeric(6, 4) default 0.18 not null,
  add column if not exists igv_amount numeric(12, 2) default 0 not null,
  add column if not exists payment_processing_fee numeric(12, 2) default 0 not null,
  add column if not exists payment_processing_rate numeric(6, 4) default 0 not null,
  add column if not exists payment_processing_fixed numeric(12, 2) default 0 not null,
  add column if not exists payment_processing_provider text default 'culqi' not null,
  add column if not exists payment_processing_note text,
  add column if not exists payment_processing_tax_amount numeric(12, 2) default 0 not null;

comment on column public.order_quotes.taxable_base is 'Base imponible calculada desde importes con IGV incluido.';
comment on column public.order_quotes.igv_amount is 'IGV/IPM incluido referencial del precio gravado.';
comment on column public.order_quotes.payment_processing_fee is 'Comision de pasarela aplicada al pago.';
comment on column public.orders.taxable_base is 'Base imponible calculada desde importes con IGV incluido.';
comment on column public.orders.igv_amount is 'IGV/IPM incluido referencial del precio gravado.';
comment on column public.orders.payment_processing_fee is 'Comision de pasarela aplicada al pago.';
