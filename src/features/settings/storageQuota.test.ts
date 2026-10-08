import { describe, expect, it } from 'vitest';
import {
  extraStorageMonthlyIls,
  formatStorageAmount,
  formatStoragePercent,
  formatStoragePrice,
  normalizeStorageQuotaGb,
  storageAlertLevel,
  storageQuotaBytes,
  storageUsedRatio,
} from './storageQuota';

describe('storage quota', () => {
  it('keeps the included five gigabytes and rejects a smaller quota', () => {
    expect(normalizeStorageQuotaGb('')).toBe(5);
    expect(normalizeStorageQuotaGb(8.4)).toBe(8);
    expect(normalizeStorageQuotaGb(4)).toBeNull();
    expect(normalizeStorageQuotaGb(1001)).toBeNull();
  });

  it('prices only the gigabytes above the included five', () => {
    expect(extraStorageMonthlyIls(5)).toBe(0);
    expect(extraStorageMonthlyIls(8)).toBe(15);
    expect(formatStoragePrice(5)).toContain('בלי תוספת');
    expect(formatStoragePrice(8)).toContain('15');
  });

  it('raises alerts at 75, 90, and 100 percent', () => {
    const quota = storageQuotaBytes(5);
    expect(storageAlertLevel(storageUsedRatio(quota * 0.74, 5))).toBe('ok');
    expect(storageAlertLevel(storageUsedRatio(quota * 0.75, 5))).toBe('warning');
    expect(storageAlertLevel(storageUsedRatio(quota * 0.9, 5))).toBe('high');
    expect(storageAlertLevel(storageUsedRatio(quota, 5))).toBe('full');
    expect(storageAlertLevel(storageUsedRatio(quota * 1.2, 5))).toBe('full');
  });

  it('formats a small recording footprint against five gigabytes', () => {
    const used = 8 * 1024 * 1024;
    expect(formatStorageAmount(used)).toBe('8.0 מגה');
    expect(formatStoragePercent(storageUsedRatio(used, 5))).toBe('0.2%');
  });
});
