import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

const MAX_DRAFT_CHARS = 4000;
const MAX_OUTPUT_TOKENS = 800;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT = 6;
const DEFAULT_MODEL = 'gpt-4.1';

const SYSTEM_PROMPT = `אתה עוזר ניסוח לבעלי עסקים במערכת ניהול תורים.
המטרה היחידה: לנסח מחדש בעברית ברורה ומקצועית מה העסק עושה ומה הוא לא עושה.

כללים:
- אל תכתוב פרומפט לסוכן קולי, אל תוראות לשיחה, ואל תסביר איך לקבוע תור.
- שמור על העובדות של בעל העסק. אל תוסיף שירותים, תחומים או מגבלות שלא נמסרו.
- אם צורפה רשימת שירותים, אפשר להישען עליה רק כעזר לדיוק. אם אין רשימה, אל תמציא אחת.
- מבנה רצוי: מה העסק עושה, ואז במה הוא לא מתעסק.
- כתוב פסקה או שתיים קצרות, בגוף ראשון רבים או בניסוח עסקי פשוט.
- החזר רק את נוסח התיאור, בלי כותרת, בלי מרכאות ובלי הסבר.`;

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

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
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

function stripWrappingQuotes(text: string) {
  const trimmed = text.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith('«') && trimmed.endsWith('»'))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function buildUserMessage(input: {
  businessName: string;
  draft: string;
  serviceTitles: string[];
}) {
  const parts = [
    `שם העסק: ${input.businessName || 'לא צוין'}`,
    '',
    'טיוטת בעל העסק:',
    input.draft,
  ];

  if (input.serviceTitles.length > 0) {
    parts.push('', 'שירותים מוגדרים כרגע:', input.serviceTitles.join(', '));
  }

  return parts.join('\n');
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

  const openaiKey = Deno.env.get('OPENAI_API_KEY') ?? '';
  if (!openaiKey) {
    return jsonResponse({ error: 'OpenAI is not configured' }, 500);
  }

  let body: Record<string, unknown>;
  try {
    body = asRecord(await request.json());
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const businessCode = readString(body.business_code);
  const draft = readString(body.draft);
  if (!businessCode) {
    return jsonResponse({ error: 'Missing business_code' }, 400);
  }
  if (!draft) {
    return jsonResponse({ error: 'Missing draft' }, 400);
  }
  if (draft.length > MAX_DRAFT_CHARS) {
    return jsonResponse({ error: 'Draft is too long' }, 400);
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

  if (!allowCall(userData.user.id)) {
    return jsonResponse({ error: 'Too many rewrite requests' }, 429);
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

  const { data: business, error: businessError } = await supabase
    .from('businesses')
    .select('business_name')
    .eq('business_code', businessCode)
    .maybeSingle();

  if (businessError) {
    return jsonResponse({ error: businessError.message }, 400);
  }

  const { data: serviceRows, error: servicesError } = await supabase
    .from('services')
    .select('title, is_active')
    .eq('business_code', businessCode)
    .order('title', { ascending: true })
    .limit(40);

  if (servicesError) {
    return jsonResponse({ error: servicesError.message }, 400);
  }

  const serviceTitles = (serviceRows ?? [])
    .filter((row) => row.is_active !== false)
    .map((row) => readString(row.title))
    .filter(Boolean);

  const model = Deno.env.get('OPENAI_MODEL')?.trim() || DEFAULT_MODEL;
  const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${openaiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0.4,
      max_tokens: MAX_OUTPUT_TOKENS,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: buildUserMessage({
            businessName: readString(business?.business_name),
            draft,
            serviceTitles,
          }),
        },
      ],
    }),
  });

  const openaiPayload = asRecord(await openaiResponse.json().catch(() => ({})));
  if (!openaiResponse.ok) {
    const openaiError = asRecord(openaiPayload.error);
    const openaiMessage = readString(openaiError.message);
    return jsonResponse(
      { error: openaiMessage || 'OpenAI request failed' },
      openaiResponse.status === 429 ? 429 : 502,
    );
  }

  const choices = Array.isArray(openaiPayload.choices) ? openaiPayload.choices : [];
  const firstChoice = asRecord(choices[0]);
  const message = asRecord(firstChoice.message);
  const rewritten = stripWrappingQuotes(readString(message.content));

  if (!rewritten) {
    return jsonResponse({ error: 'Empty rewrite' }, 502);
  }

  return jsonResponse({ text: rewritten });
});
