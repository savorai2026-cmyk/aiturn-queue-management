import type { DetailRow } from '../../shared/displayFields/types';
import {
  columnDigitsInclude,
  columnExactNumber,
  columnTextIncludes,
  compareByNumber,
  compareByText,
  type ColumnFilters,
  type ColumnSort,
} from '../../shared/displayFields/columnTable';
import type {
  ConversationLog,
  ConversationLogColumnKey,
  LogLookup,
  LogRecordingPlayback,
} from './conversations.types';

export const LOG_PAGE_SIZE = 100;
export const RECORDINGS_BUCKET = 'recordings';

const CHANNEL_LABELS: Record<string, string> = {
  whatsapp: 'WhatsApp',
  wa: 'WhatsApp',
  voice: 'קול',
  vapi: 'קול',
  phone: 'קול',
  call: 'קול',
};

export function formatLogChannel(channel: string) {
  return CHANNEL_LABELS[channel.trim().toLowerCase()] ?? channel;
}

export function formatDurationSeconds(value: number | null) {
  if (value == null || !Number.isFinite(value)) {
    return '—';
  }

  const total = Math.max(0, Math.round(value));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  if (minutes === 0) {
    return `${seconds} שנ׳`;
  }
  if (seconds === 0) {
    return `${minutes} דק׳`;
  }
  return `${minutes} דק׳ ${seconds} שנ׳`;
}

