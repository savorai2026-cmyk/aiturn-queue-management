import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

function passwordRuleError(password: string): string | null {
  if (password.length < 8) return 'הסיסמה חייבת להכיל לפחות 8 תווים.';
  if (!/[a-z]/.test(password)) return 'הסיסמה חייבת להכיל אות אנגלית קטנה.';
  if (!/[A-Z]/.test(password)) return 'הסיסמה חייבת להכיל אות אנגלית גדולה.';
  if (!/\d/.test(password)) return 'הסיסמה חייבת להכיל ספרה.';
  if (!/[^A-Za-z0-9]/.test(password)) return 'הסיסמה חייבת להכיל תו מיוחד.';
  return null;
}

function allowedRedirect(value: string): string | null {
  try {
    const url = new URL(value);
    const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    const live =
      url.origin === 'https://featurn-web-43062247540.europe-west1.run.app' ||
      url.origin === 'https://featurn-web-myjhxnlceq-ew.a.run.app';
    if (!local && !live) return null;
    return `${url.origin}/`;
  } catch {
    return null;
  }
}

function hebrewAuthError(message: string): string {
  if (/already.*(registered|exists)/i.test(message)) {
    return 'כבר יש חשבון עם הדוא״ל הזה.';
  }
  return 'לא ניתן ליצור את המשתמש.';
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

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    return jsonResponse({ error: 'Supabase is not configured' }, 500);
  }

  let body: Record<string, unknown>;
  try {
    body = asRecord(await request.json());
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const businessCode = readString(body.business_code);
  const action = readString(body.action);
  if (!businessCode) {
    return jsonResponse({ error: 'Missing business_code' }, 400);
  }

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authorization } },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) {
    return jsonResponse({ error: 'Not authenticated' }, 401);
  }

  const { data: membership, error: membershipError } = await userClient
    .from('business_members')
    .select('role')
    .eq('business_code', businessCode)
    .eq('user_id', userData.user.id)
    .eq('status', 'active')
    .maybeSingle();

  if (membershipError) {
    return jsonResponse({ error: membershipError.message }, 400);
  }
  if (membership?.role !== 'owner') {
    return jsonResponse({ error: 'רק בעל העסק יכול לנהל משתמשים.' }, 403);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: business, error: businessError } = await admin
    .from('businesses')
    .select('closed_at')
    .eq('business_code', businessCode)
    .maybeSingle();

  if (businessError) {
    return jsonResponse({ error: businessError.message }, 400);
  }
  if (business?.closed_at) {
    return jsonResponse({ error: 'החשבון נסגר.' }, 403);
  }

  if (action === 'list') {
    const { data: rows, error: listError } = await admin
      .from('business_members')
      .select('user_id, role, status, created_at')
      .eq('business_code', businessCode)
      .order('created_at', { ascending: true });

    if (listError) {
      return jsonResponse({ error: listError.message }, 400);
    }

    const members = [];
    for (const row of rows ?? []) {
      const { data: account, error: accountError } = await admin.auth.admin.getUserById(
        row.user_id,
      );
      if (accountError || !account.user) continue;
      members.push({
        userId: row.user_id,
        email: account.user.email ?? '',
        role: row.role,
        status: row.status,
        emailConfirmed: Boolean(account.user.email_confirmed_at),
        createdAt: row.created_at,
      });
    }

    return jsonResponse({ members });
  }

  if (action === 'create') {
    const email = readString(body.email).toLowerCase();
    const password = typeof body.password === 'string' ? body.password : '';
    const redirectTo = allowedRedirect(readString(body.redirect_to));
    if (!EMAIL_PATTERN.test(email)) {
      return jsonResponse({ error: 'כתובת הדוא״ל אינה תקינה.' }, 400);
    }
    const ruleError = passwordRuleError(password);
    if (ruleError) {
      return jsonResponse({ error: ruleError }, 400);
    }
    if (!redirectTo) {
      return jsonResponse({ error: 'כתובת האימות אינה תקינה.' }, 400);
    }

    const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(
      email,
      { redirectTo },
    );
    if (inviteError || !invited.user) {
      return jsonResponse(
        { error: hebrewAuthError(inviteError?.message ?? '') },
        400,
      );
    }

    const userId = invited.user.id;
    const { error: passwordError } = await admin.auth.admin.updateUserById(userId, {
      password,
    });
    if (passwordError) {
      await admin.auth.admin.deleteUser(userId);
      return jsonResponse({ error: 'לא ניתן לשמור את הסיסמה.' }, 400);
    }

    const { error: insertError } = await admin.from('business_members').insert({
      business_code: businessCode,
      user_id: userId,
      role: 'staff',
      status: 'active',
      created_by: userData.user.id,
    });
    if (insertError) {
      await admin.auth.admin.deleteUser(userId);
      return jsonResponse({ error: 'לא ניתן לשייך את המשתמש לעסק.' }, 400);
    }

    return jsonResponse({ ok: true });
  }

  if (action === 'remove') {
    const userId = readString(body.user_id);
    if (!userId) {
      return jsonResponse({ error: 'Missing user_id' }, 400);
    }
    if (userId === userData.user.id) {
      return jsonResponse({ error: 'אי אפשר למחוק את בעל העסק.' }, 400);
    }

    const { data: target, error: targetError } = await admin
      .from('business_members')
      .select('role')
      .eq('business_code', businessCode)
      .eq('user_id', userId)
      .maybeSingle();

    if (targetError) {
      return jsonResponse({ error: targetError.message }, 400);
    }
    if (!target) {
      return jsonResponse({ error: 'המשתמש לא נמצא בעסק.' }, 404);
    }
    if (target.role === 'owner') {
      return jsonResponse({ error: 'אי אפשר למחוק את בעל העסק.' }, 400);
    }

    const { error: deleteError } = await admin
      .from('business_members')
      .delete()
      .eq('business_code', businessCode)
      .eq('user_id', userId);

    if (deleteError) {
      return jsonResponse({ error: deleteError.message }, 400);
    }

    const { count, error: countError } = await admin
      .from('business_members')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (!countError && count === 0) {
      await admin.auth.admin.deleteUser(userId);
    }

    return jsonResponse({ ok: true });
  }

  return jsonResponse({ error: 'Unknown action' }, 400);
});
