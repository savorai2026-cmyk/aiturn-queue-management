-- Per-business file quota. Five gibibytes are included; extra gigabytes are priced in the app.

alter table public.businesses
  add column if not exists storage_quota_gb integer not null default 5;

alter table public.businesses
  drop constraint if exists businesses_storage_quota_gb_chk;

alter table public.businesses
  add constraint businesses_storage_quota_gb_chk
    check (storage_quota_gb >= 5 and storage_quota_gb <= 1000);

comment on column public.businesses.storage_quota_gb is
  'File-storage quota in gibibytes. Five are included in the subscription.';

create or replace function public.business_storage_used_bytes(p_business_code uuid)
returns bigint
language sql
stable
security invoker
set search_path = public, storage
as $$
  select coalesce(sum((objects.metadata->>'size')::numeric), 0)::bigint
  from storage.objects
  where bucket_id = 'recordings'
    and (storage.foldername(name))[1] = p_business_code::text;
$$;

revoke all on function public.business_storage_used_bytes(uuid) from public;
grant execute on function public.business_storage_used_bytes(uuid) to authenticated;
