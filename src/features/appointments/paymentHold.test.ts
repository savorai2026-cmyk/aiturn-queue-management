import { describe, expect, it } from 'vitest';
import { readPaymentHold } from './paymentHold';

describe('payment hold', () => {
  it('marks a status 05 appointment as waiting for proof', () => {
    expect(
      readPaymentHold('05', {
        payment_requested_at: '2026-11-04T10:00:00+02:00',
        payment_amount: 120,
        payee_name: 'המרפאה',
      }),
    ).toMatchObject({
      awaiting: true,
      label: 'ממתין לאסמכתא',
      reason: 'cancellations',
      amount: '120',
      payeeName: 'המרפאה',
      proof: null,
    });
  });

  it('reads a deposit hold and its amount', () => {
    expect(
      readPaymentHold('05', {
        payment_requested_at: '2026-11-08T10:00:00+02:00',
        payment_amount: 35,
        payment_reason: 'deposit',
      }),
    ).toMatchObject({ awaiting: true, reason: 'deposit', amount: '35' });
  });

  it('keeps a received WhatsApp proof after the appointment is confirmed', () => {
    const hold = readPaymentHold('02', {
      payment_proof: {
        accepted: true,
        amount: '120',
        payee_name: 'המרפאה',
        paid_at: '2026-11-04T10:30:00+02:00',
        storage_path: 'biz/2026/payments/42-file.jpg',
      },
    });

    expect(hold?.awaiting).toBe(false);
    expect(hold?.proof?.storagePath).toBe('biz/2026/payments/42-file.jpg');
  });

  it('ignores an ordinary appointment', () => {
    expect(readPaymentHold('02', {})).toBeNull();
  });
});
