alter table public.business_members
  add column if not exists ui_preferences jsonb not null default '{}'::jsonb;

comment on column public.business_members.ui_preferences is
  'Per-member UI preferences for this business. Example: {"clients":{"visibleColumns":["full_name","mobile_phone"]}}';
