alter table public.businesses
  add column if not exists ui_preferences jsonb not null default '{}'::jsonb;

comment on column public.businesses.ui_preferences is
  'Per-business UI preferences. Example: {"clients":{"visibleColumns":["full_name","mobile_phone"]}}';
