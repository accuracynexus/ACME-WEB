-- Track how often a customer uses each saved delivery address.
-- No new table is needed; the metadata belongs to the customer_addresses link.

alter table public.customer_addresses
  add column if not exists delivery_use_count integer not null default 0,
  add column if not exists last_used_at timestamptz;

alter table public.customer_addresses
  drop constraint if exists customer_addresses_delivery_use_count_nonnegative;

alter table public.customer_addresses
  add constraint customer_addresses_delivery_use_count_nonnegative
  check (delivery_use_count >= 0);

create index if not exists customer_addresses_usage_idx
  on public.customer_addresses (customer_id, last_used_at desc, delivery_use_count desc);

comment on column public.customer_addresses.delivery_use_count is 'Number of completed/attempted deliveries sent to this saved customer address.';
comment on column public.customer_addresses.last_used_at is 'Last time this saved customer address was used during checkout.';
