-- Allow customers to remove their own saved address links when RLS is enabled.
-- This does not enable RLS by itself, so existing projects with RLS disabled are not changed.

do $$
begin
  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'customer_addresses'
      and c.relrowsecurity
  ) and not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'customer_addresses'
      and policyname = 'customers_delete_own_customer_addresses'
  ) then
    create policy customers_delete_own_customer_addresses
      on public.customer_addresses
      for delete
      using (customer_id = auth.uid());
  end if;
end $$;
