alter table public.businesses
  drop constraint if exists businesses_storage_quota_gb_chk;

alter table public.businesses
  add constraint businesses_storage_quota_gb_chk
    check (storage_quota_gb >= 5);

comment on column public.businesses.storage_quota_gb is
  'File-storage quota in gibibytes. Minimum 5. Gigabytes above the plan inclusion are billed. No maximum.';
