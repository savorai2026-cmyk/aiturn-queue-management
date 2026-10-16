import { supabase } from '../../supabaseClient';
import {
  LOG_PAGE_SIZE,
  RECORDINGS_BUCKET,
  findLogClient,
  findRecordingForLog,
  logRangeBound,
  logSearchText,
  nationalIdSearch,
  phoneSearchNeedle,
  remoteRecordingUrl,
} from './conversations.mappers';
import type {
  ConversationLog,
  ConversationLogsResult,
  LogLookup,
} from './conversations.types';

interface ConversationLogRow {
  id: string;
  external_id: string;
  channel: string;
  client_id: string | null;
  client_phone: string | null;
  started_at: string | null;
  ended_at: string | null;
  duration_seconds: number | null;
  estimated_cost: number | null;
  currency: string;
  outcome: string | null;
  model: string | null;
  transcript: string | null;
  summary: string | null;
  recording_url: string | null;
  purged_detail_at: string | null;
  purged_recording_at: string | null;
  created_at: string;
}

interface RecordingRow {
  storage_path: string;
  mime: string | null;
}

function toConversationLog(
  row: ConversationLogRow,
  recordings: RecordingRow[],
): ConversationLog {
  const matched = findRecordingForLog(
    recordings.map((recording) => ({
      storagePath: recording.storage_path,
      mime: recording.mime,
    })),
    row.external_id,
  );

  return {
    id: row.id,
    externalId: row.external_id,
    channel: row.channel,
    clientId: row.client_id,
    clientPhone: row.client_phone,
    clientName: null,
    nationalId: null,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    durationSeconds:
      row.duration_seconds == null ? null : Number(row.duration_seconds),
    estimatedCost:
      row.estimated_cost == null ? null : Number(row.estimated_cost),
    currency: row.currency,
    outcome: row.outcome,
    model: row.model,
    transcript: row.transcript,
    summary: row.summary,
    recordingUrl: row.recording_url,
    playbackUrl: remoteRecordingUrl(row.recording_url),
    storagePath: matched?.storagePath ?? null,
    recordingMime: matched?.mime ?? null,
    purgedDetailAt: row.purged_detail_at,
    purgedRecordingAt: row.purged_recording_at,
    createdAt: row.created_at,
  };
}

const CLIENT_MATCH_LIMIT = 200;
const LOG_COLUMNS =
  'id, external_id, channel, client_id, client_phone, started_at, ended_at, duration_seconds, estimated_cost, currency, outcome, model, transcript, summary, recording_url, purged_detail_at, purged_recording_at, created_at';

interface ClientMatch {
  id: number;
  full_name?: string | null;
  national_id?: string | null;
  mobile_phone: string | null;
  whatsapp_number: string | null;
}

function applyStartRange<Query extends { or: (filters: string) => Query }>(
  query: Query,
  lookup: LogLookup,
) {
  let fromKey = lookup.from.trim();
  let toKey = lookup.to.trim();
  if (fromKey && toKey && fromKey > toKey) {
    [fromKey, toKey] = [toKey, fromKey];
  }
  const from = logRangeBound(fromKey, 'start');
  const to = logRangeBound(toKey, 'end');
  if (!from && !to) return query;

  const started = [
    from ? `started_at.gte."${from}"` : '',
    to ? `started_at.lte."${to}"` : '',
  ].filter(Boolean);
  const created = [
    'started_at.is.null',
    from ? `created_at.gte."${from}"` : '',
    to ? `created_at.lte."${to}"` : '',
  ].filter(Boolean);

  return query.or(`and(${started.join(',')}),and(${created.join(',')})`);
}

function emptyLogs(page: number): ConversationLogsResult {
  return { logs: [], total: 0, page, pageSize: LOG_PAGE_SIZE };
}

function logMatchFilter(clients: ClientMatch[]) {
  const ids = clients.map((client) => client.id).filter((id) => Number.isInteger(id));
  const needles = new Set<string>();
  for (const client of clients) {
    for (const value of [client.mobile_phone, client.whatsapp_number]) {
      const needle = phoneSearchNeedle(value);
      if (needle) needles.add(needle);
    }
  }

  const parts = [
    ids.length > 0 ? `client_id.in.(${ids.map((id) => `"${id}"`).join(',')})` : '',
    ...[...needles].slice(0, 80).map((needle) => `client_phone.ilike.%${needle}%`),
  ].filter(Boolean);

  return parts.join(',');
}

async function matchingClients(businessCode: string, lookup: LogLookup) {
  const name = logSearchText(lookup.clientName);
  const nationalId = nationalIdSearch(lookup.nationalId);
  const phone = phoneSearchNeedle(lookup.phone);
  if (!name && !nationalId) return null;

  let query = supabase
    .from('clients')
    .select('id, full_name, national_id, mobile_phone, whatsapp_number')
    .eq('business_code', businessCode)
    .order('id', { ascending: false })
    .limit(CLIENT_MATCH_LIMIT);

  if (name) query = query.ilike('full_name', `%${name}%`);
  if (nationalId) query = query.ilike('national_id', `%${nationalId}%`);
  if (phone) query = query.ilike('mobile_phone', `%${phone}%`);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as ClientMatch[];
}

async function clientsByMobile(businessCode: string, phone: string) {
  const { data, error } = await supabase
    .from('clients')
    .select('id, full_name, national_id, mobile_phone, whatsapp_number')
    .eq('business_code', businessCode)
    .ilike('mobile_phone', `%${phone}%`)
    .limit(CLIENT_MATCH_LIMIT);

  if (error) throw new Error(error.message);
  return (data ?? []) as ClientMatch[];
}

