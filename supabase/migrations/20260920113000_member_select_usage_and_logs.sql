-- Dashboard members can read their own business usage and conversation logs.
-- Writes stay with the service role / backend.

alter table if exists public.billing_accounts enable row level security;
alter table if exists public.usage_events enable row level security;
alter table if exists public.usage_prices enable row level security;
alter table if exists public.conversation_logs enable row level security;

grant select on table public.billing_accounts to authenticated;
grant select on table public.usage_events to authenticated;
grant select on table public.usage_prices to authenticated;
grant select on table public.conversation_logs to authenticated;

drop policy if exists "Members can view billing accounts" on public.billing_accounts;
create policy "Members can view billing accounts"
  on public.billing_accounts
  for select
  to authenticated
  using (private.is_business_member(business_code));

drop policy if exists "Members can view usage events" on public.usage_events;
create policy "Members can view usage events"
  on public.usage_events
  for select
  to authenticated
  using (private.is_business_member(business_code));

drop policy if exists "Authenticated can view usage prices" on public.usage_prices;
create policy "Authenticated can view usage prices"
  on public.usage_prices
  for select
  to authenticated
  using (true);

drop policy if exists "Members can view conversation logs" on public.conversation_logs;
create policy "Members can view conversation logs"
  on public.conversation_logs
  for select
  to authenticated
  using (private.is_business_member(business_code));
