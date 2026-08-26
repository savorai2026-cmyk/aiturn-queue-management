import { formatTimeHm, parseTimeToMinutes, toFullCalendarTime } from './time';

export type WeekdayKey =
  | 'sunday'
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday';

export interface WorkingShift {
  start: string;
  end: string;
}

export interface WorkingDay {
  is_closed?: boolean;
  shifts?: WorkingShift[];
}

export type WorkingHours = Partial<Record<WeekdayKey, WorkingDay>>;

const WEEKDAY_KEYS: WeekdayKey[] = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
];

export function parseWorkingHours(value: unknown): WorkingHours | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  return value as WorkingHours;
}

export function toFullCalendarBusinessHours(workingHours: WorkingHours | null) {
  if (!workingHours) {
    return [];
  }

  return WEEKDAY_KEYS.flatMap((key, dayIndex) => {
    const day = workingHours[key];

    if (!day || day.is_closed) {
      return [];
    }

    return (day.shifts ?? [])
      .filter((shift) => shift.start && shift.end)
      .map((shift) => ({
        daysOfWeek: [dayIndex],
        startTime: formatTimeHm(shift.start),
        endTime: formatTimeHm(shift.end),
      }));
  });
}

export function getCalendarSlotRange(workingHours: WorkingHours | null): {
  slotMinTime: string;
  slotMaxTime: string;
} {
  const shifts = toFullCalendarBusinessHours(workingHours);

  if (shifts.length === 0) {
    return {
      slotMinTime: '00:00:00',
      slotMaxTime: '24:00:00',
    };
  }

  let minMinutes = Number.POSITIVE_INFINITY;
  let maxMinutes = Number.NEGATIVE_INFINITY;

  for (const shift of shifts) {
    minMinutes = Math.min(minMinutes, parseTimeToMinutes(shift.startTime));
    maxMinutes = Math.max(maxMinutes, parseTimeToMinutes(shift.endTime));
  }

  return {
    slotMinTime: toFullCalendarTime(
      `${String(Math.floor(minMinutes / 60)).padStart(2, '0')}:${String(minMinutes % 60).padStart(2, '0')}`,
    ),
    slotMaxTime: toFullCalendarTime(
      `${String(Math.floor(maxMinutes / 60)).padStart(2, '0')}:${String(maxMinutes % 60).padStart(2, '0')}`,
    ),
  };
}
