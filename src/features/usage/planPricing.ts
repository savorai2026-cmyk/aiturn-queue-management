export const MONTHLY_PLAN_ILS = 150;
export const EXPANDED_MONTHLY_ILS = 250;
export const REGULAR_INCLUDED_USERS = 3;
export const EXPANDED_INCLUDED_USERS = 5;
export const EXTRA_USER_ILS = 30;
export const EXPANDED_EXTRA_USER_ILS = 40;
export const VAT_RATE = 0.18;
export const VOICE_AGOROT_PER_MINUTE = 70;
export const REGULAR_INCLUDED_STORAGE_GB = 5;
export const EXPANDED_INCLUDED_STORAGE_GB = 7;
export const EXTRA_STORAGE_GB_ILS = 5;
export const EXPANDED_EXTRA_STORAGE_GB_ILS = 3;
export const WHATSAPP_CUSTOMER_AGOROT = 10;
export const WHATSAPP_BUSINESS_AGOROT = 25;
export const REGULAR_RECORDING_MAX_DAYS = 90;
export const EXPANDED_RECORDING_MAX_DAYS = 2555;
export const DEFAULT_RECORDING_RETENTION_DAYS = 30;
export const DEFAULT_HISTORY_MONTHS = 6;
export const REGULAR_HISTORY_MAX_MONTHS = 24;
export const EXPANDED_HISTORY_MAX_MONTHS = 84;

export type SubscriptionPlan = 'regular' | 'expanded';

export function parseSubscriptionPlan(value: unknown): SubscriptionPlan {
  return value === 'expanded' ? 'expanded' : 'regular';
}

export function planLabel(plan: SubscriptionPlan): string {
  return plan === 'expanded' ? 'מורחב' : 'רגיל';
}

export function recordingRetentionMaxDays(plan: SubscriptionPlan): number {
  return plan === 'expanded'
    ? EXPANDED_RECORDING_MAX_DAYS
    : REGULAR_RECORDING_MAX_DAYS;
}

export function historyRetentionMaxMonths(plan: SubscriptionPlan): number {
  return plan === 'expanded'
    ? EXPANDED_HISTORY_MAX_MONTHS
    : REGULAR_HISTORY_MAX_MONTHS;
}

export function monthlyPlanIls(plan: SubscriptionPlan): number {
  return plan === 'expanded' ? EXPANDED_MONTHLY_ILS : MONTHLY_PLAN_ILS;
}

export function extraUserIls(plan: SubscriptionPlan): number {
  return plan === 'expanded' ? EXPANDED_EXTRA_USER_ILS : EXTRA_USER_ILS;
}

export function includedStorageGb(plan: SubscriptionPlan): number {
  return plan === 'expanded'
    ? EXPANDED_INCLUDED_STORAGE_GB
    : REGULAR_INCLUDED_STORAGE_GB;
}

export function extraStorageGbIls(plan: SubscriptionPlan): number {
  return plan === 'expanded' ? EXPANDED_EXTRA_STORAGE_GB_ILS : EXTRA_STORAGE_GB_ILS;
}

export function extraStorageChargeIls(
  quotaGb: number,
  plan: SubscriptionPlan = 'regular',
): number {
  const extra = Math.max(0, quotaGb - includedStorageGb(plan));
  return extra * extraStorageGbIls(plan);
}

export function recordingRetentionLimitText(plan: SubscriptionPlan): string {
  return daysLimitText(plan === 'expanded' ? EXPANDED_RECORDING_MAX_DAYS : REGULAR_RECORDING_MAX_DAYS);
}

export function historyRetentionLimitText(plan: SubscriptionPlan): string {
  return monthsLimitText(plan === 'expanded' ? EXPANDED_HISTORY_MAX_MONTHS : REGULAR_HISTORY_MAX_MONTHS);
}

export function daysLimitText(days: number): string {
  if (days >= EXPANDED_RECORDING_MAX_DAYS) return 'עד שבע שנים';
  if (days === REGULAR_RECORDING_MAX_DAYS) return 'עד 90 יום';
  return `עד ${days.toLocaleString('he-IL')} ימים`;
}

export function monthsLimitText(months: number): string {
  if (months >= EXPANDED_HISTORY_MAX_MONTHS) return 'עד שבע שנים';
  if (months === REGULAR_HISTORY_MAX_MONTHS) return 'עד שנתיים';
  return `עד ${months.toLocaleString('he-IL')} חודשים`;
}

