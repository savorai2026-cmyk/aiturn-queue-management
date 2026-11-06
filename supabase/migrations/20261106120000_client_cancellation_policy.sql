alter table public.clients
  add column if not exists cancellation_policy jsonb;

comment on column public.clients.cancellation_policy is
  'Optional override of businesses.cancellation_policy. Null follows the business rule.';

grant update (cancellation_policy) on public.clients to authenticated;
