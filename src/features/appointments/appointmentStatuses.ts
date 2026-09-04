export const BRAND_STATUS_COLORS = [
  { hex: '#073f67', label: 'כחול כהה' },
  { hex: '#0a527f', label: 'כחול' },
  { hex: '#12648f', label: 'כחול בהיר' },
  { hex: '#0d9488', label: 'טורקיז' },
  { hex: '#14b8a6', label: 'טורקיז בהיר' },
  { hex: '#607482', label: 'אפור' },
  { hex: '#b45309', label: 'כתום חמרה' },
  { hex: '#b91c1c', label: 'אדום' },
] as const;

export const DEFAULT_STATUS_COLOR = '#0d9488';
export const FALLBACK_STATUS_COLOR = '#12648f';

export interface StatusCatalogItem {
  status_code: string;
  status_text: string;
  color: string | null;
}

export const FALLBACK_STATUS_CATALOG: StatusCatalogItem[] = [
  { status_code: '01', status_text: 'ממתין', color: '#607482' },
  { status_code: '04', status_text: 'ממתין לאישור', color: '#0a527f' },
  { status_code: '05', status_text: 'ממתין לתשלום', color: '#14b8a6' },
  { status_code: '02', status_text: 'מתוזמן', color: '#0d9488' },
  { status_code: '03', status_text: 'הושלם', color: '#073f67' },
  { status_code: '09', status_text: 'לא הגיע', color: '#b45309' },
  { status_code: '10', status_text: 'מבוטל', color: '#b91c1c' },
];

const LEGACY_STATUS_CODES: Record<string, string> = {
  waiting: '01',
  scheduled: '02',
  completed: '03',
  no_show: '09',
  canceled: '10',
  cancelled: '10',
};

const PREFERRED_ORDER = ['01', '04', '05', '02', '03', '09', '10'];
const CLOSED_STATUS_CODES = new Set(['03', '09', '10', 'completed', 'no_show', 'canceled', 'cancelled']);
const CANCELED_STATUS_CODES = new Set(['10', 'canceled', 'cancelled']);

function normalizeHex(color: string | null | undefined): string | null {
  const value = color?.trim() ?? '';
  return /^#[0-9a-f]{6}$/i.test(value) ? value : null;
}

function canonicalStatusCode(status: string) {
  const code = status.trim();
  return LEGACY_STATUS_CODES[code] ?? LEGACY_STATUS_CODES[code.toLowerCase()] ?? code;
}

export function isCanceledStatus(status: string) {
  const code = canonicalStatusCode(status);
  return CANCELED_STATUS_CODES.has(code) || CANCELED_STATUS_CODES.has(status.trim().toLowerCase());
}

export function isClosedStatus(status: string) {
  const code = canonicalStatusCode(status);
  return (
    CLOSED_STATUS_CODES.has(code) ||
    CLOSED_STATUS_CODES.has(status.trim().toLowerCase())
  );
}

export function sortStatusCatalog(
  rows: StatusCatalogItem[],
): StatusCatalogItem[] {
  return [...rows].sort((left, right) => {
    const leftIndex = PREFERRED_ORDER.indexOf(left.status_code);
    const rightIndex = PREFERRED_ORDER.indexOf(right.status_code);

    if (leftIndex !== -1 || rightIndex !== -1) {
      return (leftIndex === -1 ? 99 : leftIndex) - (rightIndex === -1 ? 99 : rightIndex);
    }

    return left.status_text.localeCompare(right.status_text, 'he');
  });
}

export function resolveStatusCatalog(
  rows: StatusCatalogItem[],
): StatusCatalogItem[] {
  if (rows.length === 0) {
    return FALLBACK_STATUS_CATALOG;
  }

  return sortStatusCatalog(rows);
}

export function getStatusColor(
  status: string,
  catalog: StatusCatalogItem[] = FALLBACK_STATUS_CATALOG,
) {
  const code = canonicalStatusCode(status);
  const match =
    catalog.find((item) => item.status_code === status) ??
    catalog.find((item) => item.status_code === code);
  const fromCatalog = normalizeHex(match?.color);
  if (fromCatalog) return fromCatalog;

  const fallback = FALLBACK_STATUS_CATALOG.find(
    (item) => item.status_code === code || item.status_code === status,
  );
  return normalizeHex(fallback?.color) ?? FALLBACK_STATUS_COLOR;
}

export function getStatusLabel(
  status: string,
  catalog: StatusCatalogItem[] = FALLBACK_STATUS_CATALOG,
) {
  const code = canonicalStatusCode(status);
  const match =
    catalog.find((item) => item.status_code === status) ??
    catalog.find((item) => item.status_code === code);
  if (match?.status_text) return match.status_text;

  const fallback = FALLBACK_STATUS_CATALOG.find(
    (item) => item.status_code === code || item.status_code === status,
  );
  return fallback?.status_text ?? status;
}

export function creatableStatuses(catalog: StatusCatalogItem[]) {
  const open = catalog.filter((item) => !isClosedStatus(item.status_code));
  return open.length > 0
    ? open
    : catalog.filter((item) => !isCanceledStatus(item.status_code));
}

export function pickDefaultCreateStatus(catalog: StatusCatalogItem[]) {
  const options = creatableStatuses(catalog);
  return (
    options.find((item) => item.status_code === '01') ??
    options.find((item) => item.status_code === 'waiting') ??
    options.find((item) => item.status_code === '02') ??
    options.find((item) => item.status_code === 'scheduled') ??
    options[0] ??
    FALLBACK_STATUS_CATALOG[0]
  );
}

export function withCurrentStatus(
  catalog: StatusCatalogItem[],
  current?: string | null,
): StatusCatalogItem[] {
  if (!current || catalog.some((item) => item.status_code === current)) {
    return catalog;
  }

  return [
    ...catalog,
    {
      status_code: current,
      status_text: getStatusLabel(current, catalog),
      color: getStatusColor(current, catalog),
    },
  ];
}
