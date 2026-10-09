alter table public.businesses
  add column if not exists closed_at timestamptz;

comment on column public.businesses.closed_at is
  'Set when the owner closes the account. Agents stay off and the dashboard stays locked.';

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
  from public.business_payment_methods as methods
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

  update public.businesses
  set
    closed_at = coalesce(closed_at, now()),
    is_active = false,
    updated_at = now()
  where business_code = p_business_code;
end;
$$;

revoke all on function public.close_business_account(uuid) from public;
grant execute on function public.close_business_account(uuid) to authenticated;

notify pgrst, 'reload schema';
