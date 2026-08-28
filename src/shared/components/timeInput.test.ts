import { describe, expect, it } from 'vitest';
import {
  formatTimeParts,
  minuteOptions,
  parseTimeParts,
} from './timeInput';

describe('time input helpers', () => {
  it('parses 24-hour values including seconds', () => {
    expect(parseTimeParts('09:05:00')).toEqual({ hours: 9, minutes: 5 });
    expect(parseTimeParts('')).toBeNull();
  });

  it('formats hours and minutes as HH:MM', () => {
    expect(formatTimeParts(9, 5)).toBe('09:05');
    expect(formatTimeParts(23, 0)).toBe('23:00');
  });

  it('keeps an off-step minute selectable', () => {
    expect(minuteOptions(5, 7)).toEqual([
      0, 5, 7, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55,
    ]);
  });
});
