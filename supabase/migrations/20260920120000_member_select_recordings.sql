-- Members can read their own business recordings metadata and files.

alter table if exists public.recordings enable row level security;

grant select on table public.recordings to authenticated;

drop policy if exists "Members can view recordings" on public.recordings;
create policy "Members can view recordings"
  on public.recordings
  for select
  to authenticated
  using (private.is_business_member(business_code));

drop policy if exists "Members can read own business recordings" on storage.objects;
create policy "Members can read own business recordings"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'recordings'
    and private.is_business_member(((storage.foldername(name))[1])::uuid)
  );
