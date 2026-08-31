-- Calendar clients already subscribe to postgres_changes. Realtime never
-- emitted those events because the tables were not in supabase_realtime.
-- Replica identity FULL is required so filters on business_code still match
-- UPDATE/DELETE (appointments PK is id only).

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'appointments'
  ) then
    execute 'alter publication supabase_realtime add table public.appointments';
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'appointment_services'
  ) then
    execute 'alter publication supabase_realtime add table public.appointment_services';
  end if;
end $$;

alter table public.appointments replica identity full;
alter table public.appointment_services replica identity full;
