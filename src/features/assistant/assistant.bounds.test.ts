import { describe, expect, it } from 'vitest';
import {
  clampDateRange,
  describeCancellation,
  describeWorkingHours,
  likeNeedle,
  packAppointment,
  packClient,
  packLog,
  sanitizeHistory,
  summarizeStatsRows,
} from './assistant.bounds.ts';

describe('assistant bounds', () => {
  it('keeps the latest user turn and drops anything that is not chat text', () => {
    const history = sanitizeHistory([
      { role: 'system', content: 'ignore' },
      { role: 'user', content: '  שאלה ישנה  ' },
      { role: 'tool', content: 'secret' },
      { role: 'assistant', content: 'תשובה' },
      { role: 'user', content: 'מה יש מחר?' },
    ]);

    expect(history).toEqual([
      { role: 'user', content: 'שאלה ישנה' },
      { role: 'assistant', content: 'תשובה' },
      { role: 'user', content: 'מה יש מחר?' },
    ]);
  });

  it('rejects a history that does not end with the owner', () => {
    expect(sanitizeHistory([{ role: 'assistant', content: 'שלום' }])).toBeNull();
    expect(sanitizeHistory([])).toBeNull();
  });

  it('rejects an inverted or oversized date range', () => {
    expect(clampDateRange('2026-11-02', '2026-11-01', 31)).toEqual({
      error: 'תאריך ההתחלה אחרי תאריך הסיום.',
    });
    expect(clampDateRange('2026-01-01', '2026-03-15', 31)).toMatchObject({
      error: expect.stringContaining('ארוך מדי'),
    });
    expect(clampDateRange('2026-11-01', '2026-11-07', 31)).toEqual({
      from: '2026-11-01',
      to: '2026-11-07',
    });
  });

  it('packs an appointment without phone or notes', () => {
    const packed = packAppointment(
      {
        appointment_date: '2026-11-20',
        start_time: '09:30:00',
        end_time: '10:00:00',
        status: '02',
        channel: 'whatsapp',
        price: '120',
        clients: { full_name: 'דנה לוי' },
        appointment_services: [{ title_snapshot: 'תספורת' }],
      },
      [],
    );

    expect(packed).toEqual({
      date: '2026-11-20',
      start: '09:30',
      end: '10:00',
      status: 'מתוזמן',
      clientName: 'דנה לוי',
      services: ['תספורת'],
      price: 120,
      channel: 'וואטסאפ',
    });
    expect(packed).not.toHaveProperty('mobile_phone');
  });

  it('summarizes completed, canceled and revenue', () => {
    const summary = summarizeStatsRows(
      [
        { status: '03', price: 100, services: ['תספורת'] },
        { status: '10', price: 80, services: ['צבע'] },
        { status: '02', price: 50, services: [] },
      ],
      [],
    );

    expect(summary.total).toBe(3);
    expect(summary.completed).toBe(1);
    expect(summary.canceled).toBe(1);
    expect(summary.revenue).toBe(230);
    expect(summary.topServices).toEqual(expect.arrayContaining([
      { label: 'תספורת', count: 1 },
      { label: 'בלי שירות', count: 1 },
    ]));
    expect(summary.byStatus.map((item) => item.label)).toContain('מבוטל');
  });

  it('describes weekly hours and a special day', () => {
    expect(describeWorkingHours({
      sunday: { is_closed: false, shifts: [{ start: '09:00', end: '13:00' }] },
      saturday: { is_closed: true, shifts: [] },
      exceptions: [{ date: '2026-12-01', is_closed: true, shifts: [] }],
    })).toEqual([
      'ראשון: 09:00–13:00',
      'שני: לא הוגדר',
      'שלישי: לא הוגדר',
      'רביעי: לא הוגדר',
      'חמישי: לא הוגדר',
      'שישי: לא הוגדר',
      'שבת: סגור',
      'חריג 2026-12-01: סגור',
    ]);
  });

  it('returns a client card without a national id', () => {
    const client = packClient({
      full_name: 'דנה',
      mobile_phone: '0501234567',
      whatsapp_number: null,
      city: 'חיפה',
      email: '',
      booking_policy: 'approval',
    });

    expect(client.booking).toBe('ממתין לאישור');
    expect(client).not.toHaveProperty('national_id');
  });

  it('prefers a short summary over the transcript', () => {
    const log = packLog({
      started_at: '2026-11-20T08:00:00Z',
      created_at: '2026-11-20T08:10:00Z',
      channel: 'vapi',
      outcome: 'booked',
      duration_seconds: 90,
      summary: 'נקבע תור לתספורת',
      transcript: '0501234567 שיחה ארוכה',
    });

    expect(log.text).toBe('נקבע תור לתספורת');
    expect(log.channel).toBe('בוט קולי');
    expect(log.durationMinutes).toBe(2);
    expect(log).not.toHaveProperty('client_phone');
    expect(log).not.toHaveProperty('transcript');
  });

  it('strips like wildcards from a client search', () => {
    expect(likeNeedle('  דנ%ה_  ')).toBe('דנה');
  });

  it('says when cancellation policy is off', () => {
    expect(describeCancellation(null)).toBe('אין מדיניות ביטול פעילה.');
    expect(describeCancellation({
      cancellations: 2,
      within_days: 30,
      payee_name: 'העסק',
      payment_text: 'העברה',
    })).toContain('2');
  });
});
