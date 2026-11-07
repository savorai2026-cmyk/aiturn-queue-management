export const MONTHLY_PLAN_ILS = 99;
export const EXPANDED_MONTHLY_ILS = 199;
export const REGULAR_INCLUDED_USERS = 2;
export const EXPANDED_INCLUDED_USERS = 4;
export const EXTRA_USER_ILS = 40;
export const EXPANDED_EXTRA_USER_ILS = 30;
export const VAT_RATE = 0.18;
export const REGULAR_VOICE_AGOROT_PER_MINUTE = 90;
export const EXPANDED_VOICE_AGOROT_PER_MINUTE = 70;
export const REGULAR_INCLUDED_STORAGE_GB = 5;
export const EXPANDED_INCLUDED_STORAGE_GB = 7;
export const EXTRA_STORAGE_GB_ILS = 5;
export const EXPANDED_EXTRA_STORAGE_GB_ILS = 3;
export const WHATSAPP_CUSTOMER_AGOROT = 11;
export const EXPANDED_WHATSAPP_CUSTOMER_AGOROT = 9;
export const WHATSAPP_BUSINESS_AGOROT = 25;
export const EXPANDED_WHATSAPP_BUSINESS_AGOROT = 22;
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
    voiceAgorotPerMinute: expanded
      ? EXPANDED_VOICE_AGOROT_PER_MINUTE
      : REGULAR_VOICE_AGOROT_PER_MINUTE,
    whatsappCustomerAgorot: expanded
      ? EXPANDED_WHATSAPP_CUSTOMER_AGOROT
      : WHATSAPP_CUSTOMER_AGOROT,
    whatsappBusinessAgorot: expanded
      ? EXPANDED_WHATSAPP_BUSINESS_AGOROT
      : WHATSAPP_BUSINESS_AGOROT,
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

export function extraUserCount(
  memberCount: number,
  includedUsers = REGULAR_INCLUDED_USERS,
): number {
  if (!Number.isFinite(memberCount)) return 0;
  return Math.max(0, Math.floor(memberCount) - includedUsers);
}

export function voiceAgorotIncludingVat(agorot = REGULAR_VOICE_AGOROT_PER_MINUTE): number {
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

export function whatsappChargeIls(
  customerWindows: number,
  businessWindows: number,
  tariff: PlanTariff,
): number {
  const customer = Number.isFinite(customerWindows) ? Math.max(0, customerWindows) : 0;
  const business = Number.isFinite(businessWindows) ? Math.max(0, businessWindows) : 0;
  return (
    customer * (tariff.whatsappCustomerAgorot / 100) * (1 + VAT_RATE) +
    business * (tariff.whatsappBusinessAgorot / 100) * (1 + VAT_RATE)
  );
}

export function monthChargeIls(input: {
  voiceSeconds: number;
  quotaGb: number;
  memberCount?: number;
  whatsappWindows?: number;
  whatsappCustomerWindows?: number;
  whatsappBusinessWindows?: number;
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
  const whatsapp = whatsappChargeIls(
    input.whatsappCustomerWindows ?? input.whatsappWindows ?? 0,
    input.whatsappBusinessWindows ?? 0,
    tariff,
  );
  const extraStorage = Math.max(0, input.quotaGb - tariff.includedStorageGb) * tariff.extraStorageGbIls;
  return tariff.monthlyIls + extraUsers * tariff.extraUserIls + voice + whatsapp + extraStorage;
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
