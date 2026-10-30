import {
  adminClient,
  corsHeaders,
  jsonResponse,
  readJson,
  requireBillingManager,
} from '../_shared/billingHttp.ts';
import { finalizeCardSave } from '../_shared/finalizeCardSave.ts';
import { isUuid } from '../_shared/maxBilling.ts';

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
  const uniqueId = typeof body.uniqueid === 'string' ? body.uniqueid.trim() : '';
  if (!businessCode || !isUuid(uniqueId)) {
    return jsonResponse({ error: 'חסר מזהה שמירה.' }, 400);
  }

  const manager = await requireBillingManager(request, businessCode);
  if (manager instanceof Response) return manager;

  const key = Deno.env.get('ZCREDIT_WEBCHECKOUT_KEY')?.trim() ?? '';
  const admin = adminClient();
  if (!key || !admin) {
    return jsonResponse({ error: 'סליקת מקס עדיין לא הוגדרה בשרת.' }, 500);
  }

  const { data: session, error: sessionError } = await admin
    .from('billing_sessions')
    .select('business_code')
    .eq('uniqueid', uniqueId)
    .maybeSingle();

  if (sessionError) {
    return jsonResponse({ error: sessionError.message }, 400);
  }

  if (
    !session ||
    String(session.business_code).toLowerCase() !== businessCode.toLowerCase()
  ) {
    return jsonResponse({ error: 'השמירה לא נמצאה.' }, 404);
  }

  const result = await finalizeCardSave(admin, { uniqueId, key });
  return jsonResponse({
    status: result.state,
    error: result.errorText,
  });
});
