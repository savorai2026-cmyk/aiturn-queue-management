drop policy if exists "Allow read access to statuses" on public.statuses;

drop policy if exists "Members can view statuses" on public.statuses;
create policy "Members can view statuses"
  on public.statuses
  for select
  to authenticated
  using (private.is_business_member(business_code));

drop policy if exists "Owners and admins can create statuses" on public.statuses;
create policy "Owners and admins can create statuses"
  on public.statuses
  for insert
  to authenticated
  with check (
    private.has_business_role(business_code, array['owner', 'admin'])
  );

drop policy if exists "Owners and admins can update statuses" on public.statuses;
create policy "Owners and admins can update statuses"
  on public.statuses
  for update
  to authenticated
  using (
    private.has_business_role(business_code, array['owner', 'admin'])
  )
  with check (
    private.has_business_role(business_code, array['owner', 'admin'])
  );

drop policy if exists "Owners and admins can delete statuses" on public.statuses;
create policy "Owners and admins can delete statuses"
  on public.statuses
  for delete
  to authenticated
  using (
    private.has_business_role(business_code, array['owner', 'admin'])
  );
