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
  LogRecordingPlayback,
} from './conversations.types';

export const CONVERSATION_LOG_LIMIT = 500;
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

export function formatEstimatedCost(
  value: number | null,
  currency: string,
) {
  if (value == null || !Number.isFinite(value)) {
    return '—';
  }

  const amount = value.toLocaleString('he-IL', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  });
  return currency ? `${amount} ${currency}` : amount;
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
    };
  }

  return {
    key: 'recording',
    label: 'הקלטה',
    value: 'אין הקלטה',
  };
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
    case 'endedAt':
      return formatLogDateTime(log.endedAt);
    case 'channel':
      return formatLogChannel(log.channel);
    case 'clientPhone':
      return log.clientPhone || '—';
    case 'durationSeconds':
      return formatDurationSeconds(log.durationSeconds);
    case 'estimatedCost':
      return formatEstimatedCost(log.estimatedCost, log.currency);
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
    { key: 'endedAt', label: 'סיום', value: formatLogDateTime(log.endedAt) },
    { key: 'channel', label: 'ערוץ', value: formatLogChannel(log.channel) },
    {
      key: 'clientPhone',
      label: 'טלפון',
      value: log.clientPhone || '',
      dir: 'ltr',
    },
    {
      key: 'duration',
      label: 'משך',
      value: formatDurationSeconds(log.durationSeconds),
    },
    {
      key: 'cost',
      label: 'עלות משוערת',
      value: formatEstimatedCost(log.estimatedCost, log.currency),
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
      return columnDigitsInclude(log.clientPhone ?? '', query);
    }

    if (key === 'durationSeconds' && log.durationSeconds != null) {
      return (
        columnExactNumber(log.durationSeconds, query) ||
        columnTextIncludes(formatDurationSeconds(log.durationSeconds), query)
      );
    }

    if (key === 'estimatedCost' && log.estimatedCost != null) {
      return (
        columnExactNumber(log.estimatedCost, query) ||
        columnTextIncludes(
          formatEstimatedCost(log.estimatedCost, log.currency),
          query,
        )
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

  if (sort.key === 'endedAt') {
    return compareByNumber(
      timestampValue(left.endedAt),
      timestampValue(right.endedAt),
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

  if (sort.key === 'estimatedCost') {
    return compareByNumber(
      left.estimatedCost ?? -1,
      right.estimatedCost ?? -1,
      sort.direction,
    );
  }

  if (sort.key === 'clientPhone') {
    return compareByText(
      (left.clientPhone ?? '').replace(/\D/g, ''),
      (right.clientPhone ?? '').replace(/\D/g, ''),
      sort.direction,
    );
  }

  return compareByText(
    formatLogCell(left, sort.key as ConversationLogColumnKey),
    formatLogCell(right, sort.key as ConversationLogColumnKey),
    sort.direction,
  );
}
