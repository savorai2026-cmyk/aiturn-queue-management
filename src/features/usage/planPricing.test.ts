import { describe, expect, it } from 'vitest';
import {
  countWhatsappWindows,
  formatSpokenTime,
  monthChargeIls,
  voiceChargeIls,
} from './planPricing';

describe('plan pricing', () => {
  it('charges 90 agorot before VAT for each regular-plan minute', () => {
    expect(voiceChargeIls(0)).toBe(0);
    expect(voiceChargeIls(60)).toBeCloseTo(0.9 * 1.18, 5);
    expect(voiceChargeIls(10)).toBeCloseTo(0.9 * 1.18 * (10 / 60), 5);
  });

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

  it('bills one WhatsApp window per phone until 24 hours have passed', () => {
    const monthStart = Date.parse('2026-10-01T00:00:00.000Z');
    const logs = [
      { id: 'a', phone: '+972501234567', startedAt: '2026-10-02T08:00:00.000Z' },
      { id: 'a', phone: '0501234567', startedAt: '2026-10-02T08:00:00.000Z' },
      { id: 'b', phone: '0501234567', startedAt: '2026-10-02T20:00:00.000Z' },
      { id: 'c', phone: '0501234567', startedAt: '2026-10-03T08:00:00.000Z' },
      { id: 'd', phone: '0509999999', startedAt: '2026-10-02T09:00:00.000Z' },
      { id: 'old', phone: '0501234567', startedAt: '2026-09-30T20:00:00.000Z' },
    ];

    expect(countWhatsappWindows(logs, monthStart)).toEqual({ customer: 3, business: 0 });
    expect(
      monthChargeIls({
        voiceSeconds: 0,
        quotaGb: 5,
        memberCount: 2,
        whatsappWindows: 2,
        plan: 'regular',
      }),
    ).toBeCloseTo(99 + 2 * 0.11 * 1.18, 5);
  });

  it('charges a business-opened window at the business rate and keeps a reply inside the customer window', () => {
    const monthStart = Date.parse('2026-10-01T00:00:00.000Z');
    const logs = [
      { id: 'open', phone: '0501111111', startedAt: '2026-10-02T08:00:00.000Z', initiatedBy: 'customer' },
      { id: 'reply', phone: '0501111111', startedAt: '2026-10-02T12:00:00.000Z', initiatedBy: 'business' },
      { id: 'later', phone: '0502222222', startedAt: '2026-10-04T08:00:00.000Z', initiatedBy: 'business' },
      { id: 'blank', phone: '0503333333', startedAt: '2026-10-04T09:00:00.000Z', initiatedBy: null },
    ];

    expect(countWhatsappWindows(logs, monthStart)).toEqual({ customer: 2, business: 1 });
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
