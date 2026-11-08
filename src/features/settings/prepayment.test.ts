import { describe, expect, it } from 'vitest';
import { prepaymentSummary, validatePrepayment, type PrepaymentDraft } from './prepayment';

const draft: PrepaymentDraft = {
  requirement: 'none',
  depositPercent: 0,
  payeeName: '',
  instructions: '',
  holdHours: 12,
};

describe('prepayment', () => {
  it('summarizes the business rule', () => {
    expect(prepaymentSummary('none', 0)).toBe('ללא תשלום');
    expect(prepaymentSummary('none', 20)).toBe('ללא תשלום (מקדמה 20% ללקוחות שסומנו)');
    expect(prepaymentSummary('deposit', 20)).toBe('מקדמה 20%');
    expect(prepaymentSummary('full', 0)).toBe('תשלום מלא מראש');
    expect(prepaymentSummary(null, 0)).toBe('ללא תשלום');
  });

  it('accepts no prepayment without payment details', () => {
    expect(validatePrepayment(draft)).toBeNull();
  });

  it('requires a positive percent when everyone pays a deposit', () => {
    expect(
      validatePrepayment({ ...draft, requirement: 'deposit', payeeName: 'a', instructions: 'b' }),
    ).toMatch(/גדול מאפס/);
  });

  it('requires payee and instructions whenever money may be collected', () => {
    expect(validatePrepayment({ ...draft, requirement: 'full' })).toMatch(/שם מוטב/);
    expect(validatePrepayment({ ...draft, depositPercent: 10 })).toMatch(/שם מוטב/);
    expect(
      validatePrepayment({ ...draft, depositPercent: 10, payeeName: 'a', instructions: 'b' }),
    ).toBeNull();
  });

  it('rejects hold hours outside 1 to 168', () => {
    expect(validatePrepayment({ ...draft, holdHours: 0 })).toMatch(/בין 1 ל-168/);
    expect(validatePrepayment({ ...draft, holdHours: 200 })).toMatch(/בין 1 ל-168/);
  });
});
