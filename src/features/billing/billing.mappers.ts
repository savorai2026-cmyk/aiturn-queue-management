import type { BusinessRole } from '../business/BusinessContextState';
import type {
  BillingSessionStatus,
  PaymentMethodStatus,
  PaymentMethodSummary,
} from './billing.types';

const MANAGING_ROLES = new Set<BusinessRole>(['owner', 'admin']);

const PAYMENT_STATUS_LABELS: Record<PaymentMethodStatus, string> = {
  pending: 'ממתין לשמירה',
  active: 'פעיל',
  failed: 'נכשל',
  revoked: 'בוטל',
};

const SESSION_STATUS_LABELS: Record<BillingSessionStatus, string> = {
  pending: 'ממתין',
  succeeded: 'נשמר',
  failed: 'נכשל',
  canceled: 'בוטל',
  expired: 'פג תוקף',
};

export function canManagePaymentMethods(role: BusinessRole | null | undefined) {
  return role != null && MANAGING_ROLES.has(role);
}

export function isActivePaymentMethod(
  method: Pick<PaymentMethodSummary, 'status'> | null | undefined,
) {
  return method?.status === 'active';
}

export function formatCardLast4(last4: string | null | undefined) {
  const digits = last4?.replace(/\D/g, '') ?? '';
  if (digits.length < 4) {
    return null;
  }

  return `•••• ${digits.slice(-4)}`;
}

export function formatCardExpiry(raw: string | null | undefined) {
  const digits = raw?.replace(/\D/g, '') ?? '';
  if (digits.length === 4) {
    return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  }

  const trimmed = raw?.trim();
  return trimmed || null;
}

export function getPaymentStatusLabel(status: PaymentMethodStatus) {
  return PAYMENT_STATUS_LABELS[status];
}

export function getBillingSessionLabel(status: BillingSessionStatus) {
  return SESSION_STATUS_LABELS[status];
}

export function isTerminalBillingSession(status: BillingSessionStatus) {
  return (
    status === 'succeeded' ||
    status === 'failed' ||
    status === 'canceled' ||
    status === 'expired'
  );
}
