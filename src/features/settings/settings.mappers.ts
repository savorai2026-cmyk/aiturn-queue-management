import { BUSINESS_FIELDS, SERVICE_FIELDS, STATUS_FIELDS } from '../../shared/displayFields/catalogs';
import type { DetailRow } from '../../shared/displayFields/types';
import type {
  AppointmentStatusRow,
  BusinessSettings,
  Service,
} from './settings.types';

const ILS_FORMATTER = new Intl.NumberFormat('he-IL', {
  style: 'currency',
  currency: 'ILS',
});

export function formatServiceCell(service: Service, key: string): string {
  if (key === 'is_active') return service.is_active ? 'פעיל' : 'לא פעיל';
  if (key === 'price') return ILS_FORMATTER.format(service.price);
  if (key === 'deposit_amount') {
    return ILS_FORMATTER.format(service.deposit_amount ?? 0);
  }
  if (key === 'buffer_time_minutes') {
    return String(service.buffer_time_minutes ?? 0);
  }
  if (key === 'duration_minutes') return String(service.duration_minutes);
  if (key === 'color_code') return service.color_code || 'לא הוגדר';
  if (key === 'description') return service.description ?? '';
  if (key === 'service_code') return service.service_code ?? '';
  if (key === 'title') return service.title;
  return '';
}

export function toServiceDetailRows(service: Service): DetailRow[] {
  return SERVICE_FIELDS.map((field) => ({
    key: field.key,
    label: field.label,
    value: formatServiceCell(service, field.key),
    dir: field.dir,
  }));
}

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat('he-IL', {
  dateStyle: 'short',
  timeStyle: 'short',
});

export function formatStatusCell(
  status: AppointmentStatusRow,
  key: string,
): string {
  if (key === 'status_code') return status.status_code;
  if (key === 'status_text') return status.status_text;
  if (key === 'color') return status.color || 'לא הוגדר';
  if (key === 'created_at') {
    return status.created_at
      ? DATE_TIME_FORMATTER.format(new Date(status.created_at))
      : '';
  }
  return '';
}

export function toStatusDetailRows(status: AppointmentStatusRow): DetailRow[] {
  return STATUS_FIELDS.map((field) => ({
    key: field.key,
    label: field.label,
    value: formatStatusCell(status, field.key),
    dir: field.dir,
  }));
}

export function parseDepositPercent(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function normalizeDepositPercent(value: unknown): number | null {
  if (value === '' || value == null) return 0;

  const raw = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(raw) || raw < 0 || raw > 100) return null;
  return Math.round(raw * 100) / 100;
}

export function formatBusinessField(
  business: BusinessSettings,
  key: string,
): string {
  if (key === 'deposit_percent') {
    const percent = parseDepositPercent(business.deposit_percent);
    return `${percent.toLocaleString('he-IL', { maximumFractionDigits: 2 })}%`;
  }

  const value = business[key as keyof BusinessSettings];
  if (value == null || value === '') return '';
  return String(value);
}

export function toBusinessDetailRows(business: BusinessSettings): DetailRow[] {
  return BUSINESS_FIELDS.map((field) => ({
    key: field.key,
    label: field.label,
    value: formatBusinessField(business, field.key),
    dir: field.dir,
  }));
}
