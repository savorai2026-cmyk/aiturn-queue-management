revoke truncate, trigger, references on all tables in schema public from anon, authenticated;

-- Security hardening before production.
-- Tables and functions: anon gets nothing, nobody gets TRUNCATE/TRIGGER/REFERENCES.
-- Billing fields on businesses are server-only. A locked or closed account cannot write.
-- conversation_settings mirrors the plan retention, so the partner purge never deletes early.

-- 1. Table privileges

revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;

alter default privileges for role postgres in schema public
  revoke all on tables from anon;
alter default privileges for role postgres in schema public
  revoke truncate, trigger, references on tables from authenticated;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon;

do $$
declare
  t text;
begin
  foreach t in array array[
    'business_blockouts', 'conversation_settings', 'fx_monthly_rates', 'model_token_rates',
    'monthly_bills', 'openai_price_sync_requests', 'outreach_jobs', 'promotion_campaigns',
    'promotion_grants', 'quality_findings', 'quality_prompt_lines', 'quality_proposals',
    'quality_review_state', 'referrals', 'subscription_charges', 'subscription_plans',
    'subscriptions', 'whatsapp_agent_sessions'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format('revoke all on table public.%I from authenticated', t);
    end if;
  end loop;
end;
$$;

-- 2. Function privileges

do $$
declare
  f regprocedure;
begin
  for f in
    select p.oid::regprocedure
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and not exists (
        select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e'
      )
  loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end;
$$;

alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon;

revoke execute on function public.apply_usage_charge(uuid, numeric) from authenticated;

-- 3. Server-side account lock. Mirrors resolveBusinessAccess().dashboardBlocked in cardStanding.ts.

create or replace function private.business_writable(p_business_code uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_hold text;
  v_closed timestamptz;
  v_created timestamptz;
  v_exp text;
  v_today date := (now() at time zone 'Asia/Jerusalem')::date;
  v_digits text;
  v_month int;
  v_year int;
  v_invalid date;
begin
  select b.billing_hold, b.closed_at, b.created_at
    into v_hold, v_closed, v_created
  from public.businesses b
  where b.business_code = p_business_code;

  if not found then
    return false;
  end if;

  if v_closed is not null or v_hold = 'blocked' then
    return false;
  end if;

  if v_hold is distinct from 'auto' then
    return true;
  end if;

  select m.cg_card_exp
    into v_exp
  from public.payment_methods m
  where m.business_code = p_business_code
    and m.status = 'active'
  order by m.updated_at desc
  limit 1;

  if not found then
    return v_today < (coalesce(v_created, now()) at time zone 'Asia/Jerusalem')::date + 7;
  end if;

  v_digits := regexp_replace(coalesce(v_exp, ''), '\D', '', 'g');
  if length(v_digits) < 4 then
    return true;
  end if;

  v_month := substring(v_digits from 1 for 2)::int;
  v_year := 2000 + substring(v_digits from 3 for 2)::int;
  if v_month < 1 or v_month > 12 then
    return true;
  end if;

  v_invalid := make_date(
    case when v_month = 12 then v_year + 1 else v_year end,
    case when v_month = 12 then 1 else v_month + 1 end,
    1
  );

  return v_today < v_invalid + 7;
end;
$$;

revoke all on function private.business_writable(uuid) from public, anon, authenticated;

create or replace function public.business_writes_allowed(p_business_code uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if coalesce(auth.role(), '') in ('anon', 'authenticated')
    and not private.is_business_member(p_business_code) then
    return false;
  end if;
  return private.business_writable(p_business_code);
end;
$$;

revoke all on function public.business_writes_allowed(uuid) from public, anon;
grant execute on function public.business_writes_allowed(uuid) to authenticated, service_role;

create or replace function private.enforce_business_writable()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code uuid;
begin
  if tg_op = 'DELETE' then
    v_code := old.business_code;
  else
    v_code := new.business_code;
  end if;

  if coalesce(auth.role(), '') = 'authenticated' and not private.business_writable(v_code) then
    raise exception 'המערכת חסומה לעסק הזה. יש לעדכן כרטיס אשראי או לפנות לתמיכה.'
      using errcode = '42501';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function private.enforce_business_writable() from public, anon, authenticated;

do $$
declare
  t text;
begin
  foreach t in array array['appointments', 'appointment_services', 'clients', 'services', 'statuses'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_writable_guard', t);
    execute format(
      'create trigger %I before insert or update or delete on public.%I
         for each row execute function private.enforce_business_writable()',
      t || '_writable_guard', t
    );
  end loop;
end;
$$;

-- 4. businesses: members may only change their own settings

revoke insert, update, delete on public.businesses from authenticated;
grant update (
  business_name, contact_phone, email, agent_phone_number,
  timezone, slot_duration_minutes, deposit_percent, agent_prompt,
  save_recordings, recordings_retention_days, history_retention_months,
  voice_log_retention_months, whatsapp_retention_months,
  subscription_plan, storage_quota_gb, is_active,
  working_hours, max_adv_booking_days, ui_preferences,
  outreach_call_start, outreach_call_end, reminder_offsets_hours,
  owner_alert_channel, owner_alert_phone, owner_alert_lead_hours
) on public.businesses to authenticated;

create or replace function private.guard_business_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(auth.role(), '') <> 'authenticated'
    or coalesce(current_setting('app.closing_business', true), '') = 'on' then
    return new;
  end if;

  if old.closed_at is not null then
    raise exception 'החשבון נסגר ולא ניתן לשנות אותו.' using errcode = '42501';
  end if;

  if not private.business_writable(old.business_code) then
    raise exception 'המערכת חסומה לעסק הזה. יש לעדכן כרטיס אשראי או לפנות לתמיכה.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function private.guard_business_update() from public, anon, authenticated;

drop trigger if exists businesses_member_guard on public.businesses;
create trigger businesses_member_guard
  before update on public.businesses
  for each row execute function private.guard_business_update();

create or replace function public.close_business_account(p_business_code uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  if not private.has_business_role(p_business_code, array['owner']) then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  perform set_config('app.closing_business', 'on', true);

  update public.businesses
  set
    closed_at = coalesce(closed_at, now()),
    is_active = false,
    updated_at = now()
  where business_code = p_business_code;
end;
$$;

revoke all on function public.close_business_account(uuid) from public, anon;
grant execute on function public.close_business_account(uuid) to authenticated, service_role;

-- 5. One phone number per business. The partner drops ambiguous numbers from call routing.

create or replace function private.normalize_il_phone(p_phone text)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(
    case
      when d like '972%' then d
      when d like '0%' then '972' || substring(d from 2)
      when length(d) = 9 then '972' || d
      else d
    end,
    ''
  )
  from (select regexp_replace(coalesce(p_phone, ''), '\D', '', 'g') as d) s;
$$;

create or replace function private.guard_business_phones()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_phone text;
begin
  foreach v_phone in array array[
    case when tg_op = 'INSERT' or new.contact_phone is distinct from old.contact_phone
      then private.normalize_il_phone(new.contact_phone) end,
    case when tg_op = 'INSERT' or new.agent_phone_number is distinct from old.agent_phone_number
      then private.normalize_il_phone(new.agent_phone_number) end
  ] loop
    continue when v_phone is null;
    if exists (
      select 1
      from public.businesses b
      where b.business_code <> new.business_code
        and (
          private.normalize_il_phone(b.contact_phone) = v_phone
          or private.normalize_il_phone(b.agent_phone_number) = v_phone
        )
    ) then
      raise exception 'מספר הטלפון כבר משויך לעסק אחר.' using errcode = '23505';
    end if;
  end loop;
  return new;
end;
$$;

revoke all on function private.guard_business_phones() from public, anon, authenticated;

drop trigger if exists businesses_phone_guard on public.businesses;
create trigger businesses_phone_guard
  before insert or update of contact_phone, agent_phone_number on public.businesses
  for each row execute function private.guard_business_phones();

-- 6. business_agents_allowed: members only

create or replace function public.business_agents_allowed(p_business_code uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  hold text;
  active boolean;
  closed_at timestamptz;
  card_exp text;
  zone text := 'Asia/Jerusalem';
  today date;
  invalid_on date;
  month_num int;
  year_num int;
  digits text;
begin
  if coalesce(auth.role(), '') in ('anon', 'authenticated')
    and not private.is_business_member(p_business_code) then
    return false;
  end if;

  select businesses.billing_hold, businesses.is_active is not false, businesses.closed_at
    into hold, active, closed_at
  from public.businesses
  where businesses.business_code = p_business_code;

  if not found or closed_at is not null or active is not true then
    return false;
  end if;

  if hold is null or hold = 'exempt' then
    return true;
  end if;

  if hold = 'blocked' or hold = 'agents' then
    return false;
  end if;

  select methods.cg_card_exp
    into card_exp
  from public.payment_methods as methods
  where methods.business_code = p_business_code
    and methods.status = 'active'
  order by methods.updated_at desc
  limit 1;

  today := (now() at time zone zone)::date;

  if card_exp is null then
    return false;
  end if;

  digits := regexp_replace(card_exp, '\D', '', 'g');
  if length(digits) < 4 then
    return true;
  end if;

  month_num := substring(digits from 1 for 2)::int;
  year_num := 2000 + substring(digits from 3 for 2)::int;
  if month_num < 1 or month_num > 12 then
    return true;
  end if;

  invalid_on := make_date(
    case when month_num = 12 then year_num + 1 else year_num end,
    case when month_num = 12 then 1 else month_num + 1 end,
    1
  );

  return today < invalid_on;
end;
$$;

revoke all on function public.business_agents_allowed(uuid) from public, anon;
grant execute on function public.business_agents_allowed(uuid) to authenticated, service_role;

-- 7. conversation_settings follows the plan retention on businesses

alter table public.conversation_settings
  drop constraint if exists conversation_settings_detail_retention_months_check,
  drop constraint if exists conversation_settings_metrics_retention_months_check,
  drop constraint if exists conversation_settings_recording_retention_months_check;

do $$
declare
  c record;
begin
  for c in
    select conname
    from pg_constraint
    where conrelid = 'public.conversation_settings'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ~ '<= 60'
  loop
    execute format('alter table public.conversation_settings drop constraint %I', c.conname);
  end loop;
end;
$$;

alter table public.conversation_settings
  add constraint conversation_settings_detail_retention_months_check
    check (detail_retention_months between 1 and 96),
  add constraint conversation_settings_metrics_retention_months_check
    check (metrics_retention_months between 1 and 96),
  add constraint conversation_settings_recording_retention_months_check
    check (recording_retention_months between 1 and 96);

create or replace function private.sync_conversation_settings()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_months smallint := greatest(new.voice_log_retention_months, new.whatsapp_retention_months, 1);
  v_recording smallint := least(96, greatest(1, ceil(coalesce(new.recordings_retention_days, 30) / 30.0)))::smallint;
begin
  insert into public.conversation_settings (
    business_code,
    detail_retention_months,
    recording_retention_months,
    metrics_retention_months
  )
  values (new.business_code, v_months, v_recording, v_months)
  on conflict (business_code) do update
  set
    detail_retention_months = excluded.detail_retention_months,
    recording_retention_months = excluded.recording_retention_months,
    metrics_retention_months = excluded.metrics_retention_months,
    updated_at = now();
  return new;
end;
$$;

revoke all on function private.sync_conversation_settings() from public, anon, authenticated;

drop trigger if exists businesses_sync_conversation_settings on public.businesses;
create trigger businesses_sync_conversation_settings
  after insert or update of
    subscription_plan,
    recordings_retention_days,
    voice_log_retention_months,
    whatsapp_retention_months
  on public.businesses
  for each row execute function private.sync_conversation_settings();

insert into public.conversation_settings (
  business_code,
  detail_retention_months,
  recording_retention_months,
  metrics_retention_months
)
select
  b.business_code,
  greatest(b.voice_log_retention_months, b.whatsapp_retention_months, 1),
  least(96, greatest(1, ceil(coalesce(b.recordings_retention_days, 30) / 30.0)))::smallint,
  greatest(b.voice_log_retention_months, b.whatsapp_retention_months, 1)
from public.businesses b
on conflict (business_code) do update
set
  detail_retention_months = excluded.detail_retention_months,
  recording_retention_months = excluded.recording_retention_months,
  metrics_retention_months = excluded.metrics_retention_months,
  updated_at = now();

-- 8. Usage events: one row per provider event once the partner sends a key

alter table public.usage_events
  add column if not exists idempotency_key text;

create unique index if not exists usage_events_idempotency_key_uidx
  on public.usage_events (business_code, action, idempotency_key)
  where idempotency_key is not null;

comment on column public.usage_events.idempotency_key is
  'Provider event id (message id, call id). Duplicate deliveries are rejected.';

-- 9. Audit log for permissions, settings and billing

create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  actor_id uuid,
  actor_role text,
  business_code uuid,
  table_name text not null,
  action text not null,
  row_key text,
  changes jsonb not null default '{}'::jsonb
);

create index if not exists audit_log_business_created_idx
  on public.audit_log (business_code, created_at desc);

alter table public.audit_log enable row level security;
revoke all on table public.audit_log from anon, authenticated;
grant select on table public.audit_log to authenticated;

drop policy if exists "Owners can read their audit log" on public.audit_log;
create policy "Owners can read their audit log"
  on public.audit_log
  for select
  to authenticated
  using (private.has_business_role(business_code, array['owner']));

create or replace function private.audit_row()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else '{}'::jsonb end;
  v_new jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else '{}'::jsonb end;
  v_row jsonb := case when tg_op = 'DELETE' then v_old else v_new end;
  v_changes jsonb := '{}'::jsonb;
  v_key text;
begin
  for v_key in
    select k from (
      select jsonb_object_keys(v_old) as k
      union
      select jsonb_object_keys(v_new)
    ) keys
  loop
    continue when v_key in ('updated_at', 'created_at', 'ui_preferences', 'status_changed_at', 'price_checked_at')
      or v_key ~ '(token|secret|cvv|pan|card_id|uniqueid|reference)';
    continue when (v_old -> v_key) is not distinct from (v_new -> v_key);
    if v_key in ('agent_prompt', 'working_hours') then
      v_changes := v_changes || jsonb_build_object(v_key, 'changed');
    else
      v_changes := v_changes || jsonb_build_object(
        v_key,
        jsonb_build_object('old', v_old -> v_key, 'new', v_new -> v_key)
      );
    end if;
  end loop;

  if tg_op = 'UPDATE' and v_changes = '{}'::jsonb then
    return new;
  end if;

  insert into public.audit_log (actor_id, actor_role, business_code, table_name, action, row_key, changes)
  values (
    auth.uid(),
    coalesce(auth.role(), session_user::text),
    case when v_row ? 'business_code' then nullif(v_row ->> 'business_code', '')::uuid end,
    tg_table_name,
    lower(tg_op),
    coalesce(v_row ->> 'id', v_row ->> 'action', v_row ->> 'plan_code', v_row ->> 'business_code'),
    v_changes
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function private.audit_row() from public, anon, authenticated;

do $$
declare
  t text;
begin
  foreach t in array array[
    'businesses', 'business_members', 'payment_methods',
    'business_tariff_overrides', 'plan_tariffs', 'usage_prices'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop trigger if exists %I on public.%I', t || '_audit', t);
      execute format(
        'create trigger %I after %s on public.%I for each row execute function private.audit_row()',
        t || '_audit',
        case when t = 'businesses' then 'update' else 'insert or update or delete' end,
        t
      );
    end if;
  end loop;
end;
$$;

-- 10. Operational data that holds customer PII and has no value after a while

create or replace function public.purge_operational_data()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sessions integer := 0;
  v_findings integer := 0;
  v_payloads integer := 0;
begin
  delete from public.whatsapp_agent_sessions
  where coalesce(updated_at, created_at, started_at) < now() - interval '7 days';
  get diagnostics v_sessions = row_count;

  delete from public.quality_findings
  where created_at < now() - interval '90 days';
  get diagnostics v_findings = row_count;

  update public.outreach_jobs
  set payload = '{}'::jsonb
  where status in ('done', 'failed', 'cancelled', 'skipped')
    and updated_at < now() - interval '30 days'
    and payload <> '{}'::jsonb;
  get diagnostics v_payloads = row_count;

  insert into public.audit_log (actor_role, table_name, action, changes)
  values (
    'cron',
    'purge_operational_data',
    'purge',
    jsonb_build_object('sessions', v_sessions, 'findings', v_findings, 'payloads', v_payloads)
  );

  return jsonb_build_object('sessions', v_sessions, 'findings', v_findings, 'payloads', v_payloads);
end;
$$;

revoke all on function public.purge_operational_data() from public, anon, authenticated;
grant execute on function public.purge_operational_data() to service_role;

select cron.unschedule(jobid) from cron.job where jobname = 'purge-operational-data';
select cron.schedule('purge-operational-data', '40 1 * * *', 'select public.purge_operational_data();');

-- 11. model_token_rates follows usage_prices, so the partner and the database use one price

create or replace function private.sync_model_token_rates()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.price_model is null
    or new.input_usd_per_million is null
    or new.output_usd_per_million is null then
    return new;
  end if;

  insert into public.model_token_rates (model, input_usd_per_million, output_usd_per_million, updated_at)
  values (new.price_model, new.input_usd_per_million, new.output_usd_per_million, now())
  on conflict (model) do update
  set
    input_usd_per_million = excluded.input_usd_per_million,
    output_usd_per_million = excluded.output_usd_per_million,
    updated_at = now()
  where public.model_token_rates.input_usd_per_million is distinct from excluded.input_usd_per_million
    or public.model_token_rates.output_usd_per_million is distinct from excluded.output_usd_per_million;

  return new;
end;
$$;

revoke all on function private.sync_model_token_rates() from public, anon, authenticated;

drop trigger if exists usage_prices_sync_model_token_rates on public.usage_prices;
create trigger usage_prices_sync_model_token_rates
  after insert or update of price_model, input_usd_per_million, output_usd_per_million
  on public.usage_prices
  for each row execute function private.sync_model_token_rates();

insert into public.model_token_rates (model, input_usd_per_million, output_usd_per_million, updated_at)
select price_model, input_usd_per_million, output_usd_per_million, now()
from public.usage_prices
where price_model is not null
  and input_usd_per_million is not null
  and output_usd_per_million is not null
on conflict (model) do update
set
  input_usd_per_million = excluded.input_usd_per_million,
  output_usd_per_million = excluded.output_usd_per_million,
  updated_at = now();

notify pgrst, 'reload schema';
