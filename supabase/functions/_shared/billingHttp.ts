import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

export function htmlResponse(html: string, status = 200) {
  return new Response(html, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
  });
}

export function adminClient(): SupabaseClient | null {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) return null;

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function readJson(
  request: Request,
): Promise<Record<string, unknown> | Response> {
  try {
    const body = (await request.json()) as unknown;
    if (body === null || typeof body !== 'object' || Array.isArray(body)) {
      return jsonResponse({ error: 'גוף הבקשה אינו תקין.' }, 400);
    }
    return body as Record<string, unknown>;
  } catch {
    return jsonResponse({ error: 'גוף הבקשה אינו תקין.' }, 400);
  }
}

export async function requireBillingManager(
  request: Request,
  businessCode: string,
): Promise<{ userId: string } | Response> {
  const authorization = request.headers.get('Authorization');
  if (!authorization) {
    return jsonResponse({ error: 'חסרה הזדהות.' }, 401);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!supabaseUrl || !supabaseAnonKey) {
    return jsonResponse({ error: 'השרת אינו מוגדר.' }, 500);
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return jsonResponse({ error: 'לא מחובר.' }, 401);
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
    return jsonResponse({ error: 'רק בעלים או מנהל יכולים לעדכן תשלום.' }, 403);
  }

  return { userId: userData.user.id };
}

export async function postJson(url: string, body: unknown) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text) as unknown;
    } catch {
      parsed = null;
    }
  }

  return { httpOk: response.ok, status: response.status, body: parsed };
}
