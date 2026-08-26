import { describe, expect, it } from 'vitest';
import {
  hasStoredUiPreferences,
  parseUiPreferences,
  resolveVisibleFields,
  sanitizeVisibleFields,
  toggleVisibleField,
} from './preferences';

describe('ui preference merge', () => {
  it('prefers member fields over business fields', () => {
    expect(
      resolveVisibleFields(
        'clients',
        { clients: { visibleFields: ['full_name'] } },
        { clients: { visibleFields: ['city'] } },
      ),
    ).toEqual(['full_name']);
  });

  it('falls back to business then defaults', () => {
    expect(
      resolveVisibleFields(
        'clients',
        {},
        { clients: { visibleFields: ['email', 'city'] } },
      ),
    ).toEqual(['email', 'city']);

    expect(resolveVisibleFields('clients', {}, {})).toContain('full_name');
  });

  it('drops unknown keys and keeps at least one field', () => {
    expect(sanitizeVisibleFields('clients', ['nope'])).toContain('full_name');
    expect(toggleVisibleField(['full_name'], 'full_name')).toEqual([
      'full_name',
    ]);
  });

  it('parses stored json safely', () => {
    expect(
      parseUiPreferences({
        clients: { visibleFields: ['full_name', 3, 'city'] },
        statuses: { visibleFields: ['status_text'] },
      }),
    ).toEqual({
      clients: { visibleFields: ['full_name', 'city'] },
      statuses: { visibleFields: ['status_text'] },
    });

    expect(hasStoredUiPreferences({})).toBe(false);
    expect(
      hasStoredUiPreferences({ statuses: { visibleFields: ['color'] } }),
    ).toBe(true);
  });
});
