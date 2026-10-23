alter table public.usage_prices
  add column if not exists price_model text,
  add column if not exists input_usd_per_million numeric,
  add column if not exists cached_input_usd_per_million numeric,
  add column if not exists cache_write_usd_per_million numeric,
  add column if not exists output_usd_per_million numeric,
  add column if not exists long_input_usd_per_million numeric,
  add column if not exists long_cached_input_usd_per_million numeric,
  add column if not exists long_cache_write_usd_per_million numeric,
  add column if not exists long_output_usd_per_million numeric,
  add column if not exists price_source text,
  add column if not exists price_checked_at timestamptz;

comment on column public.usage_prices.input_usd_per_million is
  'USD per 1M short-context input tokens, OpenAI standard tier.';
comment on column public.usage_prices.output_usd_per_million is
  'USD per 1M short-context output tokens, OpenAI standard tier.';
comment on column public.usage_prices.amount_usd is
  'Legacy single USD rate. For openai_tokens this is the short-context input price per token.';

create or replace function public.openai_tokens_usd(
  p_meta jsonb,
  p_model text,
  p_input numeric,
  p_cached_input numeric,
  p_cache_write numeric,
  p_output numeric,
  p_long_input numeric,
  p_long_cached_input numeric,
  p_long_cache_write numeric,
  p_long_output numeric
)
returns numeric
language plpgsql
immutable
as $$
declare
  event_model text;
  prompt numeric;
  completion numeric;
  cached numeric;
  writes numeric;
  long_context boolean;
  input_rate numeric;
  cached_rate numeric;
  write_rate numeric;
  output_rate numeric;
begin
  if p_meta is null or p_input is null or p_output is null then
    return null;
  end if;

  event_model := nullif(btrim(coalesce(p_meta->>'model', '')), '');
  if event_model is not null and p_model is not null and event_model <> p_model then
    return null;
  end if;

  prompt := public.try_numeric(p_meta->>'prompt_tokens');
  completion := public.try_numeric(p_meta->>'completion_tokens');
  if prompt is null or completion is null or prompt < 0 or completion < 0 then
    return null;
  end if;

  cached := coalesce(
    public.try_numeric(p_meta->>'cached_tokens'),
    public.try_numeric(p_meta->>'cached_input_tokens'),
    0
  );
  writes := coalesce(
    public.try_numeric(p_meta->>'cache_write_tokens'),
    public.try_numeric(p_meta->>'cache_writes'),
    0
  );
  if cached < 0 then
    cached := 0;
  end if;
  if writes < 0 then
    writes := 0;
  end if;
  if cached > prompt then
    cached := prompt;
  end if;

  long_context := lower(btrim(coalesce(p_meta->>'context', ''))) in ('long', 'long_context')
    or lower(btrim(coalesce(p_meta->>'long_context', ''))) in ('true', 't', '1', 'yes');

  if long_context then
    input_rate := p_long_input;
    cached_rate := p_long_cached_input;
    write_rate := p_long_cache_write;
    output_rate := p_long_output;
  else
    input_rate := p_input;
    cached_rate := p_cached_input;
    write_rate := p_cache_write;
    output_rate := p_output;
  end if;

  if input_rate is null or output_rate is null then
    return null;
  end if;
  if cached > 0 and cached_rate is null then
    return null;
  end if;
  if writes > 0 and write_rate is null then
    return null;
  end if;

  return (
    (prompt - cached) * input_rate
    + cached * coalesce(cached_rate, 0)
    + writes * coalesce(write_rate, 0)
    + completion * output_rate
  ) / 1000000;
end;
$$;

create or replace function public.usage_events_fill_cost()
returns trigger
language plpgsql
as $$
declare
  opener text;
  computed numeric;
  fx numeric;
  price public.usage_prices%rowtype;
begin
  opener := lower(btrim(coalesce(new.initiated_by, new.meta->>'initiated_by', '')));
  if opener in ('customer', 'business') then
    new.initiated_by := opener;
  else
    new.initiated_by := null;
  end if;

  if new.action = 'openai_tokens' then
    select *
    into price
    from public.usage_prices
    where action = 'openai_tokens';

    computed := public.openai_tokens_usd(
      new.meta,
      price.price_model,
      price.input_usd_per_million,
      price.cached_input_usd_per_million,
      price.cache_write_usd_per_million,
      price.output_usd_per_million,
      price.long_input_usd_per_million,
      price.long_cached_input_usd_per_million,
      price.long_cache_write_usd_per_million,
      price.long_output_usd_per_million
    );

    if computed is not null then
      new.amount_usd := computed;
      fx := public.try_numeric(new.meta->>'fx_rate');
      if fx is not null then
        new.amount_ils := computed * fx;
      end if;
    elsif new.amount_usd is null then
      new.amount_usd := public.try_numeric(new.meta->>'amount_usd');
    end if;
  elsif new.amount_usd is null then
    new.amount_usd := public.try_numeric(new.meta->>'amount_usd');
  end if;

  if new.amount_ils is null and new.amount_usd is not null then
    new.amount_ils := new.amount_usd * public.try_numeric(new.meta->>'fx_rate');
  end if;

  return new;
end;
$$;

