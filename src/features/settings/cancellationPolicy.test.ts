import { describe, expect, it } from 'vitest';
import {
  cancellationPolicyDraft,
  cancellationPolicyPayload,
} from './cancellationPolicy';

describe('cancellation policy', () => {
  it('turns an active stored rule into a form draft', () => {
    expect(
      cancellationPolicyDraft({
        cancellations: 3,
        within_days: 14,
        near_hours: 6,
        hold_hours: 8,
        payee_name: 'המרפאה',
        payment_text: 'העברה לחשבון',
      }),
    ).toMatchObject({
      enabled: true,
      cancellations: '3',
      withinDays: '14',
      nearHours: '6',
      holdHours: '8',
      payeeName: 'המרפאה',
      paymentText: 'העברה לחשבון',
    });
  });

  it('treats an incomplete rule as off', () => {
    expect(cancellationPolicyDraft({ cancellations: 2 }).enabled).toBe(false);
    expect(cancellationPolicyDraft(null).enabled).toBe(false);
  });

  it('writes the same fields the booking server reads', () => {
    const payload = cancellationPolicyPayload({
      enabled: true,
      cancellations: '2',
      withinDays: '30',
      nearHours: '',
      holdHours: '12',
      payeeName: '  המרפאה ',
      paymentText: ' ביט לשם המרפאה ',
    });

    expect(payload).toEqual({
      value: {
        cancellations: 2,
        within_days: 30,
        hold_hours: 12,
        payee_name: 'המרפאה',
        payment_text: 'ביט לשם המרפאה',
      },
    });
  });

  it('clears the rule when it is turned off', () => {
    expect(
      cancellationPolicyPayload({
        enabled: false,
        cancellations: '2',
        withinDays: '30',
        nearHours: '',
        holdHours: '12',
        payeeName: '',
        paymentText: '',
      }),
    ).toEqual({ value: null });
  });
});