async function clientDirectory(businessCode: string) {
  const { data, error } = await supabase
    .from('clients')
    .select('id, full_name, national_id, mobile_phone, whatsapp_number')
    .eq('business_code', businessCode)
    .limit(1000);

  if (error) throw new Error(error.message);
  return (data ?? []) as ClientMatch[];
}

async function recordingsForLogs(businessCode: string, externalIds: string[]) {
  const ids = externalIds.filter((id) => /^[0-9a-z-]+$/i.test(id));
  if (ids.length === 0) return [];

  const { data, error } = await supabase
    .from('recordings')
    .select('storage_path, mime')
    .eq('business_code', businessCode)
    .or(ids.map((id) => `storage_path.ilike.%${id}%`).join(','));

  if (error) throw new Error(error.message);
  return (data ?? []) as RecordingRow[];
}

export async function getConversationLogs(
  businessCode: string,
  page: number,
  lookup: LogLookup,
): Promise<ConversationLogsResult> {
  const safePage = Number.isInteger(page) && page > 0 ? page : 0;
  const clients = await matchingClients(businessCode, lookup);
  if (clients && clients.length === 0) return emptyLogs(safePage);

  const phone = phoneSearchNeedle(lookup.phone);
  const mobileClients = phone && !clients
    ? await clientsByMobile(businessCode, phone)
    : null;
  let query = supabase
    .from('conversation_logs')
    .select(LOG_COLUMNS, { count: 'exact' })
    .eq('business_code', businessCode)
    .order('started_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .order('id', { ascending: false });

  if (clients) {
    const match = logMatchFilter(clients);
    if (!match) return emptyLogs(safePage);
    query = query.or(match);
    if (phone) query = query.ilike('client_phone', `%${phone}%`);
  } else if (phone) {
    const match = mobileClients?.length ? logMatchFilter(mobileClients) : '';
    query = query.or(
      [`client_phone.ilike.%${phone}%`, match].filter(Boolean).join(','),
    );
  }

  query = applyStartRange(query, lookup);

  const from = safePage * LOG_PAGE_SIZE;
  const { data, error, count } = await query.range(from, from + LOG_PAGE_SIZE - 1);
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as ConversationLogRow[];
  const [recordings, directory] = await Promise.all([
    recordingsForLogs(
      businessCode,
      rows.map((row) => row.external_id),
    ),
    clientDirectory(businessCode),
  ]);
  const identities = directory.map((client) => ({
    id: client.id,
    fullName: client.full_name ?? null,
    nationalId: client.national_id ?? null,
    mobilePhone: client.mobile_phone,
    whatsappNumber: client.whatsapp_number,
  }));
  const logs = rows.map((row) => {
    const log = toConversationLog(row, recordings);
    const client = findLogClient(log, identities);
    return {
      ...log,
      clientName: client?.fullName?.trim() || null,
      nationalId: client?.nationalId?.trim() || null,
    };
  });
  const result = {
    logs,
    total: count ?? rows.length,
    page: safePage,
    pageSize: LOG_PAGE_SIZE,
  };

  try {
    return { ...result, logs: await attachPlaybackUrls(logs) };
  } catch {
    return result;
  }
}

const SIGNED_URL_TTL_SECONDS = 60 * 60;
const SIGNED_URL_CHUNK_SIZE = 100;

async function attachPlaybackUrls(logs: ConversationLog[]) {
  const paths = [
    ...new Set(
      logs
        .filter((log) => log.storagePath && !log.playbackUrl && !log.purgedRecordingAt)
        .map((log) => log.storagePath as string),
    ),
  ];

  if (paths.length === 0) {
    return logs;
  }

  const signed = await getRecordingSignedUrls(paths);
  return logs.map((log) => ({
    ...log,
    playbackUrl: log.playbackUrl ?? (log.storagePath ? signed[log.storagePath] ?? null : null),
  }));
}

export async function getRecordingSignedUrls(storagePaths: string[]) {
  const signed: Record<string, string> = {};

  for (let index = 0; index < storagePaths.length; index += SIGNED_URL_CHUNK_SIZE) {
    const chunk = storagePaths.slice(index, index + SIGNED_URL_CHUNK_SIZE);
    const { data, error } = await supabase.storage
      .from(RECORDINGS_BUCKET)
      .createSignedUrls(chunk, SIGNED_URL_TTL_SECONDS);

    if (error) {
      throw new Error(error.message);
    }

    for (const item of data ?? []) {
      if (item.path && item.signedUrl && !item.error) {
        signed[item.path] = item.signedUrl;
      }
    }
  }

  return signed;
}

export async function getRecordingSignedUrl(storagePath: string) {
  const { data, error } = await supabase.storage
    .from(RECORDINGS_BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);

  if (error || !data?.signedUrl) {
    throw new Error(error?.message || 'לא ניתן לפתוח את ההקלטה.');
  }

  return data.signedUrl;
}

export async function getRecordingDownloadUrl(storagePath: string, fileName: string) {
  const { data, error } = await supabase.storage
    .from(RECORDINGS_BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS, {
      download: fileName,
    });

  if (error || !data?.signedUrl) {
    throw new Error(error?.message || 'לא ניתן להוריד את ההקלטה.');
  }

  return data.signedUrl;
}
