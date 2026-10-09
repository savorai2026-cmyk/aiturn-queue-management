import { describe, expect, it } from 'vitest';
import { isEmailAddress, passwordRuleError } from './passwordRules';

describe('staff password rules', () => {
  it('accepts a password with length, case, a digit, and a symbol', () => {
    expect(passwordRuleError('Clinic8!')).toBeNull();
  });

  it('rejects passwords that miss one of the rules', () => {
    expect(passwordRuleError('Short1!')).toMatch('8');
    expect(passwordRuleError('clinic8!')).toMatch('גדולה');
    expect(passwordRuleError('CLINIC8!')).toMatch('קטנה');
    expect(passwordRuleError('Clinic!!')).toMatch('ספרה');
    expect(passwordRuleError('Clinic88')).toMatch('מיוחד');
  });

  it('checks an email address', () => {
    expect(isEmailAddress('staff@example.com')).toBe(true);
    expect(isEmailAddress('not an email')).toBe(false);
  });
});
