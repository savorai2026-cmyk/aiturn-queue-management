import { describe, expect, it } from 'vitest';
import {
  filterAndSortLogs,
  findRecordingForLog,
  formatDurationSeconds,
  formatEstimatedCost,
  formatLogChannel,
  logRecordingLabel,
  storageFileStem,
  toConversationDetailRows,
} from './conversations.mappers';
import type { ConversationLog } from './conversations.types';

const LOG: ConversationLog = {
  id: 'log-1',
  externalId: '01a0bdbf-8154-7dd6-ae94-ff6163b0f3b6',
  channel: 'whatsapp',
  clientPhone: '0501234567',
  startedAt: '2026-09-20T07:00:00.000Z',
  endedAt: '2026-09-20T07:04:00.000Z',
  durationSeconds: 125,
  estimatedCost: 1.5,
  currency: 'USD',
  outcome: 'booked',
  model: 'gpt-4.1',
  transcript: 'שלום, אפשר לקבוע תור?',
  summary: 'נקבע תור',
  recordingUrl: null,
  storagePath:
    'e947f750-6299-4bae-a963-3c3d26592abd/2026/01a0bdbf-8154-7dd6-ae94-ff6163b0f3b6.ogg',
  recordingMime: 'audio/mpeg',
  purgedDetailAt: null,
  purgedRecordingAt: null,
  createdAt: '2026-09-20T07:00:00.000Z',
};

describe('conversation log mappers', () => {
  it('formats channel, duration and cost', () => {
    expect(formatLogChannel('vapi')).toBe('קול');
    expect(formatDurationSeconds(125)).toBe('2 דק׳ 5 שנ׳');
    expect(formatDurationSeconds(45)).toBe('45 שנ׳');
    expect(formatEstimatedCost(1.5, 'USD')).toBe('1.5 USD');
  });

  it('matches a storage file to the log external id', () => {
    expect(
      storageFileStem(
        'e947f750-6299-4bae-a963-3c3d26592abd/2026/01a0bdbf-8154-7dd6-ae94-ff6163b0f3b6.ogg',
      ),
    ).toBe('01a0bdbf-8154-7dd6-ae94-ff6163b0f3b6');

    expect(
      findRecordingForLog(
        [
          {
            storagePath:
              'e947f750-6299-4bae-a963-3c3d26592abd/2026/01a0bdbf-8154-7dd6-ae94-ff6163b0f3b6.ogg',
            mime: 'audio/ogg',
          },
        ],
        LOG.externalId,
      )?.storagePath,
    ).toContain(LOG.externalId);
  });

  it('omits tool calls, outcome and model from the details popup', () => {
    const keys = toConversationDetailRows(LOG).map((row) => row.key);
    expect(keys).not.toContain('toolCalls');
    expect(keys).not.toContain('outcome');
    expect(keys).not.toContain('model');
  });

  it('exposes a playable recording in the recording row', () => {
    const row = toConversationDetailRows(LOG, {
      audioUrl: 'https://example.com/rec.ogg',
    }).find((item) => item.key === 'recording');
    expect(row?.audioUrl).toBe('https://example.com/rec.ogg');
    expect(row?.value).toBe('');
    expect(
      toConversationDetailRows({
        ...LOG,
        playbackUrl: 'https://example.com/signed.ogg',
      }).find((item) => item.key === 'recording')?.audioUrl,
    ).toBe('https://example.com/signed.ogg');
  });

  it('replaces purged transcript in details', () => {
    const rows = toConversationDetailRows({
      ...LOG,
      purgedDetailAt: '2026-09-21T00:00:00.000Z',
      transcript: 'secret',
    });
    expect(rows.find((row) => row.key === 'transcript')?.value).toBe(
      'התמלול נמחק לפי מדיניות השמירה',
    );
  });

  it('filters and sorts logs by column', () => {
    const later = {
      ...LOG,
      id: 'log-2',
      channel: 'vapi',
      clientPhone: '0509999999',
      durationSeconds: 10,
      startedAt: '2026-09-21T07:00:00.000Z',
    };

    expect(
      filterAndSortLogs([LOG, later], { channel: 'קול' }, null).map((log) => log.id),
    ).toEqual(['log-2']);

    expect(
      filterAndSortLogs([LOG, later], { clientPhone: '050123' }, null).map(
        (log) => log.id,
      ),
    ).toEqual(['log-1']);

    expect(
      filterAndSortLogs(
        [LOG, later],
        {},
        { key: 'durationSeconds', direction: 'asc' },
      ).map((log) => log.id),
    ).toEqual(['log-2', 'log-1']);
  });

  it('labels whether a log has a playable recording', () => {
    expect(logRecordingLabel(LOG)).toBe('יש הקלטה');
    expect(logRecordingLabel({ ...LOG, storagePath: null })).toBe('אין הקלטה');
    expect(
      logRecordingLabel({
        ...LOG,
        purgedRecordingAt: '2026-09-21T00:00:00.000Z',
      }),
    ).toBe('נמחקה');
  });
});
