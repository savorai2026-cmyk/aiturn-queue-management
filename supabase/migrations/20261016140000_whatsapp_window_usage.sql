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
  whatsapp_windows integer := 0;
  prev_key text := null;
  window_open timestamptz := null;
  rec record;
begin
  if not private.is_business_member(p_business_code) then
    return jsonb_build_object(
      'member_count', 0,
      'voice_seconds', 0,
      'whatsapp_windows', 0
    );
  end if;

  select coalesce(nullif(timezone, ''), 'Asia/Jerusalem')
    into business_zone
  from public.businesses
  where business_code = p_business_code;

  month_start := date_trunc('month', now() at time zone business_zone)
    at time zone business_zone;

  for rec in
    select keyed.phone_key, keyed.started_at
    from (
      select
        started_at,
        case
          when digits = '' then 'missing:' || external_id
          else digits
        end as phone_key
      from (
        select
          external_id,
          started_at,
          case
            when raw_digits like '972%' then regexp_replace(substring(raw_digits from 4), '^0', '')
            else regexp_replace(raw_digits, '^0', '')
          end as digits
        from (
          select distinct on (external_id)
            external_id,
            coalesce(started_at, created_at) as started_at,
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
        whatsapp_windows := whatsapp_windows + 1;
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
    'whatsapp_windows', whatsapp_windows
  );
end;
$$;
