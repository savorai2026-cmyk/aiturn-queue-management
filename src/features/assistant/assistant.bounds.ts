import {
  getStatusLabel,
  isCanceledStatus,
  type StatusCatalogItem,
} from '../appointments/appointmentStatuses.ts';

export const MAX_HISTORY_MESSAGES = 8;
export const MAX_MESSAGE_CHARS = 2000;
export const MAX_APPOINTMENT_DAYS = 31;
export const MAX_STATS_DAYS = 92;
export const MAX_APPOINTMENTS = 40;
export const MAX_STATS_ROWS = 500;
export const MAX_CLIENTS = 8;
export const MAX_LOGS = 8;
export const MAX_LOG_TEXT = 400;
export const MAX_SERVICES = 40;

const DATE_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 24 * 60 * 60 * 1000;

const WEEKDAYS: Array<[string, string]> = [
  ['sunday', 'ראשון'],
  ['monday', 'שני'],
  ['tuesday', 'שלישי'],
  ['wednesday', 'רביעי'],
  ['thursday', 'חמישי'],
  ['friday', 'שישי'],
  ['saturday', 'שבת'],
];

const CHANNEL_LABELS: Record<string, string> = {
  manual: 'ידני',
  whatsapp: 'וואטסאפ',
  phone: 'טלפון',
  voice: 'קולי',
  vapi: 'בוט קולי',
};

const BOOKING_LABELS: Record<string, string> = {
  instant: 'נקבע מיד',
  approval: 'ממתין לאישור',
  blocked: 'חסום לקביעה',
};

const PAYMENT_LABELS: Record<string, string> = {
  none: 'ללא תשלום מראש',
  deposit: 'מקדמה',
  full: 'תשלום מלא מראש',
};

export interface AssistantTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface DateRange {
  from: string;
  to: string;
}

export function sanitizeHistory(value: unknown): AssistantTurn[] | null {
  if (!Array.isArray(value)) return null;

  const turns: AssistantTurn[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const record = item as { role?: unknown; content?: unknown };
    if (record.role !== 'user' && record.role !== 'assistant') continue;
    if (typeof record.content !== 'string') continue;
    const content = record.content.trim().slice(0, MAX_MESSAGE_CHARS);
    if (!content) continue;
    turns.push({ role: record.role, content });
  }

  const recent = turns.slice(-MAX_HISTORY_MESSAGES);
  if (recent.length === 0 || recent[recent.length - 1]?.role !== 'user') return null;
  return recent;
}

export function dateKeyInTimeZone(date: Date, timeZone: string): string {
  const zone = timeZone.trim() || 'Asia/Jerusalem';
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: zone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jerusalem',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  }
}

function parseDateKey(value: string): number | null {
  const match = DATE_KEY.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utc = Date.UTC(year, month - 1, day);
  const check = new Date(utc);
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    return null;
  }
  return utc;
}

export function clampDateRange(
  from: string,
  to: string,
  maxDays: number,
): DateRange | { error: string } {
  const start = parseDateKey(from.trim());
  const end = parseDateKey(to.trim());
  if (start == null || end == null) {
    return { error: 'צריך תאריכים בפורמט YYYY-MM-DD.' };
  }
  if (start > end) {
    return { error: 'תאריך ההתחלה אחרי תאריך הסיום.' };
  }
  const days = Math.round((end - start) / DAY_MS) + 1;
  if (days > maxDays) {
    return { error: `הטווח ארוך מדי. אפשר עד ${maxDays} ימים בכל בדיקה.` };
  }
  return { from: from.trim(), to: to.trim() };
}

export function clockTime(value: unknown): string {
  const text = typeof value === 'string' ? value.trim() : '';
  const match = /^(\d{1,2}):(\d{2})/.exec(text);
  if (!match) return '';
  return `${match[1].padStart(2, '0')}:${match[2]}`;
}

