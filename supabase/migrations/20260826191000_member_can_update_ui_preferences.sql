revoke update on table public.business_members from anon;

drop policy if exists "Users can update their own ui preferences"
  on public.business_members;
create policy "Users can update their own ui preferences"
  on public.business_members
  for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

revoke update on table public.business_members from authenticated;
grant update (ui_preferences) on table public.business_members
  to authenticated;
