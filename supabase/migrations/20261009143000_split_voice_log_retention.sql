-- Appointment history and the voice log are separate clocks.
-- The voice log keeps the transcript and the summary together.
-- WhatsApp correspondence stays on its own clock.

alter table public.businesses
  add column if not exists voice_log_retention_months integer;

update public.businesses
set voice_log_retention_months = history_retention_months
where voice_log_retention_months is null;

alter table public.businesses
  alter column voice_log_retention_months set default 6;

alter table public.businesses
  alter column voice_log_retention_months set not null;

alter table public.businesses
  drop constraint if exists businesses_voice_log_retention_months_chk;

alter table public.businesses
  add constraint businesses_voice_log_retention_months_chk
    check (
      voice_log_retention_months >= 1
      and voice_log_retention_months <= case
        when subscription_plan = 'expanded' then 84
        else 24
      end
    );

comment on column public.businesses.history_retention_months is
  'Months to keep appointments. Regular plans: 1–24. Default 6.';

comment on column public.businesses.voice_log_retention_months is
  'Months to keep a voice log, transcript and summary together. Regular plans: 1–24. Default 6.';

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

  if new.voice_log_retention_months is null or new.voice_log_retention_months < 1 then
    new.voice_log_retention_months := 6;
  elsif new.subscription_plan = 'expanded' and new.voice_log_retention_months > 84 then
    new.voice_log_retention_months := 84;
  elsif new.subscription_plan <> 'expanded' and new.voice_log_retention_months > 24 then
    new.voice_log_retention_months := 24;
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

drop trigger if exists businesses_clamp_retention on public.businesses;

create trigger businesses_clamp_retention
  before insert or update of
    subscription_plan,
    recordings_retention_days,
    history_retention_months,
    voice_log_retention_months,
    whatsapp_retention_months
  on public.businesses
  for each row
  execute function public.clamp_business_retention();

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
        businesses.voice_log_retention_months
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

notify pgrst, 'reload schema';
