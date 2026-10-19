-- Calificaciones y datos de clientes para el panel del negocio
--
-- 1. El negocio ve el nombre y el correo de sus clientes. Antes el panel leia
--    profiles directo y las politicas RLS de profiles no dejaban que el negocio
--    viera perfiles ajenos, asi que salia "Sin nombre / Sin correo vinculado".
--    Ahora lo lee con merchant_customer_directory, que solo devuelve clientes
--    con pedidos o carritos en ese comercio y solo a su personal (o a un admin).
--    Si el perfil no tiene nombre o correo, se toma el de la cuenta (auth.users).
--
-- 2. El cliente califica al negocio y al repartidor cuando su pedido llega
--    (submit_order_rating). Se guarda en la tabla order_ratings, que ya existia
--    pero nadie llenaba. drivers.rating_avg se recalcula con cada calificacion.
--
-- 3. El negocio lee las calificaciones de sus pedidos con
--    merchant_order_ratings.
--
-- Se puede correr mas de una vez.

-- ---------------------------------------------------------------------------
-- Quien pertenece a un comercio (personal, cuenta de acceso o admin)
-- ---------------------------------------------------------------------------
create or replace function public.is_merchant_member(p_merchant_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or p_merchant_id is null then
    return false;
  end if;

  if exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = v_uid and r.code::text in ('admin', 'super_admin')
  ) or exists (
    select 1 from public.profiles p
    where p.user_id = v_uid and p.default_role::text in ('admin', 'super_admin')
  ) then
    return true;
  end if;

  return exists (
    select 1 from public.merchant_staff ms
    where ms.user_id = v_uid
      and ms.merchant_id = p_merchant_id
      and coalesce(ms.is_active, true)
  ) or exists (
    select 1 from public.merchant_access_accounts maa
    where maa.user_id = v_uid
      and maa.merchant_id = p_merchant_id
      and maa.is_active
  );
end;
$$;

revoke all on function public.is_merchant_member(uuid) from public, anon;
grant execute on function public.is_merchant_member(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Clientes del comercio con nombre, correo y lo que calificaron
-- ---------------------------------------------------------------------------
drop function if exists public.merchant_customer_directory(uuid);
create function public.merchant_customer_directory(p_merchant_id uuid)
returns table (
  user_id uuid,
  full_name text,
  email text,
  phone text,
  default_role text,
  is_active boolean,
  rating_avg numeric,
  ratings_count integer,
  merchant_score_avg numeric,
  driver_score_avg numeric
)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
begin
  if not public.is_merchant_member(p_merchant_id) then
    raise exception 'No tienes acceso a los clientes de este comercio.' using errcode = 'insufficient_privilege';
  end if;

  return query
  with ids as (
    select o.customer_id as uid from public.orders o
    where o.merchant_id = p_merchant_id and o.customer_id is not null
    union
    select c.customer_id from public.carts c
    where c.merchant_id = p_merchant_id and c.customer_id is not null
  ),
  ratings as (
    select r.customer_id as uid,
           count(*)::integer as cnt,
           round(avg(r.merchant_score)::numeric, 1) as m_avg,
           round(avg(r.driver_score)::numeric, 1) as d_avg
    from public.order_ratings r
    where r.merchant_id = p_merchant_id
    group by r.customer_id
  )
  select
    ids.uid,
    coalesce(
      nullif(trim(p.full_name), ''),
      nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''),
      nullif(trim(u.raw_user_meta_data ->> 'name'), '')
    )::text,
    coalesce(nullif(trim(p.email), ''), u.email)::text,
    coalesce(nullif(trim(p.phone), ''), nullif(trim(u.phone), ''))::text,
    coalesce(p.default_role::text, 'customer'),
    coalesce(p.is_active, true),
    coalesce(cu.rating_avg, 0)::numeric,
    coalesce(ratings.cnt, 0),
    ratings.m_avg,
    ratings.d_avg
  from ids
  left join public.profiles p on p.user_id = ids.uid
  left join auth.users u on u.id = ids.uid
  left join public.customers cu on cu.user_id = ids.uid
  left join ratings on ratings.uid = ids.uid;
end;
$$;

