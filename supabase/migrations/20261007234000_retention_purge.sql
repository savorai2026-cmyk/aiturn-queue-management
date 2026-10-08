-- Daily retention. Recordings follow the business setting, never past seven years.
-- Transcripts, appointments, and usage rows are deleted after seven years.
-- Customer cards, services, staff, and payment methods stay.

alter table public.businesses
  drop constraint if exists businesses_recordings_retention_days_chk;

update public.businesses
set recordings_retention_days = 2555
where recordings_retention_days > 2555;

alter table public.businesses
  add constraint businesses_recordings_retention_days_chk
    check (
      recordings_retention_days >= 1
      and recordings_retention_days <= 2555
    );

comment on column public.businesses.recordings_retention_days is
  'Days to keep call recordings. 1–2555. Seven years is the hard ceiling.';

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
      where r.created_at < now() - least(
        make_interval(days => greatest(b.recordings_retention_days, 1)),
        interval '7 years'
      )
      union all
      select o.name as path, o.created_at as kept_at
      from storage.objects o
      join public.businesses b
        on (storage.foldername(o.name))[1] = b.business_code::text
      where o.bucket_id = 'recordings'
        and o.created_at < now() - least(
          make_interval(days => greatest(b.recordings_retention_days, 1)),
          interval '7 years'
        )
    ) as candidates
    group by candidates.path
  ) as expired
  order by expired.kept_at
  limit least(greatest(coalesce(p_limit, 200), 1), 500);
$$;

create or replace function public.forget_purged_recordings(p_paths text[])
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer := 0;
begin
  if p_paths is null or cardinality(p_paths) = 0 then
    return 0;
  end if;

  with doomed as (
    select
      r.id,
      r.business_code,
      regexp_replace(r.storage_path, '^.*/([^/]+?)(\.[^./]+)?$', '\1') as external_id
    from public.recordings r
    where r.storage_path = any(p_paths)
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

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
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
    where r.created_at < now() - least(
      make_interval(days => greatest(b.recordings_retention_days, 1)),
      interval '7 years'
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

  delete from public.conversation_logs
  where coalesce(started_at, created_at) < now() - interval '7 years';
  get diagnostics v_logs = row_count;

  delete from public.appointments
  where appointment_date < (
    (timezone('Asia/Jerusalem', now()))::date - interval '7 years'
  )::date;
  get diagnostics v_appointments = row_count;

  delete from public.usage_events
  where created_at < now() - interval '7 years';
  get diagnostics v_usage = row_count;

  return jsonb_build_object(
    'recordings', v_recordings,
    'conversation_logs', v_logs,
    'appointments', v_appointments,
    'usage_events', v_usage
  );
end;
$$;

create or replace function public.run_retention_purge()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text;
  v_secret text;
begin
  begin
    select secrets.decrypted_secret
    into v_url
    from vault.decrypted_secrets as secrets
    where secrets.name = 'purge_function_url'
    limit 1;

    select secrets.decrypted_secret
    into v_secret
    from vault.decrypted_secrets as secrets
    where secrets.name = 'purge_secret'
    limit 1;
  exception
    when undefined_table or insufficient_privilege then
      v_url := null;
      v_secret := null;
  end;

  if v_url is not null and v_secret is not null then
    perform net.http_post(
      url := v_url,
      body := '{}'::jsonb,
      params := '{}'::jsonb,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-purge-secret', v_secret
      ),
      timeout_milliseconds := 120000
    );
    return;
  end if;

  perform public.purge_expired_tenant_data();
end;
$$;

revoke all on function public.expired_recording_paths(integer) from public, anon, authenticated;
revoke all on function public.forget_purged_recordings(text[]) from public, anon, authenticated;
revoke all on function public.purge_expired_tenant_data() from public, anon, authenticated;
revoke all on function public.run_retention_purge() from public, anon, authenticated;

grant execute on function public.expired_recording_paths(integer) to service_role;
grant execute on function public.forget_purged_recordings(text[]) to service_role;
grant execute on function public.purge_expired_tenant_data() to service_role;

do $$
declare
  v_job bigint;
begin
  select job.jobid
  into v_job
  from cron.job as job
  where job.jobname = 'purge-expired-tenant-data';

  if v_job is not null then
    perform cron.unschedule(v_job);
  end if;
end $$;

select cron.schedule(
  'purge-expired-tenant-data',
  '20 1 * * *',
  $$select public.run_retention_purge();$$
);