export function readMoney(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

export function channelLabel(channel: string | null | undefined): string {
  const key = channel?.trim().toLowerCase() ?? '';
  if (!key) return 'לא צוין';
  return CHANNEL_LABELS[key] ?? channel?.trim() ?? 'לא צוין';
}

export function bookingPolicyLabel(policy: string | null | undefined): string {
  const key = policy?.trim().toLowerCase() ?? '';
  return BOOKING_LABELS[key] ?? 'נקבע מיד';
}

export function paymentRequirementLabel(requirement: string | null | undefined): string {
  const key = requirement?.trim().toLowerCase() ?? '';
  return PAYMENT_LABELS[key] ?? PAYMENT_LABELS.none;
}

export function planLabel(plan: string | null | undefined): string {
  return plan?.trim() === 'expanded' ? 'מורחב' : 'רגיל';
}

export function clipText(value: unknown, max: number): string {
  const text = typeof value === 'string' ? value.trim() : '';
  if (text.length <= max) return text;
  return `${text.slice(0, max).trimEnd()}…`;
}

export function likeNeedle(value: string): string {
  return value.replace(/[%_\\]/g, '').trim().slice(0, 60);
}

export function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export function serviceTitles(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const titles: string[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const title = clipText((item as { title_snapshot?: unknown }).title_snapshot, 80);
    if (title) titles.push(title);
    if (titles.length >= 6) break;
  }
  return titles;
}

export interface PackedAppointment {
  date: string;
  start: string;
  end: string;
  status: string;
  clientName: string;
  services: string[];
  price: number | null;
  channel: string;
}

export function packAppointment(
  row: {
    appointment_date: string;
    start_time: string;
    end_time: string;
    status: string;
    channel: string | null;
    price: number | string | null;
    clients: { full_name: string | null } | { full_name: string | null }[] | null;
    appointment_services: { title_snapshot: string | null }[] | null;
  },
  catalog: StatusCatalogItem[],
): PackedAppointment {
  const client = firstRelation(row.clients);
  const name = client?.full_name?.trim() || 'לקוח ללא שם';
  return {
    date: row.appointment_date,
    start: clockTime(row.start_time),
    end: clockTime(row.end_time),
    status: getStatusLabel(row.status, catalog),
    clientName: name,
    services: serviceTitles(row.appointment_services),
    price: readMoney(row.price),
    channel: channelLabel(row.channel),
  };
}

function isCompletedStatus(status: string) {
  const normalized = status.trim().toLowerCase();
  return normalized === '03' || normalized === 'completed';
}

export interface StatsSourceRow {
  status: string;
  price: number | null;
  services: string[];
}

export interface StatsSummaryPayload {
  total: number;
  completed: number;
  canceled: number;
  revenue: number;
  byStatus: Array<{ label: string; count: number }>;
  topServices: Array<{ label: string; count: number }>;
}

function topCounts(counts: Map<string, number>, limit: number) {
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], 'he'))
    .slice(0, limit)
    .map(([label, count]) => ({ label, count }));
}

export function summarizeStatsRows(
  rows: StatsSourceRow[],
  catalog: StatusCatalogItem[],
): StatsSummaryPayload {
  let completed = 0;
  let canceled = 0;
  let revenue = 0;
  const byStatus = new Map<string, number>();
  const byService = new Map<string, number>();

  for (const row of rows) {
    const label = getStatusLabel(row.status, catalog);
    byStatus.set(label, (byStatus.get(label) ?? 0) + 1);
    if (isCompletedStatus(row.status)) completed += 1;
    if (isCanceledStatus(row.status)) canceled += 1;
    if (row.price != null) revenue += row.price;
    const titles = row.services.length > 0 ? row.services : ['בלי שירות'];
    for (const title of titles) {
      byService.set(title, (byService.get(title) ?? 0) + 1);
    }
  }

  return {
    total: rows.length,
    completed,
    canceled,
    revenue: Math.round(revenue),
    byStatus: topCounts(byStatus, 8),
    topServices: topCounts(byService, 8),
  };
}

