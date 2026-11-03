do $$ begin create role anon; exception when others then null; end $$; do $$ begin create role authenticated; exception when others then null; end $$; do $$ begin create role service_role; exception when others then null; end $$;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true),'')::uuid $$;
create function auth.jwt() returns jsonb language sql stable as $$ select '{}'::jsonb $$;
create function public.is_admin() returns boolean language sql as $$ select false $$;
create type order_status as enum ('pending_payment','placed','pending','confirmed','accepted','preparing','ready_for_pickup','assigned','picked_up','on_the_way','delivered','cancelled','failed');
create type driver_state as enum ('offline','available','busy','paused');
create table drivers (user_id uuid primary key, status driver_state default 'offline');
create table driver_current_state (driver_id uuid primary key, status driver_state, is_online boolean default false, current_order_id uuid, last_lat numeric, last_lng numeric, last_seen_at timestamptz, updated_at timestamptz);
create table merchant_branches (id uuid primary key, lat numeric, lng numeric, prep_time_avg_min int);
create table orders (id uuid primary key default gen_random_uuid(), customer_id uuid, branch_id uuid, status order_status, fulfillment_type text default 'delivery', current_driver_id uuid, placed_at timestamptz default now(), created_at timestamptz default now(), accepted_at timestamptz, preparing_at timestamptz, merchant_confirmed_at timestamptz, ready_at timestamptz, picked_up_at timestamptz, delivered_at timestamptz, arrived_at timestamptz);
create table order_delivery_details (order_id uuid, lat numeric, lng numeric);
create table driver_locations (driver_id uuid, lat numeric, lng numeric, recorded_at timestamptz);
create or replace function public.distancia_km(p_lat1 numeric, p_lng1 numeric, p_lat2 numeric, p_lng2 numeric)
returns numeric
language sql
immutable
as $$
  select case when p_lat1 is null or p_lng1 is null or p_lat2 is null or p_lng2 is null then null
    else 2 * 6371 * asin(sqrt(
      power(sin(radians((p_lat2 - p_lat1)::float8) / 2), 2)
      + cos(radians(p_lat1::float8)) * cos(radians(p_lat2::float8))
        * power(sin(radians((p_lng2 - p_lng1)::float8) / 2), 2)))::numeric
  end;
$$;
