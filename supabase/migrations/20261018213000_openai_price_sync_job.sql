create table if not exists public.openai_price_sync_requests (
  request_id bigint primary key,
  created_at timestamptz not null default now()
);

alter table public.openai_price_sync_requests enable row level security;
revoke all on table public.openai_price_sync_requests from public, anon, authenticated;

create or replace function public.openai_standard_rates(p_markdown text, p_model text)
returns jsonb
language plpgsql
immutable
as $$
declare
  v_line text;
  v_title text;
  v_in_standard boolean := false;
  v_header boolean := false;
  v_cells text[];
  v_prices text[] := '{}';
  v_index integer;
  v_match text[];
begin
  if p_markdown is null or btrim(coalesce(p_model, '')) = '' then
    raise exception 'missing pricing page';
  end if;

  for v_line in
    select regexp_replace(piece, E'\r$', '')
    from regexp_split_to_table(p_markdown, E'\n') as piece
  loop
    v_title := lower(btrim(regexp_replace(v_line, '^#{1,6}\s+', '')));
    if v_title = 'standard' or v_title like 'standard %' then
      v_in_standard := true;
    elsif v_in_standard and (
      v_title = 'batch' or v_title like 'batch %'
      or v_title = 'flex' or v_title like 'flex %'
      or v_title = 'priority' or v_title like 'priority %'
    ) then
      exit;
    end if;

    if not v_in_standard or left(btrim(v_line), 1) <> '|' then
      continue;
    end if;

    select coalesce(array_agg(btrim(part.cell) order by part.ord), '{}')
    into v_cells
    from unnest(string_to_array(trim(both '|' from btrim(v_line)), '|')) with ordinality as part(cell, ord);

    if coalesce(cardinality(v_cells), 0) = 0 then
      continue;
    end if;

    if (
      select bool_and(cell ~ '^:?-+:?$')
      from unnest(v_cells) as cell
    ) then
      continue;
    end if;

    if lower(v_cells[1]) = 'model' then
      v_header := true;
      continue;
    end if;

    if not v_header or v_cells[1] is distinct from btrim(p_model) then
      continue;
    end if;

    if coalesce(cardinality(v_cells), 0) < 9 then
      raise exception 'rate row is short';
    end if;

    v_prices := '{}';
    for v_index in 2..9 loop
      if v_cells[v_index] in ('-', '—') then
        raise exception '% is missing a standard token price', btrim(p_model);
      end if;
      v_match := regexp_match(v_cells[v_index], '^\$([0-9]+(\.[0-9]+)?)$');
      if v_match is null then
        raise exception 'unrecognized price cell';
      end if;
      v_prices := v_prices || v_match[1];
    end loop;

    return jsonb_build_object(
      'input', v_prices[1],
      'cached_input', v_prices[2],
      'cache_write', v_prices[3],
      'output', v_prices[4],
      'long_input', v_prices[5],
      'long_cached_input', v_prices[6],
      'long_cache_write', v_prices[7],
      'long_output', v_prices[8]
    );
  end loop;

  raise exception '% was not found in the standard price table', btrim(p_model);
end;
$$;

create or replace function public.finish_openai_price_sync()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_model text;
  v_rates jsonb;
  rec record;
begin
  delete from public.openai_price_sync_requests
  where created_at < now() - interval '6 hours';

  select coalesce(nullif(btrim(price_model), ''), 'gpt-6-luna')
  into v_model
  from public.usage_prices
  where action = 'openai_tokens';

  for rec in
    select queued.request_id, response.status_code, response.content, response.error_msg, response.timed_out
    from public.openai_price_sync_requests as queued
    join net._http_response as response on response.id = queued.request_id
  loop
    if rec.status_code is distinct from 200
      or rec.content is null
      or coalesce(rec.timed_out, false)
      or nullif(rec.error_msg, '') is not null
    then
      raise exception 'OpenAI pricing page was not available';
    end if;

    v_rates := public.openai_standard_rates(rec.content, v_model);
    perform public.apply_openai_price_card(
      v_model,
      v_rates->>'input',
      v_rates->>'cached_input',
      v_rates->>'cache_write',
      v_rates->>'output',
      v_rates->>'long_input',
      v_rates->>'long_cached_input',
      v_rates->>'long_cache_write',
      v_rates->>'long_output',
      'https://developers.openai.com/api/docs/pricing.md'
    );

    delete from public.openai_price_sync_requests
    where request_id = rec.request_id;
  end loop;
end;
$$;

create or replace function public.run_openai_price_sync()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.finish_openai_price_sync();

  if exists (
    select 1
    from public.openai_price_sync_requests
    where created_at > now() - interval '6 hours'
  ) then
    return;
  end if;

  if exists (
    select 1
    from public.usage_prices
    where action = 'openai_tokens'
      and price_source = 'https://developers.openai.com/api/docs/pricing.md'
      and price_checked_at > now() - interval '6 days'
  ) then
    return;
  end if;

  insert into public.openai_price_sync_requests (request_id)
  values (
    net.http_get(
      'https://developers.openai.com/api/docs/pricing.md',
      '{}'::jsonb,
      jsonb_build_object('Accept', 'text/plain'),
      20000
    )
  );
end;
$$;

revoke all on function public.openai_standard_rates(text, text) from public, anon, authenticated;
revoke all on function public.finish_openai_price_sync() from public, anon, authenticated;
revoke all on function public.run_openai_price_sync() from public, anon, authenticated;

do $$
declare
  v_rates jsonb;
begin
  v_rates := public.openai_standard_rates(
    E'Standard\n\n### Standard pricing data\n\n| Model | Short context input | Short context cached input | Short context cache writes | Short context output | Long context input | Long context cached input | Long context cache writes | Long context output |\n| --- | --- | --- | --- | --- | --- | --- | --- | --- |\n| gpt-6-luna | $0.10 | $0.01 | $0.125 | $0.50 | $0.20 | $0.02 | $0.25 | $0.75 |\n\nBatch\n\n### Batch pricing data\n\n| Model | Short context input | Short context cached input | Short context cache writes | Short context output | Long context input | Long context cached input | Long context cache writes | Long context output |\n| --- | --- | --- | --- | --- | --- | --- | --- | --- |\n| gpt-6-luna | $0.05 | $0.005 | $0.0625 | $0.25 | $0.10 | $0.01 | $0.125 | $0.375 |\n',
    'gpt-6-luna'
  );
  if v_rates->>'input' is distinct from '0.10'
    or v_rates->>'output' is distinct from '0.50'
    or v_rates->>'cache_write' is distinct from '0.125'
    or v_rates->>'long_output' is distinct from '0.75'
  then
    raise exception 'openai price parser failed';
  end if;
end $$;

do $$
declare
  v_job bigint;
begin
  select job.jobid
  into v_job
  from cron.job as job
  where job.jobname = 'sync-openai-prices';

  if v_job is not null then
    perform cron.unschedule(v_job);
  end if;
end $$;

select cron.schedule(
  'sync-openai-prices',
  '20 * * * *',
  $$select public.run_openai_price_sync();$$
);
