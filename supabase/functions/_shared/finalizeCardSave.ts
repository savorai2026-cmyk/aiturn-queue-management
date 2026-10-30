import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { postJson } from './billingHttp.ts';
import {
  MAX_PROVIDER,
  SESSION_STATUS_URL,
  interpretSessionStatus,
} from './maxBilling.ts';

export interface FinalizeResult {
  state: 'saved' | 'pending' | 'failed' | 'canceled' | 'ignored';
  errorText: string | null;
  retry: boolean;
}

export async function finalizeCardSave(
  admin: SupabaseClient,
  input: {
    uniqueId: string;
    key: string;
    postedBody?: Record<string, unknown> | null;
    terminal?: 'failure' | 'cancel' | null;
  },
): Promise<FinalizeResult> {
  const { data: session, error: sessionError } = await admin
    .from('billing_sessions')
    .select('id, business_code, uniqueid, status, provider_session_id, error_text')
    .eq('uniqueid', input.uniqueId)
    .maybeSingle();

  if (sessionError || !session) {
    return { state: 'ignored', errorText: null, retry: false };
  }

  if (session.status === 'succeeded') {
    return { state: 'saved', errorText: null, retry: false };
  }

  const providerSessionId =
    typeof session.provider_session_id === 'string'
      ? session.provider_session_id.trim()
      : '';
  if (!providerSessionId) {
    return { state: 'pending', errorText: null, retry: true };
  }

  let statusBody: unknown = null;
  try {
    const response = await postJson(SESSION_STATUS_URL, {
      Key: input.key,
      SessionId: providerSessionId,
    });
    statusBody = response.body;
  } catch {
    statusBody = null;
  }

  const interpretation = interpretSessionStatus({
    statusBody,
    postedBody: input.postedBody ?? null,
    uniqueId: input.uniqueId,
    providerSessionId,
  });

  if (interpretation.action === 'save') {
    const saved = await persistToken(admin, session, interpretation);
    if (saved) return { state: 'saved', errorText: null, retry: false };
    return { state: 'pending', errorText: null, retry: true };
  }

  if (interpretation.action === 'ignore') {
    return { state: 'ignored', errorText: null, retry: false };
  }

  const declineText =
    interpretation.action === 'decline' ? interpretation.errorText : null;
  if (declineText && session.status === 'pending') {
    await admin
      .from('billing_sessions')
      .update({ error_text: declineText })
      .eq('id', session.id)
      .eq('status', 'pending');
  }

  if (input.terminal === 'cancel' && session.status === 'pending') {
    await admin
      .from('billing_sessions')
      .update({
        status: 'canceled',
        error_text: 'השמירה בוטלה.',
        completed_at: new Date().toISOString(),
      })
      .eq('id', session.id)
      .eq('status', 'pending');
    return { state: 'canceled', errorText: 'השמירה בוטלה.', retry: false };
  }

  if (input.terminal === 'failure' && session.status === 'pending') {
    const errorText =
      declineText ||
      (typeof session.error_text === 'string' ? session.error_text : '') ||
      'השמירה לא הושלמה.';
    await admin
      .from('billing_sessions')
      .update({
        status: 'failed',
        error_text: errorText,
        completed_at: new Date().toISOString(),
      })
      .eq('id', session.id)
      .eq('status', 'pending');
    return { state: 'failed', errorText, retry: false };
  }

  if (interpretation.action === 'decline') {
    return { state: 'pending', errorText: declineText, retry: false };
  }

  return { state: 'pending', errorText: null, retry: true };
}

async function persistToken(
  admin: SupabaseClient,
  session: { id: string; business_code: string },
  decision: {
    token: string;
    last4: string | null;
    expiry: string | null;
    referenceNumber: string | null;
  },
) {
  const now = new Date().toISOString();
  const { data: method, error: methodError } = await admin
    .from('payment_methods')
    .insert({
      business_code: session.business_code,
      provider: MAX_PROVIDER,
      status: 'active',
      cg_card_id: decision.token,
      cg_card_last4: decision.last4,
      cg_card_exp: decision.expiry,
      provider_reference: decision.referenceNumber,
      created_at: now,
      updated_at: now,
      tokenized_at: now,
    })
    .select('id')
    .single();

  if (methodError || !method) return false;

  const { data: locked, error: lockError } = await admin
    .from('billing_sessions')
    .update({
      status: 'succeeded',
      payment_method_id: method.id,
      error_text: null,
      completed_at: now,
    })
    .eq('id', session.id)
    .in('status', ['pending', 'failed'])
    .select('id');

  if (lockError || !locked?.length) {
    await admin
      .from('payment_methods')
      .update({ status: 'revoked', updated_at: now })
      .eq('id', method.id);
    if (lockError) return false;
    return sessionAlreadySaved(admin, session.id);
  }

  await admin
    .from('payment_methods')
    .update({ status: 'revoked', updated_at: now })
    .eq('business_code', session.business_code)
    .eq('status', 'active')
    .neq('id', method.id);

  return true;
}

async function sessionAlreadySaved(admin: SupabaseClient, sessionId: string) {
  const { data } = await admin
    .from('billing_sessions')
    .select('status')
    .eq('id', sessionId)
    .maybeSingle();
  return data?.status === 'succeeded';
}
