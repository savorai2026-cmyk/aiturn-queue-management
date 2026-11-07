update public.usage_prices
set markup_percent = 0.30,
    updated_at = now()
where action in ('openai_tokens', 'whisper_seconds');

update public.usage_prices
set amount_credits = 0,
    amount_usd = 0,
    updated_at = now()
where action = 'outreach_dispatch';

create or replace function public.usage_events_fill_cost()
returns trigger
language plpgsql
as $$
declare
  opener text;
  computed numeric;
  fx numeric;
  price public.usage_prices%rowtype;
  markup numeric;
begin
  opener := lower(btrim(coalesce(new.initiated_by, new.meta->>'initiated_by', '')));
  if opener in ('customer', 'business') then
    new.initiated_by := opener;
  else
    new.initiated_by := null;
  end if;

  if new.action = 'outreach_dispatch' then
    new.amount_usd := 0;
    new.amount_ils := 0;
    new.amount_credits := 0;
    return new;
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

  if new.action in ('openai_tokens', 'whisper_seconds') and new.amount_ils is not null then
    select markup_percent
    into markup
    from public.usage_prices
    where action = new.action;
    new.amount_credits := round(new.amount_ils * (1 + coalesce(markup, 0)), 4);
  end if;

  return new;
end;
$$;

with priced as (
  select
    e.id,
    e.business_code,
    e.amount_credits as old_credits,
    case
      when e.action = 'outreach_dispatch' then 0
      else round(cost.usd * cost.fx * 1.30, 4)
    end as new_credits,
    case
      when e.action = 'outreach_dispatch' then 0
      else round(cost.usd * cost.fx, 4)
    end as new_ils,
    case
      when e.action = 'outreach_dispatch' then 0
      else cost.usd
    end as new_usd
  from public.usage_events e
  left join public.model_token_rates rates
    on rates.model = nullif(btrim(coalesce(e.meta->>'model', '')), '')
  left join public.usage_prices token_price
    on token_price.action = 'openai_tokens'
  left join public.usage_prices whisper_price
    on whisper_price.action = 'whisper_seconds'
  left join public.fx_monthly_rates fx_row
    on fx_row.billing_month = date_trunc(
      'month',
      e.created_at at time zone 'Asia/Jerusalem'
    )::date
  cross join lateral (
    select
      coalesce(
        e.amount_usd,
        public.try_numeric(e.meta->>'amount_usd'),
        case
          when e.action = 'whisper_seconds' then e.quantity * coalesce(whisper_price.amount_usd, 0.00005)
          when e.action = 'openai_tokens'
            and (
              public.try_numeric(e.meta->>'prompt_tokens') is not null
              or public.try_numeric(e.meta->>'completion_tokens') is not null
            )
          then (
            coalesce(public.try_numeric(e.meta->>'prompt_tokens'), 0)
              * coalesce(rates.input_usd_per_million, token_price.input_usd_per_million, 0.10)
            + coalesce(public.try_numeric(e.meta->>'completion_tokens'), 0)
              * coalesce(rates.output_usd_per_million, token_price.output_usd_per_million, 0.50)
          ) / 1000000
          when e.action = 'openai_tokens'
          then e.quantity * coalesce(token_price.input_usd_per_million, 0.10) / 1000000
          else 0
        end
      ) as usd,
      coalesce(
        public.try_numeric(e.meta->>'fx_rate'),
        fx_row.average_rate,
        3.0334
      ) as fx
  ) cost
  where e.action in ('openai_tokens', 'whisper_seconds', 'outreach_dispatch')
),
updated as (
  update public.usage_events e
  set
    amount_usd = p.new_usd,
    amount_ils = p.new_ils,
    amount_credits = p.new_credits
  from priced p
  where e.id = p.id
    and (
      e.amount_credits is distinct from p.new_credits
      or e.amount_ils is distinct from p.new_ils
      or e.amount_usd is distinct from p.new_usd
    )
  returning e.business_code, p.old_credits, p.new_credits
),
delta as (
  select business_code, sum(new_credits - old_credits) as change
  from updated
  group by business_code
)
update public.billing_accounts a
set
  balance_credits = a.balance_credits - d.change,
  updated_at = now()
from delta d
where a.business_code = d.business_code;

update public.monthly_bills m
set
  usage_amount = round(coalesce(s.usage, 0), 4),
  total = round(coalesce(s.usage, 0) + coalesce(m.subscription_net, 0), 2),
  updated_at = now()
from (
  select
    bill.id,
    sum(e.amount_credits) as usage
  from public.monthly_bills bill
  left join public.usage_events e
    on e.business_code = bill.business_code
   and e.created_at >= bill.period_start
   and e.created_at < bill.period_end
  group by bill.id
) s
where m.id = s.id
  and m.status <> 'paid';
