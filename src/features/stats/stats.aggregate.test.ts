import { describe, expect, it } from 'vitest';
import { summarizeStats } from './stats.aggregate';
import { statsRange } from './stats.range';
import type { StatsAppointment } from './stats.types';

const ROW: StatsAppointment = {
  clientId: 1,
  clientName: 'ישראל ישראלי',
  date: '2026-11-18',
  startTime: '09:30:00',
  status: '03',
  channel: 'whatsapp',
  price: 120,
  serviceTitles: ['עיצוב גבות'],
};

describe('statsRange', () => {
  it('covers the last 30 days by default month', () => {
    expect(statsRange('month', new Date(2026, 10, 18))).toEqual({
      from: '2026-10-20',
      to: '2026-11-18',
    });
  });
});

describe('summarizeStats', () => {
  it('counts outcomes, money, services, hours, and channels', () => {
    const summary = summarizeStats(
      [
        ROW,
        {
          ...ROW,
          date: '2026-11-17',
          startTime: '15:00:00',
          status: '10',
          channel: 'manual',
          price: 80,
          serviceTitles: ['עיצוב גבות', 'לק ג׳ל'],
        },
        {
          ...ROW,
          status: '02',
          channel: null,
          price: 0,
          serviceTitles: [],
        },
      ],
      '2026-11-17',
      '2026-11-18',
    );

    expect(summary.total).toBe(3);
    expect(summary.completed).toBe(1);
    expect(summary.canceled).toBe(1);
    expect(summary.revenue).toBe(200);
    expect(summary.byDay.map((bar) => [bar.label, bar.value])).toEqual([
      ['17.11', 1],
      ['18.11', 2],
    ]);
    expect(summary.byService.find((bar) => bar.label === 'עיצוב גבות')?.value).toBe(2);
    expect(summary.byService.find((bar) => bar.label === 'בלי שירות')?.value).toBe(1);
    expect(summary.byHour.map((bar) => bar.label)).toEqual(['09:00', '15:00']);
    expect(summary.byChannel.map((bar) => bar.label)).toEqual(
      expect.arrayContaining(['וואטסאפ', 'ידני', 'לא צוין']),
    );
  });
});
