-- Solicitudes del formulario público de Contacto ("Registra tu negocio en ACME").
-- El formulario público inserta aquí; los administradores pueden leer.

create table if not exists public.contact_requests (
  id uuid primary key default gen_random_uuid(),
  business_name text not null,
  category text null,
  contact_name text not null,
  phone text not null,
  email text not null,
  address text null,
  daily_orders text null,
  referral_source text null,
  message text null,
  status text not null default 'new',
  created_at timestamptz not null default timezone('utc', now()),
  constraint contact_requests_status_check check (status in ('new', 'contacted', 'converted', 'archived'))
);

create index if not exists contact_requests_created_idx on public.contact_requests (created_at desc);
create index if not exists contact_requests_status_idx on public.contact_requests (status);

alter table public.contact_requests enable row level security;

-- Cualquiera (anon o autenticado) puede ENVIAR una solicitud desde la web pública.
drop policy if exists contact_requests_public_insert on public.contact_requests;
create policy contact_requests_public_insert
  on public.contact_requests
  for insert
  with check (true);

-- Solo administradores de plataforma pueden LEER las solicitudes.
drop policy if exists contact_requests_admin_select on public.contact_requests;
create policy contact_requests_admin_select
  on public.contact_requests
  for select
  using (
    exists (
      select 1
      from public.user_roles ur
      join public.roles r on r.id = ur.role_id
      where ur.user_id = auth.uid()
        and r.code in ('admin', 'super_admin')
    )
  );

-- Solo administradores pueden ACTUALIZAR el estado (new -> contacted -> converted/archived).
drop policy if exists contact_requests_admin_update on public.contact_requests;
create policy contact_requests_admin_update
  on public.contact_requests
  for update
  using (
    exists (
      select 1
      from public.user_roles ur
      join public.roles r on r.id = ur.role_id
      where ur.user_id = auth.uid()
        and r.code in ('admin', 'super_admin')
    )
  );
