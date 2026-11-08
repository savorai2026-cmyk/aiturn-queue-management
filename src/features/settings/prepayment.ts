import type { BusinessSettings } from './settings.types';

export type BusinessPaymentRequirement = BusinessSettings['default_payment_requirement'];

export const BUSINESS_PAYMENT_OPTIONS: {
  value: BusinessPaymentRequirement;
  label: string;
}[] = [
  { value: 'none', label: 'ללא תשלום' },
  { value: 'deposit', label: 'מקדמה' },
  { value: 'full', label: 'תשלום מלא' },
];

export const DEFAULT_PAYMENT_HOLD_HOURS = 12;
export const MAX_PAYMENT_HOLD_HOURS = 168;

export function parseBusinessPaymentRequirement(value: unknown): BusinessPaymentRequirement {
  return value === 'deposit' || value === 'full' ? value : 'none';
}

function formatPercent(percent: number) {
  return `${percent.toLocaleString('he-IL', { maximumFractionDigits: 2 })}%`;
}

export function prepaymentSummary(requirement: unknown, depositPercent: number): string {
  const kind = parseBusinessPaymentRequirement(requirement);
  if (kind === 'full') return 'תשלום מלא מראש';
  if (kind === 'deposit') return `מקדמה ${formatPercent(depositPercent)}`;
  if (depositPercent > 0) {
    return `ללא תשלום (מקדמה ${formatPercent(depositPercent)} ללקוחות שסומנו)`;
  }
  return 'ללא תשלום';
}

export interface PrepaymentDraft {
  requirement: BusinessPaymentRequirement;
  depositPercent: number;
  payeeName: string;
  instructions: string;
  holdHours: number;
}

export function validatePrepayment(draft: PrepaymentDraft): string | null {
  const percent = draft.depositPercent;
  if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
    return 'אחוז המקדמה חייב להיות מספר בין 0 ל-100.';
  }
  if (draft.requirement === 'deposit' && percent <= 0) {
    return 'כשכל הלקוחות משלמים מקדמה, אחוז המקדמה חייב להיות גדול מאפס.';
  }
  if (
    !Number.isInteger(draft.holdHours) ||
    draft.holdHours < 1 ||
    draft.holdHours > MAX_PAYMENT_HOLD_HOURS
  ) {
    return `זמן ההמתנה לאסמכתא חייב להיות מספר שלם בין 1 ל-${MAX_PAYMENT_HOLD_HOURS} שעות.`;
  }
  const collects = draft.requirement !== 'none' || percent > 0;
  if (collects && (!draft.payeeName.trim() || !draft.instructions.trim())) {
    return 'כדי לגבות מראש צריך שם מוטב והסבר איך לשלם.';
  }
  return null;
}
