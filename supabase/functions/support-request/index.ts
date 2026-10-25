import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

const SUPPORT_INBOX = 'office@savorai.biz';
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT = 5;

const recentCalls = new Map<string, number[]>();

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

function readString(value: unknown, max: number): string {
  const text = typeof value === 'string' ? value.trim() : '';
  return text.slice(0, max);
}

function allowCall(userId: string) {
  const now = Date.now();
  const stamps = (recentCalls.get(userId) ?? []).filter(
    (stamp) => now - stamp < RATE_WINDOW_MS,
  );
  if (stamps.length >= RATE_LIMIT) {
    recentCalls.set(userId, stamps);
    return false;
  }
  stamps.push(now);
  recentCalls.set(userId, stamps);
  return true;
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
    return jsonResponse({ error: 'חסרה התחברות.' }, 401);
  }

  const resendKey = Deno.env.get('RESEND_API_KEY') ?? '';
  if (!resendKey) {
    return jsonResponse(
      { error: 'שליחת המייל מהמערכת עדיין לא הוגדרה.' },
      503,
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return jsonResponse({ error: 'הפנייה לא תקינה.' }, 400);
  }

  const businessCode = readString(body.business_code, 40);
  const subject = readString(body.subject, 120);
  const name = readString(body.name, 80);
  const email = readString(body.email, 120);
  const phone = readString(body.phone, 30);
  const message = readString(body.message, 2000);
  const businessName = readString(body.business_name, 120);

  if (!businessCode || !subject || !name || !phone || !message) {
    return jsonResponse({ error: 'חסרים פרטים בפנייה.' }, 400);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return jsonResponse({ error: 'כתובת הדוא״ל לא תקינה.' }, 400);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!supabaseUrl || !supabaseAnonKey) {
    return jsonResponse({ error: 'המערכת לא מוגדרת לשליחה.' }, 500);
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authorization } },
  });

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return jsonResponse({ error: 'חסרה התחברות.' }, 401);
  }

  if (!allowCall(userData.user.id)) {
    return jsonResponse({ error: 'נשלחו יותר מדי פניות. אפשר לנסות שוב בעוד כמה דקות.' }, 429);
  }

  const { data: membership, error: membershipError } = await supabase
    .from('business_members')
    .select('role')
    .eq('business_code', businessCode)
    .eq('user_id', userData.user.id)
    .eq('status', 'active')
    .maybeSingle();

  if (membershipError) {
    return jsonResponse({ error: 'לא ניתן לאמת את העסק.' }, 400);
  }
  if (!membership) {
    return jsonResponse({ error: 'אין הרשאה לשלוח פנייה עבור העסק הזה.' }, 403);
  }

  const from = Deno.env.get('SUPPORT_FROM_EMAIL')?.trim() || `QGent <${SUPPORT_INBOX}>`;
  const to = Deno.env.get('SUPPORT_TO_EMAIL')?.trim() || SUPPORT_INBOX;
  const text = [
    `שם: ${name}`,
    `דוא״ל: ${email}`,
    `טלפון: ${phone}`,
    ...(businessName ? [`עסק: ${businessName}`] : []),
    `קוד עסק: ${businessCode}`,
    '',
    message,
  ].join('\n');

  const resendResponse = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [to],
      reply_to: email,
      subject,
      text,
    }),
  });

  if (!resendResponse.ok) {
    return jsonResponse({ error: 'המייל לא נשלח. אפשר לנסות שוב בעוד רגע.' }, 502);
  }

  return jsonResponse({ ok: true });
});
