-- Voice chosen for the business agent. The partner reads this and applies it
-- on the Vapi assistant. Null keeps the assistant's current voice.

alter table public.businesses
  add column if not exists agent_voice_id text;

comment on column public.businesses.agent_voice_id is
  'Cartesia voice id for the voice agent. The partner applies it on the Vapi assistant. Null keeps the assistant default.';

grant update (agent_voice_id) on public.businesses to authenticated;
