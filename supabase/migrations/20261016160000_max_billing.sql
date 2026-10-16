alter table public.billing_sessions
  add column if not exists provider_session_id text;

alter table public.billing_sessions
  add column if not exists payment_type text;

alter table public.payment_methods
  add column if not exists provider_reference text;

create table if not exists public.billing_charges (
  id uuid primary key,
  business_code uuid not null references public.businesses (business_code),
  payment_method_id uuid references public.payment_methods (id),
  amount_ils numeric(12, 2) not null,
  status text not null,
  approval_number text,
  reference_number text,
  error_text text,
  created_at timestamptz not null default now(),
  constraint billing_charges_status_chk check (status in ('succeeded', 'failed'))
);

alter table public.billing_charges enable row level security;

drop policy if exists "Members can view billing charges" on public.billing_charges;
create policy "Members can view billing charges"
  on public.billing_charges
  for select
  to authenticated
  using (private.is_business_member(business_code));

grant select (
  id,
  business_code,
  payment_method_id,
  amount_ils,
  status,
  approval_number,
  reference_number,
  error_text,
  created_at
) on table public.billing_charges to authenticated;

grant select (
  id,
  business_code,
  provider,
  status,
  cg_card_last4,
  cg_card_exp,
  created_at,
  updated_at,
  tokenized_at
) on table public.payment_methods to authenticated;

revoke insert, update, delete, truncate, trigger
  on table public.billing_sessions
  from anon, authenticated;

revoke insert, update, delete, truncate, trigger
  on table public.payment_methods
  from anon, authenticated;

drop policy if exists "Members can view billing sessions" on public.billing_sessions;
create policy "Members can view billing sessions"
  on public.billing_sessions
  for select
  to authenticated
  using (
    business_code ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and private.is_business_member(business_code::uuid)
  );

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
