import type { AppTab } from './navigation';

const APP_TABS: AppTab[] = ['calendar', 'clients', 'settings'];
const CALENDAR_VIEWS = ['dayGridMonth', 'timeGridWeek', 'timeGridDay'] as const;

export type CalendarViewName = (typeof CALENDAR_VIEWS)[number];

export interface CalendarLocation {
  date: string;
  view: CalendarViewName;
  selectedDate: string | null;
  selectedId: number | null;
  selectedServiceId: number | null;
}

function readJson<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown) {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

function isDateKey(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isStoredId(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

export function readAppTab(): AppTab {
  try {
    const stored = sessionStorage.getItem('featurn:appTab');
    if (stored && APP_TABS.includes(stored as AppTab)) {
      return stored as AppTab;
    }
  } catch {
    /* ignore */
  }
  return 'calendar';
}

export function writeAppTab(tab: AppTab) {
  try {
    sessionStorage.setItem('featurn:appTab', tab);
  } catch {
    /* ignore */
  }
}

function calendarKey(businessCode: string) {
  return `featurn:calendar:${businessCode}`;
}

export function readCalendarLocation(
  businessCode: string,
): CalendarLocation | null {
  const stored = readJson<Partial<CalendarLocation>>(calendarKey(businessCode));
  if (!stored || !isDateKey(stored.date)) {
    return null;
  }

  const view = CALENDAR_VIEWS.includes(stored.view as CalendarViewName)
    ? (stored.view as CalendarViewName)
    : 'timeGridWeek';

  return {
    date: stored.date,
    view,
    selectedDate: isDateKey(stored.selectedDate) ? stored.selectedDate : null,
    selectedId: isStoredId(stored.selectedId) ? stored.selectedId : null,
    selectedServiceId: isStoredId(stored.selectedServiceId)
      ? stored.selectedServiceId
      : null,
  };
}

export function isCalendarViewName(value: string): value is CalendarViewName {
  return CALENDAR_VIEWS.includes(value as CalendarViewName);
}

export function writeCalendarLocation(
  businessCode: string,
  location: Partial<CalendarLocation>,
) {
  const current = readCalendarLocation(businessCode);
  const next: CalendarLocation = {
    date: isDateKey(location.date)
      ? location.date
      : current?.date ?? '',
    view: location.view ?? current?.view ?? 'timeGridWeek',
    selectedDate:
      location.selectedDate === undefined
        ? current?.selectedDate ?? null
        : location.selectedDate,
    selectedId:
      location.selectedId === undefined
        ? current?.selectedId ?? null
        : location.selectedId,
    selectedServiceId:
      location.selectedServiceId === undefined
        ? current?.selectedServiceId ?? null
        : location.selectedServiceId,
  };

  if (!isDateKey(next.date)) {
    return;
  }

  writeJson(calendarKey(businessCode), next);
}