revoke all on function public.merchant_customer_directory(uuid) from public, anon;
grant execute on function public.merchant_customer_directory(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Calificaciones de los pedidos del comercio (todas o de un cliente)
-- ---------------------------------------------------------------------------
drop function if exists public.merchant_order_ratings(uuid, uuid);
create function public.merchant_order_ratings(p_merchant_id uuid, p_customer_id uuid default null)
returns table (
  id uuid,
  order_id uuid,
  order_code text,
  customer_id uuid,
  driver_id uuid,
  driver_name text,
  merchant_score smallint,
  driver_score smallint,
  comment text,
  rated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_merchant_member(p_merchant_id) then
    raise exception 'No tienes acceso a las calificaciones de este comercio.' using errcode = 'insufficient_privilege';
  end if;

  return query
  select
    r.id,
    r.order_id,
    o.order_code::text,
    r.customer_id,
    r.driver_id,
    nullif(trim(dp.full_name), '')::text,
    r.merchant_score,
    r.driver_score,
    r.comment,
    coalesce(r.rated_at, r.created_at)
  from public.order_ratings r
  left join public.orders o on o.id = r.order_id
  left join public.profiles dp on dp.user_id = r.driver_id
  where r.merchant_id = p_merchant_id
    and (p_customer_id is null or r.customer_id = p_customer_id)
  order by coalesce(r.rated_at, r.created_at) desc;
end;
$$;

revoke all on function public.merchant_order_ratings(uuid, uuid) from public, anon;
grant execute on function public.merchant_order_ratings(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- El cliente califica un pedido entregado (negocio y repartidor, de 1 a 5)
-- ---------------------------------------------------------------------------
drop function if exists public.submit_order_rating(uuid, integer, integer, text);
create function public.submit_order_rating(
  p_order_id uuid,
  p_merchant_score integer,
  p_driver_score integer default null,
  p_comment text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_order public.orders%rowtype;
  v_driver_id uuid;
  v_driver_score integer := p_driver_score;
  v_score integer;
  v_comment text := nullif(trim(coalesce(p_comment, '')), '');
  v_rating_id uuid;
begin
  if v_uid is null then
    raise exception 'Inicia sesion para calificar tu pedido.' using errcode = 'insufficient_privilege';
  end if;

  select * into v_order from public.orders where id = p_order_id;
  if not found or v_order.customer_id is distinct from v_uid then
    raise exception 'Solo puedes calificar tus propios pedidos.' using errcode = 'insufficient_privilege';
  end if;

  if v_order.status::text <> 'delivered' then
    raise exception 'Podras calificar el pedido cuando te llegue.';
  end if;

  if p_merchant_score is null or p_merchant_score not between 1 and 5 then
    raise exception 'La calificacion del negocio debe ser de 1 a 5 estrellas.';
  end if;

  v_driver_id := v_order.current_driver_id;
  if v_driver_id is null then
    select oa.driver_id into v_driver_id
    from public.order_assignments oa
    where oa.order_id = p_order_id
      and oa.status::text not in ('rejected', 'cancelled')
    order by oa.assigned_at desc nulls last
    limit 1;
  end if;

  if v_driver_id is null then
    v_driver_score := null;
  elsif v_driver_score is not null and v_driver_score not between 1 and 5 then
    raise exception 'La calificacion del repartidor debe ser de 1 a 5 estrellas.';
  end if;

  if v_comment is not null and length(v_comment) > 500 then
    v_comment := left(v_comment, 500);
  end if;

  v_score := case
    when v_driver_score is null then p_merchant_score
    else round((p_merchant_score + v_driver_score) / 2.0)::integer
  end;

  -- order_ratings.customer_id apunta a customers; se asegura la fila.
  insert into public.customers (user_id, rating_avg, created_at, updated_at)
  values (v_uid, 0, now(), now())
  on conflict (user_id) do nothing;

  update public.order_ratings
     set merchant_score = p_merchant_score,
         driver_score = v_driver_score,
         driver_id = v_driver_id,
         score = v_score,
         comment = v_comment,
         rated_at = now(),
         updated_at = now()
   where order_id = p_order_id
     and customer_id = v_uid
  returning id into v_rating_id;

  if v_rating_id is null then
    insert into public.order_ratings (
      id, order_id, customer_id, merchant_id, driver_id,
      score, merchant_score, driver_score, comment, rated_at, created_at, updated_at
    ) values (
      gen_random_uuid(), p_order_id, v_uid, v_order.merchant_id, v_driver_id,
      v_score, p_merchant_score, v_driver_score, v_comment, now(), now(), now()
    )
    returning id into v_rating_id;
  end if;

  if v_driver_id is not null then
    update public.drivers d
       set rating_avg = coalesce((
             select round(avg(r.driver_score)::numeric, 2)
             from public.order_ratings r
             where r.driver_id = v_driver_id and r.driver_score is not null
           ), d.rating_avg),
           updated_at = now()
     where d.user_id = v_driver_id;
  end if;

  return v_rating_id;
end;
$$;

revoke all on function public.submit_order_rating(uuid, integer, integer, text) from public, anon;
grant execute on function public.submit_order_rating(uuid, integer, integer, text) to authenticated;

-- ---------------------------------------------------------------------------
-- El cliente ve las calificaciones que dio
-- ---------------------------------------------------------------------------
drop function if exists public.my_order_ratings();
create function public.my_order_ratings()
returns table (
  order_id uuid,
  merchant_score smallint,
  driver_score smallint,
  comment text,
  rated_at timestamptz,
  has_driver boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select r.order_id, r.merchant_score, r.driver_score, r.comment,
         coalesce(r.rated_at, r.created_at), r.driver_id is not null
  from public.order_ratings r
  where r.customer_id = auth.uid();
$$;

revoke all on function public.my_order_ratings() from public, anon;
grant execute on function public.my_order_ratings() to authenticated;

-- Una sola calificacion por pedido (si ya hubiera duplicados, se omite el indice).
do $$
begin
  if not exists (
    select 1 from public.order_ratings group by order_id having count(*) > 1
  ) then
    create unique index if not exists order_ratings_order_id_key on public.order_ratings (order_id);
  end if;
end;
$$;

notify pgrst, 'reload schema';
