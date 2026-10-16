import { adminClient, jsonResponse, postJson } from '../_shared/billingHttp.ts';
import {
  MAX_PROVIDER,
  SESSION_STATUS_URL,
  asRecord,
  callbackMatchesSession,
  decideCardSave,
  isUuid,
  parseCallbackJson,
  readUniqueId,
} from '../_shared/maxBilling.ts';

Deno.serve(async (request) => {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const url = new URL(request.url);
  let body: Record<string, unknown> = {};
  try {
    const parsed = (await request.json()) as unknown;
    body = asRecord(parsed) ?? {};
  } catch {
    body = {};
  }

  const uniqueId = (url.searchParams.get('uniqueid')?.trim() || readUniqueId(body));
  if (!isUuid(uniqueId)) {
    return jsonResponse({ ok: true, ignored: true });
  }

  const key = Deno.env.get('ZCREDIT_WEBCHECKOUT_KEY')?.trim() ?? '';
  const admin = adminClient();
  if (!key || !admin) {
    return jsonResponse({ error: 'Billing callback is not configured' }, 500);
  }

  const { data: session, error: sessionError } = await admin
    .from('billing_sessions')
    .select('id, business_code, uniqueid, status, provider_session_id')
    .eq('uniqueid', uniqueId)
    .maybeSingle();

  if (sessionError) {
    return jsonResponse({ error: sessionError.message }, 500);
  }

  if (!session) {
    return jsonResponse({ ok: true, ignored: true });
  }

  if (session.status === 'succeeded' || session.status === 'failed' || session.status === 'canceled') {
    return jsonResponse({ ok: true });
  }

  const providerSessionId =
    typeof session.provider_session_id === 'string'
      ? session.provider_session_id.trim()
      : '';
  if (!providerSessionId) {
    return jsonResponse({ error: 'Session is not ready' }, 500);
  }

  let statusBody: Record<string, unknown> | null = null;
  try {
    const response = await postJson(SESSION_STATUS_URL, {
      Key: key,
      SessionId: providerSessionId,
    });
    statusBody = asRecord(response.body);
  } catch {
    return jsonResponse({ error: 'Status check failed' }, 500);
  }

  if (!statusBody || statusBody.HasError === true) {
    return jsonResponse({ error: 'Status check failed' }, 500);
  }

  const callback = parseCallbackJson(statusBody.CallBackJSON);
  if (
    !callbackMatchesSession({
      callback,
      uniqueId,
      providerSessionId,
    })
  ) {
    await finish(admin, session.id, {
      status: 'failed',
      error_text: 'תשובת מקס לא תאמה את השמירה שנפתחה.',
    });
    return jsonResponse({ ok: true });
  }

  if (statusBody.TransactionSuccess === true && !callback) {
    return jsonResponse({ error: 'Transaction is not ready' }, 500);
  }

  if (statusBody.TransactionSuccess !== true && !callback) {
    return jsonResponse({ error: 'Transaction is not ready' }, 500);
  }

  const decision = decideCardSave({
    transactionSuccess: statusBody.TransactionSuccess === true,
    callback,
  });

  if (decision.outcome !== 'saved' || !decision.token) {
    await finish(admin, session.id, {
      status: 'failed',
      error_text: decision.errorText,
    });
    return jsonResponse({ ok: true });
  }

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

  if (methodError || !method) {
    return jsonResponse({ error: methodError?.message ?? 'Save failed' }, 500);
  }

  const { data: locked, error: lockError } = await admin
    .from('billing_sessions')
    .update({
      status: 'succeeded',
      payment_method_id: method.id,
      error_text: null,
      completed_at: now,
    })
    .eq('id', session.id)
    .eq('status', 'pending')
    .select('id');

  if (lockError) {
    return jsonResponse({ error: lockError.message }, 500);
  }

  if (!locked?.length) {
    await admin
      .from('payment_methods')
      .update({ status: 'revoked', updated_at: now })
      .eq('id', method.id);
    return jsonResponse({ ok: true });
  }

  await admin
    .from('payment_methods')
    .update({ status: 'revoked', updated_at: now })
    .eq('business_code', session.business_code)
    .eq('status', 'active')
    .neq('id', method.id);

  return jsonResponse({ ok: true });
});

async function finish(
  admin: NonNullable<ReturnType<typeof adminClient>>,
  sessionId: string,
  patch: { status: 'failed'; error_text: string | null },
) {
  await admin
    .from('billing_sessions')
    .update({
      status: patch.status,
      error_text: patch.error_text,
      completed_at: new Date().toISOString(),
    })
    .eq('id', sessionId)
    .eq('status', 'pending');
}
