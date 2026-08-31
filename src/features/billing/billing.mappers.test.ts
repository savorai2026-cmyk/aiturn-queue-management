import { describe, expect, it } from 'vitest';
import {
  canManagePaymentMethods,
  formatCardExpiry,
  formatCardLast4,
  isActivePaymentMethod,
  isTerminalBillingSession,
} from './billing.mappers';

describe('billing.mappers', () => {
  it('allows only owners and admins to manage cards', () => {
    expect(canManagePaymentMethods('owner')).toBe(true);
    expect(canManagePaymentMethods('admin')).toBe(true);
    expect(canManagePaymentMethods('staff')).toBe(false);
    expect(canManagePaymentMethods('viewer')).toBe(false);
    expect(canManagePaymentMethods(null)).toBe(false);
  });

  it('formats the visible card digits and expiry', () => {
    expect(formatCardLast4('4242')).toBe('•••• 4242');
    expect(formatCardLast4('12')).toBeNull();
    expect(formatCardExpiry('0128')).toBe('01/28');
    expect(formatCardExpiry('01/28')).toBe('01/28');
  });

  it('treats only active methods as a saved card', () => {
    expect(isActivePaymentMethod({ status: 'active' })).toBe(true);
    expect(isActivePaymentMethod({ status: 'pending' })).toBe(false);
    expect(isActivePaymentMethod(null)).toBe(false);
  });

  it('marks finished billing sessions as terminal', () => {
    expect(isTerminalBillingSession('pending')).toBe(false);
    expect(isTerminalBillingSession('succeeded')).toBe(true);
    expect(isTerminalBillingSession('canceled')).toBe(true);
  });
});
