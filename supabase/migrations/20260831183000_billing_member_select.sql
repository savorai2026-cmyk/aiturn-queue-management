-- The Flask billing app writes these tables with the service role.
-- The dashboard only needs to read a card summary so it can prompt
-- owners after first login and show the Settings payment tab.

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
) on table public.business_payment_methods to authenticated;

grant select (
  id,
  business_code,
  uniqueid,
  status,
  expires_at,
  created_at,
  completed_at,
  error_text,
  payment_method_id
) on table public.billing_sessions to authenticated;

drop policy if exists "Members can view payment methods" on public.business_payment_methods;
create policy "Members can view payment methods"
  on public.business_payment_methods
  for select
  to authenticated
  using (private.is_business_member(business_code));

drop policy if exists "Members can view billing sessions" on public.billing_sessions;
create policy "Members can view billing sessions"
  on public.billing_sessions
  for select
  to authenticated
  using (private.is_business_member(business_code::uuid));
