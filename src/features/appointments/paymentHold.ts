export interface PaymentProof {
  storagePath: string;
  amount: string | null;
  payeeName: string | null;
  paidAt: string | null;
}

export interface PaymentHold {
  awaiting: boolean;
  label: string;
  requestedAt: string | null;
  amount: string | null;
  payeeName: string | null;
  proof: PaymentProof | null;
}

function text(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed || null;
}

function record(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

export function readPaymentHold(
  status: string,
  metadata: unknown,
): PaymentHold | null {
  const data = record(metadata);
  const proofRaw = record(data?.payment_proof);
  const storagePath = text(proofRaw?.storage_path);
  const proof = storagePath
    ? {
        storagePath,
        amount: text(proofRaw?.amount),
        payeeName: text(proofRaw?.payee_name),
        paidAt: text(proofRaw?.paid_at),
      }
    : null;
  const awaiting = String(status).trim() === '05';
  const requestedAt = text(data?.payment_requested_at);

  if (!awaiting && !proof && !requestedAt) {
    return null;
  }

  return {
    awaiting,
    label: awaiting ? 'ממתין לאסמכתא' : 'יש אסמכתא',
    requestedAt,
    amount: text(data?.payment_amount) ?? proof?.amount ?? null,
    payeeName: text(data?.payee_name) ?? proof?.payeeName ?? null,
    proof,
  };
}
