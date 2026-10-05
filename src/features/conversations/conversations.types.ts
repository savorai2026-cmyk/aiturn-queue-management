export interface ConversationLog {
  id: string;
  externalId: string;
  channel: string;
  clientPhone: string | null;
  startedAt: string | null;
  endedAt: string | null;
  durationSeconds: number | null;
  estimatedCost: number | null;
  currency: string;
  outcome: string | null;
  model: string | null;
  transcript: string | null;
  summary: string | null;
  recordingUrl: string | null;
  playbackUrl?: string | null;
  storagePath: string | null;
  recordingMime: string | null;
  purgedDetailAt: string | null;
  purgedRecordingAt: string | null;
  createdAt: string;
}

export interface ConversationLogsResult {
  logs: ConversationLog[];
  truncated: boolean;
}

export interface LogRecordingPlayback {
  audioUrl?: string | null;
  error?: string | null;
}

export type ConversationLogColumnKey =
  | 'startedAt'
  | 'endedAt'
  | 'channel'
  | 'clientPhone'
  | 'durationSeconds'
  | 'estimatedCost'
  | 'summary'
  | 'recording';
