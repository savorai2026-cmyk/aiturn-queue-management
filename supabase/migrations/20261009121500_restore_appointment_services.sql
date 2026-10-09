-- The calendar embeds appointment_services on appointments. That table was
-- missing, so PostgREST could not load the live calendar.

create unique index if not exists appointments_business_id_uidx
  on public.appointments (business_code, id);

create table if not exists public.appointment_services (
  appointment_id integer not null,
  service_id integer not null,
  business_code uuid not null
    references public.businesses(business_code) on delete cascade,
  position smallint not null check (position > 0),
  title_snapshot text not null,
  duration_minutes integer not null check (duration_minutes > 0),
  buffer_time_minutes integer not null default 0
    check (buffer_time_minutes >= 0),
  price numeric not null check (price >= 0),
  created_at timestamptz not null default now(),
  primary key (appointment_id, service_id),
  unique (appointment_id, position),
  foreign key (business_code, appointment_id)
    references public.appointments(business_code, id) on delete cascade
);

create index if not exists appointment_services_business_appointment_idx
  on public.appointment_services (business_code, appointment_id);

alter table public.appointment_services enable row level security;

grant select, insert, update, delete on table public.appointment_services to authenticated;
grant all on table public.appointment_services to service_role;

drop policy if exists "Members can view appointment services"
  on public.appointment_services;
create policy "Members can view appointment services"
  on public.appointment_services
  for select
  to authenticated
  using (private.is_business_member(business_code));

drop policy if exists "Authorized members can create appointment services"
  on public.appointment_services;
create policy "Authorized members can create appointment services"
  on public.appointment_services
  for insert
  to authenticated
  with check (
    private.has_business_role(
      business_code,
      array['owner', 'admin', 'staff']
    )
  );

drop policy if exists "Authorized members can update appointment services"
  on public.appointment_services;
create policy "Authorized members can update appointment services"
  on public.appointment_services
  for update
  to authenticated
  using (
    private.has_business_role(
      business_code,
      array['owner', 'admin', 'staff']
    )
  )
  with check (
    private.has_business_role(
      business_code,
      array['owner', 'admin', 'staff']
    )
  );

drop policy if exists "Authorized members can delete appointment services"
  on public.appointment_services;
create policy "Authorized members can delete appointment services"
  on public.appointment_services
  for delete
  to authenticated
  using (
    private.has_business_role(
      business_code,
      array['owner', 'admin', 'staff']
    )
  );

insert into public.appointment_services (
  appointment_id,
  service_id,
  business_code,
  position,
  title_snapshot,
  duration_minutes,
  buffer_time_minutes,
  price
)
select
  appointment.id,
  service.id,
  appointment.business_code,
  1,
  service.title,
  service.duration_minutes,
  coalesce(service.buffer_time_minutes, 0),
  service.price
from public.appointments as appointment
join public.services as service
  on service.id = appointment.service_id
 and service.business_code = appointment.business_code
where appointment.service_id is not null
on conflict (appointment_id, service_id) do nothing;

alter table public.appointment_services replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'appointment_services'
  ) then
    execute 'alter publication supabase_realtime add table public.appointment_services';
  end if;
end $$;

notify pgrst, 'reload schema';
