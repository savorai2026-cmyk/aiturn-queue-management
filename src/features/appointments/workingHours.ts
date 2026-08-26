import {
  addDaysToDateKey,
  formatTimeHm,
  parseTimeToMinutes,
  toDateKey,
  toFullCalendarTime,
} from './time';

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

export interface WorkingDayDraft {
  key: WeekdayKey;
  label: string;
  isOpen: boolean;
  start: string;
  end: string;
}

export const WEEKDAY_KEYS: WeekdayKey[] = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
];

export const WEEKDAY_LABELS: Record<WeekdayKey, string> = {
  sunday: 'ראשון',
  monday: 'שני',
  tuesday: 'שלישי',
  wednesday: 'רביעי',
  thursday: 'חמישי',
  friday: 'שישי',
  saturday: 'שבת',
};

const DEFAULT_OPEN_START = '09:00';
const DEFAULT_OPEN_END = '18:00';
const DEFAULT_FRIDAY_END = '13:00';

export const BOOKING_WINDOW_PRESETS = [7, 14, 30, 60, 90] as const;

function readTime(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const formatted = formatTimeHm(value);
  return /^\d{2}:\d{2}$/.test(formatted) ? formatted : null;
}

function parseShift(value: unknown): WorkingShift | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const shift = value as { start?: unknown; end?: unknown };
  const start = readTime(shift.start);
  const end = readTime(shift.end);

  if (!start || !end) {
    return null;
  }

  return { start, end };
}

function parseDay(value: unknown): WorkingDay {
  if (!value || typeof value !== 'object') {
    return { is_closed: true, shifts: [] };
  }

  const day = value as {
    is_closed?: unknown;
    shifts?: unknown;
    start?: unknown;
    end?: unknown;
  };
  const shifts = Array.isArray(day.shifts)
    ? day.shifts.map(parseShift).filter((shift): shift is WorkingShift => shift !== null)
    : [];

  if (shifts.length === 0) {
    const start = readTime(day.start);
    const end = readTime(day.end);
    if (start && end) {
      shifts.push({ start, end });
    }
  }

  return {
    is_closed: day.is_closed === true || shifts.length === 0,
    shifts,
  };
}

export function parseWorkingHours(value: unknown): WorkingHours | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const source = value as Record<string, unknown>;
  const parsed: WorkingHours = {};

  for (const key of WEEKDAY_KEYS) {
    if (key in source) {
      parsed[key] = parseDay(source[key]);
    }
  }

  return Object.keys(parsed).length > 0 ? parsed : null;
}

function defaultDraftFor(key: WeekdayKey): WorkingDayDraft {
  const isFriday = key === 'friday';
  const isSaturday = key === 'saturday';

  return {
    key,
    label: WEEKDAY_LABELS[key],
    isOpen: !isSaturday,
    start: DEFAULT_OPEN_START,
    end: isFriday ? DEFAULT_FRIDAY_END : DEFAULT_OPEN_END,
  };
}

export function toWorkingDayDrafts(value: unknown): WorkingDayDraft[] {
  const hours = parseWorkingHours(value);

  return WEEKDAY_KEYS.map((key) => {
    const fallback = defaultDraftFor(key);
    const day = hours?.[key];

    if (!day) {
      return fallback;
    }

    const firstShift = day.shifts?.[0];
    return {
      key,
      label: WEEKDAY_LABELS[key],
      isOpen: day.is_closed !== true && Boolean(firstShift),
      start: firstShift?.start ?? fallback.start,
      end: firstShift?.end ?? fallback.end,
    };
  });
}

export function toWorkingHoursPayload(drafts: WorkingDayDraft[]): WorkingHours {
  return Object.fromEntries(
    drafts.map((draft) => [
      draft.key,
      draft.isOpen
        ? {
            is_closed: false,
            shifts: [{ start: draft.start, end: draft.end }],
          }
        : {
            is_closed: true,
            shifts: [],
          },
    ]),
  ) as WorkingHours;
}

export function validateWorkingDayDrafts(drafts: WorkingDayDraft[]): string | null {
  const openDays = drafts.filter((draft) => draft.isOpen);

  if (openDays.length === 0) {
    return 'יש לבחור לפחות יום עבודה אחד.';
  }

  for (const draft of openDays) {
    if (parseTimeToMinutes(draft.end) <= parseTimeToMinutes(draft.start)) {
      return `ביום ${draft.label} שעת הסיום חייבת להיות מאוחרת משעת ההתחלה.`;
    }
  }

  return null;
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

export function getBookingRangeEndExclusive(
  maxAdvBookingDays: number | null,
  from = new Date(),
): string | null {
  if (!maxAdvBookingDays || maxAdvBookingDays <= 0) {
    return null;
  }

  return addDaysToDateKey(toDateKey(from), maxAdvBookingDays + 1);
}

export function getBookingMaxDate(
  maxAdvBookingDays: number | null,
  from = new Date(),
): string | null {
  if (!maxAdvBookingDays || maxAdvBookingDays <= 0) {
    return null;
  }

  return addDaysToDateKey(toDateKey(from), maxAdvBookingDays);
}
