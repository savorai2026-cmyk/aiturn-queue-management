-- Business-facing copy the AI agent can use in its prompt.

alter table public.businesses
  add column if not exists agent_description text;

comment on column public.businesses.agent_description is
  'What the business does, used as context in the AI agent prompt.';
