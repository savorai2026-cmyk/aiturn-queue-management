alter table public.clients
  add column if not exists deleted_at timestamptz;

comment on column public.clients.deleted_at is
  'Set when the client is removed from the client list. Past appointments stay linked so history keeps the name.';

create or replace function public.count_client_upcoming_appointments(
  p_business_code uuid,
  p_client_id bigint
)
returns integer
language plpgsql
stable
security definer
set search_path = public, private, pg_catalog
as $$
declare
  v_tz text;
  v_count integer;
begin
  if not private.has_business_role(
    p_business_code,
    array['owner', 'admin', 'staff', 'viewer']
  ) then
    raise exception 'אין הרשאה לצפות בלקוח.';
  end if;

  select coalesce(nullif(btrim(timezone), ''), 'Asia/Jerusalem')
    into v_tz
    from public.businesses
   where business_code = p_business_code;

  v_tz := coalesce(v_tz, 'Asia/Jerusalem');

  select count(*)::integer
    into v_count
    from public.appointments
   where business_code = p_business_code
     and client_id = p_client_id
     and coalesce(btrim(status::text), '') not in (
       '03', '09', '10', 'completed', 'no_show', 'canceled', 'cancelled'
     )
     and appointment_date is not null
     and start_time is not null
     and (appointment_date + start_time) > timezone(v_tz, now());

  return coalesce(v_count, 0);
end;
$$;

create or replace function public.delete_client(
  p_business_code uuid,
  p_client_id bigint
)
returns integer
language plpgsql
security definer
set search_path = public, private, pg_catalog
as $$
declare
  v_tz text;
  v_canceled integer;
begin
  if not private.has_business_role(
    p_business_code,
    array['owner', 'admin', 'staff']
  ) then
    raise exception 'אין הרשאה למחוק את הלקוח.';
  end if;

  if not exists (
    select 1
      from public.clients
     where business_code = p_business_code
       and id = p_client_id
       and deleted_at is null
  ) then
    raise exception 'לא ניתן למחוק את הלקוח.';
  end if;

  select coalesce(nullif(btrim(timezone), ''), 'Asia/Jerusalem')
    into v_tz
    from public.businesses
   where business_code = p_business_code;

  v_tz := coalesce(v_tz, 'Asia/Jerusalem');

  update public.appointments
     set status = '10'
   where business_code = p_business_code
     and client_id = p_client_id
     and coalesce(btrim(status::text), '') not in (
       '03', '09', '10', 'completed', 'no_show', 'canceled', 'cancelled'
     )
     and appointment_date is not null
     and start_time is not null
     and (appointment_date + start_time) > timezone(v_tz, now());

  get diagnostics v_canceled = row_count;

  update public.clients
     set deleted_at = now(),
         booking_policy = 'blocked'
   where business_code = p_business_code
     and id = p_client_id
     and deleted_at is null;

  if not found then
    raise exception 'לא ניתן למחוק את הלקוח.';
  end if;

  return coalesce(v_canceled, 0);
end;
$$;

revoke all on function public.count_client_upcoming_appointments(uuid, bigint) from public, anon;
revoke all on function public.delete_client(uuid, bigint) from public, anon;
grant execute on function public.count_client_upcoming_appointments(uuid, bigint) to authenticated, service_role;
grant execute on function public.delete_client(uuid, bigint) to authenticated, service_role;

create or replace function public.appointments_reject_deleted_client()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if new.client_id is null then
    return new;
  end if;

  if exists (
    select 1
      from public.clients
     where business_code = new.business_code
       and id = new.client_id
       and deleted_at is not null
  ) then
    raise exception 'הלקוח נמחק ולא ניתן לקבוע לו תור חדש.';
  end if;

  return new;
end;
$$;

revoke all on function public.appointments_reject_deleted_client() from public, anon, authenticated;

drop trigger if exists appointments_reject_deleted_client_trg on public.appointments;
create trigger appointments_reject_deleted_client_trg
  before insert
  on public.appointments
  for each row
  execute function public.appointments_reject_deleted_client();

notify pgrst, 'reload schema';
