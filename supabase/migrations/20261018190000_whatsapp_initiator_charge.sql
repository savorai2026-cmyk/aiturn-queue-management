alter table public.usage_events
  add column if not exists initiated_by text;

alter table public.usage_events
  add column if not exists amount_usd numeric;

alter table public.usage_events
  add column if not exists amount_ils numeric;

alter table public.usage_events
  drop constraint if exists usage_events_initiated_by_chk;

alter table public.usage_events
  add constraint usage_events_initiated_by_chk
  check (initiated_by is null or initiated_by in ('customer', 'business'));

alter table public.usage_prices
  add column if not exists effective_from timestamptz;

update public.usage_prices
set effective_from = updated_at
where effective_from is null;

alter table public.usage_prices
  alter column effective_from set default now();

alter table public.usage_prices
  alter column effective_from set not null;

create or replace function public.try_numeric(value text)
returns numeric
language plpgsql
immutable
as $$
begin
  if value is null or btrim(value) = '' then
    return null;
  end if;
  return btrim(value)::numeric;
exception
  when others then
    return null;
end;
$$;

create or replace function public.usage_events_fill_cost()
returns trigger
language plpgsql
as $$
declare
  opener text;
begin
  opener := lower(btrim(coalesce(new.initiated_by, new.meta->>'initiated_by', '')));
  if opener in ('customer', 'business') then
    new.initiated_by := opener;
  else
    new.initiated_by := null;
  end if;

  if new.amount_usd is null then
    new.amount_usd := public.try_numeric(new.meta->>'amount_usd');
  end if;

  if new.amount_ils is null and new.amount_usd is not null then
    new.amount_ils := new.amount_usd * public.try_numeric(new.meta->>'fx_rate');
  end if;

  return new;
end;
$$;

drop trigger if exists usage_events_fill_cost on public.usage_events;

create trigger usage_events_fill_cost
  before insert or update on public.usage_events
  for each row
  execute function public.usage_events_fill_cost();

update public.usage_events
set meta = meta
where meta is not null;

create or replace function public.business_plan_usage(p_business_code uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  business_zone text;
  month_start timestamptz;
  customer_windows integer := 0;
  business_windows integer := 0;
  prev_key text := null;
  window_open timestamptz := null;
  rec record;
begin
  if not private.is_business_member(p_business_code) then
    return jsonb_build_object(
      'member_count', 0,
      'voice_seconds', 0,
      'whatsapp_windows', 0,
      'whatsapp_customer_windows', 0,
      'whatsapp_business_windows', 0
    );
  end if;

  select coalesce(nullif(timezone, ''), 'Asia/Jerusalem')
    into business_zone
  from public.businesses
  where business_code = p_business_code;

  month_start := date_trunc('month', now() at time zone business_zone)
    at time zone business_zone;

  for rec in
    select keyed.phone_key, keyed.started_at, keyed.opener
    from (
      select
        started_at,
        opener,
        case
          when digits = '' then 'missing:' || external_id
          else digits
        end as phone_key
      from (
        select
          external_id,
          started_at,
          opener,
          case
            when raw_digits like '972%' then regexp_replace(substring(raw_digits from 4), '^0', '')
            else regexp_replace(raw_digits, '^0', '')
          end as digits
        from (
          select distinct on (external_id)
            external_id,
            coalesce(started_at, created_at) as started_at,
            case
              when lower(btrim(coalesce(initiated_by, ''))) = 'business' then 'business'
              else 'customer'
            end as opener,
            regexp_replace(coalesce(client_phone, ''), '\D', '', 'g') as raw_digits
          from public.conversation_logs
          where business_code = p_business_code
            and lower(channel) in ('whatsapp', 'wa')
            and coalesce(started_at, created_at) >= month_start - interval '24 hours'
          order by external_id, coalesce(started_at, created_at)
        ) deduped
      ) normalized
    ) keyed
    order by keyed.phone_key, keyed.started_at
  loop
    if prev_key is distinct from rec.phone_key
      or window_open is null
      or rec.started_at >= window_open + interval '24 hours' then
      window_open := rec.started_at;
      prev_key := rec.phone_key;
      if rec.started_at >= month_start then
        if rec.opener = 'business' then
          business_windows := business_windows + 1;
        else
          customer_windows := customer_windows + 1;
        end if;
      end if;
    end if;
  end loop;

  return jsonb_build_object(
    'member_count', (
      select count(*)::int
      from public.business_members
      where business_code = p_business_code
        and status = 'active'
    ),
    'voice_seconds', (
      select coalesce(sum(duration_seconds), 0)
      from public.conversation_logs
      where business_code = p_business_code
        and channel = 'vapi'
        and coalesce(started_at, created_at) >= month_start
    ),
    'whatsapp_windows', customer_windows + business_windows,
    'whatsapp_customer_windows', customer_windows,
    'whatsapp_business_windows', business_windows
  );
end;
$$;
