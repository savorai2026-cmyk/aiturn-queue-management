drop policy if exists "Owners and admins can delete services" on public.services;
drop policy if exists "Authorized members can delete services" on public.services;
create policy "Authorized members can delete services"
  on public.services
  for delete
  to authenticated
  using (
    private.has_business_role(
      business_code,
      array['owner', 'admin', 'staff']
    )
  );

alter table public.appointments
  drop constraint if exists fk_appointment_service;

alter table public.appointments
  add constraint fk_appointment_service
  foreign key (business_code, service_id)
  references public.services (business_code, id)
  on delete set null;

alter table public.appointment_services
  drop constraint if exists appointment_services_business_code_service_id_fkey;

drop policy if exists "Owners and admins can delete statuses" on public.statuses;
drop policy if exists "Authorized members can delete statuses" on public.statuses;
create policy "Authorized members can delete statuses"
  on public.statuses
  for delete
  to authenticated
  using (
    private.has_business_role(
      business_code,
      array['owner', 'admin', 'staff']
    )
  );

