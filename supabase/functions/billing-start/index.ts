import {
  adminClient,
  corsHeaders,
  jsonResponse,
  postJson,
  readJson,
  requireBillingManager,
} from '../_shared/billingHttp.ts';
import {
  CREATE_SESSION_URL,
  createSessionRequest,
  functionUrl,
  parseSavePaymentType,
  readCreatedSession,
} from '../_shared/maxBilling.ts';

const SESSION_TTL_MS = 60 * 60 * 1000;

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

  const manager = await requireBillingManager(request, businessCode);
  if (manager instanceof Response) return manager;

  const key = Deno.env.get('ZCREDIT_WEBCHECKOUT_KEY')?.trim() ?? '';
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  if (!key || !supabaseUrl || !anonKey) {
    return jsonResponse(
      { error: 'סליקת מקס עדיין לא הוגדרה בשרת. חסר מפתח WebCheckout.' },
      500,
    );
  }

  const admin = adminClient();
  if (!admin) {
    return jsonResponse({ error: 'השרת אינו מוגדר.' }, 500);
  }

  const paymentType = parseSavePaymentType(body.payment_type);
  const uniqueId = crypto.randomUUID();
  const now = Date.now();
  const publicParams = { apikey: anonKey, uniqueid: uniqueId };

  const { error: insertError } = await admin.from('billing_sessions').insert({
    business_code: businessCode,
    uniqueid: uniqueId,
    status: 'pending',
    payment_type: paymentType,
    created_at: new Date(now).toISOString(),
    expires_at: new Date(now + SESSION_TTL_MS).toISOString(),
  });

  if (insertError) {
    return jsonResponse({ error: insertError.message }, 400);
  }

  const sessionRequest = createSessionRequest({
    key,
    uniqueId,
    paymentType,
    callbackUrl: functionUrl(supabaseUrl, 'billing-callback', publicParams),
    failureCallbackUrl: functionUrl(supabaseUrl, 'billing-callback', publicParams),
    successUrl: functionUrl(supabaseUrl, 'billing-return', {
      ...publicParams,
      outcome: 'success',
    }),
    cancelUrl: functionUrl(supabaseUrl, 'billing-return', {
      ...publicParams,
      outcome: 'cancel',
    }),
    failureRedirectUrl: functionUrl(supabaseUrl, 'billing-return', {
      ...publicParams,
      outcome: 'failure',
    }),
  });

  let created: ReturnType<typeof readCreatedSession>;
  try {
    const response = await postJson(CREATE_SESSION_URL, sessionRequest);
    created = readCreatedSession(response.body);
  } catch {
    created = { error: 'לא ניתן להתחבר למקס.' };
  }

  if ('error' in created) {
    await admin
      .from('billing_sessions')
      .update({
        status: 'failed',
        error_text: created.error,
        completed_at: new Date().toISOString(),
      })
      .eq('uniqueid', uniqueId);

    return jsonResponse({ error: created.error }, 502);
  }

  const { error: updateError } = await admin
    .from('billing_sessions')
    .update({ provider_session_id: created.sessionId })
    .eq('uniqueid', uniqueId);

  if (updateError) {
    return jsonResponse({ error: updateError.message }, 400);
  }

  return jsonResponse({ url: created.sessionUrl, uniqueid: uniqueId });
});
