-- Counts active members and voice seconds for the current month.
-- Members can read their own row only, so the count runs as the owner after a membership check.

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
begin
  if not private.is_business_member(p_business_code) then
    return jsonb_build_object('member_count', 0, 'voice_seconds', 0);
  end if;

  select coalesce(nullif(timezone, ''), 'Asia/Jerusalem')
    into business_zone
  from public.businesses
  where business_code = p_business_code;

  month_start := date_trunc('month', now() at time zone business_zone)
    at time zone business_zone;

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
    )
  );
end;
$$;

revoke all on function public.business_plan_usage(uuid) from public;
grant execute on function public.business_plan_usage(uuid) to authenticated;
