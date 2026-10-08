import { extraStorageMonthlyIls } from '../settings/storageQuota';

export const MONTHLY_PLAN_ILS = 150;
export const INCLUDED_USERS = 3;
export const VOICE_AGOROT_PER_MINUTE = 70;

export function voiceChargeIls(seconds: number): number {
  if (!Number.isFinite(seconds) || seconds <= 0) return 0;
  return (seconds / 60) * (VOICE_AGOROT_PER_MINUTE / 100);
}

export function monthChargeIls(input: {
  voiceSeconds: number;
  quotaGb: number;
}): number {
  return (
    MONTHLY_PLAN_ILS +
    voiceChargeIls(input.voiceSeconds) +
    extraStorageMonthlyIls(input.quotaGb)
  );
}

export function formatPlanIls(value: number): string {
  return value.toLocaleString('he-IL', {
    style: 'currency',
    currency: 'ILS',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatSpokenTime(seconds: number): string {
  const safe = Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
  const minutes = safe / 60;
  if (minutes < 1) {
    return `${Math.round(safe).toLocaleString('he-IL')} שניות`;
  }
  const digits = minutes < 10 ? 1 : 0;
  return `${minutes.toLocaleString('he-IL', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })} דקות`;
}
