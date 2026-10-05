import { supabase } from '../../supabaseClient';
import { USAGE_EVENT_LIMIT } from './usage.mappers';
import type {
  UsageEvent,
  UsageOverview,
  UsagePrice,
} from './usage.types';

interface UsageEventRow {
  id: string;
  business_code: string;
  action: string;
  quantity: number;
  unit: string;
  amount_credits: number;
  meta: UsageEvent['meta'];
  created_at: string;
}

interface BillingAccountRow {
  balance_credits: number;
  currency: string;
  updated_at: string;
}

interface UsagePriceRow {
  action: string;
  unit: string;
  amount_credits: number;
}

function toUsageEvent(row: UsageEventRow): UsageEvent {
  return {
    id: row.id,
    businessCode: row.business_code,
    action: row.action,
    quantity: Number(row.quantity),
    unit: row.unit,
    amountCredits: Number(row.amount_credits),
    meta: row.meta ?? null,
    createdAt: row.created_at,
  };
}

function toUsagePrice(row: UsagePriceRow): UsagePrice {
  return {
    action: row.action,
    unit: row.unit,
    amountCredits: Number(row.amount_credits),
  };
}

export async function getUsageOverview(
  businessCode: string,
): Promise<UsageOverview> {
  const [accountResult, eventsResult, pricesResult] = await Promise.all([
    supabase
      .from('billing_accounts')
      .select('balance_credits, currency, updated_at')
      .eq('business_code', businessCode)
      .maybeSingle(),
    supabase
      .from('usage_events')
      .select(
        'id, business_code, action, quantity, unit, amount_credits, meta, created_at',
      )
      .eq('business_code', businessCode)
      .order('created_at', { ascending: false })
      .limit(USAGE_EVENT_LIMIT),
    supabase
      .from('usage_prices')
      .select('action, unit, amount_credits'),
  ]);

  if (accountResult.error) {
    throw new Error(accountResult.error.message);
  }

  if (eventsResult.error) {
    throw new Error(eventsResult.error.message);
  }

  const accountRow = accountResult.data as BillingAccountRow | null;
  const eventRows = (eventsResult.data ?? []) as UsageEventRow[];
  const priceRows = pricesResult.error
    ? []
    : ((pricesResult.data ?? []) as UsagePriceRow[]);

  return {
    account: accountRow
      ? {
          balanceCredits: Number(accountRow.balance_credits),
          currency: accountRow.currency,
          updatedAt: accountRow.updated_at,
        }
      : null,
    events: eventRows.map(toUsageEvent),
    prices: priceRows.map(toUsagePrice),
    truncated: eventRows.length >= USAGE_EVENT_LIMIT,
  };
}
