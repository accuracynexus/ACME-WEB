-- Cuentas internas con correo @acmedidos.com
--
-- Negocios (dueños y personal), repartidores y administradores inician sesion
-- con un correo @acmedidos.com. Los clientes de la tienda siguen usando cualquier correo.
--
-- Esta migracion lo refuerza en la base: no se puede vincular una cuenta a un
-- negocio, a la flota de reparto ni a un rol interno si su correo de acceso
-- (auth.users.email) no termina en @acmedidos.com. Las filas que ya existen no
-- se tocan; al final hay una consulta para revisar las cuentas internas actuales
-- que aun usan otro correo.

create or replace function public.is_acmedidos_email(p_email text)
returns boolean
language sql
immutable
as $$
  select coalesce(lower(trim(p_email)) ~ '^[^[:space:]@]+@acmedidos\.com$', false);
$$;

create or replace function public.is_internal_role_code(p_code text)
returns boolean
language sql
immutable
as $$
  select coalesce(
    lower(p_code) in ('admin', 'super_admin', 'merchant_staff', 'merchant_owner', 'merchant_admin', 'driver', 'operator', 'support')
    or lower(p_code) like '%admin%'
    or lower(p_code) like '%merchant%'
    or lower(p_code) like '%driver%',
    false
  );
$$;

create or replace function public.assert_internal_account_email(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_email text;
begin
  if p_user_id is null then
    return;
  end if;

  select u.email into v_email from auth.users u where u.id = p_user_id;

  if not public.is_acmedidos_email(v_email) then
    raise exception 'Las cuentas de negocios, repartidores y administradores deben usar un correo @acmedidos.com (cuenta actual: %)', coalesce(v_email, 'sin correo')
      using errcode = 'check_violation';
  end if;
end;
$$;

-- Negocios, personal y repartidores: al vincular una cuenta nueva.
create or replace function public.enforce_internal_account_email()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if tg_op = 'INSERT' or new.user_id is distinct from old.user_id then
    perform public.assert_internal_account_email(new.user_id);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_merchant_staff_acmedidos_email on public.merchant_staff;
create trigger trg_merchant_staff_acmedidos_email
  before insert or update of user_id on public.merchant_staff
  for each row execute function public.enforce_internal_account_email();

drop trigger if exists trg_merchant_access_accounts_acmedidos_email on public.merchant_access_accounts;
create trigger trg_merchant_access_accounts_acmedidos_email
  before insert or update of user_id on public.merchant_access_accounts
  for each row execute function public.enforce_internal_account_email();

drop trigger if exists trg_drivers_acmedidos_email on public.drivers;
create trigger trg_drivers_acmedidos_email
  before insert or update of user_id on public.drivers
  for each row execute function public.enforce_internal_account_email();

-- Roles internos (admin, negocio, repartidor) asignados en user_roles.
create or replace function public.enforce_internal_role_email()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_code text;
begin
  if tg_op = 'UPDATE' and new.user_id is not distinct from old.user_id and new.role_id is not distinct from old.role_id then
    return new;
  end if;

  select r.code::text into v_code from public.roles r where r.id = new.role_id;
  if public.is_internal_role_code(v_code) then
    perform public.assert_internal_account_email(new.user_id);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_user_roles_acmedidos_email on public.user_roles;
create trigger trg_user_roles_acmedidos_email
  before insert or update of user_id, role_id on public.user_roles
  for each row execute function public.enforce_internal_role_email();

-- Rol por defecto del perfil (lo usa el portal para reconocer admins).
create or replace function public.enforce_internal_default_role_email()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if new.default_role is null or not public.is_internal_role_code(new.default_role::text) then
    return new;
  end if;

  if tg_op = 'UPDATE' and new.default_role is not distinct from old.default_role and new.user_id is not distinct from old.user_id then
    return new;
  end if;

  perform public.assert_internal_account_email(new.user_id);
  return new;
end;
$$;

drop trigger if exists trg_profiles_default_role_acmedidos_email on public.profiles;
create trigger trg_profiles_default_role_acmedidos_email
  before insert or update of default_role, user_id on public.profiles
  for each row execute function public.enforce_internal_default_role_email();

-- ---------------------------------------------------------------------------
-- Revision: cuentas internas actuales que aun no usan @acmedidos.com.
-- Siguen entrando como hoy; para pasarlas al correo nuevo edita su acceso
-- desde el panel (negocios) o cambia su correo en Authentication > Users.
-- ---------------------------------------------------------------------------
select distinct u.id as user_id, u.email, x.tipo
from auth.users u
join (
  select ms.user_id, 'personal de negocio' as tipo from public.merchant_staff ms
  union all
  select maa.user_id, 'acceso de negocio' from public.merchant_access_accounts maa where maa.user_id is not null
  union all
  select d.user_id, 'repartidor' from public.drivers d
  union all
  select ur.user_id, 'rol ' || r.code::text from public.user_roles ur join public.roles r on r.id = ur.role_id
  where public.is_internal_role_code(r.code::text)
) x on x.user_id = u.id
where not public.is_acmedidos_email(u.email)
order by x.tipo, u.email;
