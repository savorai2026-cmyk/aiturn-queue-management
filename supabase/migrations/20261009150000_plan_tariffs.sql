-- Catalog prices for the two plans, plus an optional per-business override.
-- An override replaces only the fields that are filled. The plan row stays.

create table if not exists public.plan_tariffs (
  plan text primary key check (plan in ('regular', 'expanded')),
  monthly_ils numeric not null,
  included_users integer not null,
  extra_user_ils numeric not null,
  included_storage_gb integer not null,
  extra_storage_gb_ils numeric not null,
  voice_agorot_per_minute numeric not null,
  whatsapp_customer_agorot numeric not null,
  whatsapp_business_agorot numeric not null,
  recording_max_days integer not null,
  history_max_months integer not null,
  correspondence_max_months integer not null,
  updated_at timestamptz not null default now()
);

insert into public.plan_tariffs (
  plan,
  monthly_ils,
  included_users,
  extra_user_ils,
  included_storage_gb,
  extra_storage_gb_ils,
  voice_agorot_per_minute,
  whatsapp_customer_agorot,
  whatsapp_business_agorot,
  recording_max_days,
  history_max_months,
  correspondence_max_months
)
values
  ('regular', 150, 3, 30, 5, 5, 70, 10, 25, 90, 24, 24),
  ('expanded', 250, 5, 40, 7, 3, 70, 10, 25, 2555, 84, 84)
on conflict (plan) do update set
  monthly_ils = excluded.monthly_ils,
  included_users = excluded.included_users,
  extra_user_ils = excluded.extra_user_ils,
  included_storage_gb = excluded.included_storage_gb,
  extra_storage_gb_ils = excluded.extra_storage_gb_ils,
  voice_agorot_per_minute = excluded.voice_agorot_per_minute,
  whatsapp_customer_agorot = excluded.whatsapp_customer_agorot,
  whatsapp_business_agorot = excluded.whatsapp_business_agorot,
  recording_max_days = excluded.recording_max_days,
  history_max_months = excluded.history_max_months,
  correspondence_max_months = excluded.correspondence_max_months,
  updated_at = now();

create table if not exists public.business_tariff_overrides (
  business_code uuid primary key references public.businesses(business_code) on delete cascade,
  monthly_ils numeric,
  included_users integer,
  extra_user_ils numeric,
  included_storage_gb integer,
  extra_storage_gb_ils numeric,
  voice_agorot_per_minute numeric,
  whatsapp_customer_agorot numeric,
  whatsapp_business_agorot numeric,
  recording_max_days integer,
  history_max_months integer,
  correspondence_max_months integer,
  updated_at timestamptz not null default now()
);

alter table public.plan_tariffs enable row level security;
alter table public.business_tariff_overrides enable row level security;

grant select on table public.plan_tariffs to authenticated;
grant select on table public.business_tariff_overrides to authenticated;

drop policy if exists "Authenticated can view plan tariffs" on public.plan_tariffs;
create policy "Authenticated can view plan tariffs"
  on public.plan_tariffs
  for select
  to authenticated
  using (true);

drop policy if exists "Members can view their tariff override" on public.business_tariff_overrides;
create policy "Members can view their tariff override"
  on public.business_tariff_overrides
  for select
  to authenticated
  using (private.is_business_member(business_code));

create or replace function public.recording_keep_interval(p_plan text, p_days integer)
returns interval
language sql
immutable
as $$
  select least(
    make_interval(days => greatest(coalesce(p_days, 30), 1)),
    interval '7 years'
  );
$$;

create or replace function public.history_keep_interval(p_plan text, p_months integer)
returns interval
language sql
immutable
as $$
  select least(
    make_interval(months => greatest(coalesce(p_months, 6), 1)),
    interval '7 years'
  );
$$;

create or replace function public.clamp_business_retention()
returns trigger
language plpgsql
as $$
declare
  max_days integer;
  max_history integer;
  max_correspondence integer;
begin
  if new.subscription_plan is distinct from 'expanded' then
    new.subscription_plan := 'regular';
  end if;

  select
    coalesce(overrides.recording_max_days, tariffs.recording_max_days),
    coalesce(overrides.history_max_months, tariffs.history_max_months),
    coalesce(overrides.correspondence_max_months, tariffs.correspondence_max_months)
  into max_days, max_history, max_correspondence
  from public.plan_tariffs as tariffs
  left join public.business_tariff_overrides as overrides
    on overrides.business_code = new.business_code
  where tariffs.plan = new.subscription_plan;

  max_days := coalesce(max_days, case when new.subscription_plan = 'expanded' then 2555 else 90 end);
  max_history := coalesce(max_history, case when new.subscription_plan = 'expanded' then 84 else 24 end);
  max_correspondence := coalesce(max_correspondence, max_history);

  if new.recordings_retention_days is null or new.recordings_retention_days < 1 then
    new.recordings_retention_days := 30;
  elsif new.recordings_retention_days > max_days then
    new.recordings_retention_days := max_days;
  end if;

  if new.history_retention_months is null or new.history_retention_months < 1 then
    new.history_retention_months := 6;
  elsif new.history_retention_months > max_history then
    new.history_retention_months := max_history;
  end if;

  if new.voice_log_retention_months is null or new.voice_log_retention_months < 1 then
    new.voice_log_retention_months := 6;
  elsif new.voice_log_retention_months > max_correspondence then
    new.voice_log_retention_months := max_correspondence;
  end if;

  if new.whatsapp_retention_months is null or new.whatsapp_retention_months < 1 then
    new.whatsapp_retention_months := 6;
  elsif new.whatsapp_retention_months > max_correspondence then
    new.whatsapp_retention_months := max_correspondence;
  end if;

  return new;
end;
$$;

update public.businesses
set voice_log_retention_months = whatsapp_retention_months
where voice_log_retention_months is distinct from whatsapp_retention_months;

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
    and coalesce(logs.started_at, logs.created_at) < now() - public.history_keep_interval(
      businesses.subscription_plan,
      businesses.whatsapp_retention_months
    );
  get diagnostics v_logs = row_count;

  delete from public.appointments as appointments
  using public.businesses as businesses
  where appointments.business_code = businesses.business_code
    and appointments.appointment_date < (
      (timezone('Asia/Jerusalem', now()))::date
      - public.history_keep_interval(
        businesses.subscription_plan,
        businesses.history_retention_months
      )
    )::date;
  get diagnostics v_appointments = row_count;

  delete from public.usage_events as usage_events
  using public.businesses as businesses
  where usage_events.business_code = businesses.business_code
    and usage_events.created_at < now() - public.history_keep_interval(
      businesses.subscription_plan,
      businesses.history_retention_months
    );
  get diagnostics v_usage = row_count;

  return jsonb_build_object(
    'recordings', v_recordings,
    'conversation_logs', v_logs,
    'appointments', v_appointments,
    'usage_events', v_usage
  );
end;
$$;

notify pgrst, 'reload schema';
