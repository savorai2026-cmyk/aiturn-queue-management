const MUTATIONS = new Set(['book', 'cancel', 'reschedule', 'events', 'appointments']);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function queryValue(payload: Record<string, unknown>, key: string): string {
  const value = payload[key];
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return '';
}

function schedulerSecret() {
  return Deno.env.get('VAPI_SECRET') || Deno.env.get('SCHEDULER_API_SECRET') || '';
}

function upstreamHeaders(method: string) {
  const headers: Record<string, string> = {};
  if (method !== 'GET') {
    headers['Content-Type'] = 'application/json';
  }

  const secret = schedulerSecret();
  if (secret) {
    headers['x-vapi-secret'] = secret;
  }

  return headers;
}

function buildUpstream(
  baseUrl: string,
  action: string,
  payload: Record<string, unknown>,
) {
  const root = baseUrl.replace(/\/$/, '');

  if (action === 'slots') {
    const businessCode = queryValue(payload, 'business_code');
    const date = queryValue(payload, 'date');
    const duration = queryValue(payload, 'duration');
    if (!businessCode || !date || !duration) {
      return {
        error: 'Missing required parameters',
        status: 400,
      };
    }

    const url = new URL(`${root}/api/v1/slots`);
    url.searchParams.set('business_code', businessCode);
    url.searchParams.set('date', date);
    url.searchParams.set('duration', duration);
    if (queryValue(payload, 'strict').toLowerCase() === 'true') {
      url.searchParams.set('strict', 'true');
    }

    return { url: url.toString(), method: 'GET' as const };
  }

  if (!MUTATIONS.has(action)) {
    return { error: 'Unsupported scheduler action', status: 400 };
  }

  return {
    url: `${root}/${action}`,
    method: 'POST' as const,
    body: JSON.stringify(payload),
  };
}

function vapiResultText(body: Record<string, unknown>) {
  if (!Array.isArray(body.results)) return '';

  return body.results
    .map((item) => asRecord(item).result)
    .filter((value): value is string => typeof value === 'string' && value.trim() !== '')
    .join('\n');
}

function normalizeUpstreamBody(
  action: string,
  status: number,
  body: unknown,
) {
  const record = asRecord(body);
  const ok = status >= 200 && status < 400;

  if (action === 'slots') {
    const nested = asRecord(record.data);
    const slots = record.available_slots ?? record.slots ?? nested.slots;
    return {
      success: ok,
      business_code: record.business_code,
      date: record.date,
      slots: Array.isArray(slots) ? slots : [],
      error: typeof record.error === 'string' ? record.error : undefined,
    };
  }

  const resultText = vapiResultText(record);
  if (resultText || Array.isArray(record.results)) {
    const actionRequired = record.action_required === true;
    return {
      success: ok || actionRequired,
      action_required: actionRequired,
      user_message:
        resultText ||
        (typeof record.user_message === 'string' ? record.user_message : undefined),
      message: resultText,
      error: ok || actionRequired ? undefined : resultText || 'הפעולה נכשלה',
      results: record.results,
    };
  }

  if (typeof record.success === 'boolean') {
    return record;
  }

  return {
    ...record,
    success: ok,
  };
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const schedulerBaseUrl =
    Deno.env.get('SCHEDULER_API_URL') || Deno.env.get('BILLING_PUBLIC_BASE_URL');
  if (!schedulerBaseUrl) {
    return jsonResponse(
      { error: 'SCHEDULER_API_URL is not configured' },
      500,
    );
  }

  const authorization = request.headers.get('Authorization');
  if (!authorization) {
    return jsonResponse({ error: 'Missing authorization header' }, 401);
  }

  let body: { action?: unknown; payload?: unknown };

  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const action = typeof body.action === 'string' ? body.action : '';
  const payload = asRecord(body.payload);
  const upstream = buildUpstream(schedulerBaseUrl, action, payload);

  if ('error' in upstream) {
    return jsonResponse(
      { success: false, error: upstream.error },
      upstream.status,
    );
  }

  try {
    const upstreamResponse = await fetch(upstream.url, {
      method: upstream.method,
      headers: upstreamHeaders(upstream.method),
      body: 'body' in upstream ? upstream.body : undefined,
    });

    const responseText = await upstreamResponse.text();
    let parsed: unknown = responseText;

    try {
      parsed = responseText ? JSON.parse(responseText) : {};
    } catch {
      parsed = { message: responseText };
    }

    return jsonResponse(
      normalizeUpstreamBody(action, upstreamResponse.status, parsed),
      upstreamResponse.status,
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Scheduler request failed';
    return jsonResponse({ error: message }, 502);
  }
});
