import { describe, expect, it } from 'vitest';
import {
  filterTimezoneGroups,
  formatTimezoneLabel,
  getTimezoneGroups,
} from './timezones';

describe('timezones', () => {
  it('offers 24 hour zones with Jerusalem first', () => {
    const groups = getTimezoneGroups(null, new Date('2026-01-15T12:00:00Z'));
    const values = groups.flatMap((group) =>
      group.options.map((option) => option.value),
    );

    expect(values).toHaveLength(24);
    expect(values[0]).toBe('Asia/Jerusalem');
    expect(new Set(values).size).toBe(24);
  });

  it('labels Jerusalem in Hebrew with an offset', () => {
    const label = formatTimezoneLabel(
      'Asia/Jerusalem',
      new Date('2026-01-15T12:00:00Z'),
    );

    expect(label).toContain('ירושלים');
    expect(label).toMatch(/GMT[+-]\d/);
  });

  it('keeps a major city for west, east, and Europe', () => {
    const groups = getTimezoneGroups(null, new Date('2026-01-15T12:00:00Z'));
    const values = groups.flatMap((group) =>
      group.options.map((option) => option.value),
    );

    expect(values).toContain('America/New_York');
    expect(values).toContain('Europe/London');
    expect(values).toContain('Asia/Tokyo');
    expect(values).toContain('Pacific/Auckland');
    expect(values).not.toContain('Asia/Hebron');
  });

  it('keeps an unknown saved timezone selectable', () => {
    const groups = getTimezoneGroups(
      'Custom/Zone',
      new Date('2026-01-15T12:00:00Z'),
    );
    const values = groups.flatMap((group) =>
      group.options.map((option) => option.value),
    );

    expect(values).toContain('Custom/Zone');
    expect(groups[0]?.options[0]?.value).toBe('Custom/Zone');
    expect(groups[0]?.options[0]?.label).toContain('ערך קיים');
  });

  it('filters by Hebrew city name', () => {
    const groups = getTimezoneGroups(null, new Date('2026-01-15T12:00:00Z'));
    const sydney = filterTimezoneGroups(groups, 'סידני');

    expect(sydney).toHaveLength(1);
    expect(sydney[0]?.options.map((option) => option.value)).toEqual([
      'Australia/Sydney',
    ]);
  });
});
