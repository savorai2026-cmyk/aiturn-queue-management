export type ColumnFilters = Record<string, string>;

export interface ColumnSort {
  key: string;
  direction: 'asc' | 'desc';
}

export function nextColumnSort(
  current: ColumnSort | null,
  key: string,
): ColumnSort | null {
  if (current?.key !== key) return { key, direction: 'asc' };
  if (current.direction === 'asc') return { key, direction: 'desc' };
  return null;
}

export function visibleColumnFilters(
  filters: ColumnFilters,
  visibleKeys: string[],
): ColumnFilters {
  const next: ColumnFilters = {};
  for (const key of visibleKeys) {
    const value = filters[key];
    if (value?.trim()) {
      next[key] = value;
    }
  }
  return next;
}

export function normalizeColumnText(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function columnTextIncludes(value: string, query: string) {
  return normalizeColumnText(value).includes(normalizeColumnText(query));
}

export function columnDigitsInclude(value: string, query: string) {
  const digits = query.replace(/\D/g, '');
  if (!digits) return columnTextIncludes(value, query);
  return value.replace(/\D/g, '').includes(digits);
}

export function columnExactNumber(value: number, query: string) {
  const numeric = query.replace(/[^\d.]/g, '');
  if (!numeric || numeric === '.') return false;

  const tokenNumber = Number(numeric);
  if (!Number.isFinite(tokenNumber)) return false;

  return Math.round(value * 100) === Math.round(tokenNumber * 100);
}

export function compareByText(
  left: string,
  right: string,
  direction: ColumnSort['direction'],
) {
  return left.localeCompare(right, 'he') * (direction === 'asc' ? 1 : -1);
}

export function compareByNumber(
  left: number,
  right: number,
  direction: ColumnSort['direction'],
) {
  return (left - right) * (direction === 'asc' ? 1 : -1);
}