export function formatLogDateTime(value: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString('he-IL', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

export function logSearchText(value: string) {
  return value.trim().replace(/[%_*,().\\]/g, '');
}

export function phoneSearchNeedle(value: string | null | undefined) {
  const digits = (value ?? '').replace(/\D/g, '');
  if (!digits) return '';
  const local = digits.startsWith('972') ? digits.slice(3) : digits;
  return local.startsWith('0') ? local.slice(1) : local;
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function defaultLogDateRange(now = new Date()) {
  const from = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
  return { from: toDateKey(from), to: toDateKey(now) };
}

export function defaultLogLookup(now = new Date()): LogLookup {
  return {
    phone: '',
    nationalId: '',
    clientName: '',
    ...defaultLogDateRange(now),
  };
}

export function logRangeBound(dateKey: string, bound: 'start' | 'end') {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return '';
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = bound === 'start'
    ? new Date(year, month - 1, day, 0, 0, 0, 0)
    : new Date(year, month - 1, day, 23, 59, 59, 999);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

export function nationalIdSearch(value: string) {
  return logSearchText(value).replace(/\D/g, '');
}

export interface LogClientIdentity {
  id: number;
  fullName: string | null;
  nationalId: string | null;
  mobilePhone: string | null;
  whatsappNumber: string | null;
}

export function findLogClient(
  log: Pick<ConversationLog, 'clientId' | 'clientPhone'>,
  clients: LogClientIdentity[],
) {
  if (log.clientId) {
    const byId = clients.find((client) => String(client.id) === log.clientId);
    if (byId) return byId;
  }

  const needle = phoneSearchNeedle(log.clientPhone);
  if (!needle) return null;

  return (
    clients.find((client) => phoneSearchNeedle(client.mobilePhone) === needle) ??
    clients.find((client) => phoneSearchNeedle(client.whatsappNumber) === needle) ??
    null
  );
}

export function formatIsraeliPhone(value: string | null | undefined) {
  const raw = value?.trim() ?? '';
  if (!raw) return '';

  let digits = raw.replace(/\D/g, '');
  if (!digits) return raw;
  if (digits.startsWith('972')) {
    digits = `0${digits.slice(3)}`;
  }
  return digits;
}

export function storageFileStem(path: string) {
  const file = path.split('/').pop() ?? path;
  const dot = file.lastIndexOf('.');
  return (dot > 0 ? file.slice(0, dot) : file).toLowerCase();
}

export function findRecordingForLog(
  recordings: Array<{ storagePath: string; mime: string | null }>,
  externalId: string | null | undefined,
) {
  if (!externalId) return null;
  const needle = externalId.trim().toLowerCase();
  return (
    recordings.find((recording) => storageFileStem(recording.storagePath) === needle) ??
    null
  );
}

function recordingDetailRow(
  log: ConversationLog,
  playback?: LogRecordingPlayback,
): DetailRow {
  if (log.purgedRecordingAt) {
    return {
      key: 'recording',
      label: 'הקלטה',
      value: 'ההקלטה נמחקה לפי מדיניות השמירה',
    };
  }

  const readyUrl = playback?.audioUrl || logPlaybackUrl(log);
  if (readyUrl) {
    return {
      key: 'recording',
      label: 'הקלטה',
      value: '',
      audioUrl: readyUrl,
      downloadPath: log.storagePath,
      downloadName: recordingDownloadName(log),
      durationSeconds: log.durationSeconds,
    };
  }

  if (playback?.error) {
    return {
      key: 'recording',
      label: 'הקלטה',
      value: playback.error,
    };
  }

  if (log.storagePath) {
    return {
      key: 'recording',
      label: 'הקלטה',
      value: 'טוען הקלטה...',
      downloadPath: log.storagePath,
      downloadName: recordingDownloadName(log),
    };
  }

  return {
    key: 'recording',
    label: 'הקלטה',
    value: 'אין הקלטה',
  };
}

export function recordingDownloadName(
  log: Pick<ConversationLog, 'storagePath' | 'externalId' | 'recordingMime'>,
) {
  const fromPath = log.storagePath?.split('/').pop()?.trim();
  if (fromPath) return fromPath;

  const mime = log.recordingMime ?? '';
  const extension = mime.includes('mpeg') || mime.includes('mp3')
    ? 'mp3'
    : mime.includes('wav')
      ? 'wav'
      : mime.includes('mp4')
        ? 'mp4'
        : mime.includes('webm')
          ? 'webm'
          : 'ogg';
  return `recording-${log.externalId || 'call'}.${extension}`;
}

export function logRecordingLabel(log: ConversationLog) {
  if (log.purgedRecordingAt) {
    return 'נמחקה';
  }

  if (hasPlayableRecording(log)) {
    return 'יש הקלטה';
  }

  return 'אין הקלטה';
}

export function remoteRecordingUrl(value: string | null | undefined) {
  const trimmed = value?.trim() ?? '';
  return /^https?:\/\//i.test(trimmed) ? trimmed : null;
}

export function logPlaybackUrl(log: ConversationLog) {
  return remoteRecordingUrl(log.playbackUrl) ?? remoteRecordingUrl(log.recordingUrl);
}

export function hasPlayableRecording(log: ConversationLog) {
  return Boolean(log.storagePath) || Boolean(logPlaybackUrl(log));
}

export function formatLogCell(
  log: ConversationLog,
  key: ConversationLogColumnKey,
) {
  switch (key) {
    case 'startedAt':
      return formatLogDateTime(log.startedAt ?? log.createdAt);
    case 'channel':
      return formatLogChannel(log.channel);
    case 'clientName':
      return log.clientName?.trim() || '—';
    case 'nationalId':
      return log.nationalId?.trim() || '—';
    case 'clientPhone':
      return formatIsraeliPhone(log.clientPhone) || '—';
    case 'durationSeconds':
      return formatDurationSeconds(log.durationSeconds);
    case 'summary':
      return log.summary || '—';
    case 'recording':
      return logRecordingLabel(log);
  }
}

export function toConversationDetailRows(
  log: ConversationLog,
  playback?: LogRecordingPlayback,
): DetailRow[] {
  const transcript = log.purgedDetailAt
    ? 'התמלול נמחק לפי מדיניות השמירה'
    : log.transcript ?? '';

  return [
    { key: 'startedAt', label: 'התחלה', value: formatLogDateTime(log.startedAt) },
    { key: 'channel', label: 'ערוץ', value: formatLogChannel(log.channel) },
    { key: 'clientName', label: 'שם לקוח', value: log.clientName?.trim() || '—' },
    {
      key: 'nationalId',
      label: 'תעודת זהות',
      value: log.nationalId?.trim() || '—',
      dir: 'ltr',
    },
    {
      key: 'clientPhone',
      label: 'טלפון',
      value: formatIsraeliPhone(log.clientPhone),
      dir: 'ltr',
    },
    {
      key: 'duration',
      label: 'משך',
      value: formatDurationSeconds(log.durationSeconds),
    },
    { key: 'summary', label: 'סיכום', value: log.summary || '' },
    { key: 'transcript', label: 'תמלול', value: transcript },
    recordingDetailRow(log, playback),
  ];
}

export function filterAndSortLogs(
  logs: ConversationLog[],
  filters: ColumnFilters,
  sort: ColumnSort | null,
) {
  const filtered = logs.filter((log) => matchesLogColumnFilters(log, filters));
  if (!sort) return filtered;

  return [...filtered].sort((left, right) => {
    const compared = compareLogs(left, right, sort);
    return compared !== 0 ? compared : left.id.localeCompare(right.id);
  });
}

function timestampValue(value: string | null) {
  return value ? Date.parse(value) || 0 : 0;
}

function matchesLogColumnFilters(log: ConversationLog, filters: ColumnFilters) {
  return Object.entries(filters).every(([key, raw]) => {
    const query = raw.trim();
    if (!query) return true;

    if (key === 'channel') {
      return (
        log.channel === query ||
        columnTextIncludes(formatLogChannel(log.channel), query)
      );
    }

    if (key === 'clientPhone') {
      const shown = formatIsraeliPhone(log.clientPhone);
      return (
        columnDigitsInclude(shown, query) ||
        columnDigitsInclude(log.clientPhone ?? '', query)
      );
    }

    if (key === 'durationSeconds' && log.durationSeconds != null) {
      return (
        columnExactNumber(log.durationSeconds, query) ||
        columnTextIncludes(formatDurationSeconds(log.durationSeconds), query)
      );
    }

    return columnTextIncludes(
      formatLogCell(log, key as ConversationLogColumnKey),
      query,
    );
  });
}

function compareLogs(
  left: ConversationLog,
  right: ConversationLog,
  sort: ColumnSort,
) {
  if (sort.key === 'startedAt') {
    return compareByNumber(
      timestampValue(left.startedAt ?? left.createdAt),
      timestampValue(right.startedAt ?? right.createdAt),
      sort.direction,
    );
  }

  if (sort.key === 'durationSeconds') {
    return compareByNumber(
      left.durationSeconds ?? -1,
      right.durationSeconds ?? -1,
      sort.direction,
    );
  }

  if (sort.key === 'clientPhone') {
    return compareByText(
      formatIsraeliPhone(left.clientPhone),
      formatIsraeliPhone(right.clientPhone),
      sort.direction,
    );
  }

  return compareByText(
    formatLogCell(left, sort.key as ConversationLogColumnKey),
    formatLogCell(right, sort.key as ConversationLogColumnKey),
    sort.direction,
  );
}
