import { flags, getHolidaysOnDate, type Event } from '@hebcal/core';
import { addDaysToDateKey, toDateKey } from './time';

function formatIsraeliHoliday(event: Event): string | null {
  const eventFlags = event.getFlags();
  const desc = event.getDesc();

  if (eventFlags & flags.EREV) {
    return null;
  }
  if (eventFlags & flags.MINOR_FAST) {
    return null;
  }
  if (
    desc.includes('Herzl') ||
    desc.includes('Jabotinsky') ||
    desc.includes('School Observance') ||
    desc.includes('LaBehemot') ||
    desc.includes('Selichot') ||
    desc.includes('Pesach Sheni') ||
    desc.includes("Tu B'Av")
  ) {
    return null;
  }

  if (eventFlags & flags.CHOL_HAMOED) {
    if (desc.includes('Hoshana Raba')) {
      return 'הושענא רבה';
    }
    if (desc.includes('Sukkot')) {
      return 'חול המועד סוכות';
    }
    if (desc.includes('Pesach')) {
      return 'חול המועד פסח';
    }
    return 'חול המועד';
  }

  if (eventFlags & flags.CHAG) {
    if (desc.includes('Pesach')) {
      return 'פסח · יום טוב';
    }
    if (desc.startsWith('Sukkot')) {
      return 'סוכות · יום טוב';
    }
    if (desc.includes('Shavuot')) {
      return 'שבועות';
    }
    if (desc.includes('Shmini Atzeret')) {
      return 'שמיני עצרת';
    }
    if (desc.includes('Simchat Torah')) {
      return 'שמחת תורה';
    }
    if (desc.includes('Rosh Hashana')) {
      return 'ראש השנה';
    }
    if (desc.includes('Yom Kippur')) {
      return 'יום כיפור';
    }
  }

  if (desc.includes("Yom HaAtzma")) {
    return 'יום העצמאות';
  }
  if (desc.includes('Yom HaZikaron')) {
    return 'יום הזיכרון';
  }
  if (desc.includes('Yom HaShoah')) {
    return 'יום השואה';
  }
  if (desc.includes('Yom Yerushalayim')) {
    return 'יום ירושלים';
  }
  if (desc.includes('Lag BaOmer')) {
    return 'ל״ג בעומר';
  }
  if (desc.includes("Tish'a B'Av") || desc.includes('Tisha')) {
    return 'תשעה באב';
  }
  if (desc.includes('Tu BiShvat') || desc.includes("Tu B'Shvat")) {
    return 'ט״ו בשבט';
  }
  if (desc.startsWith('Chanukah')) {
    return 'חנוכה';
  }
  if (desc.includes('Purim')) {
    return desc.includes('Shushan') ? 'שושן פורים' : 'פורים';
  }

  return null;
}

export function getIsraeliHolidayLabel(date: Date): string | null {
  return getIsraeliHolidayLabelForKey(toDateKey(date));
}

export function getIsraeliHolidayLabelForKey(dateKey: string): string | null {
  const [year, month, day] = dateKey.split('-').map(Number);
  const utcNoon = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  const events = getHolidaysOnDate(utcNoon, true) ?? [];
  for (const event of events) {
    const label = formatIsraeliHoliday(event);
    if (label) {
      return label;
    }
  }
  return null;
}

export function getIsraeliHolidaysInRange(
  startKey: string,
  endExclusiveKey: string,
): Map<string, string> {
  const holidays = new Map<string, string>();
  if (!startKey || !endExclusiveKey || startKey >= endExclusiveKey) {
    return holidays;
  }

  let current = startKey;
  while (current < endExclusiveKey) {
    const label = getIsraeliHolidayLabelForKey(current);
    if (label) {
      holidays.set(current, label);
    }
    current = addDaysToDateKey(current, 1);
  }

  return holidays;
}
