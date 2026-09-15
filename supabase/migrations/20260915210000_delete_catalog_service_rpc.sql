alter table public.appointments
  alter column service_id drop not null;

alter table public.appointment_services
  drop constraint if exists appointment_services_business_code_service_id_fkey;

create or replace function public.delete_catalog_service(
  p_business_code uuid,
  p_service_id integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not private.has_business_role(
    p_business_code,
    array['owner', 'admin', 'staff']
  ) then
    raise exception 'אין הרשאה למחוק שירותים בעסק זה';
  end if;

  update public.appointments
     set service_id = null
   where business_code = p_business_code
     and service_id = p_service_id;

  delete from public.appointment_services
   where business_code = p_business_code
     and service_id = p_service_id;

  delete from public.services
   where business_code = p_business_code
     and id = p_service_id;

  if not found then
    raise exception 'השירות לא נמצא או כבר נמחק';
  end if;
end;
$$;

revoke all on function public.delete_catalog_service(uuid, integer) from public;
grant execute on function public.delete_catalog_service(uuid, integer) to authenticated;

create or replace function public.delete_catalog_status(
  p_business_code uuid,
  p_status_code text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not private.has_business_role(
    p_business_code,
    array['owner', 'admin', 'staff']
  ) then
    raise exception 'אין הרשאה למחוק סטטוסים בעסק זה';
  end if;

  if exists (
    select 1
    from public.appointments
    where business_code = p_business_code
      and status = p_status_code
  ) then
    raise exception 'לא ניתן למחוק סטטוס שכבר בשימוש בתורים';
  end if;

  delete from public.statuses
   where business_code = p_business_code
     and status_code = p_status_code;

  if not found then
    raise exception 'הסטטוס לא נמצא או כבר נמחק';
  end if;
end;
$$;

revoke all on function public.delete_catalog_status(uuid, text) from public;
grant execute on function public.delete_catalog_status(uuid, text) to authenticated;

notify pgrst, 'reload schema';
