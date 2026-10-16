import { describe, expect, it } from 'vitest';
import {
  filterAndSortLogs,
  findLogClient,
  findRecordingForLog,
  defaultLogDateRange,
  formatDurationSeconds,
  logRangeBound,
  formatIsraeliPhone,
  logSearchText,
  nationalIdSearch,
  phoneSearchNeedle,
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
  clientName: 'דנה לוי',
  nationalId: '123456782',
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
  it('formats channel, duration and local phone numbers', () => {
    expect(formatLogChannel('vapi')).toBe('קול');
    expect(formatDurationSeconds(125)).toBe('2 דק׳ 5 שנ׳');
    expect(formatDurationSeconds(45)).toBe('45 שנ׳');
    expect(formatIsraeliPhone('+972501234567')).toBe('0501234567');
    expect(formatIsraeliPhone('972-50-123-4567')).toBe('0501234567');
    expect(formatIsraeliPhone('0501234567')).toBe('0501234567');
    expect(phoneSearchNeedle('+972501234567')).toBe('501234567');
    expect(phoneSearchNeedle('050-123-4567')).toBe('501234567');
    expect(phoneSearchNeedle('אין')).toBe('');
    expect(nationalIdSearch('12-3456782')).toBe('123456782');
    expect(logSearchText(' אביב% ')).toBe('אביב');
    expect(defaultLogDateRange(new Date(2026, 9, 16))).toEqual({
      from: '2026-07-16',
      to: '2026-10-16',
    });
    const start = new Date(logRangeBound('2026-10-16', 'start'));
    expect(start.getFullYear()).toBe(2026);
    expect(start.getMonth()).toBe(9);
    expect(start.getDate()).toBe(16);
    expect(start.getHours()).toBe(0);
    const end = new Date(logRangeBound('2026-10-16', 'end'));
    expect(end.getHours()).toBe(23);
    expect(end.getMinutes()).toBe(59);
  });

  it('matches a log to the client mobile before the WhatsApp number', () => {
    const clients = [
      {
        id: 4,
        fullName: 'דנה לוי',
        nationalId: '123456782',
        mobilePhone: '0501234567',
        whatsappNumber: null,
      },
      {
        id: 9,
        fullName: 'אחר',
        nationalId: '999',
        mobilePhone: '0500000000',
        whatsappNumber: '+972501234567',
      },
    ];

    expect(findLogClient(LOG, clients)?.fullName).toBe('דנה לוי');
    expect(
      findLogClient({ ...LOG, clientPhone: '+972500000000', clientId: '9' }, clients)?.id,
    ).toBe(9);
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
    expect(keys).not.toContain('endedAt');
    expect(keys).not.toContain('cost');
  });

  it('exposes a playable recording in the recording row', () => {
    const row = toConversationDetailRows(LOG, {
      audioUrl: 'https://example.com/rec.ogg',
    }).find((item) => item.key === 'recording');
    expect(row?.audioUrl).toBe('https://example.com/rec.ogg');
    expect(row?.downloadName).toContain(LOG.externalId);
    expect(row?.durationSeconds).toBe(125);
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
        [{ ...LOG, id: 'log-3', clientPhone: '+972501234567' }],
        { clientPhone: '050123' },
        null,
      ).map((log) => log.id),
    ).toEqual(['log-3']);

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