create or replace function public.apply_openai_price_card(
  p_model text,
  p_input text,
  p_cached_input text,
  p_cache_write text,
  p_output text,
  p_long_input text,
  p_long_cached_input text,
  p_long_cache_write text,
  p_long_output text,
  p_source text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_model text := btrim(coalesce(p_model, ''));
  v_input numeric;
  v_cached_input numeric;
  v_cache_write numeric;
  v_output numeric;
  v_long_input numeric;
  v_long_cached_input numeric;
  v_long_cache_write numeric;
  v_long_output numeric;
  v_changed boolean := false;
  v_existing public.usage_prices%rowtype;
begin
  if auth.role() is distinct from 'service_role' and current_user not in ('postgres', 'supabase_admin') then
    raise exception 'not allowed';
  end if;

  if v_model = '' or v_model !~ '^[A-Za-z0-9._-]{1,80}$' then
    raise exception 'invalid model';
  end if;

  if coalesce(p_input, '') !~ '^[0-9]+(\.[0-9]+)?$'
    or coalesce(p_cached_input, '') !~ '^[0-9]+(\.[0-9]+)?$'
    or coalesce(p_cache_write, '') !~ '^[0-9]+(\.[0-9]+)?$'
    or coalesce(p_output, '') !~ '^[0-9]+(\.[0-9]+)?$'
    or coalesce(p_long_input, '') !~ '^[0-9]+(\.[0-9]+)?$'
    or coalesce(p_long_cached_input, '') !~ '^[0-9]+(\.[0-9]+)?$'
    or coalesce(p_long_cache_write, '') !~ '^[0-9]+(\.[0-9]+)?$'
    or coalesce(p_long_output, '') !~ '^[0-9]+(\.[0-9]+)?$'
  then
    raise exception 'invalid price';
  end if;

  v_input := p_input::numeric;
  v_cached_input := p_cached_input::numeric;
  v_cache_write := p_cache_write::numeric;
  v_output := p_output::numeric;
  v_long_input := p_long_input::numeric;
  v_long_cached_input := p_long_cached_input::numeric;
  v_long_cache_write := p_long_cache_write::numeric;
  v_long_output := p_long_output::numeric;

  select *
  into v_existing
  from public.usage_prices
  where action = 'openai_tokens';

  if not found then
    raise exception 'openai_tokens price row is missing';
  end if;

  v_changed := v_existing.price_model is distinct from v_model
    or v_existing.input_usd_per_million is distinct from v_input
    or v_existing.cached_input_usd_per_million is distinct from v_cached_input
    or v_existing.cache_write_usd_per_million is distinct from v_cache_write
    or v_existing.output_usd_per_million is distinct from v_output
    or v_existing.long_input_usd_per_million is distinct from v_long_input
    or v_existing.long_cached_input_usd_per_million is distinct from v_long_cached_input
    or v_existing.long_cache_write_usd_per_million is distinct from v_long_cache_write
    or v_existing.long_output_usd_per_million is distinct from v_long_output;

  update public.usage_prices
  set
    price_model = v_model,
    input_usd_per_million = v_input,
    cached_input_usd_per_million = v_cached_input,
    cache_write_usd_per_million = v_cache_write,
    output_usd_per_million = v_output,
    long_input_usd_per_million = v_long_input,
    long_cached_input_usd_per_million = v_long_cached_input,
    long_cache_write_usd_per_million = v_long_cache_write,
    long_output_usd_per_million = v_long_output,
    amount_usd = v_input / 1000000,
    price_source = nullif(btrim(coalesce(p_source, '')), ''),
    price_checked_at = now(),
    effective_from = case when v_changed then now() else effective_from end,
    updated_at = now()
  where action = 'openai_tokens';

  return jsonb_build_object(
    'model', v_model,
    'changed', coalesce(v_changed, false),
    'checked_at', now()
  );
end;
$$;

revoke all on function public.apply_openai_price_card(text, text, text, text, text, text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.apply_openai_price_card(text, text, text, text, text, text, text, text, text, text)
  to service_role;

update public.usage_prices
set
  price_model = 'gpt-6-luna',
  input_usd_per_million = 0.10,
  cached_input_usd_per_million = 0.01,
  cache_write_usd_per_million = 0.125,
  output_usd_per_million = 0.50,
  long_input_usd_per_million = 0.20,
  long_cached_input_usd_per_million = 0.02,
  long_cache_write_usd_per_million = 0.25,
  long_output_usd_per_million = 0.75,
  amount_usd = 0.10 / 1000000,
  price_source = 'openai-standard',
  price_checked_at = now(),
  effective_from = now(),
  updated_at = now()
where action = 'openai_tokens'
  and (
    price_model is distinct from 'gpt-6-luna'
    or input_usd_per_million is distinct from 0.10
    or cached_input_usd_per_million is distinct from 0.01
    or cache_write_usd_per_million is distinct from 0.125
    or output_usd_per_million is distinct from 0.50
    or long_input_usd_per_million is distinct from 0.20
    or long_cached_input_usd_per_million is distinct from 0.02
    or long_cache_write_usd_per_million is distinct from 0.25
    or long_output_usd_per_million is distinct from 0.75
  );

update public.usage_events
set meta = meta
where action = 'openai_tokens'
  and coalesce(meta->>'model', '') = 'gpt-6-luna';
