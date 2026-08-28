const MINUTES_IN_DAY = 24 * 60;

export function parseTimeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return 0;
  }

  return hours * 60 + minutes;
}

export function minutesToTime(totalMinutes: number): string {
  const normalized =
    ((totalMinutes % MINUTES_IN_DAY) + MINUTES_IN_DAY) % MINUTES_IN_DAY;
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;
}

export function formatTimeHm(time: string): string {
  return time.slice(0, 5);
}

export function toFullCalendarTime(time: string): string {
  return `${formatTimeHm(time)}:00`;
}

export function addMinutesToTime(time: string, minutes: number): string {
  return minutesToTime(parseTimeToMinutes(time) + minutes);
}

export function toSchedulerDateTime(date: string, time: string): string {
  return `${date}T${formatTimeHm(time)}:00`;
}

export function toLocalDateTime(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `${year}-${month}-${day}T${hours}:${minutes}:00`;
}

export function snapMinutes(totalMinutes: number, step = 5): number {
  return Math.round(totalMinutes / step) * step;
}

export function toTimeHm(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export function snapTimeHm(time: string, step = 5): string {
  return formatTimeHm(minutesToTime(snapMinutes(parseTimeToMinutes(time), step)));
}

export function toLocalDateTimeMs(date: string, time: string): number {
  const [year, month, day] = date.split('-').map(Number);
  const minutes = parseTimeToMinutes(time);

  return new Date(
    year,
    month - 1,
    day,
    Math.floor(minutes / 60),
    minutes % 60,
    0,
    0,
  ).getTime();
}

export function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function toLocalDateFromKey(dateKey: string, time = '00:00'): Date {
  const [year, month, day] = dateKey.split('-').map(Number);
  const minutes = parseTimeToMinutes(time);
  return new Date(
    year,
    month - 1,
    day,
    Math.floor(minutes / 60),
    minutes % 60,
    0,
    0,
  );
}

export function addDaysToDateKey(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  const next = new Date(year, month - 1, day);
  next.setDate(next.getDate() + days);
  return toDateKey(next);
}

export function addMinutesToDateTime(
  date: string,
  time: string,
  deltaMinutes: number,
): { date: string; time: string } {
  const [year, month, day] = date.split('-').map(Number);
  const next = new Date(year, month - 1, day, 0, 0, 0, 0);
  next.setMinutes(parseTimeToMinutes(time) + deltaMinutes);

  return {
    date: toDateKey(next),
    time: minutesToTime(next.getHours() * 60 + next.getMinutes()),
  };
}

export function toDbTime(time: string): string {
  return toFullCalendarTime(time);
}

export function toSafePrice(value: unknown): number {
  const price = Number(value);
  return Number.isFinite(price) && price >= 0 ? price : 0;
}

export function shiftedAppointmentTimes(
  appointmentDate: string,
  startTime: string,
  endTime: string,
  deltaMinutes: number,
): { appointment_date: string; start_time: string; end_time: string } {
  const durationMinutes = Math.max(
    parseTimeToMinutes(endTime) - parseTimeToMinutes(startTime),
    5,
  );
  const nextStart = addMinutesToDateTime(
    appointmentDate,
    startTime,
    deltaMinutes,
  );
  const startMinutes = parseTimeToMinutes(nextStart.time);
  const maxStart = MINUTES_IN_DAY - durationMinutes;
  const safeStart = Math.min(Math.max(startMinutes, 0), Math.max(maxStart, 0));

  return {
    appointment_date: nextStart.date,
    start_time: minutesToTime(safeStart),
    end_time: minutesToTime(safeStart + durationMinutes),
  };
}

export function formatHebrewDateTime(date: Date): string {
  return new Intl.DateTimeFormat('he-IL', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function parseSchedulerDateTime(value: string): {
  date: string;
  time: string;
} {
  if (value.includes('T')) {
    const [date, timePart = '00:00:00'] = value.split('T');
    return {
      date,
      time: toFullCalendarTime(timePart),
    };
  }

  if (/^\d{2}:\d{2}/.test(value)) {
    return {
      date: '',
      time: toFullCalendarTime(value),
    };
  }

  return {
    date: value,
    time: '00:00:00',
  };
}
