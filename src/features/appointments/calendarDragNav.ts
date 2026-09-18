import { toDateKey, toLocalDateFromKey, toTimeHm } from './time';

export const HEBREW_WEEKDAY_SHORT = [
  'א׳',
  'ב׳',
  'ג׳',
  'ד׳',
  'ה׳',
  'ו׳',
  'ש׳',
] as const;

export const DRAG_PERIOD_HOVER_MS = 280;

export type DragNavTarget =
  | { type: 'period'; direction: 1 | -1 }
  | { type: 'date'; dateKey: string };

export function addCalendarMonths(date: Date, months: number): Date {
  const next = new Date(date.getTime());
  const day = next.getDate();
  next.setDate(1);
  next.setMonth(next.getMonth() + months);
  const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
  next.setDate(Math.min(day, lastDay));
  return next;
}

export function shiftDateByView(
  date: Date,
  viewType: string,
  periods: number,
): Date {
  if (!periods) {
    return new Date(date.getTime());
  }

  if (viewType === 'dayGridMonth') {
    return addCalendarMonths(date, periods);
  }

  const next = new Date(date.getTime());
  next.setDate(next.getDate() + periods * (viewType === 'timeGridDay' ? 1 : 7));
  return next;
}

export function rangeDurationMs(start: Date, end: Date | null): number {
  return end ? Math.max(end.getTime() - start.getTime(), 0) : 0;
}

export function buildDropRange(
  dateKey: string,
  timeHm: string | null,
  originStart: Date,
  originEnd: Date | null,
  keepOriginTime: boolean,
): { nextStart: Date; nextEnd: Date | null } {
  const time = keepOriginTime || !timeHm ? toTimeHm(originStart) : timeHm;
  const nextStart = toLocalDateFromKey(dateKey, time);
  const duration = rangeDurationMs(originStart, originEnd);
  return {
    nextStart,
    nextEnd: duration ? new Date(nextStart.getTime() + duration) : null,
  };
}

export function periodNavLabel(
  viewType: string,
  direction: 'prev' | 'next',
): string {
  const isNext = direction === 'next';
  if (viewType === 'timeGridDay') {
    return isNext ? 'יום הבא' : 'יום קודם';
  }
  if (viewType === 'dayGridMonth') {
    return isNext ? 'חודש הבא' : 'חודש קודם';
  }
  return isNext ? 'שבוע הבא' : 'שבוע קודם';
}

export function weekDatesContaining(date: Date, weekOffset = 0): Date[] {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  start.setDate(start.getDate() - start.getDay() + weekOffset * 7);
  return Array.from({ length: 7 }, (_, index) => {
    const next = new Date(start);
    next.setDate(start.getDate() + index);
    return next;
  });
}

export function hebrewWeekdayShort(date: Date): string {
  return HEBREW_WEEKDAY_SHORT[date.getDay()] ?? '';
}

export function isDateKeyBookable(
  dateKey: string,
  bookingRangeEndExclusive: string | null,
): boolean {
  if (bookingRangeEndExclusive && dateKey >= bookingRangeEndExclusive) {
    return false;
  }
  return true;
}

export function isSameSlot(
  leftStart: Date,
  leftEnd: Date | null,
  rightStart: Date,
  rightEnd: Date | null,
): boolean {
  return (
    leftStart.getTime() === rightStart.getTime() &&
    (leftEnd?.getTime() ?? null) === (rightEnd?.getTime() ?? null)
  );
}

export function findDragNavTarget(
  clientX: number,
  clientY: number,
): DragNavTarget | null {
  for (const element of document.elementsFromPoint(clientX, clientY)) {
    if (!(element instanceof Element)) {
      continue;
    }

    const nav = element.closest('[data-drag-nav]');
    if (nav instanceof HTMLElement) {
      const value = nav.dataset.dragNav;
      if (value === 'prev') {
        return { type: 'period', direction: -1 };
      }
      if (value === 'next') {
        return { type: 'period', direction: 1 };
      }
    }
  }

  return null;
}

export function readDateKeyFromPoint(
  clientX: number,
  clientY: number,
): string | null {
  for (const element of document.elementsFromPoint(clientX, clientY)) {
    if (!(element instanceof Element)) {
      continue;
    }
    const host = element.closest('[data-date]');
    if (
      host instanceof HTMLElement &&
      /^\d{4}-\d{2}-\d{2}$/.test(host.dataset.date ?? '')
    ) {
      return host.dataset.date ?? null;
    }
  }
  return null;
}

export function canNavigateByView(
  currentStart: Date,
  viewType: string,
  direction: 1 | -1,
  bookingRangeEndExclusive: string | null,
): boolean {
  const next = shiftDateByView(currentStart, viewType, direction);
  if (direction > 0) {
    return isDateKeyBookable(toDateKey(next), bookingRangeEndExclusive);
  }
  return true;
}
