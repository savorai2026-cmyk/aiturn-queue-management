import { describe, expect, it } from 'vitest';
import {
  getBookingMaxDate,
  getBookingRangeEndExclusive,
  parseWorkingHours,
  toWorkingDayDrafts,
  toWorkingHoursPayload,
  validateWorkingDayDrafts,
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
});
