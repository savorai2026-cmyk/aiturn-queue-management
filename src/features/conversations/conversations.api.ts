import { supabase } from '../../supabaseClient';
import {
  CONVERSATION_LOG_LIMIT,
  RECORDINGS_BUCKET,
  findRecordingForLog,
  remoteRecordingUrl,
} from './conversations.mappers';
import type {
  ConversationLog,
  ConversationLogsResult,
} from './conversations.types';

interface ConversationLogRow {
  id: string;
  external_id: string;
  channel: string;
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
    clientPhone: row.client_phone,
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

export async function getConversationLogs(
  businessCode: string,
): Promise<ConversationLogsResult> {
  const [logsResult, recordingsResult] = await Promise.all([
    supabase
      .from('conversation_logs')
      .select(
        'id, external_id, channel, client_phone, started_at, ended_at, duration_seconds, estimated_cost, currency, outcome, model, transcript, summary, recording_url, purged_detail_at, purged_recording_at, created_at',
      )
      .eq('business_code', businessCode)
      .order('created_at', { ascending: false })
      .limit(CONVERSATION_LOG_LIMIT),
    supabase
      .from('recordings')
      .select('storage_path, mime')
      .eq('business_code', businessCode),
  ]);

  if (logsResult.error) {
    throw new Error(logsResult.error.message);
  }

  if (recordingsResult.error) {
    throw new Error(recordingsResult.error.message);
  }

  const rows = (logsResult.data ?? []) as ConversationLogRow[];
  const recordings = (recordingsResult.data ?? []) as RecordingRow[];
  const logs = rows.map((row) => toConversationLog(row, recordings));
  const truncated = rows.length >= CONVERSATION_LOG_LIMIT;

  try {
    return {
      logs: await attachPlaybackUrls(logs),
      truncated,
    };
  } catch {
    return { logs, truncated };
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