function dayLine(day: unknown): string {
  if (!day || typeof day !== 'object' || Array.isArray(day)) return 'לא הוגדר';
  const record = day as { is_closed?: unknown; shifts?: unknown };
  if (record.is_closed === true) return 'סגור';
  if (!Array.isArray(record.shifts) || record.shifts.length === 0) return 'לא הוגדר';
  const shifts = record.shifts
    .map((shift) => {
      if (!shift || typeof shift !== 'object') return '';
      const start = clockTime((shift as { start?: unknown }).start);
      const end = clockTime((shift as { end?: unknown }).end);
      return start && end ? `${start}–${end}` : '';
    })
    .filter(Boolean);
  return shifts.join(', ') || 'לא הוגדר';
}

export function describeWorkingHours(value: unknown): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return ['לא הוגדרו שעות פעילות.'];
  }
  const record = value as Record<string, unknown>;
  const lines = WEEKDAYS.map(([key, label]) => `${label}: ${dayLine(record[key])}`);
  if (!Array.isArray(record.exceptions)) return lines;

  for (const item of record.exceptions.slice(0, 6)) {
    if (!item || typeof item !== 'object') continue;
    const date = typeof (item as { date?: unknown }).date === 'string'
      ? (item as { date: string }).date.trim()
      : '';
    if (!DATE_KEY.test(date)) continue;
    lines.push(`חריג ${date}: ${dayLine(item)}`);
  }
  return lines;
}

export interface PackedClient {
  name: string;
  mobilePhone: string;
  whatsapp: string;
  city: string;
  email: string;
  booking: string;
}

export function packClient(row: {
  full_name: string | null;
  mobile_phone: string | null;
  whatsapp_number: string | null;
  city: string | null;
  email: string | null;
  booking_policy: string | null;
}): PackedClient {
  return {
    name: row.full_name?.trim() || 'לקוח ללא שם',
    mobilePhone: row.mobile_phone?.trim() || '',
    whatsapp: row.whatsapp_number?.trim() || '',
    city: row.city?.trim() || '',
    email: row.email?.trim() || '',
    booking: bookingPolicyLabel(row.booking_policy),
  };
}

export interface PackedLog {
  at: string;
  channel: string;
  outcome: string;
  durationMinutes: number | null;
  text: string;
}

export function packLog(row: {
  started_at: string | null;
  created_at: string;
  channel: string;
  outcome: string | null;
  duration_seconds: number | null;
  summary: string | null;
  transcript: string | null;
}): PackedLog {
  const summary = clipText(row.summary, MAX_LOG_TEXT);
  const transcript = clipText(row.transcript, MAX_LOG_TEXT);
  const seconds = row.duration_seconds;
  return {
    at: row.started_at || row.created_at,
    channel: channelLabel(row.channel),
    outcome: row.outcome?.trim() || '',
    durationMinutes:
      seconds != null && Number.isFinite(seconds) ? Math.round(seconds / 60) : null,
    text: summary || transcript,
  };
}

export function describeCancellation(value: unknown): string {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return 'אין מדיניות ביטול פעילה.';
  }
  const policy = value as Record<string, unknown>;
  const cancellations = Number(policy.cancellations);
  const withinDays = Number(policy.within_days);
  const payee = typeof policy.payee_name === 'string' ? policy.payee_name.trim() : '';
  const paymentText = typeof policy.payment_text === 'string' ? policy.payment_text.trim() : '';
  if (!Number.isInteger(cancellations) || !Number.isInteger(withinDays) || !payee || !paymentText) {
    return 'אין מדיניות ביטול פעילה.';
  }
  const near = policy.near_hours == null || policy.near_hours === ''
    ? ''
    : ` ביטול קרוב נספר בתוך ${policy.near_hours} שעות.`;
  return `אחרי ${cancellations} ביטולים ב-${withinDays} ימים הלקוח מתבקש לשלם ל${payee}. ${clipText(paymentText, 240)}${near}`;
}
