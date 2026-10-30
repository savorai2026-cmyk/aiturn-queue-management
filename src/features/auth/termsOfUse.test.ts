import { describe, expect, it } from 'vitest';
import {
  TERMS_REQUIRED_FROM,
  TERMS_SECTIONS,
  TERMS_SUMMARY,
  TERMS_VERSION,
  hasAcceptedTerms,
  needsTermsAcceptance,
  readPendingTermsAcceptance,
  termsAcceptanceMetadata,
  writePendingTermsAcceptance,
} from './termsOfUse';

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear() {
      values.clear();
    },
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    key(index: number) {
      return [...values.keys()][index] ?? null;
    },
    removeItem(key: string) {
      values.delete(key);
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
  };
}

function termsText() {
  return [
    TERMS_SUMMARY,
    ...TERMS_SECTIONS.flatMap((section) => [
      section.title,
      ...section.paragraphs,
      ...(section.bullets ?? []),
    ]),
  ].join('\n');
}

describe('terms of use', () => {
  it('limits liability to the product surface we control, without naming suppliers', () => {
    const text = termsText();

    expect(text).toContain('ממשק הניהול');
    expect(text).toContain('הלוגיקה העסקית');
    expect(text).toContain('שכבת הקישור');
    expect(text).toContain('אינו באחריותנו');
    expect(text).not.toMatch(/\b(vapi|telnyx|supabase|openai|meta|z-credit|green api)\b/i);
  });

  it('requires acceptance only from new self-serve accounts', () => {
    expect(needsTermsAcceptance(null)).toBe(false);
    expect(
      needsTermsAcceptance({
        created_at: '2026-10-21T08:00:00.000Z',
      }),
    ).toBe(false);
    expect(
      needsTermsAcceptance({
        created_at: TERMS_REQUIRED_FROM,
        invited_at: '2026-10-30T10:00:00.000Z',
      }),
    ).toBe(false);
    expect(
      needsTermsAcceptance({
        created_at: '2026-10-30T12:00:00.000Z',
        user_metadata: { terms_accepted_at: '2026-10-30T12:00:01.000Z' },
      }),
    ).toBe(false);
    expect(
      needsTermsAcceptance({
        created_at: '2026-10-30T12:00:00.000Z',
      }),
    ).toBe(true);
    expect(hasAcceptedTerms({ user_metadata: { terms_accepted_at: '  ' } })).toBe(false);
  });

  it('stores a versioned acceptance stamp', () => {
    const storage = memoryStorage();
    const acceptedAt = '2026-10-30T12:04:00.000Z';

    writePendingTermsAcceptance(storage, acceptedAt);

    expect(readPendingTermsAcceptance(storage)).toEqual({
      terms_accepted_at: acceptedAt,
      terms_version: TERMS_VERSION,
    });
    expect(termsAcceptanceMetadata(acceptedAt).terms_version).toBe(TERMS_VERSION);
    expect(readPendingTermsAcceptance({ getItem: () => '{' })).toBeNull();
    expect(readPendingTermsAcceptance({ getItem: () => null })).toBeNull();
  });
});
