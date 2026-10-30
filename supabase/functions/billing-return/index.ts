import { adminClient, htmlResponse, jsonResponse } from '../_shared/billingHttp.ts';
import { finalizeCardSave } from '../_shared/finalizeCardSave.ts';
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

  if (isUuid(uniqueId) && kind !== 'missing') {
    const admin = adminClient();
    const key = Deno.env.get('ZCREDIT_WEBCHECKOUT_KEY')?.trim() ?? '';
    if (admin && key) {
      await finalizeCardSave(admin, {
        uniqueId,
        key,
        terminal: kind === 'success' ? null : kind,
      });
    } else if (admin && kind === 'cancel') {
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
