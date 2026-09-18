import { BUSINESS_FIELDS, BUSINESS_CONFIG_FIELDS, SERVICE_FIELDS, STATUS_FIELDS } from '../../shared/displayFields/catalogs';
import type { DetailRow } from '../../shared/displayFields/types';
import {
  columnExactNumber,
  columnTextIncludes,
  compareByNumber,
  compareByText,
  type ColumnFilters,
  type ColumnSort,
} from '../../shared/displayFields/columnTable';
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

const SERVICE_NUMERIC_KEYS = new Set([
  'duration_minutes',
  'price',
  'buffer_time_minutes',
  'deposit_amount',
]);

export type ServiceColumnFilters = ColumnFilters;
export type ServiceSortState = ColumnSort;

function serviceNumericValue(service: Service, key: string): number {
  if (key === 'price') return Number(service.price);
  if (key === 'duration_minutes') return Number(service.duration_minutes);
  if (key === 'buffer_time_minutes') return Number(service.buffer_time_minutes ?? 0);
  if (key === 'deposit_amount') return Number(service.deposit_amount ?? 0);
  return 0;
}

export function matchesServiceColumnFilters(
  service: Service,
  filters: ColumnFilters,
) {
  return Object.entries(filters).every(([key, raw]) => {
    const query = raw.trim();
    if (!query) return true;

    if (key === 'is_active') {
      const isActive = Boolean(service.is_active);
      if (query === 'active') return isActive;
      if (query === 'inactive') return !isActive;
      return true;
    }

    if (SERVICE_NUMERIC_KEYS.has(key)) {
      return columnExactNumber(serviceNumericValue(service, key), query);
    }

    return columnTextIncludes(formatServiceCell(service, key), query);
  });
}

export function compareServices(
  left: Service,
  right: Service,
  sort: ColumnSort,
) {
  if (sort.key === 'is_active') {
    return compareByNumber(
      Number(Boolean(left.is_active)),
      Number(Boolean(right.is_active)),
      sort.direction,
    );
  }

  if (SERVICE_NUMERIC_KEYS.has(sort.key)) {
    return compareByNumber(
      serviceNumericValue(left, sort.key),
      serviceNumericValue(right, sort.key),
      sort.direction,
    );
  }

  return compareByText(
    formatServiceCell(left, sort.key),
    formatServiceCell(right, sort.key),
    sort.direction,
  );
}

export function filterAndSortServices(
  services: Service[],
  filters: ColumnFilters,
  sort: ColumnSort | null,
) {
  const filtered = services.filter((service) =>
    matchesServiceColumnFilters(service, filters),
  );

  if (!sort) return filtered;

  return [...filtered].sort((left, right) => {
    const compared = compareServices(left, right, sort);
    return compared !== 0 ? compared : left.id - right.id;
  });
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

export function filterAndSortStatuses(
  statuses: AppointmentStatusRow[],
  filters: ColumnFilters,
  sort: ColumnSort | null,
) {
  const filtered = statuses.filter((status) =>
    Object.entries(filters).every(([key, raw]) => {
      const query = raw.trim();
      if (!query) return true;
      return columnTextIncludes(formatStatusCell(status, key), query);
    }),
  );

  if (!sort) return filtered;

  return [...filtered].sort((left, right) => {
    if (sort.key === 'created_at') {
      const compared = compareByNumber(
        Date.parse(left.created_at ?? '') || 0,
        Date.parse(right.created_at ?? '') || 0,
        sort.direction,
      );
      return compared !== 0
        ? compared
        : left.status_code.localeCompare(right.status_code, 'he');
    }

    const compared = compareByText(
      formatStatusCell(left, sort.key),
      formatStatusCell(right, sort.key),
      sort.direction,
    );
    return compared !== 0
      ? compared
      : left.status_code.localeCompare(right.status_code, 'he');
  });
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

export function normalizeRetentionDays(value: unknown): number | null {
  if (value === '' || value == null) return 90;

  const raw = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(raw)) return null;
  const days = Math.round(raw);
  if (days < 1 || days > 3650) return null;
  return days;
}

export function formatBusinessField(
  business: BusinessSettings,
  key: string,
): string {
  if (key === 'deposit_percent') {
    const percent = parseDepositPercent(business.deposit_percent);
    return `${percent.toLocaleString('he-IL', { maximumFractionDigits: 2 })}%`;
  }

  if (key === 'save_recordings') {
    return business.save_recordings ? 'שומרים הקלטות' : 'לא שומרים הקלטות';
  }

  if (key === 'is_active') {
    return business.is_active === false ? 'לא פעיל' : 'פעיל';
  }

  if (key === 'recordings_retention_days') {
    const days = normalizeRetentionDays(business.recordings_retention_days) ?? 90;
    return `${days} ימים`;
  }

  const value = business[key as keyof BusinessSettings];
  if (value == null || value === '') return '';
  return String(value);
}

export function toBusinessDetailRows(
  business: BusinessSettings,
  fields = BUSINESS_FIELDS,
): DetailRow[] {
  return fields.map((field) => ({
    key: field.key,
    label: field.label,
    value: formatBusinessField(business, field.key),
    dir: field.dir,
  }));
}

export function toBusinessConfigDetailRows(
  business: BusinessSettings,
): DetailRow[] {
  return toBusinessDetailRows(business, BUSINESS_CONFIG_FIELDS);
}
