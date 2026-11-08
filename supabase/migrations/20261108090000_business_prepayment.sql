alter table public.businesses
  add column if not exists default_payment_requirement text not null default 'none',
  add column if not exists payment_payee_name text,
  add column if not exists payment_instructions text,
  add column if not exists payment_hold_hours integer not null default 12;

alter table public.businesses
  drop constraint if exists businesses_default_payment_requirement_check,
  drop constraint if exists businesses_payment_hold_hours_check;

alter table public.businesses
  add constraint businesses_default_payment_requirement_check
    check (default_payment_requirement in ('none', 'deposit', 'full')),
  add constraint businesses_payment_hold_hours_check
    check (payment_hold_hours between 1 and 168);

comment on column public.businesses.default_payment_requirement is
  'Prepayment for every client that follows the business: none, deposit (deposit_percent of the price), or full.';
comment on column public.businesses.payment_payee_name is
  'Name that must appear on a prepayment receipt.';
comment on column public.businesses.payment_instructions is
  'How to pay, sent to the customer with the prepayment request.';
comment on column public.businesses.payment_hold_hours is
  'Hours an unpaid prepayment hold keeps the slot before it is canceled.';
comment on column public.businesses.deposit_percent is
  'Percent of the appointment price charged when the effective payment requirement is deposit. 0-100.';

alter table public.clients
  alter column payment_requirement set default 'inherit';

alter table public.clients
  drop constraint if exists clients_payment_requirement_check;

update public.clients
   set payment_requirement = 'inherit'
 where payment_requirement = 'none';

alter table public.clients
  add constraint clients_payment_requirement_check
    check (payment_requirement in ('inherit', 'none', 'deposit', 'full'));

comment on column public.clients.payment_requirement is
  'inherit follows businesses.default_payment_requirement; none, deposit and full override it for this client.';

grant update (
  default_payment_requirement, payment_payee_name, payment_instructions, payment_hold_hours
) on public.businesses to authenticated;

notify pgrst, 'reload schema';
