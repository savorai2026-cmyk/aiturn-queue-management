import { describe, expect, it } from 'vitest';
import {
  getIsraeliHolidayLabel,
  getIsraeliHolidaysInRange,
} from './israeliHolidays';

function at(dateKey: string): Date {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

describe('israeliHolidays', () => {
  it('labels Sukkot in Israel as Yom Tov or Chol HaMoed', () => {
    expect(getIsraeliHolidayLabel(at('2026-09-26'))).toBe('סוכות · יום טוב');
    expect(getIsraeliHolidayLabel(at('2026-09-27'))).toBe('חול המועד סוכות');
    expect(getIsraeliHolidayLabel(at('2026-10-02'))).toBe('הושענא רבה');
    expect(getIsraeliHolidayLabel(at('2026-10-03'))).toBe('שמיני עצרת');
  });

  it('labels Pesach in Israel as Yom Tov or Chol HaMoed', () => {
    expect(getIsraeliHolidayLabel(at('2026-04-02'))).toBe('פסח · יום טוב');
    expect(getIsraeliHolidayLabel(at('2026-04-03'))).toBe('חול המועד פסח');
    expect(getIsraeliHolidayLabel(at('2026-04-08'))).toBe('פסח · יום טוב');
  });

  it('labels Israeli national days and major fasts', () => {
    expect(getIsraeliHolidayLabel(at('2026-04-22'))).toBe('יום העצמאות');
    expect(getIsraeliHolidayLabel(at('2026-04-21'))).toBe('יום הזיכרון');
    expect(getIsraeliHolidayLabel(at('2026-04-14'))).toBe('יום השואה');
    expect(getIsraeliHolidayLabel(at('2026-09-21'))).toBe('יום כיפור');
    expect(getIsraeliHolidayLabel(at('2026-05-22'))).toBe('שבועות');
  });

  it('skips erev and minor civic observances', () => {
    expect(getIsraeliHolidayLabel(at('2026-09-25'))).toBeNull();
    expect(getIsraeliHolidayLabel(at('2026-04-27'))).toBeNull();
  });

  it('collects holidays across a visible range', () => {
    const holidays = getIsraeliHolidaysInRange('2026-09-25', '2026-09-28');
    expect(holidays.get('2026-09-25')).toBeUndefined();
    expect(holidays.get('2026-09-26')).toBe('סוכות · יום טוב');
    expect(holidays.get('2026-09-27')).toBe('חול המועד סוכות');
  });
});
