import type { Json } from '../../types/database';

export interface CancellationPolicyDraft {
  enabled: boolean;
  cancellations: string;
  withinDays: string;
  nearHours: string;
  holdHours: string;
  payeeName: string;
  paymentText: string;
}

const EMPTY_DRAFT: CancellationPolicyDraft = {
  enabled: false,
  cancellations: '2',
  withinDays: '30',
  nearHours: '',
  holdHours: '12',
  payeeName: '',
  paymentText: '',
};

function positiveInt(value: unknown): number | null {
  if (typeof value === 'boolean' || value == null || value === '') {
    return null;
  }
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isInteger(parsed) && parsed >= 1 ? parsed : null;
}

function readObject(raw: unknown): Record<string, unknown> | null {
  if (typeof raw === 'string') {
    const text = raw.trim();
    if (!text) return null;
    try {
      return readObject(JSON.parse(text) as unknown);
    } catch {
      return null;
    }
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }
  return raw as Record<string, unknown>;
}

export function cancellationPolicyDraft(raw: unknown): CancellationPolicyDraft {
  const policy = readObject(raw);
  const cancellations = positiveInt(policy?.cancellations);
  const withinDays = positiveInt(policy?.within_days);
  const payeeName = String(policy?.payee_name ?? '').trim();
  const paymentText = String(policy?.payment_text ?? '').trim();
  if (!policy || cancellations == null || withinDays == null || !payeeName || !paymentText) {
    return { ...EMPTY_DRAFT };
  }

  const nearRaw = policy.near_hours;
  const nearHours = nearRaw == null || nearRaw === '' ? null : positiveInt(nearRaw);
  if ((nearRaw != null && nearRaw !== '') && nearHours == null) {
    return { ...EMPTY_DRAFT };
  }

  const holdRaw = policy.hold_hours;
  const holdHours = holdRaw == null || holdRaw === '' ? 12 : positiveInt(holdRaw) ?? 12;

  return {
    enabled: true,
    cancellations: String(cancellations),
    withinDays: String(withinDays),
    nearHours: nearHours == null ? '' : String(nearHours),
    holdHours: String(holdHours),
    payeeName,
    paymentText,
  };
}

export function cancellationPolicyPayload(
  draft: CancellationPolicyDraft,
): { value: Json | null } | { error: string } {
  if (!draft.enabled) {
    return { value: null };
  }

  const cancellations = positiveInt(draft.cancellations);
  const withinDays = positiveInt(draft.withinDays);
  if (cancellations == null || withinDays == null) {
    return { error: 'מספר הביטולים ומספר הימים חייבים להיות לפחות 1.' };
  }

  const nearHours = draft.nearHours.trim() === '' ? null : positiveInt(draft.nearHours);
  if (draft.nearHours.trim() !== '' && nearHours == null) {
    return { error: 'שעות הקרבה לתור חייבות להיות מספר שלם של לפחות 1, או להישאר ריקות.' };
  }

  const holdHours = draft.holdHours.trim() === '' ? 12 : positiveInt(draft.holdHours);
  if (holdHours == null) {
    return { error: 'שעות ההמתנה לאסמכתא חייבות להיות לפחות 1.' };
  }

  const payeeName = draft.payeeName.trim();
  const paymentText = draft.paymentText.trim();
  if (!payeeName || !paymentText) {
    return { error: 'צריך שם מוטב והסבר איך לשלם.' };
  }

  return {
    value: {
      cancellations,
      within_days: withinDays,
      ...(nearHours == null ? {} : { near_hours: nearHours }),
      hold_hours: holdHours,
      payee_name: payeeName,
      payment_text: paymentText,
    },
  };
}
