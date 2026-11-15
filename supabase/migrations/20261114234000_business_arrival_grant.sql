-- Arrival details are edited from business profile. Update on businesses is
-- granted per column, so these columns stay read-only until they are listed.

alter table public.businesses
  add column if not exists arrival_address text,
  add column if not exists arrival_parking text,
  add column if not exists arrival_waze_url text,
  add column if not exists arrival_photo_paths jsonb not null default '[]'::jsonb;

comment on column public.businesses.arrival_address is
  'Street address sent to a client on their first booking.';
comment on column public.businesses.arrival_parking is
  'How to park, sent with the address.';
comment on column public.businesses.arrival_waze_url is
  'Waze directions link built from the address.';
comment on column public.businesses.arrival_photo_paths is
  'Up to three storage paths of the entrance, in bucket business-arrival.';

grant update (
  arrival_address,
  arrival_parking,
  arrival_waze_url,
  arrival_photo_paths
) on public.businesses to authenticated;

insert into storage.buckets (id, name, public, file_size_limit)
values ('business-arrival', 'business-arrival', false, 5242880)
on conflict (id) do nothing;

drop policy if exists business_arrival_member_select on storage.objects;
create policy business_arrival_member_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'business-arrival'
    and split_part(name, '/', 1) in (
      select business_code::text
        from public.business_members
       where user_id = auth.uid()
         and status = 'active'
    )
  );

drop policy if exists business_arrival_member_insert on storage.objects;
create policy business_arrival_member_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'business-arrival'
    and split_part(name, '/', 1) in (
      select business_code::text
        from public.business_members
       where user_id = auth.uid()
         and status = 'active'
    )
  );

drop policy if exists business_arrival_member_update on storage.objects;
create policy business_arrival_member_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'business-arrival'
    and split_part(name, '/', 1) in (
      select business_code::text
        from public.business_members
       where user_id = auth.uid()
         and status = 'active'
    )
  );

drop policy if exists business_arrival_member_delete on storage.objects;
create policy business_arrival_member_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'business-arrival'
    and split_part(name, '/', 1) in (
      select business_code::text
        from public.business_members
       where user_id = auth.uid()
         and status = 'active'
    )
  );

notify pgrst, 'reload schema';
