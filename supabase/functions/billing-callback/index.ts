import { adminClient, jsonResponse } from '../_shared/billingHttp.ts';
import { finalizeCardSave } from '../_shared/finalizeCardSave.ts';
import { asRecord, isUuid, readUniqueId } from '../_shared/maxBilling.ts';

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

  const uniqueId = url.searchParams.get('uniqueid')?.trim() || readUniqueId(body);
  if (!isUuid(uniqueId)) {
    return jsonResponse({ ok: true, ignored: true });
  }

  const key = Deno.env.get('ZCREDIT_WEBCHECKOUT_KEY')?.trim() ?? '';
  const admin = adminClient();
  if (!key || !admin) {
    return jsonResponse({ error: 'Billing callback is not configured' }, 500);
  }

  const result = await finalizeCardSave(admin, {
    uniqueId,
    key,
    postedBody: body,
  });

  if (result.retry) {
    return jsonResponse({ error: 'Transaction is not ready' }, 500);
  }

  return jsonResponse({ ok: true });
});
