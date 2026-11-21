import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { isAppTab, openScreenLine, productGuidePrompt } from '../../../src/app/productGuide.ts';
import {
  MAX_APPOINTMENTS,
  MAX_APPOINTMENT_DAYS,
  MAX_CLIENTS,
  MAX_LOGS,
  MAX_SERVICES,
  MAX_STATS_DAYS,
  MAX_STATS_ROWS,
  clampDateRange,
  clipText,
  dateKeyInTimeZone,
  describeCancellation,
  describeWorkingHours,
  likeNeedle,
  packAppointment,
  packClient,
  packLog,
  paymentRequirementLabel,
  planLabel,
  readMoney,
  sanitizeHistory,
  serviceTitles,
  summarizeStatsRows,
  type DateRange,
} from '../../../src/features/assistant/assistant.bounds.ts';
import type { StatusCatalogItem } from '../../../src/features/appointments/appointmentStatuses.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

const MAX_OUTPUT_TOKENS = 700;
const MAX_TOOL_ROUNDS = 3;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT = 12;
const DEFAULT_MODEL = 'gpt-4.1';
const DEFAULT_TIME_ZONE = 'Asia/Jerusalem';

const recentCalls = new Map<string, number[]>();

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'business_settings',
      description:
        'הגדרות העסק הפעיל: שעות, שירותים, תוכנית, מדיניות ביטול ותשלום, וכתובת הגעה. בלי כרטיס אשראי ובלי מזהי סוכן.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_appointments',
      description:
        'תורים בטווח תאריכים. עד 31 יום ועד 40 תורים. מחזיר שם, שעה, סטטוס ושירות. בלי טלפון ובלי הערות.',
      parameters: {
        type: 'object',
        properties: {
          from: { type: 'string', description: 'YYYY-MM-DD כולל' },
          to: { type: 'string', description: 'YYYY-MM-DD כולל' },
        },
        required: ['from', 'to'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'find_clients',
      description:
        'חיפוש עד 8 לקוחות לפי שם או טלפון. מחזיר שם, טלפון, עיר ומדיניות קביעה. בלי תעודת זהות ובלי כתובת מלאה.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'שם או מספר טלפון, לפחות שני תווים' },
        },
        required: ['query'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'summarize_stats',
      description:
        'סיכום תורים בטווח של עד 92 יום: כמות, הושלמו, בוטלו, הכנסה, סטטוסים ושירותים מובילים.',
      parameters: {
        type: 'object',
        properties: {
          from: { type: 'string', description: 'YYYY-MM-DD כולל' },
          to: { type: 'string', description: 'YYYY-MM-DD כולל' },
        },
        required: ['from', 'to'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'recent_logs',
      description:
        'שיחות אחרונות של הסוכן עם לקוחות. עד 8. סיכום קצר בלבד, בלי הקלטה ובלי טלפון.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
];

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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

function readToolArgs(value: unknown): Record<string, unknown> {
  try {
    return asRecord(JSON.parse(readString(value) || '{}'));
  } catch {
    return {};
  }
}

function readNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
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

function systemPrompt(input: {
  businessName: string;
  today: string;
  timeZone: string;
  tab: string;
}) {
  const screen = isAppTab(input.tab) ? openScreenLine(input.tab) : 'אין מסך פתוח ידוע.';
  return [
    'אתה עוזר אישי לבעל עסק במערכת ניהול התורים.',
    'ענה בעברית, קצר וברור.',
    'הסבר איך המסכים עובדים רק לפי המדריך. אל תמציא כפתורים או מסכים.',
    'נתוני העסק מגיעים רק מהכלים. אם הכלי לא הופעל או החזיר שגיאה, אמור שאין לך את הנתון.',
    'אל תשנה נתונים. אי אפשר לקבוע, לבטל, למחוק, לגבות או לסגור חשבון מכאן. אם מבקשים פעולה, הפנה למסך המתאים.',
    'אל תדבר על עסק אחר, על כרטיס אשראי, על הקלטות או על מפתחות.',
    '',
    `היום בעסק: ${input.today}. אזור זמן: ${input.timeZone}.`,
    `שם העסק: ${input.businessName || 'לא צוין'}.`,
    screen,
    '',
    'מדריך המסכים:',
    productGuidePrompt(),
  ].join('\n');
}

function toolPayload(value: unknown) {
  const text = JSON.stringify(value);
  if (text.length <= 12000) return text;
  return JSON.stringify({ error: 'התוצאה גדולה מדי. צמצמו את השאלה.' });
}

async function statusCatalog(
  supabase: SupabaseClient,
  businessCode: string,
): Promise<StatusCatalogItem[]> {
  const { data, error } = await supabase
    .from('statuses')
    .select('status_code, status_text, color')
    .eq('business_code', businessCode);
  if (error) throw new Error(error.message);
  return (data ?? []).flatMap((row) => {
    const record = asRecord(row);
    const statusCode = readString(record.status_code);
    const statusText = readString(record.status_text);
    if (!statusCode || !statusText) return [];
    return [{
      status_code: statusCode,
      status_text: statusText,
      color: readString(record.color) || null,
    }];
  });
}

function rangeOrError(args: Record<string, unknown>, maxDays: number): DateRange | { error: string } {
  return clampDateRange(readString(args.from), readString(args.to), maxDays);
}

async function businessSettings(supabase: SupabaseClient, businessCode: string) {
  const [businessResult, servicesResult] = await Promise.all([
    supabase
      .from('businesses')
      .select(`
        business_name, timezone, slot_duration_minutes, max_adv_booking_days,
        subscription_plan, working_hours, agent_prompt, arrival_address,
        arrival_parking, cancellation_policy, default_payment_requirement,
        deposit_percent, contact_phone, email, payment_payee_name, payment_instructions
      `)
      .eq('business_code', businessCode)
      .maybeSingle(),
    supabase
      .from('services')
      .select('title, duration_minutes, price, is_active, buffer_time_minutes')
      .eq('business_code', businessCode)
      .order('title', { ascending: true })
      .limit(MAX_SERVICES),
  ]);
  if (businessResult.error) throw new Error(businessResult.error.message);
  if (servicesResult.error) throw new Error(servicesResult.error.message);

  const business = asRecord(businessResult.data);
  const services = (servicesResult.data ?? []).map((row) => {
    const service = asRecord(row);
    return {
      title: readString(service.title),
      minutes: readNumber(service.duration_minutes),
      bufferMinutes: readNumber(service.buffer_time_minutes),
      price: readMoney(service.price),
      active: service.is_active !== false,
    };
  }).filter((service) => service.title);

  return {
    name: readString(business.business_name),
    phone: readString(business.contact_phone),
    email: readString(business.email),
    timeZone: readString(business.timezone) || DEFAULT_TIME_ZONE,
    slotMinutes: typeof business.slot_duration_minutes === 'number'
      ? business.slot_duration_minutes
      : null,
    bookingWindowDays: typeof business.max_adv_booking_days === 'number'
      ? business.max_adv_booking_days
      : null,
    plan: planLabel(readString(business.subscription_plan)),
    hours: describeWorkingHours(business.working_hours),
    description: clipText(business.agent_prompt, 1500),
    arrivalAddress: clipText(business.arrival_address, 300),
    arrivalParking: clipText(business.arrival_parking, 300),
    payment: paymentRequirementLabel(readString(business.default_payment_requirement)),
    depositPercent: readMoney(business.deposit_percent),
    payeeName: clipText(business.payment_payee_name, 120),
    paymentInstructions: clipText(business.payment_instructions, 400),
    cancellation: describeCancellation(business.cancellation_policy),
    services,
  };
}

async function listAppointments(
  supabase: SupabaseClient,
  businessCode: string,
  args: Record<string, unknown>,
) {
  const range = rangeOrError(args, MAX_APPOINTMENT_DAYS);
  if ('error' in range) return range;

  const [catalog, result, countResult] = await Promise.all([
    statusCatalog(supabase, businessCode),
    supabase
      .from('appointments')
      .select(`
        appointment_date, start_time, end_time, status, channel, price,
        clients ( full_name ),
        appointment_services ( title_snapshot )
      `)
      .eq('business_code', businessCode)
      .gte('appointment_date', range.from)
      .lte('appointment_date', range.to)
      .order('appointment_date', { ascending: true })
      .order('start_time', { ascending: true })
      .limit(MAX_APPOINTMENTS),
    supabase
      .from('appointments')
      .select('id', { count: 'exact', head: true })
      .eq('business_code', businessCode)
      .gte('appointment_date', range.from)
      .lte('appointment_date', range.to),
  ]);
  if (result.error) throw new Error(result.error.message);
  if (countResult.error) throw new Error(countResult.error.message);

  const appointments = (result.data ?? []).map((row) => {
    const record = asRecord(row);
    return packAppointment({
      appointment_date: readString(record.appointment_date),
      start_time: readString(record.start_time),
      end_time: readString(record.end_time),
      status: readString(record.status),
      channel: readString(record.channel) || null,
      price: readMoney(record.price),
      clients: record.clients as { full_name: string | null } | { full_name: string | null }[] | null,
      appointment_services: serviceTitleRows(record.appointment_services),
    }, catalog);
  });

  return {
    from: range.from,
    to: range.to,
    shown: appointments.length,
    total: countResult.count ?? appointments.length,
    appointments,
  };
}

function serviceTitleRows(value: unknown) {
  return serviceTitles(value).map((title) => ({ title_snapshot: title }));
}

async function findClients(
  supabase: SupabaseClient,
  businessCode: string,
  args: Record<string, unknown>,
) {
  const needle = likeNeedle(readString(args.query));
  if (needle.length < 2) {
    return { error: 'צריך לפחות שני תווים לחיפוש לקוח.' };
  }
  const digits = needle.replace(/\D/g, '');
  let query = supabase
    .from('clients')
    .select('full_name, mobile_phone, whatsapp_number, city, email, booking_policy')
    .eq('business_code', businessCode)
    .is('deleted_at', null)
    .limit(MAX_CLIENTS);

  query = digits.length >= 3 && digits.length >= needle.length - 2
    ? query.or(`mobile_phone.ilike.%${digits}%,whatsapp_number.ilike.%${digits}%`)
    : query.ilike('full_name', `%${needle}%`);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return {
    query: needle,
    clients: (data ?? []).map((row) => {
      const client = asRecord(row);
      return packClient({
        full_name: readString(client.full_name) || null,
        mobile_phone: readString(client.mobile_phone) || null,
        whatsapp_number: readString(client.whatsapp_number) || null,
        city: readString(client.city) || null,
        email: readString(client.email) || null,
        booking_policy: readString(client.booking_policy) || null,
      });
    }),
  };
}

async function summarizeStats(
  supabase: SupabaseClient,
  businessCode: string,
  args: Record<string, unknown>,
) {
  const range = rangeOrError(args, MAX_STATS_DAYS);
  if ('error' in range) return range;

  const [catalog, result, countResult] = await Promise.all([
    statusCatalog(supabase, businessCode),
    supabase
      .from('appointments')
      .select(`
        status, price,
        appointment_services ( title_snapshot )
      `)
      .eq('business_code', businessCode)
      .gte('appointment_date', range.from)
      .lte('appointment_date', range.to)
      .order('appointment_date', { ascending: true })
      .limit(MAX_STATS_ROWS),
    supabase
      .from('appointments')
      .select('id', { count: 'exact', head: true })
      .eq('business_code', businessCode)
      .gte('appointment_date', range.from)
      .lte('appointment_date', range.to),
  ]);
  if (result.error) throw new Error(result.error.message);
  if (countResult.error) throw new Error(countResult.error.message);

  const rows = (result.data ?? []).map((row) => {
    const record = asRecord(row);
    return {
      status: readString(record.status),
      price: readMoney(record.price),
      services: serviceTitles(record.appointment_services),
    };
  });
  const total = countResult.count ?? rows.length;
  return {
    from: range.from,
    to: range.to,
    partial: total > rows.length,
    ...summarizeStatsRows(rows, catalog),
  };
}

async function recentLogs(supabase: SupabaseClient, businessCode: string) {
  const { data, error } = await supabase
    .from('conversation_logs')
    .select('started_at, created_at, channel, outcome, duration_seconds, summary, transcript')
    .eq('business_code', businessCode)
    .order('started_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(MAX_LOGS);
  if (error) throw new Error(error.message);

  return {
    logs: (data ?? []).map((row) => {
      const log = asRecord(row);
      return packLog({
        started_at: readString(log.started_at) || null,
        created_at: readString(log.created_at),
        channel: readString(log.channel),
        outcome: readString(log.outcome) || null,
        duration_seconds: typeof log.duration_seconds === 'number' ? log.duration_seconds : null,
        summary: readString(log.summary) || null,
        transcript: readString(log.transcript) || null,
      });
    }),
  };
}

async function runTool(
  supabase: SupabaseClient,
  businessCode: string,
  name: string,
  args: Record<string, unknown>,
) {
  try {
    if (name === 'business_settings') return await businessSettings(supabase, businessCode);
    if (name === 'list_appointments') return await listAppointments(supabase, businessCode, args);
    if (name === 'find_clients') return await findClients(supabase, businessCode, args);
    if (name === 'summarize_stats') return await summarizeStats(supabase, businessCode, args);
    if (name === 'recent_logs') return await recentLogs(supabase, businessCode);
    return { error: 'הכלי לא זמין.' };
  } catch {
    return { error: 'לא הצלחתי לקרוא את הנתונים.' };
  }
}

interface TokenUse {
  prompt: number;
  completion: number;
}

function readUsage(payload: Record<string, unknown>): TokenUse {
  const usage = asRecord(payload.usage);
  return {
    prompt: readNumber(usage.prompt_tokens),
    completion: readNumber(usage.completion_tokens),
  };
}

async function logUsage(input: {
  supabaseUrl: string;
  businessCode: string;
  model: string;
  usage: TokenUse;
}) {
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!serviceKey) return;
  const total = input.usage.prompt + input.usage.completion;
  if (total <= 0) return;

  // Members can read usage, not write it. The insert stays on the service role.
  const admin = createClient(input.supabaseUrl, serviceKey);
  const { error } = await admin.from('usage_events').insert({
    business_code: input.businessCode,
    action: 'openai_tokens',
    quantity: total,
    unit: 'token',
    initiated_by: 'business',
    idempotency_key: crypto.randomUUID(),
    meta: {
      model: input.model,
      prompt_tokens: input.usage.prompt,
      completion_tokens: input.usage.completion,
      source: 'owner_assistant',
      initiated_by: 'business',
    },
  });
  if (error) console.error('owner assistant usage', error.message);
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
  if (!businessCode) {
    return jsonResponse({ error: 'Missing business_code' }, 400);
  }

  const history = sanitizeHistory(body.messages);
  if (!history) {
    return jsonResponse({ error: 'Missing question' }, 400);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
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
    return jsonResponse({ error: 'Too many assistant requests' }, 429);
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
    .select('business_name, timezone')
    .eq('business_code', businessCode)
    .maybeSingle();
  if (businessError) {
    return jsonResponse({ error: businessError.message }, 400);
  }

  const timeZone = readString(business?.timezone) || DEFAULT_TIME_ZONE;
  const model = Deno.env.get('OPENAI_MODEL')?.trim() || DEFAULT_MODEL;
  const messages: Array<Record<string, unknown>> = [
    {
      role: 'system',
      content: systemPrompt({
        businessName: readString(business?.business_name),
        today: dateKeyInTimeZone(new Date(), timeZone),
        timeZone,
        tab: readString(body.tab),
      }),
    },
    ...history.map((turn) => ({ role: turn.role, content: turn.content })),
  ];

  const usage: TokenUse = { prompt: 0, completion: 0 };
  let answer = '';

  for (let round = 0; round <= MAX_TOOL_ROUNDS; round += 1) {
    const allowTools = round < MAX_TOOL_ROUNDS;
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        max_tokens: MAX_OUTPUT_TOKENS,
        messages,
        ...(allowTools ? { tools: TOOLS } : {}),
      }),
    });
    const openaiPayload = asRecord(await openaiResponse.json().catch(() => ({})));
    const roundUsage = readUsage(openaiPayload);
    usage.prompt += roundUsage.prompt;
    usage.completion += roundUsage.completion;
    if (!openaiResponse.ok) {
      await logUsage({ supabaseUrl, businessCode, model, usage });
      const openaiError = asRecord(openaiPayload.error);
      const openaiMessage = readString(openaiError.message);
      return jsonResponse(
        { error: openaiMessage || 'OpenAI request failed' },
        openaiResponse.status === 429 ? 429 : 502,
      );
    }

    const choice = asRecord((Array.isArray(openaiPayload.choices) ? openaiPayload.choices : [])[0]);
    const message = asRecord(choice.message);
    const toolCalls = Array.isArray(message.tool_calls) ? message.tool_calls : [];
    if (toolCalls.length === 0) {
      answer = readString(message.content);
      break;
    }

    messages.push(message);
    for (const call of toolCalls) {
      const toolCall = asRecord(call);
      const fn = asRecord(toolCall.function);
      const args = readToolArgs(fn.arguments);
      const result = await runTool(supabase, businessCode, readString(fn.name), args);
      messages.push({
        role: 'tool',
        tool_call_id: readString(toolCall.id),
        content: toolPayload(result),
      });
    }
  }

  if (!answer) {
    answer = 'לא הצלחתי לסיים את הבדיקה. נסו שאלה ממוקדת יותר.';
  }

  await logUsage({ supabaseUrl, businessCode, model, usage });
  return jsonResponse({ text: answer });
});
