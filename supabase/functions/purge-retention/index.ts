import { createClient } from 'npm:@supabase/supabase-js@2';

const BATCH_SIZE = 100;
const MAX_ROUNDS = 10;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function isAuthorized(request: Request) {
  const purgeSecret = Deno.env.get('PURGE_SECRET') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const headerSecret = request.headers.get('x-purge-secret') ?? '';
  const authorization = request.headers.get('Authorization') ?? '';

  if (purgeSecret !== '' && headerSecret === purgeSecret) return true;
  return serviceKey !== '' && authorization === `Bearer ${serviceKey}`;
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  if (!isAuthorized(request)) {
    return jsonResponse({ error: 'Forbidden' }, 403);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!supabaseUrl || !serviceKey) {
    return jsonResponse({ error: 'Missing service credentials' }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let removedFiles = 0;
  let forgottenRows = 0;

  try {
    for (let round = 0; round < MAX_ROUNDS; round += 1) {
      const listed = await supabase.rpc('expired_recording_paths', { p_limit: 200 });
      if (listed.error) {
        return jsonResponse({ error: listed.error.message }, 500);
      }

      const paths = [
        ...new Set(
          ((listed.data ?? []) as { storage_path: string | null }[])
            .map((row) => row.storage_path)
            .filter((path): path is string => typeof path === 'string' && path !== ''),
        ),
      ];

      if (paths.length === 0) break;

      for (let index = 0; index < paths.length; index += BATCH_SIZE) {
        const chunk = paths.slice(index, index + BATCH_SIZE);
        const removed = await supabase.storage.from('recordings').remove(chunk);
        if (removed.error) {
          return jsonResponse({ error: removed.error.message, removedFiles, forgottenRows }, 500);
        }
      }

      const forgotten = await supabase.rpc('forget_purged_recordings', { p_paths: paths });
      if (forgotten.error) {
        return jsonResponse({ error: forgotten.error.message, removedFiles }, 500);
      }

      removedFiles += paths.length;
      forgottenRows += typeof forgotten.data === 'number' ? forgotten.data : 0;

      if (paths.length < 200) break;
    }

    const purged = await supabase.rpc('purge_expired_tenant_data');
    if (purged.error) {
      return jsonResponse({ error: purged.error.message, removedFiles, forgottenRows }, 500);
    }

    return jsonResponse({
      removedFiles,
      forgottenRows,
      purged: purged.data,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Purge failed';
    return jsonResponse({ error: message, removedFiles, forgottenRows }, 500);
  }
});
