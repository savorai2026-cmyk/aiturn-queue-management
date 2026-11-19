import type { StatsPeriod } from './stats.types';

export function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseDateKey(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

export function statsRange(period: StatsPeriod, today = new Date()) {
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const start = new Date(end);
  const span = period === 'week' ? 6 : period === 'month' ? 29 : 89;
  start.setDate(start.getDate() - span);
  return { from: toDateKey(start), to: toDateKey(end) };
}

export function eachDateKey(from: string, to: string) {
  const dates: string[] = [];
  const cursor = parseDateKey(from);
  const end = parseDateKey(to);
  while (cursor.getTime() <= end.getTime()) {
    dates.push(toDateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

export function formatDayLabel(dateKey: string) {
  const [year, month, day] = dateKey.split('-');
  if (!year || !month || !day) return dateKey;
  return `${Number(day)}.${Number(month)}`;
}
