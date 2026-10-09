-- Two subscriptions. Regular keeps recordings for 30 days and history for 2 years.
-- Expanded keeps both up to seven years, the legal ceiling. Ten years is not a setting.

alter table public.businesses
  add column if not exists subscription_plan text not null default 'regular';

alter table public.businesses
  drop constraint if exists businesses_subscription_plan_chk;

alter table public.businesses
  add constraint businesses_subscription_plan_chk
    check (subscription_plan in ('regular', 'expanded'));

update public.businesses
set recordings_retention_days = 30
where subscription_plan <> 'expanded'
  and recordings_retention_days > 30;

alter table public.businesses
  drop constraint if exists businesses_recordings_retention_days_chk;

alter table public.businesses
  add constraint businesses_recordings_retention_days_chk
    check (
      recordings_retention_days >= 1
      and recordings_retention_days <= case
        when subscription_plan = 'expanded' then 2555
        else 30
      end
    );

comment on column public.businesses.subscription_plan is
  'regular: recordings up to 30 days and history for 2 years. expanded: both up to 7 years.';

comment on column public.businesses.recordings_retention_days is
  'Days to keep call recordings. Regular plans are capped at 30 days, expanded plans at 2555.';

create or replace function public.clamp_business_retention()
returns trigger
language plpgsql
as $$
begin
  if new.subscription_plan is distinct from 'expanded' then
    new.subscription_plan := 'regular';
  end if;

  if new.recordings_retention_days is null or new.recordings_retention_days < 1 then
    new.recordings_retention_days := 30;
  elsif new.subscription_plan = 'expanded' and new.recordings_retention_days > 2555 then
    new.recordings_retention_days := 2555;
  elsif new.subscription_plan <> 'expanded' and new.recordings_retention_days > 30 then
    new.recordings_retention_days := 30;
  end if;

  return new;
end;
$$;

drop trigger if exists businesses_clamp_retention on public.businesses;

create trigger businesses_clamp_retention
  before insert or update of subscription_plan, recordings_retention_days
  on public.businesses
  for each row
  execute function public.clamp_business_retention();

create or replace function public.recording_keep_interval(p_plan text, p_days integer)
returns interval
language sql
immutable
as $$
  select least(
    make_interval(days => greatest(coalesce(p_days, 1), 1)),
    case
      when p_plan = 'expanded' then interval '7 years'
      else interval '30 days'
    end
  );
$$;

create or replace function public.history_keep_interval(p_plan text)
returns interval
language sql
immutable
as $$
  select case
    when p_plan = 'expanded' then interval '7 years'
    else interval '2 years'
  end;
$$;

create or replace function public.expired_recording_paths(p_limit integer default 200)
returns table (storage_path text)
language sql
stable
security definer
set search_path = public, storage
as $$
  select expired.path as storage_path
  from (
    select candidates.path, min(candidates.kept_at) as kept_at
    from (
      select r.storage_path as path, r.created_at as kept_at
      from public.recordings r
      join public.businesses b on b.business_code = r.business_code
      where r.created_at < now() - public.recording_keep_interval(
        b.subscription_plan,
        b.recordings_retention_days
      )
      union all
      select o.name as path, o.created_at as kept_at
      from storage.objects o
      join public.businesses b
        on (storage.foldername(o.name))[1] = b.business_code::text
      where o.bucket_id = 'recordings'
        and o.created_at < now() - public.recording_keep_interval(
          b.subscription_plan,
          b.recordings_retention_days
        )
    ) as candidates
    group by candidates.path
  ) as expired
  order by expired.kept_at
  limit least(greatest(coalesce(p_limit, 200), 1), 500);
$$;

create or replace function public.purge_expired_tenant_data()
returns jsonb
language plpgsql
security definer
set search_path = public, storage
as $$
declare
  v_recordings integer := 0;
  v_logs integer := 0;
  v_appointments integer := 0;
  v_usage integer := 0;
begin
  with doomed as (
    select
      r.id,
      r.business_code,
      regexp_replace(r.storage_path, '^.*/([^/]+?)(\.[^./]+)?$', '\1') as external_id
    from public.recordings r
    join public.businesses b on b.business_code = r.business_code
    where r.created_at < now() - public.recording_keep_interval(
      b.subscription_plan,
      b.recordings_retention_days
    )
      and not exists (
        select 1
        from storage.objects o
        where o.bucket_id = 'recordings'
          and o.name = r.storage_path
      )
  ),
  marked as (
    update public.conversation_logs as logs
    set
      purged_recording_at = coalesce(logs.purged_recording_at, now()),
      recording_url = null,
      recording_bytes = null,
      updated_at = now()
    from doomed
    where logs.business_code = doomed.business_code
      and logs.external_id = doomed.external_id
    returning logs.id
  )
  delete from public.recordings as recordings
  using doomed
  where recordings.id = doomed.id;

  get diagnostics v_recordings = row_count;

  delete from public.conversation_logs as logs
  using public.businesses as businesses
  where logs.business_code = businesses.business_code
    and coalesce(logs.started_at, logs.created_at)
      < now() - public.history_keep_interval(businesses.subscription_plan);
  get diagnostics v_logs = row_count;

  delete from public.appointments as appointments
  using public.businesses as businesses
  where appointments.business_code = businesses.business_code
    and appointments.appointment_date < (
      (timezone('Asia/Jerusalem', now()))::date
      - public.history_keep_interval(businesses.subscription_plan)
    )::date;
  get diagnostics v_appointments = row_count;

  delete from public.usage_events as usage_events
  using public.businesses as businesses
  where usage_events.business_code = businesses.business_code
    and usage_events.created_at
      < now() - public.history_keep_interval(businesses.subscription_plan);
  get diagnostics v_usage = row_count;

  return jsonb_build_object(
    'recordings', v_recordings,
    'conversation_logs', v_logs,
    'appointments', v_appointments,
    'usage_events', v_usage
  );
end;
$$;

revoke all on function public.recording_keep_interval(text, integer) from public, anon, authenticated;
revoke all on function public.history_keep_interval(text) from public, anon, authenticated;
revoke all on function public.clamp_business_retention() from public, anon, authenticated;

notify pgrst, 'reload schema';
