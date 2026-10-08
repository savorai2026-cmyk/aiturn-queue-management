import { describe, expect, it } from 'vitest';
import {
  formatSpokenTime,
  monthChargeIls,
  voiceChargeIls,
} from './planPricing';

describe('plan pricing', () => {
  it('charges 70 agorot per actual minute, with no included allowance', () => {
    expect(voiceChargeIls(0)).toBe(0);
    expect(voiceChargeIls(60)).toBeCloseTo(0.7, 5);
    expect(voiceChargeIls(10)).toBeCloseTo(0.7 * (10 / 60), 5);
  });

  it('adds the subscription, the spoken minutes, and extra storage', () => {
    expect(monthChargeIls({ voiceSeconds: 120, quotaGb: 5 })).toBeCloseTo(151.4, 5);
    expect(monthChargeIls({ voiceSeconds: 0, quotaGb: 8 })).toBeCloseTo(165, 5);
  });

  it('describes a short call in seconds and a longer one in minutes', () => {
    expect(formatSpokenTime(10)).toBe('10 שניות');
    expect(formatSpokenTime(90)).toBe('1.5 דקות');
  });
});
