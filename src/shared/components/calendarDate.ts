export interface CalendarDay {
  dateKey: string;
  day: number;
  inMonth: boolean;
}

export function parseDateKey(
  value: string,
): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isFinite(year) || month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }

  return { year, month, day };
}

export function toDateKeyFromParts(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function shiftMonth(year: number, month: number, delta: number) {
  const next = new Date(year, month - 1 + delta, 1);
  return { year: next.getFullYear(), month: next.getMonth() + 1 };
}

export function getMonthGrid(year: number, month: number): CalendarDay[] {
  const first = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const leading = first.getDay();
  const cells: CalendarDay[] = [];

  for (let index = 0; index < leading; index += 1) {
    const date = new Date(year, month - 1, index - leading + 1);
    cells.push({
      dateKey: toDateKeyFromParts(
        date.getFullYear(),
        date.getMonth() + 1,
        date.getDate(),
      ),
      day: date.getDate(),
      inMonth: false,
    });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({
      dateKey: toDateKeyFromParts(year, month, day),
      day,
      inMonth: true,
    });
  }

  while (cells.length % 7 !== 0) {
    const last = cells[cells.length - 1];
    const [nextYear, nextMonth, nextDay] = last.dateKey.split('-').map(Number);
    const date = new Date(nextYear, nextMonth - 1, nextDay + 1);
    cells.push({
      dateKey: toDateKeyFromParts(
        date.getFullYear(),
        date.getMonth() + 1,
        date.getDate(),
      ),
      day: date.getDate(),
      inMonth: false,
    });
  }

  return cells;
}

export function isDateKeyInRange(
  dateKey: string,
  min?: string,
  max?: string,
): boolean {
  if (min && dateKey < min) return false;
  if (max && dateKey > max) return false;
  return true;
}
