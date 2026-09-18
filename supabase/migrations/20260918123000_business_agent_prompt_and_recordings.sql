-- Rename the agent context field and keep recording settings in schema.

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'businesses'
      and column_name = 'agent_description'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'businesses'
      and column_name = 'agent_prompt'
  ) then
    alter table public.businesses
      rename column agent_description to agent_prompt;
  end if;
end $$;

alter table public.businesses
  add column if not exists agent_prompt text;

alter table public.businesses
  add column if not exists save_recordings boolean not null default true;

alter table public.businesses
  add column if not exists recordings_retention_days integer not null default 90;

alter table public.businesses
  drop constraint if exists businesses_recordings_retention_days_chk;

alter table public.businesses
  add constraint businesses_recordings_retention_days_chk
    check (
      recordings_retention_days >= 1
      and recordings_retention_days <= 3650
    );

comment on column public.businesses.agent_prompt is
  'Professional scope for the AI agent: what the business does and does not do. Combined with the services catalog in the agent prompt.';

comment on column public.businesses.save_recordings is
  'When true, inbound WhatsApp audio and Vapi recording URLs are uploaded to Storage.';

comment on column public.businesses.recordings_retention_days is
  'How many days to keep recordings in Storage. 1–3650.';
