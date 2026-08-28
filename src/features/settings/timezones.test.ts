import { describe, expect, it } from 'vitest';
import {
  filterTimezoneGroups,
  formatTimezoneLabel,
  getTimezoneGroups,
  listIanaTimezones,
} from './timezones';

describe('timezones', () => {
  it('includes Israel in the IANA catalog', () => {
    expect(listIanaTimezones()).toContain('Asia/Jerusalem');
  });

  it('labels Jerusalem in Hebrew with an offset', () => {
    const label = formatTimezoneLabel(
      'Asia/Jerusalem',
      new Date('2026-01-15T12:00:00Z'),
    );

    expect(label).toContain('ישראל — ירושלים');
    expect(label).toMatch(/GMT[+-]\d/);
  });

  it('pins Jerusalem at the top of the select list', () => {
    const groups = getTimezoneGroups(null, new Date('2026-01-15T12:00:00Z'));
    const recommended = groups[0];

    expect(recommended?.id).toBe('recommended');
    expect(recommended?.options[0]?.value).toBe('Asia/Jerusalem');
  });

  it('keeps an unknown saved timezone selectable', () => {
    const groups = getTimezoneGroups('Custom/Zone', new Date('2026-01-15T12:00:00Z'));
    const values = groups.flatMap((group) => group.options.map((option) => option.value));

    expect(values).toContain('Custom/Zone');
    expect(groups[0]?.options[0]).toEqual({
      value: 'Custom/Zone',
      label: 'Custom/Zone (ערך קיים)',
    });
  });

  it('filters groups by Hebrew region name without dropping matching zones', () => {
    const groups = getTimezoneGroups(null, new Date('2026-01-15T12:00:00Z'));
    const australia = filterTimezoneGroups(groups, 'אוסטרליה');

    expect(australia).toHaveLength(1);
    expect(australia[0]?.id).toBe('Australia');
    expect(australia[0]?.options.length).toBeGreaterThan(0);
  });
});
