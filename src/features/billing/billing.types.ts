export type PaymentMethodStatus =
  | 'pending'
  | 'active'
  | 'failed'
  | 'revoked';

export type BillingSessionStatus =
  | 'pending'
  | 'succeeded'
  | 'failed'
  | 'canceled'
  | 'expired';

export interface PaymentMethodSummary {
  id: string;
  businessCode: string;
  provider: string;
  status: PaymentMethodStatus;
  last4: string | null;
  cardExp: string | null;
  tokenizedAt: string | null;
  updatedAt: string;
}

export interface BillingSessionSummary {
  id: string;
  uniqueid: string;
  status: BillingSessionStatus;
  errorText: string | null;
  expiresAt: string;
  completedAt: string | null;
  createdAt: string;
}
