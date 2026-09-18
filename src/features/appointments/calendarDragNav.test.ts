import { describe, expect, it } from 'vitest';
import {
  addCalendarMonths,
  buildDropRange,
  canNavigateByView,
  isDateKeyBookable,
  periodNavLabel,
  shiftDateByView,
  weekDatesContaining,
} from './calendarDragNav';

function at(isoLocal: string): Date {
  const [date, time] = isoLocal.split('T');
  const [year, month, day] = date.split('-').map(Number);
  const [hours, minutes] = time.split(':').map(Number);
  return new Date(year, month - 1, day, hours, minutes, 0, 0);
}

describe('calendarDragNav', () => {
  it('shifts a week-view date by whole weeks', () => {
    expect(shiftDateByView(at('2026-09-16T09:30'), 'timeGridWeek', 1)).toEqual(
      at('2026-09-23T09:30'),
    );
  });

  it('shifts a day-view date by days', () => {
    expect(shiftDateByView(at('2026-09-16T14:00'), 'timeGridDay', -1)).toEqual(
      at('2026-09-15T14:00'),
    );
  });

  it('clamps month shifts onto the last valid day', () => {
    expect(addCalendarMonths(at('2026-01-31T11:00'), 1)).toEqual(
      at('2026-02-28T11:00'),
    );
  });

  it('builds a drop range from a date and snapped time', () => {
    const moved = buildDropRange(
      '2026-09-24',
      '11:15',
      at('2026-09-16T09:00'),
      at('2026-09-16T10:00'),
      false,
    );
    expect(moved.nextStart).toEqual(at('2026-09-24T11:15'));
    expect(moved.nextEnd).toEqual(at('2026-09-24T12:15'));
  });

  it('keeps the original clock time for month-view drops', () => {
    const moved = buildDropRange(
      '2026-10-03',
      '00:00',
      at('2026-09-16T09:45'),
      at('2026-09-16T10:30'),
      true,
    );
    expect(moved.nextStart).toEqual(at('2026-10-03T09:45'));
    expect(moved.nextEnd).toEqual(at('2026-10-03T10:30'));
  });

  it('blocks navigating past the exclusive booking range', () => {
    expect(
      canNavigateByView(at('2026-09-16T00:00'), 'timeGridWeek', 1, '2026-09-20'),
    ).toBe(false);
    expect(
      canNavigateByView(at('2026-09-16T00:00'), 'timeGridWeek', 1, '2026-10-01'),
    ).toBe(true);
  });

  it('builds a Sunday-first week and Hebrew period labels', () => {
    const days = weekDatesContaining(at('2026-09-16T12:00'));
    expect(days.map((day) => day.getDate())).toEqual([13, 14, 15, 16, 17, 18, 19]);
    expect(weekDatesContaining(at('2026-09-16T12:00'), 1)[0].getDate()).toBe(20);
    expect(periodNavLabel('timeGridWeek', 'next')).toBe('שבוע הבא');
    expect(periodNavLabel('dayGridMonth', 'prev')).toBe('חודש קודם');
  });

  it('treats the booking end date as exclusive', () => {
    expect(isDateKeyBookable('2026-10-01', '2026-10-01')).toBe(false);
    expect(isDateKeyBookable('2026-09-30', '2026-10-01')).toBe(true);
    expect(isDateKeyBookable('2026-12-01', null)).toBe(true);
  });
});
