import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

const LINK_TTL_SECONDS = 20 * 60;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

function toHex(bytes: ArrayBuffer) {
  return [...new Uint8Array(bytes)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function publicOrigin(raw: string | undefined) {
  if (!raw) return null;

  try {
    return new URL(raw).origin;
  } catch {
    return null;
  }
}

async function signStartLink(secret: string, businessCode: string, exp: number) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`${businessCode}.${exp}`),
  );

  return toHex(signature);
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const authorization = request.headers.get('Authorization');
  if (!authorization) {
    return jsonResponse({ error: 'Missing authorization header' }, 401);
  }

  const secret =
    Deno.env.get('BILLING_LINK_SECRET') || Deno.env.get('VAPI_SECRET');
  const publicBase =
    publicOrigin(Deno.env.get('BILLING_PUBLIC_BASE_URL')) ||
    publicOrigin(Deno.env.get('SCHEDULER_API_URL'));

  if (!secret || !publicBase) {
    return jsonResponse(
      { error: 'Billing start is not configured' },
      500,
    );
  }

  let body: { business_code?: unknown };

  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const businessCode =
    typeof body.business_code === 'string' ? body.business_code.trim() : '';
  if (!businessCode) {
    return jsonResponse({ error: 'Missing business_code' }, 400);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!supabaseUrl || !supabaseAnonKey) {
    return jsonResponse({ error: 'Supabase is not configured' }, 500);
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authorization } },
  });

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return jsonResponse({ error: 'Not authenticated' }, 401);
  }

  const { data: membership, error: membershipError } = await supabase
    .from('business_members')
    .select('role')
    .eq('business_code', businessCode)
    .eq('user_id', userData.user.id)
    .eq('status', 'active')
    .maybeSingle();

  if (membershipError) {
    return jsonResponse({ error: membershipError.message }, 400);
  }

  if (membership?.role !== 'owner' && membership?.role !== 'admin') {
    return jsonResponse({ error: 'Not allowed' }, 403);
  }

  const exp = Math.floor(Date.now() / 1000) + LINK_TTL_SECONDS;
  const sig = await signStartLink(secret, businessCode, exp);
  const url = new URL('/billing/start', publicBase);
  url.searchParams.set('business_code', businessCode);
  url.searchParams.set('exp', String(exp));
  url.searchParams.set('sig', sig);

  return jsonResponse({ url: url.toString() });
});
