create or replace function public.appointments_enqueue_cancel_outreach()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_catalog
as $$
declare
    active_id uuid;
    cancel_payload jsonb;
begin
    if tg_op <> 'UPDATE' then
        return new;
    end if;
    if new.client_id is null or new.business_code is null or new.id is null then
        return new;
    end if;
    if coalesce(btrim(new.status::text), '') <> '10' then
        return new;
    end if;
    if coalesce(btrim(old.status::text), '') = '10' then
        return new;
    end if;
    if new.metadata->>'customer_change_id' is not null
       and new.metadata->>'customer_change_id' is distinct from old.metadata->>'customer_change_id' then
        return new;
    end if;
    if new.metadata->>'closure_id' is not null
       and new.metadata->>'closure_id' is distinct from old.metadata->>'closure_id' then
        return new;
    end if;
    if exists (
        select 1
          from public.outreach_jobs
         where appointment_id = new.id
           and reason = 'cancel'
           and created_at > now() - interval '10 minutes'
    ) then
        return new;
    end if;

    cancel_payload := jsonb_build_object(
        'old_date', coalesce(old.appointment_date, new.appointment_date)::text,
        'old_time', coalesce(old.start_time, new.start_time)::text,
        'old_end', coalesce(old.end_time, new.end_time)::text,
        'service_id', new.service_id,
        'source', 'appointment_cancel'
    );

    select id
      into active_id
      from public.outreach_jobs
     where appointment_id = new.id
       and reason = 'cancel'
       and status in ('pending', 'running')
     limit 1;

    if active_id is not null then
        return new;
    end if;

    begin
        insert into public.outreach_jobs (
            business_code,
            client_id,
            appointment_id,
            reason,
            payload
        ) values (
            new.business_code,
            new.client_id,
            new.id,
            'cancel',
            cancel_payload
        );
    exception
        when unique_violation then
            null;
    end;

    return new;
end;
$$;

revoke all on function public.appointments_enqueue_cancel_outreach() from public, anon, authenticated;

create or replace function public.queue_client_cancellation_notices(
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
  v_row public.appointments%rowtype;
  v_queued integer := 0;
begin
  if not private.has_business_role(
    p_business_code,
    array['owner', 'admin', 'staff']
  ) then
    raise exception 'אין הרשאה למחוק את הלקוח.';
  end if;

  select coalesce(nullif(btrim(timezone), ''), 'Asia/Jerusalem')
    into v_tz
    from public.businesses
   where business_code = p_business_code;

  v_tz := coalesce(v_tz, 'Asia/Jerusalem');

  for v_row in
    select *
      from public.appointments
     where business_code = p_business_code
       and client_id = p_client_id
       and coalesce(btrim(status::text), '') not in (
         '03', '09', '10', 'completed', 'no_show', 'canceled', 'cancelled'
       )
       and appointment_date is not null
       and start_time is not null
       and (appointment_date + start_time) > timezone(v_tz, now())
  loop
    begin
      insert into public.outreach_jobs (
        business_code,
        client_id,
        appointment_id,
        reason,
        payload
      ) values (
        v_row.business_code,
        v_row.client_id,
        v_row.id,
        'cancel',
        jsonb_build_object(
          'old_date', v_row.appointment_date::text,
          'old_time', v_row.start_time::text,
          'old_end', v_row.end_time::text,
          'service_id', v_row.service_id,
          'source', 'appointment_cancel'
        )
      );
      v_queued := v_queued + 1;
    exception
      when unique_violation then
        null;
    end;
  end loop;

  return v_queued;
end;
$$;

create or replace function public.client_cancellation_notice_result(
  p_business_code uuid,
  p_client_id bigint
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, private, pg_catalog
as $$
declare
  v_pending integer;
  v_sent integer;
  v_failed integer;
  v_error text;
begin
  if not private.has_business_role(
    p_business_code,
    array['owner', 'admin', 'staff']
  ) then
    raise exception 'אין הרשאה למחוק את הלקוח.';
  end if;

  select
    count(*) filter (where status in ('pending', 'running'))::integer,
    count(*) filter (where status = 'done')::integer,
    count(*) filter (where status in ('failed', 'cancelled', 'skipped'))::integer,
    (array_agg(error_text order by created_at desc) filter (
      where status = 'failed' and coalesce(error_text, '') <> ''
    ))[1]
    into v_pending, v_sent, v_failed, v_error
    from public.outreach_jobs
   where business_code = p_business_code
     and client_id = p_client_id
     and reason = 'cancel'
     and created_at > now() - interval '15 minutes';

  return jsonb_build_object(
    'pending', coalesce(v_pending, 0),
    'sent', coalesce(v_sent, 0),
    'failed', coalesce(v_failed, 0),
    'error_text', v_error
  );
end;
$$;

revoke all on function public.queue_client_cancellation_notices(uuid, bigint) from public, anon;
revoke all on function public.client_cancellation_notice_result(uuid, bigint) from public, anon;
grant execute on function public.queue_client_cancellation_notices(uuid, bigint) to authenticated, service_role;
grant execute on function public.client_cancellation_notice_result(uuid, bigint) to authenticated, service_role;

notify pgrst, 'reload schema';
