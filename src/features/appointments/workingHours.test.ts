import { describe, expect, it } from 'vitest';
import {
  createSpecialDayFromWeekly,
  getBookingMaxDate,
  getBookingRangeEndExclusive,
  parseWorkingHourExceptions,
  parseWorkingHours,
  resolveWorkingDay,
  toFullCalendarBusinessHoursForRange,
  toWorkingDayDrafts,
  toWorkingHoursPayload,
  validateWorkingDayDrafts,
  validateWorkingHourExceptions,
} from './workingHours';

describe('working hours', () => {
  it('parses stored weekday shifts', () => {
    const hours = parseWorkingHours({
      sunday: { is_closed: false, shifts: [{ start: '09:00:00', end: '18:00:00' }] },
      saturday: { is_closed: true, shifts: [] },
    });

    expect(hours?.sunday).toEqual({
      is_closed: false,
      shifts: [{ start: '09:00', end: '18:00' }],
    });
    expect(hours?.saturday?.is_closed).toBe(true);
  });

  it('turns drafts into a payload the calendar can read', () => {
    const drafts = toWorkingDayDrafts(null).map((day) =>
      day.key === 'saturday' ? { ...day, isOpen: false } : { ...day, isOpen: true },
    );
    const payload = toWorkingHoursPayload(drafts);
    const parsed = parseWorkingHours(payload);

    expect(parsed?.monday?.is_closed).toBe(false);
    expect(parsed?.saturday?.is_closed).toBe(true);
    expect(parsed?.friday?.shifts?.[0]?.end).toBe('13:00');
    expect(parsed?.monday?.shifts).toEqual([{ start: '09:00', end: '18:00' }]);
  });

  it('keeps several weekday segments through a save roundtrip', () => {
    const drafts = toWorkingDayDrafts(null).map((day) =>
      day.key === 'tuesday'
        ? {
            ...day,
            isOpen: true,
            shifts: [
              { start: '09:00', end: '14:00' },
              { start: '15:00', end: '18:00' },
            ],
          }
        : day,
    );
    const payload = toWorkingHoursPayload(drafts);
    const parsed = parseWorkingHours(payload);

    expect(parsed?.tuesday?.shifts).toEqual([
      { start: '09:00', end: '14:00' },
      { start: '15:00', end: '18:00' },
    ]);
  });

  it('rejects overlapping weekday segments', () => {
    const drafts = toWorkingDayDrafts(null).map((day) =>
      day.key === 'tuesday'
        ? {
            ...day,
            isOpen: true,
            shifts: [
              { start: '09:00', end: '14:00' },
              { start: '13:00', end: '18:00' },
            ],
          }
        : day,
    );

    expect(validateWorkingDayDrafts(drafts)).toMatch(/חופפ/);
  });

  it('copies all weekly segments onto a special day', () => {
    const drafts = toWorkingDayDrafts(null).map((day) =>
      day.key === 'wednesday'
        ? {
            ...day,
            isOpen: true,
            shifts: [
              { start: '08:00', end: '12:00' },
              { start: '16:00', end: '19:00' },
            ],
          }
        : day,
    );

    expect(
      createSpecialDayFromWeekly(drafts, '2026-09-23').shifts,
    ).toEqual([
      { start: '08:00', end: '12:00' },
      { start: '16:00', end: '19:00' },
    ]);
  });

  it('rejects a week with no open days', () => {
    const drafts = toWorkingDayDrafts(null).map((day) => ({
      ...day,
      isOpen: false,
    }));

    expect(validateWorkingDayDrafts(drafts)).toMatch(/יום עבודה/);
  });

  it('computes an inclusive booking window', () => {
    expect(getBookingMaxDate(14, new Date(2026, 7, 26))).toBe('2026-09-09');
    expect(getBookingRangeEndExclusive(14, new Date(2026, 7, 26))).toBe(
      '2026-09-10',
    );
    expect(getBookingMaxDate(null)).toBeNull();
  });

  it('stores and resolves date exceptions over the weekly template', () => {
    const drafts = toWorkingDayDrafts(null);
    const payload = toWorkingHoursPayload(drafts, [
      {
        date: '2026-09-25',
        is_closed: false,
        shifts: [
          { start: '09:00', end: '13:00' },
          { start: '16:00', end: '20:00' },
        ],
        note: 'חצי יום עם ערב',
      },
      { date: '2026-09-26', is_closed: true, shifts: [] },
    ]);

    const exceptions = parseWorkingHourExceptions(payload);
    expect(exceptions).toHaveLength(2);
    expect(
      resolveWorkingDay(parseWorkingHours(payload), exceptions, '2026-09-25')
        ?.shifts,
    ).toEqual([
      { start: '09:00', end: '13:00' },
      { start: '16:00', end: '20:00' },
    ]);
    expect(
      resolveWorkingDay(parseWorkingHours(payload), exceptions, '2026-09-26')
        ?.is_closed,
    ).toBe(true);
  });

  it('rejects overlapping special-day shifts', () => {
    expect(
      validateWorkingHourExceptions([
        {
          date: '2026-09-25',
          is_closed: false,
          shifts: [
            { start: '09:00', end: '14:00' },
            { start: '13:00', end: '18:00' },
          ],
        },
      ]),
    ).toMatch(/חופפ/);
  });

  it('marks a closed special day as non-business instead of leaving it open', () => {
    const hours = parseWorkingHours({
      sunday: { is_closed: false, shifts: [{ start: '09:00', end: '18:00' }] },
      friday: { is_closed: false, shifts: [{ start: '09:00', end: '13:00' }] },
    });
    const expanded = toFullCalendarBusinessHoursForRange(
      hours,
      [{ date: '2026-09-25', is_closed: true, shifts: [], note: 'יום גיבוש' }],
      '2026-09-20',
      '2026-09-26',
    );

    expect(
      expanded.some(
        (item) =>
          item.startRecur === '2026-09-20' &&
          item.startTime === '09:00' &&
          item.endTime === '18:00',
      ),
    ).toBe(true);
    expect(
      expanded.some(
        (item) =>
          item.startRecur === '2026-09-25' &&
          item.startTime === '00:00' &&
          item.endTime === '00:01',
      ),
    ).toBe(true);
    expect(
      expanded.some(
        (item) => item.startRecur === '2026-09-25' && item.startTime === '09:00',
      ),
    ).toBe(false);
  });

  it('maps an open special day to local recurring hours', () => {
    const hours = parseWorkingHours({
      friday: { is_closed: false, shifts: [{ start: '09:00', end: '18:00' }] },
    });
    const expanded = toFullCalendarBusinessHoursForRange(
      hours,
      [
        {
          date: '2026-09-25',
          is_closed: false,
          shifts: [{ start: '09:00', end: '12:00' }],
        },
      ],
      '2026-09-25',
      '2026-09-26',
    );

    expect(expanded).toEqual([
      {
        startTime: '09:00',
        endTime: '12:00',
        startRecur: '2026-09-25',
        endRecur: '2026-09-26',
      },
    ]);
  });
});
