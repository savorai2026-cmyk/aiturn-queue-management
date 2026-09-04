-- Per-client booking policy + business-wide deposit percent.
-- Existing clients stay instant / none. Statuses 04 and 05 are open
-- (not closed): greylist approval and waiting for deposit/full payment.

alter table public.clients
  add column if not exists booking_policy text not null default 'instant',
  add column if not exists payment_requirement text not null default 'none';

alter table public.clients
  drop constraint if exists clients_booking_policy_check,
  drop constraint if exists clients_payment_requirement_check;

alter table public.clients
  add constraint clients_booking_policy_check
    check (booking_policy in ('instant', 'approval', 'blocked')),
  add constraint clients_payment_requirement_check
    check (payment_requirement in ('none', 'deposit', 'full'));

comment on column public.clients.booking_policy is
  'instant = book immediately; approval = greylist, wait for staff; blocked = cannot book remotely';
comment on column public.clients.payment_requirement is
  'none = no payment to confirm; deposit = business deposit_percent; full = 100% of appointment total';

alter table public.businesses
  add column if not exists deposit_percent numeric(5, 2) not null default 0;

alter table public.businesses
  drop constraint if exists businesses_deposit_percent_check;

alter table public.businesses
  add constraint businesses_deposit_percent_check
    check (deposit_percent >= 0 and deposit_percent <= 100);

comment on column public.businesses.deposit_percent is
  'Percent of appointment total charged when the client payment_requirement is deposit. 0–100.';

insert into public.statuses (business_code, status_code, status_text, color)
select
  businesses.business_code,
  seeded.status_code,
  seeded.status_text,
  seeded.color
from public.businesses
cross join (
  values
    ('04', 'ממתין לאישור', '#0a527f'),
    ('05', 'ממתין לתשלום', '#14b8a6')
) as seeded(status_code, status_text, color)
on conflict (business_code, status_code) do update
set
  status_text = excluded.status_text,
  color = excluded.color;

create or replace function private.seed_booking_policy_statuses()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  insert into public.statuses (business_code, status_code, status_text, color)
  values
    (new.business_code, '04', 'ממתין לאישור', '#0a527f'),
    (new.business_code, '05', 'ממתין לתשלום', '#14b8a6')
  on conflict (business_code, status_code) do nothing;
  return new;
end;
$function$;

drop trigger if exists seed_booking_policy_statuses on public.businesses;
create trigger seed_booking_policy_statuses
after insert on public.businesses
for each row
execute procedure private.seed_booking_policy_statuses();
