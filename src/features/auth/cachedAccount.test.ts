import { describe, expect, it } from 'vitest';
import { clearCachedIdentity, isCachedIdentityKey } from './cachedAccount';

describe('isCachedIdentityKey', () => {
  it('matches the saved session and the last chosen business', () => {
    expect(isCachedIdentityKey('sb-pcslxlckklfmkaskkbry-auth-token')).toBe(true);
    expect(isCachedIdentityKey('sb-pcslxlckklfmkaskkbry-auth-token-code-verifier')).toBe(true);
    expect(isCachedIdentityKey('activeBusiness:user-1')).toBe(true);
  });

  it('leaves theme and display preferences in place', () => {
    expect(isCachedIdentityKey('featurn-color-scheme')).toBe(false);
    expect(isCachedIdentityKey('clientTableColumns:business')).toBe(false);
  });

  it('removes only the saved sign-in', () => {
    const values = new Map([
      ['sb-ref-auth-token', '1'],
      ['activeBusiness:user-1', 'business'],
      ['featurn-color-scheme', 'dark'],
    ]);
    const storage = {
      get length() {
        return values.size;
      },
      key(index: number) {
        return [...values.keys()][index] ?? null;
      },
      removeItem(key: string) {
        values.delete(key);
      },
    } as Storage;

    clearCachedIdentity(storage);

    expect([...values.keys()]).toEqual(['featurn-color-scheme']);
  });
});
