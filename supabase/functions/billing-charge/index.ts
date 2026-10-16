import {
  adminClient,
  corsHeaders,
  jsonResponse,
  postJson,
  readJson,
  requireBillingManager,
} from '../_shared/billingHttp.ts';
import {
  COMMIT_TRANSACTION_URL,
  MAX_PROVIDER,
  commitTokenChargeRequest,
  parseTestChargeAmount,
  readChargeResult,
  readToken,
} from '../_shared/maxBilling.ts';

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const body = await readJson(request);
  if (body instanceof Response) return body;

  const businessCode =
    typeof body.business_code === 'string' ? body.business_code.trim() : '';
  if (!businessCode) {
    return jsonResponse({ error: 'חסר מזהה עסק.' }, 400);
  }

  const amount = parseTestChargeAmount(body.amount_ils);
  if (amount == null) {
    return jsonResponse({ error: 'סכום הבדיקה צריך להיות בין 1 ל־10 ש״ח.' }, 400);
  }

  const manager = await requireBillingManager(request, businessCode);
  if (manager instanceof Response) return manager;

  const terminalNumber = Deno.env.get('ZCREDIT_TERMINAL_NUMBER')?.trim() ?? '';
  const password = Deno.env.get('ZCREDIT_TERMINAL_PASSWORD')?.trim() ?? '';
  if (!terminalNumber || !password) {
    return jsonResponse(
      { error: 'חיוב לפי טוקן עדיין לא הוגדר. חסרים מספר מסוף או סיסמה.' },
      500,
    );
  }

  const admin = adminClient();
  if (!admin) {
    return jsonResponse({ error: 'השרת אינו מוגדר.' }, 500);
  }

  const { data: method, error: methodError } = await admin
    .from('payment_methods')
    .select('id, provider, cg_card_id')
    .eq('business_code', businessCode)
    .eq('status', 'active')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (methodError) {
    return jsonResponse({ error: methodError.message }, 400);
  }

  const token = readToken(method?.cg_card_id);
  if (!method || method.provider !== MAX_PROVIDER || !token) {
    return jsonResponse(
      { error: 'אין טוקן שמור של מקס לעסק הזה.' },
      400,
    );
  }

  const chargeId = crypto.randomUUID();
  let result: ReturnType<typeof readChargeResult>;
  try {
    const response = await postJson(
      COMMIT_TRANSACTION_URL,
      commitTokenChargeRequest({
        terminalNumber,
        password,
        token,
        amountIls: amount,
        uniqueId: chargeId,
      }),
    );
    result = readChargeResult(response.body);
  } catch {
    result = { ok: false, error: 'לא ניתן להתחבר למקס.' };
  }

  const { error: chargeLogError } = await admin.from('billing_charges').insert({
    id: chargeId,
    business_code: businessCode,
    payment_method_id: method.id,
    amount_ils: amount,
    status: result.ok ? 'succeeded' : 'failed',
    approval_number: result.ok ? result.approvalNumber || null : null,
    reference_number: result.ok ? result.referenceNumber || null : null,
    error_text: result.ok ? null : result.error,
  });

  if (chargeLogError) {
    console.error('billing charge log failed', chargeLogError.message);
  }

  if (!result.ok) {
    return jsonResponse({ error: result.error }, 402);
  }

  return jsonResponse({
    ok: true,
    amount_ils: amount,
    approval_number: result.approvalNumber,
    reference_number: result.referenceNumber,
    last4: result.last4,
  });
});
