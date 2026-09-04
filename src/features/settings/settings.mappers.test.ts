import { describe, expect, it } from 'vitest';
import {
  formatBusinessField,
  formatStatusCell,
  normalizeDepositPercent,
  parseDepositPercent,
} from './settings.mappers';
import type { AppointmentStatusRow, BusinessSettings } from './settings.types';

const STATUS: AppointmentStatusRow = {
  business_code: 'biz-1',
  status_code: 'scheduled',
  status_text: 'מתוזמן',
  color: '#0d9488',
  created_at: '2026-08-20T08:00:00.000Z',
};

describe('formatStatusCell', () => {
  it('formats visible status fields', () => {
    expect(formatStatusCell(STATUS, 'status_code')).toBe('scheduled');
    expect(formatStatusCell(STATUS, 'status_text')).toBe('מתוזמן');
    expect(formatStatusCell(STATUS, 'color')).toBe('#0d9488');
  });

  it('falls back when color is missing', () => {
    expect(formatStatusCell({ ...STATUS, color: null }, 'color')).toBe(
      'לא הוגדר',
    );
  });
});

describe('deposit percent', () => {
  it('parses numeric strings from Postgres and rejects out of range', () => {
    expect(parseDepositPercent('20.50')).toBe(20.5);
    expect(parseDepositPercent(null)).toBe(0);
    expect(normalizeDepositPercent('')).toBe(0);
    expect(normalizeDepositPercent('15')).toBe(15);
    expect(normalizeDepositPercent(12.345)).toBe(12.35);
    expect(normalizeDepositPercent(101)).toBeNull();
    expect(normalizeDepositPercent(-1)).toBeNull();
    expect(normalizeDepositPercent('x')).toBeNull();
  });

  it('formats the business percent for details', () => {
    const business = {
      deposit_percent: 20,
    } as BusinessSettings;

    expect(formatBusinessField(business, 'deposit_percent')).toBe('20%');
    expect(
      formatBusinessField({ ...business, deposit_percent: 12.5 }, 'deposit_percent'),
    ).toBe('12.5%');
  });
});
