-- Separate from businesses.is_active.
-- exempt: tests keep working with no card. Both agents stay on.
-- auto: card expiry stops the voice agent and the WhatsApp agent, then locks the dashboard after 7 days.
-- blocked: manual lock. Both agents must stop and the dashboard is locked.

alter table public.businesses
  add column if not exists billing_hold text not null default 'exempt';

alter table public.businesses
  drop constraint if exists businesses_billing_hold_chk;

alter table public.businesses
  add constraint businesses_billing_hold_chk
    check (billing_hold in ('exempt', 'auto', 'blocked'));

comment on column public.businesses.billing_hold is
  'exempt = exception, agents on. auto = follow card expiry. blocked = force both agents off and lock this business.';

create or replace function public.business_agents_allowed(p_business_code uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  hold text;
  card_exp text;
  zone text := 'Asia/Jerusalem';
  today date;
  invalid_on date;
  month_num int;
  year_num int;
  digits text;
begin
  select businesses.billing_hold
    into hold
  from public.businesses
  where businesses.business_code = p_business_code;

  if hold is null or hold = 'exempt' then
    return true;
  end if;

  if hold = 'blocked' then
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

revoke all on function public.business_agents_allowed(uuid) from public;
grant execute on function public.business_agents_allowed(uuid) to authenticated, service_role;
