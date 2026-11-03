-- ============================================================
-- Configuracion de cobros editable desde el admin
-- Fecha: 2026-11-01
--
-- El dueño de ACME cambia desde Admin > Cobros la tarifa de servicio,
-- la condicion en productos (general y por negocio), el envio por zonas
-- y por puntos del mapa, el recargo por varios locales, el IGV y lo que
-- se le cobra al cliente por cada pasarela.
--
-- Todo va en una sola fila JSON (id = 'global'). El backend de pagos
-- (acme-pagos-api) la lee con la clave de servicio y la guarda despues
-- de comprobar que quien guarda es admin. Mientras esta tabla no exista
-- o este vacia, se cobra con los valores de siempre.
--
-- pricing_config_history guarda cada version guardada, para saber
-- quien cambio que y poder volver atras.
-- ============================================================

create table if not exists public.pricing_config (
  id text primary key default 'global',
  config jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

create table if not exists public.pricing_config_history (
  id bigint generated always as identity primary key,
  config jsonb not null,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists pricing_config_history_created_idx
  on public.pricing_config_history (created_at desc);

alter table public.pricing_config enable row level security;
alter table public.pricing_config_history enable row level security;

-- Solo admins de plataforma leen desde el navegador (el desglose interno
-- no es para los clientes). Nadie escribe desde el navegador: guarda el
-- backend con la clave de servicio, que no pasa por RLS.
drop policy if exists pricing_config_admin_read on public.pricing_config;
create policy pricing_config_admin_read on public.pricing_config
  for select to authenticated
  using (public.is_admin());

drop policy if exists pricing_config_history_admin_read on public.pricing_config_history;
create policy pricing_config_history_admin_read on public.pricing_config_history
  for select to authenticated
  using (public.is_admin());

revoke insert, update, delete on public.pricing_config from anon, authenticated;
revoke insert, update, delete on public.pricing_config_history from anon, authenticated;
