const ALLOWED_ACTIONS = new Set(['book', 'slots', 'cancel', 'reschedule']);

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

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const schedulerBaseUrl = Deno.env.get('SCHEDULER_API_URL');
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
  if (!ALLOWED_ACTIONS.has(action)) {
    return jsonResponse({ error: 'Unsupported scheduler action' }, 400);
  }

  const payload =
    body.payload && typeof body.payload === 'object' ? body.payload : {};

  try {
    const upstreamResponse = await fetch(
      `${schedulerBaseUrl.replace(/\/$/, '')}/${action}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      },
    );

    const responseText = await upstreamResponse.text();
    let responseBody: unknown = responseText;

    try {
      responseBody = responseText ? JSON.parse(responseText) : {};
    } catch {
      responseBody = { message: responseText };
    }

    return jsonResponse(responseBody, upstreamResponse.status);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Scheduler request failed';
    return jsonResponse({ error: message }, 502);
  }
});
