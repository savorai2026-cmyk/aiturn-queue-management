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
  v_hours jsonb;
  v_exception jsonb;
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
  into v_slot_minutes, v_hours
  from public.businesses as business
  where business.business_code = p_business_code;

  if v_hours is null then
    v_shifts := '[{"start":"08:00","end":"20:00"}]'::jsonb;
  else
    select elem
    into v_exception
    from jsonb_array_elements(coalesce(v_hours -> 'exceptions', '[]'::jsonb)) as elem
    where elem ->> 'date' = to_char(p_appointment_date, 'YYYY-MM-DD')
    limit 1;

    if v_exception is not null then
      if coalesce((v_exception ->> 'is_closed')::boolean, false) then
        return;
      end if;
      v_shifts := coalesce(v_exception -> 'shifts', '[]'::jsonb);
    else
      v_day_key := case extract(dow from p_appointment_date)::integer
        when 0 then 'sunday'
        when 1 then 'monday'
        when 2 then 'tuesday'
        when 3 then 'wednesday'
        when 4 then 'thursday'
        when 5 then 'friday'
        else 'saturday'
      end;

      v_day_config := v_hours -> v_day_key;

      if v_day_config is null then
        v_shifts := '[{"start":"08:00","end":"20:00"}]'::jsonb;
      elsif coalesce((v_day_config ->> 'is_closed')::boolean, false) then
        return;
      else
        v_shifts := coalesce(v_day_config -> 'shifts', '[]'::jsonb);
      end if;
    end if;
  end if;

  if v_shifts is null or jsonb_typeof(v_shifts) <> 'array' or jsonb_array_length(v_shifts) = 0 then
    return;
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
