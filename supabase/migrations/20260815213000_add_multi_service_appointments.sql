create unique index if not exists appointments_business_id_uidx
  on public.appointments (business_code, id);

create table if not exists public.appointment_services (
  appointment_id bigint not null,
  service_id bigint not null,
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
    references public.appointments(business_code, id) on delete cascade,
  foreign key (business_code, service_id)
    references public.services(business_code, id)
);

create index if not exists appointment_services_business_appointment_idx
  on public.appointment_services (business_code, appointment_id);

alter table public.appointment_services enable row level security;

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

create or replace function public.create_appointment_with_services(
  p_business_code uuid,
  p_client_id bigint,
  p_appointment_date date,
  p_start_time time without time zone,
  p_service_ids bigint[],
  p_status text default 'waiting',
  p_channel text default 'manual',
  p_currency text default 'ILS',
  p_client_notes text default null,
  p_business_notes text default null
)
returns table (
  appointment_id bigint,
  end_time time without time zone,
  total_duration_minutes integer,
  total_price numeric
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_appointment_id bigint;
  v_end_time time without time zone;
  v_total_duration integer;
  v_total_price numeric;
  v_service_count integer;
begin
  if not private.has_business_role(
    p_business_code,
    array['owner', 'admin', 'staff']
  ) then
    raise exception 'Not authorized to create appointments';
  end if;

  if coalesce(cardinality(p_service_ids), 0) = 0 then
    raise exception 'At least one service is required';
  end if;

  select
    count(*)::integer,
    sum(
      service.duration_minutes +
      coalesce(service.buffer_time_minutes, 0)
    )::integer,
    sum(service.price)
  into
    v_service_count,
    v_total_duration,
    v_total_price
  from public.services as service
  where service.business_code = p_business_code
    and service.is_active is not false
    and service.id = any(p_service_ids);

  if v_service_count <> cardinality(p_service_ids) then
    raise exception 'One or more services are invalid or inactive';
  end if;

  v_end_time :=
    p_start_time + make_interval(mins => v_total_duration);

  insert into public.appointments (
    business_code,
    client_id,
    service_id,
    appointment_date,
    start_time,
    end_time,
    status,
    channel,
    currency,
    price,
    client_notes,
    business_notes,
    metadata
  )
  values (
    p_business_code,
    p_client_id,
    p_service_ids[1],
    p_appointment_date,
    p_start_time,
    v_end_time,
    p_status,
    p_channel,
    p_currency,
    v_total_price,
    nullif(trim(p_client_notes), ''),
    nullif(trim(p_business_notes), ''),
    jsonb_build_object('service_ids', p_service_ids)
  )
  returning id into v_appointment_id;

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
    v_appointment_id,
    service.id,
    p_business_code,
    array_position(p_service_ids, service.id)::smallint,
    service.title,
    service.duration_minutes,
    coalesce(service.buffer_time_minutes, 0),
    service.price
  from public.services as service
  where service.business_code = p_business_code
    and service.id = any(p_service_ids)
  order by array_position(p_service_ids, service.id);

  return query
  select
    v_appointment_id,
    v_end_time,
    v_total_duration,
    v_total_price;
end;
$$;

revoke all on function public.create_appointment_with_services(
  uuid,
  bigint,
  date,
  time without time zone,
  bigint[],
  text,
  text,
  text,
  text,
  text
) from public;
grant execute on function public.create_appointment_with_services(
  uuid,
  bigint,
  date,
  time without time zone,
  bigint[],
  text,
  text,
  text,
  text,
  text
) to authenticated;

create or replace function public.get_available_appointment_slots(
  p_business_code uuid,
  p_appointment_date date,
  p_service_ids bigint[],
  p_limit integer default 8
)
returns table (
  start_time time without time zone,
  end_time time without time zone
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_day_key text;
  v_day_config jsonb;
  v_shifts jsonb;
  v_slot_minutes integer;
  v_total_duration integer;
  v_service_count integer;
begin
  if not private.is_business_member(p_business_code) then
    raise exception 'Not authorized to view availability';
  end if;

  if coalesce(cardinality(p_service_ids), 0) = 0 then
    return;
  end if;

  select
    count(*)::integer,
    sum(
      service.duration_minutes +
      coalesce(service.buffer_time_minutes, 0)
    )::integer
  into v_service_count, v_total_duration
  from public.services as service
  where service.business_code = p_business_code
    and service.is_active is not false
    and service.id = any(p_service_ids);

  if v_service_count <> cardinality(p_service_ids) then
    raise exception 'One or more services are invalid or inactive';
  end if;

  select
    coalesce(business.slot_duration_minutes, 30),
    business.working_hours::jsonb
  into v_slot_minutes, v_day_config
  from public.businesses as business
  where business.business_code = p_business_code;

  v_day_key := case extract(dow from p_appointment_date)::integer
    when 0 then 'sunday'
    when 1 then 'monday'
    when 2 then 'tuesday'
    when 3 then 'wednesday'
    when 4 then 'thursday'
    when 5 then 'friday'
    else 'saturday'
  end;

  v_day_config := v_day_config -> v_day_key;

  if v_day_config is null then
    v_shifts := '[{"start":"08:00","end":"20:00"}]'::jsonb;
  elsif coalesce((v_day_config ->> 'is_closed')::boolean, false) then
    return;
  else
    v_shifts := coalesce(v_day_config -> 'shifts', '[]'::jsonb);
  end if;

  return query
  with shift_values as (
    select
      (shift_value ->> 'start')::time as shift_start,
      (shift_value ->> 'end')::time as shift_end
    from jsonb_array_elements(v_shifts) as shift_value
  ),
  candidates as (
    select
      candidate::time as candidate_start,
      (
        candidate + make_interval(mins => v_total_duration)
      )::time as candidate_end
    from shift_values
    cross join lateral generate_series(
      p_appointment_date + shift_start,
      p_appointment_date + shift_end -
        make_interval(mins => v_total_duration),
      make_interval(mins => greatest(v_slot_minutes, 1))
    ) as candidate
  )
  select candidates.candidate_start, candidates.candidate_end
  from candidates
  where not exists (
    select 1
    from public.appointments as appointment
    where appointment.business_code = p_business_code
      and appointment.appointment_date = p_appointment_date
      and appointment.status <> 'canceled'
      and candidates.candidate_start < appointment.end_time
      and candidates.candidate_end > appointment.start_time
  )
  order by candidates.candidate_start
  limit greatest(p_limit, 1);
end;
$$;

revoke all on function public.get_available_appointment_slots(
  uuid,
  date,
  bigint[],
  integer
) from public;
grant execute on function public.get_available_appointment_slots(
  uuid,
  date,
  bigint[],
  integer
) to authenticated;
