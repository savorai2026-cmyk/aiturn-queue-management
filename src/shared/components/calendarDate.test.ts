import { describe, expect, it } from 'vitest';
import { getMonthGrid, isDateKeyInRange, parseDateKey, shiftMonth } from './calendarDate';

describe('date field helpers', () => {
  it('parses an ISO date key', () => {
    expect(parseDateKey('2026-08-28')).toEqual({
      year: 2026,
      month: 8,
      day: 28,
    });
  });

  it('builds a Sunday-first month grid', () => {
    const grid = getMonthGrid(2026, 8);
    expect(grid[0]?.dateKey).toBe('2026-07-26');
    expect(grid.find((cell) => cell.dateKey === '2026-08-01')?.inMonth).toBe(true);
    expect(grid.length % 7).toBe(0);
  });

  it('shifts months across year boundaries', () => {
    expect(shiftMonth(2026, 1, -1)).toEqual({ year: 2025, month: 12 });
  });

  it('respects min and max bounds', () => {
    expect(isDateKeyInRange('2026-08-28', '2026-08-26', '2026-09-10')).toBe(true);
    expect(isDateKeyInRange('2026-08-20', '2026-08-26')).toBe(false);
  });
});
