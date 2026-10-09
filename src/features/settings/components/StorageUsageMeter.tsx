import { useEffect, useState } from 'react';
import type { SubscriptionPlan } from '../../usage/planPricing';
import { getBusinessStorageUsedBytes } from '../settings.api';
import {
  formatStorageAmount,
  formatStoragePercent,
  formatStoragePrice,
  storageAlertLevel,
  storageAlertMessage,
  storageQuotaBytes,
  storageUsedRatio,
} from '../storageQuota';
import styles from './StorageUsageMeter.module.css';

interface StorageUsageBarProps {
  usedBytes: number | null;
  quotaGb: number;
  plan?: SubscriptionPlan;
  rates?: { includedGb: number; extraGbIls: number };
  error?: string;
}

export function StorageUsageBar({
  usedBytes,
  quotaGb,
  plan = 'regular',
  rates,
  error = '',
}: StorageUsageBarProps) {
  const ratio = usedBytes == null ? 0 : storageUsedRatio(usedBytes, quotaGb);
  const level = storageAlertLevel(ratio);
  const percent = formatStoragePercent(ratio);
  const usedLabel = usedBytes == null ? 'מחשב נפח' : formatStorageAmount(usedBytes);
  const alert = storageAlertMessage(level);
  const fill = Math.min(100, ratio * 100);

  return (
    <div className={styles.meter}>
      <div className={styles.head}>
        <span>
          {usedLabel} מתוך {quotaGb.toLocaleString('he-IL')} ג׳יגה
        </span>
        <span>{usedBytes == null ? '' : percent}</span>
      </div>
      <div
        className={styles.track}
        role="meter"
        aria-label="ניצול מכסת האחסון"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(fill)}
        aria-valuetext={`${usedLabel} מתוך ${quotaGb} ג׳יגה, ${percent}`}
      >
        <div
          className={styles.fill}
          data-level={level}
          style={{ width: `${fill}%` }}
        />
      </div>
      {error && <p className={styles.error}>{error}</p>}
      {alert && (
        <p className={styles.alert} data-level={level} role="status">
          {alert}
        </p>
      )}
      <p className={styles.price}>{formatStoragePrice(quotaGb, plan, rates)}</p>
      <p className={styles.hint}>
        התראה ב־75%, ב־90%, וכשהמכסה מלאה. הנפח הוא של קבצי ההקלטות.
      </p>
      {usedBytes != null && usedBytes > storageQuotaBytes(quotaGb) && (
        <p className={styles.hint}>
          בשימוש {formatStorageAmount(usedBytes)}, מעבר למכסה שנבחרה.
        </p>
      )}
    </div>
  );
}

interface StorageUsageMeterProps {
  businessCode: string;
  quotaGb: number;
  plan?: SubscriptionPlan;
  rates?: { includedGb: number; extraGbIls: number };
}

export default function StorageUsageMeter({
  businessCode,
  quotaGb,
  plan = 'regular',
  rates,
}: StorageUsageMeterProps) {
  const [usedBytes, setUsedBytes] = useState<number | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setUsedBytes(null);
    setError('');

    getBusinessStorageUsedBytes(businessCode)
      .then((bytes) => {
        if (!cancelled) setUsedBytes(bytes);
      })
      .catch(() => {
        if (!cancelled) setError('לא ניתן לחשב את נפח האחסון.');
      });

    return () => {
      cancelled = true;
    };
  }, [businessCode]);

  return (
    <StorageUsageBar
      usedBytes={usedBytes}
      quotaGb={quotaGb}
      plan={plan}
      rates={rates}
      error={error}
    />
  );
}