export interface PlanTariff {
  monthlyIls: number;
  includedUsers: number;
  extraUserIls: number;
  includedStorageGb: number;
  extraStorageGbIls: number;
  voiceAgorotPerMinute: number;
  whatsappCustomerAgorot: number;
  whatsappBusinessAgorot: number;
  recordingMaxDays: number;
  historyMaxMonths: number;
  correspondenceMaxMonths: number;
}

export function catalogTariff(plan: SubscriptionPlan): PlanTariff {
  const expanded = plan === 'expanded';
  return {
    monthlyIls: expanded ? EXPANDED_MONTHLY_ILS : MONTHLY_PLAN_ILS,
    includedUsers: expanded ? EXPANDED_INCLUDED_USERS : REGULAR_INCLUDED_USERS,
    extraUserIls: expanded ? EXPANDED_EXTRA_USER_ILS : EXTRA_USER_ILS,
    includedStorageGb: expanded ? EXPANDED_INCLUDED_STORAGE_GB : REGULAR_INCLUDED_STORAGE_GB,
    extraStorageGbIls: expanded ? EXPANDED_EXTRA_STORAGE_GB_ILS : EXTRA_STORAGE_GB_ILS,
    voiceAgorotPerMinute: VOICE_AGOROT_PER_MINUTE,
    whatsappCustomerAgorot: WHATSAPP_CUSTOMER_AGOROT,
    whatsappBusinessAgorot: WHATSAPP_BUSINESS_AGOROT,
    recordingMaxDays: expanded ? EXPANDED_RECORDING_MAX_DAYS : REGULAR_RECORDING_MAX_DAYS,
    historyMaxMonths: expanded ? EXPANDED_HISTORY_MAX_MONTHS : REGULAR_HISTORY_MAX_MONTHS,
    correspondenceMaxMonths: expanded ? EXPANDED_HISTORY_MAX_MONTHS : REGULAR_HISTORY_MAX_MONTHS,
  };
}

export function applyTariffOverride(
  base: PlanTariff,
  override: Partial<PlanTariff> | null,
): PlanTariff {
  if (!override) return base;
  const next = { ...base };
  (Object.keys(base) as (keyof PlanTariff)[]).forEach((key) => {
    const value = override[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      next[key] = value;
    }
  });
  return next;
}

export function includedUserCount(plan: SubscriptionPlan): number {
  return plan === 'expanded' ? EXPANDED_INCLUDED_USERS : REGULAR_INCLUDED_USERS;
}

export function extraUserCount(
  memberCount: number,
  includedUsers = REGULAR_INCLUDED_USERS,
): number {
  if (!Number.isFinite(memberCount)) return 0;
  return Math.max(0, Math.floor(memberCount) - includedUsers);
}

export function extraUserChargeIls(
  memberCount: number,
  plan: SubscriptionPlan = 'regular',
): number {
  return extraUserCount(memberCount, includedUserCount(plan)) * extraUserIls(plan);
}

export function voiceChargeIls(seconds: number): number {
  if (!Number.isFinite(seconds) || seconds <= 0) return 0;
  return (seconds / 60) * (VOICE_AGOROT_PER_MINUTE / 100) * (1 + VAT_RATE);
}

export function voiceAgorotIncludingVat(agorot = VOICE_AGOROT_PER_MINUTE): number {
  return agorotIncludingVat(agorot);
}

export function agorotIncludingVat(agorot: number): number {
  return agorot * (1 + VAT_RATE);
}

export function normalizeHistoryMonths(
  value: unknown,
  plan: SubscriptionPlan = 'regular',
  maxMonths = historyRetentionMaxMonths(plan),
): number | null {
  if (value === '' || value == null) return DEFAULT_HISTORY_MONTHS;

  const raw = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(raw)) return null;
  const months = Math.round(raw);
  if (months < 1 || months > maxMonths) return null;
  return months;
}

export function monthChargeIls(input: {
  voiceSeconds: number;
  quotaGb: number;
  memberCount?: number;
  plan?: SubscriptionPlan;
  tariff?: PlanTariff;
}): number {
  const plan = input.plan ?? 'regular';
  const tariff = input.tariff ?? catalogTariff(plan);
  const extraUsers = extraUserCount(input.memberCount ?? 0, tariff.includedUsers);
  const voice =
    !Number.isFinite(input.voiceSeconds) || input.voiceSeconds <= 0
      ? 0
      : (input.voiceSeconds / 60) * (tariff.voiceAgorotPerMinute / 100) * (1 + VAT_RATE);
  const extraStorage = Math.max(0, input.quotaGb - tariff.includedStorageGb) * tariff.extraStorageGbIls;
  return tariff.monthlyIls + extraUsers * tariff.extraUserIls + voice + extraStorage;
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
