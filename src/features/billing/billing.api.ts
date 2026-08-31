import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '../../supabaseClient';
import { getErrorMessage } from '../../shared/errors';
import type {
  BillingSessionStatus,
  BillingSessionSummary,
  PaymentMethodStatus,
  PaymentMethodSummary,
} from './billing.types';

const PAYMENT_METHOD_COLUMNS =
  'id, business_code, provider, status, cg_card_last4, cg_card_exp, created_at, updated_at, tokenized_at';

const BILLING_SESSION_COLUMNS =
  'id, uniqueid, status, error_text, expires_at, completed_at, created_at';

interface PaymentMethodRow {
  id: string;
  business_code: string;
  provider: string;
  status: PaymentMethodStatus;
  cg_card_last4: string | null;
  cg_card_exp: string | null;
  created_at: string;
  updated_at: string;
  tokenized_at: string | null;
}

interface BillingSessionRow {
  id: string;
  uniqueid: string;
  status: BillingSessionStatus;
  error_text: string | null;
  expires_at: string;
  completed_at: string | null;
  created_at: string;
}

interface BillingStartBody {
  url?: string;
  error?: string;
}

function toPaymentMethodSummary(row: PaymentMethodRow): PaymentMethodSummary {
  return {
    id: row.id,
    businessCode: row.business_code,
    provider: row.provider,
    status: row.status,
    last4: row.cg_card_last4,
    cardExp: row.cg_card_exp,
    tokenizedAt: row.tokenized_at,
    updatedAt: row.updated_at,
  };
}

function toBillingSessionSummary(row: BillingSessionRow): BillingSessionSummary {
  return {
    id: row.id,
    uniqueid: row.uniqueid,
    status: row.status,
    errorText: row.error_text,
    expiresAt: row.expires_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
  };
}

export async function getActivePaymentMethod(
  businessCode: string,
): Promise<PaymentMethodSummary | null> {
  const { data, error } = await supabase
    .from('business_payment_methods')
    .select(PAYMENT_METHOD_COLUMNS)
    .eq('business_code', businessCode)
    .eq('status', 'active')
    .order('updated_at', { ascending: false })
    .limit(1);

  if (error) {
    throw new Error(error.message);
  }

  const row = (data?.[0] ?? null) as PaymentMethodRow | null;
  return row ? toPaymentMethodSummary(row) : null;
}

export async function getLatestBillingSession(
  businessCode: string,
): Promise<BillingSessionSummary | null> {
  const { data, error } = await supabase
    .from('billing_sessions')
    .select(BILLING_SESSION_COLUMNS)
    .eq('business_code', businessCode)
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) {
    throw new Error(error.message);
  }

  const row = (data?.[0] ?? null) as BillingSessionRow | null;
  return row ? toBillingSessionSummary(row) : null;
}

export async function startBillingEnrollment(businessCode: string) {
  const { data, error } = await supabase.functions.invoke('billing-start', {
    body: { business_code: businessCode },
  });

  if (error) {
    let message = getErrorMessage(error);

    if (error instanceof FunctionsHttpError) {
      try {
        const body = (await error.context.json()) as BillingStartBody;
        message = body.error || message;
      } catch {
        // Keep the original Functions error message.
      }
    }

    throw new Error(message);
  }

  const body = (data ?? {}) as BillingStartBody;
  if (!body.url) {
    throw new Error(body.error || 'לא ניתן לפתוח את דף שמירת הכרטיס.');
  }

  return body.url;
}
