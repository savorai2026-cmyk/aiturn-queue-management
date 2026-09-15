drop policy if exists "Authorized members can delete appointments"
  on public.appointments;
create policy "Authorized members can delete appointments"
  on public.appointments
  for delete
  to authenticated
  using (
    private.has_business_role(
      business_code,
      array['owner', 'admin', 'staff']
    )
  );

drop policy if exists "Authorized members can delete clients"
  on public.clients;
create policy "Authorized members can delete clients"
  on public.clients
  for delete
  to authenticated
  using (
    private.has_business_role(
      business_code,
      array['owner', 'admin', 'staff']
    )
  );

drop policy if exists "Owners and admins can delete services"
  on public.services;
create policy "Owners and admins can delete services"
  on public.services
  for delete
  to authenticated
  using (
    private.has_business_role(
      business_code,
      array['owner', 'admin']
    )
  );
