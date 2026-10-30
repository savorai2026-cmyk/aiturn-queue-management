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
  uniqueid?: string;
  error?: string;
}

function isMissingRelationError(error: { code?: string; message?: string } | null) {
  if (!error) {
    return false;
  }

  return (
    error.code === 'PGRST205' ||
    error.code === '42P01' ||
    /could not find the table/i.test(error.message ?? '')
  );
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
    .from('payment_methods')
    .select(PAYMENT_METHOD_COLUMNS)
    .eq('business_code', businessCode)
    .eq('status', 'active')
    .order('updated_at', { ascending: false })
    .limit(1);

  if (error) {
    if (isMissingRelationError(error)) {
      return null;
    }
    throw new Error(error.message);
  }

  const row = (data?.[0] ?? null) as PaymentMethodRow | null;
  return row ? toPaymentMethodSummary(row) : null;
}

export async function getBusinessAccess(
  businessCode: string,
): Promise<{
  createdAt: string | null;
  billingHold: string | null;
  isActive: boolean;
  closed: boolean;
}> {
  const { data, error } = await supabase
    .from('businesses')
    .select('created_at, billing_hold, is_active, closed_at')
    .eq('business_code', businessCode)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return {
    createdAt: data?.created_at ?? null,
    billingHold: data?.billing_hold ?? null,
    isActive: data?.is_active !== false,
    closed: Boolean(data?.closed_at),
  };
}

export async function getLatestBillingSession(
  businessCode: string,
  uniqueId?: string | null,
): Promise<BillingSessionSummary | null> {
  let query = supabase
    .from('billing_sessions')
    .select(BILLING_SESSION_COLUMNS)
    .eq('business_code', businessCode);

  if (uniqueId) {
    query = query.eq('uniqueid', uniqueId);
  } else {
    query = query.order('created_at', { ascending: false });
  }

  const { data, error } = await query.limit(1);

  if (error) {
    throw new Error(error.message);
  }

  const row = (data?.[0] ?? null) as BillingSessionRow | null;
  return row ? toBillingSessionSummary(row) : null;
}

export async function startBillingEnrollment(
  businessCode: string,
  paymentType: 'validate' | 'regular',
) {
  const { data, error } = await supabase.functions.invoke('billing-start', {
    body: { business_code: businessCode, payment_type: paymentType },
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

  return {
    url: body.url,
    uniqueId: typeof body.uniqueid === 'string' ? body.uniqueid : '',
  };
}

export async function syncBillingSession(businessCode: string, uniqueId: string) {
  const { error } = await supabase.functions.invoke('billing-sync', {
    body: { business_code: businessCode, uniqueid: uniqueId },
  });

  if (error) {
    throw new Error(getErrorMessage(error));
  }
}

export async function chargeSavedCard(businessCode: string, amountIls: number) {
  const { data, error } = await supabase.functions.invoke('billing-charge', {
    body: { business_code: businessCode, amount_ils: amountIls },
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

  const body = (data ?? {}) as {
    ok?: boolean;
    error?: string;
    approval_number?: string;
    amount_ils?: number;
  };

  if (!body.ok) {
    throw new Error(body.error || 'מקס דחתה את החיוב.');
  }

  return {
    approvalNumber: body.approval_number ?? '',
    amountIls: body.amount_ils ?? amountIls,
  };
}
