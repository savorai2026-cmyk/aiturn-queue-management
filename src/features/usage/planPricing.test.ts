import { describe, expect, it } from 'vitest';
import {
  formatSpokenTime,
  monthChargeIls,
} from './planPricing';

describe('plan pricing', () => {
  it('adds the regular subscription, extra users, spoken minutes, and storage', () => {
    expect(
      monthChargeIls({ voiceSeconds: 120, quotaGb: 5, memberCount: 3, plan: 'regular' }),
    ).toBeCloseTo(99 + 40 + 0.9 * 1.18 * 2, 5);
    expect(monthChargeIls({ voiceSeconds: 0, quotaGb: 8, memberCount: 5 })).toBeCloseTo(234, 5);
    expect(monthChargeIls({ voiceSeconds: 0, quotaGb: 8, memberCount: 4 })).toBeCloseTo(194, 5);
  });

  it('charges the expanded plan at 199, with a lower user rate and cheaper storage', () => {
    expect(monthChargeIls({ voiceSeconds: 60, quotaGb: 5, plan: 'expanded' })).toBeCloseTo(
      199 + 0.7 * 1.18,
      5,
    );
    expect(
      monthChargeIls({ voiceSeconds: 0, quotaGb: 10, memberCount: 6, plan: 'expanded' }),
    ).toBeCloseTo(199 + 60 + 9, 5);
  });

  it('charges WhatsApp windows at the customer and business rates', () => {
    expect(
      monthChargeIls({
        voiceSeconds: 0,
        quotaGb: 5,
        memberCount: 2,
        whatsappWindows: 2,
        plan: 'regular',
      }),
    ).toBeCloseTo(99 + 2 * 0.11 * 1.18, 5);
    expect(
      monthChargeIls({
        voiceSeconds: 0,
        quotaGb: 5,
        memberCount: 2,
        whatsappCustomerWindows: 2,
        whatsappBusinessWindows: 1,
        plan: 'regular',
      }),
    ).toBeCloseTo(99 + (2 * 0.11 + 0.25) * 1.18, 5);
  });

  it('describes a short call in seconds and a longer one in minutes', () => {
    expect(formatSpokenTime(10)).toBe('10 שניות');
    expect(formatSpokenTime(90)).toBe('1.5 דקות');
  });
});
