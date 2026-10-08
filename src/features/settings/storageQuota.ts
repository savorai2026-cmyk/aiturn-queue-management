export const INCLUDED_STORAGE_GB = 5;
export const EXTRA_STORAGE_GB_ILS = 5;
export const MIN_STORAGE_QUOTA_GB = 5;
export const MAX_STORAGE_QUOTA_GB = 1000;

const KIB = 1024;
const MIB = 1024 ** 2;
const GIB = 1024 ** 3;

export type StorageAlertLevel = 'ok' | 'warning' | 'high' | 'full';

export function normalizeStorageQuotaGb(value: unknown): number | null {
  if (value === '' || value == null) return INCLUDED_STORAGE_GB;

  const raw = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(raw)) return null;
  const gigabytes = Math.round(raw);
  if (gigabytes < MIN_STORAGE_QUOTA_GB || gigabytes > MAX_STORAGE_QUOTA_GB) {
    return null;
  }
  return gigabytes;
}

export function storageQuotaBytes(gigabytes: number): number {
  return gigabytes * GIB;
}

export function storageUsedRatio(usedBytes: number, quotaGb: number): number {
  const quota = storageQuotaBytes(quotaGb);
  if (!Number.isFinite(usedBytes) || usedBytes <= 0 || quota <= 0) return 0;
  return usedBytes / quota;
}

export function storageAlertLevel(ratio: number): StorageAlertLevel {
  if (ratio >= 1) return 'full';
  if (ratio >= 0.9) return 'high';
  if (ratio >= 0.75) return 'warning';
  return 'ok';
}

export function extraStorageMonthlyIls(quotaGb: number): number {
  const extra = Math.max(0, quotaGb - INCLUDED_STORAGE_GB);
  return extra * EXTRA_STORAGE_GB_ILS;
}

export function formatStorageAmount(bytes: number): string {
  const safe = Number.isFinite(bytes) && bytes > 0 ? bytes : 0;
  if (safe < MIB) {
    return `${formatNumber(safe / KIB, 0)} קילובייט`;
  }
  if (safe < GIB) {
    const megabytes = safe / MIB;
    return `${formatNumber(megabytes, megabytes < 10 ? 1 : 0)} מגה`;
  }
  const gigabytes = safe / GIB;
  return `${formatNumber(gigabytes, gigabytes < 10 ? 2 : 1)} ג׳יגה`;
}

export function formatStoragePercent(ratio: number): string {
  const percent = Math.max(0, ratio) * 100;
  if (percent >= 100) {
    return `${Math.round(percent).toLocaleString('he-IL')}%`;
  }
  if (percent >= 10) {
    return `${percent.toLocaleString('he-IL', { maximumFractionDigits: 0 })}%`;
  }
  return `${percent.toLocaleString('he-IL', { maximumFractionDigits: 1 })}%`;
}

export function formatStoragePrice(quotaGb: number): string {
  const extraGb = Math.max(0, quotaGb - INCLUDED_STORAGE_GB);
  const extraIls = extraStorageMonthlyIls(quotaGb);
  if (extraGb === 0) {
    return `${INCLUDED_STORAGE_GB} ג׳יגה כלולים במנוי, בלי תוספת חודשית.`;
  }
  if (extraGb === 1) {
    return `ג׳יגה נוספת אחת, ${extraIls.toLocaleString('he-IL')} ₪ לחודש מעבר למנוי.`;
  }
  return `${extraGb.toLocaleString('he-IL')} ג׳יגה נוספות, ${extraIls.toLocaleString('he-IL')} ₪ לחודש מעבר למנוי.`;
}

export function storageAlertMessage(level: StorageAlertLevel): string {
  if (level === 'warning') return 'האחסון עבר 75% מהמכסה.';
  if (level === 'high') return 'האחסון עבר 90% מהמכסה.';
  if (level === 'full') {
    return 'מכסת האחסון מלאה. כדי להמשיך לשמור קבצים, הגדילו את כמות הג׳יגה.';
  }
  return '';
}

function formatNumber(value: number, digits: number): string {
  return value.toLocaleString('he-IL', {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
}
