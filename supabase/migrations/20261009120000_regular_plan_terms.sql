-- Regular plan: voice recordings default to 30 days and stop at 90.
-- Appointment history and voice logs default to 6 months and stop at 2 years.
-- WhatsApp text is a separate clock with the same default and ceiling.
-- Storage quota cannot pass 50 GB. Expanded plans still stop at seven years.

alter table public.businesses
  add column if not exists history_retention_months integer not null default 6;

alter table public.businesses
  add column if not exists whatsapp_retention_months integer not null default 6;

alter table public.businesses
  alter column recordings_retention_days set default 30;

alter table public.businesses
  drop constraint if exists businesses_history_retention_months_chk;

alter table public.businesses
  add constraint businesses_history_retention_months_chk
    check (
      history_retention_months >= 1
      and history_retention_months <= case
        when subscription_plan = 'expanded' then 84
        else 24
      end
    );

alter table public.businesses
  drop constraint if exists businesses_whatsapp_retention_months_chk;

alter table public.businesses
  add constraint businesses_whatsapp_retention_months_chk
    check (
      whatsapp_retention_months >= 1
      and whatsapp_retention_months <= case
        when subscription_plan = 'expanded' then 84
        else 24
      end
    );

alter table public.businesses
  drop constraint if exists businesses_recordings_retention_days_chk;

alter table public.businesses
  add constraint businesses_recordings_retention_days_chk
    check (
      recordings_retention_days >= 1
      and recordings_retention_days <= case
        when subscription_plan = 'expanded' then 2555
        else 90
      end
    );

update public.businesses
set storage_quota_gb = 50
where storage_quota_gb > 50;

alter table public.businesses
  drop constraint if exists businesses_storage_quota_gb_chk;

alter table public.businesses
  add constraint businesses_storage_quota_gb_chk
    check (storage_quota_gb >= 5 and storage_quota_gb <= 50);

comment on column public.businesses.history_retention_months is
  'Months to keep appointments and non-WhatsApp logs. Regular plans: 1–24. Default 6.';

comment on column public.businesses.whatsapp_retention_months is
  'Months to keep WhatsApp transcripts. Separate from other logs. Regular plans: 1–24. Default 6.';

comment on column public.businesses.recordings_retention_days is
  'Days to keep voice recording files. Regular plans: 1–90. Default 30. Voice transcripts use history_retention_months.';

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
  elsif new.subscription_plan <> 'expanded' and new.recordings_retention_days > 90 then
    new.recordings_retention_days := 90;
  end if;

  if new.history_retention_months is null or new.history_retention_months < 1 then
    new.history_retention_months := 6;
  elsif new.subscription_plan = 'expanded' and new.history_retention_months > 84 then
    new.history_retention_months := 84;
  elsif new.subscription_plan <> 'expanded' and new.history_retention_months > 24 then
    new.history_retention_months := 24;
  end if;

  if new.whatsapp_retention_months is null or new.whatsapp_retention_months < 1 then
    new.whatsapp_retention_months := 6;
  elsif new.subscription_plan = 'expanded' and new.whatsapp_retention_months > 84 then
    new.whatsapp_retention_months := 84;
  elsif new.subscription_plan <> 'expanded' and new.whatsapp_retention_months > 24 then
    new.whatsapp_retention_months := 24;
  end if;

  return new;
end;
$$;

create or replace function public.recording_keep_interval(p_plan text, p_days integer)
returns interval
language sql
immutable
as $$
  select least(
    make_interval(days => greatest(coalesce(p_days, 30), 1)),
    case
      when p_plan = 'expanded' then interval '7 years'
      else interval '90 days'
    end
  );
$$;

create or replace function public.history_keep_interval(p_plan text, p_months integer)
returns interval
language sql
immutable
as $$
  select least(
    make_interval(months => greatest(coalesce(p_months, 6), 1)),
    case
      when p_plan = 'expanded' then interval '7 years'
      else interval '2 years'
    end
  );
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
    and coalesce(logs.started_at, logs.created_at) < now() - case
      when logs.channel = 'whatsapp' then public.history_keep_interval(
        businesses.subscription_plan,
        businesses.whatsapp_retention_months
      )
      else public.history_keep_interval(
        businesses.subscription_plan,
        businesses.history_retention_months
      )
    end;
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

revoke all on function public.history_keep_interval(text, integer) from public, anon, authenticated;

notify pgrst, 'reload schema';
