import { describe, expect, it } from 'vitest';
import {
  formatSpokenTime,
  monthChargeIls,
  voiceChargeIls,
} from './planPricing';

describe('plan pricing', () => {
  it('charges 70 agorot before VAT for each actual minute', () => {
    expect(voiceChargeIls(0)).toBe(0);
    expect(voiceChargeIls(60)).toBeCloseTo(0.7 * 1.18, 5);
    expect(voiceChargeIls(10)).toBeCloseTo(0.7 * 1.18 * (10 / 60), 5);
  });

  it('adds the regular subscription, extra users, spoken minutes, and storage', () => {
    expect(
      monthChargeIls({ voiceSeconds: 120, quotaGb: 5, memberCount: 3, plan: 'regular' }),
    ).toBeCloseTo(150 + 0.7 * 1.18 * 2, 5);
    expect(monthChargeIls({ voiceSeconds: 0, quotaGb: 8, memberCount: 5 })).toBeCloseTo(225, 5);
    expect(monthChargeIls({ voiceSeconds: 0, quotaGb: 8, memberCount: 4 })).toBeCloseTo(195, 5);
  });

  it('charges the expanded plan at 250, with a higher user rate and cheaper storage', () => {
    expect(monthChargeIls({ voiceSeconds: 60, quotaGb: 5, plan: 'expanded' })).toBeCloseTo(
      250 + 0.7 * 1.18,
      5,
    );
    expect(
      monthChargeIls({ voiceSeconds: 0, quotaGb: 10, memberCount: 6, plan: 'expanded' }),
    ).toBeCloseTo(250 + 40 + 9, 5);
  });

  it('describes a short call in seconds and a longer one in minutes', () => {
    expect(formatSpokenTime(10)).toBe('10 שניות');
    expect(formatSpokenTime(90)).toBe('1.5 דקות');
  });
});
