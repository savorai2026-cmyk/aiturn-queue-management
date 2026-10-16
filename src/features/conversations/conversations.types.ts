export interface ConversationLog {
  id: string;
  externalId: string;
  channel: string;
  clientId?: string | null;
  clientPhone: string | null;
  clientName: string | null;
  nationalId: string | null;
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

export interface LogLookup {
  phone: string;
  nationalId: string;
  clientName: string;
  from: string;
  to: string;
}

export interface ConversationLogsResult {
  logs: ConversationLog[];
  total: number;
  page: number;
  pageSize: number;
}

export interface LogRecordingPlayback {
  audioUrl?: string | null;
  error?: string | null;
}

export type ConversationLogColumnKey =
  | 'startedAt'
  | 'channel'
  | 'clientName'
  | 'nationalId'
  | 'clientPhone'
  | 'durationSeconds'
  | 'summary'
  | 'recording';
