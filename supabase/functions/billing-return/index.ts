import { adminClient, htmlResponse, jsonResponse } from '../_shared/billingHttp.ts';
import { billingReturnHtml, isUuid } from '../_shared/maxBilling.ts';

Deno.serve(async (request) => {
  if (request.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const url = new URL(request.url);
  const outcome = url.searchParams.get('outcome');
  const uniqueId = url.searchParams.get('uniqueid')?.trim() ?? '';
  const kind =
    outcome === 'success' || outcome === 'cancel' || outcome === 'failure'
      ? outcome
      : 'missing';

  if (kind === 'cancel' && isUuid(uniqueId)) {
    const admin = adminClient();
    if (admin) {
      await admin
        .from('billing_sessions')
        .update({
          status: 'canceled',
          error_text: 'השמירה בוטלה.',
          completed_at: new Date().toISOString(),
        })
        .eq('uniqueid', uniqueId)
        .eq('status', 'pending');
    }
  }

  return htmlResponse(billingReturnHtml(kind));
});
