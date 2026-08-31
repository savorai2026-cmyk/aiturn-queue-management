import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  readBillingPromptSkipped,
  writeBillingPromptSkipped,
} from './billingPrompt';

describe('billingPrompt', () => {
  const store = new Map<string, string>();

  beforeEach(() => {
    store.clear();
    vi.stubGlobal('sessionStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('remembers a postponed billing prompt for the session', () => {
    expect(readBillingPromptSkipped('biz-1')).toBe(false);
    writeBillingPromptSkipped('biz-1');
    expect(readBillingPromptSkipped('biz-1')).toBe(true);
    expect(readBillingPromptSkipped('biz-2')).toBe(false);
  });
});
