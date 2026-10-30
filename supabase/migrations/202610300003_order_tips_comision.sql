-- ACME - 30 de octubre
-- La comision de la pasarela en la propina.
--
-- La propina se cobra como el pedido: el cliente paga la propina mas lo que
-- cobra el medio de pago, para que al repartidor le llegue completa. `amount`
-- es lo del repartidor y `fee_amount` lo de la pasarela.
alter table public.order_tips
  add column if not exists fee_amount numeric(10,2) not null default 0;

comment on column public.order_tips.fee_amount is
  'Comision del medio de pago, cobrada al cliente ademas de amount.';
