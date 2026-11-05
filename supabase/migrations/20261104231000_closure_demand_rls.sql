-- Customer phones live in this table. Members of the business may read
-- demand; the booking server writes it with the service role.

alter table public.closure_demand enable row level security;

drop policy if exists "Members can view closure demand" on public.closure_demand;

create policy "Members can view closure demand"
  on public.closure_demand
  for select
  to authenticated
  using (private.is_business_member(business_code));
