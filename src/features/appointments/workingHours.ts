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

export interface WorkingHourException {
  date: string;
  is_closed: boolean;
  shifts: WorkingShift[];
  note?: string;
}

export type WorkingHoursPayload = WorkingHours & {
  exceptions?: WorkingHourException[];
};

export interface CalendarBusinessHour {
  daysOfWeek?: number[];
  startTime?: string;
  endTime?: string;
  startRecur?: string;
  endRecur?: string;
  start?: string;
  end?: string;
}

export interface WorkingDayDraft {
  key: WeekdayKey;
  label: string;
  isOpen: boolean;
  shifts: WorkingShift[];
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

function dateFromKey(dateKey: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function parseShifts(value: unknown): WorkingShift[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map(parseShift)
    .filter((shift): shift is WorkingShift => shift !== null);
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
  const shifts = parseShifts(day.shifts);

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

function parseException(value: unknown): WorkingHourException | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const item = value as {
    date?: unknown;
    is_closed?: unknown;
    shifts?: unknown;
    start?: unknown;
    end?: unknown;
    note?: unknown;
  };
  const date = typeof item.date === 'string' ? item.date.trim() : '';
  if (!dateFromKey(date)) {
    return null;
  }

  const shifts = parseShifts(item.shifts);
  if (shifts.length === 0) {
    const start = readTime(item.start);
    const end = readTime(item.end);
    if (start && end) {
      shifts.push({ start, end });
    }
  }

  const note =
    typeof item.note === 'string' ? item.note.trim().slice(0, 80) : '';

  return {
    date,
    is_closed: item.is_closed === true || shifts.length === 0,
    shifts,
    ...(note ? { note } : {}),
  };
}

export function parseWorkingHourExceptions(value: unknown): WorkingHourException[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return [];
  }

  const raw = (value as { exceptions?: unknown }).exceptions;
  if (!Array.isArray(raw)) {
    return [];
  }

  const parsed = raw
    .map(parseException)
    .filter((item): item is WorkingHourException => item !== null);

  parsed.sort((left, right) => left.date.localeCompare(right.date));
  return parsed;
}

export function weekdayKeyFromDateKey(dateKey: string): WeekdayKey | null {
  const date = dateFromKey(dateKey);
  if (!date) return null;
  return WEEKDAY_KEYS[date.getDay()] ?? null;
}

export function resolveWorkingDay(
  workingHours: WorkingHours | null,
  exceptions: WorkingHourException[],
  dateKey: string,
): WorkingDay | null {
  const exception = exceptions.find((item) => item.date === dateKey);
  if (exception) {
    return {
      is_closed: exception.is_closed,
      shifts: exception.shifts,
    };
  }

  const weekday = weekdayKeyFromDateKey(dateKey);
  if (!weekday || !workingHours) {
    return null;
  }

  return workingHours[weekday] ?? null;
}

function minutesToHm(minutes: number): string {
  const clamped = Math.max(0, Math.min(minutes, 23 * 60 + 55));
  const hours = Math.floor(clamped / 60);
  const rest = clamped % 60;
  return `${String(hours).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
}

function defaultShiftsFor(key: WeekdayKey): WorkingShift[] {
  if (key === 'saturday') {
    return [];
  }

  return [
    {
      start: DEFAULT_OPEN_START,
      end: key === 'friday' ? DEFAULT_FRIDAY_END : DEFAULT_OPEN_END,
    },
  ];
}

function defaultDraftFor(key: WeekdayKey): WorkingDayDraft {
  const isSaturday = key === 'saturday';

  return {
    key,
    label: WEEKDAY_LABELS[key],
    isOpen: !isSaturday,
    shifts: defaultShiftsFor(key),
  };
}

export function suggestNextShift(shifts: WorkingShift[]): WorkingShift {
  if (shifts.length === 0) {
    return { start: DEFAULT_OPEN_START, end: DEFAULT_OPEN_END };
  }

  const lastEnd = Math.max(
    ...shifts.map((shift) => parseTimeToMinutes(shift.end)),
  );
  const start = lastEnd + 60;
  if (start >= 22 * 60) {
    return { start: '16:00', end: '20:00' };
  }

  return {
    start: minutesToHm(start),
    end: minutesToHm(Math.min(start + 4 * 60, 23 * 60)),
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

    const shifts = day.shifts?.length ? day.shifts : fallback.shifts;
    return {
      key,
      label: WEEKDAY_LABELS[key],
      isOpen: day.is_closed !== true && shifts.length > 0,
      shifts,
    };
  });
}

export function toWorkingHoursPayload(
  drafts: WorkingDayDraft[],
  exceptions: WorkingHourException[] = [],
): WorkingHoursPayload {
  const days = Object.fromEntries(
    drafts.map((draft) => [
      draft.key,
      draft.isOpen
        ? {
            is_closed: false,
            shifts: draft.shifts,
          }
        : {
            is_closed: true,
            shifts: [],
          },
    ]),
  ) as WorkingHours;

  const cleaned = exceptions
    .filter((item) => dateFromKey(item.date))
    .map((item) => ({
      date: item.date,
      is_closed: item.is_closed,
      shifts: item.is_closed ? [] : item.shifts,
      ...(item.note?.trim() ? { note: item.note.trim().slice(0, 80) } : {}),
    }))
    .sort((left, right) => left.date.localeCompare(right.date));

  return cleaned.length > 0 ? { ...days, exceptions: cleaned } : days;
}

export function validateShifts(
  shifts: WorkingShift[],
  context: string,
): string | null {
  if (shifts.length === 0) {
    return `${context} יש להגדיר לפחות מקטע שעות אחד, או לסמן כסגור.`;
  }

  const sorted = [...shifts].sort(
    (left, right) =>
      parseTimeToMinutes(left.start) - parseTimeToMinutes(right.start),
  );

  for (let index = 0; index < sorted.length; index += 1) {
    const shift = sorted[index];
    if (parseTimeToMinutes(shift.end) <= parseTimeToMinutes(shift.start)) {
      return `${context} שעת הסיום חייבת להיות מאוחרת משעת ההתחלה.`;
    }
    if (
      index > 0 &&
      parseTimeToMinutes(shift.start) < parseTimeToMinutes(sorted[index - 1].end)
    ) {
      return `${context} המקטעים חופפים. אפשר להגדיר בוקר וערב עם הפסקה ביניהם.`;
    }
  }

  return null;
}

export function validateWorkingDayDrafts(drafts: WorkingDayDraft[]): string | null {
  const openDays = drafts.filter((draft) => draft.isOpen);

  if (openDays.length === 0) {
    return 'יש לבחור לפחות יום עבודה אחד.';
  }

  for (const draft of openDays) {
    const error = validateShifts(draft.shifts, `ביום ${draft.label}`);
    if (error) {
      return error;
    }
  }

  return null;
}

export function validateWorkingHourExceptions(
  exceptions: WorkingHourException[],
): string | null {
  const seen = new Set<string>();

  for (const item of exceptions) {
    if (!dateFromKey(item.date)) {
      return 'יש לבחור תאריך לכל יום מיוחד.';
    }
    if (seen.has(item.date)) {
      return 'לא ניתן להגדיר את אותו תאריך יותר מפעם אחת.';
    }
    seen.add(item.date);

    if (item.is_closed) {
      continue;
    }

    const error = validateShifts(item.shifts, 'ביום המיוחד');
    if (error) {
      return error;
    }
  }

  return null;
}

function shiftToCalendarRange(dateKey: string, shift: WorkingShift): CalendarBusinessHour {
  return {
    startTime: formatTimeHm(shift.start),
    endTime: formatTimeHm(shift.end),
    startRecur: dateKey,
    endRecur: addDaysToDateKey(dateKey, 1),
  };
}

function closedDayPlaceholder(dateKey: string): CalendarBusinessHour {
  return {
    startTime: '00:00',
    endTime: '00:01',
    startRecur: dateKey,
    endRecur: addDaysToDateKey(dateKey, 1),
  };
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

export function toFullCalendarBusinessHoursForRange(
  workingHours: WorkingHours | null,
  exceptions: WorkingHourException[],
  rangeStart: string,
  rangeEndExclusive: string,
): CalendarBusinessHour[] {
  const hours: CalendarBusinessHour[] = [];
  let current = rangeStart;
  let guard = 0;

  while (current < rangeEndExclusive && guard < 400) {
    const day = resolveWorkingDay(workingHours, exceptions, current);
    const addedForDay: CalendarBusinessHour[] = [];
    if (day && !day.is_closed) {
      for (const shift of day.shifts ?? []) {
        if (shift.start && shift.end) {
          addedForDay.push(shiftToCalendarRange(current, shift));
        }
      }
    }

    hours.push(...(addedForDay.length > 0 ? addedForDay : [closedDayPlaceholder(current)]));
    current = addDaysToDateKey(current, 1);
    guard += 1;
  }

  if (hours.length === 0) {
    return [closedDayPlaceholder(rangeStart)];
  }

  return hours;
}

function collectShiftMinutes(
  workingHours: WorkingHours | null,
  exceptions: WorkingHourException[],
): number[] {
  const minutes: number[] = [];

  for (const key of WEEKDAY_KEYS) {
    const day = workingHours?.[key];
    if (!day || day.is_closed) continue;
    for (const shift of day.shifts ?? []) {
      minutes.push(parseTimeToMinutes(shift.start), parseTimeToMinutes(shift.end));
    }
  }

  for (const exception of exceptions) {
    if (exception.is_closed) continue;
    for (const shift of exception.shifts) {
      minutes.push(parseTimeToMinutes(shift.start), parseTimeToMinutes(shift.end));
    }
  }

  return minutes;
}

export function getCalendarSlotRange(
  workingHours: WorkingHours | null,
  exceptions: WorkingHourException[] = [],
): {
  slotMinTime: string;
  slotMaxTime: string;
} {
  const minutes = collectShiftMinutes(workingHours, exceptions);

  if (minutes.length === 0) {
    return {
      slotMinTime: '00:00:00',
      slotMaxTime: '24:00:00',
    };
  }

  const minMinutes = Math.min(...minutes);
  const maxMinutes = Math.max(...minutes);

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

export function createSpecialDayFromWeekly(
  weeklyDays: WorkingDayDraft[],
  dateKey = '',
): WorkingHourException {
  const weekday = weekdayKeyFromDateKey(dateKey);
  const weekly = weekday
    ? weeklyDays.find((day) => day.key === weekday)
    : undefined;
  const source =
    weekly?.isOpen ? weekly : weeklyDays.find((day) => day.isOpen);

  return {
    date: dateKey,
    is_closed: false,
    shifts:
      source?.shifts && source.shifts.length > 0
        ? source.shifts.map((shift) => ({ ...shift }))
        : [{ start: '09:00', end: '13:00' }],
  };
}

export interface SpecialDayDraft extends WorkingHourException {
  id: string;
}

function nextSpecialDayId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function toSpecialDayDrafts(
  exceptions: WorkingHourException[],
): SpecialDayDraft[] {
  return exceptions.map((item) => ({ ...item, id: nextSpecialDayId() }));
}

export function createBlankSpecialDay(
  _weeklyDays: WorkingDayDraft[],
): SpecialDayDraft {
  return {
    id: nextSpecialDayId(),
    date: toDateKey(new Date()),
    is_closed: true,
    shifts: [],
  };
}
