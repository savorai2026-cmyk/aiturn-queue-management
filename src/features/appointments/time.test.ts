import { describe, expect, it } from 'vitest';
import { nowInTimeZone, toDateKey, toTimeHm } from './time';

describe('nowInTimeZone', () => {
  const instant = new Date(Date.UTC(2026, 10, 7, 22, 30, 0));

  it('reads the wall clock of the business timezone', () => {
    const jerusalem = nowInTimeZone('Asia/Jerusalem', instant);
    expect(toDateKey(jerusalem)).toBe('2026-11-08');
    expect(toTimeHm(jerusalem)).toBe('00:30');

    const newYork = nowInTimeZone('America/New_York', instant);
    expect(toDateKey(newYork)).toBe('2026-11-07');
    expect(toTimeHm(newYork)).toBe('17:30');
  });

  it('falls back to the browser clock for a missing or unknown timezone', () => {
    expect(nowInTimeZone(null, instant).getTime()).toBe(instant.getTime());
    expect(nowInTimeZone('Not/AZone', instant).getTime()).toBe(instant.getTime());
  });
});
